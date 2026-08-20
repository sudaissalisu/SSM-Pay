/**
 * Type Definitions for Anomaly Detection Module
 * @module ml/anomaly/types
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Enumerations ==============

/**
 * Sensitivity levels for anomaly detection tuning
 */
export enum SensitivityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

/**
 * Categories of anomalies that can be detected
 */
export enum AnomalyCategory {
  STATISTICAL = 'statistical',
  TEMPORAL = 'temporal',
  BEHAVIORAL = 'behavioral',
  GEOGRAPHIC = 'geographic',
  DEVICE = 'device',
  VELOCITY = 'velocity',
  AMOUNT = 'amount'
}

/**
 * Severity levels for detected anomalies
 */
export enum AnomalySeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Types of statistical methods available
 */
export enum StatisticalMethod {
  Z_SCORE = 'z_score',
  IQR = 'iqr',
  MODIFIED_Z_SCORE = 'modified_z_score',
  HYBRID = 'hybrid'
}

// ============== Interfaces ==============

/**
 * Configuration options for the anomaly detector
 */
export interface AnomalyDetectorConfig {
  sensitivity?: SensitivityLevel;
  enableRealTimeDetection?: boolean;
  timeSeriesWindowSize?: number;
  realtimeWindowMs?: number;
  maxHistorySize?: number;
  enableBehavioralAnalysis?: boolean;
  enableGeographicAnalysis?: boolean;
  enableDeviceAnalysis?: boolean;
  customThresholds?: Partial<ThresholdConfig>;
  adaptiveThresholds?: boolean;
  minSamplesRequired?: number;
}

/**
 * Threshold configuration for various detection methods
 */
export interface ThresholdConfig {
  zScoreThreshold: number;
  iqrMultiplier: number;
  modifiedZScoreThreshold: number;
  maxVelocityPerMinute: number;
  maxVelocityPerHour: number;
  maxGeoDistanceKm: number;
  minTimeForDistanceMinutes: number;
  amountDeviationPercent: number;
  timeDeviationStd: number;
  newDeviceRiskThreshold: number;
  newLocationRiskThreshold: number;
}

/**
 * Core transaction data structure for analysis
 */
export interface TransactionData {
  transactionId: string;
  amount: number;
  currency: string;
  timestamp: Date;
  customerId: string;
  deviceFingerprint: string;
  ipAddress: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
  paymentMethod: PaymentMethodType;
  cardBin?: string;
  merchantId: string;
  mcc: string;
  channel: ChannelType;
  userAgent?: string;
  sessionId: string;
}

/**
 * Supported payment method types
 */
export type PaymentMethodType = 
  | 'card' 
  | 'bank_transfer' 
  | 'wallet' 
  | 'ussd' 
  | 'qr_code' 
  | 'bank_debit';

/**
 * Supported channel types
 */
export type ChannelType = 
  | 'web' 
  | 'mobile_web' 
  | 'ios_app' 
  | 'android_app' 
  | 'api' 
  | 'pos';

/**
 * Historical user profile for behavioral analysis
 */
export interface UserProfile {
  customerId: string;
  avgAmount: number;
  stdAmount: number;
  medianAmount: number;
  typicalHours: number[];
  typicalDays: number[];
  knownDevices: Set<string>;
  knownLocations: Set<string>;
  knownIpAddresses: Set<string>;
  preferredMethods: Set<PaymentMethodType>;
  accountAgeDays: number;
  totalTransactions: number;
  lastTransactionDate: Date;
  avgTimeBetweenTxnMinutes: number;
  dailyVelocity: number;
}

/**
 * Device profile for fingerprint analysis
 */
export interface DeviceProfile {
  fingerprint: string;
  firstSeen: Date;
  lastSeen: Date;
  transactionCount: number;
  uniqueCustomers: number;
  customerIds: Set<string>;
  riskScore: number;
  isFlagged: boolean;
  attributes?: DeviceAttributes;
}

/**
 * Device attributes for fingerprinting
 */
export interface DeviceAttributes {
  browserHash?: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  touchSupport?: boolean;
  webglVendor?: string;
  webglRenderer?: string;
}

