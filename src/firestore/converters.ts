/**
 * Firebase Admin SDK v8 - Firestore Data Converters
 * Convert between JavaScript and Firestore data formats
 */

import type { DataObject, FirestoreValue } from '../types';
import { isFieldValue } from '../field-value';

/**
 * Convert JavaScript value to Firestore format
 */
export function toFirestoreValue(value: any): FirestoreValue {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  // Handle FieldValue sentinels
  if (isFieldValue(value)) {
    switch (value._type) {
      case 'serverTimestamp':
        return { timestampValue: 'REQUEST_TIME' } as any;
      case 'increment':
        return {
          integerValue: String(value._value || 0),
        } as any; // Will be handled with transforms
      case 'arrayUnion':
      case 'arrayRemove':
      case 'delete':
        // These need special handling in the request
        return value as any;
      default:
        throw new Error(`Unknown FieldValue type: ${value._type}`);
    }
  }
  
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }
  
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(v => toFirestoreValue(v))
      }
    };
  }
  
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: convertToFirestoreFormat(value)
      }
    };
  }
  
  throw new Error(`Unsupported value type: ${typeof value}`);
}

/**
 * Convert JavaScript object to Firestore format
 */
export function convertToFirestoreFormat(data: DataObject): Record<string, FirestoreValue> {
  const result: Record<string, FirestoreValue> = {};
  
  for (const [key, value] of Object.entries(data)) {
    result[key] = toFirestoreValue(value);
  }
  
  return result;
}

/**
 * Convert Firestore value to JavaScript value
 */
export function fromFirestoreValue(value: FirestoreValue): any {
  if ('stringValue' in value) {
    return value.stringValue;
  }
  
  if ('integerValue' in value) {
    return parseInt(value.integerValue, 10);
  }
  
  if ('doubleValue' in value) {
    return value.doubleValue;
  }
  
  if ('booleanValue' in value) {
    return value.booleanValue;
  }
  
  if ('nullValue' in value) {
    return null;
  }
  
  if ('timestampValue' in value) {
    return new Date(value.timestampValue);
  }
  
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(v => fromFirestoreValue(v));
  }
  
  if ('mapValue' in value) {
    return convertFromFirestoreFormat(value.mapValue.fields || {});
  }
  
  return null;
}

/**
 * Convert Firestore format to JavaScript object
 */
export function convertFromFirestoreFormat(fields: Record<string, FirestoreValue>): DataObject {
  const result: DataObject = {};
  
  for (const [key, value] of Object.entries(fields)) {
    result[key] = fromFirestoreValue(value);
  }
  
  return result;
}
