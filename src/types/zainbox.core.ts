/**
 * @fileoverview Core Zainbox type definitions
 * @description Contains Zainbox enums, core Zainbox interface, and request/response types
 * @module types/zainbox/core
 */

import { Currency } from './payment';
import { Customer } from './customer';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Type of Zainbox account (virtual account).
 * Determines features and capabilities available.
 *
 * @enum {string}
 * @example
 * ```typescript
 * const zainboxType: ZainboxType = ZainboxType.BUSINESS;
 * ```
 */
export enum ZainboxType {
  /** Individual/personal virtual account */
  INDIVIDUAL = 'individual',
  /** Business/corporate virtual account */
  BUSINESS = 'business'
}

/**
 * Current status of a Zainbox account.
 *
 * @enum {string}
 */
export enum ZainboxStatus {
  /** Zainbox is active and operational */
  ACTIVE = 'active',
  /** Zainbox is inactive/disabled */
  INACTIVE = 'inactive',
  /** Zainbox is suspended due to compliance issues */
  SUSPENDED = 'suspended',
  /** Zainbox is pending activation */
  PENDING = 'pending',
  /** Zainbox has been closed */
  CLOSED = 'closed',
  /** Zainbox is under review */
  UNDER_REVIEW = 'under_review'
}

/**
 * Bank integration type for the Zainbox.
 *
 * @enum {string}
 */
