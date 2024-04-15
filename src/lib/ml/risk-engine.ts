/**
 * Enterprise Risk Scoring Engine for SSM-Pay Payment Platform
 * 
 * @module ml/risk-engine
 * @description Comprehensive multi-factor risk assessment system providing real-time
 * transaction risk scoring, dynamic threshold adjustment, historical tracking,
 * and compliance checks (AML/KYC). Supports configurable risk profiles for
 * different business requirements.
 * 
 * @example
 * ```typescript
 * import { RiskEngine } from '@/lib/ml/risk-engine';
 * 
 * const engine = new RiskEngine({ profile: 'moderate' });
 * const result = await engine.assessTransactionRisk(transactionData);
 * 
 * if (result.riskLevel === 'high') {
 *   // Require additional authentication
 *   console.log(result.requiredAuth);
 * }
 * ```
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Enumerations & Constants ==============

/**
 * Risk level classifications from lowest to highest risk
 */
export enum RiskLevel {
  /** Score 0-29: Minimal risk, allow transaction */
  LOW = 'low',
  /** Score 30-59: Moderate risk, may require additional verification */
  MEDIUM = 'medium',
  /** Score 60-79: High risk, strong authentication required */
  HIGH = 'high',
  /** Score 80-100: Critical risk, block and review */
  CRITICAL = 'critical'
}

/**
 * Authentication requirement levels based on risk assessment
 */
export enum AuthRequirement {
  /** No additional authentication needed */
  NONE = 'none',
  /** Basic OTP verification via SMS/email */
  OTP = 'otp',
  /** Biometric verification (fingerprint, face) */
  BIOMETRIC = 'biometric',
  /** Step-up authentication with multiple factors */
  STEP_UP = 'step_up',
  /** Manual review by fraud analyst */
  MANUAL_REVIEW = 'manual_review',
  /** Transaction blocked - no authentication can override */
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
  /** Transaction exceeds reporting threshold */
  LARGE_TRANSACTION = 'large_transaction',
  /** Multiple transactions suggesting structuring */
  STRUCTURING = 'structuring',
  /** Transaction to/from high-risk jurisdiction */
  HIGH_RISK_COUNTRY = 'high_risk_country',
  /** Transaction matches sanctions list pattern */
  SANCTIONS_MATCH = 'sanctions_match',
  /** Unusual activity for customer profile */
  UNUSUAL_ACTIVITY = 'unusual_activity',
  /** Rapid succession of transactions */
  VELOCITY_BREACH = 'velocity_breach'
}

/**
 * KYC (Know Your Customer) verification status
 */
export enum KYCStatus {
  /** Full identity verification completed */
  VERIFIED = 'verified',
  /** Partial verification - basic info only */
  PARTIAL = 'partial',
  /** Verification pending review */
  PENDING = 'pending',
  /** No KYC information on file */
  NONE = 'none',
  /** KYC verification failed/rejected */
  REJECTED = 'rejected'
}

// ============== Interface Definitions ==============

/**
 * Core transaction data required for risk assessment
 */
export interface TransactionInput {
  /** Unique transaction identifier */
  transactionId: string;
  /** Transaction amount in minor units (e.g., kobo/cents) */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Transaction timestamp */
  timestamp: Date;
  /** Initiating user/customer ID */
  customerId: string;
  /** Hashed customer identifier for privacy */
  customerHash: string;
  /** Source account/wallet identifier */
  sourceAccountId: string;
  /** Destination account/wallet identifier */
  destinationAccountId: string;
  /** Payment method used */
  paymentMethod: PaymentMethod;
  /** Device fingerprint hash */
  deviceFingerprint: string;
  /** IP address (anonymized) */
  ipAddress: string;
  /** Country code from IP geolocation */
  countryCode: string;
  /** Merchant/category code if applicable */
  merchantCategoryCode?: string;
  /** Transaction description/memo */
  description?: string;
  /** Reference to originating request */
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
  /** Unique customer identifier */
  customerId: string;
  /** Account creation date */
  accountCreatedDate: Date;
  /** Current KYC verification status */
  kycStatus: KYCStatus;
  /** Customer risk rating from previous assessments */
  riskRating: number; // 0-100
  /** Total transaction count (lifetime) */
  totalTransactions: number;
  /** Total transaction volume (lifetime) in base currency */
  totalVolume: number;
  /** Number of chargebacks/disputes */
  disputeCount: number;
  /** Number of flagged transactions */
  flaggedCount: number;
  /** Account status */
  accountStatus: 'active' | 'suspended' | 'restricted' | 'under_review';
  /** Customer tier/segment */
  tier: 'individual' | 'business' | 'premium' | 'enterprise';
  /** Known countries of operation */
  knownCountries: string[];
  /** Known devices (hashes) */
  knownDevices: string[];
  /** Email domain for analysis */
  emailDomain?: string;
  /** Phone country code */
  phoneCountryCode?: string;
}

/**
 * Historical transaction data for velocity and pattern analysis
 */
export interface TransactionHistory {
  /** Transactions in last 1 hour */
  lastHourCount: number;
  /** Transactions in last 24 hours */
  last24hCount: number;
  /** Transactions in last 7 days */
  last7dCount: number;
  /** Transactions in last 30 days */
  last30dCount: number;
  /** Sum of transactions in last 24 hours */
  last24hVolume: number;
  /** Sum of transactions in last 7 days */
  last7dVolume: number;
  /** Average transaction amount (30 day) */
  avgAmount30d: number;
  /** Standard deviation of amounts (30 day) */
  stdAmount30d: number;
  /** Maximum single transaction amount (30 day) */
  maxAmount30d: number;
  /** Time since last transaction in minutes */
  minutesSinceLastTxn: number;
  /** Failed transaction count (last 24h) */
  failedTxnCount24h: number;
  /** Declined transaction count (last 24h) */
  declinedTxnCount24h: number;
  /** Count of transactions to new recipients */
  newRecipientCount24h: number;
  /** List of recent destination accounts */
  recentDestinations: string[];
}

/**
 * Device intelligence data
 */
export interface DeviceIntelligence {
  /** Is this a known/trusted device? */
  isKnownDevice: boolean;
  /** Device trust score (0-100) */
  trustScore: number;
  /** Device age in days since first seen */
  deviceAgeDays: number;
  /** Is emulator or virtual environment detected? */
  isEmulator: boolean;
  /** Is root/jailbreak detected? */
  isRooted: boolean;
  /** VPN/proxy detected? */
  isVpnOrProxy: boolean;
  /** Tor network detected? */
  isTor: boolean;
  /** Browser/OS integrity score */
  integrityScore: number;
  /** Screen resolution (for bot detection) */
  screenResolution?: string;
  /** User agent string hash */
  userAgentHash?: string;
}

/**
 * Geolocation risk data
 */
export interface GeoLocationData {
  /** ISO 3166-1 alpha-2 country code */
  countryCode: string;
  /** IP-based country match with phone/account country */
  matchesAccountCountry: boolean;
  /** Distance from usual location (km) */
  distanceFromHome?: number;
  /** Is high-risk jurisdiction? */
  isHighRiskCountry: boolean;
  /** Is sanctioned country? */
  isSanctionedCountry: boolean;
  /** Country risk score (0-100) */
  countryRiskScore: number;
  /** Timezone offset consistency check */
  timezoneConsistent: boolean;
  /** City name if available */
  city?: string;
  /** Region/state if available */
  region?: string;
  /** ISP information */
  isp?: string;
  /** Connection type */
  connectionType?: 'broadband' | 'mobile' | 'corporate' | 'datacenter' | 'unknown';
}

/**
 * Individual risk factor contribution
 */
