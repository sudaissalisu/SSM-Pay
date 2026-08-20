/**
 * Circuit Breaker Implementation
 * Prevents cascading failures by failing fast when a service is down
 */

import {
  CircuitState,
  CircuitEventType,
  CircuitEvent,
  CircuitBreakerConfig,
  DEFAULT_CIRCUIT_CONFIG,
} from './types';

/** Circuit breaker state snapshot */
export interface CircuitStateSnapshot {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: string;
  lastSuccessTime?: string;
  nextRetryTime?: string;
  successRate: number;
  stateChangedAt: string;
}

/** Listener for circuit events */
export type CircuitEventListener = (event: CircuitEvent) => void;

/**
 * CircuitBreaker - Implements the circuit breaker pattern for resilience
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private stateChangedAt: Date;
  private nextRetryAt: Date | null = null;
  private listeners: Set<CircuitEventListener> = new Set();
  /** Rolling window of recent results for success rate tracking */
  private recentResults: boolean[] = [];

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
    this.stateChangedAt = new Date();
    console.log(`[Circuit] Created: ${this.config.name}`);
  }

  /**
   * Execute a function through the circuit breaker
   * @param fn - The function to execute
   * @returns Promise resolving to function result or throwing if open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we can execute
    const canExecute = this.canExecute();

    if (!canExecute.allowed) {
      this.emitEvent({
        type: CircuitEventType.SHORT_CIRCUITED,
        state: this.state,
        timestamp: new Date().toISOString(),
      });
      throw new Error(
        `Circuit breaker '${this.config.name}' is ${this.state} - request rejected`
      );
    }

    const startTime = Date.now();

    try {
      const result = await fn();
      const durationMs = Date.now() - startTime;

      this.recordSuccess();
      this.emitEvent({
        type: CircuitEventType.SUCCESS,
        state: this.state,
        timestamp: new Date().toISOString(),
        durationMs,
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      this.recordFailure();
      this.emitEvent({
        type: CircuitEventType.FAILURE,
        state: this.state,
        timestamp: new Date().toISOString(),
        durationMs,
        error: err,
      });

      throw err;
    }
  }

  /**
   * Check if execution is allowed in current state
   */
  canExecute(): { allowed: boolean; reason?: string } {
    switch (this.state) {
      case CircuitState.CLOSED:
        // Check success rate if enabled
        if (this.config.enableSuccessRateTracking && this.shouldTripOnSuccessRate()) {
          this.transitionTo(CircuitState.OPEN);
          return { allowed: false, reason: 'Success rate below threshold' };
        }
        return { allowed: true };

      case CircuitState.OPEN:
        // Check if reset timeout has passed
        if (this.nextRetryAt && new Date() >= this.nextRetryAt) {
          this.transitionTo(CircuitState.HALF_OPEN);
          return { allowed: true };
        }
        return { allowed: false, reason: 'Circuit is open' };

      case CircuitState.HALF_OPEN:
        // Allow limited requests through
        if (this.successCount + this.failureCount < this.config.halfOpenMaxAttempts) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Half-open attempts exhausted' };

      default:
        return { allowed: false, reason: 'Unknown state' };
    }
  }

  /**
   * Record a successful execution
   */
  recordSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = new Date();
    this.recentResults.push(true);

    if (this.state === CircuitState.HALF_OPEN) {
      // In half-open, check if we should close
      const totalAttempts = this.successCount + this.failureCount;
      const successRate = (this.successCount / totalAttempts) * 100;

      if (
        totalAttempts >= this.config.halfOpenMaxAttempts &&
        successRate >= this.config.halfOpenSuccessThreshold
      ) {
        this.transitionTo(CircuitState.CLOSED);
        this.resetCounts();
      }
    }

    this.trimRecentResults();
  }

  /**
   * Record a failed execution
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    this.recentResults.push(false);

    switch (this.state) {
      case CircuitState.CLOSED:
        if (this.failureCount >= this.config.failureThreshold) {
          this.transitionTo(CircuitState.OPEN);
        }
        break;

      case CircuitState.HALF_OPEN:
        // Any failure in half-open opens the circuit again
        this.transitionTo(CircuitState.OPEN);
        break;
    }

    this.trimRecentResults();
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current state snapshot with statistics
   */
  getStateSnapshot(): CircuitStateSnapshot {
    return {
      name: this.config.name,
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      lastFailureTime: this.lastFailureTime?.toISOString(),
      lastSuccessTime: this.lastSuccessTime?.toISOString(),
      nextRetryTime: this.nextRetryAt?.toISOString(),
      successRate: this.calculateSuccessRate(),
      stateChangedAt: this.stateChangedAt.toISOString(),
    };
  }

  /**
   * Manually reset the circuit to closed state
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.resetCounts();
    this.emitEvent({
      type: CircuitEventType.RESET,
      state: CircuitState.CLOSED,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Manually trip (open) the circuit
   */
  trip(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  /**
   * Register event listener
   */
  addEventListener(listener: CircuitEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;

    if (previousState === newState) return;

    this.state = newState;
    this.stateChangedAt = new Date();

    if (newState === CircuitState.OPEN) {
      this.nextRetryAt = new Date(
        Date.now() + this.config.resetTimeoutMs
      );
    } else {
      this.nextRetryAt = null;
    }

    console.log(
      `[Circuit] ${this.config.name}: ${previousState} -> ${newState}`
    );

    this.emitEvent({
      type: CircuitEventType.STATE_CHANGED,
      state: newState,
      previousState,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Reset counters after state change
   */
  private resetCounts(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.recentResults = [];
  }

  /**
   * Calculate current success rate from recent results
   */
  private calculateSuccessRate(): number {
    if (this.recentResults.length === 0) return 100;
    const successes = this.recentResults.filter((r) => r).length;
    return (successes / this.recentResults.length) * 100;
  }

  /**
   * Check if circuit should trip based on success rate
   */
  private shouldTripOnSuccessRate(): boolean {
    if (!this.config.enableSuccessRateTracking) return false;
    if (this.recentResults.length < this.config.minimumVolume) return false;

    return this.calculateSuccessRate() < this.config.minimumSuccessRate;
  }

  /**
   * Trim recent results to window size
   */
  private trimRecentResults(): void {
    // Keep results within time window (approximate)
    const maxResults = Math.ceil(this.config.successRateWindowMs / 1000) * 10; // Rough estimate
    while (this.recentResults.length > maxResults) {
      this.recentResults.shift();
    }
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: CircuitEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('[Circuit] Event listener error:', e);
      }
    }
  }

  /**
   * Get configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }
}
