# Refactoring Phase 2: Extract Query Builder

## Objective
Extract query building logic from `firestore-rest.ts` into a dedicated `query-builder.ts` module.

## Current State
- `buildStructuredQuery()` and `mapWhereOp()` are in `firestore-rest.ts`
- Tests exist in `firestore-rest.spec.ts`
- Functions are already exported for testing

## Tasks

### 1. Create src/firestore/query-builder.ts
Extract the following functions:
- `buildStructuredQuery(collectionPath, options)` - Build Firestore structured queries
- `mapWhereOp(op)` - Map query operators to Firestore format

### 2. Create src/firestore/query-builder.spec.ts
Move existing tests from `firestore-rest.spec.ts`:
- 5 tests for buildStructuredQuery
- 4 tests for URL generation (keep these in firestore-rest.spec.ts as integration tests)
- Add tests for mapWhereOp (all operators)

### 3. Update firestore-rest.ts
- Import `buildStructuredQuery` and `mapWhereOp` from `./firestore/query-builder`
- Re-export for backward compatibility
- Remove old function definitions

### 4. Verify
- Run `npm test` - all tests should pass
- Run `npm run build` - should compile without errors
- Check that public API is unchanged

## Expected Outcome

**Before:**
- firestore-rest.ts: 681 lines
- Tests: 44 in firestore-rest.spec.ts

**After:**
- firestore-rest.ts: ~600 lines (80 lines moved)
- firestore/query-builder.ts: ~80 lines
- firestore/query-builder.spec.ts: ~15 tests
- firestore-rest.spec.ts: ~29 tests (moved 15 to query-builder)

## Success Criteria
- ✅ All 133 tests still passing
- ✅ No breaking changes to public API
- ✅ Query builder module is independently testable
- ✅ Code is more maintainable
- ✅ Coverage maintained or improved

## Estimated Time
2-4 hours

## Priority
High - Query builder is core functionality

## Dependencies
- Phase 1 (Converters) must be complete ✅

## Notes
- Follow the pattern established in Phase 1
- Maintain backward compatibility with re-exports
- Keep tests colocated with source files
- Reference firebase-admin-node structure for inspiration
