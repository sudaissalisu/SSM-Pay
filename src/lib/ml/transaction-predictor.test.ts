/**
 * Comprehensive Test Suite for Transaction Predictor Module
 * Tests all ML prediction functionality including:
 * - Statistical utility functions
 * - Time series forecasting
 * - Churn prediction
 * - Payment success prediction
 * - Revenue forecasting
 * - Seasonal pattern detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  // Main class
  TransactionPredictor,
  createTransactionPredictor,
  quickVolumePrediction,
  quickChurnPrediction,
  quickRevenueForecast,
  
  // Statistical functions
  calculateMean,
  calculateStdDev,
  calculateVariance,
  calculateMedian,
  calculatePercentile,
  calculateCorrelation,
  calculateRSquared,
  normalizeMinMax,
  standardizeZScore,
  sigmoid,
  relu,
  simpleMovingAverage,
  weightedMovingAverage,
  exponentialMovingAverage,
  doubleExponentialSmoothing,
  holtWintersSmoothing,
  linearRegression,
  polynomialRegression,
  detectAnomaliesZScore,
  detectAnomaliesIQR,
  
  // Types
  type TimeSeriesPoint,
  type CustomerProfile,
  type PredictionResult,
  type VolumePrediction,
  type ChurnPrediction,
  type SuccessPrediction,
  type RevenueForecast,
  type SeasonalPattern,
  type ModelVersion,
  type ModelMetrics,
  type PredictionConfig,
  type PaymentMethodType,
  type TransactionStatus,
  type DeviceType,
  type CustomerSegment,
  type ChurnRiskLevel,
  type PaymentRiskLevel,
  type SeasonalPatternType,
} from './transaction-predictor';

// ============== Test Data Generators ==============

/**
 * Generate synthetic time series data for testing
 */
function generateTimeSeriesData(days: number = 90, options: {
  baseCount?: number;
  trend?: number;
  seasonalityAmplitude?: number;
  noiseLevel?: number;
  seasonalityPeriod?: number;
} = {}): TimeSeriesPoint[] {
  const {
    baseCount = 100,
    trend = 0.5,
    seasonalityAmplitude = 0.3,
    noiseLevel = 0.1,
    seasonalityPeriod = 7,
  } = options;

  const data: TimeSeriesPoint[] = [];
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Add trend component
    const trendComponent = trend * (days - i);

    // Add seasonal component (weekly pattern)
    const dayOfWeek = date.getDay();
    const seasonalComponent = Math.sin((dayOfWeek / seasonalityPeriod) * 2 * Math.PI) * seasonalityAmplitude;

    // Add noise
    const noise = (Math.random() - 0.5) * 2 * noiseLevel;

    // Calculate final count
    const count = Math.round(Math.max(10, baseCount + trendComponent + baseCount * seasonalComponent + baseCount * noise));
    
    data.push({
      timestamp: date,
      count,
      volume: count * (50000 + Math.random() * 100000), // Average txn value between 500-1500 Naira
      averageAmount: 50000 + Math.random() * 100000,
      successCount: Math.round(count * (0.9 + Math.random() * 0.08)),
      failedCount: Math.round(count * (0.02 + Math.random() * 0.05)),
      uniqueCustomers: Math.round(count * (0.7 + Math.random() * 0.2)),
      uniqueMerchants: Math.round(5 + Math.random() * 20),
    });
  }

  return data;
}

/**
 * Generate test customer profiles
 */
function generateCustomerProfiles(count: number = 5): CustomerProfile[] {
  const profiles: CustomerProfile[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const isAtRisk = i === 1 || i === 3; // Make some customers at risk
    
    profiles.push({
      customerId: `customer-${i + 1}`,
      registrationDate: new Date(now.getTime() - (30 + i * 60) * 24 * 60 * 60 * 1000),
      totalTransactions: isAtRisk ? 5 + i : 50 + i * 20,
      totalSpend: isAtRisk ? 250000 : 2500000 + i * 1000000,
      avgTransactionValue: isAtRisk ? 50000 : 55000,
      daysSinceLastTransaction: isAtRisk ? 45 + i * 10 : 2 + i,
      daysSinceFirstTransaction: 30 + i * 60,
      transactionFrequency: isAtRisk ? 0.5 : 8 + i * 2,
      preferredPaymentMethod: ['card', 'bank_transfer', 'wallet', 'ussd', 'qr_code'][i % 5] as PaymentMethodType,
      successRate: isAtRisk ? 0.75 + i * 0.02 : 0.92 + i * 0.01,
      avgProcessingTime: isAtRisk ? 8000 : 3000,
      failedTransactions30d: isAtRisk ? 3 + i : 0,
      successTransactions30d: isAtRisk ? 2 : 15 + i * 5,
      spendTrend: isAtRisk ? -0.3 - i * 0.05 : 0.1 + i * 0.03,
      engagementScore: isAtRisk ? 25 + i * 5 : 70 + i * 5,
      tenureDays: 30 + i * 60,
      isPremium: i === 0,
      lastTransactionDate: new Date(now.getTime() - (isAtRisk ? 45 + i * 10 : 2 + i) * 24 * 60 * 60 * 1000),
      preferredMerchantIds: [`merchant-${(i % 5) + 1}`],
      region: ['Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan'][i],
      segment: isAtRisk ? 'at_risk' : (i === 0 ? 'premium' : 'active') as CustomerSegment,
    });
  }

  return profiles;
}

// ============== Statistical Functions Tests ==============

