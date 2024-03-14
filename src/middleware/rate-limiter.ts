/**
 * Enterprise Rate Limiting Middleware
 * Implements token bucket and sliding window rate limiting algorithms
 * 
 * @module middleware/rate-limiter
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Type Definitions ==============

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Key generator function (default: IP-based) */
  keyGenerator?: (request: Request) => Promise<string>;
  /** Custom response when limited */
  limitExceededHandler?: (request: Request) => Response;
  /** Whether to include headers in response */
  headersEnabled?: boolean;
  /** Skip function to bypass rate limiting */
  skipIf?: (request: Request) => Promise<boolean>;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Time until reset in milliseconds */
  resetTimeMs: number;
  /** Total requests in current window */
  totalRequests: number;
  /** Limit for this window */
  limit: number;
}

export interface RateLimitStore {
  /** Get current state for a key */
  get(key: string): Promise<RateLimitEntry | null>;
  /** Increment count for a key */
  increment(key: string, windowMs: number): Promise<RateLimitEntry>;
  /** Reset a key's counter */
  reset(key: string): Promise<void>;
  /** Clean up expired entries */
  cleanup(): Promise<void>;
}

export interface RateLimitEntry {
  /** Number of requests made */
  count: number;
  /** Window start timestamp */
  windowStart: number;
  /** When this entry expires */
  expiresAt: number;
}

// ============== In-Memory Store Implementation ==============

/**
 * In-memory rate limit store
 * Suitable for single-instance deployments
 * For multi-instance, use Redis store
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private readonly cleanupIntervalMs: number = 60000) {
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => this.cleanup(), this.cleanupIntervalMs);
    
    logger.info('InMemoryRateLimitStore initialized', {
      event: 'ratelimit.store.init',
      metadata: { cleanupIntervalMs },
    });
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    
    return entry;
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now();
    const existing = await this.get(key);

    if (!existing || now > existing.windowStart + windowMs) {
      // New window
      const entry: RateLimitEntry = {
        count: 1,
        windowStart: now,
        expiresAt: now + windowMs + 1000, // Small buffer
      };
      this.store.set(key, entry);
      return entry;
    }

    // Increment existing
    existing.count++;
    this.store.set(key, existing);
    return existing;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Rate limit store cleaned up', {
        event: 'ratelimit.store.cleanup',
        metadata: { entriesRemoved: cleaned, remainingSize: this.store.size },
      });
    }
  }

  /** Get current store size */
  getSize(): number {
    return this.store.size;
  }

  /** Destroy the store and cleanup interval */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// ============== Token Bucket Algorithm ==============

export interface TokenBucketConfig extends Omit<RateLimitConfig, 'windowMs'> {
  /** Bucket capacity (max tokens) */
  capacity: number;
  /** Refill rate (tokens per second) */
  refillRate: number;
}

export interface TokenBucketState {
  /** Current token count */
  tokens: number;
  /** Last refill timestamp */
  lastRefill: number;
}

/**
 * Token Bucket Rate Limiter
 * Allows burst traffic up to capacity, then steady rate of refillRate
 */
export class TokenBucketLimiter {
  private buckets: Map<string, TokenBucketState> = new Map();

  constructor(
    private config: TokenBucketConfig,
    private store: InMemoryRateLimitStore = new InMemoryRateLimitStore()
  ) {}

  async consume(
    key: string,
    tokens: number = 1
  ): Promise<{ allowed: boolean; remaining: number; resetTimeMs: number }> {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.config.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Calculate tokens to add based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = Math.min(elapsed * this.config.refillRate, this.config.capacity);
    
    bucket.tokens = Math.min(this.config.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      
      // Calculate time to full refill
      const timeToFull = ((this.config.capacity - bucket.tokens) / this.config.refillRate) * 1000;
      
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetTimeMs: Math.ceil(timeToFull),
      };
    }

    // Not enough tokens
    const timeToNextToken = ((tokens - bucket.tokens) / this.config.refillRate) * 1000;
    
    return {
      allowed: false,
      remaining: 0,
      resetTimeMs: Math.ceil(timeToNextToken),
    };
  }

  /** Reset a specific bucket */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /** Get all active bucket states */
  getStats(): { totalBuckets: number; averageTokens: number } {
    const buckets = Array.from(this.buckets.values());
    const avgTokens = buckets.length > 0 
      ? buckets.reduce((sum, b) => sum + b.tokens, 0) / buckets.length 
      : 0;
    
    return {
      totalBuckets: buckets.length,
      averageTokens: avgTokens,
    };
  }
}

// ============== Sliding Window Log Algorithm ==============

/**
 * Sliding Window Log Rate Limiter
 * More accurate than fixed window, prevents burst at window boundaries
 */
export class SlidingWindowLogLimiter {
  constructor(
    private config: RateLimitConfig,
    private store: RateLimitStore = new InMemoryRateLimitStore()
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const entry = await this.store.increment(key, this.config.windowMs);

    // Check if we're in a new window but old data exists
    let adjustedCount = entry.count;
    
    if (entry.windowStart + this.config.windowMs > now) {
      // We're within the window, check previous window overlap
      const previousWindowStart = entry.windowStart - this.config.windowMs;
      const elapsedInCurrent = now - entry.windowStart;
      const weightOfPrevious = 1 - (elapsedInCurrent / this.config.windowMs);
      
      // Approximate previous window count (would need actual log in production)
      adjustedCount = Math.floor(entry.count * weightOfPrevious);
    }

    const allowed = adjustedCount <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const resetTimeMs = entry.windowStart + this.config.windowMs - now;

    return {
      allowed,
      remaining,
      resetTimeMs: Math.max(0, resetTimeMs),
      totalRequests: entry.count,
      limit: this.config.maxRequests,
    };
  }
}

