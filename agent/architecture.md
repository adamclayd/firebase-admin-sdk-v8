# Firebase Admin SDK v8 - Cloudflare Workers Compatible

## Overview

This library provides Firebase Admin SDK functionality for Cloudflare Workers and edge runtimes. It uses REST APIs and JWT token generation instead of the Node.js Admin SDK, making it compatible with environments that don't support Node.js.

## Key Features

- ✅ **No Node.js Dependencies** - Pure Web APIs (crypto.subtle, fetch)
- ✅ **JWT Token Generation** - Service account authentication
- ✅ **ID Token Verification** - Verify Firebase ID tokens
- ✅ **Firestore REST API** - CRUD operations via REST
- ✅ **OAuth Access Tokens** - Generate admin API access tokens
- ✅ **Token Caching** - Automatic token refresh before expiry

## Architecture

```
firebase-admin-sdk-v8/
├── src/
│   ├── index.ts                 # Main exports
│   ├── auth.ts                  # Auth operations (verify tokens)
│   ├── token-generation.ts      # JWT/OAuth token generation
│   ├── service-account.ts       # Service account handling
│   ├── firestore-rest.ts        # Firestore REST API wrapper
│   └── types.ts                 # TypeScript types
├── agent/
│   └── architecture.md          # This file
└── package.json
```

## Core Components

### 1. Service Account Management

```typescript
// src/service-account.ts
interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  token_uri: string;
}

export function getServiceAccount(): ServiceAccount {
  const key = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY;
  if (!key) {
    throw new Error('FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY not set');
  }
  return JSON.parse(key);
}
```

### 2. JWT Token Generation

```typescript
// src/token-generation.ts
/**
 * Create JWT for service account authentication
 * Uses Web Crypto API (crypto.subtle) - works in Cloudflare Workers
 */
async function createJWT(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: serviceAccount.token_uri,
    iat: now,
    exp: expiry,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase',
  };

  // Base64URL encode header and payload
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Parse private key from PEM format
  const pemContents = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  // Import private key using Web Crypto API
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Base64URL encode signature
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${unsignedToken}.${encodedSignature}`;
}

/**
 * Get OAuth access token for Firebase Admin API
 * Caches token until expiry to avoid unnecessary generation
 */
let cachedAccessToken: string | null = null;
let tokenExpiry: number = 0;

export async function getAdminAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedAccessToken && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }

  const serviceAccount = getServiceAccount();
  const jwt = await createJWT(serviceAccount);

  // Exchange JWT for access token
  const response = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${await response.text()}`);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000 - 60000; // Refresh 1 min early

  return cachedAccessToken!;
}
```

### 3. ID Token Verification

```typescript
// src/auth.ts
import { Auth, WorkersKVStoreSingle } from 'firebase-auth-cloudflare-workers';

// Simple in-memory cache for JWKs (JSON Web Keys)
class MemoryKeyStore implements WorkersKVStoreSingle {
  private cache = new Map<string, string>();
  
  async get(key: string): Promise<string | null> {
    return this.cache.get(key) || null;
  }
  
  async put(key: string, value: string): Promise<void> {
    this.cache.set(key, value);
  }
}

const keyStore = new MemoryKeyStore();

export function getAuth(): Auth {
  const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('PUBLIC_FIREBASE_PROJECT_ID not set');
  }
  return Auth.getOrInitialize(projectId, keyStore);
}

/**
 * Verify Firebase ID token
 * Uses firebase-auth-cloudflare-workers library
 */
export async function verifyIdToken(idToken: string) {
  const auth = getAuth();
  return await auth.verifyIdToken(idToken);
}

/**
 * Get user info from verified token
 */
export async function getUserFromToken(idToken: string) {
  const decodedToken = await verifyIdToken(idToken);
  return {
    uid: decodedToken.sub,
    email: decodedToken.email || null,
    emailVerified: decodedToken.email_verified || false,
    displayName: decodedToken.name || null,
    photoURL: decodedToken.picture || null,
  };
}
```

### 4. Firestore REST API

```typescript
// src/firestore-rest.ts
import { getAdminAccessToken } from './token-generation';

const FIRESTORE_API = 'https://firestore.googleapis.com/v1';

/**
 * Add a document to Firestore using REST API
 */
export async function addDocument(
  collectionPath: string,
  data: Record<string, any>
): Promise<string> {
  const accessToken = await getAdminAccessToken();
  const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;
  
  const url = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/${collectionPath}`;
  
  // Convert data to Firestore format
  const firestoreData = convertToFirestoreFormat(data);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: firestoreData }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to add document: ${await response.text()}`);
  }
  
  const result = await response.json();
  return result.name.split('/').pop(); // Return document ID
}

/**
 * Get a document from Firestore using REST API
 */
export async function getDocument(
  collectionPath: string,
  documentId: string
): Promise<Record<string, any> | null> {
  const accessToken = await getAdminAccessToken();
  const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;
  
  const url = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/${collectionPath}/${documentId}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (response.status === 404) {
    return null;
  }
  
  if (!response.ok) {
    throw new Error(`Failed to get document: ${await response.text()}`);
  }
  
  const result = await response.json();
  return convertFromFirestoreFormat(result.fields);
}

/**
 * Convert JavaScript object to Firestore format
 */
function convertToFirestoreFormat(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      result[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      result[key] = { integerValue: value };
    } else if (typeof value === 'boolean') {
      result[key] = { booleanValue: value };
    } else if (value === null) {
      result[key] = { nullValue: null };
    } else if (Array.isArray(value)) {
      result[key] = {
        arrayValue: {
          values: value.map(v => convertToFirestoreFormat({ v }).v)
        }
      };
    } else if (typeof value === 'object') {
      result[key] = {
        mapValue: {
          fields: convertToFirestoreFormat(value)
        }
      };
    }
  }
  
  return result;
}

/**
 * Convert Firestore format to JavaScript object
 */
function convertFromFirestoreFormat(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(fields)) {
    if ('stringValue' in value) {
      result[key] = value.stringValue;
    } else if ('integerValue' in value) {
      result[key] = parseInt(value.integerValue);
    } else if ('booleanValue' in value) {
      result[key] = value.booleanValue;
    } else if ('nullValue' in value) {
      result[key] = null;
    } else if ('arrayValue' in value) {
      result[key] = value.arrayValue.values.map((v: any) => 
        convertFromFirestoreFormat({ v }).v
      );
    } else if ('mapValue' in value) {
      result[key] = convertFromFirestoreFormat(value.mapValue.fields);
    }
  }
  
  return result;
}
```

## Usage Examples

### Verify ID Token

```typescript
import { verifyIdToken, getUserFromToken } from 'firebase-admin-sdk-v8';

// In a server function
const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
const decodedToken = await verifyIdToken(idToken);
console.log('User ID:', decodedToken.sub);

// Or get full user info
const user = await getUserFromToken(idToken);
console.log('User:', user);
```

### Store Data in Firestore

```typescript
import { addDocument } from 'firebase-admin-sdk-v8';

const tokenData = {
  email: 'user@example.com',
  token: crypto.randomUUID(),
  used: false,
  createdAt: Date.now(),
  expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
};

const docId = await addDocument('password-resets', tokenData);
console.log('Created document:', docId);
```

## Environment Variables

```env
# Firebase Admin Service Account (JSON string)
FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# Firebase Project ID (for REST API calls)
PUBLIC_FIREBASE_PROJECT_ID=your-project-id
```

## Dependencies

```json
{
  "dependencies": {
    "firebase-auth-cloudflare-workers": "^1.0.0"
  }
}
```

## Key Differences from Node.js Admin SDK

| Feature | Node.js Admin SDK | This Library |
|---------|------------------|--------------|
| **Environment** | Node.js only | Cloudflare Workers, Edge |
| **Auth** | Admin SDK methods | JWT + REST API |
| **Firestore** | Native SDK | REST API |
| **Token Verification** | Built-in | firebase-auth-cloudflare-workers |
| **Dependencies** | Heavy (Node.js) | Lightweight (Web APIs) |

## Benefits

1. **Edge Compatible** - Runs in Cloudflare Workers, Deno, Bun
2. **Lightweight** - No Node.js dependencies
3. **Fast Cold Starts** - Minimal bundle size
4. **Secure** - Uses Web Crypto API for signing
5. **Cached Tokens** - Automatic token refresh

## Related

- [firebase-client-v8](../firebase-client-v8) - Client-side Firebase library
- [agentbase.me](../agentbase.me) - Uses both libraries for auth
