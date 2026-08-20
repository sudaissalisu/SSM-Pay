/**
 * Type Definitions for Risk Engine Module
 * @module ml/risk/types
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Enumerations ==============

/**
 * Risk level classifications from lowest to highest risk
 */
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Authentication requirement levels based on risk assessment
 */
export enum AuthRequirement {
  NONE = 'none',
  OTP = 'otp',
  BIOMETRIC = 'biometric',
  STEP_UP = 'step_up',
  MANUAL_REVIEW = 'manual_review',
  BLOCKED = 'blocked'
}

/**
 * Predefined risk profiles with different sensitivity levels
 */
export type RiskProfile = 'conservative' | 'moderate' | 'aggressive';

/**
 * AML (Anti-Money Laundering) alert categories
 */
export enum AMLAlertType {
  LARGE_TRANSACTION = 'large_transaction',
  STRUCTURING = 'structuring',
  HIGH_RISK_COUNTRY = 'high_risk_country',
  SANCTIONS_MATCH = 'sanctions_match',
  UNUSUAL_ACTIVITY = 'unusual_activity',
  VELOCITY_BREACH = 'velocity_breach'
}

/**
 * KYC (Know Your Customer) verification status
 */
export enum KYCStatus {
  VERIFIED = 'verified',
  PARTIAL = 'partial',
  PENDING = 'pending',
  NONE = 'none',
  REJECTED = 'rejected'
}

// ============== Interface Definitions ==============

/**
 * Core transaction data required for risk assessment
 */
export interface TransactionInput {
  transactionId: string;
  amount: number;
  currency: string;
  timestamp: Date;
  customerId: string;
  customerHash: string;
  sourceAccountId: string;
  destinationAccountId: string;
  paymentMethod: PaymentMethod;
  deviceFingerprint: string;
  ipAddress: string;
  countryCode: string;
  merchantCategoryCode?: string;
  description?: string;
  referenceId?: string;
}

/**
 * Supported payment methods
 */
export type PaymentMethod = 
  | 'card' 
  | 'bank_transfer' 
  | 'wallet' 
  | 'ussd' 
  | 'qr_code' 
  | 'nfc'
  | 'direct_debit';

/**
 * Customer profile data for risk context
 */
export interface CustomerProfile {
  customerId: string;
  accountCreatedDate: Date;
  kycStatus: KYCStatus;
  riskRating: number;
  totalTransactions: number;
  totalVolume: number;
  disputeCount: number;
  flaggedCount: number;
  accountStatus: 'active' | 'suspended' | 'restricted' | 'under_review';
  tier: 'individual' | 'business' | 'premium' | 'enterprise';
  knownCountries: string[];
  knownDevices: string[];
  emailDomain?: string;
  phoneCountryCode?: string;
}

/**
 * Historical transaction data for velocity and pattern analysis
 */
export interface TransactionHistory {
  lastHourCount: number;
  last24hCount: number;
  last7dCount: number;
  last30dCount: number;
  last24hVolume: number;
  last7dVolume: number;
  avgAmount30d: number;
  stdAmount30d: number;
  maxAmount30d: number;
  minutesSinceLastTxn: number;
  failedTxnCount24h: number;
  declinedTxnCount24h: number;
  newRecipientCount24h: number;
  recentDestinations: string[];
}

/**
 * Device intelligence data
 */
export interface DeviceIntelligence {
  isKnownDevice: boolean;
  trustScore: number;
  deviceAgeDays: number;
  isEmulator: boolean;
  isRooted: boolean;
  isVpnOrProxy: boolean;
  isTor: boolean;
  integrityScore: number;
  screenResolution?: string;
  userAgentHash?: string;
}

/**
 * Geolocation risk data
 */
export interface GeoLocationData {
  countryCode: string;
  matchesAccountCountry: boolean;
  distanceFromHome?: number;
  isHighRiskCountry: boolean;
  isSanctionedCountry: boolean;
  countryRiskScore: number;
  timezoneConsistent: boolean;
  city?: string;
  region?: string;
  isp?: string;
  connectionType?: 'broadband' | 'mobile' | 'corporate' | 'datacenter' | 'unknown';
}

/**
 * Individual risk factor contribution
 */
