# Refactoring Phase 3: Extract Field Transforms

## Objective
Extract field transform logic from `firestore-rest.ts` into a dedicated `transforms.ts` module.

## Current State
- `extractFieldTransforms()` and `removeFieldTransforms()` are in `firestore-rest.ts`
- Tests exist in `firestore-rest.spec.ts`
- Functions are already exported for testing

## Tasks

### 1. Create src/firestore/transforms.ts
Extract the following functions:
- `extractFieldTransforms(data, fieldPrefix)` - Extract FieldValue sentinels as transforms
- `removeFieldTransforms(data)` - Remove FieldValue sentinels from data

Dependencies needed:
- Import `isFieldValue` from `../field-value`
- Import `toFirestoreValue` from `./converters`
- Import types from `../types`

### 2. Create src/firestore/transforms.spec.ts
Move existing tests from `firestore-rest.spec.ts`:
- 7 tests for extractFieldTransforms
- 7 tests for removeFieldTransforms
- Total: 14 tests to move

### 3. Update firestore-rest.ts
- Import `extractFieldTransforms` and `removeFieldTransforms` from `./firestore/transforms`
- Re-export for backward compatibility
- Remove old function definitions

### 4. Verify
- Run `npm test` - all tests should pass
- Run `npm run build` - should compile without errors
- Check that public API is unchanged

## Expected Outcome

**Before:**
- firestore-rest.ts: ~600 lines (after Phase 2)
- Tests: ~29 in firestore-rest.spec.ts

**After:**
- firestore-rest.ts: ~550 lines (50 lines moved)
- firestore/transforms.ts: ~50 lines
- firestore/transforms.spec.ts: 14 tests
- firestore-rest.spec.ts: ~15 tests (moved 14 to transforms)

## Success Criteria
- ✅ All 133 tests still passing
- ✅ No breaking changes to public API
- ✅ Transforms module is independently testable
- ✅ Code is more maintainable
- ✅ Coverage maintained or improved

## Estimated Time
2-4 hours

## Priority
High - Transforms are used in all write operations

## Dependencies
- Phase 1 (Converters) must be complete ✅
- Phase 2 (Query Builder) should be complete

## Notes
- Transforms depend on converters (toFirestoreValue)
- Used by setDocument, updateDocument, addDocument, batchWrite
- Critical for FieldValue sentinels (serverTimestamp, increment, etc.)
- Follow the pattern established in Phase 1
