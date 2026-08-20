/**
 * Sentry Error Tracking Integration for SSM Pay
 * 
 * Provides centralized error tracking with:
 * - Automatic error capture and reporting
 * - Sensitive data sanitization
 * - User context management
 * - Performance tracing support
 */

import * as Sentry from '@sentry/nextjs'

// Configuration types
interface SentryConfig {
  dsn: string
  environment: string
  enabled: boolean
  tracesSampleRate: number
  profilesSampleRate?: number
}

interface SentryUser {
  id: string
  email?: string
  username?: string
}

interface ErrorContext {
  [key: string]: unknown
}

/**
 * Build Sentry configuration from environment variables
 */
function buildConfig(): SentryConfig | null {
  const dsn = process.env.SENTRY_DSN
  
  if (!dsn) {
    return null
  }

  return {
    dsn,
    environment: process.env.NODE_ENV || 'development',
    enabled: process.env.SENTRY_ENABLED !== 'false', // Enabled by default if DSN is set
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0'),
  }
}

/**
 * Fields to sanitize from Sentry events (PII protection)
 */
const SENSITIVE_FIELDS = [
  'email',
  'ip_address',
  'password',
  'ssn',
  'credit_card',
  'card_number',
  'cvv',
  'api_key',
  'secret',
  'token',
  'authorization',
]

/**
 * Check if a field name is sensitive and should be sanitized
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase()
  return SENSITIVE_FIELDS.some(sensitive => 
    lowerField.includes(sensitive) || 
    lowerField.replace(/[_-]/g, '').includes(sensitive)
  )
}

/**
 * Recursively sanitize sensitive data from an object
 */
function sanitizeData(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item))
  }

  const sanitized: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isSensitiveField(key)) {
      sanitized[key] = '[REDACTED]'
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeData(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

let isInitialized = false

/**
 * Initialize Sentry for error tracking
 * Should be called once at application startup
 * 
 * @example
 * // In your app layout or entry point
 * import { initSentry } from '@/lib/sentry'
 * initSentry()
 */
export function initSentry(): void {
  // Prevent double initialization
  if (isInitialized) {
    return
  }

  const config = buildConfig()

  if (!config) {
    // Sentry not configured, skip initialization
    if (process.env.NODE_ENV === 'development') {
      console.log('[Sentry] Not initialized: SENTRY_DSN not configured')
    }
    return
  }

  try {
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      enabled: config.enabled,
      tracesSampleRate: config.tracesSampleRate,
      profilesSampleRate: config.profilesSampleRate,
      
      /**
       * Before sending event to Sentry:
       * - Sanitize user PII
       * - Remove sensitive headers/cookies
       */
      beforeSend(event) {
        // Sanitize user data
        if (event.user) {
          delete event.user.email
          delete event.user.ip_address
          delete event.user.username
        }

        // Sanitize request data
        if (event.request?.headers) {
          event.request.headers = sanitizeData(event.request.headers) as Record<string, string>
        }

        if (event.request?.cookies) {
          event.request.cookies = '[REDACTED]'
        }

        // Sanitize extra context
        if (event.contexts) {
          event.contexts = sanitizeData(event.contexts) as Sentry.Event['contexts']
        }

        // Add application info tags
        event.tags = {
          ...event.tags,
          application: 'ssm-pay',
        }

        return event
      },

      /**
       * Filter out expected errors that don't need tracking
       */
      beforeBreadcrumb(breadcrumb) {
        // Filter out noisy console breadcrumbs in production
        if (breadcrumb.category === 'console' && config.environment === 'production') {
          return null
        }

        return breadcrumb
      },

      // Set initial scope values
      initialScope: {
        tags: {
          version: process.env.npm_package_version || 'unknown',
        },
      },
    })

    isInitialized = true

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Sentry] Initialized successfully (env: ${config.environment})`)
    }
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error)
  }
}

/**
 * Capture an exception with optional context data
 * 
 * @param error - The error to capture
 * @param context - Additional context to attach to the error
 * @param level - Severity level (default: 'error')
 * 
 * @example
 * try {
 *   await riskyOperation()
 * } catch (error) {
 *   captureError(error, { operation: 'riskyOperation', userId: '123' })
 * }
 */
export function captureError(
  error: unknown,
  context?: ErrorContext,
  level: Sentry.SeverityLevel = 'error'
): void {
  if (!isInitialized) {
    return
  }

  try {
    // Sanitize context before sending
    const sanitizedContext = context ? sanitizeData(context) : undefined

    Sentry.captureException(error, {
      level,
      extra: sanitizedContext,
      tags: {
        captured: 'manual',
      },
    })
  } catch (e) {
    // Don't let Sentry errors crash the app
    console.error('[Sentry] Failed to capture error:', e)
  }
}

/**
 * Capture a message as an event (for non-error logging to Sentry)
 * 
 * @param message - The message to send
 * @param level - Severity level
 * @param context - Additional context
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: ErrorContext
): void {
  if (!isInitialized) {
    return
  }

  try {
    const sanitizedContext = context ? sanitizeData(context) : undefined

    Sentry.captureMessage(message, {
      level,
      extra: sanitizedContext,
    })
  } catch (e) {
    console.error('[Sentry] Failed to capture message:', e)
  }
}

/**
 * Set user context for subsequent errors
 * 
 * @param user - User identification data
 * 
 * @example
 * // After authentication
 * setUserContext({ id: '123', email: 'user@example.com' })
 */
export function setUserContext(user: SentryUser): void {
  if (!isInitialized) {
    return
  }

  try {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    })
  } catch (e) {
    console.error('[Sentry] Failed to set user context:', e)
  }
}

/**
 * Clear the current user context (e.g., on logout)
 */
export function clearUserContext(): void {
  if (!isInitialized) {
    return
  }

  try {
    Sentry.setUser(null)
  } catch (e) {
    console.error('[Sentry] Failed to clear user context:', e)
  }
}

/**
 * Set a tag for filtering in Sentry
 * 
 * @param key - Tag name
 * @param value - Tag value
 */
export function setTag(key: string, value: string): void {
  if (!isInitialized) {
    return
  }

  try {
    Sentry.setTag(key, value)
  } catch (e) {
    console.error('[Sentry] Failed to set tag:', e)
  }
}

/**
 * Set additional context data
 * 
 * @param key - Context name
 * @param data - Context data (will be sanitized)
 */
export function setContext(key: string, data: Record<string, unknown>): void {
  if (!isInitialized) {
    return
  }

  try {
    const sanitizedData = sanitizeData(data) as Record<string, unknown>
    Sentry.setContext(key, sanitizedData)
  } catch (e) {
    console.error('[Sentry] Failed to set context:', e)
  }
}

/**
 * Start a performance transaction span
 * Useful for measuring specific operations
 * 
 * @param name - Transaction name
 * @param op - Operation type
 * @returns Transaction object or null if not initialized
 */
export function startTransaction(
  name: string,
  op: string
): Sentry.Transaction | null {
  if (!isInitialized) {
    return null
  }

  try {
    return Sentry.startTransaction({
      name,
      op,
    })
  } catch (e) {
    console.error('[Sentry] Failed to start transaction:', e)
    return null
  }
}

/**
 * Check if Sentry is properly initialized and enabled
 */
export function isSentryEnabled(): boolean {
  return isInitialized
}

// Export Sentry for advanced usage if needed
export { Sentry }
