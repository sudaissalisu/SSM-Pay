/**
 * Structured JSON Logger for SSM-Pay
 * 
 * Provides structured logging with consistent format for:
 * - JSON output in production
 * - Human-readable output in development
 * - Log levels: debug, info, warn, error, fatal
 * - Request tracing with correlation IDs
 * - Performance timing utilities
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  requestId?: string;
  userId?: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

interface LoggerConfig {
  minLevel: LogLevel;
  jsonOutput: boolean;
  includeTimestamp: boolean;
  requestIdHeader: string;
  redactSensitive: boolean;
  sensitiveFields: string[];
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
  jsonOutput: process.env.NODE_ENV === 'production',
  includeTimestamp: true,
  requestIdHeader: 'x-request-id',
  redactSensitive: true,
  sensitiveFields: [
    'password',
    'apiKey',
    'apiSecret',
    'token',
    'cardNumber',
    'cvv',
    'accountNumber',
    'ssn',
  ],
};

/**
 * Redact sensitive fields from log data
 */
function redactSensitiveFields(
  data: Record<string, unknown>,
  sensitiveFields: string[]
): Record<string, unknown> {
  const redacted = { ...data };
  
  for (const field of sensitiveFields) {
    if (field in redacted) {
      redacted[field] = '[REDACTED]';
    }
  }
  
  // Also check nested objects
  for (const key of Object.keys(redacted)) {
    if (typeof redacted[key] === 'object' && redacted[key] !== null && !Array.isArray(redacted[key])) {
      redacted[key] = redactSensitiveFields(
        redacted[key] as Record<string, unknown>,
        sensitiveFields
      );
    }
  }
  
  return redacted;
}

/**
 * Format log entry as JSON string
 */
function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Format log entry as human-readable string
 */
function formatPretty(entry: LogEntry): string {
  const timestamp = entry.timestamp ? `[${entry.timestamp}] ` : '';
  const context = entry.context ? `[${entry.context}] ` : '';
  const requestId = entry.requestId ? `(req: ${entry.requestId}) ` : '';
  const duration = entry.durationMs ? `${entry.durationMs}ms ` : '';
  
  let output = `${timestamp}${entry.level.toUpperCase()}: ${context}${requestId}${duration}${entry.message}`;
  
  if (entry.data && Object.keys(entry.data).length > 0) {
    output += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
  }
  
  if (entry.error) {
    output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
    if (entry.error.stack) {
      output += `\n  Stack: ${entry.error.stack}`;
    }
  }
  
  return output;
}

class Logger {
  private config: LoggerConfig;
  private currentContext?: string;
  private currentRequestId?: string;
  private currentUserId?: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create child logger with bound context
   */
  child(context: string): Logger {
    const childLogger = new Logger(this.config);
    childLogger.currentContext = context;
    return childLogger;
  }

  /**
   * Bind request ID for request tracing
   */
  bindRequestId(requestId: string): void {
    this.currentRequestId = requestId;
  }

  /**
   * Bind user ID for user context
   */
  bindUserId(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Check if log level should be emitted
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevel];
  }

  /**
   * Build log entry with common fields
   */
  private buildEntry(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: this.config.includeTimestamp ? new Date().toISOString() : undefined!,
      level,
      message,
      context: this.currentContext,
      requestId: this.currentRequestId,
      userId: this.currentUserId,
    };

    if (data) {
      entry.data = this.config.redactSensitive
        ? redactSensitiveFields(data, this.config.sensitiveFields)
        : data;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as Error & { code?: string }).code,
      };
    }

    return entry;
  }

  /**
   * Write log entry to appropriate output
   */
  private write(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const formatted = this.config.jsonOutput
      ? formatJson(entry)
      : formatPretty(entry);

    switch (entry.level) {
      case 'debug':
      case 'info':
        console.log(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
      case 'fatal':
        console.error(formatted);
        break;
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.write(this.buildEntry('debug', message, data));
  }

  /**
   * Log info message
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.write(this.buildEntry('info', message, data));
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.write(this.buildEntry('warn', message, data));
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.write(this.buildEntry('error', message, data, error));
  }

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.write(this.buildEntry('fatal', message, data, error));
  }

  /**
   * Create a timed operation tracker
   */
  startTimer(operation: string): () => number {
    const start = process.hrtime.bigint();
    
    return (): number => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      
      this.info(`Operation completed: ${operation}`, { durationMs });
      
      return durationMs;
    };
  }

  /**
   * Execute function with automatic timing
   */
  async timeAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const stopTimer = this.startTimer(operation);
    try {
      const result = await fn();
      return result;
    } catch (error) {
      this.error(`Operation failed: ${operation}`, error as Error);
      throw error;
    }
  }
}

// Default logger instance
export const logger = new Logger();

// Export class and types for custom instances
export { Logger, type LoggerConfig, type LogEntry, type LogLevel };

export default logger;