export enum BankIntegrationType {
  /** Direct bank API integration */
  DIRECT = 'direct',
  /** NIBSS integration for Nigerian banks */
  NIBSS = 'nibss',
  /** Switch/processor integration */
  SWITCH = 'switch',
  /** Manual/reconciliation based */
  MANUAL = 'manual'
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Core Zainbox entity representing a virtual account.
 * Zainboxes provide dedicated bank accounts for receiving payments.
 *
 * @interface Zainbox
 * @example
 * ```typescript
 * const zainbox: Zainbox = {
 *   id: 'zbx_abc123',
 *   name: 'My Business Account',
 *   type: ZainboxType.BUSINESS,
 *   accountNumber: '0123456789',
 *   bankName: 'First Bank',
 *   currency: Currency.NGN,
 *   createdAt: new Date()
 * };
 * ```
 */
export interface Zainbox {
  /** Unique identifier for the Zainbox (format: zbx_xxxx) */
  id: string;
  /** Display name for the Zainbox */
  name: string;
  /** Type of Zainbox (individual or business) */
  type: ZainboxType;
  /** Current status of the Zainbox */
  status: ZainboxStatus;
  /** Virtual account number */
  accountNumber: string;
  /** Bank where virtual account is hosted */
  bankName: string;
  /** Bank code (CBN/NIBSS code) */
  bankCode: string;
  /** Sort code (for UK banks) */
  sortCode?: string;
  /** Account currency */
  currency: Currency;
  /** Owner customer ID */
  ownerId: string;
  /** Owner details snapshot */
  owner?: Pick<Customer, 'id' | 'email' | 'firstName' | 'lastName'>;
  /** Current balance */
  currentBalance?: number;
  /** Available balance */
  availableBalance?: number;
  /** Split configuration for incoming payments */
  splitConfig?: import('./zainbox.split').ZainboxSplitConfig;
  /** Associated bank accounts for payouts */
  payoutAccounts: import('./zainbox.split').PayoutAccount[];
  /** Transaction limits */
  limits: import('./zainbox.split').ZainboxLimits;
  /** Credentials and authentication info */
  credentials: import('./zainbox.credentials').ZainboxCredentials;
  /** Configuration settings */
  config: import('./zainbox.credentials').ZainboxConfig;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Tags for categorization */
  tags?: string[];
  /** Timestamp when Zainbox was created */
  createdAt: Date;
  /** Timestamp when Zainbox was last updated */
  updatedAt: Date;
  /** Last transaction timestamp */
  lastTransactionAt?: Date;
  /** Closure date (if applicable) */
  closedAt?: Date;
}

/**
 * Request payload for creating a new Zainbox.
 *
 * @interface CreateZainboxRequest
 */
export interface CreateZainboxRequest {
  /** Display name for the Zainbox */
  name: string;
  /** Type of Zainbox to create */
  type: ZainboxType;
  /** Owner/customer ID */
  ownerId: string;
  /** Preferred bank for virtual account (optional - auto-assigned if not specified) */
  preferredBank?: string;
  /** Account currency */
  currency: Currency;
  /** Initial split configuration */
  splitConfig?: import('./zainbox.split').ZainboxSplitConfig;
  /** Payout accounts */
  payoutAccounts?: import('./zainbox.split').PayoutAccount[];
  /** Custom limits (overrides defaults) */
  limits?: Partial<import('./zainbox.split').ZainboxLimits>;
  /** Configuration options */
  config?: Partial<import('./zainbox.credentials').ZainboxConfig>;
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Tags */
  tags?: string[];
  /** Callback URL for payment notifications */
  callbackUrl?: string;
  /** Webhook URL for real-time notifications */
  webhookUrl?: string;
  /** Enable email notifications on payments */
  emailNotification?: boolean;
  /** Email addresses for notifications */
  notificationEmails?: string[];
}

/**
 * Response returned after successful Zainbox creation.
 *
 * @interface CreateZainboxResponse
 */
export interface CreateZainboxResponse {
  /** Indicates if creation was successful */
  success: boolean;
  /** Response message */
  message: string;
  /** Created Zainbox data */
  data: Zainbox;
  /** Temporary credentials for initial setup (if applicable) */
  temporaryCredentials?: {
    /** API key for initial configuration */
    apiKey: string;
    /** Expiration time for temp credentials */
    expiresAt: Date;
  };
  /** Onboarding checklist items */
  onboardingChecklist: Array<{
    /** Checklist item ID */
    id: string;
    /** Item description */
    description: string;
    /** Whether item is completed */
    completed: boolean;
    /** Required or optional */
    required: boolean;
  }>;
}

/**
 * Transaction associated with a Zainbox.
 * Extends base transaction with Zainbox-specific fields.
 *
 * @interface ZainboxTransaction
 */
export interface ZainboxTransaction {
  /** Unique transaction ID */
  id: string;
  /** Zainbox ID that received/sent this transaction */
  zainboxId: string;
  /** Zainbox account number */
  zainboxAccountNumber: string;
  /** Transaction reference */
  reference: string;
  /** Bank reference/narration from sender's bank */
  bankReference?: string;
  /** Sender's narration/message */
  senderNarration?: string;
  /** Transaction amount */
  amount: number;
  /** Transaction currency */
  currency: Currency;
  /** Transaction type (credit/debit) */
  type: 'credit' | 'debit';
  /** Transaction status */
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  /** Sender information (for credits) */
  sender?: {
    /** Sender account name */
    accountName: string;
    /** Sender account number (masked) */
    accountNumber: string;
    /** Sender bank name */
    bankName: string;
    /** Sender bank code */
    bankCode: string;
  };
  /** Recipient information (for debits) */
  recipient?: {
    /** Recipient account name */
    accountName: string;
    /** Recipient account number */
    accountNumber: string;
    /** Recipient bank name */
    bankName: string;
  };
  /** Fee charged */
  fee?: number;
  /** Net amount */
  netAmount?: number;
  /** Payment channel used */
  channel?: string;
  /** Transaction category */
  category?: string;
  /** Description/narration */
  description?: string;
  /** External reference from bank */
  externalReference?: string;
  /** Value date (bank settlement date) */
  valueDate?: Date;
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp when transaction was created */
  createdAt: Date;
  /** Timestamp when transaction was completed */
  completedAt?: Date;
  /** Settlement timestamp */
  settledAt?: Date;
}

// ============================================================================
// FILTER AND LIST INTERFACES
// ============================================================================

/**
 * Filters for querying Zainbox transactions.
 *
 * @interface ZainboxTransactionFilters
 */
export interface ZainboxTransactionFilters {
  /** Filter by Zainbox ID */
  zainboxId?: string;
  /** Filter by transaction IDs */
  ids?: string[];
  /** Filter by references */
  references?: string[];
  /** Filter by transaction type */
  type?: 'credit' | 'debit';
  /** Filter by status */
  status?: ZainboxTransaction['status'];
  /** Minimum amount */
  amountFrom?: number;
  /** Maximum amount */
  amountTo?: number;
  /** Filter by date range start */
  dateFrom?: Date;
  /** Filter by date range end */
  dateTo?: Date;
  /** Search by sender name/narration */
  searchQuery?: string;
  /** Filter by external reference */
  externalReference?: string;
  /** Pagination page */
  page?: number;
  /** Items per page */
  perPage?: number;
  /** Sort field */
  sortBy?: 'createdAt' | 'amount' | 'status';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response for Zainbox transaction listings.
 *
 * @interface ZainboxTransactionListResponse
 */
export interface ZainboxTransactionListResponse {
  /** Array of transactions */
  data: ZainboxTransaction[];
  /** Pagination metadata */
  meta: {
    /** Current page */
    currentPage: number;
    /** Total pages */
    totalPages: number;
    /** Total items */
    totalItems: number;
    /** Items per page */
    perPage: number;
    /** Has next page */
    hasNextPage: boolean;
    /** Has previous page */
    hasPrevPage: boolean;
  };
  /** Summary statistics */
  summary: {
    /** Total credits */
    totalCredits: number;
    /** Total debits */
    totalDebits: number;
    /** Net flow */
    netFlow: number;
    /** Transaction count */
    transactionCount: number;
  };
}

/**
 * Request for updating Zainbox configuration.
 *
 * @interface UpdateZainboxRequest
 */
export interface UpdateZainboxRequest {
  /** New display name */
  name?: string;
  /** New status */
  status?: ZainboxStatus;
  /** Update split configuration */
  splitConfig?: import('./zainbox.split').ZainboxSplitConfig;
  /** Update payout accounts */
  payoutAccounts?: import('./zainbox.split').PayoutAccount[];
  /** Update limits */
  limits?: Partial<import('./zainbox.split').ZainboxLimits>;
  /** Update configuration */
  config?: Partial<import('./zainbox.credentials').ZainboxConfig>;
  /** Update metadata */
  metadata?: Record<string, unknown>;
  /** Update tags */
  tags?: string[];
  /** Update callback URL */
  callbackUrl?: string;
  /** Update webhook URL */
  webhookUrl?: string;
}

/**
 * Zainbox statistics and analytics data.
 *
 * @interface ZainboxStats
 */
export interface ZainboxStats {
  /** Zainbox ID */
  zainboxId: string;
  /** Statistics period */
  period: {
    from: Date;
    to: Date;
  };
  /** Total volume received */
  totalVolumeReceived: number;
  /** Total volume sent */
  totalVolumeSent: number;
  /** Net position */
  netPosition: number;
  /** Total transactions */
  totalTransactions: number;
  /** Credit transaction count */
  creditCount: number;
  /** Debit transaction count */
  debitCount: number;
  /** Average transaction size */
  averageTransactionSize: number;
  /** Largest transaction */
  largestTransaction: {
    amount: number;
    date: Date;
    reference: string;
  };
  /** Top senders by volume */
  topSenders: Array<{
    accountName: string;
    bankName: string;
    volume: number;
    count: number;
  }>;
  /** Daily breakdown */
  dailyBreakdown: Array<{
    date: Date;
    credits: number;
    debits: number;
    count: number;
  }>;
  /** Balance history points */
  balanceHistory: Array<{
    date: Date;
    balance: number;
  }>;
}

// ============================================================================
// TYPE ALIASES
// ============================================================================

/**
 * Type for Zainbox identifier (ID or account number).
 */
export type ZainboxIdentifier = { id: string } | { accountNumber: string };

/**
 * Type for Zainbox event handlers.
 */
export type ZainboxEventHandler = (
  event: 'created' | 'updated' | 'payment_received' | 'payment_sent' |
       'config_changed' | 'suspended' | 'closed',
  zainbox: Zainbox,
  transaction?: ZainboxTransaction
) => Promise<void> | void;

/**
 * Union type for Zainbox request types.
 */
export type ZainboxRequest =
  | CreateZainboxRequest
  | UpdateZainboxRequest;

/**
 * Union type for Zainbox response types.
 */
export type ZainboxResponse =
  | CreateZainboxResponse
  | Zainbox
  | ZainboxTransactionListResponse
  | ZainboxStats;
