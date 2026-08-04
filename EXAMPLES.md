# Firebase Admin SDK v8 - Advanced Examples

This document provides comprehensive examples of all features in the Firebase Admin SDK v8.

## Table of Contents

- [Authentication](#authentication)
- [Basic Firestore Operations](#basic-firestore-operations)
- [Field Value Operations](#field-value-operations)
- [Advanced Queries](#advanced-queries)
- [Batch Operations](#batch-operations)
- [Merge Operations](#merge-operations)

## Authentication

### Verify ID Token

```typescript
import { verifyIdToken, getUserFromToken } from 'firebase-admin-sdk-v8';

// Verify token and get decoded claims
const decodedToken = await verifyIdToken(idToken);
console.log('User ID:', decodedToken.uid);
console.log('Email:', decodedToken.email);

// Get user info in a convenient format
const user = await getUserFromToken(idToken);
console.log('User:', user.uid, user.email, user.displayName);
```

## Basic Firestore Operations

### Set Document (Create or Overwrite)

```typescript
import { setDocument } from 'firebase-admin-sdk-v8';

// Create or completely overwrite a document
await setDocument('users', 'user123', {
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  active: true,
});
```

### Add Document (Auto-generate ID)

```typescript
import { addDocument } from 'firebase-admin-sdk-v8';

// Auto-generate document ID
const docRef = await addDocument('posts', {
  title: 'Hello World',
  content: 'This is my first post',
  createdAt: new Date(),
});
console.log('Created document:', docRef.id);

// Or specify custom ID
const customDocRef = await addDocument('posts', {
  title: 'Custom ID Post',
}, 'my-custom-id');
console.log('Created document:', customDocRef.id); // 'my-custom-id'
```

### Get Document

```typescript
import { getDocument } from 'firebase-admin-sdk-v8';

const user = await getDocument('users', 'user123');
if (user) {
  console.log('User found:', user.name);
} else {
  console.log('User not found');
}
```

### Update Document

```typescript
import { updateDocument } from 'firebase-admin-sdk-v8';

// Update specific fields (document must exist)
await updateDocument('users', 'user123', {
  lastLogin: new Date(),
  loginCount: 5,
});
```

### Delete Document

```typescript
import { deleteDocument } from 'firebase-admin-sdk-v8';

await deleteDocument('users', 'user123');
```

## Field Value Operations

### Server Timestamp

```typescript
import { setDocument, FieldValue } from 'firebase-admin-sdk-v8';

await setDocument('posts', 'post1', {
  title: 'My Post',
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});
```

### Increment

```typescript
import { updateDocument, FieldValue } from 'firebase-admin-sdk-v8';

// Increment a counter
await updateDocument('users', 'user123', {
  loginCount: FieldValue.increment(1),
  points: FieldValue.increment(10),
});

// Decrement (use negative number)
await updateDocument('inventory', 'item1', {
  stock: FieldValue.increment(-1),
});
```

### Array Union (Add to Array)

```typescript
import { updateDocument, FieldValue } from 'firebase-admin-sdk-v8';

// Add tags to array (no duplicates)
await updateDocument('posts', 'post1', {
  tags: FieldValue.arrayUnion('javascript', 'typescript', 'firebase'),
});

// Add multiple items
await updateDocument('users', 'user123', {
  favoriteColors: FieldValue.arrayUnion('blue', 'green'),
});
```

### Array Remove

```typescript
import { updateDocument, FieldValue } from 'firebase-admin-sdk-v8';

// Remove tags from array
await updateDocument('posts', 'post1', {
  tags: FieldValue.arrayRemove('outdated-tag'),
});
```

### Delete Field

```typescript
import { updateDocument, FieldValue } from 'firebase-admin-sdk-v8';

// Remove a field from document
await updateDocument('users', 'user123', {
  temporaryField: FieldValue.delete(),
  oldField: FieldValue.delete(),
});
```

## Advanced Queries

### Simple Query

```typescript
import { queryDocuments } from 'firebase-admin-sdk-v8';

// Get all documents in collection
const allUsers = await queryDocuments('users');
allUsers.forEach(user => {
  console.log(user.id, user.data.name);
});
```

### Where Filters

```typescript
import { queryDocuments } from 'firebase-admin-sdk-v8';

// Single condition
const activeUsers = await queryDocuments('users', {
  where: [
    { field: 'active', op: '==', value: true }
  ]
});

// Multiple conditions (AND)
const adultActiveUsers = await queryDocuments('users', {
  where: [
    { field: 'active', op: '==', value: true },
    { field: 'age', op: '>=', value: 18 }
  ]
});

// Comparison operators
const seniorUsers = await queryDocuments('users', {
  where: [
    { field: 'age', op: '>', value: 65 }
  ]
});

// Array contains
const jsDevs = await queryDocuments('users', {
  where: [
    { field: 'skills', op: 'array-contains', value: 'javascript' }
  ]
});

// In operator
const specificUsers = await queryDocuments('users', {
  where: [
    { field: 'role', op: 'in', value: ['admin', 'moderator'] }
  ]
});
```

### Order By

```typescript
import { queryDocuments } from 'firebase-admin-sdk-v8';

// Order by single field
const usersByName = await queryDocuments('users', {
  orderBy: [
    { field: 'name', direction: 'ASCENDING' }
  ]
});

// Order by multiple fields
const sortedPosts = await queryDocuments('posts', {
  orderBy: [
    { field: 'featured', direction: 'DESCENDING' },
    { field: 'createdAt', direction: 'DESCENDING' }
  ]
});
```

### Limit and Offset

```typescript
import { queryDocuments } from 'firebase-admin-sdk-v8';

// Get first 10 users
const firstPage = await queryDocuments('users', {
  limit: 10
});

// Pagination with offset
const secondPage = await queryDocuments('users', {
  limit: 10,
  offset: 10
});
```

### Complex Query

```typescript
import { queryDocuments } from 'firebase-admin-sdk-v8';

// Combine filters, ordering, and limit
const topActiveUsers = await queryDocuments('users', {
  where: [
    { field: 'active', op: '==', value: true },
    { field: 'points', op: '>=', value: 100 }
  ],
  orderBy: [
    { field: 'points', direction: 'DESCENDING' }
  ],
  limit: 10
});
```

### Cursor-based Pagination

```typescript
import { queryDocuments } from 'firebase-admin-sdk-v8';

// Start at specific value
const results = await queryDocuments('users', {
  orderBy: [{ field: 'createdAt', direction: 'ASCENDING' }],
  startAt: [new Date('2024-01-01')],
  limit: 10
});

// Start after specific value (exclusive)
const nextResults = await queryDocuments('users', {
  orderBy: [{ field: 'createdAt', direction: 'ASCENDING' }],
  startAfter: [new Date('2024-01-01')],
  limit: 10
});

// End at specific value
const endResults = await queryDocuments('users', {
  orderBy: [{ field: 'createdAt', direction: 'ASCENDING' }],
  endAt: [new Date('2024-12-31')],
});

// End before specific value (exclusive)
const beforeResults = await queryDocuments('users', {
  orderBy: [{ field: 'createdAt', direction: 'ASCENDING' }],
  endBefore: [new Date('2024-12-31')],
});
```

## Batch Operations

### Batch Write (Multiple Operations)

```typescript
import { batchWrite } from 'firebase-admin-sdk-v8';

// Perform multiple operations atomically
await batchWrite([
  // Set a document
  {
    type: 'set',
    collectionPath: 'users',
    documentId: 'user1',
    data: { name: 'John', email: 'john@example.com' }
  },
  
  // Update a document
  {
    type: 'update',
    collectionPath: 'users',
    documentId: 'user2',
    data: { lastLogin: new Date() }
  },
  
  // Delete a document
  {
    type: 'delete',
    collectionPath: 'users',
    documentId: 'user3'
  }
]);
```

### Batch with Field Values

```typescript
import { batchWrite, FieldValue } from 'firebase-admin-sdk-v8';

await batchWrite([
  {
    type: 'update',
    collectionPath: 'posts',
    documentId: 'post1',
    data: {
      views: FieldValue.increment(1),
      lastViewed: FieldValue.serverTimestamp()
    }
  },
  {
    type: 'update',
    collectionPath: 'users',
    documentId: 'user1',
    data: {
      postsViewed: FieldValue.arrayUnion('post1')
    }
  }
]);
```

## Merge Operations

### Merge All Fields

```typescript
import { setDocument } from 'firebase-admin-sdk-v8';

// Existing document: { name: 'John', age: 30, city: 'NYC' }

// Merge new data with existing
await setDocument('users', 'user123', {
  age: 31,
  country: 'USA'
}, { merge: true });

// Result: { name: 'John', age: 31, city: 'NYC', country: 'USA' }
```

### Merge Specific Fields

```typescript
import { setDocument } from 'firebase-admin-sdk-v8';

// Existing document: { name: 'John', age: 30, city: 'NYC' }

// Only merge the 'age' field
await setDocument('users', 'user123', {
  age: 31,
  city: 'LA',
  country: 'USA'
}, { mergeFields: ['age'] });

// Result: { name: 'John', age: 31, city: 'NYC' }
// Note: city and country were NOT updated
```

### Merge with Field Values

```typescript
import { setDocument, FieldValue } from 'firebase-admin-sdk-v8';

// Merge with special field values
await setDocument('users', 'user123', {
  lastLogin: FieldValue.serverTimestamp(),
  loginCount: FieldValue.increment(1),
  devices: FieldValue.arrayUnion('mobile')
}, { merge: true });
```

## Real-World Examples

### User Registration

```typescript
import { addDocument, FieldValue } from 'firebase-admin-sdk-v8';

async function registerUser(email: string, name: string) {
  const docRef = await addDocument('users', {
    email,
    name,
    createdAt: FieldValue.serverTimestamp(),
    loginCount: 0,
    active: true,
    roles: ['user'],
  });
  
  return docRef.id;
}
```

### Track User Activity

```typescript
import { updateDocument, FieldValue } from 'firebase-admin-sdk-v8';

async function trackUserLogin(userId: string) {
  await updateDocument('users', userId, {
    lastLogin: FieldValue.serverTimestamp(),
    loginCount: FieldValue.increment(1),
  });
}
```

### Blog Post with Tags

```typescript
import { addDocument, updateDocument, FieldValue } from 'firebase-admin-sdk-v8';

async function createPost(title: string, content: string, tags: string[]) {
  const docRef = await addDocument('posts', {
    title,
    content,
    tags,
    views: 0,
    likes: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  
  return docRef.id;
}

async function addTagToPost(postId: string, tag: string) {
  await updateDocument('posts', postId, {
    tags: FieldValue.arrayUnion(tag),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function incrementPostViews(postId: string) {
  await updateDocument('posts', postId, {
    views: FieldValue.increment(1),
  });
}
```

### Leaderboard Query

```typescript
import { queryDocuments } from 'firebase-admin-sdk-v8';

async function getTopPlayers(limit: number = 10) {
  return await queryDocuments('players', {
    where: [
      { field: 'active', op: '==', value: true }
    ],
    orderBy: [
      { field: 'score', direction: 'DESCENDING' }
    ],
    limit
  });
}
```

### Bulk User Update

```typescript
import { batchWrite, FieldValue } from 'firebase-admin-sdk-v8';

async function bulkUpdateUsers(userIds: string[], updates: any) {
  const operations = userIds.map(userId => ({
    type: 'update' as const,
    collectionPath: 'users',
    documentId: userId,
    data: {
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    }
  }));
  
  // Firestore batch limit is 500 operations
  const chunks = [];
  for (let i = 0; i < operations.length; i += 500) {
    chunks.push(operations.slice(i, i + 500));
  }
  
  for (const chunk of chunks) {
    await batchWrite(chunk);
  }
}
```

### Use Firebase Emulators For Local Development
Init your Firebase Emulators: 
```bash
firebase init emulators
# > select Firestore, Authentication, and/or Storage when asked
```

Then start the emulators: 
```bash
firebase emulators:start
```

Initialize your app with emulators:
```typescript
import { initializeApp } from '@adamclayd/firebase-admin';

const authPort = 9099;
const firestorePort = 8080;
const storagePort = 9199;
const emuHost = '127.0.0.1';

const firebaseApp = initializeApp({
  projectId: 'your-project-id',
  apiKey: 'your-api-key',
  authEmulatorHost: `${emuHost}:${authPort}`,
  firestoreEmulatorHost: `${emuHost}:${firestorePort}`,
  storageEmulatorHost: `${emuHost}:${storagePort}`
});
```

Firebase will now point to the emulators instead of the production Firebase services.

**Note**:
- `projectId` is required when you use any of the emulators. It can be any string
- `apiKey` is not required unless you plan on using one of the calls that requires an api key when you use any of the emulators. It can be any string