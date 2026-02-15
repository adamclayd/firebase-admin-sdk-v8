# Task: Add Session Cookie Support

**Status**: 📋 Not Started  
**Priority**: High  
**Estimated Time**: 6-8 hours  
**Created**: 2026-02-15  
**Package**: `@prmichaelsen/firebase-admin-sdk-v8`

---

## Problem Statement

Currently, the package only supports ID token verification via `verifyIdToken()`. ID tokens expire after 1 hour, which creates several issues:

1. **Short Session Duration**: Users are effectively logged out after 1 hour
2. **Poor UX**: Users must re-authenticate frequently
3. **Complex Workarounds**: Apps must implement token refresh logic on the client side
4. **Not Production-Ready**: Web applications typically expect sessions to last days/weeks

### Current Limitation

```typescript
// Current implementation
import { verifyIdToken } from '@prmichaelsen/firebase-admin-sdk-v8'

// ✅ Can verify ID tokens (1-hour expiration)
const decodedToken = await verifyIdToken(idToken)

// ❌ Cannot create long-lived session cookies
// ❌ Cannot verify session cookies
```

---

## Objective

Add Firebase Admin SDK's session cookie functionality to enable long-lived authentication sessions (up to 14 days) instead of relying on short-lived ID tokens.

---

## Requested Features

### 1. `createSessionCookie(idToken: string, options: SessionCookieOptions): Promise<string>`

Creates a session cookie from an ID token with configurable expiration (up to 14 days).

**Interface**:
```typescript
interface SessionCookieOptions {
  expiresIn: number; // Duration in milliseconds (max: 14 days = 1,209,600,000 ms)
}
```

**Usage**:
```typescript
const sessionCookie = await createSessionCookie(idToken, {
  expiresIn: 60 * 60 * 24 * 14 * 1000 // 14 days
})
```

### 2. `verifySessionCookie(sessionCookie: string, checkRevoked?: boolean): Promise<DecodedIdToken>`

Verifies a session cookie and returns the decoded token.

**Usage**:
```typescript
const decodedToken = await verifySessionCookie(sessionCookie, true)
```

---

## Implementation Plan

### Phase 1: Research & Design (1-2 hours)

