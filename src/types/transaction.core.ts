/**
 * @fileoverview Core Transaction type definitions
 * @description Contains Transaction enums and core Transaction interface
 * @module types/transaction/core
 */

import { Currency } from './payment';
import { Customer } from './customer';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Represents the type of financial transaction.
 * Each type has specific processing rules and accounting implications.
 *
 * @enum {string}
 * @example
 * ```typescript
 * if (transaction.type === TransactionType.CREDIT) {
 *   // Handle incoming funds
 * }
 * ```
 */
export enum TransactionType {
  /** Funds credited to an account/wallet */
  CREDIT = 'credit',
  /** Funds debited from an account/wallet */
  DEBIT = 'debit',
  /** Transfer between accounts */
  TRANSFER = 'transfer',
  /** Refund of a previous transaction */
  REFUND = 'refund',
  /** Chargeback initiated by cardholder */
  CHARGEBACK = 'chargeback',
  /** Reversal of a completed transaction */
  REVERSAL = 'reversal'
}

/**
 * Represents the current status of a transaction.
 * Transactions flow through these states during processing.
 *
 * @enum {string}
 */
export enum TransactionStatus {
  /** Transaction created, awaiting processing */
  PENDING = 'pending',
  /** Transaction successfully completed */
  COMPLETED = 'completed',
  /** Transaction failed to process */
  FAILED = 'failed',
  /** Transaction is being processed by payment provider */
  PROCESSING = 'processing',
  /** Transaction has been reversed */
  REVERSED = 'reversed',
  /** Transaction partially completed (for batch operations) */
  PARTIAL = 'partial',
  /** Transaction cancelled before completion */
  CANCELLED = 'cancelled',
  /** Transaction under review for fraud/risk */
  UNDER_REVIEW = 'under_review'
}

/**
 * Categories for transaction classification and reporting.
 *
 * @enum {string}
 */
export enum TransactionCategory {
  /** Payment collection from customers */
  PAYMENT_COLLECTION = 'payment_collection',
  /** Payment to vendors/suppliers */
  VENDOR_PAYMENT = 'vendor_payment',
  /** Salary/payroll disbursement */
  PAYROLL = 'payroll',
  /** Internal transfer between own accounts */
  INTERNAL_TRANSFER = 'internal_transfer',
  /** Withdrawal to bank account */
  WITHDRAWAL = 'withdrawal',
  /** Top-up/funding of wallet */
  TOPUP = 'topup',
  /** Service fee/charge */
  SERVICE_FEE = 'service_fee',
  /** Refund to customer */
  REFUND = 'refund',
  /** Chargeback dispute */
  CHARGEBACK = 'chargeback',
  /** Miscellaneous/uncategorized */
  OTHER = 'other'
}

/**
 * Source/origin of the transaction.
 *
 * @enum {string}
 */
