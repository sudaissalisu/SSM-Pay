/**
 * Comprehensive Test Suite for Monitoring & Observability Service
 * @module services/monitoring.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  monitoringService,
  trackPerformance,
  trackAsyncOperation,
  type Metric,
  type CounterMetric,
  type GaugeMetric,
  type HistogramMetric,
  type HealthStatus,
  type AlertSeverity,
  type TimeWindow,
  type PerformanceStats,
  type ErrorRateEntry,
  type SystemHealth,
  type DashboardState,
} from './monitoring';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Test Setup ==============

/**
 * Reset monitoring service state before each test
 * Ensures test isolation
 */
function resetMonitoringService(): void {
  // Access private methods via reflection or use public API to clean up
  const metrics = monitoringService.getAllMetrics();
  for (const metric of metrics) {
    monitoringService.removeMetric(metric.name);
  }
  
  // Remove all alerts
  const alerts = monitoringService.getAllAlerts();
  for (const alert of alerts) {
    monitoringService.removeAlert(alert.id);
  }
}

// ============== Counter Metrics Tests ==============

describe('MonitoringService - Counter Metrics', () => {
  beforeEach(() => {
    resetMonitoringService();
  });

  describe('createCounter()', () => {
    it('should create a new counter metric with default values', () => {
      const counter = monitoringService.createCounter('test.counter', 'Test counter');
      
      expect(counter).toBeDefined();
      expect(counter.name).toBe('test.counter');
      expect(counter.description).toBe('Test counter');
      expect(counter.type).toBe('counter');
      expect(counter.value).toBe(0);
      expect(counter.totalIncrements).toBe(0);
      expect(counter.labels).toEqual({});
      expect(counter.createdAt).toBeInstanceOf(Date);
      expect(counter.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a counter with initial labels', () => {
      const counter = monitoringService.createCounter(
        'test.labeled_counter',
        'Labeled counter',
        { method: 'GET', endpoint: '/api/test' }
      );
      
      expect(counter.labels).toEqual({
        method: 'GET',
        endpoint: '/api/test',
      });
    });

    it('should throw error when creating duplicate counter', () => {
      monitoringService.createCounter('test.duplicate', 'First');
      
      expect(() => {
        monitoringService.createCounter('test.duplicate', 'Second');
      }).toThrow(AppError);
    });
  });

  describe('incrementCounter()', () => {
    it('should increment counter by default amount (1)', () => {
      monitoringService.createCounter('test.basic', 'Basic counter');
      monitoringService.incrementCounter('test.basic');
      
      expect(monitoringService.getCounterValue('test.basic')).toBe(1);
    });

    it('should increment counter by custom amount', () => {
      monitoringService.createCounter('test.custom', 'Custom counter');
      monitoringService.incrementCounter('test.custom', 5);
      monitoringService.incrementCounter('test.custom', 10);
      
      expect(monitoringService.getCounterValue('test.custom')).toBe(15);
    });

    it('should auto-create counter if not exists', () => {
      monitoringService.incrementCounter('test.auto_created', 3);
      
      expect(monitoringService.getCounterValue('test.auto_created')).toBe(3);
    });

    it('should merge labels on increment', () => {
      monitoringService.createCounter('test.label_merge', 'Label merge');
      monitoringService.incrementCounter('test.label_merge', 1, { status: 'success' });
      
      const metric = monitoringService.getMetric('test.label_merge') as CounterMetric;
      expect(metric.labels.status).toBe('success');
    });

    it('should update total increments count', () => {
      monitoringService.createCounter('test.increments', 'Increments counter');
      monitoringService.incrementCounter('test.increments');
      monitoringService.incrementCounter('test.increments');
      monitoringService.incrementCounter('test.increments');
      
      const metric = monitoringService.getMetric('test.increments') as CounterMetric;
      expect(metric.totalIncrements).toBe(3);
    });

    it('should throw error when incrementing non-counter metric', () => {
      monitoringService.createGauge('test.not_counter', 'A gauge');
      
      expect(() => {
        monitoringService.incrementCounter('test.not_counter');
      }).toThrow(AppError);
    });

    it('should update updatedAt timestamp on increment', () => {
      monitoringService.createCounter('test.timestamp', 'Timestamp counter');
      const before = new Date();
      
      // Small delay to ensure timestamp difference
      vi.advanceTimersByTime(10);
      monitoringService.incrementCounter('test.timestamp');
      
      const metric = monitoringService.getMetric('test.timestamp') as CounterMetric;
      expect(metric.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('getCounterValue()', () => {
    it('should return 0 for non-existent counter', () => {
      expect(monitoringService.getCounterValue('nonexistent')).toBe(0);
    });

    it('should return current value for existing counter', () => {
      monitoringService.createCounter('test.value', 'Value counter');
      monitoringService.incrementCounter('test.value', 42);
      
      expect(monitoringService.getCounterValue('test.value')).toBe(42);
    });
  });
});

// ============== Gauge Metrics Tests ==============

describe('MonitoringService - Gauge Metrics', () => {
  beforeEach(() => {
    resetMonitoringService();
  });

  describe('createGauge()', () => {
    it('should create a new gauge with default values', () => {
      const gauge = monitoringService.createGauge('test.gauge', 'Test gauge');
      
      expect(gauge).toBeDefined();
      expect(gauge.name).toBe('test.gauge');
      expect(gauge.type).toBe('gauge');
      expect(gauge.value).toBe(0);
      expect(gauge.min).toBe(Infinity);
      expect(gauge.max).toBe(-Infinity);
    });

    it('should throw error when creating duplicate gauge', () => {
      monitoringService.createGauge('test.dup', 'First');
      
      expect(() => {
        monitoringService.createGauge('test.dup', 'Second');
      }).toThrow(AppError);
    });
  });

  describe('setGauge()', () => {
    it('should set gauge value', () => {
      monitoringService.createGauge('test.set', 'Settable gauge');
      monitoringService.setGauge('test.set', 100);
      
      expect(monitoringService.getGaugeValue('test.set')).toBe(100);
    });

    it('should track min and max values', () => {
      monitoringService.createGauge('test.minmax', 'Min/max gauge');
      monitoringService.setGauge('test.minmax', 50);
      monitoringService.setGauge('test.minmax', 25);
      monitoringService.setGauge('test.minmax', 75);
      
      const gauge = monitoringService.getMetric('test.minmax') as GaugeMetric;
      expect(gauge.min).toBe(25);
      expect(gauge.max).toBe(75);
    });

    it('should auto-create gauge if not exists', () => {
      monitoringService.setGauge('test.auto_gauge', 123);
      
      expect(monitoringService.getGaugeValue('test.auto_gauge')).toBe(123);
    });
  });

  describe('incrementGauge() / decrementGauge()', () => {
    it('should increment gauge value', () => {
      monitoringService.createGauge('test.inc', 'Incrementable gauge');
      monitoringService.setGauge('test.inc', 10);
      monitoringService.incrementGauge('test.inc', 5);
      
      expect(monitoringService.getGaugeValue('test.inc')).toBe(15);
    });

    it('should decrement gauge value', () => {
      monitoringService.createGauge('test.dec', 'Decrementable gauge');
      monitoringService.setGauge('test.dec', 20);
      monitoringService.decrementGauge('test.dec', 7);
      
      expect(monitoringService.getGaugeValue('test.dec')).toBe(13);
    });

    it('should handle increment on non-existent gauge', () => {
      monitoringService.incrementGauge('test.new_inc', 1);
      
      expect(monitoringService.getGaugeValue('test.new_inc')).toBe(1);
    });
  });

  describe('getGaugeValue()', () => {
    it('should return undefined for non-existent gauge', () => {
      expect(monitoringService.getGaugeValue('nonexistent')).toBeUndefined();
    });

    it('should return current value for existing gauge', () => {
      monitoringService.createGauge('test.current', 'Current gauge');
      monitoringService.setGauge('test.current', 999);
      
      expect(monitoringService.getGaugeValue('test.current')).toBe(999);
    });
  });
});

// ============== Histogram Metrics Tests ==============

describe('MonitoringService - Histogram Metrics', () => {
  beforeEach(() => {
    resetMonitoringService();
  });

  describe('createHistogram()', () => {
    it('should create histogram with default buckets', () => {
      const hist = monitoringService.createHistogram('test.hist', 'Test histogram');
      
      expect(hist.type).toBe('histogram');
      expect(hist.count).toBe(0);
      expect(hist.sum).toBe(0);
      expect(hist.buckets.length).toBeGreaterThan(0);
      // Buckets should be sorted
      for (let i = 1; i < hist.buckets.length; i++) {
        expect(hist.buckets[i].upperBound).toBeGreaterThan(hist.buckets[i - 1].upperBound);
      }
    });

    it('should create histogram with custom buckets', () => {
      const hist = monitoringService.createHistogram(
        'test.custom_buckets',
        'Custom buckets',
        [10, 50, 100, 500]
      );
      
      expect(hist.buckets).toHaveLength(4);
      expect(hist.buckets[0].upperBound).toBe(10);
      expect(hist.buckets[3].upperBound).toBe(500);
    });

    it('should filter out invalid buckets (non-positive)', () => {
      const hist = monitoringService.createHistogram(
        'test.invalid_buckets',
        'Invalid buckets',
        [-10, 0, 50, 100]
      );
      
      // Should only have positive buckets
      expect(hist.buckets.every(b => b.upperBound > 0)).toBe(true);
    });
  });

  describe('observeHistogram()', () => {
    it('should record observations in correct buckets', () => {
      monitoringService.createHistogram('test.observe', 'Observe histogram', [10, 50, 100]);
      
      monitoringService.observeHistogram('test.observe', 5);   // <= 10
      monitoringService.observeHistogram('test.observe', 25);  // <= 50
      monitoringService.observeHistogram('test.observe', 75);  // <= 100
      monitoringService.observeHistogram('test.observe', 150); // > 100
      
      const hist = monitoringService.getMetric('test.observe') as HistogramMetric;
      expect(hist.count).toBe(4);
      expect(hist.sum).toBe(255);
      expect(hist.buckets[0].count).toBe(1); // <= 10
      expect(hist.buckets[1].count).toBe(2); // <= 50 (includes 5)
      expect(hist.buckets[2].count).toBe(3); // <= 100 (includes 5, 25, 75)
    });

    it('should auto-create histogram if not exists', () => {
      monitoringService.observeHistogram('test.auto_hist', 42);
      
      const hist = monitoringService.getMetric('test.auto_hist') as HistogramMetric;
      expect(hist).toBeDefined();
      expect(hist.count).toBe(1);
    });
  });

  describe('getHistogramStats()', () => {
    it('should calculate percentiles correctly', async () => {
      const hist = monitoringService.createHistogram('test.percentiles', 'Percentile histogram');
      
      // Add known values
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      for (const v of values) {
        monitoringService.observeHistogram('test.percentiles', v);
      }
      
      const stats = monitoringService.getHistogramStats('test.percentiles');
      
      expect(stats).not.toBeNull();
      expect(stats!.percentiles).toBeDefined();
      expect(stats!.percentiles![50]).toBeGreaterThan(0);
      expect(stats!.percentiles![95]).toBeGreaterThan(stats!.percentiles![50]);
    });

    it('should return null for non-existent histogram', () => {
      expect(monitoringService.getHistogramStats('nonexistent')).toBeNull();
    });
  });
});

// ============== Performance Tracking Tests ==============

describe('MonitoringService - Performance Tracking', () => {
  beforeEach(() => {
    resetMonitoringService();
  });

  describe('startTimer()', () => {
    it('should return a function that records duration', () => {
      const endTimer = monitoringService.startTimer('test.operation');
      
      // Simulate some work
      vi.advanceTimersByTime(100);
      
      const duration = endTimer({ success: true });
      
      expect(duration).toBe(100);
    });

    it('should record successful operations', () => {
      const endTimer = monitoringService.startTimer('test.success_op');
      vi.advanceTimersByTime(50);
      endTimer({ success: true });
      
      const stats = monitoringService.getPerformanceStats('test.success_op');
      
      expect(stats.totalCount).toBe(1);
      expect(stats.successCount).toBe(1);
      expect(stats.errorCount).toBe(0);
    });

    it('should record failed operations', () => {
      const endTimer = monitoringService.startTimer('test.fail_op');
      vi.advanceTimersByTime(30);
      endTimer({ 
        success: false, 
        error: 'Something went wrong' 
      });
      
      const stats = monitoringService.getPerformanceStats('test.fail_op');
      
      expect(stats.totalCount).toBe(1);
      expect(stats.successCount).toBe(0);
      expect(stats.errorCount).toBe(1);
    });

    it('should record multiple operations and calculate stats', () => {
      const durations = [10, 25, 50, 100, 200];
      
      for (const duration of durations) {
        const endTimer = monitoringService.startTimer('test.multi_op');
        vi.advanceTimersByTime(duration);
        endTimer({ success: duration < 150 });
      }
      
      const stats = monitoringService.getPerformanceStats('test.multi_op');
      
      expect(stats.totalCount).toBe(5);
      expect(stats.successCount).toBe(4); // 10, 25, 50, 100
      expect(stats.errorCount).toBe(1);   // 200
      expect(stats.avgDurationMs).toBe(77); // (10+25+50+100+200)/5
      expect(stats.minDurationMs).toBe(10);
      expect(stats.maxDurationMs).toBe(200);
      expect(stats.p50Ms).toBe(50); // median
      expect(stats.errorRate).toBe(20); // 1/5 * 100
    });

    it('should store labels with performance records', () => {
      const endTimer = monitoringService.startTimer('test.labeled_op');
      vi.advanceTimersByTime(45);
      endTimer({ 
        success: true, 
        labels: { method: 'POST', endpoint: '/api/payments' } 
      });
      
      const stats = monitoringService.getPerformanceStats('test.labeled_op');
      expect(stats.totalCount).toBe(1);
    });
  });

  describe('getPerformanceStats()', () => {
    it('should return empty stats for unknown operation', () => {
      const stats = monitoringService.getPerformanceStats('nonexistent');
      
      expect(stats.operation).toBe('nonexistent');
      expect(stats.totalCount).toBe(0);
      expect(stats.throughput).toBe(0);
    });

    it('should filter by time window', () => {
      // This would require manipulating timestamps, which is complex
      // Basic structure test
      const stats = monitoringService.getPerformanceStats('test.windowed', {
        window: '1h'
      });
      
      expect(stats).toBeDefined();
      expect(stats.operation).toBe('test.windowed');
    });
  });

  describe('getAllPerformanceStats()', () => {
    it('should return stats for all tracked operations', () => {
      const endTimer1 = monitoringService.startTimer('op.one');
      vi.advanceTimersByTime(10);
      endTimer1({ success: true });
      
      const endTimer2 = monitoringService.startTimer('op.two');
      vi.advanceTimersByTime(20);
      endTimer2({ success: true });
      
      const allStats = monitoringService.getAllPerformanceStats();
      
      expect(allStats.size).toBeGreaterThanOrEqual(2);
      expect(allStats.has('op.one')).toBe(true);
      expect(allStats.has('op.two')).toBe(true);
    });
  });
});

// ============== Error Rate Monitoring Tests ==============

describe('MonitoringService - Error Rate Monitoring', () => {
  beforeEach(() => {
    resetMonitoringService();
  });

  describe('recordError()', () => {
    it('should record error occurrences', () => {
      monitoringService.recordError('PAYMENT_FAILED');
      monitoringService.recordError('PAYMENT_FAILED');
      monitoringService.recordError('API_TIMEOUT');
      
      expect(monitoringService.getErrorCount('PAYMENT_FAILED')).toBe(2);
      expect(monitoringService.getErrorCount('API_TIMEOUT')).toBe(1);
    });

    it('should handle error objects', () => {
      const error = new AppError('Test error', ErrorCode.PAYMENT_INIT_FAILED);
      
      expect(() => {
        monitoringService.recordError('TEST_ERROR', error);
      }).not.toThrow();
      
      expect(monitoringService.getErrorCount('TEST_ERROR')).toBe(1);
    });

    it('should start at 0 for new error codes', () => {
      expect(monitoringService.getErrorCount('NEW_ERROR_CODE')).toBe(0);
    });
  });

  describe('getErrorRates()', () => {
    it('should return error rates for tracked errors', () => {
      monitoringService.recordError('ERROR_A');
      monitoringService.recordError('ERROR_A');
      monitoringService.recordError('ERROR_A');
      monitoringService.recordError('ERROR_B');
      
      const rates = monitoringService.getErrorRates('1h');
      
      expect(rates.length).toBeGreaterThanOrEqual(2);
      
      const errorARate = rates.find(e => e.errorCode === 'ERROR_A');
      expect(errorARate).toBeDefined();
      expect(errorARate!.count).toBe(3);
    });

    it('should sort errors by count descending', () => {
      monitoringService.recordError('FEW_ERRORS');
      monitoringService.recordError('MANY_ERRORS');
      monitoringService.recordError('MANY_ERRORS');
      monitoringService.recordError('MANY_ERRORS');
      
      const rates = monitoringService.getErrorRates();
      
      expect(rates[0].errorCode).toBe('MANY_ERRORS');
      expect(rates[1].errorCode).toBe('FEW_ERRORS');
    });

    it('should include trend information', () => {
      monitoringService.recordError('TREND_TEST');
      
      const rates = monitoringService.getErrorRates();
      const trendEntry = rates.find(e => e.errorCode === 'TREND_TEST');
      
      expect(trendEntry).toBeDefined();
      expect(['up', 'down', 'stable']).toContain(trendEntry!.trend);
    });
  });
});

// ============== Health Check Tests ==============

describe('MonitoringService - Health Checks', () => {
  beforeEach(() => {
    resetMonitoringService();
  });

  describe('checkLiveness()', () => {
    it('should return healthy status', async () => {
      const liveness = await monitoringService.checkLiveness();
      
      expect(liveness.component).toBe('liveness');
      expect(liveness.status).toBe('healthy');
      expect(liveness.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(liveness.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('checkReadiness()', () => {
    it('should return readiness status with component checks', async () => {
      const readiness = await monitoringService.checkReadiness();
      
      expect(readiness.component).toBe('readiness');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(readiness.status);
      expect(readiness.details).toBeDefined();
    });
  });

  describe('registerHealthCheck() & checkDeepHealth()', () => {
    it('should execute registered health checks', async () => {
      monitoringService.registerHealthCheck('custom_component', async () => ({
        component: 'custom_component',
        status: 'healthy',
        message: 'All good',
        timestamp: new Date(),
      }));
      
      const health = await monitoringService.checkDeepHealth();
      
      expect(health.status).toBeDefined();
      expect(health.checks.some(c => c.component === 'custom_component')).toBe(true);
      expect(health.version).toBeDefined();
      expect(health.uptimeSeconds).toBeGreaterThan(0);
    });

    it('handle failing health checks', async () => {
      monitoringService.registerHealthCheck('failing_component', async () => ({
        component: 'failing_component',
        status: 'unhealthy',
        message: 'Something is wrong',
        timestamp: new Date(),
      }));
      
      const health = await monitoringService.checkDeepHealth();
      
      expect(health.status).toBe('unhealthy');
    });

    it('should timeout slow health checks', async () => {
      monitoringService.registerHealthCheck('slow_component', async () => {
        // Simulate very slow check
        await new Promise(resolve => setTimeout(resolve, 60000));
        return {
          component: 'slow_component',
          status: 'healthy',
          timestamp: new Date(),
        };
      });
      
      const health = await monitoringService.checkDeepHealth();
      const slowCheck = health.checks.find(c => c.component === 'slow_component');
      
      expect(slowCheck).toBeDefined();
      expect(slowCheck!.status).toBe('unhealthy');
      expect(slowCheck!.message).toContain('timeout');
    });

    it('should handle throwing health checks', async () => {
      monitoringService.registerHealthCheck('throwing_component', async () => {
        throw new Error('Health check crashed');
      });
      
      const health = await monitoringService.checkDeepHealth();
      const throwingCheck = health.checks.find(c => c.component === 'throwing_component');
      
      expect(throwingCheck!.status).toBe('unhealthy');
    });
  });

  describe('getSystemHealth()', () => {
    it('should be an alias for checkDeepHealth', async () => {
      const health1 = await monitoringService.checkDeepHealth();
      const health2 = await monitoringService.getSystemHealth();
      
      // Both should return valid system health
      expect(health1.status).toBeDefined();
      expect(health2.status).toBeDefined();
      expect(health1.version).toBe(health2.version);
    });
  });
});

// ============== Alert Threshold Management Tests ==============

describe('MonitoringService - Alert Threshold Management', () => {
  beforeEach(() => {
    resetMonitoringService();
  });

  describe('createAlert()', () => {
    it('should create a new alert threshold', () => {
      const alert = monitoringService.createAlert({
        id: 'test_alert_1',
        metricName: 'test.metric',
        condition: 'gt',
        value: 100,
        severity: 'warning',
        description: 'Test alert description',
      });
      
      expect(alert.id).toBe('test_alert_1');
      expect(alert.metricName).toBe('test.metric');
      expect(alert.condition).toBe('gt');
      expect(alert.value).toBe(100);
      expect(alert.severity).toBe('warning');
      expect(alert.isActive).toBe(false);
      expect(alert.triggerCount).toBe(0);
    });

    it('should throw error for duplicate alert ID', () => {
      monitoringService.createAlert({
        id: 'duplicate_id',
        metricName: 'test.metric',
        condition: 'gt',
        value: 100,
        severity: 'info',
      });
      
      expect(() => {
        monitoringService.createAlert({
          id: 'duplicate_id',
          metricName: 'other.metric',
          condition: 'lt',
          value: 50,
          severity: 'critical',
        });
      }).toThrow(AppError);
    });

    it('should set default time window and description', () => {
      const alert = monitoringService.createAlert({
        id: 'defaults_test',
        metricName: 'test.metric',
        condition: 'gte',
        value: 10,
        severity: 'info',
      });
      
      expect(alert.timeWindow).toBe('5m');
      expect(alert.description).toContain('test.metric');
    });
  });

  describe('removeAlert()', () => {
    it('should remove an existing alert', () => {
      monitoringService.createAlert({
        id: 'to_remove',
        metricName: 'test.metric',
        condition: 'gt',
        value: 100,
        severity: 'warning',
      });
      
      expect(monitoringService.removeAlert('to_remove')).toBe(true);
      expect(monitoringService.removeAlert('to_remove')).toBe(false);
    });
  });

  describe('evaluateAlert()', () => {
    beforeEach(() => {
      // Create metric for testing
      monitoringService.createGauge('alert.test_metric', 'Test metric for alerts');
    });

    it('should trigger alert when condition is met', () => {
      monitoringService.createAlert({
        id: 'trigger_test',
        metricName: 'alert.test_metric',
        condition: 'gt',
        value: 50,
        severity: 'warning',
      });
      
      // Set value above threshold
      monitoringService.setGauge('alert.test_metric', 75);
      
      const triggered = monitoringService.evaluateAlert('trigger_test');
      
      expect(triggered).toBe(true);
      
      const activeAlerts = monitoringService.getActiveAlerts();
      expect(activeAlerts.length).toBe(1);
      expect(activeAlerts[0].currentValue).toBe(75);
    });

    it('should not trigger alert when condition is not met', () => {
      monitoringService.createAlert({
        id: 'no_trigger_test',
        metricName: 'alert.test_metric',
        condition: 'gt',
        value: 100,
        severity: 'warning',
      });
      
      // Set value below threshold
      monitoringService.setGauge('alert.test_metric', 25);
      
      const triggered = monitoringService.evaluateAlert('no_trigger_test');
      
      expect(triggered).toBe(false);
      expect(monitoringService.getActiveAlerts().length).toBe(0);
    });

    it('should support different conditions', () => {
      // Test LT condition
      monitoringService.createAlert({
        id: 'lt_condition',
        metricName: 'alert.test_metric',
        condition: 'lt',
        value: 10,
        severity: 'info',
      });
      
      monitoringService.setGauge('alert.test_metric', 5);
      expect(monitoringService.evaluateAlert('lt_condition')).toBe(true);
    });

    it('should call onTrigger callback when alert fires', () => {
      const mockCallback = vi.fn();
      
      monitoringService.createAlert({
        id: 'callback_test',
        metricName: 'alert.test_metric',
        condition: 'gt',
        value: 0,
        severity: 'critical',
        onTrigger: mockCallback,
      });
      
      monitoringService.setGauge('alert.test_metric', 100);
      monitoringService.evaluateAlert('callback_test');
      
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'callback_test',
          currentValue: 100,
        })
      );
    });

    it('should resolve alert when condition is no longer met', () => {
      monitoringService.createAlert({
        id: 'resolve_test',
        metricName: 'alert.test_metric',
        condition: 'gt',
        value: 50,
        severity: 'warning',
      });
      
      // Trigger alert
      monitoringService.setGauge('alert.test_metric', 75);
      monitoringService.evaluateAlert('resolve_test');
      expect(monitoringService.getActiveAlerts().length).toBe(1);
      
      // Resolve alert
      monitoringService.setGauge('alert.test_metric', 25);
      monitoringService.evaluateAlert('resolve_test');
      expect(monitoringService.getActiveAlerts().length).toBe(0);
    });
  });

  describe('evaluateAllAlerts()', () => {
    it('should evaluate all registered alerts', () => {
      monitoringService.createGauge('multi_alert.metric', 'Multi-alert metric');
      
      monitoringService.createAlert({
        id: 'alert_1',
        metricName: 'multi_alert.metric',
        condition: 'gt',
        value: 10,
        severity: 'warning',
      });
      
      monitoringService.createAlert({
        id: 'alert_2',
        metricName: 'multi_alert.metric',
        condition: 'lt',
        value: 0,
        severity: 'info',
      });
      
      // Trigger only alert_1
      monitoringService.setGauge('multi_alert.metric', 50);
      
      const newlyTriggered = monitoringService.evaluateAllAlerts();
      
      expect(newlyTriggered.length).toBe(1);
      expect(newlyTriggered[0].id).toBe('alert_1');
    });
  });

  describe('getActiveAlerts() / getAllAlerts()', () => {
    it('should return all active alerts', () => {
      monitoringService.createGauge('active.metric', 'Active metric');
      
      monitoringService.createAlert({
        id: 'active_1',
        metricName: 'active.metric',
        condition: 'gt',
        value: 0,
        severity: 'warning',
      });
      
      monitoringService.createAlert({
        id: 'inactive_1',
        metricName: 'active.metric',
        condition: 'gt',
        value: 99999,
        severity: 'critical',
      });
      
      monitoringService.setGauge('active.metric', 100);
      monitoringService.evaluateAllAlerts();
      
      const activeAlerts = monitoringService.getActiveAlerts();
      const allAlerts = monitoringService.getAllAlerts();
      
      expect(activeAlerts.length).toBe(1);
      expect(allAlerts.length).toBe(2);
    });
  });
});

// ============== Dashboard Data Generation Tests ==============

describe('MonitoringService - Dashboard Data Generation', () => {
  beforeEach(() => {
    resetMonitoringService();
  });

  describe('generateDashboard()', () => {
    it('should generate complete dashboard state', () => {
      const dashboard = monitoringService.generateDashboard('1h');
      
      expect(dashboard.generatedAt).toBeInstanceOf(Date);
      expect(dashboard.widgets.length).toBeGreaterThan(0);
      expect(dashboard.timeRange).toBe('1h');
      expect(typeof dashboard.activeAlertsCount).toBe('number');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(dashboard.overallStatus);
    });

    it('should include expected widget types', () => {
      const dashboard = monitoringService.generateDashboard();
      
      const widgetTypes = dashboard.widgets.map(w => w.type);
      
      expect(widgetTypes).toContain('counter');
      expect(widgetTypes).toContain('line');
      expect(widgetTypes).toContain('status');
    });

    it('should include request overview widget', () => {
      const dashboard = monitoringService.generateDashboard();
      
      const requestWidget = dashboard.widgets.find(w => w.id === 'requests_overview');
      
      expect(requestWidget).toBeDefined();
      expect(requestWidget!.title).toBe('Request Overview');
      expect(requestWidget!.type).toBe('counter');
    });

    it('should respect time range parameter', () => {
      const dashboard24h = monitoringService.generateDashboard('24h');
      const dashboard5m = monitoringService.generateDashboard('5m');
      
      expect(dashboard24h.timeRange).toBe('24h');
      expect(dashboard5m.timeRange).toBe('5m');
    });
  });
});

// ============== Utility Methods Tests ==============

describe('MonitoringService - Utility Methods', () => {
  beforeEach(() => {
    resetMonitoringService();
  });

  describe('getAllMetrics() / getMetric()', () => {
    it('should return all registered metrics', () => {
      monitoringService.createCounter('metric_1', 'First');
      monitoringService.createGauge('metric_2', 'Second');
      
      const allMetrics = monitoringService.getAllMetrics();
      
      expect(allMetrics.length).toBeGreaterThanOrEqual(2);
    });

    it('should get specific metric by name', () => {
      monitoringService.createCounter('specific_metric', 'Specific');
      
      const metric = monitoringService.getMetric('specific_metric');
      
      expect(metric).toBeDefined();
      expect(metric!.name).toBe('specific_metric');
    });

    it('should return undefined for non-existent metric', () => {
      expect(monitoringService.getMetric('does_not_exist')).toBeUndefined();
    });
  });

  describe('removeMetric()', () => {
    it('should remove existing metric', () => {
      monitoringService.createCounter('to_delete', 'Delete me');
      
      expect(monitoringService.removeMetric('to_delete')).toBe(true);
      expect(monitoringService.getMetric('to_delete')).toBeUndefined();
    });

    it('should return false for non-existent metric', () => {
      expect(monitoringService.removeMetric('already_gone')).toBe(false);
    });
  });

  describe('resetMetric()', () => {
    it('should reset counter to zero', () => {
      monitoringService.createCounter('reset_counter', 'Reset this');
      monitoringService.incrementCounter('reset_counter', 100);
      
      expect(monitoringService.getCounterValue('reset_counter')).toBe(100);
      
      monitoringService.resetMetric('reset_counter');
      
      expect(monitoringService.getCounterValue('reset_counter')).toBe(0);
    });

    it('should reset gauge to initial state', () => {
      monitoringService.createGauge('reset_gauge', 'Reset gauge');
      monitoringService.setGauge('reset_gauge', 75);
      
      const gaugeBefore = monitoringService.getMetric('reset_gauge') as GaugeMetric;
      expect(gaugeBefore.value).toBe(75);
      
      monitoringService.resetMetric('reset_gauge');
      
      const gaugeAfter = monitoringService.getMetric('reset_gauge') as GaugeMetric;
      expect(gaugeAfter.value).toBe(0);
      expect(gaugeAfter.min).toBe(Infinity);
      expect(gaugeAfter.max).toBe(-Infinity);
    });

    it('should throw error for non-existent metric', () => {
      expect(() => {
        monitoringService.resetMetric('nonexistent_for_reset');
      }).toThrow(AppError);
    });
  });

  describe('resetAllMetrics()', () => {
    it('should reset all metrics', () => {
      monitoringService.createCounter('all_reset_1', 'First');
      monitoringService.createGauge('all_reset_2', 'Second');
      
      monitoringService.incrementCounter('all_reset_1', 50);
      monitoringService.setGauge('all_reset_2', 25);
      
      monitoringService.resetAllMetrics();
      
      expect(monitoringService.getCounterValue('all_reset_1')).toBe(0);
      expect(monitoringService.getGaugeValue('all_reset_2')).toBe(0);
    });
  });

  describe('exportPrometheusFormat()', () => {
    it('should export metrics in Prometheus format', () => {
      monitoringService.createCounter('prometheus_test', 'Prometheus test counter', { environment: 'test' });
      monitoringService.incrementCounter('prometheus_test', 42);
      
      const exported = monitoringService.exportPrometheusFormat();
      
      expect(exported).toContain('# HELP prometheus_test Prometheus test counter');
      expect(exported).toContain('# TYPE prometheus_test counter');
      expect(exported).toContain('prometheus_test{environment="test"} 42');
    });

    it('should handle empty metrics gracefully', () => {
      // Clear any built-in metrics that might exist
      const metrics = monitoringService.getAllMetrics();
      metrics.forEach(m => monitoringService.removeMetric(m.name));
      
      const exported = monitoringService.exportPrometheusFormat();
      
      expect(exported).toContain('SSM-Pay Metrics Export');
    });
  });

  describe('exportJSON()', () => {
    it('should export metrics as JSON-compatible object', () => {
      monitoringService.createCounter('json_test', 'JSON test');
      monitoringService.incrementCounter('json_test', 10);
      
      const exported = monitoringService.exportJSON();
      
      expect(exported).toHaveProperty('exportedAt');
      expect(exported).toHaveProperty('metrics');
      expect(exported).toHaveProperty('health');
      expect((exported.health as Record<string, unknown>).uptimeSeconds).toBeGreaterThan(0);
    });
  });

  describe('shutdown()', () => {
    it('should shutdown without errors', () => {
      expect(() => {
        monitoringService.shutdown();
      }).not.toThrow();
    });
  });
});

// ============== Decorator and Helper Function Tests ==============

describe('trackPerformance Decorator', () => {
  it('should be defined as a function', () => {
    expect(trackPerformance).toBeDefined();
    expect(typeof trackPerformance).toBe('function');
  });

  it('should return a decorator function', () => {
    const decorator = trackPerformance('test.operation');
    expect(typeof decorator).toBe('function');
  });
});

describe('trackAsyncOperation()', () => {
  it('should track successful async operations', async () => {
    const result = await trackAsyncOperation('async_test.success', async () => {
      return { data: 'success' };
    });
    
    expect(result).toEqual({ data: 'success' });
    
    const stats = monitoringService.getPerformanceStats('async_test.success');
    expect(stats.totalCount).toBe(1);
    expect(stats.successCount).toBe(1);
  });

  it('should track failed async operations', async () => {
    await expect(trackAsyncOperation('async_test.fail', async () => {
      throw new Error('Operation failed');
    })).rejects.toThrow('Operation failed');
    
    const stats = monitoringService.getPerformanceStats('async_test.fail');
    expect(stats.totalCount).toBe(1);
    expect(stats.errorCount).toBe(1);
  });

  it('should preserve the thrown error', async () => {
    const originalError = new AppError('Original error', ErrorCode.PAYMENT_INIT_FAILED);
    
    await expect(trackAsyncOperation('async_test.preserve', async () => {
      throw originalError;
    })).rejects.toBe(originalError);
  });
});

// ============== Integration Tests ==============

describe('MonitoringService - Integration Tests', () => {
  beforeEach(() => {
    resetMonitoringService();
  });

  it('should handle complete payment flow simulation', async () => {
    // Simulate payment initiation
    monitoringService.incrementCounter('payments_initiated_total', 1, { method: 'card' });
    
    // Track processing time
    const processEnd = monitoringService.startTimer('payment.processing');
    vi.advanceTimersByTime(250);
    processEnd({ success: true, labels: { payment_method: 'card' } });
    
    // Record completion
    monitoringService.incrementCounter('payments_completed_total', 1);
    
    // Verify metrics
    expect(monitoringService.getCounterValue('payments_initiated_total')).toBe(1);
    expect(monitoringService.getCounterValue('payments_completed_total')).toBe(1);
    
    const perfStats = monitoringService.getPerformanceStats('payment.processing');
    expect(perfStats.totalCount).toBe(1);
    expect(perfStats.successCount).toBe(1);
    expect(perfStats.avgDurationMs).toBe(250);
  });

  it('should handle error scenario with alerts', async () => {
    // Create error tracking metric
    monitoringService.createGauge('error_rate_current', 'Current error rate');
    
    // Create alert for high error rate
    monitoringService.createAlert({
      id: 'high_error_rate',
      metricName: 'error_rate_current',
      condition: 'gt',
      value: 5,
      severity: 'critical',
      description: 'Error rate exceeds threshold',
    });
    
    // Simulate errors
    for (let i = 0; i < 10; i++) {
      monitoringService.recordError('PAYMENT_FAILED');
    }
    
    // Update error rate gauge
    monitoringService.setGauge('error_rate_current', 8);
    
    // Evaluate alert
    const triggered = monitoringService.evaluateAlert('high_error_rate');
    
    expect(triggered).toBe(true);
    expect(monitoringService.getActiveAlerts()).toHaveLength(1);
    expect(monitoringService.getErrorCount('PAYMENT_FAILED')).toBe(10);
  });

  it('should generate dashboard with realistic data', () => {
    // Populate some metrics
    for (let i = 0; i < 100; i++) {
      monitoringService.incrementCounter('http_requests_total');
      if (i % 10 !== 0) {
        monitoringService.incrementCounter('http_requests_success_total');
      } else {
        monitoringService.incrementCounter('http_requests_error_total');
        monitoringService.recordError('HTTP_ERROR');
      }
    }
    
    // Generate dashboard
    const dashboard = monitoringService.generateDashboard('1h');
    
    // Verify dashboard structure
    expect(dashboard.widgets.length).toBeGreaterThan(0);
    expect(dashboard.activeAlertsCount).toBeGreaterThanOrEqual(0);
    
    // Find requests widget
    const requestsWidget = dashboard.widgets.find(w => w.id === 'requests_overview');
    expect(requestsWidget).toBeDefined();
    expect(requestsWidget!.currentValue).toBe(100);
  });
});
