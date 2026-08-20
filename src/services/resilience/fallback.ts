/**
 * Fallback Handler Implementation
 * Provides graceful degradation when primary operations fail
 */

import {
  FallbackResult,
  FallbackFn,
  FallbackRegistration,
} from './types';

/** Cache entry for cached fallback responses */
interface CacheEntry<T> {
  value: T;
  timestamp: Date;
  ttl: number;
}

/** Fallback provider configuration */
export interface FallbackProviderConfig {
  /** Enable response caching */
  enableCache: boolean;
  /** Default cache TTL in milliseconds */
  defaultCacheTtlMs: number;
  /** Maximum cache entries */
  maxCacheSize: number;
  /** Whether to use fallback on timeout */
  useOnTimeout: boolean;
  /** Whether to use fallback on circuit open */
  useOnCircuitOpen: boolean;
}

/** Default configuration */
const DEFAULT_PROVIDER_CONFIG: FallbackProviderConfig = {
  enableCache: true,
  defaultCacheTtlMs: 60000, // 1 minute
  maxCacheSize: 1000,
  useOnTimeout: true,
  useOnCircuitOpen: true,
};

/**
 * FallbackHandler - Manages fallback functions and execution with graceful degradation
 */
export class FallbackHandler {
  private config: FallbackProviderConfig;
  private fallbacks: Map<string, FallbackRegistration<unknown>[]> = new Map();
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  constructor(config: Partial<FallbackProviderConfig> = {}) {
    this.config = { ...DEFAULT_PROVIDER_CONFIG, ...config };
  }

  /**
   * Register a fallback function for an operation
   * @param operationName - The operation this fallback is for
   * @param fn - The fallback function
   * @param options - Optional priority and settings
   */
  registerFallback<T>(
    operationName: string,
    fn: FallbackFn<T>,
    options: { priority?: number; enabled?: boolean } = {}
  ): void {
    const registration: FallbackRegistration<T> = {
      operationName,
      fn: fn as FallbackFn<unknown>,
      priority: options.priority ?? 10,
      enabled: options.enabled ?? true,
      createdAt: new Date().toISOString(),
    };

    if (!this.fallbacks.has(operationName)) {
      this.fallbacks.set(operationName, []);
    }

    const list = this.fallbacks.get(operationName)!;
    list.push(registration as FallbackRegistration<unknown>);

    // Sort by priority (lower first)
    list.sort((a, b) => a.priority - b.priority);

    console.log(`[Fallback] Registered for '${operationName}' (priority: ${registration.priority})`);
  }

  /**
   * Remove all fallbacks for an operation
   * @param operationName - Operation to clear
   */
  unregisterFallback(operationName: string): void {
    this.fallbacks.delete(operationName);
    // Also clear cache for this operation
    this.clearCache(operationName);
  }

  /**
   * Execute a function with automatic fallback support
   * @param operationName - Operation identifier for finding fallbacks
   * @param fn - Primary function to execute
   * @param context - Context data passed to fallback if needed
   * @returns Promise resolving to result from primary or fallback
   */
  async executeWithFallback<T>(
    operationName: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<FallbackResult<T>> {
    const startTime = Date.now();
    let originalSucceeded = false;
    let fallbackSucceeded = false;

    try {
      // Try primary execution
      const value = await fn();
      originalSucceeded = true;

      return {
        usedFallback: false,
        value,
        meta: {
          originalSucceeded: true,
          fallbackSucceeded: false,
          attempts: 1,
          totalDurationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if we should try fallback
      const shouldUseFallback =
        (this.config.useOnTimeout && err.message.toLowerCase().includes('timeout')) ||
        (this.config.useOnCircuitOpen && err.message.toLowerCase().includes('circuit')) ||
        true; // Default to using fallback

      if (!shouldUseFallback || !this.hasFallback(operationName)) {
        throw error;
      }

      console.warn(`[Fallback] Using fallback for '${operationName}': ${err.message}`);

      // Try fallback(s)
      try {
        const value = await this.executeFallback<T>(operationName, err, context);
        fallbackSucceeded = true;

        // Cache successful fallback result
        if (this.config.enableCache) {
          this.setCache(operationName, value);
        }

        return {
          usedFallback: true,
          value,
          meta: {
            originalSucceeded: false,
            fallbackSucceeded: true,
            attempts: 2,
            totalDurationMs: Date.now() - startTime,
          },
        };
      } catch (fallbackError) {
        // Both failed
        const fbErr = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));

        return {
          usedFallback: false,
          value: undefined,
          error: fbErr,
          meta: {
            originalSucceeded: false,
            fallbackSucceeded: false,
            attempts: 2,
            totalDurationMs: Date.now() - startTime,
          },
        };
      }
    }
  }

  /**
   * Get cached fallback result if available
   * @param operationName - Operation to check cache for
   * @returns Cached value or undefined
   */
  getCachedValue<T>(operationName: string): T | undefined {
    if (!this.config.enableCache) return undefined;

    const entry = this.cache.get(operationName) as CacheEntry<T> | undefined;
    if (!entry) return undefined;

    // Check TTL
    const age = Date.now() - entry.timestamp.getTime();
    if (age > entry.ttl) {
      this.cache.delete(operationName);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a value in the fallback cache
   */
  setCache<T>(operationName: string, value: T, ttlMs?: number): void {
    if (!this.config.enableCache) return;

    // Enforce cache size limit
    if (this.cache.size >= this.config.maxCacheSize) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(operationName, {
      value,
      timestamp: new Date(),
      ttl: ttlMs ?? this.config.defaultCacheTtlMs,
    });
  }

  /**
   * Clear cache for specific operation or all
   */
  clearCache(operationName?: string): void {
    if (operationName) {
      this.cache.delete(operationName);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Check if any fallback is registered for operation
   */
  hasFallback(operationName: string): boolean {
    const fallbacks = this.fallbacks.get(operationName);
    return !!fallbacks && fallbacks.some((f) => f.enabled);
  }

  /**
   * Get registered fallbacks for an operation
   */
  getFallbacks(operationName: string): FallbackRegistration<unknown>[] {
    return this.fallbacks.get(operationName)?.filter((f) => f.enabled) || [];
  }

  /**
   * Execute fallback function(s) in priority order
   */
  private async executeFallback<T>(
    operationName: string,
    error: Error,
    context?: Record<string, unknown>
  ): Promise<T> {
    const fallbacks = this.getFallbacks(operationName);

    if (fallbacks.length === 0) {
      throw new Error(`No fallback registered for '${operationName}'`);
    }

    // Try each fallback in priority order
    for (const registration of fallbacks) {
      try {
        const result = await (registration.fn as FallbackFn<T>)(
          error,
          context || {}
        );
        return result;
      } catch (fallbackError) {
        console.warn(
          `[Fallback] Fallback failed (${registration.operationName}):`,
          fallbackError instanceof Error ? fallbackError.message : fallbackError
        );
        // Continue to next fallback
      }
    }

    throw new Error(`All fallbacks failed for '${operationName}'`);
  }

  /**
   * Get current cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; entries: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Enable or disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.config.enableCache = enabled;
    if (!enabled) {
      this.cache.clear();
    }
  }
}
