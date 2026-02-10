# Task: Add Unit Tests for auth.ts

## File
`src/auth.ts`

## Current Status
- ❌ No test file exists
- File contains JWT verification and custom claims logic

## Objective
Create comprehensive unit tests for all authentication-related functions in `auth.ts`.

## Test File
Create: `src/auth.spec.ts`

## Functions to Test

### 1. `verifyIdToken(idToken: string)`
**Test Cases:**
- ✅ Should verify a valid Firebase ID token
- ✅ Should reject an expired token
- ✅ Should reject a token with invalid signature
- ✅ Should reject a malformed token
- ✅ Should extract correct user claims (uid, email, etc.)
- ✅ Should handle tokens with custom claims
- ✅ Should reject tokens from wrong project
- ✅ Should validate token audience matches project ID

### 2. `setCustomUserClaims(uid: string, claims: object)`
**Test Cases:**
- ✅ Should set custom claims for a valid user
- ✅ Should handle empty claims object
- ✅ Should overwrite existing custom claims
- ✅ Should reject invalid UID format
- ✅ Should handle API errors gracefully
- ✅ Should validate claims size limits

### 3. JWT Verification Helpers
**Test Cases:**
- ✅ Should fetch and cache public keys
- ✅ Should refresh keys when expired
- ✅ Should validate token header format
- ✅ Should verify token signature with correct key

## Testing Strategy

### Mocking
- Mock `fetch` for API calls
- Mock public key retrieval
- Use test JWT tokens with known signatures
- Mock Firebase project configuration

### Test Data
- Create valid test tokens with different claims
- Create expired tokens
- Create tokens with invalid signatures
- Create malformed tokens

### Edge Cases
- Network failures during key fetch
- Concurrent token verifications
- Token issued in the future
- Token with missing required claims

## Dependencies
- Jest for testing framework
- Mock JWT library or create test tokens
- Mock fetch responses

## Success Criteria
- ✅ All public functions have tests
- ✅ Code coverage >80% for auth.ts
- ✅ All edge cases covered
- ✅ Tests run in <1 second
- ✅ No external API calls in tests (all mocked)

## Priority
**High** - Authentication is critical security functionality

## Estimated Time
2-3 hours
