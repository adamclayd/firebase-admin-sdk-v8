# Task: Debug Production Signed URL Failure

**Status**: 🔴 In Progress  
**Priority**: CRITICAL  
**Severity**: BLOCKING PRODUCTION  
**Created**: 2026-02-14  
**Estimated Time**: 2-4 hours

---

## Problem

User reports `SignatureDoesNotMatch` error when using signed URLs in production.

### Error Message
```xml
<Error>
  <Code>SignatureDoesNotMatch</Code>
  <Message>Access denied.</Message>
  <Details>The request signature we calculated does not match the signature you provided. Check your Google secret key and signing method.</Details>
  <StringToSign>GOOG4-RSA-SHA256 20260214T175515Z 20260214/auto/storage/goog4_request fef6239c7f3ab748b633fbc9ea8bdafc2ea2ea2a8d1b333af6b81cad1cbf1792</StringToSign>
  <CanonicalRequest>GET /com-f5-parm.appspot.com/e0_agentbase/users/MnOyIarhz5b8n06TsTovM582NSG2/chat/96cc2737-64aa-47c3-9f5e-4f95c889849a X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=firebase-adminsdk-s1kin%40com-f5-parm.iam.gserviceaccount.com%2F20260214%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260214T175515Z&X-Goog-Expires=3600&X-Goog-SignedHeaders=host host:storage.googleapis.com host UNSIGNED-PAYLOAD</CanonicalRequest>
</Error>
```

### Production Details
- **Bucket**: `com-f5-parm.appspot.com`
- **Path**: `e0_agentbase/users/MnOyIarhz5b8n06TsTovM582NSG2/chat/96cc2737-64aa-47c3-9f5e-4f95c889849a`
- **Service Account**: `firebase-adminsdk-s1kin@com-f5-parm.iam.gserviceaccount.com`
- **Timestamp**: `20260214T175515Z`
- **Expires**: 3600 seconds

### Key Observations
1. E2E tests pass with simple paths
2. Production uses complex nested paths with UUIDs
3. Canonical request structure looks correct
4. Hash mismatch indicates canonical request difference

---

## Analysis

### Canonical Request Structure (from error)
Breaking down the space-separated components (spaces = newlines in actual request):

1. **Method**: `GET` ✓
2. **URI**: `/com-f5-parm.appspot.com/e0_agentbase/users/MnOyIarhz5b8n06TsTovM582NSG2/chat/96cc2737-64aa-47c3-9f5e-4f95c889849a` ✓
3. **Query String**: `X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=firebase-adminsdk-s1kin%40com-f5-parm.iam.gserviceaccount.com%2F20260214%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260214T175515Z&X-Goog-Expires=3600&X-Goog-SignedHeaders=host` ✓
4. **Headers**: `host:storage.googleapis.com` ✓
5. **Signed Headers**: `host` ✓
6. **Payload**: `UNSIGNED-PAYLOAD` ✓

### Current Code (src/storage/signed-urls.ts:214)
```typescript
const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`;
```

Where:
- `canonicalHeaders = "host:storage.googleapis.com\n"`
- This creates the required empty line between headers and signed headers

### Potential Issues

#### 1. Path Encoding
**Current**: `path.split('/').map(segment => encodeURIComponent(segment)).join('/')`

**Question**: Are underscores, hyphens, and UUIDs being encoded correctly?
- Underscores `_` - NOT encoded (unreserved)
- Hyphens `-` - NOT encoded (unreserved)  
- Slashes `/` - Used as separators, NOT encoded
- This appears correct per RFC 3986

#### 2. Query Parameter Encoding
**Current**: `encodeURIComponent(key)` and `encodeURIComponent(value)`

**Question**: Is the credential being double-encoded?
- Email `@` should become `%40` ✓ (seen in error)
- Slashes `/` should become `%2F` ✓ (seen in error)
- This appears correct

#### 3. Canonical Request Hash
**Expected**: `fef6239c7f3ab748b633fbc9ea8bdafc2ea2ea2a8d1b333af6b81cad1cbf1792`

**Question**: Is our SHA-256 hash calculation correct?
- Using `crypto.subtle.digest('SHA-256', data)` ✓
- Converting to hex correctly ✓
- Tests pass ✓

#### 4. Signature Calculation
**Question**: Is the private key being used correctly?
- Using `crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data)` ✓
- Converting to hex ✓
- Tests pass ✓

---

## Investigation Steps

### ✅ Completed
1. Reviewed code structure - looks correct
2. Analyzed error message - structure is correct
3. Verified encoding logic - appears correct
4. Fixed TypeScript lint error in tests

### 🔄 In Progress
1. Need to test with actual production-like paths
2. Need to verify hash calculation with exact production data
3. Need to compare our canonical request with Google's

### 📋 TODO
1. Create test case with exact production path
2. Log canonical request before hashing
3. Calculate hash manually and compare
4. Test with production service account (if possible)
5. Check if there's a difference in how Node.js vs edge runtimes handle encoding

---

## Hypothesis

The code structure appears correct. The issue might be:

1. **Runtime Environment Difference**: The user might be running in a different environment (browser, Deno, Bun) where `encodeURIComponent` or `crypto.subtle` behaves differently
2. **Library Version**: User might be using an older version of the library
3. **Service Account Issue**: The private key might not match the service account
4. **Timestamp Sync**: Clock skew between user's system and Google's servers
5. **Hidden Characters**: The path might contain hidden characters or different Unicode representations

---

## Next Steps

1. Ask user for:
   - Library version they're using
   - Runtime environment (Node.js version, browser, Deno, etc.)
   - How they're calling `generateSignedUrl()`
   - Full code snippet if possible

2. Create reproduction test:
   - Use exact production path
   - Use exact timestamp from error
   - Calculate canonical request
   - Calculate hash
   - Compare with error message

3. Add debug logging:
   - Log canonical request before hashing
   - Log hash result
   - Log string to sign
   - Log signature

---

## Workaround

Until fixed, user can:
1. Use Firebase Admin SDK in Node.js environment (not edge)
2. Use Google Cloud Storage client libraries
3. Generate signed URLs server-side with official SDK

---

## References

- [Google Cloud Storage V4 Signing](https://cloud.google.com/storage/docs/access-control/signing-urls-manually)
- [RFC 3986 - URI Generic Syntax](https://tools.ietf.org/html/rfc3986)
- [src/storage/signed-urls.ts](../../src/storage/signed-urls.ts)
- [src/storage/signed-urls.spec.ts](../../src/storage/signed-urls.spec.ts)

---

**Last Updated**: 2026-02-14  
**Status**: Investigating - need more information from user
