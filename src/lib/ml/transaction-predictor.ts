/**
 * Machine Learning Transaction Prediction Module
 * Enterprise-grade ML module for SSM-Pay payment platform
 * 
 * @module ml/transaction-predictor
 * @description Comprehensive transaction analytics and prediction system including:
 * - Time series forecasting for transaction volumes
 * - Customer churn probability prediction
 * - Payment success rate estimation
 * - Revenue forecasting with confidence intervals
 * - Seasonal pattern detection and analysis
 * 
 * @version 2.1.0
 * @since 1.0.0
 * @author SSM-Pay ML Engineering Team
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Model Versioning & Configuration ==============

/**
 * Model version information for tracking and audit purposes
 */
export interface ModelVersion {
  /** Unique model identifier */
  id: string;
  /** Semantic version string */
  version: string;
  /** Model creation timestamp */
  createdAt: Date;
  /** Last training timestamp */
  lastTrainedAt?: Date;
  /** Training data period start */
  trainingDataStart?: Date;
  /** Training data period end */
  trainingDataEnd?: Date;
  /** Model performance metrics */
  metrics?: ModelMetrics;
  /** Feature set used in this version */
  features: string[];
  /** Hyperparameters used */
  hyperparameters: Record<string, number | string | boolean>;
}

/**
 * Model performance metrics for evaluation
 */
export interface ModelMetrics {
  /** Mean Absolute Error */
  mae: number;
  /** Mean Squared Error */
  mse: number;
  /** Root Mean Squared Error */
  rmse: number;
  /** Mean Absolute Percentage Error */
  mape: number;
  /** R-squared score */
  r2: number;
  /** Accuracy score (for classification) */
  accuracy?: number;
  /** Precision score */
  precision?: number;
  /** Recall score */
  recall?: number;
  /** F1 score */
  f1?: number;
  /** AUC-ROC score */
  aucRoc?: number;
}

/**
 * Global configuration for the prediction module
 */
export interface PredictionConfig {
  /** Enable/disable caching of predictions */
  enableCache: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL: number;
  /** Default forecast horizon (days) */
  defaultHorizon: number;
  /** Confidence level for intervals (0-1) */
  confidenceLevel: number;
  /** Minimum data points required for training */
  minDataPoints: number;
  /** Maximum data points to use */
  maxDataPoints: number;
  /** Enable anomaly detection in predictions */
  enableAnomalyDetection: boolean;
  /** Anomaly threshold (standard deviations) */
  anomalyThreshold: number;
  /** Smoothing factor for exponential smoothing (0-1) */
  smoothingFactor: number;
  /** Window size for moving averages */
  movingAverageWindow: number;
  /** Seasonality period (days) */
  seasonalityPeriod: number;
}

/** Default configuration values */
const DEFAULT_CONFIG: PredictionConfig = {
  enableCache: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  defaultHorizon: 30,
  confidenceLevel: 0.95,
  minDataPoints: 30,
  maxDataPoints: 365,
  enableAnomalyDetection: true,
  anomalyThreshold: 2.5,
  smoothingFactor: 0.3,
  movingAverageWindow: 7,
  seasonalityPeriod: 7, // Weekly seasonality
};

// ============== Core Data Interfaces ==============

/**
 * Raw transaction record from database
 */
export interface TransactionRecord {
  /** Unique transaction identifier */
  id: string;
  /** Transaction amount in minor units (e.g., kobo) */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Transaction timestamp */
  timestamp: Date;
  /** Customer unique identifier */
  customerId: string;
  /** Merchant identifier */
  merchantId: string;
  /** Payment method used */
  paymentMethod: PaymentMethodType;
  /** Transaction status */
  status: TransactionStatus;
  /** Error code if failed */
  errorCode?: string;
  /** Device type used */
  deviceType?: DeviceType;
  /** Country code of customer */
  countryCode?: string;
  /** Transaction category/metadata */
  category?: string;
  /** Processing time in milliseconds */
  processingTimeMs?: number;
}

/**
 * Supported payment methods
 */
export type PaymentMethodType = 
  | 'card'
  | 'bank_transfer'
  | 'wallet'
  | 'ussd'
  | 'qr_code'
  | 'pay_with_bank';

/**
 * Transaction status enumeration
 */
export type TransactionStatus = 
  | 'success'
  | 'failed'
  | 'pending'
  | 'cancelled'
  | 'refunded';

/**
 * Device types for transactions
 */
export type DeviceType = 
  | 'web_desktop'
  | 'web_mobile'
  | 'ios_app'
  | 'android_app'
  | 'api'
  | 'unknown';

/**
 * Aggregated transaction data point for time series
 */
export interface TimeSeriesPoint {
  /** Timestamp of aggregation period */
  timestamp: Date;
  /** Total transaction count */
  count: number;
  /** Total volume (sum of amounts) */
  volume: number;
  /** Average transaction value */
  averageAmount: number;
  /** Success count */
  successCount: number;
  /** Failed count */
  failedCount: number;
  /** Unique customers count */
  uniqueCustomers: number;
  /** Unique merchants count */
  uniqueMerchants: number;
}

/**
 * Customer profile for churn prediction
 */
export interface CustomerProfile {
  /** Customer unique identifier */
  customerId: string;
  /** Customer registration date */
  registrationDate: Date;
  /** Total transactions lifetime */
  totalTransactions: number;
  /** Total spend lifetime */
  totalSpend: number;
  /** Average transaction value */
  avgTransactionValue: number;
  /** Days since last transaction */
  daysSinceLastTransaction: number;
  /** Days since first transaction */
  daysSinceFirstTransaction: number;
  /** Transaction frequency (per month) */
  transactionFrequency: number;
  /** Most used payment method */
  preferredPaymentMethod: PaymentMethodType;
  /** Success rate (0-1) */
  successRate: number;
  /** Average processing time */
  avgProcessingTime: number;
  /** Number of failed transactions last 30 days */
  failedTransactions30d: number;
  /** Number of successful transactions last 30 days */
  successTransactions30d: number;
  /** Spend trend (-1 to 1, negative=declining) */
  spendTrend: number;
  /** Engagement score (0-100) */
  engagementScore: number;
  /** Customer tenure in days */
  tenureDays: number;
  /** Is premium customer */
  isPremium: boolean;
  /** Last transaction date */
  lastTransactionDate: Date;
  /** Preferred merchant IDs */
  preferredMerchantIds: string[];
  /** Geographic region */
  region?: string;
  /** Customer segment */
  segment?: CustomerSegment;
}

/**
 * Customer segmentation types
 */
export type CustomerSegment = 
  | 'new'
  | 'active'
  | 'at_risk'
  | 'churned'
  | 'premium'
  | 'inactive';

/**
 * Prediction result wrapper with metadata
 */
export interface PredictionResult<T> {
  /** The predicted value(s) */
  predictions: T;
  /** Model version used */
  modelVersion: string;
  /** Prediction timestamp */
  predictedAt: Date;
  /** Confidence score (0-1) */
  confidence: number;
  /** Lower bound of confidence interval */
  lowerBound?: T;
  /** Upper bound of confidence interval */
  upperBound?: T;
  /** Features used for prediction */
  featuresUsed: string[];
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Any warnings generated during prediction */
  warnings?: string[];
  /** Model metrics if available */
  metrics?: ModelMetrics;
}

/**
 * Volume prediction output structure
 */
export interface VolumePrediction {
  /** Predicted date */
  date: Date;
  /** Predicted transaction count */
  predictedCount: number;
  /** Lower confidence bound */
  lowerBound: number;
  /** Upper confidence bound */
  upperBound: number;
  /** Point estimate */
  pointEstimate: number;
  /** Seasonal component */
  seasonalComponent?: number;
  /** Trend component */
  trendComponent?: number;
}

/**
 * Churn prediction output
 */
export interface ChurnPrediction {
  /** Customer ID */
  customerId: string;
  /** Churn probability (0-1) */
  churnProbability: number;
  /** Risk level classification */
  riskLevel: ChurnRiskLevel;
  /** Key contributing factors */
  factors: ChurnFactor[];
  /** Recommended actions */
  recommendations: string[];
  /** Prediction horizon (days until likely churn) */
  daysToChurn: number;
}

/**
 * Churn risk levels
 */
export type ChurnRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Individual factor contributing to churn risk
 */
export interface ChurnFactor {
  /** Factor name */
  name: string;
  /** Impact weight (0-1) */
  weight: number;
  /** Current value */
  value: number;
  /** Threshold for concern */
  threshold: number;
  /** Is this factor above/below threshold? */
  isConcerning: boolean;
}

/**
 * Payment success prediction output
 */
export interface SuccessPrediction {
  /** Success probability (0-1) */
  successProbability: number;
  /** Risk assessment */
  riskAssessment: PaymentRiskLevel;
  /** Key risk indicators */
  riskIndicators: RiskIndicator[];
  /** Estimated processing time */
  estimatedProcessingTime: number;
  /** Recommended actions to improve success */
  recommendations: string[];
}

/**
 * Payment risk levels
 */
