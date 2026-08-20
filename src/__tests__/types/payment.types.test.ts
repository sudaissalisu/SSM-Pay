/**
 * @fileoverview Test suite for Payment type definitions
 * @module types/payment.test
 */

import { describe, it, expect } from 'vitest';
import {
  PaymentStatus,
  PaymentMethod,
  Currency,
  CardScheme,
  PaymentChannel,
  type Payment,
  type InitializePaymentRequest,
  type VerifyPaymentResponse,
  type Money,
  type InitializePaymentResponse,
  type RefundRequest,
  type PaymentCallbackPayload,
  type PaymentConfig,
  type CardDetails,
  type SplitConfig,
  type PaymentListParams,
  type PaymentListResponse,
} from '@/types/payment';

describe('Payment Types', () => {
  
  describe('PaymentStatus Enum', () => {
    it('should have all expected status values', () => {
      expect(PaymentStatus.INITIALIZED).toBe('initialized');
      expect(PaymentStatus.PENDING).toBe('pending');
      expect(PaymentStatus.COMPLETED).toBe('completed');
      expect(PaymentStatus.FAILED).toBe('failed');
      expect(PaymentStatus.REFUNDED).toBe('refunded');
      expect(PaymentStatus.EXPIRED).toBe('expired');
    });

    it('should have exactly 6 status values', () => {
      const statusValues = Object.values(PaymentStatus);
      expect(statusValues).toHaveLength(6);
    });

    it('should contain string enum values for state machine compatibility', () => {
      const values = Object.values(PaymentStatus);
      values.forEach(value => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe('PaymentMethod Enum', () => {
    it('should have all expected payment methods', () => {
      expect(PaymentMethod.CARD).toBe('card');
      expect(PaymentMethod.BANK_TRANSFER).toBe('bank_transfer');
      expect(PaymentMethod.USSD).toBe('ussd');
      expect(PaymentMethod.TRANSFER).toBe('transfer');
      expect(PaymentMethod.QRCODE).toBe('qrcode');
    });

    it('should have exactly 5 payment methods', () => {
      const methods = Object.values(PaymentMethod);
      expect(methods).toHaveLength(5);
    });
  });

  describe('Currency Enum', () => {
    it('should have all expected currencies', () => {
      expect(Currency.NGN).toBe('NGN');
      expect(Currency.USD).toBe('USD');
      expect(Currency.GBP).toBe('GBP');
      expect(Currency.EUR).toBe('EUR');
    });

    it('should use ISO 4217 currency codes', () => {
      const validCodes = ['NGN', 'USD', 'GBP', 'EUR'];
      Object.values(Currency).forEach(code => {
        expect(validCodes).toContain(code);
      });
    });
  });

  describe('CardScheme Enum', () => {
    it('should define major card schemes', () => {
      expect(CardScheme.VISA).toBe('visa');
      expect(CardScheme.MASTERCARD).toBe('mastercard');
      expect(CardScheme.VERVE).toBe('verve');
      expect(CardScheme.AMEX).toBe('amex');
      expect(CardScheme.DISCOVER).toBe('discover');
    });
  });

  describe('PaymentChannel Enum', () => {
    it('should define payment channels', () => {
      expect(PaymentChannel.WEB).toBe('web');
      expect(PaymentChannel.API).toBe('api');
      expect(PaymentChannel.MOBILE).toBe('mobile');
      expect(PaymentChannel.POS).toBe('pos');
      expect(PaymentChannel.INVOICE).toBe('invoice');
    });
  });

  describe('Payment Interface Construction', () => {
    it('should construct a valid Payment object with required fields', () => {
      const now = new Date();
      const payment: Payment = {
        id: 'pay_1234567890',
        amount: 50000,
        currency: Currency.NGN,
        status: PaymentStatus.COMPLETED,
        method: PaymentMethod.CARD,
        customerId: 'cust_abc123',
        reference: 'ref_xyz789',
        createdAt: now,
        updatedAt: now,
      };

      expect(payment.id).toBe('pay_1234567890');
      expect(payment.amount).toBe(50000);
      expect(payment.currency).toBe(Currency.NGN);
      expect(payment.status).toBe(PaymentStatus.COMPLETED);
      expect(payment.method).toBe(PaymentMethod.CARD);
      expect(payment.customerId).toBe('cust_abc123');
      expect(payment.reference).toBe('ref_xyz789');
    });

    it('should construct a Payment object with optional fields', () => {
      const now = new Date();
      const payment: Payment = {
        id: 'pay_full_test',
        amount: 100000,
        currency: Currency.USD,
        status: PaymentStatus.PENDING,
        method: PaymentMethod.BANK_TRANSFER,
        customerId: 'cust_def456',
        reference: 'full_ref_123',
        externalId: 'ext_789',
        channel: PaymentChannel.API,
        description: 'Test payment',
        metadata: { source: 'test' },
        failureReason: undefined,
        fee: 500,
        createdAt: now,
        updatedAt: now,
        completedAt: undefined,
        expiresAt: new Date(now.getTime() + 1800000),
      };

      expect(payment.externalId).toBe('ext_789');
      expect(payment.channel).toBe(PaymentChannel.API);
      expect(payment.description).toBe('Test payment');
      expect(payment.metadata?.source).toBe('test');
      expect(payment.fee).toBe(500);
      expect(payment.expiresAt).toBeDefined();
    });

    it('should accept different payment statuses', () => {
      const basePayment = {
        id: 'pay_status_test',
        amount: 1000,
        currency: Currency.NGN,
        method: PaymentMethod.CARD,
        customerId: 'cust_test',
        reference: 'ref_test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      Object.values(PaymentStatus).forEach(status => {
        const payment: Payment = { ...basePayment, status };
        expect(payment.status).toBe(status);
      });
    });
  });

  describe('InitializePaymentRequest Interface', () => {
    it('should construct valid request with minimum fields', () => {
      const request: InitializePaymentRequest = {
        amount: 50000,
        currency: Currency.NGN,
        customer: 'customer@example.com',
      };

      expect(request.amount).toBe(50000);
      expect(request.currency).toBe(Currency.NGN);
      expect(request.customer).toBe('customer@example.com');
    });

    it('should construct request with all optional fields', () => {
      const request: InitializePaymentRequest = {
        amount: 25000,
        currency: Currency.USD,
        customer: 'cust_123',
        method: PaymentMethod.QRCODE,
        reference: 'custom_ref_001',
        description: 'Custom payment',
        callbackUrl: 'https://example.com/callback',
        redirectUrl: 'https://example.com/success',
        metadata: { orderId: 'ord_123' },
        allowPartialPayment: true,
        maxRetries: 3,
        expiresIn: 15,
        bankAccount: 'acct_001',
        ussdCode: '*123#',
      };

      expect(request.method).toBe(PaymentMethod.QRCODE);
      expect(request.allowPartialPayment).toBe(true);
      expect(request.maxRetries).toBe(3);
      expect(request.expiresIn).toBe(15);
    });
  });

  describe('VerifyPaymentResponse Interface', () => {
    it('should construct valid verification response', () => {
      const now = new Date();
      const payment: Payment = {
        id: 'pay_verified',
        amount: 10000,
        currency: Currency.NGN,
        status: PaymentStatus.COMPLETED,
        method: PaymentMethod.USSD,
        customerId: 'cust_verify',
        reference: 'ref_verified',
        createdAt: now,
        updatedAt: now,
      };

      const response: VerifyPaymentResponse = {
        success: true,
        message: 'Payment verified successfully',
        status: PaymentStatus.COMPLETED,
        data: payment,
        verifiedAt: now,
        riskScore: 15,
        threeDSStatus: 'authenticated',
      };

      expect(response.success).toBe(true);
      expect(response.status).toBe(PaymentStatus.COMPLETED);
      expect(response.riskScore).toBe(15);
      expect(response.threeDSStatus).toBe('authenticated');
      expect(response.data).toEqual(payment);
    });

    it('should handle response without optional risk score', () => {
      const now = new Date();
      const payment: Payment = {
        id: 'pay_no_risk',
        amount: 5000,
        currency: Currency.EUR,
        status: PaymentStatus.PENDING,
        method: PaymentMethod.TRANSFER,
        customerId: 'cust_nr',
        reference: 'ref_nr',
        createdAt: now,
        updatedAt: now,
      };

      const response: VerifyPaymentResponse = {
        success: true,
        message: 'Verification pending',
        status: PaymentStatus.PENDING,
        data: payment,
        verifiedAt: now,
      };

      expect(response.riskScore).toBeUndefined();
      expect(response.threeDSStatus).toBeUndefined();
    });
  });

  describe('Money Interface', () => {
    it('should represent monetary amounts correctly', () => {
      const money: Money = {
        amount: 99999,
        currency: Currency.GBP,
      };

      expect(money.amount).toBe(99999);
      expect(money.currency).toBe(Currency.GBP);
    });
  });

  describe('InitializePaymentResponse Interface', () => {
    it('should construct complete initialization response', () => {
      const now = new Date();
      const payment: Payment = {
        id: 'pay_init_resp',
        amount: 75000,
        currency: Currency.NGN,
        status: PaymentStatus.INITIALIZED,
        method: PaymentMethod.CARD,
        customerId: 'cust_init',
        reference: 'ref_init',
        createdAt: now,
        updatedAt: now,
      };

      const response: InitializePaymentResponse = {
        success: true,
        message: 'Payment initialized',
        data: payment,
        authorizationUrl: 'https://pay.example.com/authorize/pay_init_resp',
        accessCode: 'ac_abc123',
        bankDetails: {
          bankName: 'Test Bank',
          accountNumber: '0123456789',
          accountName: 'Test Account',
          sortCode: '01-02-03',
        },
        expiresAt: new Date(now.getTime() + 1800000),
      };

      expect(response.success).toBe(true);
      expect(response.authorizationUrl).toContain('authorize');
      expect(response.accessCode).toBe('ac_abc123');
      expect(response.bankDetails?.bankName).toBe('Test Bank');
    });
  });

  describe('RefundRequest Interface', () => {
    it('should construct valid refund request', () => {
      const refundRequest: RefundRequest = {
        paymentId: 'pay_to_refund',
        amount: 25000,
        reason: 'Customer requested refund',
        reference: 'refund_ref_001',
        notifyCustomer: true,
        initiatedBy: 'admin_123',
      };

      expect(refundRequest.paymentId).toBe('pay_to_refund');
      expect(refundRequest.amount).toBe(25000);
      expect(refundRequest.reason).toBe('Customer requested refund');
      expect(refundRequest.notifyCustomer).toBe(true);
    });
  });

  describe('PaymentCallbackPayload Interface', () => {
    it('should construct webhook callback payload', () => {
      const now = new Date();
      const payment: Payment = {
        id: 'pay_callback',
        amount: 30000,
        currency: Currency.NGN,
        status: PaymentStatus.COMPLETED,
        method: PaymentMethod.CARD,
        customerId: 'cust_cb',
        reference: 'ref_cb',
        createdAt: now,
        updatedAt: now,
      };

      const payload: PaymentCallbackPayload = {
        event: 'payment.completed',
        data: payment,
        timestamp: now,
        signature: 'sha256=abc123...',
        attempt: 1,
      };

      expect(payload.event).toBe('payment.completed');
      expect(payload.signature).toContain('sha256=');
      expect(payload.attempt).toBe(1);
    });
  });

  describe('PaymentConfig Interface', () => {
    it('should construct complete payment configuration', () => {
      const config: PaymentConfig = {
        isTestMode: false,
        defaultCurrency: Currency.NGN,
        require3DS: true,
        maxAmount: 1000000,
        minAmount: 100,
        supportedMethods: [
          PaymentMethod.CARD,
          PaymentMethod.BANK_TRANSFER,
          PaymentMethod.USSD,
          PaymentMethod.TRANSFER,
        ],
        webhookSecret: 'whsec_test_secret',
        callbackTimeout: 15000,
        enableWebhookRetry: true,
        maxWebhookRetries: 5,
      };

      expect(config.isTestMode).toBe(false);
      expect(config.require3DS).toBe(true);
      expect(config.supportedMethods).toHaveLength(4);
      expect(config.maxWebhookRetries).toBe(5);
    });
  });

  describe('Type Exports Existence', () => {
    it('should export SplitConfig interface', () => {
      const splitConfig: SplitConfig = {
        id: 'split_001',
        type: 'percentage',
        recipients: [
          { recipientId: 'acc_1', value: 80, type: 'subaccount' },
          { recipientId: 'acc_2', value: 20, type: 'wallet' },
        ],
        totalSplit: 100,
        feeBearer: 'sender',
      };
      expect(splitConfig.type).toBe('percentage');
      expect(splitConfig.recipients).toHaveLength(2);
    });

    it('should export PaymentListParams interface', () => {
      const params: PaymentListParams = {
        page: 1,
        perPage: 20,
        status: PaymentStatus.COMPLETED,
        method: PaymentMethod.CARD,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };
      expect(params.page).toBe(1);
      expect(params.perPage).toBe(20);
    });

    it('should export PaymentListResponse interface', () => {
      const listResponse: PaymentListResponse = {
        data: [],
        meta: {
          currentPage: 1,
          totalPages: 5,
          totalItems: 100,
          perPage: 20,
          hasNextPage: true,
          hasPrevPage: false,
        },
      };
      expect(listResponse.meta.totalItems).toBe(100);
      expect(listResponse.meta.hasNextPage).toBe(true);
    });

    it('should export CardDetails interface', () => {
      const cardDetails: CardDetails = {
        bin: '424242',
        last4: '4242',
        scheme: CardScheme.VISA,
        expiryMonth: 12,
        expiryYear: 2028,
        holderName: 'Test User',
        bank: 'Test Bank',
        country: 'US',
        isInternational: false,
      };
      expect(cardDetails.bin).toBe('424242');
      expect(cardDetails.scheme).toBe(CardScheme.VISA);
    });
  });
});
