/**
 * Enterprise Analytics Service
 * Comprehensive analytics tracking, aggregation, and reporting
 * 
 * @module services/analytics
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import {
  ArrayUtils,
  DateUtils,
  NumberUtils,
  ObjectUtils,
  IdUtils,
} from '@/utils';

// ============== Type Definitions ==============

export interface AnalyticsEvent {
  id: string;
  sessionId: string;
  userId?: string;
  deviceId: string;
  eventType: string;
  eventCategory: string;
  properties: Record<string, unknown>;
  context: EventContext;
  timestamp: Date;
  processed: boolean;
}

export interface EventContext {
  url: string;
  path: string;
  referrer?: string;
  userAgent: string;
  ipAddress: string;
  country?: string;
  city?: string;
  region?: string;
  browser?: string;
  os?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

export interface PageViewEvent extends AnalyticsEvent {
  eventType: 'page_view';
  page: string;
  title: string;
  referrer?: string;
  duration?: number;
  scrollDepth?: number;
}

export interface ClickEvent extends AnalyticsEvent {
  eventType: 'click';
  elementId: string;
  elementType: string;
  elementText?: string;
  page: string;
  href?: string;
}

export interface FormSubmitEvent extends AnalyticsEvent {
  eventType: 'form_submit';
  formId: string;
  formName: string;
  formFields: Record<string, unknown>;
  isValid: boolean;
  submissionTimeMs: number;
}

export interface TransactionEvent extends AnalyticsEvent {
  eventType: 'transaction_initiated' | 'transaction_completed' | 'transaction_failed';
  transactionRef: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  processingTimeMs?: number;
}

export interface SessionEvent extends AnalyticsEvent {
  eventType: 'session_start' | 'session_end';
  sessionId: string;
  duration?: number;
  pageCount?: int;
  eventsTriggered?: int;
  conversionTracked?: boolean;
}

export interface ErrorEvent extends AnalyticsEvent {
  eventType: 'error';
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  errorId?: string;
  fatal: boolean;
  page?: string;
  componentStack?: string;
}

export interface CustomEvent extends AnalyticsEvent {
  eventType: string;
  eventCategory: string;
  // Additional custom properties in properties
}

// ============== Analytics Store ==============

interface AggregatedMetric {
  name: string;
  type: 'count' | 'sum' | 'average' | 'min' | 'max' | 'unique_count';
  value: number;
  dimensions: Record<string, string>;
  timeRange: TimeRange;
}

interface TimeRange {
  start: Date;
  end: Date;
  granularity: 'minute' | 'hour' | 'day' | 'week' | 'month';
}

interface FunnelStage {
  stageName: string;
  count: number;
  percentage: number;
  dropOff: number;
  conversionRate: number;
  averageTimeToConvert: number; // ms
}

interface UserCohort {
  userId: string;
  firstVisit: Date;
  lastVisit: Date;
  visitCount: number;
  sessionCount: number;
  pageViews: number;
  eventsTriggered: number;
  conversionCount: number;
  lifetimeValue: number;
  preferredDevice: string;
  preferredBrowser: string;
  country: string;
  isReturning: boolean;
  churnRisk: 'low' | 'medium' | 'high';
  lastActivityDate: Date;
}

// ============== Main Analytics Class ==============

/**
 * Enterprise Analytics Service
 * 
 * Features:
 * - Event collection and validation
 * - Real-time aggregation
 * - Funnel analysis
 * - Cohort analysis
 * - Session tracking
 * - User journey mapping
 * - Conversion attribution
 * - Custom dashboards
 */
export class AnalyticsService {
  private events: Map<string, AnalyticsEvent[]> = new Map();
  private sessions: Map<string, SessionData> = new Map();
  private users: Map<string, UserData> = new Map();
  
  // In-memory stores for real-time analytics
  private realtimeMetrics: Map<string, MetricPoint[]> = new Map();
  private funnels: Map<string, FunnelData> = new Map();

  constructor(
    private options: {
      flushIntervalMs?: number;
      maxEventsInMemory?: number;
      maxSessionsInMemory?: number;
      enableRealtime?: boolean;
    } = {}
  ) {
    logger.info('AnalyticsService initialized', { event: 'analytics.init' });
    
    // Start periodic flushing if configured
    if (options.flushIntervalMs) {
      setInterval(() => this.flush(), options.flushIntervalMs);
    }
  }

  // ============== Event Collection ==============

