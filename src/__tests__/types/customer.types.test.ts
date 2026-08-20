/**
 * @fileoverview Test suite for Customer type definitions
 * @module types/customer.test
 */

import { describe, it, expect } from 'vitest';
import {
  KYCStatus,
  IdentityDocumentType,
  CustomerTier,
  CustomerStatus,
  type Customer,
  type CustomerRequest,
  type KYCVerification,
  type CustomerPreferences,
  type NotificationPreferences,
  type PaymentPreferences,
  type SecurityPreferences,
  type DisplayPreferences,
  type CommunicationPreferences,
  type ValidationError,
} from '@/types/customer';

describe('Customer Types', () => {
  
  describe('KYCStatus Enum', () => {
    it('should have all expected KYC status values', () => {
      expect(KYCStatus.NOT_STARTED).toBe('not_started');
      expect(KYCStatus.PENDING).toBe('pending');
      expect(KYCStatus.IN_PROGRESS).toBe('in_progress');
      expect(KYCStatus.VERIFIED).toBe('verified');
      expect(KYCStatus.FAILED).toBe('failed');
      expect(KYCStatus.REJECTED).toBe('rejected');
      expect(KYCStatus.EXPIRED).toBe('expired');
      expect(KYCStatus.SUSPENDED).toBe('suspended');
    });

    it('should have exactly 8 KYC status values', () => {
      const statusValues = Object.values(KYCStatus);
      expect(statusValues).toHaveLength(8);
    });

    it('should represent verification lifecycle states', () => {
      const lifecycleStates = [
        KYCStatus.NOT_STARTED,
        KYCStatus.PENDING,
        KYCStatus.IN_PROGRESS,
        KYCStatus.VERIFIED,
      ];
      
      lifecycleStates.forEach(state => {
        expect(typeof state).toBe('string');
      });
    });

    it('should include terminal states that prevent retry', () => {
      const terminalStates = [KYCStatus.REJECTED, KYCStatus.SUSPENDED];
      terminalStates.forEach(state => {
        expect(Object.values(KYCStatus)).toContain(state);
      });
    });
  });

  describe('IdentityDocumentType Enum', () => {
    it('should define accepted identity documents', () => {
      expect(IdentityDocumentType.NIN).toBe('nin');
      expect(IdentityDocumentType.PASSPORT).toBe('passport');
      expect(IdentityDocumentType.DRIVERS_LICENSE).toBe('drivers_license');
      expect(IdentityDocumentType.VOTERS_CARD).toBe('voters_card');
      expect(IdentityDocumentType.PVC).toBe('pvc');
    });

    it('should have exactly 5 document types', () => {
      const docTypes = Object.values(IdentityDocumentType);
      expect(docTypes).toHaveLength(5);
    });
  });

  describe('CustomerTier Enum', () => {
    it('should define customer tier levels', () => {
      expect(CustomerTier.BASIC).toBe('basic');
      expect(CustomerTier.STANDARD).toBe('standard');
      expect(CustomerTier.PREMIUM).toBe('premium');
      expect(CustomerTier.ENTERPRISE).toBe('enterprise');
    });

    it('should represent progressive access levels', () => {
      const tiers = Object.values(CustomerTier);
      expect(tiers).toHaveLength(4);
    });
  });

  describe('CustomerStatus Enum', () => {
    it('should define account status options', () => {
      expect(CustomerStatus.ACTIVE).toBe('active');
      expect(CustomerStatus.SUSPENDED).toBe('suspended');
      expect(CustomerStatus.CLOSED).toBe('closed');
      expect(CustomerStatus.UNDER_REVIEW).toBe('under_review');
      expect(CustomerStatus.FROZEN).toBe('frozen');
    });

    it('should have exactly 5 account statuses', () => {
      const statuses = Object.values(CustomerStatus);
      expect(statuses).toHaveLength(5);
    });
  });

  describe('Customer Interface Construction', () => {
    it('should construct a valid Customer with required fields', () => {
      const now = new Date();
      const customer: Customer = {
        id: 'cust_abc123',
        email: 'john.doe@example.com',
        status: CustomerStatus.ACTIVE,
        tier: CustomerTier.BASIC,
        kyc: {
          status: KYCStatus.NOT_STARTED,
          attemptCount: 0,
          maxAttempts: 3,
          addressVerified: false,
        },
        preferences: createDefaultPreferences(),
        createdAt: now,
        updatedAt: now,
      };

      expect(customer.id).toBe('cust_abc123');
      expect(customer.email).toBe('john.doe@example.com');
      expect(customer.status).toBe(CustomerStatus.ACTIVE);
      expect(customer.tier).toBe(CustomerTier.BASIC);
      expect(customer.kyc.status).toBe(KYCStatus.NOT_STARTED);
    });

    it('should construct a complete Customer with all fields', () => {
      const now = new Date();
      const customer: Customer = {
        id: 'cust_full_001',
        email: 'jane.doe@example.com',
        phone: '+2348012345678',
        firstName: 'Jane',
        lastName: 'Doe',
        middleName: 'Marie',
        displayName: 'Jane M. Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        status: CustomerStatus.ACTIVE,
        tier: CustomerTier.PREMIUM,
        kyc: {
          status: KYCStatus.VERIFIED,
          documentType: IdentityDocumentType.PASSPORT,
          documentNumber: 'A12345678',
          submittedAt: new Date(now.getTime() - 86400000),
          verifiedAt: new Date(now.getTime() - 43200000),
          attemptCount: 1,
          maxAttempts: 3,
          bvn: '12345678901',
          nin: '98765432101',
          addressVerified: true,
        },
        preferences: createDefaultPreferences(),
        metadata: { segment: 'premium' },
        zainboxId: 'zb_12345',
        createdAt: new Date(now.getTime() - 30 * 86400000),
        updatedAt: now,
        lastActiveAt: now,
      };

      expect(customer.firstName).toBe('Jane');
      expect(customer.lastName).toBe('Doe');
      expect(customer.phone).toBe('+2348012345678');
      expect(customer.kyc.status).toBe(KYCStatus.VERIFIED);
      expect(customer.zainboxId).toBe('zb_12345');
    });

    it('should accept different customer statuses and tiers', () => {
      const baseCustomer = {
        id: 'cust_variants',
        email: 'test@example.com',
        kyc: { status: KYCStatus.NOT_STARTED, attemptCount: 0, maxAttempts: 3, addressVerified: false },
        preferences: createDefaultPreferences(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      Object.values(CustomerStatus).forEach(status => {
        const customer: Customer = { ...baseCustomer, status };
        expect(customer.status).toBe(status);
      });

      Object.values(CustomerTier).forEach(tier => {
        const customer: Customer = { ...baseCustomer, tier };
        expect(customer.tier).toBe(tier);
      });
    });
  });

  describe('CustomerRequest Validation', () => {
    it('should validate minimum required fields', () => {
      const request: CustomerRequest = {
        email: 'newcustomer@example.com',
      };

      expect(request.email).toBeDefined();
      expect(typeof request.email).toBe('string');
      expect(request.email).toContain('@');
    });

    it('should accept all optional CustomerRequest fields', () => {
      const request: CustomerRequest = {
        email: 'full.customer@example.com',
        phone: '+2349012345678',
        firstName: 'Full',
        lastName: 'Customer',
        middleName: 'Test',
        displayName: 'Full T. Customer',
        avatarUrl: 'https://example.com/avatar.png',
        metadata: { source: 'web' },
        externalId: 'ext_cust_001',
        group: 'retail',
        tier: CustomerTier.STANDARD,
        preferredChannels: ['email', 'sms'],
      };

      expect(request.firstName).toBe('Full');
      expect(request.preferredChannels).toContain('email');
      expect(request.group).toBe('retail');
    });

    it('should handle various email formats', () => {
      const validEmails = [
        'simple@example.com',
        'very.common@example.com',
        'disposable.style.email.with+symbol@example.com',
        'user@localhost',
        'admin@mail.server1.example.com',
      ];

      validEmails.forEach(email => {
        const request: CustomerRequest = { email };
        expect(request.email).toBe(email);
      });
    });
  });

  describe('KYCVerification Interface', () => {
    it('should construct minimal KYC verification state', () => {
      const kyc: KYCVerification = {
        status: KYCStatus.NOT_STARTED,
        attemptCount: 0,
        maxAttempts: 3,
        addressVerified: false,
      };

      expect(kyc.status).toBe(KYCStatus.NOT_STARTED);
      expect(kyc.attemptCount).toBe(0);
      expect(kyc.maxAttempts).toBe(3);
      expect(kyc.addressVerified).toBe(false);
    });

    it('should construct full KYC verification with document info', () => {
      const now = new Date();
      const kyc: KYCVerification = {
        status: KYCStatus.VERIFIED,
        documentType: IdentityDocumentType.NIN,
        documentNumber: 'NIN12345678',
        documentUrl: 'https://storage.example.com/docs/nin.pdf',
        submittedAt: new Date(now.getTime() - 172800000),
        verifiedAt: new Date(now.getTime() - 86400000),
        expiresAt: new Date(now.getTime() + 365 * 86400000),
        rejectionReason: undefined,
        reviewedBy: 'reviewer_001',
        attemptCount: 2,
        maxAttempts: 3,
        bvn: '12345678901',
        nin: 'NIN98765432',
        selfieUrl: 'https://storage.example.com/selfies/user.jpg',
        addressVerified: true,
        notes: 'All documents verified successfully',
      };

      expect(kyc.documentType).toBe(IdentityDocumentType.NIN);
      expect(kyc.bvn).toBe('12345678901');
      expect(kyc.addressVerified).toBe(true);
      expect(kyc.notes).toBeDefined();
    });

    it('should handle failed/rejected KYC states', () => {
      const failedKyc: KYCVerification = {
        status: KYCStatus.FAILED,
        attemptCount: 3,
        maxAttempts: 3,
        rejectionReason: 'Document quality too low',
        addressVerified: false,
      };

      expect(failedKyc.status).toBe(KYCStatus.FAILED);
      expect(failedKyc.rejectionReason).toBe('Document quality too low');

      const rejectedKyc: KYCVerification = {
        status: KYCStatus.REJECTED,
        attemptCount: 2,
        maxAttempts: 3,
        rejectionReason: 'Suspicious activity detected',
        reviewedBy: 'fraud_team',
        addressVerified: false,
      };

      expect(rejectedKyc.status).toBe(KYCStatus.REJECTED);
    });
  });

  describe('CustomerPreferences Interfaces', () => {
    it('should construct complete notification preferences', () => {
      const notifications: NotificationPreferences = {
        email: true,
        sms: true,
        push: false,
        whatsapp: false,
        onPaymentReceived: true,
        onPaymentSent: true,
        onFailedTransaction: true,
        onKycStatusChange: true,
        marketingEmails: false,
        dailyDigest: true,
        weeklySummary: false,
      };

      expect(notifications.email).toBe(true);
      expect(notifications.push).toBe(false);
      expect(notifications.onPaymentReceived).toBe(true);
    });

    it('should construct payment preferences', () => {
      const payment: PaymentPreferences = {
        defaultCurrency: 'NGN',
        preferredMethods: ['card', 'bank_transfer'],
        saveCards: true,
        requireConfirmation: true,
        confirmationThreshold: 100000,
        biometricAuth: false,
        autoAcceptTransfers: false,
        monthlySpendingLimit: 5000000,
      };

      expect(payment.defaultCurrency).toBe('NGN');
      expect(payment.preferredMethods).toHaveLength(2);
      expect(payment.confirmationThreshold).toBe(100000);
    });

    it('should construct security preferences', () => {
      const security: SecurityPreferences = {
        twoFactorEnabled: true,
        twoFactorMethod: 'app',
        sessionTimeout: 30,
        loginNotifications: true,
        passwordChangeFrequency: 90,
        deviceManagement: true,
        trustedDevices: [
          {
            deviceId: 'dev_001',
            name: 'Chrome on Windows',
            type: 'desktop',
            os: 'Windows 11',
            browser: 'Chrome 120',
            lastUsedAt: new Date(),
            ipAddress: '192.168.1.1',
            isTrusted: true,
          },
        ],
        ipWhitelist: ['192.168.1.0/24'],
        transactionSigning: false,
        transactionSigningThreshold: 1000000,
      };

      expect(security.twoFactorEnabled).toBe(true);
      expect(security.trustedDevices).toHaveLength(1);
      expect(security.ipWhitelist).toContain('192.168.1.0/24');
    });

    it('should construct display preferences', () => {
      const display: DisplayPreferences = {
        theme: 'dark',
        dateFormat: 'DD/MM/YYYY',
        numberLocale: 'en-NG',
        showCurrencySymbol: true,
        compactNumbers: false,
        dashboardLayout: 'detailed',
      };

      expect(display.theme).toBe('dark');
      expect(display.dateFormat).toBe('DD/MM/YYYY');
    });

    it('should construct communication preferences', () => {
      const communication: CommunicationPreferences = {
        primaryChannel: 'email',
        secondaryChannel: 'whatsapp',
        optOutMarketing: true,
        contactHours: {
          start: 8,
          end: 18,
          timezone: 'Africa/Lagos',
        },
      };

      expect(communication.primaryChannel).toBe('email');
      expect(communication.contactHours.start).toBe(8);
    });
  });

  describe('ValidationError Interface', () => {
    it('should construct validation error objects', () => {
      const error: ValidationError = {
        field: 'email',
        message: 'Invalid email format',
        code: 'INVALID_EMAIL',
        details: { providedValue: 'not-an-email' },
      };

      expect(error.field).toBe('email');
      expect(error.code).toBe('INVALID_EMAIL');
      expect(error.details?.providedValue).toBe('not-an-email');
    });

    it('should work without optional details', () => {
      const error: ValidationError = {
        field: 'phone',
        message: 'Phone number is required',
        code: 'REQUIRED_FIELD',
      };

      expect(error.field).toBe('phone');
      expect(error.details).toBeUndefined();
    });
  });
});

/**
 * Helper function to create default customer preferences for testing
 */
function createDefaultPreferences(): CustomerPreferences {
  return {
    language: 'en',
    timezone: 'Africa/Lagos',
    notifications: {
      email: true,
      sms: false,
      push: false,
      whatsapp: false,
      onPaymentReceived: true,
      onPaymentSent: true,
      onFailedTransaction: true,
      onKycStatusChange: true,
      marketingEmails: false,
      dailyDigest: false,
      weeklySummary: false,
    },
    payment: {
      defaultCurrency: 'NGN',
      preferredMethods: ['card'],
      saveCards: false,
      requireConfirmation: false,
      confirmationThreshold: 500000,
      biometricAuth: false,
      autoAcceptTransfers: false,
      monthlySpendingLimit: 0,
    },
    security: {
      twoFactorEnabled: false,
      twoFactorMethod: 'sms',
      sessionTimeout: 60,
      loginNotifications: true,
      passwordChangeFrequency: 0,
      deviceManagement: false,
      transactionSigning: false,
      transactionSigningThreshold: 0,
    },
    display: {
      theme: 'system',
      dateFormat: 'DD/MM/YYYY',
      numberLocale: 'en-NG',
      showCurrencySymbol: true,
      compactNumbers: false,
      dashboardLayout: 'default',
    },
    communication: {
      primaryChannel: 'email',
      optOutMarketing: false,
    },
  };
}
