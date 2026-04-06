# API Reference

Complete API documentation for the TipStream SDK packages.

---

## @tipstream/sdk-core

### TipStreamClient

The main client for interacting with the TipStream API.

#### Constructor

```typescript
new TipStreamClient(options: TipStreamClientOptions)
```

#### Options

```typescript
interface TipStreamClientOptions {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;           // Default: 30000
  retries?: number;           // Default: 3
  retryDelay?: number;        // Default: 1000
  headers?: Record<string, string>;
  requestInterceptor?: RequestInterceptor;
  responseInterceptor?: ResponseInterceptor;
}
```

#### Methods

##### `get<T>(path: string, options?: RequestOptions): Promise<T>`

Make a GET request.

```typescript
const users = await client.get<User[]>('/users');
const user = await client.get<User>('/users/123', {
  headers: { 'X-Custom': 'header' }
});
```

##### `post<T>(path: string, options?: RequestOptions): Promise<T>`

Make a POST request.

```typescript
const user = await client.post<User>('/users', {
  body: { name: 'John', email: 'john@example.com' }
});
```

##### `put<T>(path: string, options?: RequestOptions): Promise<T>`

Make a PUT request.

```typescript
const updated = await client.put<User>('/users/123', {
  body: { name: 'Updated Name' }
});
```

##### `patch<T>(path: string, options?: RequestOptions): Promise<T>`

Make a PATCH request.

```typescript
const patched = await client.patch<User>('/users/123', {
  body: { status: 'active' }
});
```

##### `delete<T>(path: string, options?: RequestOptions): Promise<T>`

Make a DELETE request.

```typescript
await client.delete('/users/123');
```

##### `request<T>(method: string, path: string, options?: RequestOptions): Promise<T>`

Make a request with any HTTP method.

```typescript
const response = await client.request<Data>('OPTIONS', '/endpoint');
```

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `request` | `{ url, method, headers }` | Emitted before each request |
| `response` | `{ status, data, duration }` | Emitted on successful response |
| `error` | `TipStreamError` | Emitted on error |
| `retry` | `{ attempt, maxRetries, error }` | Emitted on retry |

```typescript
client.on('request', (info) => console.log('Request:', info.url));
client.on('response', (info) => console.log('Duration:', info.duration));
client.on('error', (error) => console.error('Error:', error));
client.on('retry', (info) => console.log(`Retry ${info.attempt}/${info.maxRetries}`));
```

### RequestBuilder

Fluent interface for building requests.

```typescript
import { RequestBuilder } from '@tipstream/sdk-core';

const request = new RequestBuilder()
  .method('POST')
  .url('https://api.example.com/users')
  .header('Authorization', 'Bearer token')
  .header('Content-Type', 'application/json')
  .body({ name: 'John' })
  .timeout(5000)
  .build();
```

### Error Classes

#### TipStreamError

Base error class for all SDK errors.

```typescript
class TipStreamError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}
```

#### TimeoutError

Thrown when a request times out.

```typescript
class TimeoutError extends TipStreamError {
  timeout: number;
}
```

#### NetworkError

Thrown on network failures.

```typescript
class NetworkError extends TipStreamError {
  cause?: Error;
}
```

#### ValidationError

Thrown on request/response validation failures.

```typescript
class ValidationError extends TipStreamError {
  field?: string;
  value?: unknown;
}
```

---

## @tipstream/sdk-security

### Encryptor

AES-256-GCM encryption utilities.

#### Constructor

```typescript
new Encryptor(key: Buffer | string)
```

#### Methods

##### `encrypt(data: string | Buffer): EncryptedData`

Encrypt data.

```typescript
const encryptor = new Encryptor(key);
const encrypted = encryptor.encrypt('sensitive data');
// { iv: Buffer, authTag: Buffer, ciphertext: Buffer }
```

##### `decrypt(encrypted: EncryptedData): Buffer`

Decrypt data.

```typescript
const decrypted = encryptor.decrypt(encrypted);
console.log(decrypted.toString()); // 'sensitive data'
```

