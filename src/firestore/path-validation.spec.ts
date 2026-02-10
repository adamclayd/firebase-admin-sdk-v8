/**
 * Unit tests for Firestore path validation
 */

import {
  validateCollectionPath,
  validateDocumentPath,
  isCollectionPath,
  isDocumentPath,
} from './path-validation';

describe('Path Validation', () => {
  describe('isCollectionPath', () => {
    it('should return true for paths with odd number of segments', () => {
      expect(isCollectionPath('users')).toBe(true);
      expect(isCollectionPath('users/user123/messages')).toBe(true);
      expect(isCollectionPath('a/b/c/d/e')).toBe(true);
    });

    it('should return false for paths with even number of segments', () => {
      expect(isCollectionPath('users/user123')).toBe(false);
      expect(isCollectionPath('users/user123/messages/msg456')).toBe(false);
      expect(isCollectionPath('a/b/c/d')).toBe(false);
    });

    it('should handle paths with dots in collection names', () => {
      expect(isCollectionPath('agentbase.users')).toBe(true);
      expect(isCollectionPath('agentbase.users/user123/credentials')).toBe(true);
    });

    it('should filter out empty segments from leading/trailing slashes', () => {
      expect(isCollectionPath('/users/')).toBe(true);
      expect(isCollectionPath('/users/user123/')).toBe(false);
    });
  });

  describe('isDocumentPath', () => {
    it('should return true for paths with even number of segments', () => {
      expect(isDocumentPath('users/user123')).toBe(true);
      expect(isDocumentPath('users/user123/messages/msg456')).toBe(true);
      expect(isDocumentPath('a/b/c/d')).toBe(true);
    });

    it('should return false for paths with odd number of segments', () => {
      expect(isDocumentPath('users')).toBe(false);
      expect(isDocumentPath('users/user123/messages')).toBe(false);
      expect(isDocumentPath('a/b/c')).toBe(false);
    });

    it('should return false for empty paths', () => {
      expect(isDocumentPath('')).toBe(false);
      expect(isDocumentPath('/')).toBe(false);
    });
  });

  describe('validateCollectionPath', () => {
    it('should not throw for valid collection paths', () => {
      expect(() => validateCollectionPath('collectionPath', 'users')).not.toThrow();
      expect(() => validateCollectionPath('collectionPath', 'users/user123/messages')).not.toThrow();
      expect(() => validateCollectionPath('collectionPath', 'a/b/c/d/e')).not.toThrow();
    });

    it('should throw for paths with even number of segments', () => {
      expect(() => validateCollectionPath('collectionPath', 'users/user123'))
        .toThrow('must point to a collection');
      
      expect(() => validateCollectionPath('collectionPath', 'users/user123'))
        .toThrow('does not contain an odd number of components');
    });

    it('should include the path in error message', () => {
      expect(() => validateCollectionPath('collectionPath', 'users/user123'))
        .toThrow('but was "users/user123"');
    });

    it('should include the argument name in error message', () => {
      expect(() => validateCollectionPath('myPath', 'users/user123'))
        .toThrow('Value for argument "myPath"');
    });

    it('should handle paths with dots in collection names', () => {
      expect(() => validateCollectionPath('collectionPath', 'agentbase.users')).not.toThrow();
      expect(() => validateCollectionPath('collectionPath', 'agentbase.users/user123'))
        .toThrow('must point to a collection');
    });
  });

  describe('validateDocumentPath', () => {
    it('should not throw for valid document paths', () => {
      expect(() => validateDocumentPath('collectionPath', 'users', 'user123')).not.toThrow();
      expect(() => validateDocumentPath('collectionPath', 'users/user123/messages', 'msg456')).not.toThrow();
      expect(() => validateDocumentPath('collectionPath', 'a/b/c', 'd')).not.toThrow();
    });

    it('should throw for paths with odd total segments', () => {
      expect(() => validateDocumentPath('collectionPath', 'users/user123', 'messages'))
        .toThrow('must point to a document');
      
      expect(() => validateDocumentPath('collectionPath', 'users/user123', 'messages'))
        .toThrow('does not contain an even number of components');
    });

    it('should include the full path in error message', () => {
      expect(() => validateDocumentPath('collectionPath', 'users/user123', 'messages'))
        .toThrow('but was "users/user123/messages"');
    });

    it('should include the argument name in error message', () => {
      expect(() => validateDocumentPath('myPath', 'users/user123', 'messages'))
        .toThrow('Value for argument "myPath"');
    });

    it('should handle deeply nested paths', () => {
      // 4 segments + 1 doc ID = 5 total (odd) - should throw
      expect(() => validateDocumentPath(
        'collectionPath',
        'agentbase.users/user123/credentials/instagram',
        'current'
      )).toThrow('must point to a document');
    });

    it('should allow 3-segment collection + doc ID (4 total - even)', () => {
      expect(() => validateDocumentPath(
        'collectionPath',
        'users/user123/messages',
        'msg456'
      )).not.toThrow();
    });
  });

  describe('Real-world scenarios', () => {
    it('should validate Instagram credentials path correctly', () => {
      // Your original error case
      const collectionPath = 'agentbase.users/userId/credentials/instagram';
      const documentId = 'current';
      
      // This should throw because it's 5 segments total (odd)
      expect(() => validateDocumentPath('collectionPath', collectionPath, documentId))
        .toThrow('does not contain an even number of components');
    });

    it('should validate corrected Instagram credentials path', () => {
      // Corrected version - remove one level
      const collectionPath = 'agentbase.users/userId/credentials';
      const documentId = 'instagram';
      
      // This should work (4 segments total - even)
      expect(() => validateDocumentPath('collectionPath', collectionPath, documentId))
        .not.toThrow();
    });

    it('should validate subcollection queries', () => {
      // Querying a subcollection
      const collectionPath = 'users/user123/messages';
      
      // This should work (3 segments - odd)
      expect(() => validateCollectionPath('collectionPath', collectionPath))
        .not.toThrow();
    });

    it('should reject document path used as collection', () => {
      // Trying to query a document path as a collection
      const collectionPath = 'users/user123';
      
      // This should throw (2 segments - even)
      expect(() => validateCollectionPath('collectionPath', collectionPath))
        .toThrow('must point to a collection');
    });
  });
});
