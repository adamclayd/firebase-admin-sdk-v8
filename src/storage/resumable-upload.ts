/**
 * Firebase Storage Resumable Uploads
 * Implements Google Cloud Storage resumable upload protocol for large files
 */

import { getAdminAccessToken } from '../token-generation';
import { getProjectId } from '../config';
import type { FileMetadata, UploadOptions } from './client';

const UPLOAD_API_BASE = 'https://storage.googleapis.com/upload/storage/v1';

/**
 * Get the default storage bucket name
 */
function getDefaultBucket(): string {
  const customBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (customBucket) {
    return customBucket;
  }
  const projectId = getProjectId();
  return `${projectId}.firebasestorage.app`;
}

/**
 * Options for resumable uploads
 */
export interface ResumableUploadOptions extends UploadOptions {
  chunkSize?: number; // Default: 256KB
  onProgress?: (uploaded: number, total: number) => void;
  resumeToken?: string; // Session URI to resume from previous attempt
  totalSize?: number; // Required when uploading from ReadableStream
}

/**
 * Result of chunk upload
 */
interface ChunkUploadResult {
  complete: boolean;
  metadata?: FileMetadata;
}

/**
 * Initiate a resumable upload session
 * 
 * @param bucket - Storage bucket name
 * @param path - File path in storage
 * @param contentType - MIME type of the file
 * @param totalSize - Total file size in bytes
 * @param metadata - Optional custom metadata
 * @returns Session URI for uploading chunks
 */
