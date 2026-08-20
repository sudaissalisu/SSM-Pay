/**
 * @fileoverview Test suite for Webhooks Service module
 * @module services/webhooks.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSignature,
  verifySignature,
  signPayload,
  maskSecret,
  generateWebhookSecret,
  constructSignatureHeader,
  parseSignatureHeader,
  validateEventStructure,
} from '@/services/webhooks/signature';
import { WebhookDelivery } from '@/services/webhooks/delivery';
import { WebhookSubscriptionManager } from '@/services/webhooks/subscriptions';
import {
  WebhookEventType,
  DEFAULT_RETRY_POLICY,
  type WebhookEvent,
  type WebhookSubscription,
  type DeliveryStatus,
} from '@/services/webhooks/types';

describe('Webhooks Service Module', () => {
  
  describe('generateSignature()', () => {
    const secret = 'whsec_test_secret_key_12345';

    it('should produce consistent HMAC signatures', () => {
      const payload = '{"test": "data"}';
      const timestamp = Math.floor(Date.now() / 1000);

      const signature1 = generateSignature(payload, secret, timestamp);
      const signature2 = generateSignature(payload, secret, timestamp);

      expect(signature1).toBe(signature2);
    });

    it('should include sha256= prefix', () => {
      const payload = '{"event": "test"}';
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateSignature(payload, secret, timestamp);

      expect(signature).toStartWith('sha256=');
    });

    it('should produce different signatures for different payloads', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      
      const signature1 = generateSignature('{"a": 1}', secret, timestamp);
      const signature2 = generateSignature('{"b": 2}', secret, timestamp);

      expect(signature1).not.toBe(signature2);
    });

    it('should produce different signatures for different secrets', () => {
      const payload = '{"same": "payload"}';
      const timestamp = Math.floor(Date.now() / 1000);
      const otherSecret = 'different_secret_key_67890';

      const signature1 = generateSignature(payload, secret, timestamp);
      const signature2 = generateSignature(payload, otherSecret, timestamp);

      expect(signature1).not.toBe(signature2);
    });

    it('should produce valid hex-encoded digest', () => {
      const payload = '{"test": true}';
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateSignature(payload, secret, timestamp);

      // Remove prefix and validate hex format
      const hexDigest = signature.replace('sha256=', '');
      expect(hexDigest).toMatch(/^[0-9a-f]{64}$/); // SHA256 produces 64 hex chars
    });
  });

  describe('verifySignature()', () => {
    const secret = 'whsec_verification_secret';

    it('should validate correct signatures', () => {
      const payload = '{"event": "payment.completed"}';
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateSignature(payload, secret, timestamp);
      const headerValue = `t=${timestamp},${signature}`;

      const result = verifySignature(payload, headerValue, secret);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject incorrect signatures', () => {
      const payload = '{"event": "payment.failed"}';
      const timestamp = Math.floor(Date.now() / 1000);
      const wrongSecret = 'wrong_secret_key';
      const signature = generateSignature(payload, wrongSecret, timestamp);
      const headerValue = `t=${timestamp},${signature}`;

      const result = verifySignature(payload, headerValue, secret);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('mismatch');
    });

    it('should reject expired timestamps', () => {
      const payload = '{"event": "test"}';
      // Timestamp from 10 minutes ago (outside 5-minute tolerance)
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
      const signature = generateSignature(payload, secret, oldTimestamp);
      const headerValue = `t=${oldTimestamp},${signature}`;

      const result = verifySignature(payload, headerValue, secret);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('tolerance');
    });

    it('should reject future timestamps', () => {
      const payload = '{"event": "test"}';
      // Timestamp from 10 minutes in future
      const futureTimestamp = Math.floor(Date.now() / 1000) + 600;
      const signature = generateSignature(payload, secret, futureTimestamp);
      const headerValue = `t=${futureTimestamp},${signature}`;

      const result = verifySignature(payload, headerValue, secret);

      expect(result.valid).toBe(false);
    });

    it('should handle malformed timestamp in header', () => {
      const payload = '{"event": "test"}';
      const badHeader = 't=not_a_number,sha256=somesignature';

      const result = verifySignature(payload, badHeader, secret);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid timestamp');
    });
  });

  describe('signPayload()', () => {
    it('should sign complete webhook events', () => {
      const event: WebhookEvent = {
        id: 'evt_test_001',
        type: WebhookEventType.PAYMENT_SUCCEEDED,
        createdAt: new Date().toISOString(),
        data: { paymentId: 'pay_123', amount: 50000 },
        livemode: false,
      };

      const secret = 'whsec_signing_test';
      const { event: signedEvent, signature } = signPayload(event, secret);

      expect(signedEvent).toEqual(event);
      expect(signature.signature).toContain('t=');
      expect(signature.timestamp).toBeDefined();
      expect(signature.hexDigest).toBeDefined();
      expect(signature.algorithm).toBe('sha256');
    });

    it('should include masked secret ID', () => {
      const event: WebhookEvent = {
        id: 'evt_mask_test',
        type: WebhookEventType.PAYMENT_FAILED,
        createdAt: new Date().toISOString(),
        data: {},
        livemode: true,
      };

      const secret = 'whsec_secret_for_masking_test';
      const { signature } = signPayload(event, secret);

      expect(signature.secretId).toContain('...');
      expect(signature.secretId).not.toBe(secret);
    });
  });

  describe('maskSecret()', () => {
    it('should mask long secrets correctly', () => {
      const secret = 'abcdefghijklmnopqrstuvwxyz123456';
      const masked = maskSecret(secret);

      expect(masked).toBe('abcd...3456');
    });

    it('handle short secrets', () => {
      const shortSecret = 'short';
      const masked = maskSecret(shortSecret);

      expect(masked).toBe('****');
    });

    it('should handle exactly 8 character secrets', () => {
      const exactSecret = '12345678';
      const masked = maskSecret(exactSecret);

      expect(masked).toBe('****');
    });
  });

  describe('generateWebhookSecret()', () => {
    it('should generate cryptographically secure random secrets', () => {
      const secret1 = generateWebhookSecret();
      const secret2 = generateWebhookSecret();

      // Should be different each time
      expect(secret1).not.toBe(secret2);
      
      // Should be valid hex string of expected length (64 chars for 32 bytes)
      expect(secret1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should support custom byte lengths', () => {
      const shortSecret = generateWebhookSecret(16);
      const longSecret = generateWebhookSecret(48);

      expect(shortSecret.length).toBe(32); // 16 bytes = 32 hex chars
      expect(longSecret.length).toBe(96); // 48 bytes = 96 hex chars
    });
  });

  describe('constructSignatureHeader() and parseSignatureHeader()', () => {
    it('should construct and parse signature headers correctly', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = 'abc123def456...';

      const header = constructSignatureHeader(timestamp, signature);
      const parsed = parseSignatureHeader(header);

      expect(parsed).not.toBeNull();
      expect(parsed?.timestamp).toBe(timestamp);
      expect(parsed?.signatures).toContain(`sha256=${signature}`);
    });

    it('should return null for invalid headers', () => {
      expect(parseSignatureHeader('')).toBeNull();
      expect(parseSignatureHeader('invalid')).toBeNull();
      expect(parseSignatureHeader('t=12345')).toBeNull(); // No signatures
    });
  });

  describe('validateEventStructure()', () => {
    it('should validate correct event structure', () => {
      const validEvent = {
        id: 'evt_valid',
        type: 'payment.completed',
        createdAt: new Date().toISOString(),
        data: { key: 'value' },
        livemode: false,
      };

      const result = validateEventStructure(validEvent);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidEvent = {
        type: 'payment.completed',
        // Missing id, createdAt, data, livemode
      };

      const result = validateEventStructure(invalidEvent as any);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect non-object input', () => {
      const result = validateEventStructure('not an object');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event must be an object');
    });
  });

  describe('WebhookDelivery retry logic', () => {
    let delivery: WebhookDelivery;

    beforeEach(() => {
      delivery = new WebhookDelivery({}, {
        maxRetries: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
        maxDelayMs: 1000,
        jitterEnabled: false,
      });
    });

    it('should calculate retry delay with exponential backoff', () => {
      const delay1 = delivery.calculateRetryDelay(1);
      const delay2 = delivery.calculateRetryDelay(2);
      const delay3 = delivery.calculateRetryDelay(3);

      // Exponential growth: 100, 200, 400...
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should cap delay at maximum', () => {
      const delay = delivery.calculateRetryDelay(10); // Very high attempt

      expect(delay).toBeLessThanOrEqual(1000); // maxDelayMs
    });

    it('should create queue items correctly', () => {
      const event: WebhookEvent = {
        id: 'evt_queue_test',
        type: WebhookEventType.PAYMENT_SUCCEEDED,
        createdAt: new Date().toISOString(),
        data: {},
        livemode: false,
      };

      const subscription: WebhookSubscription = {
        id: 'sub_001',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.PAYMENT_SUCCEEDED],
        secret: 'whsec_test',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        httpMethod: 'POST',
        retryPolicy: DEFAULT_RETRY_POLICY,
        apiVersion: '2024-01-01',
      };

      const queueItem = delivery.createQueueItem(event, subscription, 1);

      expect(queueItem.id).toContain('evt_queue_test');
      expect(queueItem.event).toEqual(event);
      expect(queueItem.subscription).toEqual(subscription);
      expect(queueItem.priority).toBe(1);
      expect(queueItem.retryCount).toBe(0);
      expect(queueItem.attempts).toHaveLength(0);
    });
  });

  describe('WebhookSubscriptionManager - subscription matching', () => {
    let manager: WebhookSubscriptionManager;

    beforeEach(() => {
      manager = new WebhookSubscriptionManager();
    });

    async function setupTestSubscriptions(): Promise<void> {
      await manager.subscribe({
        url: 'https://example.com/all-events',
        description: 'Receives all events',
      });

      await manager.subscribe({
        url: 'https://example.com/payments-only',
        events: [WebhookEventType.PAYMENT_SUCCEEDED, WebhookEventType.PAYMENT_FAILED],
        description: 'Payment events only',
      });

      await manager.subscribe({
        url: 'https://example.com/success-only',
        events: [WebhookEventType.PAYMENT_SUCCEEDED],
        description: 'Success only',
      });
    }

    it('should match events to correct subscriptions', async () => {
      await setupTestSubscriptions();

      const successEvent: WebhookEvent = {
        id: 'evt_success_match',
        type: WebhookEventType.PAYMENT_SUCCEEDED,
        createdAt: new Date().toISOString(),
        data: {},
        livemode: false,
      };

      const matches = manager.matchEventToSubscriptions(successEvent);

      // Should match: all-events, payments-only, success-only
      expect(matches.length).toBe(3);
      expect(matches.some(s => s.url.includes('all-events'))).toBe(true);
      expect(matches.some(s => s.url.includes('payments-only'))).toBe(true);
      expect(matches.some(s => s.url.includes('success-only'))).toBe(true);
    });

    it('only match relevant subscriptions for specific events', async () => {
      await setupTestSubscriptions();

      const failedEvent: WebhookEvent = {
        id: 'evt_failed_match',
        type: WebhookEventType.PAYMENT_FAILED,
        createdAt: new Date().toISOString(),
        data: {},
        livemode: false,
      };

      const matches = manager.matchEventToSubscriptions(failedEvent);

      // Should match: all-events, payments-only (NOT success-only)
      expect(matches.length).toBe(2);
      expect(matches.some(s => s.url.includes('success-only'))).toBe(false);
    });

    it('should not match inactive subscriptions', async () => {
      await manager.subscribe({
        url: 'https://example.com/inactive-sub',
        events: [WebhookEventType.PAYMENT_SUCCEEDED],
        description: 'Will be deactivated',
      });

      // Deactivate the subscription
      await manager.unsubscribe(
        (await manager.listSubscriptions()).find(s => s.url.includes('inactive-sub'))!.id
      );

      const event: WebhookEvent = {
        id: 'evt_inactive_test',
        type: WebhookEventType.PAYMENT_SUCCEEDED,
        createdAt: new Date().toISOString(),
        data: {},
        livemode: false,
      };

      const matches = manager.matchEventToSubscriptions(event);
      expect(matches.some(s => s.url.includes('inactive-sub'))).toBe(false);
    });

    it('should track subscription counts correctly', async () => {
      expect(manager.getActiveCount()).toBe(0);
      expect(manager.getTotalCount()).toBe(0);

      await manager.subscribe({ url: 'https://example.com/sub1' });
      await manager.subscribe({ url: 'https://example.com/sub2' });

      expect(manager.getActiveCount()).toBe(2);
      expect(manager.getTotalCount()).toBe(2);

      // Deactivate one
      const subId = (await manager.listSubscriptions())[0].id;
      await manager.unsubscribe(subId);

      expect(manager.getActiveCount()).toBe(1);
      expect(manager.getTotalCount()).toBe(2); // Still counted total
    });
  });
});
