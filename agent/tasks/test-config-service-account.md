# Task: Add Unit Tests for config.ts and service-account.ts

## Files
- `src/config.ts`
- `src/service-account.ts`

## Current Status
- ❌ No test files exist
- Files contain configuration and service account management

## Objective
Create unit tests for configuration and service account handling.

## Test Files
Create:
- `src/config.spec.ts`
- `src/service-account.spec.ts`

## Functions to Test

### config.ts

#### `initializeApp(config: AppConfig)`
**Test Cases:**
- ✅ Should initialize with service account
- ✅ Should initialize with credentials object
- ✅ Should store configuration globally
- ✅ Should throw error if already initialized
- ✅ Should validate required fields
- ✅ Should handle missing configuration

#### `getApp()`
**Test Cases:**
- ✅ Should return initialized app
- ✅ Should throw error if not initialized
- ✅ Should return same instance on multiple calls

### service-account.ts

#### `setServiceAccount(serviceAccount: ServiceAccount)`
**Test Cases:**
- ✅ Should store service account credentials
- ✅ Should validate service account format
- ✅ Should handle JSON string input
- ✅ Should handle object input
- ✅ Should validate required fields (project_id, private_key, client_email)
- ✅ Should reject invalid service account

#### `getServiceAccount()`
**Test Cases:**
- ✅ Should return stored service account
- ✅ Should throw error if not set
- ✅ Should return same instance on multiple calls

#### `getProjectId()`
**Test Cases:**
- ✅ Should extract project ID from service account
- ✅ Should throw error if service account not set
- ✅ Should return correct project ID

#### `getClientEmail()`
**Test Cases:**
- ✅ Should extract client email from service account
- ✅ Should throw error if service account not set
- ✅ Should return correct client email

#### `getPrivateKey()`
**Test Cases:**
- ✅ Should extract private key from service account
- ✅ Should throw error if service account not set
- ✅ Should return correct private key
- ✅ Should handle different key formats

## Testing Strategy

### Mocking
- Mock environment variables
- Mock file system for service account loading
- Reset global state between tests

### Test Data
- Create valid test service account JSON
- Create invalid service account formats
- Create partial service accounts (missing fields)

### Edge Cases
- Multiple initialization attempts
- Accessing before initialization
- Invalid JSON format
- Missing required fields
- Empty strings in required fields

## Dependencies
- Jest for testing framework
- Test service account fixtures

## Success Criteria
- ✅ All public functions have tests
- ✅ Code coverage >90% for both files (small files)
- ✅ All edge cases covered
- ✅ Tests run in <1 second
- ✅ No external dependencies
- ✅ Proper cleanup between tests

## Priority
**High** - Core initialization functionality

## Estimated Time
2-3 hours
