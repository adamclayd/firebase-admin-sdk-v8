# queryDocuments Subcollection Bug

## Problem

`queryDocuments` returns 0 results for subcollections even though documents exist.

## Root Cause Found

**Line 768 in index.mjs:**
```javascript
const url = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents:runQuery`;
```

This uses the GLOBAL `:runQuery` endpoint, which doesn't work for subcollections.

**Should be:**
```javascript
// For subcollections, use parent document's :runQuery
const url = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/${parentPath}:runQuery`;
```

**Example:**
- Collection path: `e0.agentbase.conversations/main/messages`
- Parent path: `e0.agentbase.conversations/main`
- Subcollection: `messages`
- Correct URL: `.../documents/e0.agentbase.conversations/main:runQuery`
- Current URL: `.../documents:runQuery` ❌

## Evidence

**Direct GET (works):**
```bash
curl https://firestore.googleapis.com/v1/projects/com-f5-parm/databases/(default)/documents/e0.agentbase.conversations/main/messages
# Returns 11 messages ✅
```

**runQuery with correct format (works):**
```bash
curl -X POST https://firestore.googleapis.com/v1/projects/com-f5-parm/databases/(default)/documents/e0.agentbase.conversations/main:runQuery \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "structuredQuery": {
      "from": [{"collectionId": "messages", "allDescendants": false}],
      "orderBy": [{"field": {"fieldPath": "timestamp"}, "direction": "DESCENDING"}],
      "limit": 50
    }
  }'
# Returns 11 messages ✅
```

**queryDocuments (fails):**
```javascript
await queryDocuments('e0.agentbase.conversations/main/messages', {
  orderBy: [{ field: 'timestamp', direction: 'DESCENDING' }],
  limit: 50
});
// Returns [] (0 messages) ❌
```

## Root Cause

**The library is using the wrong API endpoint for subcollections.**

**Current (wrong):**
- Tries to query the full path directly
- Doesn't work for subcollections

**Correct:**
- For subcollections, use `:runQuery` endpoint on the parent document
- Put subcollection name in `structuredQuery.from[0].collectionId`
- Parent path: `e0.agentbase.conversations/main`
- Subcollection: `messages`

## Fix Implementation

**Detect subcollection:**
```typescript
function isSubcollection(path: string): boolean {
  // Count slashes - if more than collection name, it's a subcollection
  const parts = path.split('/');
  return parts.length > 1;
}
```

**Build correct URL:**
```typescript
if (isSubcollection(collectionPath)) {
  // Split into parent path and subcollection name
  const parts = collectionPath.split('/');
  const subcollectionName = parts[parts.length - 1];
  const parentPath = parts.slice(0, -1).join('/');
  
  // Use :runQuery on parent
  const url = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/${parentPath}:runQuery`;
  
  // Put subcollection in query body
  const body = {
    structuredQuery: {
      from: [{
        collectionId: subcollectionName,
        allDescendants: false
      }],
      // ... rest of query
    }
  };
}
```

## Impact

**Critical:** Message loading doesn't work in production
- Messages are saved ✅
- Messages exist in database ✅
- Direct REST API works ✅
- runQuery format works ✅
- queryDocuments fails ❌

## Priority

**CRITICAL** - Blocks message loading in production

## Verified Working

**Test Results:**
- 11 messages in `e0.agentbase.conversations/main/messages`
- runQuery returns all messages with correct ordering
- Bedrock responses present ("4 + 4 = 8")
- Format is correct, just needs library implementation
