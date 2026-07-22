/**
 * Unit tests for resumable uploads
 */

import { uploadFileResumable } from './resumable-upload';
import * as tokenGeneration from '../token-generation';
import * as config from '../config';

// Mock dependencies
jest.mock('../token-generation');
jest.mock('../config');

const mockGetAdminAccessToken = tokenGeneration.getAdminAccessToken as jest.MockedFunction<typeof tokenGeneration.getAdminAccessToken>;
const mockGetProjectId = config.getProjectId as jest.MockedFunction<typeof config.getProjectId>;

describe('Resumable Uploads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminAccessToken.mockResolvedValue('mock-access-token');
    mockGetProjectId.mockReturnValue('test-project');
    delete process.env.FIREBASE_STORAGE_BUCKET;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('uploadFileResumable', () => {
    it('should initiate upload and upload small file in one chunk', async () => {
      const sessionUri = 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadId=123';
      
      // Mock initiation response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['Location', sessionUri]]),
      });
      
      // Mock chunk upload response (complete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          name: 'test.txt',
          bucket: 'test-bucket',
          size: '11',
          contentType: 'text/plain',
        }),
      });

      const data = new TextEncoder().encode('Hello World');
      const result = await uploadFileResumable(
        'test.txt',
        data.buffer,
        'text/plain'
      );

      expect(result.name).toBe('test.txt');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should upload large file in multiple chunks', async () => {
      const sessionUri = 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadId=123';
      const chunkSize = 10; // Small chunk for testing
      const data = new Uint8Array(25); // 25 bytes = 3 chunks
      
      // Mock initiation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['Location', sessionUri]]),
      });
      
      // Mock first chunk (incomplete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 308,
      });
      
      // Mock second chunk (incomplete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 308,
      });
      
      // Mock third chunk (complete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          name: 'large.bin',
          bucket: 'test-bucket',
          size: '25',
          contentType: 'application/octet-stream',
        }),
      });

      const result = await uploadFileResumable(
        'large.bin',
        data,
        'application/octet-stream',
        { chunkSize }
      );

      expect(result.name).toBe('large.bin');
      expect(global.fetch).toHaveBeenCalledTimes(4); // 1 init + 3 chunks
    });

    it('should call progress callback', async () => {
      const sessionUri = 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadId=123';
      const onProgress = jest.fn();
      const data = new Uint8Array(20);
      
      // Mock initiation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['Location', sessionUri]]),
      });
      
      // Mock first chunk (incomplete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 308,
      });
      
      // Mock second chunk (complete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          name: 'test.bin',
          size: '20',
        }),
      });

      await uploadFileResumable(
        'test.bin',
        data,
        'application/octet-stream',
        { chunkSize: 10, onProgress }
      );

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(10, 20);
      expect(onProgress).toHaveBeenCalledWith(20, 20);
    });

    it('should resume from previous session', async () => {
      const sessionUri = 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadId=123';
      const data = new Uint8Array(30);
      
      // Mock progress check (10 bytes already uploaded)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 308,
        headers: new Map([['Range', 'bytes=0-9']]),
      });
      
      // Mock remaining chunks
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 308,
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          name: 'resumed.bin',
          size: '30',
        }),
      });

      const onProgress = jest.fn();
      await uploadFileResumable(
        'resumed.bin',
        data,
        'application/octet-stream',
        { chunkSize: 10, resumeToken: sessionUri, onProgress }
      );

      // Should start from byte 10
      expect(onProgress).toHaveBeenCalledWith(10, 30); // Resume position
      expect(onProgress).toHaveBeenCalledWith(20, 30); // After chunk 2
      expect(onProgress).toHaveBeenCalledWith(30, 30); // Complete
    });

    it('should handle Blob data', async () => {
      const sessionUri = 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadId=123';
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['Location', sessionUri]]),
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          name: 'blob.txt',
          size: '5',
        }),
      });

      const blob = new Blob(['Hello'], { type: 'text/plain' });
      const result = await uploadFileResumable(
        'blob.txt',
        blob,
        'text/plain'
      );

      expect(result.name).toBe('blob.txt');
    });

    it('should include metadata in initiation', async () => {
      const sessionUri = 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadId=123';
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['Location', sessionUri]]),
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({ name: 'test.txt', size: '5' }),
      });

      const data = new Uint8Array(5);
      await uploadFileResumable(
        'test.txt',
        data,
        'text/plain',
        { metadata: { userId: '123', category: 'documents' } }
      );

      const initiationCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(initiationCall[1].body);
      expect(body.metadata).toEqual({ userId: '123', category: 'documents' });
    });

    it('should throw error if initiation fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Permission denied',
      });

      const data = new Uint8Array(10);
      await expect(
        uploadFileResumable('test.txt', data, 'text/plain')
      ).rejects.toThrow('Failed to initiate resumable upload');
    });

    it('should throw error if no session URI returned', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      const data = new Uint8Array(10);
      await expect(
        uploadFileResumable('test.txt', data, 'text/plain')
      ).rejects.toThrow('No session URI returned');
    });

    it('should throw error if chunk upload fails', async () => {
      const sessionUri = 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadId=123';
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['Location', sessionUri]]),
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 500,
        text: async () => 'Server error',
      });

      const data = new Uint8Array(10);
      await expect(
        uploadFileResumable('test.txt', data, 'text/plain')
      ).rejects.toThrow('Chunk upload failed');
    });

    it('should handle custom chunk size', async () => {
      const sessionUri = 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadId=123';
      const customChunkSize = 512 * 1024; // 512KB
      const data = new Uint8Array(100);
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['Location', sessionUri]]),
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({ name: 'test.bin', size: '100' }),
      });

      await uploadFileResumable(
        'test.bin',
        data,
        'application/octet-stream',
        { chunkSize: customChunkSize }
      );

      // Should upload in single chunk since data < chunkSize
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle Content-Range headers correctly', async () => {
      const sessionUri = 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadId=123';
      const data = new Uint8Array(20);
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['Location', sessionUri]]),
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 308,
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({ name: 'test.bin', size: '20' }),
      });

      await uploadFileResumable(
        'test.bin',
        data,
        'application/octet-stream',
        { chunkSize: 10 }
      );

      const chunkCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(chunkCall[1].headers['Content-Range']).toBe('bytes 0-9/20');
      
      const chunkCall2 = (global.fetch as jest.Mock).mock.calls[2];
      expect(chunkCall2[1].headers['Content-Range']).toBe('bytes 10-19/20');
    });
  });

  describe('ReadableStream Support', () => {
    it('should upload from ReadableStream', async () => {
      const sessionUri = 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadId=123';
      
      // Create a ReadableStream
      const data = new Uint8Array(20);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

      // Mock initiation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['Location', sessionUri]]),
      });
      
      // Mock chunk upload (complete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          name: 'stream.bin',
          size: '20',
        }),
      });

      const result = await uploadFileResumable(
        'stream.bin',
        stream,
        'application/octet-stream',
        { totalSize: 20, chunkSize: 262144 }
      );

      expect(result.name).toBe('stream.bin');
    });

    it('should upload large stream in multiple chunks', async () => {
      const sessionUri = 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadId=123';
      const chunkSize = 262144; // 256KB
      const totalSize = chunkSize * 2; // Exactly 2 chunks for simpler test
      
      // Create a ReadableStream that emits exactly 2 chunks
      const stream = new ReadableStream({
        start(controller) {
          // Emit first chunk
          controller.enqueue(new Uint8Array(chunkSize));
          // Emit second chunk
          controller.enqueue(new Uint8Array(chunkSize));
          controller.close();
        },
      });

      // Mock initiation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['Location', sessionUri]]),
      });
      
      // Mock first chunk (incomplete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 308,
      });
      
      // Mock second chunk (complete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          name: 'large-stream.bin',
          size: totalSize.toString(),
        }),
      });

      const result = await uploadFileResumable(
        'large-stream.bin',
        stream,
        'application/octet-stream',
        { totalSize, chunkSize }
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('large-stream.bin');
      expect(global.fetch).toHaveBeenCalledTimes(3); // 1 init + 2 chunks
    });

    it('should call progress callback for stream uploads', async () => {
      const sessionUri = 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadId=123';
      const totalSize = 20;
      const onProgress = jest.fn();
      
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(20));
          controller.close();
        },
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['Location', sessionUri]]),
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({ name: 'stream.bin', size: '20' }),
      });

      await uploadFileResumable(
        'stream.bin',
        stream,
        'application/octet-stream',
        { totalSize, chunkSize: 262144, onProgress }
      );

      expect(onProgress).toHaveBeenCalledWith(20, 20);
    });

    it('should throw error if totalSize not provided for stream', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(10));
          controller.close();
        },
      });

      await expect(
        uploadFileResumable(
          'stream.bin',
          stream,
          'application/octet-stream'
        )
      ).rejects.toThrow('totalSize is required when uploading from ReadableStream');
    });

    it('should handle stream errors gracefully', async () => {
      const sessionUri = 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadId=123';
      
      const stream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Stream error'));
        },
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['Location', sessionUri]]),
      });

      await expect(
        uploadFileResumable(
          'stream.bin',
          stream,
          'application/octet-stream',
          { totalSize: 100 }
        )
      ).rejects.toThrow('Stream error');
    });
  });
});