##### `static generateKey(): Buffer`

Generate a random 256-bit key.

```typescript
const key = Encryptor.generateKey();
```

### PasswordEncryptor

Encryption with password-based key derivation.

```typescript
const encryptor = new PasswordEncryptor();
const encrypted = await encryptor.encrypt('data', 'password');
const decrypted = await encryptor.decrypt(encrypted, 'password');
```

### RequestSigner

Sign and verify requests.

#### Constructor

```typescript
new RequestSigner(options: SignerOptions)
```

#### Options

```typescript
interface SignerOptions {
  algorithm: 'hmac-sha256' | 'hmac-sha384' | 'hmac-sha512' | 'rsa-sha256';
  secretKey?: string;          // For HMAC
  privateKey?: string;         // For RSA signing
  publicKey?: string;          // For RSA verification
  headerName?: string;         // Default: 'X-Signature'
  timestampTolerance?: number; // Default: 300000 (5 min)
}
```

#### Methods

##### `sign(request: SignableRequest): string`

Generate a signature.

```typescript
const signer = new RequestSigner({
  algorithm: 'hmac-sha256',
  secretKey: 'secret'
});

const signature = signer.sign({
  method: 'POST',
  url: '/users',
  body: { name: 'John' },
  timestamp: Date.now()
});
```

##### `verify(request: SignableRequest, signature: string): boolean`

Verify a signature.

```typescript
const isValid = signer.verify(request, signature);
```

##### `createAuthorizationHeader(request: SignableRequest): string`

Create a complete authorization header.

```typescript
const authHeader = signer.createAuthorizationHeader(request);
// 'TipStream ts=1234567890,sig=abc123...'
```

### WebhookVerifier

Verify incoming webhook signatures.

```typescript
const verifier = new WebhookVerifier({
  secretKey: 'webhook-secret',
  headerName: 'X-Webhook-Signature'
});

const isValid = verifier.verify(
  request.body,
  request.headers['x-webhook-signature']
);
```

### Validator

Schema-based input validation.

```typescript
import { Validator, ValidationSchema } from '@tipstream/sdk-security';

const schema: ValidationSchema = {
  name: { type: 'string', required: true, minLength: 2, maxLength: 100 },
  email: { type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  age: { type: 'number', min: 0, max: 150 }
};

const validator = new Validator(schema);
const result = validator.validate(input);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

### Sanitizer

Input sanitization utilities.

```typescript
import { Sanitizer } from '@tipstream/sdk-security';

const sanitizer = new Sanitizer({
  stripHtml: true,
  escapeHtml: true,
  trimWhitespace: true
});

const clean = sanitizer.sanitize(userInput);
```

#### Methods

- `sanitize(input: string): string` - Apply all sanitization rules
- `escapeHtml(input: string): string` - Escape HTML entities
- `stripHtml(input: string): string` - Remove HTML tags
- `detectXss(input: string): boolean` - Detect XSS patterns
- `detectSqlInjection(input: string): boolean` - Detect SQL injection patterns

### AuditLogger

Tamper-evident audit logging.

```typescript
import { AuditLogger } from '@tipstream/sdk-security';

const logger = new AuditLogger({
  storagePath: './audit-logs',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  rotationCount: 10
});

// Log events
logger.log({
  action: 'user.login',
  actor: 'user@example.com',
  resource: 'auth',
  details: { ip: '192.168.1.1' }
});

// Query logs
const logs = await logger.query({
  action: 'user.login',
  startTime: Date.now() - 86400000 // Last 24 hours
});

