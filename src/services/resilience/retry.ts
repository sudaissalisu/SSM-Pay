/**
 * Retry Handler Implementation
 * Provides configurable retry strategies with backoff and jitter
 */

import {
  RetryStrategy,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  ErrorClass,
} from './types';

/** Retry attempt record */
export interface RetryAttempt {
  /** Attempt number (1-based) */
  attempt: number;
  /** Timestamp of this attempt */
  timestamp: string;
  /** Delay before this attempt (ms) */
  delayMs: number;
  /** Error that caused retry (if any) */
  error?: Error;
  /** Whether this was the final attempt */
  isFinal: boolean;
}

/** Result of a retried execution */
export interface RetryResult<T> {
  /** The result value if successful */
  value?: T;
  /** Final error if all attempts failed */
  error?: Error;
  /** Total number of attempts made */
  attempts: number;
  /** Total time spent including delays (ms) */
  totalDurationMs: number;
  /** Record of each attempt */
  attemptLog: RetryAttempt[];
}

/** Error classification function signature */
export type ErrorClassifier = (error: Error) => ErrorClass;

/**
 * RetryHandler - Manages retry logic with various strategies
 */
export class RetryHandler {
  private config: RetryConfig;
  private errorClassifier: ErrorClassifier;

  constructor(
    config: Partial<RetryConfig> = {},
    errorClassifier?: ErrorClassifier
  ) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    this.errorClassifier = errorClassifier || this.defaultErrorClassifier;
  }

  /**
   * Execute a function with retry logic
   * @param fn - The async function to execute
   * @returns Promise resolving to retry result
   */
  async execute<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const attempts: RetryAttempt[] = [];
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      // Calculate delay for this attempt (0 for first)
      const delayMs = attempt === 1 ? 0 : this.calculateDelay(attempt - 1);

      // Record attempt start
      const attemptRecord: RetryAttempt = {
        attempt,
        timestamp: new Date().toISOString(),
        delayMs,
        isFinal: attempt === this.config.maxAttempts,
      };

      // Wait before retrying (not on first attempt)
      if (attempt > 1 && delayMs > 0) {
        await this.sleep(delayMs);
      }

      try {
        const value = await fn();

        // Success!
        return {
          value,
          attempts: attempt,
          totalDurationMs: Date.now() - startTime,
          attemptLog: [...attempts, attemptRecord],
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attemptRecord.error = lastError;
        attempts.push(attemptRecord);

        // Check if we should retry
        if (!this.shouldRetry(lastError, attempt)) {
          break;
        }

        // Call onRetry callback if provided
        if (this.config.onRetry) {
          this.config.onRetry(attempt, lastError, this.calculateDelay(attempt));
        }
      }
    }

    // All attempts exhausted or non-retryable error
    return {
      error: lastError || new Error('Unknown error'),
      attempts: attempts.length || 1,
      totalDurationMs: Date.now() - startTime,
      attemptLog: attempts,
    };
  }

  /**
   * Calculate delay for a given retry attempt using configured strategy
   * @param retryNumber - Which retry number (1-based, not counting initial attempt)
   * @returns Delay in milliseconds
   */
  calculateDelay(retryNumber: number): number {
    let delay: number;

    switch (this.config.strategy) {
      case RetryStrategy.FIXED:
        delay = this.config.initialDelayMs;
        break;

      case RetryStrategy.LINEAR:
        delay = this.config.initialDelayMs * retryNumber;
        break;

      case RetryStrategy.EXPONENTIAL:
        delay = this.config.initialDelayMs * Math.pow(this.config.multiplier, retryNumber);
        break;

      case RetryStrategy.EXPONENTIAL_JITTER:
        delay = this.exponentialBackoffWithJitter(retryNumber);
        break;

      case RetryStrategy.NONE:
      default:
        return 0;
    }

    // Apply max delay cap
    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Exponential backoff with jitter calculation
   * Uses "decorrelated jitter" algorithm for better distribution
   */
  exponentialBackoffWithJitter(retryNumber: number): number {
    const exponentialDelay =
      this.config.initialDelayMs * Math.pow(this.config.multiplier, retryNumber);

    if (!this.config.jitterEnabled) {
      return exponentialDelay;
    }

    // Decorrelated jitter: random between base and previous * random(2,3)
    const jitter = exponentialDelay * this.config.jitterFactor * (Math.random() * 2);

    return Math.floor(exponentialDelay + jitter);
  }

  /**
   * Determine if an error should trigger a retry
   */
  shouldRetry(error: Error, currentAttempt: number): boolean {
    // Don't exceed max attempts
    if (currentAttempt >= this.config.maxAttempts) {
      return false;
    }

    // Classify the error
    const classification = this.errorClassifier(error);

    if (classification === ErrorClass.NON_RETRYABLE) {
      return false;
    }

    if (classification === ErrorClass.RETRYABLE) {
      return true;
    }

    // Unknown - check against configured lists
    return this.isRetryableByConfig(error);
  }

  /**
   * Check if error matches retryable configuration
   */
  private isRetryableByConfig(error: Error): boolean {
    // Check error message/code
    const errorMessage = error.message.toUpperCase();
    const errorCode = (error as { code?: string })?.code?.toUpperCase() || '';

    const matchesErrorType = this.config.retryableErrors.some((pattern) =>
      errorMessage.includes(pattern.toUpperCase()) ||
      errorCode.includes(pattern.toUpperCase())
    );

    if (matchesErrorType) return true;

    // Check HTTP status code for errors that include status
    const statusCode = (error as { statusCode?: number; status?: number })
      ?.statusCode || (error as { statusCode?: number; status?: number })?.status;

    if (statusCode && this.config.retryableStatusCodes.includes(statusCode)) {
      return true;
    }

    // Default to retry for unknown errors
    return true;
  }

  /**
   * Default error classifier
   */
  private defaultErrorClassifier(error: Error): ErrorClass {
    const message = error.message.toLowerCase();
    const code = (error as { code?: string })?.code?.toLowerCase() || '';

    // Network errors are typically retryable
    if (
      code.includes('econnrefused') ||
      code.includes('etimedout') ||
      code.includes('econnreset') ||
      code.includes('enotfound') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('socket')
    ) {
      return ErrorClass.RETRYABLE;
    }

    // Authentication/authorization errors are not retryable
    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('authentication') ||
      code.includes('eauth')
    ) {
      return ErrorClass.NON_RETRYABLE;
    }

    // Validation errors are not retryable
    if (
      message.includes('validation') ||
      message.includes('invalid') &&
      !message.includes('token')
    ) {
      return ErrorClass.NON_RETRYABLE;
    }

    // Rate limiting might be retryable
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return ErrorClass.RETRYABLE;
    }

    return ErrorClass.UNKNOWN;
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a pre-configured retry handler for common scenarios
 */
export function createRetryHandler(scenario: 'network' | 'database' | 'external_api' | 'default'): RetryHandler {
  switch (scenario) {
    case 'network':
      return new RetryHandler({
        strategy: RetryStrategy.EXPONENTIAL_JITTER,
        maxAttempts: 5,
        initialDelayMs: 500,
        maxDelayMs: 10000,
        multiplier: 2,
      });

    case 'database':
      return new RetryHandler({
        strategy: RetryStrategy.EXPONENTIAL,
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 5000,
        multiplier: 2,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'connection'],
      });

    case 'external_api':
      return new RetryHandler({
        strategy: RetryStrategy.EXPONENTIAL_JITTER,
        maxAttempts: 4,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        multiplier: 2.5,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      });

    case 'default':
    default:
      return new RetryHandler();
  }
}
