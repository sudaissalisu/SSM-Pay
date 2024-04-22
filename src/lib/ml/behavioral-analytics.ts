/**
 * Behavioral Analytics Module for SSM-Pay Payment Platform
 * Enterprise-grade user behavior analysis system
 *
 * @module ml/behavioral-analytics
 * @description Comprehensive behavioral analytics including user profiling, session analysis,
 * navigation pattern tracking, conversion funnel analysis, user segmentation,
 * and behavior-based recommendations.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Type Definitions ==============

/**
 * Represents a single user interaction event within the platform
 */
export interface BehaviorEvent {
  /** Unique identifier for the event */
  id: string;
  /** User identifier (hashed/anonymized) */
  userId: string;
  /** Session identifier */
  sessionId: string;
  /** Event type classification */
  eventType: EventType;
  /** Page or screen where event occurred */
  page: string;
  /** Specific element or component interacted with */
  element?: string;
  /** Timestamp of when the event occurred */
  timestamp: Date;
  /** Additional metadata about the event */
  metadata: Record<string, unknown>;
  /** Device information at time of event */
  deviceInfo: DeviceInfo;
  /** Geographic location data */
  geoLocation?: GeoLocation;
}

/**
 * Classification of event types tracked by the system
 */
export type EventType =
  | 'page_view'
  | 'click'
  | 'scroll'
  | 'form_submit'
  | 'form_start'
  | 'form_abandon'
  | 'payment_init'
  | 'payment_complete'
  | 'payment_failed'
  | 'navigation'
  | 'search'
  | 'filter_apply'
  | 'item_select'
  | 'logout'
  | 'login'
  | 'signup'
  | 'error'
  | 'api_call'
  | 'download'
  | 'share'
  | 'bookmark'
  | 'feedback_submit';

/**
 * Device information captured with each event
 */
export interface DeviceInfo {
  /** Unique device fingerprint */
  deviceId: string;
  /** Device type category */
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'smart_tv' | 'other';
  /** Operating system name */
  os: string;
  /** Browser or application name */
  browser: string;
  /** Screen resolution width */
  screenWidth: number;
  /** Screen resolution height */
  screenHeight: number;
  /** User agent string (truncated) */
  userAgent: string;
}

/**
 * Geographic location derived from IP geolocation
 */
export interface GeoLocation {
  /** ISO 3166-1 alpha-2 country code */
  countryCode: string;
  /** Country name */
  countryName: string;
  /** Region/state code */
  regionCode?: string;
  /** City name */
  city?: string;
  /** Latitude coordinate */
  latitude?: number;
  /** Longitude coordinate */
  longitude?: number;
}

/**
 * Aggregated session data representing a complete user session
 */
export interface SessionData {
  /** Session identifier */
  sessionId: string;
  /** Associated user identifier */
  userId: string;
  /** Session start timestamp */
  startTime: Date;
  /** Session end timestamp (null if active) */
  endTime: Date | null;
  /** Total duration in seconds */
  durationSeconds: number;
  /** All events in this session */
  events: BehaviorEvent[];
  /** Pages visited during session */
  pagesVisited: string[];
  /** Entry page of the session */
  entryPage: string;
  /** Exit page of the session (null if active) */
  exitPage: string | null;
  /** Number of page views in session */
  pageViewCount: number;
  /** Number of interactions (clicks, forms, etc.) */
  interactionCount: number;
  /** Whether session resulted in conversion */
  converted: boolean;
  /** Conversion type if applicable */
  conversionType?: ConversionType;
  /** Device used during session */
  deviceInfo: DeviceInfo;
  /** Bounce flag - only one page viewed */
  isBounce: boolean;
}

/**
 * Types of conversions tracked in the platform
 */
export type ConversionType =
  | 'payment_completed'
  | 'account_created'
  | 'zainbox_created'
  | 'kyc_submitted'
  | 'referral_sent'
  | 'feature_adopted';

/**
 * Comprehensive user behavior profile
 */
export interface UserProfile {
  /** User identifier */
  userId: string;
  /** Profile creation date */
  createdAt: Date;
  /** Last activity timestamp */
  lastActiveAt: Date;
  /** Total sessions count */
  totalSessions: number;
  /** Total events tracked */
  totalEvents: number;
  /** Average session duration in seconds */
  avgSessionDuration: number;
  /** Most frequently visited pages */
  topPages: PageFrequency[];
  /** User's preferred device types */
  devicePreferences: DevicePreference[];
  /** Activity by hour of day (0-23) */
  hourlyActivity: number[];
  /** Activity by day of week (0=Sunday, 6=Saturday) */
  weeklyActivity: number[];
  /** Behavioral scores */
  behaviorScores: BehaviorScores;
  /** User segment assignment */
  segment: UserSegment;
  /** Engagement level classification */
  engagementLevel: EngagementLevel;
  /** Risk assessment score (0-100) */
  riskScore: number;
  /** Predicted churn probability (0-1) */
  churnProbability: number;
  /** Lifetime value prediction */
  predictedLTV: number;
  /** Feature adoption map */
  featureAdoption: Record<string, AdoptionStatus>;
  /** Navigation patterns identified */
  navigationPatterns: NavigationPattern[];
  /** Conversion history */
  conversionHistory: ConversionRecord[];
}

/**
 * Page visit frequency record
 */
export interface PageFrequency {
  /** Page path */
  page: string;
  /** Visit count */
  count: number;
  /** Percentage of total visits */
  percentage: number;
}

/**
 * Device usage preference
 */
export interface DevicePreference {
  /** Device type */
  deviceType: DeviceInfo['deviceType'];
  /** Usage count */
  count: number;
  /** Percentage of total sessions */
  percentage: number;
}

/**
 * Composite behavioral scoring metrics
 */
export interface BehaviorScores {
  /** Overall engagement score (0-100) */
  engagementScore: number;
  /** Navigation consistency score (0-100) */
  consistencyScore: number;
  /** Conversion propensity score (0-100) */
  conversionPropensity: number;
  /** Feature exploration score (0-100) */
  explorationScore: number;
  /** Loyalty indicator score (0-100) */
  loyaltyScore: number;
  /** Trustworthiness score based on behavior patterns (0-100) */
  trustScore: number;
}

/**
 * User segmentation categories
 */
export type UserSegment =
  | 'new_user'
  | 'active_user'
  | 'power_user'
  | 'at_risk_user'
  | 'churned_user'
  | 'premium_user'
  | 'casual_user'
  | 'business_user';

/**
 * User engagement level classification
 */
export type EngagementLevel = 'low' | 'medium' | 'high' | 'very_high';

/**
 * Feature adoption status tracking
 */
export type AdoptionStatus = 'not_adopted' | 'aware' | 'trialing' | 'adopted' | 'power_user';

/**
 * Identified navigation pattern
 */
export interface NavigationPattern {
  /** Pattern identifier */
  id: string;
  /** Human-readable pattern name */
  name: string;
  /** Sequence of pages in pattern */
  pageSequence: string[];
  /** Frequency of this pattern occurrence */
  frequency: number;
  /** Average time to complete pattern (seconds) */
  avgDuration: number;
  /** Conversion rate for users following this pattern */
  conversionRate: number;
  /** Confidence score for pattern detection (0-1) */
  confidence: number;
}

/**
 * Individual conversion record
 */
export interface ConversionRecord {
  /** Conversion type */
  type: ConversionType;
  /** Timestamp of conversion */
  timestamp: Date;
  /** Session where conversion occurred */
  sessionId: string;
  /** Time to convert from session start (seconds) */
  timeToConvert: number;
  /** Funnel steps completed before conversion */
  funnelStepsCompleted: string[];
}

/**
 * Conversion funnel definition and analysis
 */
export interface ConversionFunnel {
  /** Unique funnel identifier */
  id: string;
  /** Descriptive name for the funnel */
  name: string;
  /** Ordered list of funnel steps */
  steps: FunnelStep[];
  /** Analysis results */
  analysis: FunnelAnalysis;
}

/**
 * Individual step in a conversion funnel
 */
export interface FunnelStep {
  /** Step identifier */
  id: string;
  /** Step name */
  name: string;
  /** Page or action that defines this step */
  pageOrAction: string;
  /** Expected event type for this step */
  expectedEventType: EventType;
  /** Optional condition function description */
  condition?: string;
}

/**
 * Computed funnel analysis results
 */
export interface FunnelAnalysis {
  /** Total users who entered the funnel */
  totalEntries: number;
  /** Users at each step */
  stepCounts: number[];
  /** Conversion rates between consecutive steps */
  stepConversionRates: number[];
  /** Overall funnel conversion rate */
  overallConversionRate: number;
  /** Average drop-off points */
  dropOffPoints: DropOffPoint[];
  /** Average time spent at each step (seconds) */
  avgTimePerStep: number[];
  /** Analysis period start */
  periodStart: Date;
  /** Analysis period end */
  periodEnd: Date;
}

/**
 * Point where users drop off from funnel
 */
export interface DropOffPoint {
  /** Step index where drop-off occurs */
  stepIndex: number;
  /** Step name */
  stepName: string;
  /** Number of users who dropped off */
  droppedUsers: number;
  /** Drop-off rate as percentage */
  dropOffRate: number;
  /** Common reasons for drop-off (inferred) */
  reasons: string[];
}

/**
 * Recommendation generated by the analytics engine
 */
export interface BehaviorRecommendation {
  /** Recommendation identifier */
  id: string;
  /** Target user segment or specific user */
  targetUserId?: string;
  /** Target segment */
  targetSegment?: UserSegment;
  /** Recommendation category */
  category: RecommendationCategory;
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Recommendation title */
  title: string;
  /** Detailed recommendation description */
  description: string;
  /** Actionable items to implement */
  actions: RecommendationAction[];
  /** Expected impact if implemented */
  expectedImpact: ImpactEstimate;
  /** Confidence in recommendation (0-1) */
  confidence: number;
  /** When recommendation was generated */
  generatedAt: Date;
  /** Expiration timestamp */
  expiresAt: Date;
}

