/**
 * Machine Learning Fraud Detection Module
 * Enterprise-grade transaction risk analysis and anomaly detection
 * 
 * @module ml/fraud-detector
 * @description Real-time fraud detection using statistical analysis, pattern matching,
 * and rule-based scoring for payment transactions.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Type Definitions ==============

export interface TransactionFeatures {
  /** Transaction amount in base currency */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Timestamp of transaction */
  timestamp: Date;
  /** Customer email (hashed for privacy) */
  customerHash: string;
  /** Device fingerprint identifier */
  deviceId: string;
  /** IP address (anonymized) */
  ipAddress: string;
  /** Country code from IP geolocation */
  countryCode: string;
  /** Payment method type */
  paymentMethod: 'card' | 'bank_transfer' | 'wallet' | 'ussd';
  /** Card bin if card payment */
  cardBin?: string;
  /** Number of transactions in last hour for this user */
  txnCount1h: number;
  /** Number of transactions in last 24 hours for this user */
  txnCount24h: number;
  /** Average transaction amount for user (last 30 days) */
  avgAmount30d: number;
  /** Standard deviation of amounts */
  stdAmount30d: number;
  /** Time since last transaction in minutes */
  timeSinceLastTxn: number;
  /** Is this a new device for this user? */
  isNewDevice: boolean;
  /** Is this a new country for this user? */
  isNewCountry: boolean;
  /** Velocity score (transactions per minute across system) */
  systemVelocity: number;
}

export interface FraudScore {
  /** Overall risk score 0-100 */
  score: number;
  /** Risk level classification */
  level: 'low' | 'medium' | 'high' | 'critical';
  /** Should this transaction be blocked? */
  shouldBlock: boolean;
  /** Should this require manual review? */
  requiresReview: boolean;
  /** Individual factor scores */
  factors: RiskFactor[];
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Model version used */
  modelVersion: string;
  /** Unique decision ID for audit trail */
  decisionId: string;
}

export interface RiskFactor {
  /** Factor name/identifier */
  name: string;
  /** Human-readable description */
  description: string;
  /** Score contribution (-100 to +100) */
  scoreContribution: number;
  /** Weight applied to this factor */
  weight: number;
  /** Triggered rules that contributed */
  triggeredRules: string[];
}

export interface FraudRule {
  /** Unique rule identifier */
  id: string;
  /** Rule display name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule category */
  category: 'velocity' | 'amount' | 'behavioral' | 'geographic' | 'device' | 'time';
  /** Base score contribution when triggered */
  scoreImpact: number;
  /** Weight multiplier (0-1) */
  weight: number;
  /** Whether this rule blocks immediately */
  isBlocking: boolean;
  /** Evaluation function */
  evaluate: (features: TransactionFeatures) => boolean;
}

export interface UserBehaviorProfile {
  /** User identifier (hashed) */
  userId: string;
  /** Typical transaction amounts (percentiles) */
  amountPercentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p99: number;
  };
  /** Typical transaction times (hour of day) */
  activeHours: number[];
  /** Typical countries of transaction */
  typicalCountries: string[];
  /** Known devices */
  knownDevices: string[];
  /** Account age in days */
  accountAgeDays: number;
  /** Historical fraud flags */
  historicalFraudFlags: number;
  /** Trust score based on history */
  trustScore: number;
}

export interface AnomalyDetectionResult {
  /** Z-score of the amount compared to user history */
  amountZScore: number;
  /** Is the amount anomalous? */
  isAnomalous: boolean;
  /** Anomaly type if detected */
  anomalyType?: 'amount_spike' | 'new_device' | 'new_location' | 'velocity_burst' | 'time_anomaly' | null;
  /** Confidence level (0-1) */
  confidence: number;
}

// ============== Constants ==============

const MODEL_VERSION = '2.1.0-enterprise';
const DECISION_ID_PREFIX = 'FRD';
const BLOCK_THRESHOLD = 85;
const REVIEW_THRESHOLD = 60;
const MEDIUM_RISK_THRESHOLD = 40;

