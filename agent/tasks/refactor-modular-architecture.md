# Task: Refactor Library into Modular, Testable Files

## Objective
Break up the firebase-admin-sdk-v8 library into smaller, more modular files that are easier to test, maintain, and understand, following patterns from the official firebase-admin-node SDK while maintaining zero dependencies.

## Current State
- Large monolithic files (e.g., `firestore-rest.ts` was 787 lines, now 681 after Phase 1)
- Mixed concerns (data conversion, query building, API calls all in one file)
- Test coverage: 31.66% (target: 80%)
- Phase 1 complete: Converters extracted ✅

## Reference: Official firebase-admin-node Structure

The official SDK uses a clean modular structure:
```
src/
├── app/                    # App initialization
├── auth/                   # Authentication
├── firestore/              # Firestore (wraps @google-cloud/firestore)
│   ├── firestore-internal.ts
│   ├── firestore-namespace.ts
│   └── index.ts
├── database/               # Realtime Database
├── messaging/              # Cloud Messaging
└── ...
```

**Key Insights:**
- Each service in its own directory
- Thin wrapper pattern (internal + namespace + index)
- Clear separation between public API and implementation
- Uses barrel exports (index.ts) for clean imports

## Proposed Structure

### 1. Firestore Module Breakdown

**Current**: `src/firestore-rest.ts` (681 lines after Phase 1)

**Completed (Phase 1):**
```
src/firestore/
├── converters.ts               # ✅ Data format conversion utilities
├── converters.spec.ts          # ✅ 22 tests, 100% coverage
```

**Remaining Phases:**
```
src/firestore/
├── index.ts                    # Public API barrel export
├── transforms.ts               # Field transform handling
│   ├── extractFieldTransforms()
│   └── removeFieldTransforms()
├── transforms.spec.ts          # Tests for transforms
├── query-builder.ts            # Query construction
│   ├── buildStructuredQuery()
│   └── mapWhereOp()
├── query-builder.spec.ts       # Tests for query builder
├── operations.ts               # CRUD operations (REST API calls)
│   ├── setDocument()
│   ├── getDocument()
│   ├── updateDocument()
│   ├── deleteDocument()
│   ├── addDocument()
│   └── queryDocuments()
├── operations.spec.ts          # Tests for operations
├── batch.ts                    # Batch operations
│   └── batchWrite()
└── batch.spec.ts               # Tests for batch
```

**Note**: Unlike firebase-admin-node which wraps @google-cloud/firestore, we implement direct REST API calls with zero dependencies.

### 2. Auth Module Breakdown

**Current**: `src/auth.ts` (256 lines, 0% coverage)

**Proposed**:
```
src/auth/
├── index.ts                    # Public API exports
├── token-verifier.ts           # JWT verification using Web Crypto API
├── token-verifier.spec.ts      # Tests for verification
├── public-keys.ts              # Public key fetching and caching
├── public-keys.spec.ts         # Tests for key management
└── claims.ts                   # Custom claims via REST API
```

**Note**: Unlike firebase-admin-node which uses jsonwebtoken + jwks-rsa libraries, we use Web Crypto API and manual key management.

### 3. Token Generation Module

**Current**: `src/token-generation.ts` (134 lines, 14% coverage)

**Proposed**:
```
src/token/
├── index.ts                    # Public API exports
├── generator.ts                # JWT generation using Web Crypto API
├── generator.spec.ts           # Tests for generation
├── signer.ts                   # RSA signing with Web Crypto
├── signer.spec.ts              # Tests for signing
├── cache.ts                    # Token caching logic
└── cache.spec.ts               # Tests for cache
```

**Note**: Unlike firebase-admin-node which uses google-auth-library, we implement OAuth2 JWT flow manually with Web Crypto API.

### 4. X.509 Certificate Module

**Current**: `src/x509.ts` (139 lines, 0% coverage)

**Proposed**:
```
src/x509/
├── index.ts                    # Public API exports
├── parser.ts                   # Manual PEM/DER parsing
├── parser.spec.ts              # Tests for parser
├── validator.ts                # Certificate validation
└── validator.spec.ts           # Tests for validation
```

**Note**: Unlike firebase-admin-node which uses node-forge library, we implement X.509 parsing manually to avoid dependencies.

## Benefits

### 1. **Improved Testability**
- Smaller, focused functions easier to unit test
- Each module can be tested in isolation
- Better test coverage through granular testing

