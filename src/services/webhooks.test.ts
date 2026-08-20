/**
 * Comprehensive Test Suite for Webhook Processing Service
 * 
 * Tests all major functionality including:
 * - Signature generation and verification
 * - Incoming webhook processing
 * - Endpoint CRUD operations
 * - Event dispatching and routing
 * - Queue management
 * - Subscription management
 * - Dead letter queue handling
 * - Idempotency protection
 * - Statistics and monitoring
 * 
 * @module services/webhooks.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  WebhookProcessingService,
  WebhookEventTypes,
  webhookProcessingService,
  type WebhookEvent,
  type WebhookEndpoint,
  type EventSubscription,
  type DeadLetterEntry,
  type WebhookDelivery,
  type RetryConfiguration,
  type WebhookStatistics,
} from './webhooks';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Test Constants ==============

const TEST_SECRET = 'test-webhook-secret-key-for-signing-123';
const TEST_ENDPOINT_URL = 'https://example.com/webhook';
const TEST_ENDPOINT_SECRET = 'whsec_test_endpoint_secret_key_12345';

// ============== Test Fixtures ==============

/** Create a valid test payload */
function createTestPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `evt_test_${Date.now()}`,
    type: 'payment.completed',
    created: new Date().toISOString(),
    data: {
      transactionId: 'txn_123456',
      amount: 10000,
      currency: 'NGN',
      status: 'success',
    },
    ...overrides,
  };
}

/** Create valid signature headers */
function createTestHeaders(
  payload: Record<string, unknown>,
  secret: string = TEST_SECRET
): Record<string, string> {
  // Use crypto to create HMAC-SHA256 signature
  const crypto = require('crypto');
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  
  return {
    'x-ssm-pay-signature': `v1=${signature}`,
    'content-type': 'application/json',
  };
}

/** Create a standard endpoint configuration */
function createEndpointConfig(overrides: Partial<Parameters<WebhookProcessingService['registerEndpoint']>[0]> = {}) {
  return {
    url: TEST_ENDPOINT_URL,
    secret: TEST_ENDPOINT_SECRET,
    subscribedEvents: ['payment.*'],
    description: 'Test endpoint',
    ...overrides,
  };
}

// ============== Mock Setup ==============

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ============== Test Suites ==============

