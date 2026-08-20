/**
 * Zainbox Type Definitions
 * TypeScript types for Zainbox, Exchange Rate, and Webhook entities
 * 
 * @module types/zainbox
 */

import { CurrencyCode } from './payment';

// ============== Zainbox Types ==============

export interface Zainbox {
  id: string;
  codeName: string;
  name: string;
  callbackUrl: string;
  emailNotification: string;
  description: string;
  tags: string[];
  logoUrl?: string;
  color?: string;
  status: ZainboxStatus;
  type: ZainboxType;
  settings: ZainboxSettings;
  statistics: ZainboxStatistics;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ZainboxStatus = 'active' | 'inactive' | 'suspended' | 'closed';
export type ZainboxType = 'personal' | 'business' | 'merchant' | 'collection';

export interface ZainboxSettings {
  allowAutoInternalTransfer: boolean;
  requireAuthForPayment: boolean;
  minAmount: number;
  maxAmount: number;
  allowedCurrencies: CurrencyCode[];
  webhookUrl?: string;
  notificationEmails: string[];
  settlementSchedule: SettlementSchedule;
  feeStructure: FeeStructure;
}

export interface ZainboxStatistics {
  totalTransactions: number;
  totalVolume: number;
  totalFees: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageTransactionValue: number;
  lastTransactionDate?: Date;
}

export type SettlementSchedule = 'daily' | 'weekly' | 'monthly' | 'instant' | 'manual';

export interface FeeStructure {
  flatFee: number;
  percentageFee: number;
  minFee: number;
  maxFee: number;
  bearer: FeeBearer;
}

export type FeeBearer = 'sender' | 'receiver' | 'shared';

// ============== Exchange Rate Types ==============

export interface ExchangeRate {
  id: string;
  baseCurrency: CurrencyCode;
  targetCurrency: CurrencyCode;
  buyRate: number;
  sellRate: number;
  midRate: number;
  spread: number;
  source: RateSource;
  effectiveFrom: Date;
  effectiveTo?: Date;
  createdAt: Date;
}

export type RateSource = 'zainpay' | 'cbn' | 'fixer' | 'ecb' | 'custom';

export interface ExchangeRateHistory {
  rates: ExchangeRate[];
  period: RatePeriod;
  volatility: number;
  trend: 'up' | 'down' | 'stable';
  high: number;
  low: number;
  average: number;
  open: number;
  close: number;
}

export type RatePeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

// ============== Webhook Types ==============

export interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  status: WebhookStatus;
  version: number;
  retryPolicy: RetryPolicy;
  headers?: Record<string, string>;
  lastDeliveryAt?: Date;
  lastFailureAt?: Date;
  successCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type WebhookEventType =
  | 'payment.completed'
  | 'payment.failed'
  | 'payment.refunded'
  | 'transaction.created'
  | 'transaction.updated'
  | 'transaction.settled'
  | 'transaction.dispute_created'
  | 'account.created'
  | 'account.verified'
  | 'account.suspended'
  | 'zainbox.created'
  | 'zainbox.updated'
  | 'fraud.alert'
  | 'system.health_check'
  | 'rate_limit.exceeded'
  | 'batch.processing_completed';

export type WebhookStatus = 'active' | 'inactive' | 'disabled' | 'failed';

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryOn: Array<'5xx' | 'timeout' | 'network_error'>;
}
