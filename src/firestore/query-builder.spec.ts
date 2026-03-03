/**
 * Tests for Firestore Query Builder
 */

import { buildStructuredQuery, mapWhereOp } from './query-builder';

describe('Firestore Query Builder', () => {
  describe('buildStructuredQuery', () => {
    it('should generate correct query for top-level collection', () => {
      const query = buildStructuredQuery('users');
      
      expect(query).toEqual({
        from: [{ collectionId: 'users' }],
      });
    });

    it('should generate correct query for subcollection (1 level deep)', () => {
      const query = buildStructuredQuery('users/uid123/posts');
      
      expect(query).toEqual({
        from: [{ collectionId: 'posts', allDescendants: false }],
      });
    });

    it('should generate correct query for subcollection (2 levels deep)', () => {
      const query = buildStructuredQuery('users/uid123/posts/postId456/comments');
      
      expect(query).toEqual({
        from: [{ collectionId: 'comments', allDescendants: false }],
      });
    });

    it('should generate correct query for deep subcollection (3 levels deep)', () => {
      const query = buildStructuredQuery('a/b/c/d/e/f/g');
      
      expect(query).toEqual({
        from: [{ collectionId: 'g', allDescendants: false }],
      });
    });

    it('should only use the last segment as collectionId', () => {
      const paths = [
        { path: 'users', expected: 'users' },
        { path: 'users/uid/posts', expected: 'posts' },
        { path: 'a/b/c/d/e', expected: 'e' },
      ];
      
      paths.forEach(({ path, expected }) => {
        const query = buildStructuredQuery(path);
        expect(query.from[0].collectionId).toBe(expected);
      });
    });

    it('should handle where clause with single filter', () => {
      const query = buildStructuredQuery('users', {
        where: [{ field: 'age', op: '>=', value: 18 }],
      });
      
      expect(query.where).toEqual({
        fieldFilter: {
          field: { fieldPath: 'age' },
          op: 'GREATER_THAN_OR_EQUAL',
          value: { integerValue: '18' },
        },
      });
    });

    it('should handle where clause with multiple filters', () => {
      const query = buildStructuredQuery('users', {
        where: [
          { field: 'age', op: '>=', value: 18 },
          { field: 'name', op: '==', value: 'John' },
        ],
      });
      
      expect(query.where).toEqual({
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'age' },
                op: 'GREATER_THAN_OR_EQUAL',
                value: { integerValue: '18' },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: 'name' },
                op: 'EQUAL',
                value: { stringValue: 'John' },
              },
            },
          ],
        },
      });
    });

    it('should handle orderBy clause', () => {
      const query = buildStructuredQuery('users', {
        orderBy: [
          { field: 'age', direction: 'DESCENDING' as const },
          { field: 'name', direction: 'ASCENDING' as const },
        ],
      });
      
      expect(query.orderBy).toEqual([
        { field: { fieldPath: 'age' }, direction: 'DESCENDING' },
        { field: { fieldPath: 'name' }, direction: 'ASCENDING' },
      ]);
    });

    it('should handle limit', () => {
      const query = buildStructuredQuery('users', { limit: 10 });
      expect(query.limit).toBe(10);
    });

    it('should handle offset', () => {
      const query = buildStructuredQuery('users', { offset: 5 });
      expect(query.offset).toBe(5);
    });

    it('should handle startAt', () => {
      const query = buildStructuredQuery('users', {
        startAt: [18, 'John'],
      });
      
      expect(query.startAt).toEqual({
        values: [
          { integerValue: '18' },
          { stringValue: 'John' },
        ],
        before: true,
      });
    });

    it('should handle startAfter', () => {
      const query = buildStructuredQuery('users', {
        startAfter: [18, 'John'],
      });
      
      expect(query.startAt).toEqual({
        values: [
          { integerValue: '18' },
          { stringValue: 'John' },
        ],
        before: false,
      });
    });

    it('should handle endAt', () => {
      const query = buildStructuredQuery('users', {
        endAt: [65, 'Zoe'],
      });
      
      expect(query.endAt).toEqual({
        values: [
          { integerValue: '65' },
          { stringValue: 'Zoe' },
        ],
        before: false,
      });
    });

    it('should handle endBefore', () => {
      const query = buildStructuredQuery('users', {
        endBefore: [65, 'Zoe'],
      });
      
      expect(query.endAt).toEqual({
        values: [
          { integerValue: '65' },
          { stringValue: 'Zoe' },
        ],
        before: true,
      });
    });

    it('should handle complex query with multiple options', () => {
      const query = buildStructuredQuery('users/uid123/posts', {
        where: [
          { field: 'published', op: '==', value: true },
          { field: 'views', op: '>', value: 100 },
        ],
        orderBy: [{ field: 'createdAt', direction: 'DESCENDING' as const }],
        limit: 20,
        offset: 10,
      });
      
      expect(query).toEqual({
        from: [{ collectionId: 'posts', allDescendants: false }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: 'published' },
                  op: 'EQUAL',
                  value: { booleanValue: true },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: 'views' },
                  op: 'GREATER_THAN',
                  value: { integerValue: '100' },
                },
              },
            ],
          },
        },
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: 20,
        offset: 10,
      });
    });

    it('should use unaryFilter for null value queries', () => {
      const query = buildStructuredQuery('users', {
        where: [{ field: 'deletedAt', op: '==', value: null }],
      });

      expect(query.where).toEqual({
        unaryFilter: {
          field: { fieldPath: 'deletedAt' },
          op: 'IS_NULL',
        },
      });
    });

    it('should use unaryFilter for undefined value queries', () => {
      const query = buildStructuredQuery('users', {
        where: [{ field: 'deletedAt', op: '==', value: undefined }],
      });

      expect(query.where).toEqual({
        unaryFilter: {
          field: { fieldPath: 'deletedAt' },
          op: 'IS_NULL',
        },
      });
    });

    it('should use unaryFilter for NaN value queries', () => {
      const query = buildStructuredQuery('users', {
        where: [{ field: 'score', op: '==', value: NaN }],
      });

      expect(query.where).toEqual({
        unaryFilter: {
          field: { fieldPath: 'score' },
          op: 'IS_NAN',
        },
      });
    });

    it('should use fieldFilter for non-null values', () => {
      const query = buildStructuredQuery('users', {
        where: [{ field: 'age', op: '==', value: 0 }],
      });

      expect(query.where).toEqual({
        fieldFilter: {
          field: { fieldPath: 'age' },
          op: 'EQUAL',
          value: { integerValue: '0' },
        },
      });
    });

    it('should handle multiple filters with null values', () => {
      const query = buildStructuredQuery('users', {
        where: [
          { field: 'deletedAt', op: '==', value: null },
          { field: 'active', op: '==', value: true },
        ],
      });

      expect(query.where).toEqual({
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              unaryFilter: {
                field: { fieldPath: 'deletedAt' },
                op: 'IS_NULL',
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: 'active' },
                op: 'EQUAL',
                value: { booleanValue: true },
              },
            },
          ],
        },
      });
    });

    it('should use fieldFilter for null with non-equality operators', () => {
      // Only == operator should trigger unaryFilter for null
      const query = buildStructuredQuery('users', {
        where: [{ field: 'age', op: '>', value: null }],
      });

      expect(query.where).toEqual({
        fieldFilter: {
          field: { fieldPath: 'age' },
          op: 'GREATER_THAN',
          value: { nullValue: null },
        },
      });
    });
  });

  describe('mapWhereOp', () => {
    it('should map < to LESS_THAN', () => {
      expect(mapWhereOp('<')).toBe('LESS_THAN');
    });

    it('should map <= to LESS_THAN_OR_EQUAL', () => {
      expect(mapWhereOp('<=')).toBe('LESS_THAN_OR_EQUAL');
    });

    it('should map == to EQUAL', () => {
      expect(mapWhereOp('==')).toBe('EQUAL');
    });

    it('should map != to NOT_EQUAL', () => {
      expect(mapWhereOp('!=')).toBe('NOT_EQUAL');
    });

    it('should map >= to GREATER_THAN_OR_EQUAL', () => {
      expect(mapWhereOp('>=')).toBe('GREATER_THAN_OR_EQUAL');
    });

    it('should map > to GREATER_THAN', () => {
      expect(mapWhereOp('>')).toBe('GREATER_THAN');
    });

    it('should map array-contains to ARRAY_CONTAINS', () => {
      expect(mapWhereOp('array-contains')).toBe('ARRAY_CONTAINS');
    });

    it('should map array-contains-any to ARRAY_CONTAINS_ANY', () => {
      expect(mapWhereOp('array-contains-any')).toBe('ARRAY_CONTAINS_ANY');
    });

    it('should map in to IN', () => {
      expect(mapWhereOp('in')).toBe('IN');
    });

    it('should map not-in to NOT_IN', () => {
      expect(mapWhereOp('not-in')).toBe('NOT_IN');
    });

    it('should default to EQUAL for unknown operators', () => {
      expect(mapWhereOp('unknown')).toBe('EQUAL');
    });
  });
});
