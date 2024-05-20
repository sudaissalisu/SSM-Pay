/**
 * Enterprise Circuit Breaker & Resilience Patterns Library
 * for SSM-Pay Payment Platform
 *
 * This module provides comprehensive resilience patterns including:
 * - Circuit Breaker (closed/open/half-open states)
 * - Retry with exponential backoff
 * - Bulkhead isolation
 * - Timeout handling
 * - Fallback mechanisms
 * - Rate limiting integration
 * - Health check callbacks
 * - State persistence and recovery
 *
 * @module services/resilience
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode, wrapError } from '@/lib/errors';

// ============== Type Definitions ==============

/**
 * Circuit Breaker States
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Result of a circuit breaker protected execution
 */
export interface ExecutionResult<T> {
  /** Whether execution was successful */
  success: boolean;
  /** The result value (if successful) */
  value?: T;
  /** The error (if failed) */
  error?: Error;
  /** Execution metrics */
  metrics: ExecutionMetrics;
}

/**
 * Metrics collected during execution
 */
export interface ExecutionMetrics {
  /** Total time taken in milliseconds */
  durationMs: number;
  /** Number of retry attempts */
  attempts: number;
  /** Whether circuit breaker was used */
  circuitBreakerUsed: boolean;
  /** Whether fallback was invoked */
  fallbackInvoked: boolean;
  /** Timestamp of execution */
  timestamp: Date;
}

/**
 * Configuration options for Circuit Breaker
 */
export interface CircuitBreakerConfig {
  /** Unique name/identifier for this circuit breaker */
  name: string;
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting to reset (default: 30000) */
  resetTimeout?: number;
  /** Number of successful calls in half-open to close circuit (default: 3) */
  halfOpenSuccessThreshold?: number;
  /** Percentage of calls that can fail before opening (default: 50) */
  failureRateThreshold?: number;
  /** Minimum number of calls to calculate rate (default: 10) */
  volumeThreshold?: number;
  /** Window size in ms for sliding window (default: 60000) */
  slidingWindowSize?: number;
  /** Number of buckets in sliding window (default: 10) */
  slidingWindowBuckets?: number;
  /** Whether to record slow calls as failures (default: true) */
  slowCallDurationEnabled?: boolean;
  /** Duration in ms to consider a call slow (default: 5000) */
  slowCallDurationThreshold?: number;
  /** Enable automatic state persistence (default: false) */
  enablePersistence?: boolean;
  /** Custom event handler for state changes */
  onStateChange?: (state: CircuitState, previousState: CircuitState) => void;
}

/**
 * Statistics snapshot for circuit breaker
 */
export interface CircuitBreakerStats {
  /** Current state */
  state: CircuitState;
  /** Total number of successful calls */
  successfulCalls: number;
  /** Total number of failed calls */
  failedCalls: number;
  /** Total number of rejected calls (circuit open) */
  rejectedCalls: number;
  /** Current failure rate percentage */
  failureRate: number;
  /** Number of slow calls */
  slowCalls: number;
  /** When the circuit was last opened (if applicable) */
  openedAt?: Date;
  /** When the circuit can next attempt half-open (if applicable) */
  nextRetryAt?: Date;
}

/**
 * Sliding window bucket for tracking call statistics
 */
interface SlidingWindowBucket {
  /** Start time of this bucket */
  startTime: number;
  /** Number of successful calls */
  successful: number;
  /** Number of failed calls */
  failed: number;
  /** Number of slow calls */
  slow: number;
  /** Number of total calls */
  total: number;
}

/**
 * Persisted circuit breaker state for recovery
 */
export interface PersistedCircuitState {
  /** Circuit breaker name */
  name: string;
  /** Current state */
  state: CircuitState;
  /** When state was last updated */
  updatedAt: string;
  /** Failure count at time of persist */
  failureCount: number;
  /** When circuit was opened (if applicable) */
  openedAt?: string;
  /** Version for migration support */
  version: number;
}

/**
 * Configuration options for Retry with backoff
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay between retries (default: 30000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2.0) */
  multiplier?: number;
  /** Add randomness to prevent thundering herd (default: 0.1 = 10%) */
  jitterFactor?: number;
  /** Errors that should trigger retry (empty = all errors) */
  retryableErrors?: ErrorCode[];
  /** HTTP status codes that trigger retry (empty = all 5xx) */
  retryableStatusCodes?: number[];
  /** Callback before each retry attempt */
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Configuration options for Bulkhead pattern
 */
export interface BulkheadConfig {
  /** Unique name for this bulkhead */
  name: string;
  /** Maximum concurrent executions (default: 10) */
  maxConcurrent?: number;
  /** Maximum number of waiting tasks in queue (default: 50) */
  maxWaitQueueLength?: number;
  /** Timeout in ms for queue wait (default: 5000) */
  maxWaitTimeMs?: number;
}

/**
 * Statistics for bulkhead
 */
export interface BulkheadStats {
  /** Current number of running executions */
  currentRunning: number;
  /** Current number of waiting tasks */
  currentWaiting: number;
  /** Total accepted executions */
  totalAccepted: number;
  /** Total rejected executions */
  totalRejected: number;
}

/**
 * Configuration options for Timeout
 */
export interface TimeoutConfig {
  /** Timeout duration in milliseconds (default: 10000) */
  timeoutMs?: number;
  /** Whether to cancel the operation on timeout (default: true) */
  cancelOnTimeout?: boolean;
  /** Custom error message on timeout */
  timeoutErrorMessage?: string;
}

/**
 * Fallback function type
 */
export type FallbackFunction<T> = (error: Error, context: Record<string, unknown>) => T | Promise<T>;

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Whether the service is healthy */
  healthy: boolean;
  /** Additional health details */
  details: Record<string, unknown>;
  /** When check was performed */
  checkedAt: Date;
  /** Optional latency measurement */
  latencyMs?: number;
}

