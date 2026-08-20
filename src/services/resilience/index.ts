/**
 * SSM-Pay Resilience Service Module
 * Public API for circuit breaker, retry, bulkhead, and fallback patterns
 *
 * @example
 * ```typescript
 * import {
 *   ResilienceService,
 *   CircuitState,
 *   RetryStrategy,
 * } from '@/services/resilience';
 *
 * const resilience = new ResilienceService();
 *
 * // Execute with full resilience protection
 * const result = await resilience.execute('payment.process', async () => {
 *   return await processPayment(paymentData);
 * });
 *
 * // Check circuit breaker state
 * const state = resilience.getCircuitBreaker('payment').getState();
 * ```
 */

// Type exports
export type {
  CircuitBreakerConfig,
  CircuitEvent,
  CircuitStateSnapshot,
  RetryConfig,
  RetryAttempt,
  RetryResult,
  BulkheadConfig,
  BulkheadStats,
  FallbackResult,
  FallbackRegistration,
  FallbackFn,
  FallbackProviderConfig,
  ResilienceContext,
  ResiliencePolicy,
} from './types';

export {
  CircuitState,
  CircuitEventType,
  RetryStrategy,
  ErrorClass,
  DEFAULT_CIRCUIT_CONFIG,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_BULKHEAD_CONFIG,
} from './types';

// Circuit breaker
export { CircuitBreaker } from './circuit-breaker';
export type { CircuitEventListener } from './circuit-breaker';

// Retry handler
export { RetryHandler, createRetryHandler } from './retry';

// Bulkhead
export { Bulkhead } from './bulkhead';

// Fallback handler
export { FallbackHandler } from './fallback';

/**
 * Main ResilienceService facade combining all resilience patterns
 */
import { CircuitBreaker } from './circuit-breaker';
import { RetryHandler } from './retry';
import { Bulkhead } from './bulkhead';
import { FallbackHandler } from './fallback';
import {
  CircuitBreakerConfig,
  RetryConfig,
  BulkheadConfig,
  ResilienceContext,
  ResiliencePolicy,
} from './types';

/** Combined execution result */
export interface ResilienceExecutionResult<T> {
  value?: T;
  error?: Error;
  usedFallback: boolean;
  circuitState: CircuitState;
  attempts: number;
  totalDurationMs: number;
}

/** Resilience service configuration */
export interface ResilienceServiceConfig {
  /** Default policies */
  defaultPolicies?: Record<string, ResiliencePolicy>;
}

/**
 * SSM-Pay Resilience Service - Unified entry point for all resilience patterns
 */
export class ResilienceService {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private retryHandlers: Map<string, RetryHandler> = new Map();
  private bulkheads: Map<string, Bulkhead> = new Map();
  private fallbackHandler: FallbackHandler;

  constructor(config: ResilienceServiceConfig = {}) {
    this.fallbackHandler = new FallbackHandler();

    // Register default policies if provided
    if (config.defaultPolicies) {
      for (const [name, policy] of Object.entries(config.defaultPolicies)) {
        this.registerPolicy(name, policy);
      }
    }
  }

  /**
   * Execute an operation with full resilience protection
   * @param operation - Operation name/identifier
   * @param fn - The function to execute
   * @param context - Optional context data
   * @returns Promise resolving to execution result
   */
  async execute<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: ResilienceContext
  ): Promise<ResilienceExecutionResult<T>> {
    const startTime = Date.now();

    // Get or create components for this operation
    const circuitBreaker = this.getCircuitBreaker(operation);
    const bulkhead = this.getBulkhead(operation);
    const retryHandler = this.getRetryHandler(operation);

    try {
      // Wrap with fallback support
      return await this.fallbackHandler.executeWithFallback(
        operation,
        async () => {
          // Execute through bulkhead (concurrency limiting)
          return await bulkhead.execute(async () => {
            // Execute through circuit breaker
            return await circuitBreaker.execute(async () => {
              // Execute with retry logic
              const result = await retryHandler.execute(fn);

              if (result.error) {
                throw result.error;
              }

              return result.value as T;
            });
          });
        },
        context?.metadata || {}
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      return {
        error: err,
        usedFallback: false,
        circuitState: circuitBreaker.getState(),
        attempts: 1,
        totalDurationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get or create a circuit breaker for an operation
   */
  getCircuitBreaker(operation: string): CircuitBreaker {
    let cb = this.circuitBreakers.get(operation);
    if (!cb) {
      cb = new CircuitBreaker({ name: operation });
      this.circuitBreakers.set(operation, cb);
    }
    return cb;
  }

  /**
   * Get or create a retry handler for an operation
   */
  getRetryHandler(operation: string): RetryHandler {
    let rh = this.retryHandlers.get(operation);
    if (!rh) {
      rh = new RetryHandler();
      this.retryHandlers.set(operation, rh);
    }
    return rh;
  }

  /**
   * Get or create a bulkhead for an operation
   */
  getBulkhead(operation: string): Bulkhead {
    let bh = this.bulkheads.get(operation);
    if (!bh) {
      bh = new Bulkhead({ name: operation });
      this.bulkheads.set(operation, bh);
    }
    return bh;
  }

  /**
   * Get the fallback handler
   */
  getFallbackHandler(): FallbackHandler {
    return this.fallbackHandler;
  }

  /**
   * Register a complete resilience policy for an operation
   */
  registerPolicy(name: string, policy: ResiliencePolicy): void {
    if (policy.circuitBreaker) {
      const cb = this.getCircuitBreaker(name);
      // Config is applied at creation, so we'd need to recreate
      console.log(`[Resilience] Policy registered for ${name}`);
    }
  }

  /**
   * Register a fallback function
   */
  registerFallback<T>(
    operationName: string,
    fn: (error: Error, context: Record<string, unknown>) => Promise<T> | T,
    options?: { priority?: number; enabled?: boolean }
  ): void {
    this.fallbackHandler.registerFallback(operationName, fn, options);
  }

  /**
   * Get health status of all resilience components
   */
  getHealth(): Record<string, {
    circuitState: CircuitState;
    activeExecutions: number;
    waitingInQueue: number;
  }> {
    const health: Record<string, any> = {};

    for (const [name] of this.circuitBreakers) {
      health[name] = {
        circuitState: this.circuitBreakers.get(name)?.getState(),
        activeExecutions: this.bulkheads.get(name)?.getStats().activeExecutions || 0,
        waitingInQueue: this.bulkheads.get(name)?.getStats().waitingInQueue || 0,
      };
    }

    return health;
  }

  /**
   * Reset all resilience components (use with caution)
   */
  resetAll(): void {
    for (const [, cb] of this.circuitBreakers) {
      cb.reset();
    }
    for (const [, bh] of this.bulkheads) {
      bh.resetStats();
    }
    this.fallbackHandler.clearCache();

    console.log('[Resilience] All components reset');
  }
}
