/**
 * Webhook Subscription Management Module
 * 
 * Handles event subscription CRUD operations, pattern matching,
 * and event filtering for selective webhook delivery.
 * 
 * @module services/webhooks/subscriptions
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import { WebhookEvent, every } from './signature';
import { WebhookEndpoint } from './delivery';

// ============== Type Definitions ==============

/**
 * Event subscription configuration
 */
export interface EventSubscription {
  /** Subscription ID */
  id: string;
  /** Subscriber/owner identifier */
  subscriberId: string;
  /** Event pattern (supports wildcards) */
  eventPattern: string;
  /** Endpoint IDs to receive events */
  endpointIds: string[];
  /** Filter criteria for selective processing */
  filters?: EventFilter[];
  /** Whether subscription is active */
  isActive: boolean;
  /** Created at timestamp */
  createdAt: Date;
  /** Optional expiration date */
  expiresAt?: Date;
  /** Rate limit (events per minute) */
  rateLimitPerMinute?: number;
  /** Processing options */
  options: SubscriptionOptions;
}

/**
 * Event filter for conditional processing
 */
export interface EventFilter {
  /** Field path to filter on (dot notation supported) */
  field: string;
  /** Comparison operator */
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'regex';
  /** Value to compare against */
  value: unknown;
}

/**
 * Subscription processing options
 */
export interface SubscriptionOptions {
  /** Include raw payload in delivery */
  includeRawPayload: boolean;
  /** Include metadata headers */
  includeMetadata: boolean;
  /** Timeout in milliseconds for delivery acknowledgment */
  timeoutMs: number;
  /** Whether to verify SSL certificates */
  verifySsl: boolean;
  /** Custom headers to include */
  customHeaders?: Record<string, string>;
}

// ============== Default Options ==============

/** Default subscription options */
export const DEFAULT_SUBSCRIPTION_OPTIONS: SubscriptionOptions = {
  includeRawPayload: true,
  includeMetadata: true,
  timeoutMs: 30000,
  verifySsl: true,
};

// ============== Subscription Manager Class ==============

/**
 * Webhook Subscription Manager
 * 
 * Manages event subscriptions including creation, updates,
 * deletion, and event routing based on subscription patterns.
 */
export class WebhookSubscriptionManager {
  /** Active subscriptions storage */
  private subscriptions: Map<string, EventSubscription> = new Map();

