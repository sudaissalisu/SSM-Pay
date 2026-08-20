/**
 * Enterprise Webhook Processing Service - Main Module
 * 
 * Aggregates all webhook sub-modules and provides the main
 * WebhookProcessingService class that coordinates:
 * - Signature verification
 * - Delivery execution
 * - Subscription management
 * - Queue management
 * - Dead letter queue handling
 * 
 * @module services/webhooks
 * @version 2.0.0
 */

import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// Re-export types and utilities from sub-modules
export {
  // Types from signature.ts
  WebhookEventType,
  IncomingWebhookPayload,
  WEBHOOK_HEADERS,
  EVENT_SCHEMA_VERSION,
  WebhookSignatureHandler,
  WebhookEventTypes,
  every,
} from './signature';

export type { WebhookEvent } from './signature';

export {
  // Types from delivery.ts
  WebhookEndpoint,
  RetryConfiguration,
  WebhookDelivery,
  DeliveryStatus,
  WebhookDeliveryExecutor,
  DEFAULT_RETRY_CONFIG,
} from './delivery';

export {
  // Types from subscriptions.ts
  EventSubscription,
  EventFilter,
  SubscriptionOptions,
  WebhookSubscriptionManager,
  DEFAULT_SUBSCRIPTION_OPTIONS,
} from './subscriptions';

export {
  // Types from queue.ts
  WebhookQueueItem,
  QueueStatistics,
  WebhookQueueManager,
  DEFAULT_QUEUE_CONFIG,
} from './queue';

export {
  // Types from dead-letter.ts
  DeadLetterReason,
  DeadLetterEntry,
  DeliveryAttemptSummary,
  DeadLetterQueue,
  DEFAULT_DLQ_CONFIG,
} from './dead-letter';

// Import implementations
import { WebhookEvent as WebhookEventTypeImport, WEBHOOK_HEADERS, EVENT_SCHEMA_VERSION } from './signature';
import { WebhookDeliveryExecutor, WebhookEndpoint, WebhookDelivery, DeliveryStatus, DEFAULT_RETRY_CONFIG, WebhookEvent } from './delivery';
import { WebhookSubscriptionManager, EventSubscription, EventFilter, SubscriptionOptions, DEFAULT_SUBSCRIPTION_OPTIONS } from './subscriptions';
import { WebhookQueueManager, WebhookQueueItem, DEFAULT_QUEUE_CONFIG } from './queue';
import { DeadLetterQueue, DeadLetterEntry, DeadLetterReason, DEFAULT_DLQ_CONFIG } from './dead-letter';

// ============== Additional Type Definitions ==============

/**
 * Webhook statistics snapshot
 */
export interface WebhookStatistics {
  // Event Statistics
  totalEventsReceived: number;
  totalEventsProcessed: number;
  totalEventsFailed: number;
  uniqueEventsProcessed: number;
  
  // Delivery Statistics
  totalDeliveriesAttempted: number;
  totalDeliveriesSucceeded: number;
  totalDeliveriesFailed: number;
  totalDeliveriesRetried: number;
  averageDeliveryTimeMs: number;
  
  // Signature Verification
  signaturesVerified: number;
  signaturesFailed: number;
  
  // Queue Statistics
  queueSize: number;
  deadLetterQueueSize: number;
  
  // Endpoint Statistics
  activeEndpoints: number;
  totalEndpoints: number;
  disabledEndpoints: number;
  
  // Idempotency
  duplicateEventsRejected: number;
  
  // Timing
  oldestQueuedItemAgeMs: number;
  lastProcessedAt?: Date;
}

/**
 * Webhook service configuration
 */
export interface WebhookServiceConfig {
  /** Default signing secret for HMAC */
  defaultSigningSecret: string;
  /** Maximum queue size before rejecting events */
  maxQueueSize: number;
  /** Maximum dead letter queue size */
  maxDeadLetterQueueSize: number;
  /** Default retry configuration */
  defaultRetryConfig: RetryConfiguration;
  /** Processing concurrency limit */
  maxConcurrency: number;
  /** Idempotency window in milliseconds */
  idempotencyWindowMs: number;
  /** Cleanup interval in milliseconds */
  cleanupIntervalMs: number;
  /** Enable metrics collection */
  enableMetrics: boolean;
  /** Maximum payload size in bytes */
  maxPayloadSizeBytes: number;
}