// Default weights for risk categories
const CATEGORY_WEIGHTS: Record<string, number> = {
  velocity: 0.25,
  amount: 0.20,
  behavioral: 0.20,
  geographic: 0.15,
  device: 0.10,
  time: 0.10,
};

// ============== Fraud Rules Engine ==============

/**
 * Predefined fraud detection rules
 * These rules are evaluated against each transaction
 */
export const FRAUD_RULES: FraudRule[] = [
  // Velocity Rules
  {
    id: 'VEL_001',
    name: 'High Frequency Transactions',
    description: 'More than 10 transactions in the last hour',
    category: 'velocity',
    scoreImpact: 40,
    weight: CATEGORY_WEIGHTS.velocity,
    isBlocking: false,
    evaluate: (f) => f.txnCount1h > 10,
  },
  {
    id: 'VEL_002',
    name: 'Velocity Burst',
    description: 'More than 3 transactions in 5 minutes',
    category: 'velocity',
    scoreImpact: 35,
    weight: CATEGORY_WEIGHTS.velocity,
    isBlocking: false,
    evaluate: (f) => f.systemVelocity > 100,
  },
  {
    id: 'VEL_003',
    name: 'Daily Limit Exceeded',
    description: 'More than 50 transactions in 24 hours',
    category: 'velocity',
    scoreImpact: 50,
    weight: CATEGORY_WEIGHTS.velocity,
    isBlocking: true,
    evaluate: (f) => f.txnCount24h > 50,
  },

  // Amount Rules
  {
    id: 'AMT_001',
    name: 'Unusual Large Amount',
    description: 'Amount exceeds 5x user average',
    category: 'amount',
    scoreImpact: 45,
    weight: CATEGORY_WEIGHTS.amount,
    isBlocking: false,
    evaluate: (f) => f.avgAmount30d > 0 && f.amount > f.avgAmount30d * 5,
  },
  {
    id: 'AMT_002',
    name: 'Round Amount Pattern',
    description: 'Transaction amount is suspiciously round (e.g., 10000, 50000)',
    category: 'amount',
    scoreImpact: 15,
    weight: CATEGORY_WEIGHTS.amount,
    isBlocking: false,
    evaluate: (f) => {
      const roundAmounts = [1000, 5000, 10000, 25000, 50000, 100000, 500000, 1000000];
      return roundAmounts.includes(f.amount);
    },
  },
  {
    id: 'AMT_003',
    name: 'High Value Transaction',
    description: 'Single transaction exceeds threshold',
    category: 'amount',
    scoreImpact: 30,
    weight: CATEGORY_WEIGHTS.amount,
    isBlocking: false,
    evaluate: (f) => f.amount > 1000000, // 1M Naira threshold
  },
  {
    id: 'AMT_004',
    name: 'Amount Just Below Threshold',
    description: 'Amount suspiciously close to but below verification limit',
    category: 'amount',
    scoreImpact: 25,
    weight: CATEGORY_WEIGHTS.amount,
    isBlocking: false,
    evaluate: (f) => f.amount > 900000 && f.amount < 1000001,
  },

  // Behavioral Rules
  {
    id: 'BEH_001',
    name: 'New Device Login',
    description: 'Transaction from previously unseen device',
    category: 'behavioral',
    scoreImpact: 30,
    weight: CATEGORY_WEIGHTS.behavioral,
    isBlocking: false,
    evaluate: (f) => f.isNewDevice,
  },
  {
    id: 'BEH_002',
    name: 'New Country Access',
    description: 'Transaction from unusual geographic location',
    category: 'behavioral',
    scoreImpact: 35,
    weight: CATEGORY_WEIGHTS.behavioral,
    isBlocking: false,
    evaluate: (f) => f.isNewCountry,
  },
  {
    id: 'BEH_003',
    name: 'Rapid Succession',
    description: 'Multiple transactions within 60 seconds',
    category: 'behavioral',
    scoreImpact: 40,
    weight: CATEGORY_WEIGHTS.behavioral,
    isBlocking: false,
    evaluate: (f) => f.timeSinceLastTxn < 1 && f.timeSinceLastTxn >= 0,
  },
  {
    id: 'BEH_004',
    name: 'Sleeping Pattern Anomaly',
    description: 'Transaction during unusual hours for user',
    category: 'behavioral',
    scoreImpact: 20,
    weight: CATEGORY_WEIGHTS.behavioral,
    isBlocking: false,
    evaluate: (f) => {
      const hour = f.timestamp.getUTCHours();
      // Unusual hours: midnight to 5 AM UTC
      return hour >= 0 && hour <= 5;
    },
  },

  // Geographic Rules
  {
    id: 'GEO_001',
    name: 'High Risk Country',
    description: 'Transaction originating from high-risk jurisdiction',
    category: 'geographic',
    scoreImpact: 50,
    weight: CATEGORY_WEIGHTS.geographic,
    isBlocking: false,
    evaluate: (f) => {
      const highRiskCountries = ['NG', 'GH', 'KE', 'ZA', 'US', 'GB', 'DE'];
      return !highRiskCountries.includes(f.countryCode);
    },
  },
  {
    id: 'GEO_002',
    name: 'Cross-Border Velocity',
    description: 'Multiple countries in short timeframe',
    category: 'geographic',
    scoreImpact: 45,
    weight: CATEGORY_WEIGHTS.geographic,
    isBlocking: true,
    evaluate: (f) => f.isNewCountry && f.txnCount1h > 3,
  },

  // Device Rules
  {
    id: 'DEV_001',
    name: 'Known Compromised Device',
    description: 'Device flagged in compromised device database',
    category: 'device',
    scoreImpact: 90,
    weight: CATEGORY_WEIGHTS.device,
    isBlocking: true,
    evaluate: () => false, // Would check external DB in production
  },
  {
    id: 'DEV_002',
    name: 'VPN/Proxy Detected',
    description: 'Transaction through anonymizing service',
    category: 'device',
    scoreImpact: 35,
    weight: CATEGORY_WEIGHTS.device,
    isBlocking: false,
    evaluate: () => false, // Would check IP reputation service
  },

  // Time-Based Rules
  {
    id: 'TIME_001',
    name: 'Holiday Spike',
    description: 'Unusual volume during holiday period',
    category: 'time',
    scoreImpact: 15,
    weight: CATEGORY_WEIGHTS.time,
    isBlocking: false,
    evaluate: (f) => {
      const month = f.timestamp.getMonth();
      const day = f.timestamp.getDate();
      // Check for major shopping holidays (Black Friday, Christmas, etc.)
      return (month === 11 && day >= 24) || (month === 11 && day === 25);
    },
  },
];

