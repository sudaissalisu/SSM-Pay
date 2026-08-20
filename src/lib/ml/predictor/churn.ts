/**
 * Churn Prediction Logic
 * @module ml/predictor/churn
 * @description Customer churn probability prediction and risk factor analysis.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import {
  CustomerProfile,
  ChurnPrediction,
  ChurnFactor,
  ChurnRiskLevel,
  PredictionResult,
} from './types';
import { sigmoid } from './volume';

// ============== Churn Factor Calculation ==============

/**
 * Calculate individual churn factors for a customer profile
 */
export function calculateChurnFactors(profile: CustomerProfile): ChurnFactor[] {
  const factors: ChurnFactor[] = [];
  
  // Recency factor - most important
  factors.push({
    name: 'recency',
    weight: 0.25,
    value: profile.daysSinceLastTransaction,
    threshold: 30,
    isConcerning: profile.daysSinceLastTransaction > 30,
  });
  
  // Frequency factor
  factors.push({
    name: 'frequency',
    weight: 0.20,
    value: profile.transactionFrequency,
    threshold: 2,
    isConcerning: profile.transactionFrequency < 2,
  });
  
  // Engagement score
  factors.push({
    name: 'engagement',
    weight: 0.15,
    value: profile.engagementScore,
    threshold: 40,
    isConcerning: profile.engagementScore < 40,
  });
  
  // Success rate
  factors.push({
    name: 'success_rate',
    weight: 0.15,
    value: profile.successRate,
    threshold: 0.8,
    isConcerning: profile.successRate < 0.8,
  });
  
  // Spend trend
  factors.push({
    name: 'spend_trend',
    weight: 0.15,
    value: profile.spendTrend,
    threshold: -0.2,
    isConcerning: profile.spendTrend < -0.2,
  });
  
  // Recent failures
  factors.push({
    name: 'recent_failures',
    weight: 0.10,
    value: profile.failedTransactions30d,
    threshold: 3,
    isConcerning: profile.failedTransactions30d > 3,
  });
  
  return factors;
}

/**
 * Calculate logistic-style churn score from factors
 */
export function calculateLogisticScore(factors: ChurnFactor[]): number {
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const factor of factors) {
    // Normalize factor value to 0-1 range based on whether concerning
    const normalizedValue = factor.isConcerning ? 1 : 0.3;
    weightedSum += factor.weight * normalizedValue;
    totalWeight += factor.weight;
  }
  
  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  
  // Apply sigmoid to get probability
  return sigmoid((rawScore - 0.4) * 10);
}

/**
 * Classify churn risk level from probability
 */
export function classifyChurnRisk(probability: number): ChurnRiskLevel {
  if (probability >= 0.8) return 'critical';
  if (probability >= 0.6) return 'high';
  if (probability >= 0.35) return 'medium';
  return 'low';
}

/**
 * Estimate days until likely churn
 */
export function estimateDaysToChurn(profile: CustomerProfile, churnProb: number): number {
  const baseDays = profile.daysSinceLastTransaction;
  const probAdjustment = Math.round((1 - churnProb) * 60);
  
  return Math.max(1, Math.min(baseDays, baseDays + 30 - probAdjustment));
}

/**
 * Generate churn prevention recommendations
 */
export function generateChurnRecommendations(
  profile: CustomerProfile,
  factors: ChurnFactor[],
  riskLevel: ChurnRiskLevel
): string[] {
  const recommendations: string[] = [];
  
  for (const factor of factors) {
    if (!factor.isConcerning) continue;
    
    switch (factor.name) {
      case 'recency':
        recommendations.push('Send re-engagement email or push notification');
        recommendations.push('Offer time-limited incentive for next transaction');
        break;
      case 'frequency':
        recommendations.push('Introduce loyalty program benefits');
        recommendations.push('Create usage reminders or tips');
        break;
      case 'engagement':
        recommendations.push('Personalize user experience based on preferences');
        recommendations.push('Reach out for feedback on improving experience');
        break;
      case 'success_rate':
        recommendations.push('Review and address common failure reasons');
        recommendations.push('Offer alternative payment methods');
        break;
      case 'spend_trend':
        recommendations.push('Analyze competitive offerings');
        recommendations.push('Consider targeted discount or promotion');
        break;
      case 'recent_failures':
        recommendations.push('Investigate recent transaction failures');
        recommendations.push('Proactively reach out to resolve issues');
        break;
    }
  }
  
  // Add risk-level specific recommendations
  switch (riskLevel) {
    case 'critical':
      recommendations.unshift('Immediate intervention required - assign account manager');
      break;
    case 'high':
      recommendations.unshift('Schedule proactive outreach call');
      break;
    case 'medium':
      recommendations.push('Add to monitoring list for weekly review');
      break;
  }
  
  return [...new Set(recommendations)]; // Remove duplicates
}

/**
 * Calculate prediction confidence based on factor quality
 */
export function calculatePredictionConfidence(factors: ChurnFactor[]): number {
  const concerningFactors = factors.filter(f => f.isConcerning).length;
  const baseConfidence = 0.7;
  const factorBonus = (concerningFactors / factors.length) * 0.25;
  
  return Math.min(0.95, baseConfidence + factorBonus);
}

// ============== Full Churn Prediction ==============

/**
 * Perform complete churn prediction analysis
 */
export function predictChurn(
  profile: CustomerProfile,
  modelVersion: string
): PredictionResult<ChurnPrediction> {
  const startTime = Date.now();
  
  try {
    // Calculate churn probability using logistic regression-like scoring
    const factors = calculateChurnFactors(profile);
    const churnProbability = calculateLogisticScore(factors);
    
    // Determine risk level
    const riskLevel = classifyChurnRisk(churnProbability);
    
    // Estimate days until churn
    const daysToChurn = estimateDaysToChurn(profile, churnProbability);
    
    // Generate recommendations
    const recommendations = generateChurnRecommendations(profile, factors, riskLevel);
    
    const prediction: ChurnPrediction = {
      customerId: profile.customerId,
      churnProbability,
      riskLevel,
      factors,
      recommendations,
      daysToChurn,
    };
    
    const result: PredictionResult<ChurnPrediction> = {
      predictions: prediction,
      modelVersion,
      predictedAt: new Date(),
      confidence: calculatePredictionConfidence(factors),
      featuresUsed: factors.map(f => f.name),
      processingTimeMs: Date.now() - startTime,
    };
    
    logger.info('Churn prediction completed', {
      event: 'ml.predictor.churn-complete',
      metadata: {
        customerId: profile.customerId,
        churnProbability,
        riskLevel,
        processingTimeMs: result.processingTimeMs,
      },
    });
    
    return result;
  } catch (error) {
    logger.error('Churn prediction failed', {
      event: 'ml.predictor.churn-error',
      metadata: { customerId: profile.customerId },
      error: error instanceof Error ? error : new Error(String(error)),
    });
    throw error instanceof AppError ? error : new AppError(
      'Failed to generate churn prediction',
      ErrorCode.UNKNOWN_ERROR,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}
