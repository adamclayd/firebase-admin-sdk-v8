/**
 * Firebase Admin SDK v8 - Firestore REST API
 * Provides CRUD operations for Firestore using REST API
 */

import type {
  DataObject,
  FirestoreDocument,
  SetOptions,
  QueryOptions,
  BatchWrite,
  BatchWriteResult,
  DocumentReference,
} from './types';
import { getAdminAccessToken } from './token-generation';
import { getProjectId } from './service-account';
import { isFieldValue } from './field-value';
import {
  toFirestoreValue,
  fromFirestoreValue,
  convertToFirestoreFormat,
  convertFromFirestoreFormat,
} from './firestore/converters';
import {
  buildStructuredQuery,
  mapWhereOp,
} from './firestore/query-builder';

const FIRESTORE_API = 'https://firestore.googleapis.com/v1';

// Re-export converter functions for backward compatibility and testing
export {
  toFirestoreValue,
  fromFirestoreValue,
  convertToFirestoreFormat,
  convertFromFirestoreFormat,
};

// Re-export query builder functions for backward compatibility and testing
export {
  buildStructuredQuery,
  mapWhereOp,
};

/**
 * Extract field transforms from data (for increment, arrayUnion, etc.)
 * @internal - Exported for testing
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
 * @internal - Exported for testing
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



/**
 * Set a document in Firestore (create or overwrite)
 * 
 * @param {string} collectionPath - Collection path
 * @param {string} documentId - Document ID
 * @param {DataObject} data - Document data
 * @param {SetOptions} [options] - Set options (merge, mergeFields)
 * @returns {Promise<void>}
 * @throws {Error} If the operation fails
 * 
 * @example
 * ```typescript
 * // Overwrite document
 * await setDocument('users', 'user123', { name: 'John', age: 30 });
 * 
 * // Merge with existing document
 * await setDocument('users', 'user123', { age: 31 }, { merge: true });
 * 
 * // Merge specific fields
 * await setDocument('users', 'user123', { age: 31, city: 'NYC' }, { mergeFields: ['age'] });
 * ```
 */
export async function setDocument(
  collectionPath: string,
  documentId: string,
  data: DataObject,
  options?: SetOptions
): Promise<void> {
  const accessToken = await getAdminAccessToken();
  const projectId = getProjectId();
  
  const url = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/${collectionPath}/${documentId}`;
  
  const cleanData = removeFieldTransforms(data);
  const firestoreData = convertToFirestoreFormat(cleanData);
  const transforms = extractFieldTransforms(data);
  
  const body: any = { fields: firestoreData };
  
  let queryParams = '';
  
  if (options?.merge) {
    // Merge all fields
    queryParams = '?updateMask.fieldPaths=*';
  } else if (options?.mergeFields && options.mergeFields.length > 0) {
    // Merge specific fields
    const fieldPaths = options.mergeFields.join('&updateMask.fieldPaths=');
    queryParams = `?updateMask.fieldPaths=${fieldPaths}`;
  }
  
  // Add field transforms if any
  if (transforms.length > 0) {
    body.transforms = transforms;
  }
  
  const response = await fetch(`${url}${queryParams}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to set document: ${errorText}`);
  }
}

/**
 * Add a document to Firestore collection
 *
 * @param {string} collectionPath - Collection path (e.g., 'users' or 'users/uid/posts')
 * @param {DataObject} data - Document data
 * @param {string} [documentId] - Optional document ID (auto-generated if not provided)
 * @returns {Promise<DocumentReference>} Document reference with id and path
 * @throws {Error} If the operation fails
 *
 * @example
 * ```typescript
 * const docRef = await addDocument('users', {
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   createdAt: new Date()
 * });
 * console.log('Created document:', docRef.id);
 * ```
 */
export async function addDocument(
  collectionPath: string,
  data: DataObject,
  documentId?: string
): Promise<DocumentReference> {
  const accessToken = await getAdminAccessToken();
  const projectId = getProjectId();
  
  const baseUrl = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/${collectionPath}`;
  const url = documentId ? `${baseUrl}?documentId=${documentId}` : baseUrl;
  
  const cleanData = removeFieldTransforms(data);
  const firestoreData = convertToFirestoreFormat(cleanData);
  const transforms = extractFieldTransforms(data);
  
  const body: any = { fields: firestoreData };
  
  if (transforms.length > 0) {
    body.transforms = transforms;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to add document: ${errorText}`);
  }
  
  const result = await response.json() as FirestoreDocument;
  const docId = result.name.split('/').pop()!;
  
  return {
    id: docId,
    path: `${collectionPath}/${docId}`,
  };
}

/**
 * Get a document from Firestore
 * 
 * @param {string} collectionPath - Collection path
 * @param {string} documentId - Document ID
 * @returns {Promise<DataObject | null>} Document data or null if not found
 * @throws {Error} If the operation fails
 * 
 * @example
 * ```typescript
 * const user = await getDocument('users', 'user123');
 * if (user) {
 *   console.log('User:', user.name);
 * }
 * ```
 */
export async function getDocument(
  collectionPath: string,
  documentId: string
): Promise<DataObject | null> {
  const accessToken = await getAdminAccessToken();
  const projectId = getProjectId();
  
  const url = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/${collectionPath}/${documentId}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (response.status === 404) {
    return null;
  }
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get document: ${errorText}`);
  }
  
  const result = await response.json() as FirestoreDocument;
  return convertFromFirestoreFormat(result.fields);
}