async function initiateResumableUpload(
  bucket: string,
  path: string,
  contentType: string,
  totalSize: number,
  metadata?: Record<string, string>
): Promise<string> {
  const token = await getAdminAccessToken();
  const url = `${UPLOAD_API_BASE}/b/${encodeURIComponent(bucket)}/o?uploadType=resumable&name=${encodeURIComponent(path)}`;
  
  const requestBody: any = {};
  if (metadata) {
    requestBody.metadata = metadata;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': contentType,
      'X-Upload-Content-Length': totalSize.toString(),
    },
    body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to initiate resumable upload: ${response.status} ${errorText}`);
  }
  
  // Session URI is returned in Location header
  const sessionUri = response.headers.get('Location');
  if (!sessionUri) {
    throw new Error('No session URI returned from resumable upload initiation');
  }
  
  return sessionUri;
}

/**
 * Upload a chunk of data to the session
 * 
 * @param sessionUri - Session URI from initiation
 * @param chunk - Chunk data to upload
 * @param start - Starting byte position (0-indexed)
 * @param total - Total file size in bytes
 * @returns Upload result indicating if complete
 */
async function uploadChunk(
  sessionUri: string,
  chunk: ArrayBuffer,
  start: number,
  total: number
): Promise<ChunkUploadResult> {
  const end = start + chunk.byteLength - 1;
  
  const response = await fetch(sessionUri, {
    method: 'PUT',
    headers: {
      'Content-Length': chunk.byteLength.toString(),
      'Content-Range': `bytes ${start}-${end}/${total}`,
    },
    body: chunk,
  });
  
  if (response.status === 200 || response.status === 201) {
    // Upload complete
    const metadata = await response.json() as FileMetadata;
    return { complete: true, metadata };
  } else if (response.status === 308) {
    // Resume Incomplete - continue uploading
    return { complete: false };
  } else {
    const errorText = await response.text();
    throw new Error(`Chunk upload failed: ${response.status} ${errorText}`);
  }
}

/**
 * Get the current upload progress from the session
 * 
 * @param sessionUri - Session URI
 * @returns Number of bytes already uploaded
 */
async function getUploadProgress(sessionUri: string): Promise<number> {
  const response = await fetch(sessionUri, {
    method: 'PUT',
    headers: {
      'Content-Length': '0',
      'Content-Range': 'bytes */*',
    },
  });
  
  if (response.status === 308) {
    // Resume Incomplete - check Range header
    const range = response.headers.get('Range');
    if (range) {
      // Parse "bytes=0-1234" to get last uploaded byte
      const match = range.match(/bytes=0-(\d+)/);
      if (match) {
        return parseInt(match[1], 10) + 1;
      }
    }
  } else if (response.status === 200 || response.status === 201) {
    // Upload already complete
    const metadata = await response.json() as FileMetadata;
    return parseInt(metadata.size, 10);
  }
  
  return 0;
}

/**
 * Convert data to ArrayBuffer
 */
async function toArrayBuffer(data: ArrayBuffer | Uint8Array | Blob): Promise<ArrayBuffer> {
  if (data instanceof ArrayBuffer) {
    return data;
  } else if (data instanceof Uint8Array) {
    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);
    return buffer;
  } else if (data instanceof Blob) {
    return await data.arrayBuffer();
  }
  throw new Error('Unsupported data type');
}

/**
 * Read chunk from ReadableStream
 */
async function readChunkFromStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  chunkSize: number
): Promise<{ chunk: ArrayBuffer | null; done: boolean }> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (totalBytes < chunkSize) {
    const { value, done } = await reader.read();
    
    if (done) {
      // Stream ended
      if (totalBytes === 0) {
        return { chunk: null, done: true };
      }
      // Return whatever we have
      break;
    }
    
    if (value) {
      chunks.push(value);
      totalBytes += value.byteLength;
      
      // If we've reached the chunk size, stop reading
      if (totalBytes >= chunkSize) {
        break;
      }
    }
  }

  // Combine chunks into single ArrayBuffer
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  
  return { chunk: combined.buffer, done: false };
}

/**
 * Upload a file with resumable upload support
 * Suitable for large files and unreliable networks
 *
 * @param path - File path in storage
 * @param data - File data as ArrayBuffer, Uint8Array, Blob, or ReadableStream
 * @param contentType - MIME type of the file
 * @param options - Upload options
 * @returns File metadata
 *
 * @example
 * ```typescript
 * // Upload from buffer
 * const data = await fetch('https://example.com/large-video.mp4');
 * const buffer = await data.arrayBuffer();
 *
 * const metadata = await uploadFileResumable(
 *   'videos/large.mp4',
 *   buffer,
 *   'video/mp4',
 *   {
 *     chunkSize: 512 * 1024, // 512KB chunks
 *     onProgress: (uploaded, total) => {
 *       console.log(`Progress: ${(uploaded / total * 100).toFixed(2)}%`);
 *     },
 *   }
 * );
 *
 * // Upload from stream (true streaming - no memory limit)
 * const response = await fetch('https://example.com/huge-file.mp4');
 * const metadata = await uploadFileResumable(
 *   'videos/huge.mp4',
 *   response.body!, // ReadableStream
 *   'video/mp4',
 *   {
 *     totalSize: parseInt(response.headers.get('content-length')!),
 *     chunkSize: 1024 * 1024, // 1MB chunks
 *   }
 * );
 * ```
 */
export async function uploadFileResumable(
  path: string,
  data: ArrayBuffer | Uint8Array | Blob | ReadableStream<Uint8Array>,
  contentType: string,
  options: ResumableUploadOptions = {}
): Promise<FileMetadata> {
  const bucket = getDefaultBucket();
  const chunkSize = options.chunkSize || 256 * 1024; // 256KB default
  
  // Check if data is a ReadableStream
  if (data instanceof ReadableStream) {
    return await uploadFromStream(bucket, path, data, contentType, chunkSize, options);
  }
  
  // Convert to ArrayBuffer for non-stream data
  const buffer = await toArrayBuffer(data);
  const total = buffer.byteLength;
  
  // Initiate or resume session
  let sessionUri = options.resumeToken;
  let uploaded = 0;
  
  if (!sessionUri) {
    // Start new upload session
    sessionUri = await initiateResumableUpload(
      bucket,
      path,
      contentType,
      total,
      options.metadata
    );
  } else {
    // Resume existing session
    uploaded = await getUploadProgress(sessionUri);
    
    // Call progress callback for resumed upload
    if (options.onProgress) {
      options.onProgress(uploaded, total);
    }
  }
  
  // Upload in chunks
  while (uploaded < total) {
    const end = Math.min(uploaded + chunkSize, total);
    const chunk = buffer.slice(uploaded, end);
    
    const result = await uploadChunk(sessionUri, chunk, uploaded, total);
    
    uploaded = end;
    
    // Call progress callback
    if (options.onProgress) {
      options.onProgress(uploaded, total);
    }
    
    if (result.complete) {
      return result.metadata!;
    }
  }
  
  throw new Error('Upload incomplete - all chunks sent but no completion response');
}

/**
 * Upload from ReadableStream (true streaming - no memory limit)
 */
async function uploadFromStream(
  bucket: string,
  path: string,
  stream: ReadableStream<Uint8Array>,
  contentType: string,
  chunkSize: number,
  options: ResumableUploadOptions
): Promise<FileMetadata> {
  const total = options.totalSize || -1; // -1 means unknown size
  
  if (total === -1) {
    throw new Error('totalSize is required when uploading from ReadableStream');
  }
  
  // Initiate upload session
  const sessionUri = await initiateResumableUpload(
    bucket,
    path,
    contentType,
    total,
    options.metadata
  );
  
  const reader = stream.getReader();
  let uploaded = 0;
  let lastResult: ChunkUploadResult | null = null;
  
  try {
    while (true) {
      // Read chunk from stream
      const { chunk, done } = await readChunkFromStream(reader, chunkSize);
      
      if (done || !chunk) {
        // Stream ended - check if upload is complete
        if (lastResult && lastResult.complete) {
          return lastResult.metadata!;
        }
        // If we've uploaded all bytes, the last chunk should have completed
        if (uploaded === total && lastResult) {
          return lastResult.metadata!;
        }
        break;
      }
      
      // Upload chunk
      lastResult = await uploadChunk(sessionUri, chunk, uploaded, total);
      
      uploaded += chunk.byteLength;
      
      // Call progress callback
      if (options.onProgress) {
        options.onProgress(uploaded, total);
      }
      
      if (lastResult.complete) {
        return lastResult.metadata!;
      }
    }
    
    throw new Error('Stream ended but upload not complete');
  } finally {
    reader.releaseLock();
  }
}
