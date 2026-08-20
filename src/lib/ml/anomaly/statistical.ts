/**
 * @module anomaly/statistical
 * @description Statistical anomaly detection for SSM-Pay.
 * Implements z-score, IQR, and Grubbs' test for outlier detection.
 */

import {
  AnomalyAlert,
  AnomalyType,
  AnomalySeverity,
  AnomalyThreshold,
  DetectionWindow,
  AnomalyDetectionResult,
  AnomalyStatistics,
  DetectionMethod,
  AnomalyDetectionConfig,
  DEFAULT_ANOMALY_CONFIG,
  DEFAULT_THRESHOLD
} from './types';

/** Result of z-score analysis */
export interface ZScoreResult { index: number; value: number; zScore: number; isAnomaly: boolean; }

/** Result of IQR analysis */
export interface IQRResult { lowerBound: number; upperBound: number; outlierIndices: number[]; }

/** Result of Grubbs' test */
export interface GrubbsResult { criticalValue: number; gStatistic: number; outlierIndex: number; isSignificant: boolean; }

/**
 * StatisticalAnomalyDetector class
 * Provides statistical methods for detecting anomalies in numerical data
 */
export class StatisticalAnomalyDetector {
  private config: AnomalyDetectionConfig;
  private thresholds: Map<string, AnomalyThreshold>;
  private recentAlerts: Map<string, Date>;

  constructor(config?: Partial<AnomalyDetectionConfig>) {
    this.config = { ...DEFAULT_ANOMALY_CONFIG, ...config };
    this.thresholds = new Map();
    this.recentAlerts = new Map();
  }

  setThreshold(metricName: string, threshold: Partial<AnomalyThreshold>): void {
    this.thresholds.set(metricName, { metricName, ...DEFAULT_THRESHOLD, ...threshold });
  }

  getThreshold(metricName: string): AnomalyThreshold {
    return this.thresholds.get(metricName) ?? { metricName, ...DEFAULT_THRESHOLD };
  }

  /**
   * Detect anomalies using z-score method
   */
  zscoreDetection(data: number[], metricName: string, window?: Partial<DetectionWindow>): AnomalyDetectionResult {
    const threshold = this.getThreshold(metricName);
    if (data.length < this.config.minDataPoints) return this.emptyResult(data.length, metricName, DetectionMethod.Z_SCORE);

    const stats = this.calcStats(data);
    const alerts: AnomalyAlert[] = [];

    for (let i = 0; i < data.length; i++) {
      const zScore = stats.stdDev > 0 ? (data[i] - stats.mean) / stats.stdDev : 0;
      if (Math.abs(zScore) >= threshold.zScoreThreshold && !this.isInCooldown(metricName, i)) {
        const alert = this.createZScoreAlert(data[i], zScore, metricName, threshold, stats, window);
        if (alert) { alerts.push(alert); this.recordAlert(metricName, i); }
        if (alerts.length >= this.config.maxAlertsPerRun) break;
      }
    }

    return { alerts, pointsAnalyzed: data.length, anomalyCount: alerts.length, statistics: stats, detectedAt: new Date(), method: DetectionMethod.Z_SCORE };
  }

  /**
   * Detect anomalies using Interquartile Range (IQR) method
   */
  iqrDetection(data: number[], metricName: string, window?: Partial<DetectionWindow>): AnomalyDetectionResult {
    const threshold = this.getThreshold(metricName);
    if (data.length < this.config.minDataPoints) return this.emptyResult(data.length, metricName, DetectionMethod.IQR);

    const stats = this.calcStats(data);
    const k = threshold.iqrMultiplier;
    const lowerBound = stats.q1 - k * stats.iqr;
    const upperBound = stats.q3 + k * stats.iqr;
    const alerts: AnomalyAlert[] = [];

    for (let i = 0; i < data.length && alerts.length < this.config.maxAlertsPerRun; i++) {
      if ((data[i] < lowerBound || data[i] > upperBound) && !this.isInCooldown(metricName, i)) {
        const severity = Math.abs(data[i] - (data[i] < lowerBound ? lowerBound : upperBound)) / (stats.iqr || 1) >= 2 
          ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM;

        alerts.push({
          id: `iqr_${metricName}_${i}_${Date.now()}`,
          type: AnomalyType.IQR_OUTLIER, severity,
          title: `IQR ${data[i] < lowerBound ? 'Low' : 'High'} Outlier Detected`,
          description: `Value ${data[i]} outside IQR bounds [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`,
          value: data[i], expectedRange: { min: lowerBound, max: upperBound },
          detectedAt: new Date(),
          period: this.buildWindow(window, data.length),
          metricName,
          acknowledged: severity === AnomalySeverity.LOW && this.config.autoAcknowledgeLowSeverity,
          suggestedActions: ['Review the anomalous data point', 'Check for data collection errors']
        });
        this.recordAlert(metricName, i);
      }
    }

    return { alerts, pointsAnalyzed: data.length, anomalyCount: alerts.length, statistics: stats, detectedAt: new Date(), method: DetectionMethod.IQR };
  }

