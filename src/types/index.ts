/**
 * Enterprise Type Definitions
 * Comprehensive TypeScript types for the SSM Pay platform
 * 
 * @module types/index
 */

// Re-export all type modules
export type {
  // Payment Types
  Payment,
  PaymentStatus,
  PaymentMethod,
  PaymentMethodType,
  PaymentProvider,
  PaymentMetadata,
  RiskLevel,
  AVSResult,
  CurrencyCode,
  Customer,
} from './payment';

export {
  Payment,
  PaymentStatus,
  PaymentMethod,
  PaymentMethodType,
  PaymentProvider,
  PaymentMetadata,
  RiskLevel,
  AVSResult,
  CurrencyCode,
  Customer,
} from './payment';

export type {
  // Customer Types
  KYCLevel,
  CustomerTier,
  CustomerStatus,
  CustomerPreferences,
  NotificationPreferences,
  CustomerMetadata,
  LanguageCode,
  AcquisitionSource,
  Address,
  CountryCode,
} from './customer';

export {
  KYCLevel,
  CustomerTier,
  CustomerStatus,
  CustomerPreferences,
  NotificationPreferences,
  CustomerMetadata,
  LanguageCode,
  AcquisitionSource,
  Address,
  CountryCode,
} from './customer';

export type {
  // Transaction Types
  Transaction,
  TransactionType,
  TransactionStatus,
  TransactionMetadata,
  Channel,
  SourceSystem,
  Account,
  AccountType,
  AccountStatus,
  BankDetails,
  VirtualAccountDetails,
  VirtualAccountProvider,
  AccountMetadata,
} from './transaction';

export {
  Transaction,
  TransactionType,
  TransactionStatus,
  TransactionMetadata,
  Channel,
  SourceSystem,
  Account,
  AccountType,
  AccountStatus,
  BankDetails,
  VirtualAccountDetails,
  VirtualAccountProvider,
  AccountMetadata,
} from './transaction';

export type {
  // Zainbox Types
  Zainbox,
  ZainboxStatus,
  ZainboxType,
  ZainboxSettings,
  ZainboxStatistics,
  SettlementSchedule,
  FeeStructure,
  FeeBearer,
  ExchangeRate,
  RateSource,
  ExchangeRateHistory,
  RatePeriod,
  WebhookConfig,
  WebhookEventType,
  WebhookStatus,
  RetryPolicy,
} from './zainbox';

export {
  Zainbox,
  ZainboxStatus,
  ZainboxType,
  ZainboxSettings,
  ZainboxStatistics,
  SettlementSchedule,
  FeeStructure,
  FeeBearer,
  ExchangeRate,
  RateSource,
  ExchangeRateHistory,
  RatePeriod,
  WebhookConfig,
  WebhookEventType,
  WebhookStatus,
  RetryPolicy,
} from './zainbox';

export type {
  // API & Common Types
  ApiResponse,
  ApiError,
  ResponseMeta,
  PaginationMeta,
  AuditLog,
  AuditEntityType,
  AuditAction,
  Actor,
  ActorType,
  ChangeRecord,
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
  Role,
  Permission,
  Resource,
  Action,
  Scope,
  Condition,
  ConditionOperator,
  Integration,
  IntegrationType,
  IntegrationProvider,
  IntegrationStatus,
  HealthStatus,
  IntegrationConfiguration,
  EncryptedCredentials,
  EncryptionAlgorithm,
  Environment,
  RateLimitConfig,
  IntegrationMetrics,
  FeatureFlag,
  FeatureType,
  FeatureStatus,
  VariationType,
  FeatureRule,
  UserAttribute,
  RuleOperator,
  AudienceCriteria,
  FeatureVariation,
  AnalyticsEvent,
  EventCategory,
  EventProperties,
  EventContext,
  AppError,
} from './api';

export {
  ApiResponse,
  ApiError,
  ResponseMeta,
  PaginationMeta,
  AuditLog,
  AuditEntityType,
  AuditAction,
  Actor,
  ActorType,
  ChangeRecord,
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
  Role,
  Permission,
  Resource,
  Action,
  Scope,
  Condition,
  ConditionOperator,
  Integration,
  IntegrationType,
  IntegrationProvider,
  IntegrationStatus,
  HealthStatus,
  IntegrationConfiguration,
  EncryptedCredentials,
  EncryptionAlgorithm,
  Environment,
  RateLimitConfig,
  IntegrationMetrics,
  FeatureFlag,
  FeatureType,
  FeatureStatus,
  FeatureRule,
  UserAttribute,
  RuleOperator,
  AudienceCriteria,
  FeatureVariation,
  AnalyticsEvent,
  EventCategory,
  EventProperties,
  EventContext,
  SSMError,
  Errors,
  AppError,
} from './api';

// Default export with all types
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
