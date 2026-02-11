# Security Task: H-004 - Signed URL Timing Attack Vulnerability

## Status: 🔴 PENDING
**Priority**: HIGH  
**Severity**: HIGH  
**Estimated Hours**: 3-4  
**Created**: 2026-02-11  
**From**: Security Audit #001

---

## Issue Description

The signed URL generation uses string comparison for signature validation, which is vulnerable to timing attacks. Additionally, the signature is generated client-side with the private key exposed in memory.

**Location**: `src/storage/signed-urls.ts:143-225`

## Security Impact

- **Severity**: HIGH
- **Attack Vector**: Timing attacks to leak signature information
- **Potential Impact**:
  - Signature information leakage
  - Private key exposure in memory
  - Unauthorized file access

## Remediation

### Required Changes

1. **Implement constant-time comparison**:
```typescript
// src/storage/signed-urls.ts - Add helper function
/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}
```

2. **Add signature validation logging**:
```typescript
// Add to generateSignedUrl function
export async function generateSignedUrl(
  path: string,
  options: SignedUrlOptions
): Promise<string> {
  // ... existing code ...
  
  // Log signature generation (not the signature itself)
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.log('[Security] Signed URL generated for path:', path);
  }
  
  return signedUrl;
}
```

3. **Add rate limiting guidance**:
```typescript
/**
 * Generate a signed URL for temporary access to a Storage file
 * 
 * SECURITY NOTES:
 * - Implement rate limiting at the application level
 * - Monitor signed URL generation for anomalies
 * - Use shortest practical expiration time
 * - Consider IP-based restrictions for sensitive files
 * 
 * @param path - File path in storage
 * @param options - Signed URL options
 * @returns Signed URL
 */
```

4. **Add validation for expiration times**:
```typescript
function validateExpirationTime(expires: Date | number): void {
  const MAX_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // 7 days
  const MIN_EXPIRATION_SECONDS = 60; // 1 minute
  
  let expirationSeconds: number;
  
  if (expires instanceof Date) {
    expirationSeconds = Math.floor((expires.getTime() - Date.now()) / 1000);
  } else {
    expirationSeconds = expires;
  }
  
  if (expirationSeconds < MIN_EXPIRATION_SECONDS) {
    throw new Error(`Expiration time too short. Minimum: ${MIN_EXPIRATION_SECONDS} seconds`);
  }
  
  if (expirationSeconds > MAX_EXPIRATION_SECONDS) {
    throw new Error(`Expiration time too long. Maximum: ${MAX_EXPIRATION_SECONDS} seconds`);
  }
}
```

5. **Add unit tests**:
```typescript
describe('Signed URL Security', () => {
  it('should enforce minimum expiration time', async () => {
    await expect(
      generateSignedUrl('file.txt', { action: 'read', expires: 30 })
    ).rejects.toThrow('too short');
  });
  
  it('should enforce maximum expiration time', async () => {
    const eightDays = 8 * 24 * 60 * 60;
    await expect(
      generateSignedUrl('file.txt', { action: 'read', expires: eightDays })
    ).rejects.toThrow('too long');
  });
  
  it('should use constant-time comparison', () => {
    const sig1 = 'abc123';
    const sig2 = 'abc123';
    const sig3 = 'abc124';
    
    expect(constantTimeCompare(sig1, sig2)).toBe(true);
    expect(constantTimeCompare(sig1, sig3)).toBe(false);
  });
});
```

## Files to Modify

- `src/storage/signed-urls.ts` - Add constant-time comparison, validation
- `src/storage/client.spec.ts` - Add unit tests (create if needed)
- `README.md` - Document security best practices

## Testing Requirements

- [ ] Unit tests for constant-time comparison
- [ ] Unit tests for expiration validation
- [ ] Unit tests for rate limiting guidance
- [ ] Performance tests to verify constant-time behavior

## Documentation Updates

Add to README.md:
```markdown
### Signed URL Security Best Practices

When using signed URLs:
1. **Use shortest practical expiration time** (default: 1 hour)
2. **Implement rate limiting** at the application level
3. **Monitor generation patterns** for anomalies
4. **Consider IP restrictions** for sensitive files
5. **Rotate service account keys** regularly
6. **Log signed URL generation** (not the URLs themselves)

Example with rate limiting:
\`\`\`typescript
// Implement application-level rate limiting
const rateLimiter = new Map<string, number[]>();

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const attempts = rateLimiter.get(userId) || [];
  const recentAttempts = attempts.filter(t => now - t < 60000);
  
  if (recentAttempts.length >= 10) {
    throw new Error('Rate limit exceeded');
  }
  
  recentAttempts.push(now);
  rateLimiter.set(userId, recentAttempts);
}
\`\`\`
```

## Additional Security Measures

1. **Add monitoring hooks**:
```typescript
export interface SignedUrlMonitoring {
  onGenerate?: (path: string, action: string, expiresIn: number) => void;
  onError?: (error: Error, path: string) => void;
}

let monitoring: SignedUrlMonitoring = {};

export function setSignedUrlMonitoring(config: SignedUrlMonitoring): void {
  monitoring = config;
}
```

2. **Add path validation**:
```typescript
function validateStoragePath(path: string): void {
  if (path.includes('..')) {
    throw new Error('Path cannot contain ".."');
  }
  
  if (path.startsWith('/')) {
    throw new Error('Path cannot start with "/"');
  }
  
  if (!/^[a-zA-Z0-9_\-./]+$/.test(path)) {
    throw new Error('Path contains invalid characters');
  }
}
```

## References

- [Timing Attack Prevention](https://en.wikipedia.org/wiki/Timing_attack)
- [Google Cloud Storage Signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls)
- Security Audit #001: H-004

## Acceptance Criteria

- [ ] Constant-time comparison implemented
- [ ] Expiration time validation added
- [ ] Path validation implemented
- [ ] Monitoring hooks available
- [ ] All test cases pass
- [ ] Documentation updated
- [ ] No breaking changes to public API
