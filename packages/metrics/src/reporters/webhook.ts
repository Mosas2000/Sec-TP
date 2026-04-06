import type { MetricsReport, MetricsReporter } from '../collector.js';

/**
 * Webhook reporter configuration
 */
export interface WebhookReporterConfig {
  /** Webhook URL */
  url: string;
  /** HTTP method */
  method?: 'POST' | 'PUT';
  /** Custom headers */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retries on failure */
  retries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Transform report before sending */
  transform?: (report: MetricsReport) => unknown;
  /** Batch multiple reports */
  batch?: boolean;
  /** Batch size before sending */
  batchSize?: number;
}

/**
 * Webhook Reporter - sends metrics to HTTP endpoint
 *
 * @example
 * ```typescript
 * const reporter = new WebhookReporter({
 *   url: 'https://metrics.example.com/ingest',
 *   headers: { 'Authorization': 'Bearer token' },
 * });
 * collector.addReporter(reporter);
 * ```
 */
export class WebhookReporter implements MetricsReporter {
  public readonly name = 'webhook';
  private readonly config: Required<Omit<WebhookReporterConfig, 'transform'>> & 
    Pick<WebhookReporterConfig, 'transform'>;
  private batch: MetricsReport[] = [];
  private flushTimer?: ReturnType<typeof setTimeout>;

  constructor(config: WebhookReporterConfig) {
    this.config = {
      url: config.url,
      method: config.method ?? 'POST',
      headers: config.headers ?? {},
      timeout: config.timeout ?? 10000,
      retries: config.retries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      transform: config.transform,
      batch: config.batch ?? false,
      batchSize: config.batchSize ?? 10,
    };
  }

  public async report(report: MetricsReport): Promise<void> {
    if (this.config.batch) {
      this.batch.push(report);
      
      if (this.batch.length >= this.config.batchSize) {
        await this.sendBatch();
      } else {
        // Schedule batch send
        this.scheduleBatchSend();
      }
    } else {
      await this.send(report);
    }
  }

  private scheduleBatchSend(): void {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(async () => {
      this.flushTimer = undefined;
      await this.sendBatch();
    }, 5000); // 5 second delay for batching
  }

  private async sendBatch(): Promise<void> {
    if (this.batch.length === 0) return;

    const reports = [...this.batch];
    this.batch = [];

    const payload = this.config.transform
      ? reports.map(r => this.config.transform!(r))
      : reports;

    await this.sendWithRetry(payload);
  }

  private async send(report: MetricsReport): Promise<void> {
    const payload = this.config.transform
      ? this.config.transform(report)
      : report;

    await this.sendWithRetry(payload);
  }

  private async sendWithRetry(payload: unknown): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        await this.sendRequest(payload);
        return;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.retries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('Webhook reporter failed after retries:', lastError);
  }

  private async sendRequest(payload: unknown): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.url, {
        method: this.config.method,
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Send any remaining batched reports
    if (this.batch.length > 0) {
      await this.sendBatch();
    }
  }
}
