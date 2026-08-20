/**
 * Monitoring Dashboard Generation Module
 * 
 * Provides dashboard data generation including:
 * - Widget configuration
 * - Data point aggregation
 * - Status indicators
 * - Complete dashboard state
 * 
 * @module services/monitoring/dashboard
 */

import { MetricsManager } from './metrics';
import { PerformanceTracker, PerformanceStats } from './performance';
import { AlertsManager } from './alerts';
import { HealthStatus } from './health';

// ============== Type Definitions ==============

/**
 * Dashboard data point for visualization
 */
export interface DashboardDataPoint {
  /** Timestamp of the data point */
  timestamp: Date;
  /** Value at this point */
  value: number;
  /** Optional label */
  label?: string;
}

/**
 * Dashboard widget configuration
 */
export interface DashboardWidget {
  /** Widget identifier */
  id: string;
  /** Widget title */
  title: string;
  /** Widget type */
  type: 'line' | 'bar' | 'gauge' | 'counter' | 'status' | 'table';
  /** Associated metric names */
  metrics: string[];
  /** Data points for rendering */
  data: DashboardDataPoint[];
  /** Current value */
  currentValue?: number;
  /** Unit display */
  unit?: string;
  /** Status indicator (for status widgets) */
  status?: HealthStatus;
  /** Refresh interval in seconds */
  refreshInterval: number;
}

/**
 * Complete dashboard state
 */
export interface DashboardState {
  /** Dashboard generation timestamp */
  generatedAt: Date;
  /** All widgets */
  widgets: DashboardWidget[];
  /** Active alerts count */
  activeAlertsCount: number;
  /** Overall system status */
  overallStatus: HealthStatus;
  /** Data time range */
  timeRange: import('./performance').TimeWindow;

// ============== Dashboard Generator Class ==============

/**
 * Dashboard Generator
 * 
 * Creates dashboard configurations and data.
 */
export class DashboardGenerator {
  private metricsManager: MetricsManager;
  private performanceTracker: PerformanceTracker;
  private alertsManager: AlertsManager;

  constructor(
    metricsManager: MetricsManager,
    performanceTracker: PerformanceTracker,
    alertsManager: AlertsManager
  ) {
    this.metricsManager = metricsManager;
    this.performanceTracker = performanceTracker;
    this.alertsManager = alertsManager;
  }

  /**
   * Generate complete dashboard state
   */
  generateDashboard(timeRange: import('./performance').TimeWindow = '1h'): DashboardState {
    const widgets: DashboardWidget[] = [];
    
    // Request overview widget
    widgets.push(this.generateRequestWidget(timeRange));
    
    // Performance widget
    widgets.push(this.generatePerformanceWidget(timeRange));
    
    // Error rate widget
    widgets.push(this.getErrorRateWidget(timeRange));
    
    // Health status widget
    widgets.push(this.getHealthStatusWidget());
    
    // Active alerts widget
    widgets.push(this.getActiveAlertsWidget());
    
    // Determine overall status
    const activeAlerts = this.alertsManager.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    
    let overallStatus: HealthStatus = 'healthy';
    if (criticalAlerts.length > 0) {
      overallStatus = 'unhealthy';
    } else if (activeAlerts.some(a => a.severity === 'warning')) {
      overallStatus = 'degraded';
    }
    
    return {
      generatedAt: new Date(),
      widgets,
      activeAlertsCount: activeAlerts.length,
      overallStatus,
      timeRange,
    };
  }

  /**
   * Generate request overview widget
   */
  private generateRequestWidget(timeRange: import('./performance').TimeWindow): DashboardWidget {
    const totalRequests = this.metricsManager.getCounterValue('http_requests_total');
    const successRequests = this.metricsManager.getCounterValue('http_requests_success_total');
    const errorRequests = this.metricsManager.getCounterValue('http_requests_error_total');
    
    return {
      id: 'requests_overview',
      title: 'Request Overview',
      type: 'counter',
      metrics: ['http_requests_total', 'http_requests_success_total', 'http_requests_error_total'],
      data: this.metricsManager.getHistoricalData('http_requests_total', undefined, undefined)
        .map(d => ({ timestamp: d.timestamp, value: d.value })),
      currentValue: totalRequests,
      unit: 'requests',
      refreshInterval: 30,
    };
  }

