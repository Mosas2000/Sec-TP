# TipStream Integration Guide

This guide explains how to integrate the TipStream SDK into your application.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Configuration](#configuration)
- [Authentication](#authentication)
- [API Integration](#api-integration)
- [Event Handling](#event-handling)
- [Error Handling](#error-handling)
- [Security Integration](#security-integration)
- [Metrics Integration](#metrics-integration)
- [Production Setup](#production-setup)

## Overview

The TipStream SDK provides three packages for building secure, observable applications:

| Package | Purpose |
|---------|---------|
| `@tipstream/sdk-core` | HTTP client, API requests, event handling |
| `@tipstream/sdk-security` | Encryption, signing, validation, audit |
| `@tipstream/sdk-metrics` | Metrics, analytics, NPM tracking |

## Installation

```bash
# Install all packages
npm install @tipstream/sdk-core @tipstream/sdk-security @tipstream/sdk-metrics

# Or install individually
npm install @tipstream/sdk-core
npm install @tipstream/sdk-security
npm install @tipstream/sdk-metrics
```

## Configuration

### Environment Variables

Create a `.env` file:

```env
# API Configuration
TIPSTREAM_API_URL=https://api.tipstream.io
TIPSTREAM_API_KEY=your-api-key

# Security Configuration
TIPSTREAM_SIGNING_SECRET=your-signing-secret
TIPSTREAM_ENCRYPTION_KEY=your-256-bit-hex-key

# Metrics Configuration
TIPSTREAM_METRICS_ENDPOINT=https://metrics.tipstream.io/ingest
TIPSTREAM_METRICS_INTERVAL=30000

# Environment
NODE_ENV=production
```

### Configuration Module

```typescript
// config.ts
export const config = {
  api: {
    url: process.env.TIPSTREAM_API_URL || 'https://api.tipstream.io',
    key: process.env.TIPSTREAM_API_KEY || '',
    timeout: 30000,
    retries: 3
  },
  security: {
    signingSecret: process.env.TIPSTREAM_SIGNING_SECRET || '',
    encryptionKey: process.env.TIPSTREAM_ENCRYPTION_KEY || '',
    timestampTolerance: 300000 // 5 minutes
  },
  metrics: {
    endpoint: process.env.TIPSTREAM_METRICS_ENDPOINT,
    interval: parseInt(process.env.TIPSTREAM_METRICS_INTERVAL || '30000', 10),
    enabled: process.env.NODE_ENV === 'production'
  }
};
```

## Authentication

### API Key Authentication

```typescript
import { TipStreamClient } from '@tipstream/sdk-core';

const client = new TipStreamClient({
  baseUrl: config.api.url,
  apiKey: config.api.key,
  headers: {
    'X-API-Version': '2024-01'
  }
});
```

### Request Signing

For enhanced security, sign requests:

```typescript
import { TipStreamClient } from '@tipstream/sdk-core';
import { RequestSigner } from '@tipstream/sdk-security';

const signer = new RequestSigner({
  algorithm: 'hmac-sha256',
  secretKey: config.security.signingSecret
});

const client = new TipStreamClient({
  baseUrl: config.api.url,
  apiKey: config.api.key,
  requestInterceptor: async (requestConfig) => {
    const timestamp = Date.now();
    const signature = signer.sign({
      method: requestConfig.method,
      url: requestConfig.url,
      body: requestConfig.body,
      timestamp
    });

    return {
      ...requestConfig,
      headers: {
        ...requestConfig.headers,
        'X-Timestamp': timestamp.toString(),
        'X-Signature': signature
      }
    };
  }
});
```

## API Integration

### Basic Requests

```typescript
// GET
const users = await client.get<User[]>('/users');

// GET with query params
const activeUsers = await client.get<User[]>('/users', {
  params: { status: 'active', limit: '50' }
});

// POST
const newUser = await client.post<User>('/users', {
  body: { name: 'John Doe', email: 'john@example.com' }
});

// PUT
const updatedUser = await client.put<User>(`/users/${id}`, {
  body: { name: 'Jane Doe' }
});

// DELETE
await client.delete(`/users/${id}`);
```

### Pagination

```typescript
async function* paginateUsers(pageSize = 50) {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const users = await client.get<User[]>('/users', {
      params: { page: page.toString(), limit: pageSize.toString() }
    });

    yield* users;

    hasMore = users.length === pageSize;
    page++;
  }
}

// Usage
for await (const user of paginateUsers()) {
  console.log(user);
}
```

### Batch Requests

```typescript
async function batchCreate(items: CreateItem[]) {
  const batchSize = 100;
  const results: Item[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const created = await client.post<Item[]>('/items/batch', {
      body: { items: batch }
    });
    results.push(...created);
  }

  return results;
}
```

## Event Handling

### Listening to Events

```typescript
// Request started
client.on('request', ({ url, method, headers }) => {
  console.log(`[${method}] ${url}`);
});

// Response received
client.on('response', ({ status, duration, data }) => {
  console.log(`Response: ${status} (${duration}ms)`);
});

// Error occurred
client.on('error', (error) => {
  console.error(`Error: ${error.message}`);
  // Send to error tracking service
  errorTracker.capture(error);
});

// Retry attempt
client.on('retry', ({ attempt, maxRetries, error }) => {
  console.warn(`Retry ${attempt}/${maxRetries}: ${error.message}`);
});
```

### Custom Event Emitter

```typescript
import { EventEmitter } from 'events';

class TipStreamService extends EventEmitter {
  private client: TipStreamClient;

  constructor() {
    super();
    this.client = new TipStreamClient({...});
    this.setupEventForwarding();
  }

  private setupEventForwarding() {
    this.client.on('request', (data) => this.emit('api:request', data));
    this.client.on('response', (data) => this.emit('api:response', data));
    this.client.on('error', (error) => this.emit('api:error', error));
  }
}
```

## Error Handling

### Error Types

```typescript
import { 
  TipStreamError, 
  TimeoutError, 
  NetworkError,
  ValidationError 
} from '@tipstream/sdk-core';

try {
  await client.get('/resource');
} catch (error) {
  if (error instanceof TimeoutError) {
    // Request timed out
    console.error(`Timeout after ${error.timeout}ms`);
  } else if (error instanceof NetworkError) {
    // Network failure
    console.error(`Network error: ${error.message}`);
  } else if (error instanceof ValidationError) {
    // Validation failed
    console.error(`Validation: ${error.field} - ${error.message}`);
  } else if (error instanceof TipStreamError) {
    // API error
    console.error(`API error ${error.statusCode}: ${error.message}`);
  }
}
```

### Global Error Handler

```typescript
function setupGlobalErrorHandler(client: TipStreamClient) {
  client.on('error', async (error) => {
    // Log error
    logger.error('TipStream API Error', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack
    });

    // Track in analytics
    analytics.trackError(error);

    // Alert on critical errors
    if (error.statusCode >= 500) {
      await alerting.notify({
        level: 'critical',
        service: 'tipstream',
        error: error.message
      });
    }
  });
}
```

## Security Integration

### Input Validation

```typescript
import { Validator, ValidationSchema } from '@tipstream/sdk-security';

const userSchema: ValidationSchema = {
  name: { type: 'string', required: true, minLength: 2, maxLength: 100 },
  email: { type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  role: { type: 'string', enum: ['admin', 'user', 'moderator'] }
};

const validator = new Validator(userSchema);

async function createUser(input: unknown) {
  const validation = validator.validate(input);
  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(', '));
  }

  return client.post('/users', { body: input });
}
```

### Data Encryption

```typescript
import { Encryptor } from '@tipstream/sdk-security';

const encryptor = new Encryptor(Buffer.from(config.security.encryptionKey, 'hex'));

// Encrypt sensitive data before storage
function encryptSensitiveData(data: SensitiveData) {
  return {
    ...data,
    ssn: encryptor.encrypt(data.ssn),
    creditCard: encryptor.encrypt(data.creditCard)
  };
}

// Decrypt when needed
function decryptSensitiveData(data: EncryptedData) {
  return {
    ...data,
    ssn: encryptor.decrypt(data.ssn).toString(),
    creditCard: encryptor.decrypt(data.creditCard).toString()
  };
}
```

### Audit Logging

```typescript
import { AuditLogger } from '@tipstream/sdk-security';

const auditLogger = new AuditLogger({
  storagePath: './logs/audit',
  maxFileSize: 50 * 1024 * 1024
});

// Log important actions
async function performSensitiveAction(userId: string, action: string) {
  const result = await doAction();

  auditLogger.log({
    action,
    actor: userId,
    resource: result.resourceId,
    details: {
      success: true,
      timestamp: new Date().toISOString()
    }
  });

  return result;
}
```

## Metrics Integration

### Application Metrics

```typescript
import { MetricsCollector, WebhookReporter } from '@tipstream/sdk-metrics';

const metrics = new MetricsCollector({
  flushInterval: config.metrics.interval,
  defaultTags: {
    service: 'my-app',
    environment: process.env.NODE_ENV
  }
});

if (config.metrics.endpoint) {
  metrics.addReporter(new WebhookReporter({
    url: config.metrics.endpoint,
    headers: { 'Authorization': `Bearer ${config.api.key}` }
  }));
}

metrics.start();

// Track SDK usage
client.on('request', () => metrics.increment('tipstream.requests'));
client.on('response', ({ duration }) => 
  metrics.timing('tipstream.response_time', duration)
);
client.on('error', () => metrics.increment('tipstream.errors'));
```

### Business Metrics

```typescript
// Track business events
function trackPurchase(order: Order) {
  metrics.increment('orders.created', { 
    type: order.type,
    region: order.region 
  });
  metrics.gauge('orders.total_value', order.total);
  metrics.histogram('orders.item_count', order.items.length);
}

// Track feature usage
function trackFeatureUsage(feature: string, userId: string) {
  metrics.increment('features.used', { feature });
  analytics.track('feature.used', { feature, userId });
}
```

## Production Setup

### Initialization

```typescript
// tipstream.ts
import { TipStreamClient } from '@tipstream/sdk-core';
import { RequestSigner, AuditLogger } from '@tipstream/sdk-security';
import { MetricsCollector, WebhookReporter } from '@tipstream/sdk-metrics';
import { config } from './config';

// Initialize components
const signer = new RequestSigner({
  algorithm: 'hmac-sha256',
  secretKey: config.security.signingSecret
});

const auditLogger = new AuditLogger({
  storagePath: './logs/audit'
});

const metrics = new MetricsCollector({
  flushInterval: config.metrics.interval
});

if (config.metrics.enabled && config.metrics.endpoint) {
  metrics.addReporter(new WebhookReporter({
    url: config.metrics.endpoint
  }));
}

// Create client
export const tipstream = new TipStreamClient({
  baseUrl: config.api.url,
  apiKey: config.api.key,
  timeout: config.api.timeout,
  retries: config.api.retries,
  requestInterceptor: async (req) => {
    const timestamp = Date.now();
    return {
      ...req,
      headers: {
        ...req.headers,
        'X-Timestamp': timestamp.toString(),
        'X-Signature': signer.sign({ ...req, timestamp })
      }
    };
  }
});

// Setup event handlers
tipstream.on('error', (error) => {
  metrics.increment('tipstream.errors');
  auditLogger.log({
    action: 'api.error',
    actor: 'system',
    resource: 'tipstream',
    details: { error: error.message }
  });
});

// Start metrics
export function startTipStream() {
  metrics.start();
}

// Graceful shutdown
export async function stopTipStream() {
  await metrics.stop();
}
```

### Express.js Integration

```typescript
import express from 'express';
import { tipstream, startTipStream, stopTipStream } from './tipstream';

const app = express();

// Middleware for request tracking
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    metrics.timing('http.request_time', Date.now() - start, {
      method: req.method,
      path: req.path,
      status: res.statusCode.toString()
    });
  });
  next();
});

// API routes using TipStream
app.get('/api/users', async (req, res) => {
  const users = await tipstream.get('/users');
  res.json(users);
});

// Startup
startTipStream();
app.listen(3000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await stopTipStream();
  process.exit(0);
});
```

### Health Check

```typescript
app.get('/health', async (req, res) => {
  try {
    // Check TipStream connectivity
    await tipstream.get('/health');
    
    res.json({
      status: 'healthy',
      tipstream: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      tipstream: 'disconnected',
      error: error.message
    });
  }
});
```

## Best Practices

1. **Always use environment variables** for sensitive configuration
2. **Enable request signing** in production environments
3. **Set up metrics collection** for observability
4. **Implement proper error handling** with error types
5. **Use audit logging** for compliance and debugging
6. **Validate all inputs** before sending to API
7. **Implement graceful shutdown** for clean termination
8. **Monitor SDK metrics** for performance insights
