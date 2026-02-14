/**
 * Firebase Storage client using Google Cloud Storage REST API
 * Compatible with edge runtimes (Cloudflare Workers, Vercel Edge, etc.)
 */

import { getAdminAccessToken } from '../token-generation';
import { getProjectId } from '../config';

const STORAGE_API_BASE = 'https://storage.googleapis.com/storage/v1';
const UPLOAD_API_BASE = 'https://storage.googleapis.com/upload/storage/v1';

/**
 * Options for uploading files
 */
export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  public?: boolean;
}

/**
 * Options for downloading files
 */
export interface DownloadOptions {
  responseType?: 'arraybuffer' | 'blob';
}

/**
 * Options for listing files
 */
export interface ListOptions {
  prefix?: string;
  delimiter?: string;
  maxResults?: number;
  pageToken?: string;
}

/**
 * File metadata returned by Storage API
 */
export interface FileMetadata {
  name: string;
  bucket: string;
  size: string;
  contentType: string;
  timeCreated: string;
  updated: string;
  md5Hash: string;
  metadata?: Record<string, string>;
}

/**
 * Result of listing files
 */
export interface ListFilesResult {
  files: FileMetadata[];
  nextPageToken?: string;
}

/**
 * Get the default storage bucket name
 *
 * Checks FIREBASE_STORAGE_BUCKET environment variable first,
 * then falls back to {projectId}.appspot.com
 */
function getDefaultBucket(): string {
  // Check for custom bucket name in environment
  const customBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (customBucket) {
    return customBucket;
  }
  
  // Fall back to default Firebase Storage bucket (new format)
  const projectId = getProjectId();
  return `${projectId}.firebasestorage.app`;
}

/**
 * Detect content type from filename
 */
function detectContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'txt': 'text/plain',
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Upload a file to Firebase Storage
 * 
 * @param path - File path in storage (e.g., 'images/photo.jpg')
 * @param data - File data as ArrayBuffer, Uint8Array, or Blob
 * @param options - Upload options (contentType, metadata, public)
 * @returns File metadata
 * 
 * @example
 * ```typescript
 * const data = new TextEncoder().encode('Hello, Storage!');
 * const metadata = await uploadFile('files/hello.txt', data, {
 *   contentType: 'text/plain',
 *   metadata: { userId: '123' },
 * });
 * ```
 */
