/**
 * Composite Resilience Manager Module
 * 
 * Combines all resilience patterns into a unified interface.
 * Provides easy configuration and execution of resilient operations.
 * 
 * @module services/resilience/composite
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode, wrapError } from '@/lib/errors';
import { CircuitBreaker, CircuitBreakerConfig, ExecutionResult, ExecutionMetrics } from './circuit-breaker';
import { RetryHandler, RetryConfig } from './retry';
import { Bulkhead, BulkheadConfig } from './bulkhead';
import { TimeoutHandler, TimeoutConfig, FallbackProvider, FallbackFunction, RateLimiter, RateLimiterConfig } from './fallback';

// ============== Type Definitions ==============

/**
 * Combined resilience configuration for easy setup
 */
export interface ResilienceConfig {
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  retry?: Partial<RetryConfig>;
  bulkhead?: Partial<BulkheadConfig>;
  timeout?: Partial<TimeoutConfig>;
  fallback?: FallbackFunction<unknown>;
  healthCheck?: import('./circuit-breaker').HealthCheckCallback;
  rateLimiter?: Partial<RateLimiterConfig>;
}

// ============== Resilience Manager Class ==============

/**
 * Comprehensive Resilience Manager
 */
export class ResilienceManager {
  private circuitBreaker: CircuitBreaker | null;
  private retryHandler: RetryHandler;
  private bulkhead: Bulkhead | null;
  private timeoutHandler: TimeoutHandler;
  private fallbackProvider: FallbackProvider<unknown> | null;
  private rateLimiter: RateLimiter | null;
  private healthCheckCallback: import('./circuit-breaker').HealthCheckCallback | null;
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

    const buildCoreOperation = (): (() => Promise<T>) => {
      return async (): Promise<T> => {
        attempts++;

        if (this.rateLimiter) {
          await this.rateLimiter.execute(async () => {});
        }

        const executeWithProtection = async (): Promise<T> => {
          if (this.circuitBreaker) {
            return this.circuitBreaker.execute(async () => {
              if (this.bulkhead) {
                return this.bulkhead.execute(async () => {
                  return this.timeoutHandler.execute(() => fn());
                });
              }
              return this.timeoutHandler.execute(() => fn());
            });
          }

          if (this.bulkhead) {
            return this.bulkhead.execute(async () => {
              return this.timeoutHandler.execute(() => fn());
            });
          }

          return this.timeoutHandler.execute(() => fn());
        };

        return executeWithProtection();
      };
    };

    try {
      const retriableOperation = (): Promise<T> => {
        return this.retryHandler.execute(buildCoreOperation());
      };

      if (this.fallbackProvider) {
        try {
          const result = await retriableOperation();
          return createResult(true, result);
        } catch (error) {
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

  getStats(): Record<string, unknown> {
    const stats: Record<string, unknown> = { name: this.name };

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

  getCircuitBreaker(): CircuitBreaker | null {
    return this.circuitBreaker;
  }

  getBulkhead(): Bulkhead | null {
    return this.bulkhead;
  }

  getRateLimiter(): RateLimiter | null {
    return this.rateLimiter;
  }

  setHealthCheck(callback: import('./circuit-breaker').HealthCheckCallback): void {
    this.healthCheckCallback = callback;
    if (this.circuitBreaker) {
      this.circuitBreaker.setHealthCheck(callback);
    }
  }

  async performHealthCheck(): Promise<import('./circuit-breaker').HealthCheckResult | null> {
    if (this.healthCheckCallback && this.circuitBreaker) {
      return this.circuitBreaker.performHealthCheck();
    }
    
    if (this.healthCheckCallback) {
      return this.healthCheckCallback();
    }

    return null;
  }

  trip(): void {
    this.circuitBreaker?.trip();
  }

  reset(): void {
    this.circuitBreaker?.reset();
  }

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
      throw error;
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