export interface RiskFactorContribution {
  /** Factor category identifier */
  factorId: string;
  /** Human-readable factor name */
  factorName: string;
  /** Weighted score contribution (0-100) */
  score: number;
  /** Maximum possible score for this factor */
  maxScore: number;
  /** Raw value that produced this score */
  rawValue: unknown;
  /** Risk indicator flags */
  indicators: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Complete risk assessment result
 */
export interface RiskAssessmentResult {
  /** Overall composite risk score (0-100) */
  riskScore: number;
  /** Classified risk level */
  riskLevel: RiskLevel;
  /** Required authentication level */
  requiredAuth: AuthRequirement;
  /** Should transaction be blocked immediately? */
  shouldBlock: boolean;
  /** Should transaction be flagged for review? */
  shouldFlag: boolean;
  /** Individual factor contributions */
  factors: RiskFactorContribution[];
  /** AML alerts triggered */
  amlAlerts: AMLAlert[];
  /** Assessment timestamp */
  assessedAt: Date;
  /** Assessment version/config used */
  assessmentVersion: string;
  /** Recommended actions */
  recommendations: string[];
  /** Confidence level in assessment (0-100) */
  confidence: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * AML alert detail
 */
export interface AMLAlert {
  /** Alert type classification */
  type: AMLAlertType;
  /** Alert severity (1-5) */
  severity: number;
  /** Alert description */
  description: string;
  /** Regulatory threshold breached (if applicable) */
  threshold?: number;
  /** Actual value that triggered alert */
  actualValue?: number;
  /** SAR (Suspicious Activity Report) recommended */
  sarRecommended: boolean;
  /** Alert timestamp */
  timestamp: Date;
}

/**
 * Risk threshold configuration
 */
export interface RiskThresholds {
  /** Upper bound for low risk */
  lowMax: number;
  /** Upper bound for medium risk */
  mediumMax: number;
  /** Upper bound for high risk */
  highMax: number;
  /** Above this is critical */
  criticalMin: number;
}

/**
 * Risk factor weight configuration
 */
export interface RiskFactorWeights {
  /** Amount-related risk weight */
  amountWeight: number;
  /** Velocity/rate risk weight */
  velocityWeight: number;
  /** Device risk weight */
  deviceWeight: number;
  /** Geographic risk weight */
  geographicWeight: number;
  /** Behavioral/pattern risk weight */
  behavioralWeight: number;
  /** Historical risk weight */
  historicalWeight: number;
  /** Compliance/AML risk weight */
  complianceWeight: number;
  /** Customer profile risk weight */
  customerProfileWeight: number;
}

/**
 * Complete risk engine configuration
 */
export interface RiskEngineConfig {
  /** Risk sensitivity profile */
  profile: RiskProfile;
  /** Custom threshold overrides */
  thresholds?: Partial<RiskThresholds>;
  /** Custom weight overrides */
  weights?: Partial<RiskFactorWeights>;
  /** Enable AML monitoring */
  enableAML: boolean;
  /** Enable KYC enforcement */
  enforceKYC: boolean;
  /** Enable adaptive learning */
  adaptiveMode: boolean;
  /** Maximum history entries to retain */
  maxHistorySize: number;
  /** Assessment cache TTL in milliseconds */
  cacheTTL: number;
  /** Version identifier for audit trail */
  version: string;
}

/**
 * Historical risk record for tracking
 */
export interface RiskHistoryRecord {
  /** Record ID */
  id: string;
  /** Transaction ID */
  transactionId: string;
  /** Customer ID */
  customerId: string;
  /** Assessment result snapshot */
  assessment: Omit<RiskAssessmentResult, 'processingTimeMs'>;
  /** Decision made (approve/deny/review) */
  decision: 'approved' | 'denied' | 'review';
  /** Who/what made the decision */
  decisionMaker: 'system' | 'analyst' | 'override';
  /** Optional analyst notes */
  notes?: string;
  /** Record creation time */
  createdAt: Date;
}

/**
 * Statistics about risk assessments over time
 */
export interface RiskStatistics {
  /** Total assessments performed */
  totalAssessments: number;
  /** Assessments by risk level */
  byLevel: Record<RiskLevel, number>;
  /** Average risk score */
  averageScore: number;
  /** Median risk score */
  medianScore: number;
  /** Score distribution percentiles */
  percentiles: { p25: number; p50: number; p75: number; p90: number; p99: number };
  /** Block rate percentage */
  blockRate: number;
  /** Flag rate percentage */
  flagRate: number;
  /** Top triggered factors */
  topFactors: Array<{ factorId: string; count: number; avgScore: number }>;
  /** AML alert statistics */
  amlStats: { totalAlerts: number; byType: Record<AMLAlertType, number> };
}

// ============== Default Configurations ==============

/** Default threshold values for each risk profile */
const DEFAULT_THRESHOLDS: Record<RiskProfile, RiskThresholds> = {
  conservative: { lowMax: 20, mediumMax: 40, highMax: 60, criticalMin: 61 },
  moderate: { lowMax: 30, mediumMax: 50, highMax: 70, criticalMin: 71 },
  aggressive: { lowMax: 40, mediumMax: 65, highMax: 80, criticalMin: 81 },
};

/** Default factor weights for each risk profile */
const DEFAULT_WEIGHTS: Record<RiskProfile, RiskFactorWeights> = {
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
const DEFAULT_CONFIG: Omit<RiskEngineConfig, 'profile'> = {
  enableAML: true,
  enforceKYC: true,
  adaptiveMode: false,
  maxHistorySize: 10000,
  cacheTTL: 300000, // 5 minutes
  version: '1.0.0',
};

/** High-risk country codes (OFAC sanctioned + high-risk jurisdictions) */
const HIGH_RISK_COUNTRIES: Set<string> = new Set([
  'KP', 'IR', 'SY', 'CU', 'MM', 'RU', 'BY',
]);

/** Sanctioned country codes (OFAC comprehensive sanctions) */
const SANCTIONED_COUNTRIES: Set<string> = new Set([
  'KP', 'CU', 'IR', 'SY',
]);

/** High-risk MCC categories */
const HIGH_RISK_MCCS: Set<string> = new Set([
  '4899', // Cryptocurrency
  '6012', // Financial institutions
  '6051', // Foreign currency
  '7995', // Gambling
]);

/** Suspicious transaction patterns */
const SUSPICIOUS_PATTERNS = {
  ROUND_AMOUNT_THRESHOLD: 0.95, // Ratio for round amount detection
  MAX_VELOCITY_PER_HOUR: 10,
  MAX_VELOCITY_PER_DAY: 50,
  STRUCTURING_WINDOW_DAYS: 24,
  STRUCTURING_THRESHOLD: 9000, // Just below $10k reporting threshold (in cents)
  NEW_RECIPIENT_RATIO: 0.8, // >80% new recipients is suspicious
};

// ============== Main Risk Engine Class ==============

/**
 * Enterprise Risk Scoring Engine
 * 
 * Provides comprehensive multi-factor risk assessment for payment transactions.
 * Supports dynamic threshold adjustment, historical tracking, and regulatory compliance.
 * 
 * @class RiskEngine
 * @example
 * ```typescript
 * const engine = new RiskEngine({
 *   profile: 'conservative',
 *   enableAML: true,
 * });
 * 
 * const result = await engine.assessTransactionRisk(transaction, customer, history);
 * ```
 */
export class RiskEngine {
  /** Current configuration */
  private config: RiskEngineConfig;
  
  /** Active threshold configuration */
  private thresholds: RiskThresholds;
  
  /** Active factor weights */
  private weights: RiskFactorWeights;
  
  /** Historical assessment records */
  private history: Map<string, RiskHistoryRecord[]> = new Map();
  
  /** Assessment cache for performance */
  private assessmentCache: Map<string, { result: RiskAssessmentResult; expiry: Date }> = new Map();
  
  /** Running statistics */
  private stats: RiskStatistics = this.initializeStatistics();

  /**
   * Creates a new RiskEngine instance
   * 
   * @param config - Configuration options for the risk engine
   * @throws {AppError} If configuration is invalid
   */
  constructor(config: Partial<RiskEngineConfig> = {}) {
    const profile: RiskProfile = config.profile || 'moderate';
    
    // Validate profile
    if (!['conservative', 'moderate', 'aggressive'].includes(profile)) {
      throw new AppError(
        `Invalid risk profile: ${profile}`,
        ErrorCode.INVALID_CONFIG,
        { severity: 'error', context: { provided: profile } }
      );
    }

    // Build complete configuration
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      profile,
    };

    // Initialize thresholds with defaults and overrides
    this.thresholds = {
      ...DEFAULT_THRESHOLDS[profile],
      ...(this.config.thresholds || {}),
    };

    // Initialize weights with defaults and overrides
    this.weights = {
      ...DEFAULT_WEIGHTS[profile],
      ...(this.config.weights || {}),
    };

    // Validate weights sum to approximately 1
    const weightSum = Object.values(this.weights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      logger.warn('Risk factor weights do not sum to 1.0', {
        event: 'risk_engine.init',
        metadata: { weightSum, weights: this.weights },
      });
    }

    logger.info('Risk Engine initialized', {
      event: 'risk_engine.init',
      metadata: {
        profile: this.config.profile,
        thresholds: this.thresholds,
        version: this.config.version,
      },
    });
  }

  // ============== Public API Methods ==============

  /**
   * Perform comprehensive risk assessment on a transaction
   * 
   * @param transaction - The transaction to assess
   * @param customer - Customer profile data
   * @param history - Transaction history for velocity analysis
   * @param device - Optional device intelligence data
   * @param geoLocation - Optional geolocation data
   * @returns Complete risk assessment result
   * 
   * @example
   * ```typescript
   * const result = await engine.assessTransactionRisk(
   *   transactionData,
   *   customerProfile,
   *   transactionHistory,
   *   deviceInfo,
   *   geoData
   * );
   * 
   * if (result.shouldBlock) {
   *   return error('Transaction blocked due to high risk');
   * }
   * ```
   */
  async assessTransactionRisk(
    transaction: TransactionInput,
    customer: CustomerProfile,
    history: TransactionHistory,
    device?: DeviceIntelligence,
    geoLocation?: GeoLocationData
  ): Promise<RiskAssessmentResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(transaction);
      const cached = this.getCachedAssessment(cacheKey);
      if (cached) {
        logger.debug('Returning cached risk assessment', {
          event: 'risk_engine.cache_hit',
          metadata: { transactionId: transaction.transactionId },
        });
        return cached;
      }

      // Validate inputs
      this.validateInputs(transaction, customer, history);

      // Calculate individual factor scores
      const factors: RiskFactorContribution[] = [];

      // 1. Amount-based risk factors
      factors.push(this.calculateAmountRisk(transaction, history));

      // 2. Velocity/rate-based risk factors
      factors.push(this.calculateVelocityRisk(transaction, history));

      // 3. Device-based risk factors
      factors.push(this.calculateDeviceRisk(transaction, device));

      // 4. Geographic risk factors
      factors.push(this.calculateGeographicRisk(transaction, geoLocation, customer));

      // 5. Behavioral/pattern risk factors
      factors.push(this.calculateBehavioralRisk(transaction, history, customer));

      // 6. Historical risk factors
      factors.push(this.calculateHistoricalRisk(customer));

      // 7. Compliance/AML risk factors
      const amlAlerts = this.config.enableAML 
        ? this.performAMLChecks(transaction, history)
        : [];

      factors.push(this.calculateComplianceRisk(amlAlerts, customer));

      // 8. Customer profile risk factors
      factors.push(this.calculateCustomerProfileRisk(transaction, customer));

      // Calculate weighted composite score
      const riskScore = this.calculateCompositeScore(factors);

      // Determine risk level
      const riskLevel = this.classifyRiskLevel(riskScore);

      // Determine authentication requirements
      const requiredAuth = this.determineAuthRequirement(riskLevel, factors, customer);

      // Determine blocking/flagging
      const shouldBlock = this.shouldBlockTransaction(riskLevel, amlAlerts, customer);
      const shouldFlag = !shouldBlock && (riskLevel >= RiskLevel.HIGH || amlAlerts.length > 0);

      // Generate recommendations
      const recommendations = this.generateRecommendations(riskLevel, factors, amlAlerts);

      // Calculate confidence based on data completeness
      const confidence = this.calculateConfidence(factors, device, geoLocation);

      // Build final result
      const result: RiskAssessmentResult = {
        riskScore: Math.round(riskScore * 100) / 100,
        riskLevel,
        requiredAuth,
        shouldBlock,
        shouldFlag,
        factors,
        amlAlerts,
        assessedAt: new Date(),
        assessmentVersion: this.config.version,
        recommendations,
        confidence,
        processingTimeMs: Date.now() - startTime,
      };

      // Cache the result
      this.cacheAssessment(cacheKey, result);

      // Update statistics
      this.updateStatistics(result);

      // Log the assessment
      logger.info('Risk assessment completed', {
        event: 'risk_engine.assessment',
        metadata: {
          transactionId: transaction.transactionId,
          customerId: customer.customerId,
          riskScore: result.riskScore,
          riskLevel: result.riskLevel,
          shouldBlock: result.shouldBlock,
          authRequired: result.requiredAuth,
          amlAlerts: amlAlerts.length,
          processingTimeMs: result.processingTimeMs,
        },
      });

      return result;

    } catch (error) {
      const appError = error instanceof AppError 
        ? error 
        : new AppError('Risk assessment failed', ErrorCode.UNKNOWN_ERROR, { cause: error as Error });

      logger.error('Risk assessment error', {
        event: 'risk_engine.error',
        metadata: { transactionId: transaction.transactionId },
        error: appError,
      });

      throw appError;
    }
  }

