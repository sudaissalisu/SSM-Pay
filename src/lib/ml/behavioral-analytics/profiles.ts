/**
 * User Profiling Module for Behavioral Analytics
 * Creates and manages user behavior profiles
 *
 * @module ml/behavioral-analytics/profiles
 */

import { logger } from '@/lib/logger';
import {
  UserProfile,
  BehaviorEvent,
  DeviceInfo,
  PageFrequency,
  DevicePreference,
  BehaviorScores,
  EngagementLevel,
  AdoptionStatus,
  AnalyticsConfig,
  SegmentationThresholds,
} from './types';
import { 
  filterEventsByUser, 
  aggregateEventsByPage, 
  calculateEventWeight,
  categorizeEvent 
} from './events';

// ============== Profile Creation ==============

/**
 * Create or update a user profile from events
 */
export function createOrUpdateProfile(
  existingProfile: UserProfile | null,
  events: BehaviorEvent[],
  config: AnalyticsConfig
): UserProfile {
  const userId = existingProfile?.userId || (events[0]?.userId || 'unknown');
  
  // Calculate basic metrics
  const totalEvents = events.length;
  const uniquePages = new Set(events.map(e => e.page)).size;
  const uniqueSessions = new Set(events.map(e => e.sessionId)).size;
  
  // Time-based calculations
  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];
  const accountAgeDays = firstEvent 
    ? Math.max(1, Math.floor((Date.now() - firstEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24)))
    : 1;
  
  // Device preferences
  const devicePreferences = calculateDevicePreferences(events);
  
  // Page frequencies
  const pageFrequencies = getTopPages(events, 10);
  
  // Active hours calculation
  const activeHours = calculateActiveHours(events);
  
  // Calculate scores
  const scores = calculateBehaviorScores(events, accountAgeDays);
  
  // Determine engagement level and adoption status
  const engagementLevel = determineEngagementLevel(scores.engagementScore);
  const adoptionStatus = determineAdoptionStatus(events, scores);
  
  return {
    userId,
    totalEvents: existingProfile ? existingProfile.totalEvents + totalEvents : totalEvents,
    uniquePagesVisited: Math.max(existingProfile?.uniquePagesVisited || 0, uniquePages),
    totalSessions: existingProfile ? existingProfile.totalSessions + uniqueSessions : uniqueSessions,
    accountAgeDays: existingProfile?.accountAgeDays || accountAgeDays,
    firstSeenAt: existingProfile?.firstSeenAt || firstEvent?.timestamp || new Date(),
    lastActiveAt: lastEvent?.timestamp || new Date(),
    devicePreferences,
    pageFrequencies,
    activeHours,
    scores,
    engagementLevel,
    adoptionStatus,
    conversionRate: calculateConversionRate(events),
    avgSessionDuration: calculateAvgSessionDuration(events),
    bounceRate: calculateBounceRate(events),
  };
}

/**
 * Calculate device preferences from events
 */
function calculateDevicePreferences(events: BehaviorEvent[]): DevicePreference[] {
  const deviceMap = new Map<string, { count: number; device: DeviceInfo }>();
  
  for (const event of events) {
    const key = `${event.deviceInfo.deviceType}_${event.deviceInfo.os}`;
    const existing = deviceMap.get(key);
    
    if (existing) {
      existing.count++;
    } else {
      deviceMap.set(key, { count: 1, device: event.deviceInfo });
    }
  }
  
  return Array.from(deviceMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ count, device }) => ({
      deviceId: device.deviceId,
      deviceType: device.deviceType,
      usagePercentage: 0, // Will be calculated relative to total
      lastUsed: new Date(), // Would need actual timestamps
      preferred: count > events.length * 0.5,
    }));
}

/**
 * Get top pages by frequency
 */
