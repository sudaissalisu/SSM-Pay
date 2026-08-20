/**
 * Fallback, Timeout & Rate Limiter Module
 * 
 * Provides:
 * - Fallback Provider for graceful degradation
 * - Timeout Handler for operation time limits
 * - Rate Limiter for request throttling
 * 
 * @module services/resilience/fallback
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode, wrapError } from '@/lib/errors';

// ============== Type Definitions ==============

/**
 * Fallback function type
 */
export type FallbackFunction<T> = (error: Error, context: Record<string, unknown>) => T | Promise<T>;

/**
 * Configuration options for Timeout
 */
export interface TimeoutConfig {
  timeoutMs?: number;
  cancelOnTimeout?: boolean;
  timeoutErrorMessage?: string;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  limit?: number;
  windowMs?: number;
  key?: string;
}

// ============== Timeout Handler Class ==============

/**
 * Timeout Handler
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
   */
  async execute<T>(fn: () => T | Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new AppError(
          this.config.timeoutErrorMessage,
          ErrorCode.API_TIMEOUT,
          { severity: 'warning', context: { timeoutMs: this.config.timeoutMs } }
        );

        logger.warn('Operation timed out', {
          event: 'timeout.exceeded',
          metadata: { timeoutMs: this.config.timeoutMs },
          error,
        });

        reject(error);
      }, this.config.timeoutMs);

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

// ============== Fallback Provider Class ==============

/**
 * Fallback Provider
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

// ============== Rate Limiter Class ==============

/**
 * In-Memory Rate Limiter
 */
export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private requests: number[] = [];

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
