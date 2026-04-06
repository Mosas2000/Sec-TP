import { createHash } from 'crypto';

/**
 * Audit log levels
 */
export type AuditLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

/**
 * Audit event categories
 */
export type AuditEventCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'configuration'
  | 'security'
  | 'system'
  | 'api'
  | 'custom';

/**
 * Audit event data
 */
export interface AuditEvent {
  /** Event category */
  category: AuditEventCategory;
  /** Specific action performed */
  action: string;
  /** User or system identifier */
  actor?: string;
  /** Target resource */
  resource?: string;
  /** Resource identifier */
  resourceId?: string;
  /** Whether the action succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** IP address */
  ip?: string;
  /** User agent */
  userAgent?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Request ID for correlation */
  requestId?: string;
  /** Session ID */
  sessionId?: string;
}

/**
 * Stored audit log entry
 */
export interface AuditLogEntry extends AuditEvent {
  /** Unique log ID */
  id: string;
  /** Timestamp */
  timestamp: string;
  /** Log level */
  level: AuditLogLevel;
  /** Hash of previous entry (for tamper detection) */
  previousHash?: string;
  /** Hash of this entry */
  hash: string;
}

/**
 * Audit logger output type
 */
export type AuditOutput = 'console' | 'file' | 'callback';

/**
 * Audit logger configuration
 */
export interface AuditLoggerConfig {
  /** Minimum log level */
  level?: AuditLogLevel;
  /** Output type */
  output?: AuditOutput;
  /** File path (if output is 'file') */
  filePath?: string;
  /** Callback function (if output is 'callback') */
  callback?: (entry: AuditLogEntry) => void | Promise<void>;
  /** Include hash chain for tamper detection */
  enableHashChain?: boolean;
  /** Redact sensitive fields */
  redactFields?: string[];
  /** Application name */
  appName?: string;
  /** Environment */
  environment?: string;
}

/**
 * Log level priority
 */
const LOG_LEVEL_PRIORITY: Record<AuditLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
};

/**
 * Generate unique ID
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Audit Logger for security event logging
 *
 * @example
 * ```typescript
 * const logger = new AuditLogger({
 *   level: 'info',
 *   output: 'console',
 *   enableHashChain: true,
 * });
 *
 * logger.log({
 *   category: 'authentication',
 *   action: 'login',
 *   actor: 'user@example.com',
 *   success: true,
 *   ip: '192.168.1.1',
 * });
 * ```
 */
export class AuditLogger {
  private readonly config: Required<Omit<AuditLoggerConfig, 'filePath' | 'callback'>> & 
    Pick<AuditLoggerConfig, 'filePath' | 'callback'>;
  private previousHash?: string;
  private buffer: AuditLogEntry[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor(config: AuditLoggerConfig = {}) {
    this.config = {
      level: config.level ?? 'info',
      output: config.output ?? 'console',
      filePath: config.filePath,
      callback: config.callback,
      enableHashChain: config.enableHashChain ?? false,
      redactFields: config.redactFields ?? ['password', 'token', 'secret', 'apiKey', 'authorization'],
      appName: config.appName ?? 'tipstream-sdk',
      environment: config.environment ?? process.env.NODE_ENV ?? 'development',
    };
  }

  /**
   * Log an audit event
   */
  public log(event: AuditEvent, level: AuditLogLevel = 'info'): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createEntry(event, level);
    this.writeEntry(entry);
  }

  /**
   * Log an info event
   */
  public info(event: AuditEvent): void {
    this.log(event, 'info');
  }

  /**
   * Log a warning event
   */
  public warn(event: AuditEvent): void {
    this.log(event, 'warn');
  }

  /**
   * Log an error event
   */
  public error(event: AuditEvent): void {
    this.log(event, 'error');
  }

  /**
   * Log a critical event
   */
  public critical(event: AuditEvent): void {
    this.log(event, 'critical');
  }

  /**
   * Log authentication event
   */
  public logAuth(action: string, actor: string, success: boolean, details?: Partial<AuditEvent>): void {
    this.log({
      category: 'authentication',
      action,
      actor,
      success,
      ...details,
    }, success ? 'info' : 'warn');
  }

  /**
   * Log data access event
   */
  public logAccess(resource: string, resourceId: string, actor: string, details?: Partial<AuditEvent>): void {
    this.log({
      category: 'data_access',
      action: 'read',
      resource,
      resourceId,
      actor,
      success: true,
      ...details,
    });
  }

  /**
   * Log data modification event
   */
  public logModification(
    action: 'create' | 'update' | 'delete',
    resource: string,
    resourceId: string,
    actor: string,
    details?: Partial<AuditEvent>
  ): void {
    this.log({
      category: 'data_modification',
      action,
      resource,
      resourceId,
      actor,
      success: true,
      ...details,
    });
  }

  /**
   * Log security event
   */
  public logSecurity(action: string, success: boolean, details?: Partial<AuditEvent>): void {
    this.log({
      category: 'security',
      action,
      success,
      ...details,
    }, success ? 'warn' : 'critical');
  }