/**
 * Update a document in Firestore
 * 
 * @param {string} collectionPath - Collection path
 * @param {string} documentId - Document ID
 * @param {DataObject} data - Data to update
 * @returns {Promise<void>}
 * @throws {Error} If the operation fails
 * 
 * @example
 * ```typescript
 * await updateDocument('users', 'user123', {
 *   lastLogin: new Date(),
 *   loginCount: FieldValue.increment(1)
 * });
 * ```
 */
export async function updateDocument(
  collectionPath: string,
  documentId: string,
  data: DataObject
): Promise<void> {
  const accessToken = await getAdminAccessToken();
  const projectId = getProjectId();
  
  const url = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/${collectionPath}/${documentId}`;
  
  const cleanData = removeFieldTransforms(data);
  const firestoreData = convertToFirestoreFormat(cleanData);
  const transforms = extractFieldTransforms(data);
  
  // Build update mask (exclude deleted fields)
  const updateMaskFields = Object.keys(data)
    .filter(key => !isFieldValue(data[key]) || data[key]._type !== 'delete');
  
  // Create query string with multiple updateMask.fieldPaths parameters
  const updateMaskParams = updateMaskFields
    .map(field => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&');
  
  const body: any = { fields: firestoreData };
  
  if (transforms.length > 0) {
    body.transforms = transforms;
  }
  
  const response = await fetch(`${url}?${updateMaskParams}&currentDocument.exists=true`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update document: ${errorText}`);
  }
}

/**
 * Delete a document from Firestore
 * 
 * @param {string} collectionPath - Collection path
 * @param {string} documentId - Document ID
 * @returns {Promise<void>}
 * @throws {Error} If the operation fails
 * 
 * @example
 * ```typescript
 * await deleteDocument('users', 'user123');
 * ```
 */
