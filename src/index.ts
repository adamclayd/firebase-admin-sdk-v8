/**
 * Firebase Admin SDK v8
 * Cloudflare Workers compatible Firebase Admin SDK using REST APIs
 */

// Configuration exports
export { initializeApp, getConfig, clearConfig } from './config';

// Auth exports
export { verifyIdToken, getUserFromToken, getAuth } from './auth';

// Firestore exports
export {
  setDocument,
  addDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  batchWrite,
} from './firestore-rest';

// Field value helpers
export { FieldValue } from './field-value';

// Token generation exports
export { getAdminAccessToken, clearTokenCache } from './token-generation';

// Service account exports (deprecated, use initializeApp instead)
export { getServiceAccount, getProjectId } from './service-account';

// Type exports
export type {
  ServiceAccount,
  DecodedIdToken,
  UserInfo,
  TokenResponse,
  FirestoreValue,
  FirestoreDocument,
  DataObject,
  DocumentReference,
  SetOptions,
  UpdateOptions,
  FieldValue as FieldValueSentinel,
  FieldValueType,
  WhereFilterOp,
  QueryFilter,
  QueryOrder,
  QueryOptions,
  BatchWrite,
  BatchWriteResult,
} from './types';
