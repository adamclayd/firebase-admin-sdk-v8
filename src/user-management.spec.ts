/**
 * User Management Tests
 */

import {
  getUserByEmail,
  getUserByUid,
  createUser,
  updateUser,
  deleteUser,
  listUsers,
  setCustomUserClaims,
  generatePasswordResetLink,
} from './user-management';
import * as tokenGeneration from './token-generation';
import * as serviceAccount from './service-account';

// Mock dependencies
jest.mock('./token-generation');
jest.mock('./service-account');

const mockGetAdminAccessToken = tokenGeneration.getAdminAccessToken as jest.MockedFunction<
  typeof tokenGeneration.getAdminAccessToken
>;
const mockGetProjectId = serviceAccount.getProjectId as jest.MockedFunction<
  typeof serviceAccount.getProjectId
>;

describe('User Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProjectId.mockReturnValue('test-project');
    mockGetAdminAccessToken.mockResolvedValue('mock-access-token');
    global.fetch = jest.fn();
  });

  describe('getUserByEmail', () => {
    it('should get user by email successfully', async () => {
      const mockUser = {
        localId: 'user123',
        email: 'test@example.com',
        emailVerified: true,
        displayName: 'Test User',
        photoUrl: 'https://example.com/photo.jpg',
        disabled: false,
        createdAt: '1609459200000',
        lastLoginAt: '1609545600000',
        providerUserInfo: [],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ users: [mockUser] }),
      });

      const result = await getUserByEmail('test@example.com');

      expect(result).toEqual({
        uid: 'user123',
        email: 'test@example.com',
        emailVerified: true,
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
        disabled: false,
        metadata: {
          creationTime: '2021-01-01T00:00:00.000Z',
          lastSignInTime: '2021-01-02T00:00:00.000Z',
        },
        providerData: [],
        customClaims: undefined,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://identitytoolkit.googleapis.com/v1/projects/test-project/accounts:lookup',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-access-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: ['test@example.com'] }),
        }
      );
    });

    it('should return null when user not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ users: [] }),
      });

      const result = await getUserByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('should throw error for invalid email', async () => {
      await expect(getUserByEmail('')).rejects.toThrow('email must be a non-empty string');
      await expect(getUserByEmail(null as any)).rejects.toThrow('email must be a non-empty string');
    });

    it('should throw error on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      await expect(getUserByEmail('test@example.com')).rejects.toThrow(
        'Failed to get user by email: 400 Bad Request'
      );
    });
  });

  describe('getUserByUid', () => {
    it('should get user by UID successfully', async () => {
      const mockUser = {
        localId: 'user123',
        email: 'test@example.com',
        emailVerified: true,
        disabled: false,
        createdAt: '1609459200000',
        lastLoginAt: '1609545600000',
        providerUserInfo: [],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ users: [mockUser] }),
      });

      const result = await getUserByUid('user123');

      expect(result).toEqual({
        uid: 'user123',
        email: 'test@example.com',
        emailVerified: true,
        disabled: false,
        metadata: {
          creationTime: '2021-01-01T00:00:00.000Z',
          lastSignInTime: '2021-01-02T00:00:00.000Z',
        },
        providerData: [],
        customClaims: undefined,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://identitytoolkit.googleapis.com/v1/projects/test-project/accounts:lookup',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-access-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ localId: ['user123'] }),
        }
      );
    });

    it('should return null when user not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ users: [] }),
      });

      const result = await getUserByUid('notfound');

      expect(result).toBeNull();
    });

    it('should throw error for invalid UID', async () => {
      await expect(getUserByUid('')).rejects.toThrow('uid must be a non-empty string');
      await expect(getUserByUid(null as any)).rejects.toThrow('uid must be a non-empty string');
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const mockCreatedUser = {
        localId: 'newuser123',
      };

      const mockUserRecord = {
        localId: 'newuser123',
        email: 'new@example.com',
        emailVerified: false,
        displayName: 'New User',
        disabled: false,
        createdAt: '1609459200000',
        lastLoginAt: '1609459200000',
        providerUserInfo: [],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCreatedUser,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ users: [mockUserRecord] }),
        });

      const result = await createUser({
        email: 'new@example.com',
        password: 'password123',
        displayName: 'New User',
      });

      expect(result.uid).toBe('newuser123');
      expect(result.email).toBe('new@example.com');
      expect(result.displayName).toBe('New User');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://identitytoolkit.googleapis.com/v1/projects/test-project/accounts',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-access-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'new@example.com',
            password: 'password123',
            displayName: 'New User',
          }),
        }
      );
    });

    it('should create user with all properties', async () => {
      const mockCreatedUser = { localId: 'newuser123' };
      const mockUserRecord = {
        localId: 'newuser123',
        email: 'new@example.com',
        emailVerified: true,
        displayName: 'New User',
        photoUrl: 'https://example.com/photo.jpg',
        phoneNumber: '+1234567890',
        disabled: false,
        createdAt: '1609459200000',
        lastLoginAt: '1609459200000',
        providerUserInfo: [],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCreatedUser,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ users: [mockUserRecord] }),
        });

      const result = await createUser({
        email: 'new@example.com',
        password: 'password123',
        displayName: 'New User',
        photoURL: 'https://example.com/photo.jpg',
        phoneNumber: '+1234567890',
        emailVerified: true,
        disabled: false,
      });

      expect(result.uid).toBe('newuser123');
      expect(result.phoneNumber).toBe('+1234567890');
    });

    it('should throw error for invalid properties', async () => {
      await expect(createUser(null as any)).rejects.toThrow('properties must be an object');
      await expect(createUser(undefined as any)).rejects.toThrow('properties must be an object');
    });

    it('should throw error on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Email already exists',
      });

      await expect(
        createUser({ email: 'existing@example.com', password: 'password123' })
      ).rejects.toThrow('Failed to create user: 400 Email already exists');
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const mockUserRecord = {
        localId: 'user123',
        email: 'updated@example.com',
        emailVerified: true,
        displayName: 'Updated User',
        disabled: false,
        createdAt: '1609459200000',
        lastLoginAt: '1609545600000',
        providerUserInfo: [],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ users: [mockUserRecord] }),
        });

      const result = await updateUser('user123', {
        email: 'updated@example.com',
        displayName: 'Updated User',
      });

      expect(result.uid).toBe('user123');
      expect(result.email).toBe('updated@example.com');
      expect(result.displayName).toBe('Updated User');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://identitytoolkit.googleapis.com/v1/projects/test-project/accounts:update',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-access-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            localId: 'user123',
            email: 'updated@example.com',
            displayName: 'Updated User',
          }),
        }
      );
    });

    it('should update user with disabled flag', async () => {
      const mockUserRecord = {
        localId: 'user123',
        email: 'test@example.com',
        disabled: true,
        createdAt: '1609459200000',
        lastLoginAt: '1609545600000',
        providerUserInfo: [],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ users: [mockUserRecord] }),
        });

      const result = await updateUser('user123', { disabled: true });

      expect(result.disabled).toBe(true);

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.disableUser).toBe(true);
    });

    it('should throw error for invalid UID', async () => {
      await expect(updateUser('', { email: 'test@example.com' })).rejects.toThrow(
        'uid must be a non-empty string'
      );
    });

    it('should throw error for invalid properties', async () => {
      await expect(updateUser('user123', null as any)).rejects.toThrow(
        'properties must be an object'
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await deleteUser('user123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://identitytoolkit.googleapis.com/v1/projects/test-project/accounts:delete',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-access-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ localId: 'user123' }),
        }
      );
    });

    it('should throw error for invalid UID', async () => {
      await expect(deleteUser('')).rejects.toThrow('uid must be a non-empty string');
      await expect(deleteUser(null as any)).rejects.toThrow('uid must be a non-empty string');
    });

    it('should throw error on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'User not found',
      });

      await expect(deleteUser('user123')).rejects.toThrow(
        'Failed to delete user: 404 User not found'
      );
    });
  });

  describe('listUsers', () => {
    it('should list users successfully', async () => {
      const mockUsers = [
        {
          localId: 'user1',
          email: 'user1@example.com',
          emailVerified: true,
          disabled: false,
          createdAt: '1609459200000',
          lastLoginAt: '1609545600000',
          providerUserInfo: [],
        },
        {
          localId: 'user2',
          email: 'user2@example.com',
          emailVerified: false,
          disabled: false,
          createdAt: '1609459200000',
          lastLoginAt: '1609545600000',
          providerUserInfo: [],
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          users: mockUsers,
          nextPageToken: 'next-page-token',
        }),
      });

      const result = await listUsers(10);

      expect(result.users).toHaveLength(2);
      expect(result.users[0].uid).toBe('user1');
      expect(result.users[1].uid).toBe('user2');
      expect(result.pageToken).toBe('next-page-token');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://identitytoolkit.googleapis.com/v1/projects/test-project/accounts:query?maxResults=10',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer mock-access-token',
          },
        }
      );
    });

    it('should list users with page token', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ users: [] }),
      });

      await listUsers(50, 'page-token-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://identitytoolkit.googleapis.com/v1/projects/test-project/accounts:query?maxResults=50&nextPageToken=page-token-123',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer mock-access-token',
          },
        }
      );
    });

    it('should use default maxResults of 1000', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ users: [] }),
      });

      await listUsers();

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain('maxResults=1000');
    });

    it('should throw error for invalid maxResults', async () => {
      await expect(listUsers(0)).rejects.toThrow(
        'maxResults must be a number between 1 and 1000'
      );
      await expect(listUsers(1001)).rejects.toThrow(
        'maxResults must be a number between 1 and 1000'
      );
      await expect(listUsers(-1)).rejects.toThrow(
        'maxResults must be a number between 1 and 1000'
      );
    });

    it('should return empty array when no users', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await listUsers();

      expect(result.users).toEqual([]);
      expect(result.pageToken).toBeUndefined();
    });
  });

  describe('setCustomUserClaims', () => {
    it('should set custom claims successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const customClaims = { role: 'admin', premium: true };
      await setCustomUserClaims('user123', customClaims);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://identitytoolkit.googleapis.com/v1/projects/test-project/accounts:update',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-access-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            localId: 'user123',
            customAttributes: JSON.stringify(customClaims),
          }),
        }
      );
    });

    it('should clear custom claims with null', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await setCustomUserClaims('user123', null);

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.customAttributes).toBe('{}');
    });

    it('should throw error for invalid UID', async () => {
      await expect(setCustomUserClaims('', { role: 'admin' })).rejects.toThrow(
        'uid must be a non-empty string'
      );
    });

    it('should throw error for claims exceeding 1000 bytes', async () => {
      const largeClaims = { data: 'x'.repeat(1001) };

      await expect(setCustomUserClaims('user123', largeClaims)).rejects.toThrow(
        'customClaims must be less than 1000 bytes when serialized'
      );
    });

    it('should throw error on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid claims',
      });

      await expect(setCustomUserClaims('user123', { role: 'admin' })).rejects.toThrow(
        'Failed to set custom claims: 400 Invalid claims'
      );
    });
  });

  describe('generatePasswordResetLink', () => {
    it('should generate password reset link successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ oobLink: 'https://example.com/reset?oobCode=abc123' }),
      });

      const result = await generatePasswordResetLink('test@example.com');

      expect(result).toBe('https://example.com/reset?oobCode=abc123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://identitytoolkit.googleapis.com/v1/projects/test-project/accounts:sendOobCode',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-access-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestType: 'PASSWORD_RESET',
            email: 'test@example.com',
            returnOobLink: true,
          }),
        }
      );
    });

    it('should include actionCodeSettings in request', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ oobLink: 'https://example.com/reset?oobCode=abc123' }),
      });

      await generatePasswordResetLink('test@example.com', {
        url: 'https://example.com/continue',
        handleCodeInApp: true,
        iOS: { bundleId: 'com.example.ios' },
        android: {
          packageName: 'com.example.android',
          installApp: true,
          minimumVersion: '12',
        },
        dynamicLinkDomain: 'example.page.link',
        linkDomain: 'project.firebaseapp.com',
      });

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.continueUrl).toBe('https://example.com/continue');
      expect(callBody.canHandleCodeInApp).toBe(true);
      expect(callBody.iOSBundleId).toBe('com.example.ios');
      expect(callBody.androidPackageName).toBe('com.example.android');
      expect(callBody.androidInstallApp).toBe(true);
      expect(callBody.androidMinimumVersion).toBe('12');
      expect(callBody.dynamicLinkDomain).toBe('example.page.link');
      expect(callBody.linkDomain).toBe('project.firebaseapp.com');
    });

    it('should work without actionCodeSettings', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ oobLink: 'https://example.com/reset?oobCode=abc123' }),
      });

      await generatePasswordResetLink('test@example.com');

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.continueUrl).toBeUndefined();
      expect(callBody.canHandleCodeInApp).toBeUndefined();
    });

    it('should throw error for invalid email', async () => {
      await expect(generatePasswordResetLink('')).rejects.toThrow(
        'email must be a non-empty string'
      );
      await expect(generatePasswordResetLink(null as any)).rejects.toThrow(
        'email must be a non-empty string'
      );
    });

    it('should throw error on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'EMAIL_NOT_FOUND',
      });

      await expect(generatePasswordResetLink('nonexistent@example.com')).rejects.toThrow(
        'Failed to generate password reset link: 400 EMAIL_NOT_FOUND'
      );
    });

    it('should throw error when oobLink is missing from response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await expect(generatePasswordResetLink('test@example.com')).rejects.toThrow(
        'Password reset link not returned by server'
      );
    });
  });

  describe('convertToUserRecord', () => {
    it('should handle user with custom claims', async () => {
      const mockUser = {
        localId: 'user123',
        email: 'test@example.com',
        emailVerified: true,
        disabled: false,
        createdAt: '1609459200000',
        lastLoginAt: '1609545600000',
        providerUserInfo: [],
        customAttributes: JSON.stringify({ role: 'admin', premium: true }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ users: [mockUser] }),
      });

      const result = await getUserByUid('user123');

      expect(result?.customClaims).toEqual({ role: 'admin', premium: true });
    });

    it('should handle user without optional fields', async () => {
      const mockUser = {
        localId: 'user123',
        emailVerified: false,
        disabled: false,
        createdAt: '1609459200000',
        lastLoginAt: '1609545600000',
        providerUserInfo: [],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ users: [mockUser] }),
      });

      const result = await getUserByUid('user123');

      expect(result?.uid).toBe('user123');
      expect(result?.email).toBeUndefined();
      expect(result?.displayName).toBeUndefined();
      expect(result?.photoURL).toBeUndefined();
      expect(result?.phoneNumber).toBeUndefined();
    });
  });
});
