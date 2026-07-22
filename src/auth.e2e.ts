/**
 * End-to-end tests for Authentication
 * These tests run against a real Firebase project
 * 
 * Prerequisites:
 * - service-account.json file with valid credentials
 * - Firebase project: prmichaelsen-firebase-e2e
 * 
 * Run with: npm run test:e2e
 */

import { initializeApp } from './config';
import { verifyIdToken, getUserFromToken, createCustomToken, signInWithCustomToken, createSessionCookie, verifySessionCookie } from './auth';
import { getAdminAccessToken } from './token-generation';
import { createUser } from './user-management';
import * as fs from 'fs';
import * as path from 'path';

describe('Auth E2E Tests', () => {
  let serviceAccount: any;

  beforeAll(() => {
    // Load service account from filesystem
    const serviceAccountPath = path.join(__dirname, '../service-account.json');

    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        'service-account.json not found. Please add your Firebase service account credentials to the project root.'
      );
    }

    const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf-8');
    serviceAccount = JSON.parse(serviceAccountJson);

    // Initialize with service account and project ID
    initializeApp({
      serviceAccount,
      projectId: serviceAccount.project_id,
    });
  });

  describe('Admin Token Generation', () => {
    it('should generate admin access token', async () => {
      const token = await getAdminAccessToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should cache admin access token', async () => {
      const token1 = await getAdminAccessToken();
      const token2 = await getAdminAccessToken();

      // Should return same token (cached)
      expect(token1).toBe(token2);
    });

    it('should generate valid JWT format', async () => {
      const token = await getAdminAccessToken();

      // JWT should have 3 parts separated by dots
      const parts = token.split('.');
      expect(parts).toHaveLength(3);

      // Each part should be base64url encoded
      parts.forEach(part => {
        expect(part.length).toBeGreaterThan(0);
        expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
      });
    });
  });

  describe('ID Token Verification', () => {
    // Note: These tests require a valid Firebase ID token from a real user
    // For now, we'll test the error cases that don't require a real token

    it('should throw error for empty token', async () => {
      await expect(verifyIdToken('')).rejects.toThrow('ID token is required');
    });

    it('should throw error for invalid JWT format', async () => {
      await expect(verifyIdToken('invalid.token')).rejects.toThrow('Invalid JWT format');
    });

    it('should throw error for malformed token', async () => {
      await expect(verifyIdToken('not-a-jwt')).rejects.toThrow();
    });

    it('should throw error for token with invalid algorithm', async () => {
      // Create a mock token with HS256 algorithm (should be RS256)
      const header = btoa(JSON.stringify({ alg: 'HS256', kid: 'test', typ: 'JWT' }))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const payload = btoa(JSON.stringify({ sub: 'test' }))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const signature = btoa('fake-signature')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const token = `${header}.${payload}.${signature}`;

      await expect(verifyIdToken(token)).rejects.toThrow('Invalid algorithm');
    });

    it('should throw error for expired token', async () => {
      // Create a token that's already expired
      const now = Math.floor(Date.now() / 1000);
      const header = btoa(JSON.stringify({ alg: 'RS256', kid: 'test', typ: 'JWT' }))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const payload = btoa(JSON.stringify({
        iss: `https://securetoken.google.com/${serviceAccount.project_id}`,
        aud: serviceAccount.project_id,
        auth_time: now - 7200,
        iat: now - 7200,
        exp: now - 3600, // Expired 1 hour ago
        sub: 'test-user',
      })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const signature = btoa('fake-signature')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const token = `${header}.${payload}.${signature}`;

      await expect(verifyIdToken(token)).rejects.toThrow('Token has expired');
    });
  });

  describe('User Info Extraction', () => {
    it('should throw error for invalid token in getUserFromToken', async () => {
      await expect(getUserFromToken('invalid-token')).rejects.toThrow();
    });

    it('should throw error for empty token in getUserFromToken', async () => {
      await expect(getUserFromToken('')).rejects.toThrow('ID token is required');
    });
  });

  describe('Token Format Support', () => {
    it('should handle Firebase v9 token format (securetoken)', async () => {
      // This test verifies the issuer validation accepts v9 format
      const now = Math.floor(Date.now() / 1000);
      const header = btoa(JSON.stringify({ alg: 'RS256', kid: 'test', typ: 'JWT' }))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const payload = btoa(JSON.stringify({
        iss: `https://securetoken.google.com/${serviceAccount.project_id}`,
        aud: serviceAccount.project_id,
        auth_time: now - 100,
        iat: now - 100,
        exp: now + 3600,
        sub: 'test-user',
      })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const signature = btoa('fake-signature')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const token = `${header}.${payload}.${signature}`;

      // Will fail at key lookup (kid 'test' doesn't exist)
      await expect(verifyIdToken(token)).rejects.toThrow('Public key not found');
    });

    it('should handle Firebase v10 token format (session)', async () => {
      // This test verifies the issuer validation accepts v10 format
      const now = Math.floor(Date.now() / 1000);
      const header = btoa(JSON.stringify({ alg: 'RS256', kid: 'test', typ: 'JWT' }))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const payload = btoa(JSON.stringify({
        iss: `https://session.firebase.google.com/${serviceAccount.project_id}`,
        aud: serviceAccount.project_id,
        auth_time: now - 100,
        iat: now - 100,
        exp: now + 3600,
        sub: 'test-user',
      })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const signature = btoa('fake-signature')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const token = `${header}.${payload}.${signature}`;

      // Will fail at key lookup (kid 'test' doesn't exist)
      await expect(verifyIdToken(token)).rejects.toThrow('Public key not found');
    });
  });

  describe('Custom Token Creation', () => {
    it('should create a custom token with valid structure', async () => {
      const uid = 'test-user-123';
      const customClaims = {
        role: 'admin',
        premium: true,
      };

      const customToken = await createCustomToken(uid, customClaims);

      expect(customToken).toBeDefined();
      expect(typeof customToken).toBe('string');
      expect(customToken.split('.').length).toBe(3); // header.payload.signature
    });

    it('should create token with correct JWT structure', async () => {
      const uid = 'test-user-456';
      const token = await createCustomToken(uid);

      // Decode and verify structure (without calling Firebase)
      const [ headerB64, payloadB64 ] = token.split('.');
      const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      // Verify header
      expect(header.alg).toBe('RS256');
      expect(header.typ).toBe('JWT');

      // Verify payload
      expect(payload.uid).toBe(uid);
      expect(payload.aud).toContain('identitytoolkit');
      expect(payload.iss).toContain('iam.gserviceaccount.com');
      expect(payload.sub).toContain('iam.gserviceaccount.com');
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect(payload.exp - payload.iat).toBe(3600); // 1 hour
    });

    it('should include custom claims in token', async () => {
      const uid = 'test-user-789';
      const customClaims = {
        role: 'moderator',
        permissions: [ 'read', 'write' ],
        level: 5,
      };

      const token = await createCustomToken(uid, customClaims);

      const [ , payloadB64 ] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.uid).toBe(uid);
      expect(payload.claims).toEqual(customClaims);
    });

    it('should create token without custom claims', async () => {
      const uid = 'test-user-no-claims';
      const token = await createCustomToken(uid);

      const [ , payloadB64 ] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.uid).toBe(uid);
      expect(payload.claims).toBeUndefined();
    });

    it('should throw error for invalid UID', async () => {
      await expect(createCustomToken('')).rejects.toThrow('uid must be a non-empty string');
      await expect(createCustomToken('a'.repeat(129))).rejects.toThrow('uid must be at most 128 characters');
    });
  });

  describe('Custom Token Authentication Flow (E2E)', () => {
    // Note: This test requires FIREBASE_API_KEY environment variable to be set
    // Skip if API key is not configured
    const hasApiKey = process.env.FIREBASE_API_KEY || process.env.PUBLIC_FIREBASE_API_KEY;

    (hasApiKey ? it : it.skip)('should complete full auth flow: create token → exchange → verify', async () => {
      const uid = `e2e-test-${Date.now()}`;
      const customClaims = {
        role: 'tester',
        testRun: true,
        timestamp: Date.now(),
      };

      // Step 1: Create custom token
      const customToken = await createCustomToken(uid, customClaims);
      expect(customToken).toBeDefined();
      expect(typeof customToken).toBe('string');
      expect(customToken.split('.').length).toBe(3);

      // Step 2: Exchange for ID token
      const credentials = await signInWithCustomToken(customToken);

      expect(credentials.idToken).toBeDefined();
      expect(credentials.refreshToken).toBeDefined();
      expect(credentials.expiresIn).toBe('3600');

      // Step 3: Verify the ID token
      const decodedToken = await verifyIdToken(credentials.idToken);
      expect(decodedToken.uid).toBe(uid);
      // Custom claims are included in the decoded token
      expect((decodedToken as any).role).toBe('tester');
      expect((decodedToken as any).testRun).toBe(true);
    }, 30000);

    (!hasApiKey ? it : it.skip)('should skip e2e test when API key is not configured', () => {
      // This test runs when API key is not set to document the requirement
      expect(true).toBe(true);
      console.log('Skipping signInWithCustomToken e2e test: FIREBASE_API_KEY not configured');
    });

    it('should throw error when API key is missing', async () => {
      // Temporarily unset API key
      const originalApiKey = process.env.FIREBASE_API_KEY;
      const originalPublicApiKey = process.env.PUBLIC_FIREBASE_API_KEY;
      delete process.env.FIREBASE_API_KEY;
      delete process.env.PUBLIC_FIREBASE_API_KEY;

      const customToken = await createCustomToken('test-user');

      await expect(signInWithCustomToken(customToken)).rejects.toThrow('Firebase API key not configured');

      // Restore API keys
      if (originalApiKey) process.env.FIREBASE_API_KEY = originalApiKey;
      if (originalPublicApiKey) process.env.PUBLIC_FIREBASE_API_KEY = originalPublicApiKey;
    });
  });

  describe('Session Cookies', () => {
    const hasApiKey = !!(process.env.FIREBASE_API_KEY || process.env.PUBLIC_FIREBASE_API_KEY);

    (hasApiKey ? it : it.skip)('should create and verify session cookie', async () => {
      // Step 1: Create a custom token
      const uid = `test-user-${Date.now()}`;
      const customToken = await createCustomToken(uid);

      // Step 2: Exchange for ID token
      const credentials = await signInWithCustomToken(customToken);
      const idToken = credentials.idToken;

      // Step 3: Create session cookie (1 hour duration)
      const sessionCookie = await createSessionCookie(idToken, {
        expiresIn: 60 * 60 * 1000, // 1 hour
      });

      expect(sessionCookie).toBeDefined();
      expect(typeof sessionCookie).toBe('string');
      expect(sessionCookie.split('.').length).toBe(3); // JWT format

      // Step 4: Verify session cookie
      const decodedToken = await verifySessionCookie(sessionCookie);

      expect(decodedToken.uid).toBe(uid);
      expect(decodedToken.iss).toContain('session.firebase.google.com');
      expect(decodedToken.aud).toBe(serviceAccount.project_id);
    }, 30000);

    (hasApiKey ? it : it.skip)('should create session cookie with 14-day expiration', async () => {
      // Create custom token and exchange for ID token
      const uid = `test-user-long-${Date.now()}`;
      const customToken = await createCustomToken(uid);
      const credentials = await signInWithCustomToken(customToken);

      // Create 14-day session cookie
      const sessionCookie = await createSessionCookie(credentials.idToken, {
        expiresIn: 60 * 60 * 24 * 14 * 1000, // 14 days
      });

      // Verify it
      const decodedToken = await verifySessionCookie(sessionCookie);

      expect(decodedToken.uid).toBe(uid);

      // Check expiration is approximately 14 days from now
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = decodedToken.exp - now;
      expect(expiresIn).toBeGreaterThan(13 * 24 * 60 * 60); // At least 13 days
      expect(expiresIn).toBeLessThan(15 * 24 * 60 * 60); // Less than 15 days
    }, 30000);

    (hasApiKey ? it : it.skip)('should create session cookie with custom claims', async () => {
      // Create custom token with claims
      const uid = `test-user-claims-${Date.now()}`;
      const customClaims = {
        role: 'admin',
        premium: true,
        level: 5,
      };

      const customToken = await createCustomToken(uid, customClaims);
      const credentials = await signInWithCustomToken(customToken);

      // Create session cookie
      const sessionCookie = await createSessionCookie(credentials.idToken, {
        expiresIn: 60 * 60 * 1000, // 1 hour
      });

      // Verify session cookie preserves custom claims
      const decodedToken = await verifySessionCookie(sessionCookie);

      expect(decodedToken.uid).toBe(uid);
      expect((decodedToken as any).role).toBe('admin');
      expect((decodedToken as any).premium).toBe(true);
      expect((decodedToken as any).level).toBe(5);
    }, 30000);

    (!hasApiKey ? it : it.skip)('should skip session cookie e2e tests when API key is not configured', () => {
      expect(true).toBe(true);
      console.log('Skipping session cookie e2e tests: FIREBASE_API_KEY not configured');
    });
  });
});























