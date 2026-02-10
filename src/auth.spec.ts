/**
 * Unit tests for Authentication
 * Tests JWT verification with mocked crypto and fetch
 */

import { verifyIdToken, getUserFromToken, getAuth, clearPublicKeysCache } from './auth';
import * as serviceAccount from './service-account';
import * as x509 from './x509';

// Mock dependencies
jest.mock('./service-account');
jest.mock('./x509');

const mockGetProjectId = serviceAccount.getProjectId as jest.MockedFunction<typeof serviceAccount.getProjectId>;
const mockImportPublicKeyFromX509 = x509.importPublicKeyFromX509 as jest.MockedFunction<typeof x509.importPublicKeyFromX509>;

describe('Authentication', () => {
  const TEST_PROJECT_ID = 'test-project-id';
  const TEST_KID = 'test-key-id';
  
  // Mock public key
  const mockPublicKey = {} as CryptoKey;
  
  // Helper to create a mock JWT token
  function createMockToken(payload: Record<string, unknown>, header?: Record<string, unknown>): string {
    const defaultHeader = {
      alg: 'RS256',
      kid: TEST_KID,
      typ: 'JWT',
      ...header,
    };
    
    const encodedHeader = btoa(JSON.stringify(defaultHeader)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const signature = btoa('mock-signature').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }
  
  // Helper to create valid payload
  function createValidPayload(overrides?: Record<string, unknown>): Record<string, unknown> {
    const now = Math.floor(Date.now() / 1000);
    return {
      iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
      aud: TEST_PROJECT_ID,
      auth_time: now - 100,
      iat: now - 100,
      exp: now + 3600,
      sub: 'test-user-id',
      uid: 'test-user-id',
      email: 'test@example.com',
      email_verified: true,
      firebase: {
        identities: {},
        sign_in_provider: 'password',
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear the public keys cache
    clearPublicKeysCache();
    
    // Setup default mocks
    mockGetProjectId.mockReturnValue(TEST_PROJECT_ID);
    mockImportPublicKeyFromX509.mockResolvedValue(mockPublicKey);
    
    // Mock global fetch for public keys
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        [TEST_KID]: 'mock-public-key-pem',
      }),
    });
    
    // Mock crypto.subtle.verify
    global.crypto = {
      subtle: {
        verify: jest.fn().mockResolvedValue(true),
      },
    } as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('verifyIdToken', () => {
    it('should verify a valid Firebase v9 token', async () => {
      const payload = createValidPayload();
      const token = createMockToken(payload);

      const result = await verifyIdToken(token);

      expect(result.uid).toBe('test-user-id');
      expect(result.email).toBe('test@example.com');
      expect(result.aud).toBe(TEST_PROJECT_ID);
      expect(mockImportPublicKeyFromX509).toHaveBeenCalled();
    });

    it('should verify a valid Firebase v10 session token', async () => {
      const payload = createValidPayload({
        iss: `https://session.firebase.google.com/${TEST_PROJECT_ID}`,
      });
      const token = createMockToken(payload);

      const result = await verifyIdToken(token);

      expect(result.uid).toBe('test-user-id');
      expect(result.iss).toContain('session.firebase.google.com');
    });

    it('should throw error for empty token', async () => {
      await expect(verifyIdToken('')).rejects.toThrow('ID token is required');
    });

    it('should throw error for invalid JWT format', async () => {
      await expect(verifyIdToken('invalid.token')).rejects.toThrow('Invalid JWT format');
    });

    it('should throw error for invalid algorithm', async () => {
      const payload = createValidPayload();
      const token = createMockToken(payload, { alg: 'HS256' });
      
      await expect(verifyIdToken(token)).rejects.toThrow('Invalid algorithm');
    });

    it('should throw error for expired token', async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = createValidPayload({
        exp: now - 100, // Expired
      });
      const token = createMockToken(payload);
      
      await expect(verifyIdToken(token)).rejects.toThrow('Token has expired');
    });

    it('should throw error for token issued in future', async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = createValidPayload({
        iat: now + 100, // Future
      });
      const token = createMockToken(payload);
      
      await expect(verifyIdToken(token)).rejects.toThrow('Token issued in the future');
    });

    it('should throw error for auth_time in future', async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = createValidPayload({
        auth_time: now + 100, // Future
      });
      const token = createMockToken(payload);
      
      await expect(verifyIdToken(token)).rejects.toThrow('Auth time is in the future');
    });

    it('should throw error for invalid audience', async () => {
      const payload = createValidPayload({
        aud: 'wrong-project-id',
      });
      const token = createMockToken(payload);
      
      await expect(verifyIdToken(token)).rejects.toThrow('Invalid audience');
    });

    it('should throw error for invalid issuer', async () => {
      const payload = createValidPayload({
        iss: 'https://evil.com/test-project-id',
      });
      const token = createMockToken(payload);
      
      await expect(verifyIdToken(token)).rejects.toThrow('Invalid issuer');
    });

    it('should throw error for missing subject', async () => {
      const payload = createValidPayload({
        sub: '',
      });
      const token = createMockToken(payload);
      
      await expect(verifyIdToken(token)).rejects.toThrow('Invalid subject');
    });

    it('should throw error for subject too long', async () => {
      const payload = createValidPayload({
        sub: 'a'.repeat(129), // Too long
      });
      const token = createMockToken(payload);
      
      await expect(verifyIdToken(token)).rejects.toThrow('Subject too long');
    });

    it('should throw error if key not found after refresh', async () => {
      const payload = createValidPayload();
      const token = createMockToken(payload, { kid: 'nonexistent-key' });

      await expect(verifyIdToken(token)).rejects.toThrow('Public key not found');
    });

    it('should throw error if public key fetch fails', async () => {
      const payload = createValidPayload();
      const token = createMockToken(payload);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      await expect(verifyIdToken(token)).rejects.toThrow('Failed to fetch Firebase public keys');
    });

    it('should throw error for invalid signature', async () => {
      const payload = createValidPayload();
      const token = createMockToken(payload);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          [TEST_KID]: 'mock-public-key-pem',
        }),
      });

      // Mock signature verification to fail
      (global.crypto.subtle.verify as jest.Mock).mockResolvedValue(false);

      await expect(verifyIdToken(token)).rejects.toThrow('Invalid token signature');
    });

    it('should import public key from X509', async () => {
      const payload = createValidPayload();
      const token = createMockToken(payload);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          [TEST_KID]: 'mock-public-key-pem',
        }),
      });

      await verifyIdToken(token);

      expect(mockImportPublicKeyFromX509).toHaveBeenCalledWith('mock-public-key-pem');
    });

    it('should verify signature with correct parameters', async () => {
      const payload = createValidPayload();
      const token = createMockToken(payload);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          [TEST_KID]: 'mock-public-key-pem',
        }),
      });

      await verifyIdToken(token);

      expect(global.crypto.subtle.verify).toHaveBeenCalledWith(
        'RSASSA-PKCS1-v1_5',
        mockPublicKey,
        expect.any(Uint8Array),
        expect.any(Uint8Array)
      );
    });
  });

  describe('getUserFromToken', () => {
    it('should extract user info from valid token', async () => {
      const payload = createValidPayload({
        email: 'user@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
      });
      const token = createMockToken(payload);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          [TEST_KID]: 'mock-public-key-pem',
        }),
      });

      const userInfo = await getUserFromToken(token);

      expect(userInfo).toEqual({
        uid: 'test-user-id',
        email: 'user@example.com',
        emailVerified: true,
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
      });
    });

    it('should handle missing optional fields', async () => {
      const payload = createValidPayload({
        email: undefined,
        email_verified: undefined,
        name: undefined,
        picture: undefined,
      });
      const token = createMockToken(payload);

      const userInfo = await getUserFromToken(token);

      expect(userInfo).toEqual({
        uid: 'test-user-id',
        email: null,
        emailVerified: false,
        displayName: null,
        photoURL: null,
      });
    });

    it('should throw error for invalid token', async () => {
      await expect(getUserFromToken('invalid-token')).rejects.toThrow();
    });
  });

  describe('getAuth', () => {
    it('should return auth object with verifyIdToken method', () => {
      const auth = getAuth();

      expect(auth).toBeDefined();
      expect(auth.verifyIdToken).toBe(verifyIdToken);
    });
  });

  describe('JWT parsing', () => {
    it('should correctly decode base64url encoded JWT', async () => {
      const payload = createValidPayload();
      const token = createMockToken(payload);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          [TEST_KID]: 'mock-public-key-pem',
        }),
      });

      const result = await verifyIdToken(token);

      // Verify payload was correctly decoded
      expect(result.sub).toBe('test-user-id');
      expect(result.email).toBe('test@example.com');
    });

    it('should handle base64url padding correctly', async () => {
      // Create token with payload that needs padding
      const payload = createValidPayload({ test: 'a' }); // Short payload
      const token = createMockToken(payload);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          [TEST_KID]: 'mock-public-key-pem',
        }),
      });

      const result = await verifyIdToken(token);

      expect(result.uid).toBe('test-user-id');
    });
  });

  describe('Public key caching', () => {
    it('should have clearPublicKeysCache function', () => {
      expect(clearPublicKeysCache).toBeDefined();
      expect(typeof clearPublicKeysCache).toBe('function');
    });
  });
});
