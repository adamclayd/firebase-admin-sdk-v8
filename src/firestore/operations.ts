/**
 * Firebase Admin SDK v8 - Firestore CRUD Operations
 * All Firestore document operations using REST API
 */

import type {
  DataObject,
  FirestoreDocument,
  SetOptions,
  QueryOptions,
  BatchWrite,
  BatchWriteResult,
  DocumentReference,
  FirestoreWrite,
} from '../types';
import { getAdminAccessToken } from '../token-generation';
import { getProjectId } from '../service-account';
import { isFieldValue } from '../field-value';
import {
  convertToFirestoreFormat,
  convertFromFirestoreFormat,
} from './converters';
import { buildStructuredQuery } from './query-builder';
import {
  extractFieldTransforms,
  removeFieldTransforms,
} from './transforms';
import {
  validateDocumentPath,
  validateCollectionPath,
} from './path-validation';

const FIRESTORE_API = 'https://firestore.googleapis.com/v1';

/**
 * Commit writes to Firestore using the :commit API
 * Used when field transforms are present
 * 
 * @param writes - Array of write operations
 * @throws {Error} If the commit fails
 */
async function commitWrites(writes: FirestoreWrite[]): Promise<void> {
  const accessToken = await getAdminAccessToken();
  const projectId = getProjectId();
  
  const url = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents:commit`;
  
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
    throw new Error(`Failed to commit writes: ${errorText}`);
  }
}

/**
 * Set a document in Firestore (create or overwrite)
 * 
 * @param collectionPath - Collection path
 * @param documentId - Document ID
 * @param data - Document data
 * @param options - Set options (merge, mergeFields)
 * @returns Promise that resolves when document is set
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
  // Validate path structure
  validateDocumentPath('collectionPath', collectionPath, documentId);
  
  const projectId = getProjectId();
  const documentPath = `projects/${projectId}/databases/(default)/documents/${collectionPath}/${documentId}`;
  
  const cleanData = removeFieldTransforms(data);
  const firestoreData = convertToFirestoreFormat(cleanData);
  const transforms = extractFieldTransforms(data);
  
  // If we have transforms, use the :commit API
  if (transforms.length > 0) {
    const updateWrite: FirestoreWrite = {
      update: {
        name: documentPath,
        fields: firestoreData,
      },
      updateTransforms: transforms,
    };
    
    // Build update mask - only include non-transform fields
    const nonTransformFields = Object.keys(cleanData);
    if (nonTransformFields.length > 0) {
      if (options?.merge) {
        updateWrite.updateMask = { fieldPaths: ['*'] };
      } else if (options?.mergeFields && options.mergeFields.length > 0) {
        updateWrite.updateMask = { fieldPaths: options.mergeFields };
      } else {
        updateWrite.updateMask = { fieldPaths: nonTransformFields };
      }
    }
    
    await commitWrites([updateWrite]);
    return;
  }
  
  // No transforms - use regular PATCH endpoint
  const accessToken = await getAdminAccessToken();
  const url = `${FIRESTORE_API}/${documentPath}`;
  
  let queryParams = '';
  
  if (options?.merge) {
    queryParams = '?updateMask.fieldPaths=*';
  } else if (options?.mergeFields && options.mergeFields.length > 0) {
    const fieldPaths = options.mergeFields.join('&updateMask.fieldPaths=');
    queryParams = `?updateMask.fieldPaths=${fieldPaths}`;
  }
  
  const response = await fetch(`${url}${queryParams}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: firestoreData }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to set document: ${errorText}`);
  }
}

/**
 * Add a document to Firestore collection
 *
 * @param collectionPath - Collection path (e.g., 'users' or 'users/uid/posts')
 * @param data - Document data
 * @param documentId - Optional document ID (auto-generated if not provided)
 * @returns Document reference with id and path
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
  // Validate collection path (should have odd number of segments)
  validateCollectionPath('collectionPath', collectionPath);
  
  const accessToken = await getAdminAccessToken();
  const projectId = getProjectId();
  
  const baseUrl = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/${collectionPath}`;
  const url = documentId ? `${baseUrl}?documentId=${documentId}` : baseUrl;
  
  const cleanData = removeFieldTransforms(data);
  const firestoreData = convertToFirestoreFormat(cleanData);
  const transforms = extractFieldTransforms(data);
  
  const body: Record<string, unknown> = { fields: firestoreData };
  
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
 * @param collectionPath - Collection path
 * @param documentId - Document ID
 * @returns Document data or null if not found
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
  // Validate document path
  validateDocumentPath('collectionPath', collectionPath, documentId);
  
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
 * @param collectionPath - Collection path
 * @param documentId - Document ID
 * @param data - Data to update
 * @returns Promise that resolves when document is updated
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
  // Validate document path
  validateDocumentPath('collectionPath', collectionPath, documentId);
  
  const projectId = getProjectId();
  const documentPath = `projects/${projectId}/databases/(default)/documents/${collectionPath}/${documentId}`;
  
  const cleanData = removeFieldTransforms(data);
  const firestoreData = convertToFirestoreFormat(cleanData);
  const transforms = extractFieldTransforms(data);
  
  // Build update mask - include all fields (regular fields and delete fields)
  // Exclude only transform fields (serverTimestamp, increment, arrayUnion, arrayRemove)
  const updateMaskFields = Object.keys(data).filter(key => {
    if (!isFieldValue(data[key])) {
      return true; // Regular field
    }
    // Include delete fields in mask, exclude other transforms
    return data[key]._type === 'delete';
  });
  
  // If we have transforms, use the :commit API
  if (transforms.length > 0) {
    const nonTransformFields = Object.keys(cleanData);
    
    // If we have ONLY transforms (no regular fields), use pure transform write
    if (nonTransformFields.length === 0) {
      const transformWrite: FirestoreWrite = {
        transform: {
          document: documentPath,
          fieldTransforms: transforms,
        },
      };
      await commitWrites([transformWrite]);
      return;
    }
    
    // We have both regular fields and transforms
    const updateWrite: FirestoreWrite = {
      update: {
        name: documentPath,
        fields: firestoreData,
      },
      updateMask: { fieldPaths: updateMaskFields },
      updateTransforms: transforms,
      currentDocument: { exists: true },
    };
    
    await commitWrites([updateWrite]);
    return;
  }
  
  // No transforms - use regular PATCH endpoint
  const accessToken = await getAdminAccessToken();
  const url = `${FIRESTORE_API}/${documentPath}`;
  
  // Create query string with multiple updateMask.fieldPaths parameters
  const updateMaskParams = updateMaskFields
    .map(field => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&');
  
  const response = await fetch(`${url}?${updateMaskParams}&currentDocument.exists=true`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: firestoreData }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update document: ${errorText}`);
  }
}

/**
 * Delete a document from Firestore
 * 
 * @param collectionPath - Collection path
 * @param documentId - Document ID
 * @returns Promise that resolves when document is deleted
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
  // Validate document path
  validateDocumentPath('collectionPath', collectionPath, documentId);
  
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
 * @param collectionPath - Collection path
 * @param options - Query options (where, orderBy, limit, etc.)
 * @returns Array of documents with id and data
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
  // Validate collection path (should have odd number of segments)
  validateCollectionPath('collectionPath', collectionPath);
  
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
    .filter((result: { document?: FirestoreDocument }) => result.document)
    .map((result: { document: FirestoreDocument }) => ({
      id: result.document.name.split('/').pop()!,
      data: convertFromFirestoreFormat(result.document.fields),
    }));
}

/**
 * Perform batch write operations (set, update, delete)
 * 
 * @param operations - Array of batch operations
 * @returns Batch write result
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
        
        const write: FirestoreWrite = {
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
        
        const write: FirestoreWrite = {
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
        throw new Error(`Unknown batch operation type: ${(op as BatchWrite).type}`);
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
