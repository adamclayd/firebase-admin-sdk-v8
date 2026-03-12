# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.8.0] - 2026-03-12

### Added
- **Firestore Batch Get by Paths (`getAllByPaths`)**: Fetch multiple documents from different collections in a single REST API call
  - `getAllByPaths([{ collection, id }])` - Batch get up to 100 documents from arbitrary paths via `documents:batchGet` endpoint
  - Returns results in the same order as input refs
  - Missing documents return `null` (no throw)
  - Supports subcollection paths (e.g., `users/uid1/profile`)
  - 7 unit tests + 3 e2e tests

## [2.7.0] - 2026-03-12

### Added
- **Firestore Batch Get (`getAll`)**: Fetch multiple documents in a single REST API call
  - `getAll(collectionPath, documentIds)` - Batch get up to 100 documents via `documents:batchGet` endpoint
  - Returns results in the same order as input document IDs
  - Missing documents return `null` (no throw)
  - Enforces 100-document limit with clear error message
  - Supports subcollection paths
  - 8 unit tests + 5 e2e tests

### Fixed
- **FCM**: `sendMessage` now uses `getProjectId()` instead of `getConfig().projectId`, fixing silent failure when `initializeApp()` hasn't been called (falls back to `FIREBASE_PROJECT_ID` env var)

### Changed
- Total unit tests increased from 498 to 506 (+8 tests)

## [2.6.0] - 2026-03-07

### Added
- **Firebase Cloud Messaging (FCM)**: Server-side push notification support via FCM HTTP v1 API
  - `sendMessage()` - Send notifications to devices, topics, or conditions
  - `subscribeToTopic()` - Subscribe up to 1000 device tokens to a topic
  - `unsubscribeFromTopic()` - Unsubscribe device tokens from a topic
  - Full TypeScript types for Message, Notification, AndroidConfig, WebpushConfig, ApnsConfig
  - Platform-specific configuration support (Android, Web, iOS)
  - Data-only messages and notification+data payloads
  - Topic name normalization (auto-prefixes `/topics/` when missing)
  - 29 comprehensive unit tests
- New module: `src/messaging/` (client, types, index)
- New exported types: `Message`, `FcmNotification`, `AndroidConfig`, `AndroidNotification`, `WebpushConfig`, `ApnsConfig`, `FcmOptions`, `SendResponse`, `TopicManagementResponse`, `TopicManagementError`

### Changed
- Total unit tests increased from 469 to 498 (+29 tests)
- Total test suites increased from 16 to 17

## [2.5.2] - 2026-03-03

### Fixed
- **Firestore Query**: Fixed null/undefined and NaN value queries in Firestore
- Added support for `where('field', '==', null)` queries using `unaryFilter` with `IS_NULL` operator
- Added support for `where('field', '==', NaN)` queries using `unaryFilter` with `IS_NAN` operator
- Previously, null/NaN queries would fail because they incorrectly used `fieldFilter` instead of `unaryFilter`
- Firestore REST API requires `unaryFilter` for these special value comparisons
- All 463 tests passing with fix

## [2.5.1] - 2026-02-24

### Fixed
- **CRITICAL**: Fixed `merge: true` option causing "invalid path *" error
- Changed updateMask from wildcard `*` to actual field names when using `merge: true`
- Firestore REST API does not support `*` as a field path - must use explicit field names
- Fixed in both `setDocument()` and `batchWrite()` operations
- Updated tests to reflect correct behavior

## [2.5.0] - 2026-02-19

### Added
- **User Management APIs**: Complete user management functionality via Firebase Identity Toolkit REST API
  - `getUserByEmail()` - Look up users by email address
  - `getUserByUid()` - Look up users by UID
  - `createUser()` - Create new Firebase users with email, password, display name, etc.
  - `updateUser()` - Update existing user properties (email, password, display name, photo URL, etc.)
  - `deleteUser()` - Delete Firebase users
  - `listUsers()` - List all users with pagination support (up to 1000 per page)
  - `setCustomUserClaims()` - Set custom claims for role-based access control
- New type definitions: `UserRecord`, `CreateUserRequest`, `UpdateUserRequest`, `ListUsersResult`
- 30 comprehensive unit tests for user management (91.66% coverage)
- 18 E2E tests for user management (complete lifecycle testing)
- Complete user management documentation in README with examples
- Feature comparison table updated to show user management support

