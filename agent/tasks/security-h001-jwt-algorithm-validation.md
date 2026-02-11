# Security Task: H-001 - JWT Algorithm Confusion Vulnerability

## Status: 🔴 PENDING
**Priority**: HIGH  
**Severity**: HIGH  
**Estimated Hours**: 2-3  
**Created**: 2026-02-11  
**From**: Security Audit #001

---

## Issue Description

The JWT verification code hardcodes RS256 algorithm validation but doesn't protect against algorithm confusion attacks where an attacker might try to bypass validation using:
- Case-sensitivity variations (`rs256`, `Rs256`, `rS256`)
- Whitespace manipulation (`RS256 `, ` RS256`)
- Unicode homograph attacks

**Current Code** (`src/auth.ts:165-167`):
```typescript
if (header.alg !== 'RS256') {
  throw new Error('Invalid algorithm. Expected RS256');
}
```

## Security Impact

- **Severity**: HIGH
- **Attack Vector**: Token forgery via algorithm confusion
- **Potential Impact**: Authentication bypass, unauthorized access

## Remediation

### Required Changes

1. **Normalize algorithm string before comparison**:
```typescript
// src/auth.ts - Update verifyIdToken function
const normalizedAlg = header.alg?.toString().trim().toUpperCase();
if (normalizedAlg !== 'RS256') {
  throw new Error(`Invalid algorithm. Expected RS256, got ${header.alg}`);
}
```

2. **Add explicit algorithm allowlist**:
```typescript
const ALLOWED_ALGORITHMS = ['RS256'] as const;

function validateAlgorithm(alg: unknown): void {
  if (typeof alg !== 'string') {
    throw new Error('Algorithm must be a string');
  }
  
  const normalized = alg.trim().toUpperCase();
  if (!ALLOWED_ALGORITHMS.includes(normalized as any)) {
    throw new Error(`Algorithm not in allowlist. Got: ${alg}`);
  }
}
```

3. **Add unit tests**:
```typescript
describe('JWT Algorithm Validation', () => {
  it('should reject lowercase algorithm', async () => {
    const token = createTokenWithAlg('rs256');
    await expect(verifyIdToken(token)).rejects.toThrow('Algorithm not in allowlist');
  });
  
  it('should reject algorithm with whitespace', async () => {
    const token = createTokenWithAlg(' RS256 ');
    await expect(verifyIdToken(token)).rejects.toThrow();
  });
  
  it('should reject mixed case algorithm', async () => {
    const token = createTokenWithAlg('Rs256');
    await expect(verifyIdToken(token)).rejects.toThrow();
  });
});
```

## Files to Modify

- `src/auth.ts` - Add algorithm validation
- `src/auth.spec.ts` - Add test cases

## Testing Requirements

- [ ] Unit tests for case variations
- [ ] Unit tests for whitespace
- [ ] Unit tests for non-string values
- [ ] E2E test with real token

## References

- [JWT Algorithm Confusion Attacks](https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/)
- [Red Sentry JWT Vulnerabilities 2026](https://redsentry.com/resources/blog/jwt-vulnerabilities-list-2026-security-risks-mitigation-guide)
- Security Audit #001: H-001

## Acceptance Criteria

- [ ] Algorithm validation normalizes input
- [ ] Explicit allowlist implemented
- [ ] All test cases pass
- [ ] No breaking changes to public API
- [ ] Documentation updated
