/**
 * @module fraud-detector/scoring
 * @description Fraud scoring system for SSM-Pay.
 * Calculates composite fraud risk scores from detected signals.
 */

import {
  FraudRiskLevel,
  FraudSignal,
  FraudSignalCategory,
  FraudDetectionResult,
  FraudRecommendation,
  FraudDetectionConfig,
  DEFAULT_FRAUD_CONFIG
} from './types';

/** Weight configuration for signal categories */
export interface CategoryWeights {
  [FraudSignalCategory.VELOCITY]: number;
  [FraudSignalCategory.AMOUNT]: number;
  [FraudSignalCategory.LOCATION]: number;
  [FraudSignalCategory.DEVICE]: number;
  [FraudSignalCategory.BEHAVIOR]: number;
  [FraudSignalCategory.IDENTITY]: number;
}

/** Default category weights */
export const DEFAULT_CATEGORY_WEIGHTS: CategoryWeights = {
  [FraudSignalCategory.VELOCITY]: 1.0,
  [FraudSignalCategory.AMOUNT]: 1.2,
  [FraudSignalCategory.LOCATION]: 1.1,
  [FraudSignalCategory.DEVICE]: 0.8,
  [FraudSignalCategory.BEHAVIOR]: 1.3,
  [FraudSignalCategory.IDENTITY]: 1.5
};

/** Scoring configuration options */
export interface ScoringConfig {
  /** Weights for each signal category */
  categoryWeights: CategoryWeights;
  /** Maximum possible score (normalization target) */
  maxScore: number;
  /** Minimum signals required for high confidence */
  minSignalsForConfidence: number;
  /** Decay factor for older signals */
  temporalDecayFactor: number;
  /** Boost factor for multiple signals in same category */
  categoryClusteringBoost: number;
}

/** Default scoring configuration */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  categoryWeights: DEFAULT_CATEGORY_WEIGHTS,
  maxScore: 100,
  minSignalsForConfidence: 2,
  temporalDecayFactor: 0.1,
  categoryClusteringBoost: 1.2
};

/**
 * FraudScorer class
 * Calculates composite fraud risk scores from detection signals
 */
export class FraudScorer {
  private config: ScoringConfig;
  private fraudConfig: FraudDetectionConfig;

  constructor(
    scoringConfig?: Partial<ScoringConfig>,
    fraudConfig?: Partial<FraudDetectionConfig>
  ) {
    this.config = { ...DEFAULT_SCORING_CONFIG, ...scoringConfig };
    this.fraudConfig = { ...DEFAULT_FRAUD_CONFIG, ...fraudConfig };
  }

  /**
   * Calculate composite fraud score from signals
   * @param signals - Array of detected fraud signals
   * @returns Composite score from 0-100
   */
  calculateScore(signals: FraudSignal[]): number {
    if (signals.length === 0) return 0;

    let weightedSum = 0;
    const categoryCounts: Record<string, number> = {};
    
    // Calculate weighted sum of all signal severities
    for (const signal of signals) {
      const weight = this.config.categoryWeights[signal.category] ?? 1.0;
      const decayedSeverity = this.applyTemporalDecay(signal);
      
      weightedSum += decayedSeverity * weight;
      
      // Track counts per category for clustering bonus
      categoryCounts[signal.category] = 
        (categoryCounts[signal.category] ?? 0) + 1;
    }

    // Apply clustering boost for multiple signals in same category
    let clusteringBonus = 0;
    for (const count of Object.values(categoryCounts)) {
      if (count > 1) {
        clusteringBonus += (count - 1) * this.config.categoryClusteringBoost * 10;
      }
    }

    // Normalize to max score
    const rawScore = (weightedSum + clusteringBonus) / signals.length;
    const normalizedScore = Math.min(this.config.maxScore, rawScore);

    return Math.round(normalizedScore);
  }

  /**
   * Determine risk level from score
   * @param score - Calculated risk score (0-100)
   * @returns Risk level classification
   */
  getRiskLevel(score: number): FraudRiskLevel {
    if (score >= this.fraudConfig.criticalRiskThreshold) {
      return FraudRiskLevel.CRITICAL;
    }
    if (score >= this.fraudConfig.highRiskThreshold) {
      return FraudRiskLevel.HIGH;
    }
    if (score >= this.fraudConfig.mediumRiskThreshold) {
      return FraudRiskLevel.MEDIUM;
    }
    return FraudRiskLevel.LOW;
  }

