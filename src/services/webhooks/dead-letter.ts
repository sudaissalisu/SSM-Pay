/**
 * Webhook Dead Letter Queue Module
 * 
 * Handles failed webhook deliveries that cannot be retried,
 * providing storage, retrieval, and retry capabilities.
 * 
 * @module services/webhooks/dead-letter
 */

import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import { WebhookEvent } from './signature';
import { WebhookDelivery } from './delivery';

// ============== Type Definitions ==============

/**
 * Reason for adding to dead letter queue
 */
export type DeadLetterReason = 
  | 'max_retries_exceeded'
  | 'endpoint_disabled'
  | 'endpoint_deleted'
  | 'payload_too_large'
  | 'signature_verification_failed'
  | 'subscription_expired'
  | 'rate_limit_exceeded'
  | 'unknown';

/**
 * Dead letter queue entry for failed webhooks
 */
export interface DeadLetterEntry {
  /** Entry identifier */
  id: string;
  /** Original event */
  event: WebhookEvent;
  /** Target endpoint ID */
  endpointId: string;
  /** Reason for dead lettering */
  reason: DeadLetterReason;
  /** Original error message */
  originalError: string;
  /** Delivery history before failure */
  deliveryHistory: DeliveryAttemptSummary[];
  /** When added to dead letter queue */
  deadLetteredAt: Date;
  /** Number of retry attempts before dead lettering */
  totalAttempts: number;
  /** Priority for reprocessing */
  priority: number;
  /** Whether entry has been acknowledged */
  isAcknowledged: boolean;
  /** Metadata for debugging */
  metadata?: Record<string, unknown>;
}

/**
 * Summary of a delivery attempt
 */
export interface DeliveryAttemptSummary {
  /** Attempt number */
  attempt: number;
  /** Timestamp of attempt */
  timestamp: Date;
  /** Status code received */
  statusCode?: number;
  /** Error message */
  error?: string;
  /** Duration in ms */
  durationMs: number;
}

// ============== Default Configuration ==============

/** Default DLQ configuration */
export const DEFAULT_DLQ_CONFIG = {
  maxDeadLetterQueueSize: 1000,
};

// ============== Dead Letter Queue Class ==============

/**
 * Dead Letter Queue Manager
 * 
 * Manages failed webhook deliveries with support for:
 * - Entry storage and retrieval
 * - Retry attempts
 * - Acknowledgment tracking
 * - Automatic eviction when full
 */
export class DeadLetterQueue {
  /** Dead letter queue storage (using Map for O(1) lookups) */
  private entries: Map<string, DeadLetterEntry> = new Map();
  
  /** Configuration */
  private config: typeof DEFAULT_DLQ_CONFIG;

  constructor(config?: Partial<typeof DEFAULT_DLQ_CONFIG>) {
    this.config = { ...DEFAULT_DLQ_CONFIG, ...config };
  }

  /**
   * Move a failed delivery to the dead letter queue
   * 
   * @param delivery - Failed delivery
   * @param endpointId - Target endpoint ID
   * @param reason - Reason for dead lettering
   * @param options - Additional options
   */
  addEntry(
    delivery: WebhookDelivery,
    endpointId: string,
    reason: DeadLetterReason,
    options?: {
      priority?: number;
      metadata?: Record<string, unknown>;
    }
  ): DeadLetterEntry {
    // Check DLQ size limit
    if (this.entries.size >= this.config.maxDeadLetterQueueSize) {
      // Evict oldest entry
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) {
        this.entries.delete(oldestKey);
        logger.warn('Dead letter queue full, evicted oldest entry', {
          event: 'webhook.dlq.evicted',
          metadata: { evictedEntryId: oldestKey },
        });
      }
    }

    const dlqEntry: DeadLetterEntry = {
      id: `dlq_${Date.now()}_${randomUUID().slice(0, 8)}`,
      event: delivery.event,
      endpointId,
      reason,
      originalError: delivery.errorMessage || 'Unknown error',
      deliveryHistory: [{
        attempt: delivery.attemptNumber,
        timestamp: delivery.updatedAt,
        statusCode: delivery.responseStatusCode,
        error: delivery.errorMessage,
        durationMs: delivery.durationMs || 0,
      }],
      deadLetteredAt: new Date(),
      totalAttempts: delivery.attemptNumber,
      priority: options?.priority ?? 5,
      isAcknowledged: false,
      metadata: options?.metadata,
    };

    this.entries.set(dlqEntry.id, dlqEntry);

    logger.warn('Entry added to dead letter queue', {
      event: 'webhook.dlq.added',
      metadata: {
        dlqEntryId: dlqEntry.id,
        eventId: delivery.event.id,
        endpointId,
        reason,
        totalAttempts: delivery.attemptNumber,
      },
    });

