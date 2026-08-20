/**
 * Time Series Anomaly Detection Functions
 * @module ml/anomaly/temporal
 * @description Time series decomposition, trend analysis, and temporal pattern deviation detection.
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

// ============== Time-Based Analysis ==============

/**
 * Calculate how unusual an hour is given typical hours
 */
export function calculateHourDeviation(currentHour: number, typicalHours: number[]): number {
  if (typicalHours.length === 0) return 0;
  
  let minDiff = 24;
  for (const typicalHour of typicalHours) {
    const diff = Math.min(
      Math.abs(currentHour - typicalHour),
      24 - Math.abs(currentHour - typicalHour)
    );
    minDiff = Math.min(minDiff, diff);
  }
  
  return minDiff / 4;
}

/**
 * Run temporal/time-based analysis on transaction
 */
export function runTemporalAnalysis(
  transaction: TransactionData,
  profile: UserProfile | undefined,
  thresholds: ThresholdConfig
): DetectionResult[] {
  const results: DetectionResult[] = [];
  
  if (!profile || profile.totalTransactions < 5) {
    return results;
  }
  
  const txnHour = transaction.timestamp.getHours();
  const txnDay = transaction.timestamp.getDay();
  
  // Check if transaction time is unusual for this user
  if (profile.typicalHours.length > 0 && !profile.typicalHours.includes(txnHour)) {
    const hourDeviation = calculateHourDeviation(txnHour, profile.typicalHours);
    
    if (hourDeviation > thresholds.timeDeviationStd / 2) {
      results.push({
        isAnomalous: true,
        category: AnomalyCategory.TEMPORAL,
        severity: AnomalySeverity.LOW,
        confidence: clamp(hourDeviation / (thresholds.timeDeviationStd * 2), 0, 1),
        score: hourDeviation,
        threshold: thresholds.timeDeviationStd / 2,
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
      description: 'Transaction on unusual day of week for user',
      details: { typicalDays: profile.typicalDays, currentDay: txnDay },
      detectedAt: new Date(),
    });
  }
  
  // Check time since last transaction
  const timeSinceLastTxn = transaction.timestamp.getTime() - profile.lastTransactionDate.getTime();
  const timeSinceLastMinutes = timeSinceLastTxn / 60000;
  
  if (profile.avgTimeBetweenTxnMinutes > 0) {
    const timeRatio = timeSinceLastMinutes / profile.avgTimeBetweenTxnMinutes;
    
    // Flag if transaction happens much sooner than expected
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

// ============== Behavioral Analysis ==============

/**
 * Run behavioral analysis on transaction
 */
export function runBehavioralAnalysis(
  transaction: TransactionData,
  profile: UserProfile | undefined,
  thresholds: ThresholdConfig
): DetectionResult[] {
  const results: DetectionResult[] = [];
  
  if (!profile || profile.totalTransactions < 3) {
    return results;
  }
  
  // Amount deviation analysis
  if (profile.stdAmount > 0) {
    const amountDeviation = Math.abs(transaction.amount - profile.avgAmount) / profile.stdAmount;
    const percentDeviation = Math.abs((transaction.amount - profile.avgAmount) / profile.avgAmount) * 100;
    
    if (percentDeviation > thresholds.amountDeviationPercent) {
      results.push({
        isAnomalous: true,
        category: AnomalyCategory.BEHAVIORAL,
        severity: percentDeviation > thresholds.amountDeviationPercent * 2 
          ? AnomalySeverity.HIGH 
          : AnomalySeverity.MEDIUM,
        confidence: clamp(percentDeviation / (thresholds.amountDeviationPercent * 2), 0, 1),
        score: amountDeviation,
        threshold: thresholds.amountDeviationPercent,
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
  
  return results;
}

// ============== Velocity Analysis ==============

/**
 * Run velocity analysis on transaction
 */
export function runVelocityAnalysis(
  transaction: TransactionData,
  recentTransactions: TransactionData[],
  thresholds: ThresholdConfig
): DetectionResult[] {
  const results: DetectionResult[] = [];
  const now = transaction.timestamp.getTime();
  
  // Count transactions in last minute for this user
  const recentUserTxns = recentTransactions.filter(t => 
    t.customerId === transaction.customerId &&
    now - t.timestamp.getTime() <= 60000
  );
  
  if (recentUserTxns.length >= thresholds.maxVelocityPerMinute) {
    results.push({
      isAnomalous: true,
      category: AnomalyCategory.VELOCITY,
      severity: recentUserTxns.length >= thresholds.maxVelocityPerMinute * 2 
        ? AnomalySeverity.CRITICAL 
        : AnomalySeverity.HIGH,
      confidence: clamp(recentUserTxns.length / (thresholds.maxVelocityPerMinute * 2), 0, 1),
      score: recentUserTxns.length,
      threshold: thresholds.maxVelocityPerMinute,
      actualValue: recentUserTxns.length,
      description: `High transaction velocity: ${recentUserTxns.length} txns in last minute`,
      details: {
        countLastMinute: recentUserTxns.length,
        threshold: thresholds.maxVelocityPerMinute,
      },
      detectedAt: new Date(),
    });
  }
  
  // Count transactions in last hour
  const recentHourUserTxns = recentTransactions.filter(t =>
    t.customerId === transaction.customerId &&
    now - t.timestamp.getTime() <= 3600000
  );
  
  if (recentHourUserTxns.length >= thresholds.maxVelocityPerHour) {
    results.push({
      isAnomalous: true,
      category: AnomalyCategory.VELOCITY,
      severity: AnomalySeverity.HIGH,
      confidence: clamp(recentHourUserTxns.length / (thresholds.maxVelocityPerHour * 1.5), 0, 1),
      score: recentHourUserTxns.length,
      threshold: thresholds.maxVelocityPerHour,
      actualValue: recentHourUserTxns.length,
      description: `High hourly velocity: ${recentHourUserTxns.length} txns in last hour`,
      details: {
        countLastHour: recentHourUserTxns.length,
        threshold: thresholds.maxVelocityPerHour,
      },
      detectedAt: new Date(),
    });
  }
  
  // System-wide velocity check
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

// ============== Utility Functions ==============

/**
 * Clamp a value between bounds
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
