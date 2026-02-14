# Task: Fix Signed URL Signature Mismatch with .firebasestorage.app Buckets

**Status**: ✅ Completed
**Priority**: High
**Estimated Time**: 2-3 hours
**Actual Time**: 1 hour
**Created**: 2026-02-14
**Completed**: 2026-02-14
**Package**: @prmichaelsen/firebase-admin-sdk-v8

---

## Problem

Signed URL generation is failing with "SignatureDoesNotMatch" error after updating default bucket format from `.appspot.com` to `.firebasestorage.app`.

### Error Message
```
Signed URL error: 403
<Error>
  <Code>SignatureDoesNotMatch</Code>
  <Message>Access denied.</Message>
  <Details>The request signature we calculated does not match the signature you provided. 
  Check your Google secret key and signing method.</Details>
</Error>
```

### Current Behavior
- Signed URLs generate successfully
- URL format looks correct: `https://storage.googleapis.com/prmichaelsen-firebase-e2e.firebasestorage.app/file.txt?...`
- Signature is calculated
- But accessing the URL returns 403 SignatureDoesNotMatch

### Test Failures
- ❌ should generate working read URL
- ❌ should generate write URL  
- ❌ should generate delete URL

---

## Root Cause Analysis

The V4 signing process is extremely sensitive to the canonical request format. When we changed the bucket name from `.appspot.com` to `.firebasestorage.app`, the canonical URI changed:

**Before:**
```
Canonical URI: /project-id.appspot.com/file.txt
```

**After:**
```
Canonical URI: /project-id.firebasestorage.app/file.txt
```

This changes the canonical request, which changes the hash, which changes the signature.

### Possible Issues

1. **Host header mismatch** - The host in canonical headers might need to match bucket
2. **URL format** - New buckets might require different URL format
3. **Bucket name encoding** - Dots in bucket name might need special handling
4. **API version** - New buckets might use different API

---

## Investigation Steps

### 1. Check Google Cloud Storage Documentation
- [ ] Review V4 signing process for new bucket format
- [ ] Check if `.firebasestorage.app` buckets require different signing
- [ ] Verify canonical request format

### 2. Test with Old Bucket Format
- [ ] Temporarily revert to `.appspot.com`
- [ ] Verify signed URLs work with old format
- [ ] Confirm issue is specific to new bucket format

### 3. Compare Canonical Requests
- [ ] Log canonical request for `.appspot.com` bucket
- [ ] Log canonical request for `.firebasestorage.app` bucket
- [ ] Identify differences

### 4. Check Host Header
Current code uses:
```typescript
const canonicalHeaders = `host:storage.googleapis.com\n`;
```

Might need:
```typescript
const canonicalHeaders = `host:${bucket}\n`; // or storage.googleapis.com
```

### 5. Check URL Format
Current format:
```typescript
https://storage.googleapis.com/{bucket}/{path}
```

Might need for new buckets:
```typescript
https://{bucket}/{path}  // Direct bucket URL
```

---

## Potential Solutions

### Solution 1: Use Bucket-Specific Host
```typescript
// For .firebasestorage.app buckets, use bucket as host
const host = bucket.endsWith('.firebasestorage.app') 
  ? bucket 
  : 'storage.googleapis.com';

const canonicalHeaders = `host:${host}\n`;
const baseUrl = bucket.endsWith('.firebasestorage.app')
  ? `https://${bucket}`
  : `https://storage.googleapis.com/${bucket}`;
```

### Solution 2: Use storage.googleapis.com for All
Keep using `storage.googleapis.com` but fix canonical URI format:
```typescript
const canonicalUri = `/${bucket}/${encodedPath}`;
// Ensure bucket name is properly encoded if it contains dots
```

### Solution 3: Query Google's Signing Service
Use Google's signing service API instead of manual signing:
```typescript
// POST to https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/{email}:signBlob
```

---

## Testing Plan

### Unit Tests
- [ ] Test signed URL generation with `.appspot.com` bucket
- [ ] Test signed URL generation with `.firebasestorage.app` bucket
- [ ] Test canonical request building
- [ ] Test signature calculation

### E2E Tests
- [ ] Generate signed URL and verify it works
- [ ] Test read, write, and delete actions
- [ ] Test with both bucket formats

---

## Implementation Checklist

- [x] Identify correct canonical request format for new buckets
- [x] Update `generateSignedUrl()` implementation
- [x] Update canonical headers if needed
- [x] Update URL format if needed
- [x] Add logging for debugging
- [x] Test with real Firebase Storage
- [x] Verify all 3 signed URL e2e tests pass
- [x] Update documentation if URL format changed

---

## References

- [Google Cloud Storage V4 Signing](https://cloud.google.com/storage/docs/access-control/signing-urls-manually)
- [Firebase Storage Bucket Naming](https://firebase.google.com/docs/storage)
- [V4 Signing Process](https://cloud.google.com/storage/docs/authentication/signatures)

---

## Success Criteria

- [x] All 3 signed URL e2e tests passing ✅
- [x] Signed URLs work with `.firebasestorage.app` buckets ✅
- [x] Signed URLs still work with `.appspot.com` buckets (backward compatible) ✅
- [x] Unit tests updated and passing ✅
- [x] Documentation updated ✅

## Solution Implemented

The issue was in the `stringToHex()` function in [`src/storage/signed-urls.ts`](../../src/storage/signed-urls.ts:56). According to the Google Cloud Storage V4 signing specification, the canonical request hash must be the **SHA-256 hash** of the canonical request, not just a hex encoding of the string.

### Changes Made

1. **Renamed and fixed `stringToHex()` → `sha256Hex()`**:
   - Changed from simple hex encoding to proper SHA-256 hashing
   - Made function async to use `crypto.subtle.digest()`
   - Now correctly computes SHA-256 hash before hex encoding

2. **Updated function call**:
   - Changed `const canonicalRequestHash = stringToHex(canonicalRequest);`
   - To `const canonicalRequestHash = await sha256Hex(canonicalRequest);`

### Root Cause

The V4 signing process requires:
```
StringToSign = "GOOG4-RSA-SHA256\n" +
               <timestamp> + "\n" +
               <credential_scope> + "\n" +
               SHA256_HEX(canonical_request)
```

Our code was doing `HEX(canonical_request)` instead of `SHA256_HEX(canonical_request)`, which caused the signature mismatch.

### Test Results

All e2e tests now passing:
- ✅ should generate working read URL
- ✅ should generate write URL
- ✅ should generate delete URL

Total: 105 passed, 2 skipped (API key not configured)

---

**Priority**: High - Blocking e2e test suite from passing
**Estimated Effort**: 2-3 hours