  /**
   * Get recommended action based on score and signals
   * @param score - Calculated risk score
   * @param signals - Detected signals
   * @param hasCustomerProfile - Whether customer profile was available
   * @returns Recommended action
   */
  getRecommendation(
    score: number,
    signals: FraudSignal[],
    hasCustomerProfile: boolean = true
  ): FraudRecommendation {
    const riskLevel = this.getRiskLevel(score);

    switch (riskLevel) {
      case FraudRiskLevel.CRITICAL:
        return this.fraudConfig.autoBlockCritical
          ? FraudRecommendation.BLOCK_AND_INVESTIGATE
          : FraudRecommendation.DECLINE;

      case FraudRiskLevel.HIGH:
        // Check for identity-related signals which are more severe
        const hasIdentitySignal = signals.some(
          s => s.category === FraudSignalCategory.IDENTITY
        );
        if (hasIdentitySignal) {
          return FraudRecommendation.BLOCK_AND_INVESTIGATE;
        }
        return FraudRecommendation.REQUIRE_ADDITIONAL_AUTH;

      case FraudRiskLevel.MEDIUM:
        // If we don't have profile data, be more cautious
        if (!hasCustomerProfile) {
          return FraudRecommendation.REQUIRE_ADDITIONAL_AUTH;
        }
        return FraudRecommendation.APPROVE_WITH_REVIEW;

      case FraudRiskLevel.LOW:
      default:
        return FraudRecommendation.APPROVE;
    }
  }

  /**
   * Calculate confidence level based on available data
   * @param signals - Detected signals
   * @param hasProfile - Whether customer profile was used
   * @returns Confidence value between 0 and 1
   */
  calculateConfidence(signals: FraudSignal[], hasProfile: boolean): number {
    let confidence = 0.5; // Base confidence

    // More signals generally means higher confidence
    if (signals.length >= this.config.minSignalsForConfidence) {
      confidence += 0.2;
    }

    // Having profile data increases confidence
    if (hasProfile) {
      confidence += 0.2;
    }

    // High severity signals increase confidence in negative assessment
    const highSeverityCount = signals.filter(s => s.severity >= 70).length;
    if (highSeverityCount > 0) {
      confidence += Math.min(0.1, highSeverityCount * 0.03);
    }

    return Math.min(1, confidence);
  }

  /**
   * Generate complete fraud detection result
   * @param signals - Detected signals
   * @param transactionId - ID of analyzed transaction
   * @param hasProfile - Whether profile was available
   * @returns Complete detection result
   */
  generateResult(
    signals: FraudSignal[],
    transactionId: string,
    hasProfile: boolean = true
  ): FraudDetectionResult {
    const score = this.calculateScore(signals);
    const riskLevel = this.getRiskLevel(score);
    const recommendation = this.getRecommendation(score, signals, hasProfile);
    const confidence = this.calculateConfidence(signals, hasProfile);

    return {
      riskLevel,
      riskScore: score,
      signals,
      recommendation,
      confidence,
      analyzedAt: new Date(),
      detectionId: `fd_${transactionId}_${Date.now()}`
    };
  }

  /**
   * Apply temporal decay to signal severity
   * Older signals have reduced impact
   */
  private applyTemporalDecay(signal: FraudSignal): number {
    const ageMs = Date.now() - signal.timestamp.getTime();
    const ageMinutes = ageMs / (1000 * 60);
    
    // Decay is minimal for first hour, then gradually reduces impact
    const decay = Math.exp(-this.config.temporalDecayFactor * ageMinutes / 60);
    
    return signal.severity * decay;
  }

  /**
   * Update scoring configuration
   */
  updateConfig(config: Partial<ScoringConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current scoring configuration
   */
  getConfig(): ScoringConfig {
    return { ...this.config };
  }

  /**
   * Get breakdown of scores by category
   */
  getCategoryBreakdown(signals: FraudSignal[]): Record<string, number> {
    const breakdown: Record<string, number> = {};

    for (const signal of signals) {
      const category = signal.category;
      const weight = this.config.categoryWeights[category] ?? 1.0;
      
      if (!breakdown[category]) {
        breakdown[category] = 0;
      }
      
      breakdown[category] += signal.severity * weight;
    }

    // Normalize each category
    for (const key of Object.keys(breakdown)) {
      breakdown[key] = Math.round(breakdown[key]);
    }

    return breakdown;
  }
}