/**
 * Health check callback function
 */
export type HealthCheckCallback = () => Promise<HealthCheckResult>;

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum requests allowed in window (default: 100) */
  limit?: number;
  /** Time window in ms (default: 60000) */
  windowMs?: number;
  /** Name/key for this limiter */
  key?: string;
}

/**
 * Combined resilience configuration for easy setup
 */
export interface ResilienceConfig {
  /** Circuit breaker configuration */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** Bulkhead configuration */
  bulkhead?: Partial<BulkheadConfig>;
  /** Timeout configuration */
  timeout?: Partial<TimeoutConfig>;
  /** Fallback function */
  fallback?: FallbackFunction<unknown>;
  /** Health check callback */
  healthCheck?: HealthCheckCallback;
  /** Rate limiter configuration */
  rateLimiter?: Partial<RateLimiterConfig>;
}

// ============== Circuit Breaker Implementation ==============

/**
 * Enterprise Circuit Breaker Implementation
 *
 * Implements the circuit breaker pattern with three states:
 * - CLOSED: Normal operation, requests pass through and statistics are recorded
 * - OPEN: Circuit is tripped, requests fail fast without calling the service
 * - HALF_OPEN: Testing state, limited requests are allowed through to test recovery
 *
 * Features:
 * - Sliding window for failure rate calculation
 * - Configurable thresholds
 * - State change callbacks
 * - Persistence support
 * - Health check integration
 */
