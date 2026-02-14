/**
 * E2E tests for resumable uploads
 * Tests against real Firebase Storage
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { initializeApp, getProjectId } from '../config';
import { uploadFileResumable } from './resumable-upload';
import { deleteFile, getFileMetadata } from './client';
import * as fs from 'fs';
import * as path from 'path';

describe('Resumable Upload E2E Tests', () => {
  const TEST_PREFIX = 'e2e-resumable-';
  const testFiles: string[] = [];
  let bucket: string;

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
      projectId: 'prmichaelsen-firebase-e2e',
    });
    
    // Get bucket name from project ID
    bucket = `${getProjectId()}.appspot.com`;
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

  describe('Small File Upload', () => {
    it('should upload small file with resumable upload', async () => {
      const filePath = trackFile(`${TEST_PREFIX}small-${Date.now()}.txt`);
      const content = 'Hello, Resumable Uploads!';
      const data = new TextEncoder().encode(content);
      
      const metadata = await uploadFileResumable(
        filePath,
        data.buffer,
        'text/plain'
      );

      expect(metadata.name).toContain(TEST_PREFIX);
      expect(metadata.contentType).toBe('text/plain');
      expect(parseInt(metadata.size)).toBe(data.length);
    }, 30000);
  });

  describe('Image Upload', () => {
    it('should upload puppy.png with resumable upload', async () => {
      const filePath = trackFile(`${TEST_PREFIX}puppy-${Date.now()}.png`);
      const imageData = readFileSync(join(process.cwd(), 'resources/puppy.png'));
      const arrayBuffer = imageData.buffer.slice(
        imageData.byteOffset,
        imageData.byteOffset + imageData.byteLength
      );
      
      const metadata = await uploadFileResumable(
        filePath,
        arrayBuffer,
        'image/png'
      );

      expect(metadata.name).toContain(TEST_PREFIX);
      expect(metadata.contentType).toBe('image/png');
      expect(parseInt(metadata.size)).toBe(arrayBuffer.byteLength);
      
      // Verify file exists
      const retrievedMetadata = await getFileMetadata(filePath);
      expect(retrievedMetadata.name).toBe(metadata.name);
    }, 30000);

    it('should upload puppy.png with progress tracking', async () => {
      const filePath = trackFile(`${TEST_PREFIX}puppy-progress-${Date.now()}.png`);
      const imageData = readFileSync(join(process.cwd(), 'resources/puppy.png'));
      const arrayBuffer = imageData.buffer.slice(
        imageData.byteOffset,
        imageData.byteOffset + imageData.byteLength
      );

      const progressUpdates: Array<{ uploaded: number; total: number }> = [];
      
      const metadata = await uploadFileResumable(
        filePath,
        arrayBuffer,
        'image/png',
        {
          chunkSize: 50 * 1024, // 50KB chunks to get multiple progress updates
          onProgress: (uploaded: number, total: number) => {
            progressUpdates.push({ uploaded, total });
          },
        }
      );

      expect(metadata.name).toContain(TEST_PREFIX);
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Verify progress increases
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i].uploaded).toBeGreaterThanOrEqual(
          progressUpdates[i - 1].uploaded
        );
      }
      
      // Last progress should be 100%
      const lastProgress = progressUpdates[progressUpdates.length - 1];
      expect(lastProgress.uploaded).toBe(lastProgress.total);
    }, 30000);

    it('should upload puppy.png with custom metadata', async () => {
      const filePath = trackFile(`${TEST_PREFIX}puppy-metadata-${Date.now()}.png`);
      const imageData = readFileSync(join(process.cwd(), 'resources/puppy.png'));
      const arrayBuffer = imageData.buffer.slice(
        imageData.byteOffset,
        imageData.byteOffset + imageData.byteLength
      );
      
      const metadata = await uploadFileResumable(
        filePath,
        arrayBuffer,
        'image/png',
        {
          metadata: {
            uploadedBy: 'e2e-test',
            testType: 'resumable-upload',
            imageType: 'puppy',
          },
        }
      );

      expect(metadata.name).toContain(TEST_PREFIX);
      expect(metadata.metadata).toBeDefined();
      expect(metadata.metadata?.uploadedBy).toBe('e2e-test');
    }, 30000);
  });

  describe('Chunked Upload', () => {
    it('should upload puppy.png in small chunks', async () => {
      const filePath = trackFile(`${TEST_PREFIX}puppy-chunked-${Date.now()}.png`);
      const imageData = readFileSync(join(process.cwd(), 'resources/puppy.png'));
      const arrayBuffer = imageData.buffer.slice(
        imageData.byteOffset,
        imageData.byteOffset + imageData.byteLength
      );

      const chunkSize = 10 * 1024; // 10KB chunks (very small to test chunking)
      
      const metadata = await uploadFileResumable(
        filePath,
        arrayBuffer,
        'image/png',
        { chunkSize }
      );

      expect(metadata.name).toContain(TEST_PREFIX);
      expect(parseInt(metadata.size)).toBe(arrayBuffer.byteLength);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid bucket gracefully', async () => {
      const filePath = `${TEST_PREFIX}invalid-${Date.now()}.txt`;
      const data = new TextEncoder().encode('test');

      // Set invalid bucket via environment variable
      const originalBucket = process.env.FIREBASE_STORAGE_BUCKET;
      process.env.FIREBASE_STORAGE_BUCKET = 'invalid-bucket-that-does-not-exist';

      try {
        await expect(
          uploadFileResumable(
            filePath,
            data.buffer,
            'text/plain'
          )
        ).rejects.toThrow();
      } finally {
        // Restore original bucket
        if (originalBucket) {
          process.env.FIREBASE_STORAGE_BUCKET = originalBucket;
        } else {
          delete process.env.FIREBASE_STORAGE_BUCKET;
        }
      }
    }, 30000);
  });
});