/**
 * Categories of recommendations
 */
export type RecommendationCategory =
  | 'engagement'
  | 'retention'
  | 'conversion'
  | 'upsell'
  | 'onboarding'
  | 'win_back'
  | 'feature_adoption'
  | 'risk_mitigation';

/**
 * Actionable item within a recommendation
 */
export interface RecommendationAction {
  /** Action identifier */
  id: string;
  /** Action description */
  description: string;
  /** Channel to deliver action */
  channel: 'in_app' | 'email' | 'push' | 'sms' | 'banner';
  /** Estimated effort to implement */
  effort: 'low' | 'medium' | 'high';
  /** Expected timeframe for results */
  timeframe: string;
}

/**
 * Estimated impact of implementing a recommendation
 */
export interface ImpactEstimate {
  /** Metric being impacted */
  metric: string;
  /** Expected change (positive or negative percentage) */
  expectedChange: number;
  /** Confidence interval lower bound */
  confidenceLow: number;
  /** Confidence interval upper bound */
  confidenceHigh: number;
  /** Timeframe for impact realization */
  timeframe: string;
}

/**
 * Configuration options for the behavioral analytics engine
 */
export interface AnalyticsConfig {
  /** Minimum session duration to consider valid (seconds) */
  minSessionDuration: number;
  /** Maximum session timeout (seconds of inactivity) */
  sessionTimeout: number;
  /** Minimum events required for profile creation */
  minEventsForProfile: number;
  /** Lookback window for computing profiles (days) */
  profileLookbackDays: number;
  /** Weights for engagement score calculation */
  engagementWeights: EngagementWeights;
  /** Thresholds for segmentation */
  segmentationThresholds: SegmentationThresholds;
  /** Enable predictive features */
  enablePredictions: boolean;
  /** Cache TTL for computed profiles (minutes) */
  cacheTTLMinutes: number;
}

/** Weights for calculating engagement score */
export interface EngagementWeights {
  /** Weight for page view events */
  pageViewWeight: number;
  /** Weight for click events */
  clickWeight: number;
  /** Weight for form interactions */
  formWeight: number;
  /** Weight for payment events */
  paymentWeight: number;
  /** Weight for navigation events */
  navigationWeight: number;
  /** Weight for search events */
  searchWeight: number;
  /** Weight for feature adoption events */
  featureAdoptionWeight: number;
}

/** Thresholds for user segmentation decisions */
export interface SegmentationThresholds {
  /** Sessions per month for power user classification */
  powerUserThreshold: number;
  /** Days inactive for at-risk classification */
  atRiskDaysInactive: number;
  /** Days inactive for churned classification */
  churnedDaysInactive: number;
  /** Minimum engagement score for high engagement */
  highEngagementScore: number;
  /** Minimum transactions for business user */
  businessUserMinTransactions: number;
}

// ============== Default Configuration ==============

const DEFAULT_CONFIG: AnalyticsConfig = {
  minSessionDuration: 5,
  sessionTimeout: 1800, // 30 minutes
  minEventsForProfile: 10,
  profileLookbackDays: 90,
  engagementWeights: {
    pageViewWeight: 1.0,
    clickWeight: 1.5,
    formWeight: 2.0,
    paymentWeight: 3.0,
    navigationWeight: 1.2,
    searchWeight: 1.8,
    featureAdoptionWeight: 2.5,
  },
  segmentationThresholds: {
    powerUserThreshold: 20,
    atRiskDaysInactive: 14,
    churnedDaysInactive: 30,
    highEngagementScore: 70,
    businessUserMinTransactions: 50,
  },
  enablePredictions: true,
  cacheTTLMinutes: 60,
};

// ============== Main Analytics Class ==============

/**
 * BehavioralAnalyticsEngine - Core class for analyzing user behavior patterns
 *
 * @example
 * ```typescript
 * const engine = new BehavioralAnalyticsEngine();
 * await engine.initialize();
 *
 * // Track an event
 * await engine.trackEvent({
 *   id: 'evt_123',
 *   userId: 'user_456',
 *   sessionId: 'sess_789',
 *   eventType: 'page_view',
 *   page: '/dashboard',
 *   timestamp: new Date(),
 *   metadata: {},
 *   deviceInfo: { ... }
 * });
 *
 * // Get user profile
 * const profile = await engine.getUserProfile('user_456');
 * ```
 */
export class BehavioralAnalyticsEngine {
  private config: AnalyticsConfig;
  private eventStore: Map<string, BehaviorEvent[]>;
  private sessionStore: Map<string, SessionData>;
  private profileCache: Map<string, { profile: UserProfile; cachedAt: Date }>;
  private initialized: boolean;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventStore = new Map();
    this.sessionStore = new Map();
    this.profileCache = new Map();
    this.initialized = false;

