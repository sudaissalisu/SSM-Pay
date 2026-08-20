/**
 * Structured Logger for SSM Pay Application
 * 
 * Provides consistent logging format with:
 * - JSON structured logging (when LOG_FORMAT=json)
 * - Timestamp, level, module, message in each entry
 * - LOG_LEVEL env var filtering
 * - Request ID tracking for correlation
 * - Backward compatibility with existing API
 */

import type { AppError } from './errors'

// Log levels in order of severity
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// Log format types
export type LogFormat = 'text' | 'json'

interface LoggerOptions {
  /** Module name for log source identification */
  module?: string
  /** Request ID for distributed tracing correlation */
  requestId?: string
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  module?: string
  requestId?: string
  event?: string
  metadata?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
    code?: string
  }
}

// Color codes for console output (development only)
const colors: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
}

const resetColor = '\x1b[0m'

// Level hierarchy for filtering
const levelHierarchy: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * Parse and validate LOG_LEVEL environment variable
 */
function parseLogLevel(envValue: string | undefined): LogLevel {
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error']
  const lowerValue = envValue?.toLowerCase()
  
  if (lowerValue && validLevels.includes(lowerValue as LogLevel)) {
    return lowerValue as LogLevel
  }
  
  return 'info' // Default level
}

/**
 * Parse LOG_FORMAT environment variable
 */
function parseLogFormat(envValue: string | undefined): LogFormat {
  if (envValue?.toLowerCase() === 'json') {
    return 'json'
  }
  return 'text' // Default format
}

/**
 * Generate a unique request ID if not provided
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Serialize error object safely for JSON output
 */
function serializeError(error: AppError | Error | undefined): LogEntry['error'] {
  if (!error) return undefined
  
  return {
    name: error.name || 'Error',
    message: error.message,
    stack: error.stack,
    ...(typeof (error as AppError).code === 'string' && { code: (error as AppError).code }),
  }
}

class Logger {
  private minLevel: LogLevel
  private logFormat: LogFormat
  private isDevelopment: boolean
  private defaultModule: string
  private currentRequestId: string | undefined

  constructor(defaultModule = 'app') {
    this.minLevel = parseLogLevel(process.env.LOG_LEVEL)
    this.logFormat = parseLogFormat(process.env.LOG_FORMAT)
    this.isDevelopment = process.env.NODE_ENV === 'development'
    this.defaultModule = defaultModule
  }

  /**
   * Check if a log level should be output based on configured minimum level
   */
  private shouldLog(level: LogLevel): boolean {
    return levelHierarchy[level] >= levelHierarchy[this.minLevel]
  }

  /**
   * Format log entry as text for development/legacy output
   */
  private formatAsText(entry: LogEntry): string {
    const color = this.isDevelopment ? colors[entry.level] : ''
    const reset = this.isDevelopment ? resetColor : ''

    // Build parts: [LEVEL] [timestamp] [module] [requestId] [event] message
    const parts = [
      `${color}[${entry.level.toUpperCase()}]${reset}`,
      `[${entry.timestamp}]`,
      entry.module ? `[${entry.module}]` : '',
      entry.requestId ? `[${entry.requestId}]` : '',
      entry.event ? `[${entry.event}]` : '',
      entry.message,
    ].filter(Boolean)

    return parts.join(' ')
  }

  /**
   * Format log entry as structured JSON
   */
  private formatAsJson(entry: LogEntry): string {
    return JSON.stringify(entry)
  }

