/**
 * @module risk-engine/assessment
 * @description Risk assessment orchestration for SSM-Pay.
 * Combines individual risk factors into comprehensive assessments.
 */

import {
  RiskAssessment, RiskLevel, RiskRecommendation, FactorAssessment,
  RiskCategory, SubjectType, TransactionRiskInput, CustomerRiskInput,
  RiskConfig, DEFAULT_RISK_CONFIG, RiskReport
} from './types';
import { RiskFactorCalculator } from './factors';

/** Assessment options */
export interface AssessmentOptions { includeFactorDetails: boolean; generateRecommendations: boolean; }

export const DEFAULT_ASSESSMENT_OPTIONS: AssessmentOptions = {
  includeFactorDetails: true, generateRecommendations: true
};

/**
 * RiskAssessor class
 * Orchestrates comprehensive risk assessment for transactions and customers
 */
export class RiskAssessor {
  private calculator: RiskFactorCalculator;
  private config: RiskConfig;
  private options: AssessmentOptions;

  constructor(config?: Partial<RiskConfig>, options?: Partial<AssessmentOptions>) {
    this.config = { ...DEFAULT_RISK_CONFIG, ...config };
    this.options = { ...DEFAULT_ASSESSMENT_OPTIONS, ...options };
    this.calculator = new RiskFactorCalculator(this.config);
  }

  /**
   * Assess risk for a single transaction
   */
  assessTransaction(input: TransactionRiskInput, customerData?: Partial<CustomerRiskInput>, knownDevices?: Set<string>): RiskAssessment {
    const factors: FactorAssessment[] = [];

    factors.push(this.calculator.calculateAmountRisk(input, customerData?.avgTransactionAmount).assessment);
    factors.push(this.calculator.calculateFrequencyRisk(3, 24).assessment);
    factors.push(this.calculator.calculateGeographicRisk(input, customerData?.countriesUsed).assessment);
    factors.push(this.calculator.calculateDeviceRisk(input, knownDevices).assessment);

    if (customerData?.customerId && customerData.accountCreatedDate) {
      factors.push(this.calculator.calculateCustomerHistoryRisk(customerData as CustomerRiskInput));
    }

    const { overallScore, primaryCategory } = this.compositeScore(factors);
    const riskLevel = this.toLevel(overallScore);
    const recommendation = this.getTxnRecommendation(riskLevel, factors);

    return {
      assessmentId: `ra_tx_${input.transactionId}_${Date.now()}`, overallScore, riskLevel, primaryCategory,
      factors, recommendation, confidence: this.calcConfidence(factors),
      assessedAt: new Date(), subjectId: input.transactionId, subjectType: SubjectType.TRANSACTION,
      requiresReview: recommendation === RiskRecommendation.MANUAL_REVIEW || recommendation === RiskRecommendation.ADDITIONAL_VERIFICATION,
      expiresAt: new Date(Date.now() + this.config.assessmentValidityMs)
    };
  }

  /**
   * Assess risk for a customer profile
   */
  assessCustomer(input: CustomerRiskInput): RiskAssessment {
    const factors: FactorAssessment[] = [
      this.calculator.calculateCustomerHistoryRisk(input),
      this.geoDiversityFactor(input.countriesUsed),
      this.deviceDiversityFactor(input.deviceCount),
      this.activityFactor(input)
    ].filter(Boolean) as FactorAssessment[];

    const { overallScore, primaryCategory } = this.compositeScore(factors);
    const riskLevel = this.toLevel(overallScore);
    const accountAgeDays = (Date.now() - input.accountCreatedDate.getTime()) / 86400000;

    let rec: RiskRecommendation;
    if (riskLevel === RiskLevel.CRITICAL || riskLevel === RiskLevel.ELEVATED) rec = RiskRecommendation.BLOCK_AND_ESCALATE;
    else if (riskLevel === RiskLevel.HIGH) rec = accountAgeDays < 30 && input.verificationStatus !== 'FULL' ? RiskRecommendation.ADDITIONAL_VERIFICATION : RiskRecommendation.MANUAL_REVIEW;
    else if (riskLevel === RiskLevel.MEDIUM) rec = accountAgeDays < 7 ? RiskRecommendation.APPROVE_WITH_CONDITIONS : RiskRecommendation.APPROVE;
    else rec = RiskRecommendation.APPROVE;

    return {
      assessmentId: `ra_cust_${input.customerId}_${Date.now()}`, overallScore, riskLevel, primaryCategory,
      factors, recommendation: rec, confidence: this.calcConfidence(factors),
      assessedAt: new Date(), subjectId: input.customerId, subjectType: SubjectType.CUSTOMER,
      requiresReview: riskLevel === RiskLevel.MEDIUM || riskLevel === RiskLevel.HIGH,
      expiresAt: new Date(Date.now() + this.config.assessmentValidityMs)
    };
  }

  /**
   * Generate detailed risk report
   */
  generateRiskReport(assessment: RiskAssessment, previousScore?: number): RiskReport {
    const findings = this.extractFindings(assessment.factors);
    const summary = `${assessment.riskLevel.toLowerCase()} risk (score: ${assessment.overallScore}/100), driven by ${assessment.primaryCategory}`;
    
    let historicalComparison;
    if (previousScore !== undefined) {
      const changePct = ((assessment.overallScore - previousScore) / previousScore) * 100;
      historicalComparison = { previousScore, changePercent: changePct, trend: changePct > 10 ? 'declining' : changePct < -10 ? 'improving' : 'stable' };
    }

    return {
      assessmentId: assessment.assessmentId, summary, keyFindings: findings.length ? findings : ['No significant concerns'],
      factors: assessment.factors, historicalComparison,
      recommendations: this.genRecs(assessment), generatedAt: new Date()
    };
  }

