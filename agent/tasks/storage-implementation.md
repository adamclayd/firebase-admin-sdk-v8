# Storage Implementation Task

## Overview

Implement Firebase Storage functionality using the Google Cloud Storage REST API to enable file upload, download, deletion, and management in edge runtimes.

## Current State

- ❌ No Storage implementation exists
- ✅ Auth token generation working ([`getAdminAccessToken`](../../src/token-generation.ts:104-135))
- ✅ REST API pattern established (see Firestore implementation)
- ✅ TypeScript types infrastructure ready

## Goals

Implement Storage features compatible with Cloudflare Workers and edge runtimes using:
- Google Cloud Storage JSON API v1
- OAuth2 access tokens (already implemented)
- Zero dependencies (fetch + crypto.subtle only)

## API Reference

**Google Cloud Storage REST API**: https://cloud.google.com/storage/docs/json_api/v1

Key endpoints:
- Upload: `POST /upload/storage/v1/b/{bucket}/o`
- Download: `GET /storage/v1/b/{bucket}/o/{object}`
- Delete: `DELETE /storage/v1/b/{bucket}/o/{object}`
- List: `GET /storage/v1/b/{bucket}/o`
- Get metadata: `GET /storage/v1/b/{bucket}/o/{object}`
- Signed URLs: Generate with service account key

## Implementation Plan

### Phase 1: Core Storage Module (4-6 hours)

#### 1.1 Create `src/storage/client.ts`

```typescript
/**
 * Storage client for Google Cloud Storage REST API
 */

export interface StorageOptions {
  bucket?: string; // Default bucket name
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  public?: boolean;
}

export interface DownloadOptions {
  responseType?: 'arraybuffer' | 'blob' | 'stream';
}

export interface ListOptions {
  prefix?: string;
  delimiter?: string;
  maxResults?: number;
  pageToken?: string;
}

export interface FileMetadata {
  name: string;
  bucket: string;
  size: number;
  contentType: string;
  timeCreated: string;
  updated: string;
  md5Hash: string;
  metadata?: Record<string, string>;
}

// Core functions to implement:
export async function uploadFile(
  path: string,
  data: ArrayBuffer | Uint8Array | Blob,
  options?: UploadOptions
): Promise<FileMetadata>;

export async function downloadFile(
  path: string,
  options?: DownloadOptions
): Promise<ArrayBuffer>;

export async function deleteFile(path: string): Promise<void>;

export async function getFileMetadata(path: string): Promise<FileMetadata>;

export async function listFiles(options?: ListOptions): Promise<{
  files: FileMetadata[];
  nextPageToken?: string;
}>;

export async function fileExists(path: string): Promise<boolean>;
```

#### 1.2 Create `src/storage/signed-urls.ts`

```typescript
/**
 * Generate signed URLs for temporary access to Storage files
 */

export interface SignedUrlOptions {
  action: 'read' | 'write' | 'delete';
  expires: Date | number; // Date or seconds from now
  contentType?: string;
  responseDisposition?: string;
  responseType?: string;
}

export async function generateSignedUrl(
  path: string,
  options: SignedUrlOptions
): Promise<string>;
```

#### 1.3 Create `src/storage/index.ts` (Barrel Export)

```typescript
export * from './client';
export * from './signed-urls';
```

### Phase 2: Unit Tests (2-3 hours)

#### 2.1 Create `src/storage/client.spec.ts`

Test coverage:
- ✅ Upload file with different content types
- ✅ Upload with custom metadata
- ✅ Upload with public access
- ✅ Download file as ArrayBuffer
- ✅ Delete file
- ✅ Get file metadata
- ✅ List files with prefix
- ✅ List files with pagination
- ✅ File exists check (true/false)
- ✅ Error handling (404, 403, network errors)
- ✅ OAuth token integration
- ✅ Bucket name handling (default vs explicit)

**Mock Strategy**:
```typescript
beforeEach(() => {
  global.fetch = jest.fn();
  jest.spyOn(tokenGeneration, 'getAdminAccessToken')
    .mockResolvedValue('mock-access-token');
});
```

#### 2.2 Create `src/storage/signed-urls.spec.ts`

