/**
 * @fileoverview Transaction filter and summary type definitions
 * @description Contains TransactionFilters, TransactionSummary, and list response types
 * @module types/transaction/filters
 */

import { Currency } from './payment';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  TransactionCategory,
  TransactionSource
} from './transaction.core';

// ============================================================================
// FILTER INTERFACES
// ============================================================================

/**
 * Filters for searching and querying transactions.
 * All fields are optional for flexible query building.
 *
 * @interface TransactionFilters
 */
export interface TransactionFilters {
  /** Filter by transaction IDs (array for multiple) */
  ids?: string[];
  /** Filter by references (array for multiple) */
  references?: string[];
  /** Filter by transaction types */
  types?: TransactionType[];
  /** Filter by transaction statuses */
  statuses?: TransactionStatus[];
  /** Filter by categories */
  categories?: TransactionCategory[];
  /** Filter by sources */
  sources?: TransactionSource[];
  /** Filter by customer ID */
  customerId?: string;
  /** Filter by source account ID */
  sourceId?: string;
  /** Filter by destination account ID */
  destinationId?: string;
  /** Filter by payment method */
  paymentMethod?: string;
  /** Filter by currency */
  currency?: Currency;
  /** Minimum amount filter */
  amountFrom?: number;
  /** Maximum amount filter */
  amountTo?: number;
  /** Filter by date range start */
  dateFrom?: Date;
  /** Filter by date range end */
  dateTo?: Date;
  /** Filter by completion date range start */
  completedFrom?: Date;
  /** Filter by completion date range end */
  completedTo?: Date;
  /** Filter by tags (must match all if array) */
  tags?: string[];
  /** Search in description/narration */
  searchQuery?: string;
  /** Filter by external reference */
  externalReference?: string;
  /** Filter by batch ID */
  batchId?: string;
  /** Filter by original transaction ID */
  originalTransactionId?: string;
  /** Filter by reconciliation status */
  reconciliationStatus?: Transaction['reconciliationStatus'];
  /** Risk score minimum */
  riskScoreMin?: number;
  /** Risk score maximum */
  riskScoreMax?: number;
  /** Include soft-deleted transactions */
  includeDeleted?: boolean;
  /** Pagination page number */
  page?: number;
  /** Items per page */
  perPage?: number;
  /** Sort field */
  sortBy?: 'createdAt' | 'updatedAt' | 'completedAt' | 'amount' | 'status';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// SUMMARY INTERFACES
// ============================================================================

/**
 * Aggregated transaction summary statistics.
 * Used for dashboards and reporting.
 *
 * @interface TransactionSummary
 */
export interface TransactionSummary {
  /** Total volume (sum of all amounts) */
  totalVolume: number;
  /** Total count of transactions */
  totalCount: number;
  /** Successful transaction count */
  successfulCount: number;
  /** Failed transaction count */
  failedCount: number;
  /** Pending transaction count */
  pendingCount: number;
  /** Average transaction value */
  averageValue: number;
  /** Median transaction value */
  medianValue?: number;
  /** Minimum transaction value */
  minValue: number;
  /** Maximum transaction value */
  maxValue: number;
  /** Total fees collected */
  totalFees: number;
  /** Net volume (after fees) */
  netVolume: number;
  /** Summary by transaction type */
  byType: Record<TransactionType, {
    count: number;
    volume: number;
    percentage: number;
  }>;
  /** Summary by status */
  byStatus: Record<TransactionStatus, {
    count: number;
    volume: number;
    percentage: number;
  }>;
  /** Summary by currency */
  byCurrency: Record<string, {
    count: number;
    volume: number;
  }>;
  /** Summary by category */
  byCategory: Record<TransactionCategory, {
    count: number;
    volume: number;
  }>;
  /** Comparison with previous period */
  periodComparison?: {
    /** Volume change percentage */
    volumeChange: number;
    /** Count change percentage */
    countChange: number;
    /** Previous period volume */
    previousVolume: number;
    /** Previous period count */
    previousCount: number;
  };
  /** Summary calculation timestamp */
  calculatedAt: Date;
  /** Period covered by summary */
  period: {
    /** Start of period */
    from: Date;
    /** End of period */
    to: Date;
  };
}

// ============================================================================
// LIST RESPONSE INTERFACES
// ============================================================================

/**
 * Paginated response for transaction listings.
 *
 * @interface TransactionListResponse
 */
export interface TransactionListResponse {
  /** Array of transactions for current page */
  data: Transaction[];
  /** Pagination metadata */
  meta: {
    /** Current page number */
    currentPage: number;
    /** Total number of pages */
    totalPages: number;
    /** Total transactions matching filters */
    totalItems: number;
    /** Items per page */
    perPage: number;
    /** Whether there are more pages */
    hasNextPage: boolean;
    /** Whether there is a previous page */
    hasPrevPage: boolean;
  };
  /** Applied filters summary */
  appliedFilters: Partial<TransactionFilters>;
  /** Quick stats for current filter set */
  quickStats: {
    /** Total volume for filtered results */
    totalVolume: number;
    /** Average value for filtered results */
    averageValue: number;
    /** Success rate percentage */
    successRate: number;
  };
}
