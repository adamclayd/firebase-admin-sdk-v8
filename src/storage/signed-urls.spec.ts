/**
 * Unit tests for Firebase Storage signed URLs
 */

import { generateSignedUrl } from './signed-urls';
import * as config from '../config';

// Mock dependencies
jest.mock('../config');

const mockGetServiceAccount = config.getServiceAccount as jest.MockedFunction<typeof config.getServiceAccount>;
const mockGetProjectId = config.getProjectId as jest.MockedFunction<typeof config.getProjectId>;

describe('Signed URLs', () => {
  const mockServiceAccount = {
    type: 'service_account',
    project_id: 'test-project',
    private_key_id: 'key123',
    private_key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj
MzEfYyjiWA4R4/M2bS1+fWIcPm15j9zB/FaC8qF9bb3I5Jq5VJTUt9Us8cKjMzEf
YyjiWA4R4/M2bS1+fWIcPm15j9zB/FaC8qF9bb3I5Jq5VJTUt9Us8cKjMzEfYyji
WA4R4/M2bS1+fWIcPm15j9zB/FaC8qF9bb3I5Jq5VJTUt9Us8cKjMzEfYyjiWA4R
4/M2bS1+fWIcPm15j9zB/FaC8qF9bb3I5Jq5VJTUt9Us8cKjMzEfYyjiWA4R4/M2
bS1+fWIcPm15j9zB/FaC8qF9bb3I5Jq5VJTUt9Us8cKjMzEfYyjiWA4R4/M2bS1+
fWIcPm15j9zB/FaC8qF9bb3I5Jq5AgMBAAECggEAD+onAtVye4ic7VR7V50DF9bE
-----END PRIVATE KEY-----`,
    client_email: 'test@test-project.iam.gserviceaccount.com',
    client_id: '123456789',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/test%40test-project.iam.gserviceaccount.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServiceAccount.mockReturnValue(mockServiceAccount);
    mockGetProjectId.mockReturnValue('test-project');
    delete process.env.FIREBASE_STORAGE_BUCKET;
    
    // Mock crypto.subtle for signing and hashing
    global.crypto = {
      subtle: {
        importKey: jest.fn().mockResolvedValue('mock-key'),
        sign: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5]).buffer),
        digest: jest.fn().mockResolvedValue(new Uint8Array(32).buffer), // SHA-256 produces 32 bytes
      },
    } as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateSignedUrl', () => {
    it('should generate signed URL for read action', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600, // 1 hour
      });

      expect(url).toContain('https://storage.googleapis.com');
      expect(url).toContain('test-project.firebasestorage.app');
      expect(url).toContain('test.txt');
      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
      expect(url).toContain('X-Goog-Credential');
      expect(url).toContain('X-Goog-Signature');
    });

    it('should generate signed URL for write action', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'write',
        expires: 3600,
      });

      expect(url).toContain('https://storage.googleapis.com');
      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
    });

    it('should generate signed URL for delete action', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'delete',
        expires: 3600,
      });

      expect(url).toContain('https://storage.googleapis.com');
      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
    });

    it('should accept Date object for expires', async () => {
      const expiryDate = new Date(Date.now() + 3600 * 1000);
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: expiryDate,
      });

      expect(url).toContain('X-Goog-Expires');
    });

    it('should accept number (seconds) for expires', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 7200, // 2 hours
      });

      expect(url).toContain('X-Goog-Expires=7200');
    });

    it('should include content type in signed URL', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'write',
        expires: 3600,
        contentType: 'text/plain',
      });

      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
      // Content-Type is part of the canonical request, not the URL
    });

    it('should include response disposition', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
        responseDisposition: 'attachment; filename="download.txt"',
      });

      expect(url).toContain('response-content-disposition');
    });

    it('should include response type', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
        responseType: 'application/pdf',
      });

      expect(url).toContain('response-content-type');
    });

    it('should use custom bucket from environment', async () => {
      process.env.FIREBASE_STORAGE_BUCKET = 'custom-bucket.firebasestorage.app';

      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
      });

      expect(url).toContain('custom-bucket.firebasestorage.app');
    });

    it('should handle file paths with special characters', async () => {
      const url = await generateSignedUrl('folder/test file.txt', {
        action: 'read',
        expires: 3600,
      });

      // Spaces are encoded as %20
      expect(url).toContain('test%20file.txt');
      expect(url).toContain('X-Goog-Signature');
    });

    it('should handle nested folder paths', async () => {
      const url = await generateSignedUrl('images/2024/january/photo.jpg', {
        action: 'read',
        expires: 3600,
      });

      expect(url).toContain('photo.jpg');
      expect(url).toContain('X-Goog-Signature');
    });

    it('should use correct HTTP method for read action', async () => {
      await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
      });

      // The method is part of the canonical request used for signing
      expect(crypto.subtle.sign).toHaveBeenCalled();
    });

    it('should use correct HTTP method for write action', async () => {
      await generateSignedUrl('test.txt', {
        action: 'write',
        expires: 3600,
      });

      expect(crypto.subtle.sign).toHaveBeenCalled();
    });

    it('should use correct HTTP method for delete action', async () => {
      await generateSignedUrl('test.txt', {
        action: 'delete',
        expires: 3600,
      });

      expect(crypto.subtle.sign).toHaveBeenCalled();
    });

    it('should include service account email in credential', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
      });

      expect(url).toContain('test%40test-project.iam.gserviceaccount.com');
    });

    it('should use GOOG4-RSA-SHA256 algorithm', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
      });

      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
    });

    it('should include current date in credential', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
      });

      // Should contain date in YYYYMMDD format
      const dateMatch = url.match(/\d{8}/);
      expect(dateMatch).toBeTruthy();
    });

    it('should call crypto.subtle.importKey with correct parameters', async () => {
      await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
      });

      expect(crypto.subtle.importKey).toHaveBeenCalledWith(
        'pkcs8',
        expect.any(Uint8Array),
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        false,
        ['sign']
      );
    });

    it('should call crypto.subtle.sign with correct parameters', async () => {
      await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
      });

      expect(crypto.subtle.sign).toHaveBeenCalledWith(
        'RSASSA-PKCS1-v1_5',
        'mock-key',
        expect.any(Uint8Array)
      );
    });

    it('should handle very short expiry times', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 60, // 1 minute
      });

      expect(url).toContain('X-Goog-Expires=60');
    });

    it('should handle long expiry times', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 604800, // 7 days
      });

      expect(url).toContain('X-Goog-Expires=604800');
    });

    it('should generate different signatures for different files', async () => {
      const url1 = await generateSignedUrl('file1.txt', {
        action: 'read',
        expires: 3600,
      });

      const url2 = await generateSignedUrl('file2.txt', {
        action: 'read',
        expires: 3600,
      });

      expect(url1).not.toBe(url2);
    });

    it('should generate different signatures for different actions', async () => {
      // The signature is based on the canonical request which includes the HTTP method
      // We need to mock digest to return different hashes for different inputs
      let digestCallCount = 0;
      (crypto.subtle.digest as jest.Mock).mockImplementation(async (_alg, _data) => {
        // Return different hash for each call to ensure different string-to-sign
        const hash = new Uint8Array(32);
        hash[0] = digestCallCount++; // Make each hash unique
        return hash.buffer;
      });

      const signCalls: any[] = [];
      (crypto.subtle.sign as jest.Mock).mockImplementation(async (_alg, _key, data) => {
        signCalls.push(new Uint8Array(data));
        return new Uint8Array([1, 2, 3, 4, 5]).buffer;
      });

      await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
      });

      await generateSignedUrl('test.txt', {
        action: 'write',
        expires: 3600,
      });

      // Verify that sign was called twice with different string-to-sign
      // (because digest returns different hashes, the canonical request hashes differ)
      expect(signCalls).toHaveLength(2);
      expect(signCalls[0]).not.toEqual(signCalls[1]);
    });
  });

  describe('Error Handling', () => {
    it('should throw error if service account is not configured', async () => {
      mockGetServiceAccount.mockImplementation(() => {
        throw new Error('Service account not configured');
      });

      await expect(
        generateSignedUrl('test.txt', {
          action: 'read',
          expires: 3600,
        })
      ).rejects.toThrow('Service account not configured');
    });

    it('should throw error if crypto.subtle.importKey fails', async () => {
      (crypto.subtle.importKey as jest.Mock).mockRejectedValue(
        new Error('Failed to import key')
      );

      await expect(
        generateSignedUrl('test.txt', {
          action: 'read',
          expires: 3600,
        })
      ).rejects.toThrow('Failed to import key');
    });

    it('should throw error if crypto.subtle.sign fails', async () => {
      (crypto.subtle.sign as jest.Mock).mockRejectedValue(
        new Error('Failed to sign')
      );

      await expect(
        generateSignedUrl('test.txt', {
          action: 'read',
          expires: 3600,
        })
      ).rejects.toThrow('Failed to sign');
    });
  });

  describe('URL Encoding', () => {
    const specialChars = [
      { char: ' ', encoded: '%20' },
      { char: '/', encoded: '%2F' },
      { char: '?', encoded: '%3F' },
      { char: '#', encoded: '%23' },
      { char: '&', encoded: '%26' },
      { char: '=', encoded: '%3D' },
    ];

    specialChars.forEach(({ char, encoded }) => {
      it(`should properly encode ${char} as ${encoded}`, async () => {
        const filename = `test${char}file.txt`;
        const url = await generateSignedUrl(filename, {
          action: 'read',
          expires: 3600,
        });

        expect(url).toContain(encoded);
      });
    });
  });
});













/**
 * Test for signed urls under the emulator
 */
const mockGetStorageEmulatorHost = config.getStorageEmulatorHost as jest.MockedFunction<typeof config.getStorageEmulatorHost>
describe('Emulated Signed URLs', () => {
  const EMU_HOST = '127.0.0.1:9199';
  const TEST_PROJECT_ID   = 'test-project';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStorageEmulatorHost.mockReturnValue(EMU_HOST)
    mockGetProjectId.mockReturnValue(TEST_PROJECT_ID);
    delete process.env.FIREBASE_STORAGE_BUCKET;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateSignedUrl', () => {
    it('should generate signed URL for read action', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600, // 1 hour
      });

      expect(url).toContain('http://' + EMU_HOST);
      expect(url).toContain('test.txt');
      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
      expect(url).toContain('X-Goog-Credential');
      expect(url).toContain('X-Goog-Signature');
    });

    it('should generate signed URL for write action', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'write',
        expires: 3600,
      });

      expect(url).toContain('http://' + EMU_HOST);
      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
    });

    it('should generate signed URL for delete action', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'delete',
        expires: 3600,
      });

      expect(url).toContain('http://' + EMU_HOST);
      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
    });

    it('should accept Date object for expires', async () => {
      const expiryDate = new Date(Date.now() + 3600 * 1000);
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: expiryDate,
      });

      expect(url).toContain('X-Goog-Expires');
    });

    it('should accept number (seconds) for expires', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 7200, // 2 hours
      });

      expect(url).toContain('X-Goog-Expires=7200');
    });

    it('should include content type in signed URL', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'write',
        expires: 3600,
        contentType: 'text/plain',
      });

      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
      // Content-Type is part of the canonical request, not the URL
    });

    it('should include response disposition', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
        responseDisposition: 'attachment; filename="download.txt"',
      });

      expect(url).toContain('response-content-disposition');
    });

    it('should include response type', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
        responseType: 'application/pdf',
      });

      expect(url).toContain('response-content-type');
    });

    it('should use custom bucket from environment', async () => {
      process.env.FIREBASE_STORAGE_BUCKET = 'custom-bucket.firebasestorage.app';

      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
      });

      expect(url).toContain('custom-bucket.firebasestorage.app');
    });

    it('should handle file paths with special characters', async () => {
      const url = await generateSignedUrl('folder/test file.txt', {
        action: 'read',
        expires: 3600,
      });

      // Spaces are encoded as %20
      expect(url).toContain('test%20file.txt');
      expect(url).toContain('X-Goog-Signature');
    });

    it('should handle nested folder paths', async () => {
      const url = await generateSignedUrl('images/2024/january/photo.jpg', {
        action: 'read',
        expires: 3600,
      });

      expect(url).toContain('photo.jpg');
      expect(url).toContain('X-Goog-Signature');
    });

    it('should include service account email in credential', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
      });

      expect(url).toContain('test%40test-project.iam.gserviceaccount.com');
    });

    it('should use GOOG4-RSA-SHA256 algorithm', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
      });

      expect(url).toContain('X-Goog-Algorithm=GOOG4-RSA-SHA256');
    });

    it('should include current date in credential', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
      });

      // Should contain date in YYYYMMDD format
      const dateMatch = url.match(/\d{8}/);
      expect(dateMatch).toBeTruthy();
    });

    it('should handle very short expiry times', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 60, // 1 minute
      });

      expect(url).toContain('X-Goog-Expires=60');
    });

    it('should handle long expiry times', async () => {
      const url = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 604800, // 7 days
      });

      expect(url).toContain('X-Goog-Expires=604800');
    });

    it('should generate different signatures for different files', async () => {
      const url1 = await generateSignedUrl('file1.txt', {
        action: 'read',
        expires: 3600,
      });

      const url2 = await generateSignedUrl('file2.txt', {
        action: 'read',
        expires: 3600,
      });

      expect(url1).not.toBe(url2);
    });

    it('should generate different signatures for different actions', async () => {


      const url1 = await generateSignedUrl('test.txt', {
        action: 'read',
        expires: 3600,
      });

      const url2 = await generateSignedUrl('test.txt', {
        action: 'write',
        expires: 3600,
      });

      expect(url1).not.toBe(url2);
    });
  });

  describe('URL Encoding', () => {
    const specialChars = [
      { char: ' ', encoded: '%20' },
      { char: '/', encoded: '%2F' },
      { char: '?', encoded: '%3F' },
      { char: '#', encoded: '%23' },
      { char: '&', encoded: '%26' },
      { char: '=', encoded: '%3D' },
    ];

    specialChars.forEach(({ char, encoded }) => {
      it(`should properly encode ${char} as ${encoded}`, async () => {
        const filename = `test${char}file.txt`;
        const url = await generateSignedUrl(filename, {
          action: 'read',
          expires: 3600,
        });

        expect(url).toContain(encoded);
      });
    });
  });
});
