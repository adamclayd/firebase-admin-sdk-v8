/**
 * Firebase Admin SDK v8 - Authentication
 * ID token verification supporting both Firebase v9 and v10 token formats
 */

import type { DecodedIdToken, UserInfo } from './types';
import { getProjectId } from './service-account';
import { getServiceAccount, getFirebaseApiKey } from './config';
import { importPublicKeyFromX509 } from './x509';

/**
 * Custom claims for custom tokens
 */
export interface CustomClaims {
  [key: string]: any;
}

/**
 * Response from signInWithCustomToken
 */
export interface CustomTokenSignInResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  isNewUser?: boolean;
}

/**
 * JWT header structure
 */
interface JWTHeader {
  alg: string;
  kid: string;
  typ: string;
}

/**
 * Cache for Google's public keys
 */
let publicKeysCache: Record<string, string> | null = null;
let publicKeysCacheExpiry: number = 0;

/**
 * Clear the public keys cache (for testing)
 * @internal
 */
export function clearPublicKeysCache(): void {
  publicKeysCache = null;
  publicKeysCacheExpiry = 0;
}

/**
 * Fetch Google's public keys for Firebase token verification
 * Supports both securetoken (v9) and session (v10) endpoints
 */
async function fetchPublicKeys(issuer?: string): Promise<Record<string, string>> {
  // Determine which endpoint to use based on issuer
  let endpoint = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
  
  // For Firebase v10 session tokens, use the session endpoint
  if (issuer && issuer.includes('session.firebase.google.com')) {
    endpoint = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys';
  }
  
  // Return cached keys if still valid
  if (publicKeysCache && Date.now() < publicKeysCacheExpiry) {
    return publicKeysCache;
  }

  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(`Failed to fetch Firebase public keys from ${endpoint}`);
  }

  publicKeysCache = await response.json();
  
  // Cache for 1 hour (keys rotate every 24 hours)
  publicKeysCacheExpiry = Date.now() + 3600000;
  
  return publicKeysCache!;
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): string {
  // Add padding if needed
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

/**
 * Parse JWT without verification
 */
function parseJWT(token: string): { header: JWTHeader; payload: any } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const header = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1]));

  return { header, payload };
}


/**
 * Verify JWT signature
 */
async function verifySignature(
  token: string,
  publicKey: CryptoKey
): Promise<boolean> {
  const parts = token.split('.');
  const signedData = `${parts[0]}.${parts[1]}`;
  const signature = Uint8Array.from(
    base64UrlDecode(parts[2]),
    c => c.charCodeAt(0)
  );

  return await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signature,
    new TextEncoder().encode(signedData)
  );
}

/**
 * Verify a Firebase ID token
 * Supports both Firebase v9 (securetoken) and v10 (session) token formats
 * 
 * @param {string} idToken - Firebase ID token to verify
 * @returns {Promise<DecodedIdToken>} Decoded and verified token
 * @throws {Error} If token is invalid or verification fails
 * 
 * @example
 * ```typescript
 * const token = request.headers.get('authorization')?.split('Bearer ')[1];
 * const decoded = await verifyIdToken(token);
 * console.log('User ID:', decoded.uid);
 * ```
 */
