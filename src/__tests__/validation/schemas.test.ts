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
  WebhookSignatureHeaderSchema,
  CreateCustomerSchema,
  validateRequest,
  aggregateErrorMessages,
} from '@/lib/validation';

describe('Validation Schemas Module', () => {
  
  describe('InitializePaymentSchema - Valid Input', () => {
    it('should accept valid minimum input', () => {
      const validInput = {
        amount: 50000,
        currency: 'NGN',
        customer: 'customer@example.com',
      };

      const result = validateRequest(InitializePaymentSchema, validInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(50000);
        expect(result.data.currency).toBe('NGN');
        expect(result.data.customer).toBe('customer@example.com');
      }
    });

    it('should accept all optional fields with valid values', () => {
      const fullValidInput = {
        amount: 25000,
        currency: 'USD',
        customer: 'cust_abc123',
        method: 'card' as const,
        reference: 'ref_valid_001',
        description: 'Test payment for validation',
        callbackUrl: 'https://example.com/callback',
        redirectUrl: 'https://example.com/redirect',
        metadata: { orderId: 'ord_123', source: 'web' },
        allowPartialPayment: true,
        maxRetries: 3,
        expiresIn: 15,
      };

      const result = validateRequest(InitializePaymentSchema, fullValidInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.method).toBe('card');
        expect(result.data.allowPartialPayment).toBe(true);
        expect(result.data.metadata?.orderId).toBe('ord_123');
      }
    });

    it('should accept customer ID format starting with cust_', () => {
      const inputWithCustomerId = {
        amount: 10000,
        currency: 'GBP',
        customer: 'cust_789xyz',
      };

      const result = validateRequest(InitializePaymentSchema, inputWithCustomerId);
      expect(result.success).toBe(true);
    });

    it('should accept all supported currencies', () => {
      const currencies = ['NGN', 'USD', 'GBP', 'EUR'];

      currencies.forEach(currency => {
        const result = validateRequest(InitializePaymentSchema, {
          amount: 5000,
          currency,
          customer: 'test@example.com',
        });
        expect(result.success).toBe(true);
      });
    });

    it('should accept all payment methods', () => {
      const methods = ['card', 'bank_transfer', 'ussd', 'transfer', 'qrcode'];

      methods.forEach(method => {
        const result = validateRequest(InitializePaymentSchema, {
          amount: 10000,
          currency: 'NGN',
          customer: 'test@example.com',
          method,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('InitializePaymentSchema - Negative Amounts Rejection', () => {
    it('should reject zero amounts', () => {
      const invalidInput = {
        amount: 0,
        currency: 'NGN',
        customer: 'test@example.com',
      };

      const result = validateRequest(InitializePaymentSchema, invalidInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.field === 'amount')).toBe(true);
      }
    });

    it('should reject negative amounts', () => {
      const invalidInput = {
        amount: -5000,
        currency: 'NGN',
        customer: 'test@example.com',
      };

      const result = validateRequest(InitializePaymentSchema, invalidInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        const amountError = result.errors.find(e => e.field === 'amount');
        expect(amountError?.message).toBeDefined();
      }
    });

    it('should reject amounts below minimum threshold', () => {
      const smallAmountInput = {
        amount: 50, // Below minimum of 100
        currency: 'NGN',
        customer: 'test@example.com',
      };

      const result = validateRequest(InitializePaymentSchema, smallAmountInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.field === 'amount')).toBe(true);
      }
    });

    it('should reject non-number amounts', () => {
      const stringAmountInput = {
        amount: 'not a number' as any,
        currency: 'NGN',
        customer: 'test@example.com',
      };

      const result = validateRequest(InitializePaymentSchema, stringAmountInput);
      expect(result.success).toBe(false);
    });
  });

  describe('InitializePaymentSchema - Invalid Email Rejection', () => {
    it('should reject emails without @ symbol', () => {
      const invalidEmailInput = {
        amount: 10000,
        currency: 'NGN',
        customer: 'invalid-email', // No @ symbol
      };

      const result = validateRequest(InitializePaymentSchema, invalidEmailInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.field === 'customer')).toBe(true);
      }
    });

    it('should reject emails without domain', () => {
      const noDomainInput = {
        amount: 10000,
        currency: 'NGN',
        customer: 'user@',
      };

      const result = validateRequest(InitializePaymentSchema, noDomainInput);
      expect(result.success).toBe(false);
    });

    it('should reject empty customer field', () => {
      const emptyCustomerInput = {
        amount: 10000,
        currency: 'NGN',
        customer: '',
      };

      const result = validateRequest(InitializePaymentSchema, emptyCustomerInput);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const incompleteInput = {
        amount: 10000,
        // Missing currency and customer
      };

      const result = validateRequest(InitializePaymentSchema, incompleteInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(1); // Multiple missing fields
      }
    });
  });

  describe('WebhookPayloadSchema Validation', () => {
    it('should accept valid webhook payload', () => {
      const validPayload = {
        id: 'evt_test_001',
        type: 'payment.completed',
        createdAt: new Date().toISOString(),
        data: { paymentId: 'pay_123', amount: 50000 },
        livemode: false,
      };

      const result = validateRequest(WebhookPayloadSchema, validPayload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('evt_test_001');
        expect(result.data.type).toBe('payment.completed');
      }
    });

    it('should reject payload with invalid event ID format', () => {
      const badIdPayload = {
        id: 'invalid_id', // Doesn't start with evt_
        type: 'payment.completed',
        createdAt: new Date().toISOString(),
        data: {},
        livemode: true,
      };

      const result = validateRequest(WebhookPayloadSchema, badIdPayload);
      expect(result.success).toBe(false);
    });

    it('should reject payload with invalid datetime', () => {
      const badDatePayload = {
        id: 'evt_date_test',
        type: 'payment.failed',
        createdAt: 'not-a-date',
        data: {},
        livemode: false,
      };

      const result = validateRequest(WebhookPayloadSchema, badDatePayload);
      expect(result.success).toBe(false);
    });

    it('should accept all valid event types', () => {
      const validTypes = [
        'payment.completed',
        'payment.failed',
        'payment.expired',
        'refund.processed',
        'transfer.completed',
        'transfer.failed',
        'customer.created',
        'customer.updated',
      ];

      validTypes.forEach(type => {
        const payload = {
          id: `evt_type_${type.replace('.', '_')}`,
          type,
          createdAt: new Date().toISOString(),
          data: {},
          livemode: false,
        };

        const result = validateRequest(WebhookPayloadSchema, payload);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('validateRequest Helper Function', () => {
    it('should return success result for valid data', () => {
      const validData = { identifier: 'pay_123' };
      const result = validateRequest(VerifyPaymentSchema, validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.identifier).toBe('pay_123');
      }
    });

    it('should return error result with field details for invalid data', () => {
      const invalidData = {}; // Missing required identifier
      const result = validateRequest(VerifyPaymentSchema, invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(Array.isArray(result.errors)).toBe(true);
        expect(result.errors.length).toBeGreaterThan(0);
        
        // Each error should have field and message
        result.errors.forEach(error => {
          expect(error.field).toBeDefined();
          expect(error.message).toBeDefined();
          expect(typeof error.message).toBe('string');
        });
      }
    });

    it('should handle complex nested validation errors', () => {
      const complexInvalidData = {
        paymentId: 'invalid', // Doesn't start with pay_
        amount: -100, // Negative
        reason: 'ok', // Too short
      };

      const result = validateRequest(RefundSchema, complexInvalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have multiple errors
        expect(result.errors.length).toBeGreaterThan(1);
      }
    });
  });

  describe('Error Message Aggregation', () => {
    it('should return single error message for one error', () => {
      const errors = [{ field: 'email', message: 'Invalid email format' }];
      
      const message = aggregateErrorMessages(errors);
      
      expect(message).toContain('Validation error');
      expect(message).toContain('Invalid email format');
    });

    it('should return formatted list for multiple errors', () => {
      const errors = [
        { field: 'amount', message: 'Amount must be positive' },
        { field: 'currency', message: 'Currency is required' },
        { field: 'customer', message: 'Customer is required' },
      ];

      const message = aggregateErrorMessages(errors);

      expect(message).toContain('Validation errors');
      expect(message).toContain('- amount:');
      expect(message).toContain('- currency:');
      expect(message).toContain('- customer:');
    });

    it('should return empty string for no errors', () => {
      const message = aggregateErrorMessages([]);
      expect(message).toBe('');
    });
  });

  describe('CreateCustomerSchema Validation', () => {
    it('should accept valid customer creation request', () => {
      const validCustomer = {
        email: 'newuser@example.com',
        phone: '+2348012345678',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = validateRequest(CreateCustomerSchema, validCustomer);
      expect(result.success).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      const badPhoneCustomer = {
        email: 'test@example.com',
        phone: '123', // Too short
      };

      const result = validateRequest(CreateCustomerSchema, badPhoneCustomer);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email formats', () => {
      const badEmailCustomer = {
        email: 'not-an-email',
      };

      const result = validateRequest(CreateCustomerSchema, badEmailCustomer);
      expect(result.success).toBe(false);
    });

    it('should accept E.164 phone format', () => {
      const validPhones = [
        '+2348012345678',
        '+14155552671',
        '+442071234567',
      ];

      validPhones.forEach(phone => {
        const result = validateRequest(CreateCustomerSchema, {
          email: 'phone@test.com',
          phone,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('RefundSchema Validation', () => {
    it('should accept valid refund request', () => {
      const validRefund = {
        paymentId: 'pay_refund_001',
        amount: 25000,
        reason: 'Customer requested refund due to duplicate charge',
      };

      const result = validateRequest(RefundSchema, validRefund);
      expect(result.success).toBe(true);
    });

    it('should require paymentId to start with pay_', () => {
      const badIdRefund = {
        paymentId: 'invalid_id',
        amount: 10000,
        reason: 'Test refund',
      };

      const result = validateRequest(RefundSchema, badIdRefund);
      expect(result.success).toBe(false);
    });

    it('should enforce minimum reason length', () => {
      const shortReasonRefund = {
        paymentId: 'pay_short_reason',
        amount: 5000,
        reason: 'Ok', // Too short
      };

      const result = validateRequest(RefundSchema, shortReasonRefund);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases and Boundary Values', () => {
    it('should handle boundary amount values correctly', () => {
      // Minimum valid amount
      const minAmount = validateRequest(InitializePaymentSchema, {
        amount: 100,
        currency: 'NGN',
        customer: 'test@example.com',
      });
      expect(minAmount.success).toBe(true);

      // Just below minimum
      const belowMin = validateRequest(InitializePaymentSchema, {
        amount: 99,
        currency: 'NGN',
        customer: 'test@example.com',
      });
      expect(belowMin.success).toBe(false);
    });

    it('should handle very long strings at maximum length', () => {
      const maxDescription = 'x'.repeat(500); // Exactly max length
      const overMaxDescription = 'x'.repeat(501); // Over max

      const validDesc = validateRequest(InitializePaymentSchema, {
        amount: 10000,
        currency: 'NGN',
        customer: 'test@example.com',
        description: maxDescription,
      });

      const invalidDesc = validateRequest(InitializePaymentSchema, {
        amount: 10000,
        currency: 'NGN',
        customer: 'test@example.com',
        description: overMaxDescription,
      });

      expect(validDesc.success).toBe(true);
      expect(invalidDesc.success).toBe(false);
    });

    it('should handle null and undefined values gracefully', () => {
      const nullResult = validateRequest(InitializePaymentSchema, null as any);
      expect(nullResult.success).toBe(false);

      const undefinedResult = validateRequest(InitializePaymentSchema, undefined as any);
      expect(undefinedResult.success).toBe(false);
    });

    it('should handle extra/unknown fields gracefully', () => {
      const extraFields = {
        amount: 10000,
        currency: 'NGN',
        customer: 'test@example.com',
        unknownField: 'should be ignored',
        anotherUnknown: 12345,
      };

      // Zod by default strips unknown fields or ignores them
      const result = validateRequest(InitializePaymentSchema, extraFields);
      expect(result.success).toBe(true);
    });
  });
});
