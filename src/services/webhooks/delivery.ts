/**
 * Webhook Delivery Service
 * Handles delivery of webhooks to subscriber endpoints with retry logic
 */

import {
  WebhookEvent,
  WebhookSubscription,
  DeliveryAttempt,
  DeliveryStatus,
  WebhookQueueItem,
  DeadLetterEntry,
  RetryPolicy,
  DEFAULT_RETRY_POLICY,
} from './types';
import { signPayload, constructSignatureHeader } from './signature';

/** HTTP delivery options */
interface DeliveryOptions {
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Whether to follow redirects */
  followRedirects: boolean;
  /** User agent string */
  userAgent: string;
}

/** Default delivery options */
const DEFAULT_DELIVERY_OPTIONS: DeliveryOptions = {
  timeoutMs: 30000,
  followRedirects: false,
  userAgent: 'SSM-Pay-Webhook/1.0',
};

/** Delivery result from an attempt */
export interface DeliveryResult {
  /** The attempt record */
  attempt: DeliveryAttempt;
  /** Whether delivery should be retried */
  shouldRetry: boolean;
  /** Delay before next retry in milliseconds (if applicable) */
  retryDelayMs: number;
  /** Dead letter entry if max retries exhausted */
  deadLetterEntry?: DeadLetterEntry;
}

/**
 * WebhookDelivery class manages HTTP delivery of events to endpoints
 */
export class WebhookDelivery {
  private options: DeliveryOptions;
  private retryPolicy: RetryPolicy;

  constructor(
    options: Partial<DeliveryOptions> = {},
    retryPolicy: Partial<RetryPolicy> = {}
  ) {
    this.options = { ...DEFAULT_DELIVERY_OPTIONS, ...options };
    this.retryPolicy = { ...DEFAULT_RETRY_POLICY, ...retryPolicy };
  }

