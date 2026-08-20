/**
 * Transaction Predictor Module - Main Entry Point
 * @module ml/predictor
 * @description Main class and re-exports for the transaction prediction system.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// Export all types
export * from './types';

// Export stats functions (core utilities)
export {
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
} from './stats';

// Export volume/forecasting functions
export {
  simpleMovingAverage,
  weightedMovingAverage,
  exponentialMovingAverage,
  doubleExponentialSmoothing,
  holtWintersSmoothing,
  linearRegression,
  polynomialRegression,
  detectAnomaliesZScore,
  detectAnomaliesIQR,
} from './volume';

// Export churn functions
export {
  calculateChurnFactors,
  calculateLogisticScore,
  classifyChurnRisk,
  estimateDaysToChurn,
  generateChurnRecommendations,
  calculatePredictionConfidence,
  predictChurn,
} from './churn';

// Export success prediction functions
export {
  calculateAmountRisk,
  calculateMethodRisk,
  calculateTimeRisk,
  calculateDeviceRisk,
  calculateRiskIndicators,
  calculateBaseSuccessRate,
  calculateRiskAdjustment,
  classifyPaymentRisk,
  estimateProcessingTime,
  generateSuccessRecommendations,
  calculateSuccessConfidence,
  predictPaymentSuccess,
} from './success';

// Export revenue forecasting functions
export {
  generateRevenueBreakdown,
  getZValue,
  calculateMetrics as calculateRevenueMetrics,
  forecastRevenue,
} from './revenue';

// Export seasonal detection functions
export {
  detectPatternForPeriod,
  detectSeasonalPatterns,
} from './seasonal';

// Import types for internal use
import {
  PredictionConfig,
  ModelVersion,
  TimeSeriesPoint,
  CustomerProfile,
  VolumePrediction,
  ChurnPrediction,
  SuccessPrediction,
  RevenueForecast,
  SeasonalPattern,
  PaymentSuccessParams,
  DEFAULT_CONFIG,
} from './types';

import { 
  holtWintersSmoothing, 
  doubleExponentialSmoothing, 
  calculateMean, 
  calculateStdDev, 
  getZValue 
} from './volume';
import { predictChurn } from './churn';
import { predictPaymentSuccess } from './success';
import { forecastRevenue, calculateMetrics } from './revenue';
import { detectSeasonalPatterns } from './seasonal';

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

  constructor(config?: Partial<PredictionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.modelVersion = this.initializeModelVersion();
    
    logger.info('TransactionPredictor initialized', {
      event: 'ml.predictor.init',
      metadata: { version: this.modelVersion.version, config: this.config },
    });
  }

  private initializeModelVersion(): ModelVersion {
    return {
      id: `tx-predictor-v${Date.now()}`,
      version: '2.1.0',
      createdAt: new Date(),
      features: [
        'transaction_count', 'transaction_volume', 'avg_amount', 'success_rate',
        'customer_frequency', 'time_features', 'seasonal_components', 'trend_indicators',
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

  getModelVersion(): ModelVersion { return { ...this.modelVersion }; }

  updateConfig(updates: Partial<PredictionConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('Configuration updated', { event: 'ml.predictor.config-update' });
  }

  loadTrainingData(data: TimeSeriesPoint[]): void {
    if (data.length < this.config.minDataPoints) {
      throw new AppError(
        `Insufficient training data: ${data.length} points provided`,
        ErrorCode.VALIDATION_ERROR,
        { severity: 'warning' }
      );
    }
    
    this.trainingData = data
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(-this.config.maxDataPoints);
    
    this.modelVersion.trainingDataStart = this.trainingData[0]?.timestamp;
    this.modelVersion.trainingDataEnd = this.trainingData[this.trainingData.length - 1]?.timestamp;
    this.modelVersion.lastTrainedAt = new Date();
    
    logger.info('Training data loaded', {
      event: 'ml.predictor.data-loaded',
      metadata: { dataPoints: this.trainingData.length },
    });
  }

  loadCustomerProfiles(profiles: CustomerProfile[]): void {
    for (const profile of profiles) {
      this.customerProfiles.set(profile.customerId, profile);
    }
    logger.info('Customer profiles loaded', { event: 'ml.predictor.profiles-loaded', metadata: { count: profiles.length } });
  }

  // ============== Cache Management ==============

  private generateCacheKey(prefix: string, ...args: unknown[]): string {
    return `${prefix}:${JSON.stringify(args)}`;
  }

  private getCached<T>(key: string): T | null {
    if (!this.config.enableCache) return null;
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.config.cacheTTL) {
      this.cache.delete(key); return null;
    }
    return cached.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    if (!this.config.enableCache) return;
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(): void {
    this.cache.clear();
    logger.debug('Prediction cache cleared', { event: 'ml.predictor.cache-cleared' });
  }

  // ============== Volume Prediction ==============

  async predictVolume(horizon: number = this.config.defaultHorizon): Promise<import('./types').PredictionResult<VolumePrediction[]>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('volume', horizon);
    
    const cached = this.getCached<import('./types').PredictionResult<VolumePrediction[]>>(cacheKey);
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
      
      const hwCounts = holtWintersSmoothing(counts, this.config.seasonalityPeriod);
      const hwVolumes = holtWintersSmoothing(volumes, this.config.seasonalityPeriod);
      const deCounts = doubleExponentialSmoothing(counts);
      
      const seasonalIndices = this.calculateSeasonalIndices(counts);
      const predictions: VolumePrediction[] = [];
      const lastDate = this.trainingData[this.trainingData.length - 1].timestamp;
      const lastLevel = hwCounts.level[hwCounts.level.length - 1];
      const lastTrend = hwCounts.trend[hwCounts.trend.length - 1];
      
      const residuals = counts.map((c, i) => c - (hwCounts.smoothed[i] || c));
      const residualStd = calculateStdDev(residuals);
      const zValue = getZValue(this.config.confidenceLevel);
      
      for (let i = 1; i <= horizon; i++) {
        const forecastDate = new Date(lastDate);
        forecastDate.setDate(forecastDate.getDate() + i);
        
        const seasonalIndex = seasonalIndices[(this.trainingData.length + i - 1) % seasonalIndices.length];
        const trendComponent = lastTrend * i;
        const baseForecast = (lastLevel + trendComponent) * seasonalIndex;
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
      
      const fittedValues = hwCounts.smoothed.slice(-counts.length);
      const metrics = calculateMetrics(counts, fittedValues);
      
      const result: import('./types').PredictionResult<VolumePrediction[]> = {
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
        metadata: { horizon, processingTimeMs: result.processingTimeMs },
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

  // ============== Churn Prediction ==============

  async predictChurn(customerId: string): Promise<import('./types').PredictionResult<ChurnPrediction>> {
    const cacheKey = this.generateCacheKey('churn', customerId);
    const cached = this.getCached<import('./types').PredictionResult<ChurnPrediction>>(cacheKey);
    if (cached) return cached;

    const profile = this.customerProfiles.get(customerId);
    if (!profile) {
      throw new AppError(`Customer profile not found: ${customerId}`, ErrorCode.VALIDATION_ERROR, { severity: 'warning', context: { customerId } });
    }

    const result = predictChurn(profile, this.modelVersion.version);
    this.setCache(cacheKey, result);
    return result;
  }

  // ============== Payment Success Prediction ==============

  async predictPaymentSuccess(params: PaymentSuccessParams): Promise<import('./types').PredictionResult<SuccessPrediction>> {
    const result = predictPaymentSuccess(params, this.modelVersion.version, this.trainingData, this.customerProfiles);
    const cacheKey = this.generateCacheKey('success', params.amount, params.paymentMethod, params.customerId);
    this.setCache(cacheKey, result);
    return result;
  }

  // ============== Revenue Forecasting ==============

  async forecastRevenue(horizon: number = this.config.defaultHorizon): Promise<import('./types').PredictionResult<RevenueForecast>> {
    return forecastRevenue(horizon, this.modelVersion.version, this.config, this.trainingData);
  }

  // ============== Seasonal Pattern Detection ==============

  async detectSeasonalPatterns(): Promise<import('./types').PredictionResult<SeasonalPattern[]>> {
    return detectSeasonalPatterns(this.modelVersion.version, this.config, this.trainingData);
  }

  // ============== Batch Operations ==============

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
      metadata: { requested: customerIds.length, successful: results.size },
    });
    
    return results;
  }

  // ============== Utility Methods ==============

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

  reset(): void {
    this.trainingData = [];
    this.customerProfiles.clear();
    this.clearCache();
    this.modelVersion = this.initializeModelVersion();
    logger.info('Predictor reset to initial state', { event: 'ml.predictor.reset' });
  }
}

// ============== Factory Functions ==============

export function createTransactionPredictor(config?: Partial<PredictionConfig>): TransactionPredictor {
  return new TransactionPredictor(config);
}

export async function quickVolumePrediction(
  data: TimeSeriesPoint[],
  horizon: number = 30
): Promise<import('./types').PredictionResult<VolumePrediction[]>> {
  const predictor = new TransactionPredictor();
  predictor.loadTrainingData(data);
  return predictor.predictVolume(horizon);
}

export async function quickChurnPrediction(
  profile: CustomerProfile
): Promise<import('./types').PredictionResult<ChurnPrediction>> {
  const predictor = new TransactionPredictor();
  predictor.loadCustomerProfiles([profile]);
  return predictor.predictChurn(profile.customerId);
}

export async function quickRevenueForecast(
  data: TimeSeriesPoint[],
  horizon: number = 30
): Promise<import('./types').PredictionResult<RevenueForecast>> {
  const predictor = new TransactionPredictor();
  predictor.loadTrainingData(data);
  return predictor.forecastRevenue(horizon);
}

export default TransactionPredictor;
