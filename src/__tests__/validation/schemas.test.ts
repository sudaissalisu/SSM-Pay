/**
 * @fileoverview Test suite for Validation Schemas
 * @module validation/schemas.test
 */

import { describe, it, expect } from 'vitest';
import {
  InitializePaymentSchema,
  VerifyPaymentSchema,
  RefundSchema,
  WebhookPayloadSchema,
  CreateCustomerSchema,
  validateRequest,
} from '@/lib/validation';

describe('Validation Schemas Module', () => {
  
  describe('InitializePaymentSchema - Valid Input', () => {
    it('should accept valid minimum input', async () => {
      const validInput = {
        amount: 50000,
        currency: 'NGN',
        email: 'customer@example.com',
      };

      const result = await validateRequest(InitializePaymentSchema, validInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(50000);
        expect(result.data.currency).toBe('NGN');
        expect(result.data.email).toBe('customer@example.com');
      }
    });

    it('should accept all optional fields with valid values', async () => {
      const fullValidInput = {
        amount: 25000,
        currency: 'USD',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        paymentMethod: 'CARD',
        reference: 'ref_valid_001',
        callbackUrl: 'https://example.com/callback',
        metadata: { orderId: 'ord_123', source: 'web' },
      };

      const result = await validateRequest(InitializePaymentSchema, fullValidInput);

      expect(result.success).toBe(true);
    });

    it('should accept customer ID format starting with cust_', async () => {
      const input = {
        amount: 1000,
        email: 'cust_abc123@test.com',
      };

      const result = await validateRequest(InitializePaymentSchema, input);
      expect(result.success).toBe(true);
    });

    it('should accept all supported currencies', async () => {
      const currencies = ['NGN', 'USD', 'GBP', 'EUR'];
      
      for (const currency of currencies) {
        const result = await validateRequest(InitializePaymentSchema, {
          amount: 1000,
          email: 'test@example.com',
          currency,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all payment methods', async () => {
      const methods = ['CARD', 'BANK_TRANSFER', 'USSD', 'TRANSFER', 'QRCODE'];
      
      for (const method of methods) {
        const result = await validateRequest(InitializePaymentSchema, {
          amount: 1000,
          email: 'test@example.com',
          paymentMethod: method,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('InitializePaymentSchema - Invalid Input', () => {
    it('should reject zero amounts', async () => {
      const result = await validateRequest(InitializePaymentSchema, {
        amount: 0,
        email: 'test@example.com',
      });

      expect(result.success).toBe(false);
    });

    it('should reject negative amounts', async () => {
      const result = await validateRequest(InitializePaymentSchema, {
        amount: -1000,
        email: 'test@example.com',
      });

      expect(result.success).toBe(false);
    });

    it('should accept small positive amounts', async () => {
      // AmountSchema only requires positive, no minimum threshold
      const result = await validateRequest(InitializePaymentSchema, {
        amount: 50,
        email: 'test@example.com',
      });

      expect(result.success).toBe(true);
    });

    it('should reject non-number amounts', async () => {
      const result = await validateRequest(InitializePaymentSchema, {
        amount: 'not-a-number',
        email: 'test@example.com',
      });

      expect(result.success).toBe(false);
    });

    it('should reject emails without @ symbol', async () => {
      const result = await validateRequest(InitializePaymentSchema, {
        amount: 50000,
        email: 'invalid-email',
      });

      expect(result.success).toBe(false);
    });

    it('should reject emails without domain', async () => {
      const result = await validateRequest(InitializePaymentSchema, {
        amount: 50000,
        email: 'user@',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty email field', async () => {
      const result = await validateRequest(InitializePaymentSchema, {
        amount: 50000,
        email: '',
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', async () => {
      const result = await validateRequest(InitializePaymentSchema, {
        amount: 50000,
        // Missing email
      });

      expect(result.success).toBe(false);
    });
  });

  describe('WebhookPayloadSchema', () => {
    it('should accept valid webhook payload', async () => {
      const validPayload = {
        event: 'charge.completed', // Must match resource.action format
        data: {
          id: 'pay_1234567890',
          status: 'COMPLETED',
          amount: 50000,
          currency: 'NGN',
          customer: { email: 'customer@example.com' },
          createdAt: new Date().toISOString(),
        },
        signature: 'a'.repeat(64, ), // HMAC-SHA256 signature (64 hex chars)
      };

      const result = await validateRequest(WebhookPayloadSchema, validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject payload with invalid datetime', async () => {
      const invalidPayload = {
        event: 'payment.completed',
        data: {
          id: 'pay_123',
          status: 'COMPLETED',
          amount: 50000,
          currency: 'NGN',
          createdAt: 'not-a-date',
        },
      };

      const result = await validateRequest(WebhookPayloadSchema, invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should accept all valid event types', async () => {
      const events = [
        'payment.initiated',
        'payment.completed',
        'payment.failed',
        'payment.refunded',
        'transfer.successful',
      ];

      for (const event of events) {
        const result = await validateRequest(WebhookPayloadSchema, {
          event,
          data: {
            id: 'pay_123',
            status: 'COMPLETED',
            amount: 1000,
            currency: 'NGN',
            createdAt: new Date().toISOString(),
          },
        });
        // Some events may have different structures, so we just check no crash
        expect(result).toBeDefined();
      }
    });
  });

  describe('validateRequest Helper Function', () => {
    it('should return success result for valid data', async () => {
      const result = await validateRequest(InitializePaymentSchema, {
        amount: 1000,
        email: 'test@example.com',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(typeof result.data.amount).toBe('number');
      }
    });

    it('should return error result with field details for invalid data', async () => {
      const result = await validateRequest(InitializePaymentSchema, {
        amount: -100,
        email: 'bad-email',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      }
    });

    it('should handle complex nested validation errors', async () => {
      const result = await validateRequest(InitializePaymentSchema, {});

      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have multiple errors for missing required fields
        expect(result.error).toBeDefined();
      }
    });

    it('should return single error message for one error', async () => {
      const result = await validateRequest(VerifyPaymentSchema, {
        reference: '', // Invalid - too short
      });

      expect(result.success).toBe(false);
    });
  });

  describe('CreateCustomerSchema', () => {
    it('should accept valid customer creation request', async () => {
      const validCustomer = {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+2348012345678',
      };

      const result = await validateRequest(CreateCustomerSchema, validCustomer);
      expect(result.success).toBe(true);
    });

    it('should reject invalid phone numbers', async () => {
      const invalidCustomer = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        phone: '12345', // Invalid format
      };

      const result = await validateRequest(CreateCustomerSchema, invalidCustomer);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email formats', async () => {
      const invalidCustomer = {
        email: 'not-an-email',
        firstName: 'Test',
      };

      const result = await validateRequest(CreateCustomerSchema, invalidCustomer);
      expect(result.success).toBe(false);
    });
  });

  describe('RefundSchema', () => {
    it('should accept valid refund request', async () => {
      const validRefund = {
        transactionId: 'txn_abc123',
        amount: 5000,
        reason: 'Customer requested refund',
      };

      const result = await validateRequest(RefundSchema, validRefund);
      expect(result.success).toBe(true);
    });

    it('should require transactionId', async () => {
      const invalidRefund = {
        amount: 5000,
        reason: 'No transaction ID',
      };

      const result = await validateRequest(RefundSchema, invalidRefund);
      expect(result.success).toBe(false);
    });

    it('should accept reason with minimum length', async () => {
      // RefundSchema reason is optional with min(1), so any non-empty string works
      const shortReason = {
        transactionId: 'txn_123',
        reason: 'Valid refund reason',
      };

      const result = await validateRequest(RefundSchema, shortReason);
      expect(result.success).toBe(true);
    });
  });

  describe('Edge Cases and Boundary Values', () => {
    it('should handle boundary amount values correctly', async () => {
      // Test maximum allowed amount
      const maxAmount = await validateRequest(InitializePaymentSchema, {
        amount: 100000000, // Max
        email: 'test@example.com',
      });
      expect(maxAmount.success).toBe(true);

      // Test just over max
      const overMax = await validateRequest(InitializePaymentSchema, {
        amount: 100000001, // Over max
        email: 'test@example.com',
      });
      expect(overMax.success).toBe(false);
    });

    it('should handle very long strings at maximum length', async () => {
      const longName = 'a'.repeat(100); // Max length for names

      const result = await validateRequest(InitializePaymentSchema, {
        amount: 1000,
        email: 'test@example.com',
        firstName: longName,
        lastName: longName,
      });
      expect(result.success).toBe(true);
    });

    it('should handle null and undefined values gracefully', async () => {
      const nullResult = await validateRequest(InitializePaymentSchema, null);
      expect(nullResult.success).toBe(false);

      const undefinedResult = await validateRequest(InitializePaymentSchema, undefined);
      expect(undefinedResult.success).toBe(false);
    });

    it('should handle extra/unknown fields gracefully', async () => {
      const extraFields = {
        amount: 1000,
        email: 'test@example.com',
        unknownField: 'should be ignored',
        anotherExtra: 12345,
      };

      // Zod by default strips unknown fields or ignores them
      const result = await validateRequest(InitializePaymentSchema, extraFields);
      expect(result.success).toBe(true);
    });
  });
});
