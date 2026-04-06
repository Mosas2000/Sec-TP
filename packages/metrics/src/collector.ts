/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'timing' | 'histogram';

/**
 * Metric tags for dimensional data
 */
export type MetricTags = Record<string, string | number | boolean>;

/**
 * Single metric data point
 */
export interface MetricPoint {
  /** Metric name */
  name: string;
  /** Metric type */
  type: MetricType;
  /** Metric value */
  value: number;
  /** Optional tags */
  tags?: MetricTags;
  /** Timestamp */
  timestamp: number;
}

/**
 * Aggregated metric data
 */
export interface AggregatedMetric {
  /** Metric name */
  name: string;
  /** Metric type */
  type: MetricType;
  /** Count of data points */
  count: number;
  /** Sum of values */
  sum: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Average value */
  avg: number;
  /** Last value (for gauges) */
  last: number;
  /** Tags */
  tags?: MetricTags;
  /** Start of aggregation period */
  startTime: number;
  /** End of aggregation period */
  endTime: number;
}

/**
 * Metrics report
 */
export interface MetricsReport {
  /** Application name */
  appName: string;
  /** Report timestamp */
  timestamp: string;
  /** Report period in milliseconds */
  period: number;
  /** Aggregated metrics */
  metrics: AggregatedMetric[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Reporter interface
 */
export interface MetricsReporter {
  /** Reporter name */
  name: string;
  /** Report metrics */
  report(report: MetricsReport): Promise<void>;
  /** Close reporter */
  close?(): Promise<void>;
}

/**
 * Metrics collector configuration
 */
export interface MetricsCollectorConfig {
  /** Application name */
  appName?: string;
  /** Flush interval in milliseconds */
  flushInterval?: number;
  /** Maximum buffer size before forced flush */
  maxBufferSize?: number;
  /** Default tags to add to all metrics */
  defaultTags?: MetricTags;
  /** Enable auto-flush */
  autoFlush?: boolean;
}

/**
 * Generate unique metric key with tags
 */
function metricKey(name: string, tags?: MetricTags): string {
  if (!tags || Object.keys(tags).length === 0) {
    return name;
  }
  const sortedTags = Object.entries(tags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  return `${name}|${sortedTags}`;
}

/**
 * Metrics Collector for gathering and aggregating metrics
 *
 * @example
 * ```typescript
 * const collector = new MetricsCollector({
 *   appName: 'my-app',
 *   flushInterval: 60000,
 * });
 *
 * collector.increment('requests.total');
 * collector.gauge('memory.heap', process.memoryUsage().heapUsed);
 * collector.timing('api.latency', 150);
 * ```
 */
export class MetricsCollector {
  private readonly config: Required<MetricsCollectorConfig>;
  private readonly reporters: MetricsReporter[] = [];
  private readonly buffer: Map<string, MetricPoint[]> = new Map();
  private flushTimer?: ReturnType<typeof setInterval>;
  private lastFlushTime: number = Date.now();

  constructor(config: MetricsCollectorConfig = {}) {
    this.config = {
      appName: config.appName ?? 'tipstream-sdk',
      flushInterval: config.flushInterval ?? 60000,
      maxBufferSize: config.maxBufferSize ?? 10000,
      defaultTags: config.defaultTags ?? {},
      autoFlush: config.autoFlush ?? true,
    };

    if (this.config.autoFlush) {
      this.startAutoFlush();
    }
  }

  /**
   * Add a reporter
   */
  public addReporter(reporter: MetricsReporter): void {
    this.reporters.push(reporter);
  }

  /**
   * Remove a reporter
   */
  public removeReporter(reporter: MetricsReporter): void {
    const index = this.reporters.indexOf(reporter);
    if (index !== -1) {
      this.reporters.splice(index, 1);
    }
  }

  /**
   * Increment a counter
   */
  public increment(name: string, value = 1, tags?: MetricTags): void {
    this.record({
      name,
      type: 'counter',
      value,
      tags: { ...this.config.defaultTags, ...tags },
      timestamp: Date.now(),
    });
  }

  /**
   * Decrement a counter
   */
  public decrement(name: string, value = 1, tags?: MetricTags): void {
    this.increment(name, -value, tags);
  }

  /**
   * Set a gauge value
   */
  public gauge(name: string, value: number, tags?: MetricTags): void {
    this.record({
      name,
      type: 'gauge',
      value,
      tags: { ...this.config.defaultTags, ...tags },
      timestamp: Date.now(),
    });
  }

  /**
   * Record a timing value
   */
  public timing(name: string, value: number, tags?: MetricTags): void {
    this.record({
      name,
      type: 'timing',
      value,
      tags: { ...this.config.defaultTags, ...tags },
      timestamp: Date.now(),
    });
  }

  /**
   * Record a histogram value
   */
  public histogram(name: string, value: number, tags?: MetricTags): void {
    this.record({
      name,
      type: 'histogram',
      value,
      tags: { ...this.config.defaultTags, ...tags },
      timestamp: Date.now(),
    });
  }

  /**
   * Time an async operation
   */
  public async time<T>(name: string, fn: () => Promise<T>, tags?: MetricTags): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.timing(name, Date.now() - start, { ...tags, success: true });
      return result;
    } catch (error) {
      this.timing(name, Date.now() - start, { ...tags, success: false });
      throw error;
    }
  }

  /**
   * Create a timer that can be stopped manually
   */
  public startTimer(name: string, tags?: MetricTags): () => number {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.timing(name, duration, tags);
      return duration;
    };
  }