1. **Study Firebase REST API**
   - Review [Identity Toolkit API](https://cloud.google.com/identity-platform/docs/reference/rest)
   - Find session cookie creation endpoint
   - Find session cookie verification endpoint
   - Document required request/response formats

2. **Analyze Official SDK**
   - Review `firebase-admin/auth` implementation
   - Understand session cookie JWT format
   - Identify differences from ID tokens
   - Document signing process

3. **Design API**
   - Define TypeScript interfaces
   - Plan error handling
   - Consider edge runtime compatibility
   - Document security considerations

### Phase 2: Implementation (3-4 hours)

#### Step 1: Add Session Cookie Creation

**File**: `src/auth.ts`

```typescript
/**
 * Options for creating a session cookie
 */
export interface SessionCookieOptions {
  /**
   * Session duration in milliseconds
   * Maximum: 14 days (1,209,600,000 ms)
   * Minimum: 5 minutes (300,000 ms)
   */
  expiresIn: number;
}

/**
 * Create a session cookie from an ID token
 * 
 * Session cookies can have a maximum duration of 14 days and are
 * useful for maintaining long-lived authentication sessions.
 * 
 * @param idToken - Valid Firebase ID token
 * @param options - Session cookie options
 * @returns Session cookie string
 * 
 * @example
 * ```typescript
 * // Create 14-day session cookie
 * const sessionCookie = await createSessionCookie(idToken, {
 *   expiresIn: 60 * 60 * 24 * 14 * 1000
 * });
 * 
 * // Set as HTTP-only cookie
 * response.headers.set('Set-Cookie', 
 *   `session=${sessionCookie}; Max-Age=1209600; HttpOnly; Secure; SameSite=Strict`
 * );
 * ```
 */
export async function createSessionCookie(
  idToken: string,
  options: SessionCookieOptions
): Promise<string> {
  // Validate inputs
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('idToken must be a non-empty string');
  }
  
  if (!options.expiresIn || typeof options.expiresIn !== 'number') {
    throw new Error('expiresIn must be a number');
  }
  
  // Validate expiration range
  const MIN_DURATION = 5 * 60 * 1000; // 5 minutes
  const MAX_DURATION = 14 * 24 * 60 * 60 * 1000; // 14 days
  
  if (options.expiresIn < MIN_DURATION) {
    throw new Error(`expiresIn must be at least ${MIN_DURATION}ms (5 minutes)`);
  }
  
  if (options.expiresIn > MAX_DURATION) {
    throw new Error(`expiresIn must be at most ${MAX_DURATION}ms (14 days)`);
  }
  
  // Get access token for API call
  const accessToken = await getAdminAccessToken();
  const projectId = getProjectId();
  
  // Call Identity Toolkit API to create session cookie
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}:createSessionCookie`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idToken,
      validDuration: Math.floor(options.expiresIn / 1000), // Convert to seconds
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create session cookie: ${response.status} ${errorText}`);
  }
  
  const result = await response.json();
  return result.sessionCookie;
}
```

#### Step 2: Add Session Cookie Verification

**File**: `src/auth.ts`

```typescript
/**
 * Verify a Firebase session cookie
 * 
 * Session cookies are verified similarly to ID tokens but have
 * different expiration times (up to 14 days).
 * 
 * @param sessionCookie - Session cookie string to verify
 * @param checkRevoked - Whether to check if the token has been revoked
 * @returns Decoded token claims
 * 
 * @example
 * ```typescript
 * // Verify session cookie from request
 * const sessionCookie = request.cookies.get('session');
 * const decodedToken = await verifySessionCookie(sessionCookie, true);
 * console.log('User ID:', decodedToken.uid);
 * ```
 */
export async function verifySessionCookie(
  sessionCookie: string,
  checkRevoked: boolean = false
): Promise<DecodedIdToken> {
  if (!sessionCookie || typeof sessionCookie !== 'string') {
    throw new Error('sessionCookie must be a non-empty string');
  }
  
  // Session cookies are JWTs, so we can verify them like ID tokens
  // The main difference is the issuer and audience claims
  
  try {
    // Decode JWT header and payload
    const parts = sessionCookie.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid session cookie format');
    }
    
    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Decode payload
    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);
    
    // Validate claims
    const projectId = getProjectId();
    const now = Math.floor(Date.now() / 1000);
    
    // Check expiration
    if (!payload.exp || payload.exp < now) {
      throw new Error('Session cookie has expired');
    }
    
    // Check issued at
    if (!payload.iat || payload.iat > now) {
      throw new Error('Session cookie issued in the future');
    }
    
    // Check audience (should be project ID)
    if (payload.aud !== projectId) {
      throw new Error(`Session cookie has incorrect audience. Expected ${projectId}, got ${payload.aud}`);
    }
    
    // Check issuer (session cookies have different issuer)
    const expectedIssuer = `https://session.firebase.google.com/${projectId}`;
    if (payload.iss !== expectedIssuer) {
      throw new Error(`Session cookie has incorrect issuer. Expected ${expectedIssuer}, got ${payload.iss}`);
    }
    
    // Check subject (user ID)
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Session cookie has no subject (user ID)');
    }
    
    // Verify signature using public keys
    await verifySignature(sessionCookie, payload);
    
    // Check if revoked (if requested)
    if (checkRevoked) {
      await checkIfRevoked(payload.sub);
    }
    
    // Return decoded token
    return {
      uid: payload.sub,
      aud: payload.aud,
      auth_time: payload.auth_time,
      exp: payload.exp,
      iat: payload.iat,
      iss: payload.iss,
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified,
      firebase: payload.firebase,
      ...payload,
    };
  } catch (error) {
    throw new Error(`Failed to verify session cookie: ${error.message}`);
  }
}

/**
 * Verify JWT signature using Firebase public keys
 */
async function verifySignature(jwt: string, payload: any): Promise<void> {
  // Get public keys for session cookies
  const keys = await getSessionCookiePublicKeys();
  
  // Extract key ID from JWT header
  const [headerB64] = jwt.split('.');
  const headerJson = atob(headerB64.replace(/-/g, '+').replace(/_/g, '/'));
  const header = JSON.parse(headerJson);
  
  const kid = header.kid;
  if (!kid || !keys[kid]) {
    throw new Error('Session cookie has invalid key ID');
  }
  
  // Verify signature with public key
  const publicKey = keys[kid];
  const [headerAndPayload, signature] = jwt.split('.').slice(0, 2).join('.'), jwt.split('.')[2]];
  
  // Import public key
  const key = await importPublicKeyFromX509(publicKey);
  
  // Verify signature
  const encoder = new TextEncoder();
  const data = encoder.encode(headerAndPayload);
  const signatureBytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  
  const isValid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    key,
    signatureBytes,
    data
  );
  
  if (!isValid) {
    throw new Error('Session cookie signature verification failed');
  }
}

/**
 * Get public keys for session cookie verification
 * Session cookies use different public keys than ID tokens
 */
