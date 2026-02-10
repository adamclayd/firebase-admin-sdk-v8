# Field Transforms API Issue

## Problem
Field transforms (serverTimestamp, increment, arrayUnion, arrayRemove) are failing in e2e tests with error:
```
Invalid JSON payload received. Unknown name "transforms" at 'document': Cannot find field.
```

## Root Cause
We're currently trying to include transforms in the document payload when using `patch` or `createDocument` endpoints. However, **field transforms require using the `:commit` API endpoint** with a different structure.

## Correct API Format

### Current (Broken) Approach
```
PATCH /documents/collection/docId
{
  "fields": { ... },
  "transforms": [ ... ]  // ❌ Not valid here
}
```

### Correct Approach
```
POST /databases/(default)/documents:commit
{
  "writes": [
    {
      "update": {
        "name": "projects/{project}/databases/(default)/documents/collection/docId",
        "fields": { ... }
      },
      "updateMask": { "fieldPaths": [...] },
      "currentDocument": { "exists": true }
    },
    {
      "transform": {
        "document": "projects/{project}/databases/(default)/documents/collection/docId",
        "fieldTransforms": [
          {
            "fieldPath": "timestamp",
            "setToServerValue": "REQUEST_TIME"
          },
          {
            "fieldPath": "counter",
            "increment": { "integerValue": "1" }
          }
        ]
      }
    }
  ]
}
```

## Key Differences

1. **Endpoint**: Must use `:commit` instead of `patch` or `createDocument`
2. **Structure**: Transforms go in a separate `Write` object with `transform` field
3. **Document Path**: Full document path required in transform
4. **Atomic**: All writes in the commit are atomic

## Implementation Options

### Option 1: Use `:commit` for All Writes with Transforms
- Pros: Proper API usage, atomic operations
- Cons: More complex, requires refactoring setDocument/updateDocument

### Option 2: Separate API for Transforms
- Create `setDocumentWithTransforms()` and `updateDocumentWithTransforms()`
- Pros: Backward compatible, clear API
- Cons: API duplication

### Option 3: Auto-detect and Route
- Detect FieldValue sentinels and automatically use `:commit` API
- Pros: Transparent to users
- Cons: Complex logic, harder to debug

## Recommended Approach
**Option 1** - Refactor to use `:commit` API when transforms are present.

### Implementation Steps
1. Create `commitWrite()` function that uses `:commit` endpoint
2. Modify `setDocument()` and `updateDocument()` to:
   - Extract transforms using `extractFieldTransforms()`
   - If transforms exist, use `commitWrite()` with Write objects
   - If no transforms, use current `patch`/`createDocument` approach
3. Update tests to verify transform behavior

## References
- [Firestore REST API Write](https://cloud.google.com/firestore/docs/reference/rest/v1/Write)
- [Commit Method](https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/commit)
- [Stack Overflow: Field Transforms](https://stackoverflow.com/questions/71538059/firestore-document-not-incrementing-using-rest-api)

## Priority
High - Blocks 5 e2e tests and is a core feature

## Estimated Effort
4-6 hours to implement and test properly