  /**
   * Quick risk pre-check before full assessment
   * Performs fast checks for obvious blocks (sanctions, etc.)
   * 
   * @param transaction - Transaction to pre-check
   * @returns Object indicating if transaction passes pre-check
   */
  quickPreCheck(transaction: TransactionInput): { passed: boolean; reason?: string } {
    // Check for sanctioned countries
    if (SANCTIONED_COUNTRIES.has(transaction.countryCode)) {
      return {
        passed: false,
        reason: `Transaction from sanctioned country: ${transaction.countryCode}`,
      };
    }

    // Check for obviously suspicious amounts
    if (transaction.amount <= 0) {
      return {
        passed: false,
        reason: 'Invalid transaction amount',
      };
    }

    // Check for future timestamps
    if (transaction.timestamp > new Date()) {
      return {
        passed: false,
        reason: 'Future transaction timestamp',
      };
    }

    return { passed: true };
  }

  /**
   * Record assessment outcome for historical tracking and model improvement
   * 
   * @param transactionId - Assessed transaction ID
   * @param result - The assessment result
   * @param decision - Final decision made
   * @param decisionMaker - Who made the decision
   * @param notes - Optional analyst notes
   */
  recordAssessment(
    transactionId: string,
    result: RiskAssessmentResult,
    decision: 'approved' | 'denied' | 'review',
    decisionMaker: 'system' | 'analyst' | 'override' = 'system',
    notes?: string
  ): void {
    const record: RiskHistoryRecord = {
      id: `${transactionId}_${Date.now()}`,
      transactionId,
      customerId: '', // Would be populated from context
      assessment: { ...result, processingTimeMs: 0 },
      decision,
      decisionMaker,
      notes,
      createdAt: new Date(),
    };

    // Store in history (using transactionId as key for simplicity)
    const existing = this.history.get(transactionId) || [];
    existing.push(record);
    
    // Trim to max size
    if (existing.length > this.config.maxHistorySize) {
      existing.shift();
    }
    
    this.history.set(transactionId, existing);

    logger.debug('Assessment recorded', {
      event: 'risk_engine.record',
      metadata: { transactionId, decision, decisionMaker },
    });

    // Adaptive mode: adjust thresholds based on outcomes
    if (this.config.adaptiveMode && decisionMaker === 'analyst') {
      this.adaptFromFeedback(record);
    }
  }

  /**
   * Get aggregated risk statistics
   * 
   * @returns Current risk statistics snapshot
   */
  getStatistics(): RiskStatistics {
    return { ...this.stats };
  }

  /**
   * Get current configuration (for debugging/admin)
   * 
   * @returns Current engine configuration
   */
  getConfig(): Readonly<RiskEngineConfig> {
    return { ...this.config };
  }

  /**
   * Get current thresholds
   * 
   * @returns Current threshold configuration
   */
  getThresholds(): Readonly<RiskThresholds> {
    return { ...this.thresholds };
  }

  /**
   * Dynamically update thresholds at runtime
   * 
   * @param updates - Threshold values to update
   */
  updateThresholds(updates: Partial<RiskThresholds>): void {
    this.thresholds = { ...this.thresholds, ...updates };
    
    logger.info('Thresholds updated', {
      event: 'risk_engine.threshold_update',
      metadata: { newThresholds: this.thresholds },
    });
  }

