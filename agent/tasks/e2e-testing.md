# E2E Testing Task

## Objective
Create end-to-end tests that run against a real Firebase project to verify the SDK works correctly with actual Firebase services.

## Prerequisites
- ✅ Firebase project created: `prmichaelsen-firebase-e2e`
- ✅ firebase.json configured with project ID
- ✅ service-account.json in .gitignore
- ⏳ Service account credentials downloaded to service-account.json

## Test Structure

### Directory Layout
```
e2e/
├── setup.ts           # Test setup and teardown
├── firestore.e2e.ts   # Firestore CRUD operations
├── auth.e2e.ts        # Authentication operations
└── README.md          # E2E test documentation
```

## Test Scenarios

### Firestore E2E Tests
1. **Document Operations**
   - Create document with setDocument
   - Read document with getDocument
   - Update document with updateDocument
   - Delete document with deleteDocument

2. **Collection Queries**
   - Query top-level collection
   - Query subcollection (critical - this was the bug we fixed)
   - Query with where clauses
   - Query with orderBy, limit, offset

3. **Batch Operations**
   - Batch write multiple documents
   - Verify all operations succeed

4. **Field Transforms**
   - serverTimestamp()
   - increment()
   - arrayUnion()
   - arrayRemove()
   - deleteField()

### Auth E2E Tests
1. **Token Generation**
   - Generate admin access token
   - Verify token is valid
   - Test token caching

2. **Custom Claims** (if we implement this)
   - Set custom claims on user
   - Verify claims in token

## Test Configuration

### Environment Variables
```typescript
// e2e/setup.ts
process.env.GOOGLE_APPLICATION_CREDENTIALS = './service-account.json';
```

### Jest Configuration
```javascript
// jest.e2e.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/e2e/**/*.e2e.ts'],
  testTimeout: 30000, // 30 seconds for real API calls
  setupFilesAfterEnv: ['<rootDir>/e2e/setup.ts'],
};
```

## Test Data Strategy

### Cleanup Strategy
- Use unique IDs with timestamp prefix for test documents
- Clean up test data in afterEach/afterAll hooks
- Use a dedicated test collection: `e2e-tests-{timestamp}`

### Example Test Document
```typescript
const testDoc = {
  _test: true,
  _timestamp: Date.now(),
  name: 'Test User',
  email: 'test@example.com',
};
```

## Running E2E Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run specific e2e test file
npm run test:e2e -- firestore.e2e.ts

# Run with verbose output
npm run test:e2e -- --verbose
```

## Success Criteria
- ✅ All CRUD operations work against real Firestore
- ✅ Subcollection queries return correct results
- ✅ Field transforms work correctly
- ✅ Batch operations succeed
- ✅ Token generation works
- ✅ Tests clean up after themselves
- ✅ Tests are idempotent (can run multiple times)

## Notes
- E2E tests should be separate from unit tests
- E2E tests will be slower (real API calls)
- E2E tests require valid service account credentials
- E2E tests should not run in CI without proper setup
- Consider rate limiting and quota usage

## Priority
High - E2E tests will verify the SDK works correctly with real Firebase services and catch integration issues that unit tests miss.

## Estimated Time
4-6 hours
- Setup: 1 hour
- Firestore tests: 2-3 hours
- Auth tests: 1-2 hours
- Documentation: 1 hour
