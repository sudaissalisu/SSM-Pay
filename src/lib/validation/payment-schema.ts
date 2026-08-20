/**
 * Payment Validation Schemas for SSM-Pay Platform
 * 
 * These schemas are used at API boundaries to validate all payment-related
 * input data before processing. They ensure data integrity and provide
 * meaningful error messages to clients.
 */

import { z } from 'zod';

// ============================================================================
// Enum Definitions
// ============================================================================

/**
 * Supported payment statuses in the system
 */
export const PaymentStatusEnum = z.enum([
  'INITIALIZED',
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REFUNDED',
  'EXPIRED',
], {
  message: 'Invalid payment status provided',
});

export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

/**
 * Available payment methods
 */
export const PaymentMethodEnum = z.enum([
  'CARD',
  'BANK_TRANSFER',
  'USSD',
  'TRANSFER',
  'QRCODE',
], {
  message: 'Invalid payment method selected',
});

export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

/**
 * Supported currencies for transactions
 */
export const CurrencyEnum = z.enum([
  'NGN',
  'USD',
  'GBP',
  'EUR',
], {
  message: 'Unsupported currency code',
});

export type Currency = z.infer<typeof CurrencyEnum>;

/**
 * Card networks supported by the platform
 */
export const CardNetworkEnum = z.enum([
  'VISA',
  'MASTERCARD',
  'VERVE',
  'AMEX',
  'DISCOVER',
], {
  message: 'Invalid card network',
});

export type CardNetwork = z.infer<typeof CardNetworkEnum>;

/**
 * Transaction types classification
 */
export const TransactionTypeEnum = z.enum([
  'CREDIT',
  'DEBIT',
  'REFUND',
  'REVERSAL',
  'TRANSFER',
], {
  message: 'Invalid transaction type',
});

export type TransactionType = z.infer<typeof TransactionTypeEnum>;

// ============================================================================
// Base Schemas (Reusable Components)
// ============================================================================

/**
 * Amount validation - shared across multiple schemas
 */
const AmountSchema = z.number()
  .positive('Amount must be a positive value')
  .max(100000000, 'Amount exceeds maximum allowed limit of ₦100,000,000');

/**
 * Email validation with custom error messages
 */
const EmailSchema = z.email('Please provide a valid email address')
  .min(5, 'Email address is too short')
  .max(254, 'Email address exceeds maximum length');

/**
 * Reference/ID string validation
 */
const ReferenceSchema = z.string()
  .min(8, 'Reference must be at least 8 characters')
  .max(50, 'Reference cannot exceed 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Reference can only contain alphanumeric characters, hyphens, and underscores');

/**
 * UUID validation helper
 */
const UuidSchema = z.uuid('Invalid UUID format provided');

// ============================================================================
// Initialize Payment Schema
// ============================================================================

/**
 * Schema for initializing a new payment transaction
 * This is the primary entry point for creating payments
 */
export const InitializePaymentSchema = z.object({
  // Required fields
  amount: AmountSchema,
  
  currency: CurrencyEnum.default('NGN'),
  
  email: EmailSchema,
  
  // Optional customer information
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name cannot exceed 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name contains invalid characters')
    .optional(),
    
  lastName: z.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name cannot exceed 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name contains invalid characters')
    .optional(),
  
  phone: z.string()
    .regex(/^(\+234|0)[789]\d{9}$/, 'Phone number must be a valid Nigerian number (e.g., +2348012345678 or 08012345678)')
    .optional(),
  
  // Payment configuration
  paymentMethod: PaymentMethodEnum.optional(),
  
  callbackUrl: z.url({ message: 'Callback URL must be a valid URL starting with http:// or https://' })
    .refine((val) => val.length <= 500, { message: 'Callback URL is too long' })
    .optional(),
  
  redirectUrl: z.url({ message: 'Redirect URL must be a valid URL' }).optional(),
  
  // Metadata for tracking/customization
  metadata: z.record(z.string(), z.unknown())
    .default({})
    .refine(
      (data) => JSON.stringify(data).length <= 5000,
      { message: 'Metadata size exceeds maximum allowed (5KB)' }
    ),
  
  // Reference identifiers
  reference: ReferenceSchema.optional(),
  
  customerId: UuidSchema.optional(),
  
  // Additional options
  description: z.string()
    .min(3, 'Description too short')
    .max(500, 'Description too long')
    .optional(),
  
  expiresIn: z.number()
    .int('Expiry time must be in whole minutes')
    .positive('Expiry time must be positive')
    .max(1440, 'Payment cannot expire after more than 24 hours (1440 minutes)')
    .default(30),
  
  splitCode: z.string()
    .min(1, 'Split code is required if provided')
    .max(50, 'Split code is invalid')
    .optional(),
}).refine(
  // Custom validation: ensure either reference or allow system generation
  (data) => !data.reference || data.reference.length >= 8,
  { message: 'Reference must be at least 8 characters if provided', path: ['reference'] }
);

