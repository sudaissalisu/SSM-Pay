/**
 * @module services/resilience
 * 
 * Re-exports from the resilience module for backward compatibility.
 * The actual implementation has been split into focused sub-modules.
 */

export {
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
  // Types
  CircuitState,
  ExecutionResult,
  ExecutionMetrics,
  CircuitBreakerConfig,
  CircuitBreakerStats,
  PersistedCircuitState,
  RetryConfig,
  BulkheadConfig,
  BulkheadStats,
  TimeoutConfig,
  FallbackFunction,
  RateLimiterConfig,
  HealthCheckResult,
  HealthCheckCallback,
  ResilienceConfig,
} from './resilience/index';

export { default } from './resilience/index';