(process?.env?.AUTH_EMULATOR_RUNNING === 'true' ? describe : describe.skip)(process?.env?.AUTH_EMULATOR_RUNNING === 'true' ?'Auth Emulator E2E Tests' : 'Skipping Auth Emulator E2E because the emualtor is not running', () => {
  const EMU_ISS = 'firebase-auth-emulator@test-project-id';
  const PORT = JSON.parse(String.fromCharCode(...new Uint8Array(fs.readFileSync('firebase.json')))).emulators.auth.port; 
  const CFG = {
    apiKey: 'api-key',
    authEmulatorHost: `127.0.0.1:${PORT}`,
    projectId: 'test-project-id',
  }

  beforeAll(() => {
      initializeApp(CFG);
  });
  
  describe('Admin Token Generation', () => {
    it('should generate admin access token', async () => {
      const token = await getAdminAccessToken(true);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should cache admin access token', async () => {
      const token1 = await getAdminAccessToken(true);
      const token2 = await getAdminAccessToken(true);

      // Should return same token (cached)
      expect(token1).toBe(token2);
    });

    it('should generate valid admin access token in emulator mode', async () => {
      const token = await getAdminAccessToken(true);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('ID Token Verification', () => {
    // Note: These tests require a valid Firebase ID token from a real user
    // For now, we'll test the error cases that don't require a real token

    it('should throw error for empty token', async () => {
      await expect(verifyIdToken('')).rejects.toThrow('ID token is required');
    });

    it('should throw error for invalid JWT format', async () => {
      await expect(verifyIdToken('invalid.token')).rejects.toThrow('Invalid JWT format');
    });

    it('should throw error for malformed token', async () => {
      await expect(verifyIdToken('not-a-jwt')).rejects.toThrow();
    });

    it('should throw error for token with invalid algorithm', async () => {
      // Create a mock token with HS256 algorithm (should be RS256)
      const header = btoa(JSON.stringify({ alg: 'HS256', kid: 'test', typ: 'JWT' }))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const payload = btoa(JSON.stringify({ sub: 'test' }))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const signature = btoa('fake-signature')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const token = `${header}.${payload}.${signature}`;

      await expect(verifyIdToken(token)).rejects.toThrow('Invalid algorithm');
    });

    it('should throw error for expired token', async () => {
      // Create a token that's already expired
      const now = Math.floor(Date.now() / 1000);
      const header = btoa(JSON.stringify({ alg: 'none', kid: 'test', typ: 'JWT' }))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const payload = btoa(JSON.stringify({
        iss: EMU_ISS,
        aud: 'prmichaelsen-firebase-e2e',
        auth_time: now - 7200,
        iat: now - 7200,
        exp: now - 3600, // Expired 1 hour ago
        sub: 'test-user',
      })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const signature = btoa('fake-signature')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const token = `${header}.${payload}.${signature}`;

      await expect(verifyIdToken(token)).rejects.toThrow('Token has expired');
    });
  });

  describe('User Info Extraction', () => {
    it('should throw error for invalid token in getUserFromToken', async () => {
      await expect(getUserFromToken('invalid-token')).rejects.toThrow();
    });

    it('should throw error for empty token in getUserFromToken', async () => {
      await expect(getUserFromToken('')).rejects.toThrow('ID token is required');
    });
  });

  describe('Custom Token Creation', () => {
    it('should create a custom token with valid structure', async () => {
      const uid = 'test-user-123';
      const customClaims = {
        role: 'admin',
        premium: true,
      };

      const customToken = await createCustomToken(uid, customClaims);

      expect(customToken).toBeDefined();
      expect(typeof customToken).toBe('string');
      expect(customToken.split('.').length).toBe(3); // header.payload.signature
    });

    it('should create token with correct JWT structure', async () => {
      const uid = 'test-user-456';
      const token = await createCustomToken(uid);

      // Decode and verify structure (without calling Firebase)
      const [ headerB64, payloadB64 ] = token.split('.');
      const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      // Verify header
      expect(header.alg).toBe('none');
      expect(header.typ).toBe('JWT');

      // Verify payload
      expect(payload.uid).toBe(uid);
      expect(payload.iss).toContain(EMU_ISS);
      expect(payload.sub).toContain(EMU_ISS);
      expect(payload.exp).toBeDefined();
      expect(payload.exp * 1000).toBeGreaterThan(Date.now());
    });

    it('should include custom claims in token', async () => {
      const uid = 'test-user-789';
      const customClaims = {
        role: 'moderator',
        permissions: [ 'read', 'write' ],
        level: 5,
      };

      const token = await createCustomToken(uid, customClaims);

      const [ , payloadB64 ] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.uid).toBe(uid);
      expect(payload.claims).toEqual(customClaims);
    });

    it('should create token without custom claims', async () => {
      const uid = 'test-user-no-claims';
      const token = await createCustomToken(uid);

      const [ , payloadB64 ] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.uid).toBe(uid);
      expect(payload.claims).toBeUndefined();
    });

    it('should throw error for invalid UID', async () => {
      await expect(createCustomToken('')).rejects.toThrow('uid must be a non-empty string');
      await expect(createCustomToken('a'.repeat(129))).rejects.toThrow('uid must be at most 128 characters');
    });
  });

  describe('Custom Token Authentication Flow (E2E)', () => {

    it('should complete full auth flow: create token → exchange → verify', async () => {
      const uid = `e2e-test-${Date.now()}`;
      const customClaims = {
        role: 'tester',
        testRun: true,
        timestamp: Date.now(),
      };

      // Step 1: Create custom token
      const customToken = await createCustomToken(uid, customClaims);
      expect(customToken).toBeDefined();
      expect(typeof customToken).toBe('string');
      expect(customToken.split('.').length).toBe(3);

      // Step 2: Exchange for ID token
      const credentials = await signInWithCustomToken(customToken);

      expect(credentials.idToken).toBeDefined();
      expect(credentials.refreshToken).toBeDefined();
      expect(credentials.expiresIn).toBe('3600');

      // Step 3: Verify the ID token
      const decodedToken = await verifyIdToken(credentials.idToken);
      expect(decodedToken.uid).toBe(uid);
      // Custom claims are included in the decoded token
      expect((decodedToken as any).role).toBe('tester');
      expect((decodedToken as any).testRun).toBe(true);
    }, 30000);

    it('should throw error when API key is missing', async () => {
      // Temporarily unset API key
      const originalApiKey = process.env.FIREBASE_API_KEY;
      const originalPublicApiKey = process.env.PUBLIC_FIREBASE_API_KEY;
      delete process.env.FIREBASE_API_KEY;
      delete process.env.PUBLIC_FIREBASE_API_KEY;
      initializeApp({ ...CFG, apiKey: undefined })

      const customToken = await createCustomToken('test-user');

      await expect(signInWithCustomToken(customToken)).rejects.toThrow('Firebase API key not configured');

      // Restore API keys
      if (originalApiKey) process.env.FIREBASE_API_KEY = originalApiKey;
      if (originalPublicApiKey) process.env.PUBLIC_FIREBASE_API_KEY = originalPublicApiKey;
      initializeApp(CFG);
    });
  });

  describe('Session Cookies', () => {

    it('should create and verify session cookie', async () => {
      // Step 1: Create user and custom token
      const { uid } = await createUser({ email: `test-user${Date.now()}@example.com` });
      const customToken = await createCustomToken(uid);

      // Step 2: Exchange for ID token
      const credentials = await signInWithCustomToken(customToken);
      const idToken = credentials.idToken;

      // Step 3: Create session cookie (1 hour duration)
      const sessionCookie = await createSessionCookie(idToken, {
        expiresIn: 60 * 60 * 1000, // 1 hour
      });

      expect(sessionCookie).toBeDefined();
      expect(typeof sessionCookie).toBe('string');
      expect(sessionCookie.split('.').length).toBe(3); // JWT format

      // Step 4: Verify session cookie
      const decodedToken = await verifySessionCookie(sessionCookie);

      expect(decodedToken.uid).toBe(uid);
      expect(
        decodedToken.iss.includes('session.firebase.google.com') ||
        decodedToken.iss.includes('firebase-auth-emulator')
      ).toBe(true);
    }, 30000);

    it('should create session cookie with 14-day expiration', async () => {
      // Create custom token and exchange for ID token
      const { uid } = await createUser({ email: `test-user${Date.now()}@example.com` });
      const customToken = await createCustomToken(uid);
      const credentials = await signInWithCustomToken(customToken);

      // Create 14-day session cookie
      const sessionCookie = await createSessionCookie(credentials.idToken, {
        expiresIn: 60 * 60 * 24 * 14 * 1000, // 14 days
      });

      // Verify it
      const decodedToken = await verifySessionCookie(sessionCookie);

      expect(decodedToken.uid).toBe(uid);

      // Check expiration is approximately 14 days from now
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = decodedToken.exp - now;
      expect(expiresIn).toBeGreaterThan(13 * 24 * 60 * 60); // At least 13 days
      expect(expiresIn).toBeLessThan(15 * 24 * 60 * 60); // Less than 15 days
    }, 30000);

    it('should create session cookie with custom claims', async () => {
      // Create custom token with claims
      const { uid } = await createUser({ email: `test-user${Date.now()}@example.com` });
      const customClaims = {
        role: 'admin',
        premium: true,
        level: 5,
      };

      const customToken = await createCustomToken(uid, customClaims);
      const credentials = await signInWithCustomToken(customToken);

      // Create session cookie
      const sessionCookie = await createSessionCookie(credentials.idToken, {
        expiresIn: 60 * 60 * 1000, // 1 hour
      });

      // Verify session cookie preserves custom claims
      const decodedToken = await verifySessionCookie(sessionCookie);

      expect(decodedToken.uid).toBe(uid);
      expect((decodedToken as any).role).toBe('admin');
      expect((decodedToken as any).premium).toBe(true);
      expect((decodedToken as any).level).toBe(5);
    }, 30000);
  });
});