# Firebase Admin SDK v8

> Firebase Admin SDK for Cloudflare Workers and edge runtimes using REST APIs

[![npm version](badges/npm-version.svg)](https://www.npmjs.com/package/@intuitive-perception/firebase-admin-sdk-v8)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Unit Tests](badges/unit-tests.svg)](https://github.com/adamclayd/firebase-admin-sdk-v8/actions/workflows/test.yml)
[![E2E Tests](badges/e2e-tests.svg)](https://github.com/adamclayd/firebase-admin-sdk-v8/actions/workflows/e2e-tests.yml)

This library provides Firebase Admin SDK functionality for Cloudflare Workers and other edge runtimes. It uses REST APIs and JWT token generation instead of the Node.js Admin SDK, making it compatible with environments that don't support Node.js. You can use the Firebase emulators with the supported APIs with this fork of firebase-admin-sdk-v8.

## ✨ Features

- ✅ **Zero Dependencies** - No external dependencies, pure Web APIs (crypto.subtle, fetch)
- ✅ **JWT Token Generation** - Service account authentication
- ✅ **ID Token Verification** - Verify Firebase ID tokens (supports v9 and v10 formats)
- ✅ **Session Cookies** - Create and verify long-lived session cookies (up to 14 days)
- ✅ **User Management** - Create, read, update, delete users via Admin API
- ✅ **Firebase v10 Compatible** - Supports both old and new token issuer formats
- ✅ **Firestore REST API** - Full CRUD operations via REST
- ✅ **Field Value Operations** - increment, arrayUnion, arrayRemove, serverTimestamp, delete
- ✅ **Advanced Queries** - where, orderBy, limit, offset, cursor pagination
- ✅ **Batch Operations** - Atomic multi-document writes
- ✅ **Merge Operations** - Merge documents with existing data
- ✅ **OAuth Access Tokens** - Generate admin API access tokens
- ✅ **Token Caching** - Automatic token refresh before expiry
- ✅ **TypeScript** - Full type definitions included
- ✅ **Emulators** - Use with Firebase emulators for local development

## 📦 Installation

```bash
npm install @intuitive-perception/firebase-admin-sdk-v8
```

## 🚀 Quick Start

### 1. Initialize the SDK

**Option A: Cloudflare Workers / Edge Runtimes (Recommended)**

```typescript
import { initializeApp, verifyIdToken } from '@intuitive-perception/firebase-admin-sdk-v8';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Initialize with env variables
    initializeApp({
      serviceAccount: env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY,
      projectId: env.FIREBASE_PROJECT_ID,

      apiKey: env.FIREBASE_API_KEY,

      // optional - use for local development
      authEmulatorHost: env.FIREBASE_AUTH_EMULATOR_HOST,
      firestoreEmulatorHost: env.FIREBASE_FIRESTORE_EMULATOR_HOST,
      storageEmulatorHost: env.FIREBASE_STORAGE_EMULATOR_HOST,
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
import { initializeApp } from '@intuitive-perception/firebase-admin-sdk-v8';

// Option 1: Explicit initialization
initializeApp({
  serviceAccount: JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY!),
  projectId: process.env.FIREBASE_PROJECT_ID,

  apiKey: process.env.FIREBASE_API_KEY,

  // optional - use for local development
  authEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST,
  firestoreEmulatorHost: process.env.FIREBASE_FIRESTORE_EMULATOR_HOST,
  storageEmulatorHost: process.env.FIREBASE_STORAGE_EMULATOR_HOST
});

// Option 2: Auto-detect from process.env (no initialization needed)
// The SDK will automatically use process.env if initializeApp() is not called
```

**Environment Variables (if not using initializeApp):**
```env
FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your-api-key

# use for local development
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIREBASE_FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199
```

* **Notes:**
  * If a particular emulator setting is provided it will override the production setting. So make sure you have all of the emulator environment variables and `initializeApp()` settings cleared when deploying to production. 
  * On worker environments like Cloudflare it does not default to any environment variables so you have to call `initializeApp()` with the appropriate settings for your environment.


### Initializing And Starting The Emulators
If you are going to be using the Firebase emulators for local development you need to run these commands:

Install Firebase Cli:
```bash
npm install -g firebase-tools
```

Initialize:
```bash
firebase init emulators
# > select Firestore, Authentication, an/or Storage when asked
```

Start:
```bash
firebase emulators:start
```

### 2. Verify ID Tokens

```typescript
import { verifyIdToken, getUserFromToken } from '@intuitive-perception/firebase-admin-sdk-v8';

const authHeader = request.headers.get('authorization');
const idToken = authHeader?.split('Bearer ')[1];

try {
  const user = await getUserFromToken(idToken);
  console.log('User:', user.email, user.displayName);
} catch (error) {
  return new Response('Invalid token', { status: 401 });
}
```

### 3. Session Cookies (Long-Lived Sessions)

```typescript
import { createSessionCookie, verifySessionCookie } from '@intuitive-perception/firebase-admin-sdk-v8';

// Create 14-day session cookie from ID token
const sessionCookie = await createSessionCookie(idToken, {
  expiresIn: 60 * 60 * 24 * 14 * 1000
});

// Set as HTTP-only cookie
response.headers.set('Set-Cookie',
  `session=${sessionCookie}; Max-Age=1209600; HttpOnly; Secure; SameSite=Strict`
);

// Verify session cookie
const user = await verifySessionCookie(cookie);
```

### 4. Basic Firestore Operations

```typescript
import { setDocument, getDocument, updateDocument, FieldValue } from '@intuitive-perception/firebase-admin-sdk-v8';

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
import { queryDocuments } from '@intuitive-perception/firebase-admin-sdk-v8';

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

#### Configure For Production Or Local Emulators
```typescript
import { initializeApp } from '@intuitive-perception/firebase-admin-sdk-v8';

// For local emulators
initializeApp({
  authEmulatorHost: env.FIREBASE_AUTH_EMULATOR_HOST, // 127.0.0.1:9099
  projectId: env.FIREBASE_PROJECT_ID,  // test-project-id
  apiKey: env.FIREBASE_API_KEY // test-api-key
});

// For production
initializeApp({
  serviceAccount: JSON.parse(env.FIREBASE_SERVICE_ACCOUNT),
  projectId: env.FIREBASE_PROJECT_ID,
  apiKey: env.FIREBASE_API_KEY
});
```
* **Notes For Emulator:**
  * Your Authentication URLs will point the emulator instead of the production Firebase Auth service.
  * If you have the emulator configured it will override the production settings.
  * `projectId` is required for the emulator to work. It can be any string. Just make sure the ones on your frontend match the ones on the backend
  * `apiKey` is not required unless you plan to use a call like like `signInWithCustomToken` that requires an API key. It can be any string. Just make sure the frontend API key match the ones on the backend
  * `authEmulatorHost` will fall back to `FIREBASE_AUTH_EMULATOR_HOST` environment variable if not provided or undefined.

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

### User Management

#### `getUserByEmail(email: string): Promise<UserRecord | null>`

Look up a Firebase user by email address.

```typescript
const user = await getUserByEmail('user@example.com');
if (user) {
  console.log('User ID:', user.uid);
  console.log('Email verified:', user.emailVerified);
}
```

#### `getUserByUid(uid: string): Promise<UserRecord | null>`

Look up a Firebase user by UID.

```typescript
const user = await getUserByUid('user123');
if (user) {
  console.log('Email:', user.email);
  console.log('Display name:', user.displayName);
}
```

#### `createUser(properties: CreateUserRequest): Promise<UserRecord>`

Create a new Firebase user.

```typescript
const newUser = await createUser({
  email: 'newuser@example.com',
  password: 'securePassword123',
  displayName: 'New User',
  emailVerified: false,
});
console.log('Created user:', newUser.uid);
```

#### `updateUser(uid: string, properties: UpdateUserRequest): Promise<UserRecord>`

Update an existing Firebase user.

```typescript
const updatedUser = await updateUser('user123', {
  displayName: 'Updated Name',
  photoURL: 'https://example.com/photo.jpg',
  emailVerified: true,
});
```

#### `deleteUser(uid: string): Promise<void>`

Delete a Firebase user.

```typescript
await deleteUser('user123');
```

#### `listUsers(maxResults?: number, pageToken?: string): Promise<ListUsersResult>`

List all users with pagination.

```typescript
// List first 100 users
const result = await listUsers(100);
console.log('Users:', result.users.length);

// Get next page
if (result.pageToken) {
  const nextPage = await listUsers(100, result.pageToken);
}
```

#### `setCustomUserClaims(uid: string, customClaims: Record<string, any> | null): Promise<void>`

Set custom claims on a user's ID token for role-based access control.

```typescript
// Set custom claims
await setCustomUserClaims('user123', {
  role: 'admin',
  premium: true,
  permissions: ['read', 'write', 'delete'],
});

// Clear custom claims
await setCustomUserClaims('user123', null);
```

### Firestore - Basic Operations

#### Configure For Production Or Local Emulators
```typescript
import { initializeApp } from '@intuitive-perception/firebase-admin-sdk-v8';

// For local emulators
initializeApp({
  firestoreEmulatorHost: env.FIRESTORE_EMULATOR_HOST, // 127.0.0.1:8080
  projectId: env.FIREBASE_PROJECT_ID,  // test-project-id
});

// For production
initializeApp({
  serviceAccount: JSON.parse(env.FIREBASE_SERVICE_ACCOUNT),
  projectId: env.FIREBASE_PROJECT_ID,
});
```
* **Notes For Emulator:**
  * Your Firestore URLs will point the emulator instead of the production Firebase Firestore service.
  * If you have the emulator configured it will override the production settings.
  * `projectId` is required for the emulator to work. It can be any string. Just make sure the ones on your frontend match the ones on the backend
  * `firestoreEmulatorHost` will fall back to `FIREBASE_FIRESTORE_EMULATOR_HOST` environment variable if not provided or undefined.

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

#### `getAdminAccessToken(emulated: boolean = false): Promise<string>`

Get an OAuth access token for Firebase Admin API. Automatically cached and refreshed.

```typescript
// if your are on the production environment
const token = await getAdminAccessToken();

// if your are on the emulator environment
const token = await getAdminAccessToken(true);
```

#### Adding Custom Token Cache Store
If you need to use a different cache for the admin access token, you can provide your own implementation of `CacheAdminAccessTokenStore` to the `initializeApp()` function. The default assigns it to one variable in memory and will expire in exp - 60 seconds. The default will not work in a worker environment like Cloudflare because the variable will not persist between requests. See the example below:

```typescript
import { initializeApp } from '@intuitive-perception/firebase-admin-sdk-v8';
import { CacheAdminAccessTokenStore, TokenResponse } from '@intuitive-perception/firebase-admin-sdk-v8';
import { Redis } from "@upstash/redis/cloudflare";

class RedisTokenStore extends CacheAdminAccessTokenStore {
  protected constructor(token: symbol, private redis: Redis) {}

  async get(): Promise<string | null> {
    return await this.redis.getex('firebase:admin-access-token');
  }

  async set(data: TokenResponse): Promise<void> {
    return await this.redis.set('firebase:admin-access-token', data.access_token, { ex: data.expires_in - 60 });
  }

  async clear() {
    await this.redis.del('firebase:admin-access-token');
  }
}

export default {
  async fetch(request: Request, env: Env) {
    initializeApp({
      serviceAccount: env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY,
      projectId: env.FIREBASE_PROJECT_ID,
      apiKey: env.FIREBASE_API_KEY,

      // provide your custom token store
      cachedAdminAccessTokenStore: RedisTokenStore.getinstance(Redis.fromEnv(env)),
    });

    // use firebase-admin-sdk-v8
  }
}
```

Your app will now use the Cloudflare Redis instance for admin access token caching. If your app is hosted in a stateless mannor you would want to make a custom implemention because the admin token is not cahced in a stateless environment. So it would have to generate a new admin access token for every call. Implementing it would keep your server call from having to make an extra api request.

 - Implemention
   - `constuctor` must accept at least a token parameter of type `symbol` as its first parameter to be passed to the base class constructor. This is to ensure that no child classes get initialiated directly with the `new` operator
   - All implementations come with a static `getInstance` method inherited from the abstract base class that will return the saved instance or a new instance of the token store so that there is only ever one instance of it implemented. You can pass whatever additional parameters that your constructor accepts to it.
   - `get` must be implemented with no parameters and must return a `Promise<string | undefined>`
   - `set` must be implemented with a single `TokenResponse` parameter and must return a `Promise<void>`
   - `clear` must be implemented with no parameters and must return a `Promise<void>`

#### Clearing Admin Access Token Cache
```typescript
import { getAdminTokenStore } from '@intuitive-perception/firebase-admin-sdk-v8';

await getAdminTokenStore().clear();
```

### Storage - Resumable Uploads

#### Configure For Production Or Local Emulators
```typescript
import { initializeApp } from '@intuitive-perception/firebase-admin-sdk-v8';

// For local emulators
initializeApp({
  storageEmulatorHost: env.FIREBASE_STORAGE_EMULATOR_HOST, // 127.0.0.1:9099
  projectId: env.FIREBASE_PROJECT_ID,  // test-project-id
});

// For production
initializeApp({
  serviceAccount: JSON.parse(env.FIREBASE_SERVICE_ACCOUNT),
  projectId: env.FIREBASE_PROJECT_ID,
});
```
* **Notes For Emulator:**
  * Your Storage URLs will point the emulator instead of the production Firebase Storage service.
  * If you have the emulator configured it will override the production settings.
  * `projectId` is required for the emulator to work. It can be any string. Just make sure the ones on your frontend match the ones on the backend
  * `storageEmulatorHost` will fall back to `FIREBASE_STORAGE_EMULATOR_HOST` environment variable if not provided or undefined.

#### `uploadFileResumable(bucket, path, data, contentType, options?): Promise<FileMetadata>`

Upload large files with resumable upload support. Suitable for files >10MB, unreliable networks, or when progress tracking is needed.

**Features:**
- ✅ Chunked uploads (configurable chunk size)
- ✅ Progress tracking with callbacks
- ✅ Resume interrupted uploads
- ✅ Memory efficient (doesn't load entire file at once)
- ✅ Automatic retry on chunk failure

```typescript
import { uploadFileResumable } from '@intuitive-perception/firebase-admin-sdk-v8';

// Upload large file with progress tracking
const data = await fetch('https://example.com/large-video.mp4');
const buffer = await data.arrayBuffer();

const metadata = await uploadFileResumable(
  'my-bucket.appspot.com',
  'videos/large.mp4',
  buffer,
  'video/mp4',
  {
    chunkSize: 512 * 1024, // 512KB chunks (default: 256KB)
    onProgress: (uploaded, total) => {
      const percent = (uploaded / total * 100).toFixed(2);
      console.log(`Upload progress: ${percent}%`);
    },
    metadata: { userId: '123', category: 'videos' },
  }
);

console.log('Upload complete:', metadata);
```

**Resume interrupted upload:**

```typescript
let sessionUri: string;

try {
  const metadata = await uploadFileResumable(
    bucket,
    path,
    data,
    contentType,
    {
      onProgress: (uploaded, total) => {
        // Save session URI for resume
        sessionUri = /* get from response */;
      },
    }
  );
} catch (error) {
  // Resume from where it left off
  const metadata = await uploadFileResumable(
    bucket,
    path,
    data,
    contentType,
    {
      resumeToken: sessionUri, // Resume from previous session
    }
  );
}
```

**When to use:**
- Files larger than 10MB
- Unreliable network conditions
- Need progress reporting
- Files that may exceed memory limits

**When to use simple `uploadFile()` instead:**
- Small files (<10MB)
- Reliable network
- No progress tracking needed
- Edge runtime with memory constraints

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
import { queryDocuments, updateDocument, FieldValue } from '@intuitive-perception/firebase-admin-sdk-v8';

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
import { batchWrite, FieldValue } from '@intuitive-perception/firebase-admin-sdk-v8';

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
| ID Token Verification | ✅ | Supports v9 and v10 token formats |
| Custom Token Creation | ✅ | createCustomToken() |
| Custom Token Exchange | ✅ | signInWithCustomToken() |
| User Management | ✅ | Create, read, update, delete, list users |
| Firestore CRUD | ✅ | Full support |
| Firestore Queries | ✅ | where, orderBy, limit, cursors |
| Firestore Batch | ✅ | Up to 500 operations |
| Firestore Transactions | ❌ | Not yet implemented |
| **Realtime Listeners** | **❌** | **See explanation below** |
| Field Values | ✅ | increment, arrayUnion, serverTimestamp, etc. |
| Realtime Database | ❌ | Not planned |
| Cloud Storage | ✅ | Upload, download, delete, signed URLs |
| Cloud Messaging | ❌ | Not yet implemented |

## ⚠️ Realtime Listeners Not Supported

This library **does not support** Firestore realtime listeners (`onSnapshot()`). Here's why:

### Technical Limitation

**This library uses the Firestore REST API**, which is:
- ✅ Stateless (request/response only)
- ✅ Compatible with edge runtimes (Cloudflare Workers, Vercel Edge)
- ❌ **No persistent connections**
- ❌ **No server-push capabilities**
- ❌ **No streaming support**

**Realtime listeners require**:
- Persistent connections (WebSocket or gRPC)
- Bidirectional streaming
- Server-push architecture

The Firestore REST API simply doesn't provide these capabilities.

### Why Not Implement gRPC?

While Firestore does offer a gRPC API with streaming support, implementing it would require:

1. **Complex Protocol Implementation**
   - HTTP/2 framing
   - gRPC message framing
   - Protobuf encoding/decoding
   - Authentication flow
   - Reconnection logic
   - ~100+ hours of development

2. **Runtime Limitations**
   - Cloudflare Workers doesn't support full gRPC (only gRPC-Web)
   - gRPC-Web requires a proxy server
   - Can't connect directly to Firestore's gRPC endpoint
   - Would only work in Durable Objects, not regular Workers

3. **Maintenance Burden**
   - Must keep up with Firestore protocol changes
   - Complex debugging and error handling
   - High ongoing maintenance cost

### Alternatives

If you need realtime updates, consider these approaches:

#### 1. **Polling (Simple)**
```typescript
// Poll for changes every 5 seconds
setInterval(async () => {
  const doc = await getDocument('users', 'user123');
  // Handle updates
}, 5000);
```

**Pros**: Simple, works everywhere
**Cons**: 5-second delay, polling costs

#### 2. **Durable Objects + Polling (Better)**
```typescript
// Durable Object polls once, broadcasts to many clients
export class FirestoreSync {
  async poll() {
    const doc = await getDocument('users', 'user123');
    // Broadcast to all connected WebSocket clients
    for (const ws of this.sessions) {
      ws.send(JSON.stringify(doc));
    }
  }
}
```

**Pros**: One poll serves many clients, WebSocket push to clients
**Cons**: Still polling-based, Cloudflare-specific

#### 3. **Hybrid Architecture (Best)**
```typescript
// Use firebase-admin-node for realtime in Node.js
import admin from 'firebase-admin';

admin.firestore().collection('users').doc('user123')
  .onSnapshot((snapshot) => {
    // True realtime updates
    console.log('Update:', snapshot.data());
  });

// Use this library for CRUD in edge functions
import { getDocument } from '@intuitive-perception/firebase-admin-sdk-v8';
const doc = await getDocument('users', 'user123');
```

**Pros**: True realtime where needed, edge performance for CRUD
**Cons**: Requires separate Node.js service

#### 4. **Firebase Client SDK (Frontend)**
```typescript
// Use Firebase Client SDK in browser/mobile
import { onSnapshot, doc } from 'firebase/firestore';

onSnapshot(doc(db, 'users', 'user123'), (snapshot) => {
  console.log('Update:', snapshot.data());
});
```

**Pros**: True realtime, built-in, well-supported
**Cons**: Client-side only, requires Firebase Auth

### Recommendation

- **For edge runtimes**: Use polling or Durable Objects pattern
- **For true realtime**: Use `firebase-admin-node` in Node.js
- **For client apps**: Use Firebase Client SDK
- **For hybrid**: Use this library for CRUD + Node.js for realtime

### Related

- [firebase-admin-node](https://github.com/firebase/firebase-admin-node) - Full Admin SDK with realtime support
- [Firebase Client SDK](https://firebase.google.com/docs/firestore/query-data/listen) - Client-side realtime listeners

## 🗺️ Roadmap

- [x] Custom token creation ✅ (v2.2.0)
- [x] Custom token exchange ✅ (v2.2.0)
- [x] Cloud Storage operations ✅ (v2.2.0)
- [ ] User management (create, update, delete users)
- [ ] Firestore transactions
- [ ] More comprehensive error handling
- [ ] Rate limiting helpers
- [ ] Retry logic for failed operations
- [ ] Storage unit tests (currently only e2e)