Test coverage:
- ✅ Generate read URL
- ✅ Generate write URL
- ✅ Generate delete URL
- ✅ URL expiration handling
- ✅ Content-Type in signed URL
- ✅ Response disposition (download filename)
- ✅ Signature generation with service account
- ✅ URL format validation

### Phase 3: E2E Tests (2-3 hours)

#### 3.1 Create `src/storage/client.e2e.ts`

**Prerequisites**:
- Firebase Storage bucket configured
- Storage rules set to allow admin access
- Test files prepared

**Test Flow**:
```typescript
describe('Storage E2E Tests', () => {
  const TEST_PREFIX = 'e2e-test-';
  const testFiles: string[] = [];

  beforeAll(() => {
    // Verify FIREBASE_STORAGE_BUCKET env var
  });

  afterEach(async () => {
    // Cleanup: Delete all test files
    for (const file of testFiles) {
      await deleteFile(file).catch(() => {});
    }
    testFiles.length = 0;
  });

  describe('Upload and Download', () => {
    it('should upload and download a text file', async () => {
      const path = `${TEST_PREFIX}text-${Date.now()}.txt`;
      const content = 'Hello, Storage!';
      const data = new TextEncoder().encode(content);
      
      // Upload
      const metadata = await uploadFile(path, data, {
        contentType: 'text/plain',
      });
      testFiles.push(path);
      
      expect(metadata.name).toBe(path);
      expect(metadata.contentType).toBe('text/plain');
      
      // Download
      const downloaded = await downloadFile(path);
      const text = new TextDecoder().decode(downloaded);
      expect(text).toBe(content);
    });

    it('should upload and download a binary file', async () => {
      // Test with image/jpeg
    });

    it('should upload with custom metadata', async () => {
      // Test metadata preservation
    });
  });

  describe('File Management', () => {
    it('should delete a file', async () => {
      // Upload, delete, verify 404
    });

    it('should check if file exists', async () => {
      // Test fileExists true/false
    });

    it('should get file metadata', async () => {
      // Test getFileMetadata
    });
  });

  describe('List Files', () => {
    it('should list files with prefix', async () => {
      // Upload 3 files, list with prefix
    });

    it('should paginate file listing', async () => {
      // Upload 10 files, test pagination
    });
  });

  describe('Signed URLs', () => {
    it('should generate working read URL', async () => {
      // Upload file, generate signed URL, fetch with URL
    });

    it('should generate working write URL', async () => {
      // Generate write URL, PUT file, verify upload
    });

    it('should respect URL expiration', async () => {
      // Generate URL with 1-second expiry, wait, verify 403
    });
  });
});
```

### Phase 4: Integration & Documentation (1-2 hours)

#### 4.1 Update `src/index.ts`

```typescript
// Storage exports
export {
  uploadFile,
  downloadFile,
  deleteFile,
  getFileMetadata,
  listFiles,
  fileExists,
  generateSignedUrl,
} from './storage';

// Storage types
export type {
  StorageOptions,
  UploadOptions,
  DownloadOptions,
  ListOptions,
  FileMetadata,
  SignedUrlOptions,
} from './storage';
```

#### 4.2 Update `src/types.ts`

Add Storage-related types if needed for public API.

#### 4.3 Update `README.md`

Add Storage section:
```markdown
### 4. Storage Operations

#### Upload Files
\`\`\`typescript
import { uploadFile } from '@prmichaelsen/firebase-admin-sdk-v8';

const data = new TextEncoder().encode('Hello, Storage!');
const metadata = await uploadFile('files/hello.txt', data, {
  contentType: 'text/plain',
  metadata: { userId: '123' },
});
\`\`\`

#### Download Files
\`\`\`typescript
import { downloadFile } from '@prmichaelsen/firebase-admin-sdk-v8';

const data = await downloadFile('files/hello.txt');
const text = new TextDecoder().decode(data);
\`\`\`

#### Generate Signed URLs
\`\`\`typescript
import { generateSignedUrl } from '@prmichaelsen/firebase-admin-sdk-v8';

const url = await generateSignedUrl('files/hello.txt', {
  action: 'read',
  expires: 3600, // 1 hour
});
\`\`\`
```

#### 4.4 Update `agent/progress.yaml`

