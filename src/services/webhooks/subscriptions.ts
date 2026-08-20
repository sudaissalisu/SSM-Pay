/**
 * Webhook Subscription Management
 * Manages webhook endpoint subscriptions and event routing
 */

import {
  WebhookEventType,
  WebhookSubscription,
  WebhookEvent,
  DEFAULT_RETRY_POLICY,
} from './types';
import { generateWebhookSecret, maskSecret } from './signature';

/** In-memory subscription store */
interface SubscriptionStore {
  [id: string]: WebhookSubscription;
}

/**
 * Options for creating a new subscription
 */
export interface CreateSubscriptionOptions {
  /** Endpoint URL to receive webhooks */
  url: string;
  /** Event types to subscribe to (empty = all) */
  events?: WebhookEventType[];
  /** Optional description */
  description?: string;
  /** Custom retry policy */
  retryPolicy?: Partial<import('./types').RetryPolicy>;
  /** HTTP method to use */
  httpMethod?: 'POST' | 'PUT' | 'PATCH';
  /** Additional headers */
  headers?: Record<string, string>;
  /** API version expected */
  apiVersion?: string;
  /** Provide existing secret or auto-generate */
  secret?: string;
}

/**
 * Result of subscription creation
 */
export interface SubscriptionResult {
  success: boolean;
  subscription?: WebhookSubscription;
  error?: string;
}

/**
 * WebhookSubscriptionManager handles CRUD operations for webhook subscriptions
 */
export class WebhookSubscriptionManager {
  private store: SubscriptionStore = {};
  private idCounter: number = 0;

  /**
   * Create a new webhook subscription
   * @param options - Subscription configuration options
   * @returns Promise resolving to subscription result
   */
  async subscribe(options: CreateSubscriptionOptions): Promise<SubscriptionResult> {
    // Validate URL
    if (!this.isValidUrl(options.url)) {
      return { success: false, error: 'Invalid URL format' };
    }

    // Check for duplicate URLs
    const existingSubscription = Object.values(this.store).find(
      (sub) => sub.url === options.url && sub.active
    );
    if (existingSubscription) {
      return { success: false, error: 'Subscription already exists for this URL' };
    }

    // Generate ID and secret
    const id = this.generateId();
    const secret = options.secret || generateWebhookSecret();
    const now = new Date().toISOString();

    // Build retry policy with defaults
    const retryPolicy = { ...DEFAULT_RETRY_POLICY, ...options.retryPolicy };

    const subscription: WebhookSubscription = {
      id,
      url: options.url,
      events: options.events || Object.values(WebhookEventType),
      secret,
      active: true,
      createdAt: now,
      updatedAt: now,
      description: options.description,
      httpMethod: options.httpMethod || 'POST',
      headers: options.headers || {},
      retryPolicy,
      apiVersion: options.apiVersion || '2024-01-01',
    };

    this.store[id] = subscription;

    console.log(`[Subscription] Created ${id} for ${options.url} (${maskSecret(secret)})`);

    return { success: true, subscription: { ...subscription } };
  }

  /**
   * Remove an existing subscription
   * @param subscriptionId - ID of subscription to remove
   * @returns Promise resolving to operation result
   */
  async unsubscribe(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
    const subscription = this.store[subscriptionId];

    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    // Soft delete by deactivating
    subscription.active = false;
    subscription.updatedAt = new Date().toISOString();

    console.log(`[Subscription] Deactivated ${subscriptionId}`);

    return { success: true };
  }

  /**
   * Permanently delete a subscription
   * @param subscriptionId - ID to delete
   * @returns Operation result
   */
  async deleteSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.store[subscriptionId]) {
      return { success: false, error: 'Subscription not found' };
    }

    delete this.store[subscriptionId];

    return { success: true };
  }

  /**
   * Get a single subscription by ID
   * @param id - Subscription ID
   * @returns Subscription or undefined
   */
  getSubscription(id: string): WebhookSubscription | undefined {
    return this.store[id];
  }

  /**
   * List all subscriptions with optional filtering
   * @param options - Filter options
   * @returns Array of matching subscriptions
   */
  listSubscriptions(options?: {
    activeOnly?: boolean;
    eventType?: WebhookEventType;
  }): WebhookSubscription[] {
    let results = Object.values(this.store);

    if (options?.activeOnly) {
      results = results.filter((sub) => sub.active);
    }

    if (options?.eventType) {
      results = results.filter((sub) =>
        sub.events.includes(options.eventType!)
      );
    }

    return results.map((sub) => ({ ...sub }));
  }

  /**
   * Update an existing subscription
   * @param id - Subscription ID
   * @param updates - Fields to update
   * @returns Updated subscription or error
   */
  async updateSubscription(
    id: string,
    updates: Partial<Pick<WebhookSubscription, 'url' | 'events' | 'description' | 'active' | 'headers'>>
  ): Promise<{ success: boolean; subscription?: WebhookSubscription; error?: string }> {
    const subscription = this.store[id];

    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    // Apply updates
    Object.assign(subscription, updates, { updatedAt: new Date().toISOString() });

    // Re-validate URL if updated
    if (updates.url && !this.isValidUrl(updates.url)) {
      return { success: false, error: 'Invalid URL format' };
    }

    return { success: true, subscription: { ...subscription } };
  }

  /**
   * Rotate the signing secret for a subscription
   * @param id - Subscription ID
   * @returns New secret (only shown once)
   */
  async rotateSecret(id: string): Promise<{ success: boolean; secret?: string; error?: string }> {
    const subscription = this.store[id];

    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    const newSecret = generateWebhookSecret();
    subscription.secret = newSecret;
    subscription.updatedAt = new Date().toISOString();

    console.log(`[Subscription] Rotated secret for ${id}`);

    return { success: true, secret: newSecret };
  }

  /**
   * Find all subscriptions that should receive a given event
   * @param event - The event to match against
   * @returns Array of matching active subscriptions
   */
  matchEventToSubscriptions(event: WebhookEvent): WebhookSubscription[] {
    return Object.values(this.store).filter(
      (sub) =>
        sub.active &&
        sub.events.includes(event.type as WebhookEventType)
    );
  }

  /**
   * Get count of active subscriptions
   */
  getActiveCount(): number {
    return Object.values(this.store).filter((sub) => sub.active).length;
  }

  /**
   * Get total count of all subscriptions
   */
  getTotalCount(): number {
    return Object.keys(this.store).length;
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Generate unique subscription ID
   */
  private generateId(): string {
    this.idCounter += 1;
    return `sub_${Date.now()}_${this.idCounter.toString(36)}`;
  }
}