// Verify integrity
const isValid = await logger.verifyIntegrity();
```

---

## @tipstream/sdk-metrics

### MetricsCollector

Central metrics collection.

#### Constructor

```typescript
new MetricsCollector(options?: CollectorOptions)
```

#### Options

```typescript
interface CollectorOptions {
  flushInterval?: number;    // Default: 10000
  maxBufferSize?: number;    // Default: 1000
  defaultTags?: Record<string, string>;
}
```

#### Methods

##### `increment(name: string, tags?: Tags, value?: number): void`

Increment a counter.

```typescript
metrics.increment('api.requests');
metrics.increment('api.requests', { endpoint: '/users' });
metrics.increment('api.requests', { endpoint: '/users' }, 5);
```

##### `gauge(name: string, value: number, tags?: Tags): void`

Set a gauge value.

```typescript
metrics.gauge('memory.used', process.memoryUsage().heapUsed);
metrics.gauge('connections.active', 42, { server: 'main' });
```

##### `timing(name: string, duration: number, tags?: Tags): void`

Record a timing.

```typescript
metrics.timing('api.response_time', 150);
metrics.timing('db.query_time', 25, { query: 'users' });
```

##### `histogram(name: string, value: number, tags?: Tags): void`

Record a histogram value.

```typescript
metrics.histogram('request.size', 1024);
metrics.histogram('response.size', 4096, { endpoint: '/data' });
```

##### `start(): void`

Start the collector (begins flush interval).

##### `stop(): Promise<void>`

Stop the collector and flush remaining metrics.

##### `flush(): Promise<void>`

Manually flush buffered metrics.

##### `addReporter(reporter: Reporter): void`

Add a metrics reporter.

```typescript
metrics.addReporter(new ConsoleReporter());
metrics.addReporter(new FileReporter({ path: './metrics.log' }));
```

### Reporters

#### ConsoleReporter

```typescript
new ConsoleReporter({
  prefix?: string;           // Default: '[metrics]'
  format?: 'text' | 'json';  // Default: 'text'
})
```

#### FileReporter

```typescript
new FileReporter({
  path: string;
  format?: 'text' | 'json' | 'csv';
  rotateSize?: number;       // Rotate at this size
  maxFiles?: number;         // Max rotated files to keep
})
```

#### WebhookReporter

```typescript
new WebhookReporter({
  url: string;
  headers?: Record<string, string>;
  batchSize?: number;        // Default: 100
  retries?: number;          // Default: 3
})
```

### NpmTracker

Track NPM download statistics.

```typescript
import { NpmTracker } from '@tipstream/sdk-metrics';

const tracker = new NpmTracker({
  packages: ['@tipstream/sdk-core'],
  cacheDir: './cache',
  cacheTTL: 3600000
});

// Get downloads
const total = await tracker.getDownloads('@tipstream/sdk-core');
const weekly = await tracker.getDownloads('@tipstream/sdk-core', 'last-week');

// Get trends
const trends = await tracker.getDownloadTrends('@tipstream/sdk-core', 30);

// Get package info
const info = await tracker.getPackageInfo('@tipstream/sdk-core');
```

### Analytics

Usage analytics with session tracking.

```typescript
import { Analytics } from '@tipstream/sdk-metrics';

const analytics = new Analytics({
  sessionTimeout: 1800000 // 30 minutes
});

// Track events
analytics.track('feature.used', {
  feature: 'encryption',
  duration: 150
});

// Track errors
analytics.trackError(error, {
  context: 'api_request',
  endpoint: '/users'
});

// Get session stats
const stats = analytics.getSessionStats();
```

### MetricsPersistence

JSON file persistence for metrics.

```typescript
import { MetricsPersistence } from '@tipstream/sdk-metrics';

const persistence = new MetricsPersistence({
  filePath: './metrics-data.json',
  autoSave: true,
  saveInterval: 60000
});

// Store data
persistence.set('downloads.total', 1000);
persistence.set('last_updated', new Date().toISOString());

// Retrieve data
const total = persistence.get('downloads.total');

// Query with pattern
const allDownloads = persistence.query('downloads.*');
```

---

## Type Definitions

### Common Types

```typescript
// Request options
interface RequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

// Metric tags
type Tags = Record<string, string | number | boolean>;

// Validation schema field
interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: unknown[];
  custom?: (value: unknown) => boolean;
}

// Audit log entry
interface AuditEntry {
  id: string;
  timestamp: number;
  action: string;
  actor: string;
  resource: string;
  details?: Record<string, unknown>;
  hash: string;
  previousHash: string;
}
```
