/**
 * End-to-end tests for User Management
 * These tests run against a real Firebase project
 * 
 * Prerequisites:
 * - service-account.json file with valid credentials
 * - Firebase project: prmichaelsen-firebase-e2e
 * 
 * Run with: npm run test:e2e
 */

import { getServiceAccount, initializeApp } from './config';
import {
  getUserByEmail,
  getUserByUid,
  createUser,
  updateUser,
  deleteUser,
  listUsers,
  setCustomUserClaims,
  generatePasswordResetLink,
  generateEmailVerificationLink,
} from './user-management';
import * as fs from 'fs';
import * as path from 'path';

describe('User Management E2E Tests', () => {
  let testUserId: string;
  const testEmail = `test-user-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

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
      projectId: serviceAccount.project_id,
    });
  });

  afterAll(async () => {
    // Clean up test user if it exists
    if (testUserId) {
      try {
        await deleteUser(testUserId);
      } catch (error) {
        // User might already be deleted, ignore error
      }
    }
  });

  describe('createUser', () => {
    it('should create a new user with email and password', async () => {
      const user = await createUser({
        email: testEmail,
        password: testPassword,
        displayName: 'Test User',
        emailVerified: false,
      });

      expect(user).toBeDefined();
      expect(user.uid).toBeDefined();
      expect(user.email).toBe(testEmail);
      expect(user.displayName).toBe('Test User');
      expect(user.emailVerified).toBe(false);
      expect(user.disabled).toBe(false);

      // Save for cleanup
      testUserId = user.uid;
    });

    it('should throw error when creating user with existing email', async () => {
      await expect(
        createUser({
          email: testEmail,
          password: 'AnotherPassword123!',
        })
      ).rejects.toThrow();
    });
  });

  describe('getUserByEmail', () => {
    it('should get user by email', async () => {
      const user = await getUserByEmail(testEmail);

      expect(user).toBeDefined();
      expect(user?.uid).toBe(testUserId);
      expect(user?.email).toBe(testEmail);
      expect(user?.displayName).toBe('Test User');
    });

    it('should return null for non-existent email', async () => {
      const user = await getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('getUserByUid', () => {
    it('should get user by UID', async () => {
      const user = await getUserByUid(testUserId);

      expect(user).toBeDefined();
      expect(user?.uid).toBe(testUserId);
      expect(user?.email).toBe(testEmail);
      expect(user?.displayName).toBe('Test User');
    });

    it('should return null for non-existent UID', async () => {
      const user = await getUserByUid('nonexistent-uid-12345');
      expect(user).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user display name', async () => {
      const updatedUser = await updateUser(testUserId, {
        displayName: 'Updated Test User',
      });

      expect(updatedUser).toBeDefined();
      expect(updatedUser.uid).toBe(testUserId);
      expect(updatedUser.displayName).toBe('Updated Test User');
      expect(updatedUser.email).toBe(testEmail);
    });

    it('should update user email verification status', async () => {
      const updatedUser = await updateUser(testUserId, {
        emailVerified: true,
      });

      expect(updatedUser).toBeDefined();
      expect(updatedUser.emailVerified).toBe(true);
    });

    it('should update multiple properties at once', async () => {
      const updatedUser = await updateUser(testUserId, {
        displayName: 'Final Test User',
        photoURL: 'https://example.com/photo.jpg',
      });

      expect(updatedUser).toBeDefined();
      expect(updatedUser.displayName).toBe('Final Test User');
      expect(updatedUser.photoURL).toBe('https://example.com/photo.jpg');
    });

    it('should throw error when updating non-existent user', async () => {
      await expect(
        updateUser('nonexistent-uid-12345', {
          displayName: 'Should Fail',
        })
      ).rejects.toThrow();
    });
  });

  describe('setCustomUserClaims', () => {
    it('should set custom claims on user', async () => {
      await setCustomUserClaims(testUserId, {
        role: 'admin',
        premium: true,
        level: 5,
      });

      // Verify claims were set by getting the user
      const user = await getUserByUid(testUserId);
      expect(user?.customClaims).toBeDefined();
      expect(user?.customClaims?.role).toBe('admin');
      expect(user?.customClaims?.premium).toBe(true);
      expect(user?.customClaims?.level).toBe(5);
    });

    it('should update existing custom claims', async () => {
      await setCustomUserClaims(testUserId, {
        role: 'user',
        premium: false,
      });

      const user = await getUserByUid(testUserId);
      expect(user?.customClaims?.role).toBe('user');
      expect(user?.customClaims?.premium).toBe(false);
    });

    it('should clear custom claims with null', async () => {
      await setCustomUserClaims(testUserId, null);

      const user = await getUserByUid(testUserId);
      // Custom claims should be empty object or undefined
      expect(user?.customClaims).toEqual({});
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        setCustomUserClaims('nonexistent-uid-12345', { role: 'admin' })
      ).rejects.toThrow();
    });
  });

  describe('listUsers', () => {
    // Note: listUsers endpoint may not be available in all Firebase projects
    // Skipping these tests as the REST API endpoint varies by project configuration
    it.skip('should list users with default pagination', async () => {
      const result = await listUsers();

      expect(result).toBeDefined();
      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users.length).toBeGreaterThan(0);

      // Our test user should be in the list
      const testUser = result.users.find(u => u.uid === testUserId);
      expect(testUser).toBeDefined();
      expect(testUser?.email).toBe(testEmail);
    });

    it.skip('should list users with custom page size', async () => {
      const result = await listUsers(5);

      expect(result).toBeDefined();
      expect(result.users).toBeDefined();
      expect(result.users.length).toBeLessThanOrEqual(5);
    });

    it.skip('should support pagination with page token', async () => {
      const firstPage = await listUsers(2);

      expect(firstPage.users.length).toBeLessThanOrEqual(2);

      if (firstPage.pageToken) {
        const secondPage = await listUsers(2, firstPage.pageToken);

        expect(secondPage.users).toBeDefined();
        // Second page should have different users
        const firstPageIds = firstPage.users.map(u => u.uid);
        const secondPageIds = secondPage.users.map(u => u.uid);
        const overlap = firstPageIds.filter(id => secondPageIds.includes(id));
        expect(overlap.length).toBe(0);
      }
    });

    it.skip('should return all user properties', async () => {
      const result = await listUsers(10);
      const user = result.users[ 0 ];

      expect(user).toBeDefined();
      expect(user.uid).toBeDefined();
      expect(typeof user.emailVerified).toBe('boolean');
      expect(typeof user.disabled).toBe('boolean');
      expect(user.metadata).toBeDefined();
      expect(user.metadata.creationTime).toBeDefined();
      expect(user.metadata.lastSignInTime).toBeDefined();
      expect(Array.isArray(user.providerData)).toBe(true);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      // Delete the test user
      await deleteUser(testUserId);

      // Verify user is deleted
      const user = await getUserByUid(testUserId);
      expect(user).toBeNull();

      // Clear testUserId so afterAll doesn't try to delete again
      testUserId = '';
    });

    it('should throw error when deleting non-existent user', async () => {
      await expect(deleteUser('nonexistent-uid-12345')).rejects.toThrow();
    });

    it('should throw error when deleting already deleted user', async () => {
      // Try to delete the user we just deleted
      await expect(deleteUser(testUserId || 'deleted-user')).rejects.toThrow();
    });
  });

  describe('generatePasswordResetLink', () => {
    let user1Id: string;
    let user2Id: string;
    const email1 = `reset-test-1-${Date.now()}@example.com`;
    const email2 = `reset-test-2-${Date.now()}@example.com`;

    beforeAll(async () => {
      const user1 = await createUser({ email: email1, password: 'ResetTest123!' });
      user1Id = user1.uid;
      const user2 = await createUser({ email: email2, password: 'ResetTest123!' });
      user2Id = user2.uid;
    });

    afterAll(async () => {
      for (const id of [user1Id, user2Id]) {
        if (id) {
          try {
            await deleteUser(id);
          } catch {
            // ignore
          }
        }
      }
    });

    it('should generate a password reset link for an existing user', async () => {
      const link = await generatePasswordResetLink(email1);

      expect(link).toBeDefined();
      expect(typeof link).toBe('string');
      expect(link).toContain('oobCode');
    });

    it('should generate a password reset link with actionCodeSettings', async () => {
      const link = await generatePasswordResetLink(email2, {
        url: `https://${getServiceAccount().project_id}.firebaseapp.com/continue`,
      });

      expect(link).toBeDefined();
      expect(typeof link).toBe('string');
      expect(link).toContain('oobCode');
      expect(link).toContain('continueUrl');
    });

    it('should throw error for non-existent email', async () => {
      await expect(
        generatePasswordResetLink(`nonexistent-${Date.now()}@example.com`)
      ).rejects.toThrow();
    });
  });

  describe('generateEmailVerificationLink', () => {
    let user1Id: string;
    let user2Id: string;
    const email1 = `email-test-1-${Date.now()}@example.com`;
    const email2 = `email-test-2-${Date.now()}@example.com`;

    beforeAll(async () => {
      const user1 = await createUser({ email: email1, password: 'EmailTest123!' });
      user1Id = user1.uid;
      const user2 = await createUser({ email: email2, password: 'EmailTest123!' });
      user2Id = user2.uid;
    });

    afterAll(async () => {
      for (const id of [user1Id, user2Id]) {
        if (id) {
          try {
            await deleteUser(id);
          } catch {
            // ignore
          }
        }
      }
    });

    it('should generate a email verification link for an existing user', async () => {
      const link = await generateEmailVerificationLink(email1);

      expect(link).toBeDefined();
      expect(typeof link).toBe('string');
      expect(link).toContain('oobCode');
    });

    it('should generate a email verification link with actionCodeSettings', async () => {
      const link = await generateEmailVerificationLink(email2, {
        url: `https://${getServiceAccount().project_id}.firebaseapp.com/continue`,
      });

      expect(link).toBeDefined();
      expect(typeof link).toBe('string');
      expect(link).toContain('oobCode');
      expect(link).toContain('continueUrl');
    });

    it('should throw error for non-existent email', async () => {
      await expect(
        generateEmailVerificationLink(`nonexistent-${Date.now()}@example.com`)
      ).rejects.toThrow();
    });
  });

  describe('Complete User Lifecycle', () => {
    it('should handle complete user lifecycle: create, update, delete', async () => {
      const lifecycleEmail = `lifecycle-${Date.now()}@example.com`;

      // 1. Create user
      const createdUser = await createUser({
        email: lifecycleEmail,
        password: 'LifecycleTest123!',
        displayName: 'Lifecycle User',
      });

      expect(createdUser.uid).toBeDefined();
      expect(createdUser.email).toBe(lifecycleEmail);

      // 2. Get user by email
      const fetchedByEmail = await getUserByEmail(lifecycleEmail);
      expect(fetchedByEmail?.uid).toBe(createdUser.uid);

      // 3. Get user by UID
      const fetchedByUid = await getUserByUid(createdUser.uid);
      expect(fetchedByUid?.email).toBe(lifecycleEmail);

      // 4. Update user
      const updatedUser = await updateUser(createdUser.uid, {
        displayName: 'Updated Lifecycle User',
        emailVerified: true,
      });
      expect(updatedUser.displayName).toBe('Updated Lifecycle User');
      expect(updatedUser.emailVerified).toBe(true);

      // 5. Set custom claims
      await setCustomUserClaims(createdUser.uid, {
        testClaim: 'testValue',
      });
      const userWithClaims = await getUserByUid(createdUser.uid);
      expect(userWithClaims?.customClaims?.testClaim).toBe('testValue');

      // 6. Delete user
      await deleteUser(createdUser.uid);
      const deletedUser = await getUserByUid(createdUser.uid);
      expect(deletedUser).toBeNull();
    });
  });
});










