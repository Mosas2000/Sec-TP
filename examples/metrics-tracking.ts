/**
 * Metrics Tracking Example
 * 
 * This example demonstrates comprehensive metrics collection,
 * NPM download tracking, and analytics using the metrics package.
 */

import {
  MetricsCollector,
  ConsoleReporter,
  FileReporter,
  WebhookReporter,
  NpmTracker,
  DownloadTracker,
  Analytics,
  MetricsPersistence
} from '@tipstream/sdk-metrics';

// ============================================================
// 1. BASIC METRICS COLLECTION
// ============================================================

async function basicMetricsDemo() {
  console.log('=== Basic Metrics Collection ===\n');

  // Create collector with configuration
  const metrics = new MetricsCollector({
    flushInterval: 5000, // 5 seconds
    maxBufferSize: 100,
    defaultTags: {
      app: 'metrics-demo',
      version: '1.0.0'
    }
  });

  // Add console reporter for immediate feedback
  metrics.addReporter(new ConsoleReporter({
    prefix: '[Metrics]',
    format: 'text'
  }));

  // Start collection
  metrics.start();

  // Counter examples
  console.log('--- Counters ---');
  metrics.increment('http.requests');
  metrics.increment('http.requests', { method: 'GET', path: '/users' });
  metrics.increment('http.requests', { method: 'POST', path: '/users' }, 5);
  console.log('Incremented request counters');

  // Gauge examples
  console.log('\n--- Gauges ---');
  metrics.gauge('system.memory.used', process.memoryUsage().heapUsed);
  metrics.gauge('system.memory.total', process.memoryUsage().heapTotal);
  metrics.gauge('connections.active', 42, { server: 'main' });
  console.log('Set gauge values');

  // Timing examples
  console.log('\n--- Timings ---');
  const start = Date.now();
  await new Promise(resolve => setTimeout(resolve, 100));
  metrics.timing('operation.duration', Date.now() - start);
  metrics.timing('db.query', 25, { query: 'findUser' });
  metrics.timing('api.response', 150, { endpoint: '/users' });
  console.log('Recorded timings');

  // Histogram examples
  console.log('\n--- Histograms ---');
  metrics.histogram('request.size', 1024);
  metrics.histogram('response.size', 4096, { type: 'json' });
  for (let i = 0; i < 10; i++) {
    metrics.histogram('batch.size', Math.floor(Math.random() * 1000));
  }
  console.log('Recorded histogram values');

  // Manual flush
  console.log('\n--- Manual Flush ---');
  await metrics.flush();
  console.log('Metrics flushed');

  // Stop collector
  await metrics.stop();
  console.log('Collector stopped');
}

// ============================================================
// 2. MULTIPLE REPORTERS
// ============================================================

