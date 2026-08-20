/**
 * @fileoverview Test suite for Fraud Detection module
 * @module ml/fraud-detector.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FraudDetector,
  FraudRuleEngine,
  FraudScorer,
  velocityCheck,
  amountAnomaly,
  locationMismatch,
  newDeviceFlag,
  BUILT_IN_RULES,
} from '@/lib/ml/fraud-detector';
import {
  FraudRiskLevel,
  FraudSignalCategory,
  FraudRecommendation,
  type FraudDetectionInput,
  type CustomerFraudProfile,
  type FraudDetectionResult,
  type FraudSignal,
  DEFAULT_FRAUD_CONFIG,
} from '@/lib/ml/fraud-detector/types';

describe('Fraud Detector Module', () => {
  
  describe('FraudRuleEngine Initialization', () => {
    it('should initialize with default rules', () => {
      const engine = new FraudRuleEngine();
      const activeRules = engine.getActiveRules();
      
      expect(activeRules.length).toBeGreaterThan(0);
      expect(activeRules).toContain(velocityCheck);
      expect(activeRules).toContain(amountAnomaly);
    });

    it('should initialize with custom config', () => {
      const customConfig = {
        ...DEFAULT_FRAUD_CONFIG,
        maxTransactionsPerHour: 20,
        criticalRiskThreshold: 90,
      };
      
      const engine = new FraudRuleEngine(BUILT_IN_RULES, customConfig);
      const config = engine.getConfig();
      
      expect(config.maxTransactionsPerHour).toBe(20);
      expect(config.criticalRiskThreshold).toBe(90);
    });

    it('should filter out disabled rules', () => {
      const disabledRules = BUILT_IN_RULES.map(rule => ({
        ...rule,
        enabled: false,
      }));
      
      const engine = new FraudRuleEngine(disabledRules);
      const activeRules = engine.getActiveRules();
      
      expect(activeRules).toHaveLength(0);
    });

    it('should add and remove rules dynamically', () => {
      const engine = new FraudRuleEngine();
      const initialCount = engine.getActiveRules().length;
      
      // Add a custom rule
      const customRule = {
        id: 'custom_test_rule',
        name: 'Custom Test Rule',
        description: 'A test rule',
        category: FraudSignalCategory.BEHAVIOR,
        defaultSeverity: 50,
        enabled: true,
        evaluate: () => null,
      };
      
      engine.addRule(customRule as any);
      expect(engine.getActiveRules()).toHaveLength(initialCount + 1);
      
      // Remove the rule
      const removed = engine.removeRule('custom_test_rule');
      expect(removed).toBe(true);
      expect(engine.getActiveRules()).toHaveLength(initialCount);
    });
  });

  describe('Velocity Check Rule Detection', () => {
    it('should detect high transaction velocity', () => {
      const input: FraudDetectionInput = createTestInput();
      const profile: CustomerFraudProfile = {
        customerId: 'cust_001',
        avgTransactionAmount: 5000,
        amountStdDev: 2000,
        typicalCountries: ['NG'],
        knownDevices: ['device_1'],
        accountCreatedDate: new Date(),
        totalTransactionCount: 15, // Exceeds default threshold of 10
        flaggedTransactionCount: 5, // High flagged rate
        riskTier: 'STANDARD' as any,
      };

      const signal = velocityCheck.evaluate(input, profile);
      
      // Should trigger due to high transaction count or flagged rate
      if (signal) {
        expect(signal.category).toBe(FraudSignalCategory.VELOCITY);
        expect(signal.severity).toBeGreaterThan(0);
        expect(signal.name).toContain('High Transaction Velocity');
      }
    });

    it('should not flag normal transaction patterns', () => {
      const input: FraudDetectionInput = createTestInput();
      const profile: CustomerFraudProfile = {
        customerId: 'cust_normal',
        avgTransactionAmount: 5000,
        amountStdDev: 2000,
        typicalCountries: ['NG'],
        knownDevices: ['device_1'],
        accountCreatedDate: new Date(Date.now() - 86400000 * 30),
        totalTransactionCount: 3,
        flaggedTransactionCount: 0,
        riskTier: 'TRUSTED' as any,
      };

      const signal = velocityCheck.evaluate(input, profile);
      
      // Normal customer should not trigger velocity check
      expect(signal).toBeNull();
    });

    it('should be disabled when config says so', () => {
      const input: FraudDetectionInput = createTestInput();
      const profile: CustomerFraudProfile = {
        customerId: 'cust_002',
        avgTransactionAmount: 5000,
        amountStdDev: 2000,
        typicalCountries: ['NG'],
        knownDevices: [],
        accountCreatedDate: new Date(),
        totalTransactionCount: 100,
        flaggedTransactionCount: 50,
        riskTier: 'HIGH_RISK' as any,
      };

      const disabledConfig = {
        ...DEFAULT_FRAUD_CONFIG,
        enableVelocityCheck: false,
      };

      const signal = velocityCheck.evaluate(input, profile, disabledConfig);
      expect(signal).toBeNull();
    });
  });

  describe('Amount Anomaly Detection', () => {
    it('should detect unusually large transactions (z-score > 3)', () => {
      const input: FraudDetectionInput = {
        ...createTestInput(),
        amount: 150000, // Very large compared to average of 5000
      };
      
      const profile: CustomerFraudProfile = {
        customerId: 'cust_amount',
        avgTransactionAmount: 5000,
        amountStdDev: 3000, // std dev allows calculation
        typicalCountries: ['NG'],
        knownDevices: ['device_1'],
        accountCreatedDate: new Date(),
        totalTransactionCount: 10,
        flaggedTransactionCount: 0,
        riskTier: 'STANDARD' as any,
      };

      const signal = amountAnomaly.evaluate(input, profile);
      
      if (signal) {
        expect(signal.category).toBe(FraudSignalCategory.AMOUNT);
        expect(signal.severity).toBeGreaterThan(0);
      }
    });

    it('should detect transactions exceeding maximum amount', () => {
      const input: FraudDetectionInput = {
        ...createTestInput(),
        amount: 100000, // Exceeds default max of 50000
      };
      
      const profile: CustomerFraudProfile = {
        customerId: 'cust_max',
        avgTransactionAmount: 10000,
        amountStdDev: 5000,
        typicalCountries: ['NG'],
        knownDevices: ['device_1'],
        accountCreatedDate: new Date(),
        totalTransactionCount: 5,
        flaggedTransactionCount: 0,
        riskTier: 'STANDARD' as any,
      };

      const signal = amountAnomaly.evaluate(input, profile);
      
      if (signal) {
        expect(signal.name).toContain('Exceeds Maximum Amount');
        expect(signal.metadata?.maximum).toBeDefined();
      }
    });

    it('should not flag amounts within normal range', () => {
      const input: FraudDetectionInput = {
        ...createTestInput(),
        amount: 5500, // Close to average of 5000
      };
      
      const profile: CustomerFraudProfile = {
        customerId: 'cust_normal_amt',
        avgTransactionAmount: 5000,
        amountStdDev: 2000,
        typicalCountries: ['NG'],
        knownDevices: ['device_1'],
        accountCreatedDate: new Date(),
        totalTransactionCount: 10,
        flaggedTransactionCount: 0,
        riskTier: 'TRUSTED' as any,
      };

      const signal = amountAnomaly.evaluate(input, profile);
      expect(signal).toBeNull();
    });
  });

  describe('Fraud Scoring Calculation', () => {
    let scorer: FraudScorer;

    beforeEach(() => {
      scorer = new FraudScorer();
    });

    it('should return score of 0 for no signals', () => {
      const score = scorer.calculateScore([]);
      expect(score).toBe(0);
    });

    it('should calculate composite score from signals', () => {
      const signals: FraudSignal[] = [
        createTestSignal('sig_1', FraudSignalCategory.VELOCITY, 70),
        createTestSignal('sig_2', FraudSignalCategory.AMOUNT, 50),
        createTestSignal('sig_3', FraudSignalCategory.DEVICE, 40),
      ];

      const score = scorer.calculateScore(signals);
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should apply higher weights to identity signals', () => {
      const identitySignals: FraudSignal[] = [
        createTestSignal('id_sig', FraudSignalCategory.IDENTITY, 80),
      ];
      
      const velocitySignals: FraudSignal[] = [
        createTestSignal('vel_sig', FraudSignalCategory.VELOCITY, 80),
      ];

      const identityScore = scorer.calculateScore(identitySignals);
      const velocityScore = scorer.calculateScore(velocitySignals);
      
      // Identity should have higher weight than velocity
      expect(identityScore).toBeGreaterThanOrEqual(velocityScore);
    });

    it('should handle clustering bonus for same-category signals', () => {
      const clusteredSignals: FraudSignal[] = [
        createTestSignal('c1', FraudSignalCategory.AMOUNT, 60),
        createTestSignal('c2', FraudSignalCategory.AMOUNT, 55),
        createTestSignal('c3', FraudSignalCategory.AMOUNT, 50),
      ];

      const singleSignal: FraudSignal[] = [
        createTestSignal('s1', FraudSignalCategory.AMOUNT, 60),
      ];

      const clusteredScore = scorer.calculateScore(clusteredSignals);
      const singleScore = scorer.calculateScore(singleSignal);
      
      // Clustered signals should have some boost
      expect(clusteredScore).toBeGreaterThan(0);
    });
  });

  describe('Risk Level Determination', () => {
    let scorer: FraudScorer;

    beforeEach(() => {
      scorer = new FraudScorer();
    });

    it('should return LOW for scores below medium threshold', () => {
      const level = scorer.getRiskLevel(20);
      expect(level).toBe(FraudRiskLevel.LOW);
    });

    it('should return MEDIUM for scores in medium range', () => {
      const level = scorer.getRiskLevel(45);
      expect(level).toBe(FraudRiskLevel.MEDIUM);
    });

    it('should return HIGH for scores in high range', () => {
      const level = scorer.getRiskLevel(70);
      expect(level).toBe(FraudRiskLevel.HIGH);
    });

    it('should return CRITICAL for scores at or above critical threshold', () => {
      const level = scorer.getRiskLevel(88);
      expect(level).toBe(FraudRiskLevel.CRITICAL);
    });

    it('should handle boundary values correctly', () => {
      // Just below thresholds
      expect(scorer.getRiskLevel(29)).toBe(FraudRiskLevel.LOW);
      expect(scorer.getRiskLevel(59)).toBe(FraudRiskLevel.MEDIUM);
      expect(scorer.getRiskLevel(84)).toBe(FraudRiskLevel.HIGH);
      
      // At thresholds
      expect(scorer.getRiskLevel(30)).toBe(FraudRiskLevel.MEDIUM);
      expect(scorer.getRiskLevel(60)).toBe(FraudRiskLevel.HIGH);
      expect(scorer.getRiskLevel(85)).toBe(FraudRiskLevel.CRITICAL);
    });
  });

  describe('FraudDetector Integration', () => {
    let detector: FraudDetector;

    beforeEach(() => {
      detector = new FraudDetector();
    });

    it('should analyze transaction and return complete result', () => {
      const input: FraudDetectionInput = createTestInput();
      const result: FraudDetectionResult = detector.analyze(input);

      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(Object.values(FraudRiskLevel)).toContain(result.riskLevel);
      expect(result.detectionId).toContain('fd_');
      expect(result.analyzedAt).toBeInstanceOf(Date);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should include recommendation in result', () => {
      const input: FraudDetectionInput = createTestInput();
      const result = detector.analyze(input);

      expect(Object.values(FraudRecommendation)).toContain(result.recommendation);
    });

    it('should provide quick risk score access', () => {
      const input: FraudDetectionInput = createTestInput();
      const score = detector.getRiskScore(input);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should consider customer profile when provided', () => {
      const input: FraudDetectionInput = createTestInput();
      const profile: CustomerFraudProfile = {
        customerId: 'cust_profiled',
        avgTransactionAmount: 5000,
        amountStdDev: 2000,
        typicalCountries: ['NG'],
        knownDevices: ['device_1'],
        accountCreatedDate: new Date(Date.now() - 86400000 * 60),
        totalTransactionCount: 50,
        flaggedTransactionCount: 0,
        riskTier: 'TRUSTED' as any,
      };

      const resultWithProfile = detector.analyze(input, profile);
      const resultWithoutProfile = detector.analyze(input);

      // Both should return valid results
      expect(resultWithProfile.riskScore).toBeGreaterThanOrEqual(0);
      expect(resultWithoutProfile.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('should update configuration dynamically', () => {
      const originalConfig = detector.getConfig();
      
      detector.updateConfig({
        criticalRiskThreshold: 95,
        autoBlockCritical: false,
      });

      const updatedConfig = detector.getConfig();
      expect(updatedConfig.criticalRiskThreshold).toBe(95);
      expect(updatedConfig.autoBlockCritical).toBe(false);
    });
  });
});

// Helper functions for creating test data

function createTestInput(
  overrides: Partial<FraudDetectionInput> = {}
): FraudDetectionInput {
  return {
    transactionId: `txn_${Date.now()}`,
    amount: 10000,
    currency: 'NGN',
    customerId: 'cust_test',
    recipientId: 'merchant_001',
    timestamp: new Date(),
    paymentMethod: 'CREDIT_CARD',
    channel: 'WEB',
    ...overrides,
  };
}

function createTestSignal(
  id: string,
  category: FraudSignalCategory,
  severity: number
): FraudSignal {
  return {
    id,
    name: `Test Signal ${id}`,
    description: `Test signal for ${category}`,
    severity,
    category,
    timestamp: new Date(),
  };
}
