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
import { verifyIdToken, getUserFromToken, createCustomToken } from './auth';
import { getAdminAccessToken } from './token-generation';
import * as fs from 'fs';
import * as path from 'path';

describe('Auth E2E Tests', () => {
  beforeAll(() => {
    // Load service account from filesystem
    const serviceAccountPath = path.join(__dirname, '../service-account.json');
    
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
        iss: 'https://securetoken.google.com/prmichaelsen-firebase-e2e',
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

  describe('Token Format Support', () => {
    it('should handle Firebase v9 token format (securetoken)', async () => {
      // This test verifies the issuer validation accepts v9 format
      const now = Math.floor(Date.now() / 1000);
      const header = btoa(JSON.stringify({ alg: 'RS256', kid: 'test', typ: 'JWT' }))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const payload = btoa(JSON.stringify({
        iss: 'https://securetoken.google.com/prmichaelsen-firebase-e2e',
        aud: 'prmichaelsen-firebase-e2e',
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
        iss: 'https://session.firebase.google.com/prmichaelsen-firebase-e2e',
        aud: 'prmichaelsen-firebase-e2e',
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
      const [headerB64, payloadB64] = token.split('.');
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
        permissions: ['read', 'write'],
        level: 5,
      };
      
      const token = await createCustomToken(uid, customClaims);
      
      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      
      expect(payload.uid).toBe(uid);
      expect(payload.claims).toEqual(customClaims);
    });

    it('should create token without custom claims', async () => {
      const uid = 'test-user-no-claims';
      const token = await createCustomToken(uid);
      
      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      
      expect(payload.uid).toBe(uid);
      expect(payload.claims).toBeUndefined();
    });

    it('should throw error for invalid UID', async () => {
      await expect(createCustomToken('')).rejects.toThrow('uid must be a non-empty string');
      await expect(createCustomToken('a'.repeat(129))).rejects.toThrow('uid must be at most 128 characters');
    });
  });
});
