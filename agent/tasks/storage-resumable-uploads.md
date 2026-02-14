# Task: Implement Resumable Uploads for Firebase Storage

**Status**: Not Started  
**Priority**: Medium  
**Estimated Time**: 6-8 hours  
**Created**: 2026-02-14  
**Package**: @prmichaelsen/firebase-admin-sdk-v8

---

## Problem

The current storage implementation uses Google Cloud Storage's **simple upload** method, which:
- ❌ Loads entire file into memory
- ❌ No progress tracking
- ❌ No resume capability if upload fails
- ❌ Not suitable for large files (>10MB)
- ❌ Limited by edge runtime memory constraints (typically 128MB)

This makes it unsuitable for:
- Large file uploads (videos, high-res images, archives)
- Unreliable network conditions
- Progress reporting requirements
- Files that exceed memory limits

## Current Implementation

```typescript
// src/storage/client.ts:135
const url = `${UPLOAD_API_BASE}/b/${bucket}/o?uploadType=media&name=${path}`;

// Entire file loaded into memory
let body: ArrayBuffer;
if (data instanceof Blob) {
  body = await data.arrayBuffer(); // All at once
}

// Single upload request
const response = await fetch(url, { body, ... });
```

## Proposed Solution

Implement **resumable uploads** using Google Cloud Storage's resumable upload protocol:

### API Design

```typescript
/**
 * Upload a file with resumable upload support
 * Suitable for large files and unreliable networks
 */
export async function uploadFileResumable(
  path: string,
  data: ArrayBuffer | Uint8Array | Blob | ReadableStream,
  options: ResumableUploadOptions = {}
): Promise<FileMetadata>

interface ResumableUploadOptions extends UploadOptions {
  chunkSize?: number; // Default: 256KB
  onProgress?: (uploaded: number, total: number) => void;
  resumeToken?: string; // Resume from previous attempt
}
```

### Implementation Steps

#### 1. Initiate Resumable Upload Session

