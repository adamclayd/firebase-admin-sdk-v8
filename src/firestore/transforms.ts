/**
 * Firebase Admin SDK v8 - Firestore Field Transforms
 * Handles FieldValue sentinels (serverTimestamp, increment, arrayUnion, etc.)
 */

import type { DataObject } from '../types';
import { isFieldValue } from '../field-value';
import { toFirestoreValue } from './converters';

/**
 * Extract field transforms from data (for increment, arrayUnion, etc.)
 * 
 * @param data - Data object containing potential FieldValue sentinels
 * @param fieldPrefix - Optional prefix for nested field paths
 * @returns Array of transform objects for Firestore REST API
 * 
 * @example
 * ```typescript
 * const data = {
 *   timestamp: FieldValue.serverTimestamp(),
 *   count: FieldValue.increment(1),
 * };
 * const transforms = extractFieldTransforms(data);
 * // Returns: [
 * //   { fieldPath: 'timestamp', setToServerValue: 'REQUEST_TIME' },
 * //   { fieldPath: 'count', increment: { integerValue: '1' } }
 * // ]
 * ```
 */
export function extractFieldTransforms(data: DataObject, fieldPrefix = ''): any[] {
  const transforms: any[] = [];
  
  for (const [key, value] of Object.entries(data)) {
    const fieldPath = fieldPrefix ? `${fieldPrefix}.${key}` : key;
    
    if (isFieldValue(value)) {
      switch (value._type) {
        case 'serverTimestamp':
          transforms.push({
            fieldPath,
            setToServerValue: 'REQUEST_TIME',
          });
          break;
        case 'increment':
          transforms.push({
            fieldPath,
            increment: toFirestoreValue(value._value),
          });
          break;
        case 'arrayUnion':
          transforms.push({
            fieldPath,
            appendMissingElements: {
              values: value._value.map((v: any) => toFirestoreValue(v)),
            },
          });
          break;
        case 'arrayRemove':
          transforms.push({
            fieldPath,
            removeAllFromArray: {
              values: value._value.map((v: any) => toFirestoreValue(v)),
            },
          });
          break;
      }
    }
  }
  
  return transforms;
}

/**
 * Remove FieldValue sentinels from data (they're handled via transforms)
 * 
 * @param data - Data object containing potential FieldValue sentinels
 * @returns Data object with FieldValue sentinels removed
 * 
 * @example
 * ```typescript
 * const data = {
 *   name: 'John',
 *   timestamp: FieldValue.serverTimestamp(),
 *   oldField: FieldValue.delete(),
 * };
 * const cleaned = removeFieldTransforms(data);
 * // Returns: { name: 'John' }
 * // (timestamp and oldField are removed)
 * ```
 */
export function removeFieldTransforms(data: DataObject): DataObject {
  const result: DataObject = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (isFieldValue(value)) {
      if (value._type === 'delete') {
        // Skip delete fields - they're handled via updateMask
        continue;
      }
      // Skip transform fields - they're handled separately
      continue;
    }
    result[key] = value;
  }
  
  return result;
}