function getTopPages(events: BehaviorEvent[], limit: number): PageFrequency[] {
  const pageCounts = aggregateEventsByPage(events);
  
  return Array.from(pageCounts.entries())
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Calculate active hours from events
 */
function calculateActiveHours(events: BehaviorEvent[]): number[] {
  const hourCounts = new Array(24).fill(0);
  
  for (const event of events) {
    const hour = event.timestamp.getHours();
    hourCounts[hour]++;
  }
  
  // Return hours where user is active (above threshold)
  const threshold = Math.max(1, events.length * 0.02); // 2% of events in that hour
  return hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(({ count }) => count >= threshold)
    .map(({ hour }) => hour);
}

/**
 * Calculate all behavior scores
 */
function calculateBehaviorScores(
  events: BehaviorEvent[],
  accountAgeDays: number
): BehaviorScores {
  const totalWeight = events.reduce((sum, e) => sum + calculateEventWeight(e.eventType), 0);
  
  // Engagement score (0-100)
  const engagementScore = Math.min(100, Math.round(
    (totalWeight / Math.max(1, accountAgeDays)) * 10
  ));
  
  // Consistency score based on regular activity
  const consistencyScore = calculateConsistencyScore(events);
  
  // Conversion propensity
  const conversionPropensity = calculateConversionPropensity(events);
  
  // Exploration score
  const explorationScore = Math.min(100, Math.round(
    (new Set(events.map(e => e.page)).size / Math.max(1, accountAgeDays)) * 20
  ));
  
  // Loyalty score (based on return visits)
  const loyaltyScore = Math.min(100, Math.round(
    (new Set(events.map(e => e.sessionId)).size / Math.max(1, accountAgeDays)) * 15
  ));
  
  // Trust score (combination of factors)
  const trustScore = Math.round(
    (engagementScore * 0.3 + consistencyScore * 0.25 + loyaltyScore * 0.25 + explorationScore * 0.2)
  );
  
  return {
    engagementScore,
    consistencyScore,
    conversionPropensity,
    explorationScore,
    loyaltyScore,
    trustScore,
  };
}

/**
 * Calculate consistency score (0-100)
 */
function calculateConsistencyScore(events: BehaviorEvent[]): number {
  if (events.length < 2) return 50;
  
  // Group events by day
  const dailyEvents = new Map<string, number>();
  for (const event of events) {
    const day = event.timestamp.toISOString().split('T')[0];
    dailyEvents.set(day, (dailyEvents.get(day) || 0) + 1);
  }
  
  const days = Array.from(dailyEvents.values());
  const mean = days.reduce((a, b) => a + b, 0) / days.length;
  const variance = days.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / days.length;
  const stdDev = Math.sqrt(variance);
  
  // Lower variance = higher consistency
  const coefficientOfVariation = stdDev / mean;
  return Math.min(100, Math.round(Math.max(0, 100 - coefficientOfVariation * 100)));
}

/**
 * Calculate conversion propensity (0-100)
 */
function calculateConversionPropensity(events: BehaviorEvent[]): number {
  const conversionEvents = events.filter(e => 
    ['payment_init', 'payment_complete', 'form_submit', 'signup'].includes(e.eventType)
  );
  
  if (events.length === 0) return 0;
  return Math.min(100, Math.round((conversionEvents.length / events.length) * 500));
}

/**
 * Determine engagement level from score
 */
function determineEngagementLevel(score: number): EngagementLevel {
  if (score >= 80) return 'very_high';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

/**
 * Determine adoption status
 */
function determineAdoptionStatus(
  events: BehaviorEvent[],
  scores: BehaviorScores
): AdoptionStatus {
  const hasConversion = events.some(e => 
    ['payment_complete', 'payment_init'].includes(e.eventType)
  );
  
  if (scores.trustScore >= 80 && hasConversion) return 'power_user';
  if (scores.trustScore >= 60 && hasConversion) return 'adopted';
  if (scores.engagementScore >= 30) return 'trialing';
  if (scores.engagementScore >= 10) return 'aware';
  return 'not_adopted';
}

/**
 * Calculate conversion rate
 */
function calculateConversionRate(events: BehaviorEvent[]): number {
  const initiations = events.filter(e => e.eventType === 'payment_init').length;
  const completions = events.filter(e => e.eventType === 'payment_complete').length;
  
  return initiations > 0 ? completions / initiations : 0;
}

/**
 * Calculate average session duration in minutes
 */
function calculateAvgSessionDuration(events: BehaviorEvent[]): number {
  const sessionDurations = new Map<string, number>();
  
  for (const event of events) {
    const session = event.sessionId;
    const existing = sessionDurations.get(session);
    
    if (!existing) {
      sessionDurations.set(session, 0);
    }
  }
  
  // Simplified: assume average 3 minutes per session with events
  return sessionDurations.size > 0 ? 3 : 0;
}

/**
 * Calculate bounce rate (single-page sessions)
 */
function calculateBounceRate(events: BehaviorEvent[]): number {
  const sessionPageCount = new Map<string, Set<string>>();
  
  for (const event of events) {
    const session = event.sessionId;
    if (!sessionPageCount.has(session)) {
      sessionPageCount.set(session, new Set());
    }
    sessionPageCount.get(session)!.add(event.page);
  }
  
  const singlePageSessions = Array.from(sessionPageCount.values())
    .filter(pages => pages.size === 1).length;
  
  const totalSessions = sessionPageCount.size;
  return totalSessions > 0 ? singlePageSessions / totalSessions : 0;
}
