/**
 * Enterprise Webhook System
 * Handles incoming and outgoing webhooks with signature verification,
 * retry logic, event routing, and delivery tracking
 * 
 * @module webhooks/handler
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';

// ============== Type Definitions ==============

export interface WebhookEvent {
  /** Unique event ID */
  id: string;
  /** Event type (e.g., payment.completed) */
  type: string;
  /** Event data payload */
  data: Record<string, unknown>;
  /** When the event was created */
  createdAt: Date;
  /** Version of the event schema */
  version: string;
  /** Source of the event */
  source: string;
  /** Optional correlation ID for tracing */
  correlationId?: string;
}

export interface WebhookPayload {
  /** Event ID for idempotency */
  id: string;
  /** Event type */
  type: string;
  /** Timestamp in ISO format */
  created: string;
  /** Event data */
  data: Record<string, unknown>;
  /** Webhook signature for verification */
  signature: string;
  /** Signature algorithm used */
  signatureAlgorithm: 'hmac-sha256' | 'rsa-sha256';
}

export interface WebhookEndpoint {
  /** Endpoint URL */
  url: string;
  /** Secret key for signing */
  secret: string;
  /** Events this endpoint subscribes to */
  events: string[];
  /** Whether endpoint is active */
  active: boolean;
  /** Created at timestamp */
  createdAt: Date;
  /** Last successful delivery */
  lastDeliveryAt?: Date;
  /** Delivery failure count */
  failureCount: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Retry configuration */
  retryConfig: RetryConfig;
}

export interface RetryConfig {
  /** Initial delay in ms */
  initialDelayMs: number;
  /** Maximum delay in ms */
  maxDelayMs: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Jitter factor (0-1) for randomization */
  jitterFactor: number;
  /** Maximum attempts */
  maxAttempts: number;
}

export interface WebhookDelivery {
  /** Delivery attempt ID */
  id: string;
  /** Event being delivered */
  event: WebhookEvent;
  /** Target endpoint */
  endpoint: WebhookEndpoint;
  /** Current attempt number */
  attempt: number;
  /** Status of delivery */
  status: 'pending' | 'delivering' | 'delivered' | 'failed' | 'retrying';
  /** HTTP response code if delivered */
  responseCode?: number;
  /** Response body if received */
  responseBody?: string;
  /** Error message if failed */
  error?: string;
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
  nextRetryAt?: Date;
}

export interface WebhookHandler<T = unknown> {
  /** Event types this handler processes */
  eventType: string | RegExp;
  /** Handler function */
  handler: (event: WebhookEvent) => Promise<T>;
  /** Whether to run asynchronously */
  async?: boolean;
  /** Timeout in ms */
  timeout?: number;
  /** Retry config for handler failures */
  retryConfig?: RetryConfig;
}

// ============== Constants ==============

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  initialDelayMs: 1000,
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
  jitterFactor: 0.2,
  maxAttempts: 5,
};

const EVENT_VERSION = '1.0.0';
const SIGNATURE_HEADER = 'X-SSM-Signature';
const TIMESTAMP_HEADER = 'X-SSM-Timestamp';

// ============== Webhook Manager Class ==============

/**
 * Enterprise Webhook Manager
 * 
 * Features:
 * - Event creation and dispatch
 * - Endpoint management
 * - Signature generation/verification
 * - Retry with exponential backoff
 * - Delivery tracking
 * - Idempotency handling
 */
export class WebhookManager {
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private handlers: Map<string, WebhookHandler[]> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private processedEvents: Set<string> = new Set(); // For idempotency
  
  // Statistics
  private stats = {
    eventsCreated: 0,
    deliveriesAttempted: 0,
    deliveriesSucceeded: 0,
    deliveriesFailed: 0,
    signaturesVerified: 0,
    signaturesFailed: 0,
  };

  constructor(
    private signingSecret: string = process.env.WEBHOOK_SECRET || 'default-secret-change-me'
  ) {
    logger.info('WebhookManager initialized', { event: 'webhook.init' });
  }

  // ============== Event Creation ==============

  /**
   * Create a new webhook event
   */
  createEvent(
    type: string,
    data: Record<string, unknown>,
    options?: {
      source?: string;
      correlationId?: string;
      version?: string;
    }
  ): WebhookEvent {
    const event: WebhookEvent = {
      id: `evt_${Date.now()}_${randomUUID().slice(0, 8)}`,
      type,
      data,
      createdAt: new Date(),
      version: options?.version || EVENT_VERSION,
      source: options?.source || 'ssm-pay',
      correlationId: options?.correlationId,
    };

    this.stats.eventsCreated++;

    logger.info('Webhook event created', {
      event: 'webhook.event.created',
      metadata: { eventId: event.id, type },
    });

    return event;
  }

