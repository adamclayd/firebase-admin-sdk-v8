# Task: Firestore Batch Get Documents (`getAll`)

**Milestone**: None (standalone feature)
**Estimated Time**: 2-3 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Implement a `getAll` function that batch-fetches multiple Firestore documents in a single REST API call using the `documents:batchGet` endpoint, instead of requiring parallel individual `getDocument` calls.

---

## Context

The SDK currently supports only single-document reads via `getDocument(collectionPath, documentId)`. Consumers needing multiple documents must call `Promise.all(ids.map(id => getDocument(col, id)))`, which issues N parallel HTTP requests. Firestore's REST API provides a `batchGet` endpoint that fetches up to 100 documents in a single round-trip.

The `agentbase.me` project needs this for profile enrichment (`buildProfileMap`) — fetching 20-50 user profiles per API request. A single batch call is more efficient and reduces connection overhead on Cloudflare Workers.

---

## Steps

### 1. Add `getAll` to `src/firestore/operations.ts`

Implement the function following existing patterns (auth token, project ID, path validation, format conversion):

```typescript
/**
 * Batch get multiple documents from Firestore
 * Uses the documents:batchGet REST API endpoint
 *
 * @param collectionPath - The collection containing the documents
 * @param documentIds - Array of document IDs to fetch
 * @returns Array of results in the same order as documentIds. Missing documents return null.
 */
export async function getAll(
  collectionPath: string,
  documentIds: string[]
): Promise<(DataObject | null)[]> {
  if (documentIds.length === 0) return [];

  // Validate each document path
  for (const id of documentIds) {
    validateDocumentPath('collectionPath', collectionPath, id);
  }

  const accessToken = await getAdminAccessToken();
  const projectId = getProjectId();

  const basePath = `projects/${projectId}/databases/(default)/documents`;
  const documents = documentIds.map(id => `${basePath}/${collectionPath}/${id}`);

  const url = `${FIRESTORE_API}/${basePath}:batchGet`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ documents }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to batch get documents: ${errorText}`);
  }

  const results = await response.json() as Array<{
    found?: FirestoreDocument;
    missing?: string;
  }>;

  // batchGet returns results potentially out of order — reorder to match input
  const resultMap = new Map<string, DataObject | null>();
  for (const result of results) {
    if (result.found) {
      const name = result.found.name!;
      const data = convertFromFirestoreFormat(result.found.fields);
      resultMap.set(name, data);
    } else if (result.missing) {
      resultMap.set(result.missing, null);
    }
  }

  return documents.map(docPath => resultMap.get(docPath) ?? null);
}
```

### 2. Export from `src/firestore/index.ts`

Add `getAll` to the firestore module exports.

### 3. Export from `src/index.ts`

Add `getAll` to the top-level SDK exports.

### 4. Add types if needed

The `batchGet` response shape (`{ found?: FirestoreDocument; missing?: string }`) may need a type in `src/types.ts`. Check if `FirestoreDocument` already includes the `name` field — if not, ensure it's available.

### 5. Write unit tests

Create tests in the appropriate test file covering:
- Empty array input returns empty array
- Single document fetch
- Multiple documents, all found
- Multiple documents, some missing (returns null for missing)
- Result ordering matches input ordering
- Invalid collection path throws
- API error handling

### 6. Write integration/e2e tests

Test against real Firestore (following existing e2e test patterns):
- Batch get existing documents
- Batch get with mix of existing and non-existing documents
- Batch get with empty array

---

## Verification

- [ ] `getAll` function exists in `src/firestore/operations.ts`
- [ ] Function is exported from `src/firestore/index.ts` and `src/index.ts`
- [ ] Returns results in the same order as input `documentIds`
- [ ] Missing documents return `null` (not throw)
- [ ] Empty input returns empty array without making API call
- [ ] Path validation runs on all document IDs
- [ ] All tests pass
- [ ] `npx tsc --noEmit` passes

---

## API Reference

**Firestore REST API — `batchGet`**:
- Endpoint: `POST https://firestore.googleapis.com/v1/{database}/documents:batchGet`
- Body: `{ "documents": ["projects/{project}/databases/(default)/documents/{collection}/{id}", ...] }`
- Response: Array of `{ "found": { ...document } }` or `{ "missing": "projects/..." }` objects
- Limit: 100 documents per request (enforce or document this)

---

## Notes

- The `batchGet` response may return results in a different order than requested — the implementation must reorder results to match input order
- Consider adding a 100-document limit check with a helpful error message, or chunking large requests automatically
- This follows the same auth/project-id/REST pattern as all other operations in the file
- The `name` field on Firestore documents contains the full resource path (e.g., `projects/myproject/databases/(default)/documents/users/uid123`)

---

**Related Design Docs**: None
