/**
 * Tests for Firestore Field Transforms
 */

import { extractFieldTransforms, removeFieldTransforms } from './transforms';
import { FieldValue } from '../field-value';

describe('Firestore Field Transforms', () => {
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
