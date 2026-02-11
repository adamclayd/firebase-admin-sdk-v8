# Security Task: M-004 - Firestore Path Injection Risk

## Status: 🟡 PENDING
**Priority**: MEDIUM  
**Severity**: MEDIUM  
**Estimated Hours**: 2-3  
**Created**: 2026-02-11  
**From**: Security Audit #001

---

## Issue Description

Collection and document paths are not fully validated against injection attacks. Paths are used directly in URLs without comprehensive sanitization.

**Current Implementation** (`src/firestore/operations.ts`):
```typescript
const url = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/${collectionPath}/${documentId}`;
```

## Security Impact

- **Severity**: MEDIUM
- **Attack Vector**: Path traversal, unauthorized collection access
- **Potential Impact**:
  - Access to unintended collections
  - Path traversal attacks
  - URL manipulation
  - Data exfiltration

## Remediation

### Required Changes

1. **Implement comprehensive path validation**:
```typescript
// src/firestore/path-validation.ts - Enhance existing validation

/**
 * Validate Firestore path for security
 */
export function validateFirestorePath(
  path: string,
  type: 'collection' | 'document'
): void {
  if (!path || typeof path !== 'string') {
    throw new Error('Path must be a non-empty string');
  }
  
  // No null bytes
  if (path.includes('\0')) {
    throw new Error('Path cannot contain null bytes');
  }
  
  // No path traversal
  if (path.includes('..')) {
    throw new Error('Path cannot contain ".."');
  }
  
  // No leading/trailing slashes
  if (path.startsWith('/') || path.endsWith('/')) {
    throw new Error('Path cannot start or end with "/"');
  }
  
  // Valid characters only (alphanumeric, dash, underscore, slash)
  if (!/^[a-zA-Z0-9_\-/]+$/.test(path)) {
    throw new Error('Path contains invalid characters. Only alphanumeric, dash, underscore, and slash allowed');
  }
  
  // Validate segment count
  const segments = path.split('/').filter(s => s.length > 0);
  
  if (segments.length === 0) {
    throw new Error('Path cannot be empty');
  }
  
  // Check each segment
  for (const segment of segments) {
    if (segment.length === 0) {
      throw new Error('Path cannot contain empty segments');
    }
    
    if (segment.length > 1500) {
      throw new Error('Path segment too long. Max 1500 characters');
    }
  }
  
  // Validate collection vs document path
  if (type === 'collection' && segments.length % 2 !== 1) {
    throw new Error(`Invalid collection path. Expected odd number of segments, got ${segments.length}`);
  }
  
  if (type === 'document' && segments.length % 2 !== 0) {
    throw new Error(`Invalid document path. Expected even number of segments, got ${segments.length}`);
  }
}

/**
 * Validate document ID
 */
export function validateDocumentId(documentId: string): void {
  if (!documentId || typeof documentId !== 'string') {
    throw new Error('Document ID must be a non-empty string');
  }
  
  if (documentId.length > 1500) {
    throw new Error('Document ID too long. Max 1500 characters');
  }
  
  // No path separators
  if (documentId.includes('/') || documentId.includes('\\')) {
    throw new Error('Document ID cannot contain path separators');
  }
  
  // No path traversal
  if (documentId.includes('..')) {
    throw new Error('Document ID cannot contain ".."');
  }
  
  // No null bytes
  if (documentId.includes('\0')) {
    throw new Error('Document ID cannot contain null bytes');
  }
  
  // Valid characters
  if (!/^[a-zA-Z0-9_\-]+$/.test(documentId)) {
    throw new Error('Document ID contains invalid characters');
  }
}
```

2. **Update operations to use validation**:
```typescript
// src/firestore/operations.ts
import { validateFirestorePath, validateDocumentId } from './path-validation';

export async function setDocument(
  collectionPath: string,
  documentId: string,
  data: DataObject,
  options?: SetOptions
): Promise<void> {
  // Add comprehensive validation
  validateFirestorePath(collectionPath, 'collection');
  validateDocumentId(documentId);
  
  // ... rest of implementation
}
```

3. **Add comprehensive unit tests**:
```typescript
describe('Path Validation Security', () => {
  it('should reject path with null bytes', () => {
    expect(() => validateFirestorePath('users\0admin', 'collection'))
      .toThrow('null bytes');
  });
  
  it('should reject path traversal', () => {
    expect(() => validateFirestorePath('users/../admin', 'collection'))
      .toThrow('".."');
  });
  
  it('should reject path with special characters', () => {
    expect(() => validateFirestorePath('users@admin', 'collection'))
      .toThrow('invalid characters');
  });
  
  it('should reject document ID with path separator', () => {
    expect(() => validateDocumentId('user/admin'))
      .toThrow('path separators');
  });
  
  it('should reject empty path segments', () => {
    expect(() => validateFirestorePath('users//documents', 'collection'))
      .toThrow('empty segments');
  });
  
  it('should accept valid collection path', () => {
    expect(() => validateFirestorePath('users', 'collection')).not.toThrow();
    expect(() => validateFirestorePath('users/user123/posts', 'collection')).not.toThrow();
  });
  
  it('should accept valid document path', () => {
    expect(() => validateFirestorePath('users/user123', 'document')).not.toThrow();
  });
});
```

## Files to Modify

- `src/firestore/path-validation.ts` - Enhance validation
- `src/firestore/path-validation.spec.ts` - Add security tests
- `src/firestore/operations.ts` - Use enhanced validation
- `README.md` - Document path requirements

## Testing Requirements

- [ ] Unit tests for null bytes
- [ ] Unit tests for path traversal
- [ ] Unit tests for special characters
- [ ] Unit tests for empty segments
- [ ] Unit tests for segment length limits
- [ ] Unit tests for valid paths

## Documentation Updates

Add to README.md:
```markdown
### Firestore Path Requirements

Collection and document paths must meet security requirements:
- Only alphanumeric characters, dashes (-), underscores (_), and slashes (/)
- No path traversal sequences (..)
- No null bytes or control characters
- No leading or trailing slashes
- Maximum 1500 characters per segment
- Collection paths: odd number of segments (e.g., 'users', 'users/uid/posts')
- Document paths: even number of segments (e.g., 'users/uid', 'users/uid/posts/postId')
```

## References

- [Firestore Data Model](https://firebase.google.com/docs/firestore/data-model)
- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- Security Audit #001: M-004

## Acceptance Criteria

- [ ] Enhanced path validation implemented
- [ ] All security test cases pass
- [ ] Documentation updated
- [ ] No breaking changes for valid paths
- [ ] Clear error messages for invalid paths
