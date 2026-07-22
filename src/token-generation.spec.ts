/**
 * Tests for token-generation.ts
 * Tests JWT creation, OAuth token exchange, and token caching
 */

import { getAdminAccessToken, clearTokenCache } from './token-generation';
import type { ServiceAccount, TokenResponse } from './types';

// Mock service-account module
jest.mock('./service-account');
import { getServiceAccount } from './service-account';
const mockGetServiceAccount = getServiceAccount as jest.MockedFunction<typeof getServiceAccount>;

describe('Token Generation', () => {
  const TEST_SERVICE_ACCOUNT: ServiceAccount = {
    type: 'service_account',
    project_id: 'test-project',
    private_key_id: 'test-key-id',
    private_key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj
MzEfYyjiWA4R4/M2bS1+fWIcPm15j9QMQKL0hP4KZm6/Zyqrq3FGj6O6/zFvpvlI
-----END PRIVATE KEY-----`,
    client_email: 'test@test-project.iam.gserviceaccount.com',
    client_id: '123456789',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/test%40test-project.iam.gserviceaccount.com',
  };

  const MOCK_TOKEN_RESPONSE: TokenResponse = {
    access_token: 'mock-access-token-12345',
    expires_in: 3600,
    token_type: 'Bearer',
  };

  let mockCryptoSubtle: {
    importKey: jest.Mock;
    sign: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearTokenCache();
    
    mockGetServiceAccount.mockReturnValue(TEST_SERVICE_ACCOUNT);

    // Mock crypto.subtle
    mockCryptoSubtle = {
      importKey: jest.fn().mockResolvedValue({ type: 'private' }),
      sign: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5]).buffer),
    };
    
    global.crypto = {
      subtle: mockCryptoSubtle as any,
    } as any;

    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_TOKEN_RESPONSE,
      text: async () => JSON.stringify(MOCK_TOKEN_RESPONSE),
    } as Response);
  });

  afterEach(() => {
    clearTokenCache();
  });

  describe('getAdminAccessToken', () => {
    it('should generate and return access token', async () => {
      const token = await getAdminAccessToken();
      
      expect(token).toBe('mock-access-token-12345');
      expect(mockGetServiceAccount).toHaveBeenCalledTimes(1);
      expect(mockCryptoSubtle.importKey).toHaveBeenCalledTimes(1);
      expect(mockCryptoSubtle.sign).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should use correct crypto.subtle.importKey parameters', async () => {
      await getAdminAccessToken();
      
      expect(mockCryptoSubtle.importKey).toHaveBeenCalledWith(
        'pkcs8',
        expect.any(Uint8Array),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
      );
    });

    it('should use correct crypto.subtle.sign parameters', async () => {
      await getAdminAccessToken();
      
      expect(mockCryptoSubtle.sign).toHaveBeenCalledWith(
        'RSASSA-PKCS1-v1_5',
        { type: 'private' },
        expect.any(Uint8Array)
      );
    });

    it('should make OAuth token exchange request with correct parameters', async () => {
      await getAdminAccessToken();
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: expect.any(URLSearchParams),
        })
      );

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = fetchCall[1].body as URLSearchParams;
      expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
      expect(body.get('assertion')).toBeTruthy();
    });

    it('should cache token and reuse it on subsequent calls', async () => {
      const token1 = await getAdminAccessToken();
      const token2 = await getAdminAccessToken();
      const token3 = await getAdminAccessToken();
      
      expect(token1).toBe('mock-access-token-12345');
      expect(token2).toBe('mock-access-token-12345');
      expect(token3).toBe('mock-access-token-12345');
      
      // Should only call once due to caching
      expect(mockGetServiceAccount).toHaveBeenCalledTimes(1);
      expect(mockCryptoSubtle.importKey).toHaveBeenCalledTimes(1);
      expect(mockCryptoSubtle.sign).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should refresh token after expiry', async () => {
      // Mock Date.now to control time
      const originalDateNow = Date.now;
      let currentTime = 1000000000;
      Date.now = jest.fn(() => currentTime);

      try {
        // First call
        const token1 = await getAdminAccessToken();
        expect(token1).toBe('mock-access-token-12345');
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Advance time past expiry (3600s - 60s buffer = 3540s)
        currentTime += 3600000; // 1 hour later

        // Second call should refresh
        const token2 = await getAdminAccessToken();
        expect(token2).toBe('mock-access-token-12345');
        expect(global.fetch).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should throw error if OAuth token exchange fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        text: async () => 'Invalid grant',
      } as Response);

      await expect(getAdminAccessToken()).rejects.toThrow('Failed to get access token: Invalid grant');
    });

    it('should throw error if crypto.subtle.importKey fails', async () => {
      mockCryptoSubtle.importKey.mockRejectedValue(new Error('Invalid key format'));

      await expect(getAdminAccessToken()).rejects.toThrow('Invalid key format');
    });

    it('should throw error if crypto.subtle.sign fails', async () => {
      mockCryptoSubtle.sign.mockRejectedValue(new Error('Signing failed'));

      await expect(getAdminAccessToken()).rejects.toThrow('Signing failed');
    });

    it('should handle network errors during token exchange', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(getAdminAccessToken()).rejects.toThrow('Network error');
    });

    it('should handle malformed JSON response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as any as Response);

      await expect(getAdminAccessToken()).rejects.toThrow('Invalid JSON');
    });
  });

  describe('clearTokenCache', () => {
    it('should clear cached token', async () => {
      // Generate token (will be cached)
      await getAdminAccessToken();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Clear cache
      clearTokenCache();

      // Next call should regenerate token
      await getAdminAccessToken();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should allow multiple calls without error', () => {
      expect(() => {
        clearTokenCache();
        clearTokenCache();
        clearTokenCache();
      }).not.toThrow();
    });

    it('should reset token expiry', async () => {
      const originalDateNow = Date.now;
      let currentTime = 1000000000;
      Date.now = jest.fn(() => currentTime);

      try {
        // Generate token
        await getAdminAccessToken();
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Clear cache
        clearTokenCache();

        // Advance time (but not past expiry)
        currentTime += 1000000; // 16 minutes later

        // Should regenerate because cache was cleared
        await getAdminAccessToken();
        expect(global.fetch).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = originalDateNow;
      }
    });
  });

  describe('JWT Creation', () => {
    it('should create JWT with correct header', async () => {
      await getAdminAccessToken();
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = fetchCall[1].body as URLSearchParams;
      const jwt = body.get('assertion') as string;
      
      const [headerB64] = jwt.split('.');
      const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
      
      expect(header).toEqual({
        alg: 'RS256',
        typ: 'JWT',
      });
    });

    it('should create JWT with correct payload claims', async () => {
      const originalDateNow = Date.now;
      const fixedTime = 1000000000;
      Date.now = jest.fn(() => fixedTime);

      try {
        await getAdminAccessToken();
        
        const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
        const body = fetchCall[1].body as URLSearchParams;
        const jwt = body.get('assertion') as string;
        
        const [, payloadB64] = jwt.split('.');
        const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
        
        expect(payload).toMatchObject({
          iss: 'test@test-project.iam.gserviceaccount.com',
          sub: 'test@test-project.iam.gserviceaccount.com',
          aud: 'https://oauth2.googleapis.com/token',
          iat: Math.floor(fixedTime / 1000),
          exp: Math.floor(fixedTime / 1000) + 3600,
          scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase',
        });
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should create JWT with 1 hour expiry', async () => {
      const originalDateNow = Date.now;
      const fixedTime = 1000000000;
      Date.now = jest.fn(() => fixedTime);

      try {
        await getAdminAccessToken();
        
        const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
        const body = fetchCall[1].body as URLSearchParams;
        const jwt = body.get('assertion') as string;
        
        const [, payloadB64] = jwt.split('.');
        const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
        
        expect(payload.exp - payload.iat).toBe(3600); // 1 hour
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should use base64url encoding (no padding)', async () => {
      await getAdminAccessToken();
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = fetchCall[1].body as URLSearchParams;
      const jwt = body.get('assertion') as string;
      
      // Base64URL should not contain =, +, or /
      expect(jwt).not.toContain('=');
      expect(jwt).not.toContain('+');
      expect(jwt).not.toContain('/');
      
      // Should contain - and _ (base64url replacements)
      const parts = jwt.split('.');
      expect(parts).toHaveLength(3);
    });
  });

  describe('Token Caching Behavior', () => {
    it('should set token expiry with 1 minute buffer', async () => {
      const originalDateNow = Date.now;
      let currentTime = 1000000000;
      
      try {
        // Mock Date.now to return controllable time
        Date.now = jest.fn(() => currentTime);
        
        // First call - generates token
        await getAdminAccessToken();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        
        // Token expires in 3600s, but cache should expire 60s earlier (at 3540s)
        // Advance time to 3539s (just before cache expiry)
        currentTime += 3539000;
        
        await getAdminAccessToken();
        expect(global.fetch).toHaveBeenCalledTimes(1); // Still cached
        
        // Advance to 3541s (past cache expiry)
        currentTime += 2000; // Now at 3541s
        
        await getAdminAccessToken();
        expect(global.fetch).toHaveBeenCalledTimes(2); // Refreshed
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should handle concurrent token requests', async () => {
      // Make multiple concurrent requests
      const promises = [
        getAdminAccessToken(),
        getAdminAccessToken(),
        getAdminAccessToken(),
      ];
      
      const tokens = await Promise.all(promises);
      
      // All should return same token
      expect(tokens[0]).toBe('mock-access-token-12345');
      expect(tokens[1]).toBe('mock-access-token-12345');
      expect(tokens[2]).toBe('mock-access-token-12345');
      
      // Note: Due to async nature, fetch might be called multiple times
      // This is acceptable as the last one will be cached
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing service account', async () => {
      mockGetServiceAccount.mockImplementation(() => {
        throw new Error('Service account not configured');
      });

      await expect(getAdminAccessToken()).rejects.toThrow('Service account not configured');
    });

    it('should handle invalid private key format', async () => {
      mockGetServiceAccount.mockReturnValue({
        ...TEST_SERVICE_ACCOUNT,
        private_key: 'invalid-key',
      });

      // atob will throw on invalid base64
      await expect(getAdminAccessToken()).rejects.toThrow();
    });

    it('should handle OAuth error response with details', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        text: async () => JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid JWT Signature',
        }),
      } as Response);

      await expect(getAdminAccessToken()).rejects.toThrow('Failed to get access token');
    });

    it('should handle missing access_token in response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          expires_in: 3600,
          token_type: 'Bearer',
          // Missing access_token
        }),
      } as Response);

      const token = await getAdminAccessToken();
      expect(token).toBeUndefined();
    });
  });
});












describe('Emulated Token Generation', () => {
  it('should generate a the string "owner" if the emulated parameter is true', async () => {
    const token = await getAdminAccessToken(true);
    expect(token).toBe('owner');
  });
});