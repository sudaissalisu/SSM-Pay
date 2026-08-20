/**
 * @fileoverview Barrel export file for SSM-Pay type definitions
 * @description Re-exports all types from the type modules for convenient imports.
 * Import from this file to access all platform types.
 *
 * @example
 * ```typescript
 * // Import all payment types
 * import { Payment, PaymentStatus, Currency } from '@/types';
 *
 * // Or import specific module
 * import { Customer, KYCStatus } from '@/types/customer';
 * ```
 *
 * @module types
 */

// ============================================================================
// PAYMENT TYPES
// ============================================================================

// Enums
export {
  PaymentStatus,
  PaymentMethod,
  Currency,
  CardScheme,
  PaymentChannel
} from './payment';

// Core Interfaces
export type {
  Money,
  Payment,
  InitializePaymentRequest,
  InitializePaymentResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  RefundRequest,
  RefundResponse,
  PaymentCallbackPayload,
  PaymentWebhookEvent,
  PaymentConfig,
  CardDetails,
  SplitConfig,
  SplitRecipient,
  PaymentListParams,
  PaymentListResponse
} from './payment';

// Type Aliases
export type {
  PaymentIdentifier,
  PaymentEventHandler,
  PaymentStatusCallback,
  PaymentRequest,
  PaymentResponse
} from './payment';

// ============================================================================
// CUSTOMER TYPES
// ============================================================================

// Enums
export {
  KYCStatus,
  IdentityDocumentType,
  CustomerTier,
  CustomerStatus
} from './customer';

// Core Interfaces
export type {
  Customer,
  CustomerRequest,
  CustomerResponse,
  CustomerSearchParams,
  CustomerListResponse,
  KYCVerification,
  KYCSubmissionRequest,
  KYCSubmissionResponse,
  CustomerPreferences,
  NotificationPreferences,
  PaymentPreferences,
  SecurityPreferences,
  DisplayPreferences,
  CommunicationPreferences,
  DeviceInfo,
  ValidationError,
  UpdateCustomerRequest,
  CustomerStats
} from './customer';

// Type Aliases
export type {
  CustomerIdentifier,
  CustomerEventHandler,
  CustomerOperationRequest
} from './customer';

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

// Enums
export {
  TransactionType,
  TransactionStatus,
  TransactionCategory,
  TransactionSource
} from './transaction';

// Core Interfaces
export type {
  Transaction,
  TransactionFilters,
  TransactionSummary,
  BatchTransactionRequest,
  BatchTransactionItem,
  BatchTransactionResponse,
  BatchTransactionStatus,
  TransactionExportOptions,
  TransactionField,
  TransactionExportResponse,
  TransactionListResponse,
  TransactionBalance,
  CreateTransactionRequest,
  TransactionTimelineEvent
} from './transaction';

// Type Aliases
export type {
  TransactionIdentifier,
  TransactionEventHandler,
  TransactionRequest,
  TransactionResponse
} from './transaction';

// ============================================================================
// ZAINBOX TYPES (VIRTUAL ACCOUNT)
// ============================================================================

// Enums
export {
  ZainboxType,
  ZainboxStatus,
  BankIntegrationType,
  SplitMethod,
  ZainboxPermission
} from './zainbox';

// Core Interfaces
export type {
  Zainbox,
  CreateZainboxRequest,
  CreateZainboxResponse,
  ZainboxTransaction,
  ZainboxCredentials,
  ZainboxConfig,
  ZainboxSplitConfig,
  ZainboxSplitRecipient,
  PayoutAccount,
  ZainboxLimits,
  ZainboxTransactionFilters,
  ZainboxTransactionListResponse,
  UpdateZainboxRequest,
  ZainboxStats
} from './zainbox';

// Type Aliases
export type {
  ZainboxIdentifier,
  ZainboxEventHandler,
  ZainboxRequest,
  ZainboxResponse
} from './zainbox';
