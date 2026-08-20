/**
 * Alert Management Service
 * Evaluates alert rules and sends notifications
 */

import {
  AlertRule,
  AlertSeverity,
  ActiveAlert,
  NotificationChannel,
  MetricPoint,
} from './types';
import { MetricsCollector } from './metrics';

/** Alert manager configuration */
export interface AlertsConfig {
  maxActiveAlerts: number;
  defaultCooldownSeconds: number;
  enableThrottling: boolean;
  maxAlertsPerHourPerChannel: number;
}

const DEFAULT_CONFIG: AlertsConfig = {
  maxActiveAlerts: 1000,
  defaultCooldownSeconds: 300,
  enableThrottling: true,
  maxAlertsPerHourPerChannel: 100,
}

/** Alert notification payload */
export interface AlertNotification {
  alertId: string;
  ruleName: string;
  severity: AlertSeverity;
  message: string;
  currentValue: number;
  threshold: number;
  triggeredAt: string;
}

interface ChannelRateLimit { count: number; windowStart: Date; }

/**
 * AlertManager - Evaluates rules and manages alert lifecycle
 */
export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, ActiveAlert> = new Map();
  private channels: Map<string, NotificationChannel> = new Map();
  private config: AlertsConfig;
  private metrics: MetricsCollector;
  private rateLimits: Map<string, ChannelRateLimit> = new Map();

  constructor(config: Partial<AlertsConfig> = {}, metrics?: MetricsCollector) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = metrics || new MetricsCollector();
  }

  /** Create a new alert rule */
  createRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): AlertRule {
    const id = rule.id || this.generateId();
    const now = new Date().toISOString();
    const fullRule: AlertRule = { ...rule, id, createdAt: now, updatedAt: now };
    this.rules.set(id, fullRule);
    console.log(`[Alert] Rule created: ${rule.name} (${id})`);
    return fullRule;
  }

  /** Update an existing rule */
  updateRule(ruleId: string, updates: Partial<Omit<AlertRule, 'id' | 'createdAt'>>): AlertRule | null {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;
    Object.assign(rule, updates, { updatedAt: new Date().toISOString() });
    return rule;
  }

  /** Delete an alert rule */
  deleteRule(ruleId: string): boolean {
    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.ruleId === ruleId) this.resolveAlert(alertId);
    }
    return this.rules.delete(ruleId);
  }

  /** Get a rule by ID */
  getRule(ruleId: string): AlertRule | undefined { return this.rules.get(ruleId); }

  /** Get all rules optionally filtered by enabled status */
  getRules(enabledOnly?: boolean): AlertRule[] {
    let rules = Array.from(this.rules.values());
    return enabledOnly ? rules.filter((r) => r.enabled) : rules;
  }

  /** Evaluate all enabled rules against current metrics */
  evaluateRules(metricsData: MetricPoint[]): ActiveAlert[] {
    const results: ActiveAlert[] = [];
    for (const [, rule] of this.rules) {
      if (!rule.enabled) continue;
      try {
        const result = this.evaluateRule(rule, metricsData);
        if (result) results.push(result);
      } catch (error) {
        console.error(`[Alert] Error evaluating rule ${rule.name}:`, error);
      }
    }
    return results;
  }

  /** Acknowledge an active alert */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert || alert.status !== 'firing') return false;
    alert.status = 'acknowledged';
    alert.updatedAt = new Date().toISOString();
    console.log(`[Alert] Alert acknowledged: ${alertId}`);
    return true;
  }

  /** Resolve an active alert */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;
    alert.status = 'resolved';
    alert.updatedAt = new Date().toISOString();
    this.sendResolutionNotification(alert);
    this.activeAlerts.delete(alertId);
    console.log(`[Alert] Alert resolved: ${alertId}`);
    return true;
  }

  /** Get all active alerts */
  getActiveAlerts(): ActiveAlert[] { return Array.from(this.activeAlerts.values()); }

  /** Register a notification channel */
  registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel);
    console.log(`[Alert] Channel registered: ${channel.name} (${channel.type})`);
  }

  /** Send alert notification through configured channels */
  sendNotification(alert: ActiveAlert): void {
    const rule = this.rules.get(alert.ruleId);
    if (!rule) return;

    for (const channelId of rule.notificationChannels) {
      if (!this.checkRateLimit(channelId)) continue;
      const channel = this.channels.get(channelId);
      if (!channel || !channel.active) continue;

      const notification: AlertNotification = {
        alertId: alert.id, ruleName: alert.ruleName, severity: alert.severity,
        message: alert.message, currentValue: alert.currentValue,
        threshold: alert.threshold, triggeredAt: alert.triggeredAt,
      };
      this.dispatchNotification(channel, notification);
    }
  }

  // Private methods

  private evaluateRule(rule: AlertRule, metricsData: MetricPoint[]): ActiveAlert | null {
    let points = metricsData.filter((m) => m.name === rule.metricName);
    if (rule.labelFilters) {
      points = points.filter((m) =>
        Object.entries(rule.labelFilters).every(([k, v]) => m.labels[k] === v)
      );
    }
    if (points.length === 0) return null;

    const latestValue = points[points.length - 1].value;
    const isTriggered = this.compareValue(latestValue, rule.operator, rule.threshold);
    const existingAlert = this.findActiveAlertByRule(rule.id);

    if (isTriggered && existingAlert) {
      existingAlert.currentValue = latestValue;
      existingAlert.updatedAt = new Date().toISOString();
      existingAlert.fireCount++;
      if (this.shouldNotify(existingAlert)) this.sendNotification(existingAlert);
      return existingAlert;
    }

    if (isTriggered) {
      const alert = this.createAlert(rule, latestValue);
      if (this.activeAlerts.size >= this.config.maxActiveAlerts) this.evictOldestAlert();
      this.activeAlerts.set(alert.id, alert);
      this.sendNotification(alert);
      this.metrics.incrementCounter('alerts_fired_total', { severity: alert.severity });
      return alert;
    }

    if (existingAlert) this.resolveAlert(existingAlert.id);
    return null;
  }

  private shouldNotify(alert: ActiveAlert): boolean {
    if (!this.config.enableThrottling) return true;
    const rule = this.rules.get(alert.ruleId);
    if (!rule) return true;
    const elapsed = (Date.now() - new Date(alert.updatedAt).getTime()) / 1000;
    return elapsed >= rule.cooldownSeconds;
  }

  private checkRateLimit(channelId: string): boolean {
    const now = new Date();
    let limit = this.rateLimits.get(channelId);
    if (!limit || now.getTime() - limit.windowStart.getTime() > 3600000) {
      limit = { count: 0, windowStart: now };
      this.rateLimits.set(channelId, limit);
    }
    if (limit.count >= this.config.maxAlertsPerHourPerChannel) return false;
    limit.count++;
    return true;
  }

  private dispatchNotification(channel: NotificationChannel, notification: AlertNotification): void {
    console.log(`[Alert] Sending via ${channel.type} to ${channel.name}:`, {
      severity: notification.severity, message: notification.message,
    });
  }

  private sendResolutionNotification(alert: ActiveAlert): void {
    console.log(`[Alert] Resolved: ${alert.ruleName} was active for ${alert.fireCount} fires`);
  }

  private createAlert(rule: AlertRule, value: number): ActiveAlert {
    const now = new Date().toISOString();
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ruleId: rule.id, ruleName: rule.name, severity: rule.severity,
      currentValue: value, threshold: rule.threshold,
      triggeredAt: now, updatedAt: now, status: 'firing',
      fireCount: 1,
      message: `${rule.name}: value ${value} ${rule.operator} threshold ${rule.threshold}`,
    };
  }

  private findActiveAlertByRule(ruleId: string): ActiveAlert | undefined {
    for (const alert of this.activeAlerts.values()) {
      if (alert.ruleId === ruleId && alert.status === 'firing') return alert;
    }
    return undefined;
  }

  private evictOldestAlert(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [id, alert] of this.activeAlerts) {
      const time = new Date(alert.triggeredAt).getTime();
      if (time < oldestTime) { oldestTime = time; oldest = id; }
    }
    if (oldest) this.resolveAlert(oldest);
  }

  private compareValue(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      case 'neq': return value !== threshold;
      default: return false;
    }
  }

  private generateId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
