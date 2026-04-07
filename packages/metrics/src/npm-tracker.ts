/**
 * NPM download period
 */
export type DownloadPeriod = 'last-day' | 'last-week' | 'last-month' | 'last-year';

/**
 * NPM download data for a single day
 */
export interface DailyDownload {
  /** Date string (YYYY-MM-DD) */
  date: string;
  /** Download count */
  downloads: number;
}

/**
 * NPM package download statistics
 */
export interface PackageDownloads {
  /** Package name */
  package: string;
  /** Total downloads in period */
  downloads: number;
  /** Start date of period */
  start: string;
  /** End date of period */
  end: string;
  /** Daily breakdown (if requested) */
  daily?: DailyDownload[];
}

/**
 * NPM package metadata
 */
export interface PackageMetadata {
  /** Package name */
  name: string;
  /** Latest version */
  version: string;
  /** Package description */
  description?: string;
  /** Last publish date */
  lastPublish?: string;
  /** Maintainers */
  maintainers?: string[];
  /** Weekly downloads */
  weeklyDownloads?: number;
}

/**
 * Download trend data
 */
export interface DownloadTrend {
  /** Package name */
  package: string;
  /** Current period downloads */
  current: number;
  /** Previous period downloads */
  previous: number;
  /** Change percentage */
  changePercent: number;
  /** Trend direction */
  trend: 'up' | 'down' | 'stable';
}

/**
 * NPM tracker configuration
 */
export interface NpmTrackerConfig {
  /** Packages to track */
  packages: string[];
  /** NPM registry URL */
  registryUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
}

/**
 * Cache entry
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * NPM API point downloads response
 */
interface NpmPointResponse {
  package: string;
  downloads: number;
  start: string;
  end: string;
}

/**
 * NPM API range downloads response
 */
interface NpmRangeResponse {
  package: string;
  downloads: DailyDownload[];
  start: string;
  end: string;
}

/**
 * NPM Registry metadata response
 */
interface NpmRegistryResponse {
  name: string;
  description?: string;
  'dist-tags'?: { latest?: string };
  versions?: Record<string, unknown>;
  time?: Record<string, string>;
  maintainers?: Array<{ name: string }>;
}

/**
 * NPM Registry API client for tracking package downloads
 *
 * @example
 * ```typescript
 * const tracker = new NpmTracker({
 *   packages: ['@tipstream/sdk-core', '@tipstream/sdk-security'],
 * });
 *
 * const stats = await tracker.getDownloads('last-week');
 * const trends = await tracker.getTrends();
 * ```
 */
export class NpmTracker {
  private readonly config: Required<NpmTrackerConfig>;
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();

  constructor(config: NpmTrackerConfig) {
    this.config = {
      packages: config.packages,
      registryUrl: config.registryUrl ?? 'https://registry.npmjs.org',
      timeout: config.timeout ?? 10000,
      cacheTtl: config.cacheTtl ?? 300000, // 5 minutes
    };
  }

  /**
   * Get download statistics for all tracked packages
   */
  public async getDownloads(period: DownloadPeriod = 'last-week'): Promise<Map<string, PackageDownloads>> {
    const results = new Map<string, PackageDownloads>();

    await Promise.all(
      this.config.packages.map(async pkg => {
        try {
          const stats = await this.getPackageDownloads(pkg, period);
          results.set(pkg, stats);
        } catch (error) {
          console.error(`Failed to fetch downloads for ${pkg}:`, error);
        }
      })
    );

    return results;
  }

