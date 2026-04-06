# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial SDK structure with core, security, and metrics packages
- TipStreamClient with retry logic and event emitting
- AES-256-GCM encryption utilities
- Request signing with HMAC and RSA support
- Schema-based input validation and sanitization
- Audit logging with tamper-evident hash chains
- Metrics collection with multiple reporter backends
- NPM download tracking
- Analytics engine with session management
- Comprehensive test suite
- CI/CD pipelines for testing and publishing
- Security scanning with Snyk and npm audit
- SBOM generation

### Security
- Added security policy (SECURITY.md)
- Implemented secure key derivation with scrypt
- Added timing-safe comparison functions
- Integrated CodeQL analysis
- Added dependency review for PRs

## [1.0.0-alpha.0] - Initial Development

### Added
- Project initialization
- Monorepo structure with npm workspaces
- TypeScript configuration
- ESLint and Prettier setup
- Vitest test framework