export async function deleteDocument(
  collectionPath: string,
  documentId: string
): Promise<void> {
  const accessToken = await getAdminAccessToken();
  const projectId = getProjectId();
  
  const url = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/${collectionPath}/${documentId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete document: ${errorText}`);
  }
}

/**
 * Query documents in a collection with advanced filtering
 * 
 * @param {string} collectionPath - Collection path
 * @param {QueryOptions} [options] - Query options (where, orderBy, limit, etc.)
 * @returns {Promise<Array<{ id: string; data: DataObject }>>} Array of documents
 * @throws {Error} If the operation fails
 * 
 * @example
 * ```typescript
 * const activeUsers = await queryDocuments('users', {
 *   where: [
 *     { field: 'active', op: '==', value: true },
 *     { field: 'age', op: '>=', value: 18 }
 *   ],
 *   orderBy: [{ field: 'name', direction: 'ASCENDING' }],
 *   limit: 10
 * });
 * ```
 */
export async function queryDocuments(
  collectionPath: string,
  options?: QueryOptions
): Promise<Array<{ id: string; data: DataObject }>> {
  const accessToken = await getAdminAccessToken();
  const projectId = getProjectId();
  
  // If no query options, use simple list
  if (!options || Object.keys(options).length === 0) {
    const url = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/${collectionPath}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to query documents: ${errorText}`);
    }
    
    const result = await response.json();
    const documents = result.documents || [];
    
    return documents.map((doc: FirestoreDocument) => ({
      id: doc.name.split('/').pop()!,
      data: convertFromFirestoreFormat(doc.fields),
    }));
  }
  
  // Use structured query for advanced filtering
  // For subcollections, we need to specify the parent document in the URL
  const pathSegments = collectionPath.split('/');
  let queryUrl: string;
  
  if (pathSegments.length > 1) {
    // Subcollection: use parent document path in URL
    // e.g., "users/user123/posts" -> URL ends with "users/user123:runQuery"
    const parentPath = pathSegments.slice(0, -1).join('/');
    queryUrl = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/${parentPath}:runQuery`;
  } else {
    // Top-level collection
    queryUrl = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents:runQuery`;
  }
  
  const structuredQuery = buildStructuredQuery(collectionPath, options);
  
  const response = await fetch(queryUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to query documents: ${errorText}`);
  }
  
  const results = await response.json();
  
  return results
    .filter((result: any) => result.document)
    .map((result: any) => ({
      id: result.document.name.split('/').pop()!,
      data: convertFromFirestoreFormat(result.document.fields),
    }));
}

/**
 * Perform batch write operations (set, update, delete)
 * 
 * @param {BatchWrite[]} operations - Array of batch operations
 * @returns {Promise<BatchWriteResult>} Batch write result
 * @throws {Error} If the operation fails
 * 
 * @example
 * ```typescript
 * await batchWrite([
 *   { type: 'set', collectionPath: 'users', documentId: 'user1', data: { name: 'John' } },
 *   { type: 'update', collectionPath: 'users', documentId: 'user2', data: { age: 31 } },
 *   { type: 'delete', collectionPath: 'users', documentId: 'user3' }
 * ]);
 * ```
 */
export async function batchWrite(operations: BatchWrite[]): Promise<BatchWriteResult> {
  const accessToken = await getAdminAccessToken();
  const projectId = getProjectId();
  
  const url = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents:commit`;
  
  const writes = operations.map(op => {
    const docPath = `projects/${projectId}/databases/(default)/documents/${op.collectionPath}/${op.documentId}`;
    
    switch (op.type) {
      case 'set': {
        const cleanData = removeFieldTransforms(op.data!);
        const firestoreData = convertToFirestoreFormat(cleanData);
        const transforms = extractFieldTransforms(op.data!);
        
        const write: any = {
          update: {
            name: docPath,
            fields: firestoreData,
          },
        };
        
        if (op.options?.merge) {
          write.updateMask = { fieldPaths: ['*'] };
        } else if (op.options?.mergeFields) {
          write.updateMask = { fieldPaths: op.options.mergeFields };
        }
        
        if (transforms.length > 0) {
          write.updateTransforms = transforms;
        }
        
        return write;
      }
      
      case 'update': {
        const cleanData = removeFieldTransforms(op.data!);
        const firestoreData = convertToFirestoreFormat(cleanData);
        const transforms = extractFieldTransforms(op.data!);
        const updateMask = Object.keys(op.data!).filter(
          key => !isFieldValue(op.data![key]) || op.data![key]._type !== 'delete'
        );
        
        const write: any = {
          update: {
            name: docPath,
            fields: firestoreData,
          },
          updateMask: { fieldPaths: updateMask },
          currentDocument: { exists: true },
        };
        
        if (transforms.length > 0) {
          write.updateTransforms = transforms;
        }
        
        return write;
      }
      
      case 'delete':
        return {
          delete: docPath,
        };
      
      default:
        throw new Error(`Unknown batch operation type: ${(op as any).type}`);
    }
  });
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to perform batch write: ${errorText}`);
  }
  
  return await response.json() as BatchWriteResult;
}

