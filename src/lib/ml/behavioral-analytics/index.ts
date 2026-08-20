/**
 * Behavioral Analytics Module - Index
 * Main entry point for user behavior analysis system
 *
 * @module ml/behavioral-analytics
 */

// Re-export all types
export * from './types';

// Re-export event tracking functions
export {
  processEvent,
  isValidEventType,
  generateEventId,
  generateSessionId,
  createDefaultDeviceInfo,
  extractPage,
  categorizeEvent,
  calculateEventWeight,
  filterEventsByTimeRange,
  filterEventsByUser,
  aggregateEventsByPage,
  getMostFrequentPages,
} from './events';

// Re-export profile functions
export {
  createOrUpdateProfile,
  calculateDevicePreferences as _calculateDevicePreferences,
  getTopPages as _getTopPages,
  calculateActiveHours as _calculateActiveHours,
  calculateBehaviorScores as _calculateBehaviorScores,
  calculateConsistencyScore as _calculateConsistencyScore,
  calculateConversionPropensity as _calculateConversionPropensity,
  determineEngagementLevel as _determineEngagementLevel,
  determineAdoptionStatus as _determineAdoptionStatus,
  calculateConversionRate as _calculateConversionRate,
  calculateAvgSessionDuration as _calculateAvgSessionDuration,
  calculateBounceRate as _calculateBounceRate,
} from './profiles';
export { createOrUpdateProfile as createUserProfile };

// Re-export funnel analysis
export {
  PAYMENT_FUNNEL,
  SIGNUP_FUNNEL,
  analyzeFunnel,
  recordConversion,
  trackFunnelConversions,
} from './funnels';

// Re-export segmentation
export {
  SEGMENT_DEFINITIONS,
  determineUserSegments,
  getPrimarySegment,
  getSegmentStatistics,
  filterBySegment,
  getPowerUserInsights,
  getAtRiskInsights,
} from './segments';

// Re-export recommendations
export {
  generateRecommendations,
  generatePlatformRecommendations,
} from './recommendations';

// Import for main class
import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import {
  BehaviorEvent,
  UserProfile,
  AnalyticsConfig,
  BehaviorRecommendation,
  FunnelAnalysis,
  UserSegment,
} from './types';
import { processEvent } from './events';
import { createOrUpdateProfile } from './profiles';
import { analyzeFunnel, PAYMENT_FUNNEL, SIGNUP_FUNNEL } from './funnels';
import { determineUserSegments, getPrimarySegment, getSegmentStatistics } from './segments';
import { generateRecommendations, generatePlatformRecommendations } from './recommendations';

// ============== Default Configuration ==============

const DEFAULT_CONFIG: AnalyticsConfig = {
  sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
  maxEventsPerUser: 10000,
  maxProfilesCached: 1000,
  enableScoring: true,
  enableSegmentation: true,
  enableRecommendations: true,
};

// ============== Main Analytics Engine Class ==============

/**
 * Main Behavioral Analytics Engine
 * Orchestrates all behavioral analytics functionality
 */
export class BehavioralAnalyticsEngine {
  private events: Map<string, BehaviorEvent[]> = new Map();
  private profiles: Map<string, UserProfile> = new Map();
  private config: AnalyticsConfig;
  
  constructor(config?: Partial<AnalyticsConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('BehavioralAnalyticsEngine initialized', {
      event: 'analytics.init',
      metadata: { config: this.config },
    });
  }
  
  /**
   * Track a new event
   */
  trackEvent(rawEvent: Record<string, unknown>): BehaviorEvent {
    const event = processEvent(rawEvent as Partial<BehaviorEvent>);
    
    // Store by user
    const userEvents = this.events.get(event.userId) || [];
    userEvents.push(event);
    
    // Limit events per user
    if (userEvents.length > this.config.maxEventsPerUser) {
      userEvents.shift(); // Remove oldest
    }
    
    this.events.set(event.userId, userEvents);
    
    // Update profile if enabled
    if (this.config.enableScoring) {
      this.updateUserProfile(event.userId);
    }
    
    return event;
  }
  
  /**
   * Get user profile
   */
  getUserProfile(userId: string): UserProfile | null {
    return this.profiles.get(userId) || null;
  }
  
  /**
   * Get user segments
   */
  getUserSegments(userId: string): UserSegment[] {
    const profile = this.profiles.get(userId);
    if (!profile) return [];
    return determineUserSegments(profile);
  }
  
  /**
   * Get primary segment
   */
  getPrimaryUserSegment(userId: string): UserSegment {
    const profile = this.profiles.get(userId);
    if (!profile) return 'casual_user';
    return getPrimarySegment(profile);
  }
  
  /**
   * Analyze payment funnel
   */
  analyzePaymentFunnel(options?: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
  }): FunnelAnalysis {
    const allEvents = Array.from(this.events.values()).flat();
    return analyzeFunnel(PAYMENT_FUNNEL, allEvents, options);
  }
  
  /**
   * Get recommendations for a user
   */
  getRecommendations(userId: string): BehaviorRecommendation[] {
    const profile = this.profiles.get(userId);
    const userEvents = this.events.get(userId) || [];
    
    if (!profile) return [];
    
    return generateRecommendations(profile, userEvents);
  }
  
  /**
   * Get platform-wide recommendations
   */
  getPlatformRecommendations(): BehaviorRecommendation[] {
    const allProfiles = Array.from(this.profiles.values());
    const allEvents = Array.from(this.events.values()).flat();
    
    return generatePlatformRecommendations(allProfiles, allEvents);
  }
  
  /**
   * Get segment statistics
   */
  getSegmentStats(): Map<string, { count: number; percentage: number }> {
    const allProfiles = Array.from(this.profiles.values());
    return getSegmentStatistics(allProfiles) as unknown as Map<string, { count: number; percentage: number }>;
  }
  
  /**
   * Update user profile based on latest events
   */
  private updateUserProfile(userId: string): void {
    const userEvents = this.events.get(userId) || [];
    const existingProfile = this.profiles.get(userId);
    
    const updatedProfile = createOrUpdateProfile(existingProfile, userEvents, this.config);
    this.profiles.set(userId, updatedProfile);
  }
}

// ============== Utility Functions ==============

/**
 * Create a new analytics engine instance
 */
export function createBehavioralAnalyticsEngine(
  config?: Partial<AnalyticsConfig>
): BehavioralAnalyticsEngine {
  return new BehavioralAnalyticsEngine(config);
}
