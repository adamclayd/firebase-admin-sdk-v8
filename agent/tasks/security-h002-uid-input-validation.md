# Security Task: H-002 - Insufficient UID Input Validation

## Status: 🔴 PENDING
**Priority**: HIGH  
**Severity**: HIGH  
**Estimated Hours**: 2-3  
**Created**: 2026-02-11  
**From**: Security Audit #001

---

## Issue Description

The UID validation for custom tokens only checks length and type, but doesn't validate against injection attacks. Missing validations include:
- No character allowlist (could contain control characters, null bytes)
- No format validation (no regex pattern enforcement)
- No SQL/NoSQL injection prevention
- No path traversal prevention (`../` sequences)

**Current Code** (`src/auth.ts:353-360`):
```typescript
if (!uid || typeof uid !== 'string') {
  throw new Error('uid must be a non-empty string');
}

if (uid.length > 128) {
  throw new Error('uid must be at most 128 characters');
}
```

## Security Impact

- **Severity**: HIGH
- **Attack Vector**: Injection attacks via malicious UIDs
- **Potential Impact**: 
  - Log injection
  - Path traversal
  - Database query manipulation
  - Downstream system compromise

## Remediation

### Required Changes

1. **Implement comprehensive UID validation**:
```typescript
// src/auth.ts - Add validation function
function validateUID(uid: string): void {
  // Type and length checks
  if (!uid || typeof uid !== 'string') {
    throw new Error('uid must be a non-empty string');
  }
  
  if (uid.length > 128) {
    throw new Error('uid must be at most 128 characters');
  }
  
  // Character allowlist (alphanumeric, dash, underscore only)
  if (!/^[a-zA-Z0-9_-]+$/.test(uid)) {
    throw new Error('uid contains invalid characters. Only alphanumeric, dash, and underscore allowed');
  }
  
  // Prevent path traversal
  if (uid.includes('..') || uid.includes('/') || uid.includes('\\')) {
    throw new Error('uid cannot contain path traversal sequences');
  }
  
  // Prevent null bytes
  if (uid.includes('\0')) {
    throw new Error('uid cannot contain null bytes');
  }
  
  // Prevent control characters
  if (/[\x00-\x1F\x7F]/.test(uid)) {
    throw new Error('uid cannot contain control characters');
  }
}
```

2. **Update createCustomToken to use validation**:
```typescript
export async function createCustomToken(
  uid: string,
  customClaims?: CustomClaims
): Promise<string> {
  validateUID(uid); // Add this line
  
  const serviceAccount = getServiceAccount();
  // ... rest of implementation
}
```

3. **Add comprehensive unit tests**:
```typescript
describe('UID Validation', () => {
  it('should accept valid alphanumeric UID', async () => {
    await expect(createCustomToken('user123')).resolves.toBeDefined();
  });
  
  it('should accept UID with dashes and underscores', async () => {
    await expect(createCustomToken('user_123-abc')).resolves.toBeDefined();
  });
  
  it('should reject UID with special characters', async () => {
    await expect(createCustomToken('user@123')).rejects.toThrow('invalid characters');
  });
  
  it('should reject UID with path traversal', async () => {
    await expect(createCustomToken('../admin')).rejects.toThrow('path traversal');
  });
  
  it('should reject UID with null bytes', async () => {
    await expect(createCustomToken('user\0admin')).rejects.toThrow('null bytes');
  });
  
  it('should reject UID with control characters', async () => {
    await expect(createCustomToken('user\n123')).rejects.toThrow('control characters');
  });
  
  it('should reject UID with SQL injection attempt', async () => {
    await expect(createCustomToken("'; DROP TABLE users--")).rejects.toThrow();
  });
});
```

## Files to Modify

- `src/auth.ts` - Add validateUID function
- `src/auth.spec.ts` - Add test cases
- `README.md` - Document UID requirements

## Testing Requirements

- [ ] Unit tests for valid UIDs
- [ ] Unit tests for special characters
- [ ] Unit tests for path traversal
- [ ] Unit tests for null bytes
- [ ] Unit tests for control characters
- [ ] Unit tests for injection attempts

## Documentation Updates

Add to README.md:
```markdown
### UID Requirements for Custom Tokens

UIDs must meet the following requirements:
- Maximum 128 characters
- Only alphanumeric characters, dashes (-), and underscores (_)
- No path traversal sequences (../, ..\)
- No null bytes or control characters
- No special characters (@, #, $, etc.)
```

## References

- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- Security Audit #001: H-002

## Acceptance Criteria

- [ ] Comprehensive UID validation implemented
- [ ] All test cases pass
- [ ] Documentation updated
- [ ] No breaking changes for valid UIDs
- [ ] Clear error messages for invalid UIDs
