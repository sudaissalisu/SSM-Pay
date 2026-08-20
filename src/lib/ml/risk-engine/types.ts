/**
 * @module risk-engine/types
 * @description Type definitions for the risk assessment engine in SSM-Pay.
 * Defines interfaces for risk factors, categories, and assessment results.
 */

/** Risk factor identifiers */
export enum RiskFactor {
  /** Transaction amount relative to limits/history */
  AMOUNT = 'AMOUNT',
  /** Transaction frequency/velocity */
  FREQUENCY = 'FREQUENCY',
  /** Geographic location risk */
  GEOGRAPHIC = 'GEOGRAPHIC',
  /** Device trust level */
  DEVICE = 'DEVICE',
  /** Customer history and behavior */
  CUSTOMER_HISTORY = 'CUSTOMER_HISTORY',
  /** Payment method risk profile */
  PAYMENT_METHOD = 'PAYMENT_METHOD',
  /** Time-based patterns (unusual hours) */
  TEMPORAL = 'TEMPORAL',
  /** Merchant/category risk */
  MERCHANT = 'MERCHANT'
}

/** Categories of risk assessment */
export enum RiskCategory {
  /** Financial risk - potential monetary loss */
  FINANCIAL = 'FINANCIAL',
  /** Compliance risk - regulatory concerns */
  COMPLIANCE = 'COMPLIANCE',
  /** Operational risk - system/process issues */
  OPERATIONAL = 'OPERATIONAL',
  /** Reputational risk - brand/public perception */
  REPUTATIONAL = 'REPUTATIONAL',
  /** Fraud risk - intentional deception */
  FRAUD = 'FRAUD'
}

/** Individual risk factor evaluation result */
export interface FactorAssessment {
  /** The risk factor being assessed */
  factor: RiskFactor;
  /** Category this factor belongs to */
  category: RiskCategory;
  /** Risk score from 0-100 for this factor */
  score: number;
  /** Weight of this factor in overall calculation (0-1) */
  weight: number;
  /** Weighted score contribution */
  weightedScore: number;
  /** Human-readable description of findings */
  description: string;
  /** Severity level */
  severity: RiskSeverity;
  /** Additional details about the assessment */
  details?: Record<string, unknown>;
}

