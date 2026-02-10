# queryDocuments Subcollection Bug

## Problem

`queryDocuments` returns 0 results for subcollections even though documents exist.

## Evidence

**Direct REST API (works):**
```bash
curl https://firestore.googleapis.com/v1/projects/com-f5-parm/databases/(default)/documents/e0.agentbase.conversations/main/messages
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

The `queryDocuments` function likely has a bug with subcollection paths. It may be:
1. Not constructing the REST API URL correctly for subcollections
2. Not handling the response correctly
3. Filtering out subcollection results

## Impact

**Critical:** Message loading doesn't work in production
- Messages are saved ✅
- Messages exist in database ✅
- Direct REST API works ✅
- queryDocuments fails ❌

## Workaround

Use direct REST API calls instead of queryDocuments for subcollections:

```typescript
const token = await getAdminAccessToken();
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}`;

const response = await fetch(url, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const data = await response.json();
// Parse data.documents manually
```

## Fix Needed

Update `queryDocuments` in firebase-admin-sdk-v8 to properly handle subcollection paths.

## Priority

**CRITICAL** - Blocks message loading in production
