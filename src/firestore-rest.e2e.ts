/**
 * End-to-end tests for Firestore operations
 * These tests run against a real Firebase project
 * 
 * Prerequisites:
 * - service-account.json file with valid credentials
 * - Firebase project: prmichaelsen-firebase-e2e
 * 
 * Run with: npm run test:e2e
 */

import { initializeApp } from './config';
import {
  setDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  addDocument,
} from './firestore-rest';
import { FieldValue } from './field-value';
import * as fs from 'fs';
import * as path from 'path';

describe('Firestore E2E Tests', () => {
  const TEST_COLLECTION = 'e2e-tests';
  const timestamp = Date.now();
  let testDocId: string;

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
    
    // Initialize with service account
    initializeApp({ serviceAccount });
  });

  afterEach(async () => {
    // Clean up test document if it exists
    if (testDocId) {
      try {
        await deleteDocument(TEST_COLLECTION, testDocId);
      } catch (error) {
        // Ignore errors if document doesn't exist
      }
    }
  });

  describe('Document CRUD Operations', () => {
    it('should create a document with setDocument', async () => {
      testDocId = `test-${timestamp}-create`;
      
      await setDocument(TEST_COLLECTION, testDocId, {
        name: 'Test User',
        email: 'test@example.com',
        age: 30,
        createdAt: new Date().toISOString(),
        _test: true,
      });

      const doc = await getDocument(TEST_COLLECTION, testDocId);
      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Test User');
      expect(doc?.email).toBe('test@example.com');
      expect(doc?.age).toBe(30);
    });

    it('should read a document with getDocument', async () => {
      testDocId = `test-${timestamp}-read`;
      
      // Create document first
      await setDocument(TEST_COLLECTION, testDocId, {
        name: 'Read Test',
        value: 42,
        _test: true,
      });

      // Read it back
      const doc = await getDocument(TEST_COLLECTION, testDocId);
      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Read Test');
      expect(doc?.value).toBe(42);
    });

    it('should update a document with updateDocument', async () => {
      testDocId = `test-${timestamp}-update`;
      
      // Create initial document
      await setDocument(TEST_COLLECTION, testDocId, {
        name: 'Original Name',
        age: 25,
        _test: true,
      });

      // Update it
      await updateDocument(TEST_COLLECTION, testDocId, {
        name: 'Updated Name',
        age: 26,
      });

      // Verify update
      const doc = await getDocument(TEST_COLLECTION, testDocId);
      expect(doc?.name).toBe('Updated Name');
      expect(doc?.age).toBe(26);
    });

    it('should delete a document with deleteDocument', async () => {
      testDocId = `test-${timestamp}-delete`;
      
      // Create document
      await setDocument(TEST_COLLECTION, testDocId, {
        name: 'To Delete',
        _test: true,
      });

      // Delete it
      await deleteDocument(TEST_COLLECTION, testDocId);

      // Verify deletion
      const doc = await getDocument(TEST_COLLECTION, testDocId);
      expect(doc).toBeNull();
      
      testDocId = ''; // Clear so afterEach doesn't try to delete again
    });

    it('should add a document with auto-generated ID', async () => {
      const docRef = await addDocument(TEST_COLLECTION, {
        name: 'Auto ID Test',
        value: 123,
        _test: true,
      });

      testDocId = docRef.id;
      expect(testDocId).toBeDefined();
      expect(testDocId.length).toBeGreaterThan(0);

      // Verify document was created
      const doc = await getDocument(TEST_COLLECTION, testDocId);
      expect(doc?.name).toBe('Auto ID Test');
      expect(doc?.value).toBe(123);
    });
  });

  describe('Query Operations', () => {
    const queryTestDocs: string[] = [];

    beforeAll(async () => {
      // Create test documents for querying
      for (let i = 0; i < 5; i++) {
        const docId = `test-${timestamp}-query-${i}`;
        queryTestDocs.push(docId);
        await setDocument(TEST_COLLECTION, docId, {
          name: `User ${i}`,
          age: 20 + i,
          active: i % 2 === 0,
          _test: true,
        });
      }
    });

    afterAll(async () => {
      // Clean up query test documents
      for (const docId of queryTestDocs) {
        try {
          await deleteDocument(TEST_COLLECTION, docId);
        } catch (error) {
          // Ignore errors
        }
      }
    });

    it('should query documents with where clause', async () => {
      const results = await queryDocuments(TEST_COLLECTION, {
        where: [{ field: 'active', op: '==', value: true }],
      });

      expect(results.length).toBeGreaterThanOrEqual(3); // At least our 3 active docs
      results.forEach(doc => {
        const data = doc.data as Record<string, unknown>;
        if (data._test) {
          expect(data.active).toBe(true);
        }
      });
    });

    it('should query documents with orderBy and limit', async () => {
      const results = await queryDocuments(TEST_COLLECTION, {
        where: [{ field: '_test', op: '==', value: true }],
        orderBy: [{ field: 'age', direction: 'ASCENDING' }],
        limit: 3,
      });

      expect(results.length).toBeLessThanOrEqual(3);
      // Verify ordering
      for (let i = 1; i < results.length; i++) {
        const currentData = results[i].data as Record<string, unknown>;
        const prevData = results[i - 1].data as Record<string, unknown>;
        expect(currentData.age as number).toBeGreaterThanOrEqual(prevData.age as number);
      }
    });

    it('should query documents with multiple where clauses', async () => {
      const results = await queryDocuments(TEST_COLLECTION, {
        where: [
          { field: '_test', op: '==', value: true },
          { field: 'age', op: '>=', value: 22 },
        ],
      });

      expect(results.length).toBeGreaterThanOrEqual(3);
      results.forEach(doc => {
        const data = doc.data as Record<string, unknown>;
        if (data._test) {
          expect(data.age as number).toBeGreaterThanOrEqual(22);
        }
      });
    });
  });

  describe('Field Transforms', () => {
    it('should handle serverTimestamp', async () => {
      testDocId = `test-${timestamp}-timestamp`;
      
      await setDocument(TEST_COLLECTION, testDocId, {
        name: 'Timestamp Test',
        createdAt: FieldValue.serverTimestamp(),
        _test: true,
      });

      const doc = await getDocument(TEST_COLLECTION, testDocId);
      expect(doc?.createdAt).toBeDefined();
      expect(typeof doc?.createdAt).toBe('string');
    });

    it('should handle increment', async () => {
      testDocId = `test-${timestamp}-increment`;
      
      // Create initial document
      await setDocument(TEST_COLLECTION, testDocId, {
        counter: 10,
        _test: true,
      });

      // Increment counter
      await updateDocument(TEST_COLLECTION, testDocId, {
        counter: FieldValue.increment(5),
      });

      const doc = await getDocument(TEST_COLLECTION, testDocId);
      expect(doc?.counter).toBe(15);
    });

    it('should handle arrayUnion', async () => {
      testDocId = `test-${timestamp}-array-union`;
      
      // Create initial document
      await setDocument(TEST_COLLECTION, testDocId, {
        tags: ['tag1', 'tag2'],
        _test: true,
      });

      // Add new tags
      await updateDocument(TEST_COLLECTION, testDocId, {
        tags: FieldValue.arrayUnion('tag3', 'tag4'),
      });

      const doc = await getDocument(TEST_COLLECTION, testDocId);
      expect(doc?.tags).toContain('tag1');
      expect(doc?.tags).toContain('tag2');
      expect(doc?.tags).toContain('tag3');
      expect(doc?.tags).toContain('tag4');
    });

    it('should handle arrayRemove', async () => {
      testDocId = `test-${timestamp}-array-remove`;
      
      // Create initial document
      await setDocument(TEST_COLLECTION, testDocId, {
        tags: ['tag1', 'tag2', 'tag3'],
        _test: true,
      });

      // Remove tags
      await updateDocument(TEST_COLLECTION, testDocId, {
        tags: FieldValue.arrayRemove('tag2'),
      });

      const doc = await getDocument(TEST_COLLECTION, testDocId);
      expect(doc?.tags).toContain('tag1');
      expect(doc?.tags).not.toContain('tag2');
      expect(doc?.tags).toContain('tag3');
    });

    it('should handle deleteField', async () => {
      testDocId = `test-${timestamp}-delete-field`;
      
      // Create initial document
      await setDocument(TEST_COLLECTION, testDocId, {
        name: 'Test',
        tempField: 'to be deleted',
        _test: true,
      });

      // Delete field
      await updateDocument(TEST_COLLECTION, testDocId, {
        tempField: FieldValue.delete(),
      });

      const doc = await getDocument(TEST_COLLECTION, testDocId);
      expect(doc?.name).toBe('Test');
      expect(doc?.tempField).toBeUndefined();
    });
  });

  describe('Subcollection Operations (Critical Bug Fix Verification)', () => {
    const parentDocId = `test-${timestamp}-parent`;
    const subCollectionPath = `${TEST_COLLECTION}/${parentDocId}/messages`;
    const subDocIds: string[] = [];

    beforeAll(async () => {
      // Create parent document
      await setDocument(TEST_COLLECTION, parentDocId, {
        name: 'Parent Document',
        _test: true,
      });

      // Create subcollection documents
      for (let i = 0; i < 3; i++) {
        const docId = `msg-${i}`;
        subDocIds.push(docId);
        await setDocument(subCollectionPath, docId, {
          text: `Message ${i}`,
          timestamp: Date.now() + i,
          _test: true,
        });
      }
    });

    afterAll(async () => {
      // Clean up subcollection documents
      for (const docId of subDocIds) {
        try {
          await deleteDocument(subCollectionPath, docId);
        } catch (error) {
          // Ignore errors
        }
      }
      
      // Clean up parent document
      try {
        await deleteDocument(TEST_COLLECTION, parentDocId);
      } catch (error) {
        // Ignore errors
      }
    });

    it('should query subcollection documents', async () => {
      const results = await queryDocuments(subCollectionPath, {
        where: [{ field: '_test', op: '==', value: true }],
      });

      expect(results.length).toBe(3);
      results.forEach(doc => {
        expect(doc.data.text).toMatch(/^Message \d$/);
      });
    });

    it('should query subcollection with orderBy', async () => {
      const results = await queryDocuments(subCollectionPath, {
        where: [{ field: '_test', op: '==', value: true }],
        orderBy: [{ field: 'timestamp', direction: 'ASCENDING' }],
      });

      expect(results.length).toBe(3);
      // Verify ordering
      for (let i = 1; i < results.length; i++) {
        expect(results[i].data.timestamp).toBeGreaterThanOrEqual(results[i - 1].data.timestamp);
      }
    });
  });
});
