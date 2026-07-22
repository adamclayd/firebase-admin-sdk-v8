/**
 * E2E tests for Firebase Storage operations
 *
 * Prerequisites:
 * - service-account.json file with valid credentials
 * - Firebase project: prmichaelsen-firebase-e2e
 * - Firebase Storage bucket configured
 * - Storage rules allow admin access
 *
 * Run with: npm run test:e2e
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { initializeApp } from '../config';
import {
  uploadFile,
  downloadFile,
  deleteFile,
  getFileMetadata,
  listFiles,
  fileExists,
} from './client';
import { generateSignedUrl } from './signed-urls';
import * as fs from 'fs';
import * as path from 'path';

describe('Storage E2E Tests', () => {
  const TEST_PREFIX = 'e2e-test-';
  const testFiles: string[] = [];

  beforeAll(() => {
    // Load service account from filesystem
    const serviceAccountPath = path.join(__dirname, '../../service-account.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        'service-account.json not found. Please add your Firebase service account credentials to the project root.'
      );
    }
    
    const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf-8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    // Initialize with service account and project ID
    initializeApp({
      serviceAccount,
      projectId: serviceAccount.project_id,
    });
  });

  // Helper to track files for cleanup
  function trackFile(path: string): string {
    testFiles.push(path);
    return path;
  }

  // Cleanup after each test
  afterEach(async () => {
    for (const file of testFiles) {
      try {
        await deleteFile(file);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    testFiles.length = 0;
  });

  describe('Upload and Download', () => {
    it('should upload and download a text file', async () => {
      const path = trackFile(`${TEST_PREFIX}text-${Date.now()}.txt`);
      const content = 'Hello, Storage!';
      const data = new TextEncoder().encode(content);

      // Upload
      const metadata = await uploadFile(path, data, {
        contentType: 'text/plain',
      });

      expect(metadata.name).toBe(path);
      expect(metadata.contentType).toBe('text/plain');
      expect(metadata.size).toBe(data.byteLength.toString());

      // Download
      const downloaded = await downloadFile(path);
      const text = new TextDecoder().decode(downloaded);
      expect(text).toBe(content);
    }, 30000);

    it('should upload and download a binary file (image)', async () => {
      const path = trackFile(`${TEST_PREFIX}puppy-${Date.now()}.png`);
      
      // Read the test image
      const imageData = readFileSync(join(process.cwd(), 'resources/puppy.png'));
      const arrayBuffer = imageData.buffer.slice(
        imageData.byteOffset,
        imageData.byteOffset + imageData.byteLength
      );

      // Upload
      const metadata = await uploadFile(path, arrayBuffer, {
        contentType: 'image/png',
      });

      expect(metadata.name).toBe(path);
      expect(metadata.contentType).toBe('image/png');

      // Download
      const downloaded = await downloadFile(path);
      expect(downloaded.byteLength).toBe(arrayBuffer.byteLength);

      // Verify first few bytes match (PNG header)
      const originalBytes = new Uint8Array(arrayBuffer);
      const downloadedBytes = new Uint8Array(downloaded);
      expect(downloadedBytes[0]).toBe(originalBytes[0]); // 0x89
      expect(downloadedBytes[1]).toBe(originalBytes[1]); // 'P'
      expect(downloadedBytes[2]).toBe(originalBytes[2]); // 'N'
      expect(downloadedBytes[3]).toBe(originalBytes[3]); // 'G'
    }, 30000);

    it('should upload with custom metadata', async () => {
      const path = trackFile(`${TEST_PREFIX}metadata-${Date.now()}.txt`);
      const data = new TextEncoder().encode('Test with metadata');

      // Upload with custom metadata
      const metadata = await uploadFile(path, data, {
        contentType: 'text/plain',
        metadata: {
          userId: '123',
          environment: 'test',
        },
      });

      expect(metadata.metadata).toBeDefined();
      expect(metadata.metadata?.userId).toBe('123');
      expect(metadata.metadata?.environment).toBe('test');
    }, 30000);

    it('should auto-detect content type from filename', async () => {
      const path = trackFile(`${TEST_PREFIX}auto-${Date.now()}.json`);
      const data = new TextEncoder().encode('{"test": true}');

      // Upload without specifying content type
      const metadata = await uploadFile(path, data);

      expect(metadata.contentType).toBe('application/json');
    }, 30000);

    it('should upload from Uint8Array', async () => {
      const path = trackFile(`${TEST_PREFIX}uint8-${Date.now()}.txt`);
      const content = 'Uint8Array test';
      const uint8Data = new Uint8Array(new TextEncoder().encode(content));

      // Upload
      await uploadFile(path, uint8Data, {
        contentType: 'text/plain',
      });

      // Download and verify
      const downloaded = await downloadFile(path);
      const text = new TextDecoder().decode(downloaded);
      expect(text).toBe(content);
    }, 30000);
  });

  describe('File Management', () => {
    it('should delete a file', async () => {
      const path = trackFile(`${TEST_PREFIX}delete-${Date.now()}.txt`);
      const data = new TextEncoder().encode('To be deleted');

      // Upload
      await uploadFile(path, data);

      // Verify exists
      expect(await fileExists(path)).toBe(true);

      // Delete
      await deleteFile(path);

      // Verify deleted
      expect(await fileExists(path)).toBe(false);
    }, 30000);

    it('should check if file exists', async () => {
      const existingPath = trackFile(`${TEST_PREFIX}exists-${Date.now()}.txt`);
      const nonExistentPath = `${TEST_PREFIX}nonexistent-${Date.now()}.txt`;

      // Upload a file
      const data = new TextEncoder().encode('Exists test');
      await uploadFile(existingPath, data);

      // Check existing file
      expect(await fileExists(existingPath)).toBe(true);

      // Check non-existent file
      expect(await fileExists(nonExistentPath)).toBe(false);
    }, 30000);

    it('should get file metadata', async () => {
      const path = trackFile(`${TEST_PREFIX}metadata-${Date.now()}.txt`);
      const content = 'Metadata test';
      const data = new TextEncoder().encode(content);

      // Upload
      await uploadFile(path, data, {
        contentType: 'text/plain',
      });

      // Get metadata
      const metadata = await getFileMetadata(path);

      expect(metadata.name).toBe(path);
      expect(metadata.contentType).toBe('text/plain');
      expect(metadata.size).toBe(data.byteLength.toString());
      expect(metadata.timeCreated).toBeDefined();
      expect(metadata.updated).toBeDefined();
      expect(metadata.md5Hash).toBeDefined();
    }, 30000);

    it('should throw error when getting metadata for non-existent file', async () => {
      const path = `${TEST_PREFIX}nonexistent-${Date.now()}.txt`;

      await expect(getFileMetadata(path)).rejects.toThrow();
    }, 30000);

    it('should throw error when deleting non-existent file', async () => {
      const path = `${TEST_PREFIX}nonexistent-${Date.now()}.txt`;

      await expect(deleteFile(path)).rejects.toThrow();
    }, 30000);
  });

  describe('List Files', () => {
    beforeEach(async () => {
      // Upload multiple test files
      const prefix = `${TEST_PREFIX}list-${Date.now()}`;
      for (let i = 0; i < 3; i++) {
        const path = trackFile(`${prefix}/file-${i}.txt`);
        const data = new TextEncoder().encode(`File ${i}`);
        await uploadFile(path, data);
      }
    });

    it('should list files with prefix', async () => {
      const prefix = `${TEST_PREFIX}list-`;

      const result = await listFiles({ prefix });

      expect(result.files.length).toBeGreaterThanOrEqual(3);
      result.files.forEach(file => {
        expect(file.name).toContain(prefix);
      });
    }, 30000);

    it('should list files with pagination', async () => {
      const prefix = `${TEST_PREFIX}list-`;

      // Get first page with limit
      const firstPage = await listFiles({
        prefix,
        maxResults: 2,
      });

      expect(firstPage.files.length).toBeLessThanOrEqual(2);

      // If there's a next page token, get the next page
      if (firstPage.nextPageToken) {
        const secondPage = await listFiles({
          prefix,
          pageToken: firstPage.nextPageToken,
        });

        expect(secondPage.files.length).toBeGreaterThan(0);
      }
    }, 30000);

    it('should list all files without prefix', async () => {
      const result = await listFiles();

      expect(result.files.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Signed URLs', () => {
    it('should generate working read URL', async () => {
      const path = trackFile(`${TEST_PREFIX}signed-read-${Date.now()}.txt`);
      const content = 'Signed URL test';
      const data = new TextEncoder().encode(content);

      // Upload file
      await uploadFile(path, data, {
        contentType: 'text/plain',
      });

      // Generate signed URL (valid for 1 hour)
      const url = await generateSignedUrl(path, {
        action: 'read',
        expires: 3600,
      });

      expect(url).toContain('storage.googleapis.com');
      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
      expect(url).toContain('X-Goog-Signature=');

      // Fetch file using signed URL (no auth needed)
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Signed URL error:', response.status, errorText);
        console.log('Generated URL:', url);
      }
      
      expect(response.ok).toBe(true);

      const downloadedText = await response.text();
      expect(downloadedText).toBe(content);
    }, 30000);

    it('should generate write URL', async () => {
      const path = trackFile(`${TEST_PREFIX}signed-write-${Date.now()}.txt`);

      // Generate signed URL for writing
      const url = await generateSignedUrl(path, {
        action: 'write',
        expires: 3600,
        contentType: 'text/plain',
      });

      expect(url).toContain('storage.googleapis.com');
      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
      expect(url).toContain('X-Goog-Signature=');

      // Upload using signed URL
      const content = 'Uploaded via signed URL';
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: content,
      });

      expect(response.ok).toBe(true);

      // Verify file was uploaded
      const downloaded = await downloadFile(path);
      const text = new TextDecoder().decode(downloaded);
      expect(text).toBe(content);
    }, 30000);

    it('should generate delete URL', async () => {
      const path = trackFile(`${TEST_PREFIX}signed-delete-${Date.now()}.txt`);
      const data = new TextEncoder().encode('To be deleted via signed URL');

      // Upload file
      await uploadFile(path, data);

      // Generate signed URL for deletion
      const url = await generateSignedUrl(path, {
        action: 'delete',
        expires: 3600,
      });

      expect(url).toContain('storage.googleapis.com');
      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');

      // Delete using signed URL
      const response = await fetch(url, {
        method: 'DELETE',
      });

      expect(response.ok).toBe(true);

      // Verify file was deleted
      expect(await fileExists(path)).toBe(false);
    }, 30000);

    it('should generate URL with custom expiration', async () => {
      const path = trackFile(`${TEST_PREFIX}signed-expiry-${Date.now()}.txt`);
      const data = new TextEncoder().encode('Expiry test');

      await uploadFile(path, data);

      // Generate URL with 30 minutes expiration
      const url = await generateSignedUrl(path, {
        action: 'read',
        expires: 1800, // 30 minutes
      });

      expect(url).toContain('X-Goog-Expires=1800');
    }, 30000);

    it('should generate URL with Date expiration', async () => {
      const path = trackFile(`${TEST_PREFIX}signed-date-${Date.now()}.txt`);
      const data = new TextEncoder().encode('Date expiry test');

      await uploadFile(path, data);

      // Generate URL with Date expiration (1 hour from now)
      const expiresAt = new Date(Date.now() + 3600 * 1000);
      const url = await generateSignedUrl(path, {
        action: 'read',
        expires: expiresAt,
      });

      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
      expect(url).toContain('X-Goog-Signature=');
    }, 30000);
  });

  describe('Edge Cases', () => {
    it('should handle files with special characters in names', async () => {
      const path = trackFile(`${TEST_PREFIX}special-chars_with-dashes.and.dots-${Date.now()}.txt`);
      const data = new TextEncoder().encode('Special chars test');

      await uploadFile(path, data);

      const downloaded = await downloadFile(path);
      const text = new TextDecoder().decode(downloaded);
      expect(text).toBe('Special chars test');
    }, 30000);

    it('should handle empty files', async () => {
      const path = trackFile(`${TEST_PREFIX}empty-${Date.now()}.txt`);
      const data = new Uint8Array(0);

      await uploadFile(path, data);

      const downloaded = await downloadFile(path);
      expect(downloaded.byteLength).toBe(0);
    }, 30000);

    it('should handle large files', async () => {
      const path = trackFile(`${TEST_PREFIX}large-${Date.now()}.bin`);
      
      // Create 1MB file
      const size = 1024 * 1024; // 1MB
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        data[i] = i % 256;
      }

      await uploadFile(path, data, {
        contentType: 'application/octet-stream',
      });

      const metadata = await getFileMetadata(path);
      expect(metadata.size).toBe(size.toString());

      const downloaded = await downloadFile(path);
      expect(downloaded.byteLength).toBe(size);
    }, 60000); // Longer timeout for large file

    it('should handle concurrent uploads', async () => {
      const uploads = [];
      for (let i = 0; i < 3; i++) {
        const path = trackFile(`${TEST_PREFIX}concurrent-${Date.now()}-${i}.txt`);
        const data = new TextEncoder().encode(`Concurrent ${i}`);
        uploads.push(uploadFile(path, data));
      }

      const results = await Promise.all(uploads);
      expect(results.length).toBe(3);
      results.forEach(metadata => {
        expect(metadata.name).toContain(TEST_PREFIX);
      });
    }, 30000);
  });
});














/**
 * Test emulated storage e2e 
 */
