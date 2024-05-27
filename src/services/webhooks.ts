/**
 * Enterprise Webhook Processing Service for SSM-Pay
 * 
 * A comprehensive webhook system providing:
 * - HMAC-SHA256 signature verification
 * - Event routing and dispatching
 * - Exponential backoff retry logic
 * - Idempotency handling
 * - Queue management with priority support
 * - Delivery status tracking
 * - Event subscription management
 * - Dead letter queue for failed webhooks
 * 
 * @module services/webhooks
 * @version 2.0.0
 */

import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Type Definitions ==============

/**
 * Supported event types for webhooks
 */
export type WebhookEventType = 
  | 'payment.initiated'
  | 'payment.completed'
  | 'payment.failed'
  | 'payment.refunded'
  | 'payment.partial_refund'
  | 'payment.expired'
  | 'transaction.created'
  | 'transaction.updated'
  | 'transaction.verified'
  | 'transaction.reconciled'
  | 'transaction.flagged'
  | 'zainbox.created'
  | 'zainbox.updated'
  | 'zainbox.deactivated'
  | 'account.created'
  | 'account.verified'
  | 'account.suspended'
  | 'fraud.detected'
  | 'fraud.review_required'
  | 'fraud.confirmed'
  | 'fraud.dismissed'
  | 'webhook.delivery_failed'
  | 'webhook.endpoint_disabled'
  | 'system.health_check'
  | 'system.error'
  | string;

/**
 * Webhook event payload structure
 */
export interface WebhookEvent {
  /** Unique identifier for the event */
  id: string;
  /** Event type classification */
  type: WebhookEventType;
  /** Event data payload */
  data: Record<string, unknown>;
  /** ISO timestamp of event creation */
  createdAt: string;
  /** Schema version for backward compatibility */
  version: string;
  /** Source system that generated the event */
  source: string;
  /** Optional correlation ID for distributed tracing */
  correlationId?: string;
  /** Optional parent event ID for chained events */
  parentEventId?: string;
  /** Number of times this event has been processed */
  processingCount?: number;
}

/**
 * Incoming webhook payload from external sources
 */
export interface IncomingWebhookPayload {
  /** Event identifier */
  id: string;
  /** Event type */
  type: string;
  /** Creation timestamp */
  created: string;
  /** Event payload data */
  data: Record<string, unknown>;
}

/**
 * Webhook endpoint configuration
 */
export interface WebhookEndpoint {
  /** Unique endpoint identifier */
  id: string;
  /** URL to deliver webhooks to */
  url: string;
  /** Secret key for HMAC signing */
  secret: string;
  /** List of subscribed event types (supports wildcards) */
  subscribedEvents: string[];
  /** Whether endpoint is currently active */
  isActive: boolean;
  /** Endpoint creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Last successful delivery time */
  lastSuccessfulDeliveryAt?: Date;
  /** Last failure timestamp */
  lastFailureAt?: Date;
  /** Consecutive failure count */
  consecutiveFailures: number;
  /** Total deliveries attempted */
  totalDeliveries: number;
  /** Total successful deliveries */
  successfulDeliveries: number;
  /** Maximum allowed retries per webhook */
  maxRetries: number;
  /** Retry configuration */
  retryConfig: RetryConfiguration;
  /** Optional metadata for the endpoint */
  metadata?: Record<string, unknown>;
  /** Endpoint description */
  description?: string;
}

/**
 * Retry configuration for webhook delivery
 */
export interface RetryConfiguration {
  /** Initial delay in milliseconds before first retry */
  initialDelayMs: number;
  /** Maximum delay cap in milliseconds */
  maxDelayMs: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  /** Jitter factor (0-1) for randomized delays */
  jitterFactor: number;
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** HTTP status codes that trigger retry */
  retryableStatusCodes: number[];
}

/**
 * Webhook delivery attempt record
 */
export interface WebhookDelivery {
  /** Unique delivery identifier */
  id: string;
  /** Associated event */
  event: WebhookEvent;
  /** Target endpoint */
  endpointId: string;
  /** Current delivery status */
  status: DeliveryStatus;
  /** HTTP response status code */
  responseStatusCode?: number;
  /** Response body from endpoint */
  responseBody?: string;
  /** Error message if delivery failed */
  errorMessage?: string;
  /** Error code classification */
  errorCode?: string;
  /** Current attempt number */
  attemptNumber: number;
  /** Maximum attempts allowed */
  maxAttempts: number;
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
  nextRetryAt?: Date;
  /** Duration of last attempt in milliseconds */
  durationMs?: number;
  /** Request headers sent */
  requestHeaders?: Record<string, string>;
  /** Signature used for this delivery */
  signature?: string;
}

/**
 * Delivery status enumeration
 */
export type DeliveryStatus = 
  | 'pending'
  | 'queued'
  | 'processing'
  | 'delivered'
  | 'failed'
  | 'retrying'
  | 'expired'
  | 'dead_lettered';

/**
 * Event subscription configuration
 */
export interface EventSubscription {
  /** Subscription ID */
  id: string;
  /** Subscriber/owner identifier */
  subscriberId: string;
  /** Event pattern (supports wildcards) */
  eventPattern: string;
  /** Endpoint IDs to receive events */
  endpointIds: string[];
  /** Filter criteria for selective processing */
  filters?: EventFilter[];
  /** Whether subscription is active */
  isActive: boolean;
  /** Created at timestamp */
  createdAt: Date;
  /** Optional expiration date */
  expiresAt?: Date;
  /** Rate limit (events per minute) */
  rateLimitPerMinute?: number;
  /** Processing options */
  options: SubscriptionOptions;
}

/**
 * Event filter for conditional processing
 */
