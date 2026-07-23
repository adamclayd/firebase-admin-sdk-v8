/**
 * Firebase Admin SDK v8 - Authentication
 * ID token verification supporting both Firebase v9 and v10 token formats
 */

import type { DecodedIdToken, UserInfo } from './types';
import { getProjectId } from './service-account';
import { getServiceAccount, getFirebaseApiKey, getAuthEmulatorHost } from './config';
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
 * Cache for Google's public keys (separate caches for ID tokens and session cookies)
 */
let idTokenKeysCache: Record<string, string> | null = null;
let idTokenKeysCacheExpiry: number = 0;
let sessionKeysCache: Record<string, string> | null = null;
let sessionKeysCacheExpiry: number = 0;

/**
 * Clear the public keys cache (for testing)
 * @internal
 */
export function clearPublicKeysCache(): void {
  idTokenKeysCache = null;
  idTokenKeysCacheExpiry = 0;
  sessionKeysCache = null;
  sessionKeysCacheExpiry = 0;
}

/**
 * Fetch Google's public keys for Firebase token verification
 * Supports both securetoken (v9) and session (v10) endpoints
 */
async function fetchPublicKeys(issuer?: string): Promise<Record<string, string>> {
  // Determine which endpoint to use based on issuer
  const isSessionCookie = issuer && issuer.includes('session.firebase.google.com');
  
  let endpoint: string;
  let cache: Record<string, string> | null;
  let cacheExpiry: number;
  
  if (isSessionCookie) {
    endpoint = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys';
    cache = sessionKeysCache;
    cacheExpiry = sessionKeysCacheExpiry;
  } else {
    endpoint = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
    cache = idTokenKeysCache;
    cacheExpiry = idTokenKeysCacheExpiry;
  }
  
  // Return cached keys if still valid
  if (cache && Date.now() < cacheExpiry) {
    return cache;
  }

  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(`Failed to fetch Firebase public keys from ${endpoint}`);
  }

  const keys = await response.json();
  
  // Cache for 1 hour (keys rotate every 24 hours)
  const newExpiry = Date.now() + 3600000;
  
  if (isSessionCookie) {
    sessionKeysCache = keys;
    sessionKeysCacheExpiry = newExpiry;
  } else {
    idTokenKeysCache = keys;
    idTokenKeysCacheExpiry = newExpiry;
  }
  
  return keys;
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
    const emuHost = getAuthEmulatorHost();
    

    // Validate header
    if ((header.alg !== 'RS256' && !emuHost) || (emuHost && header.alg !== 'none')) {
      throw new Error(`Invalid algorithm. Expected ${emuHost ? 'none' : 'RS256'}`);
    }

    // Validate basic claims
    const now = Math.floor(Date.now() / 1000);

    if (!payload.exp || payload.exp < now) {
      throw new Error('Token has expired');
    }

    // Allow 5-minute (300s) clock skew tolerance to account for minor clock drift
    // between local system time and Google Auth server timestamps.
    const clockSkew = 300;
    if ((!payload.iat || payload.iat > now + clockSkew) && !emuHost) {
      throw new Error('Token issued in the future');
    }

    if ((!payload.auth_time || payload.auth_time > now + clockSkew) && !emuHost) {
      throw new Error('Auth time is in the future');
    }

    // Validate audience (must be project ID)
    if (payload.aud !== projectId && !emuHost) {
      throw new Error(`Invalid audience. Expected ${projectId}, got ${payload.aud}`);
    }

    // Validate issuer - support both old and new formats
    const validIssuers = [
      `https://securetoken.google.com/${projectId}`,  // Firebase v9 and earlier
      `https://session.firebase.google.com/${projectId}`, // Firebase v10+
    ];
    const emuIssuer = `firebase-auth-emulator@${projectId}`;

    if (!emuHost && !validIssuers.includes(payload.iss)) {
      throw new Error(
        `Invalid issuer. Expected one of: ${validIssuers.join(', ')}, got ${payload.iss}`
      );
    } else if (emuHost) {
      const isEmuValid = payload.iss === emuIssuer ||
                         payload.iss.includes('securetoken.google.com') ||
                         payload.iss.includes('session.firebase.google.com') ||
                         payload.iss.includes('firebase-auth-emulator');
      if (!isEmuValid) {
        throw new Error(`Invalid issuer. Expected: ${emuIssuer}, got ${payload.iss}`);
      }
    }

    // Validate subject
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Invalid subject');
    }

    if (payload.sub.length > 128) {
      throw new Error('Subject too long');
    }

    if(!emuHost) {
      // Fetch public keys and verify signature (pass issuer to get correct endpoint)
      let publicKeys = await fetchPublicKeys(payload.iss);
      let publicKeyPem = publicKeys[header.kid];

      // If key not found, it might have rotated - clear cache and retry once
      if (!publicKeyPem) {
        // Clear the appropriate cache based on issuer
        const isSessionCookie = payload.iss && payload.iss.includes('session.firebase.google.com');
        if (isSessionCookie) {
          sessionKeysCache = null;
          sessionKeysCacheExpiry = 0;
        } else {
          idTokenKeysCache = null;
          idTokenKeysCacheExpiry = 0;
        }
        
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
  // Validate UID
  if (!uid || typeof uid !== 'string') {
    throw new Error('uid must be a non-empty string');
  }
  
  if (uid.length > 128) {
    throw new Error('uid must be at most 128 characters');
  }
  
  // Build JWT payload
  
  const now = Math.floor(Date.now() / 1000);
  const emuHost = getAuthEmulatorHost();
  
  const payload: Record<string, any> = {
    iss: emuHost ? `firebase-auth-emulator@${getProjectId()}` : serviceAccount.client_email,
    sub: emuHost ? `firebase-auth-emulator@${getProjectId()}` : serviceAccount.client_email,
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
    alg: emuHost ? 'none' :'RS256',
    typ: 'JWT',
  };
  
  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;


  // Sign with private key
  const signature =  emuHost ? 'firebase-admin-sdk-v8-mock-signature' : await signWithPrivateKey(unsignedToken, getServiceAccount().private_key);
  
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

  const emuHost = getAuthEmulatorHost();
  
  const url = emuHost ? `http://${emuHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}` : `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;

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
 * Options for creating a session cookie
 */
export interface SessionCookieOptions {
  /**
   * Session duration in milliseconds
   * Maximum: 14 days (1,209,600,000 ms)
   * Minimum: 5 minutes (300,000 ms)
   */
  expiresIn: number;
}

/**
 * Create a session cookie from an ID token
 *
 * Session cookies can have a maximum duration of 14 days and are
 * useful for maintaining long-lived authentication sessions.
 *
 * @param idToken - Valid Firebase ID token
 * @param options - Session cookie options
 * @returns Session cookie string
 *
 * @example
 * ```typescript
 * // Create 14-day session cookie
 * const sessionCookie = await createSessionCookie(idToken, {
 *   expiresIn: 60 * 60 * 24 * 14 * 1000
 * });
 *
 * // Set as HTTP-only cookie
 * response.headers.set('Set-Cookie',
 *   `session=${sessionCookie}; Max-Age=1209600; HttpOnly; Secure; SameSite=Strict`
 * );
 * ```
 */
export async function createSessionCookie(
  idToken: string,
  options: SessionCookieOptions
): Promise<string> {
  // Validate inputs
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('idToken must be a non-empty string');
  }
  
  if (!options.expiresIn || typeof options.expiresIn !== 'number') {
    throw new Error('expiresIn must be a number');
  }
  
  // Validate expiration range
  const MIN_DURATION = 5 * 60 * 1000; // 5 minutes
  const MAX_DURATION = 14 * 24 * 60 * 60 * 1000; // 14 days
  
  if (options.expiresIn < MIN_DURATION) {
    throw new Error(`expiresIn must be at least ${MIN_DURATION}ms (5 minutes)`);
  }
  
  if (options.expiresIn > MAX_DURATION) {
    throw new Error(`expiresIn must be at most ${MAX_DURATION}ms (14 days)`);
  }
  
  // Get access token for API call
  const emuHost = getAuthEmulatorHost();
  const { getAdminAccessToken } = await import('./token-generation');
  const projectId = getProjectId();
  const accessToken = await getAdminAccessToken(!!emuHost);
  
  // Call Identity Toolkit API to create session cookie
  const url = emuHost ? `http://${emuHost}/identitytoolkit.googleapis.com/v1/projects/${projectId}:createSessionCookie`: `https://identitytoolkit.googleapis.com/v1/projects/${projectId}:createSessionCookie`;
  
  const validDurationSeconds = Math.floor(options.expiresIn / 1000);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idToken,
      validDuration: validDurationSeconds.toString(), // Must be string per API spec
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Failed to create session cookie: ${response.status}`;
    
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
  return result.sessionCookie;
}

/**
 * Verify a Firebase session cookie
 *
 * Session cookies are verified similarly to ID tokens but have
 * different expiration times (up to 14 days) and issuer format.
 *
 * @param sessionCookie - Session cookie string to verify
 * @param checkRevoked - Whether to check if the token has been revoked (not yet implemented)
 * @returns Decoded token claims
 *
 * @example
 * ```typescript
 * // Verify session cookie from request
 * const sessionCookie = request.cookies.get('session');
 * const decodedToken = await verifySessionCookie(sessionCookie);
 * console.log('User ID:', decodedToken.uid);
 * ```
 */
export async function verifySessionCookie(
  sessionCookie: string,
  checkRevoked: boolean = false
): Promise<DecodedIdToken> {
  if (!sessionCookie || typeof sessionCookie !== 'string') {
    throw new Error('sessionCookie must be a non-empty string');
  }
  
  // Session cookies are JWTs, so we can verify them like ID tokens
  // The main difference is the issuer claim
  
  try {
    // Decode JWT parts
    const parts = sessionCookie.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid session cookie format');
    }
    
    const emuHost = getAuthEmulatorHost();

    const [headerB64, payloadB64] = parts;
    
    // Decode header
    const headerJson = atob(headerB64.replace(/-/g, '+').replace(/_/g, '/'));
    const header: JWTHeader = JSON.parse(headerJson);
    
    // Decode payload
    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload: any = JSON.parse(payloadJson);
    
    // Validate claims
    const projectId = getProjectId();
    const now = Math.floor(Date.now() / 1000);

    // Check expiration
    if ((!payload.exp || payload.exp < now)) {
      throw new Error('Session cookie has expired');
    }

    
    // Check issued at with 5-minute (300s) clock skew tolerance for clock drift
    const clockSkew = 300;
    if ((!payload.iat || payload.iat > now + clockSkew) && !emuHost) {
      throw new Error('Session cookie issued in the future');
    }
    
    // Check audience (should be project ID)
    if ((!emuHost && payload.aud !== projectId) && !emuHost) {
      throw new Error(`Session cookie has incorrect audience. Expected ${projectId}, got ${payload.aud}`);
    }
    
    // Check issuer (session cookies have different issuer than ID tokens)
    const expectedIssuer = emuHost ? `firebase-auth-emulator@${projectId}` : `https://session.firebase.google.com/${projectId}`;
    if (!emuHost && payload.iss !== expectedIssuer) {
      throw new Error(`Session cookie has incorrect issuer. Expected ${expectedIssuer}, got ${payload.iss}`);
    } else if (emuHost) {
      const isEmuValid = payload.iss === expectedIssuer ||
                         payload.iss.includes('session.firebase.google.com') ||
                         payload.iss.includes('securetoken.google.com') ||
                         payload.iss.includes('firebase-auth-emulator');
      if (!isEmuValid) {
        throw new Error(`Session cookie has incorrect issuer. Expected ${expectedIssuer}, got ${payload.iss}`);
      }
    }
    
    // Check subject (user ID)
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Session cookie has no subject (user ID)');
    }
    
    if(!emuHost) {
      // Verify signature using public keys
      await verifySessionCookieSignature(sessionCookie, header, payload);
      
      // TODO: Check if revoked (if requested)
      // This would require calling the Identity Toolkit API
      // to check the user's tokensValidAfterTime
      if (checkRevoked) {
        // For now, we skip this check
        // Future implementation would call:
        // await checkIfTokenRevoked(payload.sub);
      }
    } 
    
    // Return decoded token
    return {
      uid: payload.sub,
      aud: payload.aud,
      auth_time: payload.auth_time,
      exp: payload.exp,
      iat: payload.iat,
      iss: payload.iss,
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified,
      firebase: payload.firebase,
      ...payload,
    };
  } catch (error: any) {
    throw new Error(`Failed to verify session cookie: ${error.message}`);
  }
}

