/**
 * Firebase User Management APIs
 * Provides user management operations using Firebase Identity Toolkit REST API
 */

import { getAdminAccessToken } from './token-generation';
import { getProjectId } from './service-account';
import type {
  UserRecord,
  CreateUserRequest,
  UpdateUserRequest,
  ListUsersResult,
  ActionCodeSettings,
} from './types';
import { getAuthEmulatorHost } from './config';

const IDENTITY_TOOLKIT_API = 'https://identitytoolkit.googleapis.com/v1';
const IDENTITY_TOOLKIT_EMULATOR_PATH = 'identitytoolkit.googleapis.com/v1';

function getUrl(path: string) {
  path.endsWith('/') && (path = path.slice(0, -1));
  const emuHost = getAuthEmulatorHost();
  return emuHost
    ? `http://${emuHost}/${IDENTITY_TOOLKIT_EMULATOR_PATH}${path}`
    : `${IDENTITY_TOOLKIT_API}${path}`;
}

/**
 * Convert Firebase Identity Toolkit user response to UserRecord
 */
function convertToUserRecord(user: any): UserRecord {
  return {
    uid: user.localId,
    email: user.email || undefined,
    emailVerified: user.emailVerified || false,
    displayName: user.displayName || undefined,
    photoURL: user.photoUrl || undefined,
    phoneNumber: user.phoneNumber || undefined,
    disabled: user.disabled || false,
    metadata: {
      creationTime: user.createdAt ? new Date(parseInt(user.createdAt)).toISOString() : new Date().toISOString(),
      lastSignInTime: user.lastLoginAt ? new Date(parseInt(user.lastLoginAt)).toISOString() : new Date().toISOString(),
    },
    providerData: user.providerUserInfo || [],
    customClaims: user.customAttributes ? JSON.parse(user.customAttributes) : undefined,
  };
}

/**
 * Look up a Firebase user by email address
 * @param email - User's email address
 * @returns User record or null if not found
 */
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  if (!email || typeof email !== 'string') {
    throw new Error('email must be a non-empty string');
  }

  const projectId = getProjectId();
  const emuHost = getAuthEmulatorHost();
  const accessToken = await getAdminAccessToken(!!emuHost);

  const response = await fetch(
    getUrl(`/projects/${projectId}/accounts:lookup`),
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: [email] }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get user by email: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.users || data.users.length === 0) {
    return null;
  }

  return convertToUserRecord(data.users[0]);
}

/**
 * Look up a Firebase user by UID
 * @param uid - User's unique ID
 * @returns User record or null if not found
 */
export async function getUserByUid(uid: string): Promise<UserRecord | null> {
  if (!uid || typeof uid !== 'string') {
    throw new Error('uid must be a non-empty string');
  }

  const projectId = getProjectId();
  const emuHost = getAuthEmulatorHost();
  const accessToken = await getAdminAccessToken(!!emuHost);
  

  const response = await fetch(
    getUrl(`/projects/${projectId}/accounts:lookup`),
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ localId: [uid] }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get user by UID: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.users || data.users.length === 0) {
    return null;
  }

  return convertToUserRecord(data.users[0]);
}

/**
 * Create a new Firebase user
 * @param properties - User properties (email, password, displayName, etc.)
 * @returns Created user record
 */
