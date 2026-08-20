/**
 * @fileoverview Payment webhook, refund, and callback type definitions
 * @description Contains Refund types, WebhookPayload, CallbackPayload
 * @module types/payment/webhook
 */

import { Payment, PaymentStatus } from './payment.core';

// ============================================================================
// REFUND TYPES
// ============================================================================

/**
 * Request payload for initiating a refund on a completed payment.
 *
 * @interface RefundRequest
 */
export interface RefundRequest {
  /** Original payment ID to refund */
  paymentId: string;
  /** Amount to refund (full amount if not specified) */
  amount?: number;
  /** Reason for the refund */
  reason: string;
  /** Reference for the refund transaction */
  reference?: string;
  /** Customer notification preference */
  notifyCustomer?: boolean;
  /** Metadata for the refund */
  metadata?: Record<string, unknown>;
  /** Initiated by user ID */
  initiatedBy?: string;
}

/**
 * Response returned after processing a refund request.
 *
 * @interface RefundResponse
 */
export interface RefundResponse {
  /** Indicates if refund was initiated successfully */
  success: boolean;
  /** Processing message */
  message: string;
  /** Refund transaction ID */
  refundId: string;
  /** Original payment reference */
  paymentReference: string;
  /** Refunded amount */
  amount: number;
  /** Refund status */
  status: PaymentStatus.PENDING | PaymentStatus.COMPLETED | PaymentStatus.FAILED;
  /** Estimated processing time in hours */
  estimatedProcessingTime?: number;
  /** Timestamp when refund was created */
  createdAt: Date;
}

// ============================================================================
// CALLBACK/WEBHOOK TYPES
// ============================================================================

/**
 * Payload received from payment gateway callbacks/webhooks.
 * This is the data structure sent when payment status changes occur.
 *
 * @interface PaymentCallbackPayload
 */
export interface PaymentCallbackPayload {
  /** Event type that triggered the callback */
  event: 'payment.completed' | 'payment.failed' | 'payment.expired' | 'refund.processed';
  /** Payment data associated with the event */
  data: Payment;
  /** Timestamp when the event occurred */
  timestamp: Date;
  /** Unique signature for verifying webhook authenticity */
  signature: string;
  /** Webhook attempt number (for retry tracking) */
  attempt: number;
}

/**
 * Webhook event structure for real-time payment notifications.
 * Extends the callback payload with additional metadata.
 *
 * @interface PaymentWebhookEvent
 */
export interface PaymentWebhookEvent {
  /** Unique event identifier */
  eventId: string;
  /** Event type classification */
  eventType: PaymentCallbackPayload['event'];
  /** Event payload containing payment data */
  payload: PaymentCallbackPayload;
  /** Source IP address of the webhook sender */
  sourceIp: string;
  /** User agent of the webhook sender */
  userAgent?: string;
  /** Delivery attempts count */
  deliveryAttempts: number;
  /** Whether this is a test event */
  isTestEvent: boolean;
  /** API version used */
  apiVersion: string;
}
