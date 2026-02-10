/**
 * Unit tests for config.ts
 * Tests SDK configuration and service account management
 */

import {
  initializeApp,
  getConfig,
  clearConfig,
  getServiceAccount,
  getProjectId,
} from './config';

describe('Config Management', () => {
  // Store original env vars
  const originalEnv = typeof process !== 'undefined' ? { ...process.env } : {};

  beforeEach(() => {
    // Clear config before each test
    clearConfig();
    
    // Reset environment variables
    if (typeof process !== 'undefined' && process.env) {
      delete process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY;
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.PUBLIC_FIREBASE_PROJECT_ID;
    }
  });

  afterEach(() => {
    // Restore original env vars
    if (typeof process !== 'undefined' && process.env) {
      process.env = { ...originalEnv };
    }
  });

  describe('initializeApp()', () => {
    it('should store configuration', () => {
      const config = {
        projectId: 'test-project',
        serviceAccount: { project_id: 'test' } as any,
      };

      initializeApp(config);
      const result = getConfig();

      expect(result).toEqual(config);
    });

    it('should handle service account object', () => {
      const serviceAccount = {
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'key123',
        private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
        client_email: 'test@test.iam.gserviceaccount.com',
        client_id: '123456',
        token_uri: 'https://oauth2.googleapis.com/token',
      };

      initializeApp({ serviceAccount });
      const result = getConfig();

      expect(result.serviceAccount).toEqual(serviceAccount);
    });

    it('should handle service account string', () => {
      const serviceAccountStr = JSON.stringify({
        type: 'service_account',
        project_id: 'test-project',
      });

      initializeApp({ serviceAccount: serviceAccountStr });
      const result = getConfig();

      expect(result.serviceAccount).toBe(serviceAccountStr);
    });

    it('should allow multiple initializations (overwrites)', () => {
      initializeApp({ projectId: 'project1' });
      expect(getConfig().projectId).toBe('project1');

      initializeApp({ projectId: 'project2' });
      expect(getConfig().projectId).toBe('project2');
    });

    it('should handle empty config', () => {
      initializeApp({});
      const result = getConfig();

      expect(result).toEqual({});
    });
  });

  describe('getConfig()', () => {
    it('should return empty object initially', () => {
      const result = getConfig();
      expect(result).toEqual({});
    });

    it('should return initialized config', () => {
      const config = { projectId: 'test' };
      initializeApp(config);

      const result = getConfig();
      expect(result).toEqual(config);
    });
  });

  describe('clearConfig()', () => {
    it('should clear configuration', () => {
      initializeApp({ projectId: 'test' });
      expect(getConfig().projectId).toBe('test');

      clearConfig();
      expect(getConfig()).toEqual({});
    });

    it('should allow re-initialization after clear', () => {
      initializeApp({ projectId: 'test1' });
      clearConfig();
      initializeApp({ projectId: 'test2' });

      expect(getConfig().projectId).toBe('test2');
    });
  });

  describe('getServiceAccount()', () => {
    const validServiceAccount = {
      type: 'service_account',
      project_id: 'test-project',
      private_key_id: 'key123',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
      client_email: 'test@test.iam.gserviceaccount.com',
      client_id: '123456',
      token_uri: 'https://oauth2.googleapis.com/token',
    };

    it('should return service account from config (object)', () => {
      initializeApp({ serviceAccount: validServiceAccount });

      const result = getServiceAccount();
      expect(result).toEqual(validServiceAccount);
    });

    it('should parse service account from config (string)', () => {
      initializeApp({ serviceAccount: JSON.stringify(validServiceAccount) });

      const result = getServiceAccount();
      expect(result).toEqual(validServiceAccount);
    });

    it('should fall back to environment variable', () => {
      if (typeof process !== 'undefined' && process.env) {
        process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY = JSON.stringify(validServiceAccount);

        const result = getServiceAccount();
        expect(result).toEqual(validServiceAccount);
      }
    });

    it('should prioritize config over environment', () => {
      const configAccount = { ...validServiceAccount, project_id: 'config-project' };
      const envAccount = { ...validServiceAccount, project_id: 'env-project' };

      if (typeof process !== 'undefined' && process.env) {
        process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY = JSON.stringify(envAccount);
      }
      initializeApp({ serviceAccount: configAccount });

      const result = getServiceAccount();
      expect(result.project_id).toBe('config-project');
    });

    it('should throw error if not configured', () => {
      expect(() => getServiceAccount()).toThrow(
        'Firebase service account not configured'
      );
    });

    it('should throw error for invalid JSON in environment', () => {
      if (typeof process !== 'undefined' && process.env) {
        process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY = 'invalid json';

        expect(() => getServiceAccount()).toThrow(
          'Failed to parse FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY'
        );
      }
    });

    it('should validate required fields', () => {
      const incompleteAccount = {
        type: 'service_account',
        project_id: 'test',
        // Missing other required fields
      };

      if (typeof process !== 'undefined' && process.env) {
        process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY = JSON.stringify(incompleteAccount);

        expect(() => getServiceAccount()).toThrow(
          'Service account is missing required field'
        );
      }
    });

    it('should validate all required fields', () => {
      const requiredFields = [
        'type',
        'project_id',
        'private_key_id',
        'private_key',
        'client_email',
        'client_id',
        'token_uri',
      ];

      requiredFields.forEach(missingField => {
        const account = { ...validServiceAccount };
        delete (account as any)[missingField];

        if (typeof process !== 'undefined' && process.env) {
          process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY = JSON.stringify(account);

          expect(() => getServiceAccount()).toThrow(
            `Service account is missing required field: ${missingField}`
          );
        }
      });
    });
  });

  describe('getProjectId()', () => {
    it('should return project ID from config', () => {
      initializeApp({ projectId: 'test-project' });

      const result = getProjectId();
      expect(result).toBe('test-project');
    });

    it('should fall back to FIREBASE_PROJECT_ID environment variable', () => {
      if (typeof process !== 'undefined' && process.env) {
        process.env.FIREBASE_PROJECT_ID = 'env-project';

        const result = getProjectId();
        expect(result).toBe('env-project');
      }
    });

    it('should fall back to PUBLIC_FIREBASE_PROJECT_ID environment variable', () => {
      if (typeof process !== 'undefined' && process.env) {
        process.env.PUBLIC_FIREBASE_PROJECT_ID = 'public-env-project';

        const result = getProjectId();
        expect(result).toBe('public-env-project');
      }
    });

    it('should prioritize FIREBASE_PROJECT_ID over PUBLIC_FIREBASE_PROJECT_ID', () => {
      if (typeof process !== 'undefined' && process.env) {
        process.env.FIREBASE_PROJECT_ID = 'private-project';
        process.env.PUBLIC_FIREBASE_PROJECT_ID = 'public-project';

        const result = getProjectId();
        expect(result).toBe('private-project');
      }
    });

    it('should prioritize config over environment', () => {
      if (typeof process !== 'undefined' && process.env) {
        process.env.FIREBASE_PROJECT_ID = 'env-project';
      }
      initializeApp({ projectId: 'config-project' });

      const result = getProjectId();
      expect(result).toBe('config-project');
    });

    it('should throw error if not configured', () => {
      expect(() => getProjectId()).toThrow(
        'Firebase project ID not configured'
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should work with full configuration', () => {
      const serviceAccount = {
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'key123',
        private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
        client_email: 'test@test.iam.gserviceaccount.com',
        client_id: '123456',
        token_uri: 'https://oauth2.googleapis.com/token',
      };

      initializeApp({
        projectId: 'my-project',
        serviceAccount,
      });

      expect(getProjectId()).toBe('my-project');
      expect(getServiceAccount()).toEqual(serviceAccount);
    });

    it('should work with environment variables only', () => {
      if (typeof process !== 'undefined' && process.env) {
        const serviceAccount = {
          type: 'service_account',
          project_id: 'test-project',
          private_key_id: 'key123',
          private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
          client_email: 'test@test.iam.gserviceaccount.com',
          client_id: '123456',
          token_uri: 'https://oauth2.googleapis.com/token',
        };

        process.env.FIREBASE_PROJECT_ID = 'env-project';
        process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY = JSON.stringify(serviceAccount);

        expect(getProjectId()).toBe('env-project');
        expect(getServiceAccount()).toEqual(serviceAccount);
      }
    });
  });
});