// ============== Constants ==============

/** Default webhook service configuration */
const DEFAULT_CONFIG: Required<WebhookServiceConfig> = {
  defaultSigningSecret: process.env.WEBHOOK_SECRET || 'ssm-pay-webhook-secret-change-me',
  maxQueueSize: 10000,
  maxDeadLetterQueueSize: 1000,
  defaultRetryConfig: DEFAULT_RETRY_CONFIG,
  maxConcurrency: 10,
  idempotencyWindowMs: 24 * 60 * 60 * 1000, // 24 hours
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
  enableMetrics: true,
  maxPayloadSizeBytes: 1024 * 1024, // 1MB
};

// ============== Main Service Class ==============

/**
 * Enterprise Webhook Processing Service
 * 
 * Provides comprehensive webhook handling including:
 * - Secure signature verification using HMAC-SHA256
 * - Intelligent event routing with pattern matching
 * - Robust retry logic with exponential backoff and jitter
 * - Complete idempotency protection
 * - Priority-based queue management
 * - Full delivery lifecycle tracking
 * - Flexible subscription management
 * - Dead letter queue for failed deliveries
 * 
 * @example
 * ```typescript
 * const webhookService = new WebhookProcessingService({
 *   defaultSigningSecret: 'your-secret-key'
 * });
 * 
 * // Register an endpoint
 * await webhookService.registerEndpoint({
 *   url: 'https://example.com/webhook',
 *   secret: 'whsec_my_secret_key',
 *   subscribedEvents: ['payment.*']
 * });
 * 
 * // Process incoming webhook
 * const result = await webhookService.processIncomingWebhook(payload, headers);
 * ```
 */
export class WebhookProcessingService {
  /** Registered endpoints storage */
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  
  /** Subscription manager */
  private subscriptionManager: WebhookSubscriptionManager;
  
  /** Delivery tracking storage */
  private deliveries: Map<string, WebhookDelivery> = new Map();
  
  /** Queue manager */
  private queueManager: WebhookQueueManager;
  
  /** Dead letter queue */
  private deadLetterQueue: DeadLetterQueue;
  
  /** Delivery executor */
  private deliveryExecutor: WebhookDeliveryExecutor;
  
  /** Processed events set for idempotency */
  private processedEvents: Map<string, number> = new Map(); // eventId -> timestamp
  
  /** Service configuration */
  private config: Required<WebhookServiceConfig>;
  
  /** Statistics tracker */
  private stats: WebhookStatistics;
  
  /** Cleanup interval handle */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Creates a new WebhookProcessingService instance
   * @param config - Optional configuration overrides
   */
  constructor(config: Partial<WebhookServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize sub-components
    this.deliveryExecutor = new WebhookDeliveryExecutor();
    this.subscriptionManager = new WebhookSubscriptionManager();
    this.deadLetterQueue = new DeadLetterQueue({
      maxDeadLetterQueueSize: this.config.maxDeadLetterQueueSize,
    });
    
    // Initialize statistics
    this.stats = this.initializeStatistics();

    // Initialize queue manager with references
    this.queueManager = new WebhookQueueManager(
      this.endpoints,
      this.deliveries,
      {
        maxQueueSize: this.config.maxQueueSize,
        maxConcurrency: this.config.maxConcurrency,
      },
      this.deliveryExecutor
    );
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    logger.info('WebhookProcessingService initialized', {
      event: 'webhook.service.initialized',
      metadata: {
        maxQueueSize: this.config.maxQueueSize,
        maxRetries: this.config.defaultRetryConfig.maxAttempts,
        idempotencyWindowMs: this.config.idempotencyWindowMs,
      },
    });
  }

  // ============== Initialization Methods ==============

  /**
   * Initialize statistics with default values
   * @private
   */
  private initializeStatistics(): WebhookStatistics {
    return {
      totalEventsReceived: 0,
      totalEventsProcessed: 0,
      totalEventsFailed: 0,
      uniqueEventsProcessed: 0,
      totalDeliveriesAttempted: 0,
      totalDeliveriesSucceeded: 0,
      totalDeliveriesFailed: 0,
      totalDeliveriesRetried: 0,
      averageDeliveryTimeMs: 0,
      signaturesVerified: 0,
      signaturesFailed: 0,
      queueSize: 0,
      deadLetterQueueSize: 0,
      activeEndpoints: 0,
      totalEndpoints: 0,
      disabledEndpoints: 0,
      duplicateEventsRejected: 0,
      oldestQueuedItemAgeMs: 0,
    };
  }

