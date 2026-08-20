/**
 * Bulkhead Pattern Implementation
 * Isolates failures by limiting concurrent executions per dependency
 */

import {
  BulkheadConfig,
  DEFAULT_BULKHEAD_CONFIG,
} from './types';

/** Execution slot in the bulkhead */
interface ExecutionSlot {
  id: string;
  startTime: Date;
}

/** Waiting queue entry */
interface QueueEntry {
  id: string;
  resolve: () => void;
  reject: (error: Error) => void;
  queuedAt: Date;
  timeout: NodeJS.Timeout | null;
}

/** Bulkhead statistics */
export interface BulkheadStats {
  name: string;
  activeExecutions: number;
  waitingInQueue: number;
  availableSlots: number;
  rejectedCount: number;
  completedCount: number;
  timedOutCount: number;
  averageExecutionTimeMs: number;
}

/**
 * Bulkhead - Limits concurrent operations to prevent cascade failures
 */
export class Bulkhead {
  private config: BulkheadConfig;
  private activeSlots: Map<string, ExecutionSlot> = new Map();
  private waitingQueue: QueueEntry[] = [];
  private rejectedCount: number = 0;
  private completedCount: number = 0;
  private timedOutCount: number = 0;
  private executionTimes: number[] = [];

  constructor(config: Partial<BulkheadConfig> = {}) {
    this.config = { ...DEFAULT_BULKHEAD_CONFIG, ...config };
    console.log(`[Bulkhead] Created: ${this.config.name} (maxConcurrent: ${this.config.maxConcurrent})`);
  }

  /**
   * Execute a function through the bulkhead
   * @param fn - The async function to execute
   * @returns Promise resolving to function result or rejecting if at capacity
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Try to acquire a slot immediately if available
    if (this.activeSlots.size < this.config.maxConcurrent) {
      return this.executeWithSlot(fn);
    }

    // No slots available - check queue capacity
    if (this.waitingQueue.length >= this.config.maxWaitQueue) {
      this.rejectedCount++;
      throw new Error(
        `Bulkhead '${this.config.name}' is full: ${this.activeSlots.size} executing, ` +
        `${this.waitingQueue.length} waiting`
      );
    }

    // Add to wait queue
    return this.queueAndWait(fn);
  }

  /**
   * Execute with an available slot
   */
  private async executeWithSlot<T>(fn: () => Promise<T>): Promise<T> {
    const slotId = this.acquireSlot();
    const startTime = Date.now();

    try {
      // Apply execution timeout
      const result = await Promise.race([
        fn(),
        this.createTimeoutPromise(slotId),
      ]);

      const durationMs = Date.now() - startTime;
      this.recordCompletion(durationMs);

      return result as T;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Check if it was a timeout
      if (error instanceof Error && error.message.includes('Execution timeout')) {
        this.timedOutCount++;
      }

      this.recordCompletion(durationMs);
      throw error;
    } finally {
      this.releaseSlot(slotId);
    }
  }

  /**
   * Add to queue and wait for a slot
   */
  private queueAndWait<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const entry: QueueEntry = {
        id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        resolve: resolve as () => void,
        reject,
        queuedAt: new Date(),
        timeout: null,
      };

      // Set up wait timeout
      if (this.config.maxWaitTimeMs > 0) {
        entry.timeout = setTimeout(() => {
          // Remove from queue
          const index = this.waitingQueue.indexOf(entry);
          if (index > -1) {
            this.waitingQueue.splice(index, 1);
            this.timedOutCount++;
          }
          reject(new Error(
            `Bulkhead '${this.config.name}' queue wait time exceeded (${this.config.maxWaitTimeMs}ms)`
          ));
        }, this.config.maxWaitTimeMs);
      }

      this.waitingQueue.push(entry);
      console.log(`[Bulkhead] ${entry.id} queued (position: ${this.waitingQueue.length})`);
    });
  }

  /**
   * Acquire an execution slot
   */
  acquireSlot(): string {
    const slotId = `slot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.activeSlots.set(slotId, {
      id: slotId,
      startTime: new Date(),
    });

    console.log(`[Bulkhead] Slot acquired: ${slotId} (${this.activeSlots.size}/${this.config.maxConcurrent})`);

    // Check if anyone is waiting
    this.processQueue();

    return slotId;
  }

  /**
   * Release an execution slot
   */
  releaseSlot(slotId: string): void {
    const existed = this.activeSlots.delete(slotId);

    if (existed) {
      console.log(`[Bulkhead] Slot released: ${slotId} (${this.activeSlots.size}/${this.config.maxConcurrent})`);
      // Process next in queue
      this.processQueue();
    }
  }

  /**
   * Process the waiting queue when a slot becomes available
   */
  private processQueue(): void {
    while (
      this.waitingQueue.length > 0 &&
      this.activeSlots.size < this.config.maxConcurrent
    ) {
      const entry = this.waitingQueue.shift();
      if (!entry) break;

      // Clear the wait timeout
      if (entry.timeout) {
        clearTimeout(entry.timeout);
      }

      // Resolve the promise so execution can proceed
      entry.resolve();

      console.log(`[Bulkhead] Dequeued: ${entry.id}`);
    }
  }

  /**
   * Create a timeout promise for execution
   */
  private createTimeoutPromise(slotId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          `Bulkhead '${this.config.name}' execution timeout exceeded (${this.config.executionTimeoutMs}ms)`
        ));
      }, this.config.executionTimeoutMs);
    });
  }

  /**
   * Record completion statistics
   */
  private recordCompletion(durationMs: number): void {
    this.completedCount++;
    this.executionTimes.push(durationMs);

    // Keep only last 1000 for average calculation
    if (this.executionTimes.length > 1000) {
      this.executionTimes.shift();
    }
  }

  /**
   * Get current bulkhead statistics
   */
  getStats(): BulkheadStats {
    const avgTime =
      this.executionTimes.length > 0
        ? this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length
        : 0;

    return {
      name: this.config.name,
      activeExecutions: this.activeSlots.size,
      waitingInQueue: this.waitingQueue.length,
      availableSlots: Math.max(0, this.config.maxConcurrent - this.activeSlots.size),
      rejectedCount: this.rejectedCount,
      completedCount: this.completedCount,
      timedOutCount: this.timedOutCount,
      averageExecutionTimeMs: avgTime,
    };
  }

  /**
   * Check if bulkhead has capacity for immediate execution
   */
  hasCapacity(): boolean {
    return this.activeSlots.size < this.config.maxConcurrent ||
           this.waitingQueue.length < this.config.maxWaitQueue;
  }

  /**
   * Get current configuration
   */
  getConfig(): BulkheadConfig {
    return { ...this.config };
  }

  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.rejectedCount = 0;
    this.completedCount = 0;
    this.timedOutCount = 0;
    this.executionTimes = [];
  }
}
