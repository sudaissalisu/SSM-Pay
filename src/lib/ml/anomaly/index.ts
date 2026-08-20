/**
 * Anomaly Detection Module - Main Entry Point
 * @module ml/anomaly
 * @description Main class and re-exports for the anomaly detection system.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// Export all types
export * from './types';

// Export statistical functions
export {
  calculateMean,
  calculateStandardDeviation,
  calculateMedian,
  calculateMAD,
  calculateQuartiles,
  clamp as statClamp,
  normalize,
  calculatePercentileRank,
  applyZScoreDetection,
  analyzeZScore,
  applyIQRDetection,
  analyzeIQR,
  applyModifiedZScoreDetection,
  analyzeModifiedZScore,
} from './statistical';

// Export temporal/behavioral/velocity functions
export {
  calculateHourDeviation,
  runTemporalAnalysis,
  runBehavioralAnalysis,
  runVelocityAnalysis,
} from './temporal';

// Export geographic functions
export {
  calculateHaversineDistance,
  calculateLocationRisk,
  runGeographicAnalysis,
} from './geographic';

// Export device functions
export {
  calculateDeviceRisk,
  runDeviceAnalysis,
} from './device';

// Export streaming functions
export {
  createSlidingWindow,
  initializeStreamingStats,
  updateStreamingStats,
  emitEvent,
  scoreToSeverity,
  determineRecommendedAction,
} from './streaming';

// Export analysis methods
export {
  runStatisticalAnalysis,
  compileAnalysisResult,
  validateTransaction,
  updateInternalState,
} from './analysis';

// Import types for internal use
import {
  AnomalyDetectorConfig,
  ThresholdConfig,
  TransactionData,
  UserProfile,
  DeviceProfile,
  GeoPoint,
  TimeSeriesPoint,
  DetectionResult,
  AnomalyAnalysisResult,
  StreamingEvent,
  StreamingStats,
  SlidingWindowBuffer,
  StatisticalMethod,
  SensitivityLevel,
  DEFAULT_THRESHOLDS,
  SENSITIVITY_ADJUSTMENTS,
  DETECTOR_VERSION,
  AnomalyCategory,
  AnomalySeverity,
} from './types';

import { 
  runTemporalAnalysis, 
  runBehavioralAnalysis, 
  runVelocityAnalysis 
} from './temporal';
import { runGeographicAnalysis } from './geographic';
import { runDeviceAnalysis } from './device';
import { 
  createSlidingWindow, 
  initializeStreamingStats, 
  updateStreamingStats, 
  emitEvent, 
  scoreToSeverity, 
  determineRecommendedAction 
} from './streaming';
import { 
  runStatisticalAnalysis, 
  compileAnalysisResult, 
  validateTransaction, 
  updateInternalState 
} from './analysis';

/**
 * Enterprise-grade Anomaly Detector for payment fraud prevention
 */
export class AnomalyDetector {
  private config: Required<AnomalyDetectorConfig>;
  private thresholds: ThresholdConfig;
  private timeSeriesData: Map<string, TimeSeriesPoint[]>;
  private userProfiles: Map<string, UserProfile>;
  private deviceProfiles: Map<string, DeviceProfile>;
  private geoHistory: Map<string, GeoPoint[]>;
  private isStreaming: boolean;
  private streamingStats: StreamingStats;
  private streamingStartTime: Date | null;
  private slidingWindow: SlidingWindowBuffer<TransactionData>;
  private eventListeners: Map<string, ((event: StreamingEvent) => void)[]>;
  private recentProcessingTimes: number[];

