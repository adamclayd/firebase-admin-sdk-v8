/**
 * End-to-end tests for getAll (batchGet)
 * These tests run against a real Firebase project
 *
 * Run with: npm run test:e2e
 */

import { initializeApp } from '../config';
import { setDocument, deleteDocument } from './operations';
import { getAll, getAllByPaths } from './operations';
import * as fs from 'fs';
import * as path from 'path';

describe('getAll E2E Tests', () => {
  const TEST_COLLECTION = 'e2e-getall-tests';
  const timestamp = Date.now();
  const docIds = [`doc1-${timestamp}`, `doc2-${timestamp}`, `doc3-${timestamp}`];

  beforeAll(async () => {
    // Load service account from filesystem
    const serviceAccountPath = path.join(__dirname, '../../service-account.json');

    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        'service-account.json not found. Please add your Firebase service account credentials to the project root.'
      );
    }

    const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf-8');
    const serviceAccount = JSON.parse(serviceAccountJson);

    initializeApp({
      serviceAccount,
      projectId: 'prmichaelsen-firebase-e2e',
    });

    // Seed test documents
    await Promise.all([
      setDocument(TEST_COLLECTION, docIds[0], { name: 'Alice', order: 1 }),
      setDocument(TEST_COLLECTION, docIds[1], { name: 'Bob', order: 2 }),
      setDocument(TEST_COLLECTION, docIds[2], { name: 'Charlie', order: 3 }),
    ]);
  });

  afterAll(async () => {
    // Clean up
    await Promise.all(
      docIds.map(id =>
        deleteDocument(TEST_COLLECTION, id).catch(() => {})
      )
    );
  });

  it('should batch get all existing documents', async () => {
    const results = await getAll(TEST_COLLECTION, docIds);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(expect.objectContaining({ name: 'Alice', order: 1 }));
    expect(results[1]).toEqual(expect.objectContaining({ name: 'Bob', order: 2 }));
    expect(results[2]).toEqual(expect.objectContaining({ name: 'Charlie', order: 3 }));
  });

  it('should return null for non-existing documents', async () => {
    const results = await getAll(TEST_COLLECTION, [
      docIds[0],
      `nonexistent-${timestamp}`,
      docIds[2],
    ]);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(expect.objectContaining({ name: 'Alice' }));
    expect(results[1]).toBeNull();
    expect(results[2]).toEqual(expect.objectContaining({ name: 'Charlie' }));
  });

  it('should return empty array for empty input', async () => {
    const results = await getAll(TEST_COLLECTION, []);
    expect(results).toEqual([]);
  });

  it('should preserve input order regardless of API response order', async () => {
    // Fetch in reverse order
    const results = await getAll(TEST_COLLECTION, [docIds[2], docIds[1], docIds[0]]);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(expect.objectContaining({ name: 'Charlie' }));
    expect(results[1]).toEqual(expect.objectContaining({ name: 'Bob' }));
    expect(results[2]).toEqual(expect.objectContaining({ name: 'Alice' }));
  });

  it('should return all nulls for entirely non-existing documents', async () => {
    const results = await getAll(TEST_COLLECTION, [
      `fake1-${timestamp}`,
      `fake2-${timestamp}`,
    ]);

    expect(results).toEqual([null, null]);
  });
});

describe('getAllByPaths E2E Tests', () => {
  const timestamp = Date.now();
  const COLLECTION_A = 'e2e-bypath-a';
  const COLLECTION_B = 'e2e-bypath-b';
  const docIdA = `docA-${timestamp}`;
  const docIdB = `docB-${timestamp}`;

  beforeAll(async () => {
    const serviceAccountPath = path.join(__dirname, '../../service-account.json');

    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        'service-account.json not found. Please add your Firebase service account credentials to the project root.'
      );
    }

    const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf-8');
    const serviceAccount = JSON.parse(serviceAccountJson);

    initializeApp({
      serviceAccount,
      projectId: 'prmichaelsen-firebase-e2e',
    });

    await Promise.all([
      setDocument(COLLECTION_A, docIdA, { name: 'Alpha', source: 'a' }),
      setDocument(COLLECTION_B, docIdB, { name: 'Beta', source: 'b' }),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      deleteDocument(COLLECTION_A, docIdA).catch(() => {}),
      deleteDocument(COLLECTION_B, docIdB).catch(() => {}),
    ]);
  });

  it('should batch get documents from different collections', async () => {
    const results = await getAllByPaths([
      { collection: COLLECTION_A, id: docIdA },
      { collection: COLLECTION_B, id: docIdB },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(expect.objectContaining({ name: 'Alpha', source: 'a' }));
    expect(results[1]).toEqual(expect.objectContaining({ name: 'Beta', source: 'b' }));
  });

  it('should return null for non-existing documents mixed with existing', async () => {
    const results = await getAllByPaths([
      { collection: COLLECTION_A, id: docIdA },
      { collection: COLLECTION_B, id: `nonexistent-${timestamp}` },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(expect.objectContaining({ name: 'Alpha' }));
    expect(results[1]).toBeNull();
  });

  it('should return empty array for empty input', async () => {
    const results = await getAllByPaths([]);
    expect(results).toEqual([]);
  });
});