/**
 * Testing resumable uploads on the emulator
 */
const mockGetStorageEmulatorHost = config.getStorageEmulatorHost as jest.MockedFunction<typeof config.getStorageEmulatorHost>;
describe('Emulated Resumable Uploads', () => {
  const EMU_HOST = '127.0.0.1:9199';
  const TEST_PROJECT_ID = 'test-project';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminAccessToken.mockResolvedValue('mock-access-token');
    mockGetProjectId.mockReturnValue(TEST_PROJECT_ID);
    mockGetStorageEmulatorHost.mockReturnValue(EMU_HOST);
    delete process.env.FIREBASE_STORAGE_BUCKET;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('uploadFileResumable', () => {
    it('should initiate upload and upload small file in one chunk', async () => {
      const sessionUri = `http://${EMU_HOST}/upload/storage/v1/b/bucket/o?uploadId=123`;

      // Mock initiation response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([ [ 'Location', sessionUri ] ]),
      });

      // Mock chunk upload response (complete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          name: 'test.txt',
          bucket: 'test-bucket',
          size: '11',
          contentType: 'text/plain',
        }),
      });

      const data = new TextEncoder().encode('Hello World');
      const result = await uploadFileResumable(
        'test.txt',
        data.buffer,
        'text/plain'
      );

      expect(result.name).toBe('test.txt');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should upload large file in multiple chunks', async () => {
      const sessionUri = `http://${EMU_HOST}/upload/storage/v1/b/bucket/o?uploadId=123`;
      const chunkSize = 10; // Small chunk for testing
      const data = new Uint8Array(25); // 25 bytes = 3 chunks

      // Mock initiation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([ [ 'Location', sessionUri ] ]),
      });

      // Mock first chunk (incomplete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 308,
      });

      // Mock second chunk (incomplete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 308,
      });

      // Mock third chunk (complete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          name: 'large.bin',
          bucket: 'test-bucket',
          size: '25',
          contentType: 'application/octet-stream',
        }),
      });

      const result = await uploadFileResumable(
        'large.bin',
        data,
        'application/octet-stream',
        { chunkSize }
      );

      expect(result.name).toBe('large.bin');
      expect(global.fetch).toHaveBeenCalledTimes(4); // 1 init + 3 chunks
    });

    it('should call progress callback', async () => {
      const sessionUri = `http://${EMU_HOST}/upload/storage/v1/b/bucket/o?uploadId=123`;
      const onProgress = jest.fn();
      const data = new Uint8Array(20);

      // Mock initiation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([ [ 'Location', sessionUri ] ]),
      });

      // Mock first chunk (incomplete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 308,
      });

      // Mock second chunk (complete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          name: 'test.bin',
          size: '20',
        }),
      });

      await uploadFileResumable(
        'test.bin',
        data,
        'application/octet-stream',
        { chunkSize: 10, onProgress }
      );

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(10, 20);
      expect(onProgress).toHaveBeenCalledWith(20, 20);
    });

    it('should resume from previous session', async () => {
      const sessionUri = `http://${EMU_HOST}/upload/storage/v1/b/bucket/o?uploadId=123`;
      const data = new Uint8Array(30);

      // Mock progress check (10 bytes already uploaded)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 308,
        headers: new Map([ [ 'Range', 'bytes=0-9' ] ]),
      });

      // Mock remaining chunks
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 308,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          name: 'resumed.bin',
          size: '30',
        }),
      });

      const onProgress = jest.fn();
      await uploadFileResumable(
        'resumed.bin',
        data,
        'application/octet-stream',
        { chunkSize: 10, resumeToken: sessionUri, onProgress }
      );

      // Should start from byte 10
      expect(onProgress).toHaveBeenCalledWith(10, 30); // Resume position
      expect(onProgress).toHaveBeenCalledWith(20, 30); // After chunk 2
      expect(onProgress).toHaveBeenCalledWith(30, 30); // Complete
    });

    it('should handle Blob data', async () => {
      const sessionUri = `http://${EMU_HOST}/upload/storage/v1/b/bucket/o?uploadId=123`;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([ [ 'Location', sessionUri ] ]),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          name: 'blob.txt',
          size: '5',
        }),
      });

      const blob = new Blob([ 'Hello' ], { type: 'text/plain' });
      const result = await uploadFileResumable(
        'blob.txt',
        blob,
        'text/plain'
      );

      expect(result.name).toBe('blob.txt');
    });

    it('should include metadata in initiation', async () => {
      const sessionUri = `http://${EMU_HOST}/upload/storage/v1/b/bucket/o?uploadId=123`;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([ [ 'Location', sessionUri ] ]),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({ name: 'test.txt', size: '5' }),
      });

      const data = new Uint8Array(5);
      await uploadFileResumable(
        'test.txt',
        data,
        'text/plain',
        { metadata: { userId: '123', category: 'documents' } }
      );

      const initiationCall = (global.fetch as jest.Mock).mock.calls[ 0 ];
      const body = JSON.parse(initiationCall[ 1 ].body);
      expect(body.metadata).toEqual({ userId: '123', category: 'documents' });
    });

    it('should throw error if initiation fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Permission denied',
      });

      const data = new Uint8Array(10);
      await expect(
        uploadFileResumable('test.txt', data, 'text/plain')
      ).rejects.toThrow('Failed to initiate resumable upload');
    });

    it('should throw error if no session URI returned', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      const data = new Uint8Array(10);
      await expect(
        uploadFileResumable('test.txt', data, 'text/plain')
      ).rejects.toThrow('No session URI returned');
    });

    it('should throw error if chunk upload fails', async () => {
      const sessionUri = `http://${EMU_HOST}/upload/storage/v1/b/bucket/o?uploadId=123`;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([ [ 'Location', sessionUri ] ]),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 500,
        text: async () => 'Server error',
      });

      const data = new Uint8Array(10);
      await expect(
        uploadFileResumable('test.txt', data, 'text/plain')
      ).rejects.toThrow('Chunk upload failed');
    });

    it('should handle custom chunk size', async () => {
      const sessionUri = `http://${EMU_HOST}/upload/storage/v1/b/bucket/o?uploadId=123`;
      const customChunkSize = 512 * 1024; // 512KB
      const data = new Uint8Array(100);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([ [ 'Location', sessionUri ] ]),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({ name: 'test.bin', size: '100' }),
      });

      await uploadFileResumable(
        'test.bin',
        data,
        'application/octet-stream',
        { chunkSize: customChunkSize }
      );

      // Should upload in single chunk since data < chunkSize
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle Content-Range headers correctly', async () => {
      const sessionUri = `http://${EMU_HOST}/upload/storage/v1/b/bucket/o?uploadId=123`;
      const data = new Uint8Array(20);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([ [ 'Location', sessionUri ] ]),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 308,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({ name: 'test.bin', size: '20' }),
      });

      await uploadFileResumable(
        'test.bin',
        data,
        'application/octet-stream',
        { chunkSize: 10 }
      );

      const chunkCall = (global.fetch as jest.Mock).mock.calls[ 1 ];
      expect(chunkCall[ 1 ].headers[ 'Content-Range' ]).toBe('bytes 0-9/20');

      const chunkCall2 = (global.fetch as jest.Mock).mock.calls[ 2 ];
      expect(chunkCall2[ 1 ].headers[ 'Content-Range' ]).toBe('bytes 10-19/20');
    });
  });

  describe('ReadableStream Support', () => {
    it('should upload from ReadableStream', async () => {
      const sessionUri = `http://${EMU_HOST}/upload/storage/v1/b/bucket/o?uploadId=123`;

      // Create a ReadableStream
      const data = new Uint8Array(20);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

      // Mock initiation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([ [ 'Location', sessionUri ] ]),
      });

      // Mock chunk upload (complete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          name: 'stream.bin',
          size: '20',
        }),
      });

      const result = await uploadFileResumable(
        'stream.bin',
        stream,
        'application/octet-stream',
        { totalSize: 20, chunkSize: 262144 }
      );

      expect(result.name).toBe('stream.bin');
    });

    it('should upload large stream in multiple chunks', async () => {
      const sessionUri = `http://${EMU_HOST}/upload/storage/v1/b/bucket/o?uploadId=123`;
      const chunkSize = 262144; // 256KB
      const totalSize = chunkSize * 2; // Exactly 2 chunks for simpler test

      // Create a ReadableStream that emits exactly 2 chunks
      const stream = new ReadableStream({
        start(controller) {
          // Emit first chunk
          controller.enqueue(new Uint8Array(chunkSize));
          // Emit second chunk
          controller.enqueue(new Uint8Array(chunkSize));
          controller.close();
        },
      });

      // Mock initiation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([ [ 'Location', sessionUri ] ]),
      });

      // Mock first chunk (incomplete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 308,
      });

      // Mock second chunk (complete)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          name: 'large-stream.bin',
          size: totalSize.toString(),
        }),
      });

      const result = await uploadFileResumable(
        'large-stream.bin',
        stream,
        'application/octet-stream',
        { totalSize, chunkSize }
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('large-stream.bin');
      expect(global.fetch).toHaveBeenCalledTimes(3); // 1 init + 2 chunks
    });

    it('should call progress callback for stream uploads', async () => {
      const sessionUri = `http://${EMU_HOST}/upload/storage/v1/b/bucket/o?uploadId=123`;
      const totalSize = 20;
      const onProgress = jest.fn();

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(20));
          controller.close();
        },
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([ [ 'Location', sessionUri ] ]),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({ name: 'stream.bin', size: '20' }),
      });

      await uploadFileResumable(
        'stream.bin',
        stream,
        'application/octet-stream',
        { totalSize, chunkSize: 262144, onProgress }
      );

      expect(onProgress).toHaveBeenCalledWith(20, 20);
    });

    it('should throw error if totalSize not provided for stream', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(10));
          controller.close();
        },
      });

      await expect(
        uploadFileResumable(
          'stream.bin',
          stream,
          'application/octet-stream'
        )
      ).rejects.toThrow('totalSize is required when uploading from ReadableStream');
    });

    it('should handle stream errors gracefully', async () => {
      const sessionUri = 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadId=123';

      const stream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Stream error'));
        },
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([ [ 'Location', sessionUri ] ]),
      });

      await expect(
        uploadFileResumable(
          'stream.bin',
          stream,
          'application/octet-stream',
          { totalSize: 100 }
        )
      ).rejects.toThrow('Stream error');
    });
  });
});
