/**
 * Enterprise Circuit Breaker & Resilience Patterns - Main Module
 * 
 * Aggregates all resilience sub-modules and re-exports them.
 * 
 * @module services/resilience
 */

// Re-export types and classes from sub-modules
export {
  // Types from circuit-breaker.ts
  CircuitState,
  ExecutionResult,
  ExecutionMetrics,
  CircuitBreakerConfig,
  CircuitBreakerStats,
  PersistedCircuitState,
  HealthCheckResult,
  HealthCheckCallback,
  CircuitBreaker,
} from './circuit-breaker';

export {
  // Types from retry.ts
  RetryConfig,
  RetryHandler,
} from './retry';

export {
  // Types from bulkhead.ts
  BulkheadConfig,
  BulkheadStats,
  Bulkhead,
} from './bulkhead';

export {
  // Types from fallback.ts
  FallbackFunction,
  TimeoutConfig,
  RateLimiterConfig,
  TimeoutHandler,
  FallbackProvider,
  RateLimiter,
} from './fallback';

export {
  // Types from composite.ts
  ResilienceConfig,
  ResilienceManager,
  createPaymentResilience,
  createApiResilience,
} from './composite';

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

// ============== Default Export ==============

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