```typescript
async function initiateResumableUpload(
  bucket: string,
  path: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<string> {
  const token = await getAdminAccessToken();
  const url = `${UPLOAD_API_BASE}/b/${bucket}/o?uploadType=resumable&name=${path}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': contentType,
    },
    body: JSON.stringify({ metadata }),
  });
  
  // Returns session URI in Location header
  return response.headers.get('Location')!;
}
```

#### 2. Upload in Chunks

```typescript
async function uploadChunk(
  sessionUri: string,
  chunk: ArrayBuffer,
  start: number,
  total: number
): Promise<{ complete: boolean; metadata?: FileMetadata }> {
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
    return { complete: true, metadata: await response.json() };
  } else if (response.status === 308) {
    // Continue uploading
    return { complete: false };
  } else {
    throw new Error(`Upload failed: ${response.status}`);
  }
}
```

#### 3. Handle Resume

```typescript
async function getUploadProgress(sessionUri: string): Promise<number> {
  const response = await fetch(sessionUri, {
    method: 'PUT',
    headers: {
      'Content-Length': '0',
      'Content-Range': 'bytes */*',
    },
  });
  
  if (response.status === 308) {
    const range = response.headers.get('Range');
    if (range) {
      // Parse "bytes=0-1234" to get last uploaded byte
      const match = range.match(/bytes=0-(\d+)/);
      return match ? parseInt(match[1]) + 1 : 0;
    }
  }
  
  return 0;
}
```

#### 4. Main Upload Function

```typescript
export async function uploadFileResumable(
  path: string,
  data: ArrayBuffer | Uint8Array | Blob,
  options: ResumableUploadOptions = {}
): Promise<FileMetadata> {
  const bucket = getDefaultBucket();
  const contentType = options.contentType || detectContentType(path);
  const chunkSize = options.chunkSize || 256 * 1024; // 256KB default
  
  // Convert to ArrayBuffer
  const buffer = await toArrayBuffer(data);
  const total = buffer.byteLength;
  
  // Initiate or resume session
  let sessionUri = options.resumeToken;
  let uploaded = 0;
  
  if (!sessionUri) {
    sessionUri = await initiateResumableUpload(bucket, path, contentType, options.metadata);
  } else {
    uploaded = await getUploadProgress(sessionUri);
  }
  
  // Upload in chunks
  while (uploaded < total) {
    const end = Math.min(uploaded + chunkSize, total);
    const chunk = buffer.slice(uploaded, end);
    
    const result = await uploadChunk(sessionUri, chunk, uploaded, total);
    
    uploaded = end;
    
    if (options.onProgress) {
      options.onProgress(uploaded, total);
    }
    
    if (result.complete) {
      return result.metadata!;
    }
  }
  
  throw new Error('Upload incomplete');
}
```

## Benefits

✅ **Large file support** - Upload files larger than available memory  
✅ **Progress tracking** - Report upload progress to users  
✅ **Resume capability** - Continue failed uploads from where they left off  
✅ **Chunked uploads** - Reduce memory usage  
✅ **Better reliability** - Retry individual chunks instead of entire file  
✅ **Network efficiency** - Handle poor network conditions gracefully

## Trade-offs

⚠️ **Complexity** - More code to maintain (~200+ lines)  
⚠️ **Multiple requests** - More API calls than simple upload  
⚠️ **Session management** - Need to track and store session URIs  
⚠️ **Edge runtime limits** - Still limited by total execution time

## Testing Requirements

### Unit Tests
- [ ] Initiate resumable upload session
- [ ] Upload chunks with correct Content-Range headers
- [ ] Handle 308 (Resume Incomplete) responses
- [ ] Handle 200/201 (Complete) responses
- [ ] Resume from previous session
- [ ] Progress callback invocation
- [ ] Error handling (network failures, invalid chunks)
- [ ] Chunk size configuration

### E2E Tests
- [ ] Upload small file (< chunk size)
- [ ] Upload large file (multiple chunks)
- [ ] Resume interrupted upload
- [ ] Progress tracking
- [ ] Upload with custom metadata
- [ ] Concurrent uploads

## Implementation Checklist

- [ ] Create `src/storage/resumable-upload.ts`
- [ ] Implement `initiateResumableUpload()`
- [ ] Implement `uploadChunk()`
- [ ] Implement `getUploadProgress()`
- [ ] Implement `uploadFileResumable()`
- [ ] Add unit tests
- [ ] Add e2e tests
- [ ] Update `src/storage/index.ts` exports
- [ ] Update `src/index.ts` exports
- [ ] Update README.md with examples
- [ ] Update TypeScript types

## Documentation Example

```typescript
import { uploadFileResumable } from '@prmichaelsen/firebase-admin-sdk-v8';

// Upload large file with progress tracking
const file = await fetch('https://example.com/large-video.mp4');
const data = await file.arrayBuffer();

const metadata = await uploadFileResumable('videos/large.mp4', data, {
  contentType: 'video/mp4',
  chunkSize: 512 * 1024, // 512KB chunks
  onProgress: (uploaded, total) => {
    const percent = (uploaded / total * 100).toFixed(2);
    console.log(`Upload progress: ${percent}%`);
  },
});

console.log('Upload complete:', metadata);
```

## References

- [Google Cloud Storage Resumable Uploads](https://cloud.google.com/storage/docs/resumable-uploads)
- [Resumable Upload Protocol](https://cloud.google.com/storage/docs/performing-resumable-uploads)
- [Upload Best Practices](https://cloud.google.com/storage/docs/best-practices#uploads)

## Success Criteria

- [ ] Can upload files larger than 10MB
- [ ] Progress tracking works correctly
- [ ] Can resume interrupted uploads
- [ ] Memory usage stays within edge runtime limits
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Backward compatible with existing `uploadFile()`

---

**Priority Justification**: Medium - Current simple upload works for most use cases. Resumable uploads are needed for:
- Applications with large file uploads
- Poor network conditions
- Progress reporting requirements
- Files exceeding memory limits

**Estimated Effort**: 6-8 hours
- Implementation: 3-4 hours
- Testing: 2-3 hours
- Documentation: 1 hour
