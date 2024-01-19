/**
 * Structured Logger for SSM Pay Application
 * Provides consistent logging format with event tagging and metadata
 */

import type { AppError } from './errors'

// Log levels in order of severity
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  event?: string
  timestamp: string
  metadata?: Record<string, unknown>
  error?: AppError | Error
}

// Color codes for console output (development only)
const colors: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
}

const resetColor = '\x1b[0m'

class Logger {
  private minLevel: LogLevel
  private isDevelopment: boolean

  constructor() {
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
    this.isDevelopment = process.env.NODE_ENV === 'development'
  }

  // Check if a log level should be output
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(this.minLevel)
  }

  // Format and output log entry
  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return
    }

    const color = this.isDevelopment ? colors[entry.level] : ''
    const reset = this.isDevelopment ? resetColor : ''

    // Format: [LEVEL] [timestamp] [event] message {metadata}
    const parts = [
      `${color}[${entry.level.toUpperCase()}]${reset}`,
      `[${entry.timestamp}]`,
      entry.event ? `[${entry.event}]` : '',
      entry.message,
    ].filter(Boolean).join(' ')

    if (this.isDevelopment && entry.metadata) {
      console.log(parts, entry.metadata)
    } else if (this.isDevelopment && entry.error) {
      this.logToConsole(entry.level, parts, entry.error)
    } else {
      // Production: JSON format for structured logging
      const jsonOutput = JSON.stringify(entry)
      this.logToConsole(entry.level, jsonOutput)
    }
  }

  // Helper to log to appropriate console method
  private logToConsole(level: LogLevel, message: string, ...optionalParams: unknown[]): void {
    switch (level) {
      case 'debug':
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
   * Create a log entry with common fields
   */
  private createEntry(
    level: LogLevel,
    message: string,
    options: {
      event?: string
      metadata?: Record<string, unknown>
      error?: AppError | Error
    } = {}
  ): LogEntry {
    return {
      level,
      message,
      event: options.event,
      timestamp: new Date().toISOString(),
      metadata: options.metadata,
      error: options.error,
    }
  }

  // Public logging methods

  debug(message: string, options?: { event?: string; metadata?: Record<string, unknown> }): void {
    this.log(this.createEntry('debug', message, options))
  }

  info(message: string, options?: { event?: string; metadata?: Record<string, unknown> }): void {
    this.log(this.createEntry('info', message, options))
  }

  warn(message: string, options?: { event?: string; metadata?: Record<string, unknown>; error?: AppError | Error }): void {
    this.log(this.createEntry('warn', message, options))
  }

  error(message: string, options?: { event?: string; metadata?: Record<string, unknown>; error?: AppError | Error }): void {
    this.log(this.createEntry('error', message, options))
  }

  // Convenience methods for specific events

  /**
   * Log payment-related events
   */
  payment(action: string, metadata: Record<string, unknown>): void {
    this.info(`Payment ${action}`, {
      event: `payment.${action}`,
      metadata,
    })
  }

  /**
   * Log API request/response events
   */
  api(endpoint: string, metadata: Record<string, unknown>): void {
    this.info(`API call: ${endpoint}`, {
      event: 'api.request',
      metadata: { endpoint, ...metadata },
    })
  }

  /**
   * Log error with full context
   */
  appError(error: AppError | Error, context?: Record<string, unknown>): void {
    this.error(error.message, {
      event: 'app.error',
      metadata: context,
      error,
    })
  }
}

// Export singleton instance
export const logger = new Logger()

// Export default for convenience
export default logger
