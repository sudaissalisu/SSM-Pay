/**
 * @module services/monitoring
 * 
 * Re-exports from the monitoring module for backward compatibility.
 * The actual implementation has been split into focused sub-modules.
 */

export {
  MonitoringService,
  monitoringService,
  // Types
  MetricType,
  MetricLabels,
  HealthStatus,
  AlertSeverity,
  TimeWindow,
  BaseMetric,
  CounterMetric,
  GaugeMetric,
  HistogramMetric,
  HistogramBucket,
  Metric,
  HealthCheckResult,
  SystemHealth,
  PerformanceRecord,
  PerformanceStats,
  ErrorRateEntry,
  AlertThreshold,
  ActiveAlert,
  DashboardDataPoint,
  DashboardWidget,
  DashboardState,
  CreateMetricOptions,
  TimeWindowQuery,
  // Constants
  DEFAULT_LATENCY_BUCKETS,
  MAX_DATA_POINTS_PER_METRIC,
  HEALTH_CHECK_TIMEOUT_MS,
  APP_VERSION,
  APPLICATION_START_TIME,
  // Classes
  MetricsManager,
  HealthManager,
  PerformanceTracker,
  AlertsManager,
  DashboardGenerator,
  // Utilities
  trackPerformance,
  trackAsyncOperation,
} from './monitoring/index';

export { default } from './monitoring/index';
