/**
 * Bulkhead Isolation Pattern Module
 * 
 * Limits the number of concurrent calls to prevent cascade failures.
 * Uses a semaphore-based approach with a waiting queue.
 * 
 * @module services/resilience/bulkhead
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode, wrapError } from '@/lib/errors';

// ============== Type Definitions ==============

/**
 * Configuration options for Bulkhead pattern
 */
export interface BulkheadConfig {
  name: string;
  maxConcurrent?: number;
  maxWaitQueueLength?: number;
  maxWaitTimeMs?: number;
}

/**
 * Statistics for bulkhead
 */
export interface BulkheadStats {
  currentRunning: number;
  currentWaiting: number;
  totalAccepted: number;
  totalRejected: number;
}

// ============== Bulkhead Class ==============

/**
 * Bulkhead Isolation Pattern Implementation
 */
export class Bulkhead {
  private config: Required<BulkheadConfig>;
  private runningCount: number = 0;
  private waitingQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  
  // Statistics
  private totalAccepted: number = 0;
  private totalRejected: number = 0;

  static readonly DEFAULT_CONFIG: Required<BulkheadConfig> = {
    name: 'default',
    maxConcurrent: 10,
    maxWaitQueueLength: 50,
    maxWaitTimeMs: 5000,
  };

  constructor(config: BulkheadConfig) {
    this.config = { ...Bulkhead.DEFAULT_CONFIG, ...config };

    logger.info('Bulkhead initialized', {
      event: 'bulkhead.init',
      metadata: {
        name: this.config.name,
        maxConcurrent: this.config.maxConcurrent,
        maxWaitQueueLength: this.config.maxWaitQueueLength,
      },
    });
  }

  /**
   * Execute a function within bulkhead constraints
   */
  async execute<T>(fn: () => T | Promise<T>): Promise<T> {
    // Try to acquire slot
    if (this.runningCount < this.config.maxConcurrent) {
      this.runningCount++;
      this.totalAccepted++;
      
      try {
        return await fn();
      } finally {
        this.releaseSlot();
      }
    }

    // Need to wait in queue
    if (this.waitingQueue.length >= this.config.maxWaitQueueLength) {
      this.totalRejected++;
      
      const error = new AppError(
        `Bulkhead '${this.config.name}' queue is full`,
        ErrorCode.API_REQUEST_FAILED,
        { 
          severity: 'warning',
          context: {
            name: this.config.name,
            runningCount: this.runningCount,
            queueLength: this.waitingQueue.length,
          },
        }
      );

      logger.warn('Bulkhead queue full, request rejected', {
        event: 'bulkhead.rejected',
        metadata: {
          name: this.config.name,
          queueLength: this.waitingQueue.length,
          maxQueueLength: this.config.maxWaitQueueLength,
        },
        error,
      });

      throw error;
    }

    // Wait for slot with timeout
    return new Promise<T>((resolve, reject) => {
      const waiter = {
        resolve: () => {
          this.runningCount++;
          this.totalAccepted++;
          
          fn()
            .then(result => {
              this.releaseSlot();
              resolve(result);
            })
            .catch(error => {
              this.releaseSlot();
              reject(wrapError(error));
            });
        },
        reject: (error: Error) => {
          this.totalRejected++;
          reject(error);
        },
      };

      this.waitingQueue.push(waiter);

      // Set up timeout for waiting
      const timeoutId = setTimeout(() => {
        const index = this.waitingQueue.indexOf(waiter);
        if (index > -1) {
          this.waitingQueue.splice(index, 1);
        }

        const timeoutError = new AppError(
          `Bulkhead '${this.config.name}' wait timeout exceeded`,
          ErrorCode.API_TIMEOUT,
          { severity: 'warning', context: { name: this.config.name, timeoutMs: this.config.maxWaitTimeMs } }
        );

        logger.warn('Bulkhead wait timeout', {
          event: 'bulkhead.timeout',
          metadata: {
            name: this.config.name,
            timeoutMs: this.config.maxWaitTimeMs,
          },
          error: timeoutError,
        });

        waiter.reject(timeoutError);
      }, this.config.maxWaitTimeMs);

      (waiter as unknown as { timeoutId: ReturnType<typeof setTimeout> }).timeoutId = timeoutId;
    });
  }

  /**
   * Get current bulkhead statistics
   */
  getStats(): BulkheadStats {
    return {
      currentRunning: this.runningCount,
      currentWaiting: this.waitingQueue.length,
      totalAccepted: this.totalAccepted,
      totalRejected: this.totalRejected,
    };
  }

  /**
   * Get available capacity
   */
  getAvailableCapacity(): number {
    return Math.max(0, this.config.maxConcurrent - this.runningCount);
  }

  /**
   * Destroy the bulkhead instance
   */
  destroy(): void {
    for (const waiter of this.waitingQueue) {
      const timeoutId = (waiter as unknown as { timeoutId?: ReturnType<typeof setTimeout> }).timeoutId;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      waiter.reject(new AppError('Bulkhead destroyed'));
    }
    this.waitingQueue = [];

    logger.info('Bulkhead destroyed', {
      event: 'bulkhead.destroy',
      metadata: { name: this.config.name },
    });
  }

  private releaseSlot(): void {
    this.runningCount--;

    // Process waiting queue
    if (this.waitingQueue.length > 0 && this.runningCount < this.config.maxConcurrent) {
      const waiter = this.waitingQueue.shift();
      if (waiter) {
        const timeoutId = (waiter as unknown as { timeoutId?: ReturnType<typeof setTimeout> }).timeoutId;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        waiter.resolve();
      }
    }
  }
}