let sessionCookiePublicKeysCache: Record<string, string> | null = null;
let sessionCookieKeysCacheExpiry: number = 0;

async function getSessionCookiePublicKeys(): Promise<Record<string, string>> {
  // Return cached keys if still valid
  if (sessionCookiePublicKeysCache && Date.now() < sessionCookieKeysCacheExpiry) {
    return sessionCookiePublicKeysCache;
  }
  
  // Fetch public keys for session cookies
  const response = await fetch('https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch session cookie public keys: ${response.status}`);
  }
  
  const keys = await response.json();
  
  // Cache keys with expiry from Cache-Control header
  const cacheControl = response.headers.get('cache-control');
  const maxAgeMatch = cacheControl?.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 3600;
  
  sessionCookiePublicKeysCache = keys;
  sessionCookieKeysCacheExpiry = Date.now() + maxAge * 1000;
  
  return keys;
}

/**
 * Check if a user's tokens have been revoked
 */
async function checkIfRevoked(uid: string): Promise<void> {
  // This would require calling the Identity Toolkit API
  // to check the user's tokensValidAfterTime
  // For now, we'll skip this check
  // TODO: Implement token revocation check
}

/**
 * Clear session cookie public keys cache
 * Useful for testing
 */
export function clearSessionCookieKeysCache(): void {
  sessionCookiePublicKeysCache = null;
  sessionCookieKeysCacheExpiry = 0;
}
```

#### Step 3: Export New Functions

**File**: `src/index.ts`

```typescript
// Add to existing exports
export {
  createSessionCookie,
  verifySessionCookie,
  clearSessionCookieKeysCache,
} from './auth';

export type {
  SessionCookieOptions,
} from './auth';
```

#### Step 4: Update Types

**File**: `src/types.ts`

```typescript
// Add SessionCookieOptions if not already in auth.ts
export interface SessionCookieOptions {
  expiresIn: number;
}
```

### Phase 3: Testing (2-3 hours)

#### Unit Tests

**File**: `src/auth.spec.ts`

```typescript
describe('Session Cookies', () => {
  describe('createSessionCookie', () => {
    it('should create a session cookie from valid ID token', async () => {
      // Mock API response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sessionCookie: 'mock-session-cookie' }),
      });
      
      const sessionCookie = await createSessionCookie('valid-id-token', {
        expiresIn: 60 * 60 * 24 * 14 * 1000, // 14 days
      });
      
      expect(sessionCookie).toBe('mock-session-cookie');
    });
    
    it('should reject expiration less than 5 minutes', async () => {
      await expect(
        createSessionCookie('token', { expiresIn: 1000 })
      ).rejects.toThrow('at least');
    });
    
    it('should reject expiration more than 14 days', async () => {
      await expect(
        createSessionCookie('token', { expiresIn: 15 * 24 * 60 * 60 * 1000 })
      ).rejects.toThrow('at most');
    });
    
    it('should reject invalid ID token', async () => {
      await expect(
        createSessionCookie('', { expiresIn: 3600000 })
      ).rejects.toThrow('non-empty string');
    });
  });
  
  describe('verifySessionCookie', () => {
    it('should verify valid session cookie', async () => {
      // Create mock session cookie JWT
      const mockPayload = {
        sub: 'user123',
        aud: 'test-project',
        iss: 'https://session.firebase.google.com/test-project',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        email: 'test@example.com',
        email_verified: true,
      };
      
      const mockJwt = createMockJwt(mockPayload);
      
      // Mock public key fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ 'key1': 'mock-public-key' }),
        headers: new Headers({ 'cache-control': 'max-age=3600' }),
      });
      
      const decoded = await verifySessionCookie(mockJwt);
      
      expect(decoded.uid).toBe('user123');
      expect(decoded.email).toBe('test@example.com');
    });
    
    it('should reject expired session cookie', async () => {
      const expiredPayload = {
        sub: 'user123',
        aud: 'test-project',
        iss: 'https://session.firebase.google.com/test-project',
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };
      
      const expiredJwt = createMockJwt(expiredPayload);
      
      await expect(
        verifySessionCookie(expiredJwt)
      ).rejects.toThrow('expired');
    });
    
    it('should reject session cookie with wrong issuer', async () => {
      const wrongIssuer = {
        sub: 'user123',
        aud: 'test-project',
        iss: 'https://securetoken.google.com/test-project', // ID token issuer
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      
      const jwt = createMockJwt(wrongIssuer);
      
      await expect(
        verifySessionCookie(jwt)
      ).rejects.toThrow('incorrect issuer');
    });
  });
});
```

#### E2E Tests

**File**: `src/auth.e2e.ts`

```typescript
describe('Session Cookies E2E', () => {
  it('should create and verify session cookie', async () => {
    // Get a real ID token (from test user)
    const idToken = await getTestIdToken();
    
    // Create session cookie
    const sessionCookie = await createSessionCookie(idToken, {
      expiresIn: 60 * 60 * 1000, // 1 hour
    });
    
    expect(sessionCookie).toBeTruthy();
    expect(typeof sessionCookie).toBe('string');
    
    // Verify session cookie
    const decoded = await verifySessionCookie(sessionCookie);
    
    expect(decoded.uid).toBeTruthy();
    expect(decoded.email).toBeTruthy();
  });
  
  it('should handle 14-day session cookie', async () => {
    const idToken = await getTestIdToken();
    
    const sessionCookie = await createSessionCookie(idToken, {
      expiresIn: 60 * 60 * 24 * 14 * 1000, // 14 days
    });
    
    const decoded = await verifySessionCookie(sessionCookie);
    
    // Check expiration is ~14 days from now
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    expect(expiresIn).toBeGreaterThan(13 * 24 * 60 * 60); // At least 13 days
    expect(expiresIn).toBeLessThan(15 * 24 * 60 * 60); // Less than 15 days
  });
});
```

### Phase 4: Documentation (1 hour)

#### Update README.md

Add section on session cookies:

```markdown
### Session Cookies

