# Security Task: H-003 - Insecure Custom Claims Validation

## Status: 🔴 PENDING
**Priority**: HIGH  
**Severity**: HIGH  
**Estimated Hours**: 2-3  
**Created**: 2026-02-11  
**From**: Security Audit #001

---

## Issue Description

Custom claims are accepted without validation, allowing potential security issues:
- No size limit (claims could be extremely large - DoS)
- No reserved claim protection (could override `iss`, `sub`, `aud`, `exp`)
- No type validation (could contain functions, circular references)
- No sensitive data detection

**Current Code** (`src/auth.ts:374-376`):
```typescript
if (customClaims) {
  payload.claims = customClaims;
}
```

## Security Impact

- **Severity**: HIGH
- **Attack Vector**: Token manipulation, DoS, data leakage
- **Potential Impact**:
  - Token size explosion (DoS)
  - JWT parsing errors
  - Reserved claim override (security bypass)
  - Sensitive data leakage in tokens

## Remediation

### Required Changes

1. **Implement custom claims validation**:
```typescript
// src/auth.ts - Add validation constants and function
const RESERVED_CLAIMS = ['iss', 'sub', 'aud', 'iat', 'exp', 'uid', 'claims', 'auth_time', 'firebase'];
const MAX_CLAIMS_SIZE = 1000; // bytes
const MAX_CLAIM_DEPTH = 5;

function validateCustomClaims(claims: Record<string, any>): void {
  if (!claims || typeof claims !== 'object') {
    throw new Error('Custom claims must be an object');
  }
  
  // Check for array (not allowed)
  if (Array.isArray(claims)) {
    throw new Error('Custom claims cannot be an array');
  }
  
  // Check size
  const claimsStr = JSON.stringify(claims);
  if (claimsStr.length > MAX_CLAIMS_SIZE) {
    throw new Error(`Custom claims too large. Max ${MAX_CLAIMS_SIZE} bytes, got ${claimsStr.length}`);
  }
  
  // Check for reserved claims
  for (const key of Object.keys(claims)) {
    if (RESERVED_CLAIMS.includes(key)) {
      throw new Error(`Cannot use reserved claim: ${key}`);
    }
  }
  
  // Validate JSON serializability (catches circular refs, functions)
  try {
    JSON.parse(claimsStr);
  } catch (e) {
    throw new Error('Custom claims must be JSON serializable');
  }
  
  // Check depth (prevent deeply nested objects)
  function checkDepth(obj: any, depth = 0): void {
    if (depth > MAX_CLAIM_DEPTH) {
      throw new Error(`Custom claims too deeply nested. Max depth: ${MAX_CLAIM_DEPTH}`);
    }
    if (obj && typeof obj === 'object') {
      for (const value of Object.values(obj)) {
        checkDepth(value, depth + 1);
      }
    }
  }
  checkDepth(claims);
}
```

2. **Update createCustomToken**:
```typescript
export async function createCustomToken(
  uid: string,
  customClaims?: CustomClaims
): Promise<string> {
  validateUID(uid);
  
  // Validate custom claims if provided
  if (customClaims) {
    validateCustomClaims(customClaims);
  }
  
  const serviceAccount = getServiceAccount();
  // ... rest of implementation
}
```

3. **Add comprehensive unit tests**:
```typescript
describe('Custom Claims Validation', () => {
  it('should accept valid custom claims', async () => {
    const claims = { role: 'admin', premium: true };
    await expect(createCustomToken('user123', claims)).resolves.toBeDefined();
  });
  
  it('should reject claims that are too large', async () => {
    const largeClaims = { data: 'x'.repeat(2000) };
    await expect(createCustomToken('user123', largeClaims)).rejects.toThrow('too large');
  });
  
  it('should reject reserved claim: iss', async () => {
    const claims = { iss: 'attacker@evil.com' };
    await expect(createCustomToken('user123', claims)).rejects.toThrow('reserved claim');
  });
  
  it('should reject reserved claim: sub', async () => {
    const claims = { sub: 'admin' };
    await expect(createCustomToken('user123', claims)).rejects.toThrow('reserved claim');
  });
  
  it('should reject reserved claim: uid', async () => {
    const claims = { uid: 'admin' };
    await expect(createCustomToken('user123', claims)).rejects.toThrow('reserved claim');
  });
  
  it('should reject array as claims', async () => {
    const claims = ['admin', 'user'] as any;
    await expect(createCustomToken('user123', claims)).rejects.toThrow('must be an object');
  });
  
  it('should reject deeply nested claims', async () => {
    const deepClaims = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } };
    await expect(createCustomToken('user123', deepClaims)).rejects.toThrow('too deeply nested');
  });
  
  it('should reject claims with circular references', async () => {
    const circular: any = { a: 1 };
    circular.self = circular;
    await expect(createCustomToken('user123', circular)).rejects.toThrow('JSON serializable');
  });
});
```

## Files to Modify

- `src/auth.ts` - Add validateCustomClaims function
- `src/auth.spec.ts` - Add test cases
- `src/types.ts` - Update CustomClaims type documentation
- `README.md` - Document claims requirements

## Testing Requirements

- [ ] Unit tests for valid claims
- [ ] Unit tests for size limits
- [ ] Unit tests for reserved claims
- [ ] Unit tests for type validation
- [ ] Unit tests for depth limits
- [ ] Unit tests for circular references

## Documentation Updates

Add to README.md:
```markdown
### Custom Claims Requirements

Custom claims must meet the following requirements:
- Maximum 1000 bytes when JSON stringified
- Cannot use reserved claim names (iss, sub, aud, iat, exp, uid, claims, auth_time, firebase)
- Must be a plain object (not an array)
- Must be JSON serializable (no functions, circular references)
- Maximum nesting depth of 5 levels
- Should not contain sensitive data (passwords, secrets, PII)
```

## References

- [Firebase Custom Claims Best Practices](https://firebase.google.com/docs/auth/admin/custom-claims)
- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- Security Audit #001: H-003

## Acceptance Criteria

- [ ] Custom claims validation implemented
- [ ] All test cases pass
- [ ] Documentation updated
- [ ] Clear error messages
- [ ] No breaking changes for valid claims
