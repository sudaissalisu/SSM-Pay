/**
 * Webhook Signature Verification Module
 * 
 * Provides HMAC-SHA256 signature generation and verification
 * for secure webhook payload validation.
 * 
 * @module services/webhooks/signature
 */

import { createHmac, timingSafeEqual } from 'crypto';
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

// ============== Constants ==============

/** HTTP header names for webhook delivery */
export const WEBHOOK_HEADERS = {
  SIGNATURE: 'X-SSM-Pay-Signature',
  TIMESTAMP: 'X-SSM-Pay-Timestamp',
  EVENT_ID: 'X-SSM-Pay-Event-ID',
  EVENT_TYPE: 'X-SSM-Pay-Event-Type',
  DELIVERY_ID: 'X-SSM-Pay-Delivery-ID',
  ATTEMPT: 'X-SSM-Pay-Attempt',
} as const;

/** Event schema version */
export const EVENT_SCHEMA_VERSION = '2.0.0';

// ============== Signature Verification Class ==============

/**
 * Webhook Signature Handler
 * 
 * Handles all cryptographic operations for webhook security including:
 * - HMAC-SHA256 signature generation
 * - Timing-safe signature verification
 * - Timestamp freshness validation
 */
export class WebhookSignatureHandler {
  private signaturesVerified: number = 0;
  private signaturesFailed: number = 0;

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
   * const signature = handler.generateSignature(
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
   * const isValid = await handler.verifySignature(
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
        this.signaturesFailed++;
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
        this.signaturesFailed++;
        logger.warn('Signature timestamp is in the future', {
          event: 'webhook.signature.future_timestamp',
          metadata: { timestampAge: Math.abs(timestampAge) },
        });
        return false;
      }
      
      if (timestampAge > maxAge) {
        this.signaturesFailed++;
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
        this.signaturesVerified++;
        logger.debug('Signature verified successfully', {
          event: 'webhook.signature.verified',
        });
      } else {
        this.signaturesFailed++;
        logger.warn('Signature verification failed', {
          event: 'webhook.signature.mismatch',
        });
      }

      return isValid;
    } catch (error) {
      this.signaturesFailed++;
      logger.error('Error during signature verification', {
        event: 'webhook.signature.error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  /**
   * Get current signature statistics
   */
  getStats(): { verified: number; failed: number } {
    return {
      verified: this.signaturesVerified,
      failed: this.signaturesFailed,
    };
  }

  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.signaturesVerified = 0;
    this.signaturesFailed = 0;
  }
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

// ============== Utility Functions ==============

/**
 * Array.every polyfill-like function for filters
 */
export function every<T>(predicate: (item: T) => boolean, items: T[]): boolean {
  return items.every(predicate);
}
