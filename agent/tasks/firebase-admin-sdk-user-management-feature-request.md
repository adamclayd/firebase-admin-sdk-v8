# Feature Request: User Management APIs for firebase-admin-sdk-v8

**Package**: `@prmichaelsen/firebase-admin-sdk-v8`
**Current Version**: 2.4.2
**Created**: 2026-02-19
**Priority**: Medium
**Status**: Proposed

---

## Overview

Request to add user management APIs to `@prmichaelsen/firebase-admin-sdk-v8` to provide complete Firebase Admin functionality in edge runtimes (Cloudflare Workers, etc.).

Currently, the SDK provides excellent support for:

- ✅ Authentication tokens (verify, create custom tokens)
- ✅ Firestore operations (CRUD, queries)
- ✅ Storage operations (upload, download, signed URLs)
- ✅ OAuth token management

However, it lacks user management operations that require direct Firebase Identity Toolkit REST API calls.

---

## Requested Features

### 1. Get User by Email

```typescript
/**
 * Look up a Firebase user by email address
 * @param email - User's email address
 * @returns User record or null if not found
 */
export async function getUserByEmail(email: string): Promise<UserRecord | null>;
```

**Use Case**: Password reset flows, user lookup, account verification

**Current Workaround**: Direct REST API call to `identitytoolkit.googleapis.com/v1/projects/{projectId}/accounts:lookup`

### 2. Get User by UID

```typescript
/**
 * Look up a Firebase user by UID
 * @param uid - User's unique ID
 * @returns User record or null if not found
 */
export async function getUserByUid(uid: string): Promise<UserRecord | null>;
```

**Use Case**: User profile retrieval, permission checks

**Current Workaround**: Direct REST API call with `localId` parameter

### 3. Create User

```typescript
/**
 * Create a new Firebase user
 * @param properties - User properties (email, password, displayName, etc.)
 * @returns Created user record
 */
export async function createUser(properties: CreateUserRequest): Promise<UserRecord>;
```

**Use Case**: User provisioning, account creation, admin user management

**Current Workaround**: Direct REST API call to `identitytoolkit.googleapis.com/v1/accounts:signUp`

### 4. Update User

```typescript
/**
 * Update an existing Firebase user
 * @param uid - User's unique ID
 * @param properties - Properties to update (email, password, displayName, etc.)
 * @returns Updated user record
 */
export async function updateUser(uid: string, properties: UpdateUserRequest): Promise<UserRecord>;
```

**Use Case**: Password resets, profile updates, email verification

**Current Workaround**: Direct REST API call to `identitytoolkit.googleapis.com/v1/accounts:update`

### 5. Delete User

```typescript
/**
 * Delete a Firebase user
 * @param uid - User's unique ID
 */
export async function deleteUser(uid: string): Promise<void>;
```

**Use Case**: Account deletion, GDPR compliance, user cleanup

**Current Workaround**: Direct REST API call to `identitytoolkit.googleapis.com/v1/accounts:delete`

### 6. List Users

```typescript
/**
 * List all users with pagination
 * @param maxResults - Maximum number of users to return (default: 1000)
 * @param pageToken - Token for next page
 * @returns List of users and next page token
 */
export async function listUsers(maxResults?: number, pageToken?: string): Promise<ListUsersResult>;
```

**Use Case**: User management dashboards, bulk operations, analytics

**Current Workaround**: Direct REST API call to `identitytoolkit.googleapis.com/v1/accounts:batchGet`

### 7. Set Custom Claims

```typescript
/**
 * Set custom claims on a user's ID token
 * @param uid - User's unique ID
 * @param customClaims - Custom claims object
 */
export async function setCustomUserClaims(
  uid: string,
  customClaims: Record<string, any>
): Promise<void>;
```

**Use Case**: Role-based access control, permissions, feature flags

**Current Workaround**: Direct REST API call to `identitytoolkit.googleapis.com/v1/accounts:update`

---

## Type Definitions

