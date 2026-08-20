/**
 * Anomaly Analysis Methods
 * @module ml/anomaly/analysis
 * @description Core analysis methods for the anomaly detector including statistical, temporal, geographic, and device analysis.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

import {
  TransactionData,
  DetectionResult,
  AnomalyCategory,
  AnomalySeverity,
  UserProfile,
  ThresholdConfig,
} from './types';

import {
  calcMean,
  calcStdDev,
  calcMedian,
  calcMAD,
  calcQuartiles,
  applyZScoreDetection,
  applyIQRDetection,
  applyModifiedZScoreDetection,
  clamp,
} from './statistical';

import { runTemporalAnalysis, runBehavioralAnalysis, runVelocityAnalysis } from './temporal';
import { runGeographicAnalysis } from './geographic';
import { runDeviceAnalysis } from './device';
import { scoreToSeverity, determineRecommendedAction } from './streaming';

// ============== Statistical Analysis ==============

/**
 * Run statistical outlier detection on transaction
 */
export function runStatisticalAnalysis(
  transaction: TransactionData,
  historicalDataGetter: (key: string) => number[] | undefined,
  thresholds: ThresholdConfig
): DetectionResult[] {
  const results: DetectionResult[] = [];
  const customerId = transaction.customerId;
  
  // Extreme amount check
  const EXTREME_AMOUNT_THRESHOLD = 10000000;
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
      details: { amount: transaction.amount, method: 'extreme_amount_check' },
      detectedAt: new Date(),
    });
  }
  
  // Get historical amounts for this user
  const historicalAmounts = historicalDataGetter(`amounts:${customerId}`) || [];
  const allAmounts = [...historicalAmounts, transaction.amount];
  
  if (allAmounts.length >= 10) {
    // Z-Score Analysis
    try {
      const mean = calcMean(historicalAmounts);
      const std = calcStdDev(historicalAmounts);
      
      if (std > 0) {
        const zScore = Math.abs((transaction.amount - mean) / std);
        
        if (zScore > thresholds.zScoreThreshold) {
          results.push({
            isAnomalous: true,
            category: AnomalyCategory.STATISTICAL,
            severity: scoreToSeverity(zScore / thresholds.zScoreThreshold),
            confidence: clamp(zScore / (thresholds.zScoreThreshold * 2), 0, 1),
            score: zScore,
            threshold: thresholds.zScoreThreshold,
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
      const { q1, q3 } = calcQuartiles(allAmounts);
      const iqr = q3 - q1;
      const lowerBound = q1 - thresholds.iqrMultiplier * iqr;
      const upperBound = q3 + thresholds.iqrMultiplier * iqr;
      
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
          threshold: thresholds.iqrMultiplier,
          actualValue: transaction.amount,
          description: `Transaction amount outside IQR bounds [${lowerBound}, ${upperBound}]`,
          details: { q1, q3, iqr, lowerBound, upperBound, method: 'iqr' },
          detectedAt: new Date(),
        });
      }
    } catch (error) {
      logger.warn('IQR calculation failed', { event: 'analyzer.iqr.error', error: error as Error });
    }
    
    // Modified Z-Score (MAD)
    try {
      const mad = calcMAD(historicalAmounts);
      const median = calcMedian(historicalAmounts);
      
      if (mad > 0) {
        const modifiedZScore = (0.6745 * (transaction.amount - median)) / mad;
        const absModifiedZScore = Math.abs(modifiedZScore);
        
        if (absModifiedZScore > thresholds.modifiedZScoreThreshold) {
          results.push({
            isAnomalous: true,
            category: AnomalyCategory.STATISTICAL,
            severity: scoreToSeverity(absModifiedZScore / thresholds.modifiedZScoreThreshold),
            confidence: clamp(absModifiedZScore / (thresholds.modifiedZScoreThreshold * 2), 0, 1),
            score: absModifiedZScore,
            threshold: thresholds.modifiedZScoreThreshold,
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
        error: error as Error,
      });
    }
  }
  
  return results;
}

// ============== Result Compilation ==============

/**
 * Compile final analysis result from individual detections
 */
export function compileAnalysisResult(
  detections: DetectionResult[], 
  startTime: number,
  methodsRunCount: number = 0
): {
  isAnomalous: boolean;
  riskScore: number;
  overallSeverity: AnomalySeverity;
  detections: DetectionResult[];
  riskFactors: string[];
  recommendedAction: string;
  metadata: object;
} {
  const processingTimeMs = performance.now() - startTime;
  const anomalousDetections = detections.filter(d => d.isAnomalous);
  
  let riskScore = 0;
  for (const detection of anomalousDetections) {
    const severityWeights: Record<AnomalySeverity, number> = {
      [AnomalySeverity.INFO]: 5,
      [AnomalySeverity.LOW]: 10,
      [AnomalySeverity.MEDIUM]: 25,
      [AnomalySeverity.HIGH]: 50,
      [AnomalySeverity.CRITICAL]: 100,
    };
    riskScore += detection.confidence * severityWeights[detection.severity];
  }
  
  riskScore = clamp(riskScore, 0, 100);
  
  let overallSeverity = AnomalySeverity.INFO;
  for (const detection of anomalousDetections) {
    const severityOrder = [
      AnomalySeverity.INFO, AnomalySeverity.LOW, AnomalySeverity.MEDIUM,
      AnomalySeverity.HIGH, AnomalySeverity.CRITICAL,
    ];
    if (severityOrder.indexOf(detection.severity) > severityOrder.indexOf(overallSeverity)) {
      overallSeverity = detection.severity;
    }
  }
  
  const recommendedAction = determineRecommendedAction(riskScore, overallSeverity, anomalousDetections);
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
      methodsRun: methodsRunCount,
      flaggingMethods: anomalousDetections.map(d => d.category),
      detectorVersion: '2.0.0',
    },
  };
}