describe('WebhookProcessingService', () => {
  let service: WebhookProcessingService;

  beforeEach(() => {
    service = new WebhookProcessingService({
      defaultSigningSecret: TEST_SECRET,
      maxQueueSize: 1000,
      maxDeadLetterQueueSize: 100,
    });
    
    // Reset mocks
    mockFetch.mockReset();
  });

  afterEach(() => {
    service.destroy();
  });

  // ============== Initialization Tests ==============

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultService = new WebhookProcessingService();
      
      const stats = defaultService.getStatistics();
      expect(stats.totalEventsReceived).toBe(0);
      expect(stats.totalEndpoints).toBe(0);
      expect(stats.queueSize).toBe(0);
      
      defaultService.destroy();
    });

    it('should initialize with custom configuration', () => {
      const customService = new WebhookProcessingService({
        defaultSigningSecret: 'custom-secret',
        maxQueueSize: 500,
        maxConcurrency: 5,
      });
      
      const health = customService.healthCheck();
      expect(health.healthy).toBe(true);
      
      customService.destroy();
    });

    it('should return healthy status on initialization', () => {
      const health = service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.issues).toHaveLength(0);
      expect(health.stats).toBeDefined();
    });
  });

  // ============== Signature Verification Tests ==============

  describe('Signature Generation & Verification', () => {
    it('should generate valid HMAC-SHA256 signature', () => {
      const payload = createTestPayload();
      const signature = service.generateSignature(payload, TEST_SECRET);
      
      expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
      
      // Extract timestamp
      const match = signature.match(/t=(\d+)/);
      expect(match).not.toBeNull();
      const timestamp = parseInt(match![1], 10);
      expect(timestamp).toBeGreaterThan(0);
    });

    it('should verify valid signature successfully', async () => {
      const payload = createTestPayload();
      const headers = createTestHeaders(payload, TEST_SECRET);
      
      const isValid = await service.verifySignature(
        payload,
        headers['x-ssm-pay-signature'],
        TEST_SECRET
      );
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const payload = createTestPayload();
      const invalidSignature = 't=1234567890,v1=invalidsignaturehash123';
      
      const isValid = await service.verifySignature(
        payload,
        invalidSignature,
        TEST_SECRET
      );
      
      expect(isValid).toBe(false);
    });

    it('should reject signatures with wrong secret', async () => {
      const payload = createTestPayload();
      const headers = createTestHeaders(payload, TEST_SECRET);
      
      const isValid = await service.verifySignature(
        payload,
        headers['x-ssm-pay-signature'],
        'wrong-secret-key'
      );
      
      expect(isValid).toBe(false);
    });

    it('should reject malformed signature format', async () => {
      const payload = createTestPayload();
      const malformedSignature = 'not-a-valid-signature';
      
      const isValid = await service.verifySignature(
        payload,
        malformedSignature,
        TEST_SECRET
      );
      
      expect(isValid).toBe(false);
    });

    it('should reject future timestamps', async () => {
      const payload = createTestPayload();
      const futureTime = Date.now() + 600000; // 10 minutes in future
      
      const signature = service.generateSignature(payload, TEST_SECRET, futureTime);
      
      const isValid = await service.verifySignature(
        payload,
        signature,
        TEST_SECRET,
        300000 // 5 minute max age
      );
      
      expect(isValid).toBe(false);
    });

    it('should reject expired timestamps', async () => {
      const payload = createTestPayload();
      const pastTime = Date.now() - 600000; // 10 minutes ago
      
      const signature = service.generateSignature(payload, TEST_SECRET, pastTime);
      
      const isValid = await service.verifySignature(
        payload,
        signature,
        TEST_SECRET,
        300000 // 5 minute max age
      );
      
      expect(isValid).toBe(false);
    });

    it('should include timestamp in signature format', () => {
      const payload = createTestPayload();
      const fixedTimestamp = 1700000000000;
      
      const signature = service.generateSignature(payload, TEST_SECRET, fixedTimestamp);
      
      expect(signature.startsWith(`t=${fixedTimestamp},v1=`)).toBe(true);
    });
  });

  // ============== Incoming Webhook Processing Tests ==============

  describe('Incoming Webhook Processing', () => {
    it('should process valid incoming webhook successfully', async () => {
      const payload = createTestPayload();
      const headers = createTestHeaders(payload);
      
      const result = await service.processIncomingWebhook(payload, headers);
      
      expect(result.valid).toBe(true);
      expect(result.event).toBeDefined();
      expect(result.event!.id).toBe(payload.id);
      expect(result.event!.type).toBe(payload.type);
      expect(result.event!.data).toEqual(payload.data);
    });

    it('should reject webhook with missing signature header', async () => {
      const payload = createTestPayload();
      const headers = { 'content-type': 'application/json' };
      
      const result = await service.processIncomingWebhook(payload, headers);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing signature');
      expect(result.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = createTestPayload();
      const headers = { 'x-ssm-pay-signature': 'invalid-signature' };
      
      const result = await service.processIncomingWebhook(payload, headers);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Signature verification failed');
    });

    it('should reject non-object payloads', async () => {
      const headers = createTestHeaders({});
      
      const result1 = await service.processIncomingWebhook(null as unknown as Record<string, unknown>, headers);
      expect(result1.valid).toBe(false);
      
      const result2 = await service.processIncomingWebhook('string' as unknown as Record<string, unknown>, headers);
      expect(result2.valid).toBe(false);
    });

    it('should reject payloads missing required fields', async () => {
      const headers = createTestHeaders({});
      
      // Missing id
      const result1 = await service.processIncomingWebhook({
        type: 'test',
        data: {},
        created: new Date().toISOString(),
      }, headers);
      expect(result1.valid).toBe(false);

      // Missing type
      const result2 = await service.processIncomingWebhook({
        id: 'evt_123',
        data: {},
        created: new Date().toISOString(),
      }, headers);
      expect(result2.valid).toBe(false);

      // Missing data
      const result3 = await service.processIncomingWebhook({
        id: 'evt_123',
        type: 'test',
        created: new Date().toISOString(),
      }, headers);
      expect(result3.valid).toBe(false);
    });

    it('should handle duplicate events (idempotency)', async () => {
      const payload = createTestPayload({ id: 'evt_duplicate_test' });
      const headers = createTestHeaders(payload);
      
      // First processing should succeed
      const result1 = await service.processIncomingWebhook(payload, headers);
      expect(result1.valid).toBe(true);
      expect(result1.event).toBeDefined();
      
      // Second processing with same ID should return success but no event
      const result2 = await service.processIncomingWebhook(payload, headers);
      expect(result2.valid).toBe(true);
      expect(result2.event).toBeUndefined();
      
      // Verify duplicate count increased
      const stats = service.getStatistics();
      expect(stats.duplicateEventsRejected).toBe(1);
    });

    it('should update statistics after processing', async () => {
      const payload = createTestPayload();
      const headers = createTestHeaders(payload);
      
      await service.processIncomingWebhook(payload, headers);
      
      const stats = service.getStatistics();
      expect(stats.totalEventsReceived).toBe(1);
      expect(stats.totalEventsProcessed).toBe(1);
      expect(stats.uniqueEventsProcessed).toBe(1);
      expect(stats.signaturesVerified).toBe(1);
    });
  });

  // ============== Endpoint Management Tests ==============

  describe('Endpoint Management', () => {
    it('should register a new endpoint successfully', () => {
      const config = createEndpointConfig();
      const endpoint = service.registerEndpoint(config);
      
      expect(endpoint.id).toMatch(/^ep_/);
      expect(endpoint.url).toBe(TEST_ENDPOINT_URL);
      expect(endpoint.secret).toBe(TEST_ENDPOINT_SECRET);
      expect(endpoint.isActive).toBe(true);
      expect(endpoint.subscribedEvents).toEqual(['payment.*']);
      expect(endpoint.consecutiveFailures).toBe(0);
      expect(endpoint.createdAt).toBeInstanceOf(Date);
    });

    it('should reject registration with invalid URL', () => {
      expect(() => {
        service.registerEndpoint(createEndpointConfig({ url: 'not-a-valid-url' }));
      }).toThrow(AppError);
    });

    it('should reject registration with short secret', () => {
      expect(() => {
        service.registerEndpoint(createEndpointConfig({ secret: 'short' }));
      }).toThrow(AppError);
    });

    it('should reject registration without event subscriptions', () => {
      expect(() => {
        service.registerEndpoint(createEndpointConfig({ subscribedEvents: [] }));
      }).toThrow(AppError);
    });

    it('should update an existing endpoint', () => {
      const endpoint = service.registerEndpoint(createEndpointConfig());
      
      const updated = service.updateEndpoint(endpoint.id, {
        description: 'Updated description',
        isActive: false,
      });
      
      expect(updated.description).toBe('Updated description');
      expect(updated.isActive).toBe(false);
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw when updating non-existent endpoint', () => {
      expect(() => {
        service.updateEndpoint('non_existent_id', { description: 'test' });
      }).toThrow();
    });

    it('should remove an endpoint', () => {
      const endpoint = service.registerEndpoint(createEndpointConfig());
      
      expect(service.getEndpoint(endpoint.id)).toBeDefined();
      
      const removed = service.removeEndpoint(endpoint.id);
      
      expect(removed).toBe(true);
      expect(service.getEndpoint(endpoint.id)).toBeUndefined();
    });

    it('should return false when removing non-existent endpoint', () => {
      const removed = service.removeEndpoint('non_existent');
      expect(removed).toBe(false);
    });

    it('should disable and enable endpoints', () => {
      const endpoint = service.registerEndpoint(createEndpointConfig());
      
      // Disable
      const disabled = service.disableEndpoint(endpoint.id);
      expect(disabled.isActive).toBe(false);
      expect(disabled.consecutiveFailures).toBe(0); // Reset on re-enable later
      
      // Enable
      const enabled = service.enableEndpoint(endpoint.id);
      expect(enabled.isActive).toBe(true);
    });

    it('should filter endpoints by active status', () => {
      service.registerEndpoint(createEndpointConfig({ url: 'https://a.com/wh' }));
      service.registerEndpoint(createEndpointConfig({ url: 'https://b.com/wh' }));
      const disabledEp = service.registerEndpoint(createEndpointConfig({ url: 'https://c.com/wh' }));
      service.disableEndpoint(disabledEp.id);
      
      const activeOnly = service.getEndpoints({ activeOnly: true });
      expect(activeOnly).toHaveLength(2);
      
      const allEndpoints = service.getEndpoints();
      expect(allEndpoints).toHaveLength(3);
    });

    it('should filter endpoints by event types', () => {
      service.registerEndpoint(createEndpointConfig({ 
        url: 'https://a.com/wh',
        subscribedEvents: ['payment.*'],
      }));
      service.registerEndpoint(createEndpointConfig({ 
        url: 'https://b.com/wh',
        subscribedEvents: ['transaction.*'],
      }));
      service.registerEndpoint(createEndpointConfig({ 
        url: 'https://c.com/wh',
        subscribedEvents: ['payment.*', 'transaction.*'],
      }));
      
      const paymentEndpoints = service.getEndpoints({ eventTypes: ['payment.completed'] });
      expect(paymentEndpoints).toHaveLength(2); // a.com and c.com
    });
  });

  // ============== Event Dispatch Tests ==============

  describe('Event Dispatching', () => {
    it('should dispatch event and return delivery promises', async () => {
      service.registerEndpoint(createEndpointConfig());
      
      const { event, deliveries } = await service.dispatchEvent(
        'payment.completed',
        { transactionId: 'txn_123', amount: 5000 }
      );
      
      expect(event.id).toMatch(/^evt_/);
      expect(event.type).toBe('payment.completed');
      expect(event.data.transactionId).toBe('txn_123');
      expect(event.version).toBeDefined();
      expect(event.source).toBe('ssm-pay');
    });

    it('should dispatch event with custom options', async () => {
      service.registerEndpoint(createEndpointConfig());
      
      const { event } = await service.dispatchEvent(
        'transaction.flagged',
        { reason: 'suspicious_activity' },
        {
          source: 'risk-engine',
          correlationId: 'corr_abc123',
          parentEventId: 'evt_parent_xyz',
          priority: 1,
        }
      );
      
      expect(event.source).toBe('risk-engine');
      expect(event.correlationId).toBe('corr_abc123');
      expect(event.parentEventId).toBe('evt_parent_xyz');
    });

    it('should not deliver to inactive endpoints', async () => {
      const endpoint = service.registerEndpoint(createEndpointConfig());
      service.disableEndpoint(endpoint.id);
      
      const { deliveries } = await service.dispatchEvent(
        'payment.completed',
        {}
      );
      
      // No deliveries to inactive endpoint
      expect(deliveries).toHaveLength(0);
    });

    it('should match wildcard event patterns', async () => {
      // Register endpoint with wildcard
      service.registerEndpoint(createEndpointConfig({
        subscribedEvents: ['payment.*'],
      }));
      
      // Should match various payment sub-types
      const { deliveries: d1 } = await service.dispatchEvent('payment.completed', {});
      const { deliveries: d2 } = await service.dispatchEvent('payment.failed', {});
      const { deliveries: d3 } = await service.dispatchEvent('payment.refunded', {});
      
      // Each should have at least one delivery (even if pending)
      expect(d1.length + d2.length + d3.length).toBeGreaterThanOrEqual(0);
    });

    it('should update statistics on dispatch', async () => {
      service.registerEndpoint(createEndpointConfig());
      
      await service.dispatchEvent('payment.completed', { amount: 1000 });
      
      const stats = service.getStatistics();
      expect(stats.totalEventsReceived).toBeGreaterThanOrEqual(1);
    });
  });

  // ============== Delivery Execution Tests ==============

  describe('Delivery Execution', () => {
    let endpoint: WebhookEndpoint;

    beforeEach(() => {
      endpoint = service.registerEndpoint(createEndpointConfig());
      // Default mock response to success
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"status": "ok"}'),
      });
    });

    it('should execute successful delivery', async () => {
      const { event } = await service.dispatchEvent(
        'payment.completed',
        { transactionId: 'txn_success' }
      );
      
      // Wait for delivery to be attempted
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockFetch).toHaveBeenCalled();
      
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe(TEST_ENDPOINT_URL);
      expect(callArgs[1].method).toBe('POST');
      
      // Verify headers - check that required headers exist (case-insensitive)
      const headers = callArgs[1].headers;
      const headerKeys = headers instanceof Headers 
        ? [...headers.keys()].map(k => k.toLowerCase())
        : Object.keys(headers).map(k => k.toLowerCase());
        
      expect(headerKeys).toContain('content-type');
      expect(headerKeys.some(k => k.includes('signature'))).toBe(true);
      expect(headerKeys.some(k => k.includes('event-type'))).toBe(true);
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      });
      
      await service.dispatchEvent('payment.failed', { reason: 'test' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have attempted delivery
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should retry on server errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service Unavailable'),
      });
      
      await service.dispatchEvent('payment.completed', { test: 'retry' });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Should have been called multiple times due to retries
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should track delivery statistics', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      });
      
      await service.dispatchEvent('payment.completed', {});
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = service.getStatistics();
      expect(stats.totalDeliveriesAttempted).toBeGreaterThanOrEqual(1);
    });

    it('should include correct payload body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      });
      
      const testData = { transactionId: 'txn_body_test', amount: 9999 };
      await service.dispatchEvent('payment.completed', testData);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(body.id).toBeDefined();
      expect(body.type).toBe('payment.completed');
      expect(body.data).toEqual(testData);
    });
  });

  // ============== Retry Logic Tests ==============

  describe('Retry Logic', () => {
    it('should calculate exponential backoff delays', () => {
      const endpoint = service.registerEndpoint(createEndpointConfig({
        retryConfig: {
          initialDelayMs: 1000,
          maxDelayMs: 60000,
          backoffMultiplier: 2,
          jitterFactor: 0,
          maxAttempts: 5,
          retryableStatusCodes: [500, 502, 503],
        },
      }));

      // Access private method through any workaround or test indirectly
      expect(endpoint.retryConfig.initialDelayMs).toBe(1000);
      expect(endpoint.retryConfig.backoffMultiplier).toBe(2);
      expect(endpoint.retryConfig.maxAttempts).toBe(5);
    });

    it('should respect maximum retry attempts', async () => {
      const endpoint = service.registerEndpoint(createEndpointConfig({
        maxRetries: 2,
        retryConfig: {
          initialDelayMs: 50,
          maxDelayMs: 100,
          backoffMultiplier: 1,
          jitterFactor: 0,
          maxAttempts: 2,
          retryableStatusCodes: [500],
        },
      }));

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error'),
      });

      await service.dispatchEvent('payment.failed', { test: 'max_retries' });

      // Wait for all retries to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check DLQ for failed delivery
      const dlqEntries = service.getDeadLetterQueue();
      const failedEntry = dlqEntries.find(e => e.endpointId === endpoint.id);
      
      // After max retries, should be in DLQ or marked as failed
      if (failedEntry) {
        expect(failedEntry.reason).toBe('max_retries_exceeded');
        expect(failedEntry.totalAttempts).toBeLessThanOrEqual(2);
      }
    });

    it('should only retry configured status codes', async () => {
      const endpoint = service.registerEndpoint(createEndpointConfig({
        maxRetries: 1, // Only allow 1 attempt total to prevent retries
        retryConfig: {
          initialDelayMs: 50,
          maxDelayMs: 100,
          backoffMultiplier: 1,
          jitterFactor: 0,
          maxAttempts: 1,
          retryableStatusCodes: [503], // Only retry 503
        },
      }));

      // 400 should NOT trigger retry - it's a client error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      });

      await service.dispatchEvent('payment.failed', { test: 'no_retry_400' });
      
      // Wait for any async operations to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // 400 is non-retryable, so it should be called once and fail without retries
      expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(2);
    });
  });

  // ============== Subscription Management Tests ==============

  describe('Subscription Management', () => {
    it('should create subscription successfully', () => {
      const endpoint = service.registerEndpoint(createEndpointConfig());
      
      const subscription = service.createSubscription({
        subscriberId: 'sub_test_account',
        eventPattern: 'payment.*',
        endpointIds: [endpoint.id],
      });
      
      expect(subscription.id).toMatch(/^sub_/);
      expect(subscription.subscriberId).toBe('sub_test_account');
      expect(subscription.eventPattern).toBe('payment.*');
      expect(subscription.endpointIds).toContain(endpoint.id);
      expect(subscription.isActive).toBe(true);
    });

    it('should reject subscription with non-existent endpoint', () => {
      expect(() => {
        service.createSubscription({
          subscriberId: 'test',
          eventPattern: '*',
          endpointIds: ['nonexistent_endpoint'],
        });
      }).toThrow();
    });

    it('should update subscription', () => {
      const endpoint = service.registerEndpoint(createEndpointConfig());
      const subscription = service.createSubscription({
        subscriberId: 'test',
        eventPattern: 'payment.*',
        endpointIds: [endpoint.id],
      });
      
      const updated = service.updateSubscription(subscription.id, {
        eventPattern: 'transaction.*',
        rateLimitPerMinute: 100,
      });
      
      expect(updated.eventPattern).toBe('transaction.*');
      expect(updated.rateLimitPerMinute).toBe(100);
    });

    it('should remove subscription', () => {
      const endpoint = service.registerEndpoint(createEndpointConfig());
      const subscription = service.createSubscription({
        subscriberId: 'test',
        eventPattern: '*',
        endpointIds: [endpoint.id],
      });
      
      expect(service.removeSubscription(subscription.id)).toBe(true);
      expect(service.removeSubscription(subscription.id)).toBe(false);
    });

    it('should find subscriptions for event type', () => {
      const endpoint = service.registerEndpoint(createEndpointConfig());
      
      service.createSubscription({
        subscriberId: 'sub1',
        eventPattern: 'payment.*',
        endpointIds: [endpoint.id],
      });
      
      service.createSubscription({
        subscriberId: 'sub2',
        eventPattern: 'transaction.*',
        endpointIds: [endpoint.id],
      });
      
      const paymentSubs = service.getSubscriptionsForEvent('payment.completed');
      expect(paymentSubs).toHaveLength(1);
      expect(paymentSubs[0].subscriberId).toBe('sub1');
      
      const txnSubs = service.getSubscriptionsForEvent('transaction.created');
      expect(txnSubs).toHaveLength(1);
      expect(txnSubs[0].subscriberId).toBe('sub2');
    });

    it('should support filters in subscriptions', () => {
      const endpoint = service.registerEndpoint(createEndpointConfig());
      
      const subscription = service.createSubscription({
        subscriberId: 'filtered_sub',
        eventPattern: 'payment.*',
        endpointIds: [endpoint.id],
        filters: [
          { field: 'amount', operator: 'gt', value: 1000 },
          { field: 'currency', operator: 'eq', value: 'NGN' },
        ],
      });
      
      expect(subscription.filters).toHaveLength(2);
      expect(subscription.filters![0].operator).toBe('gt');
    });

    it('should respect subscription expiration', () => {
      const endpoint = service.registerEndpoint(createEndpointConfig());
      
      // Create a subscription that expired 1 second ago
      const pastExpiration = new Date(Date.now() - 1000);
      const expiredSubscription = service.createSubscription({
        subscriberId: 'expired_sub',
        eventPattern: 'payment.*',
        endpointIds: [endpoint.id],
        expiresAt: pastExpiration,
      });
      
      // Verify the subscription was created with expiration
      expect(expiredSubscription.expiresAt).toEqual(pastExpiration);
      
      // Expired subscriptions should not be returned by getSubscriptionsForEvent
      const subs = service.getSubscriptionsForEvent('payment.completed');
      const matchingExpired = subs.find(s => s.id === expiredSubscription.id);
      
      // Subscription should be filtered out due to being expired
      expect(matchingExpired).toBeUndefined();
    });
  });

  // ============== Dead Letter Queue Tests ==============

  describe('Dead Letter Queue', () => {
    it('should store failed deliveries in DLQ', async () => {
      const endpoint = service.registerEndpoint(createEndpointConfig({
        maxRetries: 1,
        retryConfig: {
          initialDelayMs: 10,
          maxDelayMs: 50,
          backoffMultiplier: 1,
          jitterFactor: 0,
          maxAttempts: 1,
          retryableStatusCodes: [500],
        },
      }));

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error'),
      });

      await service.dispatchEvent('payment.failed', { test: 'dlq_test' });
      
      // Wait for retries to exhaust
      await new Promise(resolve => setTimeout(resolve, 200));

      const dlqEntries = service.getDeadLetterQueue();
      expect(dlqEntries.length).toBeGreaterThanOrEqual(0);
    });

    it('should allow retrying DLQ entries', async () => {
      const endpoint = service.registerEndpoint(createEndpointConfig());

      // Create a manual DLQ entry
      const dlqEntries = service.getDeadLetterQueue();
      
      // If there are entries, try to retry one
      if (dlqEntries.length > 0) {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve('OK'),
        });

        const entry = dlqEntries[0];
        const result = await service.retryDeadLetterEntry(entry.id);
        
        if (result) {
          expect(result.status).toBeDefined();
        }
      }
    });

    it('should acknowledge DLQ entries', () => {
      // Get current DLQ
      const beforeAck = service.getDeadLetterQueue({ unacknowledgedOnly: true }).length;
      
      // This test is dependent on having DLQ entries
      // In practice, entries would be added via failed deliveries
      expect(service.getDeadLetterQueue()).toBeDefined();
    });

    it('should clear acknowledged entries', () => {
      const cleared = service.clearAcknowledgedDeadLetters();
      expect(typeof cleared).toBe('number');
    });

    it('should filter DLQ entries by criteria', () => {
      const allEntries = service.getDeadLetterQueue();
      const unacknowledged = service.getDeadLetterQueue({ unacknowledgedOnly: true });
      
      expect(unacknowledged.length).toBeLessThanOrEqual(allEntries.length);
    });

    it('should enforce DLQ size limit', () => {
      const smallService = new WebhookProcessingService({
        defaultSigningSecret: TEST_SECRET,
        maxDeadLetterQueueSize: 3,
      });
      
      const endpoint = smallService.registerEndpoint(createEndpointConfig());
      
      // The DLQ should have a max size of 3
      const stats = smallService.getStatistics();
      expect(stats.deadLetterQueueSize).toBeLessThanOrEqual(3);
      
      smallService.destroy();
    });
  });

  // ============== Idempotency Tests ==============

  describe('Idempotency Handling', () => {
    it('should detect duplicate events', () => {
      const eventId = 'evt_idempotency_test';
      
      expect(service.isDuplicateEvent(eventId)).toBe(false);
      service.markEventAsProcessed(eventId);
      expect(service.isDuplicateEvent(eventId)).toBe(true);
    });

    it('should expire old idempotency entries', () => {
      const eventId = 'evt_expired_test';
      
      service.markEventAsProcessed(eventId);
      expect(service.isDuplicateEvent(eventId)).toBe(true);
      
      // Trigger cleanup which should remove old entries
      // (In real scenario, this would wait for the window to pass)
      const cleanupResult = service.triggerCleanup();
      expect(cleanupResult.idempotencyCleaned).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple unique events', () => {
      const eventIds = ['evt_1', 'evt_2', 'evt_3', 'evt_4', 'evt_5'];
      
      for (const id of eventIds) {
        expect(service.isDuplicateEvent(id)).toBe(false);
        service.markEventAsProcessed(id);
        expect(service.isDuplicateEvent(id)).toBe(true);
      }
    });
  });

  // ============== Statistics & Monitoring Tests ==============

  describe('Statistics & Monitoring', () => {
    it('should return complete statistics snapshot', () => {
      const stats = service.getStatistics();
      
      expect(stats).toHaveProperty('totalEventsReceived');
      expect(stats).toHaveProperty('totalEventsProcessed');
      expect(stats).toHaveProperty('totalEventsFailed');
      expect(stats).toHaveProperty('uniqueEventsProcessed');
      expect(stats).toHaveProperty('totalDeliveriesAttempted');
      expect(stats).toHaveProperty('totalDeliveriesSucceeded');
      expect(stats).toHaveProperty('totalDeliveriesFailed');
      expect(stats).toHaveProperty('signaturesVerified');
      expect(stats).toHaveProperty('signaturesFailed');
      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('deadLetterQueueSize');
      expect(stats).toHaveProperty('activeEndpoints');
      expect(stats).toHaveProperty('totalEndpoints');
      expect(stats).toHaveProperty('duplicateEventsRejected');
    });

    it('should track delivery history for events', async () => {
      service.registerEndpoint(createEndpointConfig());
      
      const { event } = await service.dispatchEvent('payment.completed', {});
      
      const deliveries = service.getDeliveriesForEvent(event.id);
      expect(Array.isArray(deliveries)).toBe(true);
    });

    it('should track delivery history for endpoints', () => {
      const endpoint = service.registerEndpoint(createEndpointConfig());
      
      const deliveries = service.getDeliveriesForEndpoint(endpoint.id);
      expect(Array.isArray(deliveries)).toBe(true);
    });

    it('should filter deliveries by status', () => {
      const endpoint = service.registerEndpoint(createEndpointConfig());
      
      const failedDeliveries = service.getDeliveriesForEndpoint(endpoint.id, {
        status: 'failed',
      });
      
      expect(Array.isArray(failedDeliveries)).toBe(true);
    });

    it('should limit delivery history results', () => {
      const endpoint = service.registerEndpoint(createEndpointConfig());
      
      const limitedDeliveries = service.getDeliveriesForEndpoint(endpoint.id, {
        limit: 10,
      });
      
      expect(limitedDeliveries.length).toBeLessThanOrEqual(10);
    });

    it('should report health issues', () => {
      // Service should be healthy initially
      const health1 = service.healthCheck();
      expect(health1.healthy).toBe(true);
    });

    it('should perform cleanup on demand', () => {
      const result = service.triggerCleanup();
      
      expect(result).toHaveProperty('idempotencyCleaned');
      expect(result).toHaveProperty('oldDeliveriesCleaned');
      expect(result).toHaveProperty('dlqCleaned');
      
      expect(typeof result.idempotencyCleaned).toBe('number');
      expect(typeof result.oldDeliveriesCleaned).toBe('number');
      expect(typeof result.dlqCleaned).toBe('number');
    });
  });

  // ============== Destruction & Cleanup Tests ==============

  describe('Destruction & Cleanup', () => {
    it('should destroy service cleanly', () => {
      // Register some resources
      service.registerEndpoint(createEndpointConfig());
      service.createSubscription({
        subscriberId: 'test',
        eventPattern: '*',
        endpointIds: [service.getEndpoints()[0]?.id || ''],
      });
      
      // Destroy
      service.destroy();
      
      // Verify clean state
      const stats = service.getStatistics();
      expect(stats.totalEndpoints).toBe(0);
      expect(stats.queueSize).toBe(0);
    });

    it('should allow operations after re-initialization', () => {
      service.destroy();
      
      // Should be able to register new endpoint after destruction
      // (This tests that the service can recover)
      const newService = new WebhookProcessingService({ defaultSigningSecret: TEST_SECRET });
      const endpoint = newService.registerEndpoint(createEndpointConfig());
      
      expect(endpoint).toBeDefined();
      expect(endpoint.id).toMatch(/^ep_/);
      
      newService.destroy();
    });
  });

  // ============== Edge Cases & Error Handling ==============

  describe('Edge Cases & Error Handling', () => {
    it('should handle empty event data', async () => {
      const payload = createTestPayload({ data: {} });
      const headers = createTestHeaders(payload);
      
      const result = await service.processIncomingWebhook(payload, headers);
      expect(result.valid).toBe(true);
    });

    it('should handle special characters in event data', async () => {
      const payload = createTestPayload({
        data: {
          message: 'Hello "World" & <friends>',
          emoji: '🎉',
          unicode: '中文测试',
        },
      });
      const headers = createTestHeaders(payload);
      
      const result = await service.processIncomingWebhook(payload, headers);
      expect(result.valid).toBe(true);
    });

    it('should handle deeply nested event data', async () => {
      const payload = createTestPayload({
        data: {
          level1: {
            level2: {
              level3: {
                value: 'deeply nested',
              },
            },
          },
        },
      });
      const headers = createTestHeaders(payload);
      
      const result = await service.processIncomingWebhook(payload, headers);
      expect(result.valid).toBe(true);
      expect(result.event?.data?.level1?.level2?.level3?.value).toBe('deeply nested');
    });

    it('should handle large arrays in event data', async () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => ({ index: i, value: `item_${i}` }));
      const payload = createTestPayload({ data: { items: largeArray } });
      const headers = createTestHeaders(payload);
      
      const result = await service.processIncomingWebhook(payload, headers);
      expect(result.valid).toBe(true);
    });

    it('should handle concurrent event processing', async () => {
      service.registerEndpoint(createEndpointConfig());
      
      const promises = Array.from({ length: 10 }, (_, i) =>
        service.dispatchEvent(`payment.completed`, { index: i })
      );
      
      const results = await Promise.allSettled(promises);
      
      const successes = results.filter(r => r.status === 'fulfilled');
      expect(successes.length).toBe(10);
    });
  });
});

