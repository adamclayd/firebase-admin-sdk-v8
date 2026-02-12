/**
 * Integration tests for Firestore REST API operations
 */

import {
  toFirestoreValue,
  fromFirestoreValue,
  convertToFirestoreFormat,
  convertFromFirestoreFormat,
} from './firestore-rest';

describe('Firestore REST API Integration', () => {

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

      it('should throw error for unknown value types', () => {
        expect(() => fromFirestoreValue({} as any)).toThrow('Unknown Firestore value type');
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
});
