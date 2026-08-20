/**
 * Circuit Breaker Pattern Module
 * 
 * Implements the circuit breaker pattern with three states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered
 * 
 * Features:
 * - Sliding window for failure rate calculation
 * - Configurable thresholds
 * - State change callbacks
 * - Persistence support
 * - Health check integration
 * 
 * @module services/resilience/circuit-breaker
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode, wrapError } from '@/lib/errors';

// ============== Type Definitions ==============

/**
 * Circuit Breaker States
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Result of a circuit breaker protected execution
 */
export interface ExecutionResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  metrics: ExecutionMetrics;
}

/**
 * Metrics collected during execution
 */
export interface ExecutionMetrics {
  durationMs: number;
  attempts: number;
  circuitBreakerUsed: boolean;
  fallbackInvoked: boolean;
  timestamp: Date;
}

/**
 * Configuration options for Circuit Breaker
 */
export interface CircuitBreakerConfig {
  name: string;
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenSuccessThreshold?: number;
  failureRateThreshold?: number;
  volumeThreshold?: number;
  slidingWindowSize?: number;
  slidingWindowBuckets?: number;
  slowCallDurationEnabled?: boolean;
  slowCallDurationThreshold?: number;
  enablePersistence?: boolean;
  onStateChange?: (state: CircuitState, previousState: CircuitState) => void;
}

/**
 * Statistics snapshot for circuit breaker
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  failureRate: number;
  slowCalls: number;
  openedAt?: Date;
  nextRetryAt?: Date;
}

/**
 * Persisted circuit breaker state for recovery
 */
export interface PersistedCircuitState {
  name: string;
  state: CircuitState;
  updatedAt: string;
  failureCount: number;
  openedAt?: string;
  version: number;
}

/** Health check result type */
export interface HealthCheckResult {
  healthy: boolean;
  details: Record<string, unknown>;
  checkedAt: Date;
  latencyMs?: number;
}

/** Health check callback function */
export type HealthCheckCallback = () => Promise<HealthCheckResult>;

// ============== Internal Types ==============

interface SlidingWindowBucket {
  startTime: number;
  successful: number;
  failed: number;
  slow: number;
  total: number;
}

// ============== Circuit Breaker Class ==============

/**
 * Enterprise Circuit Breaker Implementation
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
    this.config = { ...CircuitBreaker.DEFAULT_CONFIG, ...config };
    this.stats = this.initializeStats();
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
   */
  async execute<T>(fn: () => T | Promise<T>): Promise<T> {
    const startTime = Date.now();

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

  canExecute(): boolean {
    switch (this.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        if (this.openedAt && Date.now() >= this.openedAt.getTime() + this.config.resetTimeout) {
          this.transitionTo('HALF_OPEN');
          return true;
        }
        return false;
      case 'HALF_OPEN':
        return true;
      default:
        return true;
    }
  }

  getState(): CircuitState {
    if (this.state === 'OPEN' && this.openedAt) {
      const elapsed = Date.now() - this.openedAt.getTime();
      if (elapsed >= this.config.resetTimeout) {
        this.transitionTo('HALF_OPEN');
      }
    }
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    this.updateStatsFromWindow();
    return { ...this.stats };
  }

  trip(): void {
    if (this.state !== 'OPEN') {
      this.transitionTo('OPEN');
      logger.warn('Circuit breaker manually tripped', {
        event: 'circuit-breaker.trip',
        metadata: { name: this.config.name, previousState: this.previousState },
      });
    }
  }

  reset(): void {
    if (this.state !== 'CLOSED') {
      this.transitionTo('CLOSED');
      logger.info('Circuit breaker manually reset', {
        event: 'circuit-breaker.reset',
        metadata: { name: this.config.name, previousState: this.previousState },
      });
    }
  }

  setHealthCheck(callback: HealthCheckCallback): void {
    this.healthCheckCallback = callback;
    logger.debug('Health check callback set', {
      event: 'circuit-breaker.health-check.set',
      metadata: { name: this.config.name },
    });
  }

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

      return result;
    } catch (error) {
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

  async persistState(storage?: { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void> }): Promise<PersistedCircuitState> {
    if (!this.config.enablePersistence || !storage) {
      const state = this.createPersistedState();
      return state;
    }

    const state = this.createPersistedState();
    const key = `circuit-breaker:${this.config.name}`;
    
    try {
      await storage.set(key, JSON.stringify(state));
    } catch (error) {
      logger.error('Failed to persist circuit breaker state', {
        event: 'circuit-breaker.persist.error',
        metadata: { name: this.config.name },
        error: error as Error,
      });
    }

    return state;
  }

  async recoverState(storage?: { get: (key: string) => Promise<string | null> }): Promise<boolean> {
    if (!storage) return false;

    const key = `circuit-breaker:${this.config.name}`;
    try {
      const data = await storage.get(key);
      if (!data) return false;

      const persisted: PersistedCircuitState = JSON.parse(data);
      if (persisted.version > 1) return false;

      const updatedAt = new Date(persisted.updatedAt);
      const age = Date.now() - updatedAt.getTime();

      if (age > this.config.resetTimeout * 2) {
        return false;
      }

      this.state = persisted.state;
      this.failureCount = persisted.failureCount;
      
      if (persisted.openedAt) {
        this.openedAt = new Date(persisted.openedAt);
        const adjustedOpenTime = Date.now() - (updatedAt.getTime() - this.openedAt.getTime());
        this.openedAt = new Date(adjustedOpenTime);
      }

      return true;
    } catch {
      return false;
    }
  }

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
    
    if (now - bucket.startTime >= this.config.slidingWindowSize) {
      this.initializeSlidingWindow();
      bucket = this.slidingWindowBuckets[this.config.slidingWindowBuckets - 1];
    } else if (bucket.startTime + bucketSize < now) {
      bucket = { startTime: now, successful: 0, failed: 0, slow: 0, total: 0 };
      this.slidingWindowBuckets[bucketIndex] = bucket;
    }

    return bucket;
  }

  private recordSuccess(durationMs: number): void {
    const bucket = this.getCurrentBucket();
    bucket.successful++;
    bucket.total++;
    this.totalSuccessfulCalls++;

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
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      if (this.shouldOpenCircuit()) {
        this.transitionTo('OPEN');
      }
    }
  }

  private shouldOpenCircuit(): boolean {
    if (this.failureCount >= this.config.failureThreshold) {
      return true;
    }

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

    this.stats.state = newState;
    this.stats.openedAt = this.openedAt ?? undefined;
    this.stats.nextRetryAt = this.openedAt 
      ? new Date(this.openedAt.getTime() + this.config.resetTimeout)
      : undefined;

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