  /** Quick score without full assessment */
  quickScore(input: TransactionRiskInput): number { return this.assessTransaction(input).overallScore; }

  updateConfig(config: Partial<RiskConfig>): void { this.config = { ...this.config, config }; this.calculator.updateConfig(config); }
  updateOptions(options: Partial<AssessmentOptions>): void { this.options = { ...this.options, options }; }

  private compositeScore(factors: FactorAssessment[]): { overallScore: number; primaryCategory: RiskCategory } {
    if (!factors.length) return { overallScore: 0, primaryCategory: RiskCategory.FINANCIAL };

    let totalWScore = 0, totalWeight = 0, maxCatScore = 0, primaryCat = RiskCategory.FINANCIAL;

    for (const f of factors) {
      totalWScore += f.weightedScore; totalWeight += f.weight;
      if (f.weightedScore > maxCatScore) { maxCatScore = f.weightedScore; primaryCat = f.category; }
    }

    return { overallScore: Math.min(100, Math.round(totalWScore / (totalWeight || 1))), primaryCategory: primaryCat };
  }

  private toLevel(score: number): RiskLevel {
    const t = this.config.thresholds;
    if (score >= t.critical) return RiskLevel.CRITICAL;
    if (score >= t.elevated) return RiskLevel.ELEVATED;
    if (score >= t.high) return RiskLevel.HIGH;
    if (score >= t.medium) return RiskLevel.MEDIUM;
    if (score >= t.low) return RiskLevel.LOW;
    return RiskLevel.MINIMAL;
  }

  private getTxnRecommendation(level: RiskLevel, factors: FactorAssessment[]): RiskRecommendation {
    const hasCritical = factors.some(f => f.severity === 'CRITICAL');
    if (hasCritical || level === RiskLevel.CRITICAL) return this.config.autoDeclineHighRisk ? RiskRecommendation.DECLINE : RiskRecommendation.BLOCK_AND_ESCALATE;

    switch (level) {
      case RiskLevel.ELEVATED: return RiskRecommendation.ADDITIONAL_VERIFICATION;
      case RiskLevel.HIGH: return this.config.requireReviewMediumRisk ? RiskRecommendation.MANUAL_REVIEW : RiskRecommendation.ADDITIONAL_VERIFICATION;
      case RiskLevel.MEDIUM: return this.config.requireReviewMediumRisk ? RiskRecommendation.MANUAL_REVIEW : RiskRecommendation.APPROVE_WITH_CONDITIONS;
      default: return RiskRecommendation.APPROVE;
    }
  }

  private calcConfidence(factors: FactorAssessment[]): number {
    let conf = 0.5;
    if (factors.length >= 5) conf += 0.2;
    else if (factors.length >= 3) conf += 0.1;
    if (new Set(factors.map(f => f.severity)).size <= 2) conf += 0.1;
    return Math.min(0.95, conf);
  }

  private geoDiversityFactor(countries: string[]): FactorAssessment | null {
    if (!countries?.length) return null;
    let score = countries.length > 10 ? 30 : countries.length > 5 ? 15 : 5;
    return { factor: 'GEOGRAPHIC' as any, category: RiskCategory.COMPLIANCE, score, weight: 0.05, weightedScore: score * 0.05, description: `${countries.length} countries`, severity: score > 20 ? 'MODERATE' : 'LOW', details: { countryCount: countries.length, countries } };
  }

  private deviceDiversityFactor(count: number): FactorAssessment | null {
    if (!count || count <= 1) return null;
    const score = count > 10 ? 25 : 10;
    return { factor: 'DEVICE' as any, category: RiskCategory.FRAUD, score, weight: 0.05, weightedScore: score * 0.05, description: `${count} devices`, severity: 'LOW', details: { deviceCount: count } };
  }

  private activityFactor(input: CustomerRiskInput): FactorAssessment | null {
    const ageDays = (Date.now() - input.accountCreatedDate.getTime()) / 86400000;
    const tpd = input.totalTransactions / Math.max(ageDays, 1);
    if (tpd > 50) return { factor: 'FREQUENCY' as any, category: RiskCategory.FRAUD, score: 20, weight: 0.05, weightedScore: 1, description: `${tpd.toFixed(1)} txns/day`, severity: 'LOW', details: { totalTransactions: input.totalTransactions, transactionsPerDay: tpd } };
    if (ageDays > 30 && tpd < 0.01) return { factor: 'FREQUENCY' as any, category: RiskCategory.FRAUD, score: 15, weight: 0.05, weightedScore: 0.75, description: 'Dormant account', severity: 'LOW', details: { totalTransactions: input.totalTransactions } };
    return null;
  }

  private extractFindings(factors: FactorAssessment[]): string[] {
    return [...factors].sort((a, b) => b.score - a.score).slice(0, 3)
      .filter(f => f.score >= 40)
      .map(f => `${f.factor}: ${f.description}`);
  }

  private genRecs(assessment: RiskAssessment): string[] {
    const recs: string[] = [];
    switch (assessment.riskLevel) {
      case RiskLevel.CRITICAL: case RiskLevel.ELEVATED:
        recs.push('Escalate to senior analyst', 'Consider blocking'); break;
      case RiskLevel.HIGH:
        recs.push('Request additional verification', 'Enhanced monitoring'); break;
      case RiskLevel.MEDIUM:
        recs.push('Apply standard verification', 'Monitor subsequent transactions'); break;
      default:
        recs.push('Standard processing acceptable'); break;
    }
    return [...new Set(recs)];
  }
}