export async function createUser(properties: CreateUserRequest): Promise<UserRecord> {
  if (!properties || typeof properties !== 'object') {
    throw new Error('properties must be an object');
  }

  const projectId = getProjectId();
  const emuHost = getAuthEmulatorHost();
  const accessToken = await getAdminAccessToken(!!emuHost);

  // Build request body
  const requestBody: any = {};
  
  if (properties.email) requestBody.email = properties.email;
  if (properties.password) requestBody.password = properties.password;
  if (properties.displayName) requestBody.displayName = properties.displayName;
  if (properties.photoURL) requestBody.photoUrl = properties.photoURL;
  if (properties.phoneNumber) requestBody.phoneNumber = properties.phoneNumber;
  if (typeof properties.emailVerified === 'boolean') requestBody.emailVerified = properties.emailVerified;
  if (typeof properties.disabled === 'boolean') requestBody.disabled = properties.disabled;

  const response = await fetch(
    getUrl(`/projects/${projectId}/accounts`),
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create user: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  // Fetch the complete user record
  return getUserByUid(data.localId) as Promise<UserRecord>;
}

/**
 * Update an existing Firebase user
 * @param uid - User's unique ID
 * @param properties - Properties to update (email, password, displayName, etc.)
 * @returns Updated user record
 */
export async function updateUser(uid: string, properties: UpdateUserRequest): Promise<UserRecord> {
  if (!uid || typeof uid !== 'string') {
    throw new Error('uid must be a non-empty string');
  }

  if (!properties || typeof properties !== 'object') {
    throw new Error('properties must be an object');
  }

  const projectId = getProjectId();
  const emuHost = getAuthEmulatorHost();
  const accessToken = await getAdminAccessToken(!!emuHost);

  // Build request body
  const requestBody: any = { localId: uid };
  
  if (properties.email) requestBody.email = properties.email;
  if (properties.password) requestBody.password = properties.password;
  if (properties.displayName !== undefined) requestBody.displayName = properties.displayName;
  if (properties.photoURL !== undefined) requestBody.photoUrl = properties.photoURL;
  if (properties.phoneNumber !== undefined) requestBody.phoneNumber = properties.phoneNumber;
  if (typeof properties.emailVerified === 'boolean') requestBody.emailVerified = properties.emailVerified;
  if (typeof properties.disabled === 'boolean') requestBody.disableUser = properties.disabled;

  const response = await fetch(
    getUrl(`/projects/${projectId}/accounts:update`),
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update user: ${response.status} ${errorText}`);
  }

  // Fetch the complete user record
  return getUserByUid(uid) as Promise<UserRecord>;
}

/**
 * Delete a Firebase user
 * @param uid - User's unique ID
 */
export async function deleteUser(uid: string): Promise<void> {
  if (!uid || typeof uid !== 'string') {
    throw new Error('uid must be a non-empty string');
  }

  const projectId = getProjectId();
  const emuHost = getAuthEmulatorHost();
  const accessToken = await getAdminAccessToken(!!emuHost);

  const response = await fetch(
    getUrl(`/projects/${projectId}/accounts:delete`),
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ localId: uid }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete user: ${response.status} ${errorText}`);
  }
}

/**
 * List all users with pagination
 * @param maxResults - Maximum number of users to return (default: 1000, max: 1000)
 * @param pageToken - Token for next page
 * @returns List of users and next page token
 */
export async function listUsers(
  maxResults: number = 1000,
  pageToken?: string
): Promise<ListUsersResult> {
  if (typeof maxResults !== 'number' || maxResults < 1 || maxResults > 1000) {
    throw new Error('maxResults must be a number between 1 and 1000');
  }

  const projectId = getProjectId();
  const emuHost = getAuthEmulatorHost();
  const accessToken = await getAdminAccessToken(!!emuHost);

  // Build query string parameters
  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
  });
  
  if (pageToken) {
    params.append('nextPageToken', pageToken);
  }

  const response = await fetch(
    getUrl(`/projects/${projectId}/accounts:query?${params.toString()}`),
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list users: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  return {
    users: (data.users || []).map(convertToUserRecord),
    pageToken: data.nextPageToken,
  };
}

/**
 * Set custom claims on a user's ID token
 * @param uid - User's unique ID
 * @param customClaims - Custom claims object (max 1000 bytes when serialized)
 */
