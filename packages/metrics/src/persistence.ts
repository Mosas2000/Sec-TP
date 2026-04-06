import type { MetricsReport } from './collector.js';
import type { DownloadRecord } from './download-tracker.js';
import type { AnalyticsEvent, TrackedError } from './analytics.js';

/**
 * Persistence data structure
 */
export interface PersistenceData {
  /** Schema version */
  version: number;
  /** Last update timestamp */
  updatedAt: string;
  /** Metrics reports */
  reports: MetricsReport[];
  /** Download records */
  downloads: Record<string, DownloadRecord[]>;
  /** Analytics events */
  events: AnalyticsEvent[];
  /** Tracked errors */
  errors: TrackedError[];
  /** Custom data */
  custom?: Record<string, unknown>;
}

/**
 * Persistence configuration
 */
export interface PersistenceConfig {
  /** Storage directory path */
  storagePath: string;
  /** Maximum reports to keep */
  maxReports?: number;
  /** Maximum events to keep */
  maxEvents?: number;
  /** Maximum errors to keep */
  maxErrors?: number;
  /** Data retention period in days */
  retentionDays?: number;
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number;
}

/**
 * Current schema version
 */
const SCHEMA_VERSION = 1;

/**
 * Metrics Persistence Layer for storing and loading metrics data
 *
 * @example
 * ```typescript
 * const persistence = new MetricsPersistence({
 *   storagePath: './metrics-data',
 * });
 *
 * await persistence.saveReport(report);
 * const history = await persistence.getReports();
 * ```
 */
export class MetricsPersistence {
  private readonly config: Required<PersistenceConfig>;
  private data: PersistenceData;
  private loaded = false;
  private dirty = false;
  private autoSaveTimer?: ReturnType<typeof setInterval>;

  constructor(config: PersistenceConfig) {
    this.config = {
      storagePath: config.storagePath,
      maxReports: config.maxReports ?? 1000,
      maxEvents: config.maxEvents ?? 10000,
      maxErrors: config.maxErrors ?? 1000,
      retentionDays: config.retentionDays ?? 90,
      autoSaveInterval: config.autoSaveInterval ?? 60000,
    };

    this.data = this.createEmptyData();
  }

  /**
   * Initialize persistence (load data and start auto-save)
   */
  public async initialize(): Promise<void> {
    await this.load();
    this.startAutoSave();
  }

  /**
   * Save a metrics report
   */
  public async saveReport(report: MetricsReport): Promise<void> {
    await this.ensureLoaded();

    this.data.reports.push(report);
    this.trimReports();
    this.markDirty();
  }

  /**
   * Save download records
   */
  public async saveDownloads(packageName: string, records: DownloadRecord[]): Promise<void> {
    await this.ensureLoaded();

    this.data.downloads[packageName] = records;
    this.markDirty();
  }

  /**
   * Save analytics events
   */
  public async saveEvents(events: AnalyticsEvent[]): Promise<void> {
    await this.ensureLoaded();

    this.data.events.push(...events);
    this.trimEvents();
    this.markDirty();
  }

  /**
   * Save tracked errors
   */
  public async saveErrors(errors: TrackedError[]): Promise<void> {
    await this.ensureLoaded();

    this.data.errors.push(...errors);
    this.trimErrors();
    this.markDirty();
  }

  /**
   * Save custom data
   */
  public async saveCustom(key: string, value: unknown): Promise<void> {
    await this.ensureLoaded();

    if (!this.data.custom) {
      this.data.custom = {};
    }
    this.data.custom[key] = value;
    this.markDirty();
  }

  /**
   * Get metrics reports
   */
  public async getReports(limit?: number): Promise<MetricsReport[]> {
    await this.ensureLoaded();

    if (limit) {
      return this.data.reports.slice(-limit);
    }
    return [...this.data.reports];
  }

  /**
   * Get download records for a package
   */
  public async getDownloads(packageName: string): Promise<DownloadRecord[]> {
    await this.ensureLoaded();
    return this.data.downloads[packageName] ?? [];
  }

  /**
   * Get all download records
   */
  public async getAllDownloads(): Promise<Record<string, DownloadRecord[]>> {
    await this.ensureLoaded();
    return { ...this.data.downloads };
  }

  /**
   * Get analytics events
   */
  public async getEvents(limit?: number): Promise<AnalyticsEvent[]> {
    await this.ensureLoaded();

    if (limit) {
      return this.data.events.slice(-limit);
    }
    return [...this.data.events];
  }

  /**
   * Get tracked errors
   */
  public async getErrors(limit?: number): Promise<TrackedError[]> {
    await this.ensureLoaded();

    if (limit) {
      return this.data.errors.slice(-limit);
    }
    return [...this.data.errors];
  }

