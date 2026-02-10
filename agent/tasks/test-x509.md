# Task: Add Unit Tests for x509.ts

## File
`src/x509.ts`

## Current Status
- ❌ No test file exists
- File contains X.509 certificate parsing and validation

## Objective
Create comprehensive unit tests for X.509 certificate handling.

## Test File
Create: `src/x509.spec.ts`

## Functions to Test

### 1. Certificate Parsing
**Test Cases:**
- ✅ Should parse valid X.509 certificate
- ✅ Should extract public key from certificate
- ✅ Should extract subject information
- ✅ Should extract issuer information
- ✅ Should parse certificate validity dates
- ✅ Should handle PEM format certificates
- ✅ Should handle DER format certificates
- ✅ Should reject malformed certificates

### 2. Certificate Validation
**Test Cases:**
- ✅ Should validate certificate is not expired
- ✅ Should validate certificate is not used before valid date
- ✅ Should validate certificate signature
- ✅ Should validate certificate chain
- ✅ Should check certificate revocation status
- ✅ Should validate certificate purpose/usage

### 3. Public Key Extraction
**Test Cases:**
- ✅ Should extract RSA public key
- ✅ Should extract EC public key
- ✅ Should convert key to correct format
- ✅ Should handle different key sizes
- ✅ Should reject invalid keys

## Testing Strategy

### Mocking
- Use test X.509 certificates
- Mock certificate validation APIs
- Mock crypto operations

### Test Data
- Create valid test certificates
- Create expired certificates
- Create self-signed certificates
- Create certificates with different key types

### Edge Cases
- Certificate exactly at expiry time
- Certificate with missing fields
- Certificate with invalid signature
- Certificate chain validation failures

## Dependencies
- Jest for testing framework
- Test X.509 certificates
- Mock crypto operations

## Success Criteria
- ✅ All public functions have tests
- ✅ Code coverage >80% for x509.ts
- ✅ All edge cases covered
- ✅ Tests run in <1 second
- ✅ No external API calls in tests (all mocked)

## Priority
**Medium** - Important for JWT verification but less frequently used

## Estimated Time
2-3 hours