/**
 * Verify JWT signature using Firebase public keys for session cookies
 */
async function verifySessionCookieSignature(
  jwt: string,
  header: JWTHeader,
  payload: any
): Promise<void> {
  // Get public keys for session cookies
  // Session cookies use the session.firebase.google.com issuer
  const keys = await fetchPublicKeys(payload.iss);
  
  const kid = header.kid;
  if (!kid || !keys[kid]) {
    throw new Error('Session cookie has invalid key ID');
  }
  
  // Get the public key
  const publicKeyPem = keys[kid];
  
  // Import public key
  const publicKey = await importPublicKeyFromX509(publicKeyPem);
  
  // Verify signature
  const [headerAndPayload, signature] = [
    jwt.split('.').slice(0, 2).join('.'),
    jwt.split('.')[2]
  ];
  
  const encoder = new TextEncoder();
  const data = encoder.encode(headerAndPayload);
  
  // Decode base64url signature
  const signatureBase64 = signature.replace(/-/g, '+').replace(/_/g, '/');
  const signatureBinary = atob(signatureBase64);
  const signatureBytes = new Uint8Array(signatureBinary.length);
  for (let i = 0; i < signatureBinary.length; i++) {
    signatureBytes[i] = signatureBinary.charCodeAt(i);
  }
  
  const isValid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    publicKey,
    signatureBytes,
    data
  );
  
  if (!isValid) {
    throw new Error('Session cookie signature verification failed');
  }
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
