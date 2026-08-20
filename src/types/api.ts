/**
 * API & Common Type Definitions
 * TypeScript types for API responses, audit, reports, permissions, integrations, features, analytics, and errors
 * 
 * @module types/api
 */

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

// ============== Report Types ==============

import { CurrencyCode } from './payment';
import { Channel } from './transaction';

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
