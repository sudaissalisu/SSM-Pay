/**
 * Server-Side Sentry Configuration
 * 
 * This file configures Sentry for server-side error tracking in Next.js.
 * It captures:
 * - API route errors
 * - Server-side rendering errors
 * - Server action errors
 * - Database operation errors
 */

import { initSentry, captureError, setUserContext, clearUserContext, setTag, setContext } from '@/lib/sentry'

/**
 * Initialize server-side Sentry
 * Call this in middleware or root layout (server component)
 */
export function initServerSentry(): void {
  initSentry()
  
  // Add server-specific tags after initialization
  setTag('runtime', 'server')
  setTag('node_version', process.version)
}

/**
 * Wrap an async handler with Sentry error tracking
 * Useful for API routes and server actions
 * 
 * @example
 * export const GET = withErrorTracking(async (req) => {
 *   return Response.json({ data: 'success' })
 * })
 */
export function withErrorTracking<TArgs extends unknown[], TReturn>(
  handler: (...args: TArgs) => Promise<TReturn>,
  options?: {
    name?: string
    context?: Record<string, unknown>
  }
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const startTime = Date.now()
    
    try {
      const result = await handler(...args)
      return result
    } catch (error) {
      // Capture error with timing info
      captureError(error, {
        ...options?.context,
        handlerName: options?.name || handler.name,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      })
      
      // Re-throw to allow normal error handling
      throw error
    }
  }
}

/**
 * Create a logger wrapper that also sends errors to Sentry
 * Integrates structured logging with error tracking
 */
export function createSentryLogger(moduleName: string) {
  const { logger } = await import('@/lib/logger')
  const childLogger = logger.child(moduleName)
  
  return {
    debug: (message: string, meta?: Record<string, unknown>) => 
      childLogger.debug(message, meta),
    
    info: (message: string, meta?: Record<string, unknown>) => 
      childLogger.info(message, meta),
    
    warn: (message: string, meta?: Record<string, unknown>) => 
      childLogger.warn(message, meta),
    
    error: (message: string, error?: Error, meta?: Record<string, unknown>) => {
      childLogger.error(message, { error, ...meta })
      if (error) {
        captureError(error, { module: moduleName, message, ...meta })
      }
    },
  }
}

// Re-export core functions
export { captureError, setUserContext, clearUserContext, setTag, setContext }

export default initServerSentry