export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig> & { name: string };
  private state: CircuitState = 'CLOSED';
  private previousState: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private openedAt: Date | null = null;
  private stats: CircuitBreakerStats;
  private slidingWindowBuckets: SlidingWindowBucket[] = [];
  private healthCheckCallback: HealthCheckCallback | null = null;

  // Counters for statistics
  private totalSuccessfulCalls: number = 0;
  private totalFailedCalls: number = 0;
  private totalRejectedCalls: number = 0;
  private totalSlowCalls: number = 0;

  static readonly DEFAULT_CONFIG: Omit<Required<CircuitBreakerConfig>, 'name'> = {
    failureThreshold: 5,
    resetTimeout: 30000,
    halfOpenSuccessThreshold: 3,
    failureRateThreshold: 50,
    volumeThreshold: 10,
    slidingWindowSize: 60000,
    slidingWindowBuckets: 10,
    slowCallDurationEnabled: true,
    slowCallDurationThreshold: 5000,
    enablePersistence: false,
    onStateChange: undefined,
  };

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      ...CircuitBreaker.DEFAULT_CONFIG,
      ...config,
    };

    this.stats = this.initializeStats();

    // Initialize sliding window buckets
    this.initializeSlidingWindow();

    logger.info('Circuit breaker initialized', {
      event: 'circuit-breaker.init',
      metadata: {
        name: this.config.name,
        failureThreshold: this.config.failureThreshold,
        resetTimeout: this.config.resetTimeout,
      },
    });
  }

  /**
   * Execute a function through the circuit breaker
   *
   * @param fn - The function to execute
   * @returns Result of the function or throws if circuit is open
   * @throws {AppError} If circuit is open or execution fails
   */
  async execute<T>(fn: () => T | Promise<T>): Promise<T> {
    const startTime = Date.now();

    // Check if we can execute
    if (!this.canExecute()) {
      this.totalRejectedCalls++;
      const error = new AppError(
        `Circuit breaker '${this.config.name}' is open - rejecting request`,
        ErrorCode.API_REQUEST_FAILED,
        { severity: 'warning', context: { state: this.state, name: this.config.name } }
      );
      
      logger.warn('Circuit breaker rejected request', {
        event: 'circuit-breaker.rejected',
        metadata: { name: this.config.name, state: this.state },
        error,
      });
      
      throw error;
    }

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.recordSuccess(duration);
      return result;
    } catch (error) {
      const wrappedError = wrapError(error);
      this.recordFailure();
      
      logger.warn('Circuit breaker recorded failure', {
        event: 'circuit-breaker.failure',
        metadata: {
          name: this.config.name,
          state: this.state,
          failureCount: this.failureCount,
        },
        error: wrappedError,
      });
      
      throw wrappedError;
    }
  }

  /**
   * Check if execution is allowed based on current state
   */
  canExecute(): boolean {
    switch (this.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        // Check if reset timeout has elapsed
        if (this.openedAt && Date.now() >= this.openedAt.getTime() + this.config.resetTimeout) {
          this.transitionTo('HALF_OPEN');
          return true;
        }
        return false;

      case 'HALF_OPEN':
        // In half-open, allow limited traffic through
        return true;

      default:
        return true;
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    // Auto-check for state transitions
    if (this.state === 'OPEN' && this.openedAt) {
      const elapsed = Date.now() - this.openedAt.getTime();
      if (elapsed >= this.config.resetTimeout) {
        this.transitionTo('HALF_OPEN');
      }
    }
    return this.state;
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): CircuitBreakerStats {
    this.updateStatsFromWindow();
    return { ...this.stats };
  }

  /**
   * Manually trip the circuit (open it)
   */
  trip(): void {
    if (this.state !== 'OPEN') {
      this.transitionTo('OPEN');
      logger.warn('Circuit breaker manually tripped', {
        event: 'circuit-breaker.trip',
        metadata: { name: this.config.name, previousState: this.previousState },
      });
    }
  }

  /**
   * Manually reset the circuit (close it)
   */
  reset(): void {
    if (this.state !== 'CLOSED') {
      this.transitionTo('CLOSED');
      logger.info('Circuit breaker manually reset', {
        event: 'circuit-breaker.reset',
        metadata: { name: this.config.name, previousState: this.previousState },
      });
    }
  }

  /**
   * Set health check callback for proactive monitoring
   */
  setHealthCheck(callback: HealthCheckCallback): void {
    this.healthCheckCallback = callback;
    logger.debug('Health check callback set', {
      event: 'circuit-breaker.health-check.set',
      metadata: { name: this.config.name },
    });
  }

  /**
   * Perform health check and update state accordingly
   */
  async performHealthCheck(): Promise<HealthCheckResult | null> {
    if (!this.healthCheckCallback) {
      return null;
    }

    const startTime = Date.now();
    
    try {
      const result = await this.healthCheckCallback();
      result.latencyMs = Date.now() - startTime;

      if (!result.healthy && this.state === 'HALF_OPEN') {
        this.transitionTo('OPEN');
      } else if (result.healthy && this.state === 'OPEN') {
        this.transitionTo('HALF_OPEN');
      }

      logger.debug('Health check completed', {
        event: 'circuit-breaker.health-check',
        metadata: {
          name: this.config.name,
          healthy: result.healthy,
          latencyMs: result.latencyMs,
        },
      });

      return result;
    } catch (error) {
      logger.error('Health check failed', {
        event: 'circuit-breaker.health-check.error',
        metadata: { name: this.config.name },
        error: error as Error,
      });

      if (this.state === 'HALF_OPEN') {
        this.transitionTo('OPEN');
      }

      return {
        healthy: false,
        details: { error: (error as Error).message },
        checkedAt: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Persist current state for recovery after restart
   */
  async persistState(storage?: { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void> }): Promise<PersistedCircuitState> {
    if (!this.config.enablePersistence || !storage) {
      // Return state without storage
      const state = this.createPersistedState();
      logger.debug('Circuit breaker state prepared for persistence', {
        event: 'circuit-breaker.persist',
        metadata: { name: this.config.name, state: state.state },
      });
      return state;
    }

    const state = this.createPersistedState();
    const key = `circuit-breaker:${this.config.name}`;
    
    try {
      await storage.set(key, JSON.stringify(state));
      logger.info('Circuit breaker state persisted', {
        event: 'circuit-breaker.persisted',
        metadata: { name: this.config.name, state: state.state },
      });
    } catch (error) {
      logger.error('Failed to persist circuit breaker state', {
        event: 'circuit-breaker.persist.error',
        metadata: { name: this.config.name },
        error: error as Error,
      });
    }

    return state;
  }

  /**
   * Recover persisted state after restart
   */
  async recoverState(storage?: { get: (key: string) => Promise<string | null> }): Promise<boolean> {
    if (!storage) {
      return false;
    }

    const key = `circuit-breaker:${this.config.name}`;

    try {
      const data = await storage.get(key);
      if (!data) {
        return false;
      }

      const persisted: PersistedCircuitState = JSON.parse(data);

      // Validate version compatibility
      if (persisted.version > 1) {
        logger.warn('Unknown persisted state version', {
          event: 'circuit-breaker.recover.version-warning',
          metadata: { name: this.config.name, version: persisted.version },
        });
        return false;
      }

      // Check if state is still relevant (not too old)
      const updatedAt = new Date(persisted.updatedAt);
      const age = Date.now() - updatedAt.getTime();

      // Don't recover if state is older than reset timeout
      if (age > this.config.resetTimeout * 2) {
        logger.info('Persisted state too old, starting fresh', {
          event: 'circuit-breaker.recover.expired',
          metadata: { name: this.config.name, ageMs: age },
        });
        return false;
      }

      // Restore state
      this.state = persisted.state;
      this.failureCount = persisted.failureCount;
      
      if (persisted.openedAt) {
        this.openedAt = new Date(persisted.openedAt);
        // Adjust openedAt to account for downtime
        const adjustedOpenTime = Date.now() - (updatedAt.getTime() - this.openedAt.getTime());
        this.openedAt = new Date(adjustedOpenTime);
      }

      logger.info('Circuit breaker state recovered', {
        event: 'circuit-breaker.recovered',
        metadata: {
          name: this.config.name,
          state: this.state,
          failureCount: this.failureCount,
          ageMs: age,
        },
      });

      return true;
    } catch (error) {
      logger.error('Failed to recover circuit breaker state', {
        event: 'circuit-breaker.recover.error',
        metadata: { name: this.config.name },
        error: error as Error,
      });
      return false;
    }
  }

  /**
   * Destroy the circuit breaker instance
   */
  destroy(): void {
    this.slidingWindowBuckets = [];
    this.healthCheckCallback = null;
    
    logger.info('Circuit breaker destroyed', {
      event: 'circuit-breaker.destroy',
      metadata: { name: this.config.name },
    });
  }

  // ============== Private Methods ==============

  private initializeStats(): CircuitBreakerStats {
    return {
      state: this.state,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      failureRate: 0,
      slowCalls: 0,
    };
  }

  private initializeSlidingWindow(): void {
    const now = Date.now();
    const bucketSize = this.config.slidingWindowSize / this.config.slidingWindowBuckets;
    
    this.slidingWindowBuckets = [];
    for (let i = 0; i < this.config.slidingWindowBuckets; i++) {
      this.slidingWindowBuckets.push({
        startTime: now - (this.config.slidingWindowBuckets - 1 - i) * bucketSize,
        successful: 0,
        failed: 0,
        slow: 0,
        total: 0,
      });
    }
  }

  private getCurrentBucket(): SlidingWindowBucket {
    const now = Date.now();
    const bucketSize = this.config.slidingWindowSize / this.config.slidingWindowBuckets;
    const bucketIndex = Math.floor(now / bucketSize) % this.config.slidingWindowBuckets;
    
    let bucket = this.slidingWindowBuckets[bucketIndex];
    
    // Check if bucket is stale
    if (now - bucket.startTime >= this.config.slidingWindowSize) {
      // Reset all buckets - window has completely passed
      this.initializeSlidingWindow();
      bucket = this.slidingWindowBuckets[this.config.slidingWindowBuckets - 1];
    } else if (bucket.startTime + bucketSize < now) {
      // Reset this specific bucket
      bucket = {
        startTime: now,
        successful: 0,
        failed: 0,
        slow: 0,
        total: 0,
      };
      this.slidingWindowBuckets[bucketIndex] = bucket;
    }

    return bucket;
  }

  private recordSuccess(durationMs: number): void {
    const bucket = this.getCurrentBucket();
    bucket.successful++;
    bucket.total++;
    this.totalSuccessfulCalls++;

    // Track slow calls
    if (this.config.slowCallDurationEnabled && durationMs > this.config.slowCallDurationThreshold) {
      bucket.slow++;
      this.totalSlowCalls++;
    }

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.halfOpenSuccessThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in closed state
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  private recordFailure(): void {
    const bucket = this.getCurrentBucket();
    bucket.failed++;
    bucket.total++;
    this.totalFailedCalls++;
    this.failureCount++;

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open immediately opens the circuit
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      // Check if we should open the circuit
      if (this.shouldOpenCircuit()) {
        this.transitionTo('OPEN');
      }
    }
  }

  private shouldOpenCircuit(): boolean {
    // Check failure count threshold
    if (this.failureCount >= this.config.failureThreshold) {
      return true;
    }

    // Check failure rate threshold
    this.updateStatsFromWindow();
    if (this.stats.failureRate >= this.config.failureRateThreshold) {
      const totalCalls = this.stats.successfulCalls + this.stats.failedCalls;
      if (totalCalls >= this.config.volumeThreshold) {
        return true;
      }
    }

    return false;
  }

  private transitionTo(newState: CircuitState): void {
    this.previousState = this.state;
    this.state = newState;

    switch (newState) {
      case 'OPEN':
        this.openedAt = new Date();
        this.successCount = 0;
        break;
      case 'HALF_OPEN':
        this.successCount = 0;
        break;
      case 'CLOSED':
        this.openedAt = null;
        this.failureCount = 0;
        this.successCount = 0;
        break;
    }

    // Update stats
    this.stats.state = newState;
    this.stats.openedAt = this.openedAt ?? undefined;
    this.stats.nextRetryAt = this.openedAt 
      ? new Date(this.openedAt.getTime() + this.config.resetTimeout)
      : undefined;

    // Call state change callback
    if (this.config.onStateChange) {
      try {
        this.config.onStateChange(newState, this.previousState);
      } catch (error) {
        logger.error('State change callback error', {
          event: 'circuit-breaker.callback.error',
          metadata: { name: this.config.name },
          error: error as Error,
        });
      }
    }

    logger.info('Circuit breaker state changed', {
      event: 'circuit-breaker.state-change',
      metadata: {
        name: this.config.name,
        previousState: this.previousState,
        newState,
        openedAt: this.openedAt?.toISOString(),
      },
    });
  }

  private updateStatsFromWindow(): void {
    let successful = 0;
    let failed = 0;
    let slow = 0;

    for (const bucket of this.slidingWindowBuckets) {
      successful += bucket.successful;
      failed += bucket.failed;
      slow += bucket.slow;
    }

    const total = successful + failed;
    this.stats.successfulCalls = successful;
    this.stats.failedCalls = failed;
    this.stats.slowCalls = slow;
    this.stats.rejectedCalls = this.totalRejectedCalls;
    this.stats.failureRate = total > 0 ? (failed / total) * 100 : 0;
    this.stats.state = this.getState();
    this.stats.openedAt = this.openedAt ?? undefined;
    this.stats.nextRetryAt = this.openedAt 
      ? new Date(this.openedAt.getTime() + this.config.resetTimeout)
      : undefined;
  }

  private createPersistedState(): PersistedCircuitState {
    return {
      name: this.config.name,
      state: this.state,
      updatedAt: new Date().toISOString(),
      failureCount: this.failureCount,
      openedAt: this.openedAt?.toISOString(),
      version: 1,
    };
  }
}

// ============== Retry Implementation ==============

/**
 * Retry Handler with Exponential Backoff
 *
 * Provides configurable retry logic with:
 * - Exponential backoff with jitter
 * - Configurable retry conditions
 * - Attempt callbacks
 * - Max retry limits
 */
export class RetryHandler {
  private config: Required<RetryConfig>;

  static readonly DEFAULT_CONFIG: Required<RetryConfig> = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    multiplier: 2.0,
    jitterFactor: 0.1,
    retryableErrors: [],
    retryableStatusCodes: [],
    onRetry: undefined,
  };

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...RetryHandler.DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function with retry logic
   *
   * @param fn - The function to execute
   * @returns Result of the function
   * @throws {AppError} After all retries exhausted
   */
  async execute<T>(fn: () => T | Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await fn();
        
        if (attempt > 1) {
          logger.info('Retry succeeded', {
            event: 'retry.success',
            metadata: { attempt, maxAttempts: this.config.maxAttempts },
          });
        }
        
        return result;
      } catch (error) {
        lastError = wrapError(error);

        // Check if we should retry
        if (attempt < this.config.maxAttempts && this.shouldRetry(lastError)) {
          const delay = this.calculateDelay(attempt);
          
          logger.warn('Retrying after error', {
            event: 'retry.attempt',
            metadata: {
              attempt,
              maxAttempts: this.config.maxAttempts,
              delayMs: delay,
              error: lastError.message,
            },
            error: lastError,
          });

          // Call retry callback
          if (this.config.onRetry) {
            try {
              this.config.onRetry(lastError, attempt);
            } catch (callbackError) {
              logger.error('Retry callback error', {
                event: 'retry.callback.error',
                error: callbackError as Error,
              });
            }
          }

          // Wait before retrying
          await this.sleep(delay);
        } else {
          // No more retries or not retryable
          break;
        }
      }
    }

    logger.error('All retry attempts exhausted', {
      event: 'retry.exhausted',
      metadata: {
        maxAttempts: this.config.maxAttempts,
        error: lastError?.message,
      },
      error: lastError,
    });

    throw lastError ?? new AppError('Retry failed with unknown error');
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.initialDelayMs * Math.pow(this.config.multiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);
    
    // Apply jitter (random variation)
    const jitter = cappedDelay * this.config.jitterFactor * (Math.random() * 2 - 1);
    
    return Math.max(0, Math.floor(cappedDelay + jitter));
  }

  /**
   * Check if an error is retryable
   */
  private shouldRetry(error: Error): boolean {
    // Check specific error codes
    if (this.config.retryableErrors.length > 0 && error instanceof AppError) {
      if (this.config.retryableErrors.includes(error.code)) {
        return true;
      }
      // If specific codes defined but error doesn't match, don't retry
      if (error.code) {
        return false;
      }
    }

    // Check HTTP status codes
    if (this.config.retryableStatusCodes.length > 0 && error instanceof AppError) {
      const statusCode = error.context?.statusCode as number;
      if (statusCode && this.config.retryableStatusCodes.includes(statusCode)) {
        return true;
      }
    }

    // Default: retry on network-like errors
    const nonRetryableMessages = [
      'invalid',
      'unauthorized',
      'forbidden',
      'not found',
      'conflict',
    ];
    
    const lowerMessage = error.message.toLowerCase();
    const isNonRetryable = nonRetryableMessages.some(msg => lowerMessage.includes(msg));
    
    // If no specific filters, retry everything except obvious client errors
    if (this.config.retryableErrors.length === 0 && this.config.retryableStatusCodes.length === 0) {
      return !isNonRetryable;
    }

    return !isNonRetryable;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============== Bulkhead Implementation ==============

/**
 * Bulkhead Isolation Pattern
 *
 * Limits the number of concurrent calls to prevent cascade failures.
 * Uses a semaphore-based approach with a waiting queue.
 */
export class Bulkhead {
  private config: Required<BulkheadConfig>;
  private runningCount: number = 0;
  private waitingQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  
  // Statistics
  private totalAccepted: number = 0;
  private totalRejected: number = 0;

  static readonly DEFAULT_CONFIG: Required<BulkheadConfig> = {
    name: 'default',
    maxConcurrent: 10,
    maxWaitQueueLength: 50,
    maxWaitTimeMs: 5000,
  };

  constructor(config: BulkheadConfig) {
    this.config = { ...Bulkhead.DEFAULT_CONFIG, ...config };

    logger.info('Bulkhead initialized', {
      event: 'bulkhead.init',
      metadata: {
        name: this.config.name,
        maxConcurrent: this.config.maxConcurrent,
        maxWaitQueueLength: this.config.maxWaitQueueLength,
      },
    });
  }

  /**
   * Execute a function within bulkhead constraints
   *
   * @param fn - The function to execute
   * @returns Result of the function
   * @throws {AppError} If bulkhead is full
   */
  async execute<T>(fn: () => T | Promise<T>): Promise<T> {
    // Try to acquire slot
    if (this.runningCount < this.config.maxConcurrent) {
      this.runningCount++;
      this.totalAccepted++;
      
      try {
        return await fn();
      } finally {
        this.releaseSlot();
      }
    }

    // Need to wait in queue
    if (this.waitingQueue.length >= this.config.maxWaitQueueLength) {
      this.totalRejected++;
      
      const error = new AppError(
        `Bulkhead '${this.config.name}' queue is full`,
        ErrorCode.API_REQUEST_FAILED,
        { 
          severity: 'warning',
          context: {
            name: this.config.name,
            runningCount: this.runningCount,
            queueLength: this.waitingQueue.length,
          },
        }
      );

      logger.warn('Bulkhead queue full, request rejected', {
        event: 'bulkhead.rejected',
        metadata: {
          name: this.config.name,
          queueLength: this.waitingQueue.length,
          maxQueueLength: this.config.maxWaitQueueLength,
        },
        error,
      });

      throw error;
    }

    // Wait for slot with timeout
    return new Promise<T>((resolve, reject) => {
      const waiter = {
        resolve: () => {
          this.runningCount++;
          this.totalAccepted++;
          
          fn()
            .then(result => {
              this.releaseSlot();
              resolve(result);
            })
            .catch(error => {
              this.releaseSlot();
              reject(wrapError(error));
            });
        },
        reject: (error: Error) => {
          this.totalRejected++;
          reject(error);
        },
      };

      this.waitingQueue.push(waiter);

      // Set up timeout for waiting
      const timeoutId = setTimeout(() => {
        // Remove from queue
        const index = this.waitingQueue.indexOf(waiter);
        if (index > -1) {
          this.waitingQueue.splice(index, 1);
        }

        const timeoutError = new AppError(
          `Bulkhead '${this.config.name}' wait timeout exceeded`,
          ErrorCode.API_TIMEOUT,
          { severity: 'warning', context: { name: this.config.name, timeoutMs: this.config.maxWaitTimeMs } }
        );

        logger.warn('Bulkhead wait timeout', {
          event: 'bulkhead.timeout',
          metadata: {
            name: this.config.name,
            timeoutMs: this.config.maxWaitTimeMs,
          },
          error: timeoutError,
        });

        waiter.reject(timeoutError);
      }, this.config.maxWaitTimeMs);

      // Store timeout ID for cleanup
      (waiter as unknown as { timeoutId: ReturnType<typeof setTimeout> }).timeoutId = timeoutId;
    });
  }

  /**
   * Get current bulkhead statistics
   */
  getStats(): BulkheadStats {
    return {
      currentRunning: this.runningCount,
      currentWaiting: this.waitingQueue.length,
      totalAccepted: this.totalAccepted,
      totalRejected: this.totalRejected,
    };
  }

  /**
   * Get available capacity
   */
  getAvailableCapacity(): number {
    return Math.max(0, this.config.maxConcurrent - this.runningCount);
  }

  /**
   * Destroy the bulkhead instance
   */
  destroy(): void {
    // Reject all waiting requests
    for (const waiter of this.waitingQueue) {
      const timeoutId = (waiter as unknown as { timeoutId?: ReturnType<typeof setTimeout> }).timeoutId;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      waiter.reject(new AppError('Bulkhead destroyed'));
    }
    this.waitingQueue = [];

    logger.info('Bulkhead destroyed', {
      event: 'bulkhead.destroy',
      metadata: { name: this.config.name },
    });
  }

  private releaseSlot(): void {
    this.runningCount--;

    // Process waiting queue
    if (this.waitingQueue.length > 0 && this.runningCount < this.config.maxConcurrent) {
      const waiter = this.waitingQueue.shift();
      if (waiter) {
        const timeoutId = (waiter as unknown as { timeoutId?: ReturnType<typeof setTimeout> }).timeoutId;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        waiter.resolve();
      }
    }
  }
}

// ============== Timeout Implementation ==============

/**
 * Timeout Handler
 *
 * Wraps operations with configurable timeouts.
 */
export class TimeoutHandler {
  private config: Required<TimeoutConfig>;

  static readonly DEFAULT_CONFIG: Required<TimeoutConfig> = {
    timeoutMs: 10000,
    cancelOnTimeout: true,
    timeoutErrorMessage: 'Operation timed out',
  };

  constructor(config: Partial<TimeoutConfig> = {}) {
    this.config = { ...TimeoutHandler.DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function with timeout
   *
   * @param fn - The function to execute
   * @returns Result of the function
   * @throws {AppError} If operation times out
   */
  async execute<T>(fn: () => T | Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        const error = new AppError(
          this.config.timeoutErrorMessage,
          ErrorCode.API_TIMEOUT,
          { 
            severity: 'warning',
            context: { timeoutMs: this.config.timeoutMs },
          }
        );

        logger.warn('Operation timed out', {
          event: 'timeout.exceeded',
          metadata: { timeoutMs: this.config.timeoutMs },
          error,
        });

        reject(error);
      }, this.config.timeoutMs);

      // Execute the function
      Promise.resolve()
        .then(() => fn())
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(wrapError(error));
        });
    });
  }

  /**
   * Create a new timeout handler with merged config
   */
  withConfig(config: Partial<TimeoutConfig>): TimeoutHandler {
    return new TimeoutHandler({ ...this.config, ...config });
  }
}