export interface EventFilter {
  /** Field path to filter on (dot notation supported) */
  field: string;
  /** Comparison operator */
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'regex';
  /** Value to compare against */
  value: unknown;
}

/**
 * Subscription processing options
 */
export interface SubscriptionOptions {
  /** Include raw payload in delivery */
  includeRawPayload: boolean;
  /** Include metadata headers */
  includeMetadata: boolean;
  /** Timeout in milliseconds for delivery acknowledgment */
  timeoutMs: number;
  /** Whether to verify SSL certificates */
  verifySsl: boolean;
  /** Custom headers to include */
  customHeaders?: Record<string, string>;
}

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
  defaultRetryConfig: {
    initialDelayMs: 1000,
    maxDelayMs: 300000, // 5 minutes
    backoffMultiplier: 2,
    jitterFactor: 0.2,
    maxAttempts: 5,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  },
  maxConcurrency: 10,
  idempotencyWindowMs: 24 * 60 * 60 * 1000, // 24 hours
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
  enableMetrics: true,
  maxPayloadSizeBytes: 1024 * 1024, // 1MB
};

/** HTTP header names for webhook delivery */
const WEBHOOK_HEADERS = {
  SIGNATURE: 'X-SSM-Pay-Signature',
  TIMESTAMP: 'X-SSM-Pay-Timestamp',
  EVENT_ID: 'X-SSM-Pay-Event-ID',
  EVENT_TYPE: 'X-SSM-Pay-Event-Type',
  DELIVERY_ID: 'X-SSM-Pay-Delivery-ID',
  ATTEMPT: 'X-SSM-Pay-Attempt',
} as const;