/** Risk severity levels */
export enum RiskSeverity {
  NEGLIGIBLE = 'NEGLIGIBLE',
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/** Complete risk assessment for a transaction or entity */
export interface RiskAssessment {
  /** Unique identifier for this assessment */
  assessmentId: string;
  /** Overall composite risk score (0-100) */
  overallScore: number;
  /** Risk level classification */
  riskLevel: RiskLevel;
  /** Primary risk category driving the score */
  primaryCategory: RiskCategory;
  /** All individual factor assessments */
  factors: FactorAssessment[];
  /** Recommended action based on risk level */
  recommendation: RiskRecommendation;
  /** Confidence in the assessment (0-1) */
  confidence: number;
  /** When the assessment was performed */
  assessedAt: Date;
  /** Entity being assessed (transaction ID, customer ID, etc.) */
  subjectId: string;
  /** Subject type being assessed */
  subjectType: SubjectType;
  /** Whether review is required */
  requiresReview: boolean;
  /** Expiration time for this assessment */
  expiresAt?: Date;
}

/** Overall risk levels */
export enum RiskLevel {
  MINIMAL = 'MINIMAL',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  ELEVATED = 'ELEVATED',
  CRITICAL = 'CRITICAL'
}

/** Recommended actions after risk assessment */
export enum RiskRecommendation {
  APPROVE = 'APPROVE',
  APPROVE_WITH_CONDITIONS = 'APPROVE_WITH_CONDITIONS',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  ADDITIONAL_VERIFICATION = 'ADDITIONAL_VERIFICATION',
  DECLINE = 'DECLINE',
  BLOCK_AND_ESCALATE = 'BLOCK_AND_ESCALATE'
}

/** Types of subjects that can be assessed */
export enum SubjectType {
  TRANSACTION = 'TRANSACTION',
  CUSTOMER = 'CUSTOMER',
  MERCHANT = 'MERCHANT',
  SESSION = 'SESSION'
}

/** Configuration for the risk engine */
export interface RiskConfig {
  /** Score thresholds for each risk level */
  thresholds: {
    low: number;
    medium: number;
    high: number;
    elevated: number;
    critical: number;
  };
  /** Weights for each risk factor */
  factorWeights: Partial<Record<RiskFactor, number>>;
  /** Whether to automatically decline high-risk transactions */
  autoDeclineHighRisk: boolean;
  /** Whether to require manual review for medium risk */
  requireReviewMediumRisk: boolean;
  /** Assessment validity period in milliseconds */
  assessmentValidityMs: number;
  /** Enable caching of assessments */
  enableCache: boolean;
  /** Maximum cache size */
  maxCacheSize: number;
}

/** Default configuration values */
export const DEFAULT_RISK_CONFIG: RiskConfig = {
  thresholds: {
    low: 20,
    medium: 40,
    high: 60,
    elevated: 75,
    critical: 90
  },
  factorWeights: {
    [RiskFactor.AMOUNT]: 0.20,
    [RiskFactor.FREQUENCY]: 0.15,
    [RiskFactor.GEOGRAPHIC]: 0.15,
    [RiskFactor.DEVICE]: 0.10,
    [RiskFactor.CUSTOMER_HISTORY]: 0.20,
    [RiskFactor.PAYMENT_METHOD]: 0.10,
    [RiskFactor.TEMPORAL]: 0.05,
    [RiskFactor.MERCHANT]: 0.05
  },
  autoDeclineHighRisk: false,
  requireReviewMediumRisk: true,
  assessmentValidityMs: 30 * 60 * 1000, // 30 minutes
  enableCache: true,
  maxCacheSize: 10000
};

/** Input data for transaction risk assessment */
export interface TransactionRiskInput {
  /** Transaction ID */
  transactionId: string;
  /** Amount in smallest currency unit */
  amount: number;
  /** Currency code */
  currency: string;
  /** Customer ID */
  customerId: string;
  /** Merchant ID */
  merchantId?: string;
  /** Payment method */
  paymentMethod: string;
  /** Origin country code */
  originCountry?: string;
  /** Destination country code */
  destinationCountry?: string;
  /** Device fingerprint */
  deviceFingerprint?: string;
  /** IP address */
  ipAddress?: string;
  /** Transaction timestamp */
  timestamp: Date;
  /** Merchant category code */
  mcc?: string;
  /** Channel used */
  channel: string;
}

/** Input data for customer risk assessment */
export interface CustomerRiskInput {
  /** Customer ID */
  customerId: string;
  /** Account creation date */
  accountCreatedDate: Date;
  /** Total transactions count */
  totalTransactions: number;
  /** Successful transaction rate */
  successRate: number;
  /** Total volume processed */
  totalVolume: number;
  /** Average transaction amount */
  avgTransactionAmount: number;
  /** Countries transacted from */
  countriesUsed: string[];
  /** Known devices count */
  deviceCount: number;
  /** Chargeback count */
  chargebackCount: number;
  /** Last transaction date */
  lastTransactionDate?: Date;
  /** Verification status */
  verificationStatus: VerificationStatus;
}

/** Customer verification status */
export enum VerificationStatus {
  NONE = 'NONE',
  BASIC = 'BASIC',
  ENHANCED = 'ENHANCED',
  FULL = 'FULL'
}

/** Generated risk report with detailed analysis */
export interface RiskReport {
  /** Assessment ID */
  assessmentId: string;
  /** Executive summary */
  summary: string;
  /** Key findings */
  keyFindings: string[];
  /** Detailed factor breakdown */
  factors: FactorAssessment[];
  /** Historical comparison */
  historicalComparison?: {
    previousScore: number;
    changePercent: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  /** Recommendations */
  recommendations: string[];
  /** Report generation timestamp */
  generatedAt: Date;
}