// ============== Fallback Implementation ==============

/**
 * Fallback Provider
 *
 * Provides fallback values when primary operations fail.
 */
export class FallbackProvider<T = unknown> {
  private fallbackFn: FallbackFunction<T> | null;

  constructor(fallbackFn?: FallbackFunction<T>) {
    this.fallbackFn = fallbackFn ?? null;
  }

  /**
   * Set the fallback function
   */
  setFallback(fn: FallbackFunction<T>): this {
    this.fallbackFn = fn;
    return this;
  }

  /**
   * Execute with fallback
   *
   * @param fn - Primary function to execute
   * @param context - Context data for fallback function
   * @returns Result of primary or fallback function
   */
  async execute(fn: () => T | Promise<T>, context: Record<string, unknown> = {}): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const wrappedError = wrapError(error);

      if (this.fallbackFn) {
        logger.info('Executing fallback due to error', {
          event: 'fallback.executed',
          metadata: { context, error: wrappedError.message },
          error: wrappedError,
        });

        try {
          return await this.fallbackFn(wrappedError, context);
        } catch (fallbackError) {
          logger.error('Fallback function failed', {
            event: 'fallback.error',
            error: fallbackError as Error,
          });
          throw wrapError(fallbackError);
        }
      }

      throw wrappedError;
    }
  }

  /**
   * Get static fallback value
   */
  static withValue<T>(value: T): FallbackProvider<T> {
    return new FallbackProvider<T>(() => value);
  }
}