    return dlqEntry;
  }

  /**
   * Add entry for pending items when endpoint is deleted
   * 
   * @param event - Event that was in queue
   * @param endpointId - Deleted endpoint ID
   * @param priority - Original priority
   */
  addEntryForDeletedEndpoint(
    event: WebhookEvent,
    endpointId: string,
    priority: number
  ): DeadLetterEntry {
    const dlqEntry: DeadLetterEntry = {
      id: `dlq_${Date.now()}_${randomUUID().slice(0, 8)}`,
      event,
      endpointId,
      reason: 'endpoint_deleted',
      originalError: `Endpoint deleted while in queue`,
      deliveryHistory: [],
      deadLetteredAt: new Date(),
      totalAttempts: 0,
      priority,
      isAcknowledged: false,
    };

    this.entries.set(dlqEntry.id, dlqEntry);
    
    return dlqEntry;
  }

  /**
   * Get all entries in the dead letter queue
   * 
   * @param options - Filter options
   * @returns DLQ entries sorted by date (newest first)
   */
  getEntries(options?: {
    unacknowledgedOnly?: boolean;
    endpointId?: string;
    reason?: DeadLetterReason;
  }): DeadLetterEntry[] {
    let entries = Array.from(this.entries.values());

    if (options?.unacknowledgedOnly) {
      entries = entries.filter(e => !e.isAcknowledged);
    }

    if (options?.endpointId) {
      entries = entries.filter(e => e.endpointId === options.endpointId);
    }

    if (options?.reason) {
      entries = entries.filter(e => e.reason === options.reason);
    }

    // Sort by dead lettered date (newest first)
    entries.sort((a, b) => b.deadLetteredAt.getTime() - a.deadLetteredAt.getTime());

    return entries;
  }

  /**
   * Get a specific entry by ID
   * 
   * @param entryId - Entry ID
   * @returns Entry or undefined
   */
  getEntry(entryId: string): DeadLetterEntry | undefined {
    return this.entries.get(entryId);
  }

  /**
   * Acknowledge a dead letter queue entry
   * 
   * @param entryId - DLQ entry ID
   * @returns True if acknowledged
   */
  acknowledgeEntry(entryId: string): boolean {
    const entry = this.entries.get(entryId);
    
    if (!entry) {
      return false;
    }

    entry.isAcknowledged = true;

    logger.info('Dead letter entry acknowledged', {
      event: 'webhook.dlq.acknowledged',
      metadata: { entryId },
    });

    return true;
  }

  /**
   * Retry a dead letter queue entry
   * 
   * @param entryId - DLQ entry ID
   * @param endpoints - Available endpoints map
   * @param enqueueFn - Function to enqueue delivery
   * @returns New delivery promise or null if not found
   */
  async retryEntry<T>(
    entryId: string,
    endpoints: Map<string, { id: string; isActive: boolean }>,
    processFn: (event: WebhookEvent, endpointId: string, priority: number) => Promise<T>
  ): Promise<T | null> {
    const entry = this.entries.get(entryId);
    
    if (!entry) {
      return null;
    }

    const endpoint = endpoints.get(entry.endpointId);
    
    if (!endpoint || !endpoint.isActive) {
      throw new AppError(
        'Cannot retry: endpoint not available',
        ErrorCode.VALIDATION_ERROR,
        { context: { endpointId: entry.endpointId, exists: !!endpoint, active: endpoint?.isActive } }
      );
    }

    // Acknowledge original entry
    entry.isAcknowledged = true;

    logger.info('Retrying dead letter queue entry', {
      event: 'webhook.dlq.retried',
      metadata: { entryId, eventId: entry.event.id, endpointId: entry.endpointId },
    });

    return processFn(entry.event, entry.endpointId, entry.priority);
  }

  /**
   * Clear acknowledged entries from DLQ
   * 
   * @returns Number of entries cleared
   */
  clearAcknowledged(): number {
    let cleared = 0;

    for (const [id, entry] of this.entries.entries()) {
      if (entry.isAcknowledged) {
        this.entries.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.info('Cleared acknowledged dead letter entries', {
        event: 'webhook.dlq.cleared',
        metadata: { cleared },
      });
    }

    return cleared;
  }

  /**
   * Clear all entries from DLQ
   * 
   * @returns Number of entries cleared
   */
  clearAll(): number {
    const count = this.entries.size;
    this.entries.clear();

    if (count > 0) {
      logger.info('Cleared all dead letter entries', {
        event: 'webhook.dlq.cleared_all',
        metadata: { count },
      });
    }

    return count;
  }

  /**
   * Get current DLQ size
   */
  getSize(): number {
    return this.entries.size;
  }

  /**
   * Get count of unacknowledged entries
   */
  getUnacknowledgedCount(): number {
    let count = 0;
    for (const entry of this.entries.values()) {
      if (!entry.isAcknowledged) count++;
    }
    return count;
  }

  /**
   * Get entries by reason
   * 
   * @param reason - Reason to filter by
   * @returns Array of matching entries
   */
  getEntriesByReason(reason: DeadLetterReason): DeadLetterEntry[] {
    return Array.from(this.entries.values()).filter(e => e.reason === reason);
  }

  /**
   * Get entries for an endpoint
   * 
   * @param endpointId - Endpoint ID
   * @returns Array of matching entries
   */
  getEntriesByEndpoint(endpointId: string): DeadLetterEntry[] {
    return Array.from(this.entries.values()).filter(e => e.endpointId === endpointId);
  }
}