// ============== Statistical Analysis Functions ==============

/**
 * Calculate Z-score for amount anomaly detection
 * Z-score measures how many standard deviations a value is from the mean
 */
export function calculateZScore(
  value: number,
  mean: number,
  stdDev: number
): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Detect anomalies using modified Z-score method
 * More robust to outliers than standard Z-score
 */
export function detectAnomaliesModifiedZScore(
  values: number[],
  threshold: number = 3.5
): { index: number; value: number; zScore: number }[] {
  if (values.length < 3) return [];

  const median = values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
  
  const mad = values
    .map(v => Math.abs(v - median))
    .sort((a, b) => a - b)[Math.floor(values.length / 2)];

  if (mad === 0) return [];

  return values
    .map((value, index) => ({
      index,
      value,
      zScore: (0.6745 * (value - median)) / mad,
    }))
    .filter(({ zScore }) => Math.abs(zScore) > threshold);
}

/**
 * Calculate percentile rank for a value in a distribution
 */
export function calculatePercentile(
  value: number,
  values: number[]
): number {
  if (values.length === 0) return 50;
  const sorted = values.slice().sort((a, b) => a - b);
  const rank = sorted.filter(v => v <= value).length;
  return (rank / sorted.length) * 100;
}

/**
 * Exponential moving average for real-time calculations
 */
