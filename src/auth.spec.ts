/**
 * Unit tests for Authentication
 * Tests JWT verification with mocked crypto and fetch
 */

import { verifyIdToken, getUserFromToken, getAuth, clearPublicKeysCache, createCustomToken, signInWithCustomToken, createSessionCookie, verifySessionCookie } from './auth';
import * as serviceAccount from './service-account';
import * as config from './config';
import * as x509 from './x509';

// Mock dependencies
jest.mock('./service-account');
jest.mock('./config');
jest.mock('./x509');

const mockGetProjectId = serviceAccount.getProjectId as jest.MockedFunction<typeof serviceAccount.getProjectId>;
const mockGetServiceAccount = config.getServiceAccount as jest.MockedFunction<typeof config.getServiceAccount>;
const mockGetFirebaseApiKey = config.getFirebaseApiKey as jest.MockedFunction<typeof config.getFirebaseApiKey>;
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
        [ TEST_KID ]: 'mock-public-key-pem',
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
        iat: now + 1000, // Beyond 5-min clock skew tolerance
      });
      const token = createMockToken(payload);

      await expect(verifyIdToken(token)).rejects.toThrow('Token issued in the future');
    });

    it('should throw error for auth_time in future', async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = createValidPayload({
        auth_time: now + 1000, // Beyond 5-min clock skew tolerance
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
          [ TEST_KID ]: 'mock-public-key-pem',
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
          [ TEST_KID ]: 'mock-public-key-pem',
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
          [ TEST_KID ]: 'mock-public-key-pem',
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
          [ TEST_KID ]: 'mock-public-key-pem',
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
          [ TEST_KID ]: 'mock-public-key-pem',
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
          [ TEST_KID ]: 'mock-public-key-pem',
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
          sign: jest.fn().mockResolvedValue(new Uint8Array([ 1, 2, 3, 4 ]).buffer),
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
      const [ , payloadB64 ] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.uid).toBe(uid);
      expect(payload.claims).toEqual(customClaims);
    });

    it('should include correct JWT header', async () => {
      const token = await createCustomToken('test-user');

      const [ headerB64 ] = token.split('.');
      const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(header.alg).toBe('RS256');
      expect(header.typ).toBe('JWT');
    });

    it('should include correct JWT claims', async () => {
      const uid = 'test-user-123';
      const token = await createCustomToken(uid);

      const [ , payloadB64 ] = token.split('.');
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

      const [ , payloadB64 ] = token.split('.');
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
      const [ , payloadB64 ] = token.split('.');
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
        [ 'sign' ]
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

      const [ , payloadB64 ] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.claims).toBeUndefined();
    });

    it('should handle empty custom claims object', async () => {
      const token = await createCustomToken('test-user', {});

      const [ , payloadB64 ] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.claims).toEqual({});
    });

    it('should handle complex custom claims', async () => {
      const customClaims = {
        role: 'admin',
        permissions: [ 'read', 'write', 'delete' ],
        metadata: {
          department: 'engineering',
          level: 5,
        },
        active: true,
      };

      const token = await createCustomToken('test-user', customClaims);

      const [ , payloadB64 ] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.claims).toEqual(customClaims);
    });
  });

  describe('signInWithCustomToken', () => {
    const mockApiKey = 'AIzaSyTest123ApiKey';

    beforeEach(() => {
      mockGetFirebaseApiKey.mockReturnValue(mockApiKey);

      // Mock successful fetch response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          idToken: 'mock-id-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: '3600',
          isNewUser: false,
        }),
      });
    });

    it('should exchange custom token for ID token', async () => {
      const customToken = 'mock-custom-token';
      const result = await signInWithCustomToken(customToken);

      expect(result.idToken).toBe('mock-id-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.expiresIn).toBe('3600');
    });

    it('should call Identity Toolkit API with correct URL', async () => {
      const customToken = 'mock-custom-token';
      await signInWithCustomToken(customToken);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${mockApiKey}`,
        expect.any(Object)
      );
    });

    it('should send correct request body', async () => {
      const customToken = 'mock-custom-token';
      await signInWithCustomToken(customToken);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: customToken,
            returnSecureToken: true,
          }),
        }
      );
    });

    it('should throw error for empty custom token', async () => {
      await expect(signInWithCustomToken('')).rejects.toThrow('customToken must be a non-empty string');
    });

    it('should throw error for non-string custom token', async () => {
      await expect(signInWithCustomToken(null as any)).rejects.toThrow('customToken must be a non-empty string');
      await expect(signInWithCustomToken(undefined as any)).rejects.toThrow('customToken must be a non-empty string');
      await expect(signInWithCustomToken(123 as any)).rejects.toThrow('customToken must be a non-empty string');
    });

    it('should throw error when API key is not configured', async () => {
      mockGetFirebaseApiKey.mockImplementation(() => {
        throw new Error('Firebase API key not configured');
      });

      await expect(signInWithCustomToken('mock-token')).rejects.toThrow('Firebase API key not configured');
    });

    it('should handle API error response with JSON error message', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
          error: {
            message: 'INVALID_CUSTOM_TOKEN',
          },
        }),
      });

      await expect(signInWithCustomToken('invalid-token')).rejects.toThrow('INVALID_CUSTOM_TOKEN');
    });

    it('should handle API error response with plain text', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(signInWithCustomToken('invalid-token')).rejects.toThrow('401 - Unauthorized');
    });

    it('should handle network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(signInWithCustomToken('mock-token')).rejects.toThrow('Network error');
    });

    it('should handle malformed JSON response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(signInWithCustomToken('mock-token')).rejects.toThrow('Invalid JSON');
    });

    it('should handle expired custom token error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
          error: {
            message: 'TOKEN_EXPIRED',
          },
        }),
      });

      await expect(signInWithCustomToken('expired-token')).rejects.toThrow('TOKEN_EXPIRED');
    });

    it('should handle invalid custom token format error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
          error: {
            message: 'INVALID_CUSTOM_TOKEN: Invalid assertion format',
          },
        }),
      });

      await expect(signInWithCustomToken('malformed-token')).rejects.toThrow('Invalid assertion format');
    });

    it('should return all required fields in response', async () => {
      const result = await signInWithCustomToken('mock-token');

      expect(result).toHaveProperty('idToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
    });

    it('should handle successful authentication with custom claims', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          idToken: 'mock-id-token-with-claims',
          refreshToken: 'mock-refresh-token',
          expiresIn: '3600',
          isNewUser: true,
        }),
      });

      const result = await signInWithCustomToken('custom-token-with-claims');

      expect(result.isNewUser).toBe(true);
      expect(result.idToken).toBe('mock-id-token-with-claims');
    });

    it('should use Firebase API key from config', async () => {
      mockGetFirebaseApiKey.mockReturnValue('custom-api-key-123');

      await signInWithCustomToken('mock-token');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=custom-api-key-123',
        expect.any(Object)
      );
    });
  });

  describe('Session Cookies', () => {
    describe('createSessionCookie', () => {
      beforeEach(() => {
        mockGetProjectId.mockReturnValue(TEST_PROJECT_ID);

        // Mock token generation module
        jest.doMock('./token-generation', () => ({
          getAdminAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
        }));
      });

      it('should create a session cookie from valid ID token', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ sessionCookie: 'mock-session-cookie-jwt' }),
        });

        const sessionCookie = await createSessionCookie('valid-id-token', {
          expiresIn: 60 * 60 * 24 * 14 * 1000, // 14 days
        });

        expect(sessionCookie).toBe('mock-session-cookie-jwt');
        expect(global.fetch).toHaveBeenCalledWith(
          `https://identitytoolkit.googleapis.com/v1/projects/${TEST_PROJECT_ID}:createSessionCookie`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
            body: expect.stringContaining('"validDuration":"1209600"'),
          })
        );
      });

      it('should reject expiration less than 5 minutes', async () => {
        await expect(
          createSessionCookie('token', { expiresIn: 1000 })
        ).rejects.toThrow('at least');
      });

      it('should reject expiration more than 14 days', async () => {


        await expect(
          createSessionCookie('token', { expiresIn: 15 * 24 * 60 * 60 * 1000 })
        ).rejects.toThrow('at most');
      });

      it('should reject invalid ID token', async () => {


        await expect(
          createSessionCookie('', { expiresIn: 3600000 })
        ).rejects.toThrow('non-empty string');
      });

      it('should reject invalid expiresIn', async () => {


        await expect(
          createSessionCookie('token', { expiresIn: null as any })
        ).rejects.toThrow('must be a number');
      });

      it('should handle API errors gracefully', async () => {


        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: async () => JSON.stringify({
            error: { message: 'INVALID_ID_TOKEN' }
          }),
        });

        await expect(
          createSessionCookie('invalid-token', { expiresIn: 3600000 })
        ).rejects.toThrow('INVALID_ID_TOKEN');
      });

      it('should convert milliseconds to seconds for API', async () => {


        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ sessionCookie: 'mock-cookie' }),
        });

        await createSessionCookie('token', { expiresIn: 7 * 24 * 60 * 60 * 1000 }); // 7 days

        const fetchCall = (global.fetch as jest.Mock).mock.calls[ 0 ];
        const body = JSON.parse(fetchCall[ 1 ].body);
        expect(body.validDuration).toBe('604800'); // 7 days in seconds as string
      });
    });

    describe('verifySessionCookie', () => {
      beforeEach(() => {
        mockGetProjectId.mockReturnValue(TEST_PROJECT_ID);
        mockImportPublicKeyFromX509.mockResolvedValue(mockPublicKey);

        // Mock crypto.subtle.verify
        global.crypto = {
          subtle: {
            verify: jest.fn().mockResolvedValue(true),
          },
        } as any;
      });

      function createSessionCookieToken(payload: Record<string, unknown>): string {
        const header = {
          alg: 'RS256',
          kid: TEST_KID,
          typ: 'JWT',
        };

        const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        const signature = btoa('mock-signature').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

        return `${encodedHeader}.${encodedPayload}.${signature}`;
      }

      it('should verify valid session cookie', async () => {


        const now = Math.floor(Date.now() / 1000);
        const mockPayload = {
          sub: 'user123',
          aud: TEST_PROJECT_ID,
          iss: `https://session.firebase.google.com/${TEST_PROJECT_ID}`,
          iat: now,
          exp: now + 3600,
          auth_time: now,
          email: 'test@example.com',
          email_verified: true,
        };

        const mockJwt = createSessionCookieToken(mockPayload);

        // Mock public key fetch
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ [ TEST_KID ]: 'mock-public-key-pem' }),
          headers: new Headers({ 'cache-control': 'max-age=3600' }),
        });

        const decoded = await verifySessionCookie(mockJwt);

        expect(decoded.uid).toBe('user123');
        expect(decoded.email).toBe('test@example.com');
      });

      it('should reject expired session cookie', async () => {


        const now = Math.floor(Date.now() / 1000);
        const expiredPayload = {
          sub: 'user123',
          aud: TEST_PROJECT_ID,
          iss: `https://session.firebase.google.com/${TEST_PROJECT_ID}`,
          iat: now - 7200,
          exp: now - 3600, // Expired 1 hour ago
          auth_time: now - 7200,
        };

        const expiredJwt = createSessionCookieToken(expiredPayload);

        await expect(
          verifySessionCookie(expiredJwt)
        ).rejects.toThrow('expired');
      });

      it('should reject session cookie with wrong issuer', async () => {


        const now = Math.floor(Date.now() / 1000);
        const wrongIssuer = {
          sub: 'user123',
          aud: TEST_PROJECT_ID,
          iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`, // ID token issuer
          iat: now,
          exp: now + 3600,
          auth_time: now,
        };

        const jwt = createSessionCookieToken(wrongIssuer);

        await expect(
          verifySessionCookie(jwt)
        ).rejects.toThrow('incorrect issuer');
      });

      it('should reject session cookie with wrong audience', async () => {


        const now = Math.floor(Date.now() / 1000);
        const wrongAudience = {
          sub: 'user123',
          aud: 'wrong-project',
          iss: `https://session.firebase.google.com/${TEST_PROJECT_ID}`,
          iat: now,
          exp: now + 3600,
          auth_time: now,
        };

        const jwt = createSessionCookieToken(wrongAudience);

        await expect(
          verifySessionCookie(jwt)
        ).rejects.toThrow('incorrect audience');
      });

      it('should reject invalid session cookie format', async () => {


        await expect(
          verifySessionCookie('invalid.format')
        ).rejects.toThrow('Invalid session cookie format');
      });

      it('should reject empty session cookie', async () => {


        await expect(
          verifySessionCookie('')
        ).rejects.toThrow('non-empty string');
      });

      it('should reject session cookie without subject', async () => {


        const now = Math.floor(Date.now() / 1000);
        const noSubject = {
          aud: TEST_PROJECT_ID,
          iss: `https://session.firebase.google.com/${TEST_PROJECT_ID}`,
          iat: now,
          exp: now + 3600,
          auth_time: now,
        };

        const jwt = createSessionCookieToken(noSubject);

        await expect(
          verifySessionCookie(jwt)
        ).rejects.toThrow('no subject');
      });

      it('should handle checkRevoked parameter', async () => {


        const now = Math.floor(Date.now() / 1000);
        const mockPayload = {
          sub: 'user123',
          aud: TEST_PROJECT_ID,
          iss: `https://session.firebase.google.com/${TEST_PROJECT_ID}`,
          iat: now,
          exp: now + 3600,
          auth_time: now,
        };

        const mockJwt = createSessionCookieToken(mockPayload);

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ [ TEST_KID ]: 'mock-public-key-pem' }),
          headers: new Headers({ 'cache-control': 'max-age=3600' }),
        });

        // Should not throw even with checkRevoked=true (not yet implemented)
        const decoded = await verifySessionCookie(mockJwt, true);
        expect(decoded.uid).toBe('user123');
      });
    });
  });

  describe('Public key caching', () => {
    it('should have clearPublicKeysCache function', () => {
      expect(clearPublicKeysCache).toBeDefined();
      expect(typeof clearPublicKeysCache).toBe('function');
    });
  });
});























