/**
 * Unit tests for Firestore Operations
 * Uses mocked fetch to test without real API calls
 */

import {
  setDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  addDocument,
  queryDocuments,
  batchWrite,
} from './operations';
import { FieldValue } from '../field-value';
import * as tokenGeneration from '../token-generation';
import * as serviceAccount from '../service-account';

// Mock dependencies
jest.mock('../token-generation');
jest.mock('../service-account');

const mockGetAdminAccessToken = tokenGeneration.getAdminAccessToken as jest.MockedFunction<typeof tokenGeneration.getAdminAccessToken>;
const mockGetProjectId = serviceAccount.getProjectId as jest.MockedFunction<typeof serviceAccount.getProjectId>;

describe('Firestore Operations', () => {
  const TEST_TOKEN = 'test-access-token';
  const TEST_PROJECT = 'test-project-id';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockGetAdminAccessToken.mockResolvedValue(TEST_TOKEN);
    mockGetProjectId.mockReturnValue(TEST_PROJECT);
    
    // Mock global fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('setDocument', () => {
    it('should call correct URL for top-level collection', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await setDocument('users', 'user123', { name: 'John' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects/test-project-id/databases/(default)/documents/users/user123'),
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should call correct URL for subcollection', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await setDocument('users/uid123/posts', 'post456', { title: 'Test' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/uid123/posts/post456'),
        expect.any(Object)
      );
    });

    it('should convert data to Firestore format', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await setDocument('users', 'user123', {
        name: 'John',
        age: 30,
        active: true,
      });

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.fields).toEqual({
        name: { stringValue: 'John' },
        age: { integerValue: '30' },
        active: { booleanValue: true },
      });
    });

    it('should handle merge option', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await setDocument('users', 'user123', { age: 31 }, { merge: true });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('updateMask.fieldPaths=*'),
        expect.any(Object)
      );
    });

    it('should handle mergeFields option', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await setDocument('users', 'user123', { age: 31, city: 'NYC' }, { mergeFields: ['age'] });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('updateMask.fieldPaths=age'),
        expect.any(Object)
      );
    });

    it('should use :commit API when transforms are present', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await setDocument('users', 'user123', {
        name: 'John',
        createdAt: FieldValue.serverTimestamp(),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(':commit'),
        expect.objectContaining({
          method: 'POST',
        })
      );

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.writes).toBeDefined();
      expect(body.writes[0].updateTransforms).toBeDefined();
      expect(body.writes[0].updateTransforms[0].setToServerValue).toBe('REQUEST_TIME');
    });

    it('should handle transforms with merge option', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await setDocument('users', 'user123', {
        name: 'John',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.writes[0].updateMask).toEqual({ fieldPaths: ['*'] });
      expect(body.writes[0].updateTransforms).toBeDefined();
    });

    it('should handle transforms with mergeFields option', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await setDocument('users', 'user123', {
        name: 'John',
        age: 30,
        updatedAt: FieldValue.serverTimestamp(),
      }, { mergeFields: ['name', 'age'] });

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.writes[0].updateMask).toEqual({ fieldPaths: ['name', 'age'] });
      expect(body.writes[0].updateTransforms).toBeDefined();
    });

    it('should throw error on failed request', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: async () => JSON.stringify({ error: 'Test error' }),
      });

      await expect(setDocument('users', 'user123', { name: 'John' }))
        .rejects.toThrow('Failed to set document');
    });

    it('should throw error on failed commit with transforms', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: async () => 'Commit failed: permission denied',
      });

      await expect(setDocument('users', 'user123', {
        count: FieldValue.increment(1),
      })).rejects.toThrow('Failed to commit writes: Commit failed: permission denied');
    });
  });

  describe('getDocument', () => {
    it('should call correct URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'projects/test-project-id/databases/(default)/documents/users/user123',
          fields: {
            name: { stringValue: 'John' },
            age: { integerValue: '30' },
          },
        }),
      });

      await getDocument('users', 'user123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://firestore.googleapis.com/v1/projects/test-project-id/databases/(default)/documents/users/user123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
          }),
        })
      );
    });

    it('should convert Firestore format to JavaScript', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'projects/test-project-id/databases/(default)/documents/users/user123',
          fields: {
            name: { stringValue: 'John' },
            age: { integerValue: '30' },
            active: { booleanValue: true },
          },
        }),
      });

      const result = await getDocument('users', 'user123');

      expect(result).toEqual({
        name: 'John',
        age: 30,
        active: true,
      });
    });

    it('should return null for 404 response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 404,
        ok: false,
      });

      const result = await getDocument('users', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on other failed requests', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 500,
        ok: false,
        text: async () => JSON.stringify({ error: 'Server error' }),
      });

      await expect(getDocument('users', 'user123'))
        .rejects.toThrow('Failed to get document');
    });

    it('should handle documents with no fields', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'projects/test-project-id/databases/(default)/documents/users/user123',
          fields: null,
        }),
      });

      const result = await getDocument('users', 'user123');

      expect(result).toEqual({});
    });
  });

  describe('updateDocument', () => {
    it('should call correct URL with updateMask', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await updateDocument('users', 'user123', { age: 31 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('updateMask.fieldPaths=age'),
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });

    it('should include currentDocument.exists=true', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await updateDocument('users', 'user123', { age: 31 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('currentDocument.exists=true'),
        expect.any(Object)
      );
    });

    it('should handle multiple fields in updateMask', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await updateDocument('users', 'user123', { age: 31, city: 'NYC' });

      const url = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(url).toContain('updateMask.fieldPaths=age');
      expect(url).toContain('updateMask.fieldPaths=city');
    });

    it('should use :commit API for pure transform updates', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await updateDocument('users', 'user123', {
        counter: FieldValue.increment(1),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(':commit'),
        expect.objectContaining({
          method: 'POST',
        })
      );

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.writes[0].transform).toBeDefined();
      expect(body.writes[0].transform.fieldTransforms[0].increment).toBeDefined();
    });

    it('should use :commit API for mixed updates (fields + transforms)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await updateDocument('users', 'user123', {
        name: 'John',
        counter: FieldValue.increment(1),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(':commit'),
        expect.any(Object)
      );

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.writes[0].update).toBeDefined();
      expect(body.writes[0].updateTransforms).toBeDefined();
    });

    it('should handle deleteField in updateMask', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await updateDocument('users', 'user123', {
        name: 'John',
        oldField: FieldValue.delete(),
      });

      const url = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(url).toContain('updateMask.fieldPaths=name');
      expect(url).toContain('updateMask.fieldPaths=oldField');
    });

    it('should throw error on failed request', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: async () => JSON.stringify({ error: 'Test error' }),
      });

      await expect(updateDocument('users', 'user123', { age: 31 }))
        .rejects.toThrow('Failed to update document');
    });
  });

  describe('deleteDocument', () => {
    it('should call correct URL with DELETE method', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      await deleteDocument('users', 'user123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://firestore.googleapis.com/v1/projects/test-project-id/databases/(default)/documents/users/user123',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
          }),
        })
      );
    });

    it('should work with subcollections', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      await deleteDocument('users/uid123/posts', 'post456');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/uid123/posts/post456'),
        expect.any(Object)
      );
    });

    it('should throw error on failed request', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: async () => JSON.stringify({ error: 'Test error' }),
      });

      await expect(deleteDocument('users', 'user123'))
        .rejects.toThrow('Failed to delete document');
    });
  });

  describe('addDocument', () => {
    it('should call correct URL with POST method', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'projects/test-project-id/databases/(default)/documents/users/auto-id-123',
          fields: {},
        }),
      });

      await addDocument('users', { name: 'John' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://firestore.googleapis.com/v1/projects/test-project-id/databases/(default)/documents/users',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should return document reference with auto-generated ID', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'projects/test-project-id/databases/(default)/documents/users/auto-id-123',
          fields: {},
        }),
      });

      const result = await addDocument('users', { name: 'John' });

      expect(result).toEqual({
        id: 'auto-id-123',
        path: 'users/auto-id-123',
      });
    });

    it('should support custom document ID', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'projects/test-project-id/databases/(default)/documents/users/custom-id',
          fields: {},
        }),
      });

      await addDocument('users', { name: 'John' }, 'custom-id');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('?documentId=custom-id'),
        expect.any(Object)
      );
    });

    it('should work with subcollections', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'projects/test-project-id/databases/(default)/documents/users/uid123/posts/post-id',
          fields: {},
        }),
      });

      const result = await addDocument('users/uid123/posts', { title: 'Test' });

      expect(result.path).toBe('users/uid123/posts/post-id');
    });

    it('should throw error on failed request', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: async () => JSON.stringify({ error: 'Test error' }),
      });

      await expect(addDocument('users', { name: 'John' }))
        .rejects.toThrow('Failed to add document');
    });
  });

  describe('queryDocuments', () => {
    it('should use simple list for queries without options', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          documents: [
            {
              name: 'projects/test-project-id/databases/(default)/documents/users/user1',
              fields: { name: { stringValue: 'John' } },
            },
            {
              name: 'projects/test-project-id/databases/(default)/documents/users/user2',
              fields: { name: { stringValue: 'Jane' } },
            },
          ],
        }),
      });

      const results = await queryDocuments('users');

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('user1');
      expect(results[0].data.name).toBe('John');
      expect(results[1].id).toBe('user2');
      expect(results[1].data.name).toBe('Jane');
    });

    it('should use :runQuery for queries with options', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ([
          {
            document: {
              name: 'projects/test-project-id/databases/(default)/documents/users/user1',
              fields: { name: { stringValue: 'John' } },
            },
          },
        ]),
      });

      await queryDocuments('users', {
        where: [{ field: 'age', op: '>=', value: 18 }],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(':runQuery'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should use parent path for subcollection queries', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ([]),
      });

      await queryDocuments('users/uid123/posts', {
        where: [{ field: 'published', op: '==', value: true }],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/uid123:runQuery'),
        expect.any(Object)
      );
    });

    it('should include structured query in request body', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ([]),
      });

      await queryDocuments('users', {
        where: [{ field: 'age', op: '>=', value: 18 }],
        limit: 10,
      });

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.structuredQuery).toBeDefined();
      expect(body.structuredQuery.from[0].collectionId).toBe('users');
      expect(body.structuredQuery.limit).toBe(10);
    });

    it('should filter out results without documents', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ([
          {
            document: {
              name: 'projects/test-project-id/databases/(default)/documents/users/user1',
              fields: { name: { stringValue: 'John' } },
            },
          },
          {
            readTime: '2024-01-01T00:00:00Z',
          },
        ]),
      });

      const results = await queryDocuments('users', {
        where: [{ field: 'active', op: '==', value: true }],
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('user1');
    });

    it('should throw error on failed request', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: async () => JSON.stringify({ error: 'Test error' }),
      });

      await expect(queryDocuments('users'))
        .rejects.toThrow('Failed to query documents');
    });
  });

  describe('batchWrite', () => {
    it('should call :commit endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          writeResults: [
            { updateTime: '2024-01-01T00:00:00Z' },
          ],
        }),
      });

      await batchWrite([
        { type: 'set', collectionPath: 'users', documentId: 'user1', data: { name: 'John' } },
      ]);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(':commit'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle set operations', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ writeResults: [{ updateTime: '2024-01-01T00:00:00Z' }] }),
      });

      await batchWrite([
        { type: 'set', collectionPath: 'users', documentId: 'user1', data: { name: 'John' } },
      ]);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.writes[0].update).toBeDefined();
      expect(body.writes[0].update.fields.name.stringValue).toBe('John');
    });

    it('should handle update operations', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ writeResults: [{ updateTime: '2024-01-01T00:00:00Z' }] }),
      });

      await batchWrite([
        { type: 'update', collectionPath: 'users', documentId: 'user1', data: { age: 31 } },
      ]);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.writes[0].update).toBeDefined();
      expect(body.writes[0].updateMask).toBeDefined();
      expect(body.writes[0].currentDocument.exists).toBe(true);
    });

    it('should handle delete operations', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ writeResults: [{ updateTime: '2024-01-01T00:00:00Z' }] }),
      });

      await batchWrite([
        { type: 'delete', collectionPath: 'users', documentId: 'user1' },
      ]);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.writes[0].delete).toBeDefined();
      expect(body.writes[0].delete).toContain('/users/user1');
    });

    it('should handle multiple operations', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          writeResults: [
            { updateTime: '2024-01-01T00:00:00Z' },
            { updateTime: '2024-01-01T00:00:01Z' },
            { updateTime: '2024-01-01T00:00:02Z' },
          ],
        }),
      });

      await batchWrite([
        { type: 'set', collectionPath: 'users', documentId: 'user1', data: { name: 'John' } },
        { type: 'update', collectionPath: 'users', documentId: 'user2', data: { age: 31 } },
        { type: 'delete', collectionPath: 'users', documentId: 'user3' },
      ]);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.writes).toHaveLength(3);
    });

    it('should handle transforms in batch operations', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ writeResults: [{ updateTime: '2024-01-01T00:00:00Z' }] }),
      });

      await batchWrite([
        {
          type: 'set',
          collectionPath: 'users',
          documentId: 'user1',
          data: {
            name: 'John',
            createdAt: FieldValue.serverTimestamp(),
          },
        },
      ]);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.writes[0].updateTransforms).toBeDefined();
      expect(body.writes[0].updateTransforms[0].setToServerValue).toBe('REQUEST_TIME');
    });

    it('should throw error on failed request', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: async () => JSON.stringify({ error: 'Test error' }),
      });

      await expect(batchWrite([
        { type: 'set', collectionPath: 'users', documentId: 'user1', data: { name: 'John' } },
      ])).rejects.toThrow('Failed to perform batch write');
    });
  });
});