  /**
   * Generate performance widget
   */
  private generatePerformanceWidget(timeRange: import('./performance').TimeWindow): DashboardWidget {
    let httpStats: PerformanceStats;
    try {
      httpStats = this.performanceTracker.getPerformanceStats('http_request', { window: timeRange });
    } catch {
      httpStats = this.emptyPerformanceStats();
    }
    
    return {
      id: 'performance',
      title: 'API Performance',
      type: 'line',
      metrics: ['http_request_duration_ms'],
      data: this.metricsManager.getHistoricalData('http_request_duration_ms_raw'),
      currentValue: httpStats.avgDurationMs,
      unit: 'ms',
      refreshInterval: 15,
    };
  }

  /**
   * Generate error rate widget
   */
  private getErrorRateWidget(timeRange: import('./performance').TimeWindow): DashboardWidget {
    const activeAlerts = this.alertsManager.getActiveAlerts();
    const totalErrors = activeAlerts.length;
    
    return {
      id: 'error_rates',
      title: 'Error Rates',
      type: 'bar',
      metrics: ['errors_total'],
      data: activeAlerts.slice(0, 10).map(a => ({
        timestamp: a.triggeredAt,
        value: a.currentValue,
        label: `${a.id} (${a.severity})`,
      })),
      currentValue: totalErrors,
      unit: 'alerts',
      refreshInterval: 60,
    };
  }

  /**
   * Generate health status widget
   */
  private getHealthStatusWidget(): DashboardWidget {
    return {
      id: 'health_status',
      title: 'System Health',
      type: 'status',
      metrics: [],
      data: [],
      status: 'unknown' as HealthStatus, // Will be updated on actual check
      refreshInterval: 30,
    };
  }

  /**
   * Generate active alerts widget
   */
  private getActiveAlertsWidget(): DashboardWidget {
    const activeAlerts = this.alertsManager.getActiveAlerts();
    
    return {
      id: 'active_alerts',
      title: 'Active Alerts',
      type: 'table',
      metrics: [],
      data: activeAlerts.map(a => ({
        timestamp: a.triggeredAt,
        value: a.currentValue,
        label: `${a.id} (${a.severity})`,
      })),
      currentValue: activeAlerts.length,
      unit: 'alerts',
      refreshInterval: 10,
    };
  }

  /**
   * Get empty performance stats placeholder
   */
  private emptyPerformanceStats(): PerformanceStats {
    return {
      operation: 'unknown',
      totalCount: 0,
      successCount: 0,
      errorCount: 0,
      avgDurationMs: 0,
      minDurationMs: 0,
      maxDurationMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      errorRate: 0,
      throughput: 0,
    };
  }

  /**
   * Generate custom widget
   */
  generateCustomWidget(config: {
    id: string;
    title: string;
    type: DashboardWidget['type'];
    metricNames: string[];
    unit?: string;
    refreshInterval?: number;
  }): DashboardWidget {
    const dataPoints: DashboardDataPoint[] = [];
    let currentValue: number | undefined;

    for (const metricName of config.metricNames) {
      const metric = this.metricsManager.getMetric(metricName);
      if (metric) {
        if ('value' in metric) {
          currentValue = metric.value as number;
        }
        
        const historical = this.metricsManager.getHistoricalData(metricName);
        dataPoints.push(...historical);
      }
    }

    return {
      id: config.id,
      title: config.title,
      type: config.type,
      metrics: config.metricNames,
      data: dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
      currentValue,
      unit: config.unit,
      refreshInterval: config.refreshInterval || 60,
    };
  }
}
