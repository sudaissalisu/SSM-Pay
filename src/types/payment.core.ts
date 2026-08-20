/**
 * @fileoverview Core Payment type definitions
 * @description Contains PaymentStatus, PaymentMethod, Currency enums + Payment interface
 * @module types/payment/core
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Represents the various states a payment can be in during its lifecycle.
 * Payments flow through these states from initialization to completion or failure.
 *
 * @enum {string}
 * @example
 * ```typescript
 * const status: PaymentStatus = PaymentStatus.COMPLETED;
 * if (payment.status === PaymentStatus.PENDING) {
 *   // Handle pending payment
 * }
 * ```
 */
export enum PaymentStatus {
  /** Payment has been initialized but not yet processed */
  INITIALIZED = 'initialized',
  /** Payment is awaiting completion by the customer */
  PENDING = 'pending',
  /** Payment has been successfully completed */
  COMPLETED = 'completed',
  /** Payment failed due to an error or insufficient funds */
  FAILED = 'failed',
  /** Payment has been refunded to the customer */
  REFUNDED = 'refunded',
  /** Payment expired before completion */
  EXPIRED = 'expired'
}

/**
 * Represents the available payment methods supported by the platform.
 * Each method has specific processing requirements and fee structures.
 *
 * @enum {string}
 * @example
 * ```typescript
 * const method: PaymentMethod = PaymentMethod.CARD;
 * ```
 */
export enum PaymentMethod {
  /** Credit or debit card payment (Visa, Mastercard, Verve) */
  CARD = 'card',
  /** Direct bank transfer via banking infrastructure */
  BANK_TRANSFER = 'bank_transfer',
  /** USSD-based payment for mobile banking */
  USSD = 'ussd',
  /** Account-to-account transfer */
  TRANSFER = 'transfer',
  /** QR code-based payment scanning */
  QRCODE = 'qrcode'
}

/**
 * Supported currencies for transactions on the SSM-Pay platform.
 * Additional currencies can be added based on market requirements.
 *
 * @enum {string}
 * @example
 * ```typescript
 * const currency: Currency = Currency.NGN;
 * ```
 */
export enum Currency {
  /** Nigerian Naira - Primary currency for Nigerian operations */
  NGN = 'NGN',
  /** United States Dollar - International standard */
  USD = 'USD',
  /** British Pound Sterling - UK operations */
  GBP = 'GBP',
  /** Euro - European Union operations */
  EUR = 'EUR'
}

/**
 * Card scheme types accepted by the platform.
 *
 * @enum {string}
 */
export enum CardScheme {
  VISA = 'visa',
  MASTERCARD = 'mastercard',
  VERVE = 'verve',
  AMEX = 'amex',
  DISCOVER = 'discover'
}

/**
 * Channels through which payments are initiated.
 *
 * @enum {string}
 */
