/**
 * Enterprise-Grade Anomaly Detection Module for SSM-Pay Payment Platform
 * 
 * @module ml/anomaly-detector
 * @description Comprehensive ML-based anomaly detection system providing multiple detection
 * algorithms including statistical outlier detection, time series analysis, behavioral profiling,
 * geographic analysis, device fingerprinting, and real-time streaming detection.
 * 
 * @features
 * - Z-Score, IQR, and Modified Z-Score statistical methods
 * - Time series decomposition and trend analysis
 * - User behavioral pattern recognition
 * - Geographic velocity and location anomaly detection
 * - Device fingerprint risk assessment
 * - Real-time streaming with sliding window analysis
 * - Configurable thresholds and sensitivity levels
 * 
 * @example
 * ```typescript
 * import { AnomalyDetector } from '@/lib/ml/anomaly-detector';
 * 
 * const detector = new AnomalyDetector({
 *   sensitivity: 'medium',
 *   enableRealTimeDetection: true,
 * });
 * 
 * const result = await detector.analyzeTransaction(transactionData);
 * if (result.isAnomalous) {
 *   // Handle anomaly
 * }
 * ```
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Enumerations ==============

/**
 * Sensitivity levels for anomaly detection tuning
 * @enum {string}
 */
export enum SensitivityLevel {
  /** Low sensitivity - fewer false positives, may miss subtle anomalies */
  LOW = 'low',
  /** Medium sensitivity - balanced detection */
  MEDIUM = 'medium',
  /** High sensitivity - catches more anomalies, higher false positive rate */
  HIGH = 'high',
  /** Very high sensitivity - maximum detection, use for high-risk scenarios */
  VERY_HIGH = 'very_high'
}

/**
 * Categories of anomalies that can be detected
 * @enum {string}
 */
export enum AnomalyCategory {
  /** Statistical outliers in numerical data */
  STATISTICAL = 'statistical',
  /** Time-based pattern deviations */
  TEMPORAL = 'temporal',
  /** Behavioral pattern deviations */
  BEHAVIORAL = 'behavioral',
  /** Location-based anomalies */
  GEOGRAPHIC = 'geographic',
  /** Device-related anomalies */
  DEVICE = 'device',
  /** Velocity/rate-based anomalies */
  VELOCITY = 'velocity',
  /** Amount-based anomalies */
  AMOUNT = 'amount'
}

/**
 * Severity levels for detected anomalies
 * @enum {string}
 */
export enum AnomalySeverity {
  /** Informational - minor deviation, likely benign */
  INFO = 'info',
  /** Low severity - worth monitoring */
  LOW = 'low',
  /** Medium severity - requires attention */
  MEDIUM = 'medium',
  /** High severity - immediate review needed */
  HIGH = 'high',
  /** Critical severity - block and investigate immediately */
  CRITICAL = 'critical'
}

/**
 * Types of statistical methods available
 * @enum {string}
 */
export enum StatisticalMethod {
  /** Standard Z-Score analysis */
  Z_SCORE = 'z_score',
  /** Interquartile Range method */
  IQR = 'iqr',
  /** Modified Z-Score using MAD */
  MODIFIED_Z_SCORE = 'modified_z_score',
  /** Combination of all methods */
  HYBRID = 'hybrid'
}

// ============== Interfaces ==============

/**
 * Configuration options for the anomaly detector
 * @interface AnomalyDetectorConfig
 */
export interface AnomalyDetectorConfig {
  /** Detection sensitivity level */
  sensitivity?: SensitivityLevel;
  /** Enable real-time streaming detection */
  enableRealTimeDetection?: boolean;
  /** Window size for time series analysis (in data points) */
  timeSeriesWindowSize?: number;
  /** Sliding window size for real-time detection (in milliseconds) */
  realtimeWindowMs?: number;
  /** Maximum number of historical data points to retain */
  maxHistorySize?: number;
  /** Enable behavioral profiling */
  enableBehavioralAnalysis?: boolean;
  /** Enable geographic analysis */
  enableGeographicAnalysis?: boolean;
  /** Enable device fingerprinting */
  enableDeviceAnalysis?: boolean;
  /** Custom threshold overrides */
  customThresholds?: Partial<ThresholdConfig>;
  /** Enable adaptive thresholds that adjust based on historical data */
  adaptiveThresholds?: boolean;
  /** Minimum number of samples required before making predictions */
  minSamplesRequired?: number;
}

/**
 * Threshold configuration for various detection methods
 * @interface ThresholdConfig
 */
export interface ThresholdConfig {
  /** Z-Score threshold for statistical outliers */
  zScoreThreshold: number;
  /** IQR multiplier for outlier detection */
  iqrMultiplier: number;
  /** Modified Z-Score threshold */
  modifiedZScoreThreshold: number;
  /** Maximum allowed velocity (transactions per minute) */
  maxVelocityPerMinute: number;
  /** Maximum allowed velocity per hour */
  maxVelocityPerHour: number;
  /** Maximum distance between consecutive transactions (km) */
  maxGeoDistanceKm: number;
  /** Minimum time between distant locations (minutes) */
  minTimeForDistanceMinutes: number;
  /** Amount deviation percentage threshold */
  amountDeviationPercent: number;
  /** Time deviation threshold (standard deviations) */
  timeDeviationStd: number;
  /** New device risk score threshold */
  newDeviceRiskThreshold: number;
  /** New location risk score threshold */
  newLocationRiskThreshold: number;
}

/**
 * Core transaction data structure for analysis
 * @interface TransactionData
 */
export interface TransactionData {
  /** Unique transaction identifier */
  transactionId: string;
  /** Transaction amount in smallest currency unit (e.g., kobo) */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Transaction timestamp */
  timestamp: Date;
  /** Customer unique identifier (hashed) */
  customerId: string;
  /** Device fingerprint hash */
  deviceFingerprint: string;
  /** IP address (anonymized) */
  ipAddress: string;
  /** ISO 3166-1 alpha-2 country code */
  countryCode: string;
  /** Latitude coordinate (if available) */
  latitude?: number;
  /** Longitude coordinate (if available) */
  longitude?: number;
  /** Payment method used */
  paymentMethod: PaymentMethodType;
  /** Card BIN (first 6 digits) if card payment */
  cardBin?: string;
  /** Merchant identifier */
  merchantId: string;
  /** Merchant category code */
  mcc: string;
  /** Channel through which transaction was initiated */
  channel: ChannelType;
  /** User agent string (hashed) */
  userAgent?: string;
  /** Session identifier */
  sessionId: string;
}

/**
 * Supported payment method types
 * @type PaymentMethodType
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
 * @type ChannelType
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
 * @interface UserProfile
 */
export interface UserProfile {
  /** Customer unique identifier */
  customerId: string;
  /** Average transaction amount */
  avgAmount: number;
  /** Standard deviation of transaction amounts */
  stdAmount: number;
  /** Median transaction amount */
  medianAmount: number;
  /** Typical transaction hours (0-23) */
  typicalHours: number[];
  /** Typical days of week (0-6, Sunday=0) */
  typicalDays: number[];
  /** Known device fingerprints */
  knownDevices: Set<string>;
  /** Known locations (country codes) */
  knownLocations: Set<string>;
  /** Known IP addresses */
  knownIpAddresses: Set<string>;
  /** Preferred payment methods */
  preferredMethods: Set<PaymentMethodType>;
  /** Account age in days */
  accountAgeDays: number;
  /** Total transaction count */
  totalTransactions: number;
  /** Last transaction timestamp */
  lastTransactionDate: Date;
  /** Average time between transactions (minutes) */
  avgTimeBetweenTxnMinutes: number;
  /** Velocity score (avg transactions per day) */
  dailyVelocity: number;
}

/**
 * Device profile for fingerprint analysis
 * @interface DeviceProfile
 */
export interface DeviceProfile {
  /** Device fingerprint hash */
  fingerprint: string;
  /** First seen timestamp */
  firstSeen: Date;
  /** Last seen timestamp */
  lastSeen: Date;
  /** Total transactions from this device */
  transactionCount: number;
  /** Unique customers who used this device */
  uniqueCustomers: number;
  /** Associated customer IDs */
  customerIds: Set<string>;
  /** Risk score (0-100) */
  riskScore: number;
  /** Is this a known fraudulent device? */
  isFlagged: boolean;
  /** Device attributes for comparison */
  attributes?: DeviceAttributes;
}

/**
 * Device attributes for fingerprinting
 * @interface DeviceAttributes
 */
export interface DeviceAttributes {
  /** Browser/user-agent hash */
  browserHash?: string;
  /** Screen resolution */
  screenResolution?: string;
  /** Timezone */
  timezone?: string;
  /** Language preference */
  language?: string;
  /** Platform/OS */
  platform?: string;
  /** Number of cores (if available) */
  hardwareConcurrency?: number;
  /** Device memory (if available) */
  deviceMemory?: number;
  /** Touch support */
  touchSupport?: boolean;
  /** WebGL vendor */
  webglVendor?: string;
  /** WebGL renderer */
  webglRenderer?: string;
}

/**
 * Geographic data point for location analysis
 * @interface GeoPoint
 */
export interface GeoPoint {
  /** Latitude coordinate */
  latitude: number;
  /** Longitude coordinate */
  longitude: number;
  /** Country code */
  countryCode: string;
  /** City name (if available) */
  city?: string;
  /** Region/state (if available) */
  region?: string;
  /** Timestamp of this location data */
  timestamp: Date;
}