For long-lived authentication sessions (up to 14 days), use session cookies instead of ID tokens:

#### Create Session Cookie

\`\`\`typescript
import { createSessionCookie } from '@prmichaelsen/firebase-admin-sdk-v8';

// Create 14-day session cookie from ID token
const sessionCookie = await createSessionCookie(idToken, {
  expiresIn: 60 * 60 * 24 * 14 * 1000 // 14 days in milliseconds
});

// Set as HTTP-only cookie
response.headers.set('Set-Cookie', 
  `session=${sessionCookie}; Max-Age=1209600; HttpOnly; Secure; SameSite=Strict; Path=/`
);
\`\`\`

#### Verify Session Cookie

\`\`\`typescript
import { verifySessionCookie } from '@prmichaelsen/firebase-admin-sdk-v8';

// Get session cookie from request
const sessionCookie = request.cookies.get('session');

// Verify and get user info
const decodedToken = await verifySessionCookie(sessionCookie, true);
console.log('User:', decodedToken.uid, decodedToken.email);
\`\`\`

#### Session Cookie vs ID Token

| Feature | ID Token | Session Cookie |
|---------|----------|----------------|
| **Max Duration** | 1 hour | 14 days |
| **Use Case** | Client-side auth | Server-side sessions |
| **Refresh Required** | Yes (every hour) | No (lasts 14 days) |
| **Revocation** | Limited | Full support |
| **Best For** | Mobile apps, SPAs | Web apps with server |

#### Best Practices

1. **Always use HTTPS**: Session cookies should only be sent over secure connections
2. **Set HttpOnly flag**: Prevents JavaScript access to the cookie
3. **Use SameSite=Strict**: Protects against CSRF attacks
4. **Check revocation**: Use `checkRevoked: true` for sensitive operations
5. **Reasonable expiration**: Don't always use 14 days; match your app's needs

#### Example: Login Flow

\`\`\`typescript
// 1. Client sends ID token to server
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ idToken })
});

// 2. Server creates session cookie
import { createSessionCookie } from '@prmichaelsen/firebase-admin-sdk-v8';

export async function POST(request: Request) {
  const { idToken } = await request.json();
  
  // Create 7-day session
  const sessionCookie = await createSessionCookie(idToken, {
    expiresIn: 60 * 60 * 24 * 7 * 1000
  });
  
  // Set cookie and return success
  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Set-Cookie': `session=${sessionCookie}; Max-Age=604800; HttpOnly; Secure; SameSite=Strict; Path=/`
    }
  });
}

// 3. Verify on subsequent requests
import { verifySessionCookie } from '@prmichaelsen/firebase-admin-sdk-v8';

export async function GET(request: Request) {
  const sessionCookie = request.cookies.get('session');
  
  if (!sessionCookie) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    const user = await verifySessionCookie(sessionCookie, true);
    return new Response(JSON.stringify({ user }));
  } catch (error) {
    return new Response('Invalid session', { status: 401 });
  }
}
\`\`\`
```

#### Update EXAMPLES.md

Add comprehensive session cookie examples.

#### Update CHANGELOG.md

