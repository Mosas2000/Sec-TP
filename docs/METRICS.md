# Metrics Guide

Complete guide to using the @tipstream/sdk-metrics package for observability and analytics.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Metric Types](#metric-types)
- [Reporters](#reporters)
- [NPM Download Tracking](#npm-download-tracking)
- [Analytics](#analytics)
- [Persistence](#persistence)
- [Best Practices](#best-practices)

## Installation

```bash
npm install @tipstream/sdk-metrics
```

## Quick Start

```typescript
import { 
  MetricsCollector, 
  ConsoleReporter,
  FileReporter 
} from '@tipstream/sdk-metrics';

// Create collector
const metrics = new MetricsCollector({
  flushInterval: 10000,  // Flush every 10 seconds
  defaultTags: {
    app: 'my-app',
    environment: process.env.NODE_ENV
  }
});

// Add reporters
metrics.addReporter(new ConsoleReporter());
metrics.addReporter(new FileReporter({ path: './metrics.log' }));

// Start collecting
metrics.start();

// Record metrics
metrics.increment('api.requests', { endpoint: '/users' });
metrics.timing('api.response_time', 150, { endpoint: '/users' });

// Stop when done
await metrics.stop();
```

## Metric Types

### Counters

Counters track cumulative values that only increase.

```typescript
// Simple increment
metrics.increment('requests.total');

// Increment with tags
metrics.increment('requests.total', { 
  method: 'GET',
  endpoint: '/users',
  status: '200'
});

// Increment by specific value
metrics.increment('items.processed', {}, 100);
```

**Use cases:**
- Request counts
- Error counts
- Items processed
- Events occurred

### Gauges

Gauges track values that can go up or down.

```typescript
// Set current value
metrics.gauge('memory.used', process.memoryUsage().heapUsed);
metrics.gauge('connections.active', 42);

// With tags
metrics.gauge('queue.size', 150, { queue: 'emails' });
```

**Use cases:**
- Memory usage
- Active connections
- Queue sizes
- Temperature readings

### Timings

Timings track durations of operations.

```typescript
// Record a duration
metrics.timing('api.response_time', 150); // milliseconds

// With tags
metrics.timing('db.query_time', 25, { 
  query: 'findUser',
  database: 'users'
});

// Measure with helper
const start = Date.now();
await doSomething();
metrics.timing('operation.duration', Date.now() - start);
```

**Use cases:**
- API response times
- Database query times
- Function execution times
- External service latency

### Histograms

Histograms track distribution of values.

```typescript
// Record values
metrics.histogram('request.size', 1024);
metrics.histogram('response.size', 4096, { endpoint: '/data' });

// Track user counts
metrics.histogram('user.age', 25);
```

**Use cases:**
- Request/response sizes
- User demographics
- Price distributions
- Processing batch sizes

## Reporters

### ConsoleReporter

Outputs metrics to the console.

```typescript
import { ConsoleReporter } from '@tipstream/sdk-metrics';

const reporter = new ConsoleReporter({
  prefix: '[metrics]',    // Prefix for log lines
  format: 'text'          // 'text' or 'json'
});

metrics.addReporter(reporter);
```

**Output Examples:**

Text format:
```
[metrics] counter api.requests endpoint=/users value=1
[metrics] timing api.response_time endpoint=/users value=150ms
```

JSON format:
```json
{"type":"counter","name":"api.requests","tags":{"endpoint":"/users"},"value":1}
```

### FileReporter

Writes metrics to files with rotation support.

```typescript
import { FileReporter } from '@tipstream/sdk-metrics';

const reporter = new FileReporter({
  path: './logs/metrics.log',
  format: 'json',           // 'text', 'json', or 'csv'
  rotateSize: 10 * 1024 * 1024,  // 10MB
  maxFiles: 5               // Keep 5 rotated files
});

metrics.addReporter(reporter);
```

**File Rotation:**

When the file reaches `rotateSize`:
1. `metrics.log` → `metrics.log.1`
2. `metrics.log.1` → `metrics.log.2`
3. Files beyond `maxFiles` are deleted

### WebhookReporter

Sends metrics to an HTTP endpoint.

```typescript
import { WebhookReporter } from '@tipstream/sdk-metrics';

const reporter = new WebhookReporter({
  url: 'https://metrics.example.com/ingest',
  headers: {
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json'
  },
  batchSize: 100,    // Send in batches of 100
  retries: 3,        // Retry failed requests
  retryDelay: 1000   // Wait between retries
});

metrics.addReporter(reporter);
```

**Request Format:**

```json
{
  "metrics": [
    {
      "type": "counter",
      "name": "api.requests",
      "value": 1,
      "tags": { "endpoint": "/users" },
      "timestamp": 1234567890
    }
  ]
}
```

### Custom Reporters

Implement the Reporter interface:

```typescript
import { Reporter, MetricData } from '@tipstream/sdk-metrics';

class DatadogReporter implements Reporter {
  async report(metrics: MetricData[]): Promise<void> {
    const payload = metrics.map(m => this.transform(m));
    await fetch('https://api.datadoghq.com/api/v1/series', {
      method: 'POST',
      headers: { 'DD-API-KEY': this.apiKey },
      body: JSON.stringify({ series: payload })
    });
  }

  private transform(metric: MetricData) {
    return {
      metric: metric.name,
      points: [[metric.timestamp, metric.value]],
      tags: Object.entries(metric.tags).map(([k, v]) => `${k}:${v}`)
    };
  }
}

metrics.addReporter(new DatadogReporter());
```

## NPM Download Tracking

Track package downloads from the npm registry.

```typescript
import { NpmTracker } from '@tipstream/sdk-metrics';

const tracker = new NpmTracker({
  packages: [
    '@tipstream/sdk-core',
    '@tipstream/sdk-security',
    '@tipstream/sdk-metrics'
  ],
  cacheDir: './cache',
  cacheTTL: 3600000  // 1 hour cache
});

// Get download counts
const total = await tracker.getDownloads('@tipstream/sdk-core');
const weekly = await tracker.getDownloads('@tipstream/sdk-core', 'last-week');
const monthly = await tracker.getDownloads('@tipstream/sdk-core', 'last-month');

console.log(`Total: ${total}, Weekly: ${weekly}, Monthly: ${monthly}`);

// Get download trends (30 days)
const trends = await tracker.getDownloadTrends('@tipstream/sdk-core', 30);
// [{ date: '2024-01-01', downloads: 100 }, ...]

// Get package info
const info = await tracker.getPackageInfo('@tipstream/sdk-core');
console.log(`Latest version: ${info.version}`);
```

### Download Tracker

Track historical download data:

```typescript
import { DownloadTracker } from '@tipstream/sdk-metrics';

const downloadTracker = new DownloadTracker({
  storagePath: './download-history',
  packages: ['@tipstream/sdk-core']
});

// Record downloads
await downloadTracker.record('@tipstream/sdk-core', 'last-day', 1000);

// Get history
const history = await downloadTracker.getHistory('@tipstream/sdk-core', {
  startDate: new Date('2024-01-01'),
  endDate: new Date()
});

// Calculate growth
const growth = downloadTracker.calculateGrowth('@tipstream/sdk-core', 30);
console.log(`30-day growth: ${growth.percentage}%`);
```

## Analytics

Track usage patterns and sessions.

```typescript
import { Analytics } from '@tipstream/sdk-metrics';

const analytics = new Analytics({
  sessionTimeout: 1800000,  // 30 minutes
  maxEventsPerSession: 1000
});

// Track custom events
analytics.track('feature.used', {
  feature: 'encryption',
  duration: 150,
  success: true
});

// Track errors
try {
  await riskyOperation();
} catch (error) {
  analytics.trackError(error, {
    operation: 'riskyOperation',
    input: sanitizedInput
  });
}

// Get session statistics
const stats = analytics.getSessionStats();
console.log(`
  Session ID: ${stats.sessionId}
  Duration: ${stats.duration}ms
  Events: ${stats.eventCount}
  Errors: ${stats.errorCount}
`);

// Get aggregated stats
const aggregated = analytics.getAggregatedStats();
console.log(`
  Total sessions: ${aggregated.totalSessions}
  Total events: ${aggregated.totalEvents}
  Error rate: ${aggregated.errorRate}%
`);
```

## Persistence

Store metrics data in JSON files.

```typescript
import { MetricsPersistence } from '@tipstream/sdk-metrics';

const persistence = new MetricsPersistence({
  filePath: './data/metrics.json',
  autoSave: true,
  saveInterval: 60000  // Save every minute
});

// Store data
persistence.set('downloads.total', 50000);
persistence.set('downloads.weekly', 1200);
persistence.set('downloads.monthly', 5000);
persistence.set('last_updated', new Date().toISOString());

// Retrieve data
const total = persistence.get('downloads.total');
const lastUpdated = persistence.get('last_updated');

// Query with patterns
const allDownloads = persistence.query('downloads.*');
// { total: 50000, weekly: 1200, monthly: 5000 }

// Delete data
persistence.delete('downloads.weekly');

// Manual save
await persistence.save();

// Load from disk
await persistence.load();
```

### Data Migration

The persistence layer supports schema versioning:

```typescript
const persistence = new MetricsPersistence({
  filePath: './data/metrics.json',
  schemaVersion: 2,
  migrate: (data, fromVersion) => {
    if (fromVersion === 1) {
      // Migrate from v1 to v2
      return {
        ...data,
        downloads: {
          total: data.totalDownloads,
          breakdown: {}
        }
      };
    }
    return data;
  }
});
```

## Best Practices

### 1. Use Meaningful Names

```typescript
// Good
metrics.increment('http.requests', { method: 'GET', status: '200' });
metrics.timing('db.query.duration', queryTime, { table: 'users' });

// Bad
metrics.increment('req');
metrics.timing('time', queryTime);
```

### 2. Limit Tag Cardinality

```typescript
// Good - bounded values
metrics.increment('api.requests', { 
  endpoint: '/users',  // Known set of endpoints
  method: 'GET'        // Limited HTTP methods
});

// Bad - unbounded values (will explode cardinality)
metrics.increment('api.requests', { 
  userId: user.id,     // Unique per user!
  timestamp: Date.now() // Unique per request!
});
```

### 3. Batch Operations

```typescript
// Good - single timing for batch
const start = Date.now();
const results = await Promise.all(items.map(processItem));
metrics.timing('batch.process_time', Date.now() - start);
metrics.increment('batch.items_processed', {}, items.length);

// Inefficient - timing each item
for (const item of items) {
  const start = Date.now();
  await processItem(item);
  metrics.timing('item.process_time', Date.now() - start);
}
```

### 4. Handle Errors

```typescript
const metrics = new MetricsCollector();

// Add error handling reporter
metrics.addReporter({
  async report(data) {
    try {
      await sendToBackend(data);
    } catch (error) {
      console.error('Failed to report metrics:', error);
      // Don't throw - don't crash the app for metrics
    }
  }
});
```

### 5. Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  
  // Flush remaining metrics
  await metrics.stop();
  
  process.exit(0);
});
```

### 6. Environment-Specific Configuration

```typescript
const metrics = new MetricsCollector({
  flushInterval: process.env.NODE_ENV === 'production' 
    ? 30000  // 30s in production
    : 5000,  // 5s in development
  defaultTags: {
    environment: process.env.NODE_ENV,
    service: 'my-service',
    version: process.env.npm_package_version
  }
});

if (process.env.NODE_ENV === 'production') {
  metrics.addReporter(new WebhookReporter({
    url: process.env.METRICS_ENDPOINT
  }));
} else {
  metrics.addReporter(new ConsoleReporter());
}
```

## Troubleshooting

### Metrics Not Appearing

1. Check that `start()` was called
2. Verify flush interval hasn't elapsed yet
3. Confirm reporters are added correctly
4. Check reporter error logs

### High Memory Usage

1. Reduce `maxBufferSize`
2. Decrease `flushInterval`
3. Check for tag cardinality issues
4. Verify reporters are completing

### Missing Download Data

1. Check npm API rate limits
2. Verify package names are correct
3. Check cache directory permissions
4. Review network connectivity
