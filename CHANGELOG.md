# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