```markdown
## [2.4.0] - YYYY-MM-DD

### Added
- **Session Cookie Support**: Added `createSessionCookie()` and `verifySessionCookie()`
- Long-lived authentication sessions (up to 14 days)
- Session cookie verification with revocation checking
- Comprehensive session cookie documentation and examples
```

---

## Testing Checklist

- [ ] Unit tests for `createSessionCookie()`
  - [ ] Valid ID token creates session cookie
  - [ ] Rejects expiration < 5 minutes
  - [ ] Rejects expiration > 14 days
  - [ ] Rejects invalid ID token
  - [ ] Handles API errors gracefully
- [ ] Unit tests for `verifySessionCookie()`
  - [ ] Verifies valid session cookie
  - [ ] Rejects expired session cookie
  - [ ] Rejects invalid signature
  - [ ] Rejects wrong issuer
  - [ ] Rejects wrong audience
  - [ ] Handles checkRevoked parameter
- [ ] E2E tests
  - [ ] Create and verify session cookie with real Firebase
  - [ ] 14-day session cookie works
  - [ ] Session cookie survives server restart
  - [ ] Expired session cookies are rejected
- [ ] Documentation
  - [ ] README updated with session cookie section
  - [ ] EXAMPLES.md includes session cookie examples
  - [ ] TypeScript types exported
  - [ ] JSDoc comments complete
- [ ] Edge Runtime Compatibility
  - [ ] Works in Cloudflare Workers
  - [ ] Works in Vercel Edge Functions
  - [ ] No Node.js-specific dependencies

---

## Success Criteria

- [ ] `createSessionCookie()` creates valid session cookies
- [ ] Session cookies work with 14-day expiration
- [ ] `verifySessionCookie()` correctly verifies session cookies
- [ ] Expired session cookies are rejected
- [ ] Invalid session cookies throw appropriate errors
- [ ] All tests pass (unit + e2e)
- [ ] Documentation is complete and clear
- [ ] Works in edge runtime environments
- [ ] No breaking changes to existing API

---

## Benefits

### For Users
1. ✅ **Better UX**: Stay logged in for 14 days instead of 1 hour
2. ✅ **Simpler Code**: No client-side token refresh logic needed
3. ✅ **More Secure**: Session cookies can be revoked server-side
4. ✅ **Standard Pattern**: Matches how most web apps handle sessions

### For the Package
1. ✅ **Feature Parity**: Matches Firebase Admin SDK capabilities
2. ✅ **Production Ready**: Enables real-world web applications
3. ✅ **Competitive**: Comparable to official SDK for session management
4. ✅ **User Satisfaction**: Addresses major pain point

---

## Alternative Solutions Considered

### 1. Document the Limitation
**Pros**: No code changes needed
**Cons**: Doesn't solve the problem, users still frustrated

### 2. Provide Token Refresh Example
**Pros**: Shows users how to work around it
**Cons**: Complex, error-prone, poor UX

### 3. Export getAuth()
**Pros**: Allows advanced users to access underlying Auth
**Cons**: Doesn't work in edge runtimes (no firebase-admin)

### 4. Implement Session Cookies (CHOSEN)
**Pros**: Solves the problem completely, matches official SDK
**Cons**: Requires implementation effort (but worth it)

---

## Security Considerations

1. **HTTPS Only**: Session cookies must only be sent over HTTPS
2. **HttpOnly Flag**: Prevents XSS attacks by blocking JavaScript access
3. **SameSite Attribute**: Protects against CSRF attacks
4. **Secure Flag**: Ensures cookie only sent over HTTPS
5. **Revocation Checking**: Support checking if tokens have been revoked
6. **Expiration Validation**: Enforce maximum 14-day duration
7. **Signature Verification**: Verify JWT signature with Firebase public keys

---

## References

- [Firebase Session Cookies Documentation](https://firebase.google.com/docs/auth/admin/manage-cookies)
- [Identity Toolkit API Reference](https://cloud.google.com/identity-platform/docs/reference/rest)
- [Firebase Admin SDK Source](https://github.com/firebase/firebase-admin-node)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

## Notes

- Session cookies use different public keys than ID tokens
- Session cookies have different issuer format: `https://session.firebase.google.com/{projectId}`
- Maximum duration is enforced by Firebase (14 days)
- Minimum duration is 5 minutes
- Session cookies can be revoked via Firebase Admin API

---

**Priority**: High - This is a critical feature for production web applications
**Impact**: High - Enables long-lived sessions and improves user experience significantly
**Complexity**: Medium - Requires REST API integration and JWT verification
**Risk**: Low - Well-documented Firebase feature with clear implementation path