  /**
   * Check if should log based on level
   */
  private shouldLog(level: AuditLogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.level];
  }

  /**
   * Create audit log entry
   */
  private createEntry(event: AuditEvent, level: AuditLogLevel): AuditLogEntry {
    const id = generateId();
    const timestamp = new Date().toISOString();

    // Redact sensitive fields
    const redactedEvent = this.redactSensitiveFields(event);

    const entry: AuditLogEntry = {
      id,
      timestamp,
      level,
      ...redactedEvent,
      hash: '', // Will be set below
    };

    // Add hash chain if enabled
    if (this.config.enableHashChain) {
      entry.previousHash = this.previousHash;
      entry.hash = this.computeHash(entry);
      this.previousHash = entry.hash;
    } else {
      entry.hash = this.computeHash(entry);
    }

    return entry;
  }

  /**
   * Redact sensitive fields from metadata
   */
  private redactSensitiveFields(event: AuditEvent): AuditEvent {
    if (!event.metadata) {
      return event;
    }

    const redacted = { ...event, metadata: { ...event.metadata } };

    for (const field of this.config.redactFields) {
      if (field in redacted.metadata) {
        redacted.metadata[field] = '[REDACTED]';
      }
    }

    return redacted;
  }

  /**
   * Compute hash of entry
   */
  private computeHash(entry: Omit<AuditLogEntry, 'hash'>): string {
    const content = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp,
      level: entry.level,
      category: entry.category,
      action: entry.action,
      actor: entry.actor,
      success: entry.success,
      previousHash: entry.previousHash,
    });

    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Write entry to output
   */
  private writeEntry(entry: AuditLogEntry): void {
    switch (this.config.output) {
      case 'console':
        this.writeToConsole(entry);
        break;
      case 'file':
        this.writeToFile(entry);
        break;
      case 'callback':
        this.writeToCallback(entry);
        break;
    }
  }

  /**
   * Write to console
   */
  private writeToConsole(entry: AuditLogEntry): void {
    const formatted = this.formatEntry(entry);
    
    switch (entry.level) {
      case 'debug':
      case 'info':
        console.log(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
      case 'critical':
        console.error(formatted);
        break;
    }
  }

  /**
   * Write to file (buffered)
   */
  private writeToFile(entry: AuditLogEntry): void {
    this.buffer.push(entry);

    // Start flush timer if not running
    if (!this.flushTimer) {
      this.flushTimer = setInterval(() => this.flushBuffer(), 5000);
    }

    // Flush immediately if buffer is large
    if (this.buffer.length >= 100) {
      this.flushBuffer();
    }
  }

  /**
   * Flush buffer to file
   */
  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.filePath) {
      return;
    }

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      const fs = await import('fs/promises');
      const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
      await fs.appendFile(this.config.filePath, lines);
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Re-add entries to buffer
      this.buffer.unshift(...entries);
    }
  }

  /**
   * Write to callback
   */
  private writeToCallback(entry: AuditLogEntry): void {
    if (this.config.callback) {
      try {
        this.config.callback(entry);
      } catch (error) {
        console.error('Audit callback error:', error);
      }
    }
  }

  /**
   * Format entry for console output
   */
  private formatEntry(entry: AuditLogEntry): string {
    const levelColors: Record<AuditLogLevel, string> = {
      debug: '\x1b[90m',
      info: '\x1b[36m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      critical: '\x1b[35m',
    };

    const reset = '\x1b[0m';
    const color = levelColors[entry.level];

    const parts = [
      `${color}[${entry.level.toUpperCase()}]${reset}`,
      entry.timestamp,
      `[${entry.category}]`,
      entry.action,
      entry.success ? '✓' : '✗',
    ];

    if (entry.actor) {
      parts.push(`actor=${entry.actor}`);
    }
    if (entry.resource) {
      parts.push(`resource=${entry.resource}`);
    }
    if (entry.resourceId) {
      parts.push(`id=${entry.resourceId}`);
    }

    return parts.join(' ');
  }

  /**
   * Verify hash chain integrity
   */
  public verifyChain(entries: AuditLogEntry[]): { valid: boolean; brokenAt?: number } {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) continue;

      // Verify entry hash
      const { hash, ...rest } = entry;
      const computedHash = this.computeHash(rest);
      if (hash !== computedHash) {
        return { valid: false, brokenAt: i };
      }

      // Verify chain link
      if (i > 0 && entry.previousHash !== entries[i - 1]?.hash) {
        return { valid: false, brokenAt: i };
      }
    }

    return { valid: true };
  }

  /**
   * Close logger and flush remaining entries
   */
  public async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flushBuffer();
  }
}

/**
 * Create a child logger with preset fields
 */
export function createChildLogger(
  parent: AuditLogger,
  defaults: Partial<AuditEvent>
): { log: (event: AuditEvent, level?: AuditLogLevel) => void } {
  return {
    log: (event: AuditEvent, level?: AuditLogLevel) => {
      parent.log({ ...defaults, ...event }, level);
    },
  };
}