  /**
   * Create a new event subscription
   * 
   * @param config - Subscription configuration
   * @param endpoints - Map of available endpoints for validation
   * @returns Created subscription
   */
  createSubscription(
    config: {
      subscriberId: string;
      eventPattern: string;
      endpointIds: string[];
      filters?: EventFilter[];
      rateLimitPerMinute?: number;
      expiresAt?: Date;
      options?: Partial<SubscriptionOptions>;
    },
    endpoints: Map<string, WebhookEndpoint>
  ): EventSubscription {
    // Validate endpoints exist
    for (const endpointId of config.endpointIds) {
      if (!endpoints.has(endpointId)) {
        throw new AppError(
          `Endpoint not found: ${endpointId}`,
          ErrorCode.NOT_FOUND,
          { context: { endpointId } }
        ) as AppError & { code: ErrorCode.NOT_FOUND };
      }
    }

    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(0, 8)}`;

    const subscription: EventSubscription = {
      id: subscriptionId,
      subscriberId: config.subscriberId,
      eventPattern: config.eventPattern,
      endpointIds: config.endpointIds,
      filters: config.filters,
      isActive: true,
      createdAt: new Date(),
      expiresAt: config.expiresAt,
      rateLimitPerMinute: config.rateLimitPerMinute,
      options: {
        ...DEFAULT_SUBSCRIPTION_OPTIONS,
        ...config.options,
      },
    };

    this.subscriptions.set(subscriptionId, subscription);

    logger.info('Event subscription created', {
      event: 'webhook.subscription.created',
      metadata: {
        subscriptionId,
        subscriberId: config.subscriberId,
        eventPattern: config.eventPattern,
        endpointCount: config.endpointIds.length,
      },
    });

    return subscription;
  }

  /**
   * Update an existing subscription
   * 
   * @param subscriptionId - Subscription ID
   * @param updates - Fields to update
   * @returns Updated subscription
   */
  updateSubscription(
    subscriptionId: string,
    updates: Partial<{
      eventPattern: string;
      endpointIds: string[];
      filters: EventFilter[];
      isActive: boolean;
      rateLimitPerMinute: number;
      options: Partial<SubscriptionOptions>;
      expiresAt: Date;
    }>
  ): EventSubscription {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription) {
      throw new AppError(
        `Subscription not found: ${subscriptionId}`,
        ErrorCode.NOT_FOUND,
        { context: { subscriptionId } }
      ) as AppError & { code: ErrorCode.NOT_FOUND };
    }

    Object.assign(subscription, updates);
    this.subscriptions.set(subscriptionId, subscription);

    logger.info('Event subscription updated', {
      event: 'webhook.subscription.updated',
      metadata: { subscriptionId, updatedFields: Object.keys(updates) },
    });

    return subscription;
  }

  /**
   * Remove a subscription
   * 
   * @param subscriptionId - Subscription ID
   * @returns True if removed
   */
  removeSubscription(subscriptionId: string): boolean {
    const result = this.subscriptions.delete(subscriptionId);
    
    if (result) {
      logger.info('Event subscription removed', {
        event: 'webhook.subscription.removed',
        metadata: { subscriptionId },
      });
    }

    return result;
  }

  /**
   * Get a subscription by ID
   * 
   * @param subscriptionId - Subscription ID
   * @returns Subscription or undefined
   */
  getSubscription(subscriptionId: string): EventSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Get all subscriptions
   * 
   * @returns Array of all subscriptions
   */
  getAllSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get subscriptions for an event type
   * 
   * @param eventType - Event type to match
   * @returns Matching subscriptions
   */
  getSubscriptionsForEvent(eventType: string): EventSubscription[] {
    const matching: EventSubscription[] = [];

    for (const sub of this.subscriptions.values()) {
      if (!sub.isActive) continue;
      
      // Check expiration
      if (sub.expiresAt && sub.expiresAt < new Date()) continue;

      if (this.matchEventPattern(eventType, sub.eventPattern)) {
        matching.push(sub);
      }
    }

    return matching;
  }

  /**
   * Match event type against a pattern (supports wildcards)
   * 
   * @param eventType - Actual event type
   * @param pattern - Pattern to match against
   * @returns True if matches
   */
  matchEventPattern(eventType: string, pattern: string): boolean {
    // Exact match
    if (eventType === pattern) return true;

    // Wildcard: payment.* matches payment.completed, payment.failed, etc.
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1); // Remove *
      // Support both "event.*" and "event*" patterns
      if (pattern.endsWith('.*')) {
        return eventType.startsWith(prefix);
      }
      return eventType.startsWith(prefix);
    }

    // Regex pattern support
    if (pattern.startsWith('^') || pattern.endsWith('$')) {
      try {
        const regex = new RegExp(pattern);
        return regex.test(eventType);
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Apply event filters to data
   * 
   * @param data - Event data
   * @param filters - Filters to apply
   * @returns True if passes all filters
   */
  applyFilters(data: Record<string, unknown>, filters: EventFilter[]): boolean {
    return every(filter => {
      const value = this.getNestedValue(data, filter.field);
      return this.compareValues(value, filter.operator, filter.value);
    }, filters);
  }

  /**
   * Get nested value from object using dot notation
   * 
   * @param obj - Source object
   * @param path - Dot-notation path
   * @returns Value at path
   */
  getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' 
        ? (current as Record<string, unknown>)[key] 
        : undefined;
    }, obj as unknown);
  }

  /**
   * Compare values using operator
   * 
   * @param actual - Actual value
   * @param operator - Comparison operator
   * @param expected - Expected value
   * @returns Comparison result
   */
  compareValues(actual: unknown, operator: EventFilter['operator'], expected: unknown): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;
      case 'ne':
        return actual !== expected;
      case 'gt':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
      case 'gte':
        return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
      case 'lt':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
      case 'lte':
        return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'contains':
        return typeof actual === 'string' && typeof expected === 'string' && 
               actual.includes(expected);
      case 'regex':
        return typeof actual === 'string' && typeof expected === 'string' &&
               new RegExp(expected).test(actual);
      default:
        return false;
    }
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
  }

  /**
   * Get count of active subscriptions
   */
  getCount(): number {
    return Array.from(this.subscriptions.values()).filter(s => s.isActive).length;
  }
}
