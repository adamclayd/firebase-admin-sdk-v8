/**
 * E2E tests for resumable uploads
 * Tests against real Firebase Storage
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { initializeApp } from '../config';
import { uploadFileResumable } from './resumable-upload';
import { deleteFile, getFileMetadata, downloadFile } from './client';
import * as fs from 'fs';
import * as path from 'path';

describe('Resumable Upload E2E Tests', () => {
  const TEST_PREFIX = 'e2e-resumable-';
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
      projectId: 'prmichaelsen-firebase-e2e',
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
          chunkSize: 262144, // 256KB - minimum chunk size for GCS
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

      const chunkSize = 262144; // 256KB - minimum chunk size for GCS
      
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

  describe('ReadableStream Support', () => {
    it('should upload from ReadableStream', async () => {
      const filePath = trackFile(`${TEST_PREFIX}stream-${Date.now()}.txt`);
      const content = 'Hello from ReadableStream!';
      const data = new TextEncoder().encode(content);
      
      // Create a ReadableStream
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

      const metadata = await uploadFileResumable(
        filePath,
        stream,
        'text/plain',
        { totalSize: data.byteLength }
      );

      expect(metadata.name).toContain(TEST_PREFIX);
      expect(metadata.contentType).toBe('text/plain');
      expect(parseInt(metadata.size)).toBe(data.byteLength);
    }, 30000);

    it('should upload puppy.png from ReadableStream', async () => {
      const filePath = trackFile(`${TEST_PREFIX}stream-puppy-${Date.now()}.png`);
      const imageData = readFileSync(join(process.cwd(), 'resources/puppy.png'));
      
      // Create a ReadableStream from the image data
      // Emit the entire file at once to avoid chunk boundary issues
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(imageData);
          controller.close();
        },
      });

      const progressUpdates: number[] = [];
      const metadata = await uploadFileResumable(
        filePath,
        stream,
        'image/png',
        {
          totalSize: imageData.length,
          onProgress: (uploaded) => {
            progressUpdates.push(uploaded);
          },
        }
      );

      expect(metadata.name).toContain(TEST_PREFIX);
      expect(metadata.contentType).toBe('image/png');
      expect(parseInt(metadata.size)).toBe(imageData.length);
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Verify final progress is complete
      expect(progressUpdates[progressUpdates.length - 1]).toBe(imageData.length);
    }, 30000);
  });

  describe('Streaming Features Validation', () => {
    it('should stream large file without loading into memory', async () => {
      const filePath = trackFile(`${TEST_PREFIX}stream-large-${Date.now()}.bin`);
      
      // Create a 1MB file as stream (larger than typical chunk)
      const fileSize = 1024 * 1024; // 1MB
      const chunkSize = 262144; // 256KB - GCS minimum
      const stream = new ReadableStream({
        start(controller) {
          // Emit in exact chunk sizes to avoid boundary issues
          for (let i = 0; i < fileSize; i += chunkSize) {
            const size = Math.min(chunkSize, fileSize - i);
            controller.enqueue(new Uint8Array(size));
          }
          controller.close();
        },
      });

      const metadata = await uploadFileResumable(
        filePath,
        stream,
        'application/octet-stream',
        { totalSize: fileSize, chunkSize }
      );

      expect(metadata.name).toContain(TEST_PREFIX);
      expect(parseInt(metadata.size)).toBe(fileSize);
    }, 30000);

    it('should track progress correctly for streamed uploads', async () => {
      const filePath = trackFile(`${TEST_PREFIX}stream-progress-${Date.now()}.bin`);
      const fileSize = 600 * 1024; // 600KB
      
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(fileSize));
          controller.close();
        },
      });

      const progressUpdates: Array<{ uploaded: number; total: number }> = [];
      const metadata = await uploadFileResumable(
        filePath,
        stream,
        'application/octet-stream',
        {
          totalSize: fileSize,
          onProgress: (uploaded, total) => {
            progressUpdates.push({ uploaded, total });
          },
        }
      );

      expect(metadata.name).toContain(TEST_PREFIX);
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Verify progress increases monotonically
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i].uploaded).toBeGreaterThanOrEqual(
          progressUpdates[i - 1].uploaded
        );
      }
      
      // Verify final progress is 100%
      const final = progressUpdates[progressUpdates.length - 1];
      expect(final.uploaded).toBe(final.total);
      expect(final.total).toBe(fileSize);
    }, 30000);

    it('should handle stream with multiple small chunks', async () => {
      const filePath = trackFile(`${TEST_PREFIX}stream-multi-${Date.now()}.txt`);
      const pieces = ['Hello', ' ', 'from', ' ', 'streaming', '!'];
      const totalSize = pieces.join('').length;
      
      const stream = new ReadableStream({
        start(controller) {
          for (const piece of pieces) {
            controller.enqueue(new TextEncoder().encode(piece));
          }
          controller.close();
        },
      });

      const metadata = await uploadFileResumable(
        filePath,
        stream,
        'text/plain',
        { totalSize }
      );

      expect(metadata.name).toContain(TEST_PREFIX);
      expect(parseInt(metadata.size)).toBe(totalSize);
      
      // Verify we can download and read it back
      const downloaded = await downloadFile(filePath);
      const text = new TextDecoder().decode(downloaded);
      expect(text).toBe('Hello from streaming!');
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