// ============================================================================
// Verify Payment Schema
// ============================================================================

/**
 * Schema for verifying a completed payment
 * Used when checking payment status after redirect/callback
 */
export const VerifyPaymentSchema = z.object({
  reference: z.string().min(1, 'Transaction reference is required for verification'),
});

// ============================================================================
// Refund Schema
// ============================================================================

/**
 * Schema for processing refunds on transactions
 * Supports partial and full refunds
 */
export const RefundSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
  
  amount: z.number()
    .positive('Refund amount must be positive')
    .max(100000000, 'Refund amount exceeds maximum allowed')
    .optional(), // If omitted, full refund is assumed
  
  reason: z.string()
    .min(1, 'Refund reason is required')
    .max(500, 'Refund reason is too verbose')
    .regex(/^[a-zA-Z0-9\s.,!?'"()-]+$/, 'Reason contains invalid characters')
    .optional(),
  
  customerNote: z.string()
    .max(200, 'Customer note is too long')
    .optional(),
  
  merchantNote: z.string()
    .max(200, 'Merchant note is too long')
    .optional(),
  
  reference: z.string()
    .min(6, 'Refund reference too short')
    .max(50, 'Refund reference too long')
    .optional(),
}).refine(
  // Either amount or reason should be present for clarity
  (data) => data.amount !== undefined || data.reason !== undefined,
  { message: 'Either refund amount or reason must be provided', path: ['amount'] }
);

// ============================================================================
// Webhook Payload Schema
// ============================================================================

/**
 * Schema for validating incoming webhook payloads
 * Ensures webhook data integrity before processing
 */
export const WebhookPayloadSchema = z.object({
  event: z.string()
    .min(1, 'Event type cannot be empty')
    .regex(
      /^[a-z]+\.[a-z]+$/,
      'Event must follow format "resource.action" (e.g., charge.completed)'
    ),
  
  data: z.object({
    id: z.string(),
    
    status: PaymentStatusEnum,
    
    domain: z.string().optional(),
    
    amount: z.number(),
    
    currency: CurrencyEnum,
    
    customer: z.object({
      id: z.string().optional(),
      email: z.email('Invalid customer email in webhook data'),
      name: z.string().optional(),
      phone: z.string().optional(),
    }).optional(),
    
    reference: z.string().optional(),
    
    transactionId: z.string().optional(),
    
    createdAt: z.string().datetime({
      message: 'Created date must be a valid ISO datetime string',
    }),
    
    paidAt: z.string()
      .datetime()
      .nullable()
      .optional(),
    
    channel: z.string().optional(),
    
    metadata: z.record(z.string(), z.unknown()).optional(),
    
    fees: z.number().nonnegative().optional(),
  }),
  
  signature: z.string()
    .min(32, 'Webhook signature appears to be malformed'),
});

// ============================================================================
// Card Payment Schema
// ============================================================================

/**
 * Schema for direct card payment processing
 */
