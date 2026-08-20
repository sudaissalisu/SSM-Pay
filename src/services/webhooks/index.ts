/**
 * SSM-Pay Webhook Service Module
 * Public API for webhook delivery, subscriptions, and queue management
 *
 * @example
 * ```typescript
 * import {
 *   WebhookService,
 *   WebhookEventType,
 *   verifySignature,
 * } from '@/services/webhooks';
 *
 * // Create webhook service instance
 * const webhookService = new WebhookService();
 *
 * // Subscribe to payment events
 * await webhookService.subscribe({
 *   url: 'https://example.com/webhook',
 *   events: [WebhookEventType.PAYMENT_SUCCEEDED],
 * });
 *
 * // Verify incoming webhook
 * const result = verifySignature(payload, signature, secret);
 * ```
 */

// Type exports
export type {
  WebhookEvent,
  WebhookSignature,
  WebhookSubscription,
  DeliveryAttempt,
  DeliveryStatus,
  RetryPolicy,
  WebhookQueueItem,
  DeadLetterEntry,
  WebhookStats,
} from './types';

export {
  WebhookEventType,
  DEFAULT_RETRY_POLICY,
} from './types';

// Signature functions
export {
  generateSignature,
  verifySignature,
  signPayload,
  maskSecret,
  generateWebhookSecret,
  constructSignatureHeader,
  parseSignatureHeader,
  validateEventStructure,
} from './signature';

// Delivery service
export { WebhookDelivery } from './delivery';
export type { DeliveryResult, DeliveryOptions } from './delivery';

// Subscription management
export { WebhookSubscriptionManager } from './subscriptions';
export type {
  CreateSubscriptionOptions,
  SubscriptionResult,
} from './subscriptions';

// Queue management
export { WebhookQueue } from './queue';
export type { QueueConfig, QueueStats } from './queue';

/**
 * Main WebhookService facade that combines all webhook functionality
 */
import { WebhookEventType } from './types';
import { WebhookDelivery } from './delivery';
import { WebhookSubscriptionManager, CreateSubscriptionOptions } from './subscriptions';
import { WebhookQueue, QueueConfig } from './queue';
import { signPayload, verifySignature, generateWebhookSecret } from './signature';

/** WebhookService configuration options */
export interface WebhookServiceConfig {
  /** Queue configuration */
  queue?: Partial<QueueConfig>;
  /** Default retry policy for deliveries */
  retryPolicy?: Partial<import('./types').RetryPolicy>;
}

/**
 * SSM-Pay Webhook Service - Main entry point for all webhook operations
 */
export class WebhookService {
  private delivery: WebhookDelivery;
  private subscriptions: WebhookSubscriptionManager;
  private queue: WebhookQueue;

  constructor(config: WebhookServiceConfig = {}) {
    this.delivery = new WebhookDelivery({}, config.retryPolicy);
    this.subscriptions = new WebhookSubscriptionManager();
    this.queue = new WebhookQueue(config.queue, this.delivery);
  }

  /**
   * Create a new webhook subscription
   * @param options - Subscription configuration
   * @returns Subscription creation result
   */
  async subscribe(options: CreateSubscriptionOptions) {
    return this.subscriptions.subscribe(options);
  }

  /**
   * Remove a webhook subscription
   * @param subscriptionId - ID to remove
   * @returns Operation result
   */
  async unsubscribe(subscriptionId: string) {
    return this.subscriptions.unsubscribe(subscriptionId);
  }

  /**
   * Dispatch an event to all matching subscribers
   * @param event - Event to dispatch
   * @returns Number of queued deliveries
   */
  async dispatchEvent(event: import('./types').WebhookEvent): Promise<number> {
    const matchingSubs = this.subscriptions.matchEventToSubscriptions(event);
    let queuedCount = 0;

    for (const sub of matchingSubs) {
      const result = this.queue.enqueue(event, sub);
      if (result.success) {
        queuedCount++;
      }
    }

    // Auto-process queue
    await this.queue.processQueue();

    return queuedCount;
  }

  /**
   * Verify an incoming webhook signature
   * @param payload - Request body
   * @param signature - Signature header
   * @param secret - Expected secret
   * @returns Verification result
   */
  verifyWebhook(payload: string, signature: string, secret: string) {
    return verifySignature(payload, signature, secret);
  }

  /**
   * Generate a new webhook secret
   * @returns New secret string
   */
  createSecret(): string {
    return generateWebhookSecret();
  }

  /**
   * Get subscription manager (for advanced usage)
   */
  getSubscriptionManager(): WebhookSubscriptionManager {
    return this.subscriptions;
  }

  /**
   * Get queue (for advanced usage)
   */
  getQueue(): WebhookQueue {
    return this.queue;
  }

  /**
   * Start automatic queue processing
   */
  startProcessing(): void {
    this.queue.startPolling();
  }

  /**
   * Stop automatic queue processing
   */
  stopProcessing(): void {
    this.queue.stopPolling();
  }

  /**
   * Get current system statistics
   */
  getStats() {
    return {
      queue: this.queue.getStats(),
      subscriptions: {
        active: this.subscriptions.getActiveCount(),
        total: this.subscriptions.getTotalCount(),
      },
    };
  }
}

// Singleton instance for convenience
let defaultInstance: WebhookService | null = null;

/**
 * Get or create the default WebhookService instance
 * @returns Shared WebhookService instance
 */
export function getDefaultWebhookService(config?: WebhookServiceConfig): WebhookService {
  if (!defaultInstance) {
    defaultInstance = new WebhookService(config);
  }
  return defaultInstance;
}
