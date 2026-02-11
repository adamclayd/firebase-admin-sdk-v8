# Sign In With Custom Token Task

## Overview

Implement Firebase custom token exchange to convert custom tokens into ID tokens and refresh tokens using the Identity Toolkit REST API.

## Current State

- ❌ No custom token exchange exists
- ✅ Token verification working ([`verifyIdToken`](../../src/auth.ts:134-233))
- ✅ REST API pattern established
- ⏳ `createCustomToken` needs to be implemented first

## Goals

Implement custom token exchange compatible with edge runtimes:
- Exchange custom token for ID token and refresh token
- Use Identity Toolkit REST API v1
- Zero dependencies (fetch only)
- Return user credentials

## API Reference

**Identity Toolkit REST API**: https://cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/signInWithCustomToken

**Endpoint**: `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={API_KEY}`

**Request Body**:
```json
{
  "token": "custom_token_here",
  "returnSecureToken": true
}
```

**Response**:
```json
{
  "idToken": "eyJhbGc...",
  "refreshToken": "AOEOulZ...",
  "expiresIn": "3600",
  "localId": "user123"
}
```

## Implementation Plan

### 1. Add `signInWithCustomToken` to `src/auth.ts`

```typescript
/**
 * Response from signInWithCustomToken
 */
export interface CustomTokenSignInResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
}

/**
 * Exchange a custom token for an ID token and refresh token
 * 
 * @param customToken - Custom JWT token created with createCustomToken
 * @returns User credentials (idToken, refreshToken, expiresIn, localId)
 * 
 * @example
 * ```typescript
 * // Server-side: Create custom token
 * const customToken = await createCustomToken('user123', { role: 'admin' });
 * 
 * // Client-side: Exchange for ID token
 * const credentials = await signInWithCustomToken(customToken);
 * 
 * // Use ID token for authenticated requests
 * const user = await verifyIdToken(credentials.idToken);
 * ```
 */
export async function signInWithCustomToken(
  customToken: string
): Promise<CustomTokenSignInResponse> {
  if (!customToken || typeof customToken !== 'string') {
    throw new Error('customToken must be a non-empty string');
  }
  
  // Get Firebase Web API key
  const apiKey = getFirebaseApiKey();
  
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to sign in with custom token: ${response.status} ${errorText}`);
  }
  
  const result = await response.json();
  
  return {
    idToken: result.idToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
    localId: result.localId,
  };
}
```

### 2. Add Firebase Web API Key to `src/config.ts`

```typescript
export interface SDKConfig {
  serviceAccount?: ServiceAccount;
  projectId?: string;
  apiKey?: string; // NEW: Firebase Web API key
}

/**
 * Get Firebase Web API key
 * 
 * Required for Identity Toolkit API calls
 */
export function getFirebaseApiKey(): string {
  const config = getConfig();
  
  if (config.apiKey) {
    return config.apiKey;
  }
  
  const envKey = process.env.FIREBASE_API_KEY;
  if (envKey) {
    return envKey;
  }
  
  throw new Error(
    'Firebase API key not configured. ' +
    'Either call initializeApp({ apiKey: ... }) or set FIREBASE_API_KEY environment variable.'
  );
}
```

### 3. Add unit tests to `src/auth.spec.ts`

Test coverage:
- ✅ Sign in with valid custom token
- ✅ Return ID token, refresh token, expiresIn, localId
- ✅ Validate custom token (non-empty string)
- ✅ Handle API errors (invalid token, expired token)
- ✅ Handle network errors
- ✅ Require API key
- ✅ Parse response correctly

### 4. Add e2e test to `src/auth.e2e.ts`

```typescript
describe('Custom Token Authentication', () => {
  it('should create custom token and exchange for ID token', async () => {
    const uid = `test-user-${Date.now()}`;
    const customClaims = {
      role: 'tester',
      testRun: true,
    };
    
    // Create custom token
    const customToken = await createCustomToken(uid, customClaims);
    expect(customToken).toBeDefined();
    
    // Exchange for ID token
    const credentials = await signInWithCustomToken(customToken);
    
    expect(credentials.idToken).toBeDefined();
    expect(credentials.refreshToken).toBeDefined();
    expect(credentials.expiresIn).toBe('3600');
    expect(credentials.localId).toBe(uid);
    
    // Verify the ID token
    const decodedToken = await verifyIdToken(credentials.idToken);
    expect(decodedToken.uid).toBe(uid);
    expect(decodedToken.role).toBe('tester');
    expect(decodedToken.testRun).toBe(true);
  }, 30000);
});
```

### 5. Update `src/index.ts`

```typescript
// Auth exports
export {
  verifyIdToken,
  getUserFromToken,
  getAuth,
  createCustomToken, // NEW
  signInWithCustomToken, // NEW
} from './auth';

// Auth type exports
export type {
  CustomClaims, // NEW
  CustomTokenSignInResponse, // NEW
} from './auth';
```

## Success Criteria

- ✅ `createCustomToken` implemented
- ✅ `signInWithCustomToken` implemented
- ✅ Unit tests: 15+ tests, 95%+ coverage
- ✅ E2E test verifies full flow
- ✅ API key configuration
- ✅ Error handling
- ✅ Documentation updated
- ✅ Backward compatible

## Estimated Time

- **Implementation**: 2-3 hours
- **Unit Tests**: 1-2 hours
- **E2E Tests**: 1 hour
- **Documentation**: 30 minutes
- **Total**: 4.5-6.5 hours

## Dependencies

- ✅ JWT creation infrastructure (already implemented)
- ✅ crypto.subtle signing (already implemented)
- ✅ Service account configuration (already implemented)
- ⚠️ Firebase Web API key (needs to be added to config)

## Notes

### Getting Firebase Web API Key

1. Go to Firebase Console: https://console.firebase.google.com/project/YOUR_PROJECT/settings/general
2. Scroll to "Your apps" section
3. Find "Web API Key" under project settings
4. Copy the key (starts with `AIza...`)

### Comparison with firebase-admin-node

**firebase-admin-node**:
```typescript
import { getAuth } from 'firebase-admin/auth';

// Server-side only
const customToken = await getAuth().createCustomToken('user123');

// Client-side (firebase client SDK)
import { signInWithCustomToken } from 'firebase/auth';
await signInWithCustomToken(auth, customToken);
```

**Our Implementation**:
```typescript
// Server-side (edge runtime compatible)
const customToken = await createCustomToken('user123');

// Server-side token exchange (no client SDK needed)
const credentials = await signInWithCustomToken(customToken);

// Use the ID token
const user = await verifyIdToken(credentials.idToken);
```

### Use Cases

1. **Custom Authentication**: Authenticate users with existing auth system
2. **Server-to-Server**: Create tokens for service accounts
3. **Migration**: Migrate users from other auth systems
4. **Testing**: Create test users without Firebase Console

### Security Considerations

1. **API Key**: Not a secret, but should be in environment variables
2. **Custom Token**: Should be created server-side only
3. **ID Token**: Can be sent to client for authentication
4. **Refresh Token**: Should be stored securely

## References

- [Create Custom Tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens)
- [Identity Toolkit API](https://cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/signInWithCustomToken)
- [firebase-admin-node Auth](https://github.com/firebase/firebase-admin-node/tree/master/src/auth)
