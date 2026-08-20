/**
 * Behavior Scoring Module for Behavioral Analytics
 * @module ml/behavioral-analytics/scoring
 * @description Provides scoring utilities and calculations
 */

import type {
  BehaviorEvent,
  SessionData,
  BehaviorScores,
  EngagementWeights,
  UserSegment,
  SegmentationThresholds,
} from './types';

import { DEFAULT_CONFIG } from './types';

/**
 * Calculate engagement score from events
 */
export function calculateEngagementScore(
  events: BehaviorEvent[],
  weights: EngagementWeights = DEFAULT_CONFIG.engagementWeights
): number {
  let score = 0;
  const eventCounts = new Map<string, number>();
  
  for (const event of events) {
    eventCounts.set(event.eventType, (eventCounts.get(event.eventType) || 0) + 1);
  }

  score += (eventCounts.get('page_view') || 0) * weights.pageViewWeight;
  score += (eventCounts.get('click') || 0) * weights.clickWeight;
  score += ((eventCounts.get('form_submit') || 0) + (eventCounts.get('form_start') || 0)) * weights.formWeight;
  score += ((eventCounts.get('payment_init') || 0) + (eventCounts.get('payment_complete') || 0)) * weights.paymentWeight;
  score += (eventCounts.get('navigation') || 0) * weights.navigationWeight;
  score += (eventCounts.get('search') || 0) * weights.searchWeight;
  score += (eventCounts.get('item_select') || 0) * weights.featureAdoptionWeight;

  return Math.min(100, Math.round((score / 50) * 100));
}

/**
 * Calculate consistency score from sessions
 */
export function calculateConsistencyScore(sessions: SessionData[]): number {
  if (sessions.length < 2) {
    return sessions.length === 1 ? 50 : 0;
  }

  const durations = sessions.map(s => s.durationSeconds).filter(d => d > 0);
  if (durations.length < 2) return 50;

  const meanDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - meanDuration, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);

  return Math.max(0, Math.min(100, Math.round(100 - (stdDev / 3))));
}

/**
 * Calculate conversion propensity from sessions
 */
export function calculateConversionPropensity(sessions: SessionData[]): number {
  if (sessions.length === 0) return 0;

  const convertedSessions = sessions.filter(s => s.converted).length;
  const baseRate = (convertedSessions / sessions.length) * 100;

  const recentSessions = sessions.slice(-10);
  const recentConversionRate = recentSessions.length > 0
    ? (recentSessions.filter(s => s.converted).length / recentSessions.length) * 100
    : 0;

  return Math.min(100, Math.round(baseRate * 0.4 + recentConversionRate * 0.6));
}

/**
 * Calculate loyalty score
 */
export function calculateLoyaltyScore(events: BehaviorEvent[], sessions: SessionData[]): number {
  if (events.length === 0) return 0;

  const firstEvent = events[0].timestamp;
  const lastEvent = events[events.length - 1].timestamp;
  const daysActive = (lastEvent.getTime() - firstEvent.getTime()) / (1000 * 60 * 60 * 24);

  if (daysActive < 1) return 30;

  const frequencyScore = Math.min(100, (sessions.length / daysActive) * 20);
  const daysSinceLastActivity = (Date.now() - lastEvent.getTime()) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, Math.min(100, 100 - (daysSinceLastActivity * 3)));
  const tenureScore = Math.min(100, daysActive * 2);

  return Math.round(frequencyScore * 0.35 + recencyScore * 0.35 + tenureScore * 0.3);
}

/**
 * Calculate trust score
 */
