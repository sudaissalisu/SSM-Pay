/**
 * Enterprise Type Definitions
 * Comprehensive TypeScript types for the SSM Pay platform
 * 
 * @module types/index
 */

// ============== Payment Types ==============

export interface Payment {
  id: string;
  reference: string;
  amount: number;
  currency: CurrencyCode;
  status: PaymentStatus;
  customer: Customer;
  method: PaymentMethod;
  metadata: PaymentMetadata;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  refundedAt?: Date;
}

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'expired'
  | 'cancelled';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  provider: PaymentProvider;
  last4Digits?: string;
  bankName?: string;
  accountName?: string;
  walletAddress?: string;
  ussdNumber?: string;
  expiryDate?: string;
  issuer?: string;
  country?: string;
  isDefault: boolean;
  verified: boolean;
  addedAt: Date;
}

export type PaymentMethodType = 
  | 'card'
  | 'bank_transfer'
  | 'wallet'
  | 'ussd'
  | 'qr_code'
  | 'pay_with_points';

export type PaymentProvider = 
  | 'zainpay'
  | 'flutterwave'
  | 'paystack'
  | 'stripe'
  | 'paypal';

export interface PaymentMetadata {
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  sessionId: string;
  fraudScore?: number;
  riskLevel?: RiskLevel;
  threeDSecureAuthenticated?: boolean;
  avsResult?: AVSResult;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AVSResult = { addressMatch: boolean; zipMatch: boolean; cvvMatch: boolean };

// ============== Customer Types ==============

export interface Customer {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth?: Date;
  kycLevel: KYCLevel;
  tier: CustomerTier;
  status: CustomerStatus;
  addresses: Address[];
  paymentMethods: PaymentMethod[];
  preferences: CustomerPreferences;
  metadata: CustomerMetadata;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export type KYCLevel = 'none' | 'basic' | 'enhanced' | 'professional';
export type CustomerTier = 'standard' | 'premium' | 'business' | 'enterprise';
export type CustomerStatus = 'active' | 'suspended' | 'banned' | 'closed';

export interface CustomerPreferences {
  language: LanguageCode;
  currency: CurrencyCode;
  timezone: string;
  notifications: NotificationPreferences;
  marketingOptIn: boolean;
  twoFactorEnabled: boolean;
  biometricEnabled: boolean;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  transactionAlerts: boolean;
  promotionalEmails: boolean;
  securityAlerts: boolean;
}

export interface CustomerMetadata {
  source: AcquisitionSource;
  campaign?: string;
  referralCode?: string;
  referredBy?: string;
  tags: string[];
  customFields: Record<string, unknown>;
}

export type LanguageCode = 'en' | 'fr' | 'es' | 'pt' | 'ar' | 'ha' | 'yo' | 'ig';
export type AcquisitionSource = 'organic' | 'referral' | 'api' | 'import' | 'admin';

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

export type CurrencyCode =
  | 'NGN'
  | 'USD'
  | 'GBP'
  | 'EUR'
  | 'GHS'
  | 'ZAR'
  | 'KES'
  | 'XOF'
  | 'XAF'
  | 'UGX'
  | 'TZS'
  | 'RWF'
  | 'BIF'
  | 'MAD';

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

// ============== Audit & Logging Types ==============

export interface AuditLog {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  actor: Actor;
  changes: ChangeRecord[];
  ipAddress: string;
  userAgent: string;
  requestId: string;
  sessionId: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export type AuditEntityType = 'payment' | 'customer' | 'account' | 'zainbox' | 'user' | 'role' | 'config' | 'webhook' | 'rate_limit' | 'api_key';
export type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'enable' | 'disable' | 'configure' | 'verify' | 'suspend' | 'reactivate' | 'archive';

export interface Actor {
  id: string;
  type: ActorType;
  name: string;
  email?: string;
  ip?: string;
}

export type ActorType = 'user' | 'system' | 'api_key' | 'service' | 'admin' | 'integration';

export interface ChangeRecord {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

// ============== API Types ==============

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
  pagination?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
  timestamp: Date;
  documentation_url?: string;
}

export interface ResponseMeta {
  requestId: string;
  processingTimeMs: number;
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
  apiVersion: string;
  serverTime: Date;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ============== Address Types ==============

export interface Address {
  id: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: CountryCode;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  label?: string;
  validated: boolean;
  metadata?: Record<string, unknown>;
}

export type CountryCode =
  | 'NG'
  | 'US'
  | 'GB'
  | 'CA'
  | 'DE'
  | 'FR'
  | 'IT'
  | 'ES'
  | 'GH'
  | 'KE'
  | 'ZA'
  | 'CM'
  | 'SN'
  | 'CI'
  | 'BJ'
  | 'TN'
  | 'MA'
  | 'ET'
  | 'EG'
  | 'LY'
  | 'SD'
  | 'TZ'
  | 'UG'
  | 'RW'
  | 'BI'
  | 'GQ'
  | 'ER'
  | 'DJ'
  | 'AO'
  | 'GW'
  | 'MR'
  | 'MU'
  | 'MZ'
  | 'MW'
  | 'NA'
  | 'SL'
  | 'GM'
  | 'ST'
  | 'LC'
  | 'CV'
  | 'CF'
  | 'TD'
  | 'TG'
  | 'NE'
  | 'ML'
  | 'BF'
  | 'GN'
  | 'GW'
  | 'GA'
  | 'SN'
  | 'CG'
  | 'CD'
  | 'SC'
  | 'ZW'
  | 'MZ'
  | 'NA';

// ============== Report Types ==============

export interface Report {
  id: string;
  type: ReportType;
  title: string;
  description: string;
  parameters: ReportParameters;
  status: ReportStatus;
  generatedBy: string;
  generatedAt: Date;
  fileUrl?: string;
  data: ReportData;
  schedule?: ReportSchedule;
}

export type ReportType =
  | 'transaction_summary'
  | 'revenue_report'
  | 'customer_acquisition'
  | 'fraud_analysis'
  | 'compliance_report'
  | 'tax_report'
  | 'settlement_reconciliation'
  | 'performance_metrics'
  | 'custom';

export type ReportStatus = 'generating' | 'completed' | 'failed' | 'scheduled';

export interface ReportParameters {
  startDate: Date;
  endDate: Date;
  currencies?: CurrencyCode[];
  channels?: Channel[];
  customers?: string[];
  zainboxes?: string[];
  minAmount?: number;
  maxAmount?: number;
  includeTestTransactions?: boolean;
}

export interface ReportData {
  summary: ReportSummary;
  charts: ChartData[];
  tables: TableData[];
  insights: Insight[];
}

export interface ReportSummary {
  totalRevenue: number;
  totalTransactions: number;
  totalCustomers: number;
  conversionRate: number;
  averageOrderValue: number;
  topProducts?: Array<{ name: string; count: number; revenue: number }>;
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'table';
  title: string;
  labels: string[];
  datasets: Dataset[];
  options?: Record<string, unknown>;
}

export interface Dataset {
  label: string;
  data: number[];
  backgroundColor?: string;
  borderColor?: string;
  fill?: boolean;
}

export interface TableData {
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

export interface Insight {
  type: 'info' | 'warning' | 'success' | 'error' | 'trend';
  title: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
  impact?: 'high' | 'medium' | 'low';
}

export interface ReportSchedule {
  frequency: ScheduleFrequency;
  dayOfWeek?: number;
  hourOfDay?: number;
  recipients: string[];
  format: ReportFormat;
  enabled: boolean;
  nextRunAt?: Date;
  lastRunAt?: Date;
}

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type ReportFormat = 'pdf' | 'csv' | 'excel' | 'json' | 'html';

// ============== Role & Permission Types ==============

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  resource: Resource;
  action: Action;
  conditions?: Condition[];
  scope: Scope;
}

export type Resource =
  | 'payment'
  | 'transaction'
  | 'customer'
  | 'account'
  | 'zainbox'
  | 'report'
  | 'webhook'
  | 'api_key'
  | 'user'
  | 'role'
  | 'audit_log'
  | 'setting'
  | 'integration';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'manage' | 'admin' | 'approve' | 'reject' | 'view' | 'export' | 'import';
export type Scope = 'own' | 'team' | 'all' | 'none';

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'is_null' | 'is_not_null' | 'between';

// ============== Integration Types ==============

export interface Integration {
  id: string;
  name: string;
  type: IntegrationType;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  configuration: IntegrationConfiguration;
  credentials: EncryptedCredentials;
  healthStatus: HealthStatus;
  lastSyncAt?: Date;
  lastError?: string;
  metrics: IntegrationMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export type IntegrationType = 'payment_provider' | 'analytics' | 'email' | 'sms' | 'crm' | 'accounting' | 'compliance' | 'notification' | 'storage';
export type IntegrationProvider = 'zainpay' | 'flutterwave' | 'paystack' | 'stripe' | 'twilio' | 'sendgrid' | 'mailchimp' | 'firebase' | 'aws' | 'google' | 'microsoft';
export type IntegrationStatus = 'active' | 'inactive' | 'error' | 'pending_setup' | 'deprecated';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface IntegrationConfiguration {
  environment: Environment;
  region?: string;
  sandboxMode: boolean;
  webhookUrls: Record<string, string>;
  features: string[];
  rateLimits: RateLimitConfig;
}

export interface EncryptedCredentials {
  encrypted: string;
  algorithm: EncryptionAlgorithm;
  keyId: string;
  iv: string;
  createdAt: Date;
  expiresAt?: Date;
}

export type EncryptionAlgorithm = 'aes-256-gcm' | 'aes-128-gcm' | 'rsa-oaep';
export type Environment = 'production' | 'staging' | 'development' | 'sandbox';

export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerDay: number;
  concurrentConnections: number;
  burstAllowance: number;
}

export interface IntegrationMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptimePercentage: number;
  lastRequestAt?: Date;
}

// ============== Feature Flag Types ==============

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  type: FeatureType;
  status: FeatureStatus;
  rules: FeatureRule[];
  audience: AudienceCriteria;
  rolloutPercentage: number;
  variations: FeatureVariation[];
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export type FeatureType = 'release' | 'experiment' | 'permission' | 'ops' | 'kill_switch';
export type FeatureStatus = 'enabled' | 'disabled' | 'scheduled';
export type VariationType = 'boolean' | 'string' | 'number' | 'json';

export interface FeatureRule {
  id: string;
  attribute: UserAttribute;
  operator: RuleOperator;
  value: unknown;
  percentage?: number;
}

export type UserAttribute = 'id' | 'email' | 'country' | 'tier' | 'kyc_level' | 'tags' | 'custom';
export type RuleOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'gt' | 'gte' | 'lt' | 'lte' | 'regex' | 'semver_gt' | 'semver_lt';

export interface AudienceCriteria {
  users?: string[]; // Explicit user IDs
  excludeUsers?: string[];
  segments?: string[]; // User segment IDs
  attributes?: Record<UserAttribute, unknown>; // Attribute-based targeting
}

export interface FeatureVariation {
  id: string;
  name: string;
  weight: number;
  configuration: Record<string, unknown>;
  isControl: boolean;
}

// ============== Analytics Event Types ==============

export interface AnalyticsEvent {
  id: string;
  name: string;
  category: EventCategory;
  properties: EventProperties;
  context: EventContext;
  timestamp: Date;
  processed: boolean;
}

export type EventCategory =
  | 'page_view'
  | 'click'
  | 'form_submit'
  | 'navigation'
  | 'session_start'
  | 'session_end'
  | 'error'
  | 'api_call'
  | 'payment_initiated'
  | 'payment_completed'
  | 'payment_failed'
  | 'search'
  | 'filter_applied'
  | 'sort_applied'
  | 'item_viewed'
  | 'cart_updated'
  | 'checkout_started'
  | 'purchase_completed'
  | 'signup'
  | 'login'
  | 'logout'
  | 'share'
  | 'download'
  | 'video_played'
  | 'custom';

export interface EventProperties {
  [key: string]: unknown;
}

export interface EventContext {
  url: string;
  path: string;
  referrer?: string;
  userAgent: string;
  ipAddress: string;
  sessionId: string;
  userId?: string;
  deviceId: string;
  application: string;
  version: string;
  environment: string;
  abTests?: Array<{ testName: string; variation: string }>;
  featureFlags?: Record<string, string | boolean>;
}

// ============== Error Types ==============

export interface AppError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
  requestId?: string;
  stack?: string;
  cause?: Error;
  suggestions?: string[];
  documentationUrl?: string;
  retryable: boolean;
}

export class SSMError extends Error implements AppError {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
  requestId?: string;
  suggestions?: string[];
  documentationUrl?: string;
  retryable: boolean;

