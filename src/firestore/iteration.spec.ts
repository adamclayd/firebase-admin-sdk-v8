/**
 * Firebase Admin SDK v8 - Firestore Iteration Tests
 */

import { listDocuments, iterateCollection, countDocuments } from './iteration';
import * as operations from './operations';

// Mock the operations module
jest.mock('./operations');

describe('Firestore Iteration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listDocuments', () => {
    it('should call queryDocuments with no options', async () => {
      const mockDocs = [
        { id: 'doc1', data: { name: 'Test 1' } },
        { id: 'doc2', data: { name: 'Test 2' } },
      ];
      
      (operations.queryDocuments as jest.Mock).mockResolvedValue(mockDocs);

      const result = await listDocuments('users');

      expect(operations.queryDocuments).toHaveBeenCalledWith('users', undefined);
      expect(result).toEqual(mockDocs);
    });

    it('should pass through query options', async () => {
      const mockDocs = [{ id: 'doc1', data: { name: 'Test' } }];
      const options = {
        limit: 10,
        orderBy: [{ field: 'name', direction: 'ASCENDING' as const }],
      };
      
      (operations.queryDocuments as jest.Mock).mockResolvedValue(mockDocs);

      const result = await listDocuments('users', options);

      expect(operations.queryDocuments).toHaveBeenCalledWith('users', options);
      expect(result).toEqual(mockDocs);
    });
  });

  describe('iterateCollection', () => {
    it('should iterate through all documents in batches', async () => {
      const batch1 = Array.from({ length: 100 }, (_, i) => ({
        id: `doc${i}`,
        data: { index: i },
      }));
      const batch2 = Array.from({ length: 50 }, (_, i) => ({
        id: `doc${i + 100}`,
        data: { index: i + 100 },
      }));

      (operations.queryDocuments as jest.Mock)
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2);

      const callback = jest.fn().mockResolvedValue(undefined);
      await iterateCollection('users', callback, { batchSize: 100 });

      expect(operations.queryDocuments).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledTimes(150);
    });

    it('should stop when batch is smaller than batchSize', async () => {
      const batch1 = Array.from({ length: 100 }, (_, i) => ({
        id: `doc${i}`,
        data: { index: i },
      }));
      const batch2 = Array.from({ length: 30 }, (_, i) => ({
        id: `doc${i + 100}`,
        data: { index: i + 100 },
      }));

      (operations.queryDocuments as jest.Mock)
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2);

      const callback = jest.fn().mockResolvedValue(undefined);
      await iterateCollection('users', callback, { batchSize: 100 });

      expect(operations.queryDocuments).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledTimes(130);
    });

    it('should use pagination with orderBy', async () => {
      const batch1 = [
        { id: 'doc1', data: { name: 'Alice', age: 25 } },
        { id: 'doc2', data: { name: 'Bob', age: 30 } },
      ];
      const batch2 = [
        { id: 'doc3', data: { name: 'Charlie', age: 35 } },
      ];

      (operations.queryDocuments as jest.Mock)
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2);

      const callback = jest.fn().mockResolvedValue(undefined);
      await iterateCollection('users', callback, {
        batchSize: 2,
        orderBy: [{ field: 'name', direction: 'ASCENDING' }],
      });

      expect(operations.queryDocuments).toHaveBeenCalledTimes(2);
      
      // First call should not have startAfter
      expect(operations.queryDocuments).toHaveBeenNthCalledWith(1, 'users', {
        limit: 2,
        orderBy: [{ field: 'name', direction: 'ASCENDING' }],
        where: undefined,
      });

      // Second call should have startAfter with last doc's name
      expect(operations.queryDocuments).toHaveBeenNthCalledWith(2, 'users', {
        limit: 2,
        orderBy: [{ field: 'name', direction: 'ASCENDING' }],
        where: undefined,
        startAfter: ['Bob'],
      });
    });

    it('should pass where filters', async () => {
      const batch = [{ id: 'doc1', data: { active: true } }];
      
      (operations.queryDocuments as jest.Mock).mockResolvedValue(batch);

      const callback = jest.fn().mockResolvedValue(undefined);
      const whereFilter = [{ field: 'active', op: '==', value: true }];
      
      await iterateCollection('users', callback, {
        batchSize: 100,
        where: whereFilter,
      });

      expect(operations.queryDocuments).toHaveBeenCalledWith('users', {
        limit: 100,
        orderBy: undefined,
        where: whereFilter,
      });
    });

    it('should handle empty collection', async () => {
      (operations.queryDocuments as jest.Mock).mockResolvedValue([]);

      const callback = jest.fn().mockResolvedValue(undefined);
      await iterateCollection('users', callback);

      expect(operations.queryDocuments).toHaveBeenCalledTimes(1);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('countDocuments', () => {
    it('should count all documents', async () => {
      const batch1 = Array.from({ length: 1000 }, (_, i) => ({
        id: `doc${i}`,
        data: { index: i },
      }));
      const batch2 = Array.from({ length: 500 }, (_, i) => ({
        id: `doc${i + 1000}`,
        data: { index: i + 1000 },
      }));

      (operations.queryDocuments as jest.Mock)
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2);

      const count = await countDocuments('users');

      expect(count).toBe(1500);
    });

    it('should count with where filters', async () => {
      const batch = Array.from({ length: 50 }, (_, i) => ({
        id: `doc${i}`,
        data: { active: true },
      }));

      (operations.queryDocuments as jest.Mock).mockResolvedValue(batch);

      const whereFilter = [{ field: 'active', op: '==', value: true }];
      const count = await countDocuments('users', { where: whereFilter });

      expect(count).toBe(50);
      expect(operations.queryDocuments).toHaveBeenCalledWith('users', {
        limit: 1000,
        orderBy: undefined,
        where: whereFilter,
      });
    });

    it('should return 0 for empty collection', async () => {
      (operations.queryDocuments as jest.Mock).mockResolvedValue([]);

      const count = await countDocuments('users');

      expect(count).toBe(0);
    });
  });
});
