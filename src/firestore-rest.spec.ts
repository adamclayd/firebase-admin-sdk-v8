/**
 * Unit test to verify structured query generation for subcollections
 */

import { buildStructuredQuery } from './firestore-rest';
import type { QueryOptions } from './types';

describe('Firestore Query Structure', () => {
  describe('buildStructuredQuery', () => {
    it('should generate correct query for top-level collection', () => {
      const collectionPath = 'users';
      const options: QueryOptions = {
        orderBy: [{ field: 'name', direction: 'ASCENDING' }],
        limit: 10
      };

      const result = buildStructuredQuery(collectionPath, options);

      expect(result).toEqual({
        from: [{ collectionId: 'users' }],
        orderBy: [{ field: { fieldPath: 'name' }, direction: 'ASCENDING' }],
        limit: 10
      });
      
      // Top-level collections should NOT have allDescendants flag
      expect(result.from[0]).not.toHaveProperty('allDescendants');
    });

    it('should generate correct query for subcollection (1 level deep)', () => {
      const collectionPath = 'users/user123/posts';
      const options: QueryOptions = {
        orderBy: [{ field: 'createdAt', direction: 'DESCENDING' }],
        limit: 50
      };

      const result = buildStructuredQuery(collectionPath, options);

      expect(result).toEqual({
        from: [{ collectionId: 'posts', allDescendants: false }],
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: 50
      });
      
      // Subcollections MUST have allDescendants: false
      expect(result.from[0].allDescendants).toBe(false);
    });

    it('should generate correct query for subcollection (2 levels deep)', () => {
      const collectionPath = 'conversations/main/messages';
      const options: QueryOptions = {
        orderBy: [{ field: 'timestamp', direction: 'DESCENDING' }],
        limit: 50
      };

      const result = buildStructuredQuery(collectionPath, options);

      expect(result).toEqual({
        from: [{ collectionId: 'messages', allDescendants: false }],
        orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'DESCENDING' }],
        limit: 50
      });
      
      expect(result.from[0].collectionId).toBe('messages');
      expect(result.from[0].allDescendants).toBe(false);
    });

    it('should generate correct query for deep subcollection (3 levels deep)', () => {
      const collectionPath = 'orgs/org1/teams/team1/members';
      const options: QueryOptions = {
        limit: 100
      };

      const result = buildStructuredQuery(collectionPath, options);

      expect(result).toEqual({
        from: [{ collectionId: 'members', allDescendants: false }],
        limit: 100
      });
      
      expect(result.from[0].collectionId).toBe('members');
      expect(result.from[0].allDescendants).toBe(false);
    });

    it('should only use the last segment as collectionId', () => {
      const paths = [
        { path: 'users', expected: 'users' },
        { path: 'users/u1/posts', expected: 'posts' },
        { path: 'a/b/c/d/e', expected: 'e' },
      ];

      paths.forEach(({ path, expected }) => {
        const result = buildStructuredQuery(path, {});
        expect(result.from[0].collectionId).toBe(expected);
      });
    });
  });

  describe('Query URL generation (integration test)', () => {
    const FIRESTORE_API = 'https://firestore.googleapis.com/v1';
    const projectId = 'test-project';

    function buildQueryUrl(collectionPath: string): string {
      const pathSegments = collectionPath.split('/');
      
      if (pathSegments.length > 1) {
        const parentPath = pathSegments.slice(0, -1).join('/');
        return `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/${parentPath}:runQuery`;
      } else {
        return `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents:runQuery`;
      }
    }

    it('should generate correct URL for top-level collection', () => {
      const url = buildQueryUrl('users');
      expect(url).toBe(
        'https://firestore.googleapis.com/v1/projects/test-project/databases/(default)/documents:runQuery'
      );
    });

    it('should generate correct URL for subcollection', () => {
      const url = buildQueryUrl('users/user123/posts');
      expect(url).toBe(
        'https://firestore.googleapis.com/v1/projects/test-project/databases/(default)/documents/users/user123:runQuery'
      );
    });

    it('should generate correct URL for 2-level deep subcollection', () => {
      const url = buildQueryUrl('conversations/main/messages');
      expect(url).toBe(
        'https://firestore.googleapis.com/v1/projects/test-project/databases/(default)/documents/conversations/main:runQuery'
      );
    });

    it('should generate correct URL for 3-level deep subcollection', () => {
      const url = buildQueryUrl('orgs/org1/teams/team1/members');
      expect(url).toBe(
        'https://firestore.googleapis.com/v1/projects/test-project/databases/(default)/documents/orgs/org1/teams/team1:runQuery'
      );
    });
  });

  // CRUD Operations tests to be added
  // Requires mocking getAdminAccessToken and getProjectId
  // See agent/tasks/test-firestore-rest.md for details
});