### 2. **Better Maintainability**
- Easier to locate and fix bugs
- Clear separation of concerns
- Reduced cognitive load when reading code

### 3. **Enhanced Reusability**
- Internal utilities can be reused across modules
- Easier to extract common patterns
- Better code organization

### 4. **Clearer API Surface**
- Public exports clearly defined in index files
- Internal implementation details hidden
- Better documentation structure

### 5. **Easier Collaboration**
- Multiple developers can work on different modules
- Reduced merge conflicts
- Clear module boundaries

## Implementation Plan

### Phase 1: Firestore Converters ✅ COMPLETE
1. ✅ Extracted data conversion functions to `src/firestore/converters.ts`
2. ✅ Added 22 comprehensive tests in `src/firestore/converters.spec.ts`
3. ✅ Updated imports in `firestore-rest.ts`
4. ✅ All 133 tests passing
5. ✅ Re-exported for backward compatibility

### Phase 2: Firestore Query Builder (High Priority)
1. Extract `buildStructuredQuery` and `mapWhereOp` to `src/firestore/query-builder.ts`
2. Move existing tests from `firestore-rest.spec.ts` to `query-builder.spec.ts`
3. Add additional edge case tests
4. Update imports

### Phase 3: Firestore Transforms (Medium Priority)
1. Extract field transform functions to `src/firestore/transforms.ts`
2. Add tests for all transform types (serverTimestamp, increment, arrayUnion, etc.)
3. Update imports

### Phase 4: Firestore Operations (Medium Priority)
1. Extract CRUD operations to `src/firestore/operations.ts`
2. Consider creating a Firestore client class for better organization
3. Add integration-style tests (mocked fetch calls)
4. Update imports

### Phase 5: Auth & Token Modules (Low Priority)
1. Break up auth module into smaller pieces
2. Extract token generation and caching logic
3. Add comprehensive tests for each module

### Phase 6: X.509 Module (Low Priority)
1. Split certificate parsing and validation
2. Add tests for certificate handling
3. Update imports

## Testing Strategy

### Unit Tests
- Each module should have its own `.spec.ts` file
- Test pure functions in isolation
- Mock external dependencies (fetch, etc.)
- Aim for >80% code coverage

### Integration Tests
- Test module interactions
- Verify API contracts between modules
- Test with real-like data structures

### Regression Tests
- Ensure existing functionality still works
- Run full test suite after each refactor phase
- Verify no breaking changes to public API

## Migration Strategy

### Backward Compatibility
- Keep existing public API unchanged
- Internal refactoring only
- No breaking changes for consumers

### Incremental Approach
- Refactor one module at a time
- Commit after each successful phase
- Run tests after each change

### Documentation
- Update README with new structure
- Add JSDoc comments to all public functions
- Create architecture documentation

## Success Criteria

1. ✅ All existing tests pass
2. ✅ Test coverage increases to >80%
3. ✅ No breaking changes to public API
4. ✅ Each file is <300 lines
5. ✅ Clear module boundaries
6. ✅ Improved documentation
7. ✅ Faster test execution (parallel testing)

## Timeline

- **Phase 1**: ✅ COMPLETE (Converters extracted)
- **Phase 2**: 2-4 hours (Query builder extraction)
- **Phase 3**: 2-4 hours (Transforms extraction)
- **Phase 4**: 4-6 hours (Operations extraction)
- **Phase 5-6**: 4-6 hours (Auth & Token modules)

**Remaining Time**: 12-20 hours

## Notes

- This refactor should not change any external behavior
- Focus on internal code organization and testability
- Keep the public API surface the same
- Use barrel exports (index.ts files) like firebase-admin-node
- Must maintain zero dependencies (unlike firebase-admin-node)
- Use Web Crypto API instead of Node.js crypto or libraries
- Direct REST API calls instead of Google Cloud client libraries
- See [`agent/comparison.md`](../comparison.md) for detailed comparison with official SDK

## Lessons from firebase-admin-node

### What to Adopt
1. **Modular directory structure** - Each service in its own directory
2. **Barrel exports** - Clean public API via index.ts files
3. **Separation of concerns** - Internal implementation vs public API
4. **Comprehensive testing** - Each module has its own test file

### What to Avoid
1. **External dependencies** - We must stay dependency-free for edge runtimes
2. **Node.js-specific APIs** - Must use Web standards (fetch, Web Crypto)
3. **Complex abstractions** - Keep it simple and understandable
4. **Large bundle size** - Stay lightweight (~28KB vs their much larger size)