/**
 * Time series data point
 * @interface TimeSeriesPoint
 */
export interface TimeSeriesPoint {
  /** Timestamp of the data point */
  timestamp: Date;
  /** Value at this timestamp */
  value: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of anomaly analysis for a single detection method
 * @interface DetectionResult
 */
export interface DetectionResult {
  /** Whether an anomaly was detected */
  isAnomalous: boolean;
  /** Anomaly category */
  category: AnomalyCategory;
  /** Severity level */
  severity: AnomalySeverity;
  /** Confidence score (0-1) */
  confidence: number;
  /** Score representing degree of anomaly */
  score: number;
  /** Threshold that was exceeded */
  threshold: number;
  /** Actual value that triggered the detection */
  actualValue: number;
  /** Human-readable description */
  description: string;
  /** Additional details about the detection */
  details?: Record<string, unknown>;
  /** Timestamp of detection */
  detectedAt: Date;
}

/**
 * Comprehensive analysis result combining all detection methods
 * @interface AnomalyAnalysisResult
 */
export interface AnomalyAnalysisResult {
  /** Overall whether transaction is anomalous */
  isAnomalous: boolean;
  /** Overall risk score (0-100) */
  riskScore: number;
  /** Overall severity level */
  overallSeverity: AnomalySeverity;
  /** Individual detection results */
  detections: DetectionResult[];
  /** Combined risk factors */
  riskFactors: string[];
  /** Recommended action */
  recommendedAction: RecommendedAction;
  /** Analysis metadata */
  metadata: AnalysisMetadata;
  /** Timestamp of analysis */
  analyzedAt: Date;
}

/**
 * Recommended actions based on analysis
 * @enum RecommendedAction
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
 * @interface AnalysisMetadata
 */
export interface AnalysisMetadata {
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Number of detection methods run */
  methodsRun: number;
  /** Methods that flagged anomalies */
  flaggingMethods: AnomalyCategory[];
  /** Version of detector */
  detectorVersion: string;
  /** Configuration used */
  configSnapshot: Partial<AnomalyDetectorConfig>;
}

/**
 * Streaming detection event
 * @interface StreamingEvent
 */
export interface StreamingEvent {
  /** Event type */
  type: 'data' | 'anomaly' | 'warning' | 'error' | 'stats';
  /** Event payload */
  payload: TransactionData | AnomalyAnalysisResult | Error | StreamingStats;
  /** Event timestamp */
  timestamp: Date;
}

/**
 * Statistics about the streaming detector
 * @interface StreamingStats
 */
export interface StreamingStats {
  /** Total events processed */
  totalEventsProcessed: number;
  /** Total anomalies detected */
  totalAnomaliesDetected: number;
  /** Current anomaly rate */
  currentAnomalyRate: number;
  /** Events in current window */
  eventsInWindow: number;
  /** Average processing time */
  avgProcessingTimeMs: number;
  /** Uptime in seconds */
  uptimeSeconds: number;
}

/**
 * Sliding window buffer for real-time analysis
 * @interface SlidingWindowBuffer
 */
export interface SlidingWindowBuffer<T> {
  /** Buffer storage */
  buffer: T[];
  /** Maximum buffer size */
  maxSize: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Add item to buffer */
  add(item: T): void;
  /** Get all items in window */
  getAll(): T[];
  /** Get current size */
  size(): number;
  /** Clear the buffer */
  clear(): void;
  /** Get items within time window */
  getInWindow(now: Date): T[];
}

// ============== Constants ==============

/** Default threshold configuration */
const DEFAULT_THRESHOLDS: ThresholdConfig = {
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
const SENSITIVITY_ADJUSTMENTS: Record<SensitivityLevel, Partial<ThresholdConfig>> = {
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
const DETECTOR_VERSION = '2.0.0';

/** Earth radius in kilometers for distance calculations */
const EARTH_RADIUS_KM = 6371;

// ============== Utility Functions ==============

/**
 * Calculate the mean of an array of numbers
 * @param values - Array of numeric values
 * @returns The arithmetic mean
 * @throws {AppError} If array is empty
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) {
    throw new AppError('Cannot calculate mean of empty array', ErrorCode.VALIDATION_ERROR);
  }
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate the standard deviation of an array of numbers
 * @param values - Array of numeric values
 * @param usePopulation - Whether to use population (N) vs sample (N-1) standard deviation
 * @returns The standard deviation
 * @throws {AppError} If array has fewer than 2 elements
 */
function calculateStandardDeviation(values: number[], usePopulation: boolean = false): number {
  if (values.length < 2) {
    throw new AppError('Cannot calculate standard deviation with fewer than 2 values', ErrorCode.VALIDATION_ERROR);
  }
  const mean = calculateMean(values);
  const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / (usePopulation ? values.length : values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate the median of an array of numbers
 * @param values - Array of numeric values
 * @returns The median value
 * @throws {AppError} If array is empty
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) {
    throw new AppError('Cannot calculate median of empty array', ErrorCode.VALIDATION_ERROR);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate the Median Absolute Deviation (MAD)
 * @param values - Array of numeric values
 * @returns The MAD value
 * @throws {AppError} If array is empty
 */
function calculateMAD(values: number[]): number {
  const median = calculateMedian(values);
  const deviations = values.map(val => Math.abs(val - median));
  return calculateMedian(deviations);
}

/**
 * Calculate quartiles Q1 and Q3
 * @param values - Array of numeric values
 * @returns Object containing Q1 and Q3
 * @throws {AppError} If array has fewer than 4 elements
 */
function calculateQuartiles(values: number[]): { q1: number; q3: number } {
  if (values.length < 4) {
    throw new AppError('Cannot calculate quartiles with fewer than 4 values', ErrorCode.VALIDATION_ERROR);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  return {
    q1: sorted[q1Index],
    q3: sorted[q3Index],
  };
}

/**
 * Calculate the Haversine distance between two geographic points
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS_KM * c;
}

/**
 * Convert degrees to radians
 * @param degrees - Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Clamp a value between minimum and maximum bounds
 * @param value - Value to clamp
 * @param min - Minimum bound
 * @param max - Maximum bound
 * @returns Clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Normalize a value to 0-1 range using min-max normalization
 * @param value - Value to normalize
 * @param min - Minimum possible value
 * @param max - Maximum possible value
 * @returns Normalized value between 0 and 1
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return clamp((value - min) / (max - min), 0, 1);
}

/**
 * Calculate percentile rank of a value in a dataset
 * @param value - Value to find percentile for
 * @param dataset - Dataset to compare against
 * @returns Percentile rank (0-100)
 */
function calculatePercentileRank(value: number, dataset: number[]): number {
  if (dataset.length === 0) return 50;
  const sorted = [...dataset].sort((a, b) => a - b);
  let belowCount = 0;
  for (const val of sorted) {
    if (val < value) belowCount++;
  }
  return (belowCount / sorted.length) * 100;
}

// ============== Main Detector Class ==============

/**
 * Enterprise-grade Anomaly Detector for payment fraud prevention
 * 
 * @class AnomalyDetector
 * @description Provides comprehensive anomaly detection capabilities including
 * statistical analysis, time series analysis, behavioral profiling, geographic
 * analysis, device fingerprinting, and real-time streaming detection.
 * 
 * @example
 * ```typescript
 * const detector = new AnomalyDetector({
 *   sensitivity: SensitivityLevel.HIGH,
 *   enableBehavioralAnalysis: true,
 *   enableGeographicAnalysis: true,
 *   enableDeviceAnalysis: true,
 * });
 * 
 * // Analyze a single transaction
 * const result = await detector.analyzeTransaction(transaction);
 * 
 * // Start real-time monitoring
 * detector.startStreaming();
 * detector.onAnomaly((result) => console.log('Anomaly:', result));
 * ```
 */
export class AnomalyDetector {
  /** Current configuration */
  private config: Required<AnomalyDetectorConfig>;
  
  /** Active threshold configuration */
  private thresholds: ThresholdConfig;
  
  /** Historical data store for time series analysis */
  private timeSeriesData: Map<string, TimeSeriesPoint[]>;
  
  /** User profiles for behavioral analysis */
  private userProfiles: Map<string, UserProfile>;
  
  /** Device profiles for fingerprint analysis */
  private deviceProfiles: Map<string, DeviceProfile>;
  
  /** Geographic history for users */
  private geoHistory: Map<string, GeoPoint[]>;
  
  /** Real-time streaming state */
  private isStreaming: boolean;
  
  /** Streaming statistics */
  private streamingStats: StreamingStats;
  
  /** Streaming start time */
  private streamingStartTime: Date | null;
  
  /** Sliding window buffer for real-time analysis */
  private slidingWindow: SlidingWindowBuffer<TransactionData>;
  
  /** Event listeners for streaming mode */
  private eventListeners: Map<string, ((event: StreamingEvent) => void)[]>;
  
  /** Processing time tracker for stats */
  private recentProcessingTimes: number[];

  /**
   * Create a new AnomalyDetector instance
   * @constructor
   * @param config - Configuration options for the detector
   */
  constructor(config: AnomalyDetectorConfig = {}) {
    // Apply default configuration
    this.config = {
      sensitivity: config.sensitivity || SensitivityLevel.MEDIUM,
      enableRealTimeDetection: config.enableRealTimeDetection || false,
      timeSeriesWindowSize: config.timeSeriesWindowSize || 100,
      realtimeWindowMs: config.realtimeWindowMs || 300000, // 5 minutes
      maxHistorySize: config.maxHistorySize || 10000,
      enableBehavioralAnalysis: config.enableBehavioralAnalysis !== false,
      enableGeographicAnalysis: config.enableGeographicAnalysis !== false,
      enableDeviceAnalysis: config.enableDeviceAnalysis !== false,
      customThresholds: config.customThresholds || {},
      adaptiveThresholds: config.adaptiveThresholds || false,
      minSamplesRequired: config.minSamplesRequired || 10,
    };

    // Initialize thresholds with sensitivity adjustments
    this.thresholds = this.initializeThresholds();

    // Initialize data stores
    this.timeSeriesData = new Map();
    this.userProfiles = new Map();
    this.deviceProfiles = new Map();
    this.geoHistory = new Map();
    
    // Initialize streaming state
    this.isStreaming = false;
    this.streamingStartTime = null;
    this.eventListeners = new Map();
    this.recentProcessingTimes = [];
    
    // Initialize streaming statistics
    this.streamingStats = {
      totalEventsProcessed: 0,
      totalAnomaliesDetected: 0,
      currentAnomalyRate: 0,
      eventsInWindow: 0,
      avgProcessingTimeMs: 0,
      uptimeSeconds: 0,
    };

    // Initialize sliding window buffer
    this.slidingWindow = this.createSlidingWindow<TransactionData>(
      this.config.maxHistorySize,
      this.config.realtimeWindowMs
    );

    logger.info('AnomalyDetector initialized', {
      event: 'anomaly_detector.init',
      metadata: {
        sensitivity: this.config.sensitivity,
        version: DETECTOR_VERSION,
        features: {
          behavioral: this.config.enableBehavioralAnalysis,
          geographic: this.config.enableGeographicAnalysis,
          device: this.config.enableDeviceAnalysis,
          realtime: this.config.enableRealTimeDetection,
          adaptive: this.config.adaptiveThresholds,
        },
      },
    });
  }

  /**
   * Initialize thresholds based on configuration and sensitivity
   * @private
   * @returns Initialized threshold configuration
   */
  private initializeThresholds(): ThresholdConfig {
    const baseThresholds = { ...DEFAULT_THRESHOLDS };
    const sensitivityAdjustments = SENSITIVITY_ADJUSTMENTS[this.config.sensitivity] || {};
    const customThresholds = this.config.customThresholds || {};
    
    return {
      ...baseThresholds,
      ...sensitivityAdjustments,
      ...customThresholds,
    } as ThresholdConfig;
  }

  /**
   * Create a sliding window buffer for real-time analysis
   * @private
   * @template T - Type of items in the buffer
   * @param maxSize - Maximum number of items
   * @param windowMs - Window duration in milliseconds
   * @returns Sliding window buffer instance
   */
  private createSlidingWindow<T>(maxSize: number, windowMs: number): SlidingWindowBuffer<T> {
    return {
      buffer: [],
      maxSize,
      windowMs,
      add(item: T): void {
        this.buffer.push(item);
        if (this.buffer.length > this.maxSize) {
          this.buffer.shift();
        }
      },
      getAll(): T[] {
        return [...this.buffer];
      },
      size(): number {
        return this.buffer.length;
      },
      clear(): void {
        this.buffer = [];
      },
      getInWindow(now: Date): T[] {
        const windowStart = new Date(now.getTime() - this.windowMs);
        // Type assertion for timestamp access
        return this.buffer.filter((item) => {
          const typedItem = item as unknown as { timestamp: Date };
          return typedItem.timestamp >= windowStart;
        });
      },
    };
  }

  // ============== Public API Methods ==============

  /**
   * Analyze a single transaction for anomalies
   * 
   * @async
   * @param transaction - Transaction data to analyze
   * @returns Comprehensive anomaly analysis result
   * @throws {AppError} If transaction data is invalid or analysis fails
   * 
   * @example
   * ```typescript
   * const result = await detector.analyzeTransaction({
   *   transactionId: 'txn_123',
   *   amount: 50000,
   *   currency: 'NGN',
   *   timestamp: new Date(),
   *   customerId: 'customer_hash',
   *   // ... other fields
   * });
   * 
   * if (result.isAnomalous) {
   *   console.log(`Risk Score: ${result.riskScore}`);
   *   console.log(`Recommended Action: ${result.recommendedAction}`);
   * }
   * ```
   */
  async analyzeTransaction(transaction: TransactionData): Promise<AnomalyAnalysisResult> {
    const startTime = performance.now();
    
    try {
      // Validate input
      this.validateTransaction(transaction);
      
      logger.debug('Starting transaction analysis', {
        event: 'analyzer.analysis.start',
        metadata: {
          transactionId: transaction.transactionId,
          customerId: transaction.customerId,
          amount: transaction.amount,
        },
      });

      const detections: DetectionResult[] = [];
      let methodsRunCount = 0;
      
      // Add to sliding window for velocity analysis
      this.slidingWindow.add(transaction);
      
      // Run all enabled detection methods
      detections.push(...this.runStatisticalAnalysis(transaction));
      methodsRunCount++;
      detections.push(...this.runTemporalAnalysis(transaction));
      methodsRunCount++;
      
      if (this.config.enableBehavioralAnalysis) {
        detections.push(...this.runBehavioralAnalysis(transaction));
        methodsRunCount++;
      }
      
      if (this.config.enableGeographicAnalysis) {
        detections.push(...this.runGeographicAnalysis(transaction));
        methodsRunCount++;
      }
      
      if (this.config.enableDeviceAnalysis) {
        detections.push(...this.runDeviceAnalysis(transaction));
        methodsRunCount++;
      }
      
      detections.push(...this.runVelocityAnalysis(transaction));
      methodsRunCount++;

      // Compile final result (pass methodsRunCount)
      const result = this.compileAnalysisResult(detections, startTime, methodsRunCount);

      // Update internal state with this transaction
      this.updateInternalState(transaction);

      // Emit event if streaming and anomalous
      if (this.isStreaming && result.isAnomalous) {
        this.emitEvent({ type: 'anomaly', payload: result, timestamp: new Date() });
        this.streamingStats.totalAnomaliesDetected++;
      }

      logger.debug('Transaction analysis complete', {
        event: 'analyzer.analysis.complete',
        metadata: {
          transactionId: transaction.transactionId,
          isAnomalous: result.isAnomalous,
          riskScore: result.riskScore,
          processingTimeMs: result.metadata.processingTimeMs,
        },
      });

      return result;
    } catch (error) {
      const appError = error instanceof AppError 
        ? error 
        : new AppError('Transaction analysis failed', ErrorCode.UNKNOWN_ERROR, { cause: error as Error });
      
      logger.error('Transaction analysis error', {
        event: 'analyzer.analysis.error',
        error: appError,
        metadata: { transactionId: transaction.transactionId },
      });

      throw appError;
    }
  }

  /**
   * Analyze a batch of transactions for anomalies
   * 
   * @async
   * @param transactions - Array of transaction data to analyze
   * @returns Array of analysis results
   * @throws {AppError} If batch analysis fails
   */
  async analyzeBatch(transactions: TransactionData[]): Promise<AnomalyAnalysisResult[]> {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      throw new AppError('Transactions array cannot be empty', ErrorCode.VALIDATION_ERROR);
    }

    logger.info('Starting batch analysis', {
      event: 'analyzer.batch.start',
      metadata: { count: transactions.length },
    });

    const results: AnomalyAnalysisResult[] = [];
    
    for (const transaction of transactions) {
      try {
        const result = await this.analyzeTransaction(transaction);
        results.push(result);
      } catch (error) {
        logger.warn('Failed to analyze transaction in batch', {
          event: 'analyzer.batch.item_error',
          metadata: { transactionId: transaction.transactionId },
          error: error as Error,
        });
        // Continue with other transactions
      }
    }

    const anomalyCount = results.filter(r => r.isAnomalous).length;
    logger.info('Batch analysis complete', {
      event: 'analyzer.batch.complete',
      metadata: {
        total: results.length,
        anomalous: anomalyCount,
        clean: results.length - anomalyCount,
      },
    });

    return results;
  }

  /**
   * Detect anomalies in a numerical dataset using statistical methods
   * 
   * @param values - Array of numerical values to analyze
   * @param method - Statistical method to use
   * @returns Array of indices and scores for anomalous values
   * @throws {AppError} If analysis fails or insufficient data
   */
  detectStatisticalOutliers(
    values: number[],
    method: StatisticalMethod = StatisticalMethod.HYBRID
  ): Array<{ index: number; value: number; score: number; isOutlier: boolean }> {
    if (!Array.isArray(values) || values.length < this.config.minSamplesRequired) {
      throw new AppError(
        `Insufficient data: ${values?.length || 0} values provided, minimum ${this.config.minSamplesRequired} required`,
        ErrorCode.VALIDATION_ERROR
      );
    }

    const results: Array<{ index: number; value: number; score: number; isOutlier: boolean }> = 
      values.map((value, index) => ({ index, value, score: 0, isOutlier: false }));

    switch (method) {
      case StatisticalMethod.Z_SCORE:
        this.applyZScoreDetection(values, results);
        break;
      case StatisticalMethod.IQR:
        this.applyIQRDetection(values, results);
        break;
      case StatisticalMethod.MODIFIED_Z_SCORE:
        this.applyModifiedZScoreDetection(values, results);
        break;
      case StatisticalMethod.HYBRID:
        // Apply all methods and combine results
        this.applyZScoreDetection(values, results);
        this.applyIQRDetection(values, results);
        this.applyModifiedZScoreDetection(values, results);
        // Mark as outlier if any method flags it
        results.forEach(r => {
          r.isOutlier = r.score > 1;
        });
        break;
    }

    return results;
  }

  /**
   * Detect anomalies in time series data
   * 
   * @param data - Time series data points
   * @param options - Analysis options
   * @returns Array of anomalous points
   */
  detectTimeSeriesAnomalies(
    data: TimeSeriesPoint[],
    options: {
      seasonalityPeriod?: number;
      trendSensitivity?: number;
    } = {}
  ): TimeSeriesPoint[] {
    if (!Array.isArray(data) || data.length < this.config.minSamplesRequired) {
      logger.warn('Insufficient time series data for analysis');
      return [];
    }

    const seasonalityPeriod = options.seasonalityPeriod || 24; // Default: hourly seasonality
    const trendSensitivity = options.trendSensitivity || 2.0;

    const values = data.map(d => d.value);
    const outliers = this.detectStatisticalOutliers(values, StatisticalMethod.HYBRID);
    
    const anomalousIndices = new Set(
      outliers.filter(o => o.isOutlier).map(o => o.index)
    );

    // Additional time-series specific checks
    const anomalousPoints: TimeSeriesPoint[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (anomalousIndices.has(i)) {
        anomalousPoints.push(data[i]);
        continue;
      }

      // Check for sudden changes (point-to-point difference)
      if (i > 0) {
        const prevValue = data[i - 1].value;
        const currValue = data[i].value;
        const changePercent = prevValue !== 0 
          ? Math.abs((currValue - prevValue) / prevValue) * 100 
          : 0;
        
        if (changePercent > 100 * trendSensitivity) {
          anomalousPoints.push(data[i]);
        }
      }
    }

    return anomalousPoints;
  }

  /**
   * Start real-time streaming anomaly detection
   * 
   * @description Begins listening for incoming transactions and analyzing them
   * in real-time using a sliding window approach.
   */
  startStreaming(): void {
    if (this.isStreaming) {
      logger.warn('Streaming already active');
      return;
    }

    this.isStreaming = true;
    this.streamingStartTime = new Date();
    
    logger.info('Real-time streaming started', {
      event: 'analyzer.streaming.started',
      metadata: {
        windowMs: this.config.realtimeWindowMs,
        maxSize: this.config.maxHistorySize,
      },
    });
  }

  /**
   * Stop real-time streaming anomaly detection
   */
  stopStreaming(): void {
    if (!this.isStreaming) {
      logger.warn('Streaming not active');
      return;
    }

    this.isStreaming = false;
    
    logger.info('Real-time streaming stopped', {
      event: 'analyzer.streaming.stopped',
      metadata: {
        totalEventsProcessed: this.streamingStats.totalEventsProcessed,
        totalAnomaliesDetected: this.streamingStats.totalAnomaliesDetected,
        uptimeSeconds: this.streamingStats.uptimeSeconds,
      },
    });
  }

  /**
   * Process a transaction in streaming mode
   * 
   * @async
   * @param transaction - Transaction to process
   * @returns Analysis result (same as analyzeTransaction but optimized for streaming)
   */
  async processStreamEvent(transaction: TransactionData): Promise<AnalysisResult> {
    const startTime = performance.now();
    
    try {
      // Add to sliding window
      this.slidingWindow.add(transaction);
      
      // Update streaming stats
      this.streamingStats.totalEventsProcessed++;
      this.streamingStats.eventsInWindow = this.slidingWindow.size();
      
      // Get recent transactions for context
      const recentTransactions = this.slidingWindow.getAll();
      
      // Run quick analysis optimized for streaming
      const result = await this.analyzeTransaction(transaction);
      
      // Track processing time
      const processingTime = performance.now() - startTime;
      this.recentProcessingTimes.push(processingTime);
      if (this.recentProcessingTimes.length > 100) {
        this.recentProcessingTimes.shift();
      }
      this.streamingStats.avgProcessingTimeMs = 
        this.recentProcessingTimes.reduce((a, b) => a + b, 0) / this.recentProcessingTimes.length;
      
      // Update anomaly rate
      this.streamingStats.currentAnomalyRate = 
        this.streamingStats.totalEventsProcessed > 0
          ? this.streamingStats.totalAnomaliesDetected / this.streamingStats.totalEventsProcessed
          : 0;
      
      // Update uptime
      if (this.streamingStartTime) {
        this.streamingStats.uptimeSeconds = 
          (Date.now() - this.streamingStartTime.getTime()) / 1000;
      }
      
      // Emit data event
      this.emitEvent({ type: 'data', payload: transaction, timestamp: new Date() });
      
      return result;
    } catch (error) {
      this.emitEvent({ 
        type: 'error', 
        payload: error instanceof Error ? error : new Error(String(error)), 
        timestamp: new Date() 
      });
      throw error;
    }
  }

  /**
   * Register an event listener for streaming events
   * 
   * @param eventType - Type of event to listen for
   * @param callback - Callback function to invoke when event occurs
   */
  on(eventType: 'anomaly' | 'data' | 'error' | 'warning' | 'stats', callback: (event: StreamingEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Remove an event listener
   * 
   * @param eventType - Type of event
   * @param callback - Callback function to remove
   */
  off(eventType: string, callback: (event: StreamingEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Get current streaming statistics
   * 
   * @returns Current streaming statistics
   */
  getStreamingStats(): StreamingStats {
    return { ...this.streamingStats };
  }

  /**
   * Update user profile with transaction data
   * 
   * @param transaction - Transaction to incorporate into profile
   */
  updateUserProfile(transaction: TransactionData): void {
    const existingProfile = this.userProfiles.get(transaction.customerId);
    
    if (existingProfile) {
      // Update existing profile
      const n = existingProfile.totalTransactions;
      const newAvgAmount = (existingProfile.avgAmount * n + transaction.amount) / (n + 1);
      
      // Update standard deviation using online algorithm (Welford's method)
      // For simplicity, we'll use a approximation based on the difference from mean
      const diffFromMean = Math.abs(transaction.amount - existingProfile.avgAmount);
      const newStdAmount = Math.sqrt(
        (existingProfile.stdAmount * existingProfile.stdAmount * (n - 1) + diffFromMean * diffFromMean) / n
      );
      
      // Update typical hours
      const hour = transaction.timestamp.getHours();
      if (!existingProfile.typicalHours.includes(hour)) {
        existingProfile.typicalHours.push(hour);
      }
      
      // Update typical days
      const day = transaction.timestamp.getDay();
      if (!existingProfile.typicalDays.includes(day)) {
        existingProfile.typicalDays.push(day);
      }
      
      // Update known devices
      existingProfile.knownDevices.add(transaction.deviceFingerprint);
      
      // Update known locations
      existingProfile.knownLocations.add(transaction.countryCode);
      
      // Update preferred methods
      existingProfile.preferredMethods.add(transaction.paymentMethod);
      
      // Update timing
      const timeDiff = transaction.timestamp.getTime() - existingProfile.lastTransactionDate.getTime();
      existingProfile.avgTimeBetweenTxnMinutes = 
        (existingProfile.avgTimeBetweenTxnMinutes * n + timeDiff / 60000) / (n + 1);
      
      existingProfile.avgAmount = newAvgAmount;
      existingProfile.stdAmount = newStdAmount || 0; // Ensure it's at least 0
      // Set minimum std to avoid division by zero issues if all amounts are same
      if (existingProfile.stdAmount === 0 && n > 1) {
        existingProfile.stdAmount = existingProfile.avgAmount * 0.1; // Assume 10% variation
      }
      existingProfile.totalTransactions = n + 1;
      existingProfile.lastTransactionDate = transaction.timestamp;
      existingProfile.dailyVelocity = existingProfile.totalTransactions / Math.max(existingProfile.accountAgeDays, 1);
    } else {
      // Create new profile
      const newProfile: UserProfile = {
        customerId: transaction.customerId,
        avgAmount: transaction.amount,
        stdAmount: 0,
        medianAmount: transaction.amount,
        typicalHours: [transaction.timestamp.getHours()],
        typicalDays: [transaction.timestamp.getDay()],
        knownDevices: new Set([transaction.deviceFingerprint]),
        knownLocations: new Set([transaction.countryCode]),
        knownIpAddresses: new Set([transaction.ipAddress]),
        preferredMethods: new Set([transaction.paymentMethod]),
        accountAgeDays: 1,
        totalTransactions: 1,
        lastTransactionDate: transaction.timestamp,
        avgTimeBetweenTxnMinutes: 0,
        dailyVelocity: 1,
      };
      
      this.userProfiles.set(transaction.customerId, newProfile);
    }
    
    logger.debug('User profile updated', {
      event: 'analyzer.profile.updated',
      metadata: { customerId: transaction.customerId },
    });
  }

  /**
   * Get user's current risk profile
   * 
   * @param customerId - Customer identifier
   * @returns User profile or null if not found
   */
  getUserProfile(customerId: string): UserProfile | null {
    return this.userProfiles.get(customerId) || null;
  }

  /**
   * Update detector configuration
   * 
   * @param configUpdates - Partial configuration updates to apply
   */
  updateConfiguration(configUpdates: Partial<AnomalyDetectorConfig>): void {
    Object.assign(this.config, configUpdates);
    
    // Reinitialize thresholds if sensitivity changed
    if (configUpdates.sensitivity || configUpdates.customThresholds) {
      this.thresholds = this.initializeThresholds();
    }
    
    logger.info('Detector configuration updated', {
      event: 'analyzer.config.updated',
      metadata: { updates: Object.keys(configUpdates) },
    });
  }

  /**
   * Get current detector configuration (without sensitive data)
   * 
   * @returns Current configuration snapshot
   */
  getConfiguration(): Readonly<Partial<AnomalyDetectorConfig>> {
    return { ...this.config };
  }

  /**
   * Get current threshold configuration
   * 
   * @returns Current thresholds
   */
  getThresholds(): Readonly<ThresholdConfig> {
    return { ...this.thresholds };
  }

  /**
   * Reset all internal state (for testing purposes)
   */
  resetState(): void {
    this.timeSeriesData.clear();
    this.userProfiles.clear();
    this.deviceProfiles.clear();
    this.geoHistory.clear();
    this.slidingWindow.clear();
    this.recentProcessingTimes = [];
    this.streamingStats = {
      totalEventsProcessed: 0,
      totalAnomaliesDetected: 0,
      currentAnomalyRate: 0,
      eventsInWindow: 0,
      avgProcessingTimeMs: 0,
      uptimeSeconds: 0,
    };
    
    logger.info('Detector state reset', { event: 'analyzer.state.reset' });
  }

  // ============== Private Analysis Methods ==============

  /**
   * Validate transaction data structure
   * @private
   * @param transaction - Transaction to validate
   * @throws {AppError} If validation fails
   */
  private validateTransaction(transaction: TransactionData): void {
    const requiredFields: (keyof TransactionData)[] = [
      'transactionId',
      'amount',
      'currency',
      'timestamp',
      'customerId',
      'deviceFingerprint',
      'ipAddress',
      'countryCode',
      'paymentMethod',
      'merchantId',
      'mcc',
      'channel',
      'sessionId',
    ];

    const missingFields = requiredFields.filter(
      field => !transaction[field] && transaction[field] !== 0
    );

    if (missingFields.length > 0) {
      throw new AppError(
        `Missing required transaction fields: ${missingFields.join(', ')}`,
        ErrorCode.VALIDATION_ERROR,
        { context: { missingFields } }
      );
    }

    if (transaction.amount < 0) {
      throw new AppError(
        'Transaction amount cannot be negative',
        ErrorCode.VALIDATION_ERROR
      );
    }

    if (!(transaction.timestamp instanceof Date) || isNaN(transaction.timestamp.getTime())) {
      throw new AppError(
        'Invalid transaction timestamp',
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Run statistical outlier detection on transaction
   * @private
   * @param transaction - Transaction to analyze
   * @returns Array of detection results
   */
  private runStatisticalAnalysis(transaction: TransactionData): DetectionResult[] {
    const results: DetectionResult[] = [];
    const customerId = transaction.customerId;
    
    // Check for extremely large amounts (absolute threshold, no history needed)
    // This catches obvious anomalies like system max values or unreasonably large transactions
    const EXTREME_AMOUNT_THRESHOLD = 10000000; // 10 million in smallest currency unit
    if (transaction.amount > EXTREME_AMOUNT_THRESHOLD) {
      results.push({
        isAnomalous: true,
        category: AnomalyCategory.STATISTICAL,
        severity: AnomalySeverity.CRITICAL,
        confidence: Math.min(transaction.amount / EXTREME_AMOUNT_THRESHOLD / 10, 1),
        score: transaction.amount / EXTREME_AMOUNT_THRESHOLD,
        threshold: EXTREME_AMOUNT_THRESHOLD,
        actualValue: transaction.amount,
        description: `Extremely large transaction amount detected`,
        details: { 
          amount: transaction.amount,
          threshold: EXTREME_AMOUNT_THRESHOLD,
          method: 'extreme_amount_check',
        },
        detectedAt: new Date(),
      });
    }
    
    // Get historical amounts for this user
    const userHistoryKey = `amounts:${customerId}`;
    let historicalAmounts = this.timeSeriesData.get(userHistoryKey)?.map(p => p.value) || [];
    
    // Add current transaction for analysis
    const allAmounts = [...historicalAmounts, transaction.amount];
    
    if (allAmounts.length >= this.config.minSamplesRequired) {
      // Z-Score Analysis
      try {
        const mean = calculateMean(historicalAmounts);
        const std = calculateStandardDeviation(historicalAmounts);
        
        if (std > 0) {
          const zScore = Math.abs((transaction.amount - mean) / std);
          
          if (zScore > this.thresholds.zScoreThreshold) {
            results.push({
              isAnomalous: true,
              category: AnomalyCategory.STATISTICAL,
              severity: this.scoreToSeverity(zScore / this.thresholds.zScoreThreshold),
              confidence: clamp(zScore / (this.thresholds.zScoreThreshold * 2), 0, 1),
              score: zScore,
              threshold: this.thresholds.zScoreThreshold,
              actualValue: transaction.amount,
              description: `Transaction amount Z-score (${zScore.toFixed(2)}) exceeds threshold`,
              details: { mean, stdDev: std, method: 'z_score' },
              detectedAt: new Date(),
            });
          }
        }
      } catch (error) {
        logger.warn('Z-score calculation failed', { event: 'analyzer.zscore.error', error: error as Error });
      }
      
      // IQR Analysis
      try {
        const { q1, q3 } = calculateQuartiles(allAmounts);
        const iqr = q3 - q1;
        const lowerBound = q1 - this.thresholds.iqrMultiplier * iqr;
        const upperBound = q3 + this.thresholds.iqrMultiplier * iqr;
        
        if (transaction.amount < lowerBound || transaction.amount > upperBound) {
          const deviation = transaction.amount > upperBound 
            ? transaction.amount - upperBound 
            : lowerBound - transaction.amount;
            
          results.push({
            isAnomalous: true,
            category: AnomalyCategory.STATISTICAL,
            severity: deviation > iqr ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM,
            confidence: clamp(deviation / (iqr * 2), 0, 1),
            score: deviation / iqr,
            threshold: this.thresholds.iqrMultiplier,
            actualValue: transaction.amount,
            description: `Transaction amount outside IQR bounds [${lowerBound}, ${upperBound}]`,
            details: { q1, q3, iqr, lowerBound, upperBound, method: 'iqr' },
            detectedAt: new Date(),
          });
        }
      } catch (error) {
        logger.warn('IQR calculation failed', { event: 'analyzer.iqr.error', error: error as Error });
      }
      
      // Modified Z-Score (using MAD)
      try {
        const mad = calculateMAD(historicalAmounts);
        const median = calculateMedian(historicalAmounts);
        
        if (mad > 0) {
          const modifiedZScore = (0.6745 * (transaction.amount - median)) / mad;
          const absModifiedZScore = Math.abs(modifiedZScore);
          
          if (absModifiedZScore > this.thresholds.modifiedZScoreThreshold) {
            results.push({
              isAnomalous: true,
              category: AnomalyCategory.STATISTICAL,
              severity: this.scoreToSeverity(absModifiedZScore / this.thresholds.modifiedZScoreThreshold),
              confidence: clamp(absModifiedZScore / (this.thresholds.modifiedZScoreThreshold * 2), 0, 1),
              score: absModifiedZScore,
              threshold: this.thresholds.modifiedZScoreThreshold,
              actualValue: transaction.amount,
              description: `Modified Z-score (${absModifiedZScore.toFixed(2)}) exceeds threshold`,
              details: { median, mad, method: 'modified_z_score' },
              detectedAt: new Date(),
            });
          }
        }
      } catch (error) {
        logger.warn('Modified Z-score calculation failed', { 
          event: 'analyzer.modified_zscore.error', 
          error: error as Error 
        });
      }
    }
    
    return results;
  }

  /**
   * Run temporal/time-based analysis on transaction
   * @private
   * @param transaction - Transaction to analyze
   * @returns Array of detection results
   */
  private runTemporalAnalysis(transaction: TransactionData): DetectionResult[] {
    const results: DetectionResult[] = [];
    const profile = this.userProfiles.get(transaction.customerId);
    
    if (!profile || profile.totalTransactions < 5) {
      return results;
    }
    
    const txnHour = transaction.timestamp.getHours();
    const txnDay = transaction.timestamp.getDay();
    
    // Check if transaction time is unusual for this user
    if (profile.typicalHours.length > 0 && !profile.typicalHours.includes(txnHour)) {
      // Calculate how unusual this hour is
      const hourDeviation = this.calculateHourDeviation(txnHour, profile.typicalHours);
      
      if (hourDeviation > this.thresholds.timeDeviationStd / 2) { // More sensitive for unusual hour detection
        results.push({
          isAnomalous: true,
          category: AnomalyCategory.TEMPORAL,
          severity: AnomalySeverity.LOW,
          confidence: clamp(hourDeviation / (this.thresholds.timeDeviationStd * 2), 0, 1),
          score: hourDeviation,
          threshold: this.thresholds.timeDeviationStd / 2,
          actualValue: txnHour,
          description: `Unusual transaction hour (${txnHour}:00) for user`,
          details: { 
            typicalHours: profile.typicalHours, 
            currentHour: txnHour,
            deviation: hourDeviation,
          },
          detectedAt: new Date(),
        });
      }
    }
    
    // Check if day of week is unusual
    if (profile.typicalDays.length > 0 && !profile.typicalDays.includes(txnDay)) {
      results.push({
        isAnomalous: true,
        category: AnomalyCategory.TEMPORAL,
        severity: AnomalySeverity.INFO,
        confidence: 0.5,
        score: 1,
        threshold: 0,
        actualValue: txnDay,
        description: `Transaction on unusual day of week for user`,
        details: { typicalDays: profile.typicalDays, currentDay: txnDay },
        detectedAt: new Date(),
      });
    }
    
    // Check time since last transaction
    const timeSinceLastTxn = transaction.timestamp.getTime() - profile.lastTransactionDate.getTime();
    const timeSinceLastMinutes = timeSinceLastTxn / 60000;
    
    if (profile.avgTimeBetweenTxnMinutes > 0) {
      const timeRatio = timeSinceLastMinutes / profile.avgTimeBetweenTxnMinutes;
      
      // Flag if transaction happens much sooner than expected (potential automated attack)
      if (timeRatio < 0.1 && timeSinceLastMinutes < 1) {
        results.push({
          isAnomalous: true,
          category: AnomalyCategory.TEMPORAL,
          severity: AnomalySeverity.HIGH,
          confidence: 0.9,
          score: 1 / Math.max(timeRatio, 0.01),
          threshold: 0.1,
          actualValue: timeSinceLastMinutes,
          description: 'Rapid successive transactions detected',
          details: { 
            timeSinceLastMinutes: timeSinceLastMinutes.toFixed(2),
            averageInterval: profile.avgTimeBetweenTxnMinutes,
          },
          detectedAt: new Date(),
        });
      }
    }
    
    return results;
  }

  /**
   * Run behavioral analysis on transaction
   * @private
   * @param transaction - Transaction to analyze
   * @returns Array of detection results
   */
  private runBehavioralAnalysis(transaction: TransactionData): DetectionResult[] {
    const results: DetectionResult[] = [];
    const profile = this.userProfiles.get(transaction.customerId);
    
    if (!profile || profile.totalTransactions < 3) {
      return results;
    }
    
    // Amount deviation analysis
    if (profile.stdAmount > 0) {
      const amountDeviation = Math.abs(transaction.amount - profile.avgAmount) / profile.stdAmount;
      const percentDeviation = Math.abs((transaction.amount - profile.avgAmount) / profile.avgAmount) * 100;
      
      if (percentDeviation > this.thresholds.amountDeviationPercent) {
        results.push({
          isAnomalous: true,
          category: AnomalyCategory.BEHAVIORAL,
          severity: percentDeviation > this.thresholds.amountDeviationPercent * 2 
            ? AnomalySeverity.HIGH 
            : AnomalySeverity.MEDIUM,
          confidence: clamp(percentDeviation / (this.thresholds.amountDeviationPercent * 2), 0, 1),
          score: amountDeviation,
          threshold: this.thresholds.amountDeviationPercent,
          actualValue: transaction.amount,
          description: `Transaction amount deviates ${percentDeviation.toFixed(1)}% from user average`,
          details: {
            userAverage: profile.avgAmount,
            userStdDev: profile.stdAmount,
            percentDeviation: percentDeviation.toFixed(2),
          },
          detectedAt: new Date(),
        });
      }
    }
    
    // New payment method check
    if (!profile.preferredMethods.has(transaction.paymentMethod)) {
      results.push({
        isAnomalous: true,
        category: AnomalyCategory.BEHAVIORAL,
        severity: AnomalySeverity.LOW,
        confidence: 0.6,
        score: 1,
        threshold: 0,
        actualValue: 0,
        description: `Using new payment method: ${transaction.paymentMethod}`,
        details: {
          newMethod: transaction.paymentMethod,
          usualMethods: Array.from(profile.preferredMethods),
        },
        detectedAt: new Date(),
      });
    }
    
    // Velocity check against user's normal behavior
    const expectedDailyTxns = profile.dailyVelocity;
    if (expectedDailyTxns > 0) {
      // This would typically compare against recent transaction count
      // For now, we log the velocity for potential future alerts
      logger.debug('Behavioral velocity check', {
        event: 'analyzer.behavioral.velocity',
        metadata: {
          customerId: transaction.customerId,
          dailyVelocity: profile.dailyVelocity,
          expectedDaily: expectedDailyTxns,
        },
      });
    }
    
    return results;
  }

  /**
   * Run geographic analysis on transaction
   * @private
   * @param transaction - Transaction to analyze
   * @returns Array of detection results
   */
  private runGeographicAnalysis(transaction: TransactionData): DetectionResult[] {
    const results: DetectionResult[] = [];
    const profile = this.userProfiles.get(transaction.customerId);
    
    if (!profile) {
      return results;
    }
    
    // New country check
    const isNewCountry = !profile.knownLocations.has(transaction.countryCode);
    
    if (isNewCountry && profile.knownLocations.size > 0) {
      const riskScore = this.calculateLocationRisk(transaction.countryCode, profile);
      
      if (riskScore > this.thresholds.newLocationRiskThreshold) {
        results.push({
          isAnomalous: true,
          category: AnomalyCategory.GEOGRAPHIC,
          severity: riskScore > 80 ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM,
          confidence: clamp(riskScore / 100, 0, 1),
          score: riskScore,
          threshold: this.thresholds.newLocationRiskThreshold,
          actualValue: riskScore,
          description: `Transaction from new/unusual location: ${transaction.countryCode}`,
          details: {
            newCountry: transaction.countryCode,
            knownCountries: Array.from(profile.knownLocations),
            riskScore,
          },
          detectedAt: new Date(),
        });
      }
    }
    
    // Distance/velocity analysis if coordinates available
    if (transaction.latitude && transaction.longitude) {
      const userGeoHistory = this.geoHistory.get(transaction.customerId) || [];
      
      if (userGeoHistory.length > 0) {
        const lastLocation = userGeoHistory[userGeoHistory.length - 1];
        const distance = calculateHaversineDistance(
          lastLocation.latitude,
          lastLocation.longitude,
          transaction.latitude,
          transaction.longitude
        );
        
        const timeDiffMinutes = (transaction.timestamp.getTime() - lastLocation.timestamp.getTime()) / 60000;
        
        // Check for impossible travel
        if (distance > this.thresholds.maxGeoDistanceKm) {
          if (timeDiffMinutes < this.thresholds.minTimeForDistanceMinutes) {
            const requiredTime = distance / 900; // Assuming max 900 km/h travel speed
            
            results.push({
              isAnomalous: true,
              category: AnomalyCategory.GEOGRAPHIC,
              severity: AnomalySeverity.CRITICAL,
              confidence: 0.95,
              score: distance,
              threshold: this.thresholds.maxGeoDistanceKm,
              actualValue: distance,
              description: `Impossible travel detected: ${distance.toFixed(0)}km in ${timeDiffMinutes.toFixed(0)}min`,
              details: {
                distanceKm: distance.toFixed(2),
                timeDiffMinutes: timeDiffMinutes.toFixed(2),
                lastLocation: {
                  latitude: lastLocation.latitude,
                  longitude: lastLocation.longitude,
                  countryCode: lastLocation.countryCode,
                },
                currentLocation: {
                  latitude: transaction.latitude,
                  longitude: transaction.longitude,
                  countryCode: transaction.countryCode,
                },
                estimatedMinTravelTime: requiredTime,
              },
              detectedAt: new Date(),
            });
          }
        }
      }
      
      // Update geo history
      const geoPoint: GeoPoint = {
        latitude: transaction.latitude,
        longitude: transaction.longitude,
        countryCode: transaction.countryCode,
        timestamp: transaction.timestamp,
      };
      
      userGeoHistory.push(geoPoint);
      if (userGeoHistory.length > 100) {
        userGeoHistory.shift();
      }
      this.geoHistory.set(transaction.customerId, userGeoHistory);
    }
    
    return results;
  }

  /**
   * Run device fingerprint analysis on transaction
   * @private
   * @param transaction - Transaction to analyze
   * @returns Array of detection results
   */
  private runDeviceAnalysis(transaction: TransactionData): DetectionResult[] {
    const results: DetectionResult[] = [];
    const profile = this.userProfiles.get(transaction.customerId);
    const deviceProfile = this.deviceProfiles.get(transaction.deviceFingerprint);
    
    if (!profile) {
      return results;
    }
    
    // New device check
    const isNewDevice = !profile.knownDevices.has(transaction.deviceFingerprint);
    
    if (isNewDevice && profile.knownDevices.size > 0) {
      const deviceRisk = this.calculateDeviceRisk(transaction.deviceFingerprint, profile);
      
      if (deviceRisk > this.thresholds.newDeviceRiskThreshold) {
        results.push({
          isAnomalous: true,
          category: AnomalyCategory.DEVICE,
          severity: deviceRisk > 80 ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM,
          confidence: clamp(deviceRisk / 100, 0, 1),
          score: deviceRisk,
          threshold: this.thresholds.newDeviceRiskThreshold,
          actualValue: deviceRisk,
          description: 'Transaction from new/high-risk device',
          details: {
            deviceFingerprint: transaction.deviceFingerprint.substring(0, 16) + '...',
            deviceRisk,
            knownDeviceCount: profile.knownDevices.size,
          },
          detectedAt: new Date(),
        });
      }
    }
    
    // Check if device is flagged
    if (deviceProfile?.isFlagged) {
      results.push({
        isAnomalous: true,
        category: AnomalyCategory.DEVICE,
        severity: AnomalySeverity.CRITICAL,
        confidence: 0.99,
        score: 100,
        threshold: 0,
        actualValue: 1,
        description: 'Transaction from flagged/fraudulent device',
        details: {
          deviceFingerprint: transaction.deviceFingerprint.substring(0, 16) + '...',
          flagReason: 'Previously associated with fraudulent activity',
        },
        detectedAt: new Date(),
      });
    }
    
    // Device sharing detection (multiple accounts on same device)
    if (deviceProfile && deviceProfile.uniqueCustomers >= 3) {
      const sharingRatio = deviceProfile.uniqueCustomers / Math.max(deviceProfile.transactionCount, 1);
      
      if (sharingRatio > 0.25) { // Lowered threshold for better detection
        results.push({
          isAnomalous: true,
          category: AnomalyCategory.DEVICE,
          severity: AnomalySeverity.MEDIUM,
          confidence: clamp(sharingRatio, 0, 1),
          score: sharingRatio * 100,
          threshold: 25,
          actualValue: deviceProfile.uniqueCustomers,
          description: `Device shared by ${deviceProfile.uniqueCustomers} different accounts`,
          details: {
            uniqueCustomers: deviceProfile.uniqueCustomers,
            totalTransactions: deviceProfile.transactionCount,
            sharingRatio: sharingRatio.toFixed(2),
          },
          detectedAt: new Date(),
        });
      }
    }
    
    return results;
  }

  /**
   * Run velocity analysis on transaction
   * @private
   * @param transaction - Transaction to analyze
   * @returns Array of detection results
   */
  private runVelocityAnalysis(transaction: TransactionData): DetectionResult[] {
    const results: DetectionResult[] = [];
    
    // Get recent transactions from sliding window
    const recentTransactions = this.slidingWindow.getInWindow(new Date());
    const now = transaction.timestamp.getTime();
    
    // Count transactions in last minute for this user
    const recentUserTxns = recentTransactions.filter(t => 
      t.customerId === transaction.customerId &&
      now - t.timestamp.getTime() <= 60000
    );
    
    if (recentUserTxns.length >= this.thresholds.maxVelocityPerMinute) {
      results.push({
        isAnomalous: true,
        category: AnomalyCategory.VELOCITY,
        severity: recentUserTxns.length >= this.thresholds.maxVelocityPerMinute * 2 
          ? AnomalySeverity.CRITICAL 
          : AnomalySeverity.HIGH,
        confidence: clamp(recentUserTxns.length / (this.thresholds.maxVelocityPerMinute * 2), 0, 1),
        score: recentUserTxns.length,
        threshold: this.thresholds.maxVelocityPerMinute,
        actualValue: recentUserTxns.length,
        description: `High transaction velocity: ${recentUserTxns.length} txns in last minute`,
        details: {
          countLastMinute: recentUserTxns.length,
          threshold: this.thresholds.maxVelocityPerMinute,
        },
        detectedAt: new Date(),
      });
    }
    
    // Count transactions in last hour
    const recentHourUserTxns = recentTransactions.filter(t =>
      t.customerId === transaction.customerId &&
      now - t.timestamp.getTime() <= 3600000
    );
    
    if (recentHourUserTxns.length >= this.thresholds.maxVelocityPerHour) {
      results.push({
        isAnomalous: true,
        category: AnomalyCategory.VELOCITY,
        severity: AnomalySeverity.HIGH,
        confidence: clamp(recentHourUserTxns.length / (this.thresholds.maxVelocityPerHour * 1.5), 0, 1),
        score: recentHourUserTxns.length,
        threshold: this.thresholds.maxVelocityPerHour,
        actualValue: recentHourUserTxns.length,
        description: `High hourly velocity: ${recentHourUserTxns.length} txns in last hour`,
        details: {
          countLastHour: recentHourUserTxns.length,
          threshold: this.thresholds.maxVelocityPerHour,
        },
        detectedAt: new Date(),
      });
    }
    
    // System-wide velocity check (potential system attack)
    const allRecentTxns = recentTransactions.filter(t => 
      now - t.timestamp.getTime() <= 60000
    );
    
    if (allRecentTxns.length > 50) {
      results.push({
        isAnomalous: true,
        category: AnomalyCategory.VELOCITY,
        severity: AnomalySeverity.CRITICAL,
        confidence: 0.95,
        score: allRecentTxns.length,
        threshold: 50,
        actualValue: allRecentTxns.length,
        description: 'Elevated system-wide transaction volume detected',
        details: {
          systemWideCount: allRecentTxns.length,
          timeframe: '1 minute',
        },
        detectedAt: new Date(),
      });
    }
    
    return results;
  }

  // ============== Helper Methods ==============

  /**
   * Convert a raw score to severity level
   * @private
   * @param score - Normalized score (where 1.0 = threshold)
   * @returns Appropriate severity level
   */
  private scoreToSeverity(score: number): AnomalySeverity {
    if (score >= 3.0) return AnomalySeverity.CRITICAL;
    if (score >= 2.0) return AnomalySeverity.HIGH;
    if (score >= 1.5) return AnomalySeverity.MEDIUM;
    if (score >= 1.0) return AnomalySeverity.LOW;
    return AnomalySeverity.INFO;
  }

  /**
   * Calculate how unusual an hour is given typical hours
   * @private
   * @param currentHour - Hour to check (0-23)
   * @param typicalHours - Array of typical hours
   * @returns Deviation score
   */
  private calculateHourDeviation(currentHour: number, typicalHours: number[]): number {
    if (typicalHours.length === 0) return 0;
    
    // Find minimum absolute difference to any typical hour
    let minDiff = 24;
    for (const typicalHour of typicalHours) {
      const diff = Math.min(
        Math.abs(currentHour - typicalHour),
        24 - Math.abs(currentHour - typicalHour)
      );
      minDiff = Math.min(minDiff, diff);
    }
    
    // Normalize to approximate standard deviations
    // 12-hour difference would be very unusual (night vs day)
    return minDiff / 4; // Rough approximation
  }

  /**
   * Calculate risk score for a new location
   * @private
   * @param countryCode - Country code of new location
   * @param profile - User profile
   * @returns Risk score (0-100)
   */
  private calculateLocationRisk(countryCode: string, profile: UserProfile): number {
    // Base risk for any new location
    let risk = 40;
    
    // High-risk countries (simplified list - in production, use comprehensive database)
    const highRiskCountries = new Set([
      'NG', // Nigeria (high fraud rate for certain patterns)
      'GH', // Ghana
      'KE', // Kenya
      // Add more based on your risk model
    ]);
    
    if (highRiskCountries.has(countryCode)) {
      risk += 20;
    }
    
    // Increase risk if user has established pattern (more locations = more suspicious)
    if (profile.knownLocations.size >= 3) {
      risk += 15;
    }
    
    // New account bonus risk
    if (profile.accountAgeDays < 7) {
      risk += 15;
    }
    
    return clamp(risk, 0, 100);
  }

  /**
   * Calculate risk score for a new device
   * @private
   * @param deviceFingerprint - Device fingerprint
   * @param profile - User profile
   * @returns Risk score (0-100)
   */
  private calculateDeviceRisk(deviceFingerprint: string, profile: UserProfile): number {
    let risk = 30;
    
    const deviceProfile = this.deviceProfiles.get(deviceFingerprint);
    
    if (deviceProfile) {
      // Device exists but not for this user
      if (deviceProfile.isFlagged) {
        risk = 100;
      } else if (deviceProfile.uniqueCustomers > 1) {
        // Shared device
        risk += 30;
        risk += (deviceProfile.uniqueCustomers - 1) * 10;
      }
      
      // New device (first seen recently)
      const deviceAge = Date.now() - deviceProfile.firstSeen.getTime();
      const deviceAgeDays = deviceAge / (1000 * 60 * 60 * 24);
      
      if (deviceAgeDays < 1) {
        risk += 20; // Very new device
      }
    } else {
      // Completely unknown device - higher risk
      risk += 20; // Increased from 10 to 20
    }
    
    // Account age factor
    if (profile.accountAgeDays < 30) {
      risk += 15;
    }
    
    // Multiple devices factor
    if (profile.knownDevices.size >= 3) {
      risk += 10;
    } else if (profile.knownDevices.size >= 2) {
      risk += 5; // Some risk for having multiple devices
    }
    
    return clamp(risk, 0, 100);
  }

  /**
   * Compile final analysis result from individual detections
   * @private
   * @param detections - Individual detection results (both anomalous and normal)
   * @param startTime - Analysis start time
   * @param methodsRunCount - Number of detection methods that were executed
   * @returns Compiled analysis result
   */
  private compileAnalysisResult(
    detections: DetectionResult[], 
    startTime: number,
    methodsRunCount: number = 0
  ): AnomalyAnalysisResult {
    const processingTimeMs = performance.now() - startTime;
    const anomalousDetections = detections.filter(d => d.isAnomalous);
    
    // Calculate overall risk score
    let riskScore = 0;
    for (const detection of anomalousDetections) {
      // Weight by severity
      const severityWeights: Record<AnomalySeverity, number> = {
        [AnomalySeverity.INFO]: 5,
        [AnomalySeverity.LOW]: 10,
        [AnomalySeverity.MEDIUM]: 25,
        [AnomalySeverity.HIGH]: 50,
        [AnomalySeverity.CRITICAL]: 100,
      };
      riskScore += detection.confidence * severityWeights[detection.severity];
    }
    
    // Normalize to 0-100
    riskScore = clamp(riskScore, 0, 100);
    
    // Determine overall severity
    let overallSeverity = AnomalySeverity.INFO;
    for (const detection of anomalousDetections) {
      const severityOrder = [
        AnomalySeverity.INFO,
        AnomalySeverity.LOW,
        AnomalySeverity.MEDIUM,
        AnomalySeverity.HIGH,
        AnomalySeverity.CRITICAL,
      ];
      if (severityOrder.indexOf(detection.severity) > severityOrder.indexOf(overallSeverity)) {
        overallSeverity = detection.severity;
      }
    }
    
    // Determine recommended action
    const recommendedAction = this.determineRecommendedAction(riskScore, overallSeverity, anomalousDetections);
    
    // Extract risk factors
    const riskFactors = anomalousDetections.map(d => d.description);
    
    return {
      isAnomalous: anomalousDetections.length > 0,
      riskScore,
      overallSeverity,
      detections: anomalousDetections,
      riskFactors,
      recommendedAction,
      metadata: {
        processingTimeMs,
        methodsRun: methodsRunCount, // Actual count of methods executed
        flaggingMethods: anomalousDetections.map(d => d.category),
        detectorVersion: DETECTOR_VERSION,
        configSnapshot: {
          sensitivity: this.config.sensitivity,
          enableBehavioralAnalysis: this.config.enableBehavioralAnalysis,
          enableGeographicAnalysis: this.config.enableGeographicAnalysis,
          enableDeviceAnalysis: this.config.enableDeviceAnalysis,
        },
      },
      analyzedAt: new Date(),
    };
  }

  /**
   * Determine recommended action based on analysis
   * @private
   * @param riskScore - Overall risk score
   * @param severity - Overall severity
   * @param detections - Anomalous detections
   * @returns Recommended action
   */
  private determineRecommendedAction(
    riskScore: number,
    severity: AnomalySeverity,
    detections: DetectionResult[]
  ): RecommendedAction {
    // Critical always block
    if (severity === AnomalySeverity.CRITICAL) {
      // Check for impossible travel - always block
      const hasImpossibleTravel = detections.some(d => 
        d.category === AnomalyCategory.GEOGRAPHIC && 
        d.description.includes('Impossible travel')
      );
      
      if (hasImpossibleTravel) {
        return 'block_and_investigate';
      }
      
      // Check for flagged device
      const hasFlaggedDevice = detections.some(d =>
        d.category === AnomalyCategory.DEVICE &&
        d.description.includes('flagged')
      );
      
      if (hasFlaggedDevice) {
        return 'block_and_investigate';
      }
      
      return 'decline';
    }
    
    // High severity
    if (severity === AnomalySeverity.HIGH) {
      if (riskScore >= 75) {
        return 'require_step_up_auth';
      }
      return 'require_additional_verification';
    }
    
    // Medium severity
    if (severity === AnomalySeverity.MEDIUM) {
      if (riskScore >= 50) {
        return 'require_additional_verification';
      }
      return 'approve_with_monitoring';
    }
    
    // Low severity
    if (severity === AnomalySeverity.LOW) {
      return 'approve_with_monitoring';
    }
    
    // Info or no anomaly
    return 'approve';
  }

  /**
   * Update internal state with new transaction data
   * @private
   * @param transaction - Transaction to incorporate
   */
  private updateInternalState(transaction: TransactionData): void {
    // Update user profile
    this.updateUserProfile(transaction);
    
    // Update device profile
    this.updateDeviceProfile(transaction);
    
    // Update time series data
    const amountKey = `amounts:${transaction.customerId}`;
    const existingData = this.timeSeriesData.get(amountKey) || [];
    existingData.push({
      timestamp: transaction.timestamp,
      value: transaction.amount,
      metadata: { transactionId: transaction.transactionId },
    });
    
    // Trim to max size
    if (existingData.length > this.config.timeSeriesWindowSize) {
      existingData.shift();
    }
    this.timeSeriesData.set(amountKey, existingData);
  }

  /**
   * Update device profile with transaction data
   * @private
   * @param transaction - Transaction to incorporate
   */
  private updateDeviceProfile(transaction: TransactionData): void {
    const existing = this.deviceProfiles.get(transaction.deviceFingerprint);
    
    if (existing) {
      existing.lastSeen = transaction.timestamp;
      existing.transactionCount++;
      existing.customerIds.add(transaction.customerId);
      existing.uniqueCustomers = existing.customerIds.size;
    } else {
      this.deviceProfiles.set(transaction.deviceFingerprint, {
        fingerprint: transaction.deviceFingerprint,
        firstSeen: transaction.timestamp,
        lastSeen: transaction.timestamp,
        transactionCount: 1,
        uniqueCustomers: 1,
        customerIds: new Set([transaction.customerId]),
        riskScore: 0,
        isFlagged: false,
      });
    }
  }

  /**
   * Emit an event to registered listeners
   * @private
   * @param event - Event to emit
   */
  private emitEvent(event: StreamingEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          logger.error('Event listener error', {
            event: 'analyzer.listener.error',
            error: error as Error,
            metadata: { eventType: event.type },
          });
        }
      }
    }
  }

  /**
   * Apply Z-Score detection to results array
   * @private
   * @param values - Original values
   * @param results - Results array to update
   */
  private applyZScoreDetection(
    values: number[],
    results: Array<{ index: number; value: number; score: number; isOutlier: boolean }>
  ): void {
    try {
      const mean = calculateMean(values);
      const std = calculateStandardDeviation(values);
      
      if (std === 0) return;
      
      for (const result of results) {
        const zScore = Math.abs((result.value - mean) / std);
        if (zScore > this.thresholds.zScoreThreshold) {
          result.isOutlier = true;
          result.score = Math.max(result.score, zScore / this.thresholds.zScoreThreshold);
        }
      }
    } catch {
      // Silently skip if calculation fails
    }
  }

  /**
   * Apply IQR detection to results array
   * @private
   * @param values - Original values
   * @param results - Results array to update
   */
  private applyIQRDetection(
    values: number[],
    results: Array<{ index: number; value: number; score: number; isOutlier: boolean }>
  ): void {
    try {
      const { q1, q3 } = calculateQuartiles(values);
      let iqr = q3 - q1;
      
      // Handle case where IQR is 0 (many identical values)
      // Use a minimum IQR based on the range to allow outlier detection
      if (iqr === 0) {
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        // If there's significant range but IQR is 0, use fraction of range as minimum IQR
        if (maxVal > minVal) {
          iqr = (maxVal - minVal) * 0.1; // 10% of range
        } else {
          return; // All values identical, no outliers possible
        }
      }
      
      const lowerBound = q1 - this.thresholds.iqrMultiplier * iqr;
      const upperBound = q3 + this.thresholds.iqrMultiplier * iqr;
      
      for (const result of results) {
        if (result.value < lowerBound || result.value > upperBound) {
          result.isOutlier = true;
          const deviation = Math.max(
            Math.abs(result.value - lowerBound),
            Math.abs(result.value - upperBound)
          ) / iqr;
          result.score = Math.max(result.score, deviation);
        }
      }
    } catch {
      // Silently skip if calculation fails
    }
  }

  /**
   * Apply Modified Z-Score detection to results array
   * @private
   * @param values - Original values
   * @param results - Results array to update
   */
  private applyModifiedZScoreDetection(
    values: number[],
    results: Array<{ index: number; value: number; score: number; isOutlier: boolean }>
  ): void {
    try {
      const mad = calculateMAD(values);
      const median = calculateMedian(values);
      
      if (mad === 0) return;
      
      for (const result of results) {
        const modifiedZScore = Math.abs((0.6745 * (result.value - median)) / mad);
        if (modifiedZScore > this.thresholds.modifiedZScoreThreshold) {
          result.isOutlier = true;
          result.score = Math.max(
            result.score, 
            modifiedZScore / this.thresholds.modifiedZScoreThreshold
          );
        }
      }
    } catch {
      // Silently skip if calculation fails
    }
  }
}

// ============== Type Alias for Return Type ==============
type AnalysisResult = AnomalyAnalysisResult;

// ============== Export Singleton Instance ==============

/**
 * Default anomaly detector instance with medium sensitivity
 * Use this for most standard use cases
 */
export const defaultAnomalyDetector = new AnomalyDetector({
  sensitivity: SensitivityLevel.MEDIUM,
});

export default AnomalyDetector;
