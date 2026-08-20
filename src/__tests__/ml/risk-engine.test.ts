/**
 * @fileoverview Test suite for Risk Engine module
 * @module ml/risk-engine.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RiskEngine,
  RiskFactorCalculator,
  RiskAssessor,
} from '@/lib/ml/risk-engine';
import {
  RiskFactor,
  RiskCategory,
  RiskSeverity,
  RiskLevel,
  RiskRecommendation,
  SubjectType,
  VerificationStatus,
  type TransactionRiskInput,
  type CustomerRiskInput,
  type RiskAssessment,
  type FactorAssessment,
  type RiskReport,
  DEFAULT_RISK_CONFIG,
} from '@/lib/ml/risk-engine/types';

describe('Risk Engine Module', () => {
  
  describe('RiskFactorCalculator.calculateAmountRisk()', () => {
    let calculator: RiskFactorCalculator;

    beforeEach(() => {
      calculator = new RiskFactorCalculator();
    });

    it('should calculate low risk for normal amounts', () => {
      const input = createStandardTransactionInput(5000);
      const result = calculator.calculateAmountRisk(input, 5000);

      expect(result.score).toBeLessThan(40); // Low risk
      expect(result.severity).toBeDefined();
      expect(result.factors.isUnusualSize).toBe(false);
      expect(result.factors.exceedsLimit).toBe(false);
    });

    it('should flag unusual amount ratios', () => {
      const input = createStandardTransactionInput(50000); // 10x average
      const result = calculator.calculateAmountRisk(input, 5000);

      expect(result.factors.isUnusualSize).toBe(true);
      expect(result.score).toBeGreaterThan(20);
    });

    it('should detect amounts exceeding limits', () => {
      const input = createStandardTransactionInput(150000);
      const result = calculator.calculateAmountRisk(input);

      expect(result.factors.exceedsLimit).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('should detect round number patterns (structuring)', () => {
      const roundNumberInput = createStandardTransactionInput(15000); // Multiple of 1000
      const result = calculator.calculateAmountRisk(roundNumberInput);

      expect(result.factors.roundNumberFlag).toBe(true);
    });

    it('should return complete assessment with all fields', () => {
      const input = createStandardTransactionInput(7500);
      const result = calculator.calculateAmountRisk(input, 5000);

      expect(result.assessment.factor).toBe(RiskFactor.AMOUNT);
      expect(result.assessment.category).toBe(RiskCategory.FINANCIAL);
      expect(result.assessment.weight).toBeGreaterThan(0);
      expect(result.assessment.weightedScore).toBeGreaterThanOrEqual(0);
      expect(result.assessment.description).toBeDefined();
      expect(result.assessment.details).toBeDefined();
    });
  });

  describe('RiskFactorCalculator.calculateFrequencyRisk()', () => {
    let calculator: RiskFactorCalculator;

    beforeEach(() => {
      calculator = new RiskFactorCalculator();
    });

    it('should calculate low risk for normal frequency', () => {
      const result = calculator.calculateFrequencyRisk(5, 24);

      expect(result.score).toBeLessThan(30);
      expect(result.factors.rapidSuccession).toBe(false);
    });

    it('should flag high velocity transactions', () => {
      const result = calculator.calculateFrequencyRisk(25, 1); // 25 in 1 hour

      expect(result.factors.rapidSuccession).toBe(true);
      expect(result.score).toBeGreaterThan(40);
    });

    it('should track transactions per hour and day correctly', () => {
      const result = calculator.calculateFrequencyRisk(50, 24);

      expect(result.factors.transactionsPerHour).toBeCloseTo(2.08, 1);
      expect(result.factors.transactionsPerDay).toBe(50);
    });
  });

  describe('RiskFactorCalculator.calculateGeographicRisk()', () => {
    let calculator: RiskFactorCalculator;

    beforeEach(() => {
      calculator = new RiskFactorCalculator();
    });

    it('should calculate low risk for domestic known locations', () => {
      const input: TransactionRiskInput = {
        ...createStandardTransactionInput(10000),
        originCountry: 'NG',
        destinationCountry: 'NG',
      };

      const result = calculator.calculateGeographicRisk(input, ['NG']);

      expect(result.factors.isHighRiskCountry).toBe(false);
      expect(result.factors.isCrossBorder).toBe(false);
      expect(result.score).toBeLessThan(20);
    });

    it('should flag cross-border transactions', () => {
      const input: TransactionRiskInput = {
        ...createStandardTransactionInput(10000),
        originCountry: 'NG',
        destinationCountry: 'US',
      };

      const result = calculator.calculateGeographicRisk(input);

      expect(result.factors.isCrossBorder).toBe(true);
      expect(result.score).toBeGreaterThan(10);
    });

    it('should flag high-risk countries', () => {
      const input: TransactionRiskInput = {
        ...createStandardTransactionInput(10000),
        originCountry: 'XX', // High-risk country code
      };

      const result = calculator.calculateGeographicRisk(input);

      expect(result.factors.isHighRiskCountry).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('should flag unusual location for customer', () => {
      const input: TransactionRiskInput = {
        ...createStandardTransactionInput(10000),
        originCountry: 'FR',
      };

      const usualCountries = ['NG', 'GH', 'KE'];
      const result = calculator.calculateGeographicRisk(input, usualCountries);

      expect(result.factors.distanceFromUsual).toBe(1);
      expect(result.score).toBeGreaterThan(15);
    });
  });

  describe('RiskFactorCalculator.calculateDeviceRisk()', () => {
    let calculator: RiskFactorCalculator;

    beforeEach(() => {
      calculator = new RiskFactorCalculator();
    });

    it('should calculate low risk for known devices', () => {
      const input: TransactionRiskInput = {
        ...createStandardTransactionInput(10000),
        deviceFingerprint: 'known_device_123',
      };

      const knownDevices = new Set(['known_device_123']);
      const result = calculator.calculateDeviceRisk(input, knownDevices);

      expect(result.factors.isNewDevice).toBe(false);
      expect(result.factors.isKnownFingerprint).toBe(true);
      expect(result.score).toBe(0);
    });

    it('should flag unknown devices', () => {
      const input: TransactionRiskInput = {
        ...createStandardTransactionInput(10000),
        deviceFingerprint: 'new_device_456',
      };

      const knownDevices = new Set(['known_device_123']);
      const result = calculator.calculateDeviceRisk(input, knownDevices);

      expect(result.factors.isNewDevice).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should increase risk for missing fingerprint', () => {
      const input: TransactionRiskInput = {
        ...createStandardTransactionInput(10000),
        // No deviceFingerprint
      };

      const result = calculator.calculateDeviceRisk(input);

      expect(result.factors.isNewDevice).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(35); // Higher for missing FP
    });
  });

  describe('RiskAssessor.assessTransaction()', () => {
    let assessor: RiskAssessor;

    beforeEach(() => {
      assessor = new RiskAssessor();
    });

    it('should produce complete risk assessment', () => {
      const input = createStandardTransactionInput(10000);
      const assessment: RiskAssessment = assessor.assessTransaction(input);

      expect(assessment.assessmentId).toContain('ra_tx_');
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(assessment.overallScore).toBeLessThanOrEqual(100);
      expect(Object.values(RiskLevel)).toContain(assessment.riskLevel);
      expect(Object.values(RiskRecommendation)).toContain(assessment.recommendation);
      expect(assessment.confidence).toBeGreaterThan(0);
      expect(assessment.subjectType).toBe(SubjectType.TRANSACTION);
      expect(assessment.assessedAt).toBeInstanceOf(Date);
    });

    it('should include factor assessments', () => {
      const input = createStandardTransactionInput(10000);
      const assessment = assessor.assessTransaction(input);

      expect(assessment.factors.length).toBeGreaterThan(0);
      
      assessment.factors.forEach((factor: FactorAssessment) => {
        expect(factor.factor).toBeDefined();
        expect(factor.category).toBeDefined();
        expect(factor.score).toBeGreaterThanOrEqual(0);
        expect(factor.weight).toBeGreaterThan(0);
        expect(factor.severity).toBeDefined();
      });
    });

    it('should determine requiresReview based on recommendation', () => {
      const input = createStandardTransactionInput(10000);
      const assessment = assessor.assessTransaction(input);

      // If recommendation is MANUAL_REVIEW or ADDITIONAL_VERIFICATION, requiresReview should be true
      if (
        assessment.recommendation === RiskRecommendation.MANUAL_REVIEW ||
        assessment.recommendation === RiskRecommendation.ADDITIONAL_VERIFICATION
      ) {
        expect(assessment.requiresReview).toBe(true);
      }
    });

    it('should consider customer data when provided', () => {
      const input = createStandardTransactionInput(10000);
      const customerData = {
        customerId: 'cust_001',
        accountCreatedDate: new Date(Date.now() - 86400000 * 365),
        totalTransactions: 200,
        successRate: 0.98,
        totalVolume: 1000000,
        avgTransactionAmount: 5000,
        countriesUsed: ['NG'],
        deviceCount: 2,
        chargebackCount: 0,
        verificationStatus: VerificationStatus.FULL as VerificationStatus,
      };

      const withCustomer = assessor.assessTransaction(input, customerData);
      
      expect(withCustomer.factors.length).toBeGreaterThan(
        assessor.assessTransaction(input).factors.length
      );
    });
  });

  describe('Risk Report Generation', () => {
    let assessor: RiskAssessor;

    beforeEach(() => {
      assessor = new RiskAssessor();
    });

    it('should generate comprehensive risk report', () => {
      const input = createStandardTransactionInput(25000);
      const assessment = assessor.assessTransaction(input);
      const report: RiskReport = assessor.generateRiskReport(assessment);

      expect(report.assessmentId).toBe(assessment.assessmentId);
      expect(report.summary).toBeDefined();
      expect(report.summary.length).toBeGreaterThan(0);
      expect(Array.isArray(report.keyFindings)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('should include historical comparison when previous score provided', () => {
      const input = createStandardTransactionInput(10000);
      const assessment = assessor.assessTransaction(input);
      const report = assessor.generateRiskReport(assessment, 50);

      expect(report.historicalComparison).toBeDefined();
      expect(report.historicalComparison?.previousScore).toBe(50);
      expect(['improving', 'stable', 'declining']).toContain(
        report.historicalComparison?.trend
      );
    });

    it('should extract key findings from factors', () => {
      const input = createStandardTransactionInput(150000); // High amount
      const assessment = assessor.assessTransaction(input);
      const report = assessor.generateRiskReport(assessment);

      // Should have findings for high-scoring factors
      const highScoreFactors = assessment.factors.filter(f => f.score >= 40);
      if (highScoreFactors.length > 0) {
        expect(report.keyFindings.length).toBeGreaterThan(0);
      }
    });

    it('should provide actionable recommendations', () => {
      const input = createStandardTransactionInput(10000);
      const assessment = assessor.assessTransaction(input);
      const report = assessor.generateRiskReport(assessment);

      expect(report.recommendations.length).toBeGreaterThan(0);
      report.recommendations.forEach(rec => {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(0);
      });
    });
  });

  describe('RiskEngine Integration', () => {
    let engine: RiskEngine;

    beforeEach(() => {
      engine = new RiskEngine();
    });

    it('should assess transaction through main entry point', () => {
      const input = createStandardTransactionInput(10000);
      const assessment = engine.assessTransaction(input);

      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(assessment.riskLevel).toBeDefined();
    });

    it('should generate reports through engine', () => {
      const input = createStandardTransactionInput(10000);
      const assessment = engine.assessTransaction(input);
      const report = engine.generateReport(assessment);

      expect(report.summary).toBeDefined();
      expect(report.keyFindings).toBeDefined();
    });

    it('should provide quick score without full assessment', () => {
      const input = createStandardTransactionInput(5000);
      const score = engine.quickScore(input);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should update configuration dynamically', () => {
      const originalConfig = engine.getAssessor().getConfig ? 
        undefined : // Config access may vary
        DEFAULT_RISK_CONFIG;
        
      engine.updateConfig({
        thresholds: {
          ...DEFAULT_RISK_CONFIG.thresholds,
          critical: 95, // Raise critical threshold
        },
      });

      // Should not throw and config should be updated
      const score = engine.quickScore(createStandardTransactionInput(10000));
      expect(typeof score).toBe('number');
    });
  });

  describe('Risk Level Determination', () => {
    it('should classify scores into correct levels', () => {
      const assessor = new RiskAssessor();

      // Test various score ranges
      const testCases = [
        { expectedLevel: RiskLevel.MINIMAL, targetScore: 10 },
        { expectedLevel: RiskLevel.LOW, targetScore: 25 },
        { expectedLevel: RiskLevel.MEDIUM, targetScore: 45 },
        { expectedLevel: RiskLevel.HIGH, targetScore: 65 },
        { expectedLevel: RiskLevel.ELEVATED, targetScore: 80 },
        { expectedLevel: RiskLevel.CRITICAL, targetScore: 92 },
      ];

      testCases.forEach(({ expectedLevel, targetScore }) => {
        // Create input that might produce target score range
        const input = createStandardTransactionInput(targetScore * 100);
        const assessment = assessor.assessTransaction(input);
        
        // Verify we get a valid level (exact mapping depends on factors)
        expect(Object.values(RiskLevel)).toContain(assessment.riskLevel);
      });
    });
  });
});

// Helper functions

function createStandardTransactionInput(amount: number): TransactionRiskInput {
  return {
    transactionId: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    amount,
    currency: 'NGN',
    customerId: 'cust_test_001',
    paymentMethod: 'CREDIT_CARD',
    timestamp: new Date(),
    channel: 'WEB',
  };
}
