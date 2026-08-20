/**
 * Revenue Forecasting Logic
 * @module ml/predictor/revenue
 * @description Revenue forecasting with confidence intervals and breakdown analysis.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import {
  RevenueForecast,
  RevenueBreakdown,
  ForecastComponents,
  PredictionResult,
  TimeSeriesPoint,
  ModelMetrics,
  PredictionConfig,
} from './types';
import {
  holtWintersSmoothing,
  doubleExponentialSmoothing,
  calculateMean,
  calculateStdDev,
  calculateRSquared,
} from './volume';

// ============== Revenue Breakdown Generation ==============

/**
 * Generate revenue breakdown by category
 */
export function generateRevenueBreakdown(forecastValues: number[]): RevenueBreakdown[] {
  const total = forecastValues.reduce((a, b) => a + b, 0);
  
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

// ============== Z-Value Calculation ==============

/**
 * Get Z-value for confidence level
 */
export function getZValue(confidence: number): number {
  const zScores: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };
  const keys = Object.keys(zScores).map(Number).sort((a, b) => a - b);
  for (const key of keys) {
    if (confidence <= key) return zScores[key];
  }
  return 1.96;
}

// ============== Metrics Calculation ==============

/**
 * Calculate model metrics
 */
export function calculateMetrics(actual: number[], predicted: number[]): ModelMetrics {
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

// ============== Full Revenue Forecast ==============

/**
 * Perform complete revenue forecast
 */
export function forecastRevenue(
  horizon: number,
  modelVersion: string,
  config: PredictionConfig,
  trainingData: TimeSeriesPoint[]
): PredictionResult<RevenueForecast> {
  const startTime = Date.now();
  
  if (trainingData.length < config.minDataPoints) {
    throw new AppError(
      'Insufficient training data for revenue forecasting',
      ErrorCode.VALIDATION_ERROR,
      { severity: 'error' }
    );
  }

  try {
    const volumes = trainingData.map(d => d.volume);
    
    // Apply forecasting methods
    const hwResult = holtWintersSmoothing(volumes, config.seasonalityPeriod);
    const deResult = doubleExponentialSmoothing(volumes);
    
    // Calculate components
    const lastIndex = volumes.length - 1;
    const baseComponent = hwResult.level[lastIndex] || calculateMean(volumes);
    const trendComponent = hwResult.trend[lastIndex] || 0;
    const seasonalComponent = hwResult.seasonal[0] || 1;
    
    // Calculate forecast values
    const forecastValues: number[] = [];
    for (let i = 1; i <= horizon; i++) {
      const seasonalIdx = (lastIndex + i) % config.seasonalityPeriod;
      const seasonal = hwResult.seasonal[seasonalIdx] || 1;
      forecastValues.push((baseComponent + trendComponent * i) * seasonal);
    }
    
    // Calculate confidence intervals
    const residuals = volumes.map((v, i) => v - (hwResult.smoothed[i] || v));
    const residualStd = calculateStdDev(residuals);
    const zValue = getZValue(config.confidenceLevel);
    
    const totalRevenue = forecastValues.reduce((a, b) => a + b, 0);
    const uncertainty = zValue * residualStd * Math.sqrt(horizon);
    
    // Calculate growth rate
    const prevPeriodRevenue = volumes.slice(-horizon).reduce((a, b) => a + b, 0);
    const growthRate = prevPeriodRevenue > 0 ? (totalRevenue - prevPeriodRevenue) / prevPeriodRevenue : 0;
    
    // Generate breakdown
    const breakdown = generateRevenueBreakdown(forecastValues);
    
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
    const metrics = calculateMetrics(volumes, fittedValues);
    
    const result: PredictionResult<RevenueForecast> = {
      predictions: forecast,
      modelVersion,
      predictedAt: new Date(),
      confidence: config.confidenceLevel,
      featuresUsed: ['volume', 'seasonal', 'trend'],
      processingTimeMs: Date.now() - startTime,
      metrics,
    };
    
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
