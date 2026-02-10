# E2E Testing Best Practices

## Overview
End-to-end (e2e) tests verify the SDK works correctly with real Firebase services. These tests are critical for catching integration issues that unit tests miss.

## Test Structure Pattern

Every e2e test suite MUST follow this three-phase pattern:

### 1. Setup Phase
**Purpose:** Prepare test data and environment before tests run

**Implementation:**
- Use `beforeAll()` for suite-level setup
- Use `beforeEach()` for test-level setup
- Create test data with unique identifiers (timestamps, UUIDs)
- Tag test data with `_test: true` flag for easy identification

**Examples:**
```typescript
beforeAll(async () => {
  // Create test users
  testUserId = `test-user-${Date.now()}`;
  await createTestUser(testUserId);
  
  // Create test documents
  for (let i = 0; i < 5; i++) {
    const docId = `test-doc-${timestamp}-${i}`;
    testDocIds.push(docId);
    await setDocument('test-collection', docId, {
      name: `Test ${i}`,
      _test: true,
      _timestamp: timestamp,
    });
  }
});
```

### 2. Test Phase
**Purpose:** Execute actual test scenarios

**Best Practices:**
- Tests should be independent and idempotent
- Use descriptive test names that explain what is being verified
- Test both success and error cases
- Verify critical bug fixes (e.g., subcollection queries)
- Include assertions for data integrity

**Examples:**
```typescript
it('should query subcollection documents', async () => {
  const results = await queryDocuments(subCollectionPath, {
    where: [{ field: '_test', op: '==', value: true }],
  });
  
  expect(results.length).toBe(3);
  results.forEach(doc => {
    expect(doc.data.text).toMatch(/^Message \d$/);
  });
});
```

### 3. Cleanup Phase
**Purpose:** Remove all test data and restore environment to clean state

**Implementation:**
- Use `afterEach()` for test-level cleanup
- Use `afterAll()` for suite-level cleanup
- Delete in reverse order of creation (children before parents)
- Use try-catch to handle cleanup errors gracefully
- Never leave orphaned test data

**Examples:**
```typescript
afterEach(async () => {
  // Clean up test document if it exists
  if (testDocId) {
    try {
      await deleteDocument(TEST_COLLECTION, testDocId);
    } catch (error) {
      // Ignore errors if document doesn't exist
    }
  }
});

afterAll(async () => {
  // Clean up subcollection documents first
  for (const docId of subDocIds) {
    try {
      await deleteDocument(subCollectionPath, docId);
    } catch (error) {
      // Ignore errors
    }
  }
  
  // Then clean up parent document
  try {
    await deleteDocument(TEST_COLLECTION, parentDocId);
  } catch (error) {
    // Ignore errors
  }
  
  // Clean up test users
  try {
    await deleteTestUser(testUserId);
  } catch (error) {
    // Ignore errors
  }
});
```

## Test Data Guidelines

### Naming Convention
Use descriptive, timestamped identifiers:
```typescript
const timestamp = Date.now();
const testDocId = `test-${timestamp}-create`;
const testUserId = `test-user-${timestamp}`;
const testCollectionPath = `e2e-tests-${timestamp}`;
```

### Test Data Markers
Always include markers to identify test data:
```typescript
{
  _test: true,           // Marks this as test data
  _timestamp: Date.now(), // For debugging and cleanup
  _suite: 'firestore',    // Which test suite created this
  // ... actual test data
}
```

### Isolation
- Each test suite should use its own collection/path
- Use unique IDs to avoid conflicts between parallel test runs
- Never rely on data created by other tests

## Service-Specific Patterns

### Firestore
```typescript
describe('Firestore E2E', () => {
  const TEST_COLLECTION = 'e2e-tests';
  const timestamp = Date.now();
  let testDocId: string;

  beforeAll(() => {
    // Initialize SDK
    initializeApp({ serviceAccount: require('../../service-account.json') });
  });

  afterEach(async () => {
    // Clean up test document
    if (testDocId) {
      try {
        await deleteDocument(TEST_COLLECTION, testDocId);
      } catch (error) {
        // Ignore
      }
    }
  });

  it('should create document', async () => {
    testDocId = `test-${timestamp}-create`;
    await setDocument(TEST_COLLECTION, testDocId, {
      name: 'Test',
      _test: true,
    });
    // ... assertions
  });
});
```