/** Event schema version */
const EVENT_SCHEMA_VERSION = '2.0.0';

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
 *   secret: 'endpoint-secret',
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
  
  /** Active subscriptions storage */
  private subscriptions: Map<string, EventSubscription> = new Map();
  
  /** Delivery tracking storage */
  private deliveries: Map<string, WebhookDelivery> = new Map();
  
  /** Pending delivery queue */
  private deliveryQueue: WebhookQueueItem[] = [];
  
  /** Dead letter queue for failed deliveries */
  private deadLetterQueue: DeadLetterEntry[] = new Map();
  
  /** Processed events set for idempotency */
  private processedEvents: Map<string, number> = new Map(); // eventId -> timestamp
  
  /** Service configuration */
  private config: Required<WebhookServiceConfig>;
  
  /** Statistics tracker */
  private stats: WebhookStatistics;
  
  /** Cleanup interval handle */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  
  /** Currently processing count */
  private currentProcessingCount: number = 0;

  /**
   * Creates a new WebhookProcessingService instance
   * @param config - Optional configuration overrides
   */
  constructor(config: Partial<WebhookServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize statistics
    this.stats = this.initializeStatistics();
    
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
    
    // Don't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  // ============== Signature Verification ==============

  /**
   * Generate HMAC-SHA256 signature for a payload
   * 
   * @param payload - The payload object to sign
   * @param secret - The secret key for signing
   * @param timestamp - Optional timestamp for inclusion in signature
   * @returns Hex-encoded signature string
   * 
   * @example
   * ```typescript
   * const signature = webhookService.generateSignature(
   *   { id: 'evt_123', type: 'payment.completed', data: {} },
   *   'my-secret-key'
   * );
   * ```
   */
  generateSignature(
    payload: Record<string, unknown>,
    secret: string,
    timestamp?: number
  ): string {
    const ts = timestamp || Date.now();
    const payloadString = JSON.stringify(payload);
    const signedPayload = `${ts}.${payloadString}`;
    
    const signature = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    
    return `t=${ts},v1=${signature}`;
  }

  /**
   * Verify HMAC-SHA256 signature for an incoming webhook
   * 
   * Uses timing-safe comparison to prevent timing attacks.
   * Supports both timestamped and plain signatures.
   * 
   * @param payload - The raw payload to verify
   * @param signature - The signature to verify against
   * @param secret - The secret key used for verification
   * @param maxAge - Maximum age in ms for timestamped signatures (default: 5 minutes)
   * @returns True if signature is valid, false otherwise
   * 
   * @example
   * ```typescript
   * const isValid = await webhookService.verifySignature(
   *   requestBody,
   *   requestHeaders['x-ssm-pay-signature'],
   *   endpointSecret
   * );
   * ```
   */
  async verifySignature(
    payload: unknown,
    signature: string,
    secret: string,
    maxAge: number = 5 * 60 * 1000 // 5 minutes
  ): Promise<boolean> {
    try {
      // Parse signature format: t=timestamp,v1=signature
      const signatureMatch = signature.match(/t=(\d+),v1=([a-f0-9]+)/);
      
      if (!signatureMatch) {
        this.stats.signaturesFailed++;
        logger.warn('Invalid signature format', {
          event: 'webhook.signature.invalid_format',
          metadata: { signaturePrefix: signature.substring(0, 20) },
        });
        return false;
      }

      const [, timestampStr, providedSignature] = signatureMatch;
      const timestamp = parseInt(timestampStr, 10);
      
      // Check timestamp freshness
      const now = Date.now();
      const timestampAge = now - timestamp;
      
      if (timestampAge < 0) {
        this.stats.signaturesFailed++;
        logger.warn('Signature timestamp is in the future', {
          event: 'webhook.signature.future_timestamp',
          metadata: { timestampAge: Math.abs(timestampAge) },
        });
        return false;
      }
      
      if (timestampAge > maxAge) {
        this.stats.signaturesFailed++;
        logger.warn('Signature timestamp too old', {
          event: 'webhook.signature.expired',
          metadata: { timestampAge, maxAge },
        });
        return false;
      }

      // Generate expected signature
      const payloadString = JSON.stringify(payload);
      const signedPayload = `${timestamp}.${payloadString}`;
      
      const expectedSignature = createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      // Use timing-safe comparison
      const isValid = timingSafeEqual(
        Buffer.from(providedSignature),
        Buffer.from(expectedSignature)
      );

      if (isValid) {
        this.stats.signaturesVerified++;
        logger.debug('Signature verified successfully', {
          event: 'webhook.signature.verified',
        });
      } else {
        this.stats.signaturesFailed++;
        logger.warn('Signature verification failed', {
          event: 'webhook.signature.mismatch',
        });
      }

      return isValid;
    } catch (error) {
      this.stats.signaturesFailed++;
      logger.error('Error during signature verification', {
        event: 'webhook.signature.error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  // ============== Incoming Webhook Processing ==============

  /**
   * Process an incoming webhook request
   * 
   * Handles the complete workflow:
   * 1. Validate payload structure
   * 2. Verify signature
   * 3. Check idempotency
   * 4. Parse and normalize event
   * 5. Route to handlers/subscribers
   * 
   * @param payload - The raw webhook payload
   * @param headers - HTTP headers containing signature
   * @returns Processing result with status and optional event
   * 
   * @example
   * ```typescript
   * const result = await webhookService.processIncomingWebhook(
   *   req.body,
   *   req.headers
   * );
   * 
   * if (result.valid && result.event) {
   *   console.log('Processed event:', result.event.type);
   * }
   * ```
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

      const isValid = await this.verifySignature(
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
        type: eventType,
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
   * 
   * @param config - Endpoint configuration
   * @returns The registered endpoint
   * @throws AppError if configuration is invalid
   * 
   * @example
   * ```typescript
   * const endpoint = await webhookService.registerEndpoint({
   *   url: 'https://api.example.com/webhooks',
   *   secret: 'whsec_my_secret_key',
   *   subscribedEvents: ['payment.*', 'transaction.*'],
   *   description: 'Primary payment webhook handler'
   * });
   * ```
   */
  registerEndpoint(config: {
    url: string;
    secret: string;
    subscribedEvents: string[];
    description?: string;
    metadata?: Record<string, unknown>;
    maxRetries?: number;
    retryConfig?: Partial<RetryConfiguration>;
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
   * 
   * @param endpointId - ID of endpoint to update
   * @param updates - Fields to update
   * @returns Updated endpoint
   * @throws AppError if endpoint not found
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
      retryConfig: Partial<RetryConfiguration>;
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

    // Apply updates
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
   * 
   * @param endpointId - ID of endpoint to remove
   * @returns True if removed, false if not found
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

  /**
   * Get an endpoint by ID
   * 
   * @param endpointId - Endpoint ID
   * @returns Endpoint or undefined if not found
   */
  getEndpoint(endpointId: string): WebhookEndpoint | undefined {
    return this.endpoints.get(endpointId);
  }

  /**
   * Get all registered endpoints
   * 
   * @param options - Filter options
   * @returns Array of endpoints
   */
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
          options.eventTypes!.some(type => this.matchEventPattern(type, pattern))
        )
      );
    }

    return endpoints;
  }

  /**
   * Disable an endpoint (soft delete)
   * 
   * @param endpointId - Endpoint ID to disable
   * @returns Updated endpoint
   */
  disableEndpoint(endpointId: string): WebhookEndpoint {
    return this.updateEndpoint(endpointId, { isActive: false });
  }

  /**
   * Re-enable a disabled endpoint
   * 
   * @param endpointId - Endpoint ID to enable
   * @returns Updated endpoint
   */
  enableEndpoint(endpointId: string): WebhookEndpoint {
    const endpoint = this.updateEndpoint(endpointId, { isActive: true });
    // Reset consecutive failures when re-enabling
    endpoint.consecutiveFailures = 0;
    return endpoint;
  }

  // ============== Event Dispatch & Routing ==============

  /**
   * Create and dispatch a new webhook event
   * 
   * @param type - Event type
   * @param data - Event payload data
   * @param options - Additional event options
   * @returns Created event and delivery promises
   * 
   * @example
   * ```typescript
   * const { event, deliveries } = await webhookService.dispatchEvent(
   *   'payment.completed',
   *   { transactionId: 'txn_123', amount: 10000, currency: 'NGN' },
   *   { correlationId: 'req_456' }
   * );
   * ```
   */
  async dispatchEvent(
    type: WebhookEventType,
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

      const queueItem = this.enqueueDelivery(event, endpoint, options?.priority);
      deliveryPromises.push(this.processQueueItem(queueItem));
    }

    // Also trigger local subscriptions
    await this.routeEventToSubscribers(event);

    this.stats.totalEventsProcessed++;

    return { event, deliveries: deliveryPromises };
  }

  /**
   * Find endpoints subscribed to a specific event type
   * 
   * @param eventType - Event type to match
   * @returns Matching endpoints
   * @private
   */
  private findEndpointsForEventType(eventType: string): WebhookEndpoint[] {
    const matchingEndpoints: WebhookEndpoint[] = [];

    for (const endpoint of this.endpoints.values()) {
      if (!endpoint.isActive) continue;

      const isMatch = endpoint.subscribedEvents.some(pattern =>
        this.matchEventPattern(eventType, pattern)
      );

      if (isMatch) {
        matchingEndpoints.push(endpoint);
      }
    }

    return matchingEndpoints;
  }

  /**
   * Match event type against a pattern (supports wildcards)
   * 
   * @param eventType - Actual event type
   * @param pattern - Pattern to match against
   * @returns True if matches
   * @private
   */
  private matchEventPattern(eventType: string, pattern: string): boolean {
    // Exact match
    if (eventType === pattern) return true;

    // Wildcard: payment.* matches payment.completed, payment.failed, etc.
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1); // Remove *
      // Support both "event.*" and "event*" patterns
      if (pattern.endsWith('.*')) {
        return eventType.startsWith(prefix);
      }
      return eventType.startsWith(prefix);
    }

    // Regex pattern support
    if (pattern.startsWith('^') || pattern.endsWith('$')) {
      try {
        const regex = new RegExp(pattern);
        return regex.test(eventType);
      } catch {
        return false;
      }
    }

    return false;
  }

  // ============== Queue Management ==============

  /**
   * Add a delivery to the processing queue
   * 
   * @param event - Event to deliver
   * @param endpoint - Target endpoint
   * @param priority - Queue priority (lower = higher)
   * @returns Queue item
   * @private
   */
  private enqueueDelivery(
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

    this.updateQueueStats();

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
   * @private
   */
  private async processQueueItem(queueItem: WebhookQueueItem): Promise<WebhookDelivery[]> {
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

      const delivery = await this.executeDelivery(queueItem.event, endpoint);
      queueItem.status = 'completed';
      
      return [delivery];
    } catch (error) {
      queueItem.status = 'failed';
      throw error;
    } finally {
      this.currentProcessingCount--;
      this.updateQueueStats();
    }
  }

  /**
   * Execute actual HTTP delivery to endpoint
   * 
   * @param event - Event to deliver
   * @param endpoint - Target endpoint
   * @returns Delivery record
   * @private
   */
  private async executeDelivery(
    event: WebhookEvent,
    endpoint: WebhookEndpoint
  ): Promise<WebhookDelivery> {
    const deliveryId = `del_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const startTime = Date.now();

    // Get or create delivery record
    let delivery = this.deliveries.get(deliveryId);
    
    if (!delivery) {
      delivery = {
        id: deliveryId,
        event,
        endpointId: endpoint.id,
        status: 'processing',
        attemptNumber: 1,
        maxAttempts: endpoint.maxRetries,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.deliveries.set(deliveryId, delivery);
    } else {
      delivery.attemptNumber++;
      delivery.updatedAt = new Date();
      delivery.status = 'processing';
    }

    this.stats.totalDeliveriesAttempted++;
    endpoint.totalDeliveries++;

    try {
      // Prepare payload
      const payload: IncomingWebhookPayload = {
        id: event.id,
        type: event.type,
        created: event.createdAt,
        data: event.data,
      };

      // Generate signature
      const signature = this.generateSignature(payload, endpoint.secret);
      delivery.signature = signature;

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        [WEBHOOK_HEADERS.SIGNATURE]: signature,
        [WEBHOOK_HEADERS.TIMESTAMP]: Date.now().toString(),
        [WEBHOOK_HEADERS.EVENT_ID]: event.id,
        [WEBHOOK_HEADERS.EVENT_TYPE]: event.type,
        [WEBHOOK_HEADERS.DELIVERY]: deliveryId,
        [WEBHOOK_HEADERS.ATTEMPT]: delivery.attemptNumber.toString(),
        'User-Agent': 'SSM-Pay-Webhook/2.0',
      };

      delivery.requestHeaders = headers;

      // Execute HTTP request with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const durationMs = Date.now() - startTime;
      delivery.durationMs = durationMs;
      delivery.responseStatusCode = response.status;
      delivery.responseBody = await response.text().catch(() => '');

      if (response.ok) {
        // Success
        delivery.status = 'delivered';
        delivery.deliveredAt = new Date();
        endpoint.lastSuccessfulDeliveryAt = new Date();
        endpoint.successfulDeliveries++;
        endpoint.consecutiveFailures = 0;

        this.stats.totalDeliveriesSucceeded++;
        this.updateAverageDeliveryTime(durationMs);

        logger.info('Webhook delivered successfully', {
          event: 'webhook.delivery.success',
          metadata: {
            deliveryId,
            endpointId: endpoint.id,
            eventId: event.id,
            statusCode: response.status,
            attempt: delivery.attemptNumber,
            durationMs,
          },
        });
      } else if (endpoint.retryConfig.retryableStatusCodes.includes(response.status)) {
        // Retryable error
        throw new AppError(
          `HTTP ${response.status}: ${delivery.responseBody}`,
          ErrorCode.API_RESPONSE_ERROR,
          { context: { statusCode: response.status, endpointUrl: endpoint.url } }
        );
      } else {
        // Non-retryable error
        delivery.status = 'failed';
        delivery.errorMessage = `HTTP ${response.status}: ${delivery.responseBody}`;
        
        this.stats.totalDeliveriesFailed++;
        endpoint.consecutiveFailures++;
        endpoint.lastFailureAt = new Date();

        // Move to dead letter if appropriate
        if (delivery.attemptNumber >= delivery.maxAttempts) {
          this.moveToDeadLetterQueue(delivery, endpoint, 'max_retries_exceeded');
        }

        logger.warn('Webhook delivery failed (non-retryable)', {
          event: 'webhook.delivery.failed',
          metadata: {
            deliveryId,
            endpointId: endpoint.id,
            statusCode: response.status,
            attempt: delivery.attemptNumber,
          },
        });
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      delivery.durationMs = durationMs;
      delivery.errorMessage = error instanceof Error ? error.message : String(error);
      delivery.errorCode = error instanceof AppError ? error.code : 'UNKNOWN';

      this.stats.totalDeliveriesFailed++;
      endpoint.consecutiveFailures++;
      endpoint.lastFailureAt = new Date();

      // Determine if we should retry
      if (delivery.attemptNumber < delivery.maxAttempts) {
        delivery.status = 'retrying';
        delivery.nextRetryAt = this.calculateRetryTime(delivery, endpoint);
        
        this.stats.totalDeliveriesRetried++;

        logger.warn('Scheduling webhook retry', {
          event: 'webhook.delivery.retry_scheduled',
          metadata: {
            deliveryId,
            endpointId: endpoint.id,
            attempt: delivery.attemptNumber,
            nextRetry: delivery.nextRetryAt?.toISOString(),
          },
        });

        // Schedule retry
        const retryDelay = delivery.nextRetryAt.getTime() - Date.now();
        setTimeout(async () => {
          await this.executeDelivery(event, endpoint);
        }, retryDelay);
      } else {
        // Max retries exceeded - move to DLQ
        delivery.status = 'failed';
        this.moveToDeadLetterQueue(delivery, endpoint, 'max_retries_exceeded');

        logger.error('Webhook moved to dead letter queue', {
          event: 'webhook.delivery.dead_lettered',
          metadata: {
            deliveryId,
            endpointId: endpoint.id,
            totalAttempts: delivery.attemptNumber,
            lastError: delivery.errorMessage,
          },
        });
      }
    }

    delivery.updatedAt = new Date();
    this.deliveries.set(deliveryId, delivery);

    return delivery;
  }

  /**
   * Calculate next retry time with exponential backoff and jitter
   * 
   * @param delivery - Current delivery record
   * @param endpoint - Target endpoint
   * @returns Next retry timestamp
   * @private
   */
  private calculateRetryTime(
    delivery: WebhookDelivery,
    endpoint: WebhookEndpoint
  ): Date {
    const { retryConfig } = endpoint;
    
    // Calculate base delay with exponential backoff
    const baseDelay = retryConfig.initialDelayMs * 
      Math.pow(retryConfig.backoffMultiplier, delivery.attemptNumber - 1);
    
    // Cap at maximum delay
    const cappedDelay = Math.min(baseDelay, retryConfig.maxDelayMs);
    
    // Add jitter (randomization to prevent thundering herd)
    const jitterRange = cappedDelay * retryConfig.jitterFactor;
    const jitter = (Math.random() * 2 - 1) * jitterRange; // -jitter to +jitter
    
    const finalDelay = Math.max(0, Math.ceil(cappedDelay + jitter));

    return new Date(Date.now() + finalDelay);
  }

  // ============== Subscription Management ==============

  /**
   * Create a new event subscription
   * 
   * @param config - Subscription configuration
   * @returns Created subscription
   */
  createSubscription(config: {
    subscriberId: string;
    eventPattern: string;
    endpointIds: string[];
    filters?: EventFilter[];
    rateLimitPerMinute?: number;
    expiresAt?: Date;
    options?: Partial<SubscriptionOptions>;
  }): EventSubscription {
    // Validate endpoints exist
    for (const endpointId of config.endpointIds) {
      if (!this.endpoints.has(endpointId)) {
        throw new AppError(
          `Endpoint not found: ${endpointId}`,
          ErrorCode.NOT_FOUND,
          { context: { endpointId } }
        ) as AppError & { code: ErrorCode.NOT_FOUND };
      }
    }

    const subscriptionId = `sub_${Date.now()}_${randomUUID().slice(0, 8)}`;

    const subscription: EventSubscription = {
      id: subscriptionId,
      subscriberId: config.subscriberId,
      eventPattern: config.eventPattern,
      endpointIds: config.endpointIds,
      filters: config.filters,
      isActive: true,
      createdAt: new Date(),
      expiresAt: config.expiresAt,
      rateLimitPerMinute: config.rateLimitPerMinute,
      options: {
        includeRawPayload: true,
        includeMetadata: true,
        timeoutMs: 30000,
        verifySsl: true,
        ...config.options,
      },
    };

    this.subscriptions.set(subscriptionId, subscription);

    logger.info('Event subscription created', {
      event: 'webhook.subscription.created',
      metadata: {
        subscriptionId,
        subscriberId: config.subscriberId,
        eventPattern: config.eventPattern,
        endpointCount: config.endpointIds.length,
      },
    });

    return subscription;
  }

  /**
   * Update an existing subscription
   * 
   * @param subscriptionId - Subscription ID
   * @param updates - Fields to update
   * @returns Updated subscription
   */
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
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription) {
      throw new AppError(
        `Subscription not found: ${subscriptionId}`,
        ErrorCode.NOT_FOUND,
        { context: { subscriptionId } }
      ) as AppError & { code: ErrorCode.NOT_FOUND };
    }

    Object.assign(subscription, updates);
    this.subscriptions.set(subscriptionId, subscription);

    logger.info('Event subscription updated', {
      event: 'webhook.subscription.updated',
      metadata: { subscriptionId, updatedFields: Object.keys(updates) },
    });

    return subscription;
  }

  /**
   * Remove a subscription
   * 
   * @param subscriptionId - Subscription ID
   * @returns True if removed
   */
  removeSubscription(subscriptionId: string): boolean {
    const result = this.subscriptions.delete(subscriptionId);
    
    if (result) {
      logger.info('Event subscription removed', {
        event: 'webhook.subscription.removed',
        metadata: { subscriptionId },
      });
    }

    return result;
  }

  /**
   * Get subscriptions for an event type
   * 
   * @param eventType - Event type to match
   * @returns Matching subscriptions
   */
  getSubscriptionsForEvent(eventType: string): EventSubscription[] {
    const matching: EventSubscription[] = [];

    for (const sub of this.subscriptions.values()) {
      if (!sub.isActive) continue;
      
      // Check expiration
      if (sub.expiresAt && sub.expiresAt < new Date()) continue;

      if (this.matchEventPattern(eventType, sub.eventPattern)) {
        matching.push(sub);
      }
    }

    return matching;
  }

  /**
   * Route event to matching subscribers
   * 
   * @param event - Event to route
   * @private
   */
  private async routeEventToSubscribers(event: WebhookEvent): Promise<void> {
    const subscriptions = this.getSubscriptionsForEvent(event.type);

    for (const subscription of subscriptions) {
      // Apply filters
      if (subscription.filters && !this.applyFilters(event.data, subscription.filters)) {
        continue;
      }

      // Deliver to each endpoint in subscription
      for (const endpointId of subscription.endpointIds) {
        const endpoint = this.endpoints.get(endpointId);
        if (!endpoint || !endpoint.isActive) continue;

        try {
          const queueItem = this.enqueueDelivery(event, endpoint);
          this.processQueueItem(queueItem).catch(error => {
            logger.error('Subscriber delivery failed', {
              event: 'webhook.subscriber.error',
              error: error instanceof Error ? error : new Error(String(error)),
              metadata: { subscriptionId: subscription.id, endpointId },
            });
          });
        } catch (error) {
          // Queue full - log and continue
          logger.warn('Failed to enqueue for subscriber', {
            event: 'webhook.subscriber.enqueue_failed',
            error: error instanceof Error ? error : new Error(String(error)),
            metadata: { subscriptionId: subscription.id, endpointId },
          });
        }
      }
    }
  }

  /**
   * Apply event filters to data
   * 
   * @param data - Event data
   * @param filters - Filters to apply
   * @returns True if passes all filters
   * @private
   */
  private applyFilters(data: Record<string, unknown>, filters: EventFilter[]): boolean {
    return every(filter => {
      const value = this.getNestedValue(data, filter.field);
      return this.compareValues(value, filter.operator, filter.value);
    }, filters);
  }

  /**
   * Get nested value from object using dot notation
   * 
   * @param obj - Source object
   * @param path - Dot-notation path
   * @returns Value at path
   * @private
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' 
        ? (current as Record<string, unknown>)[key] 
        : undefined;
    }, obj as unknown);
  }

  /**
   * Compare values using operator
   * 
   * @param actual - Actual value
   * @param operator - Comparison operator
   * @param expected - Expected value
   * @returns Comparison result
   * @private
   */
  private compareValues(actual: unknown, operator: EventFilter['operator'], expected: unknown): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;
      case 'ne':
        return actual !== expected;
      case 'gt':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
      case 'gte':
        return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
      case 'lt':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
      case 'lte':
        return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'contains':
        return typeof actual === 'string' && typeof expected === 'string' && 
               actual.includes(expected);
      case 'regex':
        return typeof actual === 'string' && typeof expected === 'string' &&
               new RegExp(expected).test(actual);
      default:
        return false;
    }
  }

  // ============== Dead Letter Queue ==============

  /**
   * Move a failed delivery to the dead letter queue
   * 
   * @param delivery - Failed delivery
   * @param endpoint - Target endpoint
   * @param reason - Reason for dead lettering
   * @private
   */
  private moveToDeadLetterQueue(
    delivery: WebhookDelivery,
    endpoint: WebhookEndpoint,
    reason: DeadLetterReason
  ): void {
    // Check DLQ size limit
    if (this.deadLetterQueue.size >= this.config.maxDeadLetterQueueSize) {
      // Evict oldest entry
      const oldestKey = this.deadLetterQueue.keys().next().value;
      if (oldestKey) {
        this.deadLetterQueue.delete(oldestKey);
      }
    }

    const dlqEntry: DeadLetterEntry = {
      id: `dlq_${Date.now()}_${randomUUID().slice(0, 8)}`,
      event: delivery.event,
      endpointId: endpoint.id,
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
      priority: 5,
      isAcknowledged: false,
    };

    this.deadLetterQueue.set(dlqEntry.id, dlqEntry);
    delivery.status = 'dead_lettered';
    this.updateQueueStats();

    logger.warn('Entry added to dead letter queue', {
      event: 'webhook.dlq.added',
      metadata: {
        dlqEntryId: dlqEntry.id,
        eventId: delivery.event.id,
        endpointId: endpoint.id,
        reason,
        totalAttempts: delivery.attemptNumber,
      },
    });
  }

  /**
   * Move pending deliveries to DLQ when endpoint is deleted
   * 
   * @param endpointId - Deleted endpoint ID
   * @param reason - Reason for moving
   * @private
   */
  private movePendingDeliveriesToDLQ(endpointId: string, reason: DeadLetterReason): void {
    const pendingItems = this.deliveryQueue.filter(item => item.endpointId === endpointId);
    
    for (const item of pendingItems) {
      const endpoint = this.endpoints.get(endpointId);
      if (!endpoint) continue;

      const dlqEntry: DeadLetterEntry = {
        id: `dlq_${Date.now()}_${randomUUID().slice(0, 8)}`,
        event: item.event,
        endpointId,
        reason,
        originalError: `Endpoint deleted while in queue`,
        deliveryHistory: [],
        deadLetteredAt: new Date(),
        totalAttempts: item.attempts,
        priority: item.priority,
        isAcknowledged: false,
      };

      this.deadLetterQueue.set(dlqEntry.id, dlqEntry);
    }

    // Remove from queue
    this.deliveryQueue = this.deliveryQueue.filter(item => item.endpointId !== endpointId);
  }

  /**
   * Get all entries in the dead letter queue
   * 
   * @param options - Filter options
   * @returns DLQ entries
   */
  getDeadLetterQueue(options?: {
    unacknowledgedOnly?: boolean;
    endpointId?: string;
    reason?: DeadLetterReason;
  }): DeadLetterEntry[] {
    let entries = Array.from(this.deadLetterQueue.values());

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
   * Retry a dead letter queue entry
   * 
   * @param dlqEntryId - DLQ entry ID
   * @returns New delivery promise or null if not found
   */
  async retryDeadLetterEntry(dlqEntryId: string): Promise<WebhookDelivery | null> {
    const entry = this.deadLetterQueue.get(dlqEntryId);
    
    if (!entry) {
      return null;
    }

    const endpoint = this.endpoints.get(entry.endpointId);
    
    if (!endpoint || !endpoint.isActive) {
      throw new AppError(
        'Cannot retry: endpoint not available',
        ErrorCode.VALIDATION_ERROR,
        { context: { endpointId: entry.endpointId, exists: !!endpoint, active: endpoint?.isActive } }
      );
    }

    // Acknowledge original entry
    entry.isAcknowledged = true;

    // Create new delivery
    const queueItem = this.enqueueDelivery(entry.event, endpoint, entry.priority);
    
    logger.info('Retrying dead letter queue entry', {
      event: 'webhook.dlq.retried',
      metadata: { dlqEntryId, eventId: entry.event.id, endpointId: entry.endpointId },
    });

    const deliveries = await this.processQueueItem(queueItem);
    return deliveries[0] || null;
  }

  /**
   * Acknowledge a dead letter queue entry
   * 
   * @param dlqEntryId - DLQ entry ID
   * @returns True if acknowledged
   */
  acknowledgeDeadLetterEntry(dlqEntryId: string): boolean {
    const entry = this.deadLetterQueue.get(dlqEntryId);
    
    if (!entry) {
      return false;
    }

    entry.isAcknowledged = true;

    logger.info('Dead letter entry acknowledged', {
      event: 'webhook.dlq.acknowledged',
      metadata: { dlqEntryId },
    });

    return true;
  }

  /**
   * Clear acknowledged entries from DLQ
   * 
   * @returns Number of entries cleared
   */
  clearAcknowledgedDeadLetters(): number {
    let cleared = 0;

    for (const [id, entry] of this.deadLetterQueue.entries()) {
      if (entry.isAcknowledged) {
        this.deadLetterQueue.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.info('Cleared acknowledged dead letter entries', {
        event: 'webhook.dlq.cleared',
        metadata: { cleared },
      });
    }

    this.updateQueueStats();
    return cleared;
  }

  // ============== Idempotency Handling ==============

  /**
   * Check if an event has already been processed
   * 
   * @param eventId - Event ID to check
   * @returns True if already processed
   */
  isDuplicateEvent(eventId: string): boolean {
    const processedAt = this.processedEvents.get(eventId);
    
    if (!processedAt) {
      return false;
    }

    // Check if within idempotency window
    const age = Date.now() - processedAt;
    return age < this.config.idempotencyWindowMs;
  }

  /**
   * Mark an event as processed
   * 
   * @param eventId - Event ID to mark
   */
  markEventAsProcessed(eventId: string): void {
    this.processedEvents.set(eventId, Date.now());
  }

  /**
   * Clean up expired idempotency entries
   * 
   * @private
   */
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

  /**
   * Get current service statistics
   * 
   * @returns Current statistics snapshot
   */
  getStatistics(): WebhookStatistics {
    return { ...this.stats };
  }

  /**
   * Get delivery history for an event
   * 
   * @param eventId - Event ID
   * @returns Delivery records
   */
  getDeliveriesForEvent(eventId: string): WebhookDelivery[] {
    return Array.from(this.deliveries.values())
      .filter(d => d.event.id === eventId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get delivery history for an endpoint
   * 
   * @param endpointId - Endpoint ID
   * @param options - Filter options
   * @returns Delivery records
   */
  getDeliveriesForEndpoint(
    endpointId: string,
    options?: { status?: DeliveryStatus; limit?: number }
  ): WebhookDelivery[] {
    let deliveries = Array.from(this.deliveries.values())
      .filter(d => d.endpointId === endpointId);

    if (options?.status) {
      deliveries = deliveries.filter(d => d.status === options.status);
    }

    // Sort by most recent first
    deliveries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (options?.limit) {
      deliveries = deliveries.slice(0, options.limit);
    }

    return deliveries;
  }

  /**
   * Update endpoint statistics counters
   * @private
   */
  private updateEndpointStats(): void {
    const endpoints = Array.from(this.endpoints.values());
    this.stats.activeEndpoints = endpoints.filter(ep => ep.isActive).length;
    this.stats.disabledEndpoints = endpoints.filter(ep => !ep.isActive).length;
    this.stats.totalEndpoints = endpoints.length;
  }

  /**
   * Update queue statistics counters
   * @private
   */
  private updateQueueStats(): void {
    this.stats.queueSize = this.deliveryQueue.length;
    this.stats.deadLetterQueueSize = this.deadLetterQueue.size;

    // Calculate oldest queued item age
    if (this.deliveryQueue.length > 0) {
      const oldest = this.deliveryQueue.reduce((oldest, item) =>
        item.queuedAt < oldest.queuedAt ? item : oldest
      );
      this.stats.oldestQueuedItemAgeMs = Date.now() - oldest.queuedAt.getTime();
    } else {
      this.stats.oldestQueuedItemAgeMs = 0;
    }
  }

  /**
   * Update running average delivery time
   * @private
   */
  private updateAverageDeliveryTime(newDurationMs: number): void {
    const total = this.stats.totalDeliveriesSucceeded;
    const currentAvg = this.stats.averageDeliveryTimeMs;
    
    // Running average calculation
    this.stats.averageDeliveryTimeMs = currentAvg + (newDurationMs - currentAvg) / total;
  }

  // ============== Maintenance & Cleanup ==============

  /**
   * Perform periodic cleanup tasks
   * @private
   */
  private performCleanup(): void {
    const results = {
      idempotencyCleaned: this.cleanupIdempotencyEntries(),
      oldDeliveriesCleaned: this.cleanupOldDeliveries(),
      dlqCleaned: this.cleanupAcknowledgedDLQ(),
    };

    const totalCleaned = Object.values(results).reduce((sum, val) => sum + val, 0);

    if (totalCleaned > 0) {
      logger.debug('Webhook cleanup completed', {
        event: 'webhook.cleanup.completed',
        metadata: results,
      });
    }
  }

  /**
   * Clean up old completed/failed deliveries
   * @private
   */
  private cleanupOldDeliveries(): number {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;

    for (const [id, delivery] of this.deliveries.entries()) {
      if (
        (delivery.status === 'delivered' || delivery.status === 'failed' || delivery.status === 'dead_lettered') &&
        delivery.updatedAt.getTime() < cutoff
      ) {
        this.deliveries.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Clean up acknowledged DLQ entries
   * @private
   */
  private cleanupAcknowledgedDLQ(): number {
    return this.clearAcknowledgedDeadLetters();
  }

  /**
   * Manually trigger cleanup
   * 
   * @returns Cleanup results
   */
  triggerCleanup(): {
    idempotencyCleaned: number;
    oldDeliveriesCleaned: number;
    dlqCleaned: number;
  } {
    return {
      idempotencyCleaned: this.cleanupIdempotencyEntries(),
      oldDeliveriesCleaned: this.cleanupOldDeliveries(),
      dlqCleaned: this.cleanupAcknowledgedDLQ(),
    };
  }

  /**
   * Destroy the service instance and release resources
   */
  destroy(): void {
    // Stop cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Clear all stores
    this.endpoints.clear();
    this.subscriptions.clear();
    this.deliveries.clear();
    this.deliveryQueue = [];
    this.deadLetterQueue.clear();
    this.processedEvents.clear();

    // Reset stats
    this.stats = this.initializeStatistics();

    logger.info('WebhookProcessingService destroyed', {
      event: 'webhook.service.destroyed',
    });
  }

  // ============== Health Check ==============

  /**
   * Perform health check on the service
   * 
   * @returns Health status information
   */
  healthCheck(): {
    healthy: boolean;
    issues: string[];
    stats: Partial<WebhookStatistics>;
  } {
    const issues: string[] = [];

    // Check queue health
    if (this.deliveryQueue.length > this.config.maxQueueSize * 0.9) {
      issues.push(`Queue at ${Math.round(this.deliveryQueue.length / this.config.maxQueueSize * 100)}% capacity`);
    }

    // Check DLQ health
    if (this.deadLetterQueue.size > this.config.maxDeadLetterQueueSize * 0.9) {
      issues.push(`Dead letter queue at ${Math.round(this.deadLetterQueue.size / this.config.maxDeadLetterQueueSize * 100)}% capacity`);
    }

    // Check for unhealthy endpoints
    const unhealthyEndpoints = Array.from(this.endpoints.values())
      .filter(ep => ep.consecutiveFailures >= 10);
    
    if (unhealthyEndpoints.length > 0) {
      issues.push(`${unhealthyEndpoints.length} endpoint(s) with high failure count`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats: {
        queueSize: this.stats.queueSize,
        deadLetterQueueSize: this.stats.deadLetterQueueSize,
        activeEndpoints: this.stats.activeEndpoints,
        totalDeliveriesSucceeded: this.stats.totalDeliveriesSucceeded,
        totalDeliveriesFailed: this.stats.totalDeliveriesFailed,
      },
    };
  }
}

// ============== Utility Functions ==============

/**
 * Array.every polyfill-like function for filters
 * @private
 */
function every<T>(predicate: (item: T) => boolean, items: T[]): boolean {
  return items.every(predicate);
}

// ============== Predefined Event Types Export ==============

/**
 * Predefined SSM-Pay event types
 */
export const WebhookEventTypes = {
  // Payment Events
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
  PAYMENT_PARTIAL_REFUND: 'payment.partial_refund',
  PAYMENT_EXPIRED: 'payment.expired',

  // Transaction Events
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_UPDATED: 'transaction.updated',
  TRANSACTION_VERIFIED: 'transaction.verified',
  TRANSACTION_RECONCILED: 'transaction.reconciled',
  TRANSACTION_FLAGGED: 'transaction.flagged',

  // Zainbox Events
  ZAINBOX_CREATED: 'zainbox.created',
  ZAINBOX_UPDATED: 'zainbox.updated',
  ZAINBOX_DEACTIVATED: 'zainbox.deactivated',

  // Account Events
  ACCOUNT_CREATED: 'account.created',
  ACCOUNT_VERIFIED: 'account.verified',
  ACCOUNT_SUSPENDED: 'account.suspended',

  // Fraud & Risk Events
  FRAUD_DETECTED: 'fraud.detected',
  FRAUD_REVIEW_REQUIRED: 'fraud.review_required',
  FRAUD_CONFIRMED: 'fraud.confirmed',
  FRAUD_DISMISSED: 'fraud.dismissed',

  // System Events
  SYSTEM_HEALTH_CHECK: 'system.health_check',
  SYSTEM_RATE_LIMIT_EXCEEDED: 'system.rate_limit_exceeded',
  SYSTEM_ERROR: 'system.error',

  // Webhook Events
  WEBHOOK_DELIVERY_FAILED: 'webhook.delivery_failed',
  WEBHOOK_ENDPOINT_DISABLED: 'webhook.endpoint_disabled',
} as const;

// ============== Singleton Instance ==============

/** Default webhook processing service instance */
export const webhookProcessingService = new WebhookProcessingService();

// ============== Exports ==============

export default WebhookProcessingService;
