/**
 * @module fraud-detector
 * @description Fraud detection module for SSM-Pay payment platform.
 * Provides comprehensive fraud detection capabilities including rule-based detection,
 * risk scoring, and configurable thresholds.
 * 
 * @example
 * ```typescript
 * import { FraudDetector } from './fraud-detector';
 * 
 * const detector = new FraudDetector();
 * const result = await detector.analyze(transactionInput, customerProfile);
 * 
 * if (result.riskLevel === FraudRiskLevel.HIGH) {
 *   // Handle high-risk transaction
 * }
 * ```
 */

// Type exports
export {
  FraudRiskLevel,
  FraudSignal,
  FraudSignalCategory,
  FraudDetectionResult,
  FraudRecommendation,
  FraudDetectionConfig,
  FraudDetectionInput,
  PaymentMethodType,
  TransactionChannel,
  CustomerFraudProfile,
  CustomerRiskTier,
  DEFAULT_FRAUD_CONFIG
} from './types';

// Rule engine exports
export type { FraudRule, RuleEngineResult } from './rules';
export {
  FraudRuleEngine,
  velocityCheck,
  amountAnomaly,
  locationMismatch,
  newDeviceFlag,
  BUILT_IN_RULES
} from './rules';

// Scoring exports
export type { CategoryWeights, ScoringConfig } from './scoring';
export {
  FraudScorer,
  DEFAULT_CATEGORY_WEIGHTS,
  DEFAULT_SCORING_CONFIG
} from './scoring';

import { FraudDetectionInput, CustomerFraudProfile, FraudDetectionResult, FraudDetectionConfig, DEFAULT_FRAUD_CONFIG } from './types';
import { FraudRuleEngine, BUILT_IN_RULES } from './rules';
import { FraudScorer, DEFAULT_SCORING_CONFIG } from './scoring';

/**
 * Main Fraud Detector class
 * Orchestrates rule evaluation and scoring for complete fraud analysis
 */
export class FraudDetector {
  private ruleEngine: FraudRuleEngine;
  private scorer: FraudScorer;

  constructor(config?: Partial<FraudDetectionConfig>) {
    const fullConfig = { ...DEFAULT_FRAUD_CONFIG, ...config };
    this.ruleEngine = new FraudRuleEngine(BUILT_IN_RULES, fullConfig);
    this.scorer = new FraudScorer(DEFAULT_SCORING_CONFIG, fullConfig);
  }

  /**
   * Analyze a transaction for fraud indicators
   * @param input - Transaction data to analyze
   * @param profile - Optional customer profile for context
   * @returns Complete fraud detection result
   */
  analyze(
    input: FraudDetectionInput,
    profile?: CustomerFraudProfile
  ): FraudDetectionResult {
    // Run rule engine to get signals
    const ruleResult = this.ruleEngine.evaluate(input, profile);

    // Generate scored result from signals
    return this.scorer.generateResult(
      ruleResult.signals,
      input.transactionId,
      !!profile
    );
  }

  /**
   * Quick risk assessment (score only)
   * @param input - Transaction data
   * @param profile - Optional customer profile
   * @returns Risk score from 0-100
   */
  getRiskScore(
    input: FraudDetectionInput,
    profile?: CustomerFraudProfile
  ): number {
    const result = this.analyze(input, profile);
    return result.riskScore;
  }

  /**
   * Update fraud detection configuration
   */
  updateConfig(config: Partial<FraudDetectionConfig>): void {
    this.ruleEngine.updateConfig(config);
  }

  /**
   * Add custom fraud detection rule
   */
  addRule(rule: import('./types').FraudRule & { evaluate: (...args: unknown[]) => unknown }): void {
    this.ruleEngine.addRule(rule as any);
  }

  /**
   * Get current configuration
   */
  getConfig(): FraudDetectionConfig {
    return this.ruleEngine.getConfig();
  }
}

/** Default export */
export default FraudDetector;
