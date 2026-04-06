# @tipstream/sdk-metrics

Metrics collection and NPM download tracking for the TipStream SDK.

## Installation

```bash
npm install @tipstream/sdk-metrics
```

## Features

- 📊 **Metrics Collection** - Collect and aggregate SDK usage metrics
- 📈 **NPM Tracking** - Track package downloads from npm registry
- 📉 **Analytics** - Usage analytics, error tracking, performance metrics
- 📝 **Multiple Reporters** - Console, file, webhook outputs

## Usage

### Basic Metrics Collection

```typescript
import { MetricsCollector } from '@tipstream/sdk-metrics';

const collector = new MetricsCollector({
  appName: 'my-app',
  flushInterval: 60000, // 1 minute
});

// Record metrics
collector.increment('api.requests');
collector.gauge('memory.usage', process.memoryUsage().heapUsed);
collector.timing('api.latency', 150);

// Record with tags
collector.increment('api.requests', 1, { endpoint: '/users', method: 'GET' });
```

### NPM Download Tracking

```typescript
import { NpmTracker } from '@tipstream/sdk-metrics';

const tracker = new NpmTracker({
  packages: ['@tipstream/sdk-core', '@tipstream/sdk-security'],
});

// Get download stats
const stats = await tracker.getDownloads('last-week');
console.log(stats);
// { '@tipstream/sdk-core': { downloads: 1234, ... }, ... }

// Get historical data
const history = await tracker.getDownloadHistory('last-month');
```

### Analytics

```typescript
import { Analytics } from '@tipstream/sdk-metrics';

const analytics = new Analytics({
  trackErrors: true,
  trackPerformance: true,
});

// Track events
analytics.track('sdk.initialized', { version: '1.0.0' });
analytics.track('api.call', { endpoint: '/users', duration: 150 });

// Track errors
analytics.trackError(new Error('API failed'), { endpoint: '/users' });
```

### Reporters

```typescript
import { MetricsCollector, ConsoleReporter, FileReporter, WebhookReporter } from '@tipstream/sdk-metrics';

const collector = new MetricsCollector();

// Add console reporter
collector.addReporter(new ConsoleReporter());

// Add file reporter
collector.addReporter(new FileReporter({ path: './metrics.json' }));

// Add webhook reporter
collector.addReporter(new WebhookReporter({
  url: 'https://metrics.example.com/ingest',
  headers: { 'Authorization': 'Bearer token' },
}));
```

## License

MIT
