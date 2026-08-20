/**
 * @fileoverview Zainbox split configuration and related type definitions
 * @description Contains SplitMethod, SplitConfig, PayoutAccount, and Limits types
 * @module types/zainbox/split
 */

import { Currency } from './payment';

// ============================================================================
// SPLIT ENUM
// ============================================================================

/**
 * Split method for incoming funds to Zainbox.
 *
 * @enum {string}
 */
export enum SplitMethod {
  /** No splitting - full amount to main account */
  NONE = 'none',
  /** Percentage-based split */
  PERCENTAGE = 'percentage',
  /** Flat amount split */
  FLAT = 'flat',
  /** Ratio-based split */
  RATIO = 'ratio'
}

// ============================================================================
// SPLIT CONFIGURATION INTERFACES
// ============================================================================

/**
 * Split configuration for distributing incoming funds.
 *
 * @interface ZainboxSplitConfig
 */
export interface ZainboxSplitConfig {
  /** Split method */
  method: SplitMethod;
  /** Whether splitting is enabled */
  enabled: boolean;
  /** Primary/recipient sub-accounts */
  recipients: ZainboxSplitRecipient[];
  /** Default fallback account if splits fail */
  fallbackAccountId?: string;
  /** Minimum amount to trigger split */
  minimumAmount?: number;
  /** Maximum amount for split (above goes to primary) */
  maximumAmount?: number;
}

/**
 * Individual split recipient for Zainbox funds distribution.
 *
 * @interface ZainboxSplitRecipient
 */
export interface ZainboxSplitRecipient {
  /** Recipient unique identifier */
  id: string;
  /** Recipient account/sub-account ID */
  accountId: string;
  /** Recipient display name */
  name: string;
  /** Share value (percentage, flat amount, or ratio part) */
  value: number;
  /** Priority order for distribution */
  priority: number;
  /** Whether recipient is active in split */
  isActive: boolean;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// PAYOUT ACCOUNT INTERFACE
// ============================================================================

/**
 * Payout account linked to Zainbox for withdrawals.
 *
 * @interface PayoutAccount
 */
export interface PayoutAccount {
  /** Unique identifier for payout account */
  id: string;
  /** Bank name */
  bankName: string;
  /** Bank code */
  bankCode: string;
  /** Account number */
  accountNumber: string;
  /** Account name */
  accountName: string;
  /** Sort code (UK banks) */
  sortCode?: string;
  /** Is this the default payout account */
  isDefault: boolean;
  /** Account type */
  type: 'savings' | 'current' | 'corporate' | 'domiciliary';
  /** Account currency */
  currency: Currency;
  /** Verification status */
  verificationStatus: 'pending' | 'verified' | 'failed' | 'expired';
  /** Verification date */
  verifiedAt?: Date;
  /** Daily withdrawal limit */
  dailyLimit?: number;
  /** Monthly withdrawal limit */
  monthlyLimit?: number;
  /** Is account active for payouts */
  isActive: boolean;
  /** Created timestamp */
  createdAt: Date;
}

// ============================================================================
// LIMITS INTERFACE
// ============================================================================

/**
 * Transaction limits for Zainbox accounts.
 *
 * @interface ZainboxLimits
 */
export interface ZainboxLimits {
  /** Single transaction maximum */
  singleTransactionMax: number;
  /** Daily transaction maximum */
  dailyMax: number;
  /** Monthly transaction maximum */
  monthlyMax: number;
  /** Single transaction minimum */
  singleTransactionMin: number;
  /** Maximum balance allowed */
  maxBalance: number;
  /** Daily receive limit */
  dailyReceiveLimit: number;
  /** Monthly receive limit */
  monthlyReceiveLimit: number;
  /** Daily send/withdrawal limit */
  dailySendLimit: number;
  /** Monthly send/withdrawal limit */
  monthlySendLimit: number;
}
