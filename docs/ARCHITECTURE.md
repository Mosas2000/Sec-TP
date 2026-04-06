# Architecture Overview

This document describes the architecture of the TipStream SDK.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Application Layer                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐         │
│    │  sdk-core     │    │  sdk-security │    │  sdk-metrics  │         │
│    │               │───▶│               │    │               │         │
│    │ TipStreamClient│    │ Encryption    │    │ Collector     │         │
│    │ RequestBuilder│    │ Signing       │◀───│ Reporters     │         │
│    │ Error Types   │    │ Validation    │    │ Analytics     │         │
│    └───────────────┘    └───────────────┘    └───────────────┘         │
│            │                    │                    │                   │
│            ▼                    ▼                    ▼                   │
│    ┌─────────────────────────────────────────────────────────┐         │
│    │                     HTTP/HTTPS Layer                     │         │
│    │            (fetch API with retry & timeout)              │         │
│    └─────────────────────────────────────────────────────────┘         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                         ┌─────────────────────┐
                         │   TipStream API     │
                         │                     │
                         │  REST Endpoints     │
                         │  Webhooks           │
                         └─────────────────────┘
```

## Package Architecture

### @tipstream/sdk-core

The core package provides the foundational HTTP client functionality.

```
sdk-core/
├── src/
│   ├── index.ts          # Public exports
│   ├── client.ts         # TipStreamClient implementation
│   ├── types.ts          # Type definitions
│   ├── api/
│   │   ├── requests.ts   # RequestBuilder, interceptors
│   │   └── responses.ts  # Response processing, caching
│   └── utils/
│       └── helpers.ts    # Utility functions
└── tests/
```

**Key Classes:**

- **TipStreamClient**: Main entry point, extends EventEmitter
  - Manages HTTP requests with fetch API
  - Handles retries with exponential backoff
  - Emits events for request lifecycle
  - Supports request/response interceptors

- **RequestBuilder**: Fluent API for request construction
  - Method chaining for configuration
  - Automatic serialization
  - Header management

**Design Patterns:**
- Event Emitter for lifecycle hooks
- Builder pattern for request construction
- Strategy pattern for retry logic
- Decorator pattern for interceptors

### @tipstream/sdk-security

The security package provides cryptographic and validation utilities.

```
sdk-security/
├── src/
│   ├── index.ts          # Public exports
│   ├── encryption.ts     # AES-256-GCM encryption
│   ├── signing.ts        # Request signing (HMAC/RSA)
│   ├── validation.ts     # Schema-based validation
│   ├── sanitization.ts   # Input sanitization
│   └── audit.ts          # Audit logging
└── tests/
```

**Key Classes:**

- **Encryptor**: AES-256-GCM symmetric encryption
  - Random IV generation per operation
  - Authentication tag for integrity
  - Timing-safe comparison

- **PasswordEncryptor**: Password-based encryption
  - scrypt key derivation (N=2^14, r=8, p=1)
  - Random salt per encryption
  - Secure password handling

- **RequestSigner**: Request authentication
  - HMAC-SHA256/384/512 support
  - RSA-SHA256 support
  - Timestamp-based replay protection
  - Canonical request formatting

- **Validator**: Input validation
  - Schema-based validation rules
  - XSS detection patterns
  - SQL injection detection
  - Custom validation functions

- **AuditLogger**: Tamper-evident logging
  - SHA-256 hash chain
  - File rotation
  - Query capabilities

**Security Considerations:**
- All keys stored in memory only
- Timing-safe comparisons prevent timing attacks
- Random IVs/salts prevent deterministic output
- Hash chain ensures audit log integrity

### @tipstream/sdk-metrics

The metrics package provides observability and analytics.

```
sdk-metrics/
├── src/
│   ├── index.ts          # Public exports
│   ├── collector.ts      # MetricsCollector
│   ├── npm-tracker.ts    # NPM download tracking
│   ├── download-tracker.ts # Historical tracking
│   ├── analytics.ts      # Usage analytics
│   ├── persistence.ts    # JSON storage
│   └── reporters/
│       ├── index.ts      # Reporter exports
│       ├── console.ts    # Console output
│       ├── file.ts       # File logging
│       └── webhook.ts    # HTTP reporting
└── tests/
```

**Key Classes:**

- **MetricsCollector**: Central metrics hub
  - Counter, gauge, timing, histogram types
  - Tag-based dimensional data model
  - Buffering and batching
  - Multiple reporter support

- **Reporter Interface**: Pluggable output
  - ConsoleReporter: Development debugging
  - FileReporter: Local persistence
  - WebhookReporter: Remote collection

- **NpmTracker**: Registry integration
  - NPM API client
  - Download statistics
  - Version information
  - Response caching

- **Analytics**: Usage tracking
  - Session management
  - Event tracking
  - Error tracking
  - Aggregated statistics

## Data Flow

### Request Lifecycle

```
1. Application calls client.get('/users')
         │
         ▼
