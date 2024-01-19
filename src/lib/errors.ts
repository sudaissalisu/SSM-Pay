/**
 * Custom error types for SSM Pay application
 * Provides structured error handling across the application
 */

// Error codes for categorization
export enum ErrorCode {
  // Configuration errors (1000-1099)
  MISSING_CONFIG = 'MISSING_CONFIG',
  INVALID_CONFIG = 'INVALID_CONFIG',

  // Payment errors (1100-1199)
  PAYMENT_INIT_FAILED = 'PAYMENT_INIT_FAILED',
  PAYMENT_VERIFICATION_FAILED = 'PAYMENT_VERIFICATION_FAILED',
  PAYMENT_CALLBACK_FAILED = 'PAYMENT_CALLBACK_FAILED',

  // API errors (1200-1299)
  API_REQUEST_FAILED = 'API_REQUEST_FAILED',
  API_RESPONSE_ERROR = 'API_RESPONSE_ERROR',
  API_TIMEOUT = 'API_TIMEOUT',

  // Validation errors (1300-1399)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Exchange rate errors (1400-1499)
  EXCHANGE_RATE_FETCH_FAILED = 'EXCHANGE_RATE_FETCH_FAILED',
  EXCHANGE_RATE_NOT_FOUND = 'EXCHANGE_RATE_NOT_FOUND',

  // Zainbox errors (1500-1599)
  ZAINBOX_CREATE_FAILED = 'ZAINBOX_CREATE_FAILED',
  ZAINBOX_LIST_FAILED = 'ZAINBOX_LIST_FAILED',

  // Generic errors (9000-9999)
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

// Error severity levels
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical'

// Base application error class
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly severity: ErrorSeverity
  public readonly context?: Record<string, unknown>
  public readonly cause?: Error
  public readonly timestamp: Date

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    options: {
      severity?: ErrorSeverity
      context?: Record<string, unknown>
      cause?: Error
    } = {}
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.severity = options.severity || 'error'
    this.context = options.context
    this.cause = options.cause
    this.timestamp = new Date()

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }

  // Convert to JSON for logging/serialization
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      ...(this.cause && { causeMessage: this.cause.message }),
    }
  }

  // Create user-friendly message
  getUserMessage(): string {
    const userMessages: Partial<Record<ErrorCode, string>> = {
      [ErrorCode.MISSING_CONFIG]: 'Application configuration is missing. Please contact support.',
      [ErrorCode.PAYMENT_INIT_FAILED]: 'Unable to start payment. Please try again.',
      [ErrorCode.PAYMENT_VERIFICATION_FAILED]: 'Could not verify payment status. Please contact support.',
      [ErrorCode.API_REQUEST_FAILED]: 'Service temporarily unavailable. Please try again later.',
      [ErrorCode.EXCHANGE_RATE_FETCH_FAILED]: 'Could not fetch exchange rates. Using default values.',
      [ErrorCode.ZAINBOX_CREATE_FAILED]: 'Failed to create Zainbox. Please check your input and try again.',
    }

    return userMessages[this.code] || 'An unexpected error occurred. Please try again.'
  }
}

// Configuration error
export class ConfigError extends AppError {
  constructor(
    message: string,
    missingKey?: string,
    options: { severity?: 'info' | 'warning' | 'error' | 'critical'; cause?: Error } = {}
  ) {
    const context = missingKey ? { missingKey } : undefined
    super(message, ErrorCode.MISSING_CONFIG, {
      ...options,
      context,
    })
    this.name = 'ConfigError'
  }
}

// Payment error
export class PaymentError extends AppError {
  public readonly transactionRef?: string

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.PAYMENT_INIT_FAILED,
    options: {
      transactionRef?: string
      context?: Record<string, unknown>
      cause?: Error
    } = {}
  ) {
    super(message, code, options)
    this.name = 'PaymentError'
    this.transactionRef = options.transactionRef
  }
}

// API error with HTTP status
export class ApiError extends AppError {
  public readonly statusCode?: number
  public readonly endpoint?: string

  constructor(
    message: string,
    options: {
      statusCode?: number
      endpoint?: string
      context?: Record<string, unknown>
      cause?: Error
    } = {}
  ) {
    const code = options.statusCode && options.statusCode >= 500 
      ? ErrorCode.API_REQUEST_FAILED 
      : ErrorCode.API_RESPONSE_ERROR
    
    super(message, code, {
      ...options,
      context: { ...options.context, statusCode: options.statusCode, endpoint: options.endpoint },
    })
    this.name = 'ApiError'
    this.statusCode = options.statusCode
    this.endpoint = options.endpoint
  }
}

// Validation error
export class ValidationError extends AppError {
  public readonly fields?: string[]

  constructor(
    message: string,
    fields?: string[],
    options: { severity?: 'info' | 'warning' | 'error' | 'critical'; cause?: Error } = {}
  ) {
    const context = fields ? { fields } : undefined
    super(message, ErrorCode.VALIDATION_ERROR, {
      ...options,
      severity: 'warning',
      context,
    })
    this.name = 'ValidationError'
    this.fields = fields
  }
}

// Helper to wrap unknown errors into AppError
export function wrapError(error: unknown, defaultMessage: string = 'An error occurred'): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    return new AppError(error.message, ErrorCode.UNKNOWN_ERROR, { cause: error })
  }

  if (typeof error === 'string') {
    return new AppError(error)
  }

  return new AppError(defaultMessage)
}