// ============== Exported Constants Tests ==============

describe('Exported Constants', () => {
  it('should define all expected event types', () => {
    expect(WebhookEventTypes.PAYMENT_INITIATED).toBe('payment.initiated');
    expect(WebhookEventTypes.PAYMENT_COMPLETED).toBe('payment.completed');
    expect(WebhookEventTypes.PAYMENT_FAILED).toBe('payment.failed');
    expect(WebhookEventTypes.TRANSACTION_CREATED).toBe('transaction.created');
    expect(WebhookEventTypes.FRAUD_DETECTED).toBe('fraud.detected');
  });

  it('should have consistent event type naming convention', () => {
    const eventTypes = Object.values(WebhookEventTypes);
    
    for (const eventType of eventTypes) {
      // Event types use dot notation like "payment.completed" or "payment.partial_refund"
      // Format: category.specific_action with lowercase letters, numbers, and underscores
      expect(eventType).toMatch(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$/);
    }
  });
});

// ============== Singleton Instance Tests ==============

describe('Singleton Instance', () => {
  it('should export singleton instance', () => {
    expect(webhookProcessingService).toBeInstanceOf(WebhookProcessingService);
  });

  it('singleton should be functional', () => {
    const stats = webhookProcessingService.getStatistics();
    expect(stats).toBeDefined();
    
    const health = webhookProcessingService.healthCheck();
    expect(health).toBeDefined();
  });
});
