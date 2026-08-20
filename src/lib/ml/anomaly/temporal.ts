/**
 * @module anomaly/temporal
 * @description Temporal anomaly detection for SSM-Pay.
 * Detects pattern deviations, sudden spikes, and time-series anomalies.
 */

import {
  AnomalyAlert, AnomalyType, AnomalySeverity, DetectionWindow,
  TimeSeriesPoint, AnomalyDetectionResult, AnomalyStatistics,
  DetectionMethod, AnomalyDetectionConfig, DEFAULT_ANOMALY_CONFIG
} from './types';

/** Configuration specific to temporal detection */
export interface TemporalDetectionConfig extends AnomalyDetectionConfig {
  minSpikeFactor: number;
  baselineWindowPoints: number;
  patternDeviationStdDevs: number;
  minTrendChangePercent: number;
  emaSmoothingFactor: number;
}

export const DEFAULT_TEMPORAL_CONFIG: TemporalDetectionConfig = {
  ...DEFAULT_ANOMALY_CONFIG,
  minSpikeFactor: 2.0, baselineWindowPoints: 20,
  patternDeviationStdDevs: 2.5, minTrendChangePercent: 30, emaSmoothingFactor: 0.3
};

/** Pattern deviation result */
export interface PatternDeviationResult { index: number; actual: number; expected: number; deviation: number; isAnomaly: boolean; }

/** Spike detection result */
export interface SpikeDetectionResult { startIndex: number; endIndex: number; peakValue: number; baselineValue: number; spikeFactor: number; }

/** Time series analysis result */
export interface TimeSeriesAnalysisResult { trend: 'increasing' | 'decreasing' | 'stable'; slope: number; hasSeasonality: boolean; seasonalityPeriod?: number; volatility: number; autocorrelation: number; }

/**
 * TemporalAnomalyDetector class
 * Detects time-based anomalies in sequential data
 */
export class TemporalAnomalyDetector {
  private config: TemporalDetectionConfig;

  constructor(config?: Partial<TemporalDetectionConfig>) {
    this.config = { ...DEFAULT_TEMPORAL_CONFIG, ...config };
  }

  /**
   * Detect pattern deviations from expected behavior
   */
  detectPatternDeviations(data: TimeSeriesPoint[], metricName: string): AnomalyDetectionResult {
    if (data.length < this.config.minDataPoints) return this.emptyResult(data.length, metricName, DetectionMethod.PATTERN_DEVIATION);

    const values = data.map(d => d.value);
    const stats = this.calcStats(values);
    const emaValues = this.calcEMA(values);
    const windowSize = Math.min(this.config.baselineWindowPoints, data.length);
    const alerts: AnomalyAlert[] = [];

    for (let i = windowSize; i < data.length && alerts.length < this.config.maxAlertsPerRun; i++) {
      const actual = values[i];
      const expected = emaValues[i];
      const deviation = actual - expected;
      const localStats = this.calcStats(values.slice(i - windowSize, i));
      const threshold = this.config.patternDeviationStdDevs * localStats.stdDev;
      const devPct = expected ? (deviation / Math.abs(expected)) * 100 : 0;

      if (Math.abs(deviation) > threshold && Math.abs(devPct) > this.config.minTrendChangePercent) {
        const severity = Math.abs(devPct) >= 100 ? AnomalySeverity.CRITICAL : Math.abs(devPct) >= 50 ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM;

        alerts.push({
          id: `pattern_${metricName}_${i}_${Date.now()}`, type: AnomalyType.PATTERN_DEVIATION, severity,
          title: 'Pattern Deviation Detected',
          description: `Value ${actual} deviates ${devPct.toFixed(1)}% from expected ${expected.toFixed(2)}`,
          value: actual, expectedRange: { min: expected - threshold, max: expected + threshold },
          detectedAt: new Date(),
          period: { start: data[Math.max(0, i - windowSize)].timestamp, end: data[i].timestamp, size: windowSize, sizeUnit: 'points' },
          metricName,
          acknowledged: severity === AnomalySeverity.LOW && this.config.autoAcknowledgeLowSeverity,
          suggestedActions: ['Investigate cause of deviation', 'Check external factors', 'Review recent changes']
        });
      }
    }

    return { alerts, pointsAnalyzed: data.length, anomalyCount: alerts.length, statistics: stats, detectedAt: new Date(), method: DetectionMethod.PATTERN_DEVIATION };
  }

