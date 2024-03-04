/**
 * Enterprise Caching Layer
 * Multi-tier caching with TTL, invalidation, and statistics
 * 
 * @module services/cache
 */

import { logger } from '@/lib/logger';

// ============== Type Definitions ==============

export interface CacheOptions<T> {
  /** Cache key */
  key: string;
  /** Value to cache */
  value: T;
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttl?: number;
  /** Tags for group invalidation */
  tags?: string[];
  /** Priority for eviction (1-10, higher = less likely to evict) */
  priority?: number;
}

export interface CacheEntry<T> {
  /** Cached value */
  value: T;
  /** When this entry was created */
  createdAt: number;
  /** When this entry expires */
  expiresAt: number;
  /** Tags for group invalidation */
  tags: string[];
  /** Access count for LRU tracking */
  accessCount: number;
  /** Last access time */
  lastAccessedAt: number;
  /** Priority score */
  priority: number;
  /** Size in bytes (approximate) */
  sizeBytes: number;
}

export interface CacheStats {
  /** Total entries in cache */
  size: number;
  /** Total memory usage in bytes */
  memoryUsage: number;
  /** Maximum memory limit */
  maxMemory: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Total hits */
  hits: number;
  /** Total misses */
  misses: number;
  /** Evictions count */
  evictions: number;
  /** Average entry lifetime in ms */
  avgLifetimeMs: number;
}

export interface CacheConfig {
  /** Default TTL in milliseconds */
  defaultTtlMs: number;
  /** Maximum cache size in bytes */
  maxSizeBytes: number;
  /** Maximum number of entries */
  maxEntries: number;
  /** Cleanup interval in milliseconds */
  cleanupIntervalMs: number;
  /** Whether to track statistics */
  enableStats: boolean;
  /** Enable compression for large values */
  compressLargeValues: boolean;
  /** Size threshold for compression (bytes) */
  compressionThreshold: number;
}

// ============== Cache Implementation ==============

/**
 * Enterprise In-Memory Cache
 * Features:
 * - TTL-based expiration
 * - LRU eviction policy
 * - Tag-based invalidation
 * - Memory management
 * - Statistics tracking
 * - Compression support
 */