export interface RiskFactorContribution {
  factorId: string;
  factorName: string;
  score: number;
  maxScore: number;
  rawValue: unknown;
  indicators: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Complete risk assessment result
 */
export interface RiskAssessmentResult {
  riskScore: number;
  riskLevel: RiskLevel;
  requiredAuth: AuthRequirement;
  shouldBlock: boolean;
  shouldFlag: boolean;
  factors: RiskFactorContribution[];
  amlAlerts: AMLAlert[];
  assessedAt: Date;
  assessmentVersion: string;
  recommendations: string[];
  confidence: number;
  processingTimeMs: number;
}

/**
 * AML alert detail
 */
export interface AMLAlert {
  type: AMLAlertType;
  severity: number;
  description: string;
  threshold?: number;
  actualValue?: number;
  sarRecommended: boolean;
  timestamp: Date;
}

/**
 * Risk threshold configuration
 */
export interface RiskThresholds {
  lowMax: number;
  mediumMax: number;
  highMax: number;
  criticalMin: number;
}

/**
 * Risk factor weight configuration
 */
export interface RiskFactorWeights {
  amountWeight: number;
  velocityWeight: number;
  deviceWeight: number;
  geographicWeight: number;
  behavioralWeight: number;
  historicalWeight: number;
  complianceWeight: number;
  customerProfileWeight: number;
}

/**
 * Complete risk engine configuration
 */
export interface RiskEngineConfig {
  profile: RiskProfile;
  thresholds?: Partial<RiskThresholds>;
  weights?: Partial<RiskFactorWeights>;
  enableAML: boolean;
  enforceKYC: boolean;
  adaptiveMode: boolean;
  maxHistorySize: number;
  cacheTTL: number;
  version: string;
}

/**
 * Historical risk record for tracking
 */
export interface RiskHistoryRecord {
  id: string;
  transactionId: string;
  customerId: string;
  assessment: Omit<RiskAssessmentResult, 'processingTimeMs'>;
  decision: 'approved' | 'denied' | 'review';
  decisionMaker: 'system' | 'analyst' | 'override';
  notes?: string;
  createdAt: Date;
}

/**
 * Statistics about risk assessments over time
 */
export interface RiskStatistics {
  totalAssessments: number;
  byLevel: Record<RiskLevel, number>;
  averageScore: number;
  medianScore: number;
  percentiles: { p25: number; p50: number; p75: number; p90: number; p99: number };
  blockRate: number;
  flagRate: number;
  topFactors: Array<{ factorId: string; count: number; avgScore: number }>;
  amlStats: { totalAlerts: number; byType: Record<AMLAlertType, number> };
}

// ============== Default Configurations ==============

/** Default threshold values for each risk profile */
export const DEFAULT_THRESHOLDS: Record<RiskProfile, RiskThresholds> = {
  conservative: { lowMax: 20, mediumMax: 40, highMax: 60, criticalMin: 61 },
  moderate: { lowMax: 30, mediumMax: 50, highMax: 70, criticalMin: 71 },
  aggressive: { lowMax: 40, mediumMax: 65, highMax: 80, criticalMin: 81 },
};

/** Default factor weights for each risk profile */
export const DEFAULT_WEIGHTS: Record<RiskProfile, RiskFactorWeights> = {
  conservative: {
    amountWeight: 0.20,
    velocityWeight: 0.18,
    deviceWeight: 0.15,
    geographicWeight: 0.12,
    behavioralWeight: 0.10,
    historicalWeight: 0.10,
    complianceWeight: 0.10,
    customerProfileWeight: 0.05,
  },
  moderate: {
    amountWeight: 0.18,
    velocityWeight: 0.15,
    deviceWeight: 0.12,
    geographicWeight: 0.12,
    behavioralWeight: 0.15,
    historicalWeight: 0.12,
    complianceWeight: 0.10,
    customerProfileWeight: 0.06,
  },
  aggressive: {
    amountWeight: 0.15,
    velocityWeight: 0.12,
    deviceWeight: 0.10,
    geographicWeight: 0.08,
    behavioralWeight: 0.20,
    historicalWeight: 0.15,
    complianceWeight: 0.12,
    customerProfileWeight: 0.08,
  },
};

/** Default engine configuration */
export const DEFAULT_CONFIG: Omit<RiskEngineConfig, 'profile'> = {
  enableAML: true,
  enforceKYC: true,
  adaptiveMode: false,
  maxHistorySize: 10000,
  cacheTTL: 300000,
  version: '1.0.0',
};

/** High-risk country codes (OFAC sanctioned + high-risk jurisdictions) */
export const HIGH_RISK_COUNTRIES: Set<string> = new Set([
  'KP', 'IR', 'SY', 'CU', 'MM', 'RU', 'BY',
]);

/** Sanctioned country codes (OFAC comprehensive sanctions) */
export const SANCTIONED_COUNTRIES: Set<string> = new Set([
  'KP', 'CU', 'IR', 'SY',
]);

/** High-risk MCC categories */
export const HIGH_RISK_MCCS: Set<string> = new Set([
  '4899', // Cryptocurrency
  '6012', // Financial institutions
  '6051', // Foreign currency
  '7995', // Gambling
]);

/** Suspicious transaction patterns */
export const SUSPICIOUS_PATTERNS = {
  ROUND_AMOUNT_THRESHOLD: 0.95,
  MAX_VELOCITY_PER_HOUR: 10,
  MAX_VELOCITY_PER_DAY: 50,
  STRUCTURING_WINDOW_DAYS: 24,
  STRUCTURING_THRESHOLD: 9000,
  NEW_RECIPIENT_RATIO: 0.8,
};