2. RequestBuilder constructs request
         │
         ▼
3. Request interceptor runs (optional)
   - Add authentication
   - Sign request
   - Add metrics headers
         │
         ▼
4. HTTP request sent
         │
         ▼
5. Response received
         │
         ▼
6. Response interceptor runs (optional)
   - Transform data
   - Handle errors
   - Record metrics
         │
         ▼
7. Events emitted (request, response, error)
         │
         ▼
8. Data returned to application
```

### Metrics Flow

```
1. Event occurs (API call, error, etc.)
         │
         ▼
2. MetricsCollector.increment/gauge/timing()
         │
         ▼
3. Metric added to buffer with tags
         │
         ▼
4. Buffer reaches threshold or flush interval
         │
         ▼
5. Batch sent to all reporters
         │
         ▼
6. Reporters output metrics
   - Console: immediate log
   - File: write to disk
   - Webhook: HTTP POST
```

## Security Architecture

### Encryption Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Plaintext   │────▶│   Encryptor  │────▶│  Ciphertext  │
└──────────────┘     │              │     │  + IV        │
                     │  AES-256-GCM │     │  + AuthTag   │
                     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  256-bit Key │
                     │  (in memory) │
                     └──────────────┘
```

### Request Signing Flow

```
┌──────────────────────────────────────────────────┐
│                  Canonical Request                │
│  ┌──────────────────────────────────────────────┐│
│  │ METHOD\n                                     ││
│  │ PATH\n                                       ││
│  │ TIMESTAMP\n                                  ││
│  │ BODY_HASH                                    ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │   HMAC-SHA256    │◀──── Secret Key
              │   or RSA-SHA256  │◀──── Private Key
              └──────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │    Signature     │
              │  (base64 encoded)│
              └──────────────────┘
```

## Monorepo Structure

```
Sec-TS/
├── packages/
│   ├── core/           # @tipstream/sdk-core
│   ├── security/       # @tipstream/sdk-security
│   └── metrics/        # @tipstream/sdk-metrics
├── examples/           # Usage examples
├── docs/               # Documentation
├── tests/              # Integration tests
├── scripts/            # Build & release
├── .github/workflows/  # CI/CD pipelines
├── package.json        # Workspace root
├── tsconfig.base.json  # Shared TS config
└── vitest.config.ts    # Test configuration
```

### Dependency Graph

```
@tipstream/sdk-metrics
         │
         │ (peer dependency)
         ▼
@tipstream/sdk-core ◀─── @tipstream/sdk-security
                              (peer dependency)
```

All packages:
- Are independently versionable
- Have no circular dependencies
- Share TypeScript and test configuration
- Can be installed separately or together

## Build System

### Build Pipeline

```
TypeScript Source
       │
       ▼
   TypeScript Compiler (type checking)
       │
       ▼
   esbuild (bundling)
       │
       ├──▶ dist/index.js     (ESM)
       ├──▶ dist/index.cjs    (CommonJS)
       └──▶ dist/index.d.ts   (Type declarations)
```

### CI/CD Pipeline

```
Push/PR
   │
   ├──▶ test.yml
   │        │
   │        ├── Lint (ESLint)
   │        ├── Type Check
   │        ├── Unit Tests
   │        └── Coverage Report
   │
   ├──▶ security.yml
   │        │
   │        ├── npm audit
   │        ├── Snyk scan
   │        ├── CodeQL analysis
   │        └── Dependency review
   │
Tag (v*.*.*)
   │
   └──▶ publish.yml
            │
            ├── Build packages
            ├── Run tests
            ├── Publish to npm
            ├── Publish to GitHub Packages
            ├── Generate SBOM
            └── Create GitHub Release
```

## Performance Considerations

### Request Optimization

- Connection reuse via fetch API
- Request deduplication (configurable)
- Response caching with TTL
- Retry with exponential backoff + jitter

### Metrics Optimization

- In-memory buffering
- Batch flushing
- Async reporters
- Tag cardinality limits

### Memory Management

- Bounded buffers prevent unbounded growth
- Automatic cleanup of expired cache entries
- File rotation for logs and metrics
- Weak references where appropriate

## Extensibility Points

1. **Request Interceptors**: Transform outgoing requests
2. **Response Interceptors**: Transform incoming responses
3. **Custom Reporters**: Add new metrics destinations
4. **Custom Validators**: Add validation rules
5. **Event Handlers**: React to SDK lifecycle events