// ============== Rate Limiter Integration ==============

/**
 * In-Memory Rate Limiter
 *
 * Simple token bucket / sliding window rate limiter.
 */
export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private requests: number[] = []; // Timestamps of requests

  static readonly DEFAULT_CONFIG: Required<RateLimiterConfig> = {
    limit: 100,
    windowMs: 60000,
    key: 'default',
  };

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...RateLimiter.DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if request is allowed
   *
   * @returns Whether request is allowed and remaining count info
   */
  tryAcquire(): { allowed: boolean; remaining: number; resetAt: Date } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Clean old entries
    this.requests = this.requests.filter(time => time > windowStart);

    if (this.requests.length < this.config.limit) {
      this.requests.push(now);
      return {
        allowed: true,
        remaining: this.config.limit - this.requests.length,
        resetAt: new Date(now + this.config.windowMs),
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(this.requests[0] + this.config.windowMs),
    };
  }

  /**
   * Execute with rate limiting
   *
   * @param fn - Function to execute if rate limit allows
   * @returns Result or throws if rate limited
   */
  async execute<T>(fn: () => T | Promise<T>): Promise<T> {
    const result = this.tryAcquire();

    if (!result.allowed) {
      const error = new AppError(
        `Rate limit exceeded for ${this.config.key}`,
        ErrorCode.API_REQUEST_FAILED,
        { 
          severity: 'warning',
          context: {
            key: this.config.key,
            limit: this.config.limit,
            resetAt: result.resetAt.toISOString(),
          },
        }
      );

      logger.warn('Rate limit exceeded', {
        event: 'rate-limited',
        metadata: {
          key: this.config.key,
          limit: this.config.limit,
          resetAt: result.resetAt.toISOString(),
        },
        error,
      });

      throw error;
    }

    return fn();
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
  }

  /**
   * Get current usage stats
   */
  getStats(): { used: number; limit: number; remaining: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const activeRequests = this.requests.filter(time => time > windowStart).length;
    
    return {
      used: activeRequests,
      limit: this.config.limit,
      remaining: Math.max(0, this.config.limit - activeRequests),
    };
  }
}

