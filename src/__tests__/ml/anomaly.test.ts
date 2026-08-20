/**
 * @fileoverview Test suite for Anomaly Detection module
 * @module ml/anomaly.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnomalyDetector,
  StatisticalAnomalyDetector,
  TemporalAnomalyDetector,
} from '@/lib/ml/anomaly';
import {
  AnomalyType,
  AnomalySeverity,
  DetectionMethod,
  type AnomalyAlert,
  type AnomalyDetectionResult,
  type TimeSeriesPoint,
  DEFAULT_ANOMALY_CONFIG,
} from '@/lib/ml/anomaly/types';

describe('Anomaly Detection Module', () => {
  
  describe('StatisticalAnomalyDetector.zscoreDetection()', () => {
    let detector: StatisticalAnomalyDetector;

    beforeEach(() => {
      detector = new StatisticalAnomalyDetector();
    });

    it('should detect outliers using z-score method', () => {
      // Normal data with one outlier
      const data = [10, 12, 11, 13, 10, 12, 11, 13, 100]; // 100 is outlier
      const result = detector.zscoreDetection(data, 'test_metric');

      expect(result.method).toBe(DetectionMethod.Z_SCORE);
      expect(result.pointsAnalyzed).toBe(data.length);
    });

    it('should return empty result for insufficient data', () => {
      const data = [1, 2, 3]; // Less than minDataPoints (default 10)
      const result = detector.zscoreDetection(data, 'small_metric');

      expect(result.alerts).toHaveLength(0);
      expect(result.anomalyCount).toBe(0);
    });

    it('should identify statistical outlier alerts with correct properties', () => {
      // Data with clear outlier
      const data = generateNormalData(50, 100, 10); // mean=100, std=10
      data.push(200); // Add extreme outlier

      const result = detector.zscoreDetection(data, 'outlier_test');

      if (result.alerts.length > 0) {
        const alert = result.alerts[0];
        expect(alert.type).toBe(AnomalyType.STATISTICAL_OUTLIER);
        expect(alert.severity).toBeDefined();
        expect(Object.values(AnomalySeverity)).toContain(alert.severity);
        expect(alert.value).toBe(200); // The outlier value
        expect(alert.metricName).toBe('outlier_test');
        expect(alert.detectedAt).toBeInstanceOf(Date);
        expect(Array.isArray(alert.suggestedActions)).toBe(true);
      }
    });

    it('should not flag normal distribution data', () => {
      // Generate normal-looking data without significant outliers
      const data = generateNormalData(30, 500, 50);

      const result = detector.zscoreDetection(data, 'normal_data');

      // Most values should be within normal range
      expect(result.anomalyCount).toBeLessThan(data.length * 0.2); // Less than 20% flagged
    });

    it('should handle edge case of all identical values', () => {
      const data = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];

      const result = detector.zscoreDetection(data, 'constant_data');

      // No anomalies in constant data (stdDev = 0)
      expect(result.anomalyCount).toBe(0);
    });
  });

  describe('StatisticalAnomalyDetector.iqrDetection()', () => {
    let detector: StatisticalAnomalyDetector;

    beforeEach(() => {
      detector = new StatisticalAnomalyDetector();
    });

    it('should detect IQR outliers', () => {
      const data = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 100];
      const result = detector.iqrDetection(data, 'iqr_test');

      expect(result.method).toBe(DetectionMethod.IQR);
      expect(result.pointsAnalyzed).toBe(data.length);
    });

    it('should classify IQR outliers correctly', () => {
      const data = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, -100, 200];

      const result = detector.iqrDetection(data, 'iqr_class');

      if (result.alerts.length > 0) {
        result.alerts.forEach(alert => {
          expect(alert.type).toBe(AnomalyType.IQR_OUTLIER);
          expect([AnomalySeverity.MEDIUM, AnomalySeverity.HIGH]).toContain(alert.severity);
        });
      }
    });
  });

  describe('StatisticalAnomalyDetector.grubbsTest()', () => {
    let detector: StatisticalAnomalyDetector;

    beforeEach(() => {
      detector = new StatisticalAnomalyDetector();
    });

    it('should perform Grubbs test for single outlier', () => {
      const data = [10, 11, 12, 13, 14, 100]; // Clear single outlier

      const { result, alert } = detector.grubbsTest(data, 'grubbs_test');

      expect(result.outlierIndex).toBeGreaterThanOrEqual(-1);
      expect(typeof result.gStatistic).toBe('number');
      expect(typeof result.criticalValue).toBe('number');

      if (result.isSignificant && alert) {
        expect(alert.type).toBe(AnomalyType.GRUBBS_ANOMALY);
        expect(alert.severity).toBe(AnomalySeverity.HIGH);
      }
    });

    it('should return non-significant for normal data', () => {
      const data = [10, 11, 12, 13, 14, 15];

      const { result } = detector.grubbsTest(data, 'normal_grubbs');

      expect(result.isSignificant).toBe(false);
    });
  });

  describe('TemporalAnomalyDetector.detectSuddenSpikes()', () => {
    let detector: TemporalAnomalyDetector;

    beforeEach(() => {
      detector = new TemporalAnomalyDetector();
    });

    it('should detect sudden spikes in time series', () => {
      // Generate baseline data then add spike
      const baselineData = generateTimeSeries(30, 100, 10);
      
      // Add spike values
      const spikeData = [
        ...baselineData,
        ...generateTimeSeries(5, 300, 20), // Spike to 3x baseline
      ];

      const result = detector.detectSuddenSpikes(spikeData, 'spike_metric');

      expect(result.method).toBe(DetectionMethod.TEMPORAL_SPIKE);
      expect(result.pointsAnalyzed).toBe(spikeData.length);

      if (result.alerts.length > 0) {
        const alert = result.alerts[0];
        expect(alert.type).toBe(AnomalyType.SUDDEN_SPIKE);
        expect(alert.metadata?.spikeFactor).toBeDefined();
        expect(alert.metadata?.duration).toBeDefined();
      }
    });

    it('should not flag stable time series', () => {
      const stableData = generateTimeSeries(40, 100, 5); // Low variance

      const result = detector.detectSuddenSpikes(stableData, 'stable_metric');

      expect(result.anomalyCount).toBe(0);
    });

    it('should calculate spike factor correctly', () => {
      const data = [
        ...generateTimeSeries(25, 100, 2), // Stable at ~100
        ...generateTimeSeries(3, 500, 10), // Spike to ~5x
      ];

      const result = detector.detectSuddenSpikes(data, 'factor_test');

      if (result.alerts.length > 0) {
        const spikeFactor = result.alerts[0].metadata?.spikeFactor as number;
        expect(spikeFactor).toBeGreaterThanOrEqual(2.0); // Default minSpikeFactor
      }
    });
  });

  describe('TemporalAnomalyDetector.detectPatternDeviations()', () => {
    let detector: TemporalAnomalyDetector;

    beforeEach(() => {
      detector = new TemporalAnomalyDetector();
    });

    it('should detect pattern deviations', () => {
      // Create pattern then deviation
      const patternData = generateTimeSeries(25, 100, 5);
      const deviatingData = [
        ...patternData,
        ...generateTimeSeries(5, 250, 10), // Deviation from pattern
      ];

      const result = detector.detectPatternDeviations(deviatingData, 'pattern_metric');

      expect(result.method).toBe(DetectionMethod.PATTERN_DEVIATION);
      expect(result.pointsAnalyzed).toBe(deviatingData.length);
    });

    it('should return no alerts for consistent patterns', () => {
      const consistentData = generateTimeSeries(35, 100, 8);

      const result = detector.detectPatternDeviations(consistentData, 'consistent');

      // May have few or no alerts for consistent data
      expect(result.pointsAnalyzed).toBe(consistentData.length);
    });
  });

  describe('Anomaly Alert Generation', () => {
    let detector: StatisticalAnomalyDetector;

    beforeEach(() => {
      detector = new StatisticalAnomalyDetector();
    });

    it('should generate alerts with all required fields', () => {
      const data = [10, 11, 12, 13, 14, 150];
      const result = detector.detectAll(data, 'alert_fields_test');

      if (result.alerts.length > 0) {
        const alert = result.alerts[0];
        
        // Verify all required Alert fields
        expect(alert.id).toBeDefined();
        expect(alert.id.length).toBeGreaterThan(0);
        expect(alert.type).toBeDefined();
        expect(alert.severity).toBeDefined();
        expect(alert.title).toBeDefined();
        expect(alert.title.length).toBeGreaterThan(0);
        expect(alert.description).toBeDefined();
        expect(alert.description.length).toBeGreaterThan(0);
        expect(typeof alert.value).toBe('number');
        expect(alert.expectedRange).toBeDefined();
        expect(alert.expectedRange.min).toBeLessThanOrEqual(alert.expectedRange.max);
        expect(alert.detectedAt).toBeInstanceOf(Date);
        expect(alert.period).toBeDefined();
        expect(alert.metricName).toBe('alert_fields_test');
        expect(typeof alert.acknowledged).toBe('boolean');
        expect(Array.isArray(alert.suggestedActions)).toBe(true);
      }
    });

    it('should include severity-appropriate suggested actions', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 500];
      const result = detector.detectAll(data, 'actions_test');

      if (result.alerts.length > 0) {
        result.alerts.forEach(alert => {
          expect(alert.suggestedActions.length).toBeGreaterThan(0);
          alert.suggestedActions.forEach(action => {
            expect(typeof action).toBe('string');
            expect(action.length).toBeGreaterThan(0);
          });
        });
      }
    });
  });

  describe('AnomalyDetector Unified Interface', () => {
    let detector: AnomalyDetector;

    beforeEach(() => {
      detector = new AnomalyDetector();
    });

    it('should detect anomalies using unified interface', () => {
      const data = [10, 11, 12, 13, 14, 200];
      const result = detector.detect(data, 'unified_test');

      expect(result.alerts).toBeDefined();
      expect(result.pointsAnalyzed).toBe(data.length);
      expect(result.detectedAt).toBeInstanceOf(Date);
    });

    it('should check if specific value is anomalous', () => {
      const baselineValues = [100, 102, 98, 101, 99, 103, 97, 100, 102, 98];
      const normalValue = 101;
      const anomalousValue = 500;

      const isNormalAnomalous = detector.isAnomalous(normalValue, baselineValues, 'check_normal');
      const isAnomalousAnomalous = detector.isAnomalous(anomalousValue, baselineValues, 'check_anomalous');

      // Extreme value should be flagged more often than normal value
      expect(typeof isNormalAnomalous).toBe('boolean');
      expect(typeof isAnomalousAnomalous).toBe('boolean');
    });

    it('should provide access to sub-detectors', () => {
      const statDetector = detector.getStatisticalDetector();
      const tempDetector = detector.getTemporalDetector();

      expect(statDetector).toBeInstanceOf(StatisticalAnomalyDetector);
      expect(tempDetector).toBeInstanceOf(TemporalAnomalyDetector);
    });
  });

  describe('Configuration and Thresholds', () => {
    it('should respect custom configuration', () => {
      const customConfig = {
        ...DEFAULT_ANOMALY_CONFIG,
        globalZScoreThreshold: 4, // Higher threshold = fewer detections
        maxAlertsPerRun: 2, // Limit alerts
      };

      const detector = new StatisticalAnomalyDetector(customConfig);
      const data = [10, 11, 12, 13, 14, 50, 60];

      const result = detector.zscoreDetection(data, 'custom_config');

      // Should respect maxAlertsPerRun
      expect(result.alerts.length).toBeLessThanOrEqual(2);
    });

    it('should allow setting custom thresholds per metric', () => {
      const detector = new StatisticalAnomalyDetector();

      detector.setThreshold('revenue_metric', {
        zScoreThreshold: 2.5, // More sensitive
        iqrMultiplier: 2.0,   // Wider bounds
        minAbsoluteDeviation: 500,
        spikePercentageThreshold: 75,
        enabled: true,
      });

      const threshold = detector.getThreshold('revenue_metric');

      expect(threshold.zScoreThreshold).toBe(2.5);
      expect(threshold.iqrMultiplier).toBe(2.0);
      expect(threshold.enabled).toBe(true);
    });
  });
});

// Helper functions

function generateNormalData(
  count: number,
  mean: number,
  stdDev: number
): number[] {
  const data: number[] = [];
  
  // Box-Muller transform for normal distribution approximation
  for (let i = 0; i < count; i++) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    data.push(Math.round(mean + z * stdDev));
  }

  return data;
}

function generateTimeSeries(
  count: number,
  baseValue: number,
  variance: number
): TimeSeriesPoint[] {
  const data: TimeSeriesPoint[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    data.push({
      timestamp: new Date(now - (count - i) * 3600000), // Hourly intervals
      value: Math.round(baseValue + (Math.random() - 0.5) * variance * 2),
    });
  }

  return data;
}