  /**
   * Detect sudden spikes in time series data
   */
  detectSuddenSpikes(data: TimeSeriesPoint[], metricName: string): AnomalyDetectionResult {
    if (data.length < this.config.minDataPoints) return this.emptyResult(data.length, metricName, DetectionMethod.TEMPORAL_SPIKE);

    const values = data.map(d => d.value);
    const stats = this.calcStats(values);
    const baselineWindow = this.config.baselineWindowPoints;
    const alerts: AnomalyAlert[] = [];
    
    let inSpike = false, spikeStart = 0, spikePeak = 0, baselineValue = 0;

    for (let i = baselineWindow; i < values.length && alerts.length < this.config.maxAlertsPerRun; i++) {
      baselineValue = this.median(values.slice(i - baselineWindow, i));
      const spikeFactor = baselineValue ? values[i] / baselineValue : 1;

      if (!inSpike && spikeFactor >= this.config.minSpikeFactor) {
        inSpike = true; spikeStart = i; spikePeak = values[i];
      } else if (inSpike) {
        if (values[i] > spikePeak) spikePeak = values[i];

        if (values[i] <= baselineValue * 1.3 || i === values.length - 1) {
          const finalFactor = spikePeak / baselineValue;
          if (finalFactor >= this.config.minSpikeFactor) {
            const severity = finalFactor >= 5 ? AnomalySeverity.CRITICAL : finalFactor >= 3 ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM;

            alerts.push({
              id: `spike_${metricName}_${spikeStart}_${Date.now()}`, type: AnomalyType.SUDDEN_SPIKE, severity,
              title: 'Sudden Spike Detected',
              description: `Spike: peak ${spikePeak} is ${finalFactor.toFixed(1)}x baseline (${baselineValue})`,
              value: spikePeak, expectedRange: { min: 0, max: baselineValue * this.config.minSpikeFactor },
              detectedAt: new Date(),
              period: { start: data[spikeStart].timestamp, end: data[i].timestamp, size: i - spikeStart + 1, sizeUnit: 'points' },
              metricName, metadata: { spikeFactor: finalFactor, duration: i - spikeStart + 1, baselineValue },
              acknowledged: false,
              suggestedActions: ['Verify legitimate activity', 'Check for abuse patterns', 'Monitor continued activity']
            });
          }
          inSpike = false;
        }
      }
    }

    return { alerts, pointsAnalyzed: data.length, anomalyCount: alerts.length, statistics: stats, detectedAt: new Date(), method: DetectionMethod.TEMPORAL_SPIKE };
  }

  /**
   * Perform comprehensive time series analysis
   */
  timeSeriesAnalysis(data: TimeSeriesPoint[]): TimeSeriesAnalysisResult {
    if (data.length < 5) return { trend: 'stable', slope: 0, hasSeasonality: false, volatility: 0, autocorrelation: 0 };

    const values = data.map(d => d.value);
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) { sumX += i; sumY += values[i]; sumXY += i * values[i]; sumX2 += i * i; }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const meanY = sumY / n;
    const trend = slope > 0.01 * meanY ? 'increasing' : slope < -0.01 * meanY ? 'decreasing' : 'stable';
    const variance = values.reduce((s, v) => s + (v - meanY) ** 2, 0) / n;
    const volatility = meanY ? Math.sqrt(variance) / Math.abs(meanY) : 0;

    // Autocorrelation at lag 1
    let autoCov = 0;
    for (let i = 1; i < n; i++) autoCov += (values[i] - meanY) * (values[i - 1] - meanY);
    const autocorrelation = variance ? autoCov / ((n - 1) * variance) : 0;

    // Basic seasonality check at common periods
    let hasSeasonality = false, seasonalityPeriod: number | undefined;
    if (n >= 20) {
      for (const period of [7, 24, 30]) {
        if (period >= n) continue;
        let ac = 0;
        for (let j = period; j < n; j++) ac += (values[j] - meanY) * (values[j - period] - meanY);
        if (Math.abs(ac) > 0.6 * (n - period) * variance) { hasSeasonality = true; seasonalityPeriod = period; break; }
      }
    }

    return { trend, slope, hasSeasonality, seasonalityPeriod, volatility, autocorrelation };
  }

  /** Run all temporal methods combined */
  detectAll(data: TimeSeriesPoint[], metricName: string): AnomalyDetectionResult {
    const patternResult = this.detectPatternDeviations(data, metricName);
    const spikeResult = this.detectSuddenSpikes(data, metricName);
    return {
      alerts: [...patternResult.alerts, ...spikeResult.alerts].slice(0, this.config.maxAlertsPerRun),
      pointsAnalyzed: data.length, anomalyCount: patternResult.alerts.length + spikeResult.alerts.length,
      statistics: patternResult.statistics, detectedAt: new Date(), method: DetectionMethod.COMBINED
    };
  }

  updateConfig(config: Partial<TemporalDetectionConfig>): void { this.config = { ...this.config, ...config }; }
  getConfig(): TemporalDetectionConfig { return { ...this.config }; }

  /** Calculate Exponential Moving Average */
  private calcEMA(values: number[]): number[] {
    const ema = [values[0]];
    const alpha = this.config.emaSmoothingFactor;
    for (let i = 1; i < values.length; i++) ema.push(alpha * values[i] + (1 - alpha) * ema[i - 1]);
    return ema;
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private calcStats(values: number[]): AnomalyStatistics {
    if (!values.length) return { mean: 0, stdDev: 0, min: 0, max: 0, median: 0, q1: 0, q3: 0, iqr: 0, count: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = values.reduce((s, v) => s + v, 0) / n;
    return { mean, stdDev: Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n), min: sorted[0], max: sorted[n - 1], median: sorted[Math.floor(n / 2)], q1: sorted[Math.floor(n * 0.25)], q3: sorted[Math.floor(n * 0.75)], iqr: sorted[Math.floor(n * 0.75)] - sorted[Math.floor(n * 0.25)], count: n };
  }

  private emptyResult(count: number, metricName: string, method: DetectionMethod): AnomalyDetectionResult {
    return { alerts: [], pointsAnalyzed: count, anomalyCount: 0, statistics: this.calcStats([]), detectedAt: new Date(), method };
  }
}
