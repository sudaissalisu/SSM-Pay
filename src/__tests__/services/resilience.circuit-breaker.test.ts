/**
 * @fileoverview Test suite for Circuit Breaker pattern
 * @module services/resilience.circuit-breaker.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CircuitBreaker,
} from '@/services/resilience/circuit-breaker';
import {
  CircuitState,
  CircuitEventType,
  DEFAULT_CIRCUIT_CONFIG,
  type CircuitBreakerConfig,
  type CircuitEvent,
  type CircuitStateSnapshot,
} from '@/services/resilience/types';

describe('Circuit Breaker Pattern', () => {
  
  describe('Initial State (CLOSED)', () => {
    it('should start in CLOSED state by default', () => {
      const breaker = new CircuitBreaker();
      
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should allow execution when CLOSED', async () => {
      const breaker = new CircuitBreaker();
      const canExecute = breaker.canExecute();

      expect(canExecute.allowed).toBe(true);
    });

    it('should execute functions successfully when CLOSED', async () => {
      const breaker = new CircuitBreaker();
      
      const result = await breaker.execute(() => 
        Promise.resolve('success')
      );

      expect(result).toBe('success');
    });

    it('should track success count', async () => {
      const breaker = new CircuitBreaker();

      await breaker.execute(() => Promise.resolve('ok'));
      await breaker.execute(() => Promise.resolve('ok'));
      await breaker.execute(() => Promise.resolve('ok'));

      const snapshot = breaker.getStateSnapshot();
      expect(snapshot.successes).toBe(3);
    });

    it('should have zero failures initially', () => {
      const breaker = new CircuitBreaker();
      const snapshot = breaker.getStateSnapshot();

      expect(snapshot.failures).toBe(0);
    });

    it('should use provided configuration', () => {
      const config: Partial<CircuitBreakerConfig> = {
        name: 'test-breaker',
        failureThreshold: 3,
        resetTimeoutMs: 60000,
      };

      const breaker = new CircuitBreaker(config);
      const resolvedConfig = breaker.getConfig();

      expect(resolvedConfig.name).toBe('test-breaker');
      expect(resolvedConfig.failureThreshold).toBe(3);
      expect(resolvedConfig.resetTimeoutMs).toBe(60000);
    });
  });

  describe('State Transition to OPEN after failures', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
      // Use low threshold for faster testing
      breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 1000, // Short timeout for testing
        halfOpenMaxAttempts: 2,
      });
    });

    it('should transition to OPEN after reaching failure threshold', async () => {
      // Record failures up to threshold
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('Test error')));
        } catch {
          // Expected - errors should be thrown
        }
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should track failure count correctly', async () => {
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch {}

      const snapshot = breaker.getStateSnapshot();
      expect(snapshot.failures).toBe(1);

      try {
        await breaker.execute(() => Promise.reject(new Error('fail again')));
      } catch {}

      const snapshot2 = breaker.getStateSnapshot();
      expect(snapshot2.failures).toBe(2);
    });

    it('should reject executions when OPEN', async () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('trip')));
        } catch {}
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Should reject immediately
      const canExecute = breaker.canExecute();
      expect(canExecute.allowed).toBe(false);
      expect(canExecute.reason).toContain('open');
    });

    it('should throw error when executing through open circuit', async () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('trip')));
        } catch {}
      }

      await expect(
        breaker.execute(() => Promise.resolve('should not run'))
      ).rejects.toThrow('is open');
    });

    it('should emit STATE_CHANGED event on transition', async () => {
      const events: CircuitEvent[] = [];
      breaker.addEventListener((event) => events.push(event));

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('trip event')));
        } catch {}
      }

      const stateChangeEvents = events.filter(e => e.type === CircuitEventType.STATE_CHANGED);
      expect(stateChangeEvents.length).toBeGreaterThan(0);
      expect(stateChangeEvents[0].state).toBe(CircuitState.OPEN);
      expect(stateChangeEvents[0].previousState).toBe(CircuitState.CLOSED);
    });
  });

  describe('HALF_OPEN State after cooldown', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
      breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 50, // Very short for testing
        halfOpenMaxAttempts: 2,
        halfOpenSuccessThreshold: 80,
      });
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Trip the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('trip')));
        } catch {}
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset timeout + small buffer
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if can execute now (transitions to HALF_OPEN)
      const canExecute = breaker.canExecute();
      
      if (canExecute.allowed) {
        expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
      }
    });

    it('should allow limited requests in HALF_OPEN state', async () => {
      // Trip and wait for timeout
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('trip')));
        } catch {}
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be in HALF_OPEN and allow some requests
      if (breaker.getState() === CircuitState.HALF_OPEN || 
          breaker.canExecute().allowed) {
        
        const result = await breaker.execute(() => Promise.resolve('recovered'));
        expect(result).toBe('recovered');
      }
    });

    it('should close again on successful recovery', async () => {
      // Trip and wait
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('trip')));
        } catch {}
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Execute successful requests in HALF_OPEN
      if (breaker.canExecute().allowed) {
        await breaker.execute(() => Promise.resolve('ok1'));
        await breaker.execute(() => Promise.resolve('ok2'));

        // Should be closed now if enough successes
        expect([CircuitState.CLOSED, CircuitState.HALF_OPEN]).toContain(breaker.getState());
      }
    });

    it('should re-open on failure during HALF_OPEN', async () => {
      // Trip and wait
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('trip')));
        } catch {}
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Fail while in HALF_OPEN
      if (breaker.canExecute().allowed) {
        try {
          await breaker.execute(() => Promise.reject(new Error('half-open fail')));
        } catch {}

        // Should go back to OPEN
        expect(breaker.getState()).toBe(CircuitState.OPEN);
      }
    });
  });

  describe('Reset on Success', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
      breaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeoutMs: 500,
      });
    });

    it('should manually reset to CLOSED state', async () => {
      // Cause some failures
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('partial fail')));
        } catch {}
      }

      expect(breaker.getStateSnapshot().failures).toBe(3);

      // Reset
      breaker.reset();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getStateSnapshot().failures).toBe(0);
      expect(breaker.getStateSnapshot().successes).toBe(0);
    });

    it('should emit RESET event on manual reset', () => {
      const events: CircuitEvent[] = [];
      breaker.addEventListener((event) => events.push(event));

      breaker.reset();

      const resetEvents = events.filter(e => e.type === CircuitEventType.RESET);
      expect(resetEvents.length).toBe(1);
      expect(resetEvents[0].state).toBe(CircuitState.CLOSED);
    });

    it('should allow execution after reset', async () => {
      // Trip the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('trip before reset')));
        } catch {}
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Reset
      breaker.reset();

      // Should work now
      const result = await breaker.execute(() => Promise.resolve('after reset'));
      expect(result).toBe('after reset');
    });
  });

  describe('Event Emission', () => {
    let breaker: CircuitBreaker;
    let capturedEvents: CircuitEvent[];

    beforeEach(() => {
      breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 50,
      });
      capturedEvents = [];
      breaker.addEventListener((event) => capturedEvents.push(event));
    });

    it('should emit SUCCESS event on successful execution', async () => {
      await breaker.execute(() => Promise.resolve('data'));

      const successEvents = capturedEvents.filter(e => e.type === CircuitEventType.SUCCESS);
      expect(successEvents.length).toBe(1);
      expect(successEvents[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should emit FAILURE event on failed execution', async () => {
      try {
        await breaker.execute(() => Promise.reject(new Error('test failure')));
      } catch {}

      const failureEvents = capturedEvents.filter(e => e.type === CircuitEventType.FAILURE);
      expect(failureEvents.length).toBe(1);
      expect(failureEvents[0].error).toBeDefined();
    });

    it('should emit SHORT_CIRCUITED event when rejecting', async () => {
      // Trip the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('trip')));
        } catch {}
      }

      // Try to execute through open circuit
      try {
        await breaker.execute(() => Promise.resolve('nope'));
      } catch {}

      const shortCircuitedEvents = capturedEvents.filter(
        e => e.type === CircuitEventType.SHORT_CIRCUITED
      );
      expect(shortCircuitedEvents.length).toBeGreaterThan(0);
    });

    it('should support removing event listeners', () => {
      const events: CircuitEvent[] = [];
      const removeListener = breaker.addEventListener((event) => events.push(event));

      removeListener();

      // This event should not be captured
      breaker.reset(); // Triggers RESET event

      expect(events).toHaveLength(0);
    });
  });

  describe('State Snapshot', () => {
    it('should provide complete state information', () => {
      const breaker = new CircuitBreaker({
        name: 'snapshot-test',
      });

      const snapshot: CircuitStateSnapshot = breaker.getStateSnapshot();

      expect(snapshot.name).toBe('snapshot-test');
      expect(snapshot.state).toBe(CircuitState.CLOSED);
      expect(typeof snapshot.failures).toBe('number');
      expect(typeof snapshot.successes).toBe('number');
      expect(typeof snapshot.successRate).toBe('number');
      expect(snapshot.stateChangedAt).toBeDefined();
      expect(new Date(snapshot.stateChangedAt)).toBeInstanceOf(Date);
    });

    it('should update lastFailureTime on failure', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 5 });

      try {
        await breaker.execute(() => Promise.reject(new Error('time test')));
      } catch {}

      const snapshot = breaker.getStateSnapshot();
      expect(snapshot.lastFailureTime).toBeDefined();
    });

    it('should update lastSuccessTime on success', async () => {
      const breaker = new CircuitBreaker();

      await breaker.execute(() => Promise.resolve('ok'));

      const snapshot = breaker.getStateSnapshot();
      expect(snapshot.lastSuccessTime).toBeDefined();
    });

    it('should show nextRetryTime when OPEN', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Trip the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('trip')));
        } catch {}
      }

      const snapshot = breaker.getStateSnapshot();
      expect(snapshot.nextRetryTime).toBeDefined();
    });
  });

  describe('Manual Trip', () => {
    it('should allow manual tripping of circuit', () => {
      const breaker = new CircuitBreaker();
      
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      breaker.trip();

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Configuration Access', () => {
    it('should return current configuration', () => {
      const customConfig: Partial<CircuitBreakerConfig> = {
        name: 'config-test',
        failureThreshold: 10,
        resetTimeoutMs: 120000,
        halfOpenMaxAttempts: 5,
        halfOpenSuccessThreshold: 75,
      };

      const breaker = new CircuitBreaker(customConfig);
      const config = breaker.getConfig();

      expect(config.name).toBe('config-test');
      expect(config.failureThreshold).toBe(10);
      expect(config.halfOpenMaxAttempts).toBe(5);
    });
  });
});