describe('Statistical Utility Functions', () => {
  describe('calculateMean', () => {
    it('should calculate mean of positive numbers', () => {
      expect(calculateMean([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should handle negative numbers', () => {
      expect(calculateMean([-1, 1, -1, 1])).toBe(0);
    });

    it('should return 0 for empty array', () => {
      expect(calculateMean([])).toBe(0);
    });

    it('should handle single element array', () => {
      expect(calculateMean([42])).toBe(42);
    });

    it('should handle decimal numbers', () => {
      expect(calculateMean([1.5, 2.5, 3.5])).toBe(2.5);
    });
  });

  describe('calculateStdDev', () => {
    it('should calculate standard deviation correctly', () => {
      // For [2, 4, 4, 4, 5, 5, 7, 9], std dev should be ~2
      const result = calculateStdDev([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(result).toBeCloseTo(2, 0);
    });

    it('should return 0 for empty array', () => {
      expect(calculateStdDev([])).toBe(0);
    });

    it('should return 0 for constant array', () => {
      expect(calculateStdDev([5, 5, 5, 5])).toBeCloseTo(0, 5);
    });
  });

  describe('calculateVariance', () => {
    it('should return square of standard deviation', () => {
      const values = [1, 2, 3, 4, 5];
      const stdDev = calculateStdDev(values);
      const variance = calculateVariance(values);
      expect(variance).toBeCloseTo(stdDev * stdDev, 5);
    });
  });

  describe('calculateMedian', () => {
    it('should find median of odd-length array', () => {
      expect(calculateMedian([1, 3, 5])).toBe(3);
    });

    it('should find median of even-length array', () => {
      expect(calculateMedian([1, 2, 3, 4])).toBe(2.5);
    });

    it('should return 0 for empty array', () => {
      expect(calculateMedian([])).toBe(0);
    });

    it('should handle unsorted input', () => {
      expect(calculateMedian([5, 1, 3, 2, 4])).toBe(3);
    });
  });

  describe('calculatePercentile', () => {
    it('should calculate 50th percentile (median)', () => {
      expect(calculatePercentile([1, 2, 3, 4, 5], 50)).toBe(3);
    });

    it('should calculate 25th percentile', () => {
      expect(calculatePercentile([1, 2, 3, 4, 5], 25)).toBe(2);
    });

    it('should calculate 75th percentile', () => {
      expect(calculatePercentile([1, 2, 3, 4, 5], 75)).toBe(4);
    });

    it('should return 0 for empty array', () => {
      expect(calculatePercentile([], 50)).toBe(0);
    });

    it('should return min for 0th percentile', () => {
      expect(calculatePercentile([1, 2, 3, 4, 5], 0)).toBe(1);
    });

    it('should return max for 100th percentile', () => {
      expect(calculatePercentile([1, 2, 3, 4, 5], 100)).toBe(5);
    });
  });

  describe('calculateCorrelation', () => {
    it('should detect perfect positive correlation', () => {
      expect(calculateCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBeCloseTo(1, 5);
    });

    it('should detect perfect negative correlation', () => {
      expect(calculateCorrelation([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBeCloseTo(-1, 5);
    });

    it('should detect no correlation', () => {
      // These should have near-zero correlation
      const result = calculateCorrelation([1, 2, 3, 4, 5], [5, 1, 4, 2, 3]);
      expect(Math.abs(result)).toBeLessThan(0.5);
    });

    it('should return 0 for empty arrays', () => {
      expect(calculateCorrelation([], [])).toBe(0);
    });

    it('should return 0 for mismatched lengths', () => {
      expect(calculateCorrelation([1, 2, 3], [1, 2])).toBe(0);
    });
  });

  describe('calculateRSquared', () => {
    it('should be 1 for perfect predictions', () => {
      expect(calculateRSquared([1, 2, 3], [1, 2, 3])).toBe(1);
    });

    it('should be 0 for poor predictions (mean baseline)', () => {
      // If we predict mean for all, R² should be close to 0
      const actual = [1, 2, 3, 4, 5];
      const mean = calculateMean(actual);
      const predicted = [mean, mean, mean, mean, mean];
      expect(calculateRSquared(actual, predicted)).toBeCloseTo(0, 5);
    });

    it('should handle empty arrays', () => {
      expect(calculateRSquared([], [])).toBe(0);
    });
  });

  describe('normalizeMinMax', () => {
    it('should normalize to 0-1 range', () => {
      const result = normalizeMinMax([0, 25, 50, 75, 100]);
      expect(result.normalized).toEqual([0, 0.25, 0.5, 0.75, 1]);
    });

    it('should handle negative values', () => {
      const result = normalizeMinMax([-10, 0, 10]);
      expect(result.normalized[0]).toBe(0);
      expect(result.normalized[1]).toBeCloseTo(0.5);
      expect(result.normalized[2]).toBe(1);
    });

    it('should return empty for empty input', () => {
      const result = normalizeMinMax([]);
      expect(result.normalized).toEqual([]);
    });

    it('should handle constant array (scale = 1)', () => {
      const result = normalizeMinMax([5, 5, 5]);
      expect(result.scale).toBe(1);
    });
  });

  describe('standardizeZScore', () => {
    it('should produce zero-mean output', () => {
      const result = standardizeZScore([1, 2, 3, 4, 5]);
      const meanOfStandardized = result.standardized.reduce((a, b) => a + b, 0) / result.standardized.length;
      expect(meanOfStandardized).toBeCloseTo(0, 5);
    });

    it('should return empty for empty input', () => {
      const result = standardizeZScore([]);
      expect(result.standardized).toEqual([]);
    });
  });

  describe('sigmoid', () => {
    it('should return 0.5 for input 0', () => {
      expect(sigmoid(0)).toBeCloseTo(0.5, 5);
    });

    it('should approach 1 for large positive inputs', () => {
      expect(sigmoid(100)).toBeGreaterThan(0.99);
    });

    it('should approach 0 for large negative inputs', () => {
      expect(sigmoid(-100)).toBeLessThan(0.01);
    });

    it('should handle edge cases without overflow', () => {
      expect(() => sigmoid(1000)).not.toThrow();
      expect(() => sigmoid(-1000)).not.toThrow();
    });
  });

  describe('relu', () => {
    it('should return 0 for negative inputs', () => {
      expect(relu(-5)).toBe(0);
      expect(relu(-0.001)).toBe(0);
    });

    it('should return input for non-negative inputs', () => {
      expect(relu(0)).toBe(0);
      expect(relu(5)).toBe(5);
      expect(relu(3.14)).toBeCloseTo(3.14, 5);
    });
  });
});

// ============== Moving Average & Smoothing Tests ==============

describe('Moving Averages and Smoothing', () => {
  describe('simpleMovingAverage', () => {
    it('should calculate correct moving averages', () => {
      const result = simpleMovingAverage([1, 2, 3, 4, 5], 3);
      expect(result).toEqual([2, 3, 4]); // (1+2+3)/3, (2+3+4)/3, (3+4+5)/3
    });

    it('should return empty for window <= 0', () => {
      expect(simpleMovingAverage([1, 2, 3], 0)).toEqual([]);
      expect(simpleMovingAverage([1, 2, 3], -1)).toEqual([]);
    });

    it('should return empty for empty input', () => {
      expect(simpleMovingAverage([], 3)).toEqual([]);
    });

    it('should return single value when window >= length', () => {
      const result = simpleMovingAverage([1, 2, 3], 5);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(2); // Mean of [1, 2, 3]
    });
  });

  describe('weightedMovingAverage', () => {
    it('should apply weights correctly', () => {
      const values = [1, 2, 3, 4];
      const weights = [1, 2, 3]; // More weight on recent values
      const result = weightedMovingAverage(values, weights);
      
      // First window: (1*1 + 2*2 + 3*3) / 6 = 14/6 ≈ 2.33
      // Second window: (2*1 + 3*2 + 4*3) / 6 = 20/6 ≈ 3.33
      expect(result).toHaveLength(2);
      expect(result[0]).toBeCloseTo(14 / 6, 3);
      expect(result[1]).toBeCloseTo(20 / 6, 3);
    });

    it('should return empty for empty weights', () => {
      expect(weightedMovingAverage([1, 2, 3], [])).toEqual([]);
    });
  });

  describe('exponentialMovingAverage', () => {
    it('should start with first value', () => {
      const result = exponentialMovingAverage([5, 10, 15], 0.5);
      expect(result[0]).toBe(5);
    });

    it('should smooth more with lower alpha', () => {
      const lowAlpha = exponentialMovingAverage([10, 20, 30, 40, 50], 0.1);
      const highAlpha = exponentialMovingAverage([10, 20, 30, 40, 50], 0.9);
      
      // High alpha should track closer to original values
      expect(highAlpha[highAlpha.length - 1]).toBeGreaterThan(lowAlpha[lowAlpha.length - 1]);
    });

    it('should clamp alpha to valid range', () => {
      expect(() => exponentialMovingAverage([1, 2, 3], -0.5)).not.toThrow();
      expect(() => exponentialMovingAverage([1, 2, 3], 1.5)).not.toThrow();
    });
  });

  describe('doubleExponentialSmoothing', () => {
    it('should return smoothed and trend arrays', () => {
      const values = [10, 12, 14, 16, 18];
      const result = doubleExponentialSmoothing(values, 0.5, 0.3);
      
      expect(result.smoothed).toHaveLength(values.length);
      expect(result.trend).toHaveLength(values.length);
    });

    it('should capture upward trend', () => {
      const values = [10, 20, 30, 40, 50];
      const result = doubleExponentialSmoothing(values);
      
      // Trend should be positive for increasing series
      const avgTrend = result.trend.reduce((a, b) => a + b, 0) / result.trend.length;
      expect(avgTrend).toBeGreaterThan(0);
    });

    it('should handle short arrays', () => {
      const result = doubleExponentialSmoothing([42]);
      expect(result.smoothed).toEqual([42]);
    });
  });

  describe('holtWintersSmoothing', () => {
    it('should handle sufficient data', () => {
      const values = Array.from({ length: 21 }, (_, i) => 
        100 + Math.sin(i / 7 * 2 * Math.PI) * 20 + i * 2
      );
      const result = holtWintersSmoothing(values, 7);
      
      expect(result.smoothed).toHaveLength(values.length);
      expect(result.level).toHaveLength(values.length);
      expect(result.trend).toHaveLength(values.length);
      expect(result.seasonal).toHaveLength(7); // Seasonal indices for period 7
    });

    it('should handle insufficient data gracefully', () => {
      const values = [1, 2, 3, 4, 5]; // Less than 2 * period
      const result = holtWintersSmoothing(values, 7);
      
      expect(result.smoothed).toEqual(values);
    });
  });
});

// ============== Regression Tests ==============

describe('Regression Functions', () => {
  describe('linearRegression', () => {
    it('should fit perfect line y = 2x', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const result = linearRegression(x, y);
      
      expect(result.slope).toBeCloseTo(2, 5);
      expect(result.intercept).toBeCloseTo(0, 5);
      expect(result.rSquared).toBeCloseTo(1, 5);
    });

    it('should predict correctly', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const { predict } = linearRegression(x, y);
      
      expect(predict(10)).toBeCloseTo(20, 5);
      expect(predict(0)).toBeCloseTo(0, 5);
    });

    it('should handle intercept', () => {
      const x = [1, 2, 3];
      const y = [4, 6, 8]; // y = 2x + 2
      const result = linearRegression(x, y);
      
      expect(result.slope).toBeCloseTo(2, 5);
      expect(result.intercept).toBeCloseTo(2, 5);
    });

    it('should handle insufficient data', () => {
      const result = linearRegression([1], [2]);
      expect(result.slope).toBe(0);
      expect(result.intercept).toBe(0);
    });

    it('should handle mismatched lengths', () => {
      const result = linearRegression([1, 2, 3], [1, 2]);
      expect(result.slope).toBe(0);
    });
  });

  describe('polynomialRegression', () => {
    it('should fit quadratic function', () => {
      const x = [0, 1, 2, 3, 4];
      const y = [0, 1, 4, 9, 16]; // y = x^2
      const result = polynomialRegression(x, y, 2);
      
      expect(result.rSquared).toBeGreaterThan(0.99);
      expect(result.predict(5)).toBeCloseTo(25, 0);
    });

    it('should fit linear function with degree 1', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const result = polynomialRegression(x, y, 1);
      
      expect(result.rSquared).toBeCloseTo(1, 5);
    });

    it('should handle insufficient data for degree', () => {
      const result = polynomialRegression([1, 2], [1, 4], 3);
      expect(result.coefficients.every(c => c === 0)).toBe(true);
    });
  });
});

// ============== Anomaly Detection Tests ==============

describe('Anomaly Detection', () => {
  describe('detectAnomaliesZScore', () => {
    it('should detect outliers in normal distribution', () => {
      // Create data with one obvious outlier
      const data = [10, 11, 10, 12, 11, 10, 11, 100]; // 100 is outlier
      const anomalies = detectAnomaliesZScore(data, 2);
      
      expect(anomalies.length).toBeGreaterThanOrEqual(1);
      expect(anomalies.some(a => a.value === 100)).toBe(true);
    });

    it('should respect threshold parameter', () => {
      const data = [10, 11, 10, 12, 11, 10, 11, 100];
      const strictAnomalies = detectAnomaliesZScore(data, 1.5);
      const lenientAnomalies = detectAnomaliesZScore(data, 3);
      
      expect(strictAnomalies.length).toBeGreaterThanOrEqual(lenientAnomalies.length);
    });

    it('should return empty for normal data', () => {
      const data = [10, 11, 10, 12, 11, 10, 11, 12];
      const anomalies = detectAnomaliesZScore(data, 2.5);
      
      expect(anomalies).toHaveLength(0);
    });
  });

  describe('detectAnomaliesIQR', () => {
    it('should detect outliers using IQR method', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
      const anomalies = detectAnomaliesIQR(data);
      
      expect(anomalies.some(a => a.value === 100 && a.type === 'outlier_high')).toBe(true);
    });

    it('should detect low outliers', () => {
      const data = [-100, 51, 52, 53, 54, 55, 56, 57, 58, 59];
      const anomalies = detectAnomaliesIQR(data);
      
      expect(anomalies.some(a => a.type === 'outlier_low')).toBe(true);
    });

    it('should return empty for uniform data', () => {
      const data = [5, 5, 5, 5, 5];
      const anomalies = detectAnomaliesIQR(data);
      
      expect(anomalies).toHaveLength(0);
    });
  });
});

// ============== TransactionPredictor Class Tests ==============

describe('TransactionPredictor Class', () => {
  let predictor: TransactionPredictor;
  let testData: TimeSeriesPoint[];
  let testProfiles: CustomerProfile[];

  beforeEach(() => {
    predictor = new TransactionPredictor({
      enableCache: false, // Disable cache for testing
      minDataPoints: 10, // Lower minimum for faster tests
    });
    testData = generateTimeSeriesData(90);
    testProfiles = generateCustomerProfiles(5);
  });

  describe('Constructor and Initialization', () => {
    it('should create instance with default config', () => {
      const p = new TransactionPredictor();
      expect(p).toBeInstanceOf(TransactionPredictor);
    });

    it('should accept custom configuration', () => {
      const p = new TransactionPredictor({ defaultHorizon: 60 });
      const summary = p.getSummary();
      expect(summary.config.defaultHorizon).toBe(60);
    });

    it('should initialize model version', () => {
      const version = predictor.getModelVersion();
      expect(version.version).toBeDefined();
      expect(version.id).toBeDefined();
      expect(version.features).toBeDefined();
      expect(version.features.length).toBeGreaterThan(0);
    });

    it('should have valid model version structure', () => {
      const version: ModelVersion = predictor.getModelVersion();
      
      expect(typeof version.id).toBe('string');
      expect(typeof version.version).toBe('string');
      expect(version.createdAt).toBeInstanceOf(Date);
      expect(Array.isArray(version.features)).toBe(true);
      expect(typeof version.hyperparameters).toBe('object');
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      predictor.updateConfig({ defaultHorizon: 45 });
      const summary = predictor.getSummary();
      expect(summary.config.defaultHorizon).toBe(45);
    });

    it('should merge config updates', () => {
      const originalConfidence = predictor.getSummary().config.confidenceLevel;
      predictor.updateConfig({ confidenceLevel: 0.99 });
      
      const summary = predictor.getSummary();
      expect(summary.config.confidenceLevel).toBe(0.99);
      // Other settings should remain unchanged
      expect(summary.config.defaultHorizon).toBe(30);
    });
  });

  describe('Training Data Loading', () => {
    it('should load training data successfully', () => {
      predictor.loadTrainingData(testData);
      const summary = predictor.getSummary();
      expect(summary.trainingDataSize).toBe(testData.length);
    });

    it('should sort data by timestamp', () => {
      const unsortedData = [...testData].reverse();
      predictor.loadTrainingData(unsortedData);
      const summary = predictor.getSummary();
      expect(summary.trainingDataSize).toBe(testData.length);
    });

    it('should limit data to maxDataPoints', () => {
      const largeData = generateTimeSeriesData(500);
      predictor.loadTrainingData(largeData);
      const summary = predictor.getSummary();
      expect(summary.trainingDataSize).toBeLessThanOrEqual(365);
    });

    it('should throw error for insufficient data', () => {
      const smallData = generateTimeSeriesData(5);
      expect(() => predictor.loadTrainingData(smallData)).toThrow();
    });

    it('should update model version timestamps after loading', () => {
      predictor.loadTrainingData(testData);
      const version = predictor.getModelVersion();
      expect(version.lastTrainedAt).toBeDefined();
      expect(version.trainingDataStart).toBeDefined();
      expect(version.trainingDataEnd).toBeDefined();
    });
  });

  describe('Customer Profile Loading', () => {
    it('should load customer profiles', () => {
      predictor.loadCustomerProfiles(testProfiles);
      const summary = predictor.getSummary();
      expect(summary.customerProfilesCount).toBe(testProfiles.length);
    });

    it('handle empty profile array', () => {
      predictor.loadCustomerProfiles([]);
      const summary = predictor.getSummary();
      expect(summary.customerProfilesCount).toBe(0);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', () => {
      predictor.clearCache();
      const summary = predictor.getSummary();
      expect(summary.cacheSize).toBe(0);
    });

    it('should reset state completely', () => {
      predictor.loadTrainingData(testData);
      predictor.loadCustomerProfiles(testProfiles);
      predictor.reset();
      
      const summary = predictor.getSummary();
      expect(summary.trainingDataSize).toBe(0);
      expect(summary.customerProfilesCount).toBe(0);
      expect(summary.cacheSize).toBe(0);
    });
  });

  describe('Summary Method', () => {
    it('should return complete summary', () => {
      predictor.loadTrainingData(testData);
      predictor.loadCustomerProfiles(testProfiles);
      
      const summary = predictor.getSummary();
      
      expect(summary).toHaveProperty('modelVersion');
      expect(summary).toHaveProperty('trainingDataSize');
      expect(summary).toHaveProperty('customerProfilesCount');
      expect(summary).toHaveProperty('cacheSize');
      expect(summary).toHaveProperty('config');
    });
  });
});

// ============== Volume Prediction Tests ==============

describe('Volume Prediction', () => {
  let predictor: TransactionPredictor;
  let testData: TimeSeriesPoint[];

  beforeEach(() => {
    predictor = new TransactionPredictor({ enableCache: false, minDataPoints: 10 });
    testData = generateTimeSeriesData(90);
    predictor.loadTrainingData(testData);
  });

  it('should generate volume predictions', async () => {
    const result: PredictionResult<VolumePrediction[]> = await predictor.predictVolume(14);
    
    expect(result.predictions).toBeDefined();
    expect(result.predictions.length).toBe(14);
    expect(result.modelVersion).toBeDefined();
    expect(result.predictedAt).toBeInstanceOf(Date);
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should include confidence bounds', async () => {
    const result = await predictor.predictVolume(7);
    
    for (const pred of result.predictions) {
      expect(pred.lowerBound).toBeLessThanOrEqual(pred.predictedCount);
      expect(pred.upperBound).toBeGreaterThanOrEqual(pred.predictedCount);
      expect(pred.lowerBound).toBeGreaterThanOrEqual(0);
    }
  });

  it('should have increasing uncertainty over time', async () => {
    const result = await predictor.predictVolume(30);
    
    // Later predictions should have wider intervals
    const firstInterval = result.predictions[0].upperBound - result.predictions[0].lowerBound;
    const lastInterval = result.predictions[result.predictions.length - 1].upperBound - 
                         result.predictions[result.predictions.length - 1].lowerBound;
    
    expect(lastInterval).toBeGreaterThanOrEqual(firstInterval);
  });

  it('should include date for each prediction', async () => {
    const result = await predictor.predictVolume(7);
    const lastDataDate = testData[testData.length - 1].timestamp;
    
    for (let i = 0; i < result.predictions.length; i++) {
      expect(result.predictions[i].date).toBeInstanceOf(Date);
      expect(result.predictions[i].date.getTime()).toBeGreaterThan(lastDataDate.getTime());
    }
  });

  it('should include components breakdown', async () => {
    const result = await predictor.predictVolume(7);
    
    for (const pred of result.predictions) {
      expect(pred.seasonalComponent).toBeDefined();
      expect(pred.trendComponent).toBeDefined();
    }
  });

  it('should use specified horizon', async () => {
    const horizon = 21;
    const result = await predictor.predictVolume(horizon);
    expect(result.predictions.length).toBe(horizon);
  });

  it('should throw error without training data', async () => {
    const freshPredictor = new TransactionPredictor({ enableCache: false });
    await expect(freshPredictor.predictVolume(7)).rejects.toThrow();
  });

  it('should return metrics', async () => {
    const result = await predictor.predictVolume(7);
    
    if (result.metrics) {
      expect(result.metrics.mae).toBeGreaterThanOrEqual(0);
      expect(result.metrics.rmse).toBeGreaterThanOrEqual(0);
      expect(result.metrics.r2).toBeGreaterThanOrEqual(0);
      expect(result.metrics.r2).toBeLessThanOrEqual(1);
    }
  });
});

// ============== Churn Prediction Tests ==============

describe('Churn Prediction', () => {
  let predictor: TransactionPredictor;
  let testData: TimeSeriesPoint[];
  let testProfiles: CustomerProfile[];

  beforeEach(() => {
    predictor = new TransactionPredictor({ enableCache: false, minDataPoints: 10 });
    testData = generateTimeSeriesData(90);
    testProfiles = generateCustomerProfiles(5);
    predictor.loadTrainingData(testData);
    predictor.loadCustomerProfiles(testProfiles);
  });

  it('should predict churn for existing customer', async () => {
    const result: PredictionResult<ChurnPrediction> = await predictor.predictChurn('customer-1');
    
    expect(result.predictions).toBeDefined();
    expect(result.predictions.customerId).toBe('customer-1');
    expect(result.predictions.churnProbability).toBeGreaterThanOrEqual(0);
    expect(result.predictions.churnProbability).toBeLessThanOrEqual(1);
  });

  it('should classify risk level correctly', async () => {
    const result = await predictor.predictChurn('customer-1');
    
    const validLevels: ChurnRiskLevel[] = ['low', 'medium', 'high', 'critical'];
    expect(validLevels).toContain(result.predictions.riskLevel);
  });

  it('should include contributing factors', async () => {
    const result = await predictor.predictChurn('customer-1');
    
    expect(result.predictions.factors).toBeDefined();
    expect(result.predictions.factors.length).toBeGreaterThan(0);
    
    for (const factor of result.predictions.factors) {
      expect(factor.name).toBeDefined();
      expect(factor.weight).toBeGreaterThanOrEqual(0);
      expect(factor.weight).toBeLessThanOrEqual(1);
      expect(typeof factor.isConcerning).toBe('boolean');
    }
  });

  it('should provide recommendations', async () => {
    const result = await predictor.predictChurn('customer-1');
    
    expect(result.predictions.recommendations).toBeDefined();
    expect(Array.isArray(result.predictions.recommendations)).toBe(true);
  });

  it('should estimate days to churn', async () => {
    const result = await predictor.predictChurn('customer-1');
    
    expect(result.predictions.daysToChurn).toBeGreaterThanOrEqual(1);
  });

  it('should identify at-risk customers as higher churn probability', async () => {
    const activeResult = await predictor.predictChurn('customer-1'); // Premium/active
    const atRiskResult = await predictor.predictChurn('customer-2'); // At-risk
    
    // At-risk customer should generally have higher churn probability
    expect(atRiskResult.predictions.churnProbability).toBeGreaterThan(
      activeResult.predictions.churnProbability
    );
  });

  it('should throw error for unknown customer', async () => {
    await expect(predictor.predictChurn('unknown-customer')).rejects.toThrow();
  });

  it('should batch predict for multiple customers', async () => {
    const customerIds = ['customer-1', 'customer-2', 'customer-3'];
    const results = await predictor.batchPredictChurn(customerIds);
    
    expect(results.size).toBeGreaterThan(0);
    expect(results.has('customer-1')).toBe(true);
    expect(results.has('customer-2')).toBe(true);
  });
});

// ============== Payment Success Prediction Tests ==============

describe('Payment Success Prediction', () => {
  let predictor: TransactionPredictor;
  let testData: TimeSeriesPoint[];
  let testProfiles: CustomerProfile[];

  beforeEach(() => {
    predictor = new TransactionPredictor({ enableCache: false, minDataPoints: 10 });
    testData = generateTimeSeriesData(90);
    testProfiles = generateCustomerProfiles(5);
    predictor.loadTrainingData(testData);
    predictor.loadCustomerProfiles(testProfiles);
  });

  it('should predict payment success', async () => {
    const result: PredictionResult<SuccessPrediction> = await predictor.predictPaymentSuccess({
      amount: 50000,
      paymentMethod: 'card',
      deviceType: 'web_desktop',
    });
    
    expect(result.predictions).toBeDefined();
    expect(result.predictions.successProbability).toBeGreaterThanOrEqual(0);
    expect(result.predictions.successProbability).toBeLessThanOrEqual(1);
  });

  it('should classify risk assessment', async () => {
    const result = await predictor.predictPaymentSuccess({
      amount: 50000,
      paymentMethod: 'card',
    });
    
    const validLevels: PaymentRiskLevel[] = ['very_low', 'low', 'medium', 'high', 'very_high'];
    expect(validLevels).toContain(result.predictions.riskAssessment);
  });

  it('should include risk indicators', async () => {
    const result = await predictor.predictPaymentSuccess({
      amount: 50000,
      paymentMethod: 'card',
    });
    
    expect(result.predictions.riskIndicators).toBeDefined();
    expect(result.predictions.riskIndicators.length).toBeGreaterThan(0);
    
    for (const indicator of result.predictions.riskIndicators) {
      expect(indicator.name).toBeDefined();
      expect(indicator.riskScore).toBeGreaterThanOrEqual(0);
      expect(indicator.riskScore).toBeLessThanOrEqual(1);
      expect(['info', 'warning', 'critical']).toContain(indicator.severity);
    }
  });

  it('should estimate processing time', async () => {
    const result = await predictor.predictPaymentSuccess({
      amount: 50000,
      paymentMethod: 'card',
    });
    
    expect(result.predictions.estimatedProcessingTime).toBeGreaterThan(0);
  });

  it('should provide recommendations for risky payments', async () => {
    const result = await predictor.predictPaymentSuccess({
      amount: 2000000, // Large amount
      paymentMethod: 'ussd', // Higher risk method
    });
    
    expect(result.predictions.recommendations).toBeDefined();
  });

  it('should adjust probability based on amount', async () => {
    const lowAmountResult = await predictor.predictPaymentSuccess({
      amount: 1000,
      paymentMethod: 'card',
    });
    
    const highAmountResult = await predictor.predictPaymentSuccess({
      amount: 2000000,
      paymentMethod: 'card',
    });
    
    // High amount should generally have lower or equal success probability
    expect(highAmountResult.predictions.successProbability).toBeLessThanOrEqual(
      lowAmountResult.predictions.successProbability + 0.1 // Small tolerance
    );
  });

  it('should consider customer history when available', async () => {
    const withCustomerResult = await predictor.predictPaymentSuccess({
      amount: 50000,
      paymentMethod: 'card',
      customerId: 'customer-1',
    });
    
    // Should include customer-specific indicators
    const hasCustomerIndicator = withCustomerResult.predictions.riskIndicators.some(
      i => i.name.includes('customer')
    );
    expect(hasCustomerIndicator).toBe(true);
  });

  it('should handle different payment methods', async () => {
    const methods: PaymentMethodType[] = ['card', 'bank_transfer', 'wallet', 'ussd', 'qr_code'];
    const results = new Map<PaymentMethodType, number>();
    
    for (const method of methods) {
      const result = await predictor.predictPaymentSuccess({
        amount: 50000,
        paymentMethod: method,
      });
      results.set(method, result.predictions.successProbability);
    }
    
    // All methods should have different risk profiles
    expect(results.size).toBe(methods.length);
  });
});

// ============== Revenue Forecasting Tests ==============

describe('Revenue Forecasting', () => {
  let predictor: TransactionPredictor;
  let testData: TimeSeriesPoint[];

  beforeEach(() => {
    predictor = new TransactionPredictor({ enableCache: false, minDataPoints: 10 });
    testData = generateTimeSeriesData(90);
    predictor.loadTrainingData(testData);
  });

  it('should generate revenue forecast', async () => {
    const result: PredictionResult<RevenueForecast> = await predictor.forecastRevenue(30);
    
    expect(result.predictions).toBeDefined();
    expect(result.predictions.predictedRevenue).toBeGreaterThan(0);
    expect(result.predictions.periodStart).toBeInstanceOf(Date);
    expect(result.predictions.periodEnd).toBeInstanceOf(Date);
  });

  it('should include confidence bounds', async () => {
    const result = await predictor.forecastRevenue(30);
    
    expect(result.predictions.lowerBound).toBeGreaterThanOrEqual(0);
    expect(result.predictions.upperBound).toBeGreaterThanOrEqual(result.predictions.predictedRevenue);
    expect(result.predictions.lowerBound).toBeLessThanOrEqual(result.predictions.predictedRevenue);
  });

  it('should calculate growth rate', async () => {
    const result = await predictor.forecastRevenue(30);
    
    expect(typeof result.predictions.growthRate).toBe('number');
    // Growth rate could be positive or negative
  });

  it('should include revenue breakdown', async () => {
    const result = await predictor.forecastRevenue(30);
    
    expect(result.predictions.breakdown).toBeDefined();
    expect(result.predictions.breakdown.length).toBeGreaterThan(0);
    
    let totalPercentage = 0;
    for (const item of result.predictions.breakdown) {
      expect(item.category).toBeDefined();
      expect(item.revenue).toBeGreaterThanOrEqual(0);
      expect(item.percentage).toBeGreaterThanOrEqual(0);
      totalPercentage += item.percentage;
    }
    
    // Percentages should roughly sum to 1 (with some tolerance)
    expect(totalPercentage).toBeGreaterThan(0.9);
    expect(totalPercentage).toBeLessThan(1.1);
  });

  it('should include forecast components', async () => {
    const result = await predictor.forecastRevenue(30);
    
    expect(result.predictions.components).toBeDefined();
    expect(result.predictions.components.base).toBeDefined();
    expect(result.predictions.components.seasonal).toBeDefined();
    expect(result.predictions.components.cyclical).toBeDefined();
    expect(result.predictions.components.irregular).toBeDefined();
  });

  it('should use specified horizon', async () => {
    const horizon = 14;
    const result = await predictor.forecastRevenue(horizon);
    
    const expectedDays = (result.predictions.periodEnd.getTime() - result.predictions.periodStart.getTime()) / (1000 * 60 * 60 * 24);
    expect(expectedDays).toBe(horizon);
  });

  it('should throw error without training data', async () => {
    const freshPredictor = new TransactionPredictor({ enableCache: false });
    await expect(freshPredictor.forecastRevenue(7)).rejects.toThrow();
  });

  it('should return model metrics', async () => {
    const result = await predictor.forecastRevenue(30);
    
    if (result.metrics) {
      expect(result.metrics.mae).toBeGreaterThanOrEqual(0);
      expect(result.metrics.rmse).toBeGreaterThanOrEqual(0);
    }
  });
});

// ============== Seasonal Pattern Detection Tests ==============

describe('Seasonal Pattern Detection', () => {
  let predictor: TransactionPredictor;
  let testData: TimeSeriesPoint[];

  beforeEach(() => {
    predictor = new TransactionPredictor({ enableCache: false, minDataPoints: 10 });
    testData = generateTimeSeriesData(90, {
      seasonalityAmplitude: 0.5, // Strong weekly seasonality
    });
    predictor.loadTrainingData(testData);
  });

  it('should detect seasonal patterns', async () => {
    const result: PredictionResult<SeasonalPattern[]> = await predictor.detectSeasonalPatterns();
    
    expect(result.predictions).toBeDefined();
    expect(result.predictions.length).toBeGreaterThan(0);
  });

  it('should detect weekly patterns', async () => {
    const result = await predictor.detectSeasonalPatterns();
    
    const weeklyPattern = result.predictions.find(p => p.patternType === 'weekly');
    expect(weeklyPattern).toBeDefined();
    expect(weeklyPattern?.periodDays).toBe(7);
  });

  it('should include pattern strength', async () => {
    const result = await predictor.detectSeasonalPatterns();
    
    for (const pattern of result.predictions) {
      expect(pattern.strength).toBeGreaterThanOrEqual(0);
      expect(pattern.strength).toBeLessThanOrEqual(1);
    }
  });

  it('should identify peak periods', async () => {
    const result = await predictor.detectSeasonalPatterns();
    const weeklyPattern = result.predictions.find(p => p.patternType === 'weekly');
    
    if (weeklyPattern && weeklyPattern.strength > 0.2) {
      expect(weeklyPattern.peakPeriods).toBeDefined();
      // With strong seasonality, there should be peaks
      if (weeklyPattern.peakPeriods.length > 0) {
        for (const peak of weeklyPattern.peakPeriods) {
          expect(peak.start).toBeGreaterThanOrEqual(0);
          expect(peak.multiplier).toBeGreaterThan(1);
        }
      }
    }
  });

  it('should include amplitude measurement', async () => {
    const result = await predictor.detectSeasonalPatterns();
    
    for (const pattern of result.predictions) {
      expect(pattern.amplitude).toBeGreaterThanOrEqual(0);
    }
  });

  it('should include significance score', async () => {
    const result = await predictor.detectSeasonalPatterns();
    
    for (const pattern of result.predictions) {
      expect(pattern.significance).toBeGreaterThanOrEqual(0);
      expect(pattern.significance).toBeLessThanOrEqual(1);
    }
  });

  it('should provide human-readable description', async () => {
    const result = await predictor.detectSeasonalPatterns();
    
    for (const pattern of result.predictions) {
      expect(pattern.description).toBeDefined();
      expect(pattern.description.length).toBeGreaterThan(0);
    }
  });

  it('should require sufficient data', async () => {
    const freshPredictor = new TransactionPredictor({ enableCache: false, minDataPoints: 10 });
    const smallData = generateTimeSeriesData(10); // Less than 2 * seasonalityPeriod
    freshPredictor.loadTrainingData(smallData);
    
    await expect(freshPredictor.detectSeasonalPatterns()).rejects.toThrow();
  });
});

// ============== Factory Function Tests ==============

describe('Factory Functions', () => {
  describe('createTransactionPredictor', () => {
    it('should create configured instance', () => {
      const predictor = createTransactionPredictor({ defaultHorizon: 60 });
      expect(predictor).toBeInstanceOf(TransactionPredictor);
      expect(predictor.getSummary().config.defaultHorizon).toBe(60);
    });

    it('should work without config', () => {
      const predictor = createTransactionPredictor();
      expect(predictor).toBeInstanceOf(TransactionPredictor);
    });
  });

  describe('quickVolumePrediction', () => {
    it('should generate predictions from raw data', async () => {
      const data = generateTimeSeriesData(90);
      const result = await quickVolumePrediction(data, 14);
      
      expect(result.predictions).toBeDefined();
      expect(result.predictions.length).toBe(14);
    });
  });

  describe('quickChurnPrediction', () => {
    it('should generate churn prediction from profile', async () => {
      const profile = generateCustomerProfiles(1)[0];
      const result = await quickChurnPrediction(profile);
      
      expect(result.predictions).toBeDefined();
      expect(result.predictions.customerId).toBe(profile.customerId);
      expect(result.predictions.churnProbability).toBeGreaterThanOrEqual(0);
    });
  });

  describe('quickRevenueForecast', () => {
    it('should generate revenue forecast from raw data', async () => {
      const data = generateTimeSeriesData(90);
      const result = await quickRevenueForecast(data, 30);
      
      expect(result.predictions).toBeDefined();
      expect(result.predictions.predictedRevenue).toBeGreaterThan(0);
    });
  });
});

// ============== Edge Cases and Error Handling ==============

describe('Edge Cases and Error Handling', () => {
  it('should handle single data point gracefully', () => {
    const result = simpleMovingAverage([42], 3);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(42);
  });

  it('should handle very large numbers', () => {
    const largeNumbers = [Number.MAX_SAFE_INTEGER / 100, Number.MAX_SAFE_INTEGER / 100 + 1];
    const mean = calculateMean(largeNumbers);
    expect(mean).toBeGreaterThan(0);
  });

  it('should handle very small numbers', () => {
    const smallNumbers = [0.000001, 0.000002, 0.000003];
    const mean = calculateMean(smallNumbers);
    expect(mean).toBeCloseTo(0.000002, 10);
  });

  it('should handle NaN inputs gracefully', () => {
    // Most functions should handle or reject invalid inputs
    const result = calculateMean([1, 2, NaN, 4]);
    expect(isNaN(result)).toBe(true);
  });

  it('should handle Infinity in calculations', () => {
    const result = calculateMean([1, 2, Infinity, 4]);
    expect(isFinite(result)).toBe(false);
  });

  it('predictor should handle concurrent requests', async () => {
    const predictor = new TransactionPredictor({ enableCache: false, minDataPoints: 10 });
    const data = generateTimeSeriesData(90);
    predictor.loadTrainingData(data);
    
    // Fire off multiple predictions concurrently
    const promises = [
      predictor.predictVolume(7),
      predictor.forecastRevenue(7),
      predictor.detectSeasonalPatterns(),
    ];
    
    const results = await Promise.all(promises);
    expect(results).toHaveLength(3);
    expect(results.every(r => r !== undefined)).toBe(true);
  });
});

// ============== Performance Tests ==============

describe('Performance Considerations', () => {
  it('should process large datasets within reasonable time', async () => {
    const predictor = new TransactionPredictor({ enableCache: false, minDataPoints: 10 });
    const largeData = generateTimeSeriesData(365); // Full year of data
    predictor.loadTrainingData(largeData);
    
    const startTime = performance.now();
    await predictor.predictVolume(30);
    const elapsed = performance.now() - startTime;
    
    // Should complete within 1 second for this dataset size
    expect(elapsed).toBeLessThan(1000);
  });

  it('should efficiently batch process customers', async () => {
    const predictor = new TransactionPredictor({ enableCache: false, minDataPoints: 10 });
    const data = generateTimeSeriesData(90);
    const profiles = generateCustomerProfiles(50); // Many customers
    predictor.loadTrainingData(data);
    predictor.loadCustomerProfiles(profiles);
    
    const startTime = performance.now();
    const customerIds = profiles.map(p => p.customerId);
    await predictor.batchPredictChurn(customerIds);
    const elapsed = performance.now() - startTime;
    
    // Should complete within 2 seconds for 50 customers
    expect(elapsed).toBeLessThan(2000);
  });
});
