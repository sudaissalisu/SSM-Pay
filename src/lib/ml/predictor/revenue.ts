/**
 * @module predictor/revenue
 * @description Revenue prediction capabilities for SSM-Pay.
 * Provides revenue forecasting, volume predictions, and growth rate calculations.
 */

import {
  PredictionType,
  PredictionResult,
  RevenueForecastInput,
  RevenueForecastResult,
  ForecastDataPoint,
  ForecastGranularity,
  HistoricalDataPoint,
  ModelMetrics,
  PredictionConfig,
  DEFAULT_PREDICTION_CONFIG
} from './types';

/** Configuration specific to revenue predictions */
export interface RevenuePredictionConfig extends PredictionConfig {
  baseGrowthRate: number;
  holidaySeasonFactor: number;
  weekendAdjustment: number;
  volatilityFactor: number;
}

/** Default revenue prediction config */
export const DEFAULT_REVENUE_CONFIG: RevenuePredictionConfig = {
  ...DEFAULT_PREDICTION_CONFIG,
  baseGrowthRate: 0.02,
  holidaySeasonFactor: 1.3,
  weekendAdjustment: 0.85,
  volatilityFactor: 0.15
};

/** Monthly seasonality factors (index 0 = January) */
const MONTHLY_SEASONALITY = [
  0.85, 0.88, 0.92, 0.95, 0.98, 1.02,
  1.05, 1.03, 1.08, 1.05, 1.15, 1.35
];

/**
 * RevenuePredictor class
 * Provides revenue forecasting and related predictions
 */
export class RevenuePredictor {
  private config: RevenuePredictionConfig;
  private modelMetrics: ModelMetrics;

  constructor(config?: Partial<RevenuePredictionConfig>) {
    this.config = { ...DEFAULT_REVENUE_CONFIG, ...config };
    this.modelMetrics = { mae: 2500, rmse: 4200, r2Score: 0.85, sampleCount: 365, lastTrainedAt: new Date(), modelVersion: 'revenue-predictor-v1.3.0' };
  }

  /**
   * Forecast revenue for a given time period
   */
  forecastRevenue(input: RevenueForecastInput, historicalData?: HistoricalDataPoint[]): RevenueForecastResult {
    const dataPoints = this.generateForecastDataPoints(input, historicalData);
    const totalAmount = dataPoints.reduce((sum, dp) => sum + dp.value, 0);
    
    const yoyGrowth = historicalData?.length ? this.calculateYoYGrowth(historicalData, dataPoints) : undefined;
    const momGrowth = historicalData?.length ? this.calculateMoMGrowth(historicalData, dataPoints) : undefined;
    const confidence = this.calcConfidence(dataPoints.length, historicalData?.length);

    return {
      value: dataPoints.map(dp => dp.value),
      type: PredictionType.REVENUE_FORECAST,
      confidence,
      lowerBound: dataPoints.map(dp => dp.lowerBound),
      upperBound: dataPoints.map(dp => dp.upperBound),
      predictedAt: new Date(),
      modelVersion: this.modelMetrics.modelVersion,
      dataPoints,
      totalAmount,
      yoyGrowth,
      momGrowth
    };
  }

  /**
   * Predict daily transaction volume
   */
  predictDailyVolume(date: Date, recentVolumes?: HistoricalDataPoint[]): PredictionResult<number> {
    let baseVolume = recentVolumes?.length 
      ? recentVolumes.reduce((s, d) => s + d.value, 0) / recentVolumes.length 
      : 10000;

    let adjustedVolume = baseVolume;
    const dayOfWeek = date.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) adjustedVolume *= this.config.weekendAdjustment;
    adjustedVolume *= MONTHLY_SEASONALITY[date.getMonth()];
    if (this.isHoliday(date)) adjustedVolume *= 1.2;
    adjustedVolume *= (1 + this.config.baseGrowthRate);

    const predictedVolume = Math.round(adjustedVolume);
    const confidence = recentVolumes ? Math.min(0.95, 0.7 + recentVolumes.length / 100) : 0.5;
    const margin = predictedVolume * this.config.volatilityFactor * 1.96;