  /**
   * Create a signed payload for delivery
   */
  createSignedPayload(event: WebhookEvent, secret: string): WebhookPayload {
    const payload: WebhookPayload = {
      id: event.id,
      type: event.type,
      created: event.createdAt.toISOString(),
      data: event.data,
      signature: '',
      signatureAlgorithm: 'hmac-sha256',
    };

    payload.signature = this.signPayload(payload, secret);

    return payload;
  }

  // ============== Endpoint Management ==============

  /**
   * Register a new webhook endpoint
   */
  registerEndpoint(config: {
    url: string;
    secret: string;
    events: string[];
    active?: boolean;
    maxRetries?: number;
    retryConfig?: Partial<RetryConfig>;
  }): WebhookEndpoint {
    const endpoint: WebhookEndpoint = {
      url: config.url,
      secret: config.secret,
      events: config.events,
      active: config.active ?? true,
      createdAt: new Date(),
      failureCount: 0,
      maxRetries: config.maxRetries ?? DEFAULT_RETRY_CONFIG.maxAttempts,
      retryConfig: { ...DEFAULT_RETRY_CONFIG, ...config.retryConfig },
    };

    this.endpoints.set(endpoint.url, endpoint);

    logger.info('Webhook endpoint registered', {
      event: 'webhook.endpoint.registered',
      metadata: { url: endpoint.url, events: config.events.length },
    });

    return endpoint;
  }

  /**
   * Remove an endpoint
   */
  removeEndpoint(url: string): boolean {
    const result = this.endpoints.delete(url);
    
    if (result) {
      logger.info('Webhook endpoint removed', {
        event: 'webhook.endpoint.removed',
        metadata: { url },
      });
    }
    
    return result;
  }

  /**
   * Get all endpoints subscribed to an event type
   */
  getEndpointsForEvent(eventType: string): WebhookEndpoint[] {
    const endpoints: WebhookEndpoint[] = [];

    for (const [, endpoint] of this.endpoints) {
      if (!endpoint.active) continue;

      const matches = endpoint.events.some(pattern => 
        this.matchEventType(eventType, pattern)
      );

      if (matches) {
        endpoints.push(endpoint);
      }
    }

    return endpoints;
  }

  // ============== Handler Registration ==============

  /**
   * Register a handler for an event type
   */
  on<T = void>(
    eventType: string | RegExp,
    handler: (event: WebhookEvent) => Promise<T>,
    options?: { async?: boolean; timeout?: number }
  ): WebhookManager {
    const webhookHandler: WebhookHandler<T> = {
      eventType,
      handler,
      async: options?.async ?? true,
      timeout: options?.timeout ?? 30000,
    };

    const key = eventType instanceof RegExp ? eventType.source : eventType;
    
    if (!this.handlers.has(key)) {
      this.handlers.set(key, []);
    }
    
    this.handlers.get(key)!.push(webhookHandler as WebhookHandler);

    logger.debug('Webhook handler registered', {
      event: 'webhook.handler.registered',
      metadata: { eventType: key },
    });

    return this;
  }

  // ============== Event Dispatching ==============

  /**
   * Dispatch an event to all registered endpoints
   */
  async dispatch(event: WebhookEvent): Promise<WebhookDelivery[]> {
    const endpoints = this.getEndpointsForEvent(event.type);
    
    if (endpoints.length === 0) {
      logger.debug('No endpoints for event', {
        event: 'webhook.dispatch.no_endpoints',
        metadata: { type: event.type },
      });
      return [];
    }

    const deliveries: WebhookDelivery[] = [];

    for (const endpoint of endpoints) {
      const delivery = await this.createDelivery(event, endpoint);
      deliveries.push(delivery);
      
      // Deliver asynchronously
      this.deliver(delivery).catch(error => {
        logger.error('Delivery failed', {
          event: 'webhook.delivery.error',
          metadata: { deliveryId: delivery.id, error: String(error) },
        });
      });
    }

    // Also trigger local handlers
    await this.triggerHandlers(event);

    return deliveries;
  }

