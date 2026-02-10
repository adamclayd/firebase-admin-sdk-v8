/**
 * Firebase Admin SDK v8 - Firestore Query Builder
 * Builds structured queries for Firestore REST API
 */

import type { QueryOptions, QueryFilter } from '../types';
import { toFirestoreValue } from './converters';

/**
 * Build a structured query for Firestore REST API
 * 
 * @param collectionPath - Collection path (e.g., 'users' or 'users/uid/posts')
 * @param options - Query options (where, orderBy, limit, etc.)
 * @returns Structured query object for Firestore REST API
 * 
 * @example
 * ```typescript
 * // Top-level collection
 * buildStructuredQuery('users', { where: [{ field: 'age', op: '>=', value: 18 }] });
 * 
 * // Subcollection
 * buildStructuredQuery('users/uid123/posts', { limit: 10 });
 * ```
 */
export function buildStructuredQuery(collectionPath: string, options?: QueryOptions): any {
  const pathSegments = collectionPath.split('/');
  const collectionId = pathSegments[pathSegments.length - 1];
  
  const fromClause: any = { collectionId };
  
  // For subcollections, set allDescendants to false to query only direct children
  if (pathSegments.length > 1) {
    fromClause.allDescendants = false;
  }
  
  const query: any = {
    from: [fromClause],
  };

  if (options?.where && options.where.length > 0) {
    const filters = options.where.map((filter: QueryFilter) => ({
      fieldFilter: {
        field: { fieldPath: filter.field },
        op: mapWhereOp(filter.op),
        value: toFirestoreValue(filter.value),
      },
    }));

    if (filters.length === 1) {
      query.where = filters[0];
    } else {
      query.where = {
        compositeFilter: {
          op: 'AND',
          filters,
        },
      };
    }
  }

  if (options?.orderBy && options.orderBy.length > 0) {
    query.orderBy = options.orderBy.map(order => ({
      field: { fieldPath: order.field },
      direction: order.direction,
    }));
  }

  if (options?.limit) {
    query.limit = options.limit;
  }

  if (options?.offset) {
    query.offset = options.offset;
  }

  if (options?.startAt) {
    query.startAt = {
      values: options.startAt.map(v => toFirestoreValue(v)),
      before: true,
    };
  }

  if (options?.startAfter) {
    query.startAt = {
      values: options.startAfter.map(v => toFirestoreValue(v)),
      before: false,
    };
  }

  if (options?.endAt) {
    query.endAt = {
      values: options.endAt.map(v => toFirestoreValue(v)),
      before: false,
    };
  }

  if (options?.endBefore) {
    query.endAt = {
      values: options.endBefore.map(v => toFirestoreValue(v)),
      before: true,
    };
  }

  return query;
}

/**
 * Map query operators to Firestore REST API format
 * 
 * @param op - Query operator (e.g., '==', '>=', 'in')
 * @returns Firestore REST API operator (e.g., 'EQUAL', 'GREATER_THAN_OR_EQUAL', 'IN')
 * 
 * @example
 * ```typescript
 * mapWhereOp('=='); // 'EQUAL'
 * mapWhereOp('>='); // 'GREATER_THAN_OR_EQUAL'
 * mapWhereOp('in'); // 'IN'
 * ```
 */
export function mapWhereOp(op: string): string {
  const opMap: Record<string, string> = {
    '<': 'LESS_THAN',
    '<=': 'LESS_THAN_OR_EQUAL',
    '==': 'EQUAL',
    '!=': 'NOT_EQUAL',
    '>=': 'GREATER_THAN_OR_EQUAL',
    '>': 'GREATER_THAN',
    'array-contains': 'ARRAY_CONTAINS',
    'array-contains-any': 'ARRAY_CONTAINS_ANY',
    'in': 'IN',
    'not-in': 'NOT_IN',
  };
  return opMap[op] || 'EQUAL';
}
