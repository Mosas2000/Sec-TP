/**
 * @tipstream/sdk-metrics
 *
 * Metrics collection, NPM download tracking, and analytics
 * for TipStream SDK.
 *
 * @packageDocumentation
 */

// Metrics Collector
export { MetricsCollector } from './collector.js';

export type {
  MetricType,
  MetricTags,
  MetricPoint,
  AggregatedMetric,
  MetricsReport,
  MetricsReporter,
  MetricsCollectorConfig,
} from './collector.js';

// NPM Tracker
export { NpmTracker } from './npm-tracker.js';

export type {
  DownloadPeriod,
  DailyDownload,
  PackageDownloads,
  PackageMetadata,
  DownloadTrend,
  NpmTrackerConfig,
} from './npm-tracker.js';

// Download Tracker
export { DownloadTracker } from './download-tracker.js';

export type {
  DownloadRecord,
  DownloadHistory,
  DownloadTrackerConfig,
} from './download-tracker.js';

// Analytics
export { Analytics, createScopedAnalytics } from './analytics.js';

export type {
  AnalyticsEvent,
  TrackedError,
  PerformanceMetrics,
  AnalyticsSession,
  AnalyticsConfig,
} from './analytics.js';

// Persistence
export { MetricsPersistence } from './persistence.js';

export type {
  PersistenceData,
  PersistenceConfig,
} from './persistence.js';

// Reporters
export {
  ConsoleReporter,
  FileReporter,
  WebhookReporter,
} from './reporters/index.js';

export type {
  ConsoleReporterConfig,
  FileReporterConfig,
  WebhookReporterConfig,
} from './reporters/index.js';

/**
 * SDK Version
 */
export const VERSION = '1.0.0-alpha.0';