export async function setCustomUserClaims(
  uid: string,
  customClaims: Record<string, any> | null
): Promise<void> {
  if (!uid || typeof uid !== 'string') {
    throw new Error('uid must be a non-empty string');
  }

  // Validate custom claims size
  if (customClaims !== null) {
    const serialized = JSON.stringify(customClaims);
    if (new TextEncoder().encode(serialized).length > 1000) {
      throw new Error('customClaims must be less than 1000 bytes when serialized');
    }
  }

  const projectId = getProjectId();
  const emuHost = getAuthEmulatorHost();
  const accessToken = await getAdminAccessToken(!!emuHost);

  const requestBody: any = {
    localId: uid,
    customAttributes: customClaims ? JSON.stringify(customClaims) : '{}',
  };

  const response = await fetch(
    getUrl(`/projects/${projectId}/accounts:update`),
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to set custom claims: ${response.status} ${errorText}`);
  }
}

/**
 * Build the server request body from ActionCodeSettings
 */
function buildActionCodeSettingsRequest(settings: ActionCodeSettings): Record<string, any> {
  const request: Record<string, any> = {};

  request.continueUrl = settings.url;

  if (typeof settings.handleCodeInApp === 'boolean') {
    request.canHandleCodeInApp = settings.handleCodeInApp;
  }

  if (settings.iOS?.bundleId) {
    request.iOSBundleId = settings.iOS.bundleId;
  }

  if (settings.android) {
    request.androidPackageName = settings.android.packageName;
    if (typeof settings.android.installApp === 'boolean') {
      request.androidInstallApp = settings.android.installApp;
    }
    if (settings.android.minimumVersion) {
      request.androidMinimumVersion = settings.android.minimumVersion;
    }
  }

  if (settings.dynamicLinkDomain) {
    request.dynamicLinkDomain = settings.dynamicLinkDomain;
  }

  if (settings.linkDomain) {
    request.linkDomain = settings.linkDomain;
  }

  return request;
}

/**
 * Generate a password reset link for the given email address
 *
 * Returns an out-of-band (OOB) link that can be sent to the user
 * via a custom email delivery mechanism.
 *
 * @param email - User's email address
 * @param actionCodeSettings - Optional settings for the action code
 * @returns Password reset link URL
 *
 * @example
 * ```typescript
 * const link = await generatePasswordResetLink('user@example.com', {
 *   url: 'https://example.com/login',
 * });
 * // Send the link via your own email service
 * await sendEmail(email, `Reset your password: ${link}`);
 * ```
 */
export async function generatePasswordResetLink(
  email: string,
  actionCodeSettings?: ActionCodeSettings
): Promise<string> {
  if (!email || typeof email !== 'string') {
    throw new Error('email must be a non-empty string');
  }

  const projectId = getProjectId();
  const emuHost = getAuthEmulatorHost();
  const accessToken = await getAdminAccessToken(!!emuHost);

  const requestBody: Record<string, any> = {
    requestType: 'PASSWORD_RESET',
    email,
    returnOobLink: true,
  };

  if (actionCodeSettings) {
    Object.assign(requestBody, buildActionCodeSettingsRequest(actionCodeSettings));
  }

  const response = await fetch(
    getUrl(`/projects/${projectId}/accounts:sendOobCode`),
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate password reset link: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  if (!data.oobLink) {
    throw new Error('Password reset link not returned by server');
  }

  return data.oobLink;
}

export async function generateEmailVerificationLink(
  email: string,
  actionCodeSettings?: ActionCodeSettings
): Promise<string> {
  if (!email || typeof email !== 'string') {
    throw new Error('email must be a non-empty string');
  }

  const projectId = getProjectId();
  const emuHost = getAuthEmulatorHost();
  const accessToken = await getAdminAccessToken(!!emuHost);

  const requestBody: Record<string, any> = {
    requestType: 'VERIFY_EMAIL',
    email,
    returnOobLink: true,
  };

  if (actionCodeSettings) {
    Object.assign(requestBody, buildActionCodeSettingsRequest(actionCodeSettings));
  }

  const response = await fetch(
    getUrl(`/projects/${projectId}/accounts:sendOobCode`),
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate email verification link: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  if (!data.oobLink) {
    throw new Error('Email verification link not returned by server');
  }

  return data.oobLink;
}