  constructor(config: AnomalyDetectorConfig = {}) {
    this.config = {
      sensitivity: config.sensitivity || SensitivityLevel.MEDIUM,
      enableRealTimeDetection: config.enableRealTimeDetection || false,
      timeSeriesWindowSize: config.timeSeriesWindowSize || 100,
      realtimeWindowMs: config.realtimeWindowMs || 300000,
      maxHistorySize: config.maxHistorySize || 10000,
      enableBehavioralAnalysis: config.enableBehavioralAnalysis !== false,
      enableGeographicAnalysis: config.enableGeographicAnalysis !== false,
      enableDeviceAnalysis: config.enableDeviceAnalysis !== false,
      customThresholds: config.customThresholds || {},
      adaptiveThresholds: config.adaptiveThresholds || false,
      minSamplesRequired: config.minSamplesRequired || 10,
    };

    this.thresholds = this.initializeThresholds();
    this.timeSeriesData = new Map();
    this.userProfiles = new Map();
    this.deviceProfiles = new Map();
    this.geoHistory = new Map();
    this.isStreaming = false;
    this.streamingStartTime = null;
    this.eventListeners = new Map();
    this.recentProcessingTimes = [];
    this.streamingStats = initializeStreamingStats();
    this.slidingWindow = createSlidingWindow<TransactionData>(
      this.config.maxHistorySize,
      this.config.realtimeWindowMs
    );

    logger.info('AnomalyDetector initialized', {
      event: 'anomaly_detector.init',
      metadata: { sensitivity: this.config.sensitivity, version: DETECTOR_VERSION },
    });
  }

  private initializeThresholds(): ThresholdConfig {
    const baseThresholds = { ...DEFAULT_THRESHOLDS };
    const sensitivityAdjustments = SENSITIVITY_ADJUSTMENTS[this.config.sensitivity] || {};
    const customThresholds = this.config.customThresholds || {};
    
    return { ...baseThresholds, ...sensitivityAdjustments, ...customThresholds };
  }

  // ============== Public API Methods ==============

  async analyzeTransaction(transaction: TransactionData): Promise<AnomalyAnalysisResult> {
    const startTime = performance.now();
    
    try {
      validateTransaction(transaction);
      
      const detections: DetectionResult[] = [];
      let methodsRunCount = 0;
      
      this.slidingWindow.add(transaction);
      
      detections.push(...runStatisticalAnalysis(
        transaction, 
        (key) => this.timeSeriesData.get(key)?.map(p => p.value),
        this.thresholds
      ));
      methodsRunCount++;
      detections.push(...runTemporalAnalysis(transaction, this.userProfiles.get(transaction.customerId), this.thresholds));
      methodsRunCount++;
      
      if (this.config.enableBehavioralAnalysis) {
        detections.push(...runBehavioralAnalysis(transaction, this.userProfiles.get(transaction.customerId), this.thresholds));
        methodsRunCount++;
      }
      
      if (this.config.enableGeographicAnalysis) {
        detections.push(...runGeographicAnalysis(transaction, this.userProfiles.get(transaction.customerId), this.geoHistory, this.thresholds));
        methodsRunCount++;
      }
      
      if (this.config.enableDeviceAnalysis) {
        detections.push(...runDeviceAnalysis(transaction, this.userProfiles.get(transaction.customerId), this.deviceProfiles, this.thresholds));
        methodsRunCount++;
      }
      
      detections.push(...runVelocityAnalysis(transaction, this.slidingWindow.getAll(), this.thresholds));
      methodsRunCount++;

      const result = compileAnalysisResult(detections, startTime, methodsRunCount);
      updateInternalState(transaction, 
        (txn) => this.updateUserProfile(txn),
        (txn) => this.updateDeviceProfile(txn),
        this.timeSeriesData
      );

      if (this.isStreaming && result.isAnomalous) {
        emitEvent({ type: 'anomaly', payload: result, timestamp: new Date() }, this.eventListeners);
        this.streamingStats.totalAnomaliesDetected++;
      }

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

  async analyzeBatch(transactions: TransactionData[]): Promise<AnomalyAnalysisResult[]> {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      throw new AppError('Transactions array cannot be empty', ErrorCode.VALIDATION_ERROR);
    }

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
      }
    }