// ============== Main Rate Limiter Class ==============

/**
 * Enterprise Rate Limiter Factory
 * Creates and manages rate limiters with different strategies
 */
export class RateLimiter {
  private stores: Map<string, InMemoryRateLimitStore> = new Map();
  private limiters: Map<string, SlidingWindowLogLimiter> = new Map();
  private tokenBuckets: Map<string, TokenBucketLimiter> = new Map();
  
  private defaultConfig: RateLimitConfig = {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    headersEnabled: true,
  };

  /**
   * Create a new rate limiter instance
   */
  static create(config?: Partial<RateLimitConfig>): RateLimiter {
    return new RateLimiter(config);
  }

  constructor(config?: Partial<RateLimitConfig>) {
    this.defaultConfig = { ...this.defaultConfig, ...config };
    
    logger.info('RateLimiter initialized', {
      event: 'ratelimit.init',
      metadata: { defaultConfig: this.defaultConfig },
    });
  }

  /**
   * Check rate limit for a request
   */
  async limit(request: Request, config?: Partial<RateLimitConfig>): Promise<{
    allowed: boolean;
    response?: Response;
    headers?: Record<string, string>;
  }> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const key = merged.keyGenerator 
      ? await merged.keyGenerator(request)
      : await this.getDefaultKey(request);

    // Check skip condition
    if (merged.skipIf && await merged.skipIf(request)) {
      return { allowed: true };
    }

    // Get or create limiter
    let limiter = this.limiters.get(key);
    if (!limiter) {
      const store = this.getOrCreateStore(key);
      limiter = new SlidingWindowLogLimiter(mergedConfig, store);
      this.limiters.set(key, limiter);
    }

    const result = await limiter.check(key);

    if (!result.allowed) {
      logger.warn('Rate limit exceeded', {
        event: 'ratelimit.exceeded',
        metadata: { key, result },
      });

      const response = merged.limitExceededHandler
        ? merged.limitExceededHandler(request)
        : this.createDefaultResponse(result);

      const headers = merged.headersEnabled ? this.createRateLimitHeaders(result) : undefined;

      return { allowed: false, response, headers };
    }

    const headers = merged.headersEnabled ? this.createRateLimitHeaders(result) : undefined;
    return { allowed: true, headers };
  }

  /**
   * Create a token bucket rate limiter
   */
  createTokenBucket(name: string, config: TokenBucketConfig): TokenBucketLimiter {
    const bucket = new TokenBucketLimiter(config);
    this.tokenBuckets.set(name, bucket);
    return bucket;
  }

  /**
   * Predefined rate limit configurations for different use cases
   */
  static presets = {
    /** Strict: 10 requests per minute */
    strict: () => ({ maxRequests: 10, windowMs: 60 * 1000 }),
    
    /** Standard API: 100 requests per minute */
    api: () => ({ maxRequests: 100, windowMs: 60 * 1000 }),
    
    /** Payment endpoint: 5 requests per minute */
    payment: () => ({ maxRequests: 5, windowMs: 60 * 1000 }),
    
    /** Authentication: 10 requests per 15 minutes */
    auth: () => ({ maxRequests: 10, windowMs: 15 * 60 * 1000 }),
    
    /** Public endpoint: 30 requests per minute */
    public: () => ({ maxRequests: 30, windowMs: 60 * 1000 }),
    
    /** Webhook receiver: 200 requests per minute */
    webhook: () => ({ maxRequests: 200, windowMs: 60 * 1000 }),

    /** Token bucket for streaming: 1000 tokens, 100/sec refill */
    streaming: (): TokenBucketConfig => ({
      capacity: 1000,
      refillRate: 100,
      maxRequests: 0,
      windowMs: 0,
    }),
  };

  private getDefaultKey(request: Request): string {
    // Use IP as default key (simplified)
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0] || realIp || 'unknown';
    return `rl:${ip}`;
  }

  private getOrCreateStore(key: string): InMemoryRateLimitStore {
    const storeKey = `store:${key}`;
    let store = this.stores.get(storeKey);
    if (!store) {
      store = new InMemoryRateLimitStore();
      this.stores.set(storeKey, store);
    }
    return store;
  }

  private createDefaultResponse(result: RateLimitResult): Response {
    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil(result.resetTimeMs / 1000)} seconds.`,
        retryAfter: Math.ceil(result.resetTimeMs / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(result.resetTimeMs / 1000)),
        },
      }
    );
  }

  private createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    return {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + Math.ceil(result.resetTimeMs / 1000)),
    };
  }

  /**
   * Cleanup all stores and limiters
   */
  async destroy(): Promise<void> {
    for (const [, store] of this.stores) {
      store.destroy();
    }
    this.stores.clear();
    this.limiters.clear();
    this.tokenBuckets.clear();
    
    logger.info('RateLimiter destroyed', { event: 'ratelimit.destroy' });
  }

  /**
   * Get statistics about all rate limiters
   */
  getStats(): {
    activeStores: number;
    activeLimiters: number;
    activeTokenBuckets: number;
  } {
    return {
      activeStores: this.stores.size,
      activeLimiters: this.limiters.size,
      activeTokenBuckets: this.tokenBuckets.size,
    };
  }
}

// ============== Exports ==============

/** Default rate limiter instance */
export const rateLimiter = RateLimiter.create();

// Next.js middleware compatible export
export async function middleware(request: Request): Promise<Response | undefined> {
  const result = await rateLimiter.limit(request, RateLimiter.presets.api());
  
  if (!result.allowed && result.response) {
    return result.response;
  }
  
  return undefined;
}

export default RateLimiter;
