/**
 * SSM-Pay Monitoring Service Module
 * Public API for metrics, health checks, performance tracking, and alerts
 *
 * @example
 * ```typescript
 * import {
 *   MonitoringService,
 *   MetricType,
 *   HealthStatus,
 *   AlertSeverity,
 * } from '@/services/monitoring';
 *
 * const monitoring = new MonitoringService();
 *
 * // Record a metric
 * monitoring.metrics.recordMetric('payment_count', 1, MetricType.COUNTER);
 *
 * // Check system health
 * const health = await monitoring.health.checkHealth();
 *
 * // Track a request
 * const ctx = monitoring.performance.startTracking('/api/payments', 'POST');
 * // ... do work ...
 * monitoring.performance.endTracking(ctx, 200);
 * ```
 */

// Type exports
export type {
  MetricPoint,
  AggregatedMetric,
  HealthCheckResult,
  HealthReport,
  AlertRule,
  ActiveAlert,
  NotificationChannel,
  DashboardConfig,
  DashboardWidget,
  PerformanceSnapshot,
} from './types';

export {
  MetricType,
  MetricUnit,
  HealthStatus,
  AlertSeverity,
  WidgetType,
} from './types';

// Metrics service
export { MetricsCollector } from './metrics';
export type { MetricsConfig } from './metrics';

// Health checker
export { HealthChecker } from './health';
export type { HealthCheckerConfig } from './health';

// Performance tracker
export { PerformanceTracker } from './performance';
export type {
  PerformanceConfig,
  RequestContext,
  PerformanceReport,
  SlowQueryRecord,
  OperationStats,
} from './performance';

// Alert manager
export { AlertManager } from './alerts';
export type {
  AlertsConfig,
  AlertNotification,
} from './alerts';

/**
 * Main MonitoringService facade combining all monitoring functionality
 */
import { MetricsCollector } from './metrics';
import { HealthChecker } from './health';
import { PerformanceTracker } from './performance';
import { AlertManager } from './alerts';

/** Monitoring service configuration */
export interface MonitoringServiceConfig {
  /** Metrics collector configuration */
  metrics?: Partial<import('./metrics').MetricsConfig>;
  /** Health checker configuration */
  health?: Partial<import('./health').HealthCheckerConfig>;
  /** Performance tracker configuration */
  performance?: Partial<PerformanceConfig>;
  /** Alerts configuration */
  alerts?: Partial<AlertsConfig>;
}

/**
 * SSM-Pay Monitoring Service - Unified entry point for all monitoring
 */
export class MonitoringService {
  readonly metrics: MetricsCollector;
  readonly health: HealthChecker;
  readonly performance: PerformanceTracker;
  readonly alerts: AlertManager;

  constructor(config: MonitoringServiceConfig = {}) {
    this.metrics = new MetricsCollector(config.metrics);
    this.health = new HealthChecker(config.health);
    this.performance = new PerformanceTracker(
      config.performance,
      this.metrics
    );
    this.alerts = new AlertManager(config.alerts, this.metrics);
  }

  /**
   * Initialize all monitoring services
   */
  async initialize(): Promise<void> {
    console.log('[Monitoring] Initializing services...');
    
    // Register default alert rules
    this.registerDefaultAlerts();
    
    console.log('[Monitoring] Services initialized');
  }

  /**
   * Generate comprehensive system status report
   */
  async generateStatusReport(): Promise<{
    health: import('./types').HealthReport;
    performance: PerformanceReport;
    activeAlerts: number;
    metricCount: number;
  }> {
    const [health, performance] = await Promise.all([
      this.health.checkHealth(),
      this.performance.generateReport(),
    ]);

    return {
      health,
      performance,
      activeAlerts: this.alerts.getActiveAlerts().length,
      metricCount: this.metrics.getTotalPointCount(),
    };
  }

  /**
   * Shutdown and cleanup monitoring services
   */
  async shutdown(): Promise<void> {
    console.log('[Monitoring] Shutting down...');
    this.performance.reset();
    this.metrics.flushMetrics();
    console.log('[Monitoring] Shutdown complete');
  }

  /**
   * Register default alert rules for payment platform
   */
  private registerDefaultAlerts(): void {
    // High error rate alert
    this.alerts.createRule({
      name: 'High Error Rate',
      description: 'Error rate exceeds 5%',
      metricName: 'requests_total',
      operator: 'gt',
      threshold: 0.05,
      durationSeconds: 60,
      severity: AlertSeverity.WARNING,
      enabled: true,
      notificationChannels: ['default'],
      cooldownSeconds: 300,
    });

    // Slow response time alert
    this.alerts.createRule({
      name: 'Slow Response Time',
      description: 'P99 latency exceeds 2 seconds',
      metricName: 'request_duration_ms',
      operator: 'gt',
      threshold: 2000,
      durationSeconds: 120,
      severity: AlertSeverity.WARNING,
      enabled: true,
      notificationChannels: ['default'],
      cooldownSeconds: 600,
    });

    // System unhealthy alert
    this.alerts.createRule({
      name: 'System Unhealthy',
      description: 'Overall health check failing',
      metricName: 'health_status',
      operator: 'gte',
      threshold: 2, // UNHEALTHY or worse
      durationSeconds: 30,
      severity: AlertSeverity.CRITICAL,
      enabled: true,
      notificationChannels: ['default'],
      cooldownSeconds: 60,
    });
  }
}
