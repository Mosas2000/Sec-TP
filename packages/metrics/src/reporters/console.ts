import type { MetricsReport, MetricsReporter } from '../collector.js';

/**
 * Console reporter configuration
 */
export interface ConsoleReporterConfig {
  /** Whether to pretty print output */
  pretty?: boolean;
  /** Whether to include timestamps */
  timestamps?: boolean;
  /** Log level */
  level?: 'debug' | 'info' | 'warn';
}

/**
 * Console Reporter - outputs metrics to console
 *
 * @example
 * ```typescript
 * const reporter = new ConsoleReporter({ pretty: true });
 * collector.addReporter(reporter);
 * ```
 */
export class ConsoleReporter implements MetricsReporter {
  public readonly name = 'console';
  private readonly config: Required<ConsoleReporterConfig>;

  constructor(config: ConsoleReporterConfig = {}) {
    this.config = {
      pretty: config.pretty ?? false,
      timestamps: config.timestamps ?? true,
      level: config.level ?? 'info',
    };
  }

  public async report(report: MetricsReport): Promise<void> {
    const output = this.formatReport(report);

    switch (this.config.level) {
      case 'debug':
        console.debug(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  private formatReport(report: MetricsReport): string {
    if (this.config.pretty) {
      return this.formatPretty(report);
    }
    return JSON.stringify(report);
  }

  private formatPretty(report: MetricsReport): string {
    const lines: string[] = [];

    if (this.config.timestamps) {
      lines.push(`📊 Metrics Report - ${report.timestamp}`);
    } else {
      lines.push('📊 Metrics Report');
    }

    lines.push(`   App: ${report.appName} | Period: ${Math.round(report.period / 1000)}s`);
    lines.push('');

    for (const metric of report.metrics) {
      const tags = metric.tags 
        ? ` [${Object.entries(metric.tags).map(([k, v]) => `${k}=${v}`).join(', ')}]`
        : '';

      let value: string;
      switch (metric.type) {
        case 'counter':
          value = `sum=${metric.sum}`;
          break;
        case 'gauge':
          value = `last=${metric.last}`;
          break;
        case 'timing':
          value = `avg=${Math.round(metric.avg)}ms, min=${metric.min}ms, max=${metric.max}ms`;
          break;
        case 'histogram':
          value = `avg=${metric.avg.toFixed(2)}, min=${metric.min}, max=${metric.max}`;
          break;
        default:
          value = `count=${metric.count}`;
      }

      lines.push(`   ${metric.type.padEnd(10)} ${metric.name}${tags}: ${value}`);
    }

    return lines.join('\n');
  }
}
