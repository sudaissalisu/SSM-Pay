/**
 * @fileoverview Batch transaction and export type definitions
 * @description Contains BatchTransactionRequest/Response, TransactionExportOptions
 * @module types/transaction/batch
 */

import { Currency } from './payment';
import { TransactionType, TransactionStatus, TransactionCategory } from './transaction.core';
import { TransactionFilters } from './transaction.filters';

// ============================================================================
// BATCH TRANSACTION INTERFACES
// ============================================================================

/**
 * Request payload for creating a batch of transactions.
 * Allows efficient processing of multiple transactions.
 *
 * @interface BatchTransactionRequest
 */
export interface BatchTransactionRequest {
  /** Unique identifier for the batch */
  batchReference: string;
  /** Title/description for the batch */
  title: string;
  /** Description of the batch purpose */
  description?: string;
  /** Array of individual transactions in the batch */
  transactions: BatchTransactionItem[];
  /** Whether to process all or fail entire batch on error */
  failOnError: boolean;
  /** Scheduled processing time (null for immediate) */
  scheduledFor?: Date;
  /** Callback URL for batch completion notification */
  callbackUrl?: string;
  /** Metadata for the batch */
  metadata?: Record<string, unknown>;
  /** Notification preferences */
  notifications: {
    /** Email notification on completion */
    email: boolean;
    /** Email addresses to notify */
    emailAddresses?: string[];
    /** Webhook notification */
    webhook: boolean;
  };
}

/**
 * Individual item within a batch transaction.
 *
 * @interface BatchTransactionItem
 */
export interface BatchTransactionItem {
  /** Unique reference for this item */
  reference: string;
  /** Transaction type */
  type: TransactionType;
  /** Amount in minor units */
  amount: number;
  /** Transaction currency */
  currency: Currency;
  /** Recipient/customer ID */
  recipientId: string;
  /** Recipient account details (alternative to recipientId) */
  recipientAccount?: {
    /** Bank name */
    bankName: string;
    /** Account number */
    accountNumber: string;
    /** Account name */
    accountName: string;
    /** Sort code (for UK banks) */
    sortCode?: string;
  };
  /** Transaction description/narration */
  narration?: string;
  /** Transaction category */
  category?: TransactionCategory;
  /** Metadata for this item */
  metadata?: Record<string, unknown>;
}

/**
 * Response returned after batch transaction submission.
 *
 * @interface BatchTransactionResponse
 */
export interface BatchTransactionResponse {
  /** Indicates if batch was accepted for processing */
  success: boolean;
  /** Processing message */
  message: string;
  /** Batch ID for tracking */
  batchId: string;
  /** Batch reference */
  batchReference: string;
  /** Total items in batch */
  totalItems: number;
  /** Initial status summary */
  initialStatus: {
    /** Items accepted for processing */
    accepted: number;
    /** Items rejected due to validation */
    rejected: number;
  };
  /** Rejected items with reasons (if any) */
  rejectedItems?: Array<{
    /** Item reference */
    reference: string;
    /** Rejection reason */
    reason: string;
    /** Error code */
    errorCode: string;
  }>;
  /** Estimated processing time */
  estimatedProcessingTime?: string;
  /** Timestamp when batch was submitted */
  submittedAt: Date;
  /** Callback URL configured */
  callbackUrl?: string;
}

/**
 * Status of a processed batch transaction.
 *
 * @interface BatchTransactionStatus
 */