### Changed
- Total unit tests increased from 433 to 463 (+30 tests)
- Total E2E tests increased from 105 to 123 (+18 tests)
- Updated feature list to include user management

### Notes
- `listUsers()` E2E tests are skipped as the REST API endpoint availability varies by Firebase project configuration

## [2.4.0] - 2026-02-15

### Added
- **Session Cookie Support**: Added `createSessionCookie()` and `verifySessionCookie()`
- Long-lived authentication sessions (up to 14 days) instead of 1-hour ID tokens
- Session cookie verification with proper issuer validation
- 15 new unit tests for session cookie functionality
- 3 new E2E tests for session cookie creation and verification
- Comprehensive session cookie documentation in README

### Changed
- Auth module coverage improved from 63.18% to 97.51%
- Total tests increased from 418 to 433 (+15 tests)

## [2.3.1] - 2026-02-14

### Fixed
- **CRITICAL**: Fixed signed URL generation to match Google Cloud Storage SDK encoding
- Implemented `fixedEncodeURIComponent` to additionally encode `! * ' ( )` characters
- This fixes `SignatureDoesNotMatch` errors in production environments
- Path encoding now exactly matches official `@google-cloud/storage` SDK behavior

## [2.3.0] - 2026-02-14

### Added
- **Resumable uploads** with `uploadFileResumable()` for large files
- **True streaming support** with ReadableStream (no memory limit)
- Progress tracking with callbacks for resumable uploads
- Resume capability for interrupted uploads
- Chunked uploads with configurable chunk size (default 256KB)
- Comprehensive unit tests for Storage module (68 new tests total)
- Unit tests for `storage/client.ts` (31 tests, 88.11% coverage)
- Unit tests for `storage/signed-urls.ts` (32 tests, 100% coverage)
- Unit tests for `storage/resumable-upload.ts` (16 tests, 88.03% coverage)
- E2E tests for resumable uploads with real Firebase (11 tests)
- E2E tests for ReadableStream uploads (validated with 1MB files and puppy.png)
- E2E test for complex nested arrays (message content scenario)
- Agent Context Protocol (ACP) initialization documentation
- `.env.example` file with all environment variables documented

### Changed
- **BREAKING**: Default storage bucket format changed from `.appspot.com` to `.firebasestorage.app`
- Improved overall test coverage from 76.15% to 94.87% (+18.72%)
- Storage module coverage improved from 0% to 89.89%
- Total test count increased from 339 to 418 tests (+79 tests)
- Fixed storage e2e tests to properly initialize Firebase app

### Fixed
- Storage module now has proper unit test coverage (previously only e2e tests)
- Storage e2e tests now initialize app correctly
- Bucket naming updated to match new Firebase format
- Array serialization confirmed working (not serialized to JSON strings)

## [2.2.2] - 2026-02-13

### Added
- Collection iteration functions: `listDocuments()`, `iterateCollection()`, and `countDocuments()`
- Automatic pagination support for large collections
- Support for iterating with filters and ordering

### Changed
- **BREAKING**: `fromFirestoreValue()` now throws an error for unknown Firestore value types instead of returning `null`
- Removed debug console.log statements from production code in `auth.ts`

### Fixed
- Silent failures in Firestore data conversion now throw descriptive errors

## [2.2.1] - 2026-02-12

### Added
- Modular Firestore architecture with separate modules for converters, operations, query-builder, transforms, and path-validation
- Comprehensive path validation for Firestore operations
- Support for subcollection queries

### Changed
- Refactored Firestore implementation into modular structure
- Improved error messages for path validation

### Fixed
- Subcollection query support using correct REST API endpoints
- Path validation for nested collections

## [2.2.0] - Previous Release

### Added
- Firebase Storage support with signed URLs
- Custom token creation and sign-in
- Support for Firebase v10 session tokens
- Field transforms (serverTimestamp, increment, arrayUnion, arrayRemove, delete)
- Batch write operations
- Advanced query support (where, orderBy, limit)

### Changed
- Improved token verification to support both v9 and v10 token formats
- Enhanced error handling across all modules

### Fixed
- Public key caching and rotation handling
- Token verification for multiple issuer formats

## [2.1.0] - Initial Release

### Added
- Core Firebase Admin SDK functionality for Cloudflare Workers
- Authentication with ID token verification
- Firestore CRUD operations via REST API
- Service account configuration
- X.509 certificate handling
- JWT token generation
