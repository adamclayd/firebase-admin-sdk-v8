/**
 * Firebase Admin SDK v8
 * Cloudflare Workers compatible Firebase Admin SDK using REST APIs
 */

// Configuration exports
export { initializeApp, getConfig, clearConfig } from './config';

export { getAdminAccessToken, CacheAdminAccessTokenStore, clearTokenCache } from './token-generation';

// Auth exports
export {
  verifyIdToken,
  getUserFromToken,
  getAuth,
  createCustomToken,
  signInWithCustomToken,
  createSessionCookie,
  verifySessionCookie
} from './auth';
export type { CustomClaims, CustomTokenSignInResponse, SessionCookieOptions } from './auth';

// User Management exports
export {
  getUserByEmail,
  getUserByUid,
  createUser,
  updateUser,
  deleteUser,
  listUsers,
  setCustomUserClaims,
  generatePasswordResetLink,
  generateEmailVerificationLink
} from './user-management';

// Firestore exports
export {
  setDocument,
  addDocument,
  getDocument,
  getAll,
  getAllByPaths,
  updateDocument,
  deleteDocument,
  queryDocuments,
  batchWrite,
  listDocuments,
  iterateCollection,
  countDocuments,
} from './firestore-rest';

// Storage exports
export {
  uploadFile,
  downloadFile,
  deleteFile,
  getFileMetadata,
  listFiles,
  fileExists,
  generateSignedUrl,
  uploadFileResumable,
} from './storage';

// Messaging exports
export { sendMessage, subscribeToTopic, unsubscribeFromTopic } from './messaging';

// Field value helpers
export { FieldValue } from './field-value';

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
  UserRecord,
  CreateUserRequest,
  UpdateUserRequest,
  ListUsersResult,
  ActionCodeSettings,
} from './types';

// Messaging type exports
export type {
  Message,
  Notification as FcmNotification,
  AndroidConfig,
  AndroidNotification,
  WebpushConfig,
  ApnsConfig,
  FcmOptions,
  SendResponse,
  TopicManagementResponse,
  TopicManagementError,
} from './messaging';

// Storage type exports
export type {
  UploadOptions,
  DownloadOptions,
  ListOptions,
  FileMetadata,
  ListFilesResult,
  SignedUrlOptions,
  ResumableUploadOptions,
} from './storage';