    return results;
  }

  detectStatisticalOutliers(
    values: number[],
    method: StatisticalMethod = StatisticalMethod.HYBRID
  ): Array<{ index: number; value: number; score: number; isOutlier: boolean }> {
    if (!Array.isArray(values) || values.length < this.config.minSamplesRequired) {
      throw new AppError(`Insufficient data: ${values?.length || 0} values`, ErrorCode.VALIDATION_ERROR);
    }

    const results: Array<{ index: number; value: number; score: number; isOutlier: boolean }> = 
      values.map((value, index) => ({ index, value, score: 0, isOutlier: false }));

    switch (method) {
      case StatisticalMethod.Z_SCORE:
        applyZScoreDetection(values, results, this.thresholds);
        break;
      case StatisticalMethod.IQR:
        applyIQRDetection(values, results, this.thresholds);
        break;
      case StatisticalMethod.MODIFIED_Z_SCORE:
        applyModifiedZScoreDetection(values, results, this.thresholds);
        break;
      case StatisticalMethod.HYBRID:
        applyZScoreDetection(values, results, this.thresholds);
        applyIQRDetection(values, results, this.thresholds);
        applyModifiedZScoreDetection(values, results, this.thresholds);
        results.forEach(r => { r.isOutlier = r.score > 1; });
        break;
    }

    return results;
  }

  detectTimeSeriesAnomalies(
    data: TimeSeriesPoint[],
    options: { seasonalityPeriod?: number; trendSensitivity?: number } = {}
  ): TimeSeriesPoint[] {
    if (!Array.isArray(data) || data.length < this.config.minSamplesRequired) return [];

    const outliers = this.detectStatisticalOutliers(data.map(d => d.value), StatisticalMethod.HYBRID);
    const anomalousIndices = new Set(outliers.filter(o => o.isOutlier).map(o => o.index));

    const anomalousPoints: TimeSeriesPoint[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (anomalousIndices.has(i)) {
        anomalousPoints.push(data[i]);
        continue;
      }

      if (i > 0) {
        const prevValue = data[i - 1].value;
        const currValue = data[i].value;
        const changePercent = prevValue !== 0 ? Math.abs((currValue - prevValue) / prevValue) * 100 : 0;
        
        if (changePercent > 100 * (options.trendSensitivity || 2.0)) {
          anomalousPoints.push(data[i]);
        }
      }
    }

    return anomalousPoints;
  }

  // ============== Streaming Methods ==============

  startStreaming(): void {
    if (this.isStreaming) { logger.warn('Streaming already active'); return; }
    this.isStreaming = true;
    this.streamingStartTime = new Date();
    logger.info('Real-time streaming started', { event: 'analyzer.streaming.started' });
  }

  stopStreaming(): void {
    if (!this.isStreaming) return;
    this.isStreaming = false;
    logger.info('Real-time streaming stopped', { event: 'analyzer.streaming.stopped' });
  }

  async processStreamEvent(transaction: TransactionData): Promise<AnomalyAnalysisResult> {
    const startTime = performance.now();
    
    this.slidingWindow.add(transaction);
    this.streamingStats.totalEventsProcessed++;
    this.streamingStats.eventsInWindow = this.slidingWindow.size();
    
    const result = await this.analyzeTransaction(transaction);
    
    const processingTime = performance.now() - startTime;
    this.recentProcessingTimes.push(processingTime);
    if (this.recentProcessingTimes.length > 100) this.recentProcessingTimes.shift();
    this.streamingStats.avgProcessingTimeMs = 
      this.recentProcessingTimes.reduce((a, b) => a + b, 0) / this.recentProcessingTimes.length;
    
    this.streamingStats.currentAnomalyRate =
      this.streamingStats.totalEventsProcessed > 0
        ? this.streamingStats.totalAnomaliesDetected / this.streamingStats.totalEventsProcessed
        : 0;
    
    if (this.streamingStartTime) {
      this.streamingStats.uptimeSeconds =
        (Date.now() - this.streamingStartTime.getTime()) / 1000;
    }
    
    emitEvent({ type: 'data', payload: transaction, timestamp: new Date() }, this.eventListeners);
    return result;
  }

  on(eventType: 'anomaly' | 'data' | 'error' | 'warning' | 'stats', callback: (event: StreamingEvent) => void): void {
    if (!this.eventListeners.has(eventType)) this.eventListeners.set(eventType, []);
    this.eventListeners.get(eventType)!.push(callback);
  }

  off(eventType: string, callback: (event: StreamingEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    }
  }

  getStreamingStats(): StreamingStats { return { ...this.streamingStats }; }

  // ============== Profile Management ==============

  updateUserProfile(transaction: TransactionData): void {
    const existingProfile = this.userProfiles.get(transaction.customerId);
    
    if (existingProfile) {
      const n = existingProfile.totalTransactions;
      const newAvgAmount = (existingProfile.avgAmount * n + transaction.amount) / (n + 1);
      const diffFromMean = Math.abs(transaction.amount - existingProfile.avgAmount);
      const newStdAmount = Math.sqrt(
        (existingProfile.stdAmount * existingProfile.stdAmount * (n - 1) + diffFromMean * diffFromMean) / n
      );
      
      const hour = transaction.timestamp.getHours();
      if (!existingProfile.typicalHours.includes(hour)) existingProfile.typicalHours.push(hour);
      const day = transaction.timestamp.getDay();
      if (!existingProfile.typicalDays.includes(day)) existingProfile.typicalDays.push(day);
      existingProfile.knownDevices.add(transaction.deviceFingerprint);
      existingProfile.knownLocations.add(transaction.countryCode);
      existingProfile.preferredMethods.add(transaction.paymentMethod);
      
      const timeDiff = transaction.timestamp.getTime() - existingProfile.lastTransactionDate.getTime();
      existingProfile.avgTimeBetweenTxnMinutes =
        (existingProfile.avgTimeBetweenTxnMinutes * n + timeDiff / 60000) / (n + 1);
      
      existingProfile.avgAmount = newAvgAmount;
      existingProfile.stdAmount = newStdAmount || 0;
      if (existingProfile.stdAmount === 0 && n > 1) existingProfile.stdAmount = existingProfile.avgAmount * 0.1;
      existingProfile.totalTransactions = n + 1;
      existingProfile.lastTransactionDate = transaction.timestamp;
      existingProfile.dailyVelocity = existingProfile.totalTransactions / Math.max(existingProfile.accountAgeDays, 1);
    } else {
      this.userProfiles.set(transaction.customerId, {
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
      });
    }
    
    logger.debug('User profile updated', { event: 'analyzer.profile.updated', metadata: { customerId: transaction.customerId } });
  }

  getUserProfile(customerId: string): UserProfile | null {
    return this.userProfiles.get(customerId) || null;
  }

  // ============== Configuration Management ==============

  updateConfiguration(configUpdates: Partial<AnomalyDetectorConfig>): void {
    Object.assign(this.config, configUpdates);
    if (configUpdates.sensitivity || configUpdates.customThresholds) {
      this.thresholds = this.initializeThresholds();
    }
    logger.info('Detector configuration updated', { event: 'analyzer.config.updated' });
  }

  getConfiguration(): Readonly<Partial<AnomalyDetectorConfig>> { return { ...this.config }; }

  getThresholds(): Readonly<ThresholdConfig> { return { ...this.thresholds }; }

  resetState(): void {
    this.timeSeriesData.clear();
    this.userProfiles.clear();
    this.deviceProfiles.clear();
    this.geoHistory.clear();
    this.slidingWindow.clear();
    this.recentProcessingTimes = [];
    this.streamingStats = initializeStreamingStats();
    logger.info('Detector state reset', { event: 'analyzer.state.reset' });
  }

  // ============== Device Profile Management ==============

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
}

// Type alias
type AnalysisResult = AnomalyAnalysisResult;

// Default instance
export const defaultAnomalyDetector = new AnomalyDetector({
  sensitivity: SensitivityLevel.MEDIUM,
});

export default AnomalyDetector;