  /**
   * Start the cleanup interval for maintenance tasks
   * @private
   */
  private startCleanupInterval(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupIntervalMs);
    
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  // ============== Incoming Webhook Processing ==============

  /**
   * Process an incoming webhook request
   */
  async processIncomingWebhook(
    payload: unknown,
    headers: Record<string, string>
  ): Promise<{
    valid: boolean;
    event?: WebhookEvent;
    error?: string;
    errorCode?: ErrorCode;
  }> {
    this.stats.totalEventsReceived++;
    
    const startTime = Date.now();
    
    try {
      // Step 1: Validate payload exists
      if (!payload || typeof payload !== 'object') {
        throw new AppError('Invalid payload: must be an object', ErrorCode.VALIDATION_ERROR);
      }

      const typedPayload = payload as Record<string, unknown>;

      // Step 2: Check payload size
      const payloadSize = JSON.stringify(payload).length;
      if (payloadSize > this.config.maxPayloadSizeBytes) {
        throw new AppError(
          `Payload exceeds maximum size of ${this.config.maxPayloadSizeBytes} bytes`,
          ErrorCode.VALIDATION_ERROR
        );
      }

      // Step 3: Extract and validate required fields
      const eventId = typedPayload.id as string;
      const eventType = typedPayload.type as string;
      const eventCreated = typedPayload.created as string;
      const eventData = typedPayload.data as Record<string, unknown>;

      if (!eventId || !eventType || !eventData) {
        throw new AppError(
          'Missing required fields: id, type, or data',
          ErrorCode.VALIDATION_ERROR,
          { context: { hasId: !!eventId, hasType: !!eventType, hasData: !!eventData } }
        );
      }

      // Step 4: Verify signature
      const signatureHeader = headers[WEBHOOK_HEADERS.SIGNATURE.toLowerCase()] ||
                             headers[WEBHOOK_HEADERS.SIGNATURE];
      
      if (!signatureHeader) {
        throw new AppError(
          'Missing signature header',
          ErrorCode.VALIDATION_ERROR,
          { context: { headerName: WEBHOOK_HEADERS.SIGNATURE } }
        );
      }

      const isValid = await this.deliveryExecutor.verifySignature(
        payload,
        signatureHeader,
        this.config.defaultSigningSecret
      );

      if (!isValid) {
        throw new AppError(
          'Signature verification failed',
          ErrorCode.PAYMENT_VERIFICATION_FAILED
        );
      }

      // Update signature stats
      const sigStats = this.deliveryExecutor.getStats();
      this.stats.signaturesVerified = sigStats.verified;
      this.stats.signaturesFailed = sigStats.failed;

      // Step 5: Check idempotency
      if (this.isDuplicateEvent(eventId)) {
        this.stats.duplicateEventsRejected++;
        logger.info('Duplicate webhook event rejected', {
          event: 'webhook.duplicate_rejected',
          metadata: { eventId, eventType },
        });
        return { valid: true }; // Return success but don't reprocess
      }

      this.markEventAsProcessed(eventId);

      // Step 6: Construct normalized event
      const event: WebhookEvent = {
        id: eventId,
        type: eventType as import('./signature').WebhookEventType,
        data: eventData,
        createdAt: eventCreated || new Date().toISOString(),
        version: EVENT_SCHEMA_VERSION,
        source: 'external',
        correlationId: typedPayload.correlationId as string | undefined,
        parentEventId: typedPayload.parentEventId as string | undefined,
      };

      // Step 7: Route event to subscribers
      await this.routeEventToSubscribers(event);

      this.stats.totalEventsProcessed++;
      this.stats.uniqueEventsProcessed++;
      this.stats.lastProcessedAt = new Date();

      const processingTime = Date.now() - startTime;
      logger.info('Incoming webhook processed successfully', {
        event: 'webhook.incoming.processed',
        metadata: {
          eventId: event.id,
          eventType: event.type,
          processingTimeMs: processingTime,
        },
      });

      return { valid: true, event };
    } catch (error) {
      this.stats.totalEventsFailed++;
      
      const appError = error instanceof AppError 
        ? error 
        : new AppError(
            error instanceof Error ? error.message : 'Unknown error processing webhook',
            ErrorCode.PAYMENT_CALLBACK_FAILED,
            { cause: error instanceof Error ? error : undefined }
          );

      logger.error('Failed to process incoming webhook', {
        event: 'webhook.incoming.failed',
        error: appError,
        metadata: { processingTimeMs: Date.now() - startTime },
      });

      return {
        valid: false,
        error: appError.message,
        errorCode: appError.code,
      };
    }
  }

