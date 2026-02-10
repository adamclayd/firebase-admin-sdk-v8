# Task: Refactor Library into Modular, Testable Files

## Objective
Break up the firebase-admin-sdk-v8 library into smaller, more modular files that are easier to test, maintain, and understand.

## Current State
- Large monolithic files (e.g., `firestore-rest.ts` is 787 lines)
- Mixed concerns (data conversion, query building, API calls all in one file)
- Limited test coverage
- Internal functions not easily testable

## Proposed Structure

### 1. Firestore Module Breakdown

**Current**: `src/firestore-rest.ts` (787 lines)

**Proposed**:
```
src/firestore/
├── index.ts                    # Public API exports
├── client.ts                   # Main Firestore client class
├── converters.ts               # Data format conversion utilities
│   ├── toFirestoreValue()
│   ├── fromFirestoreValue()
│   ├── convertToFirestoreFormat()
│   └── convertFromFirestoreFormat()
├── converters.spec.ts          # Tests for converters
├── transforms.ts               # Field transform handling
│   ├── extractFieldTransforms()
│   └── removeFieldTransforms()
├── transforms.spec.ts          # Tests for transforms
├── query-builder.ts            # Query construction
│   ├── buildStructuredQuery()
│   └── mapWhereOp()
├── query-builder.spec.ts       # Tests for query builder
├── operations.ts               # CRUD operations
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

### 2. Auth Module Breakdown

**Current**: `src/auth.ts`

**Proposed**:
```
src/auth/
├── index.ts                    # Public API exports
├── token-verifier.ts           # JWT verification logic
├── token-verifier.spec.ts      # Tests for verification
├── claims.ts                   # Custom claims handling
└── claims.spec.ts              # Tests for claims
```

### 3. Token Generation Module

**Current**: `src/token-generation.ts`

**Proposed**:
```
src/token/
├── index.ts                    # Public API exports
├── generator.ts                # Token generation
├── generator.spec.ts           # Tests for generation
├── cache.ts                    # Token caching logic
└── cache.spec.ts               # Tests for cache
```

### 4. X.509 Certificate Module

**Current**: `src/x509.ts`

**Proposed**:
```
src/x509/
├── index.ts                    # Public API exports
├── parser.ts                   # Certificate parsing
├── parser.spec.ts              # Tests for parser
├── validator.ts                # Certificate validation
└── validator.spec.ts           # Tests for validation
```

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

### Phase 1: Firestore Converters (High Priority)
1. Extract data conversion functions to `src/firestore/converters.ts`
2. Add comprehensive tests in `src/firestore/converters.spec.ts`
3. Update imports in `firestore-rest.ts`
4. Verify all existing tests still pass

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

- **Phase 1-2**: 1-2 days (High priority, immediate value)
- **Phase 3-4**: 2-3 days (Medium priority)
- **Phase 5-6**: 2-3 days (Low priority, can be deferred)

**Total Estimated Time**: 5-8 days

## Notes

- This refactor should not change any external behavior
- Focus on internal code organization and testability
- Keep the public API surface the same
- Consider using barrel exports (index.ts files) for clean imports
- May want to add a build step to bundle modules for distribution