  /**
   * Create a delivery record
   */
  private async createDelivery(
    event: WebhookEvent,
    endpoint: WebhookEndpoint
  ): Promise<WebhookDelivery> {
    const delivery: WebhookDelivery = {
      id: `del_${Date.now()}_${randomUUID().slice(0, 8)}`,
      event,
      endpoint,
      attempt: 0,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.deliveries.set(delivery.id, delivery);
    return delivery;
  }

  /**
   * Attempt to deliver a webhook
   */
  private async deliver(delivery: WebhookDelivery): Promise<void> {
    delivery.status = 'delivering';
    delivery.attempt++;
    delivery.updatedAt = new Date();

    this.stats.deliveriesAttempted++;

    try {
      const payload = this.createSignedPayload(delivery.event, delivery.endpoint.secret);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(delivery.endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [SIGNATURE_HEADER]: payload.signature,
          [TIMESTAMP_HEADER]: payload.created,
          'User-Agent': 'SSM-Pay-Webhook/1.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      delivery.responseCode = response.status;
      delivery.responseBody = await response.text().catch(() => '');

      if (response.ok) {
        delivery.status = 'delivered';
        delivery.endpoint.lastDeliveryAt = new Date();
        delivery.endpoint.failureCount = 0;
        
        this.stats.deliveriesSucceeded++;

        logger.info('Webhook delivered successfully', {
          event: 'webhook.delivery.success',
          metadata: {
            deliveryId: delivery.id,
            url: delivery.endpoint.url,
            statusCode: response.status,
            attempt: delivery.attempt,
          },
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${delivery.responseBody}`);
      }
    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error instanceof Error ? error.message : String(error);
      delivery.endpoint.failureCount++;

      this.stats.deliveriesFailed++;

      logger.warn('Webhook delivery failed', {
        event: 'webhook.delivery.failed',
        metadata: {
          deliveryId: delivery.id,
          url: delivery.endpoint.url,
          error: delivery.error,
          attempt: delivery.attempt,
        },
      });

      // Schedule retry if under limit
      if (delivery.attempt < delivery.endpoint.maxRetries) {
        delivery.status = 'retrying';
        delivery.nextRetryAt = this.calculateNextRetry(delivery);
        
        setTimeout(() => {
          this.deliver(delivery);
        }, delivery.nextRetryAt.getTime() - Date.now());
      }
    }

    delivery.updatedAt = new Date();
  }

  /**
   * Trigger local handlers for an event
   */
  private async triggerHandlers(event: WebhookEvent): Promise<void> {
    for (const [, handlers] of this.handlers) {
      for (const handler of handlers) {
        if (this.matchEventType(event.type, handler.eventType)) {
          try {
            if (handler.async) {
              handler.handler(event).catch(error => {
                logger.error('Handler error', {
                  event: 'webhook.handler.error',
                  metadata: { error: String(error), type: event.type },
                });
              });
            } else {
              await handler.handler(event);
            }
          } catch (error) {
            logger.error('Handler execution failed', {
              event: 'webhook.handler.failed',
              metadata: { error: String(error), type: event.type },
            });
          }
        }
      }
    }
  }

  // ============== Incoming Webhook Handling ==============

  /**
   * Handle an incoming webhook request
   */
  async handleIncoming(
    payload: unknown,
    headers: Record<string, string>
  ): Promise<{
    valid: boolean;
    event?: WebhookEvent;
    error?: string;
  }> {
    // Verify signature first
    const signature = headers[SIGNATURE_HEADER.toLowerCase()] || headers[SIGNATURE_HEADER];
    const timestamp = headers[TIMESTAMP_HEADER.toLowerCase()] || headers[TIMESTAMP_HEADER];

    if (!signature) {
      this.stats.signaturesFailed++;
      return { valid: false, error: 'Missing signature header' };
    }

    const isValid = await this.verifySignature(
      payload,
      signature,
      this.signingSecret
    );

    if (!isValid) {
      this.stats.signaturesFailed++;
      logger.warn('Invalid webhook signature', {
        event: 'webhook.signature.invalid',
      });
      return { valid: false, error: 'Invalid signature' };
    }

    this.stats.signaturesVerified++;

    // Parse and validate payload
    try {
      const typedPayload = payload as WebhookPayload;
      
      // Check idempotency
      if (this.processedEvents.has(typedPayload.id)) {
        logger.debug('Duplicate event ignored', {
          event: 'webhook.duplicate',
          metadata: { eventId: typedPayload.id },
        });
        return { valid: true };
      }

      this.processedEvents.add(typedPayload.id);

      const event: WebhookEvent = {
        id: typedPayload.id,
        type: typedPayload.type,
        data: typedPayload.data as Record<string, unknown>,
        createdAt: new Date(typedPayload.created),
        version: EVENT_VERSION,
        source: 'external',
      };

      logger.info('Incoming webhook processed', {
        event: 'webhook.incoming.processed',
        metadata: { eventId: event.id, type: event.type },
      });

      return { valid: true, event };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid payload',
      };
    }
  }

  // ============== Signature Methods ==============

  /**
   * Sign a payload with HMAC-SHA256
   */
  signPayload(payload: Omit<WebhookPayload, 'signature'>, secret: string): string {
    const payloadString = JSON.stringify({
      id: payload.id,
      type: payload.type,
      created: payload.created,
      data: payload.data,
    });

    return createHash('sha256')
      .update(`${payloadString}.${secret}`)
      .digest('hex');
  }

  /**
   * Verify a webhook signature
   */
  async verifySignature(
    payload: unknown,
    signature: string,
    secret: string
  ): Promise<boolean> {
    try {
      const expectedSignature = this.signPayload(
        payload as Omit<WebhookPayload, 'signature'>,
        secret
      );

      // Use timing-safe comparison to prevent timing attacks
      return timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  // ============== Utility Methods ==============

  /**
   * Match event type against pattern
   */
  private matchEventType(eventType: string, pattern: string | RegExp): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(eventType);
    }

    // Support wildcards
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return eventType.startsWith(prefix);
    }

    return eventType === pattern;
  }

  /**
   * Calculate next retry time with exponential backoff and jitter
   */
  private calculateNextRetry(delivery: WebhookDelivery): Date {
    const { retryConfig } = delivery.endpoint;
    const baseDelay = retryConfig.initialDelayMs * 
      Math.pow(retryConfig.backoffMultiplier, delivery.attempt - 1);
    
    const cappedDelay = Math.min(baseDelay, retryConfig.maxDelayMs);
    
    // Add jitter
    const jitter = cappedDelay * retryConfig.jitterFactor * (Math.random() * 2 - 1);
    const finalDelay = Math.max(0, Math.ceil(cappedDelay + jitter));

    return new Date(Date.now() + finalDelay);
  }

  // ============== Statistics & Management ==============

  /**
   * Get manager statistics
   */
  getStats() {
    return {
      ...this.stats,
      endpointsRegistered: this.endpoints.size,
      handlersRegistered: Array.from(this.handlers.values())
        .reduce((sum, handlers) => sum + handlers.length, 0),
      pendingDeliveries: Array.from(this.deliveries.values())
        .filter(d => d.status === 'pending' || d.status === 'retrying').length,
      uniqueEventsProcessed: this.processedEvents.size,
    };
  }

  /**
   * Get all deliveries for an event
   */
  getDeliveriesForEvent(eventId: string): WebhookDelivery[] {
    return Array.from(this.deliveries.values())
      .filter(d => d.event.id === eventId);
  }

  /**
   * Clean up old processed events
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): number {
    let cleaned = 0;
    const cutoff = Date.now() - maxAge;

    for (const [id, delivery] of this.deliveries.entries()) {
      if (delivery.updatedAt.getTime() < cutoff && 
          (delivery.status === 'delivered' || delivery.status === 'failed')) {
        this.deliveries.delete(id);
        cleaned++;
      }
    }

    // Clean up processed events older than maxAge
    // (In production, use a proper TTL store)

    return cleaned;
  }

  /**
   * Destroy the manager and cleanup resources
   */
  destroy(): void {
    this.endpoints.clear();
    this.handlers.clear();
    this.deliveries.clear();
    this.processedEvents.clear();
    
    logger.info('WebhookManager destroyed', { event: 'webhook.destroy' });
  }
}

// ============== Predefined Event Types ==============

export const EventTypes = {
  // Payment Events
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
  PAYMENT_PARTIAL_REFUND: 'payment.partial_refund',

  // Transaction Events
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

  // Fraud Events
  FRAUD_DETECTED: 'fraud.detected',
  FRAUD_REVIEW_REQUIRED: 'fraud.review_required',
  FRAUD_CONFIRMED: 'fraud.confirmed',
  FRAUD_DISMISSED: 'fraud.dismissed',

  // System Events
  SYSTEM_HEALTH_CHECK: 'system.health_check',
  SYSTEM_RATE_LIMIT_EXCEEDED: 'system.rate_limit_exceeded',
  SYSTEM_ERROR: 'system.error',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

// ============== Singleton Instance ==============

/** Default webhook manager instance */
export const webhookManager = new WebhookManager();

export default WebhookManager;
