/**
 * Firebase Admin SDK v8 - Type Definitions
 */

/**
 * Firebase service account credentials
 */
export interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri?: string;
  token_uri: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
}

/**
 * Decoded Firebase ID token
 */
export interface DecodedIdToken {
  aud: string;
  auth_time: number;
  email?: string;
  email_verified?: boolean;
  exp: number;
  firebase: {
    identities: Record<string, any>;
    sign_in_provider: string;
  };
  iat: number;
  iss: string;
  name?: string;
  picture?: string;
  sub: string;
  uid: string;
}

/**
 * User information extracted from ID token
 */
export interface UserInfo {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
}

/**
 * OAuth token response
 */
export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Firestore document field value types
 */
export type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

/**
 * Firestore document structure
 */
export interface FirestoreDocument {
  name: string;
  fields: Record<string, FirestoreValue>;
  createTime: string;
  updateTime: string;
}

/**
 * Generic data object
 */
export type DataObject = Record<string, any>;

/**
 * Document reference (simplified version for REST API)
 */
export interface DocumentReference {
  /** Document ID */
  id: string;
  /** Collection path */
  path: string;
}

/**
 * Set options for document writes
 */
export interface SetOptions {
  /** If true, merge the data with existing document */
  merge?: boolean;
  /** Array of field paths to merge (alternative to merge: true) */
  mergeFields?: string[];
}

/**
 * Update options
 */
export interface UpdateOptions {
  /** Precondition - only update if document exists */
  exists?: boolean;
}

/**
 * Field value sentinel types
 */
export enum FieldValueType {
  ServerTimestamp = 'serverTimestamp',
  Increment = 'increment',
  ArrayUnion = 'arrayUnion',
  ArrayRemove = 'arrayRemove',
  Delete = 'delete',
}

/**
 * Field value sentinel for special operations
 */
export interface FieldValue {
  _type: FieldValueType;
  _value?: any;
}

/**
 * Query operators
 */
export type WhereFilterOp =
  | '<'
  | '<='
  | '=='
  | '!='
  | '>='
  | '>'
  | 'array-contains'
  | 'array-contains-any'
  | 'in'
  | 'not-in';

/**
 * Query filter
 */
export interface QueryFilter {
  field: string;
  op: WhereFilterOp;
  value: any;
}

/**
 * Query order
 */
export interface QueryOrder {
  field: string;
  direction: 'ASCENDING' | 'DESCENDING';
}

/**
 * Query options
 */
export interface QueryOptions {
  where?: QueryFilter[];
  orderBy?: QueryOrder[];
  limit?: number;
  offset?: number;
  startAt?: any[];
  startAfter?: any[];
  endAt?: any[];
  endBefore?: any[];
}

/**
 * Firestore field transform
 */
export interface FieldTransform {
  fieldPath: string;
  setToServerValue?: 'REQUEST_TIME';
  increment?: FirestoreValue;
  appendMissingElements?: { values: FirestoreValue[] };
  removeAllFromArray?: { values: FirestoreValue[] };
}

/**
 * Firestore document transform
 */
export interface DocumentTransform {
  document: string;
  fieldTransforms: FieldTransform[];
}

/**
 * Firestore write operation for :commit API
 */
export interface FirestoreWrite {
  update?: {
    name: string;
    fields: Record<string, FirestoreValue>;
  };
  updateMask?: {
    fieldPaths: string[];
  };
  updateTransforms?: FieldTransform[];
  currentDocument?: {
    exists?: boolean;
  };
  transform?: DocumentTransform;
  delete?: string;
}

/**
 * Batch write operation
 */
export interface BatchWrite {
  type: 'set' | 'update' | 'delete';
  collectionPath: string;
  documentId: string;
  data?: DataObject;
  options?: SetOptions;
}

/**
 * Batch write result
 */
export interface BatchWriteResult {
  writeResults: Array<{
    updateTime: string;
  }>;
}

/**
 * Firebase user record
 */
export interface UserRecord {
  /** User's unique ID */
  uid: string;
  /** User's email address */
  email?: string;
  /** Whether the email is verified */
  emailVerified: boolean;
  /** User's display name */
  displayName?: string;
  /** User's photo URL */
  photoURL?: string;
  /** User's phone number */
  phoneNumber?: string;
  /** Whether the user is disabled */
  disabled: boolean;
  /** User metadata (creation and last sign-in times) */
  metadata: {
    creationTime: string;
    lastSignInTime: string;
  };
  /** Provider-specific user information */
  providerData: UserInfo[];
  /** Custom claims set on the user */
  customClaims?: Record<string, any>;
}

/**
 * Request to create a new user
 */
export interface CreateUserRequest {
  /** User's email address */
  email?: string;
  /** Whether the email should be marked as verified */
  emailVerified?: boolean;
  /** User's phone number */
  phoneNumber?: string;
  /** User's password */
  password?: string;
  /** User's display name */
  displayName?: string;
  /** User's photo URL */
  photoURL?: string;
  /** Whether the user should be disabled */
  disabled?: boolean;
}

/**
 * Request to update an existing user
 */
export interface UpdateUserRequest {
  /** User's email address */
  email?: string;
  /** Whether the email should be marked as verified */
  emailVerified?: boolean;
  /** User's phone number */
  phoneNumber?: string;
  /** User's password */
  password?: string;
  /** User's display name */
  displayName?: string;
  /** User's photo URL */
  photoURL?: string;
  /** Whether the user should be disabled */
  disabled?: boolean;
}

/**
 * Result of listing users
 */
export interface ListUsersResult {
  /** Array of user records */
  users: UserRecord[];
  /** Token for fetching the next page (if available) */
  pageToken?: string;
}

/**
 * Settings for email action links (password reset, email verification, etc.)
 */
export interface ActionCodeSettings {
  /** The continue/state URL to redirect to after the action is completed */
  url: string;
  /** Whether the action link should be opened in a mobile app or web */
  handleCodeInApp?: boolean;
  /** iOS-specific settings */
  iOS?: {
    /** The iOS bundle ID of the app to open the link in */
    bundleId: string;
  };
  /** Android-specific settings */
  android?: {
    /** The Android package name of the app to open the link in */
    packageName: string;
    /** Whether to install the app if not already installed */
    installApp?: boolean;
    /** Minimum Android app version required */
    minimumVersion?: string;
  };
  /**
   * The domain to use for Dynamic Links
   * @deprecated Use linkDomain instead
   */
  dynamicLinkDomain?: string;
  /** Custom Firebase Hosting domain to use for the link */
  linkDomain?: string;
}
