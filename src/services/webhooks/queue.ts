/**
 * Webhook Queue Management
 * Manages the delivery queue with priority and dead letter handling
 */

import {
  WebhookEvent,
  WebhookSubscription,
  WebhookQueueItem,
  DeadLetterEntry,
  DeliveryStatus,
} from './types';
import { WebhookDelivery, DeliveryResult } from './delivery';

/** Queue configuration options */
export interface QueueConfig {
  /** Maximum concurrent deliveries */
  maxConcurrent: number;
  /** Maximum queue size before rejecting */
  maxQueueSize: number;
  /** Polling interval for queue processing (ms) */
  pollIntervalMs: number;
  /** Whether to enable dead letter queue */
  enableDeadLetterQueue: boolean;
  /** Maximum dead letter retention (ms) */
  deadLetterRetentionMs: number;
}

/** Default queue configuration */
const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxConcurrent: 10,
  maxQueueSize: 10000,
  pollIntervalMs: 1000,
  enableDeadLetterQueue: true,
  deadLetterRetentionMs: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/** Queue statistics */
export interface QueueStats {
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  deadLetterCount: number;
  averageWaitTimeMs: number;
}

/**
 * WebhookQueue manages ordered delivery of webhooks
 */
export class WebhookQueue {
  private queue: Map<string, WebhookQueueItem> = new Map();
  private deadLetters: Map<string, DeadLetterEntry> = new Map();
  private processing: Set<string> = new Set();
  private config: QueueConfig;
  private delivery: WebhookDelivery;
  private isProcessing: boolean = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    config: Partial<QueueConfig> = {},
    delivery?: WebhookDelivery
  ) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
    this.delivery = delivery || new WebhookDelivery();
  }

  /**
   * Add an event to the delivery queue
   * @param event - The event to enqueue
   * @param subscription - Target subscription
   * @param priority - Priority level (lower = higher)
   * @returns Whether item was successfully queued
   */
  enqueue(
    event: WebhookEvent,
    subscription: WebhookSubscription,
    priority: number = 0
  ): { success: boolean; error?: string; itemId?: string } {
    // Check queue capacity
    if (this.queue.size >= this.config.maxQueueSize) {
      return {
        success: false,
        error: 'Queue at maximum capacity',
      };
    }

    // Check if already in queue
    const existingKey = `${event.id}_${subscription.id}`;
    if (this.queue.has(existingKey)) {
      return {
        success: false,
        error: 'Item already in queue',
      };
    }

    const item: WebhookQueueItem = {
      id: existingKey,
      event,
      subscription,
      priority,
      enqueuedAt: new Date().toISOString(),
      retryCount: 0,
      nextAttemptAt: new Date().toISOString(),
      attempts: [],
    };

    this.queue.set(existingKey, item);

    console.log(`[Queue] Enqueued ${item.id} (priority: ${priority})`);

    return { success: true, itemId: item.id };
  }

  /**
   * Dequeue the next item ready for processing
   * @returns Next queue item or undefined if empty
   */
  dequeue(): WebhookQueueItem | undefined {
    // Find items ready for processing (nextAttemptAt <= now)
    const now = new Date();
    let bestItem: WebhookQueueItem | undefined;
    let bestKey: string | undefined;

    for (const [key, item] of this.queue) {
      // Skip items being processed
      if (this.processing.has(key)) continue;

      // Check if ready for attempt
      const nextAttempt = new Date(item.nextAttemptAt);
      if (nextAttempt > now) continue;

      // Select by priority (lowest first), then FIFO
      if (
        !bestItem ||
        item.priority < bestItem.priority ||
        (item.priority === bestItem.priority && item.enqueuedAt < bestItem.enqueuedAt)
      ) {
        bestItem = item;
        bestKey = key;
      }
    }

    if (bestItem && bestKey) {
      this.processing.add(bestKey);
    }

    return bestItem;
  }

  /**
   * Process all items in the queue
   * @returns Promise resolving when current batch is processed
   */
  async processQueue(): Promise<{ processed: number; failed: number }> {
    if (this.isProcessing) {
      return { processed: 0, failed: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let failed = 0;

    try {
      while (this.processing.size < this.config.maxConcurrent) {
        const item = this.dequeue();
        if (!item) break;

        try {
          const result = await this.deliverItem(item);
          processed++;

          if (!result.shouldRetry && result.attempt.status !== DeliveryStatus.SUCCEEDED) {
            failed++;
          }

          // Handle retry or completion
          await this.handleDeliveryResult(item, result);
        } catch (error) {
          console.error(`[Queue] Error processing ${item.id}:`, error);
          failed++;
          this.removeFromProcessing(item.id);
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return { processed, failed };
  }

  /**
   * Start automatic queue processing
   */
  startPolling(): void {
    if (this.timer) return;

    this.timer = setInterval(async () => {
      await this.processQueue();
    }, this.config.pollIntervalMs);

    console.log('[Queue] Started polling');
  }

  /**
   * Stop automatic queue processing
   */
  stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[Queue] Stopped polling');
    }
  }

  /**
   * Handle delivery result and retry/dead-letter logic
   */
  private async handleDeliveryResult(
    item: WebhookQueueItem,
    result: DeliveryResult
  ): Promise<void> {
    // Record attempt
    item.attempts.push(result.attempt);
    item.retryCount++;

    if (result.shouldRetry) {
      // Schedule retry
      item.nextAttemptAt = new Date(Date.now() + result.retryDelayMs).toISOString();
      this.removeFromProcessing(item.id);
    } else if (result.deadLetterEntry && this.config.enableDeadLetterQueue) {
      // Move to dead letter queue
      this.addToDeadLetter(result.deadLetterEntry);
      this.queue.delete(item.id);
      this.processing.delete(item.id);
    } else {
      // Success or final failure - remove from queue
      this.queue.delete(item.id);
      this.processing.delete(item.id);
    }
  }

  /**
   * Deliver a single queue item
   */
  private async deliverItem(item: WebhookQueueItem): Promise<DeliveryResult> {
    return this.delivery.deliver(
      item.event,
      item.subscription,
      item.retryCount + 1
    );
  }

  /**
   * Add entry to dead letter queue
   */
  addToDeadLetter(entry: DeadLetterEntry): void {
    this.deadLetters.set(entry.id, entry);
    console.warn(`[Queue] Dead lettered ${entry.id}: ${entry.failureReason}`);
  }

  /**
   * Get dead letter entries
   */
  getDeadLetters(includeReplayed: boolean = false): DeadLetterEntry[] {
    const entries = Array.from(this.deadLetters.values());
    return includeReplayed ? entries : entries.filter((e) => !e.replayed);
  }

  /**
   * Replay a dead lettered webhook
   */
  async replayDeadLetter(entryId: string): Promise<{ success: boolean; error?: string }> {
    const entry = this.deadLetters.get(entryId);

    if (!entry) {
      return { success: false, error: 'Dead letter entry not found' };
    }

    // Re-queue the original item
    const result = this.enqueue(
      entry.originalItem.event,
      entry.originalItem.subscription,
      entry.originalItem.priority
    );

    if (result.success) {
      entry.replayed = true;
    }

    return result;
  }

  /**
   * Remove item from processing set
   */
  private removeFromProcessing(itemId: string): void {
    this.processing.delete(itemId);
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStats {
    const now = Date.now();
    let totalWaitTime = 0;

    for (const item of this.queue.values()) {
      totalWaitTime += now - new Date(item.enqueuedAt).getTime();
    }

    return {
      pendingCount: this.queue.size - this.processing.size,
      processingCount: this.processing.size,
      completedCount: 0, // Would need tracking in production
      failedCount: this.deadLetters.size,
      deadLetterCount: this.deadLetters.size,
      averageWaitTimeMs: this.queue.size > 0 ? totalWaitTime / this.queue.size : 0,
    };
  }

  /**
   * Clear all items from queue (use with caution)
   */
  clear(): void {
    this.queue.clear();
    this.processing.clear();
    console.log('[Queue] Cleared all items');
  }

  /**
   * Get queue size
   */
  getSize(): number {
    return this.queue.size;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.size === 0;
  }
}
