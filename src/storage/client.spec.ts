/**
 * Unit tests for Firebase Storage client
 */

import {
  uploadFile,
  downloadFile,
  deleteFile,
  getFileMetadata,
  listFiles,
  fileExists,
} from './client';
import * as tokenGeneration from '../token-generation';
import * as config from '../config';

// Mock dependencies
jest.mock('../token-generation');
jest.mock('../config');

const mockGetAdminAccessToken = tokenGeneration.getAdminAccessToken as jest.MockedFunction<typeof tokenGeneration.getAdminAccessToken>;
const mockGetProjectId = config.getProjectId as jest.MockedFunction<typeof config.getProjectId>;

describe('Storage Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminAccessToken.mockResolvedValue('mock-access-token');
    mockGetProjectId.mockReturnValue('test-project');
    delete process.env.FIREBASE_STORAGE_BUCKET;
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    
    // Mock global fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload a file with ArrayBuffer', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          name: 'test.txt',
          bucket: 'test-project.firebasestorage.app',
          size: '11',
          contentType: 'text/plain',
          timeCreated: '2024-01-01T00:00:00Z',
          updated: '2024-01-01T00:00:00Z',
          md5Hash: 'abc123',
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const data = new TextEncoder().encode('Hello World');
      const result = await uploadFile('test.txt', data.buffer, {
        contentType: 'text/plain',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://storage.googleapis.com/upload/storage/v1/b/test-project.firebasestorage.app/o'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-access-token',
            'Content-Type': 'text/plain',
          }),
          body: data.buffer,
        })
      );
      expect(result.name).toBe('test.txt');
    });

    it('should upload a file with Uint8Array', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          name: 'test.txt',
          bucket: 'test-project.firebasestorage.app',
          size: '11',
          contentType: 'text/plain',
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const data = new TextEncoder().encode('Hello World');
      await uploadFile('test.txt', data);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should upload a file with Blob', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          name: 'test.txt',
          bucket: 'test-project.firebasestorage.app',
          size: '11',
          contentType: 'text/plain',
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const blob = new Blob(['Hello World'], { type: 'text/plain' });
      await uploadFile('test.txt', blob);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should detect content type from filename', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ name: 'test.png' }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const data = new Uint8Array([1, 2, 3]);
      await uploadFile('test.png', data);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'image/png',
          }),
        })
      );
    });

    it('should use custom bucket from environment', async () => {
      process.env.FIREBASE_STORAGE_BUCKET = 'custom-bucket.firebasestorage.app';
      
      const mockResponse = {
        ok: true,
        json: async () => ({ name: 'test.txt' }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const data = new Uint8Array([1, 2, 3]);
      await uploadFile('test.txt', data);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('custom-bucket.firebasestorage.app'),
        expect.any(Object)
      );
    });

    it('should throw error on upload failure', async () => {
      const mockResponse = {
        ok: false,
        text: async () => 'Upload failed',
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const data = new Uint8Array([1, 2, 3]);
      await expect(uploadFile('test.txt', data)).rejects.toThrow('Failed to upload file');
    });

    it('should include metadata in upload', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ name: 'test.txt' }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const data = new Uint8Array([1, 2, 3]);
      await uploadFile('test.txt', data, {
        metadata: { userId: '123', category: 'documents' },
      });

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('downloadFile', () => {
    it('should download a file', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockData.buffer,
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await downloadFile('test.txt');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://storage.googleapis.com/storage/v1/b/test-project.firebasestorage.app/o/test.txt?alt=media'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-access-token',
          }),
        })
      );
      expect(result).toEqual(mockData.buffer);
    });

    it('should throw error on download failure', async () => {
      const mockResponse = {
        ok: false,
        text: async () => 'File not found',
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(downloadFile('test.txt')).rejects.toThrow('Failed to download file');
    });

    it('should handle URL encoding for file paths', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(0),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await downloadFile('folder/test file.txt');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('folder%2Ftest%20file.txt'),
        expect.any(Object)
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      const mockResponse = {
        ok: true,
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await deleteFile('test.txt');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://storage.googleapis.com/storage/v1/b/test-project.firebasestorage.app/o/test.txt'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-access-token',
          }),
        })
      );
    });

    it('should throw error on delete failure', async () => {
      const mockResponse = {
        ok: false,
        text: async () => 'Delete failed',
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(deleteFile('test.txt')).rejects.toThrow('Failed to delete file');
    });
  });

  describe('getFileMetadata', () => {
    it('should get file metadata', async () => {
      const mockMetadata = {
        name: 'test.txt',
        bucket: 'test-project.firebasestorage.app',
        size: '1024',
        contentType: 'text/plain',
        timeCreated: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        md5Hash: 'abc123',
      };
      const mockResponse = {
        ok: true,
        json: async () => mockMetadata,
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getFileMetadata('test.txt');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://storage.googleapis.com/storage/v1/b/test-project.firebasestorage.app/o/test.txt'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-access-token',
          }),
        })
      );
      expect(result).toEqual(mockMetadata);
    });

    it('should throw error on metadata fetch failure', async () => {
      const mockResponse = {
        ok: false,
        text: async () => 'Not found',
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(getFileMetadata('test.txt')).rejects.toThrow('Failed to get file metadata');
    });
  });

  describe('listFiles', () => {
    it('should list files in bucket', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          items: [
            { name: 'file1.txt', size: '100' },
            { name: 'file2.txt', size: '200' },
          ],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await listFiles();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://storage.googleapis.com/storage/v1/b/test-project.firebasestorage.app/o'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-access-token',
          }),
        })
      );
      expect(result.files).toHaveLength(2);
      expect(result.files[0].name).toBe('file1.txt');
    });

    it('should list files with prefix filter', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          items: [{ name: 'images/photo.jpg' }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await listFiles({ prefix: 'images/' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('prefix=images%2F'),
        expect.any(Object)
      );
    });

    it('should list files with pagination', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          items: [{ name: 'file1.txt' }],
          nextPageToken: 'token123',
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await listFiles({ maxResults: 10 });

      expect(result.nextPageToken).toBe('token123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('maxResults=10'),
        expect.any(Object)
      );
    });

    it('should handle empty list', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({}),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await listFiles();

      expect(result.files).toEqual([]);
      expect(result.nextPageToken).toBeUndefined();
    });

    it('should throw error on list failure', async () => {
      const mockResponse = {
        ok: false,
        text: async () => 'List failed',
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(listFiles()).rejects.toThrow('Failed to list files');
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ name: 'test.txt' }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await fileExists('test.txt');

      expect(result).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: async () => 'Not found',
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await fileExists('test.txt');

      expect(result).toBe(false);
    });

    it('should throw error on other failures', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: async () => 'Server error',
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(fileExists('test.txt')).rejects.toThrow('Failed to get file metadata');
    });
  });

  describe('Content Type Detection', () => {
    const testCases = [
      { filename: 'test.txt', expected: 'text/plain' },
      { filename: 'test.html', expected: 'text/html' },
      { filename: 'test.json', expected: 'application/json' },
      { filename: 'test.jpg', expected: 'image/jpeg' },
      { filename: 'test.png', expected: 'image/png' },
      { filename: 'test.pdf', expected: 'application/pdf' },
      { filename: 'test.mp4', expected: 'video/mp4' },
      { filename: 'test.unknown', expected: 'application/octet-stream' },
      { filename: 'noextension', expected: 'application/octet-stream' },
    ];

    testCases.forEach(({ filename, expected }) => {
      it(`should detect ${expected} for ${filename}`, async () => {
        const mockResponse = {
          ok: true,
          json: async () => ({ name: filename }),
        };
        (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

        const data = new Uint8Array([1, 2, 3]);
        await uploadFile(filename, data);

        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': expected,
            }),
          })
        );
      });
    });
  });
});
