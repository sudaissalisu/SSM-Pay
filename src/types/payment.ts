/**
 * Payment Type Definitions
 * TypeScript types for payment-related entities
 * 
 * @module types/payment
 */

// ============== Common Types Used Across Modules ==============

export type CurrencyCode =
  | 'NGN'
  | 'USD'
  | 'GBP'
  | 'EUR'
  | 'GHS'
  | 'ZAR'
  | 'KES'
  | 'XOF'
  | 'XAF'
  | 'UGX'
  | 'TZS'
  | 'RWF'
  | 'BIF'
  | 'MAD';

// ============== Payment Types ==============

export interface Payment {
  id: string;
  reference: string;
  amount: number;
  currency: CurrencyCode;
  status: PaymentStatus;
  customer: Customer; // Import from customer module
  method: PaymentMethod;
  metadata: PaymentMetadata;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  refundedAt?: Date;
}

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'expired'
  | 'cancelled';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  provider: PaymentProvider;
  last4Digits?: string;
  bankName?: string;
  accountName?: string;
  walletAddress?: string;
  ussdNumber?: string;
  expiryDate?: string;
  issuer?: string;
  country?: string;
  isDefault: boolean;
  verified: boolean;
  addedAt: Date;
}

export type PaymentMethodType = 
  | 'card'
  | 'bank_transfer'
  | 'wallet'
  | 'ussd'
  | 'qr_code'
  | 'pay_with_points';

export type PaymentProvider = 
  | 'zainpay'
  | 'flutterwave'
  | 'paystack'
  | 'stripe'
  | 'paypal';

export interface PaymentMetadata {
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  sessionId: string;
  fraudScore?: number;
  riskLevel?: RiskLevel;
  threeDSecureAuthenticated?: boolean;
  avsResult?: AVSResult;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AVSResult = { addressMatch: boolean; zipMatch: boolean; cvvMatch: boolean };

// Forward declaration for Customer (defined in customer.ts)
// This will be properly resolved through the barrel export
export interface Customer {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth?: Date;
  kycLevel: import('./customer').KYCLevel;
  tier: import('./customer').CustomerTier;
  status: import('./customer').CustomerStatus;
  addresses: import('./customer').Address[];
  paymentMethods: PaymentMethod[];
  preferences: import('./customer').CustomerPreferences;
  metadata: import('./customer').CustomerMetadata;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}
