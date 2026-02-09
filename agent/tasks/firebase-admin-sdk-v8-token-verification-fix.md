# Firebase Admin SDK v8 - Token Verification Fix

## Issue

**Error**: `Failed to verify ID token: Public key not found for kid: 0ukltA`

**Location**: `firebase-admin-sdk-v8/src/auth.ts` in `verifyIdToken()` function

## Problem

The library is failing to fetch and cache Google's public keys needed to verify Firebase ID tokens. The `kid` (key ID) in the JWT header doesn't match any cached public keys.

## Root Cause

The `firebase-auth-cloudflare-workers` library (which firebase-admin-sdk-v8 uses) needs to:
1. Fetch public keys from Google's servers
2. Cache keys properly
3. Handle key rotation
4. Retry on fetch failures

## Solution

### 1. Ensure Public Key Fetching

The library should fetch keys from:
```
https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
```

### 2. Implement Proper Caching

```typescript
// In firebase-admin-sdk-v8/src/auth.ts

interface PublicKeyCache {
  keys: Record<string, string>;
  expiresAt: number;
}

let publicKeyCache: PublicKeyCache | null = null;

async function getPublicKeys(): Promise<Record<string, string>> {
  // Return cached keys if still valid
  if (publicKeyCache && Date.now() < publicKeyCache.expiresAt) {
    return publicKeyCache.keys;
  }

  // Fetch fresh keys
  const response = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );

  if (!response.ok) {
    throw new Error('Failed to fetch Firebase public keys');
  }

  const keys = await response.json();

  // Cache keys (Google's keys typically expire in 1 hour)
  const cacheControl = response.headers.get('cache-control');
  const maxAge = cacheControl?.match(/max-age=(\d+)/)?.[1];
  const ttl = maxAge ? parseInt(maxAge) * 1000 : 3600000; // Default 1 hour

  publicKeyCache = {
    keys,
    expiresAt: Date.now() + ttl,
  };

  return keys;
}
```

### 3. Update verifyIdToken Function

```typescript
export async function verifyIdToken(idToken: string) {
  try {
    // Use firebase-auth-cloudflare-workers with proper key fetching
    const auth = getAuth();
    
    // Ensure public keys are fetched and cached
    await auth.verifyIdToken(idToken);
    
    // If verification succeeds, decode and return
    const decoded = decodeToken(idToken);
    return decoded;
  } catch (error) {
    // If public key not found, clear cache and retry once
    if (error.message.includes('Public key not found')) {
      publicKeyCache = null; // Clear cache
      const auth = getAuth();
      return await auth.verifyIdToken(idToken); // Retry
    }
    throw error;
  }
}
```

### 4. Handle Key Rotation

Google rotates Firebase public keys periodically. The library should:
- Cache keys with TTL from `cache-control` header
- Automatically refetch when cache expires
- Retry with fresh keys if verification fails with "key not found"

### 5. Add Retry Logic

```typescript
async function verifyIdTokenWithRetry(idToken: string, retries = 1): Promise<any> {
  try {
    return await verifyIdToken(idToken);
  } catch (error) {
    if (retries > 0 && error.message.includes('Public key not found')) {
      // Clear cache and retry
      publicKeyCache = null;
      return await verifyIdTokenWithRetry(idToken, retries - 1);
    }
    throw error;
  }
}
```

## Testing

After fixing, test:
1. Login with fresh Firebase ID token
2. Verify token verification succeeds
3. Wait for key cache to expire (1 hour)
4. Login again, verify keys are refetched
5. Test with multiple concurrent requests

## Expected Behavior

- ✅ First login: Fetch keys, cache, verify token
- ✅ Subsequent logins: Use cached keys
- ✅ After cache expiry: Refetch keys automatically
- ✅ On key rotation: Retry with fresh keys
- ✅ No "Public key not found" errors

## Files to Modify

- `firebase-admin-sdk-v8/src/auth.ts` - Main verification logic
- `firebase-admin-sdk-v8/src/types.ts` - Add PublicKeyCache interface
- `firebase-admin-sdk-v8/README.md` - Document key caching behavior

## Priority

**HIGH** - Blocks all authentication functionality in agentbase.me
