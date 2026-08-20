/**
 * Webhook Delivery Execution Module
 * 
 * Handles HTTP delivery of webhooks to endpoints including:
 * - Request preparation and signing
 * - HTTP execution with timeout
 * - Response handling and status tracking
 * - Retry scheduling with exponential backoff
 * 
 * @module services/webhooks/delivery
 */

import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import { WebhookSignatureHandler, WEBHOOK_HEADERS, IncomingWebhookPayload } from './signature';

// ============== Type Definitions ==============

/**
 * Webhook event payload structure
 */
export interface WebhookEvent {
  /** Unique identifier for the event */
  id: string;
  /** Event type classification */
  type: import('./signature').WebhookEventType;
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

// ============== Default Configuration ==============

/** Default retry configuration */
export const DEFAULT_RETRY_CONFIG: Required<RetryConfiguration> = {
  initialDelayMs: 1000,
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
  jitterFactor: 0.2,
  maxAttempts: 5,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

// ============== Delivery Executor Class ==============

/**
 * Webhook Delivery Executor
 * 
 * Handles the actual HTTP delivery of webhooks to endpoints.
 */
export class WebhookDeliveryExecutor {
  private signatureHandler: WebhookSignatureHandler;

  constructor(signatureHandler?: WebhookSignatureHandler) {
    this.signatureHandler = signatureHandler ?? new WebhookSignatureHandler();
  }

  /**
   * Execute actual HTTP delivery to endpoint
   * 
   * @param event - Event to deliver
   * @param endpoint - Target endpoint
   * @param existingDelivery - Existing delivery record (for retries)
   * @returns Delivery record with status
   */
  async executeDelivery(
    event: WebhookEvent,
    endpoint: WebhookEndpoint,
    existingDelivery?: WebhookDelivery
  ): Promise<WebhookDelivery> {
    const deliveryId = existingDelivery?.id || `del_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const startTime = Date.now();

    // Get or create delivery record
    const delivery: WebhookDelivery = existingDelivery || {
      id: deliveryId,
      event,
      endpointId: endpoint.id,
      status: 'processing',
      attemptNumber: 1,
      maxAttempts: endpoint.maxRetries,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!existingDelivery) {
      delivery.attemptNumber = 1;
    } else {
      delivery.attemptNumber++;
    }
    
    delivery.updatedAt = new Date();
    delivery.status = 'processing';

    // Track statistics
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
      const signature = this.signatureHandler.generateSignature(payload, endpoint.secret);
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
        return this.handleSuccessResponse(delivery, endpoint, durationMs);
      } else if (endpoint.retryConfig.retryableStatusCodes.includes(response.status)) {
        // Retryable error
        throw new AppError(
          `HTTP ${response.status}: ${delivery.responseBody}`,
          ErrorCode.API_RESPONSE_ERROR,
          { context: { statusCode: response.status, endpointUrl: endpoint.url } }
        );
      } else {
        // Non-retryable error
        return this.handleNonRetryableError(delivery, endpoint, response.status);
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      delivery.durationMs = durationMs;
      delivery.errorMessage = error instanceof Error ? error.message : String(error);
      delivery.errorCode = error instanceof AppError ? error.code : 'UNKNOWN';

      // Update endpoint failure tracking
      endpoint.consecutiveFailures++;
      endpoint.lastFailureAt = new Date();

      // Determine if we should retry
      if (delivery.attemptNumber < delivery.maxAttempts) {
        delivery.status = 'retrying';
        delivery.nextRetryAt = this.calculateRetryTime(delivery, endpoint);

        logger.warn('Scheduling webhook retry', {
          event: 'webhook.delivery.retry_scheduled',
          metadata: {
            deliveryId,
            endpointId: endpoint.id,
            attempt: delivery.attemptNumber,
            nextRetry: delivery.nextRetryAt?.toISOString(),
          },
        });

        return delivery;
      }

      // Max retries exceeded
      delivery.status = 'failed';

      logger.error('Webhook delivery failed permanently', {
        event: 'webhook.delivery.failed_permanently',
        metadata: {
          deliveryId,
          endpointId: endpoint.id,
          totalAttempts: delivery.attemptNumber,
          lastError: delivery.errorMessage,
        },
      });

      return delivery;
    }
  }

  /**
   * Handle successful delivery response
   */
  private handleSuccessResponse(
    delivery: WebhookDelivery,
    endpoint: WebhookEndpoint,
    durationMs: number
  ): WebhookDelivery {
    delivery.status = 'delivered';
    delivery.deliveredAt = new Date();
    endpoint.lastSuccessfulDeliveryAt = new Date();
    endpoint.successfulDeliveries++;
    endpoint.consecutiveFailures = 0;

    logger.info('Webhook delivered successfully', {
      event: 'webhook.delivery.success',
      metadata: {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        eventId: delivery.event.id,
        statusCode: delivery.responseStatusCode,
        attempt: delivery.attemptNumber,
        durationMs,
      },
    });

    return delivery;
  }

  /**
   * Handle non-retryable error response
   */
  private handleNonRetryableError(
    delivery: WebhookDelivery,
    endpoint: WebhookEndpoint,
    statusCode: number
  ): WebhookDelivery {
    delivery.status = 'failed';
    delivery.errorMessage = `HTTP ${statusCode}: ${delivery.responseBody}`;

    endpoint.consecutiveFailures++;
    endpoint.lastFailureAt = new Date();

    logger.warn('Webhook delivery failed (non-retryable)', {
      event: 'webhook.delivery.failed',
      metadata: {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        statusCode: statusCode,
        attempt: delivery.attemptNumber,
      },
    });

    return delivery;
  }

  /**
   * Calculate next retry time with exponential backoff and jitter
   * 
   * @param delivery - Current delivery record
   * @param endpoint - Target endpoint
   * @returns Next retry timestamp
   */
  calculateRetryTime(
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
}
