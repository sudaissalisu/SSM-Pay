/**
 * Event Tracking Module for Behavioral Analytics
 * Handles user interaction event capture and processing
 *
 * @module ml/behavioral-analytics/events
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import {
  BehaviorEvent,
  EventType,
  DeviceInfo,
  GeoLocation,
  SessionData,
  AnalyticsConfig,
  PageFrequency,
} from './types';

// ============== Event Processing ==============

/**
 * Process a raw event and validate it
 */
export function processEvent(rawEvent: Partial<BehaviorEvent>): BehaviorEvent {
  const timestamp = rawEvent.timestamp || new Date();
  
  if (!rawEvent.userId) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Event must have a userId',
      { event: rawEvent }
    );
  }

  if (!rawEvent.eventType || !isValidEventType(rawEvent.eventType)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid event type: ${rawEvent.eventType}`,
      { eventType: rawEvent.eventType }
    );
  }

  return {
    id: rawEvent.id || generateEventId(),
    userId: rawEvent.userId,
    sessionId: rawEvent.sessionId || generateSessionId(),
    eventType: rawEvent.eventType,
    page: rawEvent.page || '/',
    element: rawEvent.element,
    timestamp,
    metadata: rawEvent.metadata || {},
    deviceInfo: rawEvent.deviceInfo || createDefaultDeviceInfo(),
    geoLocation: rawEvent.geoLocation,
  };
}

/**
 * Validate an event type
 */
export function isValidEventType(type: string): type is EventType {
  const validEvents: string[] = [
    'page_view', 'click', 'scroll', 'form_submit', 'form_start',
    'form_abandon', 'payment_init', 'payment_complete', 'payment_failed',
    'navigation', 'search', 'filter_apply', 'item_select', 'logout',
    'login', 'signup', 'error', 'api_call', 'download', 'share',
    'bookmark', 'feedback_submit'
  ];
  return validEvents.includes(type);
}

/**
 * Generate unique event ID
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate session ID
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create default device info
 */
export function createDefaultDeviceInfo(): DeviceInfo {
  return {
    deviceId: 'unknown',
    deviceType: 'desktop',
    os: 'Unknown',
    browser: 'Unknown',
    screenWidth: 1920,
    screenHeight: 1080,
    userAgent: '',
  };
}

/**
 * Extract page from event
 */
export function extractPage(event: BehaviorEvent): string {
  return event.page || '/';
}

/**
 * Categorize events by type group
 */
export function categorizeEvent(eventType: EventType): 'engagement' | 'conversion' | 'navigation' | 'error' {
  const engagementEvents: EventType[] = ['click', 'scroll', 'search', 'filter_apply', 'item_select'];
  const conversionEvents: EventType[] = ['payment_init', 'payment_complete', 'payment_failed', 'form_submit', 'signup'];
  const navigationEvents: EventType[] = ['page_view', 'navigation', 'download', 'share', 'bookmark'];
  const errorEvents: EventType[] = ['error'];

  if (engagementEvents.includes(eventType)) return 'engagement';
  if (conversionEvents.includes(eventType)) return 'conversion';
  if (navigationEvents.includes(eventType)) return 'navigation';
  if (errorEvents.includes(eventType)) return 'error';
  return 'navigation'; // default
}

/**
 * Calculate event weight for scoring
 */
export function calculateEventWeight(eventType: EventType): number {
  const weights: Record<EventType, number> = {
    page_view: 1,
    click: 2,
    scroll: 0.5,
    form_submit: 8,
    form_start: 3,
    form_abandon: 2,
    payment_init: 15,
    payment_complete: 25,
    payment_failed: 10,
    navigation: 1,
    search: 4,
    filter_apply: 3,
    item_select: 5,
    logout: 2,
    login: 8,
    signup: 12,
    error: -3,
    api_call: 1,
    download: 6,
    share: 7,
    bookmark: 5,
    feedback_submit: 10,
  };

  return weights[eventType] || 1;
}

/**
 * Filter events by time range
 */
export function filterEventsByTimeRange(
  events: BehaviorEvent[],
  startDate: Date,
  endDate: Date
): BehaviorEvent[] {
  return events.filter(e => 
    e.timestamp >= startDate && e.timestamp <= endDate
  );
}

/**
 * Filter events by user
 */
export function filterEventsByUser(
  events: BehaviorEvent[],
  userId: string
): BehaviorEvent[] {
  return events.filter(e => e.userId === userId);
}

/**
 * Aggregate events by page
 */
export function aggregateEventsByPage(events: BehaviorEvent[]): Map<string, number> {
  const pageCounts = new Map<string, number>();
  
  for (const event of events) {
    const page = extractPage(event);
    pageCounts.set(page, (pageCounts.get(page) || 0) + 1);
  }
  
  return pageCounts;
}

/**
 * Get most frequent pages
 */
export function getMostFrequentPages(
  events: BehaviorEvent[],
  limit: number = 10
): PageFrequency[] {
  const pageCounts = aggregateEventsByPage(events);
  
  return Array.from(pageCounts.entries())
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