export type PaymentRiskLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

/**
 * Individual risk indicator for payments
 */
export interface RiskIndicator {
  /** Indicator name */
  name: string;
  /** Current value */
  value: number;
  /** Risk contribution (0-1) */
  riskScore: number;
  /** Severity level */
  severity: 'info' | 'warning' | 'critical';
  /** Description */
  description: string;
}

/**
 * Revenue forecast output
 */
export interface RevenueForecast {
  /** Forecast period start */
  periodStart: Date;
  /** Forecast period end */
  periodEnd: Date;
  /** Predicted revenue */
  predictedRevenue: number;
  /** Lower confidence bound */
  lowerBound: number;
  /** Upper confidence bound */
  upperBound: number;
  /** Growth rate vs previous period */
  growthRate: number;
  /** Breakdown by category */
  breakdown: RevenueBreakdown[];
  /** Forecast components */
  components: ForecastComponents;
}

/**
 * Revenue breakdown by dimension
 */
export interface RevenueBreakdown {
  /** Category/dimension name */
  category: string;
  /** Revenue amount */
  revenue: number;
  /** Percentage of total */
  percentage: number;
  /** Change from previous period */
  changePercent: number;
}

/**
 * Components of a forecast
 */
export interface ForecastComponents {
  /** Base/trend component */
  base: number;
  /** Seasonal component */
  seasonal: number;
  /** Cyclical component */
  cyclical: number;
  /** Irregular/residual component */
  irregular: number;
}

/**
 * Seasonal pattern detection result
 */
export interface SeasonalPattern {
  /** Detected pattern type */
  patternType: SeasonalPatternType;
  /** Period length (in days) */
  periodDays: number;
  /** Pattern strength (0-1) */
  strength: number;
  /** Peak periods within cycle */
  peakPeriods: PeriodRange[];
  /** Low periods within cycle */
  lowPeriods: PeriodRange[];
  /** Average amplitude */
  amplitude: number;
  /** Phase offset (days from reference) */
  phaseOffset: number;
  /** Statistical significance */
  significance: number;
  /** Pattern description */
  description: string;
}

/**
 * Types of seasonal patterns
 */
export type SeasonalPatternType = 
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'none'
  | 'mixed';

/**
 * Time range within a pattern cycle
 */
export interface PeriodRange {
  /** Start position in cycle (0-based) */
  start: number;
  /** End position in cycle */
  end: number;
  /** Average multiplier during this period */
  multiplier: number;
  /** Label for this period */
  label: string;
}

// ============== Statistical Utility Functions ==============

/**
 * Calculate mean of numeric array
 * @param values - Array of numbers
 * @returns Mean value
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 * @param values - Array of numbers
 * @returns Standard deviation (population)
 */
export function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length);
}

/**
 * Calculate variance
 * @param values - Array of numbers
 * @returns Variance
 */
export function calculateVariance(values: number[]): number {
  const stdDev = calculateStdDev(values);
  return stdDev * stdDev;
}

/**
 * Calculate median value
 * @param values - Array of numbers
 * @returns Median value
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate percentile
 * @param values - Array of numbers
 * @param percentile - Percentile to calculate (0-100)
 * @returns Value at given percentile
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}

/**
 * Calculate correlation coefficient (Pearson)
 * @param x - First array of numbers
 * @param y - Second array of numbers
 * @returns Correlation coefficient (-1 to 1)
 */
export function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  const meanX = calculateMean(x);
  const meanY = calculateMean(y);
  
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  
  const denominator = Math.sqrt(denomX * denomY);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculate coefficient of determination (R-squared)
 * @param actual - Actual values
 * @param predicted - Predicted values
 * @returns R-squared value (0-1)
 */
export function calculateRSquared(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length === 0) return 0;
  
  const meanActual = calculateMean(actual);
  const ssTot = actual.reduce((sum, val) => sum + Math.pow(val - meanActual, 2), 0);
  const ssRes = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  
  return ssTot === 0 ? 1 : 1 - (ssRes / ssTot);
}

/**
 * Normalize values to 0-1 range using min-max scaling
 * @param values - Array of numbers
 * @returns Normalized array and scaling parameters
 */
export function normalizeMinMax(
  values: number[]
): { normalized: number[]; min: number; max: number; scale: number } {
  if (values.length === 0) return { normalized: [], min: 0, max: 0, scale: 1 };
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const scale = max - min || 1;
  
  return {
    normalized: values.map(val => (val - min) / scale),
    min,
    max,
    scale,
  };
}

/**
 * Z-score normalization (standardization)
 * @param values - Array of numbers
 * @returns Standardized array and statistics
 */
export function standardizeZScore(
  values: number[]
): { standardized: number[]; mean: number; stdDev: number } {
  if (values.length === 0) return { standardized: [], mean: 0, stdDev: 1 };
  
  const mean = calculateMean(values);
  const stdDev = calculateStdDev(values) || 1;
  
  return {
    standardized: values.map(val => (val - mean) / stdDev),
    mean,
    stdDev,
  };
}

/**
 * Apply sigmoid activation function
 * @param x - Input value
 * @returns Sigmoid output (0-1)
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
}

/**
 * Apply ReLU activation function
 * @param x - Input value
 * @returns ReLU output
 */
export function relu(x: number): number {
  return Math.max(0, x);
}

/**
 * Calculate simple moving average
 * @param values - Time series data
 * @param window - Window size
 * @returns Moving averages array
 */
export function simpleMovingAverage(values: number[], window: number): number[] {
  if (window <= 0 || values.length === 0) return [];
  if (window >= values.length) return [calculateMean(values)];
  
  const result: number[] = [];
  for (let i = window - 1; i < values.length; i++) {
    const windowSlice = values.slice(i - window + 1, i + 1);
    result.push(calculateMean(windowSlice));
  }
  
  return result;
}

/**
 * Calculate weighted moving average
 * @param values - Time series data
 * @param weights - Weights for each position (most recent first or last based on order)
 * @returns Weighted moving averages array
 */
export function weightedMovingAverage(values: number[], weights: number[]): number[] {
  if (weights.length === 0 || values.length === 0) return [];
  const window = weights.length;
  if (values.length < window) return [calculateMean(values)];
  
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const result: number[] = [];
  
  for (let i = window - 1; i < values.length; i++) {
    const windowSlice = values.slice(i - window + 1, i + 1);
    let weightedSum = 0;
    for (let j = 0; j < window; j++) {
      weightedSum += windowSlice[j] * weights[j];
    }
    result.push(weightedSum / weightSum);
  }
  
  return result;
}

/**
 * Calculate exponential moving average
 * @param values - Time series data
 * @param alpha - Smoothing factor (0-1), higher = more responsive
 * @returns Exponential moving averages array
 */
export function exponentialMovingAverage(values: number[], alpha: number = 0.3): number[] {
  if (values.length === 0) return [];
  if (alpha <= 0 || alpha > 1) alpha = 0.3;
  
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(alpha * values[i] + (1 - alpha) * ema[i - 1]);
  }
  
  return ema;
}

/**
 * Apply double exponential smoothing (Holt's method)
 * @param values - Time series data
 * @param alpha - Level smoothing factor
 * @param beta - Trend smoothing factor
 * @returns Smoothed values and trend components
 */
export function doubleExponentialSmoothing(
  values: number[],
  alpha: number = 0.3,
  beta: number = 0.1
): { smoothed: number[]; trend: number[] } {
  if (values.length < 2) {
    return { smoothed: values.slice(), trend: new Array(values.length).fill(0) };
  }
  
  const smoothed: number[] = [values[0]];
  const trend: number[] = [values[1] - values[0]];
  const level: number[] = [values[0]];
  
  for (let i = 1; i < values.length; i++) {
    const prevLevel = level[i - 1];
    const prevTrend = trend[i - 1];
    
    const newLevel = alpha * values[i] + (1 - alpha) * (prevLevel + prevTrend);
    const newTrend = beta * (newLevel - prevLevel) + (1 - beta) * prevTrend;
    
    level.push(newLevel);
    trend.push(newTrend);
    smoothed.push(newLevel + newTrend);
  }
  
  return { smoothed, trend };
}

/**
 * Apply triple exponential smoothing (Holt-Winters)
 * @param values - Time series data
 * @param seasonLength - Length of seasonal cycle
 * @param alpha - Level smoothing factor
 * @param beta - Trend smoothing factor
 * @param gamma - Seasonal smoothing factor
 * @returns Smoothed values with seasonal components
 */