  /**
   * Dynamically update factor weights at runtime
   * 
   * @param updates - Weight values to update
   */
  updateWeights(updates: Partial<RiskFactorWeights>): void {
    this.weights = { ...this.weights, ...updates };
    
    logger.info('Weights updated', {
      event: 'risk_engine.weight_update',
      metadata: { newWeights: this.weights },
    });
  }

  /**
   * Change risk profile at runtime
   * 
   * @param newProfile - New risk profile to use
   */
  changeProfile(newProfile: RiskProfile): void {
    this.config.profile = newProfile;
    this.thresholds = { ...DEFAULT_THRESHOLDS[newProfile] };
    this.weights = { ...DEFAULT_WEIGHTS[newProfile] };
    
    // Clear cache when profile changes
    this.assessmentCache.clear();
    
    logger.info('Risk profile changed', {
      event: 'risk_engine.profile_change',
      metadata: { newProfile, thresholds: this.thresholds },
    });
  }

  /**
   * Get assessment history for a specific transaction
   * 
   * @param transactionId - Transaction ID to look up
   * @returns History records or empty array
   */
  getTransactionHistory(transactionId: string): RiskHistoryRecord[] {
    return (this.history.get(transactionId) || []).map(r => ({ ...r }));
  }

  /**
   * Clear all cached assessments
   */
  clearCache(): void {
    this.assessmentCache.clear();
    logger.debug('Assessment cache cleared', { event: 'risk_engine.cache_clear' });
  }

  /**
   * Reset all statistics
   */
  resetStatistics(): void {
    this.stats = this.initializeStatistics();
    logger.info('Statistics reset', { event: 'risk_engine.stats_reset' });
  }

  // ============== Private Calculation Methods ==============

  /**
   * Calculate amount-related risk factors
   * Considers absolute amount, deviation from average, and round amounts
   */
  private calculateAmountRisk(
    transaction: TransactionInput,
    history: TransactionHistory
  ): RiskFactorContribution {
    let score = 0;
    const indicators: string[] = [];
    const metadata: Record<string, unknown> = {};

    // Factor 1: Absolute amount risk (logarithmic scale)
    const amountInMajor = transaction.amount / 100; // Convert from minor units
    if (amountInMajor > 10000) {
      score += 40;
      indicators.push('very_high_amount');
    } else if (amountInMajor > 5000) {
      score += 25;
      indicators.push('high_amount');
    } else if (amountInMajor > 1000) {
      score += 15;
      indicators.push('elevated_amount');
    } else if (amountInMajor > 500) {
      score += 8;
      indicators.push('moderate_amount');
    }
    metadata.amountInMajor = amountInMajor;

    // Factor 2: Deviation from user's average
    if (history.avgAmount30d > 0) {
      const deviation = Math.abs(amountInMajor - history.avgAmount30d / 100) / (history.stdAmount30d / 100 || 1);
      if (deviation > 5) {
        score += 35;
        indicators.push('extreme_deviation');
      } else if (deviation > 3) {
        score += 20;
        indicators.push('high_deviation');
      } else if (deviation > 2) {
        score += 10;
        indicators.push('moderate_deviation');
      }
      metadata.deviation = Math.round(deviation * 100) / 100;
    }

    // Factor 3: Exceeds maximum historical
    if (history.maxAmount30d > 0 && transaction.amount > history.maxAmount30d) {
      score += 15;
      indicators.push('exceeds_historical_max');
      metadata.previousMax = history.maxAmount30d;
    }

    // Factor 4: Round amount detection (potential structuring)
    if (amountInMajor > 1000) {
      const roundedToThousand = amountInMajor % 1000 === 0;
      const roundedToHundred = amountInMajor % 100 === 0;
      
      if (roundedToThousand) {
        score += 15;
        indicators.push('round_thousand_amount');
      } else if (roundedToHundred) {
        score += 8;
        indicators.push('round_hundred_amount');
      }
    }

    // Factor 5: Just below reporting threshold (potential structuring)
    const structuringRange = [900000, 950000, 990000]; // In cents ($9,000-$9,900)
    if (structuringRange.some(threshold => 
      Math.abs(transaction.amount - threshold) < 5000
    )) {
      score += 25;
      indicators.push('near_structuring_threshold');
    }

    // Cap at 100
    score = Math.min(score, 100);

    return {
      factorId: 'amount_risk',
      factorName: 'Amount Risk Analysis',
      score,
      maxScore: 100,
      rawValue: { amount: transaction.amount, amountInMajor },
      indicators,
      metadata,
    };
  }

  /**
   * Calculate velocity/rate-based risk factors
   * Analyzes transaction frequency patterns
   */
  private calculateVelocityRisk(
    transaction: TransactionInput,
    history: TransactionHistory
  ): RiskFactorContribution {
    let score = 0;
    const indicators: string[] = [];
    const metadata: Record<string, unknown> = {};

    // Factor 1: Hourly velocity
    if (history.lastHourCount > SUSPICIOUS_PATTERNS.MAX_VELOCITY_PER_HOUR) {
      score += 35;
      indicators.push('excessive_hourly_velocity');
    } else if (history.lastHourCount > SUSPICIOUS_PATTERNS.MAX_VELOCITY_PER_HOUR * 0.6) {
      score += 15;
      indicators.push('elevated_hourly_velocity');
    }
    metadata.hourlyCount = history.lastHourCount;

    // Factor 2: Daily velocity
    if (history.last24hCount > SUSPICIOUS_PATTERNS.MAX_VELOCITY_PER_DAY) {
      score += 35;
      indicators.push('excessive_daily_velocity');
    } else if (history.last24hCount > SUSPICIOUS_PATTERNS.MAX_VELOCITY_PER_DAY * 0.6) {
      score += 15;
      indicators.push('elevated_daily_velocity');
    }
    metadata.dailyCount = history.last24hCount;

    // Factor 3: Failed transaction ratio
    const totalAttempts = history.last24hCount + history.failedTxnCount24h + history.declinedTxnCount24h;
    if (totalAttempts > 5) {
      const failRate = (history.failedTxnCount24h + history.declinedTxnCount24h) / totalAttempts;
      if (failRate > 0.5) {
        score += 25;
        indicators.push('high_failure_rate');
      } else if (failRate > 0.3) {
        score += 12;
        indicators.push('elevated_failure_rate');
      }
      metadata.failureRate = Math.round(failRate * 100) / 100;
    }

    // Factor 4: Rapid successive transactions
    if (history.minutesSinceLastTxn < 1 && history.lastHourCount > 3) {
      score += 20;
      indicators.push('rapid_succession');
    } else if (history.minutesSinceLastTxn < 2 && history.lastHourCount > 5) {
      score += 10;
      indicators.push('quick_succession');
    }
    metadata.minutesSinceLastTxn = history.minutesSinceLastTxn;

    // Factor 5: New recipient ratio
    if (history.last24hCount > 3) {
      const newRecipientRatio = history.newRecipientCount24h / history.last24hCount;
      if (newRecipientRatio > SUSPICIOUS_PATTERNS.NEW_RECIPIENT_RATIO) {
        score += 15;
        indicators.push('many_new_recipients');
      }
      metadata.newRecipientRatio = Math.round(newRecipientRatio * 100) / 100;
    }

    score = Math.min(score, 100);

    return {
      factorId: 'velocity_risk',
      factorName: 'Velocity Analysis',
      score,
      maxScore: 100,
      rawValue: { 
        hourlyCount: history.lastHourCount, 
        dailyCount: history.last24hCount 
      },
      indicators,
      metadata,
    };
  }

