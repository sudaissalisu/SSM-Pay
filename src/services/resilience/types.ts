/**
 * Resilience Pattern Types for SSM-Pay Payment Platform
 * Defines interfaces for circuit breaker, retry, bulkhead, and fallback patterns
 */

/** Circuit breaker states */
export enum CircuitState {
  /** Normal operation - requests flow through */
  CLOSED = 'closed',
  /** Failure threshold reached - requests are blocked */
  OPEN = 'open',
  /** Testing if service has recovered - limited requests allowed */
  HALF_OPEN = 'half_open',
}

/** Events emitted by circuit breaker */
export enum CircuitEventType {
  STATE_CHANGED = 'state_changed',
  SUCCESS = 'success',
  FAILURE = 'failure',
  SHORT_CIRCUITED = 'short_circuited',
  TIMEOUT = 'timeout',
  RESET = 'reset',
}

/** Circuit breaker event payload */
export interface CircuitEvent {
  type: CircuitEventType;
  state: CircuitState;
  previousState?: CircuitState;
  timestamp: string;
  durationMs?: number;
  error?: Error;
}

/** Circuit breaker configuration */
export interface CircuitBreakerConfig {
  /** Name/identifier for this circuit breaker */
  name: string;
  /** Number of failures before opening */
  failureThreshold: number;
  /** Time in OPEN state before trying HALF_OPEN (ms) */
  resetTimeoutMs: number;
  /** Number of successes in HALF_OPEN before closing */
  halfOpenMaxAttempts: number;
  /** Percentage of successes required to close from HALF_OPEN */
  halfOpenSuccessThreshold: number;
  /** Whether to track success rate over time window */
  enableSuccessRateTracking: boolean;
  /** Window for success rate calculation (ms) */
  successRateWindowMs: number;
  /** Minimum success rate percentage to stay closed */
  minimumSuccessRate: number;
  /** Volume of requests needed before evaluating success rate */
  minimumVolume: number;
}

/** Default circuit breaker configuration */
export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  name: 'default',
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 3,
  halfOpenSuccessThreshold: 50,
  enableSuccessRateTracking: true,
  successRateWindowMs: 60000,
  minimumSuccessRate: 90,
  minimumVolume: 10,
};

/** Retry strategy types */
export enum RetryStrategy {
  /** Fixed delay between attempts */
  FIXED = 'fixed',
  /** Exponentially increasing delay */
  EXPONENTIAL = 'exponential',
  /** Exponential with random jitter */
  EXPONENTIAL_JITTER = 'exponential_jitter',
  /** Linear backoff */
  LINEAR = 'linear',
  /** No retry - fail immediately */
  NONE = 'none',
}

/** Error classification for retry decisions */
export enum ErrorClass {
  /** Should always retry (transient) */
  RETRYABLE = 'retryable',
  /** Should never retry (permanent) */
  NON_RETRYABLE = 'non_retryable',
  /** Use default strategy */
  UNKNOWN = 'unknown',
}

/** Retry handler configuration */
export interface RetryConfig {
  /** Strategy to use */
  strategy: RetryStrategy;
  /** Maximum number of attempts (including first) */
  maxAttempts: number;
  /** Initial delay between retries (ms) */
  initialDelayMs: number;
  /** Maximum delay cap (ms) */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  multiplier: number;
  /** Enable jitter for exponential strategies */
  jitterEnabled: boolean;
  /** Jitter factor (0-1) */
  jitterFactor: number;
  /** List of error types that should be retried */
  retryableErrors: string[];
  /** HTTP status codes to retry */
  retryableStatusCodes: number[];
  /** Callback before each retry attempt */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/** Default retry configuration */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  strategy: RetryStrategy.EXPONENTIAL_JITTER,
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
  jitterEnabled: true,
  jitterFactor: 0.5,
  retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'],
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/** Bulkhead configuration */
export interface BulkheadConfig {
  /** Name/identifier for this bulkhead */
  name: string;
  /** Maximum concurrent executions */
  maxConcurrent: number;
  /** Maximum number waiting in queue */
  maxWaitQueue: number;
  /** Maximum wait time in queue before rejection (ms) */
  maxWaitTimeMs: number;
  /** Timeout for individual executions (ms) */
  executionTimeoutMs: number;
}

/** Default bulkhead configuration */
export const DEFAULT_BULKHEAD_CONFIG: BulkheadConfig = {
  name: 'default',
  maxConcurrent: 10,
  maxWaitQueue: 20,
  maxWaitTimeMs: 5000,
  executionTimeoutMs: 30000,
}

/** Fallback result wrapper */
export interface FallbackResult<T> {
  /** Whether fallback was used */
  usedFallback: boolean;
  /** The result value (from original or fallback) */
  value: T | undefined;
  /** Error if both original and fallback failed */
  error?: Error;
  /** Execution metadata */
  meta: {
    originalSucceeded: boolean;
    fallbackSucceeded: boolean;
    attempts: number;
    totalDurationMs: number;
  };
}

/** Fallback function signature */
export type FallbackFn<T> = (error: Error, context: Record<string, unknown>) => Promise<T> | T;

/** Fallback registration */
export interface FallbackRegistration<T> {
  /** Operation name this fallback is for */
  operationName: string;
  /** The fallback function */
  fn: FallbackFn<T>;
  /** Priority (lower = higher priority) */
  priority: number;
  /** Whether this fallback is enabled */
  enabled: boolean;
  /** Created at timestamp */
  createdAt: string;
}

/** Resilience execution context passed through all patterns */
export interface ResilienceContext {
  /** Operation being executed */
  operation: string;
  /** Request/correlation ID */
  requestId?: string;
  /** User ID if applicable */
  userId?: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/** Combined resilience policy configuration */
export interface ResiliencePolicy {
  /** Policy name */
  name: string;
  /** Circuit breaker config (optional) */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Retry config (optional) */
  retry?: Partial<RetryConfig>;
  /** Bulkhead config (optional) */
  bulkhead?: Partial<BulkheadConfig>;
  /** Timeout in ms (optional) */
  timeoutMs?: number;
}