// ============== Validation ==============

/**
 * Validate transaction data structure
 */
export function validateTransaction(transaction: TransactionData): void {
  const requiredFields: (keyof TransactionData)[] = [
    'transactionId', 'amount', 'currency', 'timestamp', 'customerId',
    'deviceFingerprint', 'ipAddress', 'countryCode', 'paymentMethod',
    'merchantId', 'mcc', 'channel', 'sessionId',
  ];

  const missingFields = requiredFields.filter(field => !transaction[field] && transaction[field] !== 0);

  if (missingFields.length > 0) {
    throw new AppError(`Missing required fields: ${missingFields.join(', ')}`, ErrorCode.VALIDATION_ERROR);
  }

  if (transaction.amount < 0) {
    throw new AppError('Transaction amount cannot be negative', ErrorCode.VALIDATION_ERROR);
  }

  if (!(transaction.timestamp instanceof Date) || isNaN(transaction.timestamp.getTime())) {
    throw new AppError('Invalid transaction timestamp', ErrorCode.VALIDATION_ERROR);
  }
}

// ============== Internal State Updates ==============

/**
 * Update internal state with new transaction data
 */
export function updateInternalState(
  transaction: TransactionData,
  updateUserProfile: (txn: TransactionData) => void,
  updateDeviceProfile: (txn: TransactionData) => void,
  timeSeriesData: Map<string, import('./types').TimeSeriesPoint[]>
): void {
  updateUserProfile(transaction);
  updateDeviceProfile(transaction);
  
  const amountKey = `amounts:${transaction.customerId}`;
  const existingData = timeSeriesData.get(amountKey) || [];
  existingData.push({ timestamp: transaction.timestamp, value: transaction.amount, metadata: { transactionId: transaction.transactionId } });
  
  if (existingData.length > 100) existingData.shift();
  timeSeriesData.set(amountKey, existingData);
}