  constructor(
    message: string,
    options: {
      code: string;
      statusCode?: number;
      details?: Record<string, unknown>;
      cause?: Error;
      suggestions?: string[];
      documentationUrl?: string;
    }
  ) {
    super(message);
    this.name = 'SSMError';
    this.code = options.code;
    this.statusCode = options.statusCode || 500;
    this.message = message;
    this.details = options.details;
    this.cause = options.cause;
    this.suggestions = options.suggestions || [];
    this.documentationUrl = options.documentationUrl;
    this.retryable = false;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SSMError);
    }
  }

  toJSON(): AppError {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      requestId: this.requestId,
      stack: this.stack,
      suggestions: this.suggestions,
      documentationUrl: this.documentationUrl,
      retryable: this.retryable,
    };
  }
}

// Predefined errors
export const Errors = {
  PAYMENT_REQUIRED: (field?: string) =>
    new SSMError(field ? `${field} is required` : 'Payment information is required', {
      code: 'PAYMENT_001',
      statusCode: 400,
      suggestions: ['Provide all required payment fields'],
    }),

  INVALID_AMOUNT: () =>
    new SSMError('Invalid amount provided', {
      code: 'PAYMENT_002',
      statusCode: 400,
      suggestions: ['Enter a valid positive number'],
    }),

  INVALID_CURRENCY: () =>
    new SSMError('Unsupported currency', {
      code: 'PAYMENT_003',
      statusCode: 400,
      suggestions: ['Use NGN, USD, GBP, EUR, GHS'],
    }),

  PAYMENT_FAILED: (reason?: string) =>
    new SSMError(reason || 'Payment processing failed', {
      code: 'PAYMENT_004',
      statusCode: 402,
      retryable: true,
    }),

  TRANSACTION_NOT_FOUND: (ref?: string) =>
    new SSMError(`Transaction not found: ${ref || 'unknown'}`, {
      code: 'TXN_001',
      statusCode: 404,
    }),

  INSUFFICIENT_FUNDS: () =>
    new SSMError('Insufficient funds', {
      code: 'WALLET_001',
      statusCode: 402,
      suggestions: ['Check your balance', 'Use a different payment method'],
    }),

  RATE_LIMIT_EXCEEDED: (retryAfter?: number) =>
    new SSMError('Too many requests, please try again later', {
      code: 'RATE_001',
      statusCode: 429,
      retryable: true,
      suggestions: [`Wait ${retryAfter || 60} seconds before retrying`],
    }),

  UNAUTHORIZED: () =>
    new SSMError('Authentication required', {
      code: 'AUTH_001',
      statusCode: 401,
      suggestions: ['Provide valid authentication token'],
    }),

  FORBIDDEN: () =>
    new SSMError('Access denied', {
      code: 'AUTH_002',
      statusCode: 403,
      suggestions: ['Check your permissions'],
    }),

  NOT_FOUND: (resource?: string) =>
    new SSMError(resource ? `${resource} not found` : 'Resource not found', {
      code: 'NOT_FOUND_001',
      statusCode: 404,
    }),

  VALIDATION_ERROR: (errors: Record<string, string>) => {
    const errorList = Object.entries(errors).map(([field, msg]) => `${field}: ${msg}`);
    return new SSMError(`Validation failed: ${errorList.join('; ')}`, {
      code: 'VALIDATION_001',
      statusCode: 400,
      details: errors,
    });
  },

  EXTERNAL_SERVICE_ERROR: (service?: string) =>
    new SSMError(service ? `External service error: ${service}` : 'External service unavailable', {
      code: 'EXTERNAL_001',
      statusCode: 502,
      retryable: true,
      suggestions: ['Try again later', 'Contact support if issue persists'],
    }),

  CONFIGURATION_ERROR: (key?: string) =>
    new SSMError(key ? `Missing configuration: ${key}` : 'Server configuration error', {
      code: 'CONFIG_001',
      statusCode: 500,
      suggestions: ['Contact administrator'],
    }),
};

