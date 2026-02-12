# Task: Add Collection Iteration Support to firebase-admin-sdk-v8

**Status**: Not Started  
**Priority**: Medium  
**Created**: 2026-02-12  
**Package**: @prmichaelsen/firebase-admin-sdk-v8

---

## Problem

The `@prmichaelsen/firebase-admin-sdk-v8` package currently only exposes specific document-level operations like `getDocument`, `setDocument`, `updateDocument`, etc. It does not provide a way to:

1. List all documents in a collection
2. Iterate through collections
3. Query collections with filters
4. Perform batch operations across multiple documents

This limitation makes it impossible to write migration scripts or perform bulk operations using the package. For example, the message timestamp migration script (`scripts/migrate-message-timestamps.ts`) cannot use this package and must fall back to the standard `firebase-admin` package.

## Current API

The package currently exports these Firestore operations:
- `getDocument(path: string)` - Get a single document
- `setDocument(path: string, data: DataObject)` - Set a document
- `updateDocument(path: string, data: DataObject)` - Update a document
- `deleteDocument(path: string)` - Delete a document
- `addDocument(collectionPath: string, data: DataObject)` - Add a document to collection
- `queryDocuments(collectionPath: string, filters: QueryFilter[])` - Query with filters (limited)
- `batchWrite(operations: BatchWrite[])` - Batch write operations

## Required Features

### 1. Collection Listing
```typescript
/**
 * List all documents in a collection
 * @param collectionPath - Path to the collection
 * @param options - Pagination options (limit, startAfter, etc.)
 * @returns Array of documents with their IDs and data
 */
export async function listDocuments(
  collectionPath: string,
  options?: {
    limit?: number
    startAfter?: string
    orderBy?: string
    direction?: 'asc' | 'desc'
  }
): Promise<Array<{ id: string; data: DataObject }>>
```

### 2. Collection Iteration
```typescript
/**
 * Iterate through all documents in a collection
 * Handles pagination automatically
 * @param collectionPath - Path to the collection
 * @param callback - Function called for each document
 * @param options - Iteration options
 */
export async function iterateCollection(
  collectionPath: string,
  callback: (doc: { id: string; data: DataObject }) => Promise<void>,
  options?: {
    batchSize?: number
    orderBy?: string
    direction?: 'asc' | 'desc'
  }
): Promise<void>
```

### 3. Subcollection Access
```typescript
/**
 * List all subcollections of a document
 * @param documentPath - Path to the parent document
 * @returns Array of subcollection IDs
 */
export async function listSubcollections(
  documentPath: string
): Promise<string[]>
```

### 4. Enhanced Query Support
```typescript
/**
 * Query documents with advanced filtering
 * @param collectionPath - Path to the collection
 * @param options - Query options
 * @returns Array of matching documents
 */
export async function queryCollection(
  collectionPath: string,
  options: {
    where?: Array<{
      field: string
      operator: WhereFilterOp
      value: any
    }>
    orderBy?: Array<{
      field: string
      direction: 'asc' | 'desc'
    }>
    limit?: number
    startAfter?: any
  }
): Promise<Array<{ id: string; data: DataObject }>>
```

## Use Cases

### Migration Scripts
```typescript
// Migrate all messages from created_at to timestamp
const users = await listDocuments('e0.agentbase.users')
for (const user of users) {
  const conversations = await listDocuments(`${user.id}/conversations`)
  for (const conv of conversations) {
    await iterateCollection(
      `${user.id}/conversations/${conv.id}/messages`,
      async (msg) => {
        if (msg.data.created_at && !msg.data.timestamp) {
          await updateDocument(
            `${user.id}/conversations/${conv.id}/messages/${msg.id}`,
            { timestamp: msg.data.created_at }
          )
        }
      }
    )
  }
}
```

### Bulk Operations
```typescript
// Delete all old messages
await iterateCollection(
  'e0.agentbase.users/userId/conversations/main/messages',
  async (msg) => {
    const timestamp = new Date(msg.data.timestamp)
    if (Date.now() - timestamp.getTime() > 30 * 24 * 60 * 60 * 1000) {
      await deleteDocument(`.../${msg.id}`)
    }
  }
)
```

### Data Export
```typescript
// Export all user data
const users = await listDocuments('e0.agentbase.users')
const exportData = []
for (const user of users) {
  const conversations = await listDocuments(`${user.id}/conversations`)
  exportData.push({
    user: user.data,
    conversations: conversations.map(c => c.data)
  })
}
```

## Implementation Notes

1. **Pagination**: All iteration functions should handle pagination automatically to avoid memory issues with large collections
2. **Error Handling**: Should handle rate limits and retry failed operations
3. **Type Safety**: Return types should be properly typed with generics where possible
4. **Performance**: Consider adding batch operations for better performance
5. **Compatibility**: Maintain compatibility with existing API

## Alternative Solutions

If adding these features to the package is not feasible:

1. **Document the limitation** - Clearly state in README that migration scripts should use standard `firebase-admin`
2. **Provide helper utilities** - Create a separate package or utilities file that wraps `firebase-admin` for migration tasks
3. **Hybrid approach** - Use `@prmichaelsen/firebase-admin-sdk-v8` for runtime operations and `firebase-admin` for migrations

## Related Files

- `scripts/migrate-message-timestamps.ts` - Migration script that needs this functionality
- `@prmichaelsen/firebase-admin-sdk-v8` - Package that needs enhancement

## Success Criteria

- [ ] Can list all documents in a collection
- [ ] Can iterate through collections with automatic pagination
- [ ] Can access subcollections
- [ ] Can perform complex queries
- [ ] Migration scripts can use the package without falling back to `firebase-admin`
- [ ] Documentation updated with examples
- [ ] Tests added for new functionality

---

**Next Steps**: 
1. Evaluate if this feature should be added to the package
2. If yes, implement the collection iteration API
3. If no, document the limitation and provide alternative solutions