export function holtWintersSmoothing(
  values: number[],
  seasonLength: number = 7,
  alpha: number = 0.3,
  beta: number = 0.1,
  gamma: number = 0.1
): {
  smoothed: number[];
  level: number[];
  trend: number[];
  seasonal: number[];
} {
  if (values.length < seasonLength * 2) {
    logger.warn('Insufficient data for Holt-Winters smoothing', {
      event: 'ml.holt-warnings',
      metadata: { dataLength: values.length, requiredLength: seasonLength * 2 },
    });
    return {
      smoothed: values.slice(),
      level: values.slice(),
      trend: new Array(values.length).fill(0),
      seasonal: new Array(values.length).fill(0),
    };
  }
  
  // Initialize seasonal indices
  const seasonalIndices: number[] = [];
  for (let s = 0; s < seasonLength; s++) {
    const seasonValues: number[] = [];
    for (let i = s; i < values.length; i += seasonLength) {
      seasonValues.push(values[i]);
    }
    const seasonAvg = calculateMean(seasonValues);
    const globalAvg = calculateMean(values);
    seasonalIndices.push(globalAvg > 0 ? seasonAvg / globalAvg : 1);
  }
  
  // Initialize level and trend using first season
  let level = values[0] / seasonalIndices[0];
  const initialTrend =
    (calculateMean(values.slice(0, seasonLength)) -
      calculateMean(values.slice(seasonLength, seasonLength * 2))) /
    seasonLength;
  let trend = initialTrend;
  
  const levels: number[] = [level];
  const trends: number[] = [trend];
  const seasonal: number[] = seasonalIndices.slice();
  const smoothed: number[] = [];
  
  for (let i = 0; i < values.length; i++) {
    const s = i % seasonLength;
    
    if (i > 0) {
      // Update level, trend, and seasonal
      const newLevel =
        alpha * (values[i] / seasonal[s]) + (1 - alpha) * (level + trend);
      const newTrend =
        beta * (newLevel - level) + (1 - beta) * trend;
      const newSeasonal =
        gamma * (values[i] / newLevel) + (1 - gamma) * seasonal[s];
      
      level = newLevel;
      trend = newTrend;
      seasonal[s] = newSeasonal;
      
      levels.push(level);
      trends.push(trend);
    }
    
    smoothed.push((level + trend) * seasonal[s]);
  }
  
  return { smoothed, level: levels, trend: trends, seasonal };
}

/**
 * Perform linear regression
 * @param x - Independent variable values
 * @param y - Dependent variable values
 * @returns Regression coefficients and statistics
 */
export function linearRegression(x: number[], y: number[]): {
  slope: number;
  intercept: number;
  rSquared: number;
  standardError: number;
  predict: (x: number) => number;
} {
  if (x.length !== y.length || x.length < 2) {
    return {
      slope: 0,
      intercept: 0,
      rSquared: 0,
      standardError: 0,
      predict: (val: number) => 0,
    };
  }
  
  const n = x.length;
  const meanX = calculateMean(x);
  const meanY = calculateMean(y);
  
  let sumXY = 0;
  let sumXX = 0;
  
  for (let i = 0; i < n; i++) {
    sumXY += (x[i] - meanX) * (y[i] - meanY);
    sumXX += (x[i] - meanX) * (x[i] - meanX);
  }
  
  const slope = sumXX === 0 ? 0 : sumXY / sumXX;
  const intercept = meanY - slope * meanX;
  
  // Calculate R-squared
  const predicted = x.map(xi => slope * xi + intercept);
  const rSquared = calculateRSquared(y, predicted);
  
  // Calculate standard error
  const residuals = y.map((yi, i) => yi - predicted[i]);
  const mse = residuals.reduce((sum, r) => sum + r * r, 0) / (n - 2);
  const standardError = Math.sqrt(mse);
  
  return {
    slope,
    intercept,
    rSquared,
    standardError,
    predict: (val: number) => slope * val + intercept,
  };
}

/**
 * Perform polynomial regression
 * @param x - Independent variable values
 * @param y - Dependent variable values
 * @param degree - Polynomial degree
 * @returns Coefficients and prediction function
 */
export function polynomialRegression(
  x: number[],
  y: number[],
  degree: number = 2
): {
  coefficients: number[];
  rSquared: number;
  predict: (x: number) => number;
} {
  if (x.length !== y.length || x.length <= degree) {
    return {
      coefficients: new Array(degree + 1).fill(0),
      rSquared: 0,
      predict: (_val: number) => 0,
    };
  }
  
  // Build Vandermonde matrix and solve using normal equations
  const n = x.length;
  const m = degree + 1;
  
  // Create design matrix X
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < m; j++) {
      row.push(Math.pow(x[i], j));
    }
    X.push(row);
  }
  
  // Compute X^T * X
  const XtX: number[][] = Array(m).fill(null).map(() => Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      for (let k = 0; k < n; k++) {
        XtX[i][j] += X[k][i] * X[k][j];
      }
    }
  }
  
  // Compute X^T * y
  const Xty: number[] = Array(m).fill(0);
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < n; k++) {
      Xty[i] += X[k][i] * y[k];
    }
  }
  
  // Solve system using Gaussian elimination (simplified)
  const coefficients = gaussianElimination(XtX, Xty);
  
  // Calculate R-squared
  const predicted = x.map(xi =>
    coefficients.reduce((sum, coef, j) => sum + coef * Math.pow(xi, j), 0)
  );
  const rSquared = calculateRSquared(y, predicted);
  
  return {
    coefficients,
    rSquared,
    predict: (val: number) =>
      coefficients.reduce((sum, coef, j) => sum + coef * Math.pow(val, j), 0),
  };
}

/**
 * Gaussian elimination for solving linear systems
 * @param matrix - Coefficient matrix
 * @param vector - Right-hand side vector
 * @returns Solution vector
 */
function gaussianElimination(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const aug = matrix.map((row, i) => [...row, vector[i]]);
  
  // Forward elimination
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }
    
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    
    if (Math.abs(aug[col][col]) < 1e-10) continue;
    
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }
  
  // Back substitution
  const solution = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    if (Math.abs(aug[row][row]) < 1e-10) {
      solution[row] = 0;
      continue;
    }
    solution[row] = aug[row][n];
    for (let col = row + 1; col < n; col++) {
      solution[row] -= aug[row][col] * solution[col];
    }
    solution[row] /= aug[row][row];
  }
  
  return solution;
}

/**
 * Detect anomalies using z-score method
 * @param values - Data series
 * @param threshold - Number of standard deviations
 * @returns Array of anomaly indices and scores
 */
export function detectAnomaliesZScore(
  values: number[],
  threshold: number = 2.5
): { index: number; value: number; zScore: number }[] {
  const { standardized, mean, stdDev } = standardizeZScore(values);
  const anomalies: { index: number; value: number; zScore: number }[] = [];
  
  for (let i = 0; i < standardized.length; i++) {
    if (Math.abs(standardized[i]) > threshold) {
      anomalies.push({
        index: i,
        value: values[i],
        zScore: standardized[i],
      });
    }
  }
  
  return anomalies;
}

/**
 * Detect anomalies using IQR method
 * @param values - Data series
 * @param multiplier - IQR multiplier (typically 1.5)
 * @returns Anomaly indices and values
 */
export function detectAnomaliesIQR(
  values: number[],
  multiplier: number = 1.5
): { index: number; value: number; type: 'outlier_high' | 'outlier_low' }[] {
  if (values.length === 0) return [];
  
  const q1 = calculatePercentile(values, 25);
  const q3 = calculatePercentile(values, 75);
  const iqr = q3 - q1;
  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;
  
  const anomalies: { index: number; value: number; type: 'outlier_high' | 'outlier_low' }[] = [];
  
  for (let i = 0; i < values.length; i++) {
    if (values[i] < lowerBound) {
      anomalies.push({ index: i, value: values[i], type: 'outlier_low' });
    } else if (values[i] > upperBound) {
      anomalies.push({ index: i, value: values[i], type: 'outlier_high' });
    }
  }
  
  return anomalies;
}

// ============== Main Prediction Class ==============

/**
 * Parameters for payment success prediction
 */
export interface PaymentSuccessParams {
  /** Transaction amount */
  amount: number;
  /** Payment method */
  paymentMethod: PaymentMethodType;
  /** Customer ID (optional for guest checkouts) */
  customerId?: string;
  /** Currency code */
  currency?: string;
  /** Device type */
  deviceType?: DeviceType;
  /** Country code */
  countryCode?: string;
  /** Is this a new customer? */
  isNewCustomer?: boolean;
  /** Time of day (0-23) */
  hourOfDay?: number;
  /** Day of week (0-6, Sunday=0) */
  dayOfWeek?: number;
}

/**
 * Transaction Predictor Class
 * Main entry point for all ML prediction operations
 */
export class TransactionPredictor {
  private config: PredictionConfig;
  private modelVersion: ModelVersion;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private trainingData: TimeSeriesPoint[] = [];
  private customerProfiles: Map<string, CustomerProfile> = new Map();

  /**
   * Create a new TransactionPredictor instance
   * @param config - Optional configuration overrides
   */
  constructor(config?: Partial<PredictionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.modelVersion = this.initializeModelVersion();
    
    logger.info('TransactionPredictor initialized', {
      event: 'ml.predictor.init',
      metadata: {
        version: this.modelVersion.version,
        config: this.config,
      },
    });
  }