  /**
   * Get custom data
   */
  public async getCustom<T>(key: string): Promise<T | undefined> {
    await this.ensureLoaded();
    return this.data.custom?.[key] as T | undefined;
  }

  /**
   * Get storage statistics
   */
  public async getStats(): Promise<{
    reportCount: number;
    eventCount: number;
    errorCount: number;
    downloadPackages: number;
    totalDownloadRecords: number;
    lastUpdate: string;
  }> {
    await this.ensureLoaded();

    let totalDownloadRecords = 0;
    for (const records of Object.values(this.data.downloads)) {
      totalDownloadRecords += records.length;
    }

    return {
      reportCount: this.data.reports.length,
      eventCount: this.data.events.length,
      errorCount: this.data.errors.length,
      downloadPackages: Object.keys(this.data.downloads).length,
      totalDownloadRecords,
      lastUpdate: this.data.updatedAt,
    };
  }

  /**
   * Clear all data
   */
  public async clear(): Promise<void> {
    this.data = this.createEmptyData();
    this.markDirty();
    await this.save();
  }

  /**
   * Force save
   */
  public async flush(): Promise<void> {
    if (this.dirty) {
      await this.save();
    }
  }

  /**
   * Close persistence (save and cleanup)
   */
  public async close(): Promise<void> {
    this.stopAutoSave();
    await this.flush();
  }

  /**
   * Create empty data structure
   */
  private createEmptyData(): PersistenceData {
    return {
      version: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      reports: [],
      downloads: {},
      events: [],
      errors: [],
    };
  }

  /**
   * Ensure data is loaded
   */
  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
  }

  /**
   * Load data from storage
   */
  private async load(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const filePath = path.join(this.config.storagePath, 'metrics.json');

      try {
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content) as PersistenceData;

        // Migrate if needed
        if (data.version !== SCHEMA_VERSION) {
          this.data = this.migrate(data);
        } else {
          this.data = data;
        }
      } catch {
        // File doesn't exist, use empty data
        this.data = this.createEmptyData();
      }

      // Clean up old data
      this.cleanupOldData();

      this.loaded = true;
    } catch (error) {
      console.error('Failed to load metrics data:', error);
      this.data = this.createEmptyData();
      this.loaded = true;
    }
  }

  /**
   * Save data to storage
   */
  private async save(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      await fs.mkdir(this.config.storagePath, { recursive: true });

      this.data.updatedAt = new Date().toISOString();

      const filePath = path.join(this.config.storagePath, 'metrics.json');
      await fs.writeFile(filePath, JSON.stringify(this.data, null, 2));

      this.dirty = false;
    } catch (error) {
      console.error('Failed to save metrics data:', error);
    }
  }

  /**
   * Mark data as dirty (needs save)
   */
  private markDirty(): void {
    this.dirty = true;
  }

  /**
   * Migrate data from older schema versions
   */
  private migrate(data: Partial<PersistenceData>): PersistenceData {
    // Add migration logic as schema evolves
    return {
      ...this.createEmptyData(),
      ...data,
      version: SCHEMA_VERSION,
    };
  }

  /**
   * Trim reports to max limit
   */
  private trimReports(): void {
    if (this.data.reports.length > this.config.maxReports) {
      this.data.reports = this.data.reports.slice(-this.config.maxReports);
    }
  }

  /**
   * Trim events to max limit
   */
  private trimEvents(): void {
    if (this.data.events.length > this.config.maxEvents) {
      this.data.events = this.data.events.slice(-this.config.maxEvents);
    }
  }

  /**
   * Trim errors to max limit
   */
  private trimErrors(): void {
    if (this.data.errors.length > this.config.maxErrors) {
      this.data.errors = this.data.errors.slice(-this.config.maxErrors);
    }
  }

  /**
   * Clean up data older than retention period
   */
  private cleanupOldData(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    const cutoffTimestamp = cutoffDate.getTime();
    const cutoffStr = cutoffDate.toISOString();

    // Clean reports
    this.data.reports = this.data.reports.filter(r => r.timestamp >= cutoffStr);

    // Clean events
    this.data.events = this.data.events.filter(e => e.timestamp >= cutoffTimestamp);

    // Clean errors
    this.data.errors = this.data.errors.filter(e => e.timestamp >= cutoffTimestamp);

    // Clean download records
    for (const [pkg, records] of Object.entries(this.data.downloads)) {
      this.data.downloads[pkg] = records.filter(r => r.timestamp >= cutoffTimestamp);
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(async () => {
      if (this.dirty) {
        await this.save();
      }
    }, this.config.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }
}