async function multipleReportersDemo() {
  console.log('\n=== Multiple Reporters Demo ===\n');

  const metrics = new MetricsCollector({
    flushInterval: 3000,
    defaultTags: { environment: 'demo' }
  });

  // Console reporter for development
  metrics.addReporter(new ConsoleReporter({
    prefix: '[Console]',
    format: 'json'
  }));

  // File reporter for persistence
  metrics.addReporter(new FileReporter({
    path: './demo-metrics.log',
    format: 'json',
    rotateSize: 1024 * 1024, // 1MB
    maxFiles: 3
  }));

  // Webhook reporter for remote collection (simulated)
  // Uncomment to test with actual endpoint
  /*
  metrics.addReporter(new WebhookReporter({
    url: 'https://metrics.example.com/ingest',
    headers: { 'Authorization': 'Bearer token' },
    batchSize: 50,
    retries: 3
  }));
  */

  metrics.start();

  // Generate some metrics
  for (let i = 0; i < 5; i++) {
    metrics.increment('demo.events', { index: i.toString() });
    metrics.timing('demo.latency', Math.random() * 100);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  await metrics.flush();
  await metrics.stop();

  console.log('Metrics sent to all reporters');
}

// ============================================================
// 3. NPM DOWNLOAD TRACKING
// ============================================================

async function npmTrackingDemo() {
  console.log('\n=== NPM Download Tracking ===\n');

  const tracker = new NpmTracker({
    packages: ['express', 'lodash', 'axios'],
    cacheDir: './npm-cache',
    cacheTTL: 60000 // 1 minute cache
  });

  // Track downloads for popular packages
  const packages = ['express', 'lodash', 'axios'];

  for (const pkg of packages) {
    console.log(`\n--- ${pkg} ---`);
    
    try {
      // Get download counts
      const lastDay = await tracker.getDownloads(pkg, 'last-day');
      const lastWeek = await tracker.getDownloads(pkg, 'last-week');
      const lastMonth = await tracker.getDownloads(pkg, 'last-month');

      console.log(`Last day: ${lastDay.toLocaleString()}`);
      console.log(`Last week: ${lastWeek.toLocaleString()}`);
      console.log(`Last month: ${lastMonth.toLocaleString()}`);

      // Get package info
      const info = await tracker.getPackageInfo(pkg);
      console.log(`Latest version: ${info?.version || 'unknown'}`);

      // Get trends
      const trends = await tracker.getDownloadTrends(pkg, 7);
      if (trends.length > 0) {
        console.log('7-day trend:', trends.map(t => t.downloads).join(' → '));
      }
    } catch (error) {
      console.error(`Error fetching ${pkg}:`, error.message);
    }
  }
}

// ============================================================
// 4. DOWNLOAD HISTORY TRACKING
// ============================================================

async function downloadHistoryDemo() {
  console.log('\n=== Download History Tracking ===\n');

  const downloadTracker = new DownloadTracker({
    storagePath: './download-history',
    packages: ['express', 'lodash']
  });

  // Record some downloads (simulating daily tracking)
  const packages = ['express', 'lodash'];
  
  console.log('Recording download data...');
  for (const pkg of packages) {
    // Simulate recording over several days
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      
      const downloads = Math.floor(100000 + Math.random() * 50000);
      await downloadTracker.record(pkg, 'last-day', downloads, date);
    }
  }
  console.log('Download data recorded');

  // Get history
  console.log('\n--- Download History ---');
  for (const pkg of packages) {
    const history = await downloadTracker.getHistory(pkg, {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    });

    console.log(`\n${pkg}:`);
    history.forEach(entry => {
      console.log(`  ${entry.date.toISOString().split('T')[0]}: ${entry.downloads.toLocaleString()}`);
    });

    // Calculate growth
    const growth = downloadTracker.calculateGrowth(pkg, 7);
    console.log(`  Growth (7 days): ${growth.percentage.toFixed(1)}%`);
  }
}

// ============================================================
// 5. ANALYTICS AND SESSION TRACKING
// ============================================================

async function analyticsDemo() {
  console.log('\n=== Analytics and Session Tracking ===\n');

  const analytics = new Analytics({
    sessionTimeout: 60000, // 1 minute for demo
    maxEventsPerSession: 1000
  });

  // Track various events
  console.log('Tracking user journey...\n');

  // Page views
  analytics.track('page.view', { page: '/home', referrer: 'google.com' });
  analytics.track('page.view', { page: '/products', referrer: '/home' });
  analytics.track('page.view', { page: '/products/123', referrer: '/products' });

  // User actions
  analytics.track('button.click', { button: 'add_to_cart', product: '123' });
  analytics.track('form.submit', { form: 'checkout', items: 3 });

  // Feature usage
  analytics.track('feature.used', { feature: 'search', query: 'widgets' });
  analytics.track('feature.used', { feature: 'filter', filters: ['price', 'color'] });

  // Simulate errors
  analytics.trackError(new Error('Payment gateway timeout'), {
    gateway: 'stripe',
    amount: 99.99
  });

  analytics.trackError(new Error('Validation failed'), {
    form: 'signup',
    field: 'email'
  });

  // Get session statistics
  console.log('--- Session Statistics ---');
  const stats = analytics.getSessionStats();
  console.log(`Session ID: ${stats.sessionId}`);
  console.log(`Duration: ${stats.duration}ms`);
  console.log(`Event count: ${stats.eventCount}`);
  console.log(`Error count: ${stats.errorCount}`);
  console.log(`First event: ${new Date(stats.firstEventTime).toISOString()}`);
  console.log(`Last event: ${new Date(stats.lastEventTime).toISOString()}`);

  // Get aggregated statistics
  console.log('\n--- Aggregated Statistics ---');
  const aggregated = analytics.getAggregatedStats();
  console.log(`Total sessions: ${aggregated.totalSessions}`);
  console.log(`Total events: ${aggregated.totalEvents}`);
  console.log(`Total errors: ${aggregated.totalErrors}`);
  console.log(`Error rate: ${aggregated.errorRate.toFixed(2)}%`);

  // Event breakdown
  console.log('\n--- Event Breakdown ---');
  const events = analytics.getEventsByType();
  Object.entries(events).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
}

// ============================================================
// 6. METRICS PERSISTENCE
// ============================================================

