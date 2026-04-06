# Getting Started with TipStream SDK

Welcome to the TipStream SDK! This guide will help you get up and running quickly.

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher

## Installation

Install the packages you need:

```bash
# Core SDK (required)
npm install @tipstream/sdk-core

# Optional: Security utilities
npm install @tipstream/sdk-security

# Optional: Metrics collection
npm install @tipstream/sdk-metrics
```

Or install all packages at once:

```bash
npm install @tipstream/sdk-core @tipstream/sdk-security @tipstream/sdk-metrics
```

## Quick Start

### 1. Initialize the Client

```typescript
import { TipStreamClient } from '@tipstream/sdk-core';

const client = new TipStreamClient({
  baseUrl: 'https://api.tipstream.io',
  apiKey: 'your-api-key',
  timeout: 30000,
  retries: 3
});

// Listen for events
client.on('request', (url) => console.log(`Request: ${url}`));
client.on('response', (data) => console.log(`Response received`));
client.on('error', (error) => console.error(`Error: ${error.message}`));
```

### 2. Make API Requests

```typescript
// GET request
const users = await client.get('/users');

// POST request with body
const newUser = await client.post('/users', {
  body: {
    name: 'John Doe',
    email: 'john@example.com'
  }
});

// PUT request
const updated = await client.put(`/users/${userId}`, {
  body: { name: 'Jane Doe' }
});

// DELETE request
await client.delete(`/users/${userId}`);
```

### 3. Add Request Signing (Security)

```typescript
import { TipStreamClient } from '@tipstream/sdk-core';
import { RequestSigner } from '@tipstream/sdk-security';

// Create a signer
const signer = new RequestSigner({
  algorithm: 'hmac-sha256',
  secretKey: 'your-secret-key',
  headerName: 'X-Signature'
});

// Sign requests
const client = new TipStreamClient({
  baseUrl: 'https://api.tipstream.io',
  apiKey: 'your-api-key',
  requestInterceptor: async (config) => {
    const signature = signer.sign({
      method: config.method,
      url: config.url,
      body: config.body
    });
    
    return {
      ...config,
      headers: {
        ...config.headers,
        'X-Signature': signature
      }
    };
  }
});
```

### 4. Add Metrics Collection

```typescript
import { TipStreamClient } from '@tipstream/sdk-core';
import { MetricsCollector, ConsoleReporter } from '@tipstream/sdk-metrics';

// Create metrics collector
const metrics = new MetricsCollector();
metrics.addReporter(new ConsoleReporter({ prefix: '[SDK]' }));

// Start collecting
metrics.start();

// Track SDK usage
const client = new TipStreamClient({
  baseUrl: 'https://api.tipstream.io',
  apiKey: 'your-api-key'
});

client.on('request', () => {
  metrics.increment('api.requests', { endpoint: '/users' });
});

client.on('response', ({ duration }) => {
  metrics.timing('api.response_time', duration);
});

client.on('error', (error) => {
  metrics.increment('api.errors', { type: error.name });
});
```

## Configuration Options

### TipStreamClient Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | `string` | **required** | API base URL |
| `apiKey` | `string` | - | API key for authentication |
| `timeout` | `number` | `30000` | Request timeout in ms |
| `retries` | `number` | `3` | Number of retry attempts |
| `retryDelay` | `number` | `1000` | Base delay between retries |
| `headers` | `object` | `{}` | Default headers |
| `requestInterceptor` | `function` | - | Transform outgoing requests |
| `responseInterceptor` | `function` | - | Transform incoming responses |

### RequestSigner Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `algorithm` | `string` | `'hmac-sha256'` | Signing algorithm |
| `secretKey` | `string` | **required** | Signing secret |
| `privateKey` | `string` | - | RSA private key (for RSA) |
| `headerName` | `string` | `'X-Signature'` | Signature header name |
| `timestampTolerance` | `number` | `300000` | Timestamp tolerance (ms) |

### MetricsCollector Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `flushInterval` | `number` | `10000` | Flush interval in ms |
| `maxBufferSize` | `number` | `1000` | Max buffered metrics |
| `defaultTags` | `object` | `{}` | Tags added to all metrics |

## Error Handling

```typescript
import { TipStreamClient, TipStreamError, TimeoutError, NetworkError } from '@tipstream/sdk-core';

try {
  const response = await client.get('/users');
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  } else if (error instanceof TipStreamError) {
    console.error('API error:', error.statusCode, error.message);
  }
}
```

## Next Steps

- [API Documentation](./API.md) - Complete API reference
- [Security Guide](./SECURITY.md) - Security best practices
- [Metrics Guide](./METRICS.md) - Detailed metrics setup
- [Examples](../examples/) - Code examples

## Support

- GitHub Issues: [Report a bug](https://github.com/tipstream/sdk/issues)
- Security: See [SECURITY.md](../SECURITY.md) for reporting vulnerabilities
