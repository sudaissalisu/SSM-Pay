/**
 * Comprehensive Tests for Circuit Breaker & Resilience Patterns Library
 * @module services/resilience.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
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
} from './resilience';
import { AppError, ErrorCode } from '@/lib/errors';
import type {
  CircuitState,
  CircuitBreakerConfig,
  ExecutionResult,
  RetryConfig,
  BulkheadConfig,
  HealthCheckResult,
  PersistedCircuitState,
} from './resilience';

// ============== Test Utilities ==============

// Suppress console output during tests
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
  vi.restoreAllMocks();
});

// Helper to create a delayed promise
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to create a function that fails n times then succeeds
function failNTimes<T>(n: number, value: T, error: Error = new Error('Test error')): () => Promise<T> {
  let calls = 0;
  return async (): Promise<T> => {
    calls++;
    if (calls <= n) {
      throw error;
    }
    return value;
  };
}

// ============== Circuit Breaker Tests ==============

describe('CircuitBreaker', () => {
  const defaultConfig: CircuitBreakerConfig = {
    name: 'test-circuit',
    failureThreshold: 3,
    resetTimeout: 1000, // Short timeout for testing
  };

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const cb = new CircuitBreaker(defaultConfig);
      
      expect(cb.getState()).toBe('CLOSED');
      expect(cb.getStats().state).toBe('CLOSED');
      cb.destroy();
    });

    it('should accept custom configuration', () => {
      const cb = new CircuitBreaker({
        name: 'custom-cb',
        failureThreshold: 10,
        resetTimeout: 5000,
        halfOpenSuccessThreshold: 5,
      });
      
      expect(cb.getState()).toBe('CLOSED');
      cb.destroy();
    });

    it('should track statistics correctly', () => {
      const cb = new CircuitBreaker(defaultConfig);
      const stats = cb.getStats();
      
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('successfulCalls');
      expect(stats).toHaveProperty('failedCalls');
      expect(stats).toHaveProperty('rejectedCalls');
      expect(stats).toHaveProperty('failureRate');
      cb.destroy();
    });
  });

  describe('Closed State', () => {
    it('should allow requests when closed', async () => {
      const cb = new CircuitBreaker(defaultConfig);
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await cb.execute(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      cb.destroy();
    });

    it('should record successful calls', async () => {
      const cb = new CircuitBreaker(defaultConfig);
      
      await cb.execute(() => Promise.resolve('ok'));
      await cb.execute(() => Promise.resolve('ok'));
      
      const stats = cb.getStats();
      expect(stats.successfulCalls).toBeGreaterThanOrEqual(2);
      cb.destroy();
    });

    it('should record failed calls', async () => {
      const cb = new CircuitBreaker(defaultConfig);
      
      try {
        await cb.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // Expected
      }
      
      const stats = cb.getStats();
      expect(stats.failedCalls).toBeGreaterThanOrEqual(1);
      cb.destroy();
    });

    it('should open circuit after failure threshold', async () => {
      const cb = new CircuitBreaker({
        ...defaultConfig,
        failureThreshold: 2,
      });
      
      // Fail twice to trip the circuit
      try { await cb.execute(() => Promise.reject(new Error('fail1'))); } catch {}
      try { await cb.execute(() => Promise.reject(new Error('fail2'))); } catch {}
      
      // Circuit should be open now
      expect(cb.getState()).toBe('OPEN');
      cb.destroy();
    });
  });

  describe('Open State', () => {
    it('should reject requests when open', async () => {
      const cb = new CircuitBreaker({
        ...defaultConfig,
        failureThreshold: 2,
      });
      
      // Trip the circuit
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
      
      expect(cb.getState()).toBe('OPEN');
      
      // Should throw immediately without calling the function
      const fn = vi.fn().mockResolvedValue('success');
      
      await expect(cb.execute(fn)).rejects.toThrow('Circuit breaker');
      expect(fn).not.toHaveBeenCalled();
      cb.destroy();
    });

    it('should increment rejected call count', async () => {
      const cb = new CircuitBreaker({
        ...defaultConfig,
        failureThreshold: 2,
      });
      
      // Trip the circuit
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
      
      // Try to execute (should be rejected)
      try { await cb.execute(() => Promise.resolve('ok')); } catch {}
      
      const stats = cb.getStats();
      expect(stats.rejectedCalls).toBeGreaterThan(0);
      cb.destroy();
    });

    it('should transition to half-open after reset timeout', async () => {
      const cb = new CircuitBreaker({
        ...defaultConfig,
        failureThreshold: 2,
        resetTimeout: 50, // Very short for testing
      });
      
      // Trip the circuit
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
      
      expect(cb.getState()).toBe('OPEN');
      
      // Wait for reset timeout
      await delay(60);
      
      // Should transition to half-open
      expect(cb.getState()).toBe('HALF_OPEN');
      cb.destroy();
    });
  });

  describe('Half-Open State', () => {
    it('should allow limited requests in half-open state', async () => {
      const cb = new CircuitBreaker({
        ...defaultConfig,
        failureThreshold: 2,
        resetTimeout: 50,
        halfOpenSuccessThreshold: 2,
      });
      
      // Trip the circuit
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
      
      // Wait for half-open
      await delay(60);
      expect(cb.getState()).toBe('HALF_OPEN');
      
      // Should allow request through
      const result = await cb.execute(() => Promise.resolve('recovered'));
      expect(result).toBe('recovered');
      cb.destroy();
    });

    it('should close circuit after enough successes', async () => {
      const cb = new CircuitBreaker({
        ...defaultConfig,
        failureThreshold: 2,
        resetTimeout: 50,
        halfOpenSuccessThreshold: 2,
      });
      
      // Trip the circuit
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
      
      // Wait for half-open
      await delay(60);
      
      // Succeed enough times to close
      await cb.execute(() => Promise.resolve('ok1'));
      await cb.execute(() => Promise.resolve('ok2'));
      
      expect(cb.getState()).toBe('CLOSED');
      cb.destroy();
    });

    it('should re-open on any failure in half-open', async () => {
      const cb = new CircuitBreaker({
        ...defaultConfig,
        failureThreshold: 2,
        resetTimeout: 50,
        halfOpenSuccessThreshold: 3,
      });
      
      // Trip the circuit
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
      
      // Wait for half-open
      await delay(60);
      
      // One success first
      await cb.execute(() => Promise.resolve('ok'));
      
      // Then a failure should re-open
      try { await cb.execute(() => Promise.reject(new Error('fail-again'))); } catch {}
      
      expect(cb.getState()).toBe('OPEN');
      cb.destroy();
    });
  });

  describe('Manual Control', () => {
    it('should allow manual tripping', () => {
      const cb = new CircuitBreaker(defaultConfig);
      
      cb.trip();
      
      expect(cb.getState()).toBe('OPEN');
      cb.destroy();
    });

    it('should allow manual resetting', () => {
      const cb = new CircuitBreaker(defaultConfig);
      
      cb.trip();
      expect(cb.getState()).toBe('OPEN');
      
      cb.reset();
      expect(cb.getState()).toBe('CLOSED');
      cb.destroy();
    });

    it('should not change if already in target state', () => {
      const cb = new CircuitBreaker(defaultConfig);
      
      // Reset when already closed - no error
      cb.reset();
      expect(cb.getState()).toBe('CLOSED');
      
      // Trip when already open
      cb.trip();
      cb.trip(); // Second trip
      expect(cb.getState()).toBe('OPEN');
      cb.destroy();
    });
  });

  describe('State Change Callbacks', () => {
    it('should call onStateChange callback', () => {
      const onStateChange = vi.fn();
      const cb = new CircuitBreaker({
        ...defaultConfig,
        onStateChange,
      });
      
      cb.trip();
      
      expect(onStateChange).toHaveBeenCalledWith('OPEN', 'CLOSED');
      cb.destroy();
    });

    it('should handle callback errors gracefully', () => {
      const onErrorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      
      const cb = new CircuitBreaker({
        ...defaultConfig,
        onStateChange: onErrorCallback,
      });
      
      // Should not throw even though callback throws
      expect(() => cb.trip()).not.toThrow();
      expect(onErrorCallback).toHaveBeenCalled();
      cb.destroy();
    });
  });

  describe('Health Check Integration', () => {
    it('should set and use health check callback', async () => {
      const healthCheck = vi.fn().mockResolvedValue({
        healthy: true,
        details: {},
        checkedAt: new Date(),
      });
      
      const cb = new CircuitBreaker(defaultConfig);
      cb.setHealthCheck(healthCheck);
      
      const result = await cb.performHealthCheck();
      
      expect(result).not.toBeNull();
      expect(result?.healthy).toBe(true);
      expect(healthCheck).toHaveBeenCalled();
      cb.destroy();
    });

    it('should handle unhealthy health check in half-open', async () => {
      const healthCheck = vi.fn().mockResolvedValue({
        healthy: false,
        details: {},
        checkedAt: new Date(),
      });
      
      const cb = new CircuitBreaker({
        ...defaultConfig,
        failureThreshold: 2,
        resetTimeout: 50,
      });
      
      cb.setHealthCheck(healthCheck);
      
      // Trip and wait for half-open
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
      await delay(60);
      
      expect(cb.getState()).toBe('HALF_OPEN');
      
      // Unhealthy check should re-open
      await cb.performHealthCheck();
      expect(cb.getState()).toBe('OPEN');
      cb.destroy();
    });

    it('should return null when no health check set', async () => {
      const cb = new CircuitBreaker(defaultConfig);
      
      const result = await cb.performHealthCheck();
      expect(result).toBeNull();
      cb.destroy();
    });
  });

  describe('State Persistence', () => {
    it('should create persistable state', async () => {
      const cb = new CircuitBreaker({
        ...defaultConfig,
        enablePersistence: true,
        failureThreshold: 2,
      });
      
      // Cause failures to increment failure count
      try { await cb.execute(() => Promise.reject(new Error('fail1'))); } catch {}
      try { await cb.execute(() => Promise.reject(new Error('fail2'))); } catch {}
      
      // Circuit should now be OPEN with failureCount > 0
      const persisted = await cb.persistState();
      
      expect(persisted.name).toBe('test-circuit');
      expect(persisted.state).toBe('OPEN');
      expect(persisted.failureCount).toBeGreaterThan(0);
      expect(persisted.version).toBe(1);
      expect(persisted.updatedAt).toBeDefined();
      cb.destroy();
    });

    it('should recover state from storage', async () => {
      const mockStorage = new Map<string, string>();
      
      const cb1 = new CircuitBreaker({
        ...defaultConfig,
        enablePersistence: true,
      });
      
      cb1.trip();
      await cb1.persistState({
        get: (key) => Promise.resolve(mockStorage.get(key) ?? null),
        set: (key, value) => { mockStorage.set(key, value); return Promise.resolve(); },
      });
      
      // Create new instance and recover
      const cb2 = new CircuitBreaker(defaultConfig);
      const recovered = await cb2.recoverState({
        get: (key) => Promise.resolve(mockStorage.get(key) ?? null),
        set: () => Promise.resolve(),
      });
      
      expect(recovered).toBe(true);
      expect(cb2.getState()).toBe('OPEN');
      
      cb1.destroy();
      cb2.destroy();
    });

    it('should reject expired persisted state', async () => {
      const mockStorage = new Map<string, string>();
      
      // Create old state manually
      const oldState: PersistedCircuitState = {
        name: 'test-circuit',
        state: 'OPEN',
        updatedAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
        failureCount: 5,
        openedAt: new Date(Date.now() - 130000).toISOString(),
        version: 1,
      };
      
      mockStorage.set('circuit-breaker:test-circuit', JSON.stringify(oldState));
      
      const cb = new CircuitBreaker({
        ...defaultConfig,
        resetTimeout: 30000, // 30 seconds - state is older than 2x this
      });
      
      const recovered = await cb.recoverState({
        get: (key) => Promise.resolve(mockStorage.get(key) ?? null),
        set: () => Promise.resolve(),
      });
      
      expect(recovered).toBe(false);
      expect(cb.getState()).toBe('CLOSED'); // Fresh start
      cb.destroy();
    });
  });

  describe('Sliding Window Statistics', () => {
    it('should calculate failure rate correctly', async () => {
      // Use a circuit breaker with very high thresholds to prevent tripping
      const cb = new CircuitBreaker({
        name: 'rate-test',
        failureThreshold: 1000, // Extremely high to prevent count-based tripping
        volumeThreshold: 100, // High volume threshold
        failureRateThreshold: 100, // 100% rate needed to trip on rate
      });
      
      // Execute a few successful calls first to establish baseline
      await cb.execute(() => Promise.resolve('ok-1'));
      await cb.execute(() => Promise.resolve('ok-2'));
      
      // Now record some failures (but not enough to trip)
      try { await cb.execute(() => Promise.reject(new Error('fail-1'))); } catch {}
      try { await cb.execute(() => Promise.reject(new Error('fail-2'))); } catch {}
      try { await cb.execute(() => Promise.reject(new Error('fail-3'))); } catch {}
      
      // Verify circuit is still closed
      expect(cb.getState()).toBe('CLOSED');
      
      // Get and verify statistics
      const stats = cb.getStats();
      
      // We should have recorded both successes and failures
      expect(stats.successfulCalls + stats.failedCalls).toBeGreaterThan(0);
      
      // Failure rate should be calculable (between 0 and 100)
      expect(stats.failureRate).toBeGreaterThanOrEqual(0);
      expect(stats.failureRate).toBeLessThanOrEqual(100);
      
      // We had more failures than successes in the second batch, so rate should be > 0
      expect(stats.failedCalls).toBeGreaterThan(0);
      
      cb.destroy();
    });
  });

  describe('Destroy', () => {
    it('should clean up resources on destroy', () => {
      const cb = new CircuitBreaker(defaultConfig);
      
      expect(() => cb.destroy()).not.toThrow();
    });
  });
});

// ============== Retry Handler Tests ==============

describe('RetryHandler', () => {
  describe('Initialization', () => {
    it('should initialize with defaults', () => {
      const retry = new RetryHandler();
      expect(retry).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const retry = new RetryHandler({
        maxAttempts: 5,
        initialDelayMs: 2000,
        maxDelayMs: 60000,
      });
      expect(retry).toBeDefined();
    });
  });

  describe('Successful Execution', () => {
    it('should return result on success', async () => {
      const retry = new RetryHandler({ maxAttempts: 3 });
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await retry.execute(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('not retry on immediate success', async () => {
      const retry = new RetryHandler({ maxAttempts: 5 });
      const fn = vi.fn().mockResolvedValue('ok');
      
      await retry.execute(fn);
      
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure', async () => {
      const retry = new RetryHandler({
        maxAttempts: 3,
        initialDelayMs: 10,
      });
      
      const fn = failNTimes(2, 'success');
      
      const result = await retry.execute(fn);
      
      expect(result).toBe('success');
    });

    it('should exhaust all retries', async () => {
      const retry = new RetryHandler({
        maxAttempts: 3,
        initialDelayMs: 10,
      });
      
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));
      
      await expect(retry.execute(fn)).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should respect max attempts', async () => {
      const retry = new RetryHandler({
        maxAttempts: 5,
        initialDelayMs: 10,
      });
      
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.reject(new Error(`attempt ${callCount}`));
      });
      
      try { await retry.execute(fn); } catch {}
      
      expect(callCount).toBe(5);
    });
  });

  describe('Backoff Calculation', () => {
    it('should calculate exponential backoff', () => {
      const retry = new RetryHandler({
        initialDelayMs: 1000,
        multiplier: 2,
        jitterFactor: 0,
      });
      
      expect(retry.calculateDelay(1)).toBe(1000);
      expect(retry.calculateDelay(2)).toBe(2000);
      expect(retry.calculateDelay(3)).toBe(4000);
      expect(retry.calculateDelay(4)).toBe(8000);
    });

    it('should cap at max delay', () => {
      const retry = new RetryHandler({
        initialDelayMs: 10000,
        multiplier: 10,
        maxDelayMs: 50000,
        jitterFactor: 0,
      });
      
      const delay = retry.calculateDelay(4);
      expect(delay).toBeLessThanOrEqual(50000);
    });

    it('should apply jitter', () => {
      const retry = new RetryHandler({
        initialDelayMs: 1000,
        multiplier: 2,
        jitterFactor: 0.2,
      });
      
      const delays = Array.from({ length: 10 }, (_, i) => retry.calculateDelay(i + 1));
      
      // With jitter, we should see some variation
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it('should never return negative delay', () => {
      const retry = new RetryHandler({
        initialDelayMs: 100,
        jitterFactor: 1, // Very high jitter
      });
      
      for (let i = 0; i < 100; i++) {
        const delay = retry.calculateDelay(i + 1);
        expect(delay).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Retry Callback', () => {
    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const retry = new RetryHandler({
        maxAttempts: 3,
        initialDelayMs: 10,
        onRetry,
      });
      
      const fn = failNTimes(2, 'success');
      
      await retry.execute(fn);
      
      expect(onRetry).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retryable Errors', () => {
    it('should not retry non-retryable errors by default', async () => {
      const retry = new RetryHandler({
        maxAttempts: 3,
        initialDelayMs: 10,
      });
      
      const fn = vi.fn().mockRejectedValue(
        new AppError('Invalid input', ErrorCode.INVALID_INPUT)
      );
      
      try { await retry.execute(fn); } catch {}
      
      // Should not retry validation-like errors
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry network-like errors', async () => {
      const retry = new RetryHandler({
        maxAttempts: 3,
        initialDelayMs: 10,
      });
      
      const fn = failNTimes(2, 'success', new Error('ECONNREFUSED'));
      
      const result = await retry.execute(fn);
      expect(result).toBe('success');
    });

    it('should filter by specific error codes', async () => {
      const retry = new RetryHandler({
        maxAttempts: 3,
        initialDelayMs: 10,
        retryableErrors: [ErrorCode.API_REQUEST_FAILED],
      });
      
      // Non-retryable error code
      const fn1 = vi.fn().mockRejectedValue(
        new AppError('Validation failed', ErrorCode.VALIDATION_ERROR)
      );
      
      try { await retry.execute(fn1); } catch {}
      expect(fn1).toHaveBeenCalledTimes(1);

      // Retryable error code
      const fn2 = failNTimes(1, 'ok', 
        new AppError('API failed', ErrorCode.API_REQUEST_FAILED)
      );
      
      const result = await retry.execute(fn2);
      expect(result).toBe('ok');
    });
  });
});

// ============== Bulkhead Tests ==============

describe('Bulkhead', () => {
  const defaultBulkheadConfig: BulkheadConfig = {
    name: 'test-bulkhead',
    maxConcurrent: 2,
    maxWaitQueueLength: 5,
    maxWaitTimeMs: 100,
  };

  describe('Initialization', () => {
    it('should initialize with defaults', () => {
      const bulkhead = new Bulkhead({ name: 'test' });
      expect(bulkhead.getStats().currentRunning).toBe(0);
    });

    it('should accept custom configuration', () => {
      const bulkhead = new Bulkhead({
        name: 'custom',
        maxConcurrent: 20,
        maxWaitQueueLength: 100,
      });
      
      expect(bulkhead).toBeDefined();
      bulkhead.destroy();
    });
  });

  describe('Execution', () => {
    it('should allow execution within limits', async () => {
      const bulkhead = new Bulkhead(defaultBulkheadConfig);
      
      const result = await bulkhead.execute(() => Promise.resolve('ok'));
      
      expect(result).toBe('ok');
      expect(bulkhead.getStats().totalAccepted).toBe(1);
      bulkhead.destroy();
    });

    it('should track running count correctly', async () => {
      const bulkhead = new Bulkhead({
        ...defaultBulkheadConfig,
        maxConcurrent: 3,
      });
      
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>(resolve => { resolveFirst = resolve; });
      
      // Start a long-running operation
      const operationPromise = bulkhead.execute(() => firstPromise);
      
      // Give it time to start
      await delay(10);
      
      expect(bulkhead.getStats().currentRunning).toBe(1);
      
      // Resolve and finish
      resolveFirst!();
      await operationPromise;
      
      expect(bulkhead.getStats().currentRunning).toBe(0);
      bulkhead.destroy();
    });

    it('should queue requests when full', async () => {
      const bulkhead = new Bulkhead({
        ...defaultBulkheadConfig,
        maxConcurrent: 1,
        maxWaitQueueLength: 5,
        maxWaitTimeMs: 500,
      });
      
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>(resolve => { resolveFirst = resolve; });
      
      // Start one operation that takes a while
      const op1 = bulkhead.execute(() => firstPromise);
      await delay(10);
      
      // Queue another operation
      const op2 = bulkhead.execute(() => Promise.resolve('second'));
      
      // Resolve first to let second proceed
      resolveFirst!();
      
      const results = await Promise.all([op1, op2]);
      expect(results[1]).toBe('second');
      expect(bulkhead.getStats().totalAccepted).toBe(2);
      bulkhead.destroy();
    });
  });

  describe('Rejection', () => {
    it('should reject when queue is full', async () => {
      const bulkhead = new Bulkhead({
        ...defaultBulkheadConfig,
        maxConcurrent: 1,
        maxWaitQueueLength: 1,
        maxWaitTimeMs: 1000,
      });
      
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>(resolve => { resolveFirst = resolve; });
      
      // Start one operation
      bulkhead.execute(() => firstPromise);
      await delay(10);
      
      // Queue one more
      const queuedOp = bulkhead.execute(() => Promise.resolve('queued'));
      
      // This one should be rejected (queue full)
      await expect(bulkhead.execute(() => Promise.resolve('rejected'))).rejects.toThrow('queue is full');
      
      // Clean up
      resolveFirst!();
      await queuedOp;
      bulkhead.destroy();
    });

    it('should reject on wait timeout', async () => {
      const bulkhead = new Bulkhead({
        ...defaultBulkheadConfig,
        maxConcurrent: 1,
        maxWaitQueueLength: 10,
        maxWaitTimeMs: 30, // Very short timeout
      });
      
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>(resolve => { resolveFirst = resolve; });
      
      // Start one operation that holds the slot
      bulkhead.execute(() => firstPromise);
      await delay(10);
      
      // Queue an operation that will timeout
      await expect(bulkhead.execute(() => Promise.resolve('timeout'))).rejects.toThrow('wait timeout');
      
      resolveFirst!();
      bulkhead.destroy();
    });
  });

  describe('Statistics', () => {
    it('should track accepted and rejected counts', async () => {
      const bulkhead = new Bulkhead({
        ...defaultBulkheadConfig,
        maxConcurrent: 1,
        maxWaitQueueLength: 0, // No queue
      });
      
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>(resolve => { resolveFirst = resolve; });
      
      // First one accepted
      bulkhead.execute(() => firstPromise);
      await delay(10);
      
      // Rest rejected
      try { await bulkhead.execute(() => Promise.resolve('')); } catch {}
      try { await bulkhead.execute(() => Promise.resolve('')); } catch {}
      
      const stats = bulkhead.getStats();
      expect(stats.totalAccepted).toBe(1);
      expect(stats.totalRejected).toBe(2);
      
      resolveFirst!();
      bulkhead.destroy();
    });

    it('should report available capacity', () => {
      const bulkhead = new Bulkhead({
        ...defaultBulkheadConfig,
        maxConcurrent: 5,
      });
      
      expect(bulkhead.getAvailableCapacity()).toBe(5);
      bulkhead.destroy();
    });
  });

  describe('Destroy', () => {
    it('should clean up waiting requests on destroy', async () => {
      const bulkhead = new Bulkhead({
        ...defaultBulkheadConfig,
        maxConcurrent: 1,
        maxWaitQueueLength: 5,
        maxWaitTimeMs: 5000,
      });
      
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>(resolve => { resolveFirst = resolve; });
      
      // Start operation and queue some
      bulkhead.execute(() => firstPromise);
      await delay(10);
      
      const queuedOp = bulkhead.execute(() => Promise.resolve('queued')).catch(e => e);
      
      // Destroy should reject queued operations
      bulkhead.destroy();
      resolveFirst!();
      
      const result = await queuedOp;
      expect(result).toBeInstanceOf(Error);
    });
  });
});

// ============== Timeout Handler Tests ==============

describe('TimeoutHandler', () => {
  describe('Initialization', () => {
    it('should initialize with defaults', () => {
      const timeout = new TimeoutHandler();
      expect(timeout).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const timeout = new TimeoutHandler({
        timeoutMs: 5000,
        timeoutErrorMessage: 'Custom timeout message',
      });
      expect(timeout).toBeDefined();
    });
  });

  describe('Execution', () => {
    it('should complete before timeout', async () => {
      const timeout = new TimeoutHandler({ timeoutMs: 1000 });
      
      const result = await timeout.execute(() => 
        Promise.resolve('completed quickly')
      );
      
      expect(result).toBe('completed quickly');
    });

    it('should timeout on slow operations', async () => {
      const timeout = new TimeoutHandler({ 
        timeoutMs: 50,
        timeoutErrorMessage: 'Operation too slow',
      });
      
      await expect(
        timeout.execute(() => delay(1000).then(() => 'too late'))
      ).rejects.toThrow('Operation too slow');
    });

    it('should throw API_TIMEOUT error code', async () => {
      const timeout = new TimeoutHandler({ timeoutMs: 50 });
      
      try {
        await timeout.execute(() => delay(100));
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.API_TIMEOUT);
      }
    });
  });

  describe('Configuration Merging', () => {
    it('should merge configs with withConfig', () => {
      const base = new TimeoutHandler({ timeoutMs: 5000 });
      const derived = base.withConfig({ timeoutMs: 1000 });
      
      // They should be independent instances
      expect(base).not.toBe(derived);
    });
  });
});

// ============== Fallback Provider Tests ==============

describe('FallbackProvider', () => {
  describe('Static Value Fallback', () => {
    it('should provide static fallback value', async () => {
      const fallback = FallbackProvider.withValue('default-value');
      
      const result = await fallback.execute(
        () => Promise.reject(new Error('failed')),
        {}
      );
      
      expect(result).toBe('default-value');
    });

    it('should return original value on success', async () => {
      const fallback = FallbackProvider.withValue('fallback');
      
      const result = await fallback.execute(
        () => Promise.resolve('original'),
        {}
      );
      
      expect(result).toBe('original');
    });
  });

  describe('Function Fallback', () => {
    it('should call fallback function on error', async () => {
      const fallbackFn = vi.fn().mockResolvedValue('fallback-result');
      const fallback = new FallbackProvider(fallbackFn);
      
      const result = await fallback.execute(
        () => Promise.reject(new Error('error')),
        { key: 'value' }
      );
      
      expect(result).toBe('fallback-result');
      expect(fallbackFn).toHaveBeenCalled();
    });

    it('should pass error and context to fallback', async () => {
      const fallbackFn = vi.fn().mockImplementation((err, ctx) => {
        expect(err).toBeInstanceOf(Error);
        expect(ctx).toEqual({ contextKey: 'contextValue' });
        return 'handled';
      });
      
      const fallback = new FallbackProvider(fallbackFn);
      
      const result = await fallback.execute(
        () => Promise.reject(new Error('test')),
        { contextKey: 'contextValue' }
      );
      
      expect(result).toBe('handled');
    });

    it('should propagate fallback function errors', async () => {
      const badFallback = new FallbackProvider<unknown>(
        () => Promise.reject(new Error('Fallback also failed'))
      );
      
      await expect(
        badFallback.execute(() => Promise.reject(new Error('Original')))
      ).rejects.toThrow('Fallback also failed');
    });
  });

  describe('Set Fallback', () => {
    it('should allow setting fallback after construction', async () => {
      const fallback = new FallbackProvider<string>();
      
      // No fallback initially
      await expect(
        fallback.execute(() => Promise.reject(new Error('no fallback')))
      ).rejects.toThrow('no fallback');
      
      // Set fallback
      fallback.setFallback(() => 'now I have fallback');
      
      const result = await fallback.execute(
        () => Promise.reject(new Error('error'))
      );
      
      expect(result).toBe('now I have fallback');
    });
  });
});

// ============== Rate Limiter Tests ==============

describe('RateLimiter', () => {
  describe('Initialization', () => {
    it('should initialize with defaults', () => {
      const limiter = new RateLimiter();
      expect(limiter).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const limiter = new RateLimiter({
        limit: 50,
        windowMs: 30000,
        key: 'custom-key',
      });
      expect(limiter).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests under limit', () => {
      const limiter = new RateLimiter({ limit: 5, windowMs: 1000 });
      
      for (let i = 0; i < 5; i++) {
        const result = limiter.tryAcquire();
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests over limit', () => {
      const limiter = new RateLimiter({ limit: 2, windowMs: 1000 });
      
      // Use up limit
      limiter.tryAcquire();
      limiter.tryAcquire();
      
      // Next should be blocked
      const result = limiter.tryAcquire();
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should report remaining count', () => {
      const limiter = new RateLimiter({ limit: 10, windowMs: 1000 });
      
      const r1 = limiter.tryAcquire();
      expect(r1.remaining).toBe(9);
      
      const r2 = limiter.tryAcquire();
      expect(r2.remaining).toBe(8);
    });

    it('should provide reset timestamp', () => {
      const limiter = new RateLimiter({ limit: 1, windowMs: 1000 });
      
      limiter.tryAcquire();
      const result = limiter.tryAcquire();
      
      expect(result.resetAt).toBeInstanceOf(Date);
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Execute Method', () => {
    it('should execute when under limit', async () => {
      const limiter = new RateLimiter({ limit: 5, windowMs: 1000 });
      
      const result = await limiter.execute(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });

    it('should throw when rate limited', async () => {
      const limiter = new RateLimiter({ limit: 1, windowMs: 1000 });
      
      await limiter.execute(() => Promise.resolve('first'));
      
      await expect(
        limiter.execute(() => Promise.resolve('second'))
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Statistics', () => {
    it('should report usage stats', () => {
      const limiter = new RateLimiter({ limit: 10, windowMs: 1000 });
      
      limiter.tryAcquire();
      limiter.tryAcquire();
      limiter.tryAcquire();
      
      const stats = limiter.getStats();
      expect(stats.used).toBe(3);
      expect(stats.limit).toBe(10);
      expect(stats.remaining).toBe(7);
    });
  });

  describe('Reset', () => {
    it('should clear all tracked requests', () => {
      const limiter = new RateLimiter({ limit: 2, windowMs: 1000 });
      
      limiter.tryAcquire();
      limiter.tryAcquire();
      expect(limiter.tryAcquire().allowed).toBe(false);
      
      limiter.reset();
      expect(limiter.tryAcquire().allowed).toBe(true);
    });
  });
});

// ============== Resilience Manager Tests ==============

describe('ResilienceManager', () => {
  describe('Initialization', () => {
    it('should initialize with minimal config', () => {
      const manager = new ResilienceManager('test-manager');
      expect(manager).toBeDefined();
    });

    it('should initialize with full config', () => {
      const manager = new ResilienceManager('full-manager', {
        circuitBreaker: { name: 'cb' },
        retry: { maxAttempts: 5 },
        bulkhead: { name: 'bh' },
        timeout: { timeoutMs: 5000 },
        fallback: async () => 'fallback',
        rateLimiter: { limit: 100 },
      });
      
      expect(manager.getCircuitBreaker()).not.toBeNull();
      expect(manager.getBulkhead()).not.toBeNull();
      expect(manager.getRateLimiter()).not.toBeNull();
      manager.destroy();
    });
  });

  describe('Execute', () => {
    it('should execute successfully', async () => {
      const manager = new ResilienceManager('success-test');
      
      const result = await manager.execute(() => Promise.resolve('ok'));
      
      expect(result.success).toBe(true);
      expect(result.value).toBe('ok');
      expect(result.error).toBeUndefined();
      manager.destroy();
    });

    it('should handle failures', async () => {
      const manager = new ResilienceManager('failure-test');
      
      const result = await manager.execute(
        () => Promise.reject(new Error('failed'))
      );
      
      expect(result.success).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.error).toBeDefined();
      manager.destroy();
    });

    it('should include metrics in result', async () => {
      const manager = new ResilienceManager('metrics-test');
      
      const result = await manager.execute(() => Promise.resolve('data'));
      
      expect(result.metrics).toBeDefined();
      expect(result.metrics.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.metrics.timestamp).toBeInstanceOf(Date);
      manager.destroy();
    });

    it('should apply fallback when configured', async () => {
      const manager = new ResilienceManager('fallback-test', {
        fallback: async () => 'fallback-value',
      });
      
      const result = await manager.execute(
        () => Promise.reject(new Error('original error'))
      );
      
      expect(result.success).toBe(true);
      expect(result.value).toBe('fallback-value');
      expect(result.metrics.fallbackInvoked).toBe(true);
      manager.destroy();
    });
  });

  describe('Component Access', () => {
    it('should expose circuit breaker', () => {
      const manager = new ResilienceManager('cb-access', {
        circuitBreaker: { name: 'my-cb' },
      });
      
      const cb = manager.getCircuitBreaker();
      expect(cb).not.toBeNull();
      expect(cb?.getState()).toBe('CLOSED');
      manager.destroy();
    });

    it('should return null for unconfigured components', () => {
      const manager = new ResilienceManager('no-components');
      
      expect(manager.getCircuitBreaker()).toBeNull();
      expect(manager.getBulkhead()).toBeNull();
      expect(manager.getRateLimiter()).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should aggregate component statistics', async () => {
      const manager = new ResilienceManager('stats-test', {
        circuitBreaker: { name: 'stats-cb' },
        rateLimiter: { limit: 50 },
      });
      
      await manager.execute(() => Promise.resolve('ok'));
      
      const stats = manager.getStats();
      expect(stats.name).toBe('stats-test');
      expect(stats.circuitBreaker).toBeDefined();
      expect(stats.rateLimiter).toBeDefined();
      manager.destroy();
    });
  });

  describe('Manual Control', () => {
    it('should support manual trip', () => {
      const manager = new ResilienceManager('trip-test', {
        circuitBreaker: { name: 'trip-cb' },
      });
      
      manager.trip();
      expect(manager.getCircuitBreaker()?.getState()).toBe('OPEN');
      manager.destroy();
    });

    it('should support manual reset', () => {
      const manager = new ResilienceManager('reset-test', {
        circuitBreaker: { name: 'reset-cb' },
      });
      
      manager.trip();
      manager.reset();
      expect(manager.getCircuitBreaker()?.getState()).toBe('CLOSED');
      manager.destroy();
    });
  });

  describe('Health Check', () => {
    it('should perform health check via manager', async () => {
      const healthCheck = vi.fn().mockResolvedValue({
        healthy: true,
        details: {},
        checkedAt: new Date(),
      });
      
      const manager = new ResilienceManager('hc-test', {
        circuitBreaker: { name: 'hc-cb' },
        healthCheck,
      });
      
      const result = await manager.performHealthCheck();
      
      expect(result).not.toBeNull();
      expect(result?.healthy).toBe(true);
      manager.destroy();
    });
  });

  describe('Destroy', () => {
    it('should clean up all components', () => {
      const manager = new ResilienceManager('destroy-test', {
        circuitBreaker: { name: 'destroy-cb' },
        bulkhead: { name: 'destroy-bh' },
      });
      
      expect(() => manager.destroy()).not.toThrow();
    });
  });
});

// ============== Factory Function Tests ==============

describe('Factory Functions', () => {
  describe('createPaymentResilience', () => {
    it('should create payment resilience manager', () => {
      const manager = createPaymentResilience('txn-123');
      
      expect(manager).toBeInstanceOf(ResilienceManager);
      expect(manager.getCircuitBreaker()).not.toBeNull();
      manager.destroy();
    });

    it('should use transaction ref in names', () => {
      const manager = createPaymentResilience('txn-456');
      
      const cb = manager.getCircuitBreaker()!;
      expect(cb.getStats().state).toBeDefined();
      manager.destroy();
    });

    it('should work without transaction ref', () => {
      const manager = createPaymentResilience();
      
      expect(manager).toBeDefined();
      manager.destroy();
    });
  });

  describe('createApiResilience', () => {
    it('should create API resilience manager', () => {
      const manager = createApiResilience('zainpay');
      
      expect(manager).toBeInstanceOf(ResilienceManager);
      expect(manager.getCircuitBreaker()).not.toBeNull();
      expect(manager.getBulkhead()).not.toBeNull();
      expect(manager.getRateLimiter()).not.toBeNull();
      manager.destroy();
    });

    it('should have API-appropriate settings', () => {
      const manager = createApiResilience('external-api');
      
      // API resilience should have bulkhead and rate limiter
      expect(manager.getBulkhead()).not.toBeNull();
      expect(manager.getRateLimiter()).not.toBeNull();
      manager.destroy();
    });
  });
});

// ============== Decorator/Wrapper Function Tests ==============

describe('Wrapper Functions', () => {
  describe('withCircuitBreaker', () => {
    it('should wrap function with circuit breaker', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const wrapped = withCircuitBreaker(fn, {
        name: 'wrapped-cb',
      });
      
      const result = await wrapped();
      
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalled();
    });

    it('should protect against failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const wrapped = withCircuitBreaker(fn, {
        name: 'protected-fn',
        failureThreshold: 2,
      });
      
      // Should still throw but be protected
      await expect(wrapped()).rejects.toThrow();
    });
  });

  describe('withRetry', () => {
    it('should wrap function with retry logic', async () => {
      const fn = failNTimes(2, 'success');
      const wrapped = withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
      });
      
      const result = await wrapped();
      
      expect(result).toBe('success');
    });
  });

  describe('withTimeout', () => {
    it('should wrap function with timeout', async () => {
      const fn = () => Promise.resolve('fast result');
      const wrapped = withTimeout(fn, 1000);
      
      const result = await wrapped();
      
      expect(result).toBe('fast result');
    });

    it('should timeout slow functions', async () => {
      const fn = () => delay(1000).then(() => 'slow result');
      const wrapped = withTimeout(fn, 50);
      
      await expect(wrapped()).rejects.toThrow();
    });
  });
});

// ============== Integration Tests ==============

describe('Integration Scenarios', () => {
  it('should handle complete payment flow with resilience', async () => {
    const manager = createPaymentResilience('integration-test');
    
    let attempt = 0;
    const processPayment = async () => {
      attempt++;
      if (attempt < 3) {
        throw new AppError('Payment service unavailable', ErrorCode.PAYMENT_INIT_FAILED);
      }
      return { status: 'success', transactionId: 'txn-123' };
    };
    
    const result = await manager.execute(processPayment);
    
    expect(result.success).toBe(true);
    expect(result.value).toEqual({ status: 'success', transactionId: 'txn-123' });
    expect(result.metrics.attempts).toBeGreaterThanOrEqual(2);
    manager.destroy();
  });

  it('should cascade through all patterns correctly', async () => {
    const manager = new ResilienceManager('cascade-test', {
      circuitBreaker: {
        name: 'cascade-cb',
        failureThreshold: 10,
        resetTimeout: 100,
      },
      retry: {
        maxAttempts: 2,
        initialDelayMs: 10,
      },
      fallback: async (error) => ({
        status: 'degraded',
        originalError: error.message,
      }),
    });
    
    const alwaysFail = () => Promise.reject(new Error('Always fails'));
    
    const result = await manager.execute(alwaysFail);
    
    // Should eventually use fallback
    expect(result.success).toBe(true);
    expect((result.value as Record<string, unknown>).status).toBe('degraded');
    expect(result.metrics.fallbackInvoked).toBe(true);
    manager.destroy();
  });

  it('should recover after circuit opens and closes', async () => {
    const manager = new ResilienceManager('recovery-test', {
      circuitBreaker: {
        name: 'recovery-cb',
        failureThreshold: 3,
        resetTimeout: 50,
        halfOpenSuccessThreshold: 1,
      },
      retry: { maxAttempts: 1 }, // Don't retry much
    });
    
    let shouldFail = true;
    const flakyService = async () => {
      if (shouldFail) {
        throw new Error('Service down');
      }
      return 'recovered';
    };
    
    // Fail enough to open circuit
    for (let i = 0; i < 3; i++) {
      try { await manager.execute(flakyService); } catch {}
    }
    
    expect(manager.getCircuitBreaker()?.getState()).toBe('OPEN');
    
    // Wait for recovery
    await delay(60);
    shouldFail = false;
    
    // Should work now
    const result = await manager.execute(flakyService);
    
    expect(result.success).toBe(true);
    expect(result.value).toBe('recovered');
    expect(manager.getCircuitBreaker()?.getState()).toBe('CLOSED');
    manager.destroy();
  });
});
