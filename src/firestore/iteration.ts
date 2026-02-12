/**
 * Firebase Admin SDK v8 - Firestore Collection Iteration
 * Convenience functions for iterating through collections
 */

import { queryDocuments } from './operations';
import type { DataObject, QueryOptions } from '../types';

/**
 * List all documents in a collection
 * This is a convenience wrapper around queryDocuments with no filters
 * 
 * @param collectionPath - Collection path
 * @param options - Query options (limit, orderBy, etc.)
 * @returns Array of documents with id and data
 * @throws {Error} If the operation fails
 * 
 * @example
 * ```typescript
 * // List all users
 * const users = await listDocuments('users');
 * 
 * // List with pagination
 * const firstPage = await listDocuments('users', { limit: 10 });
 * const secondPage = await listDocuments('users', { 
 *   limit: 10, 
 *   startAfter: [firstPage[firstPage.length - 1].data.name] 
 * });
 * ```
 */
export async function listDocuments(
  collectionPath: string,
  options?: QueryOptions
): Promise<Array<{ id: string; data: DataObject }>> {
  return queryDocuments(collectionPath, options);
}

/**
 * Iterate through all documents in a collection
 * Handles pagination automatically by fetching documents in batches
 * 
 * @param collectionPath - Collection path
 * @param callback - Function called for each document
 * @param options - Iteration options
 * @throws {Error} If the operation fails
 * 
 * @example
 * ```typescript
 * // Process all messages
 * await iterateCollection(
 *   'users/user123/conversations/main/messages',
 *   async (msg) => {
 *     console.log('Processing message:', msg.id);
 *     // Perform operations on each message
 *   },
 *   { batchSize: 100 }
 * );
 * 
 * // Iterate with ordering
 * await iterateCollection(
 *   'users',
 *   async (user) => {
 *     console.log('User:', user.data.name);
 *   },
 *   { 
 *     batchSize: 50,
 *     orderBy: [{ field: 'createdAt', direction: 'ASCENDING' }]
 *   }
 * );
 * ```
 */
export async function iterateCollection(
  collectionPath: string,
  callback: (doc: { id: string; data: DataObject }) => Promise<void>,
  options?: {
    batchSize?: number;
    orderBy?: Array<{ field: string; direction: 'ASCENDING' | 'DESCENDING' }>;
    where?: Array<{ field: string; op: any; value: any }>;
  }
): Promise<void> {
  const batchSize = options?.batchSize || 100;
  let lastDoc: { id: string; data: DataObject } | null = null;
  let hasMore = true;

  while (hasMore) {
    // Build query options
    const queryOptions: QueryOptions = {
      limit: batchSize,
      orderBy: options?.orderBy,
      where: options?.where,
    };

    // Add pagination cursor if we have a last document
    if (lastDoc && options?.orderBy && options.orderBy.length > 0) {
      // Use the ordered field values as cursor
      const cursorValues = options.orderBy.map(order => lastDoc!.data[order.field]);
      queryOptions.startAfter = cursorValues;
    }

    // Fetch batch
    const docs = await queryDocuments(collectionPath, queryOptions);

    // Process each document
    for (const doc of docs) {
      await callback(doc);
    }

    // Check if there are more documents
    hasMore = docs.length === batchSize;
    if (hasMore && docs.length > 0) {
      lastDoc = docs[docs.length - 1];
    }
  }
}

/**
 * Count documents in a collection
 * Note: This fetches all documents to count them, which may be expensive for large collections
 * 
 * @param collectionPath - Collection path
 * @param options - Query options (where filters)
 * @returns Number of documents
 * @throws {Error} If the operation fails
 * 
 * @example
 * ```typescript
 * // Count all users
 * const totalUsers = await countDocuments('users');
 * 
 * // Count active users
 * const activeUsers = await countDocuments('users', {
 *   where: [{ field: 'active', op: '==', value: true }]
 * });
 * ```
 */
export async function countDocuments(
  collectionPath: string,
  options?: {
    where?: Array<{ field: string; op: any; value: any }>;
  }
): Promise<number> {
  let count = 0;
  await iterateCollection(
    collectionPath,
    async () => {
      count++;
    },
    { batchSize: 1000, where: options?.where }
  );
  return count;
}