    logger.info('BehavioralAnalyticsEngine instance created', {
      event: 'behavioral_analytics.init',
      metadata: { config: this.config },
    });
  }

  /**
   * Initialize the analytics engine
   * Sets up internal stores and validates configuration
   */
  async initialize(): Promise<void> {
    try {
      // Validate configuration
      this.validateConfig();

      // Initialize stores
      this.eventStore = new Map();
      this.sessionStore = new Map();
      this.profileCache = new Map();

      this.initialized = true;

      logger.info('BehavioralAnalyticsEngine initialized successfully', {
        event: 'behavioral_analytics.ready',
        metadata: { config: this.config },
      });
    } catch (error) {
      const appError = error instanceof AppError ? error : new AppError(
        'Failed to initialize BehavioralAnalyticsEngine',
        ErrorCode.UNKNOWN_ERROR,
        { cause: error instanceof Error ? error : undefined }
      );
      logger.error('BehavioralAnalyticsEngine initialization failed', {
        event: 'behavioral_analytics.init_error',
        error: appError,
      });
      throw appError;
    }
  }

  /**
   * Validate engine configuration
   * @throws AppError if configuration is invalid
   */
  private validateConfig(): void {
    const { engagementWeights, segmentationThresholds } = this.config;

    // Validate engagement weights sum to reasonable range
    const weightSum = Object.values(engagementWeights).reduce((a, b) => a + b, 0);
    if (weightSum <= 0 || weightSum > 20) {
      throw new AppError(
        'Invalid engagement weights configuration',
        ErrorCode.INVALID_CONFIG,
        { context: { weightSum } }
      );
    }

    // Validate segmentation thresholds are logical
    if (segmentationThresholds.atRiskDaysInactive >= segmentationThresholds.churnedDaysInactive) {
      throw new AppError(
        'At-risk threshold must be less than churned threshold',
        ErrorCode.INVALID_CONFIG,
        { context: segmentationThresholds }
      );
    }
  }

  /**
   * Track a new behavior event
   * @param event - The behavior event to track
   * @throws AppError if engine not initialized or event invalid
   */
  async trackEvent(event: BehaviorEvent): Promise<void> {
    this.ensureInitialized();
    this.validateEvent(event);

    try {
      // Store event by user
      const userEvents = this.eventStore.get(event.userId) || [];
      userEvents.push(event);
      this.eventStore.set(event.userId, userEvents);

      // Update or create session
      this.updateSession(event);

      // Invalidate profile cache for this user
      this.profileCache.delete(event.userId);

      logger.debug('Event tracked successfully', {
        event: 'behavioral_analytics.event_tracked',
        metadata: {
          eventId: event.id,
          userId: event.userId,
          eventType: event.eventType,
          page: event.page,
        },
      });
    } catch (error) {
      const appError = error instanceof AppError ? error : new AppError(
        'Failed to track event',
        ErrorCode.UNKNOWN_ERROR,
        { cause: error instanceof Error ? error : undefined }
      );
      logger.error('Event tracking failed', {
        event: 'behavioral_analytics.track_error',
        error: appError,
        metadata: { eventId: event.id },
      });
      throw appError;
    }
  }

  /**
   * Track multiple events in batch
   * @param events - Array of behavior events to track
   */
  async trackEventsBatch(events: BehaviorEvent[]): Promise<void> {
    this.ensureInitialized();

    if (!events.length) {
      return;
    }

    for (const event of events) {
      await this.trackEvent(event);
    }

    logger.info(`Batch tracking completed: ${events.length} events`, {
      event: 'behavioral_analytics.batch_tracked',
      metadata: { eventCount: events.length },
    });
  }

  /**
   * Validate event structure and required fields
   * @param event - Event to validate
   * @throws AppError if validation fails
   */
  private validateEvent(event: BehaviorEvent): void {
    if (!event.id || typeof event.id !== 'string') {
      throw new AppError('Event ID is required and must be a string', ErrorCode.VALIDATION_ERROR);
    }
    if (!event.userId || typeof event.userId !== 'string') {
      throw new AppError('User ID is required and must be a string', ErrorCode.VALIDATION_ERROR);
    }
    if (!event.sessionId || typeof event.sessionId !== 'string') {
      throw new AppError('Session ID is required and must be a string', ErrorCode.VALIDATION_ERROR);
    }
    if (!event.eventType || !this.isValidEventType(event.eventType)) {
      throw new AppError(`Invalid event type: ${event.eventType}`, ErrorCode.VALIDATION_ERROR);
    }
    if (!event.page || typeof event.page !== 'string') {
      throw new AppError('Page is required and must be a string', ErrorCode.VALIDATION_ERROR);
    }
    if (!(event.timestamp instanceof Date) || isNaN(event.timestamp.getTime())) {
      throw new AppError('Timestamp must be a valid Date object', ErrorCode.VALIDATION_ERROR);
    }
    if (!event.deviceInfo || !event.deviceInfo.deviceId) {
      throw new AppError('Device info with device ID is required', ErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Check if event type is valid
   * @param type - Event type to check
   */
  private isValidEventType(type: string): type is EventType {
    const validTypes: EventType[] = [
      'page_view', 'click', 'scroll', 'form_submit', 'form_start', 'form_abandon',
      'payment_init', 'payment_complete', 'payment_failed', 'navigation', 'search',
      'filter_apply', 'item_select', 'logout', 'login', 'signup', 'error', 'api_call',
      'download', 'share', 'bookmark', 'feedback_submit',
    ];
    return validTypes.includes(type as EventType);
  }

  /**
   * Update session data with new event
   * @param event - New event to incorporate into session
   */
  private updateSession(event: BehaviorEvent): void {
    let session = this.sessionStore.get(event.sessionId);

    if (!session) {
      // Create new session
      session = this.createSession(event);
      this.sessionStore.set(event.sessionId, session);
    } else {
      // Update existing session
      session.events.push(event);
      
      if (!session.pagesVisited.includes(event.page)) {
        session.pagesVisited.push(event.page);
      }

      // Count interactions (non-page_view events)
      if (event.eventType !== 'page_view') {
        session.interactionCount++;
      } else {
        session.pageViewCount++;
      }

      // Check for conversion events
      if (this.isConversionEvent(event.eventType)) {
        session.converted = true;
        session.conversionType = this.getConversionType(event.eventType);
      }

      // Update end time
      session.endTime = event.timestamp;
      session.durationSeconds = Math.floor(
        (event.timestamp.getTime() - session.startTime.getTime()) / 1000
      );

      // Update bounce status
      session.isBounce = session.pageViewCount <= 1 && session.interactionCount === 0;

      // Update exit page
      session.exitPage = event.page;
    }
  }

  /**
   * Create a new session from the first event
   * @param event - First event of the session
   * @returns New session data
   */
  private createSession(event: BehaviorEvent): SessionData {
    return {
      sessionId: event.sessionId,
      userId: event.userId,
      startTime: event.timestamp,
      endTime: event.timestamp,
      durationSeconds: 0,
      events: [event],
      pagesVisited: [event.page],
      entryPage: event.page,
      exitPage: event.page,
      pageViewCount: event.eventType === 'page_view' ? 1 : 0,
      interactionCount: event.eventType !== 'page_view' ? 1 : 0,
      converted: this.isConversionEvent(event.eventType),
      conversionType: this.isConversionEvent(event.eventType)
        ? this.getConversionType(event.eventType)
        : undefined,
      deviceInfo: event.deviceInfo,
      isBounce: true,
    };
  }

  /**
   * Check if event type represents a conversion
   * @param eventType - Event type to check
   */
  private isConversionEvent(eventType: EventType): boolean {
    const conversionEvents: EventType[] = [
      'payment_complete', 'signup', 'payment_init', 'feedback_submit',
    ];
    return conversionEvents.includes(eventType);
  }

  /**
   * Map event type to conversion type
   * @param eventType - Conversion event type
   */
  private getConversionType(eventType: EventType): ConversionType {
    const mapping: Partial<Record<EventType, ConversionType>> = {
      payment_complete: 'payment_completed',
      signup: 'account_created',
      payment_init: 'payment_completed',
      feedback_submit: 'feature_adopted',
    };
    return mapping[eventType] || 'feature_adopted';
  }

  /**
   * Get comprehensive user behavior profile
   * @param userId - User identifier
   * @returns Complete user behavior profile
   * @throws AppError if user not found or insufficient data
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    this.ensureInitialized();

    // Check cache first
    const cached = this.profileCache.get(userId);
    if (cached && this.isCacheValid(cached.cachedAt)) {
      return cached.profile;
    }

    const events = this.eventStore.get(userId);
    
    if (!events || events.length < this.config.minEventsForProfile) {
      throw new AppError(
        `Insufficient data for user profile. Required: ${this.config.minEventsForProfile} events`,
        ErrorCode.VALIDATION_ERROR,
        { context: { userId, eventCount: events?.length || 0 } }
      );
    }

    try {
      const profile = this.buildUserProfile(userId, events);
      
      // Cache the profile
      this.profileCache.set(userId, { profile, cachedAt: new Date() });

      logger.debug('User profile generated', {
        event: 'behavioral_analytics.profile_generated',
        metadata: { userId, segment: profile.segment, engagementLevel: profile.engagementLevel },
      });

      return profile;
    } catch (error) {
      const appError = error instanceof AppError ? error : new AppError(
        'Failed to generate user profile',
        ErrorCode.UNKNOWN_ERROR,
        { cause: error instanceof Error ? error : undefined }
      );
      logger.error('Profile generation failed', {
        event: 'behavioral_analytics.profile_error',
        error: appError,
        metadata: { userId },
      });
      throw appError;
    }
  }

  /**
   * Check if cached profile is still valid
   * @param cachedAt - Timestamp when profile was cached
   */
  private isCacheValid(cachedAt: Date): boolean {
    const elapsedMinutes = (Date.now() - cachedAt.getTime()) / (1000 * 60);
    return elapsedMinutes < this.config.cacheTTLMinutes;
  }

  /**
   * Build comprehensive user profile from events
   * @param userId - User identifier
   * @param events - All user events
   * @returns Complete user profile
   */
  private buildUserProfile(userId: string, events: BehaviorEvent[]): UserProfile {
    const sortedEvents = [...events].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Calculate basic metrics
    const totalEvents = sortedEvents.length;
    const userSessions = this.aggregateUserSessions(userId);
    const totalSessions = userSessions.length;
    
    // Calculate average session duration (excluding bounces and very short sessions)
    const validSessions = userSessions.filter(
      s => s.durationSeconds >= this.config.minSessionDuration
    );
    const avgSessionDuration = validSessions.length > 0
      ? validSessions.reduce((sum, s) => sum + s.durationSeconds, 0) / validSessions.length
      : 0;

    // Calculate page frequencies
    const topPages = this.calculatePageFrequencies(sortedEvents);

    // Calculate device preferences
    const devicePreferences = this.calculateDevicePreferences(userSessions);

    // Calculate temporal activity patterns
    const hourlyActivity = this.calculateHourlyActivity(sortedEvents);
    const weeklyActivity = this.calculateWeeklyActivity(sortedEvents);

    // Calculate behavioral scores
    const behaviorScores = this.calculateBehaviorScores(sortedEvents, userSessions);

    // Determine user segment
    const segment = this.determineUserSegment(sortedEvents, userSessions, behaviorScores);

    // Determine engagement level
    const engagementLevel = this.determineEngagementLevel(behaviorScores.engagementScore);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(sortedEvents, behaviorScores);

    // Calculate churn probability
    const churnProbability = this.calculateChurnProbability(
      sortedEvents, behaviorScores, userSessions
    );

    // Calculate predicted LTV
    const predictedLTV = this.predictLifetimeValue(userSessions, behaviorScores);

    // Analyze feature adoption
    const featureAdoption = this.analyzeFeatureAdoption(sortedEvents);

    // Identify navigation patterns
    const navigationPatterns = this.identifyNavigationPatterns(userSessions);

    // Extract conversion history
    const conversionHistory = this.extractConversionHistory(userSessions);

    return {
      userId,
      createdAt: sortedEvents[0].timestamp,
      lastActiveAt: sortedEvents[sortedEvents.length - 1].timestamp,
      totalSessions,
      totalEvents,
      avgSessionDuration,
      topPages,
      devicePreferences,
      hourlyActivity,
      weeklyActivity,
      behaviorScores,
      segment,
      engagementLevel,
      riskScore,
      churnProbability,
      predictedLTV,
      featureAdoption,
      navigationPatterns,
      conversionHistory,
    };
  }

  /**
   * Aggregate all sessions for a user
   * @param userId - User identifier
   * @returns Array of user sessions
   */
  private aggregateUserSessions(userId: string): SessionData[] {
    const sessions: SessionData[] = [];
    
    Array.from(this.sessionStore.values()).forEach((session) => {
      if (session.userId === userId) {
        sessions.push(session);
      }
    });
    
    return sessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  /**
   * Calculate page visit frequencies
   * @param events - Sorted array of events
   * @returns Top pages by frequency
   */
  private calculatePageFrequencies(events: BehaviorEvent[]): PageFrequency[] {
    const pageCounts = new Map<string, number>();
    
    for (const event of events) {
      if (event.eventType === 'page_view') {
        pageCounts.set(event.page, (pageCounts.get(event.page) || 0) + 1);
      }
    }

    const totalPages = Array.from(pageCounts.values()).reduce((a, b) => a + b, 0);
    
    return Array.from(pageCounts.entries())
      .map(([page, count]) => ({
        page,
        count,
        percentage: (count / totalPages) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 pages
  }

  /**
   * Calculate device preferences from sessions
   * @param sessions - User sessions
   * @returns Device preference breakdown
   */
  private calculateDevicePreferences(sessions: SessionData[]): DevicePreference[] {
    const deviceCounts = new Map<DeviceInfo['deviceType'], number>();
    
    for (const session of sessions) {
      const deviceType = session.deviceInfo.deviceType;
      deviceCounts.set(deviceType, (deviceCounts.get(deviceType) || 0) + 1);
    }

    const totalSessions = sessions.length;
    
    return Array.from(deviceCounts.entries())
      .map(([deviceType, count]) => ({
        deviceType,
        count,
        percentage: (count / totalSessions) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate activity distribution by hour of day
   * @param events - Sorted array of events
   * @returns Array of 24 values representing activity per hour
   */
  private calculateHourlyActivity(events: BehaviorEvent[]): number[] {
    const hours = new Array(24).fill(0);
    
    for (const event of events) {
      const hour = event.timestamp.getHours();
      hours[hour]++;
    }

    const maxActivity = Math.max(...hours);
    return maxActivity > 0 ? hours.map(h => (h / maxActivity) * 100) : hours;
  }

  /**
   * Calculate activity distribution by day of week
   * @param events - Sorted array of events
   * @returns Array of 7 values representing activity per day
   */
  private calculateWeeklyActivity(events: BehaviorEvent[]): number[] {
    const days = new Array(7).fill(0);
    
    for (const event of events) {
      const day = event.timestamp.getDay();
      days[day]++;
    }

    const maxActivity = Math.max(...days);
    return maxActivity > 0 ? days.map(d => (d / maxActivity) * 100) : days;
  }

  /**
   * Calculate composite behavioral scores
   * @param events - Sorted array of events
   * @param sessions - User sessions
   * @returns Object containing all behavioral scores
   */
  private calculateBehaviorScores(
    events: BehaviorEvent[],
    sessions: SessionData[]
  ): BehaviorScores {
    const weights = this.config.engagementWeights;

    // Engagement Score Calculation
    let engagementScore = 0;
    const eventCounts = new Map<EventType, number>();
    
    for (const event of events) {
      eventCounts.set(event.eventType, (eventCounts.get(event.eventType) || 0) + 1);
    }

    engagementScore += (eventCounts.get('page_view') || 0) * weights.pageViewWeight;
    engagementScore += (eventCounts.get('click') || 0) * weights.clickWeight;
    engagementScore += ((eventCounts.get('form_submit') || 0) + (eventCounts.get('form_start') || 0)) * weights.formWeight;
    engagementScore += ((eventCounts.get('payment_init') || 0) + (eventCounts.get('payment_complete') || 0)) * weights.paymentWeight;
    engagementScore += (eventCounts.get('navigation') || 0) * weights.navigationWeight;
    engagementScore += (eventCounts.get('search') || 0) * weights.searchWeight;
    engagementScore += (eventCounts.get('item_select') || 0) * weights.featureAdoptionWeight;

    // Normalize to 0-100 scale (assuming ~50 weighted events as baseline for 100)
    engagementScore = Math.min(100, Math.round((engagementScore / 50) * 100));

    // Consistency Score - measures regularity of usage patterns
    const consistencyScore = this.calculateConsistencyScore(sessions);

    // Conversion Propensity - based on past conversion behavior
    const conversionPropensity = this.calculateConversionPropensity(sessions);

    // Exploration Score - variety of features/pages explored
    const uniquePages = new Set(events.filter(e => e.eventType === 'page_view').map(e => e.page)).size;
    const explorationScore = Math.min(100, Math.round((uniquePages / 15) * 100)); // 15+ pages = full score

    // Loyalty Score - based on retention and frequency
    const loyaltyScore = this.calculateLoyaltyScore(events, sessions);

    // Trust Score - based on behavior consistency and risk indicators
    const trustScore = this.calculateTrustScore(events, consistencyScore);

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
   * Calculate consistency score based on session regularity
   * @param sessions - User sessions
   * @returns Consistency score 0-100
   */
  private calculateConsistencyScore(sessions: SessionData[]): number {
    if (sessions.length < 2) {
      return sessions.length === 1 ? 50 : 0;
    }

    // Calculate variance in session durations
    const durations = sessions.map(s => s.durationSeconds).filter(d => d > 0);
    if (durations.length < 2) return 50;

    const meanDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - meanDuration, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = higher consistency (inverse relationship)
    // Normalize assuming stdDev of 300+ seconds is low consistency
    const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - (stdDev / 3))));
    
    return consistencyScore;
  }

  /**
   * Calculate conversion propensity based on historical data
   * @param sessions - User sessions
   * @returns Conversion propensity score 0-100
   */
  private calculateConversionPropensity(sessions: SessionData[]): number {
    if (sessions.length === 0) return 0;

    const convertedSessions = sessions.filter(s => s.converted).length;
    const baseRate = (convertedSessions / sessions.length) * 100;

    // Factor in recent conversion velocity
    const recentSessions = sessions.slice(-10); // Last 10 sessions
    const recentConversionRate = recentSessions.length > 0
      ? (recentSessions.filter(s => s.converted).length / recentSessions.length) * 100
      : 0;

    // Weight recent conversions more heavily
    const weightedScore = Math.round(baseRate * 0.4 + recentConversionRate * 0.6);
    
    return Math.min(100, weightedScore);
  }

  /**
   * Calculate loyalty score based on usage patterns
   * @param events - User events
   * @param sessions - User sessions
   * @returns Loyalty score 0-100
   */
  private calculateLoyaltyScore(events: BehaviorEvent[], sessions: SessionData[]): number {
    if (events.length === 0) return 0;

    const firstEvent = events[0].timestamp;
    const lastEvent = events[events.length - 1].timestamp;
    const daysActive = (lastEvent.getTime() - firstEvent.getTime()) / (1000 * 60 * 60 * 24);

    if (daysActive < 1) return 30; // New user baseline

    // Frequency component
    const frequencyScore = Math.min(100, (sessions.length / daysActive) * 20); // 5+ sessions/day = 100

    // Recency component (more recent activity = higher loyalty indicator)
    const daysSinceLastActivity = (Date.now() - lastEvent.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, Math.min(100, 100 - (daysSinceLastActivity * 3))); // Lose 3 pts/day

    // Duration component (longer tenure = higher loyalty)
    const tenureScore = Math.min(100, daysActive * 2); // 50+ days = 100

    return Math.round(frequencyScore * 0.35 + recencyScore * 0.35 + tenureScore * 0.3);
  }

  /**
   * Calculate trust score based on behavior patterns
   * @param events - User events
   * @param consistencyScore - Pre-calculated consistency score
   * @returns Trust score 0-100
   */
  private calculateTrustScore(events: BehaviorEvent[], consistencyScore: number): number {
    let trustScore = 50; // Start at neutral

    // Consistency contributes positively
    trustScore += (consistencyScore - 50) * 0.3;

    // Check for suspicious patterns
    const rapidActions = this.detectRapidActionPattern(events);
    if (rapidActions.detected) {
      trustScore -= 20;
    }

    // Check for unusual timing patterns
    const unusualTiming = this.detectUnusualTiming(events);
    if (unusualTiming) {
      trustScore -= 10;
    }

    // Positive signals
    const hasVerificationEvents = events.some(e => 
      e.eventType === 'payment_complete' || e.eventType === 'kyc_submitted' as EventType
    );
    if (hasVerificationEvents) {
      trustScore += 15;
    }

    // Regular login pattern
    const loginEvents = events.filter(e => e.eventType === 'login');
    if (loginEvents.length >= 3) {
      trustScore += 10;
    }

    return Math.max(0, Math.min(100, Math.round(trustScore)));
  }

  /**
   * Detect rapid/suspicious action patterns
   * @param events - Events to analyze
   * @returns Detection result
   */
  private detectRapidActionPattern(events: BehaviorEvent[]): { detected: boolean; details?: string } {
    if (events.length < 5) return { detected: false };

    // Check for multiple rapid-fire actions (< 1 second apart)
    let rapidCount = 0;
    for (let i = 1; i < events.length; i++) {
      const timeDiff = events[i].timestamp.getTime() - events[i - 1].timestamp.getTime();
      if (timeDiff < 1000) { // Less than 1 second
        rapidCount++;
      }
    }

    if (rapidCount > events.length * 0.3) { // More than 30% rapid actions
      return { detected: true, details: `${rapidCount} rapid actions detected` };
    }

    return { detected: false };
  }

  /**
   * Detect unusual timing patterns (e.g., activity at odd hours consistently)
   * @param events - Events to analyze
   * @returns True if unusual pattern detected
   */
  private detectUnusualTiming(events: BehaviorEvent[]): boolean {
    if (events.length < 10) return false;

    const lateNightEvents = events.filter(e => {
      const hour = e.timestamp.getHours();
      return hour >= 1 && hour <= 4; // 1 AM - 4 AM
    });

    // If more than 40% of activity is between 1-4 AM, flag as unusual
    return lateNightEvents.length > events.length * 0.4;
  }

  /**
   * Determine user segment based on behavior patterns
   * @param events - User events
   * @param sessions - User sessions
   * @param scores - Behavioral scores
   * @returns Assigned user segment
   */
  private determineUserSegment(
    events: BehaviorEvent[],
    sessions: SessionData[],
    scores: BehaviorScores
  ): UserSegment {
    const thresholds = this.config.segmentationThresholds;
    const lastEvent = events[events.length - 1];
    const daysSinceLastActivity = (Date.now() - lastEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24);

    // Check for churned user first
    if (daysSinceLastActivity > thresholds.churnedDaysInactive) {
      return 'churned_user';
    }

    // Check for at-risk user
    if (daysSinceLastActivity > thresholds.atRiskDaysInactive) {
      return 'at_risk_user';
    }

    // Check for power user
    if (sessions.length >= thresholds.powerUserThreshold && scores.engagementScore >= thresholds.highEngagementScore) {
      return 'power_user';
    }

    // Check for premium/business user (based on transaction volume)
    const paymentEvents = events.filter(e => 
      e.eventType === 'payment_complete' || e.eventType === 'payment_init'
    );
    if (paymentEvents.length >= thresholds.businessUserMinTransactions) {
      return 'business_user';
    }

    // Check for premium user (high value, high engagement)
    if (scores.loyaltyScore >= 80 && scores.trustScore >= 80) {
      return 'premium_user';
    }

    // Active user check
    if (scores.engagementScore >= 50 && sessions.length >= 5) {
      return 'active_user';
    }

    // New user (less than 7 days since first event)
    const firstEvent = events[0];
    const daysSinceFirstEvent = (Date.now() - firstEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceFirstEvent <= 7) {
      return 'new_user';
    }

    // Default to casual user
    return 'casual_user';
  }

  /**
   * Determine engagement level from engagement score
   * @param engagementScore - Calculated engagement score
   * @returns Engagement level classification
   */
  private determineEngagementLevel(engagementScore: number): EngagementLevel {
    if (engagementScore >= 85) return 'very_high';
    if (engagementScore >= 65) return 'high';
    if (engagementScore >= 35) return 'medium';
    return 'low';
  }

  /**
   * Calculate risk score for fraud/security purposes
   * @param events - User events
   * @param scores - Behavioral scores
   * @returns Risk score 0-100 (higher = more risky)
   */
  private calculateRiskScore(events: BehaviorEvent[], scores: BehaviorScores): number {
    let riskScore = 0;

    // Low trust increases risk
    riskScore += (100 - scores.trustScore) * 0.4;

    // Inconsistent behavior increases risk
    riskScore += (100 - scores.consistencyScore) * 0.2;

    // Rapid action detection
    const rapidActions = this.detectRapidActionPattern(events);
    if (rapidActions.detected) {
      riskScore += 25;
    }

    // Multiple failed payments
    const failedPayments = events.filter(e => e.eventType === 'payment_failed').length;
    riskScore += Math.min(20, failedPayments * 5);

    // Device diversity (using many devices can be risky)
    const devices = new Set(events.map(e => e.deviceInfo.deviceId));
    if (devices.size > 5) {
      riskScore += 15;
    }

    // Geographic anomalies (if geo data available)
    const geoAnomaly = this.detectGeoAnomalies(events);
    if (geoAnomaly) {
      riskScore += 20;
    }

    return Math.min(100, Math.round(riskScore));
  }

  /**
   * Detect geographic anomalies in user behavior
   * @param events - Events with potential geo data
   * @returns True if anomaly detected
   */
  private detectGeoAnomalies(events: BehaviorEvent[]): boolean {
    const eventsWithGeo = events.filter(e => e.geoLocation);
    if (eventsWithGeo.length < 2) return false;

    const countries = new Set(eventsWithGeo.map(e => e.geoLocation?.countryCode));
    
    // Multiple countries in short time frame is suspicious
    if (countries.size > 2) {
      // Check if they appeared in different countries within 24 hours
      for (let i = 1; i < eventsWithGeo.length; i++) {
        const prev = eventsWithGeo[i - 1];
        const curr = eventsWithGeo[i];
        const timeDiff = curr.timestamp.getTime() - prev.timestamp.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        if (hoursDiff < 24 && prev.geoLocation?.countryCode !== curr.geoLocation?.countryCode) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate churn probability using behavioral indicators
   * @param events - User events
   * @param scores - Behavioral scores
   * @param sessions - User sessions
   * @returns Churn probability 0-1
   */
  private calculateChurnProbability(
    events: BehaviorEvent[],
    scores: BehaviorScores,
    sessions: SessionData[]
  ): number {
    let churnProbability = 0;

    // Recency factor (most important)
    const lastEvent = events[events.length - 1];
    const daysSinceLastActivity = (Date.now() - lastEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastActivity > 30) {
      churnProbability += 0.5;
    } else if (daysSinceLastActivity > 14) {
      churnProbability += 0.3;
    } else if (daysSinceLastActivity > 7) {
      churnProbability += 0.15;
    }

    // Engagement decline factor
    if (scores.engagementScore < 30) {
      churnProbability += 0.2;
    } else if (scores.engagementScore < 50) {
      churnProbability += 0.1;
    }

    // Session frequency decline
    if (sessions.length >= 3) {
      const recentSessions = sessions.slice(-3);
      const olderSessions = sessions.slice(0, 3);
      const recentAvgDuration = recentSessions.reduce((s, sess) => s + sess.durationSeconds, 0) / 3;
      const olderAvgDuration = olderSessions.reduce((s, sess) => s + sess.durationSeconds, 0) / 3;
      
      if (olderAvgDuration > 0 && recentAvgDuration < olderAvgDuration * 0.5) {
        churnProbability += 0.15;
      }
    }

    // Loyalty factor (inverse)
    churnProbability += (100 - scores.loyaltyScore) * 0.002;

    return Math.min(1, Math.round(churnProbability * 100) / 100);
  }

  /**
   * Predict customer lifetime value
   * @param sessions - User sessions
   * @param scores - Behavioral scores
   * @returns Predicted LTV in base currency units
   */
  private predictLifetimeValue(sessions: SessionData[], scores: BehaviorScores): number {
    // Base LTV calculation using simplified model
    const avgTransactionValue = 150; // Base assumption
    
    // Adjust based on engagement and loyalty
    const engagementMultiplier = 0.5 + (scores.engagementScore / 100);
    const loyaltyMultiplier = 0.5 + (scores.loyaltyScore / 100);
    
    // Estimate transactions per month based on session frequency
    const monthlySessions = sessions.length / Math.max(1, this.getMonthsFromFirstSession(sessions));
    const estimatedMonthlyTxns = Math.min(monthlySessions * 0.3, 10); // Cap at 10/month
    
    // Project over 12 months
    const projectedMonths = 12 * loyaltyMultiplier;
    
    return Math.round(avgTransactionValue * estimatedMonthlyTxns * engagementMultiplier * projectedMonths);
  }

  /**
   * Get months elapsed since first session
   * @param sessions - User sessions
   * @returns Number of months (minimum 1)
   */
  private getMonthsFromFirstSession(sessions: SessionData[]): number {
    if (sessions.length === 0) return 1;
    
    const firstSession = sessions[0];
    const months = (Date.now() - firstSession.startTime.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return Math.max(1, months);
  }

  /**
   * Analyze feature adoption across the platform
   * @param events - User events
   * @returns Map of feature adoption statuses
   */
  private analyzeFeatureAdoption(events: BehaviorEvent[]): Record<string, AdoptionStatus> {
    const features: Record<string, AdoptionStatus> = {
      payments: 'not_adopted',
      zainbox: 'not_adopted',
      dashboard: 'not_adopted',
      search: 'not_adopted',
      filters: 'not_adopted',
      sharing: 'not_adopted',
      feedback: 'not_adopted',
    };

    // Check payment feature adoption
    const paymentEvents = events.filter(e => 
      e.eventType === 'payment_init' || e.eventType === 'payment_complete'
    );
    if (paymentEvents.length > 0) {
      features.payments = paymentEvents.length >= 5 ? 'power_user' :
                          paymentEvents.length >= 3 ? 'adopted' :
                          paymentEvents.length >= 1 ? 'trialing' : 'not_adopted';
    }

    // Check zainbox feature
    const zainboxEvents = events.filter(e => 
      e.page.includes('zainbox') || e.metadata.zainbox_action
    );
    if (zainboxEvents.length > 0) {
      features.zainbox = zainboxEvents.length >= 10 ? 'power_user' :
                         zainboxEvents.length >= 5 ? 'adopted' :
                         zainboxEvents.length >= 1 ? 'trialing' : 'not_adopted';
    }

    // Check dashboard usage
    const dashboardViews = events.filter(e => e.page.includes('dashboard')).length;
    if (dashboardViews > 0) {
      features.dashboard = dashboardViews >= 20 ? 'power_user' :
                           dashboardViews >= 10 ? 'adopted' :
                           dashboardViews >= 3 ? 'trialing' : 'aware';
    }

    // Check search usage
    const searchEvents = events.filter(e => e.eventType === 'search').length;
    if (searchEvents > 0) {
      features.search = searchEvents >= 10 ? 'power_user' :
                        searchEvents >= 5 ? 'adopted' :
                        searchEvents >= 1 ? 'trialing' : 'not_adopted';
    }

    // Check filter usage
    const filterEvents = events.filter(e => e.eventType === 'filter_apply').length;
    if (filterEvents > 0) {
      features.filters = filterEvents >= 10 ? 'power_user' :
                         filterEvents >= 5 ? 'adopted' :
                         filterEvents >= 1 ? 'trialing' : 'not_adopted';
    }

    // Check sharing
    const shareEvents = events.filter(e => e.eventType === 'share').length;
    if (shareEvents > 0) {
      features.sharing = shareEvents >= 5 ? 'power_user' :
                         shareEvents >= 2 ? 'adopted' :
                         shareEvents >= 1 ? 'trialing' : 'not_adopted';
    }

    // Check feedback
    const feedbackEvents = events.filter(e => e.eventType === 'feedback_submit').length;
    if (feedbackEvents > 0) {
      features.feedback = feedbackEvents >= 3 ? 'power_user' :
                          feedbackEvents >= 1 ? 'adopted' : 'not_adopted';
    }

    return features;
  }

  /**
   * Identify common navigation patterns from sessions
   * @param sessions - User sessions
   * @returns Array of identified navigation patterns
   */
  private identifyNavigationPatterns(sessions: SessionData[]): NavigationPattern[] {
    const patternMap = new Map<string, {
      sequences: string[][];
      durations: number[];
      conversions: number;
      totalCount: number;
    }>();

    for (const session of sessions) {
      if (session.pagesVisited.length < 2) continue;

      // Extract page sequence (limit to 5 pages for pattern matching)
      const sequence = session.pagesVisited.slice(0, 5);
      const patternKey = sequence.join(' -> ');

      const existing = patternMap.get(patternKey) || {
        sequences: [],
        durations: [],
        conversions: 0,
        totalCount: 0,
      };

      existing.sequences.push(sequence);
      existing.durations.push(session.durationSeconds);
      if (session.converted) existing.conversions++;
      existing.totalCount++;

      patternMap.set(patternKey, existing);
    }

    // Convert to NavigationPattern array
    const patterns: NavigationPattern[] = [];

    let index = 0;
    for (const [key, data] of Array.from(patternMap.entries())) {
      if (data.totalCount < 2) continue; // Require at least 2 occurrences

      const avgDuration = data.durations.reduce((a, b) => a + b, 0) / data.durations.length;
      const conversionRate = data.conversions / data.totalCount;
      
      // Generate pattern name from key
      const name = this.generatePatternName(key);

      patterns.push({
        id: `pattern_${index++}`,
        name,
        pageSequence: data.sequences[0],
        frequency: data.totalCount,
        avgDuration: Math.round(avgDuration),
        conversionRate: Math.round(conversionRate * 100) / 100,
        confidence: Math.min(1, data.totalCount / 10), // More occurrences = higher confidence
      });
    }

    // Sort by frequency and return top patterns
    return patterns.sort((a, b) => b.frequency - a.frequency).slice(0, 10);
  }

  /**
   * Generate human-readable pattern name
   * @param patternKey - Pattern key string
   * @returns Human-readable name
   */
  private generatePatternName(patternKey: string): string {
    const pages = patternKey.split(' -> ');
    
    // Common pattern mappings
    const patternNames: Record<string, string> = {
      '/dashboard': 'Dashboard',
      '/dashboard/payment': 'Payment',
      '/dashboard/zainbox': 'ZainBox',
      '/dashboard/zainbox/list': 'ZainBox List',
      '/dashboard/zainbox/create': 'ZainBox Create',
      '/login': 'Login',
      '/signup': 'Signup',
      '/callback': 'Callback',
    };

    const mappedPages = pages.map(p => patternNames[p] || p.replace('/', ''));
    
    if (mappedPages.length <= 3) {
      return mappedPages.join(' → ');
    }
    
    return `${mappedPages[0]} → ${mappedPages[1]} → ... → ${mappedPages[mappedPages.length - 1]}`;
  }

  /**
   * Extract conversion history from sessions
   * @param sessions - User sessions
   * @returns Array of conversion records
   */
  private extractConversionHistory(sessions: SessionData[]): ConversionRecord[] {
    const conversions: ConversionRecord[] = [];

    for (const session of sessions) {
      if (!session.converted || !session.conversionType) continue;

      const conversionEvent = session.events.find(e => 
        this.isConversionEvent(e.eventType)
      );

      if (conversionEvent) {
        conversions.push({
          type: session.conversionType!,
          timestamp: conversionEvent.timestamp,
          sessionId: session.sessionId,
          timeToConvert: Math.floor(
            (conversionEvent.timestamp.getTime() - session.startTime.getTime()) / 1000
          ),
          funnelStepsCompleted: session.pagesVisited,
        });
      }
    }

    return conversions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get session data by session ID
   * @param sessionId - Session identifier
   * @returns Session data or null if not found
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    this.ensureInitialized();
    return this.sessionStore.get(sessionId) || null;
  }

  /**
   * Get all sessions for a user
   * @param userId - User identifier
   * @returns Array of session data
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    this.ensureInitialized();
    return this.aggregateUserSessions(userId);
  }

  /**
   * Analyze a conversion funnel
   * @param funnel - Funnel definition to analyze
   * @param options - Analysis options
   * @returns Funnel analysis results
   */
  async analyzeFunnel(
    funnel: ConversionFunnel,
    options?: { startDate?: Date; endDate?: Date; userId?: string }
  ): Promise<FunnelAnalysis> {
    this.ensureInitialized();

    const startDate = options?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = options?.endDate || new Date();

    // Collect all sessions in date range
    let relevantSessions: SessionData[] = [];
    
    Array.from(this.sessionStore.values()).forEach((session) => {
      if (session.startTime >= startDate && session.startTime <= endDate) {
        if (!options?.userId || session.userId === options.userId) {
          relevantSessions.push(session);
        }
      }
    });

    // Initialize step counts
    const stepCounts = new Array(funnel.steps.length).fill(0);
    const totalTimePerStep = new Array(funnel.steps.length).fill(0);
    const usersAtEachStep = new Map<number, Set<string>>();

    // Process each session through the funnel
    for (const session of relevantSessions) {
      let maxStepReached = -1;
      const stepTimes: number[] = [];

      for (let stepIndex = 0; stepIndex < funnel.steps.length; stepIndex++) {
        const step = funnel.steps[stepIndex];
        
        // Find matching event in session
        const matchingEvent = session.events.find(e => 
          e.eventType === step.expectedEventType &&
          (e.page === step.pageOrAction || e.element === step.pageOrAction)
        );

        if (matchingEvent) {
          maxStepReached = stepIndex;
          stepTimes[stepIndex] = matchingEvent.timestamp.getTime();
          
          if (!usersAtEachStep.has(stepIndex)) {
            usersAtEachStep.set(stepIndex, new Set());
          }
          usersAtEachStep.get(stepIndex)!.add(session.userId);
        } else {
          break; // User didn't complete this step
        }
      }

      // Update counts for reached steps
      for (let i = 0; i <= maxStepReached; i++) {
        stepCounts[i]++;
      }

      // Calculate time spent at each step
      for (let i = 0; i < stepTimes.length - 1; i++) {
        if (stepTimes[i] && stepTimes[i + 1]) {
          totalTimePerStep[i] += (stepTimes[i + 1] - stepTimes[i]) / 1000;
        }
      }
    }

    // Calculate conversion rates between steps
    const stepConversionRates: number[] = [];
    for (let i = 0; i < stepCounts.length; i++) {
      if (i === 0) {
        stepConversionRates.push(100); // Entry step is 100%
      } else if (stepCounts[i - 1] > 0) {
        stepConversionRates.push(Math.round((stepCounts[i] / stepCounts[i - 1]) * 10000) / 100);
      } else {
        stepConversionRates.push(0);
      }
    }

    // Calculate overall conversion rate
    const overallConversionRate = stepCounts[0] > 0
      ? Math.round((stepCounts[stepCounts.length - 1] / stepCounts[0]) * 10000) / 100
      : 0;

    // Calculate average time per step
    const avgTimePerStep = stepCounts.map((count, i) =>
      count > 0 ? Math.round(totalTimePerStep[i] / count) : 0
    );

    // Identify drop-off points
    const dropOffPoints: DropOffPoint[] = [];
    for (let i = 1; i < stepCounts.length; i++) {
      const dropped = stepCounts[i - 1] - stepCounts[i];
      if (dropped > 0) {
        const dropOffRate = Math.round((dropped / stepCounts[i - 1]) * 10000) / 100;
        dropOffPoints.push({
          stepIndex: i,
          stepName: funnel.steps[i].name,
          droppedUsers: dropped,
          dropOffRate,
          reasons: this.inferDropOffReasons(funnel.steps[i], dropOffRate),
        });
      }
    }

    const analysis: FunnelAnalysis = {
      totalEntries: stepCounts[0] || 0,
      stepCounts,
      stepConversionRates,
      overallConversionRate,
      dropOffPoints,
      avgTimePerStep,
      periodStart: startDate,
      periodEnd: endDate,
    };

    logger.info('Funnel analysis completed', {
      event: 'behavioral_analytics.funnel_analyzed',
      metadata: {
        funnelId: funnel.id,
        funnelName: funnel.name,
        overallConversionRate,
        totalEntries: analysis.totalEntries,
      },
    });

    return analysis;
  }

  /**
   * Infer possible reasons for drop-off at a funnel step
   * @param step - The funnel step where drop-off occurred
   * @param dropOffRate - The drop-off rate percentage
   * @returns Array of inferred reasons
   */
  private inferDropOffReasons(step: FunnelStep, dropOffRate: number): string[] {
    const reasons: string[] = [];

    if (dropOffRate > 50) {
      reasons.push('High friction at this step');
    }

    if (step.expectedEventType === 'form_submit' || step.expectedEventType === 'payment_init') {
      reasons.push('Complex form or payment process');
      reasons.push('Possible technical issues');
    }

    if (step.expectedEventType === 'signup') {
      reasons.push('Account creation barrier');
      reasons.push('Privacy concerns');
    }

    if (dropOffRate > 30 && dropOffRate <= 50) {
      reasons.push('Moderate friction or distraction');
    }

    return reasons;
  }

  /**
   * Generate behavior-based recommendations
   * @param options - Options for recommendation generation
   * @returns Array of recommendations
   */
  async generateRecommendations(
    options?: { userId?: string; segment?: UserSegment; categories?: RecommendationCategory[] }
  ): Promise<BehaviorRecommendation[]> {
    this.ensureInitialized();

    const recommendations: BehaviorRecommendation[] = [];
    const categories = options?.categories || [
      'engagement', 'retention', 'conversion', 'upsell', 'onboarding', 'win_back'
    ];

    // Generate user-specific recommendations
    if (options?.userId) {
      try {
        const profile = await this.getUserProfile(options.userId);
        const userRecs = this.generateUserSpecificRecommendations(profile, categories);
        recommendations.push(...userRecs);
      } catch {
        // User may not have enough data
        logger.warn('Cannot generate recommendations for user - insufficient data', {
          event: 'behavioral_analytics.recommendation_skip',
          metadata: { userId: options.userId },
        });
      }
    }

    // Generate segment-based recommendations
    if (options?.segment) {
      const segmentRecs = this.generateSegmentRecommendations(options.segment, categories);
      recommendations.push(...segmentRecs);
    }

    // If no specific target, generate general recommendations
    if (!options?.userId && !options?.segment) {
      const generalRecs = this.generateGeneralRecommendations(categories);
      recommendations.push(...generalRecs);
    }

    logger.info(`Generated ${recommendations.length} recommendations`, {
      event: 'behavioral_analytics.recommendations_generated',
      metadata: {
        userId: options?.userId,
        segment: options?.segment,
        recommendationCount: recommendations.length,
      },
    });

    return recommendations;
  }

  /**
   * Generate recommendations specific to a user
   * @param profile - User behavior profile
   * @param categories - Categories to generate recommendations for
   * @returns Array of user-specific recommendations
   */
  private generateUserSpecificRecommendations(
    profile: UserProfile,
    categories: RecommendationCategory[]
  ): BehaviorRecommendation[] {
    const recs: BehaviorRecommendation[] = [];
    let recIndex = 0;

    // Churn prevention for at-risk users
    if (categories.includes('retention') && profile.churnProbability > 0.5) {
      recs.push({
        id: `rec_user_${profile.userId}_${recIndex++}`,
        targetUserId: profile.userId,
        category: 'retention',
        priority: profile.churnProbability > 0.7 ? 'critical' : 'high',
        title: 'Re-engagement campaign needed',
        description: `User shows ${Math.round(profile.churnProbability * 100)}% churn probability based on declining engagement patterns.`,
        actions: [
          {
            id: `action_${recIndex}`,
            description: 'Send personalized re-engagement email highlighting new features',
            channel: 'email',
            effort: 'low',
            timeframe: 'Immediate',
          },
          {
            id: `action_${recIndex + 1}`,
            description: 'Offer exclusive discount or incentive on next transaction',
            channel: 'in_app',
            effort: 'low',
            timeframe: '1-2 days',
          },
        ],
        expectedImpact: {
          metric: 'churn_rate',
          expectedChange: -15,
          confidenceLow: -25,
          confidenceHigh: -5,
          timeframe: '30 days',
        },
        confidence: profile.churnProbability,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }

    // Feature adoption recommendations
    if (categories.includes('feature_adoption')) {
      const unadoptedFeatures = Object.entries(profile.featureAdoption)
        .filter(([, status]) => status === 'not_adopted' || status === 'aware');

      for (const [feature, status] of unadoptedFeatures.slice(0, 2)) {
        recs.push({
          id: `rec_user_${profile.userId}_${recIndex++}`,
          targetUserId: profile.userId,
          category: 'feature_adoption',
          priority: 'medium',
          title: `Promote ${feature} feature adoption`,
          description: `User has not adopted the ${feature} feature (${status} status). This feature could improve their experience.`,
          actions: [
            {
              id: `action_${recIndex}`,
              description: `Show contextual tooltip or walkthrough for ${feature}`,
              channel: 'in_app',
              effort: 'low',
              timeframe: 'Next session',
            },
          ],
          expectedImpact: {
            metric: 'feature_adoption_rate',
            expectedChange: 20,
            confidenceLow: 10,
            confidenceHigh: 35,
            timeframe: '14 days',
          },
          confidence: 0.7,
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        });
      }
    }

    // Conversion optimization
    if (categories.includes('conversion') && profile.behaviorScores.conversionPropensity < 50) {
      recs.push({
        id: `rec_user_${profile.userId}_${recIndex++}`,
        targetUserId: profile.userId,
        category: 'conversion',
        priority: 'medium',
        title: 'Improve conversion path',
        description: 'User shows interest but doesn\'t complete conversions. Consider simplifying the flow.',
        actions: [
          {
            id: `action_${recIndex}`,
            description: 'Reduce form fields or offer guest checkout option',
            channel: 'in_app',
            effort: 'medium',
            timeframe: '1 week',
          },
          {
            id: `action_${recIndex + 1}`,
            description: 'Send reminder for abandoned flows',
            channel: 'push',
            effort: 'low',
            timeframe: '24 hours',
          },
        ],
        expectedImpact: {
          metric: 'conversion_rate',
          expectedChange: 12,
          confidenceLow: 5,
          confidenceHigh: 20,
          timeframe: '30 days',
        },
        confidence: 0.65,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }

    return recs;
  }

  /**
   * Generate recommendations for a user segment
   * @param segment - Target user segment
   * @param categories - Categories to generate recommendations for
   * @returns Array of segment-level recommendations
   */
  private generateSegmentRecommendations(
    segment: UserSegment,
    categories: RecommendationCategory[]
  ): BehaviorRecommendation[] {
    const recs: BehaviorRecommendation[] = [];
    let recIndex = 0;

    const segmentRecommendations: Partial<Record<UserSegment, BehaviorRecommendation[]>> = {
      new_user: [{
        id: `rec_segment_new_${recIndex++}`,
        targetSegment: 'new_user',
        category: 'onboarding',
        priority: 'high',
        title: 'Optimize new user onboarding',
        description: 'New users need guided introduction to core features to drive activation.',
        actions: [
          {
            id: `action_${recIndex}`,
            description: 'Implement progressive onboarding with milestones',
            channel: 'in_app',
            effort: 'high',
            timeframe: '2-4 weeks',
          },
          {
            id: `action_${recIndex + 1}`,
            description: 'Send welcome series email campaign',
            channel: 'email',
            effort: 'medium',
            timeframe: '1 week',
          },
        ],
        expectedImpact: {
          metric: 'activation_rate',
          expectedChange: 25,
          confidenceLow: 15,
          confidenceHigh: 35,
          timeframe: '30 days',
        },
        confidence: 0.8,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }],
      at_risk_user: [{
        id: `rec_segment_atrisk_${recIndex++}`,
        targetSegment: 'at_risk_user',
        category: 'win_back',
        priority: 'critical',
        title: 'Launch win-back campaign',
        description: 'At-risk users show declining engagement patterns and need immediate intervention.',
        actions: [
          {
            id: `action_${recIndex}`,
            description: 'Send personalized "we miss you" message with incentive',
            channel: 'email',
            effort: 'low',
            timeframe: 'Immediate',
          },
          {
            id: `action_${recIndex + 1}`,
            description: 'Highlight new features or improvements since last visit',
            channel: 'push',
            effort: 'low',
            timeframe: '24-48 hours',
          },
        ],
        expectedImpact: {
          metric: 'reactivation_rate',
          expectedChange: 18,
          confidenceLow: 10,
          confidenceHigh: 28,
          timeframe: '14 days',
        },
        confidence: 0.75,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      }],
      power_user: [{
        id: `rec_segment_power_${recIndex++}`,
        targetSegment: 'power_user',
        category: 'upsell',
        priority: 'medium',
        title: 'Offer premium features to power users',
        description: 'Power users are ideal candidates for premium tier upgrades.',
        actions: [
          {
            id: `action_${recIndex}`,
            description: 'Present exclusive premium features preview',
            channel: 'in_app',
            effort: 'low',
            timeframe: 'Next session',
          },
          {
            id: `action_${recIndex + 1}`,
            description: 'Send VIP program invitation',
            channel: 'email',
            effort: 'low',
            timeframe: '1 week',
          },
        ],
        expectedImpact: {
          metric: 'upgrade_rate',
          expectedChange: 8,
          confidenceLow: 4,
          confidenceHigh: 14,
          timeframe: '60 days',
        },
        confidence: 0.7,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      }],
    };

    const segmentRecs = segmentRecommendations[segment] || [];
    
    for (const rec of segmentRecs) {
      if (categories.includes(rec.category)) {
        recs.push(rec);
      }
    }

    return recs;
  }

  /**
   * Generate general platform-wide recommendations
   * @param categories - Categories to generate recommendations for
   * @returns Array of general recommendations
   */
  private generateGeneralRecommendations(categories: RecommendationCategory[]): BehaviorRecommendation[] {
    const recs: BehaviorRecommendation[] = [];
    let recIndex = 0;

    if (categories.includes('engagement')) {
      recs.push({
        id: `rec_general_${recIndex++}`,
        category: 'engagement',
        priority: 'high',
        title: 'Implement gamification elements',
        description: 'Add progress indicators, achievements, and rewards to increase user engagement.',
        actions: [
          {
            id: `action_${recIndex}`,
            description: 'Design achievement badge system',
            channel: 'in_app',
            effort: 'high',
            timeframe: '4-6 weeks',
          },
          {
            id: `action_${recIndex + 1}`,
            description: 'Create daily/weekly challenges',
            channel: 'in_app',
            effort: 'medium',
            timeframe: '2-3 weeks',
          },
        ],
        expectedImpact: {
          metric: 'daily_active_users',
          expectedChange: 15,
          confidenceLow: 8,
          confidenceHigh: 24,
          timeframe: '60 days',
        },
        confidence: 0.72,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
    }

    if (categories.includes('conversion')) {
      recs.push({
        id: `rec_general_${recIndex++}`,
        category: 'conversion',
        priority: 'high',
        title: 'Optimize mobile conversion flow',
        description: 'Mobile users show lower conversion rates. Focus on mobile UX improvements.',
        actions: [
          {
            id: `action_${recIndex}`,
            description: 'Simplify mobile payment form layout',
            channel: 'in_app',
            effort: 'medium',
            timeframe: '2 weeks',
          },
          {
            id: `action_${recIndex + 1}`,
            description: 'Implement mobile wallet payment options',
            channel: 'in_app',
            effort: 'high',
            timeframe: '4-6 weeks',
          },
        ],
        expectedImpact: {
          metric: 'mobile_conversion_rate',
          expectedChange: 22,
          confidenceLow: 12,
          confidenceHigh: 32,
          timeframe: '45 days',
        },
        confidence: 0.68,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
    }

    if (categories.includes('risk_mitigation')) {
      recs.push({
        id: `rec_general_${recIndex++}`,
        category: 'risk_mitigation',
        priority: 'medium',
        title: 'Enhance anomaly detection',
        description: 'Improve detection of unusual behavior patterns for security.',
        actions: [
          {
            id: `action_${recIndex}`,
            description: 'Implement real-time behavior scoring alerts',
            channel: 'in_app',
            effort: 'high',
            timeframe: '6-8 weeks',
          },
        ],
        expectedImpact: {
          metric: 'fraud_detection_rate',
          expectedChange: 18,
          confidenceLow: 10,
          confidenceHigh: 28,
          timeframe: '90 days',
        },
        confidence: 0.65,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
    }

    return recs;
  }

  /**
   * Segment users based on behavior criteria
   * @param criteria - Optional filtering criteria
   * @returns Map of segments to user IDs
   */
  async segmentUsers(
    criteria?: { segment?: UserSegment; minEngagement?: number; maxRiskScore?: number }
  ): Promise<Map<UserSegment, string[]>> {
    this.ensureInitialized();

    const segmentMap = new Map<UserSegment, string[]>();

    // Initialize all segments
    const allSegments: UserSegment[] = [
      'new_user', 'active_user', 'power_user', 'at_risk_user',
      'churned_user', 'premium_user', 'casual_user', 'business_user',
    ];
    for (const segment of allSegments) {
      segmentMap.set(segment, []);
    }

    // Process all users with sufficient data
    for (const [userId, events] of Array.from(this.eventStore.entries())) {
      if (events.length < this.config.minEventsForProfile) continue;

      try {
        const profile = await this.getUserProfile(userId);

        // Apply filters if provided
        if (criteria?.segment && profile.segment !== criteria.segment) continue;
        if (criteria?.minEngagement && profile.behaviorScores.engagementScore < criteria.minEngagement) continue;
        if (criteria?.maxRiskScore && profile.riskScore > criteria.maxRiskScore) continue;

        const currentList = segmentMap.get(profile.segment) || [];
        currentList.push(userId);
        segmentMap.set(profile.segment, currentList);
      } catch {
        // Skip users without sufficient data
        continue;
      }
    }

    logger.info('User segmentation completed', {
      event: 'behavioral_analytics.segmentation_complete',
      metadata: {
        totalUsersProcessed: this.eventStore.size,
        segmentDistribution: Object.fromEntries(
          Array.from(segmentMap.entries()).map(([seg, users]) => [seg, users.length])
        ),
      },
    });

    return segmentMap;
  }

  /**
   * Get aggregated statistics across all users
   * @returns Platform-wide behavioral statistics
   */
  async getPlatformStats(): Promise<{
    totalUsers: number;
    totalSessions: number;
    totalEvents: number;
    avgSessionDuration: number;
    overallConversionRate: number;
    segmentDistribution: Record<UserSegment, number>;
    avgEngagementScore: number;
    avgRiskScore: number;
    topPages: PageFrequency[];
    peakActivityHour: number;
  }> {
    this.ensureInitialized();

    let totalEvents = 0;
    let totalDuration = 0;
    let convertedSessions = 0;
    const segmentCounts: Record<string, number> = {};
    let totalEngagementScore = 0;
    let totalRiskScore = 0;
    let profiledUsers = 0;
    const allPageCounts = new Map<string, number>();
    const hourlyTotals = new Array(24).fill(0);

    for (const [userId, events] of Array.from(this.eventStore.entries())) {
      totalEvents += events.length;

      // Count page views
      for (const event of events) {
        if (event.eventType === 'page_view') {
          allPageCounts.set(event.page, (allPageCounts.get(event.page) || 0) + 1);
          hourlyTotals[event.timestamp.getHours()]++;
        }
      }

      // Try to get profile for detailed stats
      if (events.length >= this.config.minEventsForProfile) {
        try {
          const profile = await this.getUserProfile(userId);
          totalDuration += profile.avgSessionDuration;
          totalEngagementScore += profile.behaviorScores.engagementScore;
          totalRiskScore += profile.riskScore;
          profiledUsers++;

          segmentCounts[profile.segment] = (segmentCounts[profile.segment] || 0) + 1;

          if (profile.conversionHistory.length > 0) {
            convertedSessions++;
          }
        } catch {
          // Skip unprofileable users
        }
      }
    }

    // Calculate session stats
    const totalSessions = this.sessionStore.size;
    Array.from(this.sessionStore.values()).forEach((session) => {
      if (session.converted) convertedSessions++;
    });

    // Find peak hour
    const peakActivityHour = hourlyTotals.indexOf(Math.max(...hourlyTotals));

    // Sort pages by count
    const topPages = Array.from(allPageCounts.entries())
      .map(([page, count]) => ({ page, count, percentage: 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalUsers: this.eventStore.size,
      totalSessions,
      totalEvents,
      avgSessionDuration: profiledUsers > 0 ? Math.round(totalDuration / profiledUsers) : 0,
      overallConversionRate: totalSessions > 0 ? Math.round((convertedSessions / totalSessions) * 10000) / 100 : 0,
      segmentDistribution: segmentCounts as Record<UserSegment, number>,
      avgEngagementScore: profiledUsers > 0 ? Math.round(totalEngagementScore / profiledUsers) : 0,
      avgRiskScore: profiledUsers > 0 ? Math.round(totalRiskScore / profiledUsers) : 0,
      topPages,
      peakActivityHour,
    };
  }

  /**
   * Clear all stored data (useful for testing)
   */
  async clearAll(): Promise<void> {
    this.eventStore.clear();
    this.sessionStore.clear();
    this.profileCache.clear();

    logger.info('All analytics data cleared', {
      event: 'behavioral_analytics.data_cleared',
    });
  }

  /**
   * Ensure the engine is initialized before operations
   * @throws AppError if engine not initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new AppError(
        'BehavioralAnalyticsEngine not initialized. Call initialize() first.',
        ErrorCode.INVALID_CONFIG
      );
    }
  }

  /**
   * Export user data for compliance purposes (GDPR, etc.)
   * @param userId - User identifier
   * @returns All stored data for the user
   */
  async exportUserData(userId: string): Promise<{
    events: BehaviorEvent[];
    sessions: SessionData[];
    profile?: UserProfile;
  }> {
    this.ensureInitialized();

    const events = this.eventStore.get(userId) || [];
    const sessions = this.aggregateUserSessions(userId);
    
    let profile: UserProfile | undefined;
    try {
      profile = await this.getUserProfile(userId);
    } catch {
      // Profile may not exist
    }

    logger.info('User data exported', {
      event: 'behavioral_analytics.data_export',
      metadata: { userId, eventCount: events.length, sessionCount: sessions.length },
    });

    return { events, sessions, profile };
  }

  /**
   * Delete all data for a user (GDPR right to erasure)
   * @param userId - User identifier
   */
  async deleteUserData(userId: string): Promise<void> {
    this.ensureInitialized();

    this.eventStore.delete(userId);
    this.profileCache.delete(userId);

    // Remove user sessions
    const sessionsToDelete: string[] = [];
    Array.from(this.sessionStore.entries()).forEach(([sessionId, session]) => {
      if (session.userId === userId) {
        sessionsToDelete.push(sessionId);
      }
    });
    for (const sessionId of sessionsToDelete) {
      this.sessionStore.delete(sessionId);
    }

    logger.info('User data deleted', {
      event: 'behavioral_analytics.data_deleted',
      metadata: { userId, sessionsDeleted: sessionsToDelete.length },
    });
  }
}

// ============== Utility Functions ==============

/**
 * Create a standardized behavior event
 * @param params - Event parameters
 * @returns Complete behavior event object
 */
export function createBehaviorEvent(params: {
  id: string;
  userId: string;
  sessionId: string;
  eventType: EventType;
  page: string;
  element?: string;
  metadata?: Record<string, unknown>;
  deviceInfo: DeviceInfo;
  geoLocation?: GeoLocation;
  timestamp?: Date;
}): BehaviorEvent {
  return {
    id: params.id,
    userId: params.userId,
    sessionId: params.sessionId,
    eventType: params.eventType,
    page: params.page,
    element: params.element,
    timestamp: params.timestamp || new Date(),
    metadata: params.metadata || {},
    deviceInfo: params.deviceInfo,
    geoLocation: params.geoLocation,
  };
}

/**
 * Create default device info object
 * @param overrides - Optional property overrides
 * @returns DeviceInfo object
 */
export function createDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: overrides.deviceId || 'unknown_device',
    deviceType: overrides.deviceType || 'desktop',
    os: overrides.os || 'Unknown OS',
    browser: overrides.browser || 'Unknown Browser',
    screenWidth: overrides.screenWidth || 1920,
    screenHeight: overrides.screenHeight || 1080,
    userAgent: overrides.userAgent || '',
  };
}

/**
 * Calculate session timeout threshold
 * @param config - Analytics configuration
 * @returns Timeout in milliseconds
 */
export function getSessionTimeoutMs(config: AnalyticsConfig): number {
  return config.sessionTimeout * 1000;
}

/**
 * Determine if session should be considered expired
 * @param lastActivity - Timestamp of last activity
 * @param config - Analytics configuration
 * @returns True if session is expired
 */
export function isSessionExpired(lastActivity: Date, config: AnalyticsConfig): boolean {
  const timeout = getSessionTimeoutMs(config);
  const elapsed = Date.now() - lastActivity.getTime();
  return elapsed > timeout;
}

// Export singleton instance for convenience
export const behavioralAnalytics = new BehavioralAnalyticsEngine();

export default BehavioralAnalyticsEngine;