export function calculateTrustScore(events: BehaviorEvent[], consistencyScore: number): number {
  let trustScore = 50;

  trustScore += (consistencyScore - 50) * 0.3;

  // Check for rapid actions
  let rapidCount = 0;
  for (let i = 1; i < events.length; i++) {
    const timeDiff = events[i].timestamp.getTime() - events[i - 1].timestamp.getTime();
    if (timeDiff < 1000) rapidCount++;
  }
  if (rapidCount > events.length * 0.3) trustScore -= 20;

  // Check unusual timing
  const lateNightEvents = events.filter(e => {
    const hour = e.timestamp.getHours();
    return hour >= 1 && hour <= 4;
  });
  if (lateNightEvents.length > events.length * 0.4) trustScore -= 10;

  // Positive signals
  if (events.some(e => e.eventType === 'payment_complete' || e.eventType === 'signup')) {
    trustScore += 15;
  }

  const loginEvents = events.filter(e => e.eventType === 'login');
  if (loginEvents.length >= 3) trustScore += 10;

  return Math.max(0, Math.min(100, Math.round(trustScore)));
}

/**
 * Calculate risk score
 */
export function calculateRiskScore(events: BehaviorEvent[], scores: BehaviorScores): number {
  let riskScore = 0;

  riskScore += (100 - scores.trustScore) * 0.4;
  riskScore += (100 - scores.consistencyScore) * 0.2;

  let rapidCount = 0;
  for (let i = 1; i < events.length; i++) {
    const timeDiff = events[i].timestamp.getTime() - events[i - 1].timestamp.getTime();
    if (timeDiff < 1000) rapidCount++;
  }
  if (rapidCount > events.length * 0.3) riskScore += 25;

  const failedPayments = events.filter(e => e.eventType === 'payment_failed').length;
  riskScore += Math.min(20, failedPayments * 5);

  const devices = new Set(events.map(e => e.deviceInfo.deviceId));
  if (devices.size > 5) riskScore += 15;

  return Math.min(100, Math.round(riskScore));
}

/**
 * Calculate churn probability
 */
export function calculateChurnProbability(
  events: BehaviorEvent[],
  scores: BehaviorScores,
  sessions: SessionData[]
): number {
  let churnProb = 0;

  const lastEvent = events[events.length - 1];
  const daysSinceLastActivity = (Date.now() - lastEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSinceLastActivity > 30) churnProb += 0.5;
  else if (daysSinceLastActivity > 14) churnProb += 0.3;
  else if (daysSinceLastActivity > 7) churnProb += 0.15;

  if (scores.engagementScore < 30) churnProb += 0.2;
  else if (scores.engagementScore < 50) churnProb += 0.1;

  churnProb += (100 - scores.loyaltyScore) * 0.002;

  return Math.min(1, Math.round(churnProb * 100) / 100);
}

/**
 * Determine user segment
 */
export function determineUserSegment(
  events: BehaviorEvent[],
  sessions: SessionData[],
  scores: BehaviorScores,
  thresholds: SegmentationThresholds = DEFAULT_CONFIG.segmentationThresholds
): UserSegment {
  const lastEvent = events[events.length - 1];
  const daysSinceLastActivity = (Date.now() - lastEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceLastActivity > thresholds.churnedDaysInactive) return 'churned_user';
  if (daysSinceLastActivity > thresholds.atRiskDaysInactive) return 'at_risk_user';

  if (sessions.length >= thresholds.powerUserThreshold && scores.engagementScore >= thresholds.highEngagementScore) {
    return 'power_user';
  }

  const paymentEvents = events.filter(e => 
    e.eventType === 'payment_complete' || e.eventType === 'payment_init'
  );
  if (paymentEvents.length >= thresholds.businessUserMinTransactions) return 'business_user';
  if (scores.loyaltyScore >= 80 && scores.trustScore >= 80) return 'premium_user';
  if (scores.engagementScore >= 50 && sessions.length >= 5) return 'active_user';

  const firstEvent = events[0];
  const daysSinceFirstEvent = (Date.now() - firstEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceFirstEvent <= 7) return 'new_user';

  return 'casual_user';
}

/**
 * Get engagement level from score
 */
export function getEngagementLevel(score: number): 'low' | 'medium' | 'high' | 'very_high' {
  if (score >= 85) return 'very_high';
  if (score >= 65) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}
