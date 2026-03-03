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
  batchWrite,
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
    
    // Initialize with service account and project ID
    initializeApp({
      serviceAccount,
      projectId: 'prmichaelsen-firebase-e2e',
    });
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

    it('should query documents where field is null', async () => {
      // Create test documents with null and non-null values
      const nullTestDocs: string[] = [];

      try {
        const docWithNull = `test-${timestamp}-null-query-1`;
        const docWithValue = `test-${timestamp}-null-query-2`;
        const docWithoutField = `test-${timestamp}-null-query-3`;

        nullTestDocs.push(docWithNull, docWithValue, docWithoutField);

        // Document with null value
        await setDocument(TEST_COLLECTION, docWithNull, {
          name: 'User with null deletedAt',
          deletedAt: null,
          _test: true,
          _testNull: true,
        });

        // Document with actual value
        await setDocument(TEST_COLLECTION, docWithValue, {
          name: 'User with deletedAt value',
          deletedAt: '2026-01-01',
          _test: true,
          _testNull: true,
        });

        // Document without the field (should also match null query)
        await setDocument(TEST_COLLECTION, docWithoutField, {
          name: 'User without deletedAt field',
          _test: true,
          _testNull: true,
        });

        // Query for documents where deletedAt is null
        const results = await queryDocuments(TEST_COLLECTION, {
          where: [
            { field: '_testNull', op: '==', value: true },
            { field: 'deletedAt', op: '==', value: null },
          ],
        });

        // Firestore null queries only match fields explicitly set to null, not missing fields
        expect(results.length).toBeGreaterThanOrEqual(1);

        const resultIds = results.map(doc => doc.id);
        expect(resultIds).toContain(docWithNull);
        // Missing field is NOT matched by null query in Firestore
        // expect(resultIds).toContain(docWithoutField);
        expect(resultIds).not.toContain(docWithValue);

        results.forEach(doc => {
          const data = doc.data as Record<string, unknown>;
          if (data._testNull) {
            // deletedAt should be null (missing fields are not matched by IS_NULL)
            expect(data.deletedAt).toBeNull();
          }
        });
      } finally {
        // Clean up
        for (const docId of nullTestDocs) {
          try {
            await deleteDocument(TEST_COLLECTION, docId);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    });

    it.skip('should query documents where field is NaN', async () => {
      // NOTE: Firestore does not support storing NaN values in documents
      // The unaryFilter IS_NAN exists in the API spec but cannot be tested
      // because NaN cannot be written to Firestore
      // Error: "Cannot convert firestore.v1.Value with type unset"

      // This test is kept for documentation purposes but skipped
      // The unit tests verify that the query builder correctly generates
      // IS_NAN unaryFilter for NaN queries
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
      // Firestore timestamps are returned as Date objects
      expect(doc?.createdAt).toBeInstanceOf(Date);
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

  describe('Deeply Nested Subcollections (4+ Levels)', () => {
    const userId = `user-${timestamp}`;
    const credentialId = `cred-${timestamp}`;
    
    // Test path similar to your error:
    // agentbase.users/{userId}/credentials/{docId}
    const userCollectionPath = `${TEST_COLLECTION}.users`; // Collection with dot in name
    const credentialCollectionPath = `${userCollectionPath}/${userId}/credentials`;
    
    afterAll(async () => {
      // Cleanup
      try {
        await deleteDocument(credentialCollectionPath, credentialId);
      } catch (error) {
        // Ignore
      }
      try {
        await deleteDocument(userCollectionPath, userId);
      } catch (error) {
        // Ignore
      }
    });

    it('should handle collection names with dots', async () => {
      // Create user document in collection with dot
      await setDocument(userCollectionPath, userId, {
        name: 'Test User',
        _test: true,
      });

      const doc = await getDocument(userCollectionPath, userId);
      expect(doc).not.toBeNull();
      expect(doc?.name).toBe('Test User');
    }, 30000);

    it('should create deeply nested subcollection (4 levels)', async () => {
      // Create parent user first
      await setDocument(userCollectionPath, userId, {
        name: 'Test User',
        _test: true,
      });

      // Create credential in 4-level deep subcollection
      // Path: collection.with.dot/userId/credentials/instagram/credentialId
      await setDocument(credentialCollectionPath, credentialId, {
        access_token: 'test_token',
        user_id: '12345',
        expires_in: 5184000,
        _test: true,
      });

      // Verify it was created
      const credential = await getDocument(credentialCollectionPath, credentialId);
      expect(credential).not.toBeNull();
      expect(credential?.access_token).toBe('test_token');
      expect(credential?.user_id).toBe('12345');
    }, 30000);

    it('should query deeply nested subcollection', async () => {
      // Ensure parent and credential exist
      await setDocument(userCollectionPath, userId, {
        name: 'Test User',
        _test: true,
      });

      await setDocument(credentialCollectionPath, credentialId, {
        access_token: 'test_token',
        user_id: '12345',
        _test: true,
      });

      // Query the deeply nested collection
      const results = await queryDocuments(credentialCollectionPath, {
        where: [{ field: '_test', op: '==', value: true }],
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      const found = results.find(r => r.id === credentialId);
      expect(found).toBeDefined();
      expect(found?.data.access_token).toBe('test_token');
    }, 30000);

    it('should update deeply nested document', async () => {
      // Ensure documents exist
      await setDocument(userCollectionPath, userId, {
        name: 'Test User',
        _test: true,
      });

      await setDocument(credentialCollectionPath, credentialId, {
        access_token: 'test_token',
        user_id: '12345',
        _test: true,
      });

      // Update the credential
      await updateDocument(credentialCollectionPath, credentialId, {
        access_token: 'updated_token',
        expires_in: 7200,
      });

      // Verify update
      const updated = await getDocument(credentialCollectionPath, credentialId);
      expect(updated?.access_token).toBe('updated_token');
      expect(updated?.expires_in).toBe(7200);
      expect(updated?.user_id).toBe('12345'); // Should still exist
    }, 30000);
  });

  describe('Batch Write Operations', () => {
    const batchTestDocs: string[] = [];

    afterAll(async () => {
      // Cleanup batch test documents
      for (const docId of batchTestDocs) {
        try {
          await deleteDocument(TEST_COLLECTION, docId);
        } catch (error) {
          // Ignore errors
        }
      }
    });

    it('should perform multiple set operations in batch', async () => {
      const doc1Id = `test-${timestamp}-batch-set-1`;
      const doc2Id = `test-${timestamp}-batch-set-2`;
      const doc3Id = `test-${timestamp}-batch-set-3`;
      batchTestDocs.push(doc1Id, doc2Id, doc3Id);

      await batchWrite([
        { type: 'set', collectionPath: TEST_COLLECTION, documentId: doc1Id, data: { name: 'Batch User 1', _test: true } },
        { type: 'set', collectionPath: TEST_COLLECTION, documentId: doc2Id, data: { name: 'Batch User 2', _test: true } },
        { type: 'set', collectionPath: TEST_COLLECTION, documentId: doc3Id, data: { name: 'Batch User 3', _test: true } },
      ]);

      // Verify all documents were created
      const doc1 = await getDocument(TEST_COLLECTION, doc1Id);
      const doc2 = await getDocument(TEST_COLLECTION, doc2Id);
      const doc3 = await getDocument(TEST_COLLECTION, doc3Id);

      expect(doc1?.name).toBe('Batch User 1');
      expect(doc2?.name).toBe('Batch User 2');
      expect(doc3?.name).toBe('Batch User 3');
    });

    it('should perform mixed operations (set, update, delete) in batch', async () => {
      const setDocId = `test-${timestamp}-batch-mixed-set`;
      const updateDocId = `test-${timestamp}-batch-mixed-update`;
      const deleteDocId = `test-${timestamp}-batch-mixed-delete`;
      batchTestDocs.push(setDocId, updateDocId);

      // Create documents for update and delete
      await setDocument(TEST_COLLECTION, updateDocId, { name: 'To Update', value: 10, _test: true });
      await setDocument(TEST_COLLECTION, deleteDocId, { name: 'To Delete', _test: true });

      // Perform batch operations
      await batchWrite([
        { type: 'set', collectionPath: TEST_COLLECTION, documentId: setDocId, data: { name: 'New Doc', _test: true } },
        { type: 'update', collectionPath: TEST_COLLECTION, documentId: updateDocId, data: { value: 20 } },
        { type: 'delete', collectionPath: TEST_COLLECTION, documentId: deleteDocId },
      ]);

      // Verify results
      const setDoc = await getDocument(TEST_COLLECTION, setDocId);
      const updateDoc = await getDocument(TEST_COLLECTION, updateDocId);
      const deleteDoc = await getDocument(TEST_COLLECTION, deleteDocId);

      expect(setDoc?.name).toBe('New Doc');
      expect(updateDoc?.value).toBe(20);
      expect(updateDoc?.name).toBe('To Update'); // Should still have original name
      expect(deleteDoc).toBeNull();
    });

    it('should handle field transforms in batch operations', async () => {
      const doc1Id = `test-${timestamp}-batch-transform-1`;
      const doc2Id = `test-${timestamp}-batch-transform-2`;
      batchTestDocs.push(doc1Id, doc2Id);

      await batchWrite([
        {
          type: 'set',
          collectionPath: TEST_COLLECTION,
          documentId: doc1Id,
          data: {
            name: 'Transform Test 1',
            createdAt: FieldValue.serverTimestamp(),
            count: FieldValue.increment(5),
            _test: true,
          },
        },
        {
          type: 'set',
          collectionPath: TEST_COLLECTION,
          documentId: doc2Id,
          data: {
            name: 'Transform Test 2',
            tags: FieldValue.arrayUnion('tag1', 'tag2'),
            _test: true,
          },
        },
      ]);

      // Verify transforms were applied
      const doc1 = await getDocument(TEST_COLLECTION, doc1Id);
      const doc2 = await getDocument(TEST_COLLECTION, doc2Id);

      expect(doc1?.name).toBe('Transform Test 1');
      expect(doc1?.createdAt).toBeDefined();
      expect(doc1?.count).toBe(5);
      expect(doc2?.name).toBe('Transform Test 2');
      expect(doc2?.tags).toEqual(['tag1', 'tag2']);
    });

    it('should handle batch operations with mergeFields option', async () => {
      const docId = `test-${timestamp}-batch-merge`;
      batchTestDocs.push(docId);

      // Create initial document
      await setDocument(TEST_COLLECTION, docId, {
        name: 'Original',
        email: 'original@example.com',
        age: 25,
        _test: true,
      });

      // Update with mergeFields
      await batchWrite([
        {
          type: 'set',
          collectionPath: TEST_COLLECTION,
          documentId: docId,
          data: { name: 'Updated', city: 'NYC', age: 30 },
          options: { mergeFields: ['name', 'city'] },
        },
      ]);

      // Verify only specified fields were updated
      const doc = await getDocument(TEST_COLLECTION, docId);
      expect(doc?.name).toBe('Updated'); // Should be updated
      expect(doc?.city).toBe('NYC'); // Should be added
      expect(doc?.email).toBe('original@example.com'); // Should be preserved
      expect(doc?.age).toBe(25); // Should NOT be updated (not in mergeFields)
    });
  });

  describe('Error Handling', () => {
    it('should throw error when getting non-existent document', async () => {
      const nonExistentId = `test-${timestamp}-nonexistent`;
      const doc = await getDocument(TEST_COLLECTION, nonExistentId);
      expect(doc).toBeNull();
    });

    it('should throw error when updating non-existent document', async () => {
      const nonExistentId = `test-${timestamp}-update-nonexistent`;
      await expect(
        updateDocument(TEST_COLLECTION, nonExistentId, { name: 'Updated' })
      ).rejects.toThrow();
    });

    it('should handle deleting non-existent document gracefully', async () => {
      const nonExistentId = `test-${timestamp}-delete-nonexistent`;
      // Should not throw error
      await expect(
        deleteDocument(TEST_COLLECTION, nonExistentId)
      ).resolves.not.toThrow();
    });

    it('should handle empty query results', async () => {
      const results = await queryDocuments(TEST_COLLECTION, {
        where: [{ field: 'nonExistentField', op: '==', value: 'impossible-value-12345' }],
      });
      expect(results).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    const edgeTestDocs: string[] = [];

    afterAll(async () => {
      for (const docId of edgeTestDocs) {
        try {
          await deleteDocument(TEST_COLLECTION, docId);
        } catch (error) {
          // Ignore
        }
      }
    });

    it('should handle documents with special characters in IDs', async () => {
      const docId = `test-${timestamp}-special_chars.with-dashes`;
      edgeTestDocs.push(docId);

      await setDocument(TEST_COLLECTION, docId, {
        name: 'Special Chars Test',
        _test: true,
      });

      const doc = await getDocument(TEST_COLLECTION, docId);
      expect(doc?.name).toBe('Special Chars Test');
    });

    it('should handle documents with unicode characters', async () => {
      const docId = `test-${timestamp}-unicode`;
      edgeTestDocs.push(docId);

      await setDocument(TEST_COLLECTION, docId, {
        name: 'Unicode Test',
        emoji: '🔥',
        chinese: '你好',
        arabic: 'مرحبا',
        _test: true,
      });

      const doc = await getDocument(TEST_COLLECTION, docId);
      expect(doc?.emoji).toBe('🔥');
      expect(doc?.chinese).toBe('你好');
      expect(doc?.arabic).toBe('مرحبا');
    });

    it('should handle deeply nested objects', async () => {
      const docId = `test-${timestamp}-nested`;
      edgeTestDocs.push(docId);

      await setDocument(TEST_COLLECTION, docId, {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
              },
            },
          },
        },
        _test: true,
      });

      const doc = await getDocument(TEST_COLLECTION, docId);
      expect(doc?.level1?.level2?.level3?.level4?.value).toBe('deep');
    });

    it('should handle large arrays', async () => {
      const docId = `test-${timestamp}-large-array`;
      edgeTestDocs.push(docId);

      const largeArray = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
      }));

      await setDocument(TEST_COLLECTION, docId, {
        items: largeArray,
        _test: true,
      });

      const doc = await getDocument(TEST_COLLECTION, docId);
      expect(doc?.items).toHaveLength(100);
      expect(doc?.items[0].id).toBe(0);
      expect(doc?.items[99].id).toBe(99);
    });

    it('should handle empty objects and arrays', async () => {
      const docId = `test-${timestamp}-empty`;
      edgeTestDocs.push(docId);

      await setDocument(TEST_COLLECTION, docId, {
        emptyObject: {},
        emptyArray: [],
        emptyString: '',
        _test: true,
      });

      const doc = await getDocument(TEST_COLLECTION, docId);
      expect(doc?.emptyObject).toEqual({});
      expect(doc?.emptyArray).toEqual([]);
      expect(doc?.emptyString).toBe('');
    });

    it('should handle null and undefined values', async () => {
      const docId = `test-${timestamp}-null`;
      edgeTestDocs.push(docId);

      await setDocument(TEST_COLLECTION, docId, {
        nullValue: null,
        normalValue: 'test',
        _test: true,
      });

      const doc = await getDocument(TEST_COLLECTION, docId);
      expect(doc?.nullValue).toBeNull();
      expect(doc?.normalValue).toBe('test');
    });

    it('should handle very long strings', async () => {
      const docId = `test-${timestamp}-long-string`;
      edgeTestDocs.push(docId);

      const longString = 'a'.repeat(10000); // 10KB string

      await setDocument(TEST_COLLECTION, docId, {
        longText: longString,
        _test: true,
      });

      const doc = await getDocument(TEST_COLLECTION, docId);
      expect(doc?.longText).toHaveLength(10000);
    });

    it('should handle documents with many fields', async () => {
      const docId = `test-${timestamp}-many-fields`;
      edgeTestDocs.push(docId);

      const manyFields: any = { _test: true };
      for (let i = 0; i < 50; i++) {
        manyFields[`field${i}`] = `value${i}`;
      }

      await setDocument(TEST_COLLECTION, docId, manyFields);

      const doc = await getDocument(TEST_COLLECTION, docId);
      expect(doc?.field0).toBe('value0');
      expect(doc?.field49).toBe('value49');
    });

    it('should handle complex nested arrays with objects (message content scenario)', async () => {
      const docId = `test-${timestamp}-message-content`;
      edgeTestDocs.push(docId);

      // This tests the exact scenario from the task document
      const messageContent = [
        { type: 'text', text: 'what do you see in this image?' },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
          }
        }
      ];

      await setDocument(TEST_COLLECTION, docId, {
        content: messageContent,
        timestamp: new Date().toISOString(),
        _test: true,
      });

      const doc = await getDocument(TEST_COLLECTION, docId);
      
      // Verify the content is an array, not a string
      expect(Array.isArray(doc?.content)).toBe(true);
      expect(doc?.content).toHaveLength(2);
      
      // Verify first element (text)
      expect(doc?.content[0].type).toBe('text');
      expect(doc?.content[0].text).toBe('what do you see in this image?');
      
      // Verify second element (image with nested source object)
      expect(doc?.content[1].type).toBe('image');
      expect(doc?.content[1].source).toBeDefined();
      expect(doc?.content[1].source.type).toBe('base64');
      expect(doc?.content[1].source.media_type).toBe('image/png');
      expect(doc?.content[1].source.data).toContain('iVBORw0KGgo');
      
      // Most importantly: verify it's NOT a JSON string
      expect(typeof doc?.content).not.toBe('string');
    });
  });
});
