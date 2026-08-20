/**
 * Webhook Queue Management Module
 * 
 * Handles priority-based queue management for webhook deliveries
 * including enqueueing, processing, and concurrency control.
 * 
 * @module services/webhooks/queue
 */

import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import { WebhookEvent } from './signature';
import { WebhookEndpoint, WebhookDelivery, WebhookDeliveryExecutor } from './delivery';

// ============== Type Definitions ==============

/**
 * Queue item for pending webhook delivery
 */
export interface WebhookQueueItem {
  /** Queue item ID */
  id: string;
  /** Event to deliver */
  event: WebhookEvent;
  /** Target endpoint ID */
  endpointId: string;
  /** Queue priority (lower = higher priority) */
  priority: number;
  /** When item was queued */
  queuedAt: Date;
  /** Scheduled delivery time */
  scheduledFor: Date;
  /** Number of processing attempts */
  attempts: number;
  /** Current status */
  status: 'waiting' | 'scheduled' | 'processing' | 'completed' | 'failed';
}

/**
 * Queue statistics
 */
export interface QueueStatistics {
  /** Current queue size */
  queueSize: number;
  /** Maximum queue capacity */
  maxQueueSize: number;
  /** Currently processing count */
  currentProcessingCount: number;
  /** Maximum concurrent processing */
  maxConcurrency: number;
  /** Age of oldest item in ms (0 if empty) */
  oldestItemAgeMs: number;
}

// ============== Default Configuration ==============

/** Default queue configuration */
export const DEFAULT_QUEUE_CONFIG = {
  maxQueueSize: 10000,
  maxConcurrency: 10,
};

// ============== Queue Manager Class ==============

/**
 * Webhook Queue Manager
 * 
 * Manages the priority-based delivery queue with support for:
 * - Priority ordering
 * - Concurrency limiting
 * - Scheduled delivery
 * - Queue statistics
 */
export class WebhookQueueManager {
  /** Pending delivery queue */
  private deliveryQueue: WebhookQueueItem[] = [];
  
  /** Currently processing count */
  private currentProcessingCount: number = 0;

  /** Configuration */
  private config: typeof DEFAULT_QUEUE_CONFIG;

  /** Delivery executor */
  private deliveryExecutor: WebhookDeliveryExecutor;

  /** Endpoints map reference */
  private endpoints: Map<string, WebhookEndpoint>;

  /** Deliveries storage reference */
  private deliveries: Map<string, WebhookDelivery>;

  constructor(
    endpoints: Map<string, WebhookEndpoint>,
    deliveries: Map<string, WebhookDelivery>,
    config?: Partial<typeof DEFAULT_QUEUE_CONFIG>,
    deliveryExecutor?: WebhookDeliveryExecutor
  ) {
    this.endpoints = endpoints;
    this.deliveries = deliveries;
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
    this.deliveryExecutor = deliveryExecutor ?? new WebhookDeliveryExecutor();
  }

  /**
   * Add a delivery to the processing queue
   * 
   * @param event - Event to deliver
   * @param endpoint - Target endpoint
   * @param priority - Queue priority (lower = higher)
   * @returns Queue item
   */
  enqueueDelivery(
    event: WebhookEvent,
    endpoint: WebhookEndpoint,
    priority: number = 5
  ): WebhookQueueItem {
    // Check queue size limit
    if (this.deliveryQueue.length >= this.config.maxQueueSize) {
      logger.warn('Webhook queue full, rejecting delivery', {
        event: 'webhook.queue.full',
        metadata: {
          currentSize: this.deliveryQueue.length,
          maxSize: this.config.maxQueueSize,
          eventId: event.id,
        },
      });
      throw new AppError(
        'Webhook queue is full',
        ErrorCode.API_REQUEST_FAILED,
        { context: { currentSize: this.deliveryQueue.length, maxSize: this.config.maxQueueSize } }
      );
    }

    const queueItem: WebhookQueueItem = {
      id: `qi_${Date.now()}_${randomUUID().slice(0, 8)}`,
      event,
      endpointId: endpoint.id,
      priority,
      queuedAt: new Date(),
      scheduledFor: new Date(), // Schedule immediately
      attempts: 0,
      status: 'waiting',
    };

    // Insert maintaining priority order
    const insertIndex = this.deliveryQueue.findIndex(
      item => item.priority > priority
    );
    
    if (insertIndex === -1) {
      this.deliveryQueue.push(queueItem);
    } else {
      this.deliveryQueue.splice(insertIndex, 0, queueItem);
    }

    logger.debug('Delivery enqueued', {
      event: 'webhook.queue.enqueued',
      metadata: {
        queueItemId: queueItem.id,
        eventId: event.id,
        endpointId: endpoint.id,
        position: this.deliveryQueue.indexOf(queueItem),
      },
    });

    return queueItem;
  }

