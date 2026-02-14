# Firebase Admin SDK Array Serialization Issue

**Project**: `@prmichaelsen/firebase-admin-sdk-v8`  
**Issue**: Arrays and objects are being serialized to JSON strings instead of preserved as native Firestore types  
**Severity**: Medium  
**Impact**: Requires workaround parsing in consuming applications  

---

## Problem Description

When saving documents with array or object fields using `addDocument()` or `setDocument()`, the Firebase Admin SDK is converting these fields to JSON strings instead of preserving them as native Firestore array/map types.

### Expected Behavior
```typescript
await addDocument('messages', {
  content: [
    { type: 'text', text: 'Hello' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: '...' } }
  ]
})

// Should store as Firestore array type
// When retrieved: content is Array<Object>
```

### Actual Behavior
```typescript
// Stores as JSON string
// When retrieved: content is string '[{"type":"text","text":"Hello"},...]'
```

## Evidence

From consuming application logs:
```typescript
// Message retrieved from Firestore
{
  id: "msg-123",
  content: '[{"type":"text","text":"what do you see in this image?"},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"iVBORw0KGgoAAAA..."}}]'
  // ^ This should be an array, not a string
}
```

## Root Cause

The Firebase Admin SDK REST API wrapper is likely calling `JSON.stringify()` on the entire document before sending to Firestore REST API, instead of properly handling nested arrays/objects.

### Suspected Location

In the `addDocument()` or `setDocument()` functions, check for:
```typescript
// WRONG - stringifies everything
const body = JSON.stringify(data)

// CORRECT - Firestore REST API accepts JSON directly
const body = JSON.stringify({
  fields: convertToFirestoreFields(data)  // Proper field conversion
})
```

## Firestore REST API Format

Firestore REST API expects fields in this format:
```json
{
  "fields": {
    "content": {
      "arrayValue": {
        "values": [
          {
            "mapValue": {
              "fields": {
                "type": { "stringValue": "text" },
                "text": { "stringValue": "Hello" }
              }
            }
          }
        ]
      }
    }
  }
}
```

## Required Fix

1. **Update field conversion logic** to properly handle:
   - Arrays → `arrayValue`
   - Objects → `mapValue`
   - Strings → `stringValue`
   - Numbers → `integerValue` or `doubleValue`
   - Booleans → `booleanValue`
   - Null → `nullValue`

2. **Recursive conversion** for nested structures

3. **Preserve type information** instead of stringifying

## Workaround (Current)

Consuming applications must parse JSON strings:
```typescript
// In conversation-database.service.ts
let message: any = { id: doc.id, ...doc.data }

// Parse content if it's a JSON string
if (typeof message.content === 'string' && message.content.trim().startsWith('[')) {
  try {
    message.content = JSON.parse(message.content)
  } catch (e) {
    console.warn('Failed to parse content JSON:', e)
  }
}
```

## Testing

After fix, verify:
```typescript
// Test 1: Array field
await addDocument('test', {
  items: ['a', 'b', 'c']
})
const doc = await getDocument('test', 'docId')
assert(Array.isArray(doc.items))  // Should be true

// Test 2: Nested object
await addDocument('test', {
  user: {
    name: 'John',
    tags: ['admin', 'user']
  }
})
const doc2 = await getDocument('test', 'docId2')
assert(typeof doc2.user === 'object')  // Should be true
assert(Array.isArray(doc2.user.tags))  // Should be true

// Test 3: Mixed content (real-world case)
await addDocument('messages', {
  content: [
    { type: 'text', text: 'Hello' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc123' } }
  ]
})
const msg = await getDocument('messages', 'msgId')
assert(Array.isArray(msg.content))  // Should be true
assert(msg.content[0].type === 'text')  // Should work without JSON.parse
```

## References

- [Firestore REST API Documentation](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents)
- [Firestore Value Types](https://firebase.google.com/docs/firestore/reference/rest/v1/Value)
- Issue found in: `agentbase.me` project
- Workaround implemented in: `src/services/conversation-database.service.ts:186-197`

## Priority

**Medium** - The workaround is functional, but proper fix would:
- Eliminate need for workarounds in consuming apps
- Improve type safety
- Reduce parsing overhead
- Prevent potential bugs from failed JSON parsing
