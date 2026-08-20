/**
 * @module predictor/types
 * @description Type definitions for the prediction system in SSM-Pay.
 * Defines interfaces for transaction and revenue prediction capabilities.
 */

/** Types of predictions available in the system */
export enum PredictionType {
  /** Predict likelihood of successful transaction completion */
  TRANSACTION_SUCCESS = 'TRANSACTION_SUCCESS',
  /** Estimate processing time for a transaction */
  PROCESSING_TIME = 'PROCESSING_TIME',
  /** Predict customer churn probability */
  CHURN_RISK = 'CHURN_RISK',
  /** Forecast future revenue */
  REVENUE_FORECAST = 'REVENUE_FORECAST',
  /** Predict daily transaction volume */
  DAILY_VOLUME = 'DAILY_VOLUME',
  /** Calculate revenue growth rate */
  GROWTH_RATE = 'GROWTH_RATE'
}

/** Result of any prediction operation */
export interface PredictionResult<T = number> {
  /** The predicted value */
  value: T;
  /** Type of prediction performed */
  type: PredictionType;
  /** Confidence score (0-1) representing prediction certainty */
  confidence: number;
  /** Lower bound of prediction interval (if applicable) */
  lowerBound?: T;
  /** Upper bound of prediction interval (if applicable) */
  upperBound?: T;
  /** Timestamp when prediction was generated */
  predictedAt: Date;
  /** Model version used for prediction */
  modelVersion: string;
  /** Additional metadata about the prediction */
  metadata?: Record<string, unknown>;
}

/** Features used for transaction-level predictions */
export interface PredictionFeatures {
  // Transaction features
  /** Transaction amount in smallest currency unit */
  amount: number;
  /** Currency code */
  currency: string;
  /** Payment method used */
  paymentMethod: string;
  /** Merchant category code */
  merchantCategoryCode?: string;
  
  // Customer features
  /** Customer ID */
  customerId: string;
  /** Customer account age in days */
  accountAgeDays: number;
  /** Customer's historical success rate */
  historicalSuccessRate: number;
  /** Total transactions by this customer */
  totalTransactions: number;
  
  // Temporal features
  /** Hour of day (0-23) */
  hourOfDay: number;
  /** Day of week (0-6, Sunday=0) */
  dayOfWeek: number;
  /** Whether this is a weekend */
  isWeekend: boolean;
  /** Whether this is a holiday period */
  isHoliday: boolean;
  
  // Geographic features
  /** Origin country code */
  originCountry?: string;
  /** Destination country code */
  destinationCountry?: string;
  /** Is cross-border transaction */
  isCrossBorder: boolean;
}

/** Metrics for evaluating model performance */
export interface ModelMetrics {
  /** Mean Absolute Error */
  mae: number;
  /** Root Mean Squared Error */
  rmse: number;
  /** R-squared score */
  r2Score: number;
  /** Accuracy (for classification models) */
  accuracy?: number;
  /** Precision (for classification models) */
  precision?: number;
  /** Recall (for classification models) */
  recall?: number;
  /** F1 Score (for classification models) */
  f1Score?: number;
  /** Number of samples evaluated */
  sampleCount: number;
  /** Last training timestamp */
  lastTrainedAt?: Date;
  /** Model version */
  modelVersion: string;
}

/** Configuration for prediction models */
export interface PredictionConfig {
  /** Enable caching of predictions */
  enableCache: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  /** Minimum confidence threshold for returning predictions */
  minConfidence: number;
  /** Whether to include prediction intervals */
  includeIntervals: boolean;
  /** Interval confidence level (e.g., 0.95 for 95%) */
  intervalConfidence: number;
  /** Maximum historical days to consider */
  maxHistoricalDays: number;
}

/** Default prediction configuration */
export const DEFAULT_PREDICTION_CONFIG: PredictionConfig = {
  enableCache: true,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  minConfidence: 0.5,
  includeIntervals: true,
  intervalConfidence: 0.95,
  maxHistoricalDays: 90
};

/** Input for revenue forecasting */
export interface RevenueForecastInput {
  /** Start date of forecast period */
  startDate: Date;
  /** End date of forecast period */
  endDate: Date;
  /** Granularity of forecast */
  granularity: ForecastGranularity;
  /** Optional segments to forecast for */
  segments?: string[];
  /** Include historical comparison */
  includeHistoricalComparison: boolean;
}

/** Time granularity for forecasts */
export enum ForecastGranularity {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY'
}

/** Result of revenue forecasting */
export interface RevenueForecastResult extends PredictionResult<number[]> {
  /** Individual data points in the forecast */
  dataPoints: ForecastDataPoint[];
  /** Total forecasted amount */
  totalAmount: number;
  /** Year-over-year growth if applicable */
  yoyGrowth?: number;
  /** Month-over-month growth if applicable */
  momGrowth?: number;
}

/** Single data point in a forecast */
export interface ForecastDataPoint {
  /** Timestamp for this data point */
  date: Date;
  /** Predicted value */
  value: number;
  /** Lower bound */
  lowerBound: number;
  /** Upper bound */
  upperBound: number;
  /** Actual value if available (for historical periods) */
  actualValue?: number;
}

/** Historical data point for model training/evaluation */
export interface HistoricalDataPoint {
  /** Timestamp */
  timestamp: Date;
  /** Value */
  value: number;
  /** Additional features at this point */
  features?: Record<string, number>;
}
