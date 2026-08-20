/**
 * @module anomaly
 * @description Anomaly detection module for SSM-Pay payment platform.
 * Provides statistical and temporal anomaly detection capabilities
 * for monitoring transaction patterns and system metrics.
 * 
 * @example
 * ```typescript
 * import { AnomalyDetector } from './anomaly';
 * 
 * const detector = new AnomalyDetector();
 * const result = detector.detect(data, 'transaction_volume');
 * 
 * if (result.anomalyCount > 0) {
 *   // Handle anomalies
 * }
 * ```
 */

// Type exports
export {
  AnomalyType,
  AnomalySeverity,
  AnomalyAlert,
  AnomalyThreshold,
  DetectionWindow,
  TimeSeriesPoint,
  AnomalyDetectionResult,
  AnomalyStatistics,
  DetectionMethod,
  AnomalyDetectionConfig,
  DEFAULT_ANOMALY_CONFIG,
  DEFAULT_THRESHOLD
} from './types';

// Statistical detector exports
export type { ZScoreResult, IQRResult, GrubbsResult } from './statistical';
export { StatisticalAnomalyDetector } from './statistical';

// Temporal detector exports
export type {
  TemporalDetectionConfig,
  PatternDeviationResult,
  SpikeDetectionResult,
  TimeSeriesAnalysisResult
} from './temporal';
export { TemporalAnomalyDetector, DEFAULT_TEMPORAL_CONFIG } from './temporal';

import { 
  AnomalyDetectionConfig, 
  DEFAULT_ANOMALY_CONFIG,
  TimeSeriesPoint,
  AnomalyDetectionResult 
} from './types';
import { StatisticalAnomalyDetector } from './statistical';
import { TemporalAnomalyDetector, DEFAULT_TEMPORAL_CONFIG, TemporalDetectionConfig } from './temporal';

/** Unified anomaly detection interface */
export class AnomalyDetector {
  private statistical: StatisticalAnomalyDetector;
  private temporal: TemporalAnomalyDetector;

  constructor(config?: Partial<AnomalyDetectionConfig>) {
    this.statistical = new StatisticalAnomalyDetector(config);
    this.temporal = new TemporalAnomalyDetector({
      ...DEFAULT_TEMPORAL_CONFIG,
      ...config
    });
  }

  /**
   * Detect anomalies in numerical data using all methods
   * @param data - Array of values to analyze
   * @param metricName - Name of the metric
   * @returns Combined detection result
   */
  detect(data: number[], metricName: string): AnomalyDetectionResult {
    return this.statistical.detectAll(data, metricName);
  }

  /**
   * Detect anomalies in time series data
   * @param data - Time series data points with timestamps
   * @param metricName - Name of the metric
   * @returns Combined temporal detection result
   */
  detectTemporal(data: TimeSeriesPoint[], metricName: string): AnomalyDetectionResult {
    return this.temporal.detectAll(data, metricName);
  }

  /**
   * Quick check if value is anomalous compared to baseline
   * @param value - Value to check
   * @param baselineValues - Historical baseline values
   * @param metricName - Metric name for threshold lookup
   * @returns True if anomalous
   */
  isAnomalous(
    value: number, 
    baselineValues: number[], 
    metricName: string = 'default'
  ): boolean {
    const result = this.statistical.zscoreDetection(
      [...baselineValues, value],
      metricName
    );
    
    // Check if last point (our value) triggered an alert
    return result.alerts.some(alert => alert.value === value);
  }

  /**
   * Get access to statistical detector for advanced usage
   */
  getStatisticalDetector(): StatisticalAnomalyDetector {
    return this.statistical;
  }

  /**
   * Get access to temporal detector for advanced usage
   */
  getTemporalDetector(): TemporalAnomalyDetector {
    return this.temporal;
  }

  /**
   * Set threshold for a specific metric
   */
  setThreshold(metricName: string, threshold: Partial<import('./types').AnomalyThreshold>): void {
    this.statistical.setThreshold(metricName, threshold);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AnomalyDetectionConfig>): void {
    this.statistical.updateConfig(config);
    this.temporal.updateConfig(config as Partial<TemporalDetectionConfig>);
  }
}

/** Default export */
export default AnomalyDetector;