```typescript
interface UserRecord {
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  disabled: boolean;
  metadata: {
    creationTime: string;
    lastSignInTime: string;
  };
  providerData: UserInfo[];
  customClaims?: Record<string, any>;
}

interface CreateUserRequest {
  email?: string;
  emailVerified?: boolean;
  phoneNumber?: string;
  password?: string;
  displayName?: string;
  photoURL?: string;
  disabled?: boolean;
}

interface UpdateUserRequest {
  email?: string;
  emailVerified?: boolean;
  phoneNumber?: string;
  password?: string;
  displayName?: string;
  photoURL?: string;
  disabled?: boolean;
}

interface ListUsersResult {
  users: UserRecord[];
  pageToken?: string;
}
```

---

## Benefits

### For SDK Users

- ✅ **Complete Firebase Admin API** - No need for custom REST implementations
- ✅ **Type Safety** - Full TypeScript support for user operations
- ✅ **Consistent API** - Same patterns as existing SDK functions
- ✅ **Edge Compatible** - Works in Cloudflare Workers, Deno, etc.
- ✅ **Reduced Code** - Eliminate custom user management wrappers

### For the SDK

- ✅ **Feature Parity** - Match official `firebase-admin` capabilities
- ✅ **Market Position** - Most complete edge-compatible Firebase Admin SDK
- ✅ **User Adoption** - Attract more users needing user management

---

## Implementation Notes

### API Endpoints

All user management operations use Firebase Identity Toolkit REST API:

**Base URL**: `https://identitytoolkit.googleapis.com/v1`

**Endpoints**:

- `POST /projects/{projectId}/accounts:lookup` - Get user(s)
- `POST /projects/{projectId}/accounts:signUp` - Create user
- `POST /projects/{projectId}/accounts:update` - Update user
- `POST /projects/{projectId}/accounts:delete` - Delete user
- `POST /projects/{projectId}/accounts:batchGet` - List users

**Authentication**: Uses OAuth 2.0 access token (already implemented in SDK via `getAdminAccessToken()`)

### Error Handling

Follow existing SDK patterns:

- Return `null` for not found (instead of throwing)
- Throw descriptive errors for failures
- Include Firebase error codes in error messages

### Testing

- Unit tests for each function
- Integration tests with Firebase emulator
- Edge runtime compatibility tests (Cloudflare Workers, Deno)

---

## Current Workaround

Users currently implement these functions manually using the SDK's `getAdminAccessToken()`:

```typescript
// Example: Current workaround in arthouse1312 project
// src/lib/firebase-admin-rest.ts

import { getAdminAccessToken, getProjectId, ensureInitialized } from './firebase-admin-sdk';

export async function lookupUserByEmail(email: string, env?: any): Promise<any | null> {
  ensureInitialized(env);
  const projectId = getProjectId();
  const accessToken = await getAdminAccessToken();

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: [email] }),
    }
  );

  const data = await response.json();
  return data.users?.[0] || null;
}
```

This works but requires users to:

1. Understand Firebase Identity Toolkit REST API
2. Implement error handling
3. Maintain custom wrappers
4. Handle type definitions manually

---

## Priority Justification

**Medium Priority** because:

- ✅ SDK is already very useful without these features
- ✅ Workarounds exist (custom REST implementations)
- ✅ Would significantly improve developer experience
- ✅ Would reduce boilerplate in user projects
- ✅ Would make SDK feature-complete

**Not High Priority** because:

- ⚠️ Core token/Firestore/Storage operations already work well
- ⚠️ Users can implement workarounds
- ⚠️ Not blocking for most use cases

---

## Related Issues

- None yet (first feature request)

---

## References

- [Firebase Identity Toolkit REST API](https://cloud.google.com/identity-platform/docs/reference/rest/v1/accounts)
- [Firebase Admin SDK User Management](https://firebase.google.com/docs/auth/admin/manage-users)
- [Arthouse1312 Implementation](https://github.com/prmichaelsen/arthouse1312/blob/main/src/lib/firebase-admin-rest.ts)

---

**Status**: Proposed
**Next Steps**: Review and prioritize for future SDK release
**Estimated Effort**: 2-3 days (implementation + testing + documentation)
