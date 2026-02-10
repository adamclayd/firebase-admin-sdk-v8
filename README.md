# Firebase Admin SDK v8

> Firebase Admin SDK for Cloudflare Workers and edge runtimes using REST APIs

[![npm version](https://img.shields.io/npm/v/firebase-admin-sdk-v8.svg)](https://www.npmjs.com/package/firebase-admin-sdk-v8)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This library provides Firebase Admin SDK functionality for Cloudflare Workers and other edge runtimes. It uses REST APIs and JWT token generation instead of the Node.js Admin SDK, making it compatible with environments that don't support Node.js.

## ✨ Features

- ✅ **Zero Dependencies** - No external dependencies, pure Web APIs (crypto.subtle, fetch)
- ✅ **JWT Token Generation** - Service account authentication
- ✅ **ID Token Verification** - Verify Firebase ID tokens (supports v9 and v10 formats)
- ✅ **Firebase v10 Compatible** - Supports both old and new token issuer formats
- ✅ **Firestore REST API** - Full CRUD operations via REST
- ✅ **Field Value Operations** - increment, arrayUnion, arrayRemove, serverTimestamp, delete
- ✅ **Advanced Queries** - where, orderBy, limit, offset, cursor pagination
- ✅ **Batch Operations** - Atomic multi-document writes
- ✅ **Merge Operations** - Merge documents with existing data
- ✅ **OAuth Access Tokens** - Generate admin API access tokens
- ✅ **Token Caching** - Automatic token refresh before expiry
- ✅ **TypeScript** - Full type definitions included

## 📦 Installation

```bash
npm install firebase-admin-sdk-v8
```

## 🚀 Quick Start

### 1. Initialize the SDK

**Option A: Cloudflare Workers / Edge Runtimes (Recommended)**

```typescript
import { initializeApp, verifyIdToken } from '@prmichaelsen/firebase-admin-sdk-v8';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Initialize with env variables
    initializeApp({
      serviceAccount: env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY,
      projectId: env.FIREBASE_PROJECT_ID
    });

    // Now use the SDK
    const token = request.headers.get('authorization')?.split('Bearer ')[1];
    const user = await verifyIdToken(token);
    
    return new Response(JSON.stringify({ user }));
  }
};
```

**Option B: Node.js / Traditional Environments**

```typescript
import { initializeApp } from '@prmichaelsen/firebase-admin-sdk-v8';

// Option 1: Explicit initialization
initializeApp({
  serviceAccount: JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY!),
  projectId: process.env.FIREBASE_PROJECT_ID
});

// Option 2: Auto-detect from process.env (no initialization needed)
// The SDK will automatically use process.env if initializeApp() is not called
```

**Environment Variables (if not using initializeApp):**
```env
FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
FIREBASE_PROJECT_ID=your-project-id
```

### 2. Verify ID Tokens

```typescript
import { verifyIdToken, getUserFromToken } from 'firebase-admin-sdk-v8';

const authHeader = request.headers.get('authorization');
const idToken = authHeader?.split('Bearer ')[1];

try {
  const user = await getUserFromToken(idToken);
  console.log('User:', user.email, user.displayName);
} catch (error) {
  return new Response('Invalid token', { status: 401 });
}
```

### 3. Basic Firestore Operations

```typescript
import { setDocument, getDocument, updateDocument, FieldValue } from 'firebase-admin-sdk-v8';

// Set a document (create or overwrite)
await setDocument('users', 'user123', {
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: FieldValue.serverTimestamp(),
});

// Get a document
const user = await getDocument('users', 'user123');

// Update with field values
await updateDocument('users', 'user123', {
  loginCount: FieldValue.increment(1),
  lastLogin: FieldValue.serverTimestamp(),
});
```

### 4. Advanced Queries

```typescript
import { queryDocuments } from 'firebase-admin-sdk-v8';

const activeUsers = await queryDocuments('users', {
  where: [
    { field: 'active', op: '==', value: true },
    { field: 'age', op: '>=', value: 18 }
  ],
  orderBy: [{ field: 'createdAt', direction: 'DESCENDING' }],
  limit: 10
});
```

## 📚 API Reference

### Authentication

#### `verifyIdToken(idToken: string): Promise<DecodedIdToken>`

Verify a Firebase ID token and return the decoded token.

```typescript
const decoded = await verifyIdToken(idToken);
console.log('User ID:', decoded.uid);
```

#### `getUserFromToken(idToken: string): Promise<UserInfo>`

Get user information from a verified ID token.

```typescript
const user = await getUserFromToken(idToken);
// Returns: { uid, email, emailVerified, displayName, photoURL }
```

### Firestore - Basic Operations

#### `setDocument(collectionPath, documentId, data, options?): Promise<void>`

Create or overwrite a document. Supports merge options.

```typescript
// Overwrite
await setDocument('users', 'user123', { name: 'John', age: 30 });

// Merge with existing
await setDocument('users', 'user123', { age: 31 }, { merge: true });

// Merge specific fields
await setDocument('users', 'user123', { age: 31, city: 'NYC' }, { 
  mergeFields: ['age'] 
});
```

#### `addDocument(collectionPath, data, documentId?): Promise<DocumentReference>`

Add a document with auto-generated or custom ID. Returns a DocumentReference with `id` and `path` properties.

```typescript
const docRef = await addDocument('posts', { title: 'Hello' });
console.log('Created:', docRef.id); // Auto-generated ID

const customDocRef = await addDocument('posts', { title: 'Hi' }, 'custom-id');
console.log('Created:', customDocRef.id); // 'custom-id'
```

#### `getDocument(collectionPath, documentId): Promise<DataObject | null>`

Get a document by ID.

```typescript
const user = await getDocument('users', 'user123');
```

#### `updateDocument(collectionPath, documentId, data): Promise<void>`

Update specific fields in a document.

```typescript
await updateDocument('users', 'user123', { lastLogin: new Date() });
```

#### `deleteDocument(collectionPath, documentId): Promise<void>`

Delete a document.

```typescript
await deleteDocument('users', 'user123');
```

### Firestore - Field Values

#### `FieldValue.serverTimestamp()`

Set field to server timestamp.

```typescript
await setDocument('posts', 'post1', {
  createdAt: FieldValue.serverTimestamp()
});
```

#### `FieldValue.increment(n)`

Increment a numeric field.

```typescript
await updateDocument('users', 'user1', {
  loginCount: FieldValue.increment(1),
  points: FieldValue.increment(10)
});
```

#### `FieldValue.arrayUnion(...elements)`

Add elements to an array (no duplicates).

```typescript
await updateDocument('posts', 'post1', {
  tags: FieldValue.arrayUnion('javascript', 'typescript')
});
```

#### `FieldValue.arrayRemove(...elements)`

Remove elements from an array.

```typescript
await updateDocument('posts', 'post1', {
  tags: FieldValue.arrayRemove('outdated')
});
```

#### `FieldValue.delete()`

Delete a field from a document.

```typescript
await updateDocument('users', 'user1', {
  temporaryField: FieldValue.delete()
});
```

### Firestore - Queries

#### `queryDocuments(collectionPath, options?): Promise<Array<{ id, data }>>`

Query documents with advanced filtering.

**Query Options:**
- `where`: Array of filters `{ field, op, value }`
- `orderBy`: Array of orders `{ field, direction }`
- `limit`: Maximum number of results
- `offset`: Number of results to skip
- `startAt`, `startAfter`, `endAt`, `endBefore`: Cursor pagination

**Where Operators:**
- `==`, `!=`, `<`, `<=`, `>`, `>=`
- `array-contains`, `array-contains-any`
- `in`, `not-in`

```typescript
// Simple query
const users = await queryDocuments('users');

// With filters
const activeAdults = await queryDocuments('users', {
  where: [
    { field: 'active', op: '==', value: true },
    { field: 'age', op: '>=', value: 18 }
  ]
});

// With ordering and limit
const topUsers = await queryDocuments('users', {
  where: [{ field: 'active', op: '==', value: true }],
  orderBy: [{ field: 'points', direction: 'DESCENDING' }],
  limit: 10
});

// Cursor pagination
const results = await queryDocuments('users', {
  orderBy: [{ field: 'createdAt', direction: 'ASCENDING' }],
  startAfter: [lastCreatedAt],
  limit: 20
});
```

### Firestore - Batch Operations

#### `batchWrite(operations): Promise<BatchWriteResult>`

Perform multiple write operations atomically.

```typescript
await batchWrite([
  {
    type: 'set',
    collectionPath: 'users',
    documentId: 'user1',
    data: { name: 'John' }
  },
  {
    type: 'update',
    collectionPath: 'users',
    documentId: 'user2',
    data: { lastLogin: FieldValue.serverTimestamp() }
  },
  {
    type: 'delete',
    collectionPath: 'users',
    documentId: 'user3'
  }
]);
```

### Token Generation

#### `getAdminAccessToken(): Promise<string>`

Get an OAuth access token for Firebase Admin API. Automatically cached and refreshed.

```typescript
const token = await getAdminAccessToken();
```

#### `clearTokenCache(): void`

Clear the cached access token.

```typescript
clearTokenCache();
```

## 💡 Examples

See [EXAMPLES.md](./EXAMPLES.md) for comprehensive examples including:
- Authentication patterns
- Field value operations
- Complex queries
- Batch operations
- Real-world use cases

## 🔧 Advanced Usage

### Cloudflare Workers Example

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY = env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY;
    process.env.PUBLIC_FIREBASE_PROJECT_ID = env.PUBLIC_FIREBASE_PROJECT_ID;

    const authHeader = request.headers.get('authorization');
    const idToken = authHeader?.split('Bearer ')[1];

    if (!idToken) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const user = await getUserFromToken(idToken);
      
      // Track user activity
      await updateDocument('users', user.uid, {
        lastSeen: FieldValue.serverTimestamp(),
        visitCount: FieldValue.increment(1)
      });

      return new Response(JSON.stringify({ user }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response('Error: ' + error.message, { status: 500 });
    }
  },
};
```

### Leaderboard Example

```typescript
import { queryDocuments, updateDocument, FieldValue } from 'firebase-admin-sdk-v8';

async function getTopPlayers(limit = 10) {
  return await queryDocuments('players', {
    where: [{ field: 'active', op: '==', value: true }],
    orderBy: [{ field: 'score', direction: 'DESCENDING' }],
    limit
  });
}

async function updatePlayerScore(playerId: string, points: number) {
  await updateDocument('players', playerId, {
    score: FieldValue.increment(points),
    lastPlayed: FieldValue.serverTimestamp()
  });
}
```

### Bulk Operations Example

```typescript
import { batchWrite, FieldValue } from 'firebase-admin-sdk-v8';

async function bulkUpdateUsers(userIds: string[], updates: any) {
  const operations = userIds.map(userId => ({
    type: 'update' as const,
    collectionPath: 'users',
    documentId: userId,
    data: {
      ...updates,
      updatedAt: FieldValue.serverTimestamp()
    }
  }));
  
  // Process in chunks of 500 (Firestore batch limit)
  for (let i = 0; i < operations.length; i += 500) {
    const chunk = operations.slice(i, i + 500);
    await batchWrite(chunk);
  }
}
```

## 🆚 Comparison with Node.js Admin SDK

| Feature | Node.js Admin SDK | This Library |
|---------|------------------|--------------|
| **Environment** | Node.js only | Cloudflare Workers, Edge, Deno, Bun |
| **Auth** | Admin SDK methods | JWT + REST API |
| **Firestore** | Native SDK | REST API |
| **Field Values** | ✅ Full support | ✅ Full support |
| **Queries** | ✅ Full support | ✅ Full support |
| **Batch Writes** | ✅ Full support | ✅ Full support |
| **Token Verification** | Built-in | firebase-auth-cloudflare-workers |
| **Dependencies** | Heavy (Node.js) | Lightweight (Web APIs) |
| **Cold Starts** | Slower | Faster |
| **Bundle Size** | Large | Small |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

## 🔗 Related Projects

- [firebase-auth-cloudflare-workers](https://github.com/Code-Hex/firebase-auth-cloudflare-workers) - ID token verification library
- [Firebase REST API Documentation](https://firebase.google.com/docs/firestore/use-rest-api)

## 📝 Notes

- This library is designed for server-side use only (admin operations)
- For client-side Firebase, use the official Firebase JS SDK
- Service account credentials should be kept secure and never exposed to clients
- Token caching is automatic and refreshes 1 minute before expiry
- Batch operations support up to 500 operations per batch (Firestore limit)

## 🐛 Troubleshooting

### "FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY not set"

Make sure you've set the environment variable with your service account JSON:

```typescript
process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY = JSON.stringify(serviceAccount);
```

### "Failed to verify ID token"

Ensure the token is:
1. A valid Firebase ID token (not an access token)
2. Not expired
3. From the correct Firebase project

### TypeScript Errors

Make sure you have the required dev dependencies:

```bash
npm install -D @types/node typescript
```

### Query Performance

For better query performance:
- Create composite indexes for multi-field queries
- Use cursor pagination instead of offset for large datasets
- Limit query results to reasonable sizes

## 📊 Feature Comparison Table

| Feature | Supported | Notes |
|---------|-----------|-------|
| ID Token Verification | ✅ | Via firebase-auth-cloudflare-workers |
| Custom Token Creation | ❌ | Not yet implemented |
| User Management | ❌ | Not yet implemented |
| Firestore CRUD | ✅ | Full support |
| Firestore Queries | ✅ | where, orderBy, limit, cursors |
| Firestore Batch | ✅ | Up to 500 operations |
| Firestore Transactions | ❌ | Not yet implemented |
| Field Values | ✅ | increment, arrayUnion, serverTimestamp, etc. |
| Realtime Database | ❌ | Not planned |
| Cloud Storage | ❌ | Not yet implemented |
| Cloud Messaging | ❌ | Not yet implemented |

## 🗺️ Roadmap

- [ ] Custom token creation
- [ ] User management (create, update, delete users)
- [ ] Firestore transactions
- [ ] Cloud Storage operations
- [ ] More comprehensive error handling
- [ ] Rate limiting helpers
- [ ] Retry logic for failed operations