  /**
   * Initialize model version metadata
   * @private
   */
  private initializeModelVersion(): ModelVersion {
    return {
      id: `tx-predictor-v${Date.now()}`,
      version: '2.1.0',
      createdAt: new Date(),
      features: [
        'transaction_count',
        'transaction_volume',
        'avg_amount',
        'success_rate',
        'customer_frequency',
        'time_features',
        'seasonal_components',
        'trend_indicators',
      ],
      hyperparameters: {
        smoothingFactor: DEFAULT_CONFIG.smoothingFactor,
        movingAverageWindow: DEFAULT_CONFIG.movingAverageWindow,
        seasonalityPeriod: DEFAULT_CONFIG.seasonalityPeriod,
        confidenceLevel: DEFAULT_CONFIG.confidenceLevel,
        anomalyThreshold: DEFAULT_CONFIG.anomalyThreshold,
      },
    };
  }

  /**
   * Get current model version info
   * @returns Model version object
   */
  getModelVersion(): ModelVersion {
    return { ...this.modelVersion };
  }

  /**
   * Update configuration
   * @param updates - Configuration updates to apply
   */
  updateConfig(updates: Partial<PredictionConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('Configuration updated', {
      event: 'ml.predictor.config-update',
      metadata: { updates },
    });
  }

  /**
   * Load training data for the predictor
   * @param data - Time series data points
   */
  loadTrainingData(data: TimeSeriesPoint[]): void {
    if (data.length < this.config.minDataPoints) {
      throw new AppError(
        `Insufficient training data: ${data.length} points provided, minimum ${this.config.minDataPoints} required`,
        ErrorCode.VALIDATION_ERROR,
        { severity: 'warning' }
      );
    }
    
    // Sort by timestamp and limit size
    this.trainingData = data
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(-this.config.maxDataPoints);
    
    this.modelVersion.trainingDataStart = this.trainingData[0]?.timestamp;
    this.modelVersion.trainingDataEnd = this.trainingData[this.trainingData.length - 1]?.timestamp;
    this.modelVersion.lastTrainedAt = new Date();
    
    logger.info('Training data loaded', {
      event: 'ml.predictor.data-loaded',
      metadata: {
        dataPoints: this.trainingData.length,
        dateRange: {
          from: this.modelVersion.trainingDataStart?.toISOString(),
          to: this.modelVersion.trainingDataEnd?.toISOString(),
        },
      },
    });
  }

  /**
   * Load customer profiles for churn prediction
   * @param profiles - Array of customer profiles
   */
  loadCustomerProfiles(profiles: CustomerProfile[]): void {
    for (const profile of profiles) {
      this.customerProfiles.set(profile.customerId, profile);
    }
    
    logger.info('Customer profiles loaded', {
      event: 'ml.predictor.profiles-loaded',
      metadata: { count: profiles.length },
    });
  }

  // ============== Cache Management ==============

  /**
   * Generate cache key from inputs
   * @private
   */
  private generateCacheKey(prefix: string, ...args: unknown[]): string {
    return `${prefix}:${JSON.stringify(args)}`;
  }