  /**
   * Calculate device-based risk factors
   * Analyzes device fingerprint and integrity signals
   */
  private calculateDeviceRisk(
    transaction: TransactionInput,
    device?: DeviceIntelligence
  ): RiskFactorContribution {
    let score = 0;
    const indicators: string[] = [];
    const metadata: Record<string, unknown> = {};

    // If no device data, apply moderate risk
    if (!device) {
      return {
        factorId: 'device_risk',
        factorName: 'Device Analysis',
        score: 30, // Default moderate risk without data
        maxScore: 100,
        rawValue: null,
        indicators: ['no_device_data'],
        metadata: { reason: 'No device intelligence provided' },
      };
    }

    // Factor 1: Known device check
    if (!device.isKnownDevice) {
      score += 25;
      indicators.push('unknown_device');
    }
    metadata.isKnownDevice = device.isKnownDevice;

    // Factor 2: Device trust score (inverse relationship)
    score += (100 - device.trustScore) * 0.3;
    if (device.trustScore < 30) {
      indicators.push('low_device_trust');
    } else if (device.trustScore < 60) {
      indicators.push('moderate_device_trust');
    }
    metadata.deviceTrustScore = device.trustScore;

    // Factor 3: New device (age check)
    if (device.deviceAgeDays < 1) {
      score += 20;
      indicators.push('brand_new_device');
    } else if (device.deviceAgeDays < 7) {
      score += 10;
      indicators.push('recent_device');
    }
    metadata.deviceAgeDays = device.deviceAgeDays;

    // Factor 4: Emulator/virtual environment
    if (device.isEmulator) {
      score += 40;
      indicators.push('emulator_detected');
    }
    metadata.isEmulator = device.isEmulator;

    // Factor 5: Root/jailbreak detection
    if (device.isRooted) {
      score += 35;
      indicators.push('root_detected');
    }
    metadata.isRooted = device.isRooted;

    // Factor 6: VPN/Proxy detection
    if (device.isVpnOrProxy) {
      score += 15;
      indicators.push('vpn_proxy_detected');
    }
    metadata.isVpnOrProxy = device.isVpnOrProxy;

    // Factor 7: Tor network
    if (device.isTor) {
      score += 50;
      indicators.push('tor_network');
    }
    metadata.isTor = device.isTor;

    // Factor 8: Integrity score
    score += (100 - device.integrityScore) * 0.2;
    if (device.integrityScore < 50) {
      indicators.push('low_integrity_score');
    }
    metadata.integrityScore = device.integrityScore;

    score = Math.min(score, 100);

    return {
      factorId: 'device_risk',
      factorName: 'Device Analysis',
      score: Math.round(score),
      maxScore: 100,
      rawValue: device,
      indicators,
      metadata,
    };
  }

  /**
   * Calculate geographic/location-based risk factors
   * Analyzes IP geolocation and cross-border patterns
   */
  private calculateGeographicRisk(
    transaction: TransactionInput,
    geoLocation?: GeoLocationData,
    customer?: CustomerProfile
  ): RiskFactorContribution {
    let score = 0;
    const indicators: string[] = [];
    const metadata: Record<string, unknown> = {};

    // If no geo data, use basic country from transaction
    const effectiveGeo: GeoLocationData = geoLocation || {
      countryCode: transaction.countryCode,
      matchesAccountCountry: true,
      isHighRiskCountry: HIGH_RISK_COUNTRIES.has(transaction.countryCode),
      isSanctionedCountry: SANCTIONED_COUNTRIES.has(transaction.countryCode),
      countryRiskScore: HIGH_RISK_COUNTRIES.has(transaction.countryCode) ? 80 : 20,
      timezoneConsistent: true,
      connectionType: 'unknown',
    };

    // Factor 1: High-risk country
    if (effectiveGeo.isHighRiskCountry) {
      score += 35;
      indicators.push('high_risk_country');
    }
    metadata.isHighRiskCountry = effectiveGeo.isHighRiskCountry;

    // Factor 2: Sanctioned country (should be caught in pre-check too)
    if (effectiveGeo.isSanctionedCountry) {
      score += 100;
      indicators.push('sanctioned_country');
    }
    metadata.isSanctionedCountry = effectiveGeo.isSanctionedCountry;

    // Factor 3: Country mismatch
    if (!effectiveGeo.matchesAccountCountry) {
      score += 25;
      indicators.push('country_mismatch');
    }
    metadata.matchesAccountCountry = effectiveGeo.matchesAccountCountry;

    // Factor 4: Country risk score
    score += effectiveGeo.countryRiskScore * 0.3;
    metadata.countryRiskScore = effectiveGeo.countryRiskScore;

    // Factor 5: Distance from home location
    if (effectiveGeo.distanceFromHome !== undefined) {
      if (effectiveGeo.distanceFromHome > 5000) {
        // > 5000 km
        score += 25;
        indicators.push('impossible_travel');
      } else if (effectiveGeo.distanceFromHome > 1000) {
        score += 12;
        indicators.push('unusual_location');
      }
      metadata.distanceFromHomeKm = effectiveGeo.distanceFromHome;
    }

    // Factor 6: Timezone inconsistency
    if (!effectiveGeo.timezoneConsistent) {
      score += 15;
      indicators.push('timezone_inconsistent');
    }
    metadata.timezoneConsistent = effectiveGeo.timezoneConsistent;

    // Factor 7: Datacenter connection (bot suspicion)
    if (effectiveGeo.connectionType === 'datacenter') {
      score += 30;
      indicators.push('datacenter_connection');
    }
    metadata.connectionType = effectiveGeo.connectionType;

    // Factor 8: Cross-border for customer
    if (customer && customer.knownCountries.length > 0) {
      const isNewCountry = !customer.knownCountries.includes(effectiveGeo.countryCode);
      if (isNewCountry) {
        score += 15;
        indicators.push('new_country_for_customer');
      }
      metadata.customerKnownCountries = customer.knownCountries;
    }

    score = Math.min(score, 100);

    return {
      factorId: 'geographic_risk',
      factorName: 'Geographic Analysis',
      score: Math.round(score),
      maxScore: 100,
      rawValue: effectiveGeo,
      indicators,
      metadata,
    };
  }

  /**
   * Calculate behavioral/pattern-based risk factors
   * Analyzes transaction patterns and anomalies
   */
  private calculateBehavioralRisk(
    transaction: TransactionInput,
    history: TransactionHistory,
    customer: CustomerProfile
  ): RiskFactorContribution {
    let score = 0;
    const indicators: string[] = [];
    const metadata: Record<string, unknown> = {};

    // Factor 1: Time-based anomaly (transactions at unusual hours)
    const hour = transaction.timestamp.getHours();
    const isUnusualHour = hour >= 0 && hour < 5; // Midnight to 5 AM
    if (isUnusualHour && transaction.amount > 50000) {
      score += 15;
      indicators.push('unusual_hour_large_amount');
    }
    metadata.transactionHour = hour;

    // Factor 2: Weekend/holiday large transaction
    const dayOfWeek = transaction.timestamp.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend && transaction.amount > 100000) {
      score += 10;
      indicators.push('weekend_large_transaction');
    }
    metadata.dayOfWeek = dayOfWeek;

    // Factor 3: First transaction after long silence
    if (history.minutesSinceLastTxn > 1440) { // > 24 hours
      if (customer.totalTransactions > 10) {
        // Not a new customer
        score += 10;
        indicators.push('return_after_silence');
      }
    } else if (history.minutesSinceLastTxn > 10080) { // > 7 days
      score += 15;
      indicators.push('return_after_long_absence');
    }
    metadata.silenceMinutes = history.minutesSinceLastTxn;

    // Factor 4: Spending pattern break
    if (history.avgAmount30d > 0 && history.last30dCount >= 5) {
      const ratio = (transaction.amount / 100) / (history.avgAmount30d / 100);
      if (ratio > 10) {
        score += 25;
        indicators.push('spending_pattern_break');
      } else if (ratio > 5) {
        score += 12;
        indicators.push('elevated_spending');
      }
      metadata.spendingRatio = Math.round(ratio * 100) / 100;
    }