export const CardPaymentSchema = z.object({
  number: z.string()
    .regex(/^\d{13,19}$/, 'Card number must be between 13 and 19 digits')
    .transform((val) => val.replace(/\s/g, '')),
  
  expiryMonth: z.coerce.number()
    .int('Expiry month must be an integer')
    .min(1, 'Month must be between 01 and 12')
    .max(12, 'Month must be between 01 and 12'),
  
  expiryYear: z.coerce.number()
    .int('Expiry year must be an integer')
    .min(new Date().getFullYear() % 100, 'Card has expired or year is invalid')
    .max((new Date().getFullYear() % 100) + 20, 'Expiry year is too far in the future'),
  
  cvv: z.string()
    .regex(/^\d{3,4}$/, 'CVV must be 3 or 4 digits'),
  
  pin: z.string()
    .regex(/^\d{4}$/, 'PIN must be exactly 4 digits')
    .optional(),
  
  billingAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().length(2).optional(),
    zipCode: z.string().optional(),
  }).optional(),
}).refine(
  // Validate card using Luhn algorithm (basic check)
  (data) => {
    const { number } = data;
    let sum = 0;
    let isEven = false;
    for (let i = number.length - 1; i >= 0; i--) {
      let digit = parseInt(number[i], 10);
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }
    return sum % 10 === 0;
  },
  { message: 'Card number failed Luhn check - please verify the card details', path: ['number'] }
);

// ============================================================================
// Bank Transfer Schema
// ============================================================================

/**
 * Schema for bank transfer payment initialization
 */
export const BankTransferSchema = z.object({
  accountBank: z.string()
    .min(3, 'Bank code is required')
    .max(10, 'Invalid bank code format')
    .regex(/^\d+$/, 'Bank code must be numeric'),
  
  accountNumber: z.string()
    .regex(/^\d{10}$/, 'Account number must be exactly 10 digits'),
  
  bvn: z.string()
    .regex(/^\d{11}$/, 'BVN must be exactly 11 digits')
    .optional(),
  
  accountName: z.string()
    .min(2, 'Account name is required')
    .max(200, 'Account name is too long')
    .optional(),
  
  amount: AmountSchema,
  
  narration: z.string()
    .max(150, 'Transfer narration is too long')
    .optional(),
  
  reference: ReferenceSchema.optional(),
});

// ============================================================================
// Transfer/Payout Schema
// ============================================================================

/**
 * Schema for initiating transfers/payouts to bank accounts
 */
export const TransferSchema = z.object({
  amount: AmountSchema,
  
  recipient: z.object({
    type: z.enum(['nuban', 'mobile_money', 'authorization'], {
      message: 'Invalid recipient type',
    }),
    
    accountNumber: z.string()
      .regex(/^\d{10}$/, 'Recipient account number must be 10 digits'),
    
    bankCode: z.string()
      .min(3, 'Bank code is required')
      .regex(/^\d+$/, 'Bank code must be numeric'),
    
    name: z.string()
      .min(2, 'Recipient name is required')
      .max(200, 'Recipient name is too long'),
  }),
  
  reason: z.string()
    .max(255, 'Transfer reason is too long')
    .optional(),
  
  reference: ReferenceSchema.optional(),
  
  currency: CurrencyEnum.default('NGN'),
  
  sourceAccount: z.string().optional(),
  
  callbackUrl: z.url({ message: 'Callback URL must be valid' }).optional(),
}).transform((data) => ({
  ...data,
  processedAt: new Date().toISOString(),
}));

// ============================================================================
// Export Types
// ============================================================================

/** Input type for payment initialization */
export type InitializePaymentInput = z.infer<typeof InitializePaymentSchema>;

/** Input type for payment verification */
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>;

/** Input type for refund processing */
export type RefundInput = z.infer<typeof RefundSchema>;

/** Input type for webhook payload */
export type WebhookPayloadInput = z.infer<typeof WebhookPayloadSchema>;

/** Input type for card payments */
export type CardPaymentInput = z.infer<typeof CardPaymentSchema>;

/** Input type for bank transfer payments */
export type BankTransferInput = z.infer<typeof BankTransferSchema>;

/** Input type for transfers/payouts */
export type TransferInput = z.infer<typeof TransferSchema>;
