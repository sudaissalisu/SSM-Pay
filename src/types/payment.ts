/**
 * @fileoverview Core payment type definitions for SSM-Pay platform
 * @description Barrel export file for all payment-related types.
 * Split into core, requests, and webhook modules for better organization.
 * @module types/payment
 */

// Core types (enums, Payment interface, Money, CardDetails, etc.)
export {
  PaymentStatus,
  PaymentMethod,
  Currency,
  CardScheme,
  PaymentChannel,
  Money,
  Payment,
  PaymentConfig,
  CardDetails,
  SplitConfig,
  SplitRecipient,
  PaymentListParams,
  PaymentListResponse,
  PaymentIdentifier
} from './payment.core';

// Request/Response types
export {
  InitializePaymentRequest,
  InitializePaymentResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse
} from './payment.requests';

export type {
  PaymentEventHandler,
  PaymentStatusCallback,
  PaymentRequest,
  PaymentResponse
} from './payment.requests';

// Webhook and refund types
export {
  RefundRequest,
  RefundResponse,
  PaymentCallbackPayload,
  PaymentWebhookEvent
} from './payment.webhook';
