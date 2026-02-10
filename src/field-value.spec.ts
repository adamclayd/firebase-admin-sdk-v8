/**
 * Unit tests for field-value.ts
 * Tests FieldValue sentinel values and type checking
 */

import {
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  deleteField,
  isFieldValue,
  FieldValue,
} from './field-value';

describe('FieldValue Sentinels', () => {
  describe('serverTimestamp()', () => {
    it('should create serverTimestamp sentinel', () => {
      const result = serverTimestamp();
      
      expect(result).toEqual({
        _type: 'serverTimestamp',
      });
    });

    it('should have correct _type property', () => {
      const result = serverTimestamp();
      expect(result._type).toBe('serverTimestamp');
    });

    it('should be identifiable by isFieldValue()', () => {
      const result = serverTimestamp();
      expect(isFieldValue(result)).toBe(true);
    });

    it('should not have a _value property', () => {
      const result = serverTimestamp();
      expect(result).not.toHaveProperty('_value');
    });
  });

  describe('deleteField()', () => {
    it('should create delete sentinel', () => {
      const result = deleteField();
      
      expect(result).toEqual({
        _type: 'delete',
      });
    });

    it('should have correct _type property', () => {
      const result = deleteField();
      expect(result._type).toBe('delete');
    });

    it('should be identifiable by isFieldValue()', () => {
      const result = deleteField();
      expect(isFieldValue(result)).toBe(true);
    });
  });

  describe('increment()', () => {
    it('should create increment sentinel with positive number', () => {
      const result = increment(5);
      
      expect(result).toEqual({
        _type: 'increment',
        _value: 5,
      });
    });

    it('should create increment sentinel with negative number', () => {
      const result = increment(-3);
      
      expect(result).toEqual({
        _type: 'increment',
        _value: -3,
      });
    });

    it('should create increment sentinel with zero', () => {
      const result = increment(0);
      
      expect(result).toEqual({
        _type: 'increment',
        _value: 0,
      });
    });

    it('should handle decimal numbers', () => {
      const result = increment(1.5);
      
      expect(result).toEqual({
        _type: 'increment',
        _value: 1.5,
      });
    });

    it('should store the increment value', () => {
      const result = increment(10);
      expect(result._value).toBe(10);
    });

    it('should be identifiable by isFieldValue()', () => {
      const result = increment(1);
      expect(isFieldValue(result)).toBe(true);
    });
  });

  describe('arrayUnion()', () => {
    it('should create arrayUnion sentinel with single element', () => {
      const result = arrayUnion('tag1');
      
      expect(result).toEqual({
        _type: 'arrayUnion',
        _value: ['tag1'],
      });
    });

    it('should create arrayUnion sentinel with multiple elements', () => {
      const result = arrayUnion('tag1', 'tag2', 'tag3');
      
      expect(result).toEqual({
        _type: 'arrayUnion',
        _value: ['tag1', 'tag2', 'tag3'],
      });
    });

    it('should handle empty array', () => {
      const result = arrayUnion();
      
      expect(result).toEqual({
        _type: 'arrayUnion',
        _value: [],
      });
    });

    it('should handle different data types', () => {
      const result = arrayUnion('string', 123, true, { key: 'value' });
      
      expect(result._value).toEqual(['string', 123, true, { key: 'value' }]);
    });

    it('should handle nested arrays', () => {
      const result = arrayUnion([1, 2], [3, 4]);
      
      expect(result._value).toEqual([[1, 2], [3, 4]]);
    });

    it('should be identifiable by isFieldValue()', () => {
      const result = arrayUnion('test');
      expect(isFieldValue(result)).toBe(true);
    });
  });

  describe('arrayRemove()', () => {
    it('should create arrayRemove sentinel with single element', () => {
      const result = arrayRemove('tag1');
      
      expect(result).toEqual({
        _type: 'arrayRemove',
        _value: ['tag1'],
      });
    });

    it('should create arrayRemove sentinel with multiple elements', () => {
      const result = arrayRemove('tag1', 'tag2');
      
      expect(result).toEqual({
        _type: 'arrayRemove',
        _value: ['tag1', 'tag2'],
      });
    });

    it('should handle empty array', () => {
      const result = arrayRemove();
      
      expect(result).toEqual({
        _type: 'arrayRemove',
        _value: [],
      });
    });

    it('should handle different data types', () => {
      const result = arrayRemove('string', 456, false);
      
      expect(result._value).toEqual(['string', 456, false]);
    });

    it('should be identifiable by isFieldValue()', () => {
      const result = arrayRemove('test');
      expect(isFieldValue(result)).toBe(true);
    });
  });

  describe('isFieldValue()', () => {
    it('should return true for serverTimestamp', () => {
      expect(isFieldValue(serverTimestamp())).toBe(true);
    });

    it('should return true for delete', () => {
      expect(isFieldValue(deleteField())).toBe(true);
    });

    it('should return true for increment', () => {
      expect(isFieldValue(increment(1))).toBe(true);
    });

    it('should return true for arrayUnion', () => {
      expect(isFieldValue(arrayUnion('test'))).toBe(true);
    });

    it('should return true for arrayRemove', () => {
      expect(isFieldValue(arrayRemove('test'))).toBe(true);
    });

    it('should return false for regular objects', () => {
      expect(isFieldValue({ key: 'value' })).toBe(false);
    });

    it('should return false for null', () => {
      expect(isFieldValue(null)).toBeFalsy();
    });

    it('should return false for undefined', () => {
      expect(isFieldValue(undefined)).toBeFalsy();
    });

    it('should return false for primitives', () => {
      expect(isFieldValue('string')).toBe(false);
      expect(isFieldValue(123)).toBe(false);
      expect(isFieldValue(true)).toBe(false);
    });

    it('should return false for objects with _type but not FieldValue', () => {
      expect(isFieldValue({ _type: 'custom', other: 'prop' })).toBe(true); // Has _type, so technically matches
    });

    it('should return false for arrays', () => {
      expect(isFieldValue([1, 2, 3])).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isFieldValue({})).toBe(false);
    });
  });

  describe('FieldValue namespace', () => {
    it('should expose serverTimestamp method', () => {
      expect(FieldValue.serverTimestamp).toBe(serverTimestamp);
      expect(typeof FieldValue.serverTimestamp).toBe('function');
    });

    it('should expose increment method', () => {
      expect(FieldValue.increment).toBe(increment);
      expect(typeof FieldValue.increment).toBe('function');
    });

    it('should expose arrayUnion method', () => {
      expect(FieldValue.arrayUnion).toBe(arrayUnion);
      expect(typeof FieldValue.arrayUnion).toBe('function');
    });

    it('should expose arrayRemove method', () => {
      expect(FieldValue.arrayRemove).toBe(arrayRemove);
      expect(typeof FieldValue.arrayRemove).toBe('function');
    });

    it('should expose delete method', () => {
      expect(FieldValue.delete).toBe(deleteField);
      expect(typeof FieldValue.delete).toBe('function');
    });

    it('should work when called via namespace', () => {
      const timestamp = FieldValue.serverTimestamp();
      expect(timestamp._type).toBe('serverTimestamp');

      const inc = FieldValue.increment(5);
      expect(inc._value).toBe(5);

      const union = FieldValue.arrayUnion('a', 'b');
      expect(union._value).toEqual(['a', 'b']);

      const remove = FieldValue.arrayRemove('x');
      expect(remove._value).toEqual(['x']);

      const del = FieldValue.delete();
      expect(del._type).toBe('delete');
    });
  });
});