export enum PaymentChannel {
  WEB = 'web',
  API = 'api',
  MOBILE = 'mobile',
  POS = 'pos',
  INVOICE = 'invoice'
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Represents a monetary amount with its currency.
 * Used for type-safe handling of financial values.
 *
 * @interface Money
 */
export interface Money {
  /** The numerical value of the amount */
  amount: number;
  /** The ISO 4217 currency code */
  currency: Currency;
}

/**
 * Core Payment entity representing a single payment transaction.
 * This is the central data structure for all payment operations.
 *
 * @interface Payment
 * @example
 * ```typescript
 * const payment: Payment = {
 *   id: 'pay_1234567890',
 *   amount: 50000,
 *   currency: Currency.NGN,
 *   status: PaymentStatus.COMPLETED,
 *   method: PaymentMethod.CARD,
 *   customerId: 'cust_abc123',
 *   reference: 'ref_xyz789',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * };
 * ```
 */
export interface Payment {
  /** Unique identifier for the payment (format: pay_xxxx) */
  id: string;
  /** The payment amount in minor units (kobo/cents) */
  amount: number;
  /** The currency of the payment */
  currency: Currency;
  /** Current status of the payment */
  status: PaymentStatus;
  /** Payment method used for this transaction */
  method: PaymentMethod;
  /** ID of the customer who initiated the payment */
  customerId: string;
  /** Unique reference code for reconciliation */
  reference: string;
  /** Optional external transaction ID from payment processor */
  externalId?: string;
  /** Channel through which payment was initiated */
  channel?: PaymentChannel;
  /** Description of the payment purpose */
  description?: string;
  /** Additional metadata attached to the payment */
  metadata?: Record<string, unknown>;
  /** Failure reason if payment failed */
  failureReason?: string;
  /** Fee charged for this transaction */
  fee?: number;
  /** Timestamp when payment was created */
  createdAt: Date;
  /** Timestamp when payment was last updated */
  updatedAt: Date;
  /** Timestamp when payment was completed (if applicable) */
  completedAt?: Date;
  /** Timestamp when payment expires */
  expiresAt?: Date;
}

// ============================================================================
// CONFIG AND CARD INTERFACES
// ============================================================================

/**
 * Configuration options for payment processing.
 *
 * @interface PaymentConfig
 */
export interface PaymentConfig {
  /** Enable sandbox/test mode */
  isTestMode: boolean;
  /** Default currency for transactions */
  defaultCurrency: Currency;
  /** Enable 3D Secure authentication */
  require3DS: boolean;
  /** Maximum transaction amount */
  maxAmount?: number;
  /** Minimum transaction amount */
  minAmount?: number;
  /** Supported payment methods */
  supportedMethods: PaymentMethod[];
  /** Webhook secret for signature verification */
  webhookSecret: string;
  /** Callback timeout in milliseconds */
  callbackTimeout: number;
  /** Enable automatic retries for failed webhooks */
  enableWebhookRetry: boolean;
  /** Maximum webhook retry attempts */
  maxWebhookRetries: number;
}

/**
 * Card details for card-based payments.
 * Note: Never store full card details - use tokenization.
 *
 * @interface CardDetails
 */
export interface CardDetails {
  /** First 6 digits (BIN) */
  bin: string;
  /** Last 4 digits */
  last4: string;
  /** Card scheme (Visa, Mastercard, etc.) */
  scheme: CardScheme;
  /** Cardholder name (masked) */
  holderName?: string;
  /** Expiry month */
  expiryMonth: number;
  /** Expiry year */
  expiryYear: number;
  /** Issuing bank name */
  bank?: string;
  /** Country of issuance (ISO 3166-1 alpha-2) */
  country?: string;
  /** Whether the card is international */
  isInternational?: boolean;
  /** Tokenized card reference for recurring payments */
  token?: string;
}

// ============================================================================
// SPLIT PAYMENT INTERFACES
// ============================================================================

/**
 * Split payment configuration for revenue sharing.
 *
 * @interface SplitConfig
 */
export interface SplitConfig {
  /** Unique split identifier */
  id: string;
  /** Split type - percentage or flat amount */
  type: 'percentage' | 'flat';
  /** Array of split recipients */
  recipients: SplitRecipient[];
  /** Total split amount/percentage (for validation) */
  totalSplit: number;
  /** Fee bearer - who pays transaction fees */
  feeBearer: 'sender' | 'recipients' | 'shared';
}

/**
 * Individual split recipient configuration.
 *
 * @interface SplitRecipient
 */
export interface SplitRecipient {
  /** Recipient identifier (account/wallet ID) */
  recipientId: string;
  /** Amount or percentage to receive */
  value: number;
  /** Recipient type */
  type: 'subaccount' | 'wallet' | 'bank_account';
  /** Optional metadata for the recipient */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// LIST INTERFACES
// ============================================================================

/**
 * Pagination parameters for listing payments.
 *
 * @interface PaymentListParams
 */
export interface PaymentListParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  perPage?: number;
  /** Filter by payment status */
  status?: PaymentStatus;
  /** Filter by payment method */
  method?: PaymentMethod;
  /** Filter by currency */
  currency?: Currency;
  /** Filter by customer ID */
  customerId?: string;
  /** Filter by date range start */
  dateFrom?: Date;
  /** Filter by date range end */
  dateTo?: Date;
  /** Minimum amount filter */
  amountFrom?: number;
  /** Maximum amount filter */
  amountTo?: number;
  /** Sort field */
  sortBy?: 'createdAt' | 'amount' | 'updatedAt';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response for payment listings.
 *
 * @interface PaymentListResponse
 */
export interface PaymentListResponse {
  /** Array of payments for current page */
  data: Payment[];
  /** Pagination metadata */
  meta: {
    /** Current page number */
    currentPage: number;
    /** Total number of pages */
    totalPages: number;
    /** Total number of items across all pages */
    totalItems: number;
    /** Items per page */
    perPage: number;
    /** Whether there are more pages */
    hasNextPage: boolean;
    /** Whether there is a previous page */
    hasPrevPage: boolean;
  };
}

// ============================================================================
// TYPE ALIASES
// ============================================================================

/**
 * Type representing valid payment identifiers (ID or reference).
 */
export type PaymentIdentifier = { id: string } | { reference: string };