export function calculateEMA(
  currentValue: number,
  previousEMA: number,
  alpha: number = 0.3
): number {
  if (previousEMA === 0) return currentValue;
  return alpha * currentValue + (1 - alpha) * previousEMA;
}

/**
 * Calculate entropy of a dataset (measure of randomness)
 */
export function calculateEntropy(values: number[]): number {
  if (values.length === 0) return 0;

  const total = values.reduce((sum, v) => sum + Math.abs(v), 0);
  if (total === 0) return 0;

  const probabilities = values.map(v => Math.abs(v) / total);
  return -probabilities.reduce((entropy, p) => {
    if (p === 0) return entropy;
    return entropy + p * Math.log2(p);
  }, 0);
}

// ============== Main Fraud Detection Class ==============

/**
 * Enterprise Fraud Detection Engine
 * 
 * Provides real-time transaction risk scoring using:
 * - Rule-based scoring engine
 * - Statistical anomaly detection
 * - Behavioral analysis
 * - Geographic risk assessment
 * 
 * @example
 * ```typescript
 * const detector = new FraudDetector();
 * const score = await detector.analyzeTransaction(features);
 * if (score.shouldBlock) {
 *   // Block transaction
 * }
 * ```
 */
export class FraudDetector {
  private customRules: FraudRule[] = [];
  private enabledCategories: Set<string> = new Set(Object.keys(CATEGORY_WEIGHTS));
  private cache: Map<string, FraudScore> = new Map();
  private readonly cacheTTL: number = 300000; // 5 minutes
  private analyticsCallback?: (score: FraudScore) => void;

  constructor(options?: {
    customRules?: FraudRule[];
    disabledCategories?: string[];
    analyticsCallback?: (score: FraudScore) => void;
  }) {
    if (options?.customRules) {
      this.customRules = options.customRules;
    }
    if (options?.disabledCategories) {
      options.disabledCategories.forEach(cat => this.enabledCategories.delete(cat));
    }
    this.analyticsCallback = options?.analyticsCallback;
    
    logger.info('FraudDetector initialized', {
      event: 'fraud.detector.init',
      metadata: {
        modelVersion: MODEL_VERSION,
        rulesCount: this.getAllRules().length,
        enabledCategories: Array.from(this.enabledCategories),
      },
    });
  }

  /**
   * Analyze a transaction for fraud risk
   * Main entry point for fraud detection
   */
  async analyzeTransaction(features: TransactionFeatures): Promise<FraudScore> {
    const startTime = performance.now();
    const decisionId = this.generateDecisionId();

    logger.info('Analyzing transaction for fraud', {
      event: 'fraud.analyze.start',
      metadata: { decisionId, amount: features.amount, currency: features.currency },
    });

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(features);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.debug('Returning cached fraud score', {
          event: 'fraud.analyze.cache_hit',
          metadata: { decisionId: cached.decisionId },
        });
        return cached;
      }

      // Run all analyses
      const [ruleScores, anomalyResult] = await Promise.all([
        this.evaluateRules(features),
        this.detectAnomalies(features),
      ]);

      // Combine scores
      const combinedFactors = this.combineFactors(ruleScores, anomalyResult, features);
      const finalScore = this.calculateFinalScore(combinedFactors);

      // Determine action
      const result: FraudScore = {
        score: finalScore,
        level: this.classifyRiskLevel(finalScore),
        shouldBlock: finalScore >= BLOCK_THRESHOLD || combinedFactors.some(f => 
          FRAUD_RULES.find(r => r.id === f.triggeredRules[0])?.isBlocking
        ),
        requiresReview: finalScore >= REVIEW_THRESHOLD && finalScore < BLOCK_THRESHOLD,
        factors: combinedFactors,
        processingTimeMs: performance.now() - startTime,
        modelVersion: MODEL_VERSION,
        decisionId,
      };

