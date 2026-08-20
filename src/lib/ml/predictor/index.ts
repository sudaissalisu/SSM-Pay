/**
 * @module predictor
 * @description Prediction module for SSM-Pay payment platform.
 * Provides transaction success prediction, processing time estimation,
 * churn risk analysis, and revenue forecasting capabilities.
 * 
 * @example
 * ```typescript
 * import { TransactionPredictor, RevenuePredictor } from './predictor';
 * 
 * const txPredictor = new TransactionPredictor();
 * const result = txPredictor.predictSuccessProbability(features);
 * 
 * const revPredictor = new RevenuePredictor();
 * const forecast = revPredictor.forecastRevenue(forecastInput);
 * ```
 */

// Type exports
export {
  PredictionType,
  PredictionResult,
  PredictionFeatures,
  ModelMetrics,
  PredictionConfig,
  RevenueForecastInput,
  ForecastGranularity,
  RevenueForecastResult,
  ForecastDataPoint,
  HistoricalDataPoint,
  DEFAULT_PREDICTION_CONFIG
} from './types';

// Transaction predictor exports
export type { TransactionPredictionConfig } from './transaction';
export {
  TransactionPredictor,
  DEFAULT_TRANSACTION_CONFIG
} from './transaction';

// Revenue predictor exports
export type { RevenuePredictionConfig } from './revenue';
export {
  RevenuePredictor,
  DEFAULT_REVENUE_CONFIG
} from './revenue';

// Re-export main classes for convenience
import { TransactionPredictor, DEFAULT_TRANSACTION_CONFIG } from './transaction';
import { RevenuePredictor, DEFAULT_REVENUE_CONFIG } from './revenue';

/** Unified Predictor interface combining all prediction capabilities */
export class Predictor {
  public readonly transaction: TransactionPredictor;
  public readonly revenue: RevenuePredictor;

  constructor(
    transactionConfig?: Partial<import('./transaction').TransactionPredictionConfig>,
    revenueConfig?: Partial<import('./revenue').RevenuePredictionConfig>
  ) {
    this.transaction = new TransactionPredictor(transactionConfig);
    this.revenue = new RevenuePredictor(revenueConfig);
  }

  /**
   * Get combined metrics from all predictors
   */
  getMetrics(): {
    transaction: ModelMetrics;
    revenue: ModelMetrics;
  } {
    return {
      transaction: this.transaction.getMetrics(),
      revenue: this.revenue.getMetrics()
    };
  }
}

/** Default export */
export default Predictor;

// Re-import for type usage
import { ModelMetrics } from './types';