  /**
   * Process a queue item (deliver webhook)
   * 
   * @param queueItem - Item to process
   * @returns Array of delivery records
   */
  async processQueueItem(queueItem: WebhookQueueItem): Promise<WebhookDelivery[]> {
    // Wait until scheduled time
    const now = new Date();
    if (queueItem.scheduledFor > now) {
      const delay = queueItem.scheduledFor.getTime() - now.getTime();
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Check concurrency limit
    if (this.currentProcessingCount >= this.config.maxConcurrency) {
      // Requeue with slight delay
      queueItem.scheduledFor = new Date(Date.now() + 100);
      return this.processQueueItem(queueItem);
    }

    queueItem.status = 'processing';
    this.currentProcessingCount++;

    try {
      const endpoint = this.endpoints.get(queueItem.endpointId);
      
      if (!endpoint) {
        throw new Error(`Endpoint not found: ${queueItem.endpointId}`);
      }

      const delivery = await this.deliveryExecutor.executeDelivery(
        queueItem.event,
        endpoint,
        this.deliveries.get(`del_${Date.now()}_${randomUUID().slice(0, 8)}`)
      );
      
      // Store delivery record
      this.deliveries.set(delivery.id, delivery);
      
      queueItem.status = delivery.status === 'delivered' ? 'completed' : 
                       delivery.status === 'failed' ? 'failed' : 
                       queueItem.status;
      
      return [delivery];
    } catch (error) {
      queueItem.status = 'failed';
      throw error;
    } finally {
      this.currentProcessingCount--;
    }
  }

  /**
   * Get next item from queue (without removing)
   * 
   * @returns Next queue item or undefined if empty
   */
  peek(): WebhookQueueItem | undefined {
    return this.deliveryQueue[0];
  }

  /**
   * Remove and return next item from queue
   * 
   * @returns Next queue item or undefined if empty
   */
  dequeue(): WebhookQueueItem | undefined {
    return this.deliveryQueue.shift();
  }

  /**
   * Get all items in queue
   * 
   * @returns Array of all queue items
   */
  getAllItems(): WebhookQueueItem[] {
    return [...this.deliveryQueue];
  }

  /**
   * Get items for a specific endpoint
   * 
   * @param endpointId - Endpoint ID to filter by
   * @returns Array of matching queue items
   */
  getItemsByEndpoint(endpointId: string): WebhookQueueItem[] {
    return this.deliveryQueue.filter(item => item.endpointId === endpointId);
  }

  /**
   * Remove items for a specific endpoint
   * 
   * @param endpointId - Endpoint ID to remove items for
   * @returns Number of items removed
   */
  removeItemsByEndpoint(endpointId: string): number {
    const beforeLength = this.deliveryQueue.length;
    this.deliveryQueue = this.deliveryQueue.filter(item => item.endpointId !== endpointId);
    return beforeLength - this.deliveryQueue.length;
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStatistics {
    let oldestItemAgeMs = 0;
    
    if (this.deliveryQueue.length > 0) {
      const oldest = this.deliveryQueue.reduce((oldest, item) =>
        item.queuedAt < oldest.queuedAt ? item : oldest
      );
      oldestItemAgeMs = Date.now() - oldest.queuedAt.getTime();
    }

    return {
      queueSize: this.deliveryQueue.length,
      maxQueueSize: this.config.maxQueueSize,
      currentProcessingCount: this.currentProcessingCount,
      maxConcurrency: this.config.maxConcurrency,
      oldestItemAgeMs,
    };
  }

  /**
   * Clear all items from queue
   */
  clear(): void {
    this.deliveryQueue = [];
  }

  /**
   * Get current queue length
   */
  getLength(): number {
    return this.deliveryQueue.length;
  }

  /**
   * Check if queue is full
   */
  isFull(): boolean {
    return this.deliveryQueue.length >= this.config.maxQueueSize;
  }
}