export async function uploadFile(
  path: string,
  data: ArrayBuffer | Uint8Array | Blob,
  options: UploadOptions = {}
): Promise<FileMetadata> {
  const token = await getAdminAccessToken();
  const bucket = getDefaultBucket();
  
  // Detect content type if not provided
  const contentType = options.contentType || detectContentType(path);
  
  // Build upload URL with simple upload
  const url = `${UPLOAD_API_BASE}/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(path)}`;
  
  // Convert data to ArrayBuffer if needed
  let body: ArrayBuffer;
  if (data instanceof Blob) {
    body = await data.arrayBuffer() as ArrayBuffer;
  } else if (data instanceof Uint8Array) {
    // Create a proper ArrayBuffer from Uint8Array
    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);
    body = buffer;
  } else {
    body = data;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': contentType,
      'Content-Length': body.byteLength.toString(),
    },
    body,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload file: ${response.status} ${errorText}`);
  }
  
  const result = await response.json() as FileMetadata;
  
  // Set public access if requested
  if (options.public) {
    await makeFilePublic(path);
  }
  
  // Update custom metadata if provided
  if (options.metadata) {
    return await updateFileMetadata(path, options.metadata);
  }
  
  return result;
}

/**
 * Download a file from Firebase Storage
 * 
 * @param path - File path in storage
 * @param options - Download options
 * @returns File data as ArrayBuffer
 * 
 * @example
 * ```typescript
 * const data = await downloadFile('files/hello.txt');
 * const text = new TextDecoder().decode(data);
 * console.log(text); // "Hello, Storage!"
 * ```
 */
export async function downloadFile(
  path: string,
  _options: DownloadOptions = {}
): Promise<ArrayBuffer> {
  const token = await getAdminAccessToken();
  const bucket = getDefaultBucket();
  
  const url = `${STORAGE_API_BASE}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to download file: ${response.status} ${errorText}`);
  }
  
  return await response.arrayBuffer();
}

/**
 * Delete a file from Firebase Storage
 * 
 * @param path - File path in storage
 * 
 * @example
 * ```typescript
 * await deleteFile('files/hello.txt');
 * ```
 */
export async function deleteFile(path: string): Promise<void> {
  const token = await getAdminAccessToken();
  const bucket = getDefaultBucket();
  
  const url = `${STORAGE_API_BASE}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete file: ${response.status} ${errorText}`);
  }
}

/**
 * Get file metadata from Firebase Storage
 * 
 * @param path - File path in storage
 * @returns File metadata
 * 
 * @example
 * ```typescript
 * const metadata = await getFileMetadata('files/hello.txt');
 * console.log(metadata.size, metadata.contentType);
 * ```
 */
export async function getFileMetadata(path: string): Promise<FileMetadata> {
  const token = await getAdminAccessToken();
  const bucket = getDefaultBucket();
  
  const url = `${STORAGE_API_BASE}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get file metadata: ${response.status} ${errorText}`);
  }
  
  return await response.json() as FileMetadata;
}

/**
 * Update file metadata
 * 
 * @param path - File path in storage
 * @param metadata - Custom metadata to set
 * @returns Updated file metadata
 */
async function updateFileMetadata(
  path: string,
  metadata: Record<string, string>
): Promise<FileMetadata> {
  const token = await getAdminAccessToken();
  const bucket = getDefaultBucket();
  
  const url = `${STORAGE_API_BASE}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ metadata }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update file metadata: ${response.status} ${errorText}`);
  }
  
  return await response.json() as FileMetadata;
}

/**
 * Make a file publicly accessible
 * 
 * @param path - File path in storage
 */
async function makeFilePublic(path: string): Promise<void> {
  const token = await getAdminAccessToken();
  const bucket = getDefaultBucket();
  
  const url = `${STORAGE_API_BASE}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}/acl`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      entity: 'allUsers',
      role: 'READER',
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to make file public: ${response.status} ${errorText}`);
  }
}

/**
 * List files in Firebase Storage
 * 
 * @param options - List options (prefix, delimiter, maxResults, pageToken)
 * @returns List of files and optional next page token
 * 
 * @example
 * ```typescript
 * // List all files with prefix
 * const { files } = await listFiles({ prefix: 'images/' });
 * 
 * // List with pagination
 * const { files, nextPageToken } = await listFiles({ maxResults: 10 });
 * if (nextPageToken) {
 *   const nextPage = await listFiles({ pageToken: nextPageToken });
 * }
 * ```
 */
export async function listFiles(options: ListOptions = {}): Promise<ListFilesResult> {
  const token = await getAdminAccessToken();
  const bucket = getDefaultBucket();
  
  // Build query parameters
  const params = new URLSearchParams();
  if (options.prefix) params.append('prefix', options.prefix);
  if (options.delimiter) params.append('delimiter', options.delimiter);
  if (options.maxResults) params.append('maxResults', options.maxResults.toString());
  if (options.pageToken) params.append('pageToken', options.pageToken);
  
  const url = `${STORAGE_API_BASE}/b/${encodeURIComponent(bucket)}/o?${params.toString()}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list files: ${response.status} ${errorText}`);
  }
  
  const result = await response.json() as { items?: FileMetadata[]; nextPageToken?: string };
  
  return {
    files: result.items || [],
    nextPageToken: result.nextPageToken,
  };
}

/**
 * Check if a file exists in Firebase Storage
 * 
 * @param path - File path in storage
 * @returns True if file exists, false otherwise
 * 
 * @example
 * ```typescript
 * if (await fileExists('files/hello.txt')) {
 *   console.log('File exists!');
 * }
 * ```
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await getFileMetadata(path);
    return true;
  } catch (error) {
    // 404 means file doesn't exist
    if (error instanceof Error && error.message.includes('404')) {
      return false;
    }
    // Re-throw other errors
    throw error;
  }
}