  /**
   * Get download statistics for a single package
   */
  public async getPackageDownloads(
    packageName: string,
    period: DownloadPeriod = 'last-week'
  ): Promise<PackageDownloads> {
    const cacheKey = `downloads:${packageName}:${period}`;
    const cached = this.getFromCache<PackageDownloads>(cacheKey);
    if (cached) return cached;

    const url = `https://api.npmjs.org/downloads/point/${period}/${encodeURIComponent(packageName)}`;
    const response = await this.fetch<NpmPointResponse>(url);

    const data: PackageDownloads = {
      package: response.package,
      downloads: response.downloads,
      start: response.start,
      end: response.end,
    };

    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get daily download breakdown for a package
   */
  public async getDailyDownloads(
    packageName: string,
    period: DownloadPeriod = 'last-month'
  ): Promise<PackageDownloads> {
    const cacheKey = `daily:${packageName}:${period}`;
    const cached = this.getFromCache<PackageDownloads>(cacheKey);
    if (cached) return cached;

    const url = `https://api.npmjs.org/downloads/range/${period}/${encodeURIComponent(packageName)}`;
    const response = await this.fetch<NpmRangeResponse>(url);

    const data: PackageDownloads = {
      package: response.package,
      downloads: response.downloads?.reduce((sum: number, d: DailyDownload) => sum + d.downloads, 0) ?? 0,
      start: response.start,
      end: response.end,
      daily: response.downloads,
    };

    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get package metadata
   */
  public async getPackageMetadata(packageName: string): Promise<PackageMetadata> {
    const cacheKey = `metadata:${packageName}`;
    const cached = this.getFromCache<PackageMetadata>(cacheKey);
    if (cached) return cached;

    const url = `${this.config.registryUrl}/${encodeURIComponent(packageName)}`;
    const response = await this.fetch<NpmRegistryResponse>(url);

    const latestVersion = response['dist-tags']?.latest;

    const data: PackageMetadata = {
      name: response.name,
      version: latestVersion ?? 'unknown',
      description: response.description,
      lastPublish: latestVersion ? response.time?.[latestVersion] : undefined,
      maintainers: response.maintainers?.map((m) => m.name),
    };

    // Get weekly downloads
    try {
      const downloads = await this.getPackageDownloads(packageName, 'last-week');
      data.weeklyDownloads = downloads.downloads;
    } catch {
      // Ignore download fetch errors
    }

    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get download trends (compare current week to previous week)
   */
  public async getTrends(): Promise<Map<string, DownloadTrend>> {
    const trends = new Map<string, DownloadTrend>();

    await Promise.all(
      this.config.packages.map(async pkg => {
        try {
          const trend = await this.getPackageTrend(pkg);
          trends.set(pkg, trend);
        } catch (error) {
          console.error(`Failed to fetch trend for ${pkg}:`, error);
        }
      })
    );

    return trends;
  }

  /**
   * Get download trend for a single package
   */
  public async getPackageTrend(packageName: string): Promise<DownloadTrend> {
    // Get last 14 days of data
    const daily = await this.getDailyDownloads(packageName, 'last-month');

    if (!daily.daily || daily.daily.length < 14) {
      return {
        package: packageName,
        current: daily.downloads,
        previous: 0,
        changePercent: 0,
        trend: 'stable',
      };
    }

    // Split into current and previous weeks
    const sortedDays = [...daily.daily].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const currentWeek = sortedDays.slice(0, 7);
    const previousWeek = sortedDays.slice(7, 14);

    const current = currentWeek.reduce((sum, d) => sum + d.downloads, 0);
    const previous = previousWeek.reduce((sum, d) => sum + d.downloads, 0);

    let changePercent = 0;
    if (previous > 0) {
      changePercent = ((current - previous) / previous) * 100;
    }

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (changePercent > 5) trend = 'up';
    else if (changePercent < -5) trend = 'down';

    return {
      package: packageName,
      current,
      previous,
      changePercent: Math.round(changePercent * 100) / 100,
      trend,
    };
  }

  /**
   * Get total downloads across all tracked packages
   */
  public async getTotalDownloads(period: DownloadPeriod = 'last-week'): Promise<number> {
    const downloads = await this.getDownloads(period);
    let total = 0;
    for (const stats of downloads.values()) {
      total += stats.downloads;
    }
    return total;
  }

  /**
   * Fetch data from URL
   */
  private async fetch<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.config.cacheTtl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Add a package to track
   */
  public addPackage(packageName: string): void {
    if (!this.config.packages.includes(packageName)) {
      this.config.packages.push(packageName);
    }
  }

  /**
   * Remove a package from tracking
   */
  public removePackage(packageName: string): void {
    const index = this.config.packages.indexOf(packageName);
    if (index !== -1) {
      this.config.packages.splice(index, 1);
    }
  }

  /**
   * Get list of tracked packages
   */
  public getTrackedPackages(): string[] {
    return [...this.config.packages];
  }
}
