/**
 * Retry Pattern Module
 * 
 * Provides configurable retry logic with:
 * - Exponential backoff with jitter
 * - Configurable retry conditions
 * - Attempt callbacks
 * - Max retry limits
 * 
 * @module services/resilience/retry
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode, wrapError } from '@/lib/errors';

// ============== Type Definitions ==============

/**
 * Configuration options for Retry with backoff
 */
export interface RetryConfig {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  multiplier?: number;
  jitterFactor?: number;
  retryableErrors?: ErrorCode[];
  retryableStatusCodes?: number[];
  onRetry?: (error: Error, attempt: number) => void;
}

// ============== Retry Handler Class ==============

/**
 * Retry Handler with Exponential Backoff
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
    const exponentialDelay = this.config.initialDelayMs * 
      Math.pow(this.config.multiplier, attempt - 1);
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
    
    if (this.config.retryableErrors.length === 0 && this.config.retryableStatusCodes.length === 0) {
      return !isNonRetryable;
    }

    return !isNonRetryable;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<RetryConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
