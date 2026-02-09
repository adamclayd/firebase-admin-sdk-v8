/**
 * Firebase Admin SDK v8 - Field Value Helpers
 * Special field values for Firestore operations
 */

import type { FieldValue as FieldValueSentinel, FieldValueType } from './types';

/**
 * Sentinel value for server timestamp
 * @returns {FieldValueSentinel} Field value that will be replaced with server timestamp
 * 
 * @example
 * ```typescript
 * await setDocument('posts', 'post1', {
 *   title: 'Hello',
 *   createdAt: FieldValue.serverTimestamp()
 * });
 * ```
 */
export function serverTimestamp(): FieldValueSentinel {
  return {
    _type: 'serverTimestamp' as FieldValueType,
  };
}

/**
 * Increment a numeric field by the given value
 * @param {number} n - Amount to increment by
 * @returns {FieldValueSentinel} Field value for increment operation
 * 
 * @example
 * ```typescript
 * await updateDocument('users', 'user1', {
 *   loginCount: FieldValue.increment(1)
 * });
 * ```
 */
export function increment(n: number): FieldValueSentinel {
  return {
    _type: 'increment' as FieldValueType,
    _value: n,
  };
}

/**
 * Add elements to an array field (union)
 * @param {...any} elements - Elements to add to the array
 * @returns {FieldValueSentinel} Field value for array union operation
 * 
 * @example
 * ```typescript
 * await updateDocument('users', 'user1', {
 *   tags: FieldValue.arrayUnion('new-tag', 'another-tag')
 * });
 * ```
 */
export function arrayUnion(...elements: any[]): FieldValueSentinel {
  return {
    _type: 'arrayUnion' as FieldValueType,
    _value: elements,
  };
}

/**
 * Remove elements from an array field
 * @param {...any} elements - Elements to remove from the array
 * @returns {FieldValueSentinel} Field value for array remove operation
 * 
 * @example
 * ```typescript
 * await updateDocument('users', 'user1', {
 *   tags: FieldValue.arrayRemove('old-tag')
 * });
 * ```
 */
export function arrayRemove(...elements: any[]): FieldValueSentinel {
  return {
    _type: 'arrayRemove' as FieldValueType,
    _value: elements,
  };
}

/**
 * Delete a field from a document
 * @returns {FieldValueSentinel} Field value for delete operation
 * 
 * @example
 * ```typescript
 * await updateDocument('users', 'user1', {
 *   temporaryField: FieldValue.delete()
 * });
 * ```
 */
export function deleteField(): FieldValueSentinel {
  return {
    _type: 'delete' as FieldValueType,
  };
}

/**
 * Check if a value is a FieldValue sentinel
 */
export function isFieldValue(value: any): value is FieldValueSentinel {
  return value && typeof value === 'object' && '_type' in value;
}

/**
 * FieldValue namespace with all helper methods
 */
export const FieldValue = {
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  delete: deleteField,
};
