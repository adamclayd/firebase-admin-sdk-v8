# Firebase Admin SDK v8 Type Issues

## Issue 1: addDocument Return Type

**Problem:**
The `addDocument` function is typed to return `Promise<string>` (just the document ID), but the code tries to access `.id` property as if it returns a DocumentReference object.

**Current Type:**
```typescript
addDocument(collectionPath: string, data: any, documentId?: string): Promise<string>
```

**Usage in conversation.service.ts:**
```typescript
const docRef = await addDocument(CONVERSATIONS, conversation)
return {
  id: docRef.id,  // ❌ Error: Property 'id' does not exist on type 'string'
  ...conversation
}
```

**Expected Behavior:**
Either:
1. Return just the string ID (current type is correct, usage is wrong)
2. Return `{ id: string }` object (type needs update)

**Fix Needed:**
Update usage to:
```typescript
const docId = await addDocument(CONVERSATIONS, conversation)
return {
  id: docId,  // ✅ docId is a string
  ...conversation
}
```

## Issue 2: Query Direction Values

**Problem:**
The Firestore REST API expects "DESCENDING" or "ASCENDING" (all caps), but the types might allow lowercase "desc"/"asc".

**Error:**
```
Invalid value at 'structured_query.order_by[0].direction' (type.googleapis.com/google.firestore.v1.StructuredQuery.Direction), "desc"
```

**Current Usage:**
```typescript
orderBy: [{ field: 'timestamp', direction: 'desc' }]  // ❌ Should be 'DESCENDING'
```

**Fix:**
```typescript
orderBy: [{ field: 'timestamp', direction: 'DESCENDING' }]  // ✅ Correct
```

**Type Definition Needed:**
```typescript
type Direction = 'ASCENDING' | 'DESCENDING'  // Not 'asc' | 'desc'
```

## Issue 3: startAfter Type

**Problem:**
`startAfter` is typed as `any[]` but being passed a string (timestamp).

**Error:**
```typescript
options.startAfter = startAfter  // Type 'string' is not assignable to type 'any[]'
```

**Current:**
```typescript
if (startAfter) {
  options.startAfter = startAfter  // startAfter is string
}
```

**Expected:**
```typescript
if (startAfter) {
  options.startAfter = [startAfter]  // Wrap in array
}
```

## Recommendations

1. **Update addDocument return type** to match actual return value
2. **Update Direction type** to only allow "ASCENDING" | "DESCENDING"
3. **Update startAfter type** or documentation to clarify it expects an array
4. **Add JSDoc examples** showing correct usage

## Priority

High - These type mismatches cause runtime errors and confusion.