// ============== Composite Resilience Manager ==============

/**
 * Comprehensive Resilience Manager
 *
 * Combines all resilience patterns into a unified interface.
 * Provides easy configuration and execution of resilient operations.
 */
export class ResilienceManager {
  private circuitBreaker: CircuitBreaker | null;
  private retryHandler: RetryHandler;
  private bulkhead: Bulkhead | null;
  private timeoutHandler: TimeoutHandler;
  private fallbackProvider: FallbackProvider<unknown> | null;
  private rateLimiter: RateLimiter | null;
  private healthCheckCallback: HealthCheckCallback | null;
  private readonly name: string;

  constructor(name: string, config: ResilienceConfig = {}) {
    this.name = name;

    // Initialize components based on config
    this.circuitBreaker = config.circuitBreaker 
      ? new CircuitBreaker({ name, ...config.circuitBreaker }) 
      : null;

    this.retryHandler = new RetryHandler(config.retry);

    this.bulkhead = config.bulkhead 
      ? new Bulkhead({ name, ...config.bulkhead }) 
      : null;

    this.timeoutHandler = new TimeoutHandler(config.timeout);

    this.fallbackProvider = config.fallback 
      ? new FallbackProvider(config.fallback) 
      : null;

    this.rateLimiter = config.rateLimiter 
      ? new RateLimiter({ key: name, ...config.rateLimiter }) 
      : null;

    this.healthCheckCallback = config.healthCheck ?? null;

    // Set health check on circuit breaker if provided
    if (this.healthCheckCallback && this.circuitBreaker) {
      this.circuitBreaker.setHealthCheck(this.healthCheckCallback);
    }

    logger.info('Resilience manager initialized', {
      event: 'resilience.init',
      metadata: {
        name,
        hasCircuitBreaker: !!this.circuitBreaker,
        hasBulkhead: !!this.bulkhead,
        hasFallback: !!this.fallbackProvider,
        hasRateLimiter: !!this.rateLimiter,
      },
    });
  }