export enum TransactionSource {
  /** API integration */
  API = 'api',
  /** Web dashboard */
  DASHBOARD = 'dashboard',
  /** Mobile application */
  MOBILE = 'mobile',
  /** Scheduled/recurring */
  SCHEDULED = 'scheduled',
  /** Webhook callback */
  WEBHOOK = 'webhook',
  /** Bulk/batch upload */
  BATCH = 'batch',
  /** System-generated (fees, adjustments) */
  SYSTEM = 'system',
  /** Imported from external system */
  IMPORTED = 'imported'
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Core Transaction entity representing a single financial movement.
 * This is the central data structure for all transaction operations.
 *
 * @interface Transaction
 * @example
 * ```typescript
 * const transaction: Transaction = {
 *   id: 'txn_abc123',
 *   type: TransactionType.CREDIT,
 *   status: TransactionStatus.COMPLETED,
 *   amount: 50000,
 *   currency: Currency.NGN,
 *   reference: 'txn_ref_xyz789',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * };
 * ```
 */
export interface Transaction {
  /** Unique identifier for the transaction (format: txn_xxxx) */
  id: string;
  /** Type of transaction */
  type: TransactionType;
  /** Current status of the transaction */
  status: TransactionStatus;
  /** Transaction amount in minor units */
  amount: number;
  /** Transaction currency */
  currency: Currency;
  /** Unique reference code for reconciliation */
  reference: string;
  /** Original transaction ID (for refunds, reversals, chargebacks) */
  originalTransactionId?: string;
  /** Parent batch transaction ID (if part of a batch) */
  batchId?: string;
  /** Source customer/account ID */
  sourceId?: string;
  /** Destination customer/account ID */
  destinationId?: string;
  /** Customer ID associated with this transaction */
  customerId?: string;
  /** Customer details snapshot at time of transaction */
  customer?: Pick<Customer, 'id' | 'email' | 'firstName' | 'lastName'>;
  /** Payment method used */
  paymentMethod?: string;
  /** Payment channel used */
  channel?: string;
  /** Transaction category for reporting */
  category: TransactionCategory;
  /** Source/origin of the transaction */
  source: TransactionSource;
  /** Human-readable description */
  description?: string;
  /** Narration/purpose text */
  narration?: string;
  /** External reference from payment processor */
  externalReference?: string;
  /** Fee charged for this transaction */
  fee?: number;
  /** Net amount after fees */
  netAmount?: number;
  /** Exchange rate (if currency conversion) */
  exchangeRate?: number;
  /** Original amount in source currency */
  originalAmount?: number;
  /** Original currency before conversion */
  originalCurrency?: Currency;
  /** Failure reason if transaction failed */
  failureReason?: string;
  /** Failure code from processor */
  failureCode?: string;
  /** Risk score assessment (0-100) */
  riskScore?: number;
  /** Metadata attached to transaction */
  metadata?: Record<string, unknown>;
  /** Tags for categorization and filtering */
  tags?: string[];
  /** IP address of initiator */
  ipAddress?: string;
  /** Timestamp when transaction was created */
  createdAt: Date;
  /** Timestamp when transaction was last updated */
  updatedAt: Date;
  /** Timestamp when transaction was completed */
  completedAt?: Date;
  /** Timestamp when transaction expires (for pending transactions) */
  expiresAt?: Date;
  /** Settlement date (when funds are actually moved) */
  settledAt?: Date;
  /** Reconciliation status */
  reconciliationStatus: 'pending' | 'matched' | 'unmatched' | 'disputed';
}

/**
 * Request for creating a single transaction.
 *
 * @interface CreateTransactionRequest
 */
export interface CreateTransactionRequest {
  /** Transaction type */
  type: TransactionType;
  /** Amount in minor units */
  amount: number;
  /** Transaction currency */
  currency: Currency;
  /** Reference (auto-generated if not provided) */
  reference?: string;
  /** Source account ID */
  sourceId?: string;
  /** Destination account ID */
  destinationId?: string;
  /** Customer ID */
  customerId?: string;
  /** Description */
  description?: string;
  /** Narration */
  narration?: string;
  /** Category */
  category?: TransactionCategory;
  /** Payment method */
  paymentMethod?: string;
  /** Channel */
  channel?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Tags */
  tags?: string[];
  /** Scheduled for future date */
  scheduledFor?: Date;
  /** Idempotency key for duplicate prevention */
  idempotencyKey?: string;
}

/**
 * Transaction timeline event for audit trail.
 *
 * @interface TransactionTimelineEvent
 */
export interface TransactionTimelineEvent {
  /** Event ID */
  id: string;
  /** Event type */
  eventType: 'created' | 'status_changed' | 'processing_started' | 'completed' |
    'failed' | 'reversed' | 'refunded' | 'disputed' | 'resolved' | 'note_added';
  /** Previous status (for status changes) */
  previousStatus?: TransactionStatus;
  /** New status (for status changes) */
  newStatus?: TransactionStatus;
  /** Event description */
  description: string;
  /** User/system that triggered the event */
  triggeredBy: string;
  /** Additional event data */
  data?: Record<string, unknown>;
  /** Event timestamp */
  timestamp: Date;
  /** IP address */
  ipAddress?: string;
}

/**
 * Transaction balance information.
 *
 * @interface TransactionBalance
 */
export interface TransactionBalance {
  /** Account/wallet ID */
  accountId: string;
  /** Available balance */
  availableBalance: number;
  /** Ledger balance */
  ledgerBalance: number;
  /** Pending credits */
  pendingCredits: number;
  /** Pending debits */
  pendingDebits: number;
  /** Currency */
  currency: Currency;
  /** Last transaction timestamp */
  lastTransactionAt?: Date;
  /** Balance as of timestamp */
  asOf: Date;
}

// ============================================================================
// TYPE ALIASES
// ============================================================================

/**
 * Type for transaction identifier (ID or reference).
 */
export type TransactionIdentifier = { id: string } | { reference: string };

/**
 * Type for transaction event handlers.
 */
export type TransactionEventHandler = (
  event: 'created' | 'updated' | 'completed' | 'failed' | 'reversed',
  transaction: Transaction
) => Promise<void> | void;