  /**
   * Output the formatted log to the appropriate console method
   */
  private outputLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return
    }

    const formattedMessage = this.logFormat === 'json'
      ? this.formatAsJson(entry)
      : this.formatAsText(entry)

    // In text mode with metadata, append it separately for better readability
    if (this.logFormat === 'text' && this.isDevelopment && entry.metadata) {
      this.logToConsole(entry.level, formattedMessage, entry.metadata)
    } else if (this.logFormat === 'text' && entry.error) {
      // For errors in text mode, include error details
      const errorObj = new Error(entry.error.message)
      errorObj.name = entry.error.name
      errorObj.stack = entry.error.stack
      this.logToConsole(entry.level, formattedMessage, errorObj)
    } else {
      this.logToConsole(entry.level, formattedMessage)
    }
  }

  /**
   * Route log to appropriate console method based on level
   */
  private logToConsole(level: LogLevel, message: string, ...optionalParams: unknown[]): void {
    switch (level) {
      case 'debug':
        console.debug(message, ...optionalParams)
        break
      case 'info':
        console.info(message, ...optionalParams)
        break
      case 'warn':
        console.warn(message, ...optionalParams)
        break
      case 'error':
        console.error(message, ...optionalParams)
        break
      default:
        console.log(message, ...optionalParams)
    }
  }

  /**
   * Create a structured log entry with all context
   */
  private createEntry(
    level: LogLevel,
    message: string,
    options: {
      event?: string
      metadata?: Record<string, unknown>
      error?: AppError | Error
      module?: string
      requestId?: string
    } = {}
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      module: options.module || this.defaultModule,
      requestId: options.requestId || this.currentRequestId,
      event: options.event,
      metadata: options.metadata,
      error: serializeError(options.error),
    }
  }

  // ==========================================
  // Request Context Management
  // ==========================================

  /**
   * Set request ID for current execution context
   * Useful for correlating logs across a single request
   */
  setRequestId(requestId?: string): string {
    this.currentRequestId = requestId || generateRequestId()
    return this.currentRequestId
  }

  /**
   * Get the current request ID
   */
  getRequestId(): string | undefined {
    return this.currentRequestId
  }

  /**
   * Clear the current request ID (end of request lifecycle)
   */
  clearRequestId(): void {
    this.currentRequestId = undefined
  }

  /**
   * Create a child logger with specific module name
   * Allows different components to have their own namespace
   */
  child(moduleName: string): LoggerChild {
    return new LoggerChild(this, moduleName)
  }

  // ==========================================
  // Core Logging Methods
  // ==========================================

  debug(message: string, options?: { event?: string; metadata?: Record<string, unknown> }): void {
    this.outputLog(this.createEntry('debug', message, options))
  }

  info(message: string, options?: { event?: string; metadata?: Record<string, unknown> }): void {
    this.outputLog(this.createEntry('info', message, options))
  }

  warn(message: string, options?: { event?: string; metadata?: Record<string, unknown>; error?: AppError | Error }): void {
    this.outputLog(this.createEntry('warn', message, options))
  }

  error(message: string, options?: { event?: string; metadata?: Record<string, unknown>; error?: AppError | Error }): void {
    this.outputLog(this.createEntry('error', message, options))
  }

  // ==========================================
  // Convenience Methods for Domain Events
  // ==========================================

  /**
   * Log payment-related events with standardized formatting
   */
  payment(action: string, metadata: Record<string, unknown>): void {
    this.outputLog(this.createEntry('info', `Payment ${action}`, {
      event: `payment.${action}`,
      metadata: { ...metadata, domain: 'payments' },
    }))
  }

  /**
   * Log API request/response events
   */
  api(endpoint: string, metadata: Record<string, unknown>): void {
    this.outputLog(this.createEntry('info', `API call: ${endpoint}`, {
      event: 'api.request',
      metadata: { endpoint, ...metadata, domain: 'api' },
    }))
  }

  /**
   * Log application errors with full context
   */
  appError(error: AppError | Error, context?: Record<string, unknown>): void {
    this.outputLog(this.createEntry('error', error.message, {
      event: 'app.error',
      metadata: { ...context, domain: 'app' },
      error,
    }))
  }

  /**
   * Log authentication events (login, logout, token refresh)
   */
  auth(action: string, userId?: string, metadata?: Record<string, unknown>): void {
    this.outputLog(this.createEntry('info', `Auth ${action}`, {
      event: `auth.${action}`,
      metadata: { userId, ...metadata, domain: 'auth' },
    }))
  }

  /**
   * Log database operations
   */
  database(operation: string, table: string, metadata?: Record<string, unknown>): void {
    this.outputLog(this.createEntry('debug', `DB ${operation} on ${table}`, {
      event: 'database.operation',
      metadata: { operation, table, ...metadata, domain: 'database' },
    }))
  }
}

/**
 * Child Logger - Inherits parent configuration but overrides module name
 * Used for component-specific logging namespaces
 */
class LoggerChild extends Logger {
  private parent: Logger
  private childModule: string

  constructor(parent: Logger, moduleName: string) {
    super(moduleName)
    this.parent = parent
    this.childModule = moduleName
  }

  override createEntry(
    level: LogLevel,
    message: string,
    options: {
      event?: string
      metadata?: Record<string, unknown>
      error?: AppError | Error
      module?: string
      requestId?: string
    } = {}
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      module: options.module || this.childModule,
      requestId: options.requestId || this.parent.getRequestId(),
      event: options.event,
      metadata: options.metadata,
      error: serializeError(options.error),
    }
  }
}

// Export singleton instance with app-wide defaults
export const logger = new Logger('ssm-pay')

// Export class for creating custom instances
export { Logger }

// Export default for convenience
export default logger

// Re-export types for external use
export type { LogEntry, LoggerOptions }