  /**
   * Execute an operation with all configured resilience patterns
   *
   * Patterns are applied in order:
   * 1. Rate Limiter (rejects if over limit)
   * 2. Circuit Breaker (rejects if open)
   * 3. Bulkhead (limits concurrency)
   * 4. Timeout (wraps execution)
   * 5. Retry (retries on failure)
   * 6. Fallback (provides alternative on final failure)
   *
   * @param fn - The function to execute
   * @param context - Additional context for logging/fallback
   * @returns Execution result with metrics
   */
  async execute<T>(
    fn: () => T | Promise<T>,
    context: Record<string, unknown> = {}
  ): Promise<ExecutionResult<T>> {
    const startTime = Date.now();
    let attempts = 0;
    let fallbackInvoked = false;
    let circuitBreakerUsed = !!this.circuitBreaker;

    const createResult = (
      success: boolean,
      value?: T,
      error?: Error
    ): ExecutionResult<T> => ({
      success,
      value,
      error,
      metrics: {
        durationMs: Date.now() - startTime,
        attempts,
        circuitBreakerUsed,
        fallbackInvoked,
        timestamp: new Date(),
      },
    });

    // Build the core operation function (rate limiter + circuit breaker + bulkhead + timeout)
    const buildCoreOperation = (): (() => Promise<T>) => {
      return async (): Promise<T> => {
        attempts++;

        // Apply rate limiting first
        if (this.rateLimiter) {
          await this.rateLimiter.execute(async () => {});
        }

        // Build the protected execution chain
        const executeWithProtection = async (): Promise<T> => {
          // Apply circuit breaker
          if (this.circuitBreaker) {
            return this.circuitBreaker.execute(async () => {
              // Apply bulkhead
              if (this.bulkhead) {
                return this.bulkhead.execute(async () => {
                  // Apply timeout
                  return this.timeoutHandler.execute(() => fn());
                });
              }
              return this.timeoutHandler.execute(() => fn());
            });
          }

          // Apply bulkhead without circuit breaker
          if (this.bulkhead) {
            return this.bulkhead.execute(async () => {
              return this.timeoutHandler.execute(() => fn());
            });
          }

          // Just timeout
          return this.timeoutHandler.execute(() => fn());
        };

        return executeWithProtection();
      };
    };

    try {
      // Wrap core operation with retry
      const retriableOperation = (): Promise<T> => {
        return this.retryHandler.execute(buildCoreOperation());
      };

      // Apply fallback if configured
      if (this.fallbackProvider) {
        try {
          const result = await retriableOperation();
          return createResult(true, result);
        } catch (error) {
          // Use fallback on failure
          fallbackInvoked = true;
          const wrappedError = wrapError(error);
          
          try {
            const fallbackResult = await this.fallbackProvider.execute(
              () => Promise.reject(wrappedError),
              context
            ) as T;
            return createResult(true, fallbackResult);
          } catch (fallbackError) {
            return createResult(false, undefined, wrapError(fallbackError));
          }
        }
      }

      // No fallback - just execute with retry
      const result = await retriableOperation();
      return createResult(true, result);
    } catch (error) {
      const wrappedError = wrapError(error);
      fallbackInvoked = false;
      
      logger.error('Resilience execution failed', {
        event: 'resilience.execution.failed',
        metadata: {
          name: this.name,
          attempts,
          durationMs: Date.now() - startTime,
          ...context,
        },
        error: wrappedError,
      });

      return createResult(false, undefined, wrappedError);
    }
  }

