/**
 * Firebase Admin SDK v8 - Firestore Iteration E2E Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp } from '../config';
import {
  listDocuments,
  iterateCollection,
  countDocuments,
} from './iteration';
import {
  addDocument,
  deleteDocument,
  setDocument,
} from './operations';

const TEST_COLLECTION = 'e2e_iteration_test';

describe('Firestore Iteration E2E', () => {
  beforeAll(() => {
    // Load service account from filesystem
    const serviceAccountPath = path.join(__dirname, '../../service-account.json');
    
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

  beforeEach(async () => {
    // Clean up test documents before each test
    try {
      const docs = await listDocuments(TEST_COLLECTION);
      for (const doc of docs) {
        await deleteDocument(TEST_COLLECTION, doc.id);
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  afterEach(async () => {
    // Clean up test documents after each test
    try {
      const docs = await listDocuments(TEST_COLLECTION);
      for (const doc of docs) {
        await deleteDocument(TEST_COLLECTION, doc.id);
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('listDocuments', () => {
    it('should list all documents in a collection', async () => {
      // Create test documents
      const doc1 = await addDocument(TEST_COLLECTION, { name: 'Alice', age: 25 });
      const doc2 = await addDocument(TEST_COLLECTION, { name: 'Bob', age: 30 });
      const doc3 = await addDocument(TEST_COLLECTION, { name: 'Charlie', age: 35 });

      // List all documents
      const docs = await listDocuments(TEST_COLLECTION);

      expect(docs).toHaveLength(3);
      expect(docs.map(d => d.id).sort()).toEqual([doc1.id, doc2.id, doc3.id].sort());
      expect(docs.map(d => d.data.name).sort()).toEqual(['Alice', 'Bob', 'Charlie'].sort());
    });

    it('should return empty array for non-existent collection', async () => {
      const docs = await listDocuments('non_existent_collection_xyz');
      expect(docs).toEqual([]);
    });

    it('should support limit option', async () => {
      // Create 5 documents
      for (let i = 0; i < 5; i++) {
        await addDocument(TEST_COLLECTION, { index: i });
      }

      // List with limit
      const docs = await listDocuments(TEST_COLLECTION, { limit: 3 });

      expect(docs).toHaveLength(3);
    });

    it('should support orderBy option', async () => {
      // Create documents with specific order
      await addDocument(TEST_COLLECTION, { name: 'Charlie', order: 3 });
      await addDocument(TEST_COLLECTION, { name: 'Alice', order: 1 });
      await addDocument(TEST_COLLECTION, { name: 'Bob', order: 2 });

      // List with orderBy
      const docs = await listDocuments(TEST_COLLECTION, {
        orderBy: [{ field: 'order', direction: 'ASCENDING' }],
      });

      expect(docs).toHaveLength(3);
      expect(docs[0].data.name).toBe('Alice');
      expect(docs[1].data.name).toBe('Bob');
      expect(docs[2].data.name).toBe('Charlie');
    });

    it('should support where filters', async () => {
      // Create documents
      await addDocument(TEST_COLLECTION, { name: 'Alice', active: true });
      await addDocument(TEST_COLLECTION, { name: 'Bob', active: false });
      await addDocument(TEST_COLLECTION, { name: 'Charlie', active: true });

      // List with filter
      const docs = await listDocuments(TEST_COLLECTION, {
        where: [{ field: 'active', op: '==', value: true }],
      });

      expect(docs).toHaveLength(2);
      expect(docs.map(d => d.data.name).sort()).toEqual(['Alice', 'Charlie'].sort());
    });
  });

  describe('iterateCollection', () => {
    it('should iterate through all documents', async () => {
      // Create test documents
      const docIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const doc = await addDocument(TEST_COLLECTION, { index: i });
        docIds.push(doc.id);
      }

      // Iterate and collect
      const collected: Array<{ id: string; data: any }> = [];
      await iterateCollection(TEST_COLLECTION, async (doc) => {
        collected.push(doc);
      });

      expect(collected).toHaveLength(5);
      expect(collected.map(d => d.id).sort()).toEqual(docIds.sort());
    });

    it('should handle large collections with pagination', async () => {
      // Create 25 documents
      for (let i = 0; i < 25; i++) {
        await addDocument(TEST_COLLECTION, { index: i });
      }

      // Iterate with small batch size
      const collected: number[] = [];
      await iterateCollection(
        TEST_COLLECTION,
        async (doc) => {
          collected.push(doc.data.index);
        },
        { batchSize: 10 }
      );

      expect(collected).toHaveLength(25);
      expect(collected.sort((a, b) => a - b)).toEqual(
        Array.from({ length: 25 }, (_, i) => i)
      );
    }, 60000); // Increase timeout to 60 seconds

    it('should iterate with orderBy', async () => {
      // Create documents
      await addDocument(TEST_COLLECTION, { name: 'Charlie', order: 3 });
      await addDocument(TEST_COLLECTION, { name: 'Alice', order: 1 });
      await addDocument(TEST_COLLECTION, { name: 'Bob', order: 2 });

      // Iterate with orderBy
      const names: string[] = [];
      await iterateCollection(
        TEST_COLLECTION,
        async (doc) => {
          names.push(doc.data.name);
        },
        {
          orderBy: [{ field: 'order', direction: 'ASCENDING' }],
        }
      );

      expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should iterate with where filters', async () => {
      // Create documents
      await addDocument(TEST_COLLECTION, { name: 'Alice', active: true });
      await addDocument(TEST_COLLECTION, { name: 'Bob', active: false });
      await addDocument(TEST_COLLECTION, { name: 'Charlie', active: true });
      await addDocument(TEST_COLLECTION, { name: 'David', active: false });

      // Iterate with filter
      const activeNames: string[] = [];
      await iterateCollection(
        TEST_COLLECTION,
        async (doc) => {
          activeNames.push(doc.data.name);
        },
        {
          where: [{ field: 'active', op: '==', value: true }],
        }
      );

      expect(activeNames.sort()).toEqual(['Alice', 'Charlie'].sort());
    });

    it('should handle empty collection', async () => {
      const collected: any[] = [];
      await iterateCollection('empty_collection_xyz', async (doc) => {
        collected.push(doc);
      });

      expect(collected).toHaveLength(0);
    });

    it('should allow updating documents during iteration', async () => {
      // Create documents
      await addDocument(TEST_COLLECTION, { value: 1 });
      await addDocument(TEST_COLLECTION, { value: 2 });
      await addDocument(TEST_COLLECTION, { value: 3 });

      // Iterate and update
      await iterateCollection(TEST_COLLECTION, async (doc) => {
        await setDocument(TEST_COLLECTION, doc.id, {
          value: doc.data.value * 2,
        });
      });

      // Verify updates
      const docs = await listDocuments(TEST_COLLECTION);
      const values = docs.map(d => d.data.value).sort((a, b) => a - b);
      expect(values).toEqual([2, 4, 6]);
    });
  });

  describe('countDocuments', () => {
    it('should count all documents in a collection', async () => {
      // Create test documents
      for (let i = 0; i < 7; i++) {
        await addDocument(TEST_COLLECTION, { index: i });
      }

      const count = await countDocuments(TEST_COLLECTION);
      expect(count).toBe(7);
    });

    it('should return 0 for empty collection', async () => {
      const count = await countDocuments('empty_collection_xyz');
      expect(count).toBe(0);
    });

    it('should count with where filters', async () => {
      // Create documents
      await addDocument(TEST_COLLECTION, { active: true });
      await addDocument(TEST_COLLECTION, { active: false });
      await addDocument(TEST_COLLECTION, { active: true });
      await addDocument(TEST_COLLECTION, { active: true });
      await addDocument(TEST_COLLECTION, { active: false });

      const activeCount = await countDocuments(TEST_COLLECTION, {
        where: [{ field: 'active', op: '==', value: true }],
      });

      expect(activeCount).toBe(3);
    });

    it('should handle large collections', async () => {
      // Create many documents
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(addDocument(TEST_COLLECTION, { index: i }));
      }
      await Promise.all(promises);

      const count = await countDocuments(TEST_COLLECTION);
      expect(count).toBe(50);
    });
  });

  describe('Subcollection support', () => {
    const parentDocId = 'parent_doc';
    const subCollectionPath = `${TEST_COLLECTION}/${parentDocId}/subcollection`;

    afterEach(async () => {
      // Clean up subcollection
      try {
        const docs = await listDocuments(subCollectionPath);
        for (const doc of docs) {
          await deleteDocument(subCollectionPath, doc.id);
        }
        await deleteDocument(TEST_COLLECTION, parentDocId);
      } catch (error) {
        // Ignore errors
      }
    });

    it('should list documents in subcollection', async () => {
      // Create parent document
      await setDocument(TEST_COLLECTION, parentDocId, { name: 'Parent' });

      // Create subcollection documents
      await addDocument(subCollectionPath, { name: 'Sub1' });
      await addDocument(subCollectionPath, { name: 'Sub2' });

      // List subcollection
      const docs = await listDocuments(subCollectionPath);

      expect(docs).toHaveLength(2);
      expect(docs.map(d => d.data.name).sort()).toEqual(['Sub1', 'Sub2'].sort());
    });

    it('should iterate through subcollection', async () => {
      // Create parent document
      await setDocument(TEST_COLLECTION, parentDocId, { name: 'Parent' });

      // Create subcollection documents
      for (let i = 0; i < 5; i++) {
        await addDocument(subCollectionPath, { index: i });
      }

      // Iterate subcollection
      const collected: number[] = [];
      await iterateCollection(subCollectionPath, async (doc) => {
        collected.push(doc.data.index);
      });

      expect(collected).toHaveLength(5);
    });

    it('should count documents in subcollection', async () => {
      // Create parent document
      await setDocument(TEST_COLLECTION, parentDocId, { name: 'Parent' });

      // Create subcollection documents
      for (let i = 0; i < 3; i++) {
        await addDocument(subCollectionPath, { index: i });
      }

      const count = await countDocuments(subCollectionPath);
      expect(count).toBe(3);
    });
  });
});
