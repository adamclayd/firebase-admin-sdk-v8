/**
 * Path validation utilities for Firestore operations
 */

/**
 * Validates that a collection path has an odd number of segments
 * 
 * @param argumentName - Name of the argument for error messages
 * @param collectionPath - The collection path to validate
 * @throws Error if path has even number of segments
 */
export function validateCollectionPath(argumentName: string, collectionPath: string): void {
  const segments = collectionPath.split('/').filter(s => s.length > 0);
  
  if (segments.length % 2 === 0) {
    throw new Error(
      `Value for argument "${argumentName}" must point to a collection, but was "${collectionPath}". ` +
      `Your path does not contain an odd number of components.`
    );
  }
}

/**
 * Validates that a document path (collection + document ID) has an even number of segments
 * 
 * @param argumentName - Name of the argument for error messages
 * @param collectionPath - The collection path
 * @param documentId - The document ID
 * @throws Error if combined path has odd number of segments
 */
export function validateDocumentPath(
  argumentName: string,
  collectionPath: string,
  documentId: string
): void {
  const collectionSegments = collectionPath.split('/').filter(s => s.length > 0);
  const totalSegments = collectionSegments.length + 1; // +1 for document ID
  
  if (totalSegments % 2 !== 0) {
    const fullPath = `${collectionPath}/${documentId}`;
    throw new Error(
      `Value for argument "${argumentName}" must point to a document, but was "${fullPath}". ` +
      `Your path does not contain an even number of components.`
    );
  }
}

/**
 * Check if a path points to a collection (odd number of segments)
 */
export function isCollectionPath(path: string): boolean {
  const segments = path.split('/').filter(s => s.length > 0);
  return segments.length % 2 === 1;
}

/**
 * Check if a path points to a document (even number of segments)
 */
export function isDocumentPath(path: string): boolean {
  const segments = path.split('/').filter(s => s.length > 0);
  return segments.length > 0 && segments.length % 2 === 0;
}