// ============== Export All Types ==============

export {
  SSMError,
  Errors,
};

export default {
  // Payment Types
  Payment,
  PaymentStatus,
  PaymentMethod,
  PaymentMethodType,
  PaymentProvider,
  PaymentMetadata,
  RiskLevel,
  AVSResult,

  // Customer Types
  Customer,
  KYCLevel,
  CustomerTier,
  CustomerStatus,
  CustomerPreferences,
  NotificationPreferences,
  CustomerMetadata,
  LanguageCode,
  AcquisitionSource,

  // Transaction Types
  Transaction,
  TransactionType,
  TransactionStatus,
  TransactionMetadata,
  Channel,
  SourceSystem,

  // Account Types
  Account,
  AccountType,
  AccountStatus,
  BankDetails,
  VirtualAccountDetails,
  VirtualAccountProvider,
  AccountMetadata,

  // Zainbox Types
  Zainbox,
  ZainboxStatus,
  ZainboxType,
  ZainboxSettings,
  ZainboxStatistics,
  SettlementSchedule,
  FeeStructure,
  FeeBearer,

  // Exchange Rate Types
  ExchangeRate,
  CurrencyCode,
  RateSource,
  ExchangeRateHistory,
  RatePeriod,

  // Webhook Types
  WebhookConfig,
  WebhookEventType,
  WebhookStatus,
  RetryPolicy,

  // Audit Types
  AuditLog,
  AuditEntityType,
  AuditAction,
  Actor,
  ActorType,
  ChangeRecord,

  // API Types
  ApiResponse,
  ApiError,
  ResponseMeta,
  PaginationMeta,

  // Address Types
  Address,
  CountryCode,

  // Report Types
  Report,
  ReportType,
  ReportStatus,
  ReportParameters,
  ReportData,
  ReportSummary,
  ChartData,
  Dataset,
  TableData,
  Insight,
  ReportSchedule,
  ScheduleFrequency,
  ReportFormat,

  // Role & Permission Types
  Role,
  Permission,
  Resource,
  Action,
  Scope,
  Condition,
  ConditionOperator,

  // Integration Types
  Integration,
  IntegrationType,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationConfiguration,
  EncryptedCredentials,
  EncryptionAlgorithm,
  Environment,
  RateLimitConfig,
  IntegrationMetrics,

  // Feature Flag Types
  FeatureFlag,
  FeatureType,
  FeatureStatus,
  VariationType,
  FeatureRule,
  UserAttribute,
  RuleOperator,
  AudienceCriteria,
  FeatureVariation,

  // Analytics Types
  AnalyticsEvent,
  EventCategory,
  EventProperties,
  EventContext,

  // Error Types
  AppError,
};
