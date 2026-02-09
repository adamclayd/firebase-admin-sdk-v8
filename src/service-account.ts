/**
 * Firebase Admin SDK v8 - Service Account Management
 */

import type { ServiceAccount } from './types';

/**
 * Get Firebase service account from environment variable
 * @throws {Error} If FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY is not set
 * @returns {ServiceAccount} Parsed service account credentials
 */
export function getServiceAccount(): ServiceAccount {
  const key = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY;
  
  if (!key) {
    throw new Error(
      'FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY environment variable is not set. ' +
      'Please provide your Firebase service account JSON as a string.'
    );
  }

  try {
    const serviceAccount = JSON.parse(key) as ServiceAccount;
    
    // Validate required fields
    const requiredFields = [
      'type',
      'project_id',
      'private_key_id',
      'private_key',
      'client_email',
      'client_id',
      'token_uri',
    ];
    
    for (const field of requiredFields) {
      if (!(field in serviceAccount)) {
        throw new Error(`Service account is missing required field: ${field}`);
      }
    }
    
    return serviceAccount;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        'Failed to parse FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY. ' +
        'Ensure it contains valid JSON.'
      );
    }
    throw error;
  }
}

/**
 * Get Firebase project ID from environment
 * @throws {Error} If PUBLIC_FIREBASE_PROJECT_ID is not set
 * @returns {string} Firebase project ID
 */
export function getProjectId(): string {
  const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;
  
  if (!projectId) {
    throw new Error(
      'PUBLIC_FIREBASE_PROJECT_ID environment variable is not set. ' +
      'Please provide your Firebase project ID.'
    );
  }
  
  return projectId;
}