  // ============== Endpoint Management ==============

  /**
   * Register a new webhook endpoint
   */
  registerEndpoint(config: {
    url: string;
    secret: string;
    subscribedEvents: string[];
    description?: string;
    metadata?: Record<string, unknown>;
    maxRetries?: number;
    retryConfig?: Partial<import('./delivery').RetryConfiguration>;
  }): WebhookEndpoint {
    // Validate URL
    try {
      new URL(config.url);
    } catch {
      throw new AppError(
        `Invalid URL: ${config.url}`,
        ErrorCode.INVALID_CONFIG,
        { context: { url: config.url } }
      );
    }

    // Validate secret
    if (!config.secret || config.secret.length < 16) {
      throw new AppError(
        'Secret must be at least 16 characters',
        ErrorCode.VALIDATION_ERROR,
        { context: { secretLength: config.secret?.length || 0 } }
      );
    }

    // Validate subscribed events
    if (!config.subscribedEvents || config.subscribedEvents.length === 0) {
      throw new AppError(
        'At least one event subscription is required',
        ErrorCode.VALIDATION_ERROR
      );
    }

    const endpointId = `ep_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const now = new Date();

    const endpoint: WebhookEndpoint = {
      id: endpointId,
      url: config.url,
      secret: config.secret,
      subscribedEvents: config.subscribedEvents,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      consecutiveFailures: 0,
      totalDeliveries: 0,
      successfulDeliveries: 0,
      maxRetries: config.maxRetries ?? this.config.defaultRetryConfig.maxAttempts,
      retryConfig: { ...this.config.defaultRetryConfig, ...config.retryConfig },
      metadata: config.metadata,
      description: config.description,
    };

    this.endpoints.set(endpointId, endpoint);
    this.updateEndpointStats();

    logger.info('Webhook endpoint registered', {
      event: 'webhook.endpoint.registered',
      metadata: {
        endpointId,
        url: config.url,
        eventCount: config.subscribedEvents.length,
      },
    });

    return endpoint;
  }

  /**
   * Update an existing webhook endpoint
   */
  updateEndpoint(
    endpointId: string,
    updates: Partial<{
      url: string;
      secret: string;
      subscribedEvents: string[];
      isActive: boolean;
      description: string;
      metadata: Record<string, unknown>;
      maxRetries: number;
      retryConfig: Partial<import('./delivery').RetryConfiguration>;
    }>
  ): WebhookEndpoint {
    const endpoint = this.endpoints.get(endpointId);
    
    if (!endpoint) {
      throw new AppError(
        `Endpoint not found: ${endpointId}`,
        ErrorCode.NOT_FOUND,
        { context: { endpointId } }
      ) as AppError & { code: ErrorCode.NOT_FOUND };
    }

    Object.assign(endpoint, updates, { updatedAt: new Date() });
    
    if (updates.retryConfig) {
      endpoint.retryConfig = { ...endpoint.retryConfig, ...updates.retryConfig };
    }

    this.endpoints.set(endpointId, endpoint);
    this.updateEndpointStats();

    logger.info('Webhook endpoint updated', {
      event: 'webhook.endpoint.updated',
      metadata: { endpointId, updatedFields: Object.keys(updates) },
    });

    return endpoint;
  }

  /**
   * Remove a webhook endpoint
   */
  removeEndpoint(endpointId: string): boolean {
    const endpoint = this.endpoints.get(endpointId);
    
    if (!endpoint) {
      return false;
    }

    // Move pending deliveries to dead letter queue
    this.movePendingDeliveriesToDLQ(endpointId, 'endpoint_deleted');

    this.endpoints.delete(endpointId);
    this.updateEndpointStats();

    logger.info('Webhook endpoint removed', {
      event: 'webhook.endpoint.removed',
      metadata: { endpointId, url: endpoint.url },
    });

    return true;
  }

  getEndpoint(endpointId: string): WebhookEndpoint | undefined {
    return this.endpoints.get(endpointId);
  }

  getEndpoints(options?: {
    activeOnly?: boolean;
    eventTypes?: string[];
  }): WebhookEndpoint[] {
    let endpoints = Array.from(this.endpoints.values());

    if (options?.activeOnly) {
      endpoints = endpoints.filter(ep => ep.isActive);
    }

    if (options?.eventTypes?.length) {
      endpoints = endpoints.filter(ep =>
        ep.subscribedEvents.some(pattern =>
          options.eventTypes!.some(type => this.subscriptionManager.matchEventPattern(type, pattern))
        )
      );
    }

    return endpoints;
  }

  disableEndpoint(endpointId: string): WebhookEndpoint {
    return this.updateEndpoint(endpointId, { isActive: false });
  }

  enableEndpoint(endpointId: string): WebhookEndpoint {
    const endpoint = this.updateEndpoint(endpointId, { isActive: true });
    endpoint.consecutiveFailures = 0;
    return endpoint;
  }

  // ============== Event Dispatch & Routing ==============

  async dispatchEvent(
    type: import('./signature').WebhookEventType,
    data: Record<string, unknown>,
    options?: {
      source?: string;
      correlationId?: string;
      parentEventId?: string;
      priority?: number;
    }
  ): Promise<{
    event: WebhookEvent;
    deliveries: Promise<WebhookDelivery[]>[];
  }> {
    const event: WebhookEvent = {
      id: `evt_${Date.now()}_${randomUUID().slice(0, 8)}`,
      type,
      data,
      createdAt: new Date().toISOString(),
      version: EVENT_SCHEMA_VERSION,
      source: options?.source || 'ssm-pay',
      correlationId: options?.correlationId,
      parentEventId: options?.parentEventId,
    };

    this.stats.totalEventsReceived++;

    logger.info('Dispatching webhook event', {
      event: 'webhook.event.dispatched',
      metadata: { eventId: event.id, type: event.type },
    });

    // Find matching endpoints and create deliveries
    const targetEndpoints = this.findEndpointsForEventType(event.type);
    const deliveryPromises: Promise<WebhookDelivery[]>[] = [];

    for (const endpoint of targetEndpoints) {
      if (!endpoint.isActive) continue;

      const queueItem = this.queueManager.enqueueDelivery(event, endpoint, options?.priority);
      deliveryPromises.push(this.queueManager.processQueueItem(queueItem));
    }

    // Also trigger local subscriptions
    await this.routeEventToSubscribers(event);

    this.stats.totalEventsProcessed++;

    return { event, deliveries: deliveryPromises };
  }

  private findEndpointsForEventType(eventType: string): WebhookEndpoint[] {
    const matchingEndpoints: WebhookEndpoint[] = [];

    for (const endpoint of this.endpoints.values()) {
      if (!endpoint.isActive) continue;

      const isMatch = endpoint.subscribedEvents.some(pattern =>
        this.subscriptionManager.matchEventPattern(eventType, pattern)
      );

      if (isMatch) {
        matchingEndpoints.push(endpoint);
      }
    }

    return matchingEndpoints;
  }

  // ============== Subscription Management Delegation ==============

  createSubscription(config: {
    subscriberId: string;
    eventPattern: string;
    endpointIds: string[];
    filters?: EventFilter[];
    rateLimitPerMinute?: number;
    expiresAt?: Date;
    options?: Partial<SubscriptionOptions>;
  }): EventSubscription {
    return this.subscriptionManager.createSubscription(config, this.endpoints);
  }

  updateSubscription(
    subscriptionId: string,
    updates: Partial<{
      eventPattern: string;
      endpointIds: string[];
      filters: EventFilter[];
      isActive: boolean;
      rateLimitPerMinute: number;
      options: Partial<SubscriptionOptions>;
      expiresAt: Date;
    }>
  ): EventSubscription {
    return this.subscriptionManager.updateSubscription(subscriptionId, updates);
  }

  removeSubscription(subscriptionId: string): boolean {
    return this.subscriptionManager.removeSubscription(subscriptionId);
  }

  getSubscriptionsForEvent(eventType: string): EventSubscription[] {
    return this.subscriptionManager.getSubscriptionsForEvent(eventType);
  }

  private async routeEventToSubscribers(event: WebhookEvent): Promise<void> {
    const subscriptions = this.subscriptionManager.getSubscriptionsForEvent(event.type);

    for (const subscription of subscriptions) {
      // Apply filters
      if (subscription.filters && !this.subscriptionManager.applyFilters(event.data, subscription.filters)) {
        continue;
      }

      // Deliver to each endpoint in subscription
      for (const endpointId of subscription.endpointIds) {
        const endpoint = this.endpoints.get(endpointId);
        if (!endpoint || !endpoint.isActive) continue;

        try {
          const queueItem = this.queueManager.enqueueDelivery(event, endpoint);
          this.queueManager.processQueueItem(queueItem).catch(error => {
            logger.error('Subscriber delivery failed', {
              event: 'webhook.subscriber.error',
              error: error instanceof Error ? error : new Error(String(error)),
              metadata: { subscriptionId: subscription.id, endpointId },
            });
          });
        } catch (error) {
          logger.warn('Failed to enqueue for subscriber', {
            event: 'webhook.subscriber.enqueue_failed',
            error: error instanceof Error ? error : new Error(String(error)),
            metadata: { subscriptionId: subscription.id, endpointId },
          });
        }
      }
    }
  }

  // ============== Dead Letter Queue Delegation ==============

  private moveToDeadLetterQueue(delivery: WebhookDelivery, endpoint: WebhookEndpoint, reason: DeadLetterReason): void {
    this.deadLetterQueue.addEntry(delivery, endpoint.id, reason);
    delivery.status = 'dead_lettered';
  }

  private movePendingDeliveriesToDLQ(endpointId: string, reason: DeadLetterReason): void {
    const pendingItems = this.queueManager.getItemsByEndpoint(endpointId);
    
    for (const item of pendingItems) {
      this.deadLetterQueue.addEntryForDeletedEndpoint(item.event, endpointId, item.priority);
    }

    // Remove from queue
    this.queueManager.removeItemsByEndpoint(endpointId);
  }

  getDeadLetterQueue(options?: {
    unacknowledgedOnly?: boolean;
    endpointId?: string;
    reason?: DeadLetterReason;
  }): DeadLetterEntry[] {
    return this.deadLetterQueue.getEntries(options);
  }

  async retryDeadLetterEntry(dlqEntryId: string): Promise<WebhookDelivery | null> {
    return this.deadLetterQueue.retryEntry(dlqEntryId, this.endpoints, (event, endpointId, priority) => {
      const endpoint = this.endpoints.get(endpointId)!;
      const queueItem = this.queueManager.enqueueDelivery(event, endpoint, priority);
      return this.queueManager.processQueueItem(queueItem).then(d => d[0] || null);
    });
  }

  acknowledgeDeadLetterEntry(dlqEntryId: string): boolean {
    return this.deadLetterQueue.acknowledgeEntry(dlqEntryId);
  }

  clearAcknowledgedDeadLetters(): number {
    return this.deadLetterQueue.clearAcknowledged();
  }

  // ============== Idempotency Handling ==============

  isDuplicateEvent(eventId: string): boolean {
    const processedAt = this.processedEvents.get(eventId);
    
    if (!processedAt) {
      return false;
    }

    const age = Date.now() - processedAt;
    return age < this.config.idempotencyWindowMs;
  }

  markEventAsProcessed(eventId: string): void {
    this.processedEvents.set(eventId, Date.now());
  }

  private cleanupIdempotencyEntries(): number {
    const cutoff = Date.now() - this.config.idempotencyWindowMs;
    let cleaned = 0;

    for (const [eventId, processedAt] of this.processedEvents.entries()) {
      if (processedAt < cutoff) {
        this.processedEvents.delete(eventId);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ============== Statistics & Monitoring ==============

  getStatistics(): WebhookStatistics {
    // Get latest stats from sub-components
    const queueStats = this.queueManager.getStats();
    this.stats.queueSize = queueStats.queueSize;
    this.stats.deadLetterQueueSize = this.deadLetterQueue.getSize();
    this.stats.oldestQueuedItemAgeMs = queueStats.oldestItemAgeMs;
    
    return { ...this.stats };
  }

  getDeliveriesForEvent(eventId: string): WebhookDelivery[] {
    return Array.from(this.deliveries.values())
      .filter(d => d.event.id === eventId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getDeliveriesForEndpoint(
    endpointId: string,
    options?: { status?: DeliveryStatus; limit?: number }
  ): WebhookDelivery[] {
    let deliveries = Array.from(this.deliveries.values())
      .filter(d => d.endpointId === endpointId);

    if (options?.status) {
      deliveries = deliveries.filter(d => d.status === options.status);
    }

    deliveries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (options?.limit) {
      deliveries = deliveries.slice(0, options.limit);
    }

    return deliveries;
  }

  private updateEndpointStats(): void {
    const endpoints = Array.from(this.endpoints.values());
    this.stats.activeEndpoints = endpoints.filter(ep => ep.isActive).length;
    this.stats.disabledEndpoints = endpoints.filter(ep => !ep.isActive).length;
    this.stats.totalEndpoints = endpoints.length;
  }

  private updateAverageDeliveryTime(newDurationMs: number): void {
    const total = this.stats.totalDeliveriesSucceeded;
    const currentAvg = this.stats.averageDeliveryTimeMs;
    this.stats.averageDeliveryTimeMs = currentAvg + (newDurationMs - currentAvg) / total;
  }

  // ============== Maintenance & Cleanup ==============

  private performCleanup(): void {
    const results = {
      idempotencyCleaned: this.cleanupIdempotencyEntries(),
      dlqCleaned: this.deadLetterQueue.clearAcknowledged(),
    };

    const totalCleaned = Object.values(results).reduce((sum, val) => sum + val, 0);

    if (totalCleaned > 0) {
      logger.debug('Webhook cleanup completed', {
        event: 'webhook.cleanup.completed',
        metadata: results,
      });
    }
  }

  triggerCleanup(): {
    idempotencyCleaned: number;
    dlqCleaned: number;
  } {
    return {
      idempotencyCleaned: this.cleanupIdempotencyEntries(),
      dlqCleaned: this.deadLetterQueue.clearAcknowledged(),
    };
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.endpoints.clear();
    this.subscriptionManager.clear();
    this.deliveries.clear();
    this.queueManager.clear();
    this.deadLetterQueue.clearAll();
    this.processedEvents.clear();

    this.stats = this.initializeStatistics();

    logger.info('WebhookProcessingService destroyed', {
      event: 'webhook.service.destroyed',
    });
  }

  healthCheck(): {
    healthy: boolean;
    issues: string[];
    stats: Partial<WebhookStatistics>;
  } {
    const issues: string[] = [];
    const stats = this.getStatistics();

    if (stats.queueSize > this.config.maxQueueSize * 0.9) {
      issues.push(`Queue at ${Math.round(stats.queueSize / this.config.maxQueueSize * 100)}% capacity`);
    }

    if (stats.deadLetterQueueSize > this.config.maxDeadLetterQueueSize * 0.9) {
      issues.push(`Dead letter queue at ${Math.round(stats.deadLetterQueueSize / this.config.maxDeadLetterQueueSize * 100)}% capacity`);
    }

    const unhealthyEndpoints = Array.from(this.endpoints.values())
      .filter(ep => ep.consecutiveFailures >= 10);
    
    if (unhealthyEndpoints.length > 0) {
      issues.push(`${unhealthyEndpoints.length} endpoint(s) with high failure count`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats: {
        queueSize: stats.queueSize,
        deadLetterQueueSize: stats.deadLetterQueueSize,
        activeEndpoints: stats.activeEndpoints,
        totalDeliveriesSucceeded: stats.totalDeliveriesSucceeded,
        totalDeliveriesFailed: stats.totalDeliveriesFailed,
      },
    };
  }
}

// ============== Singleton Instance ==============

/** Default webhook processing service instance */
export const webhookProcessingService = new WebhookProcessingService();

// ============== Exports ==============

export default WebhookProcessingService;
