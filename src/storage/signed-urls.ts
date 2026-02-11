/**
 * Generate signed URLs for temporary access to Firebase Storage files
 * Uses Google Cloud Storage V4 signing process
 */

import { getServiceAccount, getProjectId } from '../config';

/**
 * Get the storage bucket name (same logic as client.ts)
 */
function getStorageBucket(): string {
  const customBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (customBucket) {
    return customBucket;
  }
  const projectId = getProjectId();
  return `${projectId}.appspot.com`;
}

/**
 * Options for generating signed URLs
 */
export interface SignedUrlOptions {
  action: 'read' | 'write' | 'delete';
  expires: Date | number; // Date or seconds from now
  contentType?: string;
  responseDisposition?: string;
  responseType?: string;
}

/**
 * Convert expires option to expiration timestamp
 */
function getExpirationTimestamp(expires: Date | number): number {
  if (expires instanceof Date) {
    return Math.floor(expires.getTime() / 1000);
  }
  // Assume it's seconds from now
  return Math.floor(Date.now() / 1000) + expires;
}

/**
 * Convert action to HTTP method
 */
function actionToMethod(action: 'read' | 'write' | 'delete'): string {
  switch (action) {
    case 'read':
      return 'GET';
    case 'write':
      return 'PUT';
    case 'delete':
      return 'DELETE';
  }
}

/**
 * Encode string to hex
 */
function stringToHex(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Sign data with service account private key using crypto.subtle
 */
async function signData(data: string, privateKey: string): Promise<string> {
  // Import the private key
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');
  
  // Decode base64
  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Import key for signing
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
  
  // Sign the data
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    dataBytes
  );
  
  // Convert signature to hex
  const signatureArray = new Uint8Array(signature);
  return Array.from(signatureArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a signed URL for temporary access to a Storage file
 * 
 * Uses Google Cloud Storage V4 signing process
 * 
 * @param path - File path in storage (e.g., 'images/photo.jpg')
 * @param options - Signed URL options
 * @returns Signed URL that can be used without authentication
 * 
 * @example
 * ```typescript
 * // Generate read URL valid for 1 hour
 * const url = await generateSignedUrl('files/hello.txt', {
 *   action: 'read',
 *   expires: 3600,
 * });
 * 
 * // Generate write URL with content type
 * const uploadUrl = await generateSignedUrl('files/upload.jpg', {
 *   action: 'write',
 *   expires: 1800, // 30 minutes
 *   contentType: 'image/jpeg',
 * });
 * 
 * // Use the URL (no auth needed)
 * const response = await fetch(url);
 * const data = await response.arrayBuffer();
 * ```
 */
export async function generateSignedUrl(
  path: string,
  options: SignedUrlOptions
): Promise<string> {
  const serviceAccount = getServiceAccount();
  const bucket = getStorageBucket();
  
  // V4 signing process
  const method = actionToMethod(options.action);
  const expiration = getExpirationTimestamp(options.expires);
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000);
  
  // Format date and time for V4 signing (YYYYMMDDTHHMMSSZ)
  const isoString = now.toISOString();
  const datestamp = isoString.split('T')[0].replace(/-/g, ''); // YYYYMMDD
  const timeString = isoString.split('T')[1].replace(/[:.]/g, '').substring(0, 6); // HHMMSS
  const dateTimeStamp = `${datestamp}T${timeString}Z`; // YYYYMMDDTHHMMSSZ
  
  // Credential scope
  const credentialScope = `${datestamp}/auto/storage/goog4_request`;
  const credential = `${serviceAccount.client_email}/${credentialScope}`;
  
  // Canonical headers (must be sorted)
  const canonicalHeaders = `host:storage.googleapis.com\n`;
  const signedHeaders = 'host';
  
  // Query parameters for signed URL
  const queryParams: Record<string, string> = {
    'X-Goog-Algorithm': 'GOOG4-RSA-SHA256',
    'X-Goog-Credential': credential,
    'X-Goog-Date': dateTimeStamp,
    'X-Goog-Expires': (expiration - timestamp).toString(),
    'X-Goog-SignedHeaders': signedHeaders,
  };
  
  // Add optional query parameters
  if (options.contentType) {
    queryParams['response-content-type'] = options.contentType;
  }
  if (options.responseDisposition) {
    queryParams['response-content-disposition'] = options.responseDisposition;
  }
  if (options.responseType) {
    queryParams['response-content-type'] = options.responseType;
  }
  
  // Build canonical query string (must be sorted)
  const sortedParams = Object.keys(queryParams).sort();
  const canonicalQueryString = sortedParams
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&');
  
  // Canonical request
  // Note: The path must be URL-encoded for the canonical request
  const encodedPath = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
  const canonicalUri = `/${bucket}/${encodedPath}`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  
  // String to sign
  const canonicalRequestHash = stringToHex(canonicalRequest);
  const stringToSign = [
    'GOOG4-RSA-SHA256',
    dateTimeStamp,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');
  
  // Sign the string
  const signature = await signData(stringToSign, serviceAccount.private_key);
  
  // Build final URL
  const signedUrl = `https://storage.googleapis.com${canonicalUri}?${canonicalQueryString}&X-Goog-Signature=${signature}`;
  
  return signedUrl;
}
