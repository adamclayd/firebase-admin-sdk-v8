/**
 * Unit test to verify structured query generation for subcollections
 */

import {
  buildStructuredQuery,
  toFirestoreValue,
  fromFirestoreValue,
  convertToFirestoreFormat,
  convertFromFirestoreFormat,
  extractFieldTransforms,
  removeFieldTransforms,
} from './firestore-rest';
import { FieldValue } from './field-value';
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

  describe('Data Converters', () => {
    describe('toFirestoreValue', () => {
      it('should convert null to nullValue', () => {
        const result = toFirestoreValue(null);
        expect(result).toEqual({ nullValue: null });
      });

      it('should convert undefined to nullValue', () => {
        const result = toFirestoreValue(undefined);
        expect(result).toEqual({ nullValue: null });
      });

      it('should convert string to stringValue', () => {
        const result = toFirestoreValue('hello');
        expect(result).toEqual({ stringValue: 'hello' });
      });

      it('should convert boolean to booleanValue', () => {
        expect(toFirestoreValue(true)).toEqual({ booleanValue: true });
        expect(toFirestoreValue(false)).toEqual({ booleanValue: false });
      });

      it('should convert integer to integerValue', () => {
        const result = toFirestoreValue(42);
        expect(result).toEqual({ integerValue: '42' });
      });

      it('should convert float to doubleValue', () => {
        const result = toFirestoreValue(3.14);
        expect(result).toEqual({ doubleValue: 3.14 });
      });

      it('should convert Date to timestampValue', () => {
        const date = new Date('2024-01-01T00:00:00.000Z');
        const result = toFirestoreValue(date);
        expect(result).toEqual({ timestampValue: '2024-01-01T00:00:00.000Z' });
      });

      it('should convert array to arrayValue', () => {
        const result = toFirestoreValue([1, 'two', true]);
        expect(result).toEqual({
          arrayValue: {
            values: [
              { integerValue: '1' },
              { stringValue: 'two' },
              { booleanValue: true }
            ]
          }
        });
      });

      it('should convert object to mapValue', () => {
        const result = toFirestoreValue({ name: 'John', age: 30 });
        expect(result).toEqual({
          mapValue: {
            fields: {
              name: { stringValue: 'John' },
              age: { integerValue: '30' }
            }
          }
        });
      });

      it('should handle nested objects', () => {
        const result = toFirestoreValue({
          user: { name: 'John', tags: ['admin', 'user'] }
        });
        expect(result).toEqual({
          mapValue: {
            fields: {
              user: {
                mapValue: {
                  fields: {
                    name: { stringValue: 'John' },
                    tags: {
                      arrayValue: {
                        values: [
                          { stringValue: 'admin' },
                          { stringValue: 'user' }
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        });
      });
    });

    describe('fromFirestoreValue', () => {
      it('should convert stringValue to string', () => {
        const result = fromFirestoreValue({ stringValue: 'hello' });
        expect(result).toBe('hello');
      });

      it('should convert integerValue to number', () => {
        const result = fromFirestoreValue({ integerValue: '42' });
        expect(result).toBe(42);
      });

      it('should convert doubleValue to number', () => {
        const result = fromFirestoreValue({ doubleValue: 3.14 });
        expect(result).toBe(3.14);
      });

      it('should convert booleanValue to boolean', () => {
        expect(fromFirestoreValue({ booleanValue: true })).toBe(true);
        expect(fromFirestoreValue({ booleanValue: false })).toBe(false);
      });

      it('should convert nullValue to null', () => {
        const result = fromFirestoreValue({ nullValue: null });
        expect(result).toBeNull();
      });

      it('should convert timestampValue to Date', () => {
        const result = fromFirestoreValue({ timestampValue: '2024-01-01T00:00:00.000Z' });
        expect(result).toBeInstanceOf(Date);
        expect(result.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      });

      it('should convert arrayValue to array', () => {
        const result = fromFirestoreValue({
          arrayValue: {
            values: [
              { integerValue: '1' },
              { stringValue: 'two' },
              { booleanValue: true }
            ]
          }
        });
        expect(result).toEqual([1, 'two', true]);
      });

      it('should convert mapValue to object', () => {
        const result = fromFirestoreValue({
          mapValue: {
            fields: {
              name: { stringValue: 'John' },
              age: { integerValue: '30' }
            }
          }
        });
        expect(result).toEqual({ name: 'John', age: 30 });
      });

      it('should handle nested structures', () => {
        const result = fromFirestoreValue({
          mapValue: {
            fields: {
              user: {
                mapValue: {
                  fields: {
                    name: { stringValue: 'John' },
                    tags: {
                      arrayValue: {
                        values: [
                          { stringValue: 'admin' },
                          { stringValue: 'user' }
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        });
        expect(result).toEqual({
          user: { name: 'John', tags: ['admin', 'user'] }
        });
      });

      it('should return null for unknown value types', () => {
        const result = fromFirestoreValue({} as any);
        expect(result).toBeNull();
      });
    });

    describe('Round-trip conversion', () => {
      it('should preserve data through round-trip conversion', () => {
        const original = {
          string: 'hello',
          number: 42,
          float: 3.14,
          boolean: true,
          null: null,
          array: [1, 2, 3],
          nested: { key: 'value' }
        };

        const firestore = convertToFirestoreFormat(original);
        const restored = convertFromFirestoreFormat(firestore);

        expect(restored).toEqual(original);
      });
    });
  });

  describe('Field Transforms', () => {
    describe('extractFieldTransforms', () => {
      it('should extract serverTimestamp transform', () => {
        const data = {
          name: 'John',
          createdAt: FieldValue.serverTimestamp()
        };

        const transforms = extractFieldTransforms(data);

        expect(transforms).toEqual([
          {
            fieldPath: 'createdAt',
            setToServerValue: 'REQUEST_TIME'
          }
        ]);
      });

      it('should extract increment transform', () => {
        const data = {
          count: FieldValue.increment(5)
        };

        const transforms = extractFieldTransforms(data);

        expect(transforms).toEqual([
          {
            fieldPath: 'count',
            increment: { integerValue: '5' }
          }
        ]);
      });

      it('should extract arrayUnion transform', () => {
        const data = {
          tags: FieldValue.arrayUnion('tag1', 'tag2')
        };

        const transforms = extractFieldTransforms(data);

        expect(transforms).toEqual([
          {
            fieldPath: 'tags',
            appendMissingElements: {
              values: [
                { stringValue: 'tag1' },
                { stringValue: 'tag2' }
              ]
            }
          }
        ]);
      });

      it('should extract arrayRemove transform', () => {
        const data = {
          tags: FieldValue.arrayRemove('oldTag')
        };

        const transforms = extractFieldTransforms(data);

        expect(transforms).toEqual([
          {
            fieldPath: 'tags',
            removeAllFromArray: {
              values: [{ stringValue: 'oldTag' }]
            }
          }
        ]);
      });

      it('should extract multiple transforms', () => {
        const data = {
          createdAt: FieldValue.serverTimestamp(),
          count: FieldValue.increment(1),
          tags: FieldValue.arrayUnion('new')
        };

        const transforms = extractFieldTransforms(data);

        expect(transforms).toHaveLength(3);
        expect(transforms[0].fieldPath).toBe('createdAt');
        expect(transforms[1].fieldPath).toBe('count');
        expect(transforms[2].fieldPath).toBe('tags');
      });

      it('should return empty array for no transforms', () => {
        const data = {
          name: 'John',
          age: 30
        };

        const transforms = extractFieldTransforms(data);

        expect(transforms).toEqual([]);
      });

      it('should not extract delete field values', () => {
        const data = {
          name: 'John',
          oldField: FieldValue.delete()
        };

        const transforms = extractFieldTransforms(data);

        expect(transforms).toEqual([]);
      });
    });

    describe('removeFieldTransforms', () => {
      it('should remove serverTimestamp', () => {
        const data = {
          name: 'John',
          createdAt: FieldValue.serverTimestamp()
        };

        const result = removeFieldTransforms(data);

        expect(result).toEqual({ name: 'John' });
      });

      it('should remove increment', () => {
        const data = {
          name: 'John',
          count: FieldValue.increment(1)
        };

        const result = removeFieldTransforms(data);

        expect(result).toEqual({ name: 'John' });
      });

      it('should remove arrayUnion', () => {
        const data = {
          name: 'John',
          tags: FieldValue.arrayUnion('tag')
        };

        const result = removeFieldTransforms(data);

        expect(result).toEqual({ name: 'John' });
      });

      it('should remove arrayRemove', () => {
        const data = {
          name: 'John',
          tags: FieldValue.arrayRemove('tag')
        };

        const result = removeFieldTransforms(data);

        expect(result).toEqual({ name: 'John' });
      });

      it('should remove delete field', () => {
        const data = {
          name: 'John',
          oldField: FieldValue.delete()
        };

        const result = removeFieldTransforms(data);

        expect(result).toEqual({ name: 'John' });
      });

      it('should keep regular fields', () => {
        const data = {
          name: 'John',
          age: 30,
          active: true
        };

        const result = removeFieldTransforms(data);

        expect(result).toEqual(data);
      });

      it('should remove all FieldValue sentinels', () => {
        const data = {
          name: 'John',
          createdAt: FieldValue.serverTimestamp(),
          count: FieldValue.increment(1),
          tags: FieldValue.arrayUnion('tag'),
          oldTags: FieldValue.arrayRemove('old'),
          deletedField: FieldValue.delete()
        };

        const result = removeFieldTransforms(data);

        expect(result).toEqual({ name: 'John' });
      });
    });
  });
});