  /**
   * Deliver a webhook event to a subscription endpoint
   * @param event - The event to deliver
   * @param subscription - Target subscription
   * @param attemptNumber - Current attempt number
   * @returns Promise resolving to delivery result
   */
  async deliver(
    event: WebhookEvent,
    subscription: WebhookSubscription,
    attemptNumber: number = 1
  ): Promise<DeliveryResult> {
    const startTime = Date.now();
    const attemptId = this.generateAttemptId();

    try {
      // Sign the payload
      const { signature } = signPayload(event, subscription.secret);
      const payload = JSON.stringify(event);

      // Build request headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': this.options.userAgent,
        'X-Webhook-Signature': signature.signature,
        'X-Webhook-Timestamp': String(signature.timestamp),
        'X-Webhook-Id': event.id,
        'X-Webhook-Event-Type': event.type,
        ...subscription.headers,
      };

      // Execute HTTP delivery (simulated)
      const response = await this.executeHttpRequest(
        subscription.url,
        payload,
        headers,
        subscription.httpMethod
      );

      const durationMs = Date.now() - startTime;
      const status = this.determineStatus(response.statusCode);

      const attempt: DeliveryAttempt = {
        id: attemptId,
        eventId: event.id,
        endpointUrl: subscription.url,
        status,
        statusCode: response.statusCode,
        responseBody: response.body,
        attemptedAt: new Date().toISOString(),
        durationMs,
        attemptNumber,
      };

      // Determine if retry is needed
      if (status === DeliveryStatus.SUCCEEDED || status === DeliveryStatus.DELIVERED) {
        return {
          attempt,
          shouldRetry: false,
          retryDelayMs: 0,
        };
      }

      return this.handleFailure(event, subscription, attempt, attemptNumber);

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const attempt: DeliveryAttempt = {
        id: attemptId,
        eventId: event.id,
        endpointUrl: subscription.url,
        status: DeliveryStatus.FAILED,
        errorMessage,
        attemptedAt: new Date().toISOString(),
        durationMs,
        attemptNumber,
      };

      return this.handleFailure(event, subscription, attempt, attemptNumber);
    }
  }

  /**
   * Handle failed delivery and determine retry strategy
   */
  private handleFailure(
    event: WebhookEvent,
    subscription: WebhookSubscription,
    attempt: DeliveryAttempt,
    attemptNumber: number
  ): DeliveryResult {
    const effectivePolicy = { ...this.retryPolicy, ...subscription.retryPolicy };

    if (attemptNumber >= effectivePolicy.maxRetries) {
      // Max retries exceeded - create dead letter entry
      const deadLetterEntry: DeadLetterEntry = {
        id: this.generateDeadLetterId(),
        originalItem: {
          id: `queue-${event.id}`,
          event,
          subscription,
          priority: 0,
          enqueuedAt: new Date().toISOString(),
          retryCount: attemptNumber,
          nextAttemptAt: new Date().toISOString(),
          attempts: [attempt],
        },
        failureReason: attempt.errorMessage || `HTTP ${attempt.statusCode}`,
        totalAttempts: attemptNumber,
        deadLetteredAt: new Date().toISOString(),
        replayed: false,
      };

      return {
        attempt: { ...attempt, status: DeliveryStatus.EXPIRED },
        shouldRetry: false,
        retryDelayMs: 0,
        deadLetterEntry,
      };
    }

    // Calculate retry delay with exponential backoff
    const delayMs = this.calculateRetryDelay(attemptNumber, effectivePolicy);

    return {
      attempt: { ...attempt, status: DeliveryStatus.RETRYING },
      shouldRetry: true,
      retryDelayMs: delayMs,
    };
  }

  /**
   * Calculate retry delay using exponential backoff with optional jitter
   */
  calculateRetryDelay(
    attemptNumber: number,
    policy: RetryPolicy = this.retryPolicy
  ): number {
    const delay = Math.min(
      policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attemptNumber - 1),
      policy.maxDelayMs
    );

    if (policy.jitterEnabled) {
      // Add random jitter (±25% of delay)
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      return Math.max(0, Math.floor(delay + jitter));
    }

    return Math.floor(delay);
  }

  /**
   * Determine delivery status from HTTP status code
   */
  private determineStatus(statusCode: number): DeliveryStatus {
    if (statusCode >= 200 && statusCode < 300) {
      return statusCode === 200 ? DeliveryStatus.DELIVERED : DeliveryStatus.SUCCEEDED;
    }
    if (statusCode === 429 || statusCode >= 500) {
      return DeliveryStatus.FAILED; // Retryable
    }
    return DeliveryStatus.FAILED; // Non-retryable client errors
  }

  /**
   * Execute HTTP request to deliver webhook (simulation)
   */
  private async executeHttpRequest(
    url: string,
    body: string,
    headers: Record<string, string>,
    method: string
  ): Promise<{ statusCode: number; body?: string }> {
    // In production, this would use fetch or a HTTP library
    // For now, simulate successful delivery
    console.log(`[Webhook] ${method} ${url}`, {
      headers: Object.keys(headers),
      bodyLength: body.length,
    });

    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

    // Simulate occasional failures (10% chance for demo)
    if (Math.random() < 0.1) {
      return { statusCode: 500, body: 'Internal Server Error' };
    }

    return { statusCode: 200, body: '{"received": true}' };
  }

  /**
   * Generate unique attempt ID
   */
  private generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Generate unique dead letter entry ID
   */
  private generateDeadLetterId(): string {
    return `dl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Create a queue item from event and subscription
   */
  createQueueItem(
    event: WebhookEvent,
    subscription: WebhookSubscription,
    priority: number = 0
  ): WebhookQueueItem {
    return {
      id: `queue_${event.id}_${subscription.id}`,
      event,
      subscription,
      priority,
      enqueuedAt: new Date().toISOString(),
      retryCount: 0,
      nextAttemptAt: new Date().toISOString(),
      attempts: [],
    };
  }

  /**
   * Get current retry policy
   */
  getRetryPolicy(): RetryPolicy {
    return { ...this.retryPolicy };
  }

  /**
   * Update retry policy configuration
   */
  updateRetryPolicy(updates: Partial<RetryPolicy>): void {
    this.retryPolicy = { ...this.retryPolicy, ...updates };
  }
}
