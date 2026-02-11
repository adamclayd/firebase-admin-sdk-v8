# Custom Token Creation Task

## Overview

Implement Firebase custom token creation to allow server-side authentication of users with custom claims.

## Current State

- ❌ No custom token creation exists
- ✅ JWT creation infrastructure exists ([`token-generation.ts`](../../src/token-generation.ts:36-89))
- ✅ Service account private key available
- ✅ crypto.subtle signing working

## Goals

Implement custom token creation matching firebase-admin-node behavior:
- Create custom JWT tokens for users
- Support custom claims
- Use service account private key for signing
- Compatible with Firebase Authentication

## API Reference

**Firebase Admin SDK**: https://firebase.google.com/docs/auth/admin/create-custom-tokens

## Implementation Plan

### 1. Add `createCustomToken` to `src/auth.ts`

```typescript
/**
 * Custom claims for custom tokens
 */
export interface CustomClaims {
  [key: string]: any;
}

/**
 * Create a custom token for a user
 * 
 * @param uid - User ID
 * @param customClaims - Optional custom claims to include in token
 * @returns Custom JWT token
 * 
 * @example
 * ```typescript
 * // Create token with custom claims
 * const token = await createCustomToken('user123', {
 *   role: 'admin',
 *   premium: true,
 * });
 * 
 * // Use token on client to sign in
 * await signInWithCustomToken(auth, token);
 * ```
 */
export async function createCustomToken(
  uid: string,
  customClaims?: CustomClaims
): Promise<string> {
  const serviceAccount = getServiceAccount();
  
  // Validate UID
  if (!uid || typeof uid !== 'string') {
    throw new Error('uid must be a non-empty string');
  }
  
  if (uid.length > 128) {
    throw new Error('uid must be at most 128 characters');
  }
  
  // Build JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, any> = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600, // 1 hour
    uid,
  };
  
  // Add custom claims if provided
  if (customClaims) {
    payload.claims = customClaims;
  }
  
  // Create JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  
  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  
  // Sign with private key
  const signature = await signWithPrivateKey(unsignedToken, serviceAccount.private_key);
  
  return `${unsignedToken}.${signature}`;
}

/**
 * Helper to sign data with private key
 */
async function signWithPrivateKey(data: string, privateKey: string): Promise<string> {
  // Import the private key
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');
  
  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const key = await crypto.subtle.importKey(
    'pkcs8',
    bytes,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
  
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    dataBytes
  );
  
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```

### 2. Add unit tests to `src/auth.spec.ts`

Test coverage:
- ✅ Create token with valid UID
- ✅ Create token with custom claims
- ✅ Validate UID (non-empty, max 128 chars)
- ✅ JWT structure (header, payload, signature)
- ✅ JWT claims (iss, sub, aud, iat, exp, uid)
- ✅ Custom claims in payload
- ✅ Signature verification
- ✅ Token expiration (1 hour)

### 3. Add e2e test to `src/auth.e2e.ts`

```typescript
describe('Custom Tokens', () => {
  it('should create and verify custom token', async () => {
    const uid = 'test-user-123';
    const customClaims = {
      role: 'admin',
      premium: true,
    };
    
    // Create custom token
    const customToken = await createCustomToken(uid, customClaims);
    
    expect(customToken).toBeDefined();
    expect(customToken.split('.').length).toBe(3); // header.payload.signature
    
    // Decode and verify structure (without calling Firebase)
    const [, payloadB64] = customToken.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    
    expect(payload.uid).toBe(uid);
    expect(payload.claims).toEqual(customClaims);
    expect(payload.aud).toContain('identitytoolkit');
  });
});
```

### 4. Update `src/index.ts`

```typescript
// Auth exports
export {
  verifyIdToken,
  getUserFromToken,
  getAuth,
  createCustomToken, // NEW
} from './auth';
```

## Success Criteria

- ✅ `createCustomToken` function implemented
- ✅ Unit tests: 8+ tests, 95%+ coverage
- ✅ E2E test verifies token structure
- ✅ Custom claims support
- ✅ UID validation
- ✅ JWT format matches Firebase expectations
- ✅ Documentation updated
- ✅ Backward compatible

## Estimated Time

- **Implementation**: 1-2 hours
- **Unit Tests**: 1 hour
- **E2E Tests**: 30 minutes
- **Documentation**: 30 minutes
- **Total**: 3-4 hours

## Dependencies

- ✅ JWT creation infrastructure (already implemented)
- ✅ crypto.subtle signing (already implemented)
- ✅ Service account configuration (already implemented)

## Notes

### Comparison with firebase-admin-node

**firebase-admin-node**:
```typescript
import { getAuth } from 'firebase-admin/auth';

const customToken = await getAuth().createCustomToken('user123', {
  role: 'admin',
});
```

**Our Implementation**:
```typescript
import { createCustomToken } from '@prmichaelsen/firebase-admin-sdk-v8';

const customToken = await createCustomToken('user123', {
  role: 'admin',
});
```

### Security Considerations

1. **UID Validation**: Must be non-empty, max 128 characters
2. **Custom Claims**: Should not contain reserved claims (iss, sub, aud, etc.)
3. **Token Expiration**: 1 hour (matches Firebase default)
4. **Private Key**: Must be kept secure

### Future Enhancements

- Custom token expiration times
- Validate custom claims (no reserved names)
- Support for tenant IDs
- Token revocation

## References

- [Firebase Custom Tokens Documentation](https://firebase.google.com/docs/auth/admin/create-custom-tokens)
- [firebase-admin-node Auth](https://github.com/firebase/firebase-admin-node/tree/master/src/auth)
- [JWT Specification](https://tools.ietf.org/html/rfc7519)