    // Factor 5: New account rapid activity
    const accountAgeDays = Math.floor(
      (Date.now() - customer.accountCreatedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (accountAgeDays < 7 && history.last24hCount > 5) {
      score += 25;
      indicators.push('new_account_rapid_activity');
    } else if (accountAgeDays < 30 && history.last24hCount > 20) {
      score += 15;
      indicators.push('young_account_high_activity');
    }
    metadata.accountAgeDays = accountAgeDays;

    // Factor 6: High-risk merchant category
    if (transaction.merchantCategoryCode && HIGH_RISK_MCCS.has(transaction.merchantCategoryCode)) {
      score += 20;
      indicators.push('high_risk_mcc');
    }
    metadata.mcc = transaction.merchantCategoryCode;

    // Factor 7: Self-transfer detection (source == destination)
    if (transaction.sourceAccountId === transaction.destinationAccountId) {
      score += 30;
      indicators.push('self_transfer_suspicious');
    }

    score = Math.min(score, 100);

    return {
      factorId: 'behavioral_risk',
      factorName: 'Behavioral Pattern Analysis',
      score: Math.round(score),
      maxScore: 100,
      rawValue: { hour, dayOfWeek, accountAgeDays },
      indicators,
      metadata,
    };
  }

  /**
   * Calculate historical risk factors based on customer's past behavior
   */
  private calculateHistoricalRisk(customer: CustomerProfile): RiskFactorContribution {
    let score = 0;
    const indicators: string[] = [];
    const metadata: Record<string, unknown> = {};

    // Factor 1: Previous risk rating
    score += customer.riskRating * 0.4;
    if (customer.riskRating > 70) {
      indicators.push('high_historical_risk');
    } else if (customer.riskRating > 50) {
      indicators.push('elevated_historical_risk');
    }
    metadata.historicalRiskRating = customer.riskRating;

    // Factor 2: Dispute/chargeback history
    const disputeRate = customer.totalTransactions > 0 
      ? customer.disputeCount / customer.totalTransactions 
      : 0;
    
    if (disputeRate > 0.1) {
      score += 30;
      indicators.push('high_dispute_rate');
    } else if (disputeRate > 0.05) {
      score += 15;
      indicators.push('elevated_dispute_rate');
    }
    metadata.disputeRate = Math.round(disputeRate * 100) / 100;
    metadata.disputeCount = customer.disputeCount;

    // Factor 3: Flagged transaction history
    const flaggedRate = customer.totalTransactions > 0
      ? customer.flaggedCount / customer.totalTransactions
      : 0;
    
    if (flaggedRate > 0.2) {
      score += 25;
      indicators.push('frequently_flagged');
    } else if (flaggedRate > 0.1) {
      score += 12;
      indicators.push('sometimes_flagged');
    }
    metadata.flaggedRate = Math.round(flaggedRate * 100) / 100;
    metadata.flaggedCount = customer.flaggedCount;

    // Factor 4: Account restrictions
    if (customer.accountStatus === 'restricted') {
      score += 40;
      indicators.push('account_restricted');
    } else if (customer.accountStatus === 'under_review') {
      score += 25;
      indicators.push('account_under_review');
    } else if (customer.accountStatus === 'suspended') {
      score += 100;
      indicators.push('account_suspended');
    }
    metadata.accountStatus = customer.accountStatus;

    // Factor 5: Low transaction history (new/unproven customer)
    if (customer.totalTransactions < 5) {
      score += 15;
      indicators.push('limited_history');
    } else if (customer.totalTransactions < 20) {
      score += 5;
      indicators.push('developing_history');
    }
    metadata.totalTransactions = customer.totalTransactions;

    score = Math.min(score, 100);

    return {
      factorId: 'historical_risk',
      factorName: 'Historical Analysis',
      score: Math.round(score),
      maxScore: 100,
      rawValue: customer,
      indicators,
      metadata,
    };
  }

  /**
   * Calculate compliance/AML risk factors
   */
  private calculateComplianceRisk(
    alerts: AMLAlert[],
    customer: CustomerProfile
  ): RiskFactorContribution {
    let score = 0;
    const indicators: string[] = [];
    const metadata: Record<string, unknown> = {};

    // Base score on alerts present
    score += alerts.length * 15;
    
    // Severity weighting
    const severitySum = alerts.reduce((sum, a) => sum + a.severity, 0);
    score += severitySum * 5;

    if (alerts.length > 0) {
      indicators.push('aml_alerts_present');
    }
    if (alerts.some(a => a.severity >= 4)) {
      indicators.push('high_severity_alerts');
      score += 20;
    }
    if (alerts.some(a => a.type === AMLAlertType.SANCTIONS_MATCH)) {
      indicators.push('sanctions_alert');
      score += 30;
    }

    // KYC status impact
    switch (customer.kycStatus) {
      case KYCStatus.NONE:
        score += 40;
        indicators.push('no_kyc');
        break;
      case KYCStatus.REJECTED:
        score += 50;
        indicators.push('kyc_rejected');
        break;
      case KYCStatus.PENDING:
        score += 20;
        indicators.push('kyc_pending');
        break;
      case KYCStatus.PARTIAL:
        score += 10;
        indicators.push('partial_kyc');
        break;
      case KYCStatus.VERIFIED:
        // No penalty
        break;
    }
    metadata.kycStatus = customer.kycStatus;

    // SAR recommendation check
    const sarRecommended = alerts.some(a => a.sarRecommended);
    if (sarRecommended) {
      indicators.push('sar_recommended');
      score += 15;
    }
    metadata.alertCount = alerts.length;
    metadata.sarRecommended = sarRecommended;

    score = Math.min(score, 100);

    return {
      factorId: 'compliance_risk',
      factorName: 'Compliance & AML Analysis',
      score: Math.round(score),
      maxScore: 100,
      rawValue: { alertCount: alerts.length, kycStatus: customer.kycStatus },
      indicators,
      metadata,
    };
  }

  /**
   * Calculate customer profile risk factors
   */
  private calculateCustomerProfileRisk(
    transaction: TransactionInput,
    customer: CustomerProfile
  ): RiskFactorContribution {
    let score = 0;
    const indicators: string[] = [];
    const metadata: Record<string, unknown> = {};

    // Factor 1: Account age
    const accountAgeDays = Math.floor(
      (Date.now() - customer.accountCreatedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (accountAgeDays < 1) {
      score += 30;
      indicators.push('brand_new_account');
    } else if (accountAgeDays < 7) {
      score += 15;
      indicators.push('very_new_account');
    } else if (accountAgeDays < 30) {
      score += 5;
      indicators.push('new_account');
    }
    metadata.accountAgeDays = accountAgeDays;

    // Factor 2: Tier-based adjustments
    switch (customer.tier) {
      case 'enterprise':
        // Lower risk for verified enterprises
        score -= 10;
        break;
      case 'premium':
        score -= 5;
        break;
      case 'individual':
        // Standard risk
        break;
      case 'business':
        // Slightly elevated for small businesses
        score += 5;
        indicators.push('business_tier');
        break;
    }
    metadata.tier = customer.tier;

    // Factor 3: Volume relative to tier expectations
    const expectedVolumeByTier: Record<CustomerProfile['tier'], number> = {
      individual: 1000000,     // $10,000/month
      business: 10000000,      // $100,000/month
      premium: 5000000,        // $50,000/month
      enterprise: 100000000,   // $1,000,000/month
    };
    
    if (customer.totalVolume > expectedVolumeByTier[customer.tier] * 1.5) {
      score += 15;
      indicators.push('exceeds_tier_volume');
    }
    metadata.volumeVsTier = customer.totalVolume / expectedVolumeByTier[customer.tier];

    // Ensure non-negative
    score = Math.max(0, Math.min(score, 100));

    return {
      factorId: 'customer_profile_risk',
      factorName: 'Customer Profile Analysis',
      score: Math.round(score),
      maxScore: 100,
      rawValue: { tier: customer.tier, accountAgeDays },
      indicators,
      metadata,
    };
  }

  // ============== AML Compliance Checks ==============

  /**
   * Perform Anti-Money Laundering checks on transaction
   * 
   * @param transaction - Transaction to check
   * @param history - Transaction history for pattern analysis
   * @returns Array of triggered AML alerts
   */
  performAMLChecks(
    transaction: TransactionInput,
    history: TransactionHistory
  ): AMLAlert[] {
    const alerts: AMLAlert[] = [];
    const now = new Date();

    // Check 1: Large transaction reporting threshold (e.g., $10,000)
    const largeTxnThreshold = 1000000; // $10,000 in cents
    if (transaction.amount >= largeTxnThreshold) {
      alerts.push({
        type: AMLAlertType.LARGE_TRANSACTION,
        severity: transaction.amount >= largeTxnThreshold * 2 ? 4 : 3,
        description: `Transaction amount ${transaction.amount / 100} exceeds reporting threshold`,
        threshold: largeTxnThreshold,
        actualValue: transaction.amount,
        sarRecommended: transaction.amount >= largeTxnThreshold * 1.5,
        timestamp: now,
      });
    }

    // Check 2: Structuring detection (multiple transactions just below threshold)
    if (history.last24hVolume > SUSPICIOUS_PATTERNS.STRUCTURING_THRESHOLD * 2 &&
        history.last24hCount >= 3) {
      const avg24h = history.last24hVolume / history.last24hCount;
      if (avg24h < SUSPICIOUS_PATTERNS.STRUCTURING_THRESHOLD &&
          history.last24hVolume > SUSPICIOUS_PATTERNS.STRUCTURING_THRESHOLD) {
        alerts.push({
          type: AMLAlertType.STRUCTURING,
          severity: 4,
          description: 'Potential structuring pattern detected - multiple transactions below reporting threshold',
          threshold: SUSPICIOUS_PATTERNS.STRUCTURING_THRESHOLD,
          actualValue: history.last24hVolume,
          sarRecommended: true,
          timestamp: now,
        });
      }
    }

    // Check 3: High-risk country
    if (HIGH_RISK_COUNTRIES.has(transaction.countryCode)) {
      alerts.push({
        type: AMLAlertType.HIGH_RISK_COUNTRY,
        severity: SANCTIONED_COUNTRIES.has(transaction.countryCode) ? 5 : 3,
        description: `Transaction involving high-risk jurisdiction: ${transaction.countryCode}`,
        sarRecommended: SANCTIONED_COUNTRIES.has(transaction.countryCode),
        timestamp: now,
      });
    }

    // Check 4: Velocity breach
    if (history.lastHourCount > SUSPICIOUS_PATTERNS.MAX_VELOCITY_PER_HOUR * 2) {
      alerts.push({
        type: AMLAlertType.VELOCITY_BREACH,
        severity: 3,
        description: `Excessive transaction velocity: ${history.lastHourCount} transactions per hour`,
        threshold: SUSPICIOUS_PATTERNS.MAX_VELOCITY_PER_HOUR * 2,
        actualValue: history.lastHourCount,
        sarRecommended: false,
        timestamp: now,
      });
    }

    // Check 5: Unusual activity pattern
    const volumeRatio = history.last24hVolume / Math.max(history.last7dVolume, 1);
    if (volumeRatio > 0.8 && history.last7dCount > 10) {
      // Most of weekly volume in one day
      alerts.push({
        type: AMLAlertType.UNUSUAL_ACTIVITY,
        severity: 2,
        description: 'Unusual concentration of transaction volume within 24-hour period',
        actualValue: volumeRatio,
        sarRecommended: false,
        timestamp: now,
      });
    }

    if (alerts.length > 0) {
      logger.info('AML alerts generated', {
        event: 'risk_engine.aml_alert',
        metadata: {
          transactionId: transaction.transactionId,
          alertCount: alerts.length,
          alertTypes: alerts.map(a => a.type),
        },
      });
    }

    return alerts;
  }

  // ============== Helper Methods ==============

  /**
   * Calculate weighted composite score from all factors
   */
  private calculateCompositeScore(factors: RiskFactorContribution[]): number {
    const weightEntries: Array<[keyof RiskFactorWeights, string]> = [
      ['amountWeight', 'amount_risk'],
      ['velocityWeight', 'velocity_risk'],
      ['deviceWeight', 'device_risk'],
      ['geographicWeight', 'geographic_risk'],
      ['behavioralWeight', 'behavioral_risk'],
      ['historicalWeight', 'historical_risk'],
      ['complianceWeight', 'compliance_risk'],
      ['customerProfileWeight', 'customer_profile_risk'],
    ];

    let compositeScore = 0;

    for (const [weightKey, factorId] of weightEntries) {
      const factor = factors.find(f => f.factorId === factorId);
      if (factor) {
        const weight = this.weights[weightKey];
        compositeScore += factor.score * weight;
      }
    }

    return Math.min(100, Math.max(0, compositeScore));
  }

  /**
   * Classify numeric score into risk level
   */
  private classifyRiskLevel(score: number): RiskLevel {
    if (score <= this.thresholds.lowMax) return RiskLevel.LOW;
    if (score <= this.thresholds.mediumMax) return RiskLevel.MEDIUM;
    if (score <= this.thresholds.highMax) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }

  /**
   * Determine authentication requirement based on risk level
   */
  private determineAuthRequirement(
    riskLevel: RiskLevel,
    factors: RiskFactorContribution[],
    customer: CustomerProfile
  ): AuthRequirement {
    // Critical always blocks
    if (riskLevel === RiskLevel.CRITICAL) {
      return AuthRequirement.BLOCKED;
    }

    // High risk requires strong auth
    if (riskLevel === RiskLevel.HIGH) {
      // Check for device-related risks
      const hasDeviceRisk = factors
        .find(f => f.factorId === 'device_risk' && f.score > 50);
      
      if (hasDeviceRisk) {
        return AuthRequirement.STEP_UP;
      }
      return AuthRequirement.BIOMETRIC;
    }

    // Medium risk requires OTP
    if (riskLevel === RiskLevel.MEDIUM) {
      // New device or location adds friction
      const isNewDevice = factors
        .find(f => f.factorId === 'device_risk' && f.indicators.includes('unknown_device'));
      const isNewLocation = factors
        .find(f => f.factorId === 'geographic_risk' && f.indicators.includes('country_mismatch'));
      
      if (isNewDevice || isNewLocation) {
        return AuthRequirement.STEP_UP;
      }
      return AuthRequirement.OTP;
    }

    // Low risk - check KYC for unverified users
    if (customer.kycStatus !== KYCStatus.VERIFIED && customer.kycStatus !== KYCStatus.PARTIAL) {
      return AuthRequirement.OTP;
    }

    return AuthRequirement.NONE;
  }

  /**
   * Determine if transaction should be blocked
   */
  private shouldBlockTransaction(
    riskLevel: RiskLevel,
    amlAlerts: AMLAlert[],
    customer: CustomerProfile
  ): boolean {
    // Critical risk always blocks
    if (riskLevel === RiskLevel.CRITICAL) {
      return true;
    }

    // Sanctions match always blocks
    if (amlAlerts.some(a => a.type === AMLAlertType.SANCTIONS_MATCH)) {
      return true;
    }

    // Suspended account blocks
    if (customer.accountStatus === 'suspended') {
      return true;
    }

    // High severity AML alerts with high risk
    if (riskLevel === RiskLevel.HIGH && amlAlerts.some(a => a.severity >= 4)) {
      return true;
    }

    return false;
  }

  /**
   * Generate actionable recommendations based on assessment
   */
  private generateRecommendations(
    riskLevel: RiskLevel,
    factors: RiskFactorContribution[],
    amlAlerts: AMLAlert[]
  ): string[] {
    const recommendations: string[] = [];

    // Based on risk level
    switch (riskLevel) {
      case RiskLevel.LOW:
        recommendations.push('Transaction approved for processing');
        break;
      case RiskLevel.MEDIUM:
        recommendations.push('Require OTP verification before processing');
        break;
      case RiskLevel.HIGH:
        recommendations.push('Require step-up authentication');
        recommendations.push('Consider setting up transaction monitoring rules');
        break;
      case RiskLevel.CRITICAL:
        recommendations.push('BLOCK transaction immediately');
        recommendations.push('Escalate to fraud operations team');
        break;
    }

    // Specific factor-based recommendations
    const highDeviceRisk = factors.find(f => f.factorId === 'device_risk' && f.score > 60);
    if (highDeviceRisk) {
      recommendations.push('Review device fingerprint - potential fraud tool detected');
    }

    const geoMismatch = factors.find(f => 
      f.factorId === 'geographic_risk' && f.indicators.includes('impossible_travel')
    );
    if (geoMismatch) {
      recommendations.push('Flag for impossible travel investigation');
    }

    // AML-specific recommendations
    if (amlAlerts.some(a => a.sarRecommended)) {
      recommendations.push('Consider filing Suspicious Activity Report (SAR)');
    }

    if (amlAlerts.some(a => a.type === AMLAlertType.STRUCTURING)) {
      recommendations.push('Review for potential structuring violation');
    }

    return recommendations;
  }

  /**
   * Calculate confidence level based on data completeness
   */
  private calculateConfidence(
    factors: RiskFactorContribution[],
    device?: DeviceIntelligence,
    geoLocation?: GeoLocationData
  ): number {
    let confidence = 70; // Base confidence

    // Having device data increases confidence
    if (device) {
      confidence += 10;
    }

    // Having geo data increases confidence
    if (geoLocation) {
      confidence += 10;
    }

    // No "no data" indicators increases confidence
    const missingDataFactors = factors.filter(f =>
      f.indicators.includes('no_device_data')
    ).length;
    confidence -= missingDataFactors * 10;

    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Validate input data
   */
  private validateInputs(
    transaction: TransactionInput,
    customer: CustomerProfile,
    history: TransactionHistory
  ): void {
    if (!transaction.transactionId) {
      throw new AppError('Transaction ID is required', ErrorCode.VALIDATION_ERROR, {
        severity: 'warning',
        context: { field: 'transactionId' },
      });
    }

    if (!transaction.amount || transaction.amount <= 0) {
      throw new AppError('Valid transaction amount is required', ErrorCode.VALIDATION_ERROR, {
        severity: 'warning',
        context: { field: 'amount', value: transaction.amount },
      });
    }

    if (!customer.customerId) {
      throw new AppError('Customer ID is required', ErrorCode.VALIDATION_ERROR, {
        severity: 'warning',
        context: { field: 'customerId' },
      });
    }
  }

  /**
   * Generate cache key for assessment
   */
  private generateCacheKey(transaction: TransactionInput): string {
    return `risk:${transaction.transactionId}:${transaction.amount}:${transaction.timestamp.getTime()}`;
  }

  /**
   * Get cached assessment if valid
   */
  private getCachedAssessment(key: string): RiskAssessmentResult | null {
    const cached = this.assessmentCache.get(key);
    if (cached && cached.expiry > new Date()) {
      return cached.result;
    }
    if (cached) {
      this.assessmentCache.delete(key);
    }
    return null;
  }

  /**
   * Store assessment in cache
   */
  private cacheAssessment(key: string, result: RiskAssessmentResult): void {
    const expiry = new Date(Date.now() + this.config.cacheTTL);
    this.assessmentCache.set(key, { result, expiry });
  }

  /**
   * Initialize fresh statistics object
   */
  private initializeStatistics(): RiskStatistics {
    return {
      totalAssessments: 0,
      byLevel: {
        [RiskLevel.LOW]: 0,
        [RiskLevel.MEDIUM]: 0,
        [RiskLevel.HIGH]: 0,
        [RiskLevel.CRITICAL]: 0,
      },
      averageScore: 0,
      medianScore: 0,
      percentiles: { p25: 0, p50: 0, p75: 0, p90: 0, p99: 0 },
      blockRate: 0,
      flagRate: 0,
      topFactors: [],
      amlStats: { totalAlerts: 0, byType: {} as Record<AMLAlertType, number> },
    };
  }

  /**
   * Update running statistics with new assessment
   */
  private updateStatistics(result: RiskAssessmentResult): void {
    this.stats.totalAssessments++;
    this.stats.byLevel[result.riskLevel]++;

    // Update running average
    const n = this.stats.totalAssessments;
    this.stats.averageScore = 
      (this.stats.averageScore * (n - 1) + result.riskScore) / n;

    // Update block/flag rates
    if (result.shouldBlock) {
      this.stats.blockRate = ((this.stats.blockRate * (n - 1) + 1) / n) * 100;
    }
    if (result.shouldFlag) {
      this.stats.flagRate = ((this.stats.flagRate * (n - 1) + 1) / n) * 100;
    }

    // Update top factors
    for (const factor of result.factors) {
      const existing = this.stats.topFactors.find(f => f.factorId === factor.factorId);
      if (existing) {
        existing.count++;
        existing.avgScore = (existing.avgScore * (existing.count - 1) + factor.score) / existing.count;
      } else {
        this.stats.topFactors.push({
          factorId: factor.factorId,
          count: 1,
          avgScore: factor.score,
        });
      }
    }

    // Sort top factors by count
    this.stats.topFactors.sort((a, b) => b.count - a.count);
    this.stats.topFactors = this.stats.topFactors.slice(0, 10);

    // Update AML stats
    this.stats.amlStats.totalAlerts += result.amlAlerts.length;
    for (const alert of result.amlAlerts) {
      this.stats.amlStats.byType[alert.type] = 
        (this.stats.amlStats.byType[alert.type] || 0) + 1;
    }
  }

  /**
   * Adapt thresholds based on analyst feedback (adaptive mode)
   */
  private adaptFromFeedback(record: RiskHistoryRecord): void {
    // Simple adaptation: if analyst overrode a deny to approve, lower thresholds slightly
    if (record.decision === 'approved' && record.assessment.shouldBlock) {
      this.thresholds.highMax = Math.min(95, this.thresholds.highMax + 1);
      this.thresholds.criticalMin = Math.min(96, this.thresholds.criticalMin + 1);
      logger.debug('Adapting thresholds: false positive detected', {
        event: 'risk_engine.adapt',
        metadata: { transactionId: record.transactionId },
      });
    }

    // If analyst overrode an approve to deny, raise thresholds
    if (record.decision === 'denied' && !record.assessment.shouldBlock) {
      this.thresholds.mediumMax = Math.max(20, this.thresholds.mediumMax - 1);
      this.thresholds.lowMax = Math.max(10, this.thresholds.lowMax - 1);
      logger.debug('Adapting thresholds: false negative detected', {
        event: 'risk_engine.adapt',
        metadata: { transactionId: record.transactionId },
      });
    }
  }
}

// ============== Utility Functions ==============

/**
 * Create a default RiskEngine instance with moderate profile
 * 
 * @returns Configured RiskEngine instance
 */
export function createDefaultRiskEngine(): RiskEngine {
  return new RiskEngine({ profile: 'moderate' });
}

/**
 * Create a conservative RiskEngine instance for high-security scenarios
 * 
 * @returns Conservative RiskEngine instance
 */
export function createConservativeRiskEngine(): RiskEngine {
  return new RiskEngine({ 
    profile: 'conservative',
    enableAML: true,
    enforceKYC: true,
  });
}

/**
 * Create an aggressive RiskEngine instance for low-friction scenarios
 * 
 * @returns Aggressive RiskEngine instance
 */
export function createAggressiveRiskEngine(): RiskEngine {
  return new RiskEngine({ 
    profile: 'aggressive',
    enableAML: true,
    enforceKYC: false,
  });
}

/**
 * Format risk score for display
 * 
 * @param score - Numeric risk score (0-100)
 * @returns Formatted string with color indicator emoji
 */
export function formatRiskScore(score: number): string {
  if (score <= 30) return `🟢 ${score}/100 (Low Risk)`;
  if (score <= 60) return `🟡 ${score}/100 (Medium Risk)`;
  if (score <= 80) return `🟠 ${score}/100 (High Risk)`;
  return `🔴 ${score}/100 (Critical Risk)`;
}

/**
 * Get human-readable description for risk level
 * 
 * @param level - Risk level enum value
 * @returns Human-readable description
 */
export function getRiskLevelDescription(level: RiskLevel): string {
  const descriptions: Record<RiskLevel, string> = {
    [RiskLevel.LOW]: 'Minimal risk detected. Transaction can proceed normally.',
    [RiskLevel.MEDIUM]: 'Moderate risk indicators present. Additional verification recommended.',
    [RiskLevel.HIGH]: 'Significant risk factors detected. Strong authentication required.',
    [RiskLevel.CRITICAL]: 'Critical risk level. Immediate action required.',
  };
  return descriptions[level];
}

/**
 * Get human-readable description for auth requirement
 * 
 * @param req - Auth requirement enum value
 * @returns Human-readable description
 */
export function getAuthRequirementDescription(req: AuthRequirement): string {
  const descriptions: Record<AuthRequirement, string> = {
    [AuthRequirement.NONE]: 'No additional authentication required.',
    [AuthRequirement.OTP]: 'One-time password verification via SMS or email required.',
    [AuthRequirement.BIOMETRIC]: 'Biometric verification (fingerprint or face) required.',
    [AuthRequirement.STEP_UP]: 'Multi-factor step-up authentication required.',
    [AuthRequirement.MANUAL_REVIEW]: 'Manual review by fraud analyst required before proceeding.',
    [AuthRequirement.BLOCKED]: 'Transaction blocked. No authentication override available.',
  };
  return descriptions[req];
}

// Export singleton instances for convenience
export const defaultRiskEngine = createDefaultRiskEngine();
export const conservativeRiskEngine = createConservativeRiskEngine();
export const aggressiveRiskEngine = createAggressiveRiskEngine();