export class Cache<T = unknown> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private indexByTag: Map<string, Set<string>> = new Map();
  
  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalLifetime: 0,
    entriesEvicted: 0,
  };
  
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private config: Required<CacheConfig>;

  static readonly DEFAULT_CONFIG: Required<CacheConfig> = {
    defaultTtlMs: 5 * 60 * 1000, // 5 minutes
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    maxEntries: 10000,
    cleanupIntervalMs: 60 * 1000, // 1 minute
    enableStats: true,
    compressLargeValues: false,
    compressionThreshold: 1024, // 1KB
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...Cache.DEFAULT_CONFIG, ...config };
    
    // Start cleanup interval
    this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupIntervalMs);
    
    // Don't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }

    logger.info('Cache initialized', {
      event: 'cache.init',
      metadata: { config: this.config },
    });
  }

  /**
   * Get a value from cache
   */
  async get(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access metadata
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    this.stats.hits++;

    logger.debug('Cache hit', {
      event: 'cache.hit',
      metadata: { key, accessCount: entry.accessCount },
    });

    return entry.value;
  }

  /**
   * Set a value in cache
   */
  async set(options: CacheOptions<T>): Promise<void> {
    const now = Date.now();
    const ttl = options.ttl ?? this.config.defaultTtlMs;
    const sizeBytes = this.estimateSize(options.value);

    // Check if we need to make room
    await this.ensureSpace(sizeBytes);

    const entry: CacheEntry<T> = {
      value: options.value,
      createdAt: now,
      expiresAt: now + ttl,
      tags: options.tags ?? [],
      accessCount: 0,
      lastAccessedAt: now,
      priority: options.priority ?? 5,
      sizeBytes,
    };

    // Delete existing entry if present
    if (this.store.has(key)) {
      this.deleteInternal(key);
    }

    // Store the entry
    this.store.set(key, entry);

    // Update tag index
    for (const tag of entry.tags) {
      if (!this.indexByTag.has(tag)) {
        this.indexByTag.set(tag, new Set());
      }
      this.indexByTag.get(tag)!.add(key);
    }

    logger.debug('Cache set', {
      event: 'cache.set',
      metadata: { key, ttl, tags: options.tags, sizeBytes },
    });
  }

  /**
   * Check if a key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key
   */
  async delete(key: string): Promise<boolean> {
    const existed = this.store.has(key);
    if (existed) {
      this.deleteInternal(key);
      logger.debug('Cache delete', { event: 'cache.delete', metadata: { key } });
    }
    return existed;
  }

  /**
   * Invalidate all entries with matching tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0;

    for (const tag of tags) {
      const keys = this.indexByTag.get(tag);
      if (keys) {
        for (const key of keys) {
          if (this.store.has(key)) {
            this.deleteInternal(key);
            invalidated++;
          }
        }
        this.indexByTag.delete(tag);
      }
    }

    logger.info('Cache invalidation by tags', {
      event: 'cache.invalidate.tags',
      metadata: { tags, count: invalidated },
    });

    return invalidated;
  }

  /**
   * Get or set pattern - returns cached value or computes and caches it
   */
  async getOrSet(
    key: string,
    factory: () => T | Promise<T>,
    options?: Omit<CacheOptions<T>, 'key' | 'value'>
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set({ ...options, key, value });
    return value;
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    const size = this.store.size;
    this.store.clear();
    this.indexByTag.clear();

    logger.info('Cache cleared', {
      event: 'cache.clear',
      metadata: { entriesRemoved: size },
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    
    let currentMemoryUsage = 0;
    for (const [, entry] of this.store) {
      currentMemoryUsage += entry.sizeBytes;
    }

    const avgLifetime = this.stats.entriesEvicted > 0 
      ? this.stats.totalLifetime / this.stats.entriesEvicted 
      : 0;

    return {
      size: this.store.size,
      memoryUsage: currentMemoryUsage,
      maxMemory: this.config.maxSizeBytes,
      hitRate,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      avgLifetimeMs: avgLifetime,
    };
  }

  /**
   * Force cleanup of expired entries
   */
  async cleanup(): Promise<{ expired: number; evicted: number }> {
    const now = Date.now();
    let expired = 0;
    let evicted = 0;

    // Remove expired entries
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.stats.totalLifetime += now - entry.createdAt;
        this.stats.entriesEvicted++;
        this.deleteInternal(key);
        expired++;
      }
    }

    // Evict if over memory/entry limit
    while (this.isOverLimit()) {
      const evictedKey = this.findEvictionCandidate();
      if (evictedKey) {
        this.stats.totalLifetime += now - this.store.get(evictedKey)!.createdAt;
        this.stats.entriesEvicted++;
        this.deleteInternal(evictedKey);
        this.stats.evictions++;
        evicted++;
      } else {
        break;
      }
    }

    if (expired > 0 || evicted > 0) {
      logger.debug('Cache cleanup complete', {
        event: 'cache.cleanup',
        metadata: { expired, evicted, remaining: this.store.size },
      });
    }

    return { expired, evicted };
  }

  /**
   * Destroy the cache instance
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
    this.indexByTag.clear();

    logger.info('Cache destroyed', { event: 'cache.destroy' });
  }

  // ============== Private Methods ==============

  private deleteInternal(key: string): void {
    const entry = this.store.get(key);
    if (entry) {
      // Remove from tag index
      for (const tag of entry.tags) {
        const keys = this.indexByTag.get(tag);
        if (keys) {
          keys.delete(key);
          if (keys.size === 0) {
            this.indexByTag.delete(tag);
          }
        }
      }
    }
    this.store.delete(key);
  }

  private isOverLimit(): boolean {
    if (this.store.size >= this.config.maxEntries) return true;
    
    let totalMemory = 0;
    for (const [, entry] of this.store) {
      totalMemory += entry.sizeBytes;
    }
    return totalMemory >= this.config.maxSizeBytes;
  }

  private findEvictionCandidate(): string | null {
    let candidate: string | null = null;
    let lowestScore = Infinity;

    for (const [key, entry] of this.store.entries()) {
      // Score based on: recency, frequency, priority
      const age = Date.now() - entry.lastAccessedAt;
      const score = (entry.priority * 10) + (entry.accessCount / (age + 1)) - age / 1000;
      
      if (score < lowestScore) {
        lowestScore = score;
        candidate = key;
      }
    }

    return candidate;
  }

  private async ensureSpace(requiredBytes: number): Promise<void> {
    // Check current usage
    let currentMemory = 0;
    for (const [, entry] of this.store) {
      currentMemory += entry.sizeBytes;
    }

    const availableSpace = this.config.maxSizeBytes - currentMemory;
    const availableEntries = this.config.maxEntries - this.store.size;

    if (availableSpace >= requiredBytes && availableEntries > 0) {
      return; // Enough space
    }

    // Need to evict
    const iterations = Math.ceil(requiredBytes / 1024); // Estimate iterations needed
    
    for (let i = 0; i < iterations; i++) {
      if (!this.isOverLimit()) break;
      
      const key = this.findEvictionCandidate();
      if (key) {
        this.stats.evictions++;
        this.deleteInternal(key);
      } else {
        break;
      }
    }
  }

  private estimateSize(value: unknown): number {
    try {
      const str = JSON.stringify(value);
      return new Blob([str]).size;
    } catch {
      return 1024; // Default estimate
    }
  }
}

// ============== Specialized Caches ==============

/** Response cache for API responses */
export class ResponseCache extends Cache<ResponseData> {}

export interface ResponseData {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  cachedAt: Date;
}

/** Session cache for user sessions */
export class SessionCache extends Cache<SessionData> {}

export interface SessionData {
  userId: string;
  sessionId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  expiresAt: Date;
}

/** Rate limit state cache */
export class RateLimitCache extends Cache<RateLimitState> {}

export interface RateLimitState {
  count: number;
  windowStart: number;
  resetAt: number;
}

// ============== Singleton Instances ==============

/** Default application cache */
export const appCache = new Cache({ 
  defaultTtlMs: 10 * 60 * 1000, // 10 minutes
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
});

/** Short-lived cache for frequently changing data */
export const shortTermCache = new Cache({
  defaultTtlMs: 60 * 1000, // 1 minute
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
});

/** Long-lived cache for rarely changing data */
export const longTermCache = new Cache({
  defaultTtlMs: 60 * 60 * 1000, // 1 hour
  maxSizeBytes: 20 * 1024 * 1024, // 20MB
});

// ============== Decorators & Utilities ==============

/**
 * Cache decorator for memoizing function results
 */
export function Cached(
  ttlMs?: number,
  tags?: string[]
) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cache = appCache;

    descriptor.value = async function (...args: unknown[]) {
      const key = `${target?.constructor?.name || 'unknown'}:${propertyKey}:${JSON.stringify(args)}`;
      
      return cache.getOrSet(key, () => originalMethod.apply(this, args), { ttl: ttlMs, tags });
    };

    return descriptor;
  };
}

/**
 * Invalidate cache by tags after method execution
 */
export function InvalidateCache(tags: string[]) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cache = appCache;

    descriptor.value = async function (...args: unknown[]) {
      const result = await originalMethod.apply(this, args);
      await cache.invalidateByTags(tags);
      return result;
    };

    return descriptor;
  };
}

export default Cache;
