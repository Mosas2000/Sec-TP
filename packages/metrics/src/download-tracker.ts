import type { PackageDownloads, DownloadTrend, DownloadPeriod } from './npm-tracker.js';

/**
 * Stored download record
 */
export interface DownloadRecord {
  /** Package name */
  package: string;
  /** Download count */
  downloads: number;
  /** Record date (YYYY-MM-DD) */
  date: string;
  /** Record timestamp */
  timestamp: number;
  /** Period this record covers */
  period: DownloadPeriod;
}

/**
 * Download history summary
 */
export interface DownloadHistory {
  /** Package name */
  package: string;
  /** Historical records */
  records: DownloadRecord[];
  /** Total downloads across all records */
  totalDownloads: number;
  /** Average daily downloads */
  averageDaily: number;
  /** Peak downloads */
  peakDownloads: number;
  /** Peak date */
  peakDate: string;
}

/**
 * Download tracker configuration
 */
export interface DownloadTrackerConfig {
  /** Storage path for JSON files */
  storagePath?: string;
  /** Whether to store daily granularity */
  storeDailyRecords?: boolean;
  /** Maximum history to retain (days) */
  maxHistoryDays?: number;
}

/**
 * Download Tracker for persisting and analyzing download data
 *
 * @example
 * ```typescript
 * const tracker = new DownloadTracker({
 *   storagePath: './metrics-data',
 * });
 *
 * // Store downloads
 * await tracker.recordDownloads(packageDownloads);
 *
 * // Get history
 * const history = await tracker.getHistory('@tipstream/sdk-core');
 * ```
 */
export class DownloadTracker {
  private readonly config: Required<DownloadTrackerConfig>;
  private records: Map<string, DownloadRecord[]> = new Map();
  private loaded = false;

  constructor(config: DownloadTrackerConfig = {}) {
    this.config = {
      storagePath: config.storagePath ?? './metrics-data',
      storeDailyRecords: config.storeDailyRecords ?? true,
      maxHistoryDays: config.maxHistoryDays ?? 365,
    };
  }

  /**
   * Record download statistics
   */
  public async recordDownloads(downloads: PackageDownloads): Promise<void> {
    await this.ensureLoaded();

    const record: DownloadRecord = {
      package: downloads.package,
      downloads: downloads.downloads,
      date: downloads.end,
      timestamp: Date.now(),
      period: this.detectPeriod(downloads.start, downloads.end),
    };

    if (!this.records.has(downloads.package)) {
      this.records.set(downloads.package, []);
    }

    const packageRecords = this.records.get(downloads.package)!;
    
    // Avoid duplicates for same date
    const existingIndex = packageRecords.findIndex(r => r.date === record.date);
    if (existingIndex !== -1) {
      packageRecords[existingIndex] = record;
    } else {
      packageRecords.push(record);
    }

    // Trim old records
    this.trimOldRecords(downloads.package);

    await this.save();
  }

  /**
   * Record multiple package downloads
   */
  public async recordMultiple(downloads: Map<string, PackageDownloads>): Promise<void> {
    for (const [_, stats] of downloads) {
      await this.recordDownloads(stats);
    }
  }

  /**
   * Get download history for a package
   */
  public async getHistory(packageName: string): Promise<DownloadHistory | null> {
    await this.ensureLoaded();

    const records = this.records.get(packageName);
    if (!records || records.length === 0) {
      return null;
    }

    const sortedRecords = [...records].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const totalDownloads = sortedRecords.reduce((sum, r) => sum + r.downloads, 0);
    const averageDaily = totalDownloads / sortedRecords.length;
    
    let peakDownloads = 0;
    let peakDate = '';
    
    for (const record of sortedRecords) {
      if (record.downloads > peakDownloads) {
        peakDownloads = record.downloads;
        peakDate = record.date;
      }
    }

    return {
      package: packageName,
      records: sortedRecords,
      totalDownloads,
      averageDaily: Math.round(averageDaily),
      peakDownloads,
      peakDate,
    };
  }

