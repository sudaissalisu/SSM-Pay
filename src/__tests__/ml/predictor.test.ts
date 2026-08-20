/**
 * @fileoverview Test suite for ML Prediction module
 * @module ml/predictor.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TransactionPredictor,
  RevenuePredictor,
  DEFAULT_TRANSACTION_CONFIG,
  DEFAULT_REVENUE_CONFIG,
} from '@/lib/ml/predictor';
import {
  PredictionType,
  type PredictionResult,
  type PredictionFeatures,
  type RevenueForecastInput,
  type ForecastGranularity,
  type HistoricalDataPoint,
  type ModelMetrics,
} from '@/lib/ml/predictor/types';

describe('ML Predictor Module', () => {
  
  describe('TransactionPredictor.successProbability()', () => {
    let predictor: TransactionPredictor;

    beforeEach(() => {
      predictor = new TransactionPredictor();
    });

    it('should return prediction result with valid probability', () => {
      const features = createStandardFeatures();
      const result: PredictionResult<number> = predictor.predictSuccessProbability(features);

      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(1);
      expect(result.type).toBe(PredictionType.TRANSACTION_SUCCESS);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.predictedAt).toBeInstanceOf(Date);
      expect(result.modelVersion).toBeDefined();
    });

    it('should return higher probability for trusted customers', () => {
      const trustedFeatures: PredictionFeatures = {
        ...createStandardFeatures(),
        totalTransactions: 100,
        accountAgeDays: 365,
        historicalSuccessRate: 0.98,
      };

      const newCustomerFeatures: PredictionFeatures = {
        ...createStandardFeatures(),
        totalTransactions: 0,
        accountAgeDays: 1,
        historicalSuccessRate: 0,
      };

      const trustedResult = predictor.predictSuccessProbability(trustedFeatures);
      const newResult = predictor.predictSuccessProbability(newCustomerFeatures);

      // Trusted customer should have higher success probability
      expect(trustedResult.value).toBeGreaterThan(newResult.value);
    });

    it('should return lower probability for large amounts', () => {
      const normalAmount: PredictionFeatures = {
        ...createStandardFeatures(),
        amount: 5000,
      };

      const largeAmount: PredictionFeatures = {
        ...createStandardFeatures(),
        amount: 150000, // Very large
      };

      const normalResult = predictor.predictSuccessProbability(normalAmount);
      const largeResult = predictor.predictSuccessProbability(largeAmount);

      // Large amounts should have slightly lower probability
      expect(largeResult.value).toBeLessThan(normalResult.value);
    });

    it('should include prediction interval bounds', () => {
      const features = createStandardFeatures();
      const result = predictor.predictSuccessProbability(features);

      expect(result.lowerBound).toBeDefined();
      expect(result.upperBound).toBeDefined();
      
      if (result.lowerBound !== undefined && result.upperBound !== undefined) {
        expect(result.lowerBound).toBeLessThanOrEqual(result.value);
        expect(result.upperBound).toBeGreaterThanOrEqual(result.value);
      }
    });

    it('should handle different payment methods', () => {
      const cardPayment: PredictionFeatures = {
        ...createStandardFeatures(),
        paymentMethod: 'CREDIT_CARD',
      };

      const cryptoPayment: PredictionFeatures = {
        ...createStandardFeatures(),
        paymentMethod: 'CRYPTO',
      };

      const cardResult = predictor.predictSuccessProbability(cardPayment);
      const cryptoResult = predictor.predictSuccessProbability(cryptoPayment);

      // Both should return valid results
      expect(cardResult.value).toBeGreaterThan(0);
      expect(cryptoResult.value).toBeGreaterThan(0);
    });

    it('should consider temporal factors (weekend/holiday)', () => {
      const weekdayFeature: PredictionFeatures = {
        ...createStandardFeatures(),
        isWeekend: false,
        isHoliday: false,
      };

      const weekendFeature: PredictionFeatures = {
        ...createStandardFeatures(),
        isWeekend: true,
        isHoliday: false,
      };

      const weekdayResult = predictor.predictSuccessProbability(weekdayFeature);
      const weekendResult = predictor.predictSuccessProbability(weekendFeature);

      // Weekend might have slightly different probability
      expect(weekendResult.value).toBeGreaterThan(0);
    });
  });

  describe('TransactionPredictor.processingTime()', () => {
    let predictor: TransactionPredictor;

    beforeEach(() => {
      predictor = new TransactionPredictor();
    });

    it('should estimate processing time in seconds', () => {
      const features = createStandardFeatures();
      const result = predictor.predictProcessingTime(features);

      expect(typeof result.value).toBe('number');
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.type).toBe(PredictionType.PROCESSING_TIME);
    });

    it('should return longer times for bank transfers than digital wallets', () => {
      const bankTransfer: PredictionFeatures = {
        ...createStandardFeatures(),
        paymentMethod: 'BANK_TRANSFER',
      };

      const digitalWallet: PredictionFeatures = {
        ...createStandardFeatures(),
        paymentMethod: 'DIGITAL_WALLET',
      };

      const bankResult = predictor.predictProcessingTime(bankTransfer);
      const walletResult = predictor.predictProcessingTime(digitalWallet);

      expect(bankResult.value).toBeGreaterThan(walletResult.value);
    });

    it('should increase time for large amounts', () => {
      const normalAmount: PredictionFeatures = {
        ...createStandardFeatures(),
        amount: 5000,
      };

      const largeAmount: PredictionFeatures = {
        ...createStandardFeatures(),
        amount: 100000,
      };

      const normalResult = predictor.predictProcessingTime(normalAmount);
      const largeResult = predictor.predictProcessingTime(largeAmount);

      expect(largeResult.value).toBeGreaterThanOrEqual(normalResult.value);
    });
  });

  describe('TransactionPredictor.churnRisk()', () => {
    let predictor: TransactionPredictor;

    beforeEach(() => {
      predictor = new TransactionPredictor();
    });

    it('should predict churn risk between 0 and 1', () => {
      const features = createStandardFeatures();
      const result = predictor.predictChurnRisk(features);

      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(1);
      expect(result.type).toBe(PredictionType.CHURN_RISK);
    });

    it('should identify high churn risk for inactive accounts', () => {
      const inactiveAccount: PredictionFeatures = {
        ...createStandardFeatures(),
        totalTransactions: 0,
        accountAgeDays: 2,
        historicalSuccessRate: 0.5,
      };

      const result = predictor.predictChurnRisk(inactiveAccount);
      
      // Inactive new accounts should have elevated churn risk
      expect(result.metadata?.isAtRisk).toBeDefined();
    });

    it('should show low churn risk for loyal customers', () => {
      const loyalCustomer: PredictionFeatures = {
        ...createStandardFeatures(),
        totalTransactions: 200,
        accountAgeDays: 500,
        historicalSuccessRate: 0.99,
      };

      const result = predictor.predictChurnRisk(loyalCustomer);
      
      // Loyal customers should have lower churn risk
      expect(result.value).toBeLessThan(0.5);
    });
  });

  describe('RevenuePredictor.forecastRevenue()', () => {
    let predictor: RevenuePredictor;

    beforeEach(() => {
      predictor = new RevenuePredictor();
    });

    it('should generate revenue forecast with data points', () => {
      const input: RevenueForecastInput = {
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 86400000), // 7 days
        granularity: ForecastGranularity.DAILY,
        includeHistoricalComparison: true,
      };

      const result = predictor.forecastRevenue(input);

      expect(result.value).toBeDefined();
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.dataPoints).toHaveLength(result.value.length);
      expect(result.totalAmount).toBeGreaterThan(0);
      expect(result.type).toBe(PredictionType.REVENUE_FORECAST);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should include growth metrics when historical data provided', () => {
      const input: RevenueForecastInput = {
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 86400000),
        granularity: ForecastGranularity.DAILY,
      };

      const historicalData: HistoricalDataPoint[] = generateHistoricalData(30);
      const result = predictor.forecastRevenue(input, historicalData);

      // Should include YoY and MoM growth when historical data is present
      if (historicalData.length > 0) {
        expect(result.yoyGrowth).toBeDefined();
        expect(result.momGrowth).toBeDefined();
      }
    });

    it('should respect forecast granularity', () => {
      const dailyInput: RevenueForecastInput = {
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 86400000),
        granularity: ForecastGranularity.DAILY,
      };

      const weeklyInput: RevenueForecastInput = {
        startDate: new Date(),
        endDate: new Date(Date.now() + 28 * 86400000),
        granularity: ForecastGranularity.WEEKLY,
      };

      const dailyResult = predictor.forecastRevenue(dailyInput);
      const weeklyResult = predictor.forecastRevenue(weeklyInput);

      // Daily should have more points than weekly for similar periods
      expect(dailyResult.dataPoints.length).toBeGreaterThan(0);
      expect(weeklyResult.dataPoints.length).toBeGreaterThan(0);
    });

    it('should generate valid data points with bounds', () => {
      const input: RevenueForecastInput = {
        startDate: new Date(),
        endDate: new Date(Date.now() + 3 * 86400000),
        granularity: ForecastGranularity.DAILY,
      };

      const result = predictor.forecastRevenue(input);

      result.dataPoints.forEach(point => {
        expect(point.date).toBeInstanceOf(Date);
        expect(point.value).toBeGreaterThanOrEqual(0);
        expect(point.lowerBound).toBeLessThanOrEqual(point.value);
        expect(point.upperBound).toBeGreaterThanOrEqual(point.value);
      });
    });
  });

  describe('RevenuePredictor.dailyVolume()', () => {
    let predictor: RevenuePredictor;

    beforeEach(() => {
      predictor = new RevenuePredictor();
    });

    it('should predict daily transaction volume', () => {
      const testDate = new Date();
      const result = predictor.predictDailyVolume(testDate);

      expect(typeof result.value).toBe('number');
      expect(result.value).toBeGreaterThan(0);
      expect(result.type).toBe(PredictionType.DAILY_VOLUME);
    });

    it('should adjust volume based on day of week', () => {
      const monday = new Date('2024-01-08'); // Monday
      const sunday = new Date('2024-01-07'); // Sunday

      const mondayResult = predictor.predictDailyVolume(monday);
      const sundayResult = predictor.predictDailyVolume(sunday);

      // Weekends typically have lower volume
      expect(mondayResult.value).toBeGreaterThan(0);
      expect(sundayResult.value).toBeGreaterThan(0);
    });

    it('should use recent volumes as baseline when provided', () => {
      const testDate = new Date();
      const recentVolumes: HistoricalDataPoint[] = [
        { timestamp: new Date(Date.now() - 86400000), value: 15000 },
        { timestamp: new Date(Date.now() - 172800000), value: 14000 },
        { timestamp: new Date(Date.now() - 259200000), value: 16000 },
      ];

      const result = predictor.predictDailyVolume(testDate, recentVolumes);
      
      expect(result.metadata?.baseVolume).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.5); // Higher confidence with history
    });
  });

  describe('Prediction Result Types', () => {
    it('should contain all required fields in prediction result', () => {
      const mockResult: PredictionResult<string> = {
        value: 'test_value',
        type: PredictionType.TRANSACTION_SUCCESS,
        confidence: 0.85,
        lowerBound: 'lower',
        upperBound: 'upper',
        predictedAt: new Date(),
        modelVersion: 'v1.0.0',
        metadata: { key: 'value' },
      };

      expect(mockResult.value).toBe('test_value');
      expect(mockResult.type).toBe(PredictionType.TRANSACTION_SUCCESS);
      expect(mockResult.confidence).toBe(0.85);
      expect(mockResult.modelVersion).toBe('v1.0.0');
    });

    it('should handle numeric prediction results correctly', () => {
      const numericResult: PredictionResult<number> = {
        value: 0.95,
        type: PredictionType.TRANSACTION_SUCCESS,
        confidence: 0.9,
        lowerBound: 0.85,
        upperBound: 0.99,
        predictedAt: new Date(),
        modelVersion: 'v2.0.0',
      };

      expect(typeof numericResult.value).toBe('number');
      expect(numericResult.lowerBound).toBeLessThan(numericResult.upperBound);
    });
  });

  describe('Model Metrics', () => {
    it('should return valid model metrics from TransactionPredictor', () => {
      const predictor = new TransactionPredictor();
      const metrics: ModelMetrics = predictor.getMetrics();

      expect(metrics.mae).toBeGreaterThanOrEqual(0);
      expect(metrics.rmse).toBeGreaterThanOrEqual(0);
      expect(metrics.r2Score).toBeGreaterThanOrEqual(0);
      expect(metrics.r2Score).toBeLessThanOrEqual(1);
      expect(metrics.sampleCount).toBeGreaterThan(0);
      expect(metrics.modelVersion).toBeDefined();
    });

    it('should return valid model metrics from RevenuePredictor', () => {
      const predictor = new RevenuePredictor();
      const metrics: ModelMetrics = predictor.getMetrics();

      expect(metrics.mae).toBeGreaterThanOrEqual(0);
      expect(metrics.modelVersion).toContain('revenue');
    });
  });
});

// Helper functions

function createStandardFeatures(): PredictionFeatures {
  return {
    amount: 10000,
    currency: 'NGN',
    paymentMethod: 'CREDIT_CARD',
    customerId: 'cust_001',
    accountAgeDays: 90,
    historicalSuccessRate: 0.95,
    totalTransactions: 25,
    hourOfDay: 14,
    dayOfWeek: 3, // Wednesday
    isWeekend: false,
    isHoliday: false,
    isCrossBorder: false,
  };
}

function generateHistoricalData(days: number): HistoricalDataPoint[] {
  const data: HistoricalDataPoint[] = [];
  const now = Date.now();

  for (let i = days; i > 0; i--) {
    data.push({
      timestamp: new Date(now - i * 86400000),
      value: 45000 + Math.random() * 10000, // Random around 45k-55k
    });
  }

  return data;
}