async function persistenceDemo() {
  console.log('\n=== Metrics Persistence ===\n');

  const persistence = new MetricsPersistence({
    filePath: './demo-metrics-data.json',
    autoSave: true,
    saveInterval: 5000
  });

  // Load existing data
  await persistence.load();
  console.log('Loaded existing data');

  // Store various metrics
  console.log('\n--- Storing Data ---');
  
  persistence.set('stats.totalRequests', 150000);
  persistence.set('stats.totalErrors', 250);
  persistence.set('stats.avgResponseTime', 45.7);
  persistence.set('stats.lastUpdated', new Date().toISOString());
  
  persistence.set('packages.@tipstream/sdk-core.downloads', 50000);
  persistence.set('packages.@tipstream/sdk-security.downloads', 30000);
  persistence.set('packages.@tipstream/sdk-metrics.downloads', 25000);

  console.log('Data stored');

  // Retrieve data
  console.log('\n--- Retrieving Data ---');
  console.log('Total requests:', persistence.get('stats.totalRequests'));
  console.log('Total errors:', persistence.get('stats.totalErrors'));
  console.log('Error rate:', 
    (persistence.get('stats.totalErrors') / persistence.get('stats.totalRequests') * 100).toFixed(2) + '%'
  );

  // Query with patterns
  console.log('\n--- Pattern Queries ---');
  
  const allStats = persistence.query('stats.*');
  console.log('All stats:', allStats);

  const allDownloads = persistence.query('packages.*.downloads');
  console.log('All downloads:', allDownloads);

  // Calculate totals
  const totalDownloads = Object.values(allDownloads).reduce((sum, val) => sum + (val as number), 0);
  console.log('Total SDK downloads:', totalDownloads.toLocaleString());

  // Save to disk
  await persistence.save();
  console.log('\nData saved to disk');
}

// ============================================================
// 7. COMPLETE METRICS WORKFLOW
// ============================================================

async function completeMetricsWorkflow() {
  console.log('\n=== Complete Metrics Workflow ===\n');
  console.log('Simulating a production metrics setup...\n');

  // Initialize all components
  const metrics = new MetricsCollector({
    flushInterval: 5000,
    defaultTags: {
      service: 'api-server',
      environment: 'demo',
      version: '2.1.0'
    }
  });

  const analytics = new Analytics({
    sessionTimeout: 1800000
  });

  const persistence = new MetricsPersistence({
    filePath: './workflow-metrics.json',
    autoSave: true
  });

  // Setup reporters
  metrics.addReporter(new ConsoleReporter({ prefix: '[API]' }));
  metrics.addReporter(new FileReporter({ 
    path: './workflow-metrics.log',
    format: 'json'
  }));

  // Start collection
  metrics.start();
  await persistence.load();

  // Simulate API traffic
  console.log('Simulating API traffic...\n');

  const endpoints = ['/users', '/products', '/orders', '/auth'];
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];

  for (let i = 0; i < 20; i++) {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const method = methods[Math.floor(Math.random() * methods.length)];
    const duration = Math.floor(Math.random() * 200) + 10;
    const status = Math.random() > 0.1 ? 200 : 500;

    // Record metrics
    metrics.increment('http.requests', { endpoint, method, status: status.toString() });
    metrics.timing('http.response_time', duration, { endpoint, method });
    
    if (status === 500) {
      metrics.increment('http.errors', { endpoint, method });
      analytics.trackError(new Error('Internal Server Error'), { endpoint, method });
    }

    // Track analytics
    analytics.track('api.call', { endpoint, method, duration, status });

    // Update persistence
    const key = `api.${endpoint.replace('/', '')}.${method.toLowerCase()}.count`;
    const current = persistence.get(key) || 0;
    persistence.set(key, current + 1);
  }

  // Flush and save
  await metrics.flush();
  await persistence.save();

  // Report summary
  console.log('\n--- Workflow Summary ---');
  
  const sessionStats = analytics.getSessionStats();
  console.log(`Events tracked: ${sessionStats.eventCount}`);
  console.log(`Errors tracked: ${sessionStats.errorCount}`);
  
  const apiStats = persistence.query('api.*');
  console.log('\nAPI call distribution:');
  Object.entries(apiStats).forEach(([key, count]) => {
    console.log(`  ${key}: ${count}`);
  });

  // Cleanup
  await metrics.stop();
  console.log('\nWorkflow complete');
}

// ============================================================
// RUN ALL DEMOS
// ============================================================

async function main() {
  try {
    await basicMetricsDemo();
    await multipleReportersDemo();
    await npmTrackingDemo();
    await downloadHistoryDemo();
    await analyticsDemo();
    await persistenceDemo();
    await completeMetricsWorkflow();

    console.log('\n=== All Metrics Demos Complete ===');
  } catch (error) {
    console.error('Demo error:', error);
  }
}

main();
