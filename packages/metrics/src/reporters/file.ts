import type { MetricsReport, MetricsReporter } from '../collector.js';

/**
 * File reporter configuration
 */
export interface FileReporterConfig {
  /** File path for metrics output */
  path: string;
  /** Whether to append or overwrite */
  append?: boolean;
  /** Whether to pretty print JSON */
  pretty?: boolean;
  /** Maximum file size in bytes before rotation */
  maxSize?: number;
  /** Maximum number of backup files to keep */
  maxBackups?: number;
}

/**
 * File Reporter - outputs metrics to JSON files
 *
 * @example
 * ```typescript
 * const reporter = new FileReporter({
 *   path: './metrics/data.json',
 *   append: true,
 *   maxSize: 10 * 1024 * 1024, // 10MB
 * });
 * collector.addReporter(reporter);
 * ```
 */
export class FileReporter implements MetricsReporter {
  public readonly name = 'file';
  private readonly config: Required<FileReporterConfig>;
  private currentSize = 0;

  constructor(config: FileReporterConfig) {
    this.config = {
      path: config.path,
      append: config.append ?? true,
      pretty: config.pretty ?? false,
      maxSize: config.maxSize ?? 50 * 1024 * 1024, // 50MB default
      maxBackups: config.maxBackups ?? 5,
    };
  }

  public async report(report: MetricsReport): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Ensure directory exists
    const dir = path.dirname(this.config.path);
    await fs.mkdir(dir, { recursive: true });

    // Check if rotation needed
    await this.checkRotation();

    // Format data
    const data = this.config.pretty
      ? JSON.stringify(report, null, 2)
      : JSON.stringify(report);

    const content = this.config.append ? data + '\n' : data;

    // Write to file
    if (this.config.append) {
      await fs.appendFile(this.config.path, content);
    } else {
      await fs.writeFile(this.config.path, content);
    }

    this.currentSize += Buffer.byteLength(content);
  }

  private async checkRotation(): Promise<void> {
    if (this.currentSize < this.config.maxSize) {
      // Check actual file size
      try {
        const fs = await import('fs/promises');
        const stats = await fs.stat(this.config.path);
        this.currentSize = stats.size;
      } catch {
        this.currentSize = 0;
      }
    }

    if (this.currentSize >= this.config.maxSize) {
      await this.rotate();
    }
  }

  private async rotate(): Promise<void> {
    const fs = await import('fs/promises');

    // Delete oldest backup
    const oldestBackup = `${this.config.path}.${this.config.maxBackups}`;
    try {
      await fs.unlink(oldestBackup);
    } catch {
      // File doesn't exist, ignore
    }

    // Shift existing backups
    for (let i = this.config.maxBackups - 1; i >= 1; i--) {
      const oldPath = `${this.config.path}.${i}`;
      const newPath = `${this.config.path}.${i + 1}`;
      try {
        await fs.rename(oldPath, newPath);
      } catch {
        // File doesn't exist, ignore
      }
    }

    // Move current file to .1
    try {
      await fs.rename(this.config.path, `${this.config.path}.1`);
    } catch {
      // File doesn't exist, ignore
    }

    this.currentSize = 0;
  }

  public async close(): Promise<void> {
    // No cleanup needed for file reporter
  }
}
