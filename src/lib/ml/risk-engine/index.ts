/**
 * @module risk-engine
 * @description Risk assessment engine for SSM-Pay payment platform.
 * Provides comprehensive risk evaluation for transactions and customers
 * using multiple weighted factors and configurable thresholds.
 * 
 * @example
 * ```typescript
 * import { RiskAssessor } from './risk-engine';
 * 
 * const assessor = new RiskAssessor();
 * const assessment = assessor.assessTransaction(transactionInput);
 * 
 * if (assessment.requiresReview) {
 *   // Queue for manual review
 * }
 * 
 * const report = assessor.generateRiskReport(assessment);
 * console.log(report.summary);
 * ```
 */

// Type exports
export {
  RiskFactor,
  RiskCategory,
  FactorAssessment,
  RiskSeverity,
  RiskAssessment,
  RiskLevel,
  RiskRecommendation,
  SubjectType,
  RiskConfig,
  TransactionRiskInput,
  CustomerRiskInput,
  VerificationStatus,
  RiskReport,
  DEFAULT_RISK_CONFIG
} from './types';

// Factor calculator exports
export type {
  AmountRiskResult,
  FrequencyRiskResult,
  GeographicRiskResult,
  DeviceRiskResult
} from './factors';
export { RiskFactorCalculator } from './factors';

// Assessor exports
export type { AssessmentOptions, DEFAULT_ASSESSMENT_OPTIONS } from './assessment';
export { RiskAssessor } from './assessment';

import { 
  RiskConfig, 
  TransactionRiskInput, 
  CustomerRiskInput, 
  RiskAssessment,
  RiskReport,
  DEFAULT_RISK_CONFIG 
} from './types';
import { RiskFactorCalculator } from './factors';
import { RiskAssessor, AssessmentOptions, DEFAULT_ASSESSMENT_OPTIONS } from './assessment';

/** Main RiskEngine class combining all risk capabilities */
export class RiskEngine {
  private assessor: RiskAssessor;
  private calculator: RiskFactorCalculator;

  constructor(config?: Partial<RiskConfig>, options?: Partial<AssessmentOptions>) {
    this.calculator = new RiskFactorCalculator(config);
    this.assessor = new RiskAssessor(config, options);
  }

  /**
   * Assess transaction risk (main entry point)
   */
  assessTransaction(
    input: TransactionRiskInput,
    customerData?: Partial<CustomerRiskInput>,
    knownDevices?: Set<string>
  ): RiskAssessment {
    return this.assessor.assessTransaction(input, customerData, knownDevices);
  }

  /**
   * Assess customer risk profile
   */
  assessCustomer(input: CustomerRiskInput): RiskAssessment {
    return this.assessor.assessCustomer(input);
  }

  /**
   * Generate detailed risk report
   */
  generateReport(
    assessment: RiskAssessment,
    previousScore?: number
  ): RiskReport {
    return this.assessor.generateRiskReport(assessment, previousScore);
  }

  /**
   * Quick score without full assessment
   */
  quickScore(input: TransactionRiskInput): number {
    return this.assessor.quickScore(input);
  }

  /**
   * Get access to factor calculator for custom usage
   */
  getCalculator(): RiskFactorCalculator {
    return this.calculator;
  }

  /**
   * Get access to assessor for advanced operations
   */
  getAssessor(): RiskAssessor {
    return this.assessor;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RiskConfig>): void {
    this.calculator.updateConfig(config);
    this.assessor.updateConfig(config);
  }
}

/** Default export */
export default RiskEngine;
