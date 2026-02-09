/**
 * Firebase Admin SDK v8 - JWT and OAuth Token Generation
 * Uses Web Crypto API for compatibility with Cloudflare Workers
 */

import type { ServiceAccount, TokenResponse } from './types';
import { getServiceAccount } from './service-account';

/**
 * Base64URL encode a string
 */
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Base64URL encode a Uint8Array
 */
function base64UrlEncodeBuffer(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Create a JWT (JSON Web Token) for service account authentication
 * Uses Web Crypto API (crypto.subtle) - compatible with Cloudflare Workers
 * 
 * @param {ServiceAccount} serviceAccount - Firebase service account credentials
 * @returns {Promise<string>} Signed JWT token
 */
async function createJWT(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  // JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  // JWT payload with required claims
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: serviceAccount.token_uri,
    iat: now,
    exp: expiry,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase',
  };

  // Base64URL encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Parse private key from PEM format
  const pemContents = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  // Import private key using Web Crypto API
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Base64URL encode signature
  const encodedSignature = base64UrlEncodeBuffer(new Uint8Array(signature));

  return `${unsignedToken}.${encodedSignature}`;
}

/**
 * Token cache to avoid unnecessary regeneration
 */
let cachedAccessToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Get OAuth access token for Firebase Admin API
 * Automatically caches token and refreshes before expiry
 * 
 * @returns {Promise<string>} Valid OAuth access token
 * @throws {Error} If token generation fails
 */
export async function getAdminAccessToken(): Promise<string> {
  // Return cached token if still valid (with 1 minute buffer)
  if (cachedAccessToken && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }

  const serviceAccount = getServiceAccount();
  const jwt = await createJWT(serviceAccount);

  // Exchange JWT for OAuth access token
  const response = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const data = await response.json() as TokenResponse;
  cachedAccessToken = data.access_token;
  
  // Set expiry with 1 minute buffer to ensure token is refreshed before it expires
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;

  return cachedAccessToken;
}

/**
 * Clear the cached access token (useful for testing or forcing refresh)
 */
export function clearTokenCache(): void {
  cachedAccessToken = null;
  tokenExpiry = 0;
}