  /**
   * Track a page view event
   */
  async trackPageView(data: Omit<PageViewEvent, 'id' | 'timestamp' | 'eventType' | 'processed'>): Promise<string> {
    const event: PageViewEvent = {
      ...data,
      id: IdUtils.shortId(),
      eventType: 'page_view',
      eventCategory: 'engagement',
      timestamp: new Date(),
      processed: false,
    };

    return this.track(event);
  }

  /**
   * Track a click event
   */
  async trackClick(data: Omit<ClickEvent, 'id' | 'timestamp' | 'eventType' | 'processed'>): Promise<string> {
    const event: ClickEvent = {
      ...data,
      id: IdUtils.shortId(),
      'eventType': 'click',
      eventCategory: 'engagement',
      timestamp: new Date(),
      processed: false,
    };

    return this.track(event);
  }

  /**
   * Track a form submission event
   */
  async trackFormSubmit(data: Omit<FormSubmitEvent, 'id' | 'timestamp' | 'eventType' | 'processed'>): Promise<string> {
    const event: FormSubmitEvent = {
      ...data,
      id: IdUtils.shortId(),
      'eventType': 'form_submit',
      eventCategory: 'engagement',
      timestamp: new Date(),
      processed: false,
    };

    return this.track(event);
  }

  /**
   * Track a transaction-related event
   */
  async trackTransaction(data: Omit<TransactionEvent, 'id' | 'timestamp' | 'eventType' | 'processed'>): Promise<string> {
    const event: TransactionEvent = {
      ...data,
      id: IdUtils.shortId(),
      eventType: data.eventType || 'transaction_initiated',
      eventCategory: 'payment',
      timestamp: new Date(),
      processed: false,
    };

    return this.track(event);
  }

  /**
   * Track an error event
   */
  async trackError(data: Omit<ErrorEvent, 'id' | 'timestamp' | 'eventType' | 'processed'>): Promise<string> {
    const event: ErrorEvent = {
      ...data,
      id: IdUtils.shortId(),
      'eventType': 'error',
      eventCategory: 'system',
      timestamp: new Date(),
      processed: false,
    };

    return this.track(event);
  }

  /**
   * Track a custom/event
   */
  async track(data: Omit<CustomEvent, 'id' | 'timestamp' | 'processed'>): Promise<string> {
    const event: CustomEvent = {
      ...data,
      id: IdUtils.shortId(),
      timestamp: new Date(),
      processed: false,
    };

    return this.track(event as AnalyticsEvent);
  }

  /**
   * Generic event tracking method
   */
  async track(event: AnalyticsEvent): Promise<string> {
    try {
      // Validate required fields
      if (!event.sessionId) {
        throw new AppError('sessionId is required for all events', ErrorCode.VALIDATION_ERROR);
      }

      if (!event.deviceId) {
        throw new AppError('deviceId is required for all events', ErrorCode.VALIDATION_ERROR);
      }

      // Enrich context if not provided
      if (!event.context) {
        event.context = this.getDefaultContext();
      }

      // Store event
      const sessionKey = event.sessionId;
      if (!this.events.has(sessionKey)) {
        this.events.set(sessionKey, []);
      }
      
      this.events.get(sessionKey)!.push(event);

      // Update session
      this.updateSession(event);

      // Update user data if userId present
      if (event.userId) {
        this.updateUser(event.userId, event);

        // Update funnel data for transaction events
        if (event.eventCategory === 'payment') {
          this.updateFunnel(event as TransactionEvent);
        }
      }

      // Add to realtime metrics
      this.addToRealtimeMetrics(event);

      event.processed = true;

      logger.debug('Event tracked', {
        event: 'analytics.event.tracked',
        metadata: { eventId: event.id, type: event.eventType },
      });

      return event.id;
    } catch (error) {
      logger.error('Failed to track event', {
        event: 'analytics.error',
        metadata: { error: String(error), eventData: JSON.stringify(data).slice(0, 100) },
      });
      
      throw error;
    }
  }

  // ============== Session Management ==============