### Authentication
```typescript
describe('Auth E2E', () => {
  const testUserIds: string[] = [];

  afterAll(async () => {
    // Clean up all test users
    for (const uid of testUserIds) {
      try {
        await deleteUser(uid);
      } catch (error) {
        // Ignore
      }
    }
  });

  it('should create user', async () => {
    const uid = `test-user-${Date.now()}`;
    testUserIds.push(uid);
    await createUser({ uid, email: 'test@example.com' });
    // ... assertions
  });
});
```

### Storage
```typescript
describe('Storage E2E', () => {
  const testFiles: string[] = [];

  afterAll(async () => {
    // Clean up all test files
    for (const path of testFiles) {
      try {
        await deleteFile(path);
      } catch (error) {
        // Ignore
      }
    }
  });

  it('should upload file', async () => {
    const path = `e2e-tests/${Date.now()}/test.txt`;
    testFiles.push(path);
    await uploadFile(path, 'test content');
    // ... assertions
  });
});
```

## Error Handling

### Cleanup Errors
Always wrap cleanup in try-catch:
```typescript
afterEach(async () => {
  try {
    await cleanupTestData();
  } catch (error) {
    // Log but don't fail the test
    console.warn('Cleanup failed:', error);
  }
});
```

### Test Failures
If a test fails, cleanup should still run:
```typescript
it('should handle errors gracefully', async () => {
  testDocId = `test-${Date.now()}-error`;
  
  try {
    await setDocument(TEST_COLLECTION, testDocId, { name: 'Test' });
    // ... test logic that might fail
  } finally {
    // Cleanup happens even if test fails
    // afterEach will handle this
  }
});
```

## Performance Considerations

### Minimize API Calls
- Batch operations when possible
- Reuse test data across multiple tests in same suite
- Use `beforeAll` for expensive setup operations

### Timeouts
- Set appropriate timeouts for real API calls (30 seconds)
- Consider network latency and Firebase quotas

### Parallel Execution
- Use unique identifiers to avoid conflicts
- Don't rely on execution order
- Each test should be independent

## CI/CD Integration

### Running E2E Tests
```bash
# Local development (requires service-account.json)
npm run test:e2e

# CI/CD (requires GOOGLE_APPLICATION_CREDENTIALS)
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
npm run test:e2e
```

### Conditional Execution
```typescript
const hasCredentials = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

(hasCredentials ? describe : describe.skip)('E2E Tests', () => {
  // Tests only run if credentials are available
});
```

## Debugging

### Verbose Logging
```bash
npm run test:e2e -- --verbose
```

### Inspect Test Data
Leave `_test: true` and `_timestamp` fields for manual inspection:
```typescript
// Query all test data
const testDocs = await queryDocuments('e2e-tests', {
  where: [{ field: '_test', op: '==', value: true }],
});
console.log('Orphaned test data:', testDocs);
```

### Manual Cleanup
If tests fail and leave orphaned data:
```typescript
// Create a cleanup script
async function cleanupOrphanedTestData() {
  const collections = ['e2e-tests', 'test-users', 'test-storage'];
  
  for (const collection of collections) {
    const docs = await queryDocuments(collection, {
      where: [{ field: '_test', op: '==', value: true }],
    });
    
    for (const doc of docs) {
      await deleteDocument(collection, doc.id);
    }
  }
}
```

## Checklist

Before committing e2e tests, verify:

- [ ] Setup phase creates all necessary test data
- [ ] Test data uses unique identifiers (timestamps/UUIDs)
- [ ] Test data is tagged with `_test: true`
- [ ] Tests are independent and idempotent
- [ ] Cleanup phase removes ALL test data
- [ ] Cleanup handles errors gracefully (try-catch)
- [ ] Tests work with real Firebase project
- [ ] Tests don't leave orphaned data on failure
- [ ] Timeouts are appropriate (30s for e2e)
- [ ] Tests verify critical bug fixes

## Example: Complete E2E Test Suite

See [`src/firestore-rest.e2e.ts`](../src/firestore-rest.e2e.ts) for a complete example following all these patterns.