  /**
   * Perform Grubbs' test for single outlier detection
   */
  grubbsTest(data: number[], metricName: string, alpha: number = 0.05): { result: GrubbsResult; alert?: AnomalyAlert; stats: AnomalyStatistics } {
    if (data.length < 3) return { result: { criticalValue: 0, gStatistic: 0, outlierIndex: -1, isSignificant: false }, stats: this.calcStats([]) };

    const stats = this.calcStats(data);
    const n = data.length;
    
    let maxDeviation = 0, outlierIndex = -1;
    for (let i = 0; i < n; i++) {
      const deviation = Math.abs(data[i] - stats.mean);
      if (deviation > maxDeviation) { maxDeviation = deviation; outlierIndex = i; }
    }

    const gStatistic = maxDeviation / stats.stdDev;
    const tCritical = alpha <= 0.01 ? 2.576 : alpha <= 0.025 ? 1.96 : alpha <= 0.05 ? 1.645 : 1.282;
    const criticalValue = ((n - 1) / Math.sqrt(n)) * Math.sqrt(tCritical * tCritical / (n - 2 + tCritical * tCritical));
    const isSignificant = gStatistic > criticalValue;

    let alert: AnomalyAlert | undefined;
    if (isSignificant && outlierIndex >= 0) {
      alert = {
        id: `grubbs_${metricName}_${Date.now()}`, type: AnomalyType.GRUBBS_ANOMALY, severity: AnomalySeverity.HIGH,
        title: 'Grubbs\' Test: Significant Outlier Detected',
        description: `Value ${data[outlierIndex]} is a significant outlier (G=${gStatistic.toFixed(3)})`,
        value: data[outlierIndex], expectedRange: { min: stats.mean - 2 * stats.stdDev, max: stats.mean + 2 * stats.stdDev },
        zScore: gStatistic, detectedAt: new Date(), period: this.buildWindow({}, n), metricName,
        acknowledged: false,
        suggestedActions: ['Investigate this extreme value', 'Check for data quality issues', 'Consider business context']
      };
    }

    return { result: { criticalValue, gStatistic, outlierIndex, isSignificant }, alert, stats };
  }

  /** Run all statistical methods combined */
  detectAll(data: number[], metricName: string, window?: Partial<DetectionWindow>): AnomalyDetectionResult {
    const zResult = this.zscoreDetection(data, metricName, window);
    const iqrResult = this.iqrDetection(data, metricName, window);
    const grubbsResult = this.grubbsTest(data, metricName);

    const allAlerts = [...zResult.alerts, ...iqrResult.alerts];
    if (grubbsResult.alert) allAlerts.push(grubbsResult.alert);

    return { alerts: allAlerts.slice(0, this.config.maxAlertsPerRun), pointsAnalyzed: data.length, anomalyCount: allAlerts.length, statistics: zResult.statistics, detectedAt: new Date(), method: DetectionMethod.COMBINED };
  }

  /** Calculate summary statistics */
  calcStats(data: number[]): AnomalyStatistics {
    if (!data.length) return { mean: 0, stdDev: 0, min: 0, max: 0, median: 0, q1: 0, q3: 0, iqr: 0, count: 0 };

    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = data.reduce((s, v) => s + v, 0) / n;
    const stdDev = Math.sqrt(data.reduce((s, v) => s + (v - mean) ** 2, 0) / n);

    return {
      mean, stdDev, min: sorted[0], max: sorted[n - 1],
      median: sorted[Math.floor(n / 2)],
      q1: sorted[Math.floor(n * 0.25)], q3: sorted[Math.floor(n * 0.75)],
      iqr: sorted[Math.floor(n * 0.75)] - sorted[Math.floor(n * 0.25)], count: n
    };
  }

  updateConfig(config: Partial<AnomalyDetectionConfig>): void { this.config = { ...this.config, config }; }

  private createZScoreAlert(value: number, zScore: number, metricName: string, threshold: AnomalyThreshold, stats: AnomalyStatistics, window?: Partial<DetectionWindow>): AnomalyAlert | null {
    if (threshold.hardBounds && value >= threshold.hardBounds.min && value <= threshold.hardBounds.max) return null;

    const severity = Math.abs(zScore) >= 5 ? AnomalySeverity.CRITICAL : Math.abs(zScore) >= 4 ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM;
    const expectedMin = stats.mean - threshold.zScoreThreshold * stats.stdDev;
    const expectedMax = stats.mean + threshold.zScoreThreshold * stats.stdDev;

    return {
      id: `zscore_${metricName}_${Date.now()}`, type: AnomalyType.STATISTICAL_OUTLIER, severity,
      title: 'Statistical Outlier Detected',
      description: `Value ${value} has z-score of ${zScore.toFixed(2)}, exceeding threshold ${threshold.zScoreThreshold}`,
      value, expectedRange: { min: expectedMin, max: expectedMax }, zScore,
      detectedAt: new Date(), period: this.buildWindow(window, 0), metricName,
      acknowledged: this.shouldAutoAck(severity),
      suggestedActions: ['Review the anomalous value', 'Check for data errors', 'Investigate root cause']
    };
  }

  private buildWindow(partial?: Partial<DetectionWindow>, size?: number): DetectionWindow {
    return {
      start: partial?.start ?? new Date(Date.now() - 3600000),
      end: partial?.end ?? new Date(),
      size: partial?.size ?? size ?? 0,
      sizeUnit: partial?.sizeUnit ?? 'points'
    };
  }

  private isInCooldown(metricName: string, index: number): boolean {
    const last = this.recentAlerts.get(`${metricName}_${index}`);
    return !!last && (Date.now() - last.getTime()) < this.config.alertCooldownMs;
  }

  private recordAlert(metricName: string, index: number): void { this.recentAlerts.set(`${metricName}_${index}`, new Date()); }
  private shouldAutoAck(severity: AnomalySeverity): boolean { return this.config.autoAcknowledgeLowSeverity && (severity === AnomalySeverity.LOW || severity === AnomalySeverity.INFO); }

  private emptyResult(count: number, metricName: string, method: DetectionMethod): AnomalyDetectionResult {
    return { alerts: [], pointsAnalyzed: count, anomalyCount: 0, statistics: this.calcStats([]), detectedAt: new Date(), method };
  }
}
