/**
 * Firebase Admin SDK v8 - Firestore REST API
 * Thin compatibility layer - imports and re-exports from modular firestore/
 */

// Re-export all converter functions
export {
  toFirestoreValue,
  fromFirestoreValue,
  convertToFirestoreFormat,
  convertFromFirestoreFormat,
} from './firestore/converters';

// Re-export all query builder functions
export {
  buildStructuredQuery,
  mapWhereOp,
} from './firestore/query-builder';

// Re-export all transform functions
export {
  extractFieldTransforms,
  removeFieldTransforms,
} from './firestore/transforms';

// Re-export all CRUD operations
export {
  setDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  addDocument,
  queryDocuments,
  batchWrite,
} from './firestore/operations';

// Re-export collection iteration functions
export {
  listDocuments,
  iterateCollection,
  countDocuments,
} from './firestore/iteration';