  /**
   * Get combined statistics from all components
   */
  getStats(): Record<string, unknown> {
    const stats: Record<string, unknown> = {
      name: this.name,
    };

    if (this.circuitBreaker) {
      stats.circuitBreaker = this.circuitBreaker.getStats();
    }

    if (this.bulkhead) {
      stats.bulkhead = this.bulkhead.getStats();
    }

    if (this.rateLimiter) {
      stats.rateLimiter = this.rateLimiter.getStats();
    }

    return stats;
  }

  /**
   * Get individual components for advanced usage
   */
  getCircuitBreaker(): CircuitBreaker | null {
    return this.circuitBreaker;
  }

  getBulkhead(): Bulkhead | null {
    return this.bulkhead;
  }

  getRateLimiter(): RateLimiter | null {
    return this.rateLimiter;
  }

  /**
   * Set/update health check callback
   */
  setHealthCheck(callback: HealthCheckCallback): void {
    this.healthCheckCallback = callback;
    if (this.circuitBreaker) {
      this.circuitBreaker.setHealthCheck(callback);
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<HealthCheckResult | null> {
    if (this.healthCheckCallback && this.circuitBreaker) {
      return this.circuitBreaker.performHealthCheck();
    }
    
    if (this.healthCheckCallback) {
      return this.healthCheckCallback();
    }

    return null;
  }

  /**
   * Manually trip the circuit breaker
   */
  trip(): void {
    this.circuitBreaker?.trip();
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.circuitBreaker?.reset();
  }

  /**
   * Destroy all components
   */
  destroy(): void {
    this.circuitBreaker?.destroy();
    this.bulkhead?.destroy();

    logger.info('Resilience manager destroyed', {
      event: 'resilience.destroy',
      metadata: { name: this.name },
    });
  }
}

// ============== Factory Functions ==============

/**
 * Create a pre-configured resilience manager for payment operations
 */
export function createPaymentResilience(transactionRef?: string): ResilienceManager {
  return new ResilienceManager(`payment-${transactionRef ?? 'default'}`, {
    circuitBreaker: {
      name: `payment-cb-${transactionRef ?? 'default'}`,
      failureThreshold: 5,
      resetTimeout: 30000,
      halfOpenSuccessThreshold: 2,
    },
    retry: {
      maxAttempts: 3,
      initialDelayMs: 500,
      maxDelayMs: 5000,
      jitterFactor: 0.2,
    },
    timeout: {
      timeoutMs: 15000,
      timeoutErrorMessage: 'Payment processing timed out',
    },
    fallback: async (error) => {
      logger.warn('Payment fallback executed', {
        event: 'payment.fallback',
        metadata: { transactionRef, originalError: error.message },
      });
      throw error; // Re-throw for proper handling upstream
    },
  });
}

/**
 * Create a pre-configured resilience manager for external API calls
 */
export function createApiResilience(apiName: string): ResilienceManager {
  return new ResilienceManager(`api-${apiName}`, {
    circuitBreaker: {
      name: `api-cb-${apiName}`,
      failureThreshold: 10,
      resetTimeout: 60000,
      halfOpenSuccessThreshold: 3,
      failureRateThreshold: 40,
    },
    retry: {
      maxAttempts: 4,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      multiplier: 2.5,
      jitterFactor: 0.15,
      retryableStatusCodes: [500, 502, 503, 504],
    },
    bulkhead: {
      name: `api-bh-${apiName}`,
      maxConcurrent: 20,
      maxWaitQueueLength: 100,
    },
    timeout: {
      timeoutMs: 30000,
      timeoutErrorMessage: `API call to ${apiName} timed out`,
    },
    rateLimiter: {
      limit: 200,
      windowMs: 60000,
    },
  });
}

// ============== Utility Functions ==============

/**
 * Wrap any async function with circuit breaker protection
 */
export function withCircuitBreaker<T extends (...args: unknown[]) => unknown>(
  fn: T,
  config: CircuitBreakerConfig
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  const cb = new CircuitBreaker(config);
  
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return cb.execute(() => fn(...args)) as Promise<ReturnType<T>>;
  };
}

/**
 * Wrap any async function with retry logic
 */
export function withRetry<T extends (...args: unknown[]) => unknown>(
  fn: T,
  config: Partial<RetryConfig> = {}
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  const retry = new RetryHandler(config);
  
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return retry.execute(() => fn(...args)) as Promise<ReturnType<T>>;
  };
}

/**
 * Wrap any async function with timeout
 */
export function withTimeout<T extends (...args: unknown[]) => unknown>(
  fn: T,
  timeoutMs: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  const timeout = new TimeoutHandler({ timeoutMs });
  
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return timeout.execute(() => fn(...args)) as Promise<ReturnType<T>>;
  };
}

// ============== Default Exports ==============

export default {
  CircuitBreaker,
  RetryHandler,
  Bulkhead,
  TimeoutHandler,
  FallbackProvider,
  RateLimiter,
  ResilienceManager,
  createPaymentResilience,
  createApiResilience,
  withCircuitBreaker,
  withRetry,
  withTimeout,
};
