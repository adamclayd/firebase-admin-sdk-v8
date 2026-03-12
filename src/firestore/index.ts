/**
 * Firebase Admin SDK v8 - Firestore Module
 * Barrel export for all Firestore functionality
 */

// Converters
export {
  toFirestoreValue,
  fromFirestoreValue,
  convertToFirestoreFormat,
  convertFromFirestoreFormat,
} from './converters';

// Query Builder
export {
  buildStructuredQuery,
  mapWhereOp,
} from './query-builder';

// Field Transforms
export {
  extractFieldTransforms,
  removeFieldTransforms,
} from './transforms';

// CRUD Operations
export {
  setDocument,
  getDocument,
  getAll,
  getAllByPaths,
  updateDocument,
  deleteDocument,
  addDocument,
  queryDocuments,
  batchWrite,
} from './operations';

// Collection Iteration
export {
  listDocuments,
  iterateCollection,
  countDocuments,
} from './iteration';
