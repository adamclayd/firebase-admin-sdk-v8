# Task: Add Unit Tests for token-generation.ts

## File
`src/token-generation.ts`

## Current Status
- ❌ No test file exists
- File contains JWT generation and access token management

## Objective
Create comprehensive unit tests for token generation and caching logic.

## Test File
Create: `src/token-generation.spec.ts`

## Functions to Test

### 1. `getAdminAccessToken()`
**Test Cases:**
- ✅ Should generate a valid JWT for service account
- ✅ Should cache token and reuse until expiry
- ✅ Should refresh token when expired
- ✅ Should handle concurrent requests (return same token)
- ✅ Should include correct claims (iss, sub, aud, iat, exp)
- ✅ Should use correct scopes for Firebase Admin
- ✅ Should handle service account errors
- ✅ Should validate token format

### 2. JWT Generation Helpers
**Test Cases:**
- ✅ Should create JWT header correctly
- ✅ Should create JWT payload with correct expiry (1 hour)
- ✅ Should sign JWT with service account private key
- ✅ Should encode JWT in correct format (header.payload.signature)
- ✅ Should handle RSA signing errors

### 3. Token Caching
**Test Cases:**
- ✅ Should cache token in memory
- ✅ Should return cached token if not expired
- ✅ Should generate new token if cache is empty
- ✅ Should generate new token if cached token expired
- ✅ Should handle cache invalidation

## Testing Strategy

### Mocking
- Mock service account credentials
- Mock crypto signing operations
- Mock Date.now() for time-based tests
- Mock fetch for token exchange

### Test Data
- Create test service account JSON
- Create test private keys
- Create expected JWT structures

### Edge Cases
- Token expiry edge cases (exactly at expiry time)
- Invalid service account format
- Missing private key
- Signing failures
- Clock skew scenarios

## Dependencies
- Jest for testing framework
- Mock crypto operations
- Test service account credentials

## Success Criteria
- ✅ All public functions have tests
- ✅ Code coverage >80% for token-generation.ts
- ✅ All edge cases covered
- ✅ Tests run in <1 second
- ✅ No external API calls in tests (all mocked)
- ✅ Token caching logic verified

## Priority
**High** - Token generation is critical for all API operations

## Estimated Time
2-3 hours
