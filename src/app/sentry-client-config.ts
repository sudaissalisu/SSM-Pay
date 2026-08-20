/**
 * Client-Side Sentry Configuration
 * 
 * This file configures Sentry for browser-side error tracking.
 * It captures:
 * - JavaScript errors
 * - Unhandled promise rejections
 * - UI interaction errors
 * - Performance data (if tracing enabled)
 */

import * as Sentry from '@sentry/nextjs'
import { captureError, setUserContext, clearUserContext } from '@/lib/sentry'

/**
 * Initialize client-side Sentry
 * Call this in your root layout or _app component
 */
export function initClientSentry(): void {
  // Only initialize if DSN is configured and we're in browser
  if (typeof window === 'undefined') {
    return
  }

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN
  
  if (!dsn) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Sentry Client] Not initialized: DSN not configured')
    }
    return
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'production',
      enabled: process.env.SENTRY_ENABLED !== 'false',
      
      // Performance monitoring
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      
      // Session replay (optional, requires additional setup)
      replaysSessionSampleRate: parseFloat(process.env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE || '0'),
      replaysOnErrorSampleRate: parseFloat(process.env.SENTRY_REPLAYS_ERROR_SAMPLE_RATE || '0.1'),
      
      // Filter out noisy errors
      ignoreErrors: [
        // Common browser extensions errors
        /Extension context invalidated/,
        /Network request failed/,
        /Loading chunk \d+ failed/,
        /Loading CSS chunk \d+ failed/,
        // Non-critical errors
        /ResizeObserver loop limit exceeded/,
        /Request aborted/,
      ],
      
      // Sanitize before sending
      beforeSend(event) {
        // Remove PII from user
        if (event.user) {
          delete event.user.email
          delete event.user.ip_address
        }
        
        // Add client info
        event.tags = {
          ...event.tags,
          runtime: 'browser',
          url: typeof window !== 'undefined' ? window.location.pathname : undefined,
        }
        
        return event
      },
      
      // Initial scope
      initialScope: {
        tags: {
          runtime: 'browser',
        },
      },
    })

    // Set up global error handlers for better UX feedback
    setupGlobalHandlers()
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Sentry Client] Initialized successfully')
    }
  } catch (error) {
    console.error('[Sentry Client] Failed to initialize:', error)
  }
}

/**
 * Set up global error handlers that provide user feedback
 */
function setupGlobalHandlers(): void {
  if (typeof window === 'undefined') return

  // Capture unhandled promise rejections with user context
  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason, {
      type: 'unhandledrejection',
      timestamp: new Date().toISOString(),
    })
  })
}

// Re-export convenience functions for client usage
export { captureError, setUserContext, clearUserContext }

// Default export for easy importing
export default initClientSentry