  private updateSession(event: AnalyticsEvent): void {
    const sessionKey = event.sessionId;
    
    let session = this.sessions.get(sessionKey);
    
    if (!session) {
      session = {
        sessionId: sessionKey,
        userId: event.userId,
        deviceId: event.deviceId,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        pageViews: 0,
        eventsTriggered: 0,
        conversionTracked: false,
        referrer: event.context?.referrer,
        landingPage: event.context?.path,
        exitPage: event.context?.path,
        entryPage: event.context?.path,
        utmSource: event.context?.utmSource,
        utmMedium: event.context?.utmMedium,
        utmCampaign: event.context?.utmCampaign,
        utmContent: event.context?.utmContent,
        utmTerm: event.context?.utmTerm,
        browser: event.context?.browser,
        os: event.context?.os,
        deviceType: event.context?.deviceType,
        country: event.context?.country,
        ip: event.context?.ipAddress,
        isNewSession: true,
      };
      
      this.sessions.set(sessionKey, session);
    } else {
      session.lastActivityAt = new Date();
      session.pageViews++;
      session.eventsTriggered++;
      session.exitPage = event.context?.path;
      
      if (event.eventType === 'session_end') {
        const duration = Date.now() - session.createdAt.getTime();
        session.duration = duration;
        session.conversionTracked = session.eventsTriggered > 0;
      }
      
      this.sessions.set(sessionKey, session);
    }
  }

  /**
   * Get or create session
   */
  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<void> {
    await this.track({
      eventType: 'session_end',
      sessionId,
      deviceId: '',
      data: {},
    });
  }

  // ============== User Management ==============

  private updateUser(userId: string, event: AnalyticsEvent): void {
    let user = this.users.get(userId);
    
    if (!user) {
      user = {
        userId,
        firstVisit: new Date(),
        lastVisit: new Date(),
        visitCount: 1,
        sessionCount: 1,
        pageViews: 0,
        eventsTriggered: 1,
        conversionCount: 0,
        lifetimeValue: 0,
        preferredDevice: event.context?.deviceType || 'desktop',
        preferredBrowser: event.context?.browser || 'unknown',
        country: event.context?.country || 'NG',
        isReturning: false,
        churnRisk: 'low' as const,
        lastActivityDate: new Date(),
      };
      
      this.users.set(userId, user);
    } else {
      user.lastVisit = new Date();
      user.visitCount++;
      user.sessionCount += event.eventType === 'session_start' ? 1 : 0;
      user.pageViews += event.eventType === 'page_view' ? 1 : 0;
      user.eventsTriggered++;
      user.lifetimeValue += this.calculateLifetimeValue(user);
      user.isReturning = user.visitCount > 1;
      
      // Update device/browser preferences
      if (event.context?.deviceType && event.context.deviceType !== 'unknown') {
        user.preferredDevice = event.context.deviceType;
      }
      if (event.context?.browser && event.context.browser !== 'unknown') {
        user.preferredBrowser = event.context.browser;
      }
      
      // Calculate churn risk
      const daysSinceLastVisit = DateUtils.diffInDays(user.lastVisit, new Date());
      const daysSinceFirstVisit = DateUtils.diffInDays(user.firstVisit, new Date());
      
      if (daysSinceLastVisit > 30 && user.visitCount <= 3) {
        user.churnRisk = 'high';
      } else if (daysSinceLastVisit > 14 && user.visitCount <= 5) {
        user.churnRisk = 'medium';
      } else if (user.churnRisk !== 'high') {
        user.churnRisk = 'low';
      }
      
      user.lastActivityDate = new Date();
      
      this.users.set(userId, user);
    }
  }

  private calculateLifetimeValue(user: UserData): number {
    // Simple LTV calculation based on engagement
    const recencyFactor = Math.max(1, 30 - DateUtils.diffInDays(user.firstVisit, new Date())) / 30;
    const frequencyFactor = Math.min(10, user.visitCount / 10);
    const depthFactor = Math.min(1, user.eventsTriggered / 50);
    const conversionBonus = user.conversionCount > 0 ? 2 : 1;
    
    return recencyFactor * frequencyFactor * depthFactor * conversionBonus;
  }

  getUser(userId: string): UserData | undefined {
    return this.users.get(userId);
  }

  // ============== Funnel Analysis ==============

