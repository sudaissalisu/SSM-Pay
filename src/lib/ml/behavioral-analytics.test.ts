/**
 * Unit Tests for Behavioral Analytics Module
 * Comprehensive test coverage for SSM-Pay behavioral analytics engine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BehavioralAnalyticsEngine,
  createBehaviorEvent,
  createDeviceInfo,
  getSessionTimeoutMs,
  isSessionExpired,
  type BehaviorEvent,
  type SessionData,
  type UserProfile,
  type ConversionFunnel,
  type FunnelStep,
  type BehaviorRecommendation,
  type DeviceInfo,
  type EventType,
  type UserSegment,
  type EngagementLevel,
  type AdoptionStatus,
} from './behavioral-analytics';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Test Fixtures ==============

/** Create a mock device info object for testing */
function createMockDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: overrides.deviceId || 'test_device_123',
    deviceType: overrides.deviceType || 'desktop',
    os: overrides.os || 'Windows',
    browser: overrides.browser || 'Chrome',
    screenWidth: overrides.screenWidth || 1920,
    screenHeight: overrides.screenHeight || 1080,
    userAgent: overrides.userAgent || 'Mozilla/5.0 Test Browser',
  };
}

/** Create a mock behavior event for testing */
function createMockEvent(overrides: Partial<BehaviorEvent> & {
  userId?: string;
  sessionId?: string;
  eventType?: EventType;
  page?: string;
} = {}): BehaviorEvent {
  const now = new Date();
  return {
    id: overrides.id || `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: overrides.userId || 'test_user_001',
    sessionId: overrides.sessionId || 'test_session_001',
    eventType: overrides.eventType || 'page_view',
    page: overrides.page || '/dashboard',
    timestamp: overrides.timestamp || now,
    metadata: overrides.metadata || {},
    deviceInfo: overrides.deviceInfo || createMockDeviceInfo(),
    element: overrides.element,
    geoLocation: overrides.geoLocation,
  };
}

/** Create a batch of events simulating a typical user session */
function createMockSessionEvents(
  userId: string = 'test_user_001',
  sessionId: string = 'test_session_001'
): BehaviorEvent[] {
  const baseTime = new Date('2024-01-15T10:00:00Z');
  
  return [
    // Initial page view
    createMockEvent({
      id: 'evt_1',
      userId,
      sessionId,
      eventType: 'page_view',
      page: '/dashboard',
      timestamp: new Date(baseTime.getTime()),
    }),
    // Click on payment menu
    createMockEvent({
      id: 'evt_2',
      userId,
      sessionId,
      eventType: 'click',
      page: '/dashboard',
      element: 'payment_menu_item',
      timestamp: new Date(baseTime.getTime() + 5000),
    }),
    // Navigate to payment page
    createMockEvent({
      id: 'evt_3',
      userId,
      sessionId,
      eventType: 'navigation',
      page: '/dashboard/payment',
      timestamp: new Date(baseTime.getTime() + 10000),
    }),
    // Payment page view
    createMockEvent({
      id: 'evt_4',
      userId,
      sessionId,
      eventType: 'page_view',
      page: '/dashboard/payment',
      timestamp: new Date(baseTime.getTime() + 11000),
    }),
    // Start form (payment initiation)
    createMockEvent({
      id: 'evt_5',
      userId,
      sessionId,
      eventType: 'form_start',
      page: '/dashboard/payment',
      element: 'payment_form',
      timestamp: new Date(baseTime.getTime() + 30000),
    }),
    // Payment init event
    createMockEvent({
      id: 'evt_6',
      userId,
      sessionId,
      eventType: 'payment_init',
      page: '/dashboard/payment',
      timestamp: new Date(baseTime.getTime() + 60000),
      metadata: { amount: 5000, currency: 'NGN' },
    }),
    // Complete payment
    createMockEvent({
      id: 'evt_7',
      userId,
      sessionId,
      eventType: 'payment_complete',
      page: '/callback',
      timestamp: new Date(baseTime.getTime() + 120000),
      metadata: { transaction_ref: 'txn_123456', status: 'success' },
    }),
  ];
}

/** Create a sample conversion funnel definition */
function createMockFunnel(): ConversionFunnel {
  const steps: FunnelStep[] = [
    {
      id: 'step_1',
      name: 'Dashboard Visit',
      pageOrAction: '/dashboard',
      expectedEventType: 'page_view',
    },
    {
      id: 'step_2',
      name: 'Payment Page View',
      pageOrAction: '/dashboard/payment',
      expectedEventType: 'page_view',
    },
    {
      id: 'step_3',
      name: 'Payment Initiation',
      pageOrAction: '/dashboard/payment',
      expectedEventType: 'payment_init',
    },
    {
      id: 'step_4',
      name: 'Payment Completion',
      pageOrAction: '/callback',
      expectedEventType: 'payment_complete',
    },
  ];

  return {
    id: 'funnel_payment_conversion',
    name: 'Payment Conversion Funnel',
    steps,
    analysis: {
      totalEntries: 0,
      stepCounts: [],
      stepConversionRates: [],
      overallConversionRate: 0,
      dropOffPoints: [],
      avgTimePerStep: [],
      periodStart: new Date(),
      periodEnd: new Date(),
    },
  };
}

// ============== Test Suite ==============

describe('BehavioralAnalyticsEngine', () => {
  let engine: BehavioralAnalyticsEngine;

  beforeEach(async () => {
    engine = new BehavioralAnalyticsEngine();
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.clearAll();
  });

  describe('Initialization', () => {
    it('should initialize successfully with default configuration', async () => {
      const testEngine = new BehavioralAnalyticsEngine();
      expect(testEngine.initialize()).resolves.not.toThrow();
    });

    it('should accept custom configuration', async () => {
      const customConfig = {
        minSessionDuration: 10,
        sessionTimeout: 3600,
        cacheTTLMinutes: 120,
      };
      
      const testEngine = new BehavioralAnalyticsEngine(customConfig);
      await testEngine.initialize();
      
      expect(testEngine.initialize()).resolves.not.toThrow();
    });

    it('should throw error with invalid engagement weights', async () => {
      const invalidConfig = {
        engagementWeights: {
          pageViewWeight: -1,
          clickWeight: 1.5,
          formWeight: 2.0,
          paymentWeight: 3.0,
          navigationWeight: 1.2,
          searchWeight: 1.8,
          featureAdoptionWeight: 2.5,
        },
      };

      const testEngine = new BehavioralAnalyticsEngine(invalidConfig);
      await expect(testEngine.initialize()).rejects.toThrow(AppError);
    });

    it('should throw error with invalid segmentation thresholds', async () => {
      const invalidConfig = {
        segmentationThresholds: {
          powerUserThreshold: 20,
          atRiskDaysInactive: 30, // Higher than churned threshold
          churnedDaysInactive: 14,
          highEngagementScore: 70,
          businessUserMinTransactions: 50,
        },
      };

      const testEngine = new BehavioralAnalyticsEngine(invalidConfig);
      await expect(testEngine.initialize()).rejects.toThrow(AppError);
    });
  });

  describe('Event Tracking', () => {
    it('should track a valid event successfully', async () => {
      const event = createMockEvent({ id: 'test_event_1' });
      
      await expect(engine.trackEvent(event)).resolves.not.toThrow();
    });

    it('should reject event without id', async () => {
      const event = createMockEvent({ id: '' });
      
      await expect(engine.trackEvent(event)).rejects.toThrow(AppError);
      await expect(engine.trackEvent(event)).rejects.toThrow(/Event ID is required/);
    });

    it('should reject event without userId', async () => {
      const event = createMockEvent({ userId: '' });
      
      await expect(engine.trackEvent(event)).rejects.toThrow(AppError);
      await expect(engine.trackEvent(event)).rejects.toThrow(/User ID is required/);
    });

    it('should reject event without sessionId', async () => {
      const event = createMockEvent({ sessionId: '' });
      
      await expect(engine.trackEvent(event)).rejects.toThrow(AppError);
      await expect(engine.trackEvent(event)).rejects.toThrow(/Session ID is required/);
    });

    it('should reject event with invalid eventType', async () => {
      const event = createMockEvent();
      (event as Record<string, unknown>).eventType = 'invalid_type';
      
      await expect(engine.trackEvent(event)).rejects.toThrow(AppError);
      await expect(engine.trackEvent(event)).rejects.toThrow(/Invalid event type/);
    });

    it('should reject event without page', async () => {
      const event = createMockEvent({ page: '' });
      
      await expect(engine.trackEvent(event)).rejects.toThrow(AppError);
      await expect(engine.trackEvent(event)).rejects.toThrow(/Page is required/);
    });

    it('should reject event with invalid timestamp', async () => {
      const event = createMockEvent();
      event.timestamp = new Date('invalid') as Date;
      
      await expect(engine.trackEvent(event)).rejects.toThrow(AppError);
      await expect(engine.trackEvent(event)).rejects.toThrow(/valid Date/);
    });

    it('should reject event without deviceInfo', async () => {
      const event = createMockEvent();
      (event as Record<string, unknown>).deviceInfo = null;
      
      await expect(engine.trackEvent(event)).rejects.toThrow(AppError);
      await expect(engine.trackEvent(event)).rejects.toThrow(/Device info/);
    });

    it('should track multiple events in batch', async () => {
      const events = [
        createMockEvent({ id: 'batch_evt_1' }),
        createMockEvent({ id: 'batch_evt_2', eventType: 'click' }),
        createMockEvent({ id: 'batch_evt_3', eventType: 'scroll' }),
      ];

      await expect(engine.trackEventsBatch(events)).resolves.not.toThrow();
    });

    it('should handle empty batch gracefully', async () => {
      await expect(engine.trackEventsBatch([])).resolves.not.toThrow();
    });

    it('should track all valid event types', async () => {
      const validEventTypes: EventType[] = [
        'page_view', 'click', 'scroll', 'form_submit', 'form_start', 'form_abandon',
        'payment_init', 'payment_complete', 'payment_failed', 'navigation', 'search',
        'filter_apply', 'item_select', 'logout', 'login', 'signup', 'error', 'api_call',
        'download', 'share', 'bookmark', 'feedback_submit',
      ];

      for (const eventType of validEventTypes) {
        const event = createMockEvent({
          id: `type_test_${eventType}`,
          eventType,
        });
        await expect(engine.trackEvent(event)).resolves.not.toThrow();
      }
    });
  });

  describe('Session Management', () => {
    it('should create session from first event', async () => {
      const event = createMockEvent({ id: 'session_test_1' });
      await engine.trackEvent(event);

      const session = await engine.getSession(event.sessionId);
      
      expect(session).not.toBeNull();
      expect(session!.sessionId).toBe(event.sessionId);
      expect(session!.userId).toBe(event.userId);
      expect(session!.entryPage).toBe(event.page);
      expect(session!.pagesVisited).toContain(event.page);
      expect(session!.events).toHaveLength(1);
    });

    it('should update existing session with subsequent events', async () => {
      const events = createMockSessionEvents();
      
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const session = await engine.getSession('test_session_001');
      
      expect(session).not.toBeNull();
      expect(session!.events).toHaveLength(7);
      expect(session!.pagesVisited).toContain('/dashboard');
      expect(session!.pagesVisited).toContain('/dashboard/payment');
      expect(session!.pagesVisited).toContain('/callback');
      expect(session!.converted).toBe(true);
      expect(session!.conversionType).toBe('payment_completed');
    });

    it('should correctly count page views and interactions', async () => {
      const events = createMockSessionEvents();
      
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const session = await engine.getSession('test_session_001');
      
      expect(session!.pageViewCount).toBe(2); // dashboard + payment page views
      expect(session!.interactionCount).toBe(5); // click, navigation, form_start, payment_init, payment_complete
    });

    it('should mark single-page sessions as bounces', async () => {
      const event = createMockEvent({
        id: 'bounce_test_1',
        eventType: 'page_view',
      });
      
      await engine.trackEvent(event);

      const session = await engine.getSession(event.sessionId);
      expect(session!.isBounce).toBe(true);
    });

    it('should not mark multi-interaction sessions as bounces', async () => {
      const events = [
        createMockEvent({ id: 'bounce_test_2', eventType: 'page_view' }),
        createMockEvent({ id: 'bounce_test_3', eventType: 'click' }),
      ];
      
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const session = await engine.getSession('test_session_001');
      expect(session!.isBounce).toBe(false);
    });

    it('should calculate session duration correctly', async () => {
      const startTime = new Date('2024-01-15T10:00:00Z');
      const endTime = new Date('2024-01-15T10:05:30Z'); // 5.5 minutes = 330 seconds

      const events = [
        createMockEvent({ id: 'duration_test_1', timestamp: startTime }),
        createMockEvent({ id: 'duration_test_2', timestamp: endTime, eventType: 'click' }),
      ];
      
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const session = await engine.getSession('test_session_001');
      expect(session!.durationSeconds).toBe(330);
    });

    it('should return null for non-existent session', async () => {
      const session = await engine.getSession('non_existent_session');
      expect(session).toBeNull();
    });

    it('should retrieve all sessions for a user', async () => {
      // Create events in two different sessions
      const session1Events = createMockSessionEvents('user_multi', 'session_a');
      const session2Events = createMockSessionEvents('user_multi', 'session_b');

      for (const event of [...session1Events, ...session2Events]) {
        await engine.trackEvent(event);
      }

      const sessions = await engine.getUserSessions('user_multi');
      expect(sessions).toHaveLength(2);
    });
  });

  describe('User Profiling', () => {
    it('should generate profile for user with sufficient data', async () => {
      // Generate enough events across multiple sessions
      for (let i = 0; i < 3; i++) {
        const events = createMockSessionEvents('profile_user', `profile_sess_${i}`);
        
        // Offset timestamps to simulate different days
        for (const event of events) {
          event.timestamp = new Date(event.timestamp.getTime() + i * 24 * 60 * 60 * 1000);
          event.id = `${event.id}_${i}`;
          await engine.trackEvent(event);
        }
      }

      const profile = await engine.getUserProfile('profile_user');
      
      expect(profile).toBeDefined();
      expect(profile.userId).toBe('profile_user');
      expect(profile.totalEvents).toBeGreaterThanOrEqual(10);
      expect(profile.totalSessions).toBe(3);
      expect(profile.segment).toBeDefined();
      expect(profile.engagementLevel).toBeDefined();
      expect(profile.behaviorScores).toBeDefined();
      expect(profile.topPages).toBeDefined();
      expect(profile.devicePreferences).toBeDefined();
    });

    it('should throw error for user with insufficient data', async () => {
      const event = createMockEvent({ userId: 'insufficient_user' });
      await engine.trackEvent(event);

      await expect(engine.getUserProfile('insufficient_user')).rejects.toThrow(AppError);
      await expect(engine.getUserProfile('insufficient_user')).rejects.toThrow(/Insufficient data/);
    });

    it('should calculate correct top pages', async () => {
      const events = [
        ...createMockSessionEvents('pages_user'),
        createMockEvent({ userId: 'pages_user', sessionId: 'pages_extra', page: '/settings', eventType: 'page_view' }),
        createMockEvent({ userId: 'pages_user', sessionId: 'pages_extra', page: '/settings', eventType: 'page_view' }),
        createMockEvent({ userId: 'pages_user', sessionId: 'pages_extra', page: '/help', eventType: 'page_view' }),
      ];

      for (const event of events) {
        await engine.trackEvent(event);
      }

      const profile = await engine.getUserProfile('pages_user');
      
      expect(profile.topPages.length).toBeGreaterThan(0);
      expect(profile.topPages[0].page).toBeDefined();
      expect(profile.topPages[0].count).toBeGreaterThan(0);
    });

    it('should calculate hourly activity distribution', async () => {
      const events = createMockSessionEvents('hourly_user');
      
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const profile = await engine.getUserProfile('hourly_user');
      
      expect(profile.hourlyActivity).toHaveLength(24);
      expect(profile.hourlyActivity.every(h => typeof h === 'number')).toBe(true);
    });

    it('should calculate weekly activity distribution', async () => {
      const events = createMockSessionEvents('weekly_user');
      
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const profile = await engine.getUserProfile('weekly_user');
      
      expect(profile.weeklyActivity).toHaveLength(7);
      expect(profile.weeklyActivity.every(d => typeof d === 'number')).toBe(true);
    });

    it('should assign correct engagement level based on score', async () => {
      const events = createMockSessionEvents('engagement_user');
      
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const profile = await engine.getUserProfile('engagement_user');
      
      expect(['low', 'medium', 'high', 'very_high']).toContain(profile.engagementLevel);
    });

    it('should analyze feature adoption', async () => {
      const events = createMockSessionEvents('adoption_user');
      
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const profile = await engine.getUserProfile('adoption_user');
      
      expect(profile.featureAdoption).toBeDefined();
      expect(typeof profile.featureAdoption.payments).toBe('string');
      expect(typeof profile.featureAdoption.dashboard).toBe('string');
      expect(['not_adopted', 'aware', 'trialing', 'adopted', 'power_user']).toContain(
        profile.featureAdoption.payments
      );
    });

    it('should identify navigation patterns', async () => {
      // Create multiple similar sessions to establish patterns
      for (let i = 0; i < 3; i++) {
        const events = createMockSessionEvents('pattern_user', `pattern_sess_${i}`);
        for (const event of events) {
          event.id = `${event.id}_${i}`;
          event.timestamp = new Date(event.timestamp.getTime() + i * 24 * 60 * 60 * 1000);
          await engine.trackEvent(event);
        }
      }

      const profile = await engine.getUserProfile('pattern_user');
      
      expect(profile.navigationPatterns).toBeDefined();
      expect(Array.isArray(profile.navigationPatterns)).toBe(true);
    });

    it('should extract conversion history', async () => {
      const events = createMockSessionEvents('conversion_user');
      
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const profile = await engine.getUserProfile('conversion_user');
      
      expect(profile.conversionHistory).toBeDefined();
      if (profile.conversionHistory.length > 0) {
        expect(profile.conversionHistory[0].type).toBeDefined();
        expect(profile.conversionHistory[0].timestamp).toBeDefined();
        expect(profile.conversionHistory[0].sessionId).toBeDefined();
      }
    });

    it('should calculate risk score between 0 and 100', async () => {
      const events = createMockSessionEvents('risk_user');
      
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const profile = await engine.getUserProfile('risk_user');
      
      expect(profile.riskScore).toBeGreaterThanOrEqual(0);
      expect(profile.riskScore).toBeLessThanOrEqual(100);
    });

    it('should calculate churn probability between 0 and 1', async () => {
      const events = createMockSessionEvents('churn_user');
      
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const profile = await engine.getUserProfile('churn_user');
      
      expect(profile.churnProbability).toBeGreaterThanOrEqual(0);
      expect(profile.churnProbability).toBeLessThanOrEqual(1);
    });

    it('should predict positive lifetime value', async () => {
      const events = createMockSessionEvents('ltv_user');
      
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const profile = await engine.getUserProfile('ltv_user');
      
      expect(profile.predictedLTV).toBeGreaterThanOrEqual(0);
      expect(typeof profile.predictedLTV).toBe('number');
    });
  });

  describe('Behavior Scoring', () => {
    it('should calculate all behavior scores', async () => {
      const events = createMockSessionEvents('scores_user');
      
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const profile = await engine.getUserProfile('scores_user');
      const scores = profile.behaviorScores;
      
      expect(scores.engagementScore).toBeGreaterThanOrEqual(0);
      expect(scores.engagementScore).toBeLessThanOrEqual(100);
      expect(scores.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(scores.consistencyScore).toBeLessThanOrEqual(100);
      expect(scores.conversionPropensity).toBeGreaterThanOrEqual(0);
      expect(scores.conversionPropensity).toBeLessThanOrEqual(100);
      expect(scores.explorationScore).toBeGreaterThanOrEqual(0);
      expect(scores.explorationScore).toBeLessThanOrEqual(100);
      expect(scores.loyaltyScore).toBeGreaterThanOrEqual(0);
      expect(scores.loyaltyScore).toBeLessThanOrEqual(100);
      expect(scores.trustScore).toBeGreaterThanOrEqual(0);
      expect(scores.trustScore).toBeLessThanOrEqual(100);
    });

    it('should reflect high engagement for active users', async () => {
      // Create many interactions
      const events: BehaviorEvent[] = [];
      for (let i = 0; i < 20; i++) {
        events.push(createMockEvent({
          id: `high_engage_${i}`,
          userId: 'high_engagement_user',
          sessionId: `sess_${Math.floor(i / 7)}`,
          eventType: i % 2 === 0 ? 'page_view' : 'click',
          page: ['/dashboard', '/dashboard/payment', '/settings'][i % 3],
        }));
      }

      for (const event of events) {
        await engine.trackEvent(event);
      }

      const profile = await engine.getUserProfile('high_engagement_user');
      expect(profile.behaviorScores.engagementScore).toBeGreaterThan(50);
    });
  });

  describe('User Segmentation', () => {
    it('should segment users into valid categories', async () => {
      const segments: UserSegment[] = [
        'new_user', 'active_user', 'power_user', 'at_risk_user',
        'churned_user', 'premium_user', 'casual_user', 'business_user',
      ];

      const events = createMockSessionEvents('segment_user');
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const profile = await engine.getUserProfile('segment_user');
      
      expect(segments).toContain(profile.segment);
    });

    it('should provide segment distribution statistics', async () => {
      // Create users that will fall into different segments
      for (let i = 0; i < 5; i++) {
        const events = createMockSessionEvents(`dist_user_${i}`, `dist_sess_${i}`);
        for (const event of events) {
          event.id = `${event.id}_${i}`;
          event.timestamp = new Date(event.timestamp.getTime() + i * 24 * 60 * 60 * 1000);
          await engine.trackEvent(event);
        }
      }

      const segments = await engine.segmentUsers();
      
      expect(segments).toBeInstanceOf(Map);
      expect(segments.size).toBeGreaterThan(0);
    });

    it('should filter segments by criteria', async () => {
      const events = createMockSessionEvents('filter_user');
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const segments = await engine.segmentUsers({ minEngagementScore: 0 });
      
      // Should return some results since we're filtering by minimum score of 0
      let totalUsers = 0;
      for (const [, users] of segments) {
        totalUsers += users.length;
      }
      expect(totalUsers).toBeGreaterThan(0);
    });
  });

  describe('Funnel Analysis', () => {
    it('should analyze conversion funnel', async () => {
      // Create complete funnel journey
      const events = createMockSessionEvents('funnel_user');
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const funnel = createMockFunnel();
      const analysis = await engine.analyzeFunnel(funnel);
      
      expect(analysis).toBeDefined();
      expect(analysis.totalEntries).toBeGreaterThanOrEqual(0);
      expect(analysis.stepCounts).toHaveLength(funnel.steps.length);
      expect(analysis.stepConversionRates).toHaveLength(funnel.steps.length);
      expect(analysis.overallConversionRate).toBeGreaterThanOrEqual(0);
      expect(analysis.overallConversionRate).toBeLessThanOrEqual(100);
      expect(analysis.avgTimePerStep).toHaveLength(funnel.steps.length);
    });

    it('should identify drop-off points', async () => {
      // Create incomplete funnel journeys (drop off before completion)
      const partialEvents = createMockSessionEvents('dropoff_user').slice(0, 4); // Only first 4 events
      for (const event of partialEvents) {
        await engine.trackEvent(event);
      }

      const funnel = createMockFunnel();
      const analysis = await engine.analyzeFunnel(funnel);
      
      // Should have some drop-off data or zero entries
      expect(Array.isArray(analysis.dropOffPoints)).toBe(true);
    });

    it('should filter funnel by date range', async () => {
      const events = createMockSessionEvents('date_filter_user');
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const funnel = createMockFunnel();
      const pastDate = new Date('2024-01-01T00:00:00Z');
      const futureDate = new Date('2025-12-31T23:59:59Z');
      
      const analysis = await engine.analyzeFunnel(funnel, {
        startDate: pastDate,
        endDate: futureDate,
      });
      
      expect(analysis.periodStart).toEqual(pastDate);
      expect(analysis.periodEnd).toEqual(futureDate);
    });

    it('should filter funnel by user', async () => {
      const events = createMockSessionEvents('user_filter_user');
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const funnel = createMockFunnel();
      const analysis = await engine.analyzeFunnel(funnel, {
        userId: 'user_filter_user',
      });
      
      expect(analysis.totalEntries).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations for specific user', async () => {
      // Create user with concerning patterns (potential churn)
      const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000); // 20 days ago
      const events = createMockSessionEvents('rec_user');
      for (const event of events) {
        event.timestamp = oldDate;
        await engine.trackEvent(event);
      }

      const recommendations = await engine.generateRecommendations({
        userId: 'rec_user',
        categories: ['retention', 'feature_adoption'],
      });
      
      expect(Array.isArray(recommendations)).toBe(true);
      if (recommendations.length > 0) {
        const rec = recommendations[0];
        expect(rec.id).toBeDefined();
        expect(rec.category).toBeDefined();
        expect(rec.priority).toBeDefined();
        expect(rec.title).toBeDefined();
        expect(rec.description).toBeDefined();
        expect(rec.actions).toBeDefined();
        expect(rec.expectedImpact).toBeDefined();
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should generate recommendations for segment', async () => {
      const recommendations = await engine.generateRecommendations({
        segment: 'new_user',
        categories: ['onboarding'],
      });
      
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should generate general recommendations', async () => {
      const recommendations = await engine.generateRecommendations({
        categories: ['engagement', 'conversion'],
      });
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should include actionable items in recommendations', async () => {
      const recommendations = await engine.generateRecommendations({
        categories: ['engagement'],
      });
      
      if (recommendations.length > 0) {
        const actions = recommendations[0].actions;
        expect(actions.length).toBeGreaterThan(0);
        
        const action = actions[0];
        expect(action.id).toBeDefined();
        expect(action.description).toBeDefined();
        expect(['in_app', 'email', 'push', 'sms', 'banner']).toContain(action.channel);
        expect(['low', 'medium', 'high']).toContain(action.effort);
      }
    });

    it('should include impact estimates in recommendations', async () => {
      const recommendations = await engine.generateRecommendations({
        categories: ['conversion'],
      });
      
      if (recommendations.length > 0) {
        const impact = recommendations[0].expectedImpact;
        expect(impact.metric).toBeDefined();
        expect(typeof impact.expectedChange).toBe('number');
        expect(typeof impact.confidenceLow).toBe('number');
        expect(typeof impact.confidenceHigh).toBe('number');
        expect(impact.timeframe).toBeDefined();
      }
    });
  });

  describe('Platform Statistics', () => {
    it('should return platform-wide statistics', async () => {
      // Add some data
      for (let i = 0; i < 3; i++) {
        const events = createMockSessionEvents(`stats_user_${i}`, `stats_sess_${i}`);
        for (const event of events) {
          event.id = `${event.id}_${i}`;
          await engine.trackEvent(event);
        }
      }

      const stats = await engine.getPlatformStats();
      
      expect(stats.totalUsers).toBeGreaterThanOrEqual(0);
      expect(stats.totalSessions).toBeGreaterThanOrEqual(0);
      expect(stats.totalEvents).toBeGreaterThanOrEqual(0);
      expect(stats.avgSessionDuration).toBeGreaterThanOrEqual(0);
      expect(stats.overallConversionRate).toBeGreaterThanOrEqual(0);
      expect(stats.overallConversionRate).toBeLessThanOrEqual(100);
      expect(stats.avgEngagementScore).toBeGreaterThanOrEqual(0);
      expect(stats.avgEngagementScore).toBeLessThanOrEqual(100);
      expect(stats.avgRiskScore).toBeGreaterThanOrEqual(0);
      expect(stats.avgRiskScore).toBeLessThanOrEqual(100);
      expect(stats.peakActivityHour).toBeGreaterThanOrEqual(0);
      expect(stats.peakActivityHour).toBeLessThanOrEqual(23);
    });

    it('should include top pages in statistics', async () => {
      const events = createMockSessionEvents('top_pages_user');
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const stats = await engine.getPlatformStats();
      
      expect(Array.isArray(stats.topPages)).toBe(true);
    });
  });

  describe('Data Management', () => {
    it('should export user data completely', async () => {
      const events = createMockSessionEvents('export_user');
      for (const event of events) {
        await engine.trackEvent(event);
      }

      const exportedData = await engine.exportUserData('export_user');
      
      expect(exportedData.events).toBeDefined();
      expect(exportedData.sessions).toBeDefined();
      expect(exportedData.events.length).toBe(events.length);
    });

    it('should delete user data on request', async () => {
      const events = createMockSessionEvents('delete_user');
      for (const event of events) {
        await engine.trackEvent(event);
      }

      // Verify data exists
      const profileBefore = await engine.getUserProfile('delete_user').catch(() => null);
      
      await engine.deleteUserData('delete_user');

      // Verify data is deleted
      await expect(engine.getUserProfile('delete_user')).rejects.toThrow();
    });

    it('should clear all data', async () => {
      const events = createMockSessionEvents('clear_user');
      for (const event of events) {
        await engine.trackEvent(event);
      }

      await engine.clearAll();

      const stats = await engine.getPlatformStats();
      expect(stats.totalUsers).toBe(0);
      expect(stats.totalSessions).toBe(0);
      expect(stats.totalEvents).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid successive events', async () => {
      const events: BehaviorEvent[] = [];
      const baseTime = new Date();
      
      for (let i = 0; i < 50; i++) {
        events.push(createMockEvent({
          id: `rapid_${i}`,
          userId: 'rapid_user',
          sessionId: 'rapid_session',
          eventType: 'click',
          timestamp: new Date(baseTime.getTime() + i * 100), // 100ms apart
        }));
      }

      await expect(engine.trackEventsBatch(events)).resolves.not.toThrow();
    });

    it('should handle events with extensive metadata', async () => {
      const largeMetadata = {
        key1: 'value1',
        key2: 123,
        key3: true,
        key4: { nested: 'object' },
        key5: ['array', 'of', 'values'],
        // Add many more keys
        ...Object.fromEntries(
          Array.from({ length: 20 }, (_, i) => [`extra_key_${i}`, `value_${i}`])
        ),
      };

      const event = createMockEvent({
        id: 'metadata_test',
        metadata: largeMetadata,
      });

      await expect(engine.trackEvent(event)).resolves.not.toThrow();
    });

    it('should handle different device types', async () => {
      const deviceTypes: DeviceInfo['deviceType'][] = ['desktop', 'mobile', 'tablet'];
      
      for (const deviceType of deviceTypes) {
        const event = createMockEvent({
          id: `device_${deviceType}`,
          deviceInfo: createMockDeviceInfo({ deviceType }),
        });
        
        await expect(engine.trackEvent(event)).resolves.not.toThrow();
      }
    });

    it('should handle geographic location data', async () => {
      const event = createMockEvent({
        id: 'geo_test',
        geoLocation: {
          countryCode: 'NG',
          countryName: 'Nigeria',
          regionCode: 'LG',
          city: 'Lagos',
          latitude: 6.5244,
          longitude: 3.3792,
        },
      });

      await expect(engine.trackEvent(event)).resolves.not.toThrow();

      const session = await engine.getSession(event.sessionId);
      expect(session).not.toBeNull();
    });

    it('should handle failed payment events', async () => {
      const events = [
        createMockEvent({ id: 'fail_1', eventType: 'payment_init' }),
        createMockEvent({ 
          id: 'fail_2', 
          eventType: 'payment_failed',
          metadata: { reason: 'insufficient_funds', error_code: 'DECLINED' },
        }),
      ];

      for (const event of events) {
        await engine.trackEvent(event);
      }

      const session = await engine.getSession('test_session_001');
      // Failed payments should not mark as converted
      expect(session!.converted).toBe(false);
    });
  });
});

describe('Utility Functions', () => {
  describe('createBehaviorEvent', () => {
    it('should create a complete behavior event', () => {
      const event = createBehaviorEvent({
        id: 'util_test_1',
        userId: 'user_1',
        sessionId: 'session_1',
        eventType: 'page_view',
        page: '/test',
        deviceInfo: createMockDeviceInfo(),
      });

      expect(event.id).toBe('util_test_1');
      expect(event.userId).toBe('user_1');
      expect(event.sessionId).toBe('session_1');
      expect(event.eventType).toBe('page_view');
      expect(event.page).toBe('/test');
      expect(event.metadata).toEqual({});
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should use provided timestamp or default to now', () => {
      const customTime = new Date('2024-06-15T12:00:00Z');
      
      const eventWithTime = createBehaviorEvent({
        id: 'time_test_1',
        userId: 'user_1',
        sessionId: 'session_1',
        eventType: 'page_view',
        page: '/test',
        deviceInfo: createMockDeviceInfo(),
        timestamp: customTime,
      });

      expect(eventWithTime.timestamp).toEqual(customTime);
    });

    it('should include optional fields when provided', () => {
      const event = createBehaviorEvent({
        id: 'optional_test',
        userId: 'user_1',
        sessionId: 'session_1',
        eventType: 'click',
        page: '/test',
        element: 'button_id',
        metadata: { custom: 'data' },
        deviceInfo: createMockDeviceInfo(),
        geoLocation: {
          countryCode: 'US',
          countryName: 'United States',
        },
      });

      expect(event.element).toBe('button_id');
      expect(event.metadata).toEqual({ custom: 'data' });
      expect(event.geoLocation).toBeDefined();
      expect(event.geoLocation?.countryCode).toBe('US');
    });
  });

  describe('createDeviceInfo', () => {
    it('should create default device info', () => {
      const deviceInfo = createDeviceInfo();

      expect(deviceInfo.deviceId).toBe('unknown_device');
      expect(deviceInfo.deviceType).toBe('desktop');
      expect(deviceInfo.screenWidth).toBe(1920);
      expect(deviceInfo.screenHeight).toBe(1080);
    });

    it('should apply overrides', () => {
      const deviceInfo = createDeviceInfo({
        deviceId: 'custom_device',
        deviceType: 'mobile',
        os: 'iOS',
        screenWidth: 375,
        screenHeight: 667,
      });

      expect(deviceInfo.deviceId).toBe('custom_device');
      expect(deviceInfo.deviceType).toBe('mobile');
      expect(deviceInfo.os).toBe('iOS');
      expect(deviceInfo.screenWidth).toBe(375);
      expect(deviceInfo.screenHeight).toBe(667);
      // Non-overridden values should be defaults
      expect(deviceInfo.browser).toBe('Unknown Browser');
    });
  });

  describe('getSessionTimeoutMs', () => {
    it('should convert seconds to milliseconds', () => {
      const config = {
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

      const timeoutMs = getSessionTimeoutMs(config);
      expect(timeoutMs).toBe(1800000); // 1800 * 1000
    });
  });

  describe('isSessionExpired', () => {
    it('should return false for recent activity', () => {
      const config = {
        minSessionDuration: 5,
        sessionTimeout: 1800,
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

      const recentActivity = new Date(Date.now() - 60000); // 1 minute ago
      expect(isSessionExpired(recentActivity, config)).toBe(false);
    });

    it('should return true for old activity', () => {
      const config = {
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

      const oldActivity = new Date(Date.now() - 3600000); // 1 hour ago
      expect(isSessionExpired(oldActivity, config)).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  it('should process complete user journey end-to-end', async () => {
    const engine = new BehavioralAnalyticsEngine();
    await engine.initialize();

    try {
      // Simulate a complete user journey over multiple days
      const userId = 'journey_user';
      
      // Day 1: Sign up and explore
      const day1Base = new Date('2024-01-01T10:00:00Z');
      const day1Events = [
        createMockEvent({ id: 'j1_1', userId, sessionId: 'j1_s1', eventType: 'signup', page: '/signup', timestamp: new Date(day1Base.getTime()) }),
        createMockEvent({ id: 'j1_2', userId, sessionId: 'j1_s1', eventType: 'page_view', page: '/dashboard', timestamp: new Date(day1Base.getTime() + 5000) }),
        createMockEvent({ id: 'j1_3', userId, sessionId: 'j1_s1', eventType: 'click', page: '/dashboard', element: 'explore_btn', timestamp: new Date(day1Base.getTime() + 15000) }),
      ];

      // Day 2: First payment attempt
      const day2Base = new Date('2024-01-02T14:00:00Z');
      const day2Events = [
        createMockEvent({ id: 'j2_1', userId, sessionId: 'j2_s1', eventType: 'login', page: '/login', timestamp: new Date(day2Base.getTime()) }),
        createMockEvent({ id: 'j2_2', userId, sessionId: 'j2_s1', eventType: 'page_view', page: '/dashboard', timestamp: new Date(day2Base.getTime() + 3000) }),
        createMockEvent({ id: 'j2_3', userId, sessionId: 'j2_s1', eventType: 'navigation', page: '/dashboard/payment', timestamp: new Date(day2Base.getTime() + 10000) }),
        createMockEvent({ id: 'j2_4', userId, sessionId: 'j2_s1', eventType: 'payment_init', page: '/dashboard/payment', timestamp: new Date(day2Base.getTime() + 30000), metadata: { amount: 10000 } }),
        createMockEvent({ id: 'j2_5', userId, sessionId: 'j2_s1', eventType: 'payment_complete', page: '/callback', timestamp: new Date(day2Base.getTime() + 60000), metadata: { status: 'success' } }),
      ];

      // Day 5: Return and use zainbox
      const day5Base = new Date('2024-01-05T09:00:00Z');
      const day5Events = [
        createMockEvent({ id: 'j5_1', userId, sessionId: 'j5_s1', eventType: 'login', page: '/login', timestamp: new Date(day5Base.getTime()) }),
        createMockEvent({ id: 'j5_2', userId, sessionId: 'j5_s1', eventType: 'page_view', page: '/dashboard', timestamp: new Date(day5Base.getTime() + 2000) }),
        createMockEvent({ id: 'j5_3', userId, sessionId: 'j5_s1', eventType: 'navigation', page: '/dashboard/zainbox', timestamp: new Date(day5Base.getTime() + 8000) }),
        createMockEvent({ id: 'j5_4', userId, sessionId: 'j5_s1', eventType: 'page_view', page: '/dashboard/zainbox/list', timestamp: new Date(day5Base.getTime() + 12000) }),
        createMockEvent({ id: 'j5_5', userId, sessionId: 'j5_s1', eventType: 'click', page: '/dashboard/zainbox/list', element: 'create_zainbox', timestamp: new Date(day5Base.getTime() + 20000) }),
        createMockEvent({ id: 'j5_6', userId, sessionId: 'j5_s1', eventType: 'navigation', page: '/dashboard/zainbox/create', timestamp: new Date(day5Base.getTime() + 25000) }),
        createMockEvent({ id: 'j5_7', userId, sessionId: 'j5_s1', eventType: 'form_submit', page: '/dashboard/zainbox/create', timestamp: new Date(day5Base.getTime() + 60000) }),
      ];

      // Track all events
      const allEvents = [...day1Events, ...day2Events, ...day5Events];
      await engine.trackEventsBatch(allEvents);

      // Get comprehensive profile
      const profile = await engine.getUserProfile(userId);

      // Validate profile completeness
      expect(profile.totalEvents).toBe(allEvents.length);
      expect(profile.totalSessions).toBe(3);
      expect(profile.conversionHistory.length).toBeGreaterThanOrEqual(1);
      expect(profile.featureAdoption.payments).not.toBe('not_adopted');

      // Get platform stats
      const stats = await engine.getPlatformStats();
      expect(stats.totalUsers).toBeGreaterThanOrEqual(1);

      // Get recommendations
      const recommendations = await engine.generateRecommendations({ userId });
      expect(Array.isArray(recommendations)).toBe(true);

      // Cleanup
      await engine.clearAll();
    } catch (error) {
      await engine.clearAll();
      throw error;
    }
  });

  it('should handle concurrent event tracking', async () => {
    const engine = new BehavioralAnalyticsEngine();
    await engine.initialize();

    try {
      // Track many events concurrently
      const eventPromises = Array.from({ length: 100 }, (_, i) =>
        engine.trackEvent(createMockEvent({
          id: `concurrent_${i}`,
          userId: `concurrent_user`,
          sessionId: `concurrent_session`,
          eventType: i % 2 === 0 ? 'page_view' : 'click',
        }))
      );

      await Promise.all(eventPromises);

      // Verify all events were tracked
      const profile = await engine.getUserProfile('concurrent_user');
      expect(profile.totalEvents).toBe(100);

      await engine.clearAll();
    } catch (error) {
      await engine.clearAll();
      throw error;
    }
  });
});
