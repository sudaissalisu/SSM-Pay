/**
 * Monitoring Alert Management Module
 * 
 * Provides alert threshold management including:
 * - Alert creation and configuration
 * - Threshold evaluation
 * - Active alert tracking
 * - Callback execution on trigger
 * 
 * @module services/monitoring/alerts
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import { Metric } from './metrics';

// ============== Type Definitions ==============

/**
 * Alert severity levels for threshold violations
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Time window options (re-exported for convenience)
 */
export type { TimeWindow } from './performance';

/**
 * Alert definition for threshold monitoring
 */
export interface AlertThreshold {
  /** Unique alert identifier */
  id: string;
  /** Metric name to monitor */
  metricName: string;
  /** Condition to evaluate */
  condition: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  /** Threshold value */
  value: number;
  /** Alert severity when triggered */
  severity: AlertSeverity;
  /** Whether the alert is currently active */
  isActive: boolean;
  /** Time window for evaluation */
  timeWindow: import('./performance').TimeWindow;
  /** Human-readable description */
  description: string;
  /** Callback function when triggered */
  onTrigger?: (alert: ActiveAlert) => void;
  /** Created timestamp */
  createdAt: Date;
  /** Last triggered timestamp */
  lastTriggeredAt?: Date;
  /** Total trigger count */
  triggerCount: number;
}

/**
 * Currently active alert
 */
export interface ActiveAlert extends AlertThreshold {
  /** Current metric value that triggered the alert */
  currentValue: number;
  /** When this instance was triggered */
  triggeredAt: Date;
  /** Resolved timestamp if applicable */
  resolvedAt?: Date;
}

// ============== Alerts Manager Class ==============

/**
 * Alerts Manager
 * 
 * Manages alert thresholds and active alerts.
 */
export class AlertsManager {
  /** Registered alert thresholds */
  private alerts: Map<string, AlertThreshold> = new Map();
  
  /** Currently active alerts */
  private activeAlerts: Map<string, ActiveAlert> = new Map();
  
  /** Reference to metrics for value retrieval */
  private getMetric: (name: string) => Metric | undefined;

  constructor(getMetric: (name: string) => Metric | undefined) {
    this.getMetric = getMetric;
  }

  /**
   * Create a new alert threshold
   */
  createAlert(options: {
    id: string;
    metricName: string;
    condition: AlertThreshold['condition'];
    value: number;
    severity: AlertSeverity;
    timeWindow?: import('./performance').TimeWindow;
    description?: string;
    onTrigger?: (alert: ActiveAlert) => void;
  }): AlertThreshold {
    if (this.alerts.has(options.id)) {
      throw new AppError(
        `Alert '${options.id}' already exists`,
        ErrorCode.VALIDATION_ERROR,
        { severity: 'warning' }
      );
    }

    const alert: AlertThreshold = {
      id: options.id,
      metricName: options.metricName,
      condition: options.condition,
      value: options.value,
      severity: options.severity,
      isActive: false,
      timeWindow: options.timeWindow || '5m',
      description: options.description || `Alert when ${options.metricName} ${options.condition} ${options.value}`,
      onTrigger: options.onTrigger,
      createdAt: new Date(),
      triggerCount: 0,
    };

    this.alerts.set(alert.id, alert);
    logger.info(`Created alert: ${options.id}`, { event: 'alert.created', metadata: { alertId: options.id } });
    
    return alert;
  }

  /**
   * Remove an alert threshold
   */
  removeAlert(id: string): boolean {
    const deleted = this.alerts.delete(id);
    this.activeAlerts.delete(id);
    
    if (deleted) {
      logger.info(`Removed alert: ${id}`, { event: 'alert.removed', metadata: { alertId: id } });
    }
    
    return deleted;
  }

  /**
   * Evaluate a specific alert against current metric values
   */
  evaluateAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    const metric = this.getMetric(alert.metricName);
    if (!metric) {
      return false;
    }

    // Get value based on metric type
    let currentValue: number;
    if (metric.type === 'histogram') {
      currentValue = (metric as import('./metrics').HistogramMetric).sum / 
        Math.max((metric as import('./metrics').HistogramMetric).count, 1);
    } else {
      currentValue = (metric as import('.CounterMetric | .GaugeMetric').CounterMetric | import('.GaugeMetric').GaugeMetric).value;
    }
    
    const isTriggered = this.evaluateCondition(currentValue, alert.condition, alert.value);

    if (isTriggered && !alert.isActive) {
      // Alert is newly triggered
      alert.isActive = true;
      alert.lastTriggeredAt = new Date();
      alert.triggerCount++;

      const activeAlert: ActiveAlert = {
        ...alert,
        currentValue,
        triggeredAt: alert.lastTriggeredAt,
      };

      this.activeAlerts.set(alertId, activeAlert);

      logger.warn(`Alert triggered: ${alertId}`, {
        event: 'alert.triggered',
        metadata: {
          alertId,
          metricName: alert.metricName,
          currentValue,
          threshold: alert.value,
          severity: alert.severity,
        },
      });

      // Execute callback if defined
      if (alert.onTrigger) {
        try {
          alert.onTrigger(activeAlert);
        } catch (error) {
          logger.error('Alert callback execution failed', {
            event: 'alert.callback_error',
            error: error instanceof Error ? error : new AppError(String(error)),
          });
        }
      }
    } else if (!isTriggered && alert.isActive) {
      // Alert is resolved
      alert.isActive = false;
      const activeAlert = this.activeAlerts.get(alertId);
      if (activeAlert) {
        activeAlert.resolvedAt = new Date();
      }

      logger.info(`Alert resolved: ${alertId}`, {
        event: 'alert.resolved',
        metadata: { alertId, resolvedAt: new Date().toISOString() },
      });
    }

    return isTriggered;
  }

  /**
   * Evaluate all registered alerts
   */
  evaluateAllAlerts(): ActiveAlert[] {
    const newlyTriggered: ActiveAlert[] = [];

    for (const alertId of Array.from(this.alerts.keys())) {
      const wasActive = this.alerts.get(alertId)?.isActive;
      const isTriggered = this.evaluateAlert(alertId);
      
      if (isTriggered && !wasActive) {
        const active = this.activeAlerts.get(alertId);
        if (active) {
          newlyTriggered.push(active);
        }
      }
    }

    return newlyTriggered;
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): ActiveAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get all registered alert thresholds
   */
  getAllAlerts(): AlertThreshold[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get a specific alert by ID
   */
  getAlert(id: string): AlertThreshold | undefined {
    return this.alerts.get(id);
  }

  /**
   * Check if an alert is currently active
   */
  isAlertActive(id: string): boolean {
    return this.activeAlerts.has(id);
  }

  /**
   * Clear all active alerts
   */
  clearActiveAlerts(): number {
    const count = this.activeAlerts.size;
    this.activeAlerts.clear();
    
    // Reset all alerts to inactive
    for (const alert of this.alerts.values()) {
      alert.isActive = false;
    }
    
    return count;
  }

  /**
   * Evaluate numeric condition
   */
  evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }
}