/**
 * Geographic data point for location analysis
 */
export interface GeoPoint {
  latitude: number;
  longitude: number;
  countryCode: string;
  city?: string;
  region?: string;
  timestamp: Date;
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Result of anomaly analysis for a single detection method
 */
export interface DetectionResult {
  isAnomalous: boolean;
  category: AnomalyCategory;
  severity: AnomalySeverity;
  confidence: number;
  score: number;
  threshold: number;
  actualValue: number;
  description: string;
  details?: Record<string, unknown>;
  detectedAt: Date;
}

/**
 * Comprehensive analysis result combining all detection methods
 */
export interface AnomalyAnalysisResult {
  isAnomalous: boolean;
  riskScore: number;
  overallSeverity: AnomalySeverity;
  detections: DetectionResult[];
  riskFactors: string[];
  recommendedAction: RecommendedAction;
  metadata: AnalysisMetadata;
  analyzedAt: Date;
}

/**
 * Recommended actions based on analysis
 */
export type RecommendedAction = 
  | 'approve'
  | 'approve_with_monitoring'
  | 'require_additional_verification'
  | 'require_step_up_auth'
  | 'decline'
  | 'block_and_investigate';

/**
 * Metadata about the analysis
 */
export interface AnalysisMetadata {
  processingTimeMs: number;
  methodsRun: number;
  flaggingMethods: AnomalyCategory[];
  detectorVersion: string;
  configSnapshot: Partial<AnomalyDetectorConfig>;
}

/**
 * Streaming detection event
 */
export interface StreamingEvent {
  type: 'data' | 'anomaly' | 'warning' | 'error' | 'stats';
  payload: TransactionData | AnomalyAnalysisResult | Error | StreamingStats;
  timestamp: Date;
}

/**
 * Statistics about the streaming detector
 */
export interface StreamingStats {
  totalEventsProcessed: number;
  totalAnomaliesDetected: number;
  currentAnomalyRate: number;
  eventsInWindow: number;
  avgProcessingTimeMs: number;
  uptimeSeconds: number;
}

/**
 * Sliding window buffer for real-time analysis
 */
export interface SlidingWindowBuffer<T> {
  buffer: T[];
  maxSize: number;
  windowMs: number;
  add(item: T): void;
  getAll(): T[];
  size(): number;
  clear(): void;
  getInWindow(now: Date): T[];
}

// ============== Constants ==============

/** Default threshold configuration */
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  zScoreThreshold: 3.0,
  iqrMultiplier: 1.5,
  modifiedZScoreThreshold: 3.5,
  maxVelocityPerMinute: 5,
  maxVelocityPerHour: 20,
  maxGeoDistanceKm: 500,
  minTimeForDistanceMinutes: 30,
  amountDeviationPercent: 200,
  timeDeviationStd: 2.5,
  newDeviceRiskThreshold: 60,
  newLocationRiskThreshold: 50,
};

/** Sensitivity-specific threshold adjustments */
export const SENSITIVITY_ADJUSTMENTS: Record<SensitivityLevel, Partial<ThresholdConfig>> = {
  [SensitivityLevel.LOW]: {
    zScoreThreshold: 4.0,
    iqrMultiplier: 2.0,
    modifiedZScoreThreshold: 4.5,
    amountDeviationPercent: 300,
  },
  [SensitivityLevel.MEDIUM]: {
    zScoreThreshold: 3.0,
    iqrMultiplier: 1.5,
    modifiedZScoreThreshold: 3.5,
    amountDeviationPercent: 200,
  },
  [SensitivityLevel.HIGH]: {
    zScoreThreshold: 2.5,
    iqrMultiplier: 1.25,
    modifiedZScoreThreshold: 3.0,
    amountDeviationPercent: 150,
  },
  [SensitivityLevel.VERY_HIGH]: {
    zScoreThreshold: 2.0,
    iqrMultiplier: 1.0,
    modifiedZScoreThreshold: 2.5,
    amountDeviationPercent: 100,
  },
};

/** Detector version for metadata */
export const DETECTOR_VERSION = '2.0.0';

/** Earth radius in kilometers for distance calculations */
export const EARTH_RADIUS_KM = 6371;
