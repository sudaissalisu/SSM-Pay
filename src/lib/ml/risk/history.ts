/**
 * Historical Tracking Functions
 * @module ml/risk/history
 * @description Risk assessment history tracking, statistics, and adaptive learning.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import {
  RiskHistoryRecord,
  RiskAssessmentResult,
  RiskStatistics,
  RiskLevel,
  AMLAlertType,
  RiskEngineConfig,
} from './types';

// ============== Statistics Initialization ==============

/**
 * Initialize fresh statistics object
 */
export function initializeStatistics(): RiskStatistics {
  return {
    totalAssessments: 0,
    byLevel: {
      [RiskLevel.LOW]: 0,
      [RiskLevel.MEDIUM]: 0,
      [RiskLevel.HIGH]: 0,
      [RiskLevel.CRITICAL]: 0,
    },
    averageScore: 0,
    medianScore: 0,
    percentiles: { p25: 0, p50: 0, p75: 0, p90: 0, p99: 0 },
    blockRate: 0,
    flagRate: 0,
    topFactors: [],
    amlStats: { totalAlerts: 0, byType: {} as Record<AMLAlertType, number> },
  };
}

// ============== Statistics Update ==============

/**
 * Update running statistics with new assessment
 */
export function updateStatistics(
  stats: RiskStatistics,
  result: RiskAssessmentResult
): void {
  stats.totalAssessments++;
  stats.byLevel[result.riskLevel]++;

  // Update running average
  const n = stats.totalAssessments;
  stats.averageScore = 
    (stats.averageScore * (n - 1) + result.riskScore) / n;

  // Update block/flag rates
  if (result.shouldBlock) {
    stats.blockRate = ((stats.blockRate * (n - 1) + 1) / n) * 100;
  }
  if (result.shouldFlag) {
    stats.flagRate = ((stats.flagRate * (n - 1) + 1) / n) * 100;
  }

  // Update top factors
  for (const factor of result.factors) {
    const existing = stats.topFactors.find(f => f.factorId === factor.factorId);
    if (existing) {
      existing.count++;
      existing.avgScore = (existing.avgScore * (existing.count - 1) + factor.score) / existing.count;
    } else {
      stats.topFactors.push({
        factorId: factor.factorId,
        count: 1,
        avgScore: factor.score,
      });
    }
  }

  // Sort top factors by count
  stats.topFactors.sort((a, b) => b.count - a.count);
  stats.topFactors = stats.topFactors.slice(0, 10);

  // Update AML stats
  stats.amlStats.totalAlerts += result.amlAlerts.length;
  for (const alert of result.amlAlerts) {
    stats.amlStats.byType[alert.type] = 
      (stats.amlStats.byType[alert.type] || 0) + 1;
  }
}

// ============== Adaptive Learning ==============

/**
 * Adapt thresholds based on analyst feedback (adaptive mode)
 */
export function adaptFromFeedback(
  record: RiskHistoryRecord,
  thresholds: { highMax: number; criticalMin: number; mediumMax: number; lowMax: number }
): { highMax: number; criticalMin: number; mediumMax: number; lowMax: number } {
  const newThresholds = { ...thresholds };

  if (record.decision === 'approved' && record.assessment.shouldBlock) {
    newThresholds.highMax = Math.min(95, thresholds.highMax + 1);
    newThresholds.criticalMin = Math.min(96, thresholds.criticalMin + 1);
    logger.debug('Adapting thresholds: false positive detected', {
      event: 'risk_engine.adapt',
      metadata: { transactionId: record.transactionId },
    });
  }

  if (record.decision === 'denied' && !record.assessment.shouldBlock) {
    newThresholds.mediumMax = Math.max(20, thresholds.mediumMax - 1);
    newThresholds.lowMax = Math.max(10, thresholds.lowMax - 1);
    logger.debug('Adapting thresholds: false negative detected', {
      event: 'risk_engine.adapt',
      metadata: { transactionId: record.transactionId },
    });
  }

  return newThresholds;
}