  private updateFunnel(event: TransactionEvent): void {
    const funnelKey = `${event.eventType}_${event.currency || 'NGN'}`;
    
    let funnel = this.funnels.get(funnelKey);
    
    if (!funnel) {
      funnel = {
        name: event.eventType,
        stages: [
          { stageName: 'initiated', count: 0, percentage: 100, dropOff: 0, conversionRate: 0, averageTimeToConvert: 0 },
          { stageName: 'processing', count: 0, percentage: 0, dropOff: 0, conversionRate: 0, averageTimeToConvert: 0 },
          { stageName: 'completed', count: 0, percentage: 0, dropOff: 0, conversionRate: 0, averageTimeToConvert: 0 },
          { stageName: 'failed', count: 0, percentage: 0, dropOff: 0, conversionRate: 0, averageTimeToConvert: 0 },
        ],
        totalEntries: 0,
        conversions: 0,
        totalRevenue: 0,
        currency: event.currency || 'NGN',
        startDate: new Date(),
        lastUpdated: new Date(),
      };
      
      this.funnels.set(funnelKey, funnel);
      funnel = this.funnels.get(funnelKey)!;
    }

    // Find current stage and increment
    const currentStageIndex = funnel.stages.findIndex(s => s.stageName === event.status);
    
    if (currentStageIndex >= 0) {
      funnel.stages[currentStageIndex].count++;
      funnel.totalEntries++;
      
      if (event.status === 'completed') {
        funnel.conversions++;
        funnel.totalRevenue += event.amount || 0;
      }
    }
    
    funnel.lastUpdated = new Date();
    this.funnels.set(funnelKey, funnel);
  }

  getFunnel(eventType?: string, currency?: string): FunnelData | undefined {
    const key = `${eventType || 'payment'}_${currency || 'NGN'}`;
    return this.funnels.get(key);
  }

  getAllFunnels(): FunnelData[] {
    return Array.from(this.funnels.values());
  }

  // ============== Real-time Metrics ==============

  private addToRealtimeMetrics(event: AnalyticsEvent): void {
    const metricKey = `${event.eventCategory}:${event.eventType}`;
    
    if (!this.realtimeMetrics.has(metricKey)) {
      this.realtimeMetrics.set(metricKey, []);
    }
    
    const point: MetricPoint = {
      timestamp: event.timestamp,
      value: 1, // Count
      tags: {
        eventType: event.eventType,
        category: event.eventCategory,
        userId: event.userId || 'anonymous',
        sessionId: event.sessionId,
        deviceId: event.deviceId,
        country: event.context?.country,
        path: event.context?.path,
      },
    };

    this.realtimeMetrics.get(metricKey)!.push(point);
  }

  /**
   * Get real-time metrics for the last N minutes
   */
  getRealtimeMetrics(
    minutes: number = 60,
    filters?: { eventType?: string; category?: string }
  ): MetricPoint[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const points: MetricPoint[] = [];

    for (const [, points] of this.realtimeMetrics) {
      const recentPoints = points.filter(p => p.timestamp >= cutoff);
      
      if (filters?.eventType) {
        recentPoints = recentPoints.filter(p => p.tags.eventType === filters.eventType);
      }
      if (filters?.category) {
        recentPoints = recentPoints.filter(p => p.tags.category === filters.category);
      }
      
      points.push(...recentPoints);
    }

    return points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(
    startTime: Date,
    endTime: Date,
    granularity: 'minute' | 'hour' | 'day' = 'hour'
  ): AggregatedMetric[] {
    const metrics: AggregatedMetric[] = [];
    
    for (const [, points] of this.realtimeMetrics) {
      const filteredPoints = points.filter(
        p => p.timestamp >= startTime && p.timestamp <= endTime
      );
      
      if (filteredPoints.length === 0) continue;
      
      // Group by time period
      const grouped = this.groupByTimePeriod(filteredPoints, granularity);
      
      for (const [period, periodPoints] of Object.entries(grouped)) {
        metrics.push({
          name: `events_${periodPoints[0].tags.eventType}`,
          type: 'count',
          value: periodPoints.length,
          dimensions: {
            eventType: periodPoints[0].tags.eventType,
            category: periodPoints[0].tags.category,
            period,
          },
          timeRange: { start: startTime, end: endTime },
        });
      }
    }

    return metrics;
  }

  private groupByTimePeriod(
    points: MetricPoint[],
    granularity: 'minute' | 'hour' | 'day'
  ): Map<string, MetricPoint[]> {
    const groups = new Map<string, MetricPoint[]>();
    
    for (const point of points) {
      const key = this.getTimePeriodKey(point.timestamp, granularity);
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      
      groups.get(key)!.push(point);
    }
    
    return groups;
  }

  private getTimePeriodKey(date: Date, granularity: string): string {
    const d = new Date(date);
    
    switch (granularity) {
      case 'minute':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}T${d.getHours().toString().padStart(2, '0')}`;
      case 'hour':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}H${d.getHours().toString().padStart(2, '0')}`;
      case 'day':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      default:
        return date.toISOString();
    }
  }

  // ============== Query Methods ==============