  /**
   * Get cached result if valid
   * @private
   */
  private getCached<T>(key: string): T | null {
    if (!this.config.enableCache) return null;
    
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.config.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  /**
   * Store result in cache
   * @private
   */
  private setCache<T>(key: string, data: T): void {
    if (!this.config.enableCache) return;
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear all cached predictions
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Prediction cache cleared', { event: 'ml.predictor.cache-cleared' });
  }

  // ============== Volume Prediction ==============

  /**
   * Predict future transaction volumes using time series forecasting
   * @param horizon - Number of days to forecast
   * @returns Prediction result with daily forecasts
   */
  async predictVolume(horizon: number = this.config.defaultHorizon): Promise<PredictionResult<VolumePrediction[]>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('volume', horizon);
    
    const cached = this.getCached<PredictionResult<VolumePrediction[]>>(cacheKey);
    if (cached) return cached;

    if (this.trainingData.length < this.config.minDataPoints) {
      throw new AppError(
        'Insufficient training data for volume prediction',
        ErrorCode.VALIDATION_ERROR,
        { severity: 'error', context: { required: this.config.minDataPoints, available: this.trainingData.length } }
      );
    }

    try {
      const counts = this.trainingData.map(d => d.count);
      const volumes = this.trainingData.map(d => d.volume);
      
      // Apply Holt-Winters for seasonal forecasting
      const hwCounts = holtWintersSmoothing(counts, this.config.seasonalityPeriod);
      const hwVolumes = holtWintersSmoothing(volumes, this.config.seasonalityPeriod);
      
      // Get trend from double exponential smoothing
      const deCounts = doubleExponentialSmoothing(counts);
      const deVolumes = doubleExponentialSmoothing(volumes);
      
      // Calculate seasonal indices
      const seasonalIndices = this.calculateSeasonalIndices(counts);
      
      // Generate forecasts
      const predictions: VolumePrediction[] = [];
      const lastDate = this.trainingData[this.trainingData.length - 1].timestamp;
      const lastLevel = hwCounts.level[hwCounts.level.length - 1];
      const lastTrend = hwCounts.trend[hwCounts.trend.length - 1];
      
      // Calculate prediction interval width based on historical error
      const residuals = counts.map((c, i) => c - (hwCounts.smoothed[i] || c));
      const residualStd = calculateStdDev(residuals);
      const zValue = this.getZValue(this.config.confidenceLevel);
      
      for (let i = 1; i <= horizon; i++) {
        const forecastDate = new Date(lastDate);
        forecastDate.setDate(forecastDate.getDate() + i);
        
        const seasonalIndex = seasonalIndices[(this.trainingData.length + i - 1) % seasonalIndices.length];
        const trendComponent = lastTrend * i;
        const baseForecast = (lastLevel + trendComponent) * seasonalIndex;
        
        // Widen confidence intervals further into the future
        const uncertaintyMultiplier = Math.sqrt(i);
        const intervalWidth = zValue * residualStd * uncertaintyMultiplier;
        
        predictions.push({
          date: forecastDate,
          predictedCount: Math.round(Math.max(0, baseForecast)),
          lowerBound: Math.round(Math.max(0, baseForecast - intervalWidth)),
          upperBound: Math.round(baseForecast + intervalWidth),
          pointEstimate: Math.round(Math.max(0, baseForecast)),
          seasonalComponent: seasonalIndex,
          trendComponent: trendComponent,
        });
      }
      
      // Calculate model metrics
      const fittedValues = hwCounts.smoothed.slice(-counts.length);
      const metrics = this.calculateMetrics(counts, fittedValues);
      
      const result: PredictionResult<VolumePrediction[]> = {
        predictions,
        modelVersion: this.modelVersion.version,
        predictedAt: new Date(),
        confidence: this.config.confidenceLevel,
        featuresUsed: ['count', 'volume', 'seasonal_indices', 'trend'],
        processingTimeMs: Date.now() - startTime,
        metrics,
      };
      
      this.setCache(cacheKey, result);
      
      logger.info('Volume prediction completed', {
        event: 'ml.predictor.volume-complete',
        metadata: {
          horizon,
          processingTimeMs: result.processingTimeMs,
          firstPrediction: predictions[0]?.predictedCount,
          lastPrediction: predictions[predictions.length - 1]?.predictedCount,
        },
      });
      
      return result;
    } catch (error) {
      logger.error('Volume prediction failed', {
        event: 'ml.predictor.volume-error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error instanceof AppError ? error : new AppError(
        'Failed to generate volume prediction',
        ErrorCode.UNKNOWN_ERROR,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Calculate seasonal indices from historical data
   * @private
   */
  private calculateSeasonalIndices(values: number[]): number[] {
    const period = this.config.seasonalityPeriod;
    const indices: number[] = [];
    const overallMean = calculateMean(values);
    
    if (overallMean === 0) return new Array(period).fill(1);
    
    for (let s = 0; s < period; s++) {
      const seasonValues: number[] = [];
      for (let i = s; i < values.length; i += period) {
        seasonValues.push(values[i]);
      }
      indices.push(calculateMean(seasonValues) / overallMean);
    }
    
    return indices;
  }

  /**
   * Get Z-value for confidence level
   * @private
   */
  private getZValue(confidence: number): number {
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };
    // Find closest match or interpolate
    const keys = Object.keys(zScores).map(Number).sort((a, b) => a - b);
    for (const key of keys) {
      if (confidence <= key) return zScores[key];
    }
    return 1.96; // Default to 95%
  }

  // ============== Churn Prediction ==============

  /**
   * Predict customer churn probability
   * @param customerId - Customer ID to analyze
   * @returns Churn prediction with risk factors
   */
  async predictChurn(customerId: string): Promise<PredictionResult<ChurnPrediction>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('churn', customerId);
    
    const cached = this.getCached<PredictionResult<ChurnPrediction>>(cacheKey);
    if (cached) return cached;

    const profile = this.customerProfiles.get(customerId);
    
    if (!profile) {
      throw new AppError(
        `Customer profile not found: ${customerId}`,
        ErrorCode.VALIDATION_ERROR,
        { severity: 'warning', context: { customerId } }
      );
    }

    try {
      // Calculate churn probability using logistic regression-like scoring
      const factors = this.calculateChurnFactors(profile);
      const churnProbability = this.calculateLogisticScore(factors);
      
      // Determine risk level
      const riskLevel = this.classifyChurnRisk(churnProbability);
      
      // Estimate days until churn
      const daysToChurn = this.estimateDaysToChurn(profile, churnProbability);
      
      // Generate recommendations
      const recommendations = this.generateChurnRecommendations(profile, factors, riskLevel);
      
      const prediction: ChurnPrediction = {
        customerId,
        churnProbability,
        riskLevel,
        factors,
        recommendations,
        daysToChurn,
      };
      
      const result: PredictionResult<ChurnPrediction> = {
        predictions: prediction,
        modelVersion: this.modelVersion.version,
        predictedAt: new Date(),
        confidence: this.calculatePredictionConfidence(factors),
        featuresUsed: factors.map(f => f.name),
        processingTimeMs: Date.now() - startTime,
      };
      
      this.setCache(cacheKey, result);
      
      logger.info('Churn prediction completed', {
        event: 'ml.predictor.churn-complete',
        metadata: {
          customerId,
          churnProbability,
          riskLevel,
          processingTimeMs: result.processingTimeMs,
        },
      });
      
      return result;
    } catch (error) {
      logger.error('Churn prediction failed', {
        event: 'ml.predictor.churn-error',
        metadata: { customerId },
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error instanceof AppError ? error : new AppError(
        'Failed to generate churn prediction',
        ErrorCode.UNKNOWN_ERROR,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Calculate individual churn factors
   * @private
   */
  private calculateChurnFactors(profile: CustomerProfile): ChurnFactor[] {
    const factors: ChurnFactor[] = [];
    
    // Recency factor - most important
    factors.push({
      name: 'recency',
      weight: 0.25,
      value: profile.daysSinceLastTransaction,
      threshold: 30,
      isConcerning: profile.daysSinceLastTransaction > 30,
    });
    
    // Frequency factor
    factors.push({
      name: 'frequency',
      weight: 0.20,
      value: profile.transactionFrequency,
      threshold: 2,
      isConcerning: profile.transactionFrequency < 2,
    });
    
    // Engagement score
    factors.push({
      name: 'engagement',
      weight: 0.15,
      value: profile.engagementScore,
      threshold: 40,
      isConcerning: profile.engagementScore < 40,
    });
    
    // Success rate
    factors.push({
      name: 'success_rate',
      weight: 0.15,
      value: profile.successRate,
      threshold: 0.8,
      isConcerning: profile.successRate < 0.8,
    });
    
    // Spend trend
    factors.push({
      name: 'spend_trend',
      weight: 0.15,
      value: profile.spendTrend,
      threshold: -0.2,
      isConcerning: profile.spendTrend < -0.2,
    });
    
    // Recent failures
    factors.push({
      name: 'recent_failures',
      weight: 0.10,
      value: profile.failedTransactions30d,
      threshold: 3,
      isConcerning: profile.failedTransactions30d > 3,
    });
    
    return factors;
  }

  /**
   * Calculate logistic-style churn score
   * @private
   */
  private calculateLogisticScore(factors: ChurnFactor[]): number {
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const factor of factors) {
      // Normalize factor value to 0-1 range based on whether concerning
      const normalizedValue = factor.isConcerning ? 1 : 0.3;
      weightedSum += factor.weight * normalizedValue;
      totalWeight += factor.weight;
    }
    
    const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    // Apply sigmoid to get probability
    // Shift to make moderate scores map to reasonable probabilities
    return sigmoid((rawScore - 0.4) * 10);
  }

  /**
   * Classify churn risk level
   * @private
   */
  private classifyChurnRisk(probability: number): ChurnRiskLevel {
    if (probability >= 0.8) return 'critical';
    if (probability >= 0.6) return 'high';
    if (probability >= 0.35) return 'medium';
    return 'low';
  }

  /**
   * Estimate days until likely churn
   * @private
   */
  private estimateDaysToChurn(profile: CustomerProfile, churnProb: number): number {
    // Base estimate on recency and probability
    const baseDays = profile.daysSinceLastTransaction;
    const probAdjustment = Math.round((1 - churnProb) * 60); // Higher prob = sooner
    
    return Math.max(1, Math.min(baseDays, baseDays + 30 - probAdjustment));
  }

  /**
   * Generate churn prevention recommendations
   * @private
   */
  private generateChurnRecommendations(
    profile: CustomerProfile,
    factors: ChurnFactor[],
    riskLevel: ChurnRiskLevel
  ): string[] {
    const recommendations: string[] = [];
    
    for (const factor of factors) {
      if (!factor.isConcerning) continue;
      
      switch (factor.name) {
        case 'recency':
          recommendations.push('Send re-engagement email or push notification');
          recommendations.push('Offer time-limited incentive for next transaction');
          break;
        case 'frequency':
          recommendations.push('Introduce loyalty program benefits');
          recommendations.push('Create usage reminders or tips');
          break;
        case 'engagement':
          recommendations.push('Personalize user experience based on preferences');
          recommendations.push('Reach out for feedback on improving experience');
          break;
        case 'success_rate':
          recommendations.push('Review and address common failure reasons');
          recommendations.push('Offer alternative payment methods');
          break;
        case 'spend_trend':
          recommendations.push('Analyze competitive offerings');
          recommendations.push('Consider targeted discount or promotion');
          break;
        case 'recent_failures':
          recommendations.push('Investigate recent transaction failures');
          recommendations.push('Proactively reach out to resolve issues');
          break;
      }
    }
    
    // Add risk-level specific recommendations
    switch (riskLevel) {
      case 'critical':
        recommendations.unshift('Immediate intervention required - assign account manager');
        break;
      case 'high':
        recommendations.unshift('Schedule proactive outreach call');
        break;
      case 'medium':
        recommendations.push('Add to monitoring list for weekly review');
        break;
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Calculate prediction confidence based on factor quality
   * @private
   */
  private calculatePredictionConfidence(factors: ChurnFactor[]): number {
    // More concerning factors = higher confidence in prediction
    const concerningFactors = factors.filter(f => f.isConcerning).length;
    const baseConfidence = 0.7;
    const factorBonus = (concerningFactors / factors.length) * 0.25;
    
    return Math.min(0.95, baseConfidence + factorBonus);
  }

  // ============== Payment Success Prediction ==============

  /**
   * Predict probability of payment success
   * @param params - Payment parameters for prediction
   * @returns Success prediction with risk indicators
   */
  async predictPaymentSuccess(params: PaymentSuccessParams): Promise<PredictionResult<SuccessPrediction>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('success', params.amount, params.paymentMethod, params.customerId);
    
    const cached = this.getCached<PredictionResult<SuccessPrediction>>(cacheKey);
    if (cached) return cached;

    try {
      // Calculate risk indicators
      const indicators = this.calculateRiskIndicators(params);
      
      // Calculate base success rate from historical data
      const baseSuccessRate = this.calculateBaseSuccessRate(params);
      
      // Adjust based on risk indicators
      const riskAdjustment = this.calculateRiskAdjustment(indicators);
      const successProbability = Math.max(0.05, Math.min(0.99, baseSuccessRate - riskAdjustment));
      
      // Classify risk level
      const riskAssessment = this.classifyPaymentRisk(successProbability);
      
      // Estimate processing time
      const estimatedProcessingTime = this.estimateProcessingTime(params);
      
      // Generate recommendations
      const recommendations = this.generateSuccessRecommendations(indicators, riskAssessment);
      
      const prediction: SuccessPrediction = {
        successProbability,
        riskAssessment,
        riskIndicators: indicators,
        estimatedProcessingTime,
        recommendations,
      };
      
      const result: PredictionResult<SuccessPrediction> = {
        predictions: prediction,
        modelVersion: this.modelVersion.version,
        predictedAt: new Date(),
        confidence: this.calculateSuccessConfidence(indicators),
        featuresUsed: indicators.map(i => i.name),
        processingTimeMs: Date.now() - startTime,
      };
      
      this.setCache(cacheKey, result);
      
      logger.info('Payment success prediction completed', {
        event: 'ml.predictor.success-complete',
        metadata: {
          successProbability,
          riskAssessment,
          processingTimeMs: result.processingTimeMs,
        },
      });
      
      return result;
    } catch (error) {
      logger.error('Payment success prediction failed', {
        event: 'ml.predictor.success-error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error instanceof AppError ? error : new AppError(
        'Failed to generate success prediction',
        ErrorCode.UNKNOWN_ERROR,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Calculate individual risk indicators
   * @private
   */
  private calculateRiskIndicators(params: PaymentSuccessParams): RiskIndicator[] {
    const indicators: RiskIndicator[] = [];
    
    // Amount-based risk
    const amountRisk = this.calculateAmountRisk(params.amount);
    indicators.push(amountRisk);
    
    // Payment method risk
    const methodRisk = this.calculateMethodRisk(params.paymentMethod);
    indicators.push(methodRisk);
    
    // Customer history risk
    if (params.customerId) {
      const profile = this.customerProfiles.get(params.customerId);
      if (profile) {
        indicators.push({
          name: 'customer_success_rate',
          value: profile.successRate,
          riskScore: 1 - profile.successRate,
          severity: profile.successRate < 0.8 ? 'warning' : 'info',
          description: `Historical success rate: ${(profile.successRate * 100).toFixed(1)}%`,
        });
        
        indicators.push({
          name: 'customer_recency',
          value: profile.daysSinceLastTransaction,
          riskScore: Math.min(1, profile.daysSinceLastTransaction / 90),
          severity: profile.daysSinceLastTransaction > 60 ? 'warning' : 'info',
          description: `${profile.daysSinceLastTransaction} days since last transaction`,
        });
      } else {
        indicators.push({
          name: 'customer_history',
          value: 0,
          riskScore: 0.2,
          severity: 'info',
          description: 'New customer - limited history',
        });
      }
    }
    
    // Time-based risk
    if (params.hourOfDay !== undefined) {
      const timeRisk = this.calculateTimeRisk(params.hourOfDay, params.dayOfWeek ?? 0);
      indicators.push(timeRisk);
    }
    
    // Device risk
    if (params.deviceType) {
      const deviceRisk = this.calculateDeviceRisk(params.deviceType);
      indicators.push(deviceRisk);
    }
    
    return indicators;
  }

  /**
   * Calculate amount-based risk indicator
   * @private
   */
  private calculateAmountRisk(amount: number): RiskIndicator {
    // Define risk thresholds (in base currency minor units)
    const thresholds = [
      { limit: 10000, risk: 0.05 },     // Very low amounts
      { limit: 50000, risk: 0.1 },      // Low amounts
      { limit: 200000, risk: 0.15 },    // Medium amounts
      { limit: 500000, risk: 0.25 },    // High amounts
      { limit: 1000000, risk: 0.35 },   // Very high amounts
      { limit: Infinity, risk: 0.5 },   // Extreme amounts
    ];
    
    const threshold = thresholds.find(t => amount <= t.limit)!;
    const severity = threshold.risk > 0.3 ? 'critical' : threshold.risk > 0.15 ? 'warning' : 'info';
    
    return {
      name: 'amount_risk',
      value: amount,
      riskScore: threshold.risk,
      severity,
      description: `Amount ${this.formatCurrency(amount)} falls into ${severity} risk tier`,
    };
  }

  /**
   * Calculate payment method risk
   * @private
   */
  private calculateMethodRisk(method: PaymentMethodType): RiskIndicator {
    const methodRisks: Record<PaymentMethodType, { risk: number; description: string }> = {
      card: { risk: 0.08, description: 'Card payments have good reliability' },
      bank_transfer: { risk: 0.12, description: 'Bank transfers may have delays' },
      wallet: { risk: 0.06, description: 'Wallet payments are highly reliable' },
      ussd: { risk: 0.18, description: 'USSD has higher failure rates due to network issues' },
      qr_code: { risk: 0.1, description: 'QR code payments are generally reliable' },
      pay_with_bank: { risk: 0.15, description: 'Pay with bank depends on bank availability' },
    };
    
    const { risk, description } = methodRisks[method];
    const severity = risk > 0.15 ? 'warning' : 'info';
    
    return {
      name: 'payment_method_risk',
      value: 0,
      riskScore: risk,
      severity,
      description,
    };
  }

  /**
   * Calculate time-based risk
   * @private
   */
  private calculateTimeRisk(hourOfDay: number, dayOfWeek: number): RiskIndicator {
    // Business hours are typically safer
    const isBusinessHours = hourOfDay >= 8 && hourOfDay <= 18;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    let risk = 0.05; // Base low risk during business hours on weekdays
    
    if (!isBusinessHours) risk += 0.08;
    if (isWeekend) risk += 0.05;
    
    // Late night transactions have higher risk
    if (hourOfDay >= 0 && hourOfDay < 6) risk += 0.1;
    
    const severity = risk > 0.15 ? 'warning' : 'info';
    
    return {
      name: 'temporal_risk',
      value: hourOfDay,
      riskScore: Math.min(0.4, risk),
      severity,
      description: `Transaction at ${hourOfDay}:00 on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]}`,
    };
  }

  /**
   * Calculate device-based risk
   * @private
   */
  private calculateDeviceRisk(deviceType: DeviceType): RiskIndicator {
    const deviceRisks: Record<DeviceType, { risk: number; description: string }> = {
      web_desktop: { risk: 0.05, description: 'Desktop web is stable' },
      web_mobile: { risk: 0.08, description: 'Mobile web may have browser variations' },
      ios_app: { risk: 0.04, description: 'iOS app provides consistent experience' },
      android_app: { risk: 0.06, description: 'Android app is generally reliable' },
      api: { risk: 0.03, description: 'API calls are well-handled' },
      unknown: { risk: 0.12, description: 'Unknown device type adds uncertainty' },
    };
    
    const { risk, description } = deviceRisks[deviceType];
    
    return {
      name: 'device_risk',
      value: 0,
      riskScore: risk,
      severity: risk > 0.08 ? 'warning' : 'info',
      description,
    };
  }

  /**
   * Calculate base success rate from historical data
   * @private
   */
  private calculateBaseSuccessRate(params: PaymentSuccessParams): number {
    if (this.trainingData.length === 0) return 0.92; // Default high success rate
    
    // Calculate overall success rate from training data
    const totalSuccess = this.trainingData.reduce((sum, d) => sum + d.successCount, 0);
    const totalTxns = this.trainingData.reduce((sum, d) => sum + d.count, 0);
    
    return totalTxns > 0 ? totalSuccess / totalTxns : 0.92;
  }

  /**
   * Calculate cumulative risk adjustment
   * @private
   */
  private calculateRiskAdjustment(indicators: RiskIndicator[]): number {
    return indicators.reduce((sum, ind) => sum + ind.riskScore * 0.1, 0);
  }

  /**
   * Classify payment risk level
   * @private
   */
  private classifyPaymentRisk(probability: number): PaymentRiskLevel {
    if (probability >= 0.95) return 'very_low';
    if (probability >= 0.85) return 'low';
    if (probability >= 0.70) return 'medium';
    if (probability >= 0.50) return 'high';
    return 'very_high';
  }

  /**
   * Estimate processing time based on parameters
   * @private
   */
  private estimateProcessingTime(params: PaymentSuccessParams): number {
    // Base times by payment method (in milliseconds)
    const baseTimes: Record<PaymentMethodType, number> = {
      card: 3000,
      bank_transfer: 15000,
      wallet: 2000,
      ussd: 45000,
      qr_code: 4000,
      pay_with_bank: 12000,
    };
    
    let estimatedTime = baseTimes[params.paymentMethod] || 5000;
    
    // Adjust for amount (larger amounts may take longer for verification)
    if (params.amount > 500000) estimatedTime *= 1.3;
    if (params.amount > 1000000) estimatedTime *= 1.5;
    
    // Add randomness to simulate variance
    estimatedTime *= (0.9 + Math.random() * 0.2);
    
    return Math.round(estimatedTime);
  }

  /**
   * Generate recommendations to improve success rate
   * @private
   */
  private generateSuccessRecommendations(
    indicators: RiskIndicator[],
    riskLevel: PaymentRiskLevel
  ): string[] {
    const recommendations: string[] = [];
    
    for (const indicator of indicators) {
      if (indicator.severity !== 'critical' && indicator.severity !== 'warning') continue;
      
      switch (indicator.name) {
        case 'amount_risk':
          recommendations.push('Consider splitting large transactions');
          recommendations.push('Enable 3D Secure for added verification');
          break;
        case 'payment_method_risk':
          recommendations.push('Offer alternative payment methods at checkout');
          break;
        case 'customer_success_rate':
          recommendations.push('Pre-validate customer payment details');
          break;
        case 'temporal_risk':
          recommendations.push('Consider retry logic for off-hours transactions');
          break;
        case 'device_risk':
          recommendations.push('Ensure proper device fingerprinting');
          break;
      }
    }
    
    // Add general recommendations based on risk level
    if (riskLevel === 'high' || riskLevel === 'very_high') {
      recommendations.push('Implement real-time fraud screening');
      recommendations.push('Prepare manual review workflow');
    }
    
    return [...new Set(recommendations)];
  }

  /**
   * Calculate confidence in success prediction
   * @private
   */
  private calculateSuccessConfidence(indicators: RiskIndicator[]): number {
    const avgRisk = indicators.reduce((sum, i) => sum + i.riskScore, 0) / indicators.length;
    return Math.max(0.6, 1 - avgRisk);
  }

  // ============== Revenue Forecasting ==============

  /**
   * Forecast future revenue
   * @param horizon - Number of days to forecast
   * @returns Revenue forecast with breakdown
   */
  async forecastRevenue(horizon: number = this.config.defaultHorizon): Promise<PredictionResult<RevenueForecast>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('revenue', horizon);
    
    const cached = this.getCached<PredictionResult<RevenueForecast>>(cacheKey);
    if (cached) return cached;

    if (this.trainingData.length < this.config.minDataPoints) {
      throw new AppError(
        'Insufficient training data for revenue forecasting',
        ErrorCode.VALIDATION_ERROR,
        { severity: 'error' }
      );
    }

    try {
      const volumes = this.trainingData.map(d => d.volume);
      const counts = this.trainingData.map(d => d.count);
      
      // Apply forecasting methods
      const hwResult = holtWintersSmoothing(volumes, this.config.seasonalityPeriod);
      const deResult = doubleExponentialSmoothing(volumes);
      
      // Calculate components
      const lastIndex = volumes.length - 1;
      const baseComponent = hwResult.level[lastIndex] || calculateMean(volumes);
      const trendComponent = hwResult.trend[lastIndex] || 0;
      const seasonalComponent = hwResult.seasonal[0] || 1;
      
      // Calculate forecast values
      const forecastValues: number[] = [];
      for (let i = 1; i <= horizon; i++) {
        const seasonalIdx = (lastIndex + i) % this.config.seasonalityPeriod;
        const seasonal = hwResult.seasonal[seasonalIdx] || 1;
        forecastValues.push((baseComponent + trendComponent * i) * seasonal);
      }
      
      // Calculate confidence intervals
      const residuals = volumes.map((v, i) => v - (hwResult.smoothed[i] || v));
      const residualStd = calculateStdDev(residuals);
      const zValue = this.getZValue(this.config.confidenceLevel);
      
      const totalRevenue = forecastValues.reduce((a, b) => a + b, 0);
      const uncertainty = zValue * residualStd * Math.sqrt(horizon);
      
      // Calculate growth rate
      const prevPeriodRevenue = volumes.slice(-horizon).reduce((a, b) => a + b, 0);
      const growthRate = prevPeriodRevenue > 0 ? (totalRevenue - prevPeriodRevenue) / prevPeriodRevenue : 0;
      
      // Generate breakdown (simplified - would use categories in production)
      const breakdown: RevenueBreakdown[] = this.generateRevenueBreakdown(forecastValues);
      
      const forecast: RevenueForecast = {
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + horizon * 24 * 60 * 60 * 1000),
        predictedRevenue: Math.round(totalRevenue),
        lowerBound: Math.round(Math.max(0, totalRevenue - uncertainty)),
        upperBound: Math.round(totalRevenue + uncertainty),
        growthRate,
        breakdown,
        components: {
          base: baseComponent,
          seasonal: seasonalComponent,
          cyclical: trendComponent,
          irregular: residualStd,
        },
      };
      
      // Calculate metrics
      const fittedValues = hwResult.smoothed.slice(-volumes.length);
      const metrics = this.calculateMetrics(volumes, fittedValues);
      
      const result: PredictionResult<RevenueForecast> = {
        predictions: forecast,
        modelVersion: this.modelVersion.version,
        predictedAt: new Date(),
        confidence: this.config.confidenceLevel,
        featuresUsed: ['volume', 'seasonal', 'trend'],
        processingTimeMs: Date.now() - startTime,
        metrics,
      };
      
      this.setCache(cacheKey, result);
      
      logger.info('Revenue forecast completed', {
        event: 'ml.predictor.revenue-complete',
        metadata: {
          horizon,
          predictedRevenue: forecast.predictedRevenue,
          growthRate: forecast.growthRate,
          processingTimeMs: result.processingTimeMs,
        },
      });
      
      return result;
    } catch (error) {
      logger.error('Revenue forecasting failed', {
        event: 'ml.predictor.revenue-error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error instanceof AppError ? error : new AppError(
        'Failed to generate revenue forecast',
        ErrorCode.UNKNOWN_ERROR,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Generate revenue breakdown by category
   * @private
   */
  private generateRevenueBreakdown(forecastValues: number[]): RevenueBreakdown[] {
    // Simplified breakdown - in production, this would use actual category data
    const total = forecastValues.reduce((a, b) => a + b, 0);
    
    // Assume distribution based on typical patterns
    const categories = [
      { name: 'Card Payments', percentage: 0.45, changePercent: 0.05 },
      { name: 'Bank Transfers', percentage: 0.25, changePercent: -0.02 },
      { name: 'Wallet Payments', percentage: 0.15, changePercent: 0.12 },
      { name: 'USSD', percentage: 0.10, changePercent: -0.05 },
      { name: 'Other Methods', percentage: 0.05, changePercent: 0.03 },
    ];
    
    return categories.map(cat => ({
      category: cat.name,
      revenue: Math.round(total * cat.percentage),
      percentage: cat.percentage,
      changePercent: cat.changePercent,
    }));
  }

  // ============== Seasonal Pattern Detection ==============

  /**
   * Detect seasonal patterns in transaction data
   * @returns Detected seasonal patterns
   */
  async detectSeasonalPatterns(): Promise<PredictionResult<SeasonalPattern[]>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('seasonal');
    
    const cached = this.getCached<PredictionResult<SeasonalPattern[]>>(cacheKey);
    if (cached) return cached;

    if (this.trainingData.length < this.config.seasonalityPeriod * 2) {
      throw new AppError(
        'Insufficient data for seasonal pattern detection',
        ErrorCode.VALIDATION_ERROR,
        { severity: 'warning' }
      );
    }

    try {
      const patterns: SeasonalPattern[] = [];
      const counts = this.trainingData.map(d => d.count);
      
      // Detect weekly pattern
      const weeklyPattern = this.detectPatternForPeriod(counts, 7, 'weekly');
      patterns.push(weeklyPattern);
      
      // Detect monthly pattern (approximate with 30-day period)
      if (counts.length >= 60) {
        const monthlyPattern = this.detectPatternForPeriod(counts, 30, 'monthly');
        patterns.push(monthlyPattern);
      }
      
      // Determine dominant pattern
      const dominantPattern = patterns.reduce((max, p) => p.strength > max.strength ? p : max, patterns[0]);
      
      // If mixed patterns detected, add summary
      if (patterns.length > 1 && patterns.every(p => p.strength > 0.3)) {
        patterns.push({
          patternType: 'mixed',
          periodDays: 7,
          strength: Math.min(1, patterns.reduce((sum, p) => sum + p.strength, 0) / patterns.length),
          peakPeriods: dominantPattern.peakPeriods,
          lowPeriods: dominantPattern.lowPeriods,
          amplitude: dominantPattern.amplitude,
          phaseOffset: dominantPattern.phaseOffset,
          significance: Math.min(...patterns.map(p => p.significance)),
          description: `Multiple seasonal patterns detected: ${patterns.map(p => p.patternType).join(', ')}`,
        });
      }
      
      const result: PredictionResult<SeasonalPattern[]> = {
        predictions: patterns,
        modelVersion: this.modelVersion.version,
        predictedAt: new Date(),
        confidence: dominantPattern.strength,
        featuresUsed: ['count', 'timestamp'],
        processingTimeMs: Date.now() - startTime,
      };
      
      this.setCache(cacheKey, result);
      
      logger.info('Seasonal pattern detection completed', {
        event: 'ml.predictor.seasonal-complete',
        metadata: {
          patternsDetected: patterns.length,
          dominantPattern: dominantPattern.patternType,
          processingTimeMs: result.processingTimeMs,
        },
      });
      
      return result;
    } catch (error) {
      logger.error('Seasonal pattern detection failed', {
        event: 'ml.predictor.seasonal-error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error instanceof AppError ? error : new AppError(
        'Failed to detect seasonal patterns',
        ErrorCode.UNKNOWN_ERROR,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Detect pattern for a specific period
   * @private
   */
  private detectPatternForPeriod(
    values: number[],
    period: number,
    patternType: SeasonalPatternType
  ): SeasonalPattern {
    // Calculate seasonal indices for this period
    const indices: number[] = [];
    const overallMean = calculateMean(values);
    
    if (overallMean === 0) {
      return {
        patternType: 'none',
        periodDays: period,
        strength: 0,
        peakPeriods: [],
        lowPeriods: [],
        amplitude: 0,
        phaseOffset: 0,
        significance: 0,
        description: 'No significant pattern detected',
      };
    }
    
    for (let s = 0; s < period; s++) {
      const seasonValues: number[] = [];
      for (let i = s; i < values.length; i += period) {
        seasonValues.push(values[i]);
      }
      indices.push(calculateMean(seasonValues) / overallMean);
    }
    
    // Calculate pattern strength (coefficient of variation of indices)
    const indexMean = calculateMean(indices);
    const indexStd = calculateStdDev(indices);
    const strength = indexMean > 0 ? Math.min(1, indexStd / indexMean) : 0;
    
    // Find peaks and troughs
    const peakThreshold = 1 + indexStd * 0.5;
    const lowThreshold = 1 - indexStd * 0.5;
    
    const peakPeriods: PeriodRange[] = [];
    const lowPeriods: PeriodRange[] = [];
    
    let inPeak = false;
    let inLow = false;
    let peakStart = 0;
    let lowStart = 0;
    
    for (let i = 0; i < indices.length; i++) {
      if (indices[i] >= peakThreshold && !inPeak) {
        peakStart = i;
        inPeak = true;
      } else if (indices[i] < peakThreshold && inPeak) {
        peakPeriods.push({
          start: peakStart,
          end: i - 1,
          multiplier: calculateMean(indices.slice(peakStart, i)),
          label: this.getPeriodLabel(patternType, peakStart, i - 1),
        });
        inPeak = false;
      }
      
      if (indices[i] <= lowThreshold && !inLow) {
        lowStart = i;
        inLow = true;
      } else if (indices[i] > lowThreshold && inLow) {
        lowPeriods.push({
          start: lowStart,
          end: i - 1,
          multiplier: calculateMean(indices.slice(lowStart, i)),
          label: this.getPeriodLabel(patternType, lowStart, i - 1),
        });
        inLow = false;
      }
    }
    
    // Handle unclosed ranges
    if (inPeak) {
      peakPeriods.push({
        start: peakStart,
        end: indices.length - 1,
        multiplier: calculateMean(indices.slice(peakStart)),
        label: this.getPeriodLabel(patternType, peakStart, indices.length - 1),
      });
    }
    if (inLow) {
      lowPeriods.push({
        start: lowStart,
        end: indices.length - 1,
        multiplier: calculateMean(indices.slice(lowStart)),
        label: this.getPeriodLabel(patternType, lowStart, indices.length - 1),
      });
    }
    
    // Calculate amplitude
    const amplitude = Math.max(...indices) - Math.min(...indices);
    
    // Find phase offset (position of maximum)
    const maxIndex = indices.indexOf(Math.max(...indices));
    
    // Calculate statistical significance (simplified)
    const significance = this.calculateSeasonalSignificance(values, indices, period);
    
    return {
      patternType,
      periodDays: period,
      strength: Math.min(1, strength * 3), // Scale up for interpretability
      peakPeriods,
      lowPeriods,
      amplitude,
      phaseOffset: maxIndex,
      significance,
      description: this.generatePatternDescription(patternType, strength, peakPeriods, lowPeriods),
    };
  }

  /**
   * Get human-readable label for a period
   * @private
   */
  private getPeriodLabel(patternType: SeasonalPatternType, start: number, end: number): string {
    switch (patternType) {
      case 'weekly':
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        if (start === end) return days[start];
        return `${days[start]} - ${days[end]}`;
      case 'monthly':
        if (start < 7) return `Beginning of month (day ${start + 1}-${end + 1})`;
        if (start < 14) return `First half of month (day ${start + 1}-${end + 1})`;
        if (start < 21) return `Third week (day ${start + 1}-${end + 1})`;
        return `End of month (day ${start + 1}-${end + 1})`;
      default:
        return `Period ${start + 1} - ${end + 1}`;
    }
  }

  /**
   * Calculate statistical significance of seasonal pattern
   * @private
   */
  private calculateSeasonalSignificance(
    values: number[],
    indices: number[],
    period: number
  ): number {
    // Use ANOVA-like F-test approximation
    const overallMean = calculateMean(values);
    const betweenGroupVar = 0;
    const withinGroupVar = 0;
    
    // Simplified: compare seasonal variation to random variation
    const seasonalVariation = calculateStdDev(indices);
    const expectedRandomVariation = 1 / Math.sqrt(values.length / period);
    
    return Math.min(1, seasonalVariation / (expectedRandomVariation + 0.01));
  }

  /**
   * Generate human-readable pattern description
   * @private
   */
  private generatePatternDescription(
    patternType: SeasonalPatternType,
    strength: number,
    peaks: PeriodRange[],
    lows: PeriodRange[]
  ): string {
    if (strength < 0.2) return `No significant ${patternType} pattern detected`;
    
    const peakDesc = peaks.length > 0 
      ? `Peaks occur during: ${peaks.map(p => p.label).join(', ')}`
      : '';
    const lowDesc = lows.length > 0 
      ? `Low periods: ${lows.map(p => p.label).join(', ')}`
      : '';
    
    return [`Strong ${patternType} pattern detected (strength: ${(strength * 100).toFixed(0)}%)`, peakDesc, lowDesc]
      .filter(Boolean)
      .join('. ');
  }

  // ============== Utility Methods ==============

  /**
   * Format currency amount for display
   * @private
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100); // Assuming minor units
  }

  /**
   * Calculate model metrics
   * @private
   */
  private calculateMetrics(actual: number[], predicted: number[]): ModelMetrics {
    const n = actual.length;
    if (n === 0 || n !== predicted.length) {
      return {
        mae: 0,
        mse: 0,
        rmse: 0,
        mape: 0,
        r2: 0,
      };
    }
    
    let sumAbsError = 0;
    let sumSqError = 0;
    let sumAbsPctError = 0;
    
    for (let i = 0; i < n; i++) {
      const error = actual[i] - predicted[i];
      sumAbsError += Math.abs(error);
      sumSqError += error * error;
      sumAbsPctError += actual[i] !== 0 ? Math.abs(error / actual[i]) : 0;
    }
    
    return {
      mae: sumAbsError / n,
      mse: sumSqError / n,
      rmse: Math.sqrt(sumSqError / n),
      mape: (sumAbsPctError / n) * 100,
      r2: calculateRSquared(actual, predicted),
    };
  }

  /**
   * Batch predict churn for multiple customers
   * @param customerIds - Array of customer IDs
   * @returns Map of customer ID to churn prediction
   */
  async batchPredictChurn(customerIds: string[]): Promise<Map<string, ChurnPrediction>> {
    const results = new Map<string, ChurnPrediction>();
    
    logger.info('Starting batch churn prediction', {
      event: 'ml.predictor.batch-churn-start',
      metadata: { count: customerIds.length },
    });
    
    for (const customerId of customerIds) {
      try {
        const result = await this.predictChurn(customerId);
        results.set(customerId, result.predictions);
      } catch (error) {
        logger.warn(`Failed to predict churn for customer ${customerId}`, {
          event: 'ml.predictor.batch-churn-warning',
          metadata: { customerId, error: String(error) },
        });
      }
    }
    
    logger.info('Batch churn prediction completed', {
      event: 'ml.predictor.batch-churn-complete',
      metadata: {
        requested: customerIds.length,
        successful: results.size,
        failed: customerIds.length - results.size,
      },
    });
    
    return results;
  }

  /**
   * Get prediction summary statistics
   * @returns Summary of current model state
   */
  getSummary(): {
    modelVersion: ModelVersion;
    trainingDataSize: number;
    customerProfilesCount: number;
    cacheSize: number;
    config: PredictionConfig;
  } {
    return {
      modelVersion: this.modelVersion,
      trainingDataSize: this.trainingData.length,
      customerProfilesCount: this.customerProfiles.size,
      cacheSize: this.cache.size,
      config: this.config,
    };
  }

  /**
   * Reset predictor state
   */
  reset(): void {
    this.trainingData = [];
    this.customerProfiles.clear();
    this.clearCache();
    this.modelVersion = this.initializeModelVersion();
    
    logger.info('Predictor reset to initial state', { event: 'ml.predictor.reset' });
  }
}

// ============== Factory Functions ==============

/**
 * Create a configured TransactionPredictor instance
 * @param config - Optional configuration overrides
 * @returns Configured predictor instance
 */
export function createTransactionPredictor(config?: Partial<PredictionConfig>): TransactionPredictor {
  return new TransactionPredictor(config);
}

/**
 * Quick volume prediction without managing predictor instance
 * @param data - Historical time series data
 * @param horizon - Days to forecast
 * @returns Volume predictions
 */
export async function quickVolumePrediction(
  data: TimeSeriesPoint[],
  horizon: number = 30
): Promise<PredictionResult<VolumePrediction[]>> {
  const predictor = new TransactionPredictor();
  predictor.loadTrainingData(data);
  return predictor.predictVolume(horizon);
}

/**
 * Quick churn prediction without managing predictor instance
 * @param profile - Customer profile
 * @returns Churn prediction
 */
export async function quickChurnPrediction(
  profile: CustomerProfile
): Promise<PredictionResult<ChurnPrediction>> {
  const predictor = new TransactionPredictor();
  predictor.loadCustomerProfiles([profile]);
  return predictor.predictChurn(profile.customerId);
}

/**
 * Quick revenue forecast without managing predictor instance
 * @param data - Historical time series data
 * @param horizon - Days to forecast
 * @returns Revenue forecast
 */
export async function quickRevenueForecast(
  data: TimeSeriesPoint[],
  horizon: number = 30
): Promise<PredictionResult<RevenueForecast>> {
  const predictor = new TransactionPredictor();
  predictor.loadTrainingData(data);
  return predictor.forecastRevenue(horizon);
}

// ============== Type Exports Summary ==============
// All major types are exported for external use:
// - ModelVersion, ModelMetrics, PredictionConfig
// - TransactionRecord, TimeSeriesPoint, CustomerProfile
// - PredictionResult, VolumePrediction, ChurnPrediction
// - SuccessPrediction, RevenueForecast, SeasonalPattern
// - And all supporting types...

export default TransactionPredictor;