/**
 * Emulated User Mangemant E2E Tests
 */
const emuRunning = process?.env?.AUTH_EMULATOR_RUNNING === 'true';

(emuRunning ? describe : describe.skip)(`User Management E2E Emulator Tests${emuRunning ? '' : ' - emulator not running'}`, () => {
  let testUserId: string;
  const testEmail = `test-user-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  beforeAll(() => {
    const port = JSON.parse(String.fromCharCode(...new Uint8Array(fs.readFileSync(path.join(__dirname, '../firebase.json'))))).emulators.auth.port;

    // Initialize with service account and project ID
    initializeApp({
      authEmulatorHost: `127.0.0.1:${port}`,
      projectId: 'test-project-id',
    });
  });

  afterAll(async () => {
    // Clean up test user if it exists
    if (testUserId) {
      try {
        await deleteUser(testUserId);
      } catch (error) {
        // User might already be deleted, ignore error
      }
    }
  });

  describe('createUser', () => {
    it('should create a new user with email and password', async () => {
      const user = await createUser({
        email: testEmail,
        password: testPassword,
        displayName: 'Test User',
        emailVerified: false,
      });

      expect(user).toBeDefined();
      expect(user.uid).toBeDefined();
      expect(user.email).toBe(testEmail);
      expect(user.displayName).toBe('Test User');
      expect(user.emailVerified).toBe(false);
      expect(user.disabled).toBe(false);

      // Save for cleanup
      testUserId = user.uid;
    });

    it('should throw error when creating user with existing email', async () => {
      await expect(
        createUser({
          email: testEmail,
          password: 'AnotherPassword123!',
        })
      ).rejects.toThrow();
    });
  });

  describe('getUserByEmail', () => {
    it('should get user by email', async () => {
      const user = await getUserByEmail(testEmail);

      expect(user).toBeDefined();
      expect(user?.uid).toBe(testUserId);
      expect(user?.email).toBe(testEmail);
      expect(user?.displayName).toBe('Test User');
    });

    it('should return null for non-existent email', async () => {
      const user = await getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('getUserByUid', () => {
    it('should get user by UID', async () => {
      const user = await getUserByUid(testUserId);

      expect(user).toBeDefined();
      expect(user?.uid).toBe(testUserId);
      expect(user?.email).toBe(testEmail);
      expect(user?.displayName).toBe('Test User');
    });

    it('should return null for non-existent UID', async () => {
      const user = await getUserByUid('nonexistent-uid-12345');
      expect(user).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user display name', async () => {
      const updatedUser = await updateUser(testUserId, {
        displayName: 'Updated Test User',
      });

      expect(updatedUser).toBeDefined();
      expect(updatedUser.uid).toBe(testUserId);
      expect(updatedUser.displayName).toBe('Updated Test User');
      expect(updatedUser.email).toBe(testEmail);
    });

    it('should update user email verification status', async () => {
      const updatedUser = await updateUser(testUserId, {
        emailVerified: true,
      });

      expect(updatedUser).toBeDefined();
      expect(updatedUser.emailVerified).toBe(true);
    });

    it('should update multiple properties at once', async () => {
      const updatedUser = await updateUser(testUserId, {
        displayName: 'Final Test User',
        photoURL: 'https://example.com/photo.jpg',
      });

      expect(updatedUser).toBeDefined();
      expect(updatedUser.displayName).toBe('Final Test User');
      expect(updatedUser.photoURL).toBe('https://example.com/photo.jpg');
    });

    it('should throw error when updating non-existent user', async () => {
      await expect(
        updateUser('nonexistent-uid-12345', {
          displayName: 'Should Fail',
        })
      ).rejects.toThrow();
    });
  });

  describe('setCustomUserClaims', () => {
    it('should set custom claims on user', async () => {
      await setCustomUserClaims(testUserId, {
        role: 'admin',
        premium: true,
        level: 5,
      });

      // Verify claims were set by getting the user
      const user = await getUserByUid(testUserId);
      expect(user?.customClaims).toBeDefined();
      expect(user?.customClaims?.role).toBe('admin');
      expect(user?.customClaims?.premium).toBe(true);
      expect(user?.customClaims?.level).toBe(5);
    });

    it('should update existing custom claims', async () => {
      await setCustomUserClaims(testUserId, {
        role: 'user',
        premium: false,
      });

      const user = await getUserByUid(testUserId);
      expect(user?.customClaims?.role).toBe('user');
      expect(user?.customClaims?.premium).toBe(false);
    });

    it('should clear custom claims with null', async () => {
      await setCustomUserClaims(testUserId, null);

      const user = await getUserByUid(testUserId);
      // Custom claims should be empty object or undefined
      expect(user?.customClaims).toEqual({});
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        setCustomUserClaims('nonexistent-uid-12345', { role: 'admin' })
      ).rejects.toThrow();
    });
  });

  describe('listUsers', () => {
    // Note: listUsers endpoint may not be available in all Firebase projects
    // Skipping these tests as the REST API endpoint varies by project configuration
    it.skip('should list users with default pagination', async () => {
      const result = await listUsers();

      expect(result).toBeDefined();
      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users.length).toBeGreaterThan(0);

      // Our test user should be in the list
      const testUser = result.users.find(u => u.uid === testUserId);
      expect(testUser).toBeDefined();
      expect(testUser?.email).toBe(testEmail);
    });

    it.skip('should list users with custom page size', async () => {
      const result = await listUsers(5);

      expect(result).toBeDefined();
      expect(result.users).toBeDefined();
      expect(result.users.length).toBeLessThanOrEqual(5);
    });

    it.skip('should support pagination with page token', async () => {
      const firstPage = await listUsers(2);

      expect(firstPage.users.length).toBeLessThanOrEqual(2);

      if (firstPage.pageToken) {
        const secondPage = await listUsers(2, firstPage.pageToken);

        expect(secondPage.users).toBeDefined();
        // Second page should have different users
        const firstPageIds = firstPage.users.map(u => u.uid);
        const secondPageIds = secondPage.users.map(u => u.uid);
        const overlap = firstPageIds.filter(id => secondPageIds.includes(id));
        expect(overlap.length).toBe(0);
      }
    });

    it.skip('should return all user properties', async () => {
      const result = await listUsers(10);
      const user = result.users[ 0 ];

      expect(user).toBeDefined();
      expect(user.uid).toBeDefined();
      expect(typeof user.emailVerified).toBe('boolean');
      expect(typeof user.disabled).toBe('boolean');
      expect(user.metadata).toBeDefined();
      expect(user.metadata.creationTime).toBeDefined();
      expect(user.metadata.lastSignInTime).toBeDefined();
      expect(Array.isArray(user.providerData)).toBe(true);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      // Delete the test user
      await deleteUser(testUserId);

      // Verify user is deleted
      const user = await getUserByUid(testUserId);
      expect(user).toBeNull();

      // Clear testUserId so afterAll doesn't try to delete again
      testUserId = '';
    });

    it('should throw error when deleting non-existent user', async () => {
      await expect(deleteUser('nonexistent-uid-12345')).rejects.toThrow();
    });

    it('should throw error when deleting already deleted user', async () => {
      // Try to delete the user we just deleted
      await expect(deleteUser(testUserId || 'deleted-user')).rejects.toThrow();
    });
  });

  describe('generatePasswordResetLink', () => {
    let resetTestUserId: string;
    const resetTestEmail = `reset-test-${Date.now()}@example.com`;

    beforeAll(async () => {
      const user = await createUser({
        email: resetTestEmail,
        password: 'ResetTest123!',
      });
      resetTestUserId = user.uid;
    });

    afterAll(async () => {
      if (resetTestUserId) {
        try {
          await deleteUser(resetTestUserId);
        } catch {
          // ignore
        }
      }
    });

    it('should generate a password reset link for an existing user', async () => {
      const link = await generatePasswordResetLink(resetTestEmail);

      expect(link).toBeDefined();
      expect(typeof link).toBe('string');
      expect(link).toContain('oobCode');
    });

    it('should generate a password reset link with actionCodeSettings', async () => {
      const link = await generatePasswordResetLink(resetTestEmail, {
        url: 'htp://127.0.0.1:4200/continue',
      });

      expect(link).toBeDefined();
      expect(typeof link).toBe('string');
      expect(link).toContain('oobCode');
      expect(link).toContain('continueUrl');
    });

    it('should throw error for non-existent email', async () => {
      await expect(
        generatePasswordResetLink(`nonexistent-${Date.now()}@example.com`)
      ).rejects.toThrow();
    });
  });

  describe('generateEmailVerificationLink', () => {
    let resetTestUserId: string;
    const resetTestEmail = `email-test-${Date.now()}@example.com`;

    beforeAll(async () => {
      const user = await createUser({
        email: resetTestEmail,
        password: 'EmailTest123!',
      });
      resetTestUserId = user.uid;
    });

    afterAll(async () => {
      if (resetTestUserId) {
        try {
          await deleteUser(resetTestUserId);
        } catch {
          // ignore
        }
      }
    });

    it('should generate a email verification link for an existing user', async () => {
      const link = await generateEmailVerificationLink(resetTestEmail);

      expect(link).toBeDefined();
      expect(typeof link).toBe('string');
      expect(link).toContain('oobCode');
    });

    it('should generate a email verification link with actionCodeSettings', async () => {
      const link = await generateEmailVerificationLink(resetTestEmail, {
        url: 'http://127.0.0.1:4200/continue',
      });

      expect(link).toBeDefined();
      expect(typeof link).toBe('string');
      expect(link).toContain('oobCode');
      expect(link).toContain('continueUrl');
    });

    it('should throw error for non-existent email', async () => {
      await expect(
        generateEmailVerificationLink(`nonexistent-${Date.now()}@example.com`)
      ).rejects.toThrow();
    });
  });

  describe('Complete User Lifecycle', () => {
    it('should handle complete user lifecycle: create, update, delete', async () => {
      const lifecycleEmail = `lifecycle-${Date.now()}@example.com`;

      // 1. Create user
      const createdUser = await createUser({
        email: lifecycleEmail,
        password: 'LifecycleTest123!',
        displayName: 'Lifecycle User',
      });

      expect(createdUser.uid).toBeDefined();
      expect(createdUser.email).toBe(lifecycleEmail);

      // 2. Get user by email
      const fetchedByEmail = await getUserByEmail(lifecycleEmail);
      expect(fetchedByEmail?.uid).toBe(createdUser.uid);

      // 3. Get user by UID
      const fetchedByUid = await getUserByUid(createdUser.uid);
      expect(fetchedByUid?.email).toBe(lifecycleEmail);

      // 4. Update user
      const updatedUser = await updateUser(createdUser.uid, {
        displayName: 'Updated Lifecycle User',
        emailVerified: true,
      });
      expect(updatedUser.displayName).toBe('Updated Lifecycle User');
      expect(updatedUser.emailVerified).toBe(true);

      // 5. Set custom claims
      await setCustomUserClaims(createdUser.uid, {
        testClaim: 'testValue',
      });
      const userWithClaims = await getUserByUid(createdUser.uid);
      expect(userWithClaims?.customClaims?.testClaim).toBe('testValue');

      // 6. Delete user
      await deleteUser(createdUser.uid);
      const deletedUser = await getUserByUid(createdUser.uid);
      expect(deletedUser).toBeNull();
    });
  });
});