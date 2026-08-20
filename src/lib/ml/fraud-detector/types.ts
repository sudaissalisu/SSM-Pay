/**
 * @module fraud-detector/types
 * @description Type definitions for the fraud detection system in SSM-Pay.
 * Defines core interfaces, enums, and configuration types for fraud analysis.
 */

/** Risk level classification for fraud detection results */
export enum FraudRiskLevel {
  /** Low risk - transaction appears legitimate */
  LOW = 'LOW',
  /** Medium risk - requires additional review */
  MEDIUM = 'MEDIUM',
  /** High risk - strong indicators of fraud */
  HIGH = 'HIGH',
  /** Critical risk - immediate action required */
  CRITICAL = 'CRITICAL'
}

/** Individual signal that contributes to fraud detection */
export interface FraudSignal {
  /** Unique identifier for this signal */
  id: string;
  /** Human-readable name of the signal */
  name: string;
  /** Detailed description of what triggered this signal */
  description: string;
  /** Severity score from 0 to 100 */
  severity: number;
  /** Category of fraud this signal relates to */
  category: FraudSignalCategory;
  /** Timestamp when the signal was generated */
  timestamp: Date;
  /** Additional metadata about the signal */
  metadata?: Record<string, unknown>;
}

/** Categories of fraud signals */
export enum FraudSignalCategory {
  VELOCITY = 'VELOCITY',
  AMOUNT = 'AMOUNT',
  LOCATION = 'LOCATION',
  DEVICE = 'DEVICE',
  BEHAVIOR = 'BEHAVIOR',
  IDENTITY = 'IDENTITY'
}

/** Complete result of a fraud detection analysis */
export interface FraudDetectionResult {
  /** Overall risk level assessment */
  riskLevel: FraudRiskLevel;
  /** Composite risk score from 0 to 100 */
  riskScore: number;
  /** Collection of all detected signals */
  signals: FraudSignal[];
  /** Recommended action based on detection result */
  recommendation: FraudRecommendation;
  /** Confidence level of the assessment (0-1) */
  confidence: number;
  /** Timestamp of the analysis */
  analyzedAt: Date;
  /** Unique identifier for this detection run */
  detectionId: string;
}

/** Recommended actions after fraud detection */
export enum FraudRecommendation {
  APPROVE = 'APPROVE',
  APPROVE_WITH_REVIEW = 'APPROVE_WITH_REVIEW',
  REQUIRE_ADDITIONAL_AUTH = 'REQUIRE_ADDITIONAL_AUTH',
  DECLINE = 'DECLINE',
  BLOCK_AND_INVESTIGATE = 'BLOCK_AND_INVESTIGATE'
}

/** Configuration options for the fraud detection system */
export interface FraudDetectionConfig {
  /** Enable or disable velocity checks */
  enableVelocityCheck: boolean;
  /** Enable or disable amount anomaly detection */
  enableAmountAnomaly: boolean;
  /** Enable or disable location mismatch detection */
  enableLocationCheck: boolean;
  /** Enable or device fingerprinting checks */
  enableDeviceCheck: boolean;
  /** Threshold for medium risk (0-100) */
  mediumRiskThreshold: number;
  /** Threshold for high risk (0-100) */
  highRiskThreshold: number;
  /** Threshold for critical risk (0-100) */
  criticalRiskThreshold: number;
  /** Maximum transactions per hour before flagging */
  maxTransactionsPerHour: number;
  /** Maximum transaction amount before flagging */
  maxTransactionAmount: number;
  /** Time window in minutes for velocity calculations */
  velocityWindowMinutes: number;
  /** Whether to automatically block critical transactions */
  autoBlockCritical: boolean;
}

/** Input data for fraud detection analysis */
export interface FraudDetectionInput {
  /** Transaction ID being analyzed */
  transactionId: string;
  /** Amount of the transaction in smallest currency unit */
  amount: number;
  /** Currency code (ISO 4217) */
  currency: string;
  /** Sender/customer ID */
  customerId: string;
  /** Recipient ID or account */
  recipientId: string;
  /** IP address of the request */
  ipAddress?: string;
  /** Device fingerprint hash */
  deviceFingerprint?: string;
  /** ISO country code of transaction origin */
  countryCode?: string;
  /** Latitude of transaction location */
  latitude?: number;
  /** Longitude of transaction location */
  longitude?: number;
  /** Timestamp of the transaction */
  timestamp: Date;
  /** Payment method used */
  paymentMethod: PaymentMethodType;
  /** Merchant category code */
  merchantCategoryCode?: string;
  /** Channel through which transaction was initiated */
  channel: TransactionChannel;
}

/** Supported payment methods */
export enum PaymentMethodType {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  DIGITAL_WALLET = 'DIGITAL_WALLET',
  CRYPTO = 'CRYPTO',
  ACH = 'ACH',
  WIRE = 'WIRE'
}

/** Transaction channels */
export enum TransactionChannel {
  WEB = 'WEB',
  MOBILE_APP = 'MOBILE_API',
  API = 'API',
  POS = 'POS',
  ATM = 'ATM'
}

/** Historical data for context-aware fraud detection */
export interface CustomerFraudProfile {
  /** Customer ID */
  customerId: string;
  /** Average transaction amount */
  avgTransactionAmount: number;
  /** Standard deviation of transaction amounts */
  amountStdDev: number;
  /** Typical countries for transactions */
  typicalCountries: string[];
  /** Known device fingerprints */
  knownDevices: string[];
  /** Account creation date */
  accountCreatedDate: Date;
  /** Total historical transactions */
  totalTransactionCount: number;
  /** Number of previously flagged transactions */
  flaggedTransactionCount: number;
  /** Customer risk tier from historical analysis */
  riskTier: CustomerRiskTier;
}

/** Customer risk classification */
export enum CustomerRiskTier {
  TRUSTED = 'TRUSTED',
  STANDARD = 'STANDARD',
  ELEVATED = 'ELEVATED',
  HIGH_RISK = 'HIGH_RISK'
}

/** Default configuration values for fraud detection */
export const DEFAULT_FRAUD_CONFIG: FraudDetectionConfig = {
  enableVelocityCheck: true,
  enableAmountAnomaly: true,
  enableLocationCheck: true,
  enableDeviceCheck: true,
  mediumRiskThreshold: 30,
  highRiskThreshold: 60,
  criticalRiskThreshold: 85,
  maxTransactionsPerHour: 10,
  maxTransactionAmount: 50000,
  velocityWindowMinutes: 60,
  autoBlockCritical: true
};
