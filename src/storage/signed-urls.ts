/**
 * Generate signed URLs for temporary access to Firebase Storage files
 * Uses Google Cloud Storage V4 signing process
 */

import { getServiceAccount, getProjectId, getStorageEmulatorHost } from '../config';

/**
 * Get the storage bucket name (same logic as client.ts)
 */
function getStorageBucket(): string {
  const customBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (customBucket) {
    return customBucket;
  }
  const projectId = getProjectId();
  return `${projectId}.firebasestorage.app`;
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
 * Encode URI component with additional encoding for reserved characters
 * Matches Google Cloud Storage SDK behavior
 * Encodes: A-Z a-z 0-9 and also ! * ' ( )
 */
function fixedEncodeURIComponent(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    c => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

/**
 * Compute SHA-256 hash of a string and return as hex
 */
async function sha256Hex(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
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
  
  // For read operations, force raw media response for the emulator
  if (options.action === 'read') {
    queryParams['alt'] = 'media';
  }
  
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
  // Each segment of the path should be encoded separately
  // Using fixedEncodeURIComponent to match Google Cloud Storage SDK behavior
  const encodedPath = path.split('/').map(segment => fixedEncodeURIComponent(segment)).join('/');
  const canonicalUri = `/${bucket}/${encodedPath}`;
  
  // Build canonical request according to V4 signing spec
  // Format:
  // HTTP_METHOD\n
  // CANONICAL_URI\n
  // CANONICAL_QUERY_STRING\n
  // CANONICAL_HEADERS\n
  // \n (empty line separating headers from signed headers)
  // SIGNED_HEADERS\n
  // PAYLOAD_HASH
  //
  // Note: canonicalHeaders already ends with \n, so the template below adds another \n to create the required empty line
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`;
  
  // String to sign
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = [
    'GOOG4-RSA-SHA256',
    dateTimeStamp,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');
  
  const emuHost = getStorageEmulatorHost();

  // Sign the string
  const signature = emuHost ? `firebase-admin-sdk-v8-${getProjectId()}` : await signData(stringToSign, serviceAccount.private_key);
  
  // Build final URL
  const signedUrl = emuHost
    ? `http://${emuHost}/v0/b/${bucket}/o/${encodedPath}?${canonicalQueryString}&X-Goog-Signature=${signature}`
    : `https://storage.googleapis.com${canonicalUri}?${canonicalQueryString}&X-Goog-Signature=${signature}`;
  
  return signedUrl;
}
