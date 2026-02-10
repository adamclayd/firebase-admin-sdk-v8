# Task: Expand Unit Tests for firestore-rest.ts

## File
`src/firestore-rest.ts`

## Current Status
- ✅ Partial test file exists: `src/firestore-rest.spec.ts`
- ✅ Tests for `buildStructuredQuery` and URL generation
- ❌ Missing tests for CRUD operations, converters, and transforms

## Objective
Expand test coverage to include all functions in firestore-rest.ts.

## Test File
Expand: `src/firestore-rest.spec.ts`

## Functions Already Tested
- ✅ `buildStructuredQuery()` - Query structure generation
- ✅ URL generation for subcollections

## Functions Needing Tests

### 1. Data Conversion Functions

#### `toFirestoreValue(value: any)`
**Test Cases:**
- ✅ Should convert null/undefined to nullValue
- ✅ Should convert strings to stringValue
- ✅ Should convert booleans to booleanValue
- ✅ Should convert integers to integerValue
- ✅ Should convert floats to doubleValue
- ✅ Should convert Date to timestampValue
- ✅ Should convert arrays to arrayValue
- ✅ Should convert objects to mapValue
- ✅ Should handle nested objects
- ✅ Should handle FieldValue sentinels

#### `fromFirestoreValue(value: FirestoreValue)`
**Test Cases:**
- ✅ Should convert stringValue to string
- ✅ Should convert integerValue to number
- ✅ Should convert doubleValue to number
- ✅ Should convert booleanValue to boolean
- ✅ Should convert nullValue to null
- ✅ Should convert timestampValue to Date
- ✅ Should convert arrayValue to array
- ✅ Should convert mapValue to object
- ✅ Should handle nested structures

### 2. Transform Functions

#### `extractFieldTransforms(data: DataObject)`
**Test Cases:**
- ✅ Should extract serverTimestamp transforms
- ✅ Should extract increment transforms
- ✅ Should extract arrayUnion transforms
- ✅ Should extract arrayRemove transforms
- ✅ Should handle multiple transforms
- ✅ Should handle nested field paths
- ✅ Should return empty array for no transforms

#### `removeFieldTransforms(data: DataObject)`
**Test Cases:**
- ✅ Should remove FieldValue sentinels
- ✅ Should keep regular fields
- ✅ Should handle delete sentinels
- ✅ Should return clean data object

### 3. CRUD Operations (with mocked fetch)

#### `setDocument(collectionPath, documentId, data, options?)`
**Test Cases:**
- ✅ Should create document with correct URL
- ✅ Should send correct request body
- ✅ Should handle merge option
- ✅ Should handle mergeFields option
- ✅ Should handle field transforms
- ✅ Should handle API errors
- ✅ Should work with subcollections

#### `getDocument(collectionPath, documentId)`
**Test Cases:**
- ✅ Should fetch document with correct URL
- ✅ Should return parsed document data
- ✅ Should return null for 404
- ✅ Should handle API errors
- ✅ Should work with subcollections

#### `updateDocument(collectionPath, documentId, data)`
**Test Cases:**
- ✅ Should update with correct URL
- ✅ Should include updateMask
- ✅ Should handle field transforms
- ✅ Should handle delete fields
- ✅ Should require document exists
- ✅ Should handle API errors

#### `deleteDocument(collectionPath, documentId)`
**Test Cases:**
- ✅ Should delete with correct URL
- ✅ Should use DELETE method
- ✅ Should handle API errors
- ✅ Should work with subcollections

#### `addDocument(collectionPath, data, documentId?)`
**Test Cases:**
- ✅ Should create with auto-generated ID
- ✅ Should create with specified ID
- ✅ Should return document reference
- ✅ Should handle field transforms
- ✅ Should handle API errors
- ✅ Should work with subcollections

#### `queryDocuments(collectionPath, options?)`
**Test Cases:**
- ✅ Should use simple list for no options
- ✅ Should use structured query for options
- ✅ Should handle where filters
- ✅ Should handle orderBy
- ✅ Should handle limit and offset
- ✅ Should handle startAt/startAfter
- ✅ Should handle endAt/endBefore
- ✅ Should parse results correctly
- ✅ Should work with subcollections (already tested)

#### `batchWrite(operations: BatchWrite[])`
**Test Cases:**
- ✅ Should batch multiple set operations
- ✅ Should batch multiple update operations
- ✅ Should batch multiple delete operations
- ✅ Should batch mixed operations
- ✅ Should handle field transforms in batch
- ✅ Should handle merge options
- ✅ Should handle API errors

### 4. Query Operator Mapping

#### `mapWhereOp(op: string)`
**Test Cases:**
- ✅ Should map < to LESS_THAN
- ✅ Should map <= to LESS_THAN_OR_EQUAL
- ✅ Should map == to EQUAL
- ✅ Should map != to NOT_EQUAL
- ✅ Should map >= to GREATER_THAN_OR_EQUAL
- ✅ Should map > to GREATER_THAN
- ✅ Should map array-contains to ARRAY_CONTAINS
- ✅ Should map array-contains-any to ARRAY_CONTAINS_ANY
- ✅ Should map in to IN
- ✅ Should map not-in to NOT_IN

## Testing Strategy

### Mocking
- Mock `fetch` for all API calls
- Mock `getAdminAccessToken()` to return test token
- Mock `getProjectId()` to return test project
- Verify fetch called with correct URLs and bodies

### Test Data
- Create sample Firestore documents
- Create sample query options
- Create sample batch operations

### Edge Cases
- Empty collections
- Large batch operations
- Network failures
- Invalid data types
- Subcollection edge cases

## Dependencies
- Jest for testing framework
- Mock fetch responses
- Test data fixtures

## Success Criteria
- ✅ All public functions have tests
- ✅ Code coverage >80% for firestore-rest.ts
- ✅ All edge cases covered
- ✅ Tests run in <2 seconds
- ✅ No external API calls in tests (all mocked)

## Priority
**High** - Core functionality of the library

## Estimated Time
4-6 hours
