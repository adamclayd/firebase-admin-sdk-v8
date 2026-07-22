/**
 * Firebase Storage client using Google Cloud Storage REST API
 * Compatible with edge runtimes (Cloudflare Workers, Vercel Edge, etc.)
 */

import { getAdminAccessToken } from '../token-generation';
import { getProjectId, getStorageEmulatorHost } from '../config';

const STORAGE_API_BASE = 'https://storage.googleapis.com/storage/v1';
const UPLOAD_API_BASE = 'https://storage.googleapis.com/upload/storage/v1';
const STORAGE_EMULATOR_PATH = 'storage/v1';
const UPLOAD_EMULATOR_PATH = 'upload/storage/v1';

function getUrl(path: string, forUpload = false) {
  let emuHost = getStorageEmulatorHost();
  path.startsWith('/') && (path = path.slice(1));
  path.endsWith('/') && (path = path.slice(0, -1));

  emuHost && forUpload && (path = `http://${emuHost}/${UPLOAD_EMULATOR_PATH}/${path}`);
  emuHost && !forUpload && (path = `http://${emuHost}/${STORAGE_EMULATOR_PATH}/${path}`);
  !emuHost && forUpload && (path = `${UPLOAD_API_BASE}/${path}`);
  !emuHost && !forUpload && (path = `${STORAGE_API_BASE}/${path}`);

  return path;
}

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
 * then falls back to {projectId}.firebasestorage.app
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
  const isEmulator = !!getStorageEmulatorHost();
  const token = await getAdminAccessToken(isEmulator);
  const bucket = getDefaultBucket();
  
  // Detect content type if not provided
  const contentType = options.contentType || detectContentType(path);

  if (isEmulator) {
    // Emulator path: use multipart upload to handle metadata and data atomically
    let dataBytes: Uint8Array;
    if (data instanceof Blob) {
      dataBytes = new Uint8Array(await data.arrayBuffer());
    } else if (data instanceof Uint8Array) {
      dataBytes = data;
    } else {
      dataBytes = new Uint8Array(data);
    }
    
    // Construct multipart body
    const metadataObject: Record<string, unknown> = {
      name: path,
      contentType,
    };
    if (options.metadata) {
      metadataObject.metadata = options.metadata;
    }

    const boundary = `===FIREBASE_ADMIN_SDK_${Date.now()}===`;
    const encoder = new TextEncoder();
    
    const part1 = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadataObject)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`
    );
    const part2 = encoder.encode(`\r\n--${boundary}--`);
    
    const totalLength = part1.byteLength + dataBytes.byteLength + part2.byteLength;
    const body = new Uint8Array(totalLength);
    body.set(part1, 0);
    body.set(dataBytes, part1.byteLength);
    body.set(part2, part1.byteLength + dataBytes.byteLength);
    
    const url = getUrl(`/b/${encodeURIComponent(bucket)}/o?uploadType=multipart`, true);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': totalLength.toString(),
      },
      body,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload file: ${response.status} ${errorText}`);
    }
    
    const result = await response.json() as FileMetadata;
    
    if (options.public) {
      await makeFilePublic(path);
    }
    
    return result;
  } else {
    // Production path: use media upload followed by metadata update
    // Build upload URL with simple upload
    const url = getUrl(`/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(path)}`, true);
    
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
  const token = await getAdminAccessToken(!!getStorageEmulatorHost());
  const bucket = getDefaultBucket();
  
  const url = getUrl(`/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`);
  
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
  const token = await getAdminAccessToken(!!getStorageEmulatorHost());
  const bucket = getDefaultBucket();
  
  const url = getUrl(`/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}`);
  
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
  const token = await getAdminAccessToken(!!getStorageEmulatorHost());
  const bucket = getDefaultBucket();
  
  const url = getUrl(`/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}`);
  
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
  const token = await getAdminAccessToken(!!getStorageEmulatorHost());
  const bucket = getDefaultBucket();
  
  const url = getUrl(`/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}`);
  
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
  const token = await getAdminAccessToken(!!getStorageEmulatorHost());
  const bucket = getDefaultBucket();
  
  const url = getUrl(`/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}/acl`);
  
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
  const token = await getAdminAccessToken(!!getStorageEmulatorHost());
  const bucket = getDefaultBucket();
  
  // Build query parameters
  const params = new URLSearchParams();
  if (options.prefix) params.append('prefix', options.prefix);
  if (options.delimiter) params.append('delimiter', options.delimiter);
  if (options.maxResults) params.append('maxResults', options.maxResults.toString());
  if (options.pageToken) params.append('pageToken', options.pageToken);
  
  const url = getUrl(`/b/${encodeURIComponent(bucket)}/o?${params.toString()}`);
  
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
