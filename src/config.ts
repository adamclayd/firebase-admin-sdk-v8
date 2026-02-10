/**
 * Firebase Admin SDK v8 - Configuration
 * Manages SDK configuration and credentials
 */

import type { ServiceAccount } from './types';

/**
 * SDK Configuration
 */
interface SDKConfig {
  serviceAccount?: ServiceAccount | string;
  projectId?: string;
}

/**
 * Global SDK configuration
 */
let globalConfig: SDKConfig = {};

/**
 * Initialize the Firebase Admin SDK with configuration
 * This is optional - the SDK will fall back to environment variables if not called
 * 
 * @param config - SDK configuration
 * 
 * @example
 * ```typescript
 * // Cloudflare Workers
 * export default {
 *   async fetch(request, env) {
 *     initializeApp({
 *       serviceAccount: env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY,
 *       projectId: env.FIREBASE_PROJECT_ID
 *     });
 *     // ... use SDK
 *   }
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Node.js (optional - will use process.env by default)
 * initializeApp({
 *   serviceAccount: JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY),
 *   projectId: process.env.FIREBASE_PROJECT_ID
 * });
 * ```
 */
export function initializeApp(config: SDKConfig): void {
  globalConfig = { ...config };
}

/**
 * Get the current SDK configuration
 */
export function getConfig(): SDKConfig {
  return globalConfig;
}

/**
 * Clear the SDK configuration (useful for testing)
 */
export function clearConfig(): void {
  globalConfig = {};
}

/**
 * Get service account from config or environment
 * Priority: 1) globalConfig, 2) process.env
 */
export function getServiceAccount(): ServiceAccount {
  // Try config first
  if (globalConfig.serviceAccount) {
    if (typeof globalConfig.serviceAccount === 'string') {
      return JSON.parse(globalConfig.serviceAccount);
    }
    return globalConfig.serviceAccount;
  }

  // Fall back to process.env
  const key = typeof process !== 'undefined' && process.env?.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY;
  
  if (!key) {
    throw new Error(
      'Firebase service account not configured. ' +
      'Either call initializeApp({ serviceAccount: ... }) or set FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY environment variable.'
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
 * Get Firebase project ID from config or environment
 * Priority: 1) globalConfig, 2) process.env
 */
export function getProjectId(): string {
  // Try config first
  if (globalConfig.projectId) {
    return globalConfig.projectId;
  }

  // Fall back to process.env
  if (typeof process !== 'undefined' && process.env) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.PUBLIC_FIREBASE_PROJECT_ID;
    if (projectId) {
      return projectId;
    }
  }
  
  throw new Error(
    'Firebase project ID not configured. ' +
    'Either call initializeApp({ projectId: ... }) or set FIREBASE_PROJECT_ID environment variable.'
  );
}
