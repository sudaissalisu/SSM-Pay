/**
 * @fileoverview Payment request/response type definitions
 * @description Contains InitializePaymentRequest/Response, VerifyPaymentRequest/Response
 * @module types/payment/requests
 */

import {
  Payment,
  PaymentStatus,
  PaymentMethod,
  Currency
} from './payment.core';

// ============================================================================
// INITIALIZATION TYPES
// ============================================================================

/**
 * Request payload for initializing a new payment.
 * Contains all required information to create a payment intent.
 *
 * @interface InitializePaymentRequest
 */
export interface InitializePaymentRequest {
  /** Amount to charge in minor units */
  amount: number;
  /** Currency for the transaction */
  currency: Currency;
  /** Customer ID or email for the payer */
  customer: string;
  /** Preferred payment method (optional - shows selection UI if omitted) */
  method?: PaymentMethod;
  /** Unique reference for this transaction (auto-generated if not provided) */
  reference?: string;
  /** Human-readable description of the payment */
  description?: string;
  /** Callback URL for payment notifications */
  callbackUrl?: string;
  /** Redirect URL after payment completion */
  redirectUrl?: string;
  /** Custom metadata for the payment */
  metadata?: Record<string, unknown>;
  /** Whether to allow partial payments */
  allowPartialPayment?: boolean;
  /** Maximum retry attempts for failed payments */
  maxRetries?: number;
  /** Expiration time in minutes (default: 30) */
  expiresIn?: number;
  /** Bank account for bank transfer payments */
  bankAccount?: string;
  /** USSD code for USSD payments */
  ussdCode?: string;
}

/**
 * Response returned after successful payment initialization.
 * Contains the payment details and authorization/redirect information.
 *
 * @interface InitializePaymentResponse
 */
export interface InitializePaymentResponse {
  /** Indicates if initialization was successful */
  success: boolean;
  /** Message describing the result */
  message: string;
  /** The created payment object */
  data: Payment;
  /** Authorization URL for redirect-based payments */
  authorizationUrl?: string;
  /** Access code for embedded payments */
  accessCode?: string;
  /** USSD code for USSD payments */
  ussdCode?: string;
  /** Bank account details for transfer payments */
  bankDetails?: {
    /** Bank name */
    bankName: string;
    /** Account number */
    accountNumber: string;
    /** Account name */
    accountName: string;
    /** Sort code */
    sortCode?: string;
  };
  /** QR code data for QR payments */
  qrCodeData?: string;
  /** Expiration timestamp */
  expiresAt: Date;
}

// ============================================================================
// VERIFICATION TYPES
// ============================================================================

/**
 * Request payload for verifying a payment's status.
 * Used to confirm payment completion after callback or redirect.
 *
 * @interface VerifyPaymentRequest
 */
export interface VerifyPaymentRequest {
  /** Payment ID or reference to verify */
  identifier: string;
  /** Whether identifier is a reference (default: false) */
  isReference?: boolean;
  /** Expected amount for verification (optional security check) */
  expectedAmount?: number;
}

/**
 * Response returned after payment verification.
 * Contains the current state and details of the verified payment.
 *
 * @interface VerifyPaymentResponse
 */
export interface VerifyPaymentResponse {
  /** Indicates if verification was successful */
  success: boolean;
  /** Verification message */
  message: string;
  /** Current payment status */
  status: PaymentStatus;
  /** Full payment details */
  data: Payment;
  /** Verification timestamp */
  verifiedAt: Date;
  /** Risk assessment score (0-100) */
  riskScore?: number;
  /** 3DS authentication status if applicable */
  threeDSStatus?: 'authenticated' | 'attempted' | 'not_authenticated' | 'not_supported';
}

// ============================================================================
// TYPE ALIASES
// ============================================================================

/**
 * Type for payment event handlers/callbacks.
 */
export type PaymentEventHandler = (
  event: import('./payment.webhook').PaymentWebhookEvent
) => Promise<void> | void;

/**
 * Type for payment status change callback.
 */
export type PaymentStatusCallback = (
  payment: Payment,
  previousStatus: PaymentStatus,
  newStatus: PaymentStatus
) => void;

/**
 * Union type for all payment request types.
 */
export type PaymentRequest =
  | InitializePaymentRequest
  | VerifyPaymentRequest
  | import('./payment.webhook').RefundRequest;

/**
 * Union type for all payment response types.
 */
export type PaymentResponse =
  | InitializePaymentResponse
  | VerifyPaymentResponse
  | import('./payment.webhook').RefundResponse;