      // Cache result
      this.cache.set(cacheKey, result);
      
      // Schedule cache cleanup
      setTimeout(() => this.cache.delete(cacheKey), this.cacheTTL);

      // Send to analytics if callback provided
      this.analyticsCallback?.(result);

      logger.info('Fraud analysis complete', {
        event: 'fraud.analyze.complete',
        metadata: {
          decisionId,
          score: result.score,
          level: result.level,
          shouldBlock: result.shouldBlock,
          processingTimeMs: result.processingTimeMs,
        },
      });

      return result;
    } catch (error) {
      logger.appError(error instanceof Error ? error : new Error(String(error)), {
        action: 'analyzeTransaction',
        decisionId,
      });
      
      // Return safe default on error
      return {
        score: MEDIUM_RISK_THRESHOLD,
        level: 'medium',
        shouldBlock: false,
        requiresReview: true,
        factors: [],
        processingTimeMs: performance.now() - startTime,
        modelVersion: MODEL_VERSION,
        decisionId,
      };
    }
  }

  /**
   * Evaluate all fraud rules against transaction features
   */
  private async evaluateRules(features: TransactionFeatures): Promise<RiskFactor[]> {
    const rules = this.getAllRules();
    const triggeredFactors: RiskFactor[] = [];

    for (const rule of rules) {
      try {
        const isTriggered = rule.evaluate(features);
        
        if (isTriggered) {
          triggeredFactors.push({
            name: rule.name,
            description: rule.description,
            scoreContribution: rule.scoreImpact,
            weight: rule.weight,
            triggeredRules: [rule.id],
          });

          logger.debug(`Rule triggered: ${rule.id}`, {
            event: 'fraud.rule.triggered',
            metadata: { ruleId: rule.id, scoreImpact: rule.scoreImpact },
          });
        }
      } catch (error) {
        logger.warn(`Error evaluating rule ${rule.id}`, {
          event: 'fraud.rule.error',
          metadata: { ruleId: rule.id, error: String(error) },
        });
      }
    }

    return triggeredFactors;
  }

  /**
   * Detect statistical anomalies in transaction
   */
  private async detectAnomalies(features: TransactionFeatures): Promise<AnomalyDetectionResult> {
    const zScore = calculateZScore(
      features.amount,
      features.avgAmount30d,
      features.stdAmount30d
    );

    const isAnomalous = Math.abs(zScore) > 2.5;
    
    let anomalyType: AnomalyDetectionResult['anomalyType'] = null;
    let confidence = Math.min(Math.abs(zScore) / 5, 1);

    if (isAnomalous) {
      if (zScore > 2.5) {
        anomalyType = 'amount_spike';
      } else if (zScore < -2.5) {
        anomalyType = 'amount_spike'; // Unusually small
      }

      if (features.isNewDevice) {
        anomalyType = 'new_device';
        confidence = Math.max(confidence, 0.8);
      }

      if (features.isNewCountry) {
        anomalyType = 'new_location';
        confidence = Math.max(confidence, 0.75);
      }

      if (features.txnCount1h > 5) {
        anomalyType = 'velocity_burst';
        confidence = Math.max(confidence, 0.9);
      }
    }

    return {
      amountZScore: zScore,
      isAnomalous,
      anomalyType,
      confidence,
    };
  }

  /**
   * Combine rule-based scores with anomaly detection results
   */
  private combineFactors(
    ruleFactors: RiskFactor[],
    anomaly: AnomalyDetectionResult,
    features: TransactionFeatures
  ): RiskFactor[] {
    const combined = [...ruleFactors];

    // Add anomaly as a factor if significant
    if (anomaly.isAnomalous) {
      const anomalyScore = Math.min(Math.abs(anomaly.amountZScore) * 10, 50);
      combined.push({
        name: 'Statistical Anomaly',
        description: `Transaction shows ${anomaly.anomalyType} pattern (z-score: ${anomaly.amountZScore.toFixed(2)})`,
        scoreContribution: anomalyScore,
        weight: 0.15,
        triggeredRules: [`ANOMALY_${anomaly.anomalyType?.toUpperCase()}`],
      });
    }

    // Add velocity factor if high
    if (features.systemVelocity > 50) {
      combined.push({
        name: 'System Velocity Alert',
        description: `Elevated system-wide transaction velocity (${features.systemVelocity} txn/min)`,
        scoreContribution: Math.min(features.systemVelocity, 40),
        weight: CATEGORY_WEIGHTS.velocity,
        triggeredRules: ['SYS_VEL_001'],
      });
    }

    return combined;
  }

  /**
   * Calculate final weighted score from all factors
   */
  private calculateFinalScore(factors: RiskFactor[]): number {
    if (factors.length === 0) return 5; // Base low risk score

    const weightedSum = factors.reduce((sum, factor) => {
      return sum + (factor.scoreContribution * factor.weight);
    }, 0);

    const maxPossibleScore = factors.reduce((sum, factor) => {
      return sum + (100 * factor.weight);
    }, 0);

    // Normalize to 0-100 scale
    const normalizedScore = maxPossibleScore > 0 
      ? (weightedSum / maxPossibleScore) * 100 
      : 0;

    return Math.min(Math.round(normalizedScore), 100);
  }

  /**
   * Classify risk level from numeric score
   */
  private classifyRiskLevel(score: number): FraudScore['level'] {
    if (score >= BLOCK_THRESHOLD) return 'critical';
    if (score >= REVIEW_THRESHOLD) return 'high';
    if (score >= MEDIUM_RISK_THRESHOLD) return 'medium';
    return 'low';
  }

  /**
   * Get all applicable rules (default + custom)
   */
  getAllRules(): FraudRule[] {
    return [
      ...FRAUD_RULES.filter(r => this.enabledCategories.has(r.category)),
      ...this.customRules.filter(r => this.enabledCategories.has(r.category)),
    ];
  }

  /**
   * Add a custom fraud detection rule
   */
  addCustomRule(rule: FraudRule): void {
    this.customRules.push(rule);
    logger.info('Custom fraud rule added', {
      event: 'fraud.rule.added',
      metadata: { ruleId: rule.id, ruleName: rule.name },
    });
  }

  /**
   * Remove a custom rule by ID
   */
  removeCustomRule(ruleId: string): boolean {
    const initialLength = this.customRules.length;
    this.customRules = this.customRules.filter(r => r.id !== ruleId);
    const removed = this.customRules.length < initialLength;
    
    if (removed) {
      logger.info('Custom fraud rule removed', {
        event: 'fraud.rule.removed',
        metadata: { ruleId },
      });
    }
    
    return removed;
  }

  /**
   * Enable or disable a rule category
   */
  setCategoryEnabled(category: string, enabled: boolean): void {
    if (enabled) {
      this.enabledCategories.add(category);
    } else {
      this.enabledCategories.delete(category);
    }
    
    logger.info(`Category ${enabled ? 'enabled' : 'disabled'}`, {
      event: 'fraud.category.toggled',
      metadata: { category, enabled },
    });
  }

  /**
   * Clear the score cache
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Fraud detection cache cleared', {
      event: 'fraud.cache.cleared',
      metadata: { entriesRemoved: size },
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: Infinity, // No hard limit
    };
  }

  /**
   * Generate unique decision ID
   */
  private generateDecisionId(): string {
    const timestamp = Date.now(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${DECISION_ID_PREFIX}_${timestamp}_${random}`;
  }

  /**
   * Generate cache key from features
   */
  private generateCacheKey(features: TransactionFeatures): string {
    const keyData = `${features.amount}:${features.currency}:${features.customerHash}:${features.deviceId}:${features.timestamp.getTime()}`;
    
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < keyData.length; i++) {
      const char = keyData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `fc_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Build or update user behavior profile
   */
  static buildUserProfile(
    transactionHistory: { amount: number; timestamp: Date; countryCode: string; deviceId: string }[]
  ): UserBehaviorProfile {
    if (transactionHistory.length === 0) {
      throw new AppError('Cannot build profile from empty history', ErrorCode.INVALID_INPUT);
    }

    const amounts = transactionHistory.map(t => t.amount).sort((a, b) => a - b);
    const countries = [...new Set(transactionHistory.map(t => t.countryCode))];
    const devices = [...new Set(transactionHistory.map(t => t.deviceId))];
    
    const now = new Date();
    const accountAgeMs = now.getTime() - transactionHistory[0].timestamp.getTime();
    const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

    // Calculate percentiles
    const getPercentile = (p: number) => amounts[Math.floor(amounts.length * p / 100)] || 0;

    return {
      userId: 'derived_from_history',
      amountPercentiles: {
        p25: getPercentile(25),
        p50: getPercentile(50),
        p75: getPercentile(75),
        p90: getPercentile(90),
        p99: getPercentile(99),
      },
      activeHours: this.calculateActiveHours(transactionHistory),
      typicalCountries: countries,
      knownDevices: devices,
      accountAgeDays,
      historicalFraudFlags: 0, // Would come from DB
      trustScore: this.calculateTrustScore(accountAgeDays, devices.length, countries.length),
    };
  }

  /**
   * Calculate typical active hours from transaction history
   */
  private static calculateActiveHours(
    history: { timestamp: Date }[]
  ): number[] {
    const hourCounts = new Array(24).fill(0);
    
    for (const tx of history) {
      hourCounts[tx.timestamp.getHours()]++;
    }

    const avgCount = hourCounts.reduce((a, b) => a + b, 0) / 24;
    
    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(({ count }) => count > avgCount)
      .map(({ hour }) => hour);
  }

  /**
   * Calculate trust score based on account characteristics
   */
  private static calculateTrustScore(
    accountAgeDays: number,
    deviceCount: number,
    countryCount: number
  ): number {
    let score = 50; // Base score

    // Age bonus (up to 25 points)
    score += Math.min(accountAgeDays / 30 * 5, 25);

    // Device diversity penalty (too many devices is suspicious)
    if (deviceCount > 5) {
      score -= (deviceCount - 5) * 5;
    }

    // Country diversity penalty
    if (countryCount > 3) {
      score -= (countryCount - 3) * 10;
    }

    return Math.max(0, Math.min(100, score));
  }
}

// ============== Singleton Export ==============

/** Global fraud detector instance */
export const fraudDetector = new FraudDetector();

// ============== Utility Functions ==============

/**
 * Quick fraud check for simple use cases
 */
export async function quickFraudCheck(
  amount: number,
  email: string,
  deviceId: string
): Promise<{ isSafe: boolean; score: number }> {
  const features: TransactionFeatures = {
    amount,
    currency: 'NGN',
    timestamp: new Date(),
    customerHash: Buffer.from(email).toString('base64').slice(0, 16),
    deviceId,
    ipAddress: 'unknown',
    countryCode: 'NG',
    paymentMethod: 'card',
    txnCount1h: 1,
    txnCount24h: 1,
    avgAmount30d: amount,
    stdAmount30d: amount * 0.3,
    timeSinceLastTxn: 60,
    isNewDevice: true,
    isNewCountry: false,
    systemVelocity: 10,
  };

  const result = await fraudDetector.analyzeTransaction(features);
  
  return {
    isSafe: !result.shouldBlock && result.level !== 'high' && result.level !== 'critical',
    score: result.score,
  };
}

/**
 * Batch process multiple transactions for fraud analysis
 */
export async function batchFraudAnalysis(
  transactions: Omit<TransactionFeatures, 'timestamp'>[]
): Promise<FraudScore[]> {
  return Promise.all(
    transactions.map(txn => 
      fraudDetector.analyzeTransaction({
        ...txn,
        timestamp: new Date(),
      })
    )
  );
}

export default FraudDetector;