export async function verifyIdToken(idToken: string): Promise<DecodedIdToken> {
  if (!idToken) {
    throw new Error('ID token is required');
  }

  try {
    // Parse token
    const { header, payload } = parseJWT(idToken);

    // Get project ID
    const projectId = getProjectId();

    // Validate header
    if (header.alg !== 'RS256') {
      throw new Error('Invalid algorithm. Expected RS256');
    }

    // Validate basic claims
    const now = Math.floor(Date.now() / 1000);
    
    if (!payload.exp || payload.exp < now) {
      throw new Error('Token has expired');
    }

    if (!payload.iat || payload.iat > now) {
      throw new Error('Token issued in the future');
    }

    if (!payload.auth_time || payload.auth_time > now) {
      throw new Error('Auth time is in the future');
    }

    // Validate audience (must be project ID)
    if (payload.aud !== projectId) {
      throw new Error(`Invalid audience. Expected ${projectId}, got ${payload.aud}`);
    }

    // Validate issuer - support both old and new formats
    const validIssuers = [
      `https://securetoken.google.com/${projectId}`,  // Firebase v9 and earlier
      `https://session.firebase.google.com/${projectId}`, // Firebase v10+
    ];

    if (!validIssuers.includes(payload.iss)) {
      throw new Error(
        `Invalid issuer. Expected one of: ${validIssuers.join(', ')}, got ${payload.iss}`
      );
    }

    // Validate subject
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Invalid subject');
    }

    if (payload.sub.length > 128) {
      throw new Error('Subject too long');
    }

    // Fetch public keys and verify signature (pass issuer to get correct endpoint)
    let publicKeys = await fetchPublicKeys(payload.iss);
    let publicKeyPem = publicKeys[header.kid];

    // If key not found, it might have rotated - clear cache and retry once
    if (!publicKeyPem) {
      publicKeysCache = null;
      publicKeysCacheExpiry = 0;
      
      publicKeys = await fetchPublicKeys(payload.iss);
      publicKeyPem = publicKeys[header.kid];
      
      if (!publicKeyPem) {
        // Still not found after refresh
        const availableKids = Object.keys(publicKeys).join(', ');
        throw new Error(
          `Public key not found for kid: ${header.kid}. ` +
          `Available kids: ${availableKids}. ` +
          `This might indicate the token is from a different Firebase project or was signed with a very old key.`
        );
      }
    }

    const publicKey = await importPublicKeyFromX509(publicKeyPem);
    const isValid = await verifySignature(idToken, publicKey);

    if (!isValid) {
      throw new Error('Invalid token signature');
    }

    // Return decoded token with uid
    return {
      ...payload,
      uid: payload.sub,
    } as DecodedIdToken;
  } catch (error) {
    throw new Error(
      `Failed to verify ID token: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get user information from a verified ID token
 * 
 * @param {string} idToken - Firebase ID token
 * @returns {Promise<UserInfo>} User information extracted from token
 * @throws {Error} If token is invalid or verification fails
 * 
 * @example
 * ```typescript
 * const user = await getUserFromToken(idToken);
 * console.log('User:', user.email, user.displayName);
 * ```
 */
export async function getUserFromToken(idToken: string): Promise<UserInfo> {
  const decodedToken = await verifyIdToken(idToken);
  
  return {
    uid: decodedToken.sub || decodedToken.uid,
    email: decodedToken.email || null,
    emailVerified: decodedToken.email_verified || false,
    displayName: decodedToken.name || null,
    photoURL: decodedToken.picture || null,
  };
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Helper to sign data with private key
 */
async function signWithPrivateKey(data: string, privateKey: string): Promise<string> {
  // Import the private key
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');
  
  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const key = await crypto.subtle.importKey(
    'pkcs8',
    bytes,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
  
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    dataBytes
  );
  
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Create a custom token for a user
 *
 * @param uid - User ID
 * @param customClaims - Optional custom claims to include in token
 * @returns Custom JWT token
 *
 * @example
 * ```typescript
 * // Create token with custom claims
 * const token = await createCustomToken('user123', {
 *   role: 'admin',
 *   premium: true,
 * });
 *
 * // Use token on client to sign in
 * await signInWithCustomToken(auth, token);
 * ```
 */
export async function createCustomToken(
  uid: string,
  customClaims?: CustomClaims
): Promise<string> {
  const serviceAccount = getServiceAccount();
  
  // Validate UID
  if (!uid || typeof uid !== 'string') {
    throw new Error('uid must be a non-empty string');
  }
  
  if (uid.length > 128) {
    throw new Error('uid must be at most 128 characters');
  }
  
  // Build JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, any> = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600, // 1 hour
    uid,
  };
  
  // Add custom claims if provided
  if (customClaims) {
    payload.claims = customClaims;
  }
  
  // Create JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  
  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  
  // Sign with private key
  const signature = await signWithPrivateKey(unsignedToken, serviceAccount.private_key);
  
  return `${unsignedToken}.${signature}`;
}

/**
 * Exchange a custom token for an ID token and refresh token
 *
 * @param customToken - Custom JWT token created with createCustomToken
 * @returns User credentials (idToken, refreshToken, expiresIn, localId)
 *
 * @example
 * ```typescript
 * // Server-side: Create custom token
 * const customToken = await createCustomToken('user123', { role: 'admin' });
 *
 * // Exchange for ID token
 * const credentials = await signInWithCustomToken(customToken);
 *
 * // Use ID token for authenticated requests
 * const user = await verifyIdToken(credentials.idToken);
 * ```
 */
export async function signInWithCustomToken(
  customToken: string
): Promise<CustomTokenSignInResponse> {
  if (!customToken || typeof customToken !== 'string') {
    throw new Error('customToken must be a non-empty string');
  }
  
  // Get Firebase Web API key
  const apiKey = getFirebaseApiKey();
  
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Failed to sign in with custom token: ${response.status}`;
    
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error && errorJson.error.message) {
        errorMessage += ` - ${errorJson.error.message}`;
      }
    } catch {
      errorMessage += ` - ${errorText}`;
    }
    
    throw new Error(errorMessage);
  }
  
  const result = await response.json();
  
  return {
    idToken: result.idToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
    isNewUser: result.isNewUser,
  };
}

/**
 * Get Auth instance (for compatibility, but not used in new implementation)
 * @deprecated Use verifyIdToken directly
 */
export function getAuth(): any {
  return {
    verifyIdToken,
  };
}
