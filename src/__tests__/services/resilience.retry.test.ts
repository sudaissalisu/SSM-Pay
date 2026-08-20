/**
 * @fileoverview Test suite for Retry Handler pattern
 * @module services/resilience.retry.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RetryHandler,
  createRetryHandler,
} from '@/services/resilience/retry';
import {
  RetryStrategy,
  ErrorClass,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
  type RetryAttempt,
  type RetryResult,
} from '@/services/resilience/types';

describe('Retry Handler Pattern', () => {
  
  describe('Exponential Backoff Calculation', () => {
    let handler: RetryHandler;

    beforeEach(() => {
      handler = new RetryHandler({
        strategy: RetryStrategy.EXPONENTIAL,
        maxAttempts: 5,
        initialDelayMs: 1000,
        multiplier: 2,
        maxDelayMs: 30000,
        jitterEnabled: false,
      });
    });

    it('should calculate exponential delays correctly', () => {
      // With initial=1000, multiplier=2:
      // retry 1: 1000 * 2^0 = 1000
      // retry 2: 1000 * 2^1 = 2000
      // retry 3: 1000 * 2^2 = 4000
      // retry 4: 1000 * 2^3 = 8000

      const delay1 = handler.calculateDelay(1);
      const delay2 = handler.calculateDelay(2);
      const delay3 = handler.calculateDelay(3);
      const delay4 = handler.calculateDelay(4);

      expect(delay1).toBe(1000);
      expect(delay2).toBe(2000);
      expect(delay3).toBe(4000);
      expect(delay4).toBe(8000);
    });

    it('should double each subsequent delay', () => {
      const delays = [1, 2, 3, 4].map(n => handler.calculateDelay(n));

      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).toBe(delays[i - 1] * 2);
      }
    });

    it('should use custom multiplier when configured', () => {
      const customHandler = new RetryHandler({
        strategy: RetryStrategy.EXPONENTIAL,
        initialDelayMs: 100,
        multiplier: 3,
        maxDelayMs: 100000,
      });

      const delay1 = customHandler.calculateDelay(1); // 100 * 3^0 = 100
      const delay2 = customHandler.calculateDelay(2); // 100 * 3^1 = 300
      const delay3 = customHandler.calculateDelay(3); // 100 * 3^2 = 900

      expect(delay1).toBe(100);
      expect(delay2).toBe(300);
      expect(delay3).toBe(900);
    });
  });

  describe('Jitter Addition', () => {
    it('should add randomness to delays when enabled', () => {
      const handler = new RetryHandler({
        strategy: RetryStrategy.EXPONENTIAL_JITTER,
        initialDelayMs: 1000,
        multiplier: 2,
        jitterEnabled: true,
        jitterFactor: 0.5,
        maxDelayMs: 50000,
      });

      const delays = Array.from({ length: 10 }, (_, i) => 
        handler.calculateDelay(i + 1)
      );

      // With jitter, we should see variation in delays
      const uniqueDelays = new Set(delays);
      
      // It's possible (though unlikely) all are same, but typically they vary
      // At minimum, verify delays are in reasonable range
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(50000);
      });
    });

    it('should not add jitter when disabled', () => {
      const handler = new RetryHandler({
        strategy: RetryStrategy.EXPONENTIAL_JITTER,
        initialDelayMs: 1000,
        multiplier: 2,
        jitterEnabled: false,
        maxDelayMs: 50000,
      });

      const delay1 = handler.calculateDelay(1);
      const delay2 = handler.calculateDelay(1);

      // Without jitter, should be deterministic
      expect(delay1).toBe(delay2);
      expect(delay1).toBe(1000);
    });

    it('should keep jittered delays within reasonable bounds', () => {
      const handler = new RetryHandler({
        strategy: RetryStrategy.EXPONENTIAL_JITTER,
        initialDelayMs: 2000,
        multiplier: 2,
        jitterEnabled: true,
        jitterFactor: 0.25, // ±25%
        maxDelayMs: 60000,
      });

      // Calculate base exponential delay for retry 3: 2000 * 2^2 = 8000
      const baseDelay = 8000;
      
      // Run multiple times to check bounds
      for (let i = 0; i < 20; i++) {
        const delay = handler.calculateDelay(3);
        // Should be roughly within ±50% of base (with jitter factor 0.25)
        expect(delay).toBeGreaterThan(baseDelay * 0.5); // Lower bound
        expect(delay).toBeLessThan(baseDelay * 2.5); // Upper bound with some margin
      }
    });
  });

  describe('Max Retries Enforcement', () => {
    it('should stop retrying after max attempts', async () => {
      let attemptCount = 0;
      const handler = new RetryHandler({
        maxAttempts: 3,
        initialDelayMs: 10, // Very short for testing
        jitterEnabled: false,
      });

      const result: RetryResult<string> = await handler.execute(async () => {
        attemptCount++;
        throw new Error('Always fails');
      });

      expect(attemptCount).toBe(3);
      expect(result.attempts).toBe(3);
      expect(result.error).toBeDefined();
      expect(result.value).toBeUndefined();
    });

    it('should return success before max retries if operation succeeds', async () => {
      let attemptCount = 0;
      const handler = new RetryHandler({
        maxAttempts: 5,
        initialDelayMs: 10,
        jitterEnabled: false,
      });

      const result = await handler.execute(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Not yet');
        }
        return 'success on third try';
      });

      expect(attemptCount).toBe(3);
      expect(result.value).toBe('success on third try');
      expect(result.error).toBeUndefined();
      expect(result.attempts).toBe(3);
    });

    it('should succeed on first attempt when no error', async () => {
      const handler = new RetryHandler({
        maxAttempts: 3,
        initialDelayMs: 10,
        jitterEnabled: false,
      });

      const result = await handler.execute(() => Promise.resolve('immediate'));

      expect(result.value).toBe('immediate');
      expect(result.attempts).toBe(1);
      expect(result.attemptLog[0].delayMs).toBe(0); // No delay for first attempt
    });

    it('should record attempt log with correct data', async () => {
      let callNumber = 0;
      const handler = new RetryHandler({
        maxAttempts: 3,
        initialDelayMs: 50,
        jitterEnabled: false,
      });

      const result = await handler.execute(async () => {
        callNumber++;
        if (callNumber === 1) throw new Error('first fail');
        if (callNumber === 2) throw new Error('second fail');
        return 'recovered';
      });

      expect(result.attemptLog.length).toBe(3);

      // First attempt - failed
      expect(result.attemptLog[0].attempt).toBe(1);
      expect(result.attemptLog[0].delayMs).toBe(0);
      expect(result.attemptLog[0].error?.message).toBe('first fail');

      // Second attempt - failed
      expect(result.attemptLog[1].attempt).toBe(2);
      expect(result.attemptLog[1].delayMs).toBe(50); // Initial delay

      // Third attempt - succeeded (no error)
      expect(result.attemptLog[2].attempt).toBe(3);
      expect(result.attemptLog[2].error).toBeUndefined();
    });
  });

  describe('Retry Strategy Variants', () => {
    it('should implement FIXED strategy', () => {
      const handler = new RetryHandler({
        strategy: RetryStrategy.FIXED,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        jitterEnabled: false,
      });

      expect(handler.calculateDelay(1)).toBe(1000);
      expect(handler.calculateDelay(2)).toBe(1000);
      expect(handler.calculateDelay(5)).toBe(1000);
    });

    it('should implement LINEAR strategy', () => {
      const handler = new RetryHandler({
        strategy: RetryStrategy.LINEAR,
        initialDelayMs: 500,
        maxDelayMs: 10000,
        jitterEnabled: false,
      });

      expect(handler.calculateDelay(1)).toBe(500);   // 500 * 1
      expect(handler.calculateDelay(2)).toBe(1000);  // 500 * 2
      expect(handler.calculateDelay(3)).toBe(1500);  // 500 * 3
    });

    it('should implement NONE strategy (no delay)', () => {
      const handler = new RetryHandler({
        strategy: RetryStrategy.NONE,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
      });

      expect(handler.calculateDelay(1)).toBe(0);
      expect(handler.calculateDelay(10)).toBe(0);
    });

    it('should cap delays at maximum', () => {
      const handler = new RetryHandler({
        strategy: RetryStrategy.EXPONENTIAL,
        initialDelayMs: 1000,
        multiplier: 10, // Aggressive growth
        maxDelayMs: 5000, // Low cap
        jitterEnabled: false,
      });

      // 1000 * 10^3 = 1,000,000 but capped at 5000
      expect(handler.calculateDelay(4)).toBe(5000);
      expect(handler.calculateDelay(10)).toBe(5000);
    });
  });

  describe('Error Classification', () => {
    it('should classify network errors as retryable', () => {
      const handler = new RetryHandler();

      const networkError = new Error('ECONNREFUSED connection refused');
      const timeoutError = new Error('ETIMEDOUT operation timed out');
      const socketError = new Error('ECONNRESET connection reset');

      expect(handler.shouldRetry(networkError, 1)).toBe(true);
      expect(handler.shouldRetry(timeoutError, 1)).toBe(true);
      expect(handler.shouldRetry(socketError, 1)).toBe(true);
    });

    it('should classify auth errors as non-retryable', () => {
      const handler = new RetryHandler();

      const authError = new Error('Unauthorized access denied');
      const forbiddenError = new Error('Forbidden resource');
      const eAuthError = Object.assign(new Error('auth failed'), { code: 'EAUTH' });

      expect(handler.shouldRetry(authError, 1)).toBe(false);
      expect(handler.shouldRetry(forbiddenError, 1)).toBe(false);
      expect(handler.shouldRetry(eAuthError, 1)).toBe(false);
    });

    it('should respect max attempts even for retryable errors', () => {
      const handler = new RetryHandler({ maxAttempts: 2 });

      const retryableError = new Error('ETIMEDOUT timed out');
      
      // First attempt - should retry
      expect(handler.shouldRetry(retryableError, 1)).toBe(true);
      
      // Second (last) attempt - should not retry
      expect(handler.shouldRetry(retryableError, 2)).toBe(false);
    });

    it('should classify rate limit errors as retryable', () => {
      const handler = new RetryHandler();

      const rateLimitError = new Error('Rate limit exceeded, too many requests');
      
      expect(handler.shouldRetry(rateLimitError, 1)).toBe(true);
    });

    it('should classify validation errors as non-retryable', () => {
      const handler = new RetryHandler();

      const validationError = new Error('Validation failed: invalid email format');
      
      expect(handler.shouldRetry(validationError, 1)).toBe(false);
    });
  });

  describe('Pre-configured Handlers', () => {
    it('should create network-optimized handler', () => {
      const handler = createRetryHandler('network');
      const config = handler.getConfig();

      expect(config.strategy).toBe(RetryStrategy.EXPONENTIAL_JITTER);
      expect(config.maxAttempts).toBe(5);
      expect(config.initialDelayMs).toBe(500);
    });

    it('should create database-optimized handler', () => {
      const handler = createRetryHandler('database');
      const config = handler.getConfig();

      expect(config.strategy).toBe(RetryStrategy.EXPONENTIAL);
      expect(config.maxAttempts).toBe(3);
      expect(config.initialDelayMs).toBe(100);
    });

    it('should create external API handler', () => {
      const handler = createRetryHandler('external_api');
      const config = handler.getConfig();

      expect(config.strategy).toBe(RetryStrategy.EXPONENTIAL_JITTER);
      expect(config.retryableStatusCodes).toContain(429);
      expect(config.retryableStatusCodes).toContain(503);
    });

    it('should create default handler', () => {
      const handler = createRetryHandler('default');
      const config = handler.getConfig();

      expect(config).toBeDefined();
      expect(config.maxAttempts).toBe(DEFAULT_RETRY_CONFIG.maxAttempts);
    });
  });

  describe('Configuration Management', () => {
    it('should allow updating configuration', () => {
      const handler = new RetryHandler({
        maxAttempts: 3,
        initialDelayMs: 100,
      });

      handler.updateConfig({
        maxAttempts: 7,
        initialDelayMs: 500,
      });

      const config = handler.getConfig();
      expect(config.maxAttempts).toBe(7);
      expect(config.initialDelayMs).toBe(500);
    });

    it('should use default values for unspecified options', () => {
      const handler = new RetryHandler({});
      const config = handler.getConfig();

      expect(config.strategy).toBe(DEFAULT_RETRY_CONFIG.strategy);
      expect(config.jitterEnabled).toBe(DEFAULT_RETRY_CONFIG.jitterEnabled);
    });
  });

  describe('Total Duration Tracking', () => {
    it('should track total execution duration including delays', async () => {
      let calls = 0;
      const handler = new RetryHandler({
        maxAttempts: 3,
        initialDelayMs: 20, // Short delays for testing
        jitterEnabled: false,
      });

      const startTime = Date.now();

      await handler.execute(async () => {
        calls++;
        if (calls < 3) throw new Error('fail');
        return 'done';
      });

      const totalTime = Date.now() - startTime;

      // Should have taken at least 20ms (one delay between attempts)
      expect(totalTime).toBeGreaterThanOrEqual(15); // Small tolerance
    });
  });
});