/**
 * Unit tests for Authentication with the emulator
 * Tests JWT verification with mocked crypto and fetch
 */
const mockGetAuthEmulatorHost = config.getAuthEmulatorHost as jest.MockedFunction<typeof config.getAuthEmulatorHost>;

describe('Authentication Emulator', () => {
  const TEST_PROJECT_ID = 'test-project-id';
  const TEST_KID = 'test-key-id';
  const EMU_HOST = 'localhost:9099';
  const EMU_ISS = `firebase-auth-emulator@${TEST_PROJECT_ID}`;

  // Mock public key
  const mockPublicKey = {} as CryptoKey;

  // Helper to create a mock JWT token
  function createMockToken(payload: Record<string, unknown>, header?: Record<string, unknown>): string {
    const defaultHeader = {
      alg: 'none',
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
      iss: EMU_ISS,
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
    mockGetAuthEmulatorHost.mockReturnValue(EMU_HOST);
    mockGetProjectId.mockReturnValue(TEST_PROJECT_ID);
    mockImportPublicKeyFromX509.mockResolvedValue(mockPublicKey);
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
    });

    it('should verify a valid Firebase v10 session token', async () => {
      const payload = createValidPayload({
        iss: EMU_ISS,
      });
      const token = createMockToken(payload);

      const result = await verifyIdToken(token);

      expect(result.uid).toBe('test-user-id');
      expect(result.iss).toContain(EMU_ISS);
    });

    it('should throw error for empty token', async () => {
      await expect(verifyIdToken('')).rejects.toThrow('ID token is required');
    });

    it('should throw error for invalid JWT format', async () => {
      await expect(verifyIdToken('invalid.token')).rejects.toThrow('Invalid JWT format');
    });

    it('should reject and throw for invalid algorithm', async () => {
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

      const result = await verifyIdToken(token);

      // Verify payload was correctly decoded
      expect(result.sub).toBe('test-user-id');
      expect(result.email).toBe('test@example.com');
    });

    it('should handle base64url padding correctly', async () => {
      // Create token with payload that needs padding
      const payload = createValidPayload({ test: 'a' }); // Short payload
      const token = createMockToken(payload);

      const result = await verifyIdToken(token);

      expect(result.uid).toBe('test-user-id');
    });
  });

  describe('createCustomToken', () => {

    beforeEach(() => {
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
      const [ , payloadB64 ] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.uid).toBe(uid);
      expect(payload.claims).toEqual(customClaims);
    });

    it('should include correct JWT header', async () => {
      const token = await createCustomToken('test-user');

      const [ headerB64 ] = token.split('.');
      const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(header.alg).toBe('none');
      expect(header.typ).toBe('JWT');
    });

    it('should include correct JWT claims', async () => {
      const uid = 'test-user-123';
      const token = await createCustomToken(uid);

      const [ , payloadB64 ] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.iss).toBe(EMU_ISS);
      expect(payload.sub).toBe(EMU_ISS);
      expect(payload.uid).toBe(uid);
      expect(payload.exp).toBeDefined();
    });

    it('should set token expiration to greater than current time', async () => {
      const token = await createCustomToken('test-user');

      const [ , payloadB64 ] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.exp * 1000).toBeGreaterThan(Date.now());
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
      const [ , payloadB64 ] = token.split('.');
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

    it('should not include claims field when no custom claims provided', async () => {
      const token = await createCustomToken('test-user');

      const [ , payloadB64 ] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.claims).toBeUndefined();
    });

    it('should handle empty custom claims object', async () => {
      const token = await createCustomToken('test-user', {});

      const [ , payloadB64 ] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.claims).toEqual({});
    });

    it('should handle complex custom claims', async () => {
      const customClaims = {
        role: 'admin',
        permissions: [ 'read', 'write', 'delete' ],
        metadata: {
          department: 'engineering',
          level: 5,
        },
        active: true,
      };

      const token = await createCustomToken('test-user', customClaims);

      const [ , payloadB64 ] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.claims).toEqual(customClaims);
    });
  });

  describe('signInWithCustomToken', () => {
    const mockApiKey = 'AIzaSyTest123ApiKey';

    beforeEach(() => {
      mockGetFirebaseApiKey.mockReturnValue(mockApiKey);

      // Mock successful fetch response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          idToken: 'mock-id-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: '3600',
          isNewUser: false,
        }),
      });
    });

    it('should exchange custom token for ID token', async () => {
      const customToken = 'mock-custom-token';
      const result = await signInWithCustomToken(customToken);

      expect(result.idToken).toBe('mock-id-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.expiresIn).toBe('3600');
    });

    it('should call Identity Toolkit API with correct URL', async () => {
      const customToken = 'mock-custom-token';
      await signInWithCustomToken(customToken);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://${EMU_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${mockApiKey}`,
        expect.any(Object)
      );
    });

    it('should send correct request body', async () => {
      const customToken = 'mock-custom-token';
      await signInWithCustomToken(customToken);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: customToken,
            returnSecureToken: true,
          }),
        }
      );
    });

    it('should throw error for empty custom token', async () => {
      await expect(signInWithCustomToken('')).rejects.toThrow('customToken must be a non-empty string');
    });

    it('should throw error for non-string custom token', async () => {
      await expect(signInWithCustomToken(null as any)).rejects.toThrow('customToken must be a non-empty string');
      await expect(signInWithCustomToken(undefined as any)).rejects.toThrow('customToken must be a non-empty string');
      await expect(signInWithCustomToken(123 as any)).rejects.toThrow('customToken must be a non-empty string');
    });

    it('should throw error when API key is not configured', async () => {
      mockGetFirebaseApiKey.mockImplementation(() => {
        throw new Error('Firebase API key not configured');
      });

      await expect(signInWithCustomToken('mock-token')).rejects.toThrow('Firebase API key not configured');
    });

    it('should handle API error response with JSON error message', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
          error: {
            message: 'INVALID_CUSTOM_TOKEN',
          },
        }),
      });

      await expect(signInWithCustomToken('invalid-token')).rejects.toThrow('INVALID_CUSTOM_TOKEN');
    });

    it('should handle API error response with plain text', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(signInWithCustomToken('invalid-token')).rejects.toThrow('401 - Unauthorized');
    });

    it('should handle network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(signInWithCustomToken('mock-token')).rejects.toThrow('Network error');
    });

    it('should handle malformed JSON response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(signInWithCustomToken('mock-token')).rejects.toThrow('Invalid JSON');
    });

    it('should handle expired custom token error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
          error: {
            message: 'TOKEN_EXPIRED',
          },
        }),
      });

      await expect(signInWithCustomToken('expired-token')).rejects.toThrow('TOKEN_EXPIRED');
    });

    it('should handle invalid custom token format error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
          error: {
            message: 'INVALID_CUSTOM_TOKEN: Invalid assertion format',
          },
        }),
      });

      await expect(signInWithCustomToken('malformed-token')).rejects.toThrow('Invalid assertion format');
    });

    it('should return all required fields in response', async () => {
      const result = await signInWithCustomToken('mock-token');

      expect(result).toHaveProperty('idToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
    });

    it('should handle successful authentication with custom claims', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          idToken: 'mock-id-token-with-claims',
          refreshToken: 'mock-refresh-token',
          expiresIn: '3600',
          isNewUser: true,
        }),
      });

      const result = await signInWithCustomToken('custom-token-with-claims');

      expect(result.isNewUser).toBe(true);
      expect(result.idToken).toBe('mock-id-token-with-claims');
    });

    it('should use Firebase API key from config', async () => {
      mockGetFirebaseApiKey.mockReturnValue('custom-api-key-123');

      await signInWithCustomToken('mock-token');

      expect(global.fetch).toHaveBeenCalledWith(
        `http://${EMU_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=custom-api-key-123`,
        expect.any(Object)
      );
    });
  });

  describe('Session Cookies', () => {
    describe('createSessionCookie', () => {
      beforeEach(() => {
        mockGetProjectId.mockReturnValue(TEST_PROJECT_ID);

        // Mock token generation module
        jest.doMock('./token-generation', () => ({
          getAdminAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
        }));
      });

      it('should create a session cookie from valid ID token', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ sessionCookie: 'mock-session-cookie-jwt' }),
        });

        const sessionCookie = await createSessionCookie('valid-id-token', {
          expiresIn: 60 * 60 * 24 * 14 * 1000, // 14 days
        });

        expect(sessionCookie).toBe('mock-session-cookie-jwt');
        expect(global.fetch).toHaveBeenCalledWith(
          `http://${EMU_HOST}/identitytoolkit.googleapis.com/v1/projects/${TEST_PROJECT_ID}:createSessionCookie`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
            body: expect.stringContaining('"validDuration":"1209600"'),
          })
        );
      });

      it('should reject expiration less than 5 minutes', async () => {
        await expect(
          createSessionCookie('token', { expiresIn: 1000 })
        ).rejects.toThrow('at least');
      });

      it('should reject expiration more than 14 days', async () => {


        await expect(
          createSessionCookie('token', { expiresIn: 15 * 24 * 60 * 60 * 1000 })
        ).rejects.toThrow('at most');
      });

      it('should reject invalid ID token', async () => {


        await expect(
          createSessionCookie('', { expiresIn: 3600000 })
        ).rejects.toThrow('non-empty string');
      });

      it('should reject invalid expiresIn', async () => {


        await expect(
          createSessionCookie('token', { expiresIn: null as any })
        ).rejects.toThrow('must be a number');
      });

      it('should handle API errors gracefully', async () => {


        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: async () => JSON.stringify({
            error: { message: 'INVALID_ID_TOKEN' }
          }),
        });

        await expect(
          createSessionCookie('invalid-token', { expiresIn: 3600000 })
        ).rejects.toThrow('INVALID_ID_TOKEN');
      });

      it('should convert milliseconds to seconds for API', async () => {


        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ sessionCookie: 'mock-cookie' }),
        });

        await createSessionCookie('token', { expiresIn: 7 * 24 * 60 * 60 * 1000 }); // 7 days

        const fetchCall = (global.fetch as jest.Mock).mock.calls[ 0 ];
        const body = JSON.parse(fetchCall[ 1 ].body);
        expect(body.validDuration).toBe('604800'); // 7 days in seconds as string
      });
    });

    describe('verifySessionCookie', () => {
      beforeEach(() => {
        mockGetProjectId.mockReturnValue(TEST_PROJECT_ID);
        mockImportPublicKeyFromX509.mockResolvedValue(mockPublicKey);

        // Mock crypto.subtle.verify
        global.crypto = {
          subtle: {
            verify: jest.fn().mockResolvedValue(true),
          },
        } as any;
      });

      function createSessionCookieToken(payload: Record<string, unknown>): string {
        const header = {
          alg: 'none',
          kid: TEST_KID,
          typ: 'JWT',
        };

        const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        const signature = btoa('mock-signature').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

        return `${encodedHeader}.${encodedPayload}.${signature}`;
      }

      it('should verify valid session cookie', async () => {


        const now = Math.floor(Date.now() / 1000);
        const mockPayload = {
          sub: 'user123',
          aud: TEST_PROJECT_ID,
          iss: `${EMU_ISS}`,
          iat: now,
          exp: now + 3600,
          auth_time: now,
          email: 'test@example.com',
          email_verified: true,
        };

        const mockJwt = createSessionCookieToken(mockPayload);

        // Mock public key fetch
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ [ TEST_KID ]: 'mock-public-key-pem' }),
          headers: new Headers({ 'cache-control': 'max-age=3600' }),
        });

        const decoded = await verifySessionCookie(mockJwt);

        expect(decoded.uid).toBe('user123');
        expect(decoded.email).toBe('test@example.com');
      });

      it('should reject expired session cookie', async () => {


        const now = Math.floor(Date.now() / 1000);
        const expiredPayload = {
          sub: 'user123',
          aud: TEST_PROJECT_ID,
          iss: `${EMU_ISS}`,
          iat: now - 7200,
          exp: now - 3600, // Expired 1 hour ago
          auth_time: now - 7200,
        };

        const expiredJwt = createSessionCookieToken(expiredPayload);

        await expect(
          verifySessionCookie(expiredJwt)
        ).rejects.toThrow('expired');
      });

      it('should reject session cookie with wrong issuer', async () => {


        const now = Math.floor(Date.now() / 1000);
        const wrongIssuer = {
          sub: 'user123',
          aud: TEST_PROJECT_ID,
          iss: `firebase@${TEST_PROJECT_ID}`, // ID token issuer
          iat: now,
          exp: now + 3600,
          auth_time: now,
        };

        const jwt = createSessionCookieToken(wrongIssuer);

        await expect(
          verifySessionCookie(jwt)
        ).rejects.toThrow('incorrect issuer');
      });

      it('should reject invalid session cookie format', async () => {


        await expect(
          verifySessionCookie('invalid.format')
        ).rejects.toThrow('Invalid session cookie format');
      });

      it('should reject empty session cookie', async () => {


        await expect(
          verifySessionCookie('')
        ).rejects.toThrow('non-empty string');
      });

      it('should reject session cookie without subject', async () => {


        const now = Math.floor(Date.now() / 1000);
        const noSubject = {
          aud: TEST_PROJECT_ID,
          iss: `${EMU_ISS}`,
          iat: now,
          exp: now + 3600,
          auth_time: now,
        };

        const jwt = createSessionCookieToken(noSubject);

        await expect(
          verifySessionCookie(jwt)
        ).rejects.toThrow('no subject');
      });

      it('should handle checkRevoked parameter', async () => {


        const now = Math.floor(Date.now() / 1000);
        const mockPayload = {
          sub: 'user123',
          aud: TEST_PROJECT_ID,
          iss: `${EMU_ISS}`,
          iat: now,
          exp: now + 3600,
          auth_time: now,
        };

        const mockJwt = createSessionCookieToken(mockPayload);

        // Should not throw even with checkRevoked=true (not yet implemented)
        const decoded = await verifySessionCookie(mockJwt, true);
        expect(decoded.uid).toBe('user123');
      });
    });
  });

  describe('Public key caching', () => {
    it('should have clearPublicKeysCache function', () => {
      expect(clearPublicKeysCache).toBeDefined();
      expect(typeof clearPublicKeysCache).toBe('function');
    });
  });
});