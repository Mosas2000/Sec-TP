/**
 * Analytics event
 */
export interface AnalyticsEvent {
  /** Event name */
  name: string;
  /** Event category */
  category?: string;
  /** Event properties */
  properties?: Record<string, unknown>;
  /** Event timestamp */
  timestamp: number;
  /** Session ID */
  sessionId?: string;
  /** User ID */
  userId?: string;
}

/**
 * Error tracking data
 */
export interface TrackedError {
  /** Error message */
  message: string;
  /** Error name/type */
  name: string;
  /** Stack trace */
  stack?: string;
  /** Context when error occurred */
  context?: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
  /** Session ID */
  sessionId?: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Operation name */
  operation: string;
  /** Duration in milliseconds */
  duration: number;
  /** Whether operation succeeded */
  success: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
}

/**
 * Analytics session
 */
export interface AnalyticsSession {
  /** Session ID */
  id: string;
  /** Session start time */
  startTime: number;
  /** Last activity time */
  lastActivity: number;
  /** Event count */
  eventCount: number;
  /** Error count */
  errorCount: number;
  /** User ID if identified */
  userId?: string;
  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  /** Enable event tracking */
  trackEvents?: boolean;
  /** Enable error tracking */
  trackErrors?: boolean;
  /** Enable performance tracking */
  trackPerformance?: boolean;
  /** Session timeout in milliseconds */
  sessionTimeout?: number;
  /** Maximum events to buffer */
  maxBufferSize?: number;
  /** Flush interval in milliseconds */
  flushInterval?: number;
  /** Event callback */
  onEvent?: (event: AnalyticsEvent) => void;
  /** Error callback */
  onError?: (error: TrackedError) => void;
  /** Flush callback */
  onFlush?: (events: AnalyticsEvent[], errors: TrackedError[]) => void;
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Analytics engine for tracking SDK usage
 *
 * @example
 * ```typescript
 * const analytics = new Analytics({
 *   trackEvents: true,
 *   trackErrors: true,
 *   trackPerformance: true,
 * });
 *
 * analytics.track('sdk.initialized', { version: '1.0.0' });
 * analytics.trackError(new Error('API failed'));
 * ```
 */
export class Analytics {
  private readonly config: Required<Omit<AnalyticsConfig, 'onEvent' | 'onError' | 'onFlush'>> & 
    Pick<AnalyticsConfig, 'onEvent' | 'onError' | 'onFlush'>;
  
  private session: AnalyticsSession;
  private eventBuffer: AnalyticsEvent[] = [];
  private errorBuffer: TrackedError[] = [];
  private performanceBuffer: PerformanceMetrics[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor(config: AnalyticsConfig = {}) {
    this.config = {
      trackEvents: config.trackEvents ?? true,
      trackErrors: config.trackErrors ?? true,
      trackPerformance: config.trackPerformance ?? true,
      sessionTimeout: config.sessionTimeout ?? 30 * 60 * 1000, // 30 minutes
      maxBufferSize: config.maxBufferSize ?? 1000,
      flushInterval: config.flushInterval ?? 60000, // 1 minute
      onEvent: config.onEvent,
      onError: config.onError,
      onFlush: config.onFlush,
    };

    this.session = this.createSession();
    this.startAutoFlush();
  }

  /**
   * Track an event
   */
  public track(name: string, properties?: Record<string, unknown>, category?: string): void {
    if (!this.config.trackEvents) return;

    this.updateSession();

    const event: AnalyticsEvent = {
      name,
      category,
      properties,
      timestamp: Date.now(),
      sessionId: this.session.id,
      userId: this.session.userId,
    };

    this.eventBuffer.push(event);
    this.session.eventCount++;

    if (this.config.onEvent) {
      this.config.onEvent(event);
    }

    this.checkBufferSize();
  }

  /**
   * Track an error
   */
  public trackError(error: Error, context?: Record<string, unknown>): void {
    if (!this.config.trackErrors) return;

    this.updateSession();

    const tracked: TrackedError = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      context,
      timestamp: Date.now(),
      sessionId: this.session.id,
    };

    this.errorBuffer.push(tracked);
    this.session.errorCount++;

    if (this.config.onError) {
      this.config.onError(tracked);
    }

    this.checkBufferSize();
  }

  /**
   * Track performance
   */
  public trackPerformance(
    operation: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.config.trackPerformance) return;

    const metrics: PerformanceMetrics = {
      operation,
      duration,
      success,
      metadata,
      timestamp: Date.now(),
    };

    this.performanceBuffer.push(metrics);
    this.checkBufferSize();
  }

  /**
   * Time an async operation
   */
  public async time<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.trackPerformance(operation, Date.now() - start, true, metadata);
      return result;
    } catch (error) {
      this.trackPerformance(operation, Date.now() - start, false, metadata);
      if (error instanceof Error) {
        this.trackError(error, { operation, ...metadata });
      }
      throw error;
    }
  }

  /**
   * Identify user
   */
  public identify(userId: string, traits?: Record<string, unknown>): void {
    this.session.userId = userId;
    this.track('user.identified', { userId, ...traits }, 'user');
  }

  /**
   * Reset user identity
   */
  public reset(): void {
    this.session = this.createSession();
    this.track('session.reset', undefined, 'session');
  }

  /**
   * Get current session
   */
  public getSession(): AnalyticsSession {
    return { ...this.session };
  }

  /**
   * Get buffered events
   */
  public getEvents(): AnalyticsEvent[] {
    return [...this.eventBuffer];
  }

  /**
   * Get buffered errors
   */
  public getErrors(): TrackedError[] {
    return [...this.errorBuffer];
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics[] {
    return [...this.performanceBuffer];
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): Map<string, {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
  }> {
    const summary = new Map<string, {
      count: number;
      totalDuration: number;
      minDuration: number;
      maxDuration: number;
      successCount: number;
    }>();

    for (const metric of this.performanceBuffer) {
      const existing = summary.get(metric.operation);
      
      if (existing) {
        existing.count++;
        existing.totalDuration += metric.duration;
        existing.minDuration = Math.min(existing.minDuration, metric.duration);
        existing.maxDuration = Math.max(existing.maxDuration, metric.duration);
        if (metric.success) existing.successCount++;
      } else {
        summary.set(metric.operation, {
          count: 1,
          totalDuration: metric.duration,
          minDuration: metric.duration,
          maxDuration: metric.duration,
          successCount: metric.success ? 1 : 0,
        });
      }
    }

    // Convert to final format
    const result = new Map<string, {
      count: number;
      avgDuration: number;
      minDuration: number;
      maxDuration: number;
      successRate: number;
    }>();

    for (const [operation, data] of summary) {
      result.set(operation, {
        count: data.count,
        avgDuration: Math.round(data.totalDuration / data.count),
        minDuration: data.minDuration,
        maxDuration: data.maxDuration,
        successRate: Math.round((data.successCount / data.count) * 100),
      });
    }

    return result;
  }

  /**
   * Flush all buffers
   */
  public async flush(): Promise<void> {
    const events = [...this.eventBuffer];
    const errors = [...this.errorBuffer];

    this.eventBuffer = [];
    this.errorBuffer = [];
    this.performanceBuffer = [];

    if (this.config.onFlush && (events.length > 0 || errors.length > 0)) {
      this.config.onFlush(events, errors);
    }
  }

  /**
   * Create new session
   */
  private createSession(): AnalyticsSession {
    return {
      id: generateId(),
      startTime: Date.now(),
      lastActivity: Date.now(),
      eventCount: 0,
      errorCount: 0,
    };
  }

  /**
   * Update session activity
   */
  private updateSession(): void {
    const now = Date.now();
    
    // Check if session timed out
    if (now - this.session.lastActivity > this.config.sessionTimeout) {
      const oldSession = this.session;
      this.session = this.createSession();
      this.track('session.timeout', { 
        previousSessionId: oldSession.id,
        duration: oldSession.lastActivity - oldSession.startTime,
      }, 'session');
    }

    this.session.lastActivity = now;
  }

  /**
   * Check buffer size and flush if needed
   */
  private checkBufferSize(): void {
    const totalSize = this.eventBuffer.length + this.errorBuffer.length + this.performanceBuffer.length;
    
    if (totalSize >= this.config.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
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
   * Close analytics and flush remaining data
   */
  public async close(): Promise<void> {
    this.stopAutoFlush();
    await this.flush();
  }
}

/**
 * Create a scoped analytics instance with preset properties
 */
export function createScopedAnalytics(
  analytics: Analytics,
  scope: string,
  defaultProperties?: Record<string, unknown>
): {
  track: (name: string, properties?: Record<string, unknown>) => void;
  trackError: (error: Error, context?: Record<string, unknown>) => void;
} {
  return {
    track: (name: string, properties?: Record<string, unknown>) => {
      analytics.track(`${scope}.${name}`, { ...defaultProperties, ...properties }, scope);
    },
    trackError: (error: Error, context?: Record<string, unknown>) => {
      analytics.trackError(error, { scope, ...defaultProperties, ...context });
    },
  };
}