Add Storage module tracking:
```yaml
files:
  - name: storage/client.ts
    status: complete
    test_file: src/storage/client.spec.ts
    tests_count: 20
    coverage: 95+
    priority: high
    
  - name: storage/signed-urls.ts
    status: complete
    test_file: src/storage/signed-urls.spec.ts
    tests_count: 8
    coverage: 95+
    priority: medium
```

## Technical Considerations

### 1. Multipart Upload for Large Files

For files >5MB, use resumable upload:
```
POST /upload/storage/v1/b/{bucket}/o?uploadType=resumable
```

### 2. Content-Type Detection

```typescript
function detectContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'txt': 'text/plain',
    'html': 'text/html',
    'json': 'application/json',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'pdf': 'application/pdf',
    // ... more types
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}
```

### 3. Signed URL Generation

Use service account private key to sign:
```typescript
async function signUrl(
  verb: string,
  path: string,
  expiration: number,
  contentType?: string
): Promise<string> {
  const serviceAccount = getServiceAccount();
  
  // Canonical request
  const canonicalRequest = [
    verb,
    `/${serviceAccount.project_id}.appspot.com/${path}`,
    '', // Query string
    '', // Headers
    '', // Signed headers
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  
  // Sign with private key
  const signature = await signWithPrivateKey(
    canonicalRequest,
    serviceAccount.private_key
  );
  
  // Build signed URL
  return `https://storage.googleapis.com/...?X-Goog-Signature=${signature}`;
}
```

### 4. Bucket Configuration

Add to config:
```typescript
export interface SDKConfig {
  serviceAccount?: ServiceAccount;
  projectId?: string;
  storageBucket?: string; // NEW: Default bucket
}
```

## Success Criteria

- ✅ All core Storage operations implemented
- ✅ Unit tests: 28+ tests, 95%+ coverage
- ✅ E2E tests: 10+ tests, all passing
- ✅ Signed URLs working with real Firebase Storage
- ✅ Zero dependencies maintained
- ✅ TypeScript types complete
- ✅ Documentation updated
- ✅ Examples added to README
- ✅ Backward compatible (no breaking changes)

## Estimated Time

- **Phase 1 (Core Module)**: 4-6 hours
- **Phase 2 (Unit Tests)**: 2-3 hours
- **Phase 3 (E2E Tests)**: 2-3 hours
- **Phase 4 (Integration)**: 1-2 hours
- **Total**: 9-14 hours

## Dependencies

- ✅ OAuth token generation (already implemented)
- ✅ Service account configuration (already implemented)
- ✅ REST API pattern (established with Firestore)
- ⚠️ Firebase Storage bucket (needs setup for e2e tests)

## Notes

### Comparison with firebase-admin-node

**firebase-admin-node Storage**:
```typescript
import { getStorage } from 'firebase-admin/storage';

const bucket = getStorage().bucket();
await bucket.upload('local-file.txt');
const [files] = await bucket.getFiles();
```

**Our Implementation**:
```typescript
import { uploadFile, listFiles } from '@prmichaelsen/firebase-admin-sdk-v8';

const data = await readFile('local-file.txt');
await uploadFile('local-file.txt', data);
const { files } = await listFiles();
```

### API Differences

- firebase-admin-node uses Google Cloud Storage SDK (Node.js only)
- Our implementation uses REST API (edge runtime compatible)
- Signed URLs require manual implementation (no SDK helper)
- Streaming not supported in edge runtimes (use ArrayBuffer)

### Security Considerations

1. **Storage Rules**: Configure Firebase Storage rules for admin access
2. **Signed URLs**: Set appropriate expiration times
3. **Public Access**: Be careful with `public: true` option
4. **Metadata**: Don't store sensitive data in file metadata

### Future Enhancements

- Resumable uploads for large files (>5MB)
- Streaming downloads (if runtime supports)
- Batch operations (delete multiple files)
- Copy/move operations
- Custom download tokens
- CORS configuration

## References

- [Google Cloud Storage JSON API](https://cloud.google.com/storage/docs/json_api/v1)
- [Signed URLs Documentation](https://cloud.google.com/storage/docs/access-control/signed-urls)
- [Firebase Storage REST API](https://firebase.google.com/docs/storage/web/upload-files)
- [firebase-admin-node Storage](https://github.com/firebase/firebase-admin-node/tree/master/src/storage)