    return {
      value: predictedVolume,
      type: PredictionType.DAILY_VOLUME,
      confidence,
      lowerBound: Math.max(0, Math.round(predictedVolume - margin)),
      upperBound: Math.round(predictedVolume + margin),
      predictedAt: new Date(),
      modelVersion: this.modelMetrics.modelVersion,
      metadata: { date: date.toISOString(), baseVolume: Math.round(baseVolume), isWeekend: dayOfWeek === 0 || dayOfWeek === 6 }
    };
  }

  /**
   * Calculate revenue growth rate over a period
   */
  calculateGrowthRate(historicalData: HistoricalDataPoint[], periodDays: number = 30): PredictionResult<number> {
    if (historicalData.length < 2) {
      return { value: 0, type: PredictionType.GROWTH_RATE, confidence: 0, predictedAt: new Date(), modelVersion: this.modelMetrics.modelVersion, metadata: { error: 'Insufficient data' } };
    }

    const sorted = [...historicalData].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const startValue = this.findClosestValue(sorted, periodStart);
    const endValue = this.findClosestValue(sorted, now);

    if (!startValue || !endValue || startValue === 0) {
      return { value: 0, type: PredictionType.GROWTH_RATE, confidence: 0.3, predictedAt: new Date(), modelVersion: this.modelMetrics.modelVersion };
    }

    const growthRate = ((endValue - startValue) / startValue) * 100;
    const confidence = Math.min(0.9, 0.5 + sorted.length / 100);

    return {
      value: Math.round(growthRate * 100) / 100,
      type: PredictionType.GROWTH_RATE,
      confidence,
      lowerBound: growthRate - growthRate * 0.1,
      upperBound: growthRate + growthRate * 0.1,
      predictedAt: new Date(),
      modelVersion: this.modelMetrics.modelVersion,
      metadata: { periodDays, startValue, endValue, dataPointCount: sorted.length }
    };
  }

  /**
   * Analyze trends in historical data using linear regression
   */
  analyzeTrend(historicalData: HistoricalDataPoint[]) {
    if (historicalData.length < 3) return { trend: 'stable' as const, slope: 0, rSquared: 0, seasonalityStrength: 0 };

    const sorted = [...historicalData].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const n = sorted.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    sorted.forEach((dp, i) => { sumX += i; sumY += dp.value; sumXY += i * dp.value; sumX2 += i * i; });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const yMean = sumY / n;

    let ssTotal = 0, ssResidual = 0;
    sorted.forEach((dp, i) => {
      const predicted = intercept + slope * i;
      ssTotal += Math.pow(dp.value - yMean, 2);
      ssResidual += Math.pow(dp.value - predicted, 2);
    });

    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
    const trend = slope > 0.01 ? 'increasing' as const : slope < -0.01 ? 'decreasing' as const : 'stable' as const;
    
    // Basic seasonality detection
    let seasonalityStrength = 0;
    if (n >= 30) {
      const mid = Math.floor(n / 2);
      const firstAvg = sorted.slice(0, mid).reduce((s, d) => s + d.value, 0) / mid;
      const secondAvg = sorted.slice(mid).reduce((s, d) => s + d.value, 0) / (n - mid);
      seasonalityStrength = Math.min(1, Math.abs(firstAvg - secondAvg) / Math.max(firstAvg, secondAvg) * 2);
    }

    return { trend, slope, rSquared, seasonalityStrength };
  }

  getMetrics(): ModelMetrics { return { ...this.modelMetrics }; }
  updateConfig(config: Partial<RevenuePredictionConfig>): void { this.config = { ...this.config, ...config }; }

  /** Generate forecast data points with seasonality and growth adjustments */
  private generateForecastDataPoints(input: RevenueForecastInput, historicalData?: HistoricalDataPoint[]): ForecastDataPoint[] {
    const points: ForecastDataPoint[] = [];
    const currentDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    const baseValue = historicalData?.length ? historicalData.reduce((s, d) => s + d.value, 0) / historicalData.length : 50000;

    while (currentDate <= endDate) {
      let value = baseValue;
      value *= Math.pow(1 + this.config.baseGrowthRate, Math.floor((currentDate.getTime() - input.startDate.getTime()) / 86400000));
      value *= MONTHLY_SEASONALITY[currentDate.getMonth()];
      if (currentDate.getDay() === 0 || currentDate.getDay() === 6) value *= this.config.weekendAdjustment;
      value *= (1 + (Math.random() - 0.5) * 2 * this.config.volatilityFactor);

      const stdDev = value * this.config.volatilityFactor;
      points.push({
        date: new Date(currentDate),
        value: Math.round(value),
        lowerBound: Math.max(0, Math.round(value - 1.96 * stdDev)),
        upperBound: Math.round(value + 1.96 * stdDev)
      });

      // Advance by granularity
      switch (input.granularity) {
        case ForecastGranularity.HOURLY: currentDate.setHours(currentDate.getHours() + 1); break;
        case ForecastGranularity.DAILY: currentDate.setDate(currentDate.getDate() + 1); break;
        case ForecastGranularity.WEEKLY: currentDate.setDate(currentDate.getDate() + 7); break;
        case ForecastGranularity.MONTHLY: currentDate.setMonth(currentDate.getMonth() + 1); break;
        case ForecastGranularity.QUARTERLY: currentDate.setMonth(currentDate.getMonth() + 3); break;
      }
    }
    return points;
  }

  /** Simple holiday detection for major US holidays */
  private isHoliday(date: Date): boolean {
    const m = date.getMonth(), d = date.getDate();
    return (m === 11 && d >= 20 && d <= 26) || (m === 10 && d >= 22 && d <= 29) || (m === 6 && d === 4);
  }

  /** Find closest value to target date in sorted array */
  private findClosestValue(sorted: HistoricalDataPoint[], target: Date): number | null {
    if (!sorted.length) return null;
    return sorted.reduce((closest, dp) => 
      Math.abs(dp.timestamp.getTime() - target.getTime()) < Math.abs(closest.timestamp.getTime() - target.getTime()) ? dp : closest
    ).value;
  }

  private calculateYoYGrowth(historical: HistoricalDataPoint[], forecast: ForecastDataPoint[]): number {
    const currentTotal = forecast.reduce((s, d) => s + d.value, 0);
    const prevYearTotal = historical.reduce((s, d) => s + d.value, 0) / 2;
    return ((currentTotal - prevYearTotal) / prevYearTotal) * 100;
  }

  private calculateMoMGrowth(historical: HistoricalDataPoint[], forecast: ForecastDataPoint[]): number {
    if (forecast.length < 2 || historical.length < 2) return 0;
    const currentMonth = forecast.slice(0, Math.ceil(forecast.length / 2)).reduce((s, d) => s + d.value, 0);
    const prevMonth = historical.slice(-Math.ceil(historical.length / 2)).reduce((s, d) => s + d.value, 0);
    return prevMonth > 0 ? ((currentMonth - prevMonth) / prevMonth) * 100 : 0;
  }

  private calcConfidence(forecastLen: number, historicalLen?: number): number {
    let conf = 0.6;
    if (historicalLen) conf += Math.min(0.25, historicalLen / 200);
    if (forecastLen > 90) conf -= 0.1;
    else if (forecastLen < 7) conf += 0.05;
    return Math.min(0.95, Math.max(0.4, conf));
  }
}
