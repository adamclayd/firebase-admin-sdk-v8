/**
 * Unit tests for Authentication
 * Tests JWT verification with mocked crypto and fetch
 */

import { verifyIdToken, getUserFromToken, getAuth, clearPublicKeysCache, createCustomToken } from './auth';
import * as serviceAccount from './service-account';
import * as config from './config';
import * as x509 from './x509';

// Mock dependencies
jest.mock('./service-account');
jest.mock('./config');
jest.mock('./x509');

const mockGetProjectId = serviceAccount.getProjectId as jest.MockedFunction<typeof serviceAccount.getProjectId>;
const mockGetServiceAccount = config.getServiceAccount as jest.MockedFunction<typeof config.getServiceAccount>;
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

  describe('createCustomToken', () => {
    const mockServiceAccount = {
      type: 'service_account',
      project_id: 'test-project',
      private_key_id: 'key-id',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC\n-----END PRIVATE KEY-----',
      client_email: 'test@test-project.iam.gserviceaccount.com',
      client_id: '123456789',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/test%40test-project.iam.gserviceaccount.com',
    };

    beforeEach(() => {
      mockGetServiceAccount.mockReturnValue(mockServiceAccount);
      
      // Mock crypto.subtle for signing
      global.crypto = {
        subtle: {
          importKey: jest.fn().mockResolvedValue({} as CryptoKey),
          sign: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer),
          verify: jest.fn().mockResolvedValue(true),
        },
      } as any;
    });

    it('should create a custom token with valid UID', async () => {
      const uid = 'test-user-123';
      const token = await createCustomToken(uid);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // header.payload.signature
    });

    it('should create token with custom claims', async () => {
      const uid = 'test-user-123';
      const customClaims = {
        role: 'admin',
        premium: true,
        level: 5,
      };

      const token = await createCustomToken(uid, customClaims);
      
      // Decode payload to verify claims
      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      
      expect(payload.uid).toBe(uid);
      expect(payload.claims).toEqual(customClaims);
    });

    it('should include correct JWT header', async () => {
      const token = await createCustomToken('test-user');
      
      const [headerB64] = token.split('.');
      const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
      
      expect(header.alg).toBe('RS256');
      expect(header.typ).toBe('JWT');
    });

    it('should include correct JWT claims', async () => {
      const uid = 'test-user-123';
      const token = await createCustomToken(uid);
      
      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      
      expect(payload.iss).toBe(mockServiceAccount.client_email);
      expect(payload.sub).toBe(mockServiceAccount.client_email);
      expect(payload.aud).toBe('https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit');
      expect(payload.uid).toBe(uid);
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
    });

    it('should set token expiration to 1 hour', async () => {
      const token = await createCustomToken('test-user');
      
      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      
      const expiresIn = payload.exp - payload.iat;
      expect(expiresIn).toBe(3600); // 1 hour in seconds
    });

    it('should throw error for empty UID', async () => {
      await expect(createCustomToken('')).rejects.toThrow('uid must be a non-empty string');
    });

    it('should throw error for non-string UID', async () => {
      await expect(createCustomToken(null as any)).rejects.toThrow('uid must be a non-empty string');
      await expect(createCustomToken(undefined as any)).rejects.toThrow('uid must be a non-empty string');
      await expect(createCustomToken(123 as any)).rejects.toThrow('uid must be a non-empty string');
    });

    it('should throw error for UID longer than 128 characters', async () => {
      const longUid = 'a'.repeat(129);
      await expect(createCustomToken(longUid)).rejects.toThrow('uid must be at most 128 characters');
    });

    it('should accept UID with exactly 128 characters', async () => {
      const maxUid = 'a'.repeat(128);
      const token = await createCustomToken(maxUid);
      
      expect(token).toBeDefined();
      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      expect(payload.uid).toBe(maxUid);
    });

    it('should use base64url encoding (no padding)', async () => {
      const token = await createCustomToken('test-user');
      const parts = token.split('.');
      
      // Base64url should not contain +, /, or =
      parts.forEach(part => {
        expect(part).not.toContain('+');
        expect(part).not.toContain('/');
        expect(part).not.toContain('=');
      });
    });

    it('should call crypto.subtle.importKey with correct parameters', async () => {
      await createCustomToken('test-user');
      
      expect(global.crypto.subtle.importKey).toHaveBeenCalledWith(
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
      await createCustomToken('test-user');
      
      expect(global.crypto.subtle.sign).toHaveBeenCalledWith(
        'RSASSA-PKCS1-v1_5',
        expect.anything(),
        expect.any(Uint8Array)
      );
    });

    it('should not include claims field when no custom claims provided', async () => {
      const token = await createCustomToken('test-user');
      
      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      
      expect(payload.claims).toBeUndefined();
    });

    it('should handle empty custom claims object', async () => {
      const token = await createCustomToken('test-user', {});
      
      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      
      expect(payload.claims).toEqual({});
    });

    it('should handle complex custom claims', async () => {
      const customClaims = {
        role: 'admin',
        permissions: ['read', 'write', 'delete'],
        metadata: {
          department: 'engineering',
          level: 5,
        },
        active: true,
      };

      const token = await createCustomToken('test-user', customClaims);
      
      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      
      expect(payload.claims).toEqual(customClaims);
    });
  });

  describe('Public key caching', () => {
    it('should have clearPublicKeysCache function', () => {
      expect(clearPublicKeysCache).toBeDefined();
      expect(typeof clearPublicKeysCache).toBe('function');
    });
  });
});
