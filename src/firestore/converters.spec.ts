/**
 * Unit tests for firestore/converters.ts
 * Tests data format conversion between JavaScript and Firestore
 */

import {
  toFirestoreValue,
  fromFirestoreValue,
  convertToFirestoreFormat,
  convertFromFirestoreFormat,
} from './converters';

describe('Firestore Data Converters', () => {
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

    it('should handle complex nested structures', () => {
      const original = {
        users: [
          { name: 'Alice', age: 30, tags: ['admin'] },
          { name: 'Bob', age: 25, tags: ['user', 'viewer'] }
        ],
        metadata: {
          created: new Date('2024-01-01'),
          count: 2,
          active: true
        }
      };

      const firestore = convertToFirestoreFormat(original);
      const restored = convertFromFirestoreFormat(firestore);

      // Dates are converted to Date objects, so we need to compare carefully
      expect(restored.users).toEqual(original.users);
      expect(restored.metadata.count).toBe(2);
      expect(restored.metadata.active).toBe(true);
      expect(restored.metadata.created).toBeInstanceOf(Date);
    });
  });
});