  /**
   * Get all tracked packages
   */
  public async getTrackedPackages(): Promise<string[]> {
    await this.ensureLoaded();
    return Array.from(this.records.keys());
  }

  /**
   * Get summary statistics for all packages
   */
  public async getSummary(): Promise<Map<string, { total: number; latest: number; trend: string }>> {
    await this.ensureLoaded();

    const summary = new Map<string, { total: number; latest: number; trend: string }>();

    for (const [packageName, records] of this.records) {
      if (records.length === 0) continue;

      const sortedRecords = [...records].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const total = records.reduce((sum, r) => sum + r.downloads, 0);
      const latest = sortedRecords[0]?.downloads ?? 0;

      let trend = 'stable';
      if (sortedRecords.length >= 2) {
        const current = sortedRecords[0]?.downloads ?? 0;
        const previous = sortedRecords[1]?.downloads ?? 0;
        if (previous > 0) {
          const change = ((current - previous) / previous) * 100;
          if (change > 5) trend = 'up';
          else if (change < -5) trend = 'down';
        }
      }

      summary.set(packageName, { total, latest, trend });
    }

    return summary;
  }

  /**
   * Compare downloads between two periods
   */
  public async compareperiods(
    packageName: string,
    startDate1: string,
    endDate1: string,
    startDate2: string,
    endDate2: string
  ): Promise<{ period1: number; period2: number; change: number; changePercent: number }> {
    await this.ensureLoaded();

    const records = this.records.get(packageName) ?? [];

    const period1Records = records.filter(r => r.date >= startDate1 && r.date <= endDate1);
    const period2Records = records.filter(r => r.date >= startDate2 && r.date <= endDate2);

    const period1 = period1Records.reduce((sum, r) => sum + r.downloads, 0);
    const period2 = period2Records.reduce((sum, r) => sum + r.downloads, 0);

    const change = period2 - period1;
    const changePercent = period1 > 0 ? ((period2 - period1) / period1) * 100 : 0;

    return {
      period1,
      period2,
      change,
      changePercent: Math.round(changePercent * 100) / 100,
    };
  }

  /**
   * Detect period from date range
   */
  private detectPeriod(start: string, end: string): DownloadPeriod {
    const days = Math.ceil(
      (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (days <= 1) return 'last-day';
    if (days <= 7) return 'last-week';
    if (days <= 31) return 'last-month';
    return 'last-year';
  }

  /**
   * Trim old records beyond retention period
   */
  private trimOldRecords(packageName: string): void {
    const records = this.records.get(packageName);
    if (!records) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxHistoryDays);
    const cutoffStr = cutoffDate.toISOString().split('T')[0]!;

    const trimmed = records.filter(r => r.date >= cutoffStr);
    this.records.set(packageName, trimmed);
  }

  /**
   * Ensure data is loaded from storage
   */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const filePath = path.join(this.config.storagePath, 'downloads.json');
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content) as Record<string, DownloadRecord[]>;
        
        this.records = new Map(Object.entries(data));
      } catch {
        // File doesn't exist yet, start fresh
        this.records = new Map();
      }
      
      this.loaded = true;
    } catch (error) {
      console.error('Failed to load download history:', error);
      this.records = new Map();
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

      // Ensure directory exists
      await fs.mkdir(this.config.storagePath, { recursive: true });

      const filePath = path.join(this.config.storagePath, 'downloads.json');
      const data = Object.fromEntries(this.records);
      
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save download history:', error);
    }
  }

  /**
   * Export data as JSON
   */
  public async exportData(): Promise<string> {
    await this.ensureLoaded();
    return JSON.stringify(Object.fromEntries(this.records), null, 2);
  }

  /**
   * Import data from JSON
   */
  public async importData(json: string): Promise<void> {
    const data = JSON.parse(json) as Record<string, DownloadRecord[]>;
    this.records = new Map(Object.entries(data));
    this.loaded = true;
    await this.save();
  }

  /**
   * Clear all data
   */
  public async clear(): Promise<void> {
    this.records = new Map();
    await this.save();
  }
}