  /**
   * Query events with optional filters
   */
  query(options: {
    eventType?: string | string[];
    eventCategory?: string | string[];
    userId?: string;
    sessionId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): AnalyticsEvent[] {
    let events: AnalyticsEvent[] = [];

    for (const [, sessionEvents] of this.events) {
      let filtered = [...sessionEvents];
      
      if (options.eventType) {
        const types = Array.isArray(options.eventType) ? options.eventType : [options.eventType];
        filtered = filtered.filter(e => types.includes(e.eventType));
      }
      
      if (options.eventCategory) {
        const categories = Array.isArray(options.eventCategory) ? options.eventCategory : [options.eventCategory];
        filtered = filtered.filter(e => categories.includes(e.eventCategory));
      }
      
      if (options.userId) {
        filtered = filtered.filter(e => e.userId === options.userId);
      }
      
      if (options.sessionId) {
        filtered = fitered.filter(e => e.sessionId === options.sessionId);
      }
      
      if (options.startDate) {
        filtered = filtered.filter(e => e.timestamp >= options.startDate);
      }
      
      if (options.endDate) {
        filtered = filtered.filter(e => e.timestamp <= options.endDate);
      }
      
      events.push(...filtered);
    }

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    if (options.offset) {
      events = events.slice(options.offset);
    }
    
    if (options.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  /**
   * Get unique users count
   */
  getUniqueUsers(startDate?: Date, endDate?: Date): number {
    const users = new Set<string>();
    
    for (const [, sessionEvents] of this.events) {
      for (const event of sessionEvents) {
        if (event.userId && startDate && event.timestamp >= startDate) {
          if (!endDate || event.timestamp <= endDate) {
            users.add(event.userId);
          }
        }
      }
    }
    
    return users.size;
  }

  /**
   * Get page views count
   */
  getPageViews(startDate?: Date, endDate?: Date): number {
    let count = 0;
    
    for (const [, sessionEvents] of this.events) {
      for (const event of sessionEvents) {
        if (event.eventType === 'page_view') {
          if (startDate && event.timestamp >= startDate) {
            if (!endDate || event.timestamp <= endDate) {
              count++;
            }
          }
        }
      }
    }
    
    return count;
  }

  /**
   * Get conversion rate
   */
  getConversionRate(startDate?: Date, endDate?: Date): number {
    const totalTransactions = this.query({
      eventType: ['transaction_initiated'],
      startDate,
      endDate,
    }).length;
    
    const completedTransactions = this.query({
      eventType: ['transaction_completed'],
      startDate,
      endDate,
    }).length;
    
    return totalTransactions > 0 ? (completedTransactions / totalTransactions) * 100 : 0;
  }

  /**
   * Get popular pages
   */
  getPopularPages(limit: number = 10): Array<{ page: string; views: number }> {
    const pageCounts = new Map<string, number>();
    
    for (const [, sessionEvents] of this.events) {
      for (const event of sessionEvents) {
        if (event.eventType === 'page_view' && event.context?.path) {
          const page = event.context.path;
          pageCounts.set(page, (pageCounts.get(page) || 0) + 1);
        }
      }
    }
    
    return Array.from(pageCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([page, views]) => ({ page, views }));
  }

  /**
   * Get active sessions count
   */
  getActiveSessions(windowMinutes: number = 30): number {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    let count = 0;
    
    for (const [, session] of this.sessions) {
      if (session.lastActivityAt >= cutoff) {
        count++;
      }
    }
    
    return count;
  }

  // ============== Data Export ==============

  /**
   * Export events to CSV format
   */
  exportToCsv(events?: AnalyticsEvent[]): string {
    const eventsToExport = events || Array.from(this.events.values()).flat();
    
    if (eventsToExport.length === 0) return '';
    
    const headers = [
      'id',
      'sessionId',
      'userId',
      'deviceId',
      'eventType',
      'eventCategory',
      'timestamp',
      'url',
      'path',
      'ipAddress',
      'country',
      'browser',
      'os',
      'deviceType',
      'properties',
    ];
    
    const csvRows = eventsToExport.map(event => [
      event.id,
      event.sessionId,
      event.userId || '',
      event.deviceId,
      event.eventType,
      event.eventCategory,
      event.timestamp.toISOString(),
      event.context?.url || '',
      event.context?.path || '',
      event.context?.ipAddress || '',
      event.context?.country || '',
      event.context?.browser || '',
      event.context?.os || '',
      event.context?.deviceType || '',
      `"${JSON.stringify(event.properties).replace(/"/g, '')}"`,
    ]);
    
    return [headers.join(','), ...csvRows].map(row => row.join(',')).join('\n');
  }

  /**
   * Export events to JSON format
   */
  exportToJson(events?: AnalyticsEvent[]): string {
    const eventsToExport = events || Array.from(this.events.values()).flat();
    return JSON.stringify(eventsToExport, null, 2);
  }

  /**
   * Flush events to persistent storage
   */
  async flush(): Promise<{ eventsFlushed: number; errors: number }> {
    let eventsFlushed = 0;
    let errors = 0;

    for (const [sessionId, events] of this.events) {
      for (const event of events) {
        if (event.processed) continue;

        try {
          // In production, this would send to analytics backend
          // For now, we just mark as processed
          event.processed = true;
          eventsFlushed++;

          // Remove old sessions
          if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId)!;
            const ageInHours = DateUtils.diffInHours(session.createdAt, new Date());
            if (ageInHours > 48) {
              this.sessions.delete(sessionId);
              this.events.delete(sessionId);
            }
          }
        } catch (error) {
          errors++;
          logger.error('Error flushing event', {
            event: 'analytics.flush.error',
            metadata: { eventId: event.id, error: String(error) },
          });
        }
      }
    }

    // Clean up old data periodically
    this.cleanupOldData();

    logger.info('Analytics flushed', {
      event: 'analytics.flush.complete',
      metadata: { eventsFlushed, errors },
    });

    return { eventsFlushed, errors };
  }

  /**
   * Clean up old data from memory
   */
  private cleanupOldData(): void {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    const now = Date.now();
    
    // Clean old sessions
    for (const [sessionId, session] of this.sessions) {
      if (now - session.createdAt.getTime() > maxAge) {
        this.sessions.delete(sessionId);
        this.events.delete(sessionId);
      }
    }
    
    // Clean old users (keep returning users)
    const userMaxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
    for (const [userId, user] of this.users) {
      if (now - user.firstVisit.getTime() > userMaxAge && user.churnRisk === 'high') {
        this.users.delete(userId);
      }
    }
    
    // Keep only last day of realtime metrics
    const metricsMaxAge = 24 * 60 * 60 * 1000;
    for (const [key, points] of this.realtimeMetrics) {
      const oldestPoint = points.reduce((oldest, p) => 
        oldest.timestamp.getTime()
      , points[0]);
      
      if (now - oldestPoint.getTime() > metricsMaxAge) {
        this.realtimeMetrics.delete(key);
      }
    }
  }

  /**
   * Destroy service and cleanup resources
   */
  destroy(): void {
    this.events.clear();
    this.sessions.clear();
    this.users.clear();
    this.realtimeMetrics.clear();
    this.funnels.clear();
    
    logger.info('AnalyticsService destroyed', { event: 'analytics.destroy' });
  }

  // ============== Type Exports ==============

  export interface SessionData {
    sessionId: string;
    userId?: string;
    deviceId: string;
    createdAt: Date;
    lastActivityAt: Date;
    pageViews: number;
    eventsTriggered: number;
    conversionTracked: boolean;
    duration?: number;
    referrer?: string;
    landingPage?: string;
    exitPage?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    browser?: string;
    os?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
    country?: string;
    ip?: string;
    isNewSession: boolean;
  }

  export interface UserData {
    userId: string;
    firstVisit: Date;
    lastVisit: Date;
    visitCount: number;
    sessionCount: number;
    pageViews: number;
    eventsTriggered: number;
    conversionCount: number;
    lifetimeValue: number;
    preferredDevice: string;
    preferredBrowser: string;
    country: string;
    isReturning: boolean;
    churnRisk: 'low' | 'medium' | 'high';
    lastActivityDate: Date;
  }

  export interface MetricPoint {
    timestamp: Date;
    value: number;
    tags: Record<string, string>;
  }

  export interface FunnelData {
    name: string;
    stages: FunnelStage[];
    totalEntries: number;
    conversions: number;
    totalRevenue: number;
    currency: string;
    startDate: Date;
    lastUpdated: Date;
  }

  export interface FunnelStage {
    stageName: string;
    count: number;
    percentage: number;
    dropOff: number;
    conversionRate: number;
    averageTimeToConvert: number;
  }
}

// ============== Singleton Instance ==============

/** Default analytics instance */
export const analyticsService = new AnalyticsService();

export default AnalyticsService;
