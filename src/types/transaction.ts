/**
 * Transaction Type Definitions
 * TypeScript types for transaction and account entities
 * 
 * @module types/transaction
 */

import { CurrencyCode } from './payment';
import { Customer } from './customer';

// ============== Transaction Types ==============

export interface Transaction {
  id: string;
  reference: string;
  type: TransactionType;
  amount: number;
  fee: number;
  netAmount: number;
  currency: CurrencyCode;
  status: TransactionStatus;
  description: string;
  narration?: string;
  fromAccount: Account;
  toAccount: Account;
  paymentId?: string;
  refundId?: string;
  externalRef?: string;
  metadata: TransactionMetadata;
  createdAt: Date;
  postedAt: Date;
  settledAt?: Date;
}

export type TransactionType =
  | 'payment'
  | 'refund'
  | 'transfer'
  | 'withdrawal'
  | 'deposit'
  | 'fee'
  | 'adjustment'
  | 'chargeback'
  | 'reversal';

export type TransactionStatus =
  | 'pending'
  | 'posted'
  | 'completed'
  | 'failed'
  | 'reversed'
  | 'disputed'
  | 'settled'
  | 'cancelled';

export interface TransactionMetadata {
  ipAddress: string;
  deviceId: string;
  channel: Channel;
  source: SourceSystem;
  batchId?: string;
  correlationId?: string;
  tags: string[];
  customFields: Record<string, unknown>;
}

export type Channel = 'web' | 'mobile_app' | 'api' | 'webhook' | 'pos' | 'atm' | 'agent';
export type SourceSystem = 'core' | 'zainpay' | 'admin' | 'migration' | 'import';

// ============== Account Types ==============

export interface Account {
  id: string;
  number: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  balance: number;
  availableBalance: number;
  frozenBalance: number;
  status: AccountStatus;
  customerId: string;
  bankDetails?: BankDetails;
  virtualAccountDetails?: VirtualAccountDetails;
  metadata: AccountMetadata;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

export type AccountType = 'wallet' | 'virtual_account' | 'settlement' | 'escrow' | 'fee';
export type AccountStatus = 'active' | 'frozen' | 'closed' | 'suspended';

export interface BankDetails {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  bvn?: string; // Bank Verification Number
  sortCode?: string;
  nuban?: string; // NUBAN for Nigerian banks
}

export interface VirtualAccountDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  nuban: string;
  provider: VirtualAccountProvider;
  isActive: boolean;
}

export type VirtualAccountProvider = 'zainpay' | 'flutterwave' | 'paystack';

export interface AccountMetadata {
  autoCreate: boolean;
  dailyLimit?: number;
  monthlyLimit?: number;
  requiresApproval: boolean;
  tags: string[];
}
