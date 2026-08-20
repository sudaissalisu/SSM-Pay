/**
 * Webhook Types for SSM-Pay Payment Platform
 * Defines all interfaces and enums used in the webhook system
 */

/** Supported webhook event types for payment processing */
export enum WebhookEventType {
  PAYMENT_SUCCEEDED = 'payment.succeeded',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_PENDING = 'payment.pending',
  REFUND_PROCESSED = 'refund.processed',
  REFUND_FAILED = 'refund.failed',
  DISPUTE_OPENED = 'dispute.opened',
  DISPUTE_CLOSED = 'dispute.closed',
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  TRANSFER_COMPLETED = 'transfer.completed',
  TRANSFER_FAILED = 'transfer.failed',
  PAYOUT_PROCESSED = 'payout.processed',
  PAYOUT_FAILED = 'payout.failed',
  WEBHOOK_TEST = 'webhook.test',
}

/** Webhook event payload structure */
export interface WebhookEvent {
  /** Unique identifier for the event */
  id: string;
  /** Event type from WebhookEventType */
  type: WebhookEventType;
  /** ISO 8601 timestamp of when the event occurred */
  createdAt: string;
  /** The resource object this event relates to */
  data: Record<string, unknown>;
  /** Previous attributes (for update events) */
  previousAttributes?: Record<string, unknown>;
  /** API version that created this event */
  apiVersion: string;
  /** Request ID that triggered this event */
  requestId?: string;
  /** Whether this is a live or test event */
  livemode: boolean;
  /** Number of delivery attempts */
  metadata?: Record<string, string>;
}

/** Webhook signature verification data */
export interface WebhookSignature {
  /** The raw signature header value */
  signature: string;
  /** Timestamp included in the signature */
  timestamp: number;
  /** Computed HMAC-SHA256 hex digest */
  hexDigest: string;
  /** The signing secret used (masked) */
  secretId: string;
  /** Algorithm used for signing */
  algorithm: 'sha256' | 'sha512';
}

/** Delivery status for webhook attempts */
export enum DeliveryStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  RETRYING = 'retrying',
  EXPIRED = 'expired',
  DELIVERED = 'delivered',
  ACKNOWLEDGED = 'acknowledged',
}

/** Individual delivery attempt record */
export interface DeliveryAttempt {
  /** Unique attempt identifier */
  id: string;
  /** Event being delivered */
  eventId: string;
  /** Target endpoint URL */
  endpointUrl: string;
  /** Status of this attempt */
  status: DeliveryStatus;
  /** HTTP response code received */
  statusCode?: number;
  /** Response body from endpoint */
  responseBody?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Timestamp of attempt */
  attemptedAt: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Attempt number (1-based) */
  attemptNumber: number;
}

/** Webhook subscription configuration */
export interface WebhookSubscription {
  /** Unique subscription identifier */
  id: string;
  /** Endpoint URL to receive webhooks */
  url: string;
  /** List of event types to receive */
  events: WebhookEventType[];
  /** Secret key for verifying signatures */
  secret: string;
  /** Whether subscription is active */
  active: boolean;
  /** Created at timestamp */
  createdAt: string;
  /** Updated at timestamp */
  updatedAt: string;
  /** Optional description */
  description?: string;
  /** HTTP method to use (POST default) */
  httpMethod: 'POST' | 'PUT' | 'PATCH';
  /** Additional headers to include */
  headers?: Record<string, string>;
  /** Retry policy for failed deliveries */
  retryPolicy: RetryPolicy;
  /** Version of API format expected */
  apiVersion: string;
}

/** Retry policy configuration */
export interface RetryPolicy {
  /** Maximum number of retry attempts (0-10) */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Backoff multiplier (e.g., 2 for exponential) */
  backoffMultiplier: number;
  /** Maximum delay cap in milliseconds */
  maxDelayMs: number;
  /** Add jitter to prevent thundering herd */
  jitterEnabled: boolean;
  /** Whether to use dead letter queue on exhaustion */
  useDeadLetterQueue: boolean;
}

/** Queue item for pending webhook deliveries */
export interface WebhookQueueItem {
  /** Unique queue item ID */
  id: string;
  /** The event to deliver */
  event: WebhookEvent;
  /** Target subscription */
  subscription: WebhookSubscription;
  /** Priority level (lower = higher priority) */
  priority: number;
  /** Enqueued at timestamp */
  enqueuedAt: string;
  /** Current retry count */
  retryCount: number;
  /** Next scheduled attempt time */
  nextAttemptAt: string;
  /** Delivery history */
  attempts: DeliveryAttempt[];
}

/** Dead letter queue entry for failed webhooks */
export interface DeadLetterEntry {
  /** Entry identifier */
  id: string;
  /** Original queue item */
  originalItem: WebhookQueueItem;
  /** Reason for failure */
  failureReason: string;
  /** Total attempts made */
  totalAttempts: number;
  /** Sent to dead letter at */
  deadLetteredAt: string;
  /** Whether it has been manually replayed */
  replayed: boolean;
}

/** Default retry policy configuration */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 5,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  jitterEnabled: true,
  useDeadLetterQueue: true,
};

/** Webhook delivery statistics */
export interface WebhookStats {
  totalDelivered: number;
  totalFailed: number;
  averageDeliveryTimeMs: number;
  successRate: number;
  pendingCount: number;
  deadLetterCount: number;
}