export interface BatchTransactionStatus {
  /** Batch ID */
  batchId: string;
  /** Batch reference */
  batchReference: string;
  /** Overall batch status */
  status: 'pending' | 'processing' | 'completed' | 'partially_completed' | 'failed' | 'cancelled';
  /** Progress information */
  progress: {
    /** Total items */
    total: number;
    /** Completed items */
    completed: number;
    /** Failed items */
    failed: number;
    /** Pending items */
    pending: number;
    /** Progress percentage */
    percentage: number;
  };
  /** Individual item statuses */
  items: Array<{
    /** Item reference */
    reference: string;
    /** Transaction ID (if created) */
    transactionId?: string;
    /** Item status */
    status: TransactionStatus;
    /** Amount */
    amount: number;
    /** Error details (if failed) */
    error?: {
      /** Error code */
      code: string;
      /** Error message */
      message: string;
    };
  }>;
  /** Summary totals */
  summary: {
    /** Total amount */
    totalAmount: number;
    /** Successfully processed amount */
    processedAmount: number;
    /** Failed amount */
    failedAmount: number;
    /** Total fees */
    totalFees: number;
  };
  /** Started processing timestamp */
  startedAt?: Date;
  /** Completion timestamp */
  completedAt?: Date;
  /** Last updated timestamp */
  updatedAt: Date;
}

// ============================================================================
// EXPORT INTERFACES
// ============================================================================

/**
 * Options for exporting transactions to various formats.
 *
 * @interface TransactionExportOptions
 */
export interface TransactionExportOptions {
  /** Export format */
  format: 'csv' | 'xlsx' | 'pdf' | 'json';
  /** Apply filters to export */
  filters: TransactionFilters;
  /** Fields to include in export (empty = all) */
  fields?: TransactionField[];
  /** Column headers customization */
  headers?: Partial<Record<TransactionField, string>>;
  /** Date format for exported dates */
  dateFormat?: string;
  /** Number format locale */
  numberLocale?: string;
  /** Include headers row */
  includeHeaders: boolean;
  /** Split exports larger than this size (in rows) */
  maxRowsPerFile?: number;
  /** Compression format */
  compression?: 'none' | 'zip' | 'gzip';
  /** Include summary sheet (for xlsx) */
  includeSummary?: boolean;
  /** Custom filename prefix */
  filenamePrefix?: string;
  /** Email export when complete */
  emailTo?: string;
  /** Export callback URL */
  callbackUrl?: string;
}

/**
 * Available fields for transaction export selection.
 *
 * @typedef {string} TransactionField
 */
export type TransactionField =
  | 'id'
  | 'reference'
  | 'type'
  | 'status'
  | 'amount'
  | 'currency'
  | 'fee'
  | 'netAmount'
  | 'customerId'
  | 'sourceId'
  | 'destinationId'
  | 'paymentMethod'
  | 'channel'
  | 'category'
  | 'source'
  | 'description'
  | 'narration'
  | 'externalReference'
  | 'failureReason'
  | 'createdAt'
  | 'updatedAt'
  | 'completedAt'
  | 'settledAt';

/**
 * Response for transaction export requests.
 *
 * @interface TransactionExportResponse
 */
export interface TransactionExportResponse {
  /** Export job ID */
  exportId: string;
  /** Export status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Requested format */
  format: TransactionExportOptions['format'];
  /** Total records matching filter */
  totalRecords: number;
  /** Records being exported */
  exportedRecords: number;
  /** Download URL (when complete) */
  downloadUrl?: string;
  /** File size in bytes (when complete) */
  fileSize?: number;
  /** Expiration time for download URL */
  expiresAt?: Date;
  /** Estimated completion time */
  estimatedCompletion?: Date;
  /** Error details (if failed) */
  error?: {
    code: string;
    message: string;
  };
  /** Created timestamp */
  createdAt: Date;
  /** Completed timestamp */
  completedAt?: Date;
}

// ============================================================================
// TYPE ALIASES
// ============================================================================

/**
 * Union type for transaction request types.
 */
export type TransactionRequest =
  | import('./transaction.core').CreateTransactionRequest
  | BatchTransactionRequest;

/**
 * Union type for transaction response types.
 */
export type TransactionResponse =
  | import('./transaction.core').Transaction
  | BatchTransactionResponse
  | BatchTransactionStatus;
