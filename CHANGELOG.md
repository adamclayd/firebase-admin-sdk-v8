# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
