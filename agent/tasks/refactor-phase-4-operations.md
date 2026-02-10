# Refactoring Phase 4: Extract CRUD Operations

## Objective
Extract CRUD operations from `firestore-rest.ts` into a dedicated `operations.ts` module, leaving only the main entry point.

## Current State
- All CRUD functions are in `firestore-rest.ts`
- Limited tests for CRUD operations (need mocked fetch)
- Functions use converters, transforms, and query builder

## Tasks

### 1. Create src/firestore/operations.ts
Extract the following functions:
- `setDocument(collectionPath, documentId, data, options)` - Create or overwrite document
- `getDocument(collectionPath, documentId)` - Fetch document
- `updateDocument(collectionPath, documentId, data)` - Update document fields
- `deleteDocument(collectionPath, documentId)` - Delete document
- `addDocument(collectionPath, data, documentId?)` - Add document with auto-ID
- `queryDocuments(collectionPath, options?)` - Query collection with filters
- `batchWrite(operations)` - Batch write operations

Dependencies needed:
- Import converters from `./converters`
- Import transforms from `./transforms`
- Import query builder from `./query-builder`
- Import `getAdminAccessToken` from `../token-generation`
- Import `getProjectId` from `../service-account`
- Import types from `../types`

### 2. Create src/firestore/operations.spec.ts
Add comprehensive tests with mocked fetch:
- Mock `getAdminAccessToken()` to return test token
- Mock `getProjectId()` to return test project
- Mock `global.fetch` to return test responses
- Test each CRUD operation:
  - Verify correct URL construction
  - Verify correct request body
  - Verify correct headers
  - Verify response parsing
  - Test error handling
  - Test subcollection paths

Estimated: 30-40 tests

### 3. Update firestore-rest.ts
After extraction, firestore-rest.ts should be minimal:
- Import all operations from `./firestore/operations`
- Re-export for backward compatibility
- Maybe keep as thin wrapper or deprecate in favor of direct imports

### 4. Create src/firestore/index.ts (Barrel Export)
Public API exports following firebase-admin-node pattern:
```typescript
export * from './converters';
export * from './transforms';
export * from './query-builder';
export * from './operations';
```

### 5. Update src/index.ts
Consider updating main index to import from firestore module:
```typescript
export * from './firestore';
// or keep current structure for backward compatibility
```

### 6. Verify
- Run `npm test` - all tests should pass
- Run `npm run build` - should compile without errors
- Check that public API is unchanged
- Verify bundle size hasn't increased significantly

## Expected Outcome

**Before:**
- firestore-rest.ts: ~550 lines (after Phase 3)
- Limited CRUD tests

**After:**
- firestore-rest.ts: ~50 lines (thin wrapper or deprecated)
- firestore/operations.ts: ~500 lines
- firestore/operations.spec.ts: 30-40 tests
- firestore/index.ts: Barrel export
- Total tests: ~170+

## Success Criteria
- ✅ All tests passing (133+ existing + 30-40 new)
- ✅ No breaking changes to public API
- ✅ Operations module is independently testable
- ✅ Coverage increases significantly (40% → 60%+)
- ✅ Clean module structure
- ✅ Backward compatible

## Estimated Time
4-6 hours

## Priority
Medium - Can be done after Phases 2-3, or in parallel

## Dependencies
- Phase 1 (Converters) must be complete ✅
- Phase 2 (Query Builder) should be complete
- Phase 3 (Transforms) should be complete

## Notes
- This is the largest refactoring phase
- CRUD operations are the main public API
- Need comprehensive mocked fetch tests
- Consider keeping firestore-rest.ts as a thin compatibility layer
- Or deprecate it in favor of direct imports from firestore/
- Follow firebase-admin-node pattern of internal + namespace + index

## Testing Strategy

### Mock Setup
```typescript
// Mock dependencies
jest.mock('../token-generation', () => ({
  getAdminAccessToken: jest.fn().mockResolvedValue('test-token')
}));

jest.mock('../service-account', () => ({
  getProjectId: jest.fn().mockReturnValue('test-project')
}));

// Mock fetch
global.fetch = jest.fn();
```

### Test Pattern
```typescript
it('should call correct URL for setDocument', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({})
  });

  await setDocument('users', 'user123', { name: 'John' });

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/users/user123'),
    expect.objectContaining({
      method: 'PATCH',
      headers: expect.objectContaining({
        'Authorization': 'Bearer test-token'
      })
    })
  );
});
```

## Impact on Coverage
- Current: 31.66% overall, firestore-rest.ts at 40.62%
- Expected after Phase 4: 50-60% overall
- Operations tests will significantly boost coverage
