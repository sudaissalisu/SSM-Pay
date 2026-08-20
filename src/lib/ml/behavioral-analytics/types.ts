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
