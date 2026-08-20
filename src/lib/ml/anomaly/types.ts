/**
 * @module anomaly/types
 * @description Type definitions for the anomaly detection system in SSM-Pay.
 * Defines interfaces for statistical and temporal anomaly detection.
 */

/** Types of anomalies that can be detected */
export enum AnomalyType {
  /** Statistical outlier (z-score based) */
  STATISTICAL_OUTLIER = 'STATISTICAL_OUTLIER',
  /** Value outside IQR bounds */
  IQR_OUTLIER = 'IQR_OUTLIER',
  /** Extreme value by Grubbs' test */
  GRUBBS_ANOMALY = 'GRUBBS_ANOMALY',
  /** Sudden spike in values */
  SUDDEN_SPIKE = 'SUDDEN_SPIKE',
  /** Unexpected pattern deviation */
  PATTERN_DEVIATION = 'PATTERN_DEVIATION',
  /** Trend anomaly */
  TREND_ANOMALY = 'TREND_ANOMALY',
  /** Seasonal anomaly */
  SEASONAL_ANOMALY = 'SEASONAL_ANOMALY'
}

/** Severity levels for anomalies */
export enum AnomalySeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/** Alert generated when an anomaly is detected */
export interface AnomalyAlert {
  /** Unique identifier for this alert */
  id: string;
  /** Type of anomaly detected */
  type: AnomalyType;
  /** Severity level */
  severity: AnomalySeverity;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description: string;
  /** The anomalous value that triggered the alert */
  value: number;
  /** Expected/normal value range */
  expectedRange: { min: number; max: number };
  /** How many standard deviations from mean (if applicable) */
  zScore?: number;
  /** When the anomaly was detected */
  detectedAt: Date;
  /** Time period the anomaly relates to */
  period: DetectionWindow;
  /** Metric name being monitored */
  metricName: string;
  /** Additional context */
  metadata?: Record<string, unknown>;
  /** Whether alert has been acknowledged */
  acknowledged: boolean;
  /** Suggested actions */
  suggestedActions: string[];
}

/** Threshold configuration for anomaly detection */
export interface AnomalyThreshold {
  /** Metric this threshold applies to */
  metricName: string;
  /** Z-score threshold for statistical detection (default 3) */
  zScoreThreshold: number;
  /** IQR multiplier for outlier detection (default 1.5) */
  iqrMultiplier: number;
  /** Minimum absolute deviation to flag */
  minAbsoluteDeviation: number;
  /** Minimum percentage change to flag as spike */
  spikePercentageThreshold: number;
  /** Custom minimum/max bounds */
  hardBounds?: { min: number; max: number };
  /** Whether this threshold is enabled */
  enabled: boolean;
}

/** Time window for detection analysis */
export interface DetectionWindow {
  /** Start of the window */
  start: Date;
  /** End of the window */
  end: Date;
  /** Window size in data points or duration */
  size: number;
  /** Unit of size ('points', 'minutes', 'hours', 'days') */
  sizeUnit: 'points' | 'minutes' | 'hours' | 'days';
}

/** Data point for time series analysis */
export interface TimeSeriesPoint {
  /** Timestamp of the data point */
  timestamp: Date;
  /** Value at this timestamp */
  value: number;
  /** Optional label/category */
  label?: string;
}

/** Result of an anomaly detection operation */
export interface AnomalyDetectionResult {
  /** Alerts generated during detection */
  alerts: AnomalyAlert[];
  /** Total data points analyzed */
  pointsAnalyzed: number;
  /** Number of anomalies found */
  anomalyCount: number;
  /** Summary statistics of analyzed data */
  statistics: AnomalyStatistics;
  /** When detection was performed */
  detectedAt: Date;
  /** Detection method used */
  method: DetectionMethod;
}

/** Statistical summary of analyzed data */
export interface AnomalyStatistics {
  /** Mean value */
  mean: number;
  /** Standard deviation */
  stdDev: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Median value */
  median: number;
  /** First quartile (25th percentile) */
  q1: number;
  /** Third quartile (75th percentile) */
  q3: number;
  /** Interquartile range */
  iqr: number;
  /** Total count of data points */
  count: number;
}

/** Methods available for anomaly detection */
export enum DetectionMethod {
  Z_SCORE = 'Z_SCORE',
  IQR = 'IQR',
  GRUBBS = 'GRUBBS',
  TEMPORAL_SPIKE = 'TEMPORAL_SPIKE',
  PATTERN_DEVIATION = 'PATTERN_DEVIATION',
  COMBINED = 'COMBINED'
}

/** Configuration for the anomaly detection system */
export interface AnomalyDetectionConfig {
  /** Global z-score threshold */
  globalZScoreThreshold: number;
  /** Global IQR multiplier */
  globalIqrMultiplier: number;
  /** Spike detection sensitivity (0-1) */
  spikeSensitivity: number;
  /** Pattern deviation sensitivity (0-1) */
  patternSensitivity: number;
  /** Minimum data points required for analysis */
  minDataPoints: number;
  /** Maximum alerts per detection run */
  maxAlertsPerRun: number;
  /** Whether to auto-acknowledge low severity alerts */
  autoAcknowledgeLowSeverity: boolean;
  /** Alert cooldown period in ms (prevent duplicate alerts) */
  alertCooldownMs: number;
}

/** Default configuration values */
export const DEFAULT_ANOMALY_CONFIG: AnomalyDetectionConfig = {
  globalZScoreThreshold: 3,
  globalIqrMultiplier: 1.5,
  spikeSensitivity: 0.7,
  patternSensitivity: 0.6,
  minDataPoints: 10,
  maxAlertsPerRun: 50,
  autoAcknowledgeLowSeverity: true,
  alertCooldownMs: 300000 // 5 minutes
};

/** Default threshold template */
export const DEFAULT_THRESHOLD: Omit<AnomalyThreshold, 'metricName'> = {
  zScoreThreshold: 3,
  iqrMultiplier: 1.5,
  minAbsoluteDeviation: 100,
  spikePercentageThreshold: 50,
  enabled: true
};