const emuRunning = process?.env?.STORAGE_EMULATOR_RUNNING === 'true';
(emuRunning ? describe : describe.skip)(`Storage E2E Emulator Tests${emuRunning ? '' : ' - emulator not running'}`, () => {
  const TEST_PREFIX = 'e2e-test-';
  const testFiles: string[] = [];
  

  beforeAll(() => {
    const port = JSON.parse(fs.readFileSync(join(__dirname, '../../firebase.json')).toString()).emulators.storage.port;

    // Initialize with service account and project ID
    initializeApp({
      storageEmulatorHost: `127.0.0.1:${port}`,
      projectId: 'test-project-id'
    });
  });

  // Helper to track files for cleanup
  function trackFile(path: string): string {
    testFiles.push(path);
    return path;
  }

  // Cleanup after each test
  afterEach(async () => {
    for (const file of testFiles) {
      try {
        await deleteFile(file);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    testFiles.length = 0;
  });

  describe('Upload and Download', () => {
    it('should upload and download a text file', async () => {
      const path = trackFile(`${TEST_PREFIX}text-${Date.now()}.txt`);
      const content = 'Hello, Storage!';
      const data = new TextEncoder().encode(content);

      // Upload
      const metadata = await uploadFile(path, data, {
        contentType: 'text/plain',
      });

      expect(metadata.name).toBe(path);
      expect(metadata.contentType).toBe('text/plain');
      expect(metadata.size).toBe(data.byteLength.toString());

      // Download
      const downloaded = await downloadFile(path);
      const text = new TextDecoder().decode(downloaded);
      expect(text).toBe(content);
    }, 30000);

    it('should upload and download a binary file (image)', async () => {
      const path = trackFile(`${TEST_PREFIX}puppy-${Date.now()}.png`);

      // Read the test image
      const imageData = readFileSync(join(process.cwd(), 'resources/puppy.png'));
      const arrayBuffer = imageData.buffer.slice(
        imageData.byteOffset,
        imageData.byteOffset + imageData.byteLength
      );

      // Upload
      const metadata = await uploadFile(path, arrayBuffer, {
        contentType: 'image/png',
      });

      expect(metadata.name).toBe(path);
      expect(metadata.contentType).toBe('image/png');

      // Download
      const downloaded = await downloadFile(path);
      expect(downloaded.byteLength).toBe(arrayBuffer.byteLength);

      // Verify first few bytes match (PNG header)
      const originalBytes = new Uint8Array(arrayBuffer);
      const downloadedBytes = new Uint8Array(downloaded);
      expect(downloadedBytes[ 0 ]).toBe(originalBytes[ 0 ]); // 0x89
      expect(downloadedBytes[ 1 ]).toBe(originalBytes[ 1 ]); // 'P'
      expect(downloadedBytes[ 2 ]).toBe(originalBytes[ 2 ]); // 'N'
      expect(downloadedBytes[ 3 ]).toBe(originalBytes[ 3 ]); // 'G'
    }, 30000);

    it('should upload with custom metadata', async () => {
      const path = trackFile(`${TEST_PREFIX}metadata-${Date.now()}.txt`);
      const data = new TextEncoder().encode('Test with metadata');

      // Upload with custom metadata
      const metadata = await uploadFile(path, data, {
        contentType: 'text/plain',
        metadata: {
          userId: '123',
          environment: 'test',
        },
      });

      expect(metadata.metadata).toBeDefined();
      expect(metadata.metadata?.userId).toBe('123');
      expect(metadata.metadata?.environment).toBe('test');
    }, 30000);

    it('should auto-detect content type from filename', async () => {
      const path = trackFile(`${TEST_PREFIX}auto-${Date.now()}.json`);
      const data = new TextEncoder().encode('{"test": true}');

      // Upload without specifying content type
      const metadata = await uploadFile(path, data);

      expect(metadata.contentType).toBe('application/json');
    }, 30000);

    it('should upload from Uint8Array', async () => {
      const path = trackFile(`${TEST_PREFIX}uint8-${Date.now()}.txt`);
      const content = 'Uint8Array test';
      const uint8Data = new Uint8Array(new TextEncoder().encode(content));

      // Upload
      await uploadFile(path, uint8Data, {
        contentType: 'text/plain',
      });

      // Download and verify
      const downloaded = await downloadFile(path);
      const text = new TextDecoder().decode(downloaded);
      expect(text).toBe(content);
    }, 30000);
  });

  describe('File Management', () => {
    it('should delete a file', async () => {
      const path = trackFile(`${TEST_PREFIX}delete-${Date.now()}.txt`);
      const data = new TextEncoder().encode('To be deleted');

      // Upload
      await uploadFile(path, data);

      // Verify exists
      expect(await fileExists(path)).toBe(true);

      // Delete
      await deleteFile(path);

      // Verify deleted
      expect(await fileExists(path)).toBe(false);
    }, 30000);

    it('should check if file exists', async () => {
      const existingPath = trackFile(`${TEST_PREFIX}exists-${Date.now()}.txt`);
      const nonExistentPath = `${TEST_PREFIX}nonexistent-${Date.now()}.txt`;

      // Upload a file
      const data = new TextEncoder().encode('Exists test');
      await uploadFile(existingPath, data);

      // Check existing file
      expect(await fileExists(existingPath)).toBe(true);

      // Check non-existent file
      expect(await fileExists(nonExistentPath)).toBe(false);
    }, 30000);

    it('should get file metadata', async () => {
      const path = trackFile(`${TEST_PREFIX}metadata-${Date.now()}.txt`);
      const content = 'Metadata test';
      const data = new TextEncoder().encode(content);

      // Upload
      await uploadFile(path, data, {
        contentType: 'text/plain',
      });

      // Get metadata
      const metadata = await getFileMetadata(path);

      expect(metadata.name).toBe(path);
      expect(metadata.contentType).toBe('text/plain');
      expect(metadata.size).toBe(data.byteLength.toString());
      expect(metadata.timeCreated).toBeDefined();
      expect(metadata.updated).toBeDefined();
      expect(metadata.md5Hash).toBeDefined();
    }, 30000);

    it('should throw error when getting metadata for non-existent file', async () => {
      const path = `${TEST_PREFIX}nonexistent-${Date.now()}.txt`;

      await expect(getFileMetadata(path)).rejects.toThrow();
    }, 30000);

    it('should throw error when deleting non-existent file', async () => {
      const path = `${TEST_PREFIX}nonexistent-${Date.now()}.txt`;

      await expect(deleteFile(path)).rejects.toThrow();
    }, 30000);
  });

  describe('List Files', () => {
    beforeEach(async () => {
      // Upload multiple test files
      const prefix = `${TEST_PREFIX}list-${Date.now()}`;
      for (let i = 0; i < 3; i++) {
        const path = trackFile(`${prefix}/file-${i}.txt`);
        const data = new TextEncoder().encode(`File ${i}`);
        await uploadFile(path, data);
      }
    });

    it('should list files with prefix', async () => {
      const prefix = `${TEST_PREFIX}list-`;

      const result = await listFiles({ prefix });

      expect(result.files.length).toBeGreaterThanOrEqual(3);
      result.files.forEach(file => {
        expect(file.name).toContain(prefix);
      });
    }, 30000);

    it('should list files with pagination', async () => {
      const prefix = `${TEST_PREFIX}list-`;

      // Get first page with limit
      const firstPage = await listFiles({
        prefix,
        maxResults: 2,
      });

      expect(firstPage.files.length).toBeLessThanOrEqual(2);

      // If there's a next page token, get the next page
      if (firstPage.nextPageToken) {
        const secondPage = await listFiles({
          prefix,
          pageToken: firstPage.nextPageToken,
        });

        expect(secondPage.files.length).toBeGreaterThan(0);
      }
    }, 30000);

    it('should list all files without prefix', async () => {
      const result = await listFiles();

      expect(result.files.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Signed URLs', () => {
    it('should generate working read URL', async () => {
      const path = trackFile(`${TEST_PREFIX}signed-read-${Date.now()}.txt`);
      const content = 'Signed URL test';
      const data = new TextEncoder().encode(content);

      // Upload file
      await uploadFile(path, data, {
        contentType: 'text/plain',
      });

      // Generate signed URL (valid for 1 hour)
      const url = await generateSignedUrl(path, {
        action: 'read',
        expires: 3600,
      });

      expect(url.includes('127.0.0.1') || url.includes('storage.googleapis.com')).toBe(true);
      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
      expect(url).toContain('X-Goog-Signature=');

      // Fetch file using signed URL (no auth needed)
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Signed URL error:', response.status, errorText);
        console.log('Generated URL:', url);
      }

      expect(response.ok).toBe(true);

      const downloadedText = await response.text();
      expect(downloadedText).toBe(content);
    }, 30000);

    it('should generate write URL', async () => {
      const path = trackFile(`${TEST_PREFIX}signed-write-${Date.now()}.txt`);

      // Generate signed URL for writing
      const url = await generateSignedUrl(path, {
        action: 'write',
        expires: 3600,
        contentType: 'text/plain',
      });

      expect(url.includes('127.0.0.1') || url.includes('storage.googleapis.com')).toBe(true);
      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
      expect(url).toContain('X-Goog-Signature=');

      // Upload using signed URL
      const content = 'Uploaded via signed URL';
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: content,
      });

      expect(response.ok).toBe(true);

      // Verify file was uploaded
      const downloaded = await downloadFile(path);
      const text = new TextDecoder().decode(downloaded);
      expect(text).toBe(content);
    }, 30000);

    it('should generate delete URL', async () => {
      const path = trackFile(`${TEST_PREFIX}signed-delete-${Date.now()}.txt`);
      const data = new TextEncoder().encode('To be deleted via signed URL');

      // Upload file
      await uploadFile(path, data);

      // Generate signed URL for deletion
      const url = await generateSignedUrl(path, {
        action: 'delete',
        expires: 3600,
      });

      expect(url.includes('127.0.0.1') || url.includes('storage.googleapis.com')).toBe(true);
      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');

      // Delete using signed URL
      const response = await fetch(url, {
        method: 'DELETE',
      });

      expect(response.ok).toBe(true);

      // Verify file was deleted
      expect(await fileExists(path)).toBe(false);
    }, 30000);

    it('should generate URL with custom expiration', async () => {
      const path = trackFile(`${TEST_PREFIX}signed-expiry-${Date.now()}.txt`);
      const data = new TextEncoder().encode('Expiry test');

      await uploadFile(path, data);

      // Generate URL with 30 minutes expiration
      const url = await generateSignedUrl(path, {
        action: 'read',
        expires: 1800, // 30 minutes
      });

      expect(url).toContain('X-Goog-Expires=1800');
    }, 30000);

    it('should generate URL with Date expiration', async () => {
      const path = trackFile(`${TEST_PREFIX}signed-date-${Date.now()}.txt`);
      const data = new TextEncoder().encode('Date expiry test');

      await uploadFile(path, data);

      // Generate URL with Date expiration (1 hour from now)
      const expiresAt = new Date(Date.now() + 3600 * 1000);
      const url = await generateSignedUrl(path, {
        action: 'read',
        expires: expiresAt,
      });

      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
      expect(url).toContain('X-Goog-Signature=');
    }, 30000);
  });

  describe('Edge Cases', () => {
    it('should handle files with special characters in names', async () => {
      const path = trackFile(`${TEST_PREFIX}special-chars_with-dashes.and.dots-${Date.now()}.txt`);
      const data = new TextEncoder().encode('Special chars test');

      await uploadFile(path, data);

      const downloaded = await downloadFile(path);
      const text = new TextDecoder().decode(downloaded);
      expect(text).toBe('Special chars test');
    }, 30000);

    it('should handle empty files', async () => {
      const path = trackFile(`${TEST_PREFIX}empty-${Date.now()}.txt`);
      const data = new Uint8Array(0);

      await uploadFile(path, data);

      const downloaded = await downloadFile(path);
      expect(downloaded.byteLength).toBe(0);
    }, 30000);

    it('should handle large files', async () => {
      const path = trackFile(`${TEST_PREFIX}large-${Date.now()}.bin`);

      // Create 1MB file
      const size = 1024 * 1024; // 1MB
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        data[ i ] = i % 256;
      }

      await uploadFile(path, data, {
        contentType: 'application/octet-stream',
      });

      const metadata = await getFileMetadata(path);
      expect(metadata.size).toBe(size.toString());

      const downloaded = await downloadFile(path);
      expect(downloaded.byteLength).toBe(size);
    }, 60000); // Longer timeout for large file

    it('should handle concurrent uploads', async () => {
      const uploads = [];
      for (let i = 0; i < 3; i++) {
        const path = trackFile(`${TEST_PREFIX}concurrent-${Date.now()}-${i}.txt`);
        const data = new TextEncoder().encode(`Concurrent ${i}`);
        uploads.push(uploadFile(path, data));
      }

      const results = await Promise.all(uploads);
      expect(results.length).toBe(3);
      results.forEach(metadata => {
        expect(metadata.name).toContain(TEST_PREFIX);
      });
    }, 30000);
  });
});
