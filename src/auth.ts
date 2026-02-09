/**
 * Firebase Admin SDK v8 - Authentication
 * ID token verification using firebase-auth-cloudflare-workers
 */

import { Auth, type KeyStorer } from 'firebase-auth-cloudflare-workers';
import type { DecodedIdToken, UserInfo } from './types';
import { getProjectId } from './service-account';

/**
 * Simple in-memory cache for JWKs (JSON Web Keys)
 * Implements KeyStorer interface for firebase-auth-cloudflare-workers
 */
class MemoryKeyStore implements KeyStorer {
  private cache: string | null = null;
  
  async get<ExpectedValue = unknown>(): Promise<ExpectedValue | null> {
    if (!this.cache) {
      return null;
    }
    try {
      return JSON.parse(this.cache) as ExpectedValue;
    } catch {
      return null;
    }
  }
  
  async put(value: string, _expirationTtl: number): Promise<void> {
    this.cache = value;
    // In a real implementation with TTL support, you would set a timeout
    // to clear the cache after _expirationTtl seconds
    // For now, we just store indefinitely
  }
}

// Singleton key store instance
const keyStore = new MemoryKeyStore();

/**
 * Get or initialize Firebase Auth instance
 * @returns {Auth} Firebase Auth instance
 * @throws {Error} If PUBLIC_FIREBASE_PROJECT_ID is not set
 */
export function getAuth(): Auth {
  const projectId = getProjectId();
  return Auth.getOrInitialize(projectId, keyStore);
}

/**
 * Verify a Firebase ID token
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

  const auth = getAuth();
  
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken as DecodedIdToken;
  } catch (error) {
    throw new Error(`Failed to verify ID token: ${error instanceof Error ? error.message : String(error)}`);
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
