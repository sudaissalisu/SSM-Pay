/**
 * Type Definitions for Transaction Prediction Module
 * @module ml/predictor/types
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
export const DEFAULT_CONFIG: PredictionConfig = {
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

// ============== Payment Success Params ==============

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