  /**
   * Record a metric point
   */
  private record(point: MetricPoint): void {
    const key = metricKey(point.name, point.tags);
    
    if (!this.buffer.has(key)) {
      this.buffer.set(key, []);
    }
    
    this.buffer.get(key)!.push(point);

    // Check buffer size
    let totalSize = 0;
    for (const points of this.buffer.values()) {
      totalSize += points.length;
    }

    if (totalSize >= this.config.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Flush metrics to reporters
   */
  public async flush(): Promise<void> {
    const now = Date.now();
    const period = now - this.lastFlushTime;
    this.lastFlushTime = now;

    if (this.buffer.size === 0) {
      return;
    }

    // Aggregate metrics
    const aggregated: AggregatedMetric[] = [];

    for (const [key, points] of this.buffer.entries()) {
      if (points.length === 0) continue;

      const first = points[0]!;
      const values = points.map(p => p.value);

      aggregated.push({
        name: first.name,
        type: first.type,
        count: points.length,
        sum: values.reduce((a, b) => a + b, 0),
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        last: values[values.length - 1]!,
        tags: first.tags,
        startTime: Math.min(...points.map(p => p.timestamp)),
        endTime: Math.max(...points.map(p => p.timestamp)),
      });
    }

    // Clear buffer
    this.buffer.clear();

    // Create report
    const report: MetricsReport = {
      appName: this.config.appName,
      timestamp: new Date().toISOString(),
      period,
      metrics: aggregated,
    };

    // Send to reporters
    await Promise.all(
      this.reporters.map(async reporter => {
        try {
          await reporter.report(report);
        } catch (error) {
          console.error(`Metrics reporter ${reporter.name} failed:`, error);
        }
      })
    );
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(err => console.error('Auto-flush failed:', err));
    }, this.config.flushInterval);
  }

  /**
   * Stop auto-flush timer
   */
  public stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Get current buffer size
   */
  public getBufferSize(): number {
    let size = 0;
    for (const points of this.buffer.values()) {
      size += points.length;
    }
    return size;
  }

  /**
   * Close collector and flush remaining metrics
   */
  public async close(): Promise<void> {
    this.stopAutoFlush();
    await this.flush();

    for (const reporter of this.reporters) {
      if (reporter.close) {
        await reporter.close();
      }
    }
  }
}
