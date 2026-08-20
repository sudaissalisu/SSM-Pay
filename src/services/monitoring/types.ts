/**
 * Monitoring Types for SSM-Pay Payment Platform
 * Defines interfaces and enums for metrics, health checks, and alerts
 */

/** Types of metrics that can be collected */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

/** Unit of measurement for metrics */
export enum MetricUnit {
  NONE = 'none',
  MILLISECONDS = 'milliseconds',
  BYTES = 'bytes',
  PERCENT = 'percent',
  COUNT = 'count',
  REQUESTS_PER_SECOND = 'requests_per_second',
}

/** A single metric data point */
export interface MetricPoint {
  /** Unique metric identifier */
  name: string;
  /** Type of metric */
  type: MetricType;
  /** Numeric value */
  value: number;
  /** Unit of measurement */
  unit: MetricUnit;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Key-value labels for grouping */
  labels: Record<string, string>;
  /** Optional description */
  description?: string;
}

/** Aggregated metric data over a time window */
export interface AggregatedMetric {
  /** Metric name */
  name: string;
  /** Metric type */
  type: MetricType;
  /** Statistical aggregations */
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  standardDeviation: number;
  /** Time window start */
  windowStart: string;
  /** Time window end */
  windowEnd: string;
  /** Labels that were aggregated */
  labels: Record<string, string>;
}

/** Health status levels */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

/** Individual health check result */
export interface HealthCheckResult {
  /** Name of the component being checked */
  componentName: string;
  /** Current health status */
  status: HealthStatus;
  /** Response time in milliseconds */
  responseTimeMs: number;
  /** Timestamp of check */
  timestamp: string;
  /** Additional details or error message */
  message?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/** Overall system health report */
export interface HealthReport {
  /** Overall system status (worst of all components) */
  overallStatus: HealthStatus;
  /** Individual component results */
  components: HealthCheckResult[];
  /** Report generation timestamp */
  generatedAt: string;
  /** System uptime in seconds */
  uptimeSeconds: number;
  /** Version information */
  version: string;
  /** Environment name */
  environment: string;
}

/** Alert severity levels */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency',
}

/** Alert rule definition */
export interface AlertRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this alert monitors */
  description: string;
  /** Metric to evaluate */
  metricName: string;
  /** Comparison operator */
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq';
  /** Threshold value */
  threshold: number;
  /** Duration condition must be met (seconds) */
  durationSeconds: number;
  /** Severity level when triggered */
  severity: AlertSeverity;
  /** Whether rule is currently enabled */
  enabled: boolean;
  /** Labels filter (all must match) */
  labelFilters?: Record<string, string>;
  /** Notification channels */
  notificationChannels: string[];
  /** Cooldown between alerts (seconds) */
  cooldownSeconds: number;
  /** Creation timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
}

/** Active alert instance */
export interface ActiveAlert {
  /** Alert ID */
  id: string;
  /** Rule that triggered this alert */
  ruleId: string;
  /** Rule name */
  ruleName: string;
  /** Current severity */
  severity: AlertSeverity;
  /** Current metric value */
  currentValue: number;
  /** Threshold that was crossed */
  threshold: number;
  /** When alert was first triggered */
  triggeredAt: string;
  /** Last updated timestamp */
  updatedAt: string;
  /** Current status */
  status: 'firing' | 'acknowledged' | 'resolved';
  /** Number of times this alert has fired */
  fireCount: number;
  /** Annotation message */
  message: string;
}

/** Notification channel configuration */
export interface NotificationChannel {
  /** Channel ID */
  id: string;
  /** Channel type */
  type: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'sms';
  /** Human-readable name */
  name: string;
  /** Whether channel is active */
  active: boolean;
  /** Channel-specific configuration */
  config: Record<string, unknown>;
  /** Created at */
  createdAt: string;
}

/** Dashboard widget types */
export enum WidgetType {
  LINE_CHART = 'line_chart',
  BAR_CHART = 'bar_chart',
  GAUGE = 'gauge',
  TABLE = 'table',
  NUMBER = 'number',
  STATUS_GRID = 'status_grid',
}

/** Dashboard configuration */
export interface DashboardConfig {
  /** Dashboard ID */
  id: string;
  /** Display name */
  name: string;
  /** Widget definitions */
  widgets: DashboardWidget[];
  /** Refresh interval (seconds) */
  refreshIntervalSeconds: number;
  /** Default time range (seconds) */
  defaultTimeRangeSeconds: number;
  /** Owner/creator */
  owner: string;
  /** Created at */
  createdAt: string;
}

/** Single dashboard widget */
export interface DashboardWidget {
  /** Widget ID */
  id: string;
  /** Widget title */
  title: string;
  /** Widget type */
  type: WidgetType;
  /** Metrics to display */
  metrics: string[];
  /** Widget position/size */
  layout: { x: number; y: number; width: number; height: number };
  /** Widget-specific configuration */
  config: Record<string, unknown>;
}

/** Performance snapshot for tracking */
export interface PerformanceSnapshot {
  /** Snapshot ID */
  id: string;
  /** Request/response identifier */
  requestId: string;
  /** Endpoint or operation name */
  operation: string;
  /** HTTP method if applicable */
  method?: string;
  /** Start timestamp */
  startTime: string;
  /** End timestamp */
  endTime: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Status code */
  statusCode: number;
  /** Success flag */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Request size in bytes */
  requestSizeBytes?: number;
  /** Response size in bytes */
  responseSizeBytes?: number;
  /** Custom tags */
  tags: Record<string, string>;
}
