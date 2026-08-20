/**
 * Sentry Integration Configuration for SSM-Pay
 * 
 * This module provides Sentry error tracking and performance monitoring.
 * It supports both client-side and server-side Sentry initialization.
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Sentry DSN from environment
 */
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || '';

/**
 * Sample rates for Sentry features
 */
const REPLAYS_ERROR_SAMPLE_RATE = parseFloat(
  process.env.SENTRY_REPLAYS_ERROR_SAMPLE_RATE || '0.1'
);

const REPLAYS_SESSION_SAMPLE_RATE = parseFloat(
  process.env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE || '0.1'
);

/**
 * Profile sample rate (0-1)
 */
const PROFILE_SAMPLE_RATE = parseFloat(
  process.env.SENTRY_PROFILE_SAMPLE_RATE || '0.1'
);

/**
 * Configure Sentry client options
 */
export const sentryClientConfig = {
  dsn: SENTRY_DSN || undefined,
  enabled: !!SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version || '1.0.0',
  dist: process.env.NEXT_BUILD_ID || undefined,

  // Sample rate for errors (1.0 = 100%)
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.2'),

  // Replay configuration
  replaysSessionSampleRate: REPLAYS_SESSION_SAMPLE_RATE,
  replaysOnErrorSampleRate: REPLAYS_ERROR_SAMPLE_RATE,

  // Profiling
  profilesSampleRate: PROFILE_SAMPLE_RATE,

  // Initial scope data
  initialScope: {
    tags: {
      platform: 'web',
      application: 'ssm-pay',
    },
    user: {
      id: typeof window !== 'undefined' ? localStorage.getItem('userId') : undefined,
    },
  },

  // Ignore specific errors
  ignoreErrors: [
    // Network errors that aren't actionable
    /NetworkError/i,
    /Failed to fetch/i,
    /Network request failed/i,
    /Loading chunk \d+ failed/i,
    /Loading CSS chunk \d+ failed/i,
    
    // Third-party script errors
    /Non-Error promise rejection captured/i,
    /ResizeObserver loop limit exceeded/i,
    
    // Browser extensions
    /Extension context invalidated/i,
  ],

  // Deny URLs from reporting
  denyUrls: [
    // Browser extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    
    // Ad networks and analytics
    /google-analytics\.com/i,
    /googletagmanager\.com/i,
    /doubleclick\.net/i,
    
    // Social media widgets
    /facebook\.com\/plugins/i,
    /connect\.facebook\.net/i,
    /platform\.twitter\.com/i,
  ],

  // Before send hook for additional processing
  beforeSend(event) {
    // Add custom context
    event.contexts = {
      ...event.contexts,
      app: {
        name: 'SSM-Pay',
        version: process.env.npm_package_version || 'unknown',
      },
    };

    // Filter out PII from breadcrumbs if needed
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => ({
        ...breadcrumb,
        // Remove potential PII from data
        data: breadcrumb.data ? filterPii(breadcrumb.data) : undefined,
      }));
    }

    return event;
  },

  integrations: [],
};

/**
 * Configure Sentry server options
 */
export const sentryServerConfig = {
  dsn: SENTRY_DSN || undefined,
  enabled: !!SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version || '1.0.0',

  // Sample rate for distributed tracing
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.2'),

  // Profiling
  profilesSampleRate: PROFILE_SAMPLE_RATE,

  // Initial scope
  initialScope: {
    tags: {
      platform: 'server',
      runtime: process.version,
      nodeEnv: process.env.NODE_ENV,
      application: 'ssm-pay',
    },
  },

  // Server-specific ignore patterns
  ignoreErrors: [
    /NetworkError/i,
    /ECONNREFUSED/i,
    /ECONNRESET/i,
    /ETIMEDOUT/i,
  ],

  // Before send for server-side
  beforeSend(event, hint) {
    // Log the error locally as well
    const error = hint?.originalException || hint?.syntheticException;
    if (error) {
      console.error('[Sentry]', error instanceof Error ? error.message : error);
    }

    // Add server-specific context
    event.contexts = {
      ...event.contexts,
      server: {
        hostname: process.env.HOSTNAME || 'unknown',
        pid: process.pid,
        memoryUsage: process.memoryUsage(),
      },
    };

    return event;
  },
};

/**
 * Filter potentially PII-sensitive data
 */
function filterPii(data: Record<string, unknown>): Record<string, unknown> {
  const piiFields = [
    'email',
    'password',
    'cardNumber',
    'cvv',
    'accountNumber',
    'ssn',
    'phoneNumber',
    'firstName',
    'lastName',
  ];

  const filtered = { ...data };

  for (const field of piiFields) {
    if (field in filtered && filtered[field]) {
      filtered[field] = '[Filtered]';
    }
  }

  return filtered;
}

/**
 * Set user context in Sentry
 */
export function setSentryUser(user: {
  id?: string;
  email?: string;
  username?: string;
}): void {
  Sentry.setUser(user);
}

/**
 * Set extra tags for better filtering
 */
export function setSentryTags(tags: Record<string, string>): void {
  Object.entries(tags).forEach(([key, value]) => {
    Sentry.setTag(key, value);
  });
}

/**
 * Capture an exception with additional context
 */
export function captureException(
  error: Error | unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    level?: Sentry.SeverityLevel;
  }
): string {
  return Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
    level: context?.level,
  });
}

/**
 * Capture a message as a breadcrumb or event
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): string {
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Add a breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  });
}

/**
 * Start a transaction span for performance tracking
 */
export function startTransaction(name: string, op: string): Sentry.Transaction | undefined {
  if (!SENTRY_DSN) return undefined;
  
  return Sentry.startTransaction({
    name,
    op,
    trimEnd: true,
  });
}

/**
 * Check if Sentry is properly configured
 */
export function isSentryEnabled(): boolean {
  return !!SENTRY_DSN && SENTRY_DSN !== 'https://examplePublicKey@o0.ingest.sentry.io/0';
}

export { Sentry };
export default Sentry;
