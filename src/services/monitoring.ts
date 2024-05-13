/**
 * Enterprise Monitoring & Observability Service for SSM-Pay Payment Platform
 * 
 * Provides comprehensive application metrics collection, health checks,
 * performance tracking, error rate monitoring, alert management,
 * and dashboard data generation.
 * 
 * @module services/monitoring
 * @version 1.0.0
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Type Definitions ==============

/**
 * Metric types supported by the monitoring system
 */
export type MetricType = 'counter' | 'gauge' | 'histogram';

/**
 * Label/tag key-value pairs for metric dimensions
 */
export type MetricLabels = Record<string, string | number | boolean>;

/**
 * Health status levels for system components
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Alert severity levels for threshold violations
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Time window options for aggregated metrics
 */
export type TimeWindow = '1m' | '5m' | '15m' | '1h' | '6h' | '24h' | '7d';

/**
 * Base metric interface for all metric types
 */
export interface BaseMetric {
  /** Unique identifier for the metric */
  name: string;
  /** Human-readable description */
  description: string;
  /** Type of metric */
  type: MetricType;
  /** Labels/tags for dimensionality */
  labels: MetricLabels;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Counter metric - monotonically increasing value
 */
export interface CounterMetric extends BaseMetric {
  type: 'counter';
  /** Current counter value */
  value: number;
  /** Total increments since creation */
  totalIncrements: number;
}

/**
 * Gauge metric - point-in-time value that can go up or down
 */
export interface GaugeMetric extends BaseMetric {
  type: 'gauge';
  /** Current gauge value */
  value: number;
  /** Minimum value recorded */
  min: number;
  /** Maximum value recorded */
  max: number;
}

/**
 * Histogram bucket for distribution tracking
 */
export interface HistogramBucket {
  /** Upper bound of the bucket */
  upperBound: number;
  /** Count of observations in this bucket */
  count: number;
}

/**
 * Histogram metric - distribution of values
 */
export interface HistogramMetric extends BaseMetric {
  type: 'histogram';
  /** Total count of observations */
  count: number;
  /** Sum of all observations */
  sum: number;
  /** Distribution buckets */
  buckets: HistogramBucket[];
  /** Calculated percentiles (updated on request) */
  percentiles?: Record<number, number>;
}

/**
 * Union type for all metric types
 */
export type Metric = CounterMetric | GaugeMetric | HistogramMetric;

/**
 * Health check result for a single component
 */
export interface HealthCheckResult {
  /** Component identifier */
  component: string;
  /** Current health status */
  status: HealthStatus;
  /** Human-readable message */
  message?: string;
  /** Response time in milliseconds */
  responseTimeMs?: number;
  /** Additional details */
  details?: Record<string, unknown>;
  /** Error message if check failed */
  error?: string;
  /** Timestamp of the check */
  timestamp: Date;
}

/**
 * Overall system health status
 */
export interface SystemHealth {
  /** Overall system status */
  status: HealthStatus;
  /** Individual component checks */
  checks: HealthCheckResult[];
  /** System uptime in seconds */
  uptimeSeconds: number;
  /** Timestamp of the health assessment */
  timestamp: Date;
  /** Version information */
  version: string;
}

/**
 * Performance measurement record
 */
export interface PerformanceRecord {
  /** Operation/method name */
  operation: string;
  /** Response time in milliseconds */
  durationMs: number;
  /** Timestamp of the measurement */
  timestamp: Date;
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Additional context */
  labels?: MetricLabels;
}

/**
 * Aggregated performance statistics
 */
export interface PerformanceStats {
  /** Operation name */
  operation: string;
  /** Total number of calls */
  totalCount: number;
  /** Number of successful calls */
  successCount: number;
  /** Number of failed calls */
  errorCount: number;
  /** Average response time in ms */
  avgDurationMs: number;
  /** Minimum response time in ms */
  minDurationMs: number;
  /** Maximum response time in ms */
  maxDurationMs: number;
  /** P50 (median) response time in ms */
  p50Ms: number;
  /** P95 response time in ms */
  p95Ms: number;
  /** P99 response time in ms */
  p99Ms: number;
  /** Error rate as percentage (0-100) */
  errorRate: number;
  /** Throughput (requests per second) */
  throughput: number;
}

/**
 * Error rate tracking entry
 */
export interface ErrorRateEntry {
  /** Error code or category */
  errorCode: string;
  /** Count of errors in current window */
  count: number;
  /** Error rate percentage */
  rate: number;
  /** Trend direction ('up', 'down', 'stable') */
  trend: 'up' | 'down' | 'stable';
  /** Previous window count for comparison */
  previousCount: number;
}

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
  timeWindow: TimeWindow;
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
  timeRange: TimeWindow;
}

/**
 * Options for creating custom metrics
 */
export interface CreateMetricOptions {
  /** Metric name (required) */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Initial labels */
  labels?: MetricLabels;
  /** Default histogram buckets (for histograms) */
  buckets?: number[];
}

/**
 * Options for time-windowed queries
 */
export interface TimeWindowQuery {
  /** Time window size */
  window: TimeWindow;
  /** Optional start time override */
  startTime?: Date;
  /** Optional end time override */
  endTime?: Date;
  /** Filter by labels */
  labelFilters?: MetricLabels;
}

// ============== Constants ==============

/** Default histogram buckets for latency measurements */
const DEFAULT_LATENCY_BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/** Default time window in milliseconds for aggregation */
const DEFAULT_AGGREGATION_WINDOW_MS = 60000; // 1 minute

/** Maximum number of data points retained per metric */
const MAX_DATA_POINTS_PER_METRIC = 10080; // 7 days at 1-minute intervals

/** Health check timeout in milliseconds */
const HEALTH_CHECK_TIMEOUT_MS = 5000;

/** Application version from environment or default */
const APP_VERSION = process.env.npm_package_version || '1.0.0';

/** Application start time for uptime calculation */
const APPLICATION_START_TIME = Date.now();

// ============== Main Monitoring Class ==============

/**
 * Enterprise-grade Monitoring & Observability Service
 * 
 * Provides comprehensive metrics collection, health checking,
 * performance monitoring, alerting, and dashboard generation.
 * 
 * @example
 * ```typescript
 * import { monitoringService } from '@/services/monitoring';
 * 
 * // Record a counter increment
 * monitoringService.incrementCounter('payment.requests.total', { method: 'initiate' });
 * 
 * // Track performance
 * const stopTimer = monitoringService.startTimer('api.payment.init');
 * // ... do work ...
 * stopTimer({ success: true });
 * 
 * // Check system health
 * const health = await monitoringService.getSystemHealth();
 * ```
 */
class MonitoringService {
  // ============== Private State ==============
  
  /** Storage for all registered metrics */
  private metrics: Map<string, Metric> = new Map();
  
  /** Performance records for time-windowed analysis */
  private performanceRecords: Map<string, PerformanceRecord[]> = new Map();
  
  /** Error tracking counts */
  private errorCounts: Map<string, { count: number; timestamps: Date[] }> = new Map();
  
  /** Registered alert thresholds */
  private alerts: Map<string, AlertThreshold> = new Map();
  
  /** Currently active alerts */
  private activeAlerts: Map<string, ActiveAlert> = new Map();
  
  /** Health check registry */
  private healthChecks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  
  /** Historical data points for dashboard visualization */
  private historicalData: Map<string, DashboardDataPoint[]> = new Map();
  
  /** Cleanup interval handle */
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  /** Whether the service has been initialized */
  private initialized: boolean = false;

  // ============== Initialization ==============

  /**
   * Initialize the monitoring service
   * Sets up built-in metrics, starts background tasks
   */
  initialize(): void {
    if (this.initialized) {
      logger.warn('Monitoring service already initialized', { event: 'monitoring.init' });
      return;
    }

    logger.info('Initializing monitoring service', { event: 'monitoring.init' });

    // Register built-in metrics
    this.registerBuiltInMetrics();
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    this.initialized = true;
    logger.info('Monitoring service initialized successfully', { event: 'monitoring.ready' });
  }

  /**
   * Register built-in application metrics
   * @private
   */
  private registerBuiltInMetrics(): void {
    // Request counters
    this.createCounter('http_requests_total', 'Total HTTP requests received');
    this.createCounter('http_requests_success_total', 'Total successful HTTP requests');
    this.createCounter('http_requests_error_total', 'Total failed HTTP requests');
    
    // Payment-specific counters
    this.createCounter('payments_initiated_total', 'Total payment initiations');
    this.createCounter('payments_completed_total', 'Total completed payments');
    this.createCounter('payments_failed_total', 'Total failed payments');
    this.createCounter('payments_refunded_total', 'Total refunded payments');
    
    // Latency histograms
    this.createHistogram('http_request_duration_ms', 'HTTP request duration in milliseconds');
    this.createHistogram('payment_processing_duration_ms', 'Payment processing duration in milliseconds');
    this.createHistogram('external_api_call_duration_ms', 'External API call duration in milliseconds');
    
    // Gauges for current state
    this.createGauge('active_connections', 'Currently active connections');
    this.createGauge('pending_payments', 'Payments awaiting completion');
    this.createGauge('queue_depth', 'Current processing queue depth');
    
    // Business metrics
    this.createCounter('revenue_total', 'Total revenue processed', { unit: 'minor_units' });
    this.createGauge('average_transaction_value', 'Average transaction value');
  }

  /**
   * Start the background cleanup interval
   * @private
   */
  private startCleanupInterval(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      try {
        this.cleanupOldData();
        this.evaluateAllAlerts();
      } catch (error) {
        logger.error('Error in monitoring cleanup cycle', {
          event: 'monitoring.error',
          error: error instanceof Error ? error : new AppError(String(error)),
        });
      }
    }, 5 * 60 * 1000);
    
    // Don't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Clean up old data beyond retention period
   * @private
   */
  private cleanupOldData(): void {
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    // Clean up performance records
    for (const [key, records] of Array.from(this.performanceRecords.entries())) {
      const filtered = records.filter(r => r.timestamp > cutoffTime);
      if (filtered.length !== records.length) {
        this.performanceRecords.set(key, filtered);
      }
    }
    
    // Clean up historical data
    for (const [key, dataPoints] of Array.from(this.historicalData.entries())) {
      const filtered = dataPoints.filter(d => d.timestamp > cutoffTime);
      if (filtered.length !== dataPoints.length) {
        this.historicalData.set(key, filtered.slice(-MAX_DATA_POINTS_PER_METRIC));
      }
    }
    
    // Clean up error timestamps
    for (const [key, data] of Array.from(this.errorCounts.entries())) {
      const filteredTimestamps = data.timestamps.filter(t => t > cutoffTime);
      if (filteredTimestamps.length !== data.timestamps.length) {
        this.errorCounts.set(key, {
          count: filteredTimestamps.length,
          timestamps: filteredTimestamps,
        });
      }
    }

    logger.debug('Completed monitoring data cleanup', {
      event: 'monitoring.cleanup',
      metadata: { cutoffTime: cutoffTime.toISOString() },
    });
  }

  // ============== Counter Metrics ==============

  /**
   * Create a new counter metric
   * @param name - Unique metric name
   * @param description - Human-readable description
   * @param labels - Initial labels
   * @returns The created counter metric
   * @throws {AppError} If metric already exists
   */
  createCounter(
    name: string,
    description: string = '',
    labels: MetricLabels = {}
  ): CounterMetric {
    if (this.metrics.has(name)) {
      throw new AppError(
        `Metric '${name}' already exists`,
        ErrorCode.VALIDATION_ERROR,
        { severity: 'warning' }
      );
    }

    const now = new Date();
    const counter: CounterMetric = {
      name,
      description,
      type: 'counter',
      labels: { ...labels },
      value: 0,
      totalIncrements: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.metrics.set(name, counter);
    logger.debug(`Created counter metric: ${name}`, { event: 'metric.created', metadata: { name, type: 'counter' } });
    
    return counter;
  }

  /**
   * Increment a counter metric
   * @param name - Metric name to increment
   * @param amount - Amount to add (default: 1)
   * @param labels - Additional labels for this increment
   * @throws {AppError} If metric doesn't exist or is not a counter
   */
  incrementCounter(
    name: string,
    amount: number = 1,
    labels: MetricLabels = {}
  ): void {
    const metric = this.metrics.get(name);
    
    if (!metric) {
      // Auto-create if doesn't exist
      this.createCounter(name);
      return this.incrementCounter(name, amount, labels);
    }
    
    if (metric.type !== 'counter') {
      throw new AppError(
        `Metric '${name}' is not a counter`,
        ErrorCode.VALIDATION_ERROR,
        { severity: 'warning' }
      );
    }

    metric.value += amount;
    metric.totalIncrements++;
    metric.updatedAt = new Date();
    
    // Merge labels if provided
    if (Object.keys(labels).length > 0) {
      metric.labels = { ...metric.labels, ...labels };
    }

    // Record historical data point
    this.recordHistoricalDataPoint(name, metric.value);
  }

  /**
   * Get current counter value
   * @param name - Counter metric name
   * @returns Current counter value
   */
  getCounterValue(name: string): number {
    const metric = this.metrics.get(name);
    
    if (!metric || metric.type !== 'counter') {
      return 0;
    }
    
    return metric.value;
  }

  // ============== Gauge Metrics ==============

  /**
   * Create a new gauge metric
   * @param name - Unique metric name
   * @param description - Human-readable description
   * @param labels - Initial labels
   * @returns The created gauge metric
   */
  createGauge(
    name: string,
    description: string = '',
    labels: MetricLabels = {}
  ): GaugeMetric {
    if (this.metrics.has(name)) {
      throw new AppError(
        `Metric '${name}' already exists`,
        ErrorCode.VALIDATION_ERROR,
        { severity: 'warning' }
      );
    }

    const now = new Date();
    const gauge: GaugeMetric = {
      name,
      description,
      type: 'gauge',
      labels: { ...labels },
      value: 0,
      min: Infinity,
      max: -Infinity,
      createdAt: now,
      updatedAt: now,
    };

    this.metrics.set(name, gauge);
    logger.debug(`Created gauge metric: ${name}`, { event: 'metric.created', metadata: { name, type: 'gauge' } });
    
    return gauge;
  }

  /**
   * Set a gauge metric value
   * @param name - Gauge metric name
   * @param value - Value to set
   * @param labels - Additional labels
   */
  setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    let metric = this.metrics.get(name) as GaugeMetric | undefined;
    
    if (!metric) {
      this.createGauge(name);
      metric = this.metrics.get(name) as GaugeMetric;
    }
    
    if (metric!.type !== 'gauge') {
      throw new AppError(
        `Metric '${name}' is not a gauge`,
        ErrorCode.VALIDATION_ERROR,
        { severity: 'warning' }
      );
    }

    metric!.value = value;
    metric!.min = Math.min(metric!.min, value);
    metric!.max = Math.max(metric!.max, value);
    metric!.updatedAt = new Date();
    
    if (Object.keys(labels).length > 0) {
      metric!.labels = { ...metric!.labels, ...labels };
    }

    this.recordHistoricalDataPoint(name, value);
  }

  /**
   * Increment a gauge metric
   * @param name - Gauge metric name
   * @param amount - Amount to add
   */
  incrementGauge(name: string, amount: number = 1): void {
    const metric = this.metrics.get(name) as GaugeMetric | undefined;
    const currentValue = metric?.value ?? 0;
    this.setGauge(name, currentValue + amount);
  }

  /**
   * Decrement a gauge metric
   * @param name - Gauge metric name
   * @param amount - Amount to subtract
   */
  decrementGauge(name: string, amount: number = 1): void {
    const metric = this.metrics.get(name) as GaugeMetric | undefined;
    const currentValue = metric?.value ?? 0;
    this.setGauge(name, currentValue - amount);
  }

  /**
   * Get current gauge value
   * @param name - Gauge metric name
   * @returns Current gauge value or undefined
   */
  getGaugeValue(name: string): number | undefined {
    const metric = this.metrics.get(name);
    
    if (!metric || metric.type !== 'gauge') {
      return undefined;
    }
    
    return metric.value;
  }

  // ============== Histogram Metrics ==============

  /**
   * Create a new histogram metric
   * @param name - Unique metric name
   * @param description - Human-readable description
   * @param buckets - Bucket boundaries
   * @param labels - Initial labels
   * @returns The created histogram metric
   */
  createHistogram(
    name: string,
    description: string = '',
    buckets: number[] = DEFAULT_LATENCY_BUCKETS,
    labels: MetricLabels = {}
  ): HistogramMetric {
    if (this.metrics.has(name)) {
      throw new AppError(
        `Metric '${name}' already exists`,
        ErrorCode.VALIDATION_ERROR,
        { severity: 'warning' }
      );
    }

    // Sort buckets and ensure they're positive
    const sortedBuckets = [...buckets].filter(b => b > 0).sort((a, b) => a - b);

    const now = new Date();
    const histogram: HistogramMetric = {
      name,
      description,
      type: 'histogram',
      labels: { ...labels },
      count: 0,
      sum: 0,
      buckets: sortedBuckets.map(upperBound => ({
        upperBound,
        count: 0,
      })),
      createdAt: now,
      updatedAt: now,
    };

    this.metrics.set(name, histogram);
    logger.debug(`Created histogram metric: ${name}`, { event: 'metric.created', metadata: { name, type: 'histogram' } });
    
    return histogram;
  }

  /**
   * Observe a value in a histogram
   * @param name - Histogram metric name
   * @param value - Value to observe
   * @param labels - Additional labels
   */
  observeHistogram(name: string, value: number, labels: MetricLabels = {}): void {
    let metric = this.metrics.get(name) as HistogramMetric | undefined;
    
    if (!metric) {
      this.createHistogram(name);
      metric = this.metrics.get(name) as HistogramMetric;
    }
    
    if (metric!.type !== 'histogram') {
      throw new AppError(
        `Metric '${name}' is not a histogram`,
        ErrorCode.VALIDATION_ERROR,
        { severity: 'warning' }
      );
    }

    // Update basic stats
    metric!.count++;
    metric!.sum += value;
    metric!.updatedAt = new Date();

    // Find appropriate bucket
    for (const bucket of metric!.buckets) {
      if (value <= bucket.upperBound) {
        bucket.count++;
      }
    }

    // Merge labels
    if (Object.keys(labels).length > 0) {
      metric!.labels = { ...metric!.labels, ...labels };
    }

    // Record raw value for percentile calculations
    this.recordHistoricalDataPoint(`${name}_raw`, value);
  }

  /**
   * Get histogram statistics including percentiles
   * @param name - Histogram metric name
   * @returns Histogram with calculated percentiles
   */
  getHistogramStats(name: string): HistogramMetric | null {
    const metric = this.metrics.get(name);
    
    if (!metric || metric.type !== 'histogram') {
      return null;
    }

    // Get all observed values for percentile calculation
    const rawData = this.historicalData.get(`${name}_raw`) || [];
    const values = rawData.map(d => d.value).sort((a, b) => a - b);

    if (values.length > 0) {
      metric.percentiles = {
        50: this.calculatePercentile(values, 50),
        90: this.calculatePercentile(values, 90),
        95: this.calculatePercentile(values, 95),
        99: this.calculatePercentile(values, 99),
      };
    }

    return metric;
  }

  /**
   * Calculate percentile from sorted values
   * @private
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
  }

  // ============== Performance Tracking ==============

  /**
   * Start a timer for performance measurement
   * @param operation - Name of the operation being timed
   * @returns Function to call when operation completes
   * 
   * @example
   * ```typescript
   * const endTimer = monitoringService.startTimer('database.query');
   * // ... perform operation ...
   * endTimer({ success: true });
   * ```
   */
  startTimer(operation: string): (result?: { success: boolean; error?: string; labels?: MetricLabels }) => number {
    const startTime = Date.now();
    
    return (result?: { success: boolean; error?: string; labels?: MetricLabels }): number => {
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      
      const record: PerformanceRecord = {
        operation,
        durationMs,
        timestamp: new Date(startTime),
        success: result?.success ?? true,
        error: result?.error,
        labels: result?.labels,
      };
      
      // Store performance record
      const records = this.performanceRecords.get(operation) || [];
      records.push(record);
      this.performanceRecords.set(operation, records);
      
      // Update corresponding histogram if exists
      const histogramName = `${operation}_duration_ms`;
      if (this.metrics.has(histogramName)) {
        this.observeHistogram(histogramName, durationMs, result?.labels);
      }
      
      return durationMs;
    };
  }

  /**
   * Get aggregated performance statistics for an operation
   * @param operation - Operation name
   * @param query - Time window query options
   * @returns Aggregated performance statistics
   */
  getPerformanceStats(operation: string, query?: TimeWindowQuery): PerformanceStats {
    const records = this.getFilteredPerformanceRecords(operation, query);
    
    if (records.length === 0) {
      return this.emptyPerformanceStats(operation);
    }
    
    const durations = records.map(r => r.durationMs).sort((a, b) => a - b);
    const successRecords = records.filter(r => r.success);
    const errorRecords = records.filter(r => !r.success);
    
    // Calculate time window for throughput
    const timeSpanMs = this.getTimeSpanMs(records, query);
    
    return {
      operation,
      totalCount: records.length,
      successCount: successRecords.length,
      errorCount: errorRecords.length,
      avgDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDurationMs: durations[0],
      maxDurationMs: durations[durations.length - 1],
      p50Ms: this.calculatePercentile(durations, 50),
      p95Ms: this.calculatePercentile(durations, 95),
      p99Ms: this.calculatePercentile(durations, 99),
      errorRate: (errorRecords.length / records.length) * 100,
      throughput: timeSpanMs > 0 ? (records.length / (timeSpanMs / 1000)) : 0,
    };
  }

  /**
   * Get performance stats for all operations
   * @param query - Time window query options
   * @returns Map of operation names to their stats
   */
  getAllPerformanceStats(query?: TimeWindowQuery): Map<string, PerformanceStats> {
    const stats = new Map<string, PerformanceStats>();
    
    for (const operation of Array.from(this.performanceRecords.keys())) {
      stats.set(operation, this.getPerformanceStats(operation, query));
    }
    
    return stats;
  }

  /**
   * Get empty performance stats placeholder
   * @private
   */
  private emptyPerformanceStats(operation: string): PerformanceStats {
    return {
      operation,
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
   * Get filtered performance records based on time window
   * @private
   */
  private getFilteredPerformanceRecords(operation: string, query?: TimeWindowQuery): PerformanceRecord[] {
    let records = this.performanceRecords.get(operation) || [];
    
    if (query) {
      const { startTime, endTime } = this.getTimeBounds(query.window, query.startTime, query.endTime);
      records = records.filter(r => r.timestamp >= startTime && r.timestamp <= endTime);
      
      // Apply label filters
      if (query.labelFilters) {
        records = records.filter(record => {
          if (!record.labels) return false;
          return Object.entries(query.labelFilters!).every(
            ([key, value]) => record.labels![key] === value
          );
        });
      }
    }
    
    return records;
  }

  /**
   * Calculate time span in milliseconds from records
   * @private
   */
  private getTimeSpanMs(records: PerformanceRecord[], query?: TimeWindowQuery): number {
    if (query?.startTime && query?.endTime) {
      return query.endTime.getTime() - query.startTime.getTime();
    }
    
    if (records.length < 2) {
      return records.length === 1 ? 60000 : 0; // Assume 1 minute for single record
    }
    
    return records[records.length - 1].timestamp.getTime() - records[0].timestamp.getTime();
  }

  // ============== Error Rate Monitoring ==============

  /**
   * Record an error occurrence
   * @param errorCode - Error code or category
   * @param error - Optional error object
   */
  recordError(errorCode: string, error?: Error | AppError): void {
    const now = new Date();
    const existing = this.errorCounts.get(errorCode) || { count: 0, timestamps: [] };
    
    existing.count++;
    existing.timestamps.push(now);
    
    this.errorCounts.set(errorCode, existing);
    
    // Increment error counter metric
    this.incrementCounter('errors_total', 1, { error_code: errorCode });
    
    logger.debug(`Recorded error: ${errorCode}`, {
      event: 'monitoring.error_recorded',
      metadata: { errorCode, totalErrors: existing.count },
      error,
    });
  }

  /**
   * Get error rates for all tracked error codes
   * @param window - Time window for rate calculation
   * @returns Array of error rate entries
   */
  getErrorRates(window: TimeWindow = '1h'): ErrorRateEntry[] {
    const { startTime } = this.getTimeBounds(window);
    const { startTime: prevStartTime } = this.getTimeBounds(window, undefined, startTime);
    
    const entries: ErrorRateEntry[] = [];
    
    for (const [errorCode, data] of Array.from(this.errorCounts.entries())) {
      const currentCount = data.timestamps.filter(t => t >= startTime).length;
      const previousCount = data.timestamps.filter(t => t >= prevStartTime && t < startTime).length;
      
      // Calculate rate (errors per minute)
      const windowMinutes = this.getWindowMinutes(window);
      const rate = currentCount / windowMinutes;
      
      // Determine trend
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (previousCount > 0) {
        const changeRatio = currentCount / previousCount;
        if (changeRatio > 1.2) trend = 'up';
        else if (changeRatio < 0.8) trend = 'down';
      }
      
      entries.push({
        errorCode,
        count: currentCount,
        rate,
        trend,
        previousCount,
      });
    }
    
    // Sort by count descending
    entries.sort((a, b) => b.count - a.count);
    
    return entries;
  }

  /**
   * Get total error count for a specific error code
   * @param errorCode - Error code to look up
   * @returns Total count or 0 if not found
   */
  getErrorCount(errorCode: string): number {
    return this.errorCounts.get(errorCode)?.count ?? 0;
  }

  // ============== Health Checks ==============

  /**
   * Register a custom health check
   * @param component - Component identifier
   * @param checkFn - Async function that performs the health check
   */
  registerHealthCheck(
    component: string,
    checkFn: () => Promise<HealthCheckResult>
  ): void {
    this.healthChecks.set(component, checkFn);
    logger.debug(`Registered health check for: ${component}`, { event: 'health.check_registered' });
  }

  /**
   * Perform liveness check (basic process health)
   * @returns Liveness health result
   */
  async checkLiveness(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Basic liveness - just check if we can respond
      return {
        component: 'liveness',
        status: 'healthy',
        message: 'Service is alive',
        responseTimeMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        component: 'liveness',
        status: 'unhealthy',
        message: 'Liveness check failed',
        responseTimeMs: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Perform readiness check (dependencies available)
   * @returns Readiness health result
   */
  async checkReadiness(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapLimitMB = memUsage.heapUsed / 1024 / 1024; // Note: heap limit not directly available
    const memoryHealthy = heapUsedMB < 500; // 500MB threshold
    
    checks.push({
      component: 'memory',
      status: memoryHealthy ? 'healthy' : 'degraded',
      message: `Heap usage: ${heapUsedMB.toFixed(2)}MB`,
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date(),
      details: { heapUsedMB, rssMB: memUsage.rss / 1024 / 1024 },
    });
    
    // Check event loop lag
    const eventLoopLag = await this.measureEventLoopLag();
    checks.push({
      component: 'event_loop',
      status: eventLoopLag < 100 ? 'healthy' : 'degraded',
      message: `Event loop lag: ${eventLoopLag.toFixed(2)}ms`,
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date(),
      details: { lagMs: eventLoopLag },
    });
    
    // Determine overall readiness
    const allHealthy = checks.every(c => c.status === 'healthy');
    const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
    
    return {
      component: 'readiness',
      status: hasUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded',
      message: `Readiness: ${checks.filter(c => c.status === 'healthy').length}/${checks.length} checks passing`,
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date(),
      details: { checks },
    };
  }

  /**
   * Perform deep health check (all components including dependencies)
   * @returns Complete system health status
   */
  async checkDeepHealth(): Promise<SystemHealth> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];
    
    // Run liveness check
    checks.push(await this.checkLiveness());
    
    // Run readiness check
    const readiness = await this.checkReadiness();
    checks.push(readiness);
    
    // Run all registered custom health checks
    for (const [component, checkFn] of Array.from(this.healthChecks.entries())) {
      try {
        // Add timeout to prevent hanging checks
        const result = await Promise.race([
          checkFn(),
          new Promise<HealthCheckResult>((resolve) =>
            setTimeout(() => resolve({
              component,
              status: 'unhealthy' as HealthStatus,
              message: 'Health check timeout',
              timestamp: new Date(),
            }), HEALTH_CHECK_TIMEOUT_MS)
          ),
        ]);
        checks.push(result);
      } catch (error) {
        checks.push({
          component,
          status: 'unhealthy',
          message: 'Health check threw error',
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
        });
      }
    }
    
    // Determine overall status
    const statuses = checks.map(c => c.status);
    let overallStatus: HealthStatus = 'healthy';
    
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    } else if (statuses.includes('unknown')) {
      overallStatus = 'unknown';
    }
    
    const uptimeSeconds = (Date.now() - APPLICATION_START_TIME) / 1000;
    
    return {
      status: overallStatus,
      checks,
      uptimeSeconds,
      timestamp: new Date(),
      version: APP_VERSION,
    };
  }

  /**
   * Alias for deep health check
   */
  async getSystemHealth(): Promise<SystemHealth> {
    return this.checkDeepHealth();
  }

  /**
   * Measure event loop lag
   * @private
   */
  private measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delta = Number(process.hrtime.bigint() - start) / 1e6; // Convert to ms
        resolve(delta);
      });
    });
  }

  // ============== Alert Threshold Management ==============

  /**
   * Create a new alert threshold
   * @param options - Alert configuration options
   * @returns The created alert threshold
   */
  createAlert(options: {
    id: string;
    metricName: string;
    condition: AlertThreshold['condition'];
    value: number;
    severity: AlertSeverity;
    timeWindow?: TimeWindow;
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
   * @param id - Alert ID to remove
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
   * @param alertId - Alert ID to evaluate
   * @returns Whether the alert is currently triggering
   */
  evaluateAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    const metric = this.metrics.get(alert.metricName);
    if (!metric) {
      return false;
    }

    // Get value based on metric type
    let currentValue: number;
    if (metric.type === 'histogram') {
      currentValue = (metric as HistogramMetric).sum / Math.max((metric as HistogramMetric).count, 1);
    } else {
      currentValue = (metric as CounterMetric | GaugeMetric).value;
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
   * @returns Array of newly triggered alerts
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
   * @returns Array of currently active alerts
   */
  getActiveAlerts(): ActiveAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get all registered alert thresholds
   * @returns Array of alert configurations
   */
  getAllAlerts(): AlertThreshold[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Evaluate numeric condition
   * @private
   */
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  // ============== Dashboard Data Generation ==============

  /**
   * Generate complete dashboard state
   * @param timeRange - Time range for data
   * @returns Complete dashboard state
   */
  generateDashboard(timeRange: TimeWindow = '1h'): DashboardState {
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
    const activeAlerts = this.getActiveAlerts();
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
   * @private
   */
  private generateRequestWidget(timeRange: TimeWindow): DashboardWidget {
    const totalRequests = this.getCounterValue('http_requests_total');
    const successRequests = this.getCounterValue('http_requests_success_total');
    const errorRequests = this.getCounterValue('http_requests_error_total');
    
    return {
      id: 'requests_overview',
      title: 'Request Overview',
      type: 'counter',
      metrics: ['http_requests_total', 'http_requests_success_total', 'http_requests_error_total'],
      data: this.getHistoricalData('http_requests_total', timeRange),
      currentValue: totalRequests,
      unit: 'requests',
      refreshInterval: 30,
    };
  }

  /**
   * Generate performance widget
   * @private
   */
  private generatePerformanceWidget(timeRange: TimeWindow): DashboardWidget {
    const httpStats = this.getPerformanceStats('http_request', { window: timeRange });
    
    return {
      id: 'performance',
      title: 'API Performance',
      type: 'line',
      metrics: ['http_request_duration_ms'],
      data: this.getHistoricalData('http_request_duration_ms_raw', timeRange),
      currentValue: httpStats.avgDurationMs,
      unit: 'ms',
      refreshInterval: 15,
    };
  }

  /**
   * Generate error rate widget
   * @private
   */
  private getErrorRateWidget(timeRange: TimeWindow): DashboardWidget {
    const errorRates = this.getErrorRates(timeRange);
    const totalErrors = errorRates.reduce((sum, e) => sum + e.count, 0);
    
    return {
      id: 'error_rates',
      title: 'Error Rates',
      type: 'bar',
      metrics: ['errors_total'],
      data: errorRates.slice(0, 10).map(e => ({
        timestamp: new Date(),
        value: e.rate,
        label: e.errorCode,
      })),
      currentValue: totalErrors,
      unit: 'errors/min',
      refreshInterval: 60,
    };
  }

  /**
   * Generate health status widget
   * @private
   */
  private getHealthStatusWidget(): DashboardWidget {
    // Use cached health or return unknown
    const status: HealthStatus = 'unknown'; // Will be updated on actual check
    
    return {
      id: 'health_status',
      title: 'System Health',
      type: 'status',
      metrics: [],
      data: [],
      status: status,
      refreshInterval: 30,
    };
  }

  /**
   * Generate active alerts widget
   * @private
   */
  private getActiveAlertsWidget(): DashboardWidget {
    const activeAlerts = this.getActiveAlerts();
    
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

  // ============== Utility Methods ==============

  /**
   * Get all registered metrics
   * @returns Array of all metrics
   */
  getAllMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get a specific metric by name
   * @param name - Metric name
   * @returns Metric or undefined
   */
  getMetric(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Remove a metric
   * @param name - Metric name to remove
   * @returns True if metric was removed
   */
  removeMetric(name: string): boolean {
    return this.metrics.delete(name);
  }

  /**
   * Reset a metric to initial state
   * @param name - Metric name to reset
   * @throws {AppError} If metric doesn't exist
   */
  resetMetric(name: string): void {
    const metric = this.metrics.get(name);
    
    if (!metric) {
      throw new AppError(
        `Metric '${name}' does not exist`,
        ErrorCode.VALIDATION_ERROR,
        { severity: 'warning' }
      );
    }

    switch (metric.type) {
      case 'counter':
        metric.value = 0;
        metric.totalIncrements = 0;
        break;
      case 'gauge':
        metric.value = 0;
        metric.min = Infinity;
        metric.max = -Infinity;
        break;
      case 'histogram':
        metric.count = 0;
        metric.sum = 0;
        metric.buckets.forEach(b => b.count = 0);
        delete metric.percentiles;
        break;
    }
    
    metric.updatedAt = new Date();
    
    logger.debug(`Reset metric: ${name}`, { event: 'metric.reset', metadata: { name } });
  }

  /**
   * Reset all metrics to initial state
   */
  resetAllMetrics(): void {
    for (const name of Array.from(this.metrics.keys())) {
      try {
        this.resetMetric(name);
      } catch {
        // Continue resetting other metrics
      }
    }
    
    logger.info('All metrics have been reset', { event: 'metrics.reset_all' });
  }

  /**
   * Export all metrics in Prometheus format
   * @returns Prometheus-compatible text format
   */
  exportPrometheusFormat(): string {
    const lines: string[] = [];
    lines.push('# SSM-Pay Metrics Export');
    lines.push(`# Generated at: ${new Date().toISOString()}`);
    lines.push('');
    
    for (const metric of Array.from(this.metrics.values())) {
      // Help text
      lines.push(`# HELP ${metric.name} ${metric.description}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      
      // Labels string
      const labelsStr = Object.entries(metric.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      
      switch (metric.type) {
        case 'counter':
        case 'gauge':
          lines.push(`${metric.name}{${labelsStr}} ${metric.value}`);
          break;
        case 'histogram':
          // Output buckets
          const hist = metric as HistogramMetric;
          for (const bucket of hist.buckets) {
            lines.push(`${metric.name}_bucket{${labelsStr},le="${bucket.upperBound}"} ${bucket.count}`);
          }
          lines.push(`${metric.name}_bucket{${labelsStr},le="+Inf"} ${hist.count}`);
          lines.push(`${metric.name}_sum{${labelsStr}} ${hist.sum}`);
          lines.push(`${metric.name}_count{${labelsStr}} ${hist.count}`);
          break;
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }

  /**
   * Export metrics as JSON object
   * @returns JSON-serializable metrics object
   */
  exportJSON(): Record<string, unknown> {
    const exportData: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      metrics: {},
      health: {
        uptimeSeconds: (Date.now() - APPLICATION_START_TIME) / 1000,
        version: APP_VERSION,
      },
    };
    
    for (const [name, metric] of Array.from(this.metrics.entries())) {
      (exportData.metrics as Record<string, unknown>)[name] = metric;
    }
    
    return exportData;
  }

  /**
   * Record a historical data point
   * @private
   */
  private recordHistoricalDataPoint(metricName: string, value: number): void {
    const dataPoints = this.historicalData.get(metricName) || [];
    
    dataPoints.push({
      timestamp: new Date(),
      value,
    });
    
    // Trim to max size
    if (dataPoints.length > MAX_DATA_POINTS_PER_METRIC) {
      dataPoints.splice(0, dataPoints.length - MAX_DATA_POINTS_PER_METRIC);
    }
    
    this.historicalData.set(metricName, dataPoints);
  }

  /**
   * Get historical data for a metric
   * @private
   */
  private getHistoricalData(metricName: string, timeRange: TimeWindow): DashboardDataPoint[] {
    const dataPoints = this.historicalData.get(metricName) || [];
    const { startTime, endTime } = this.getTimeBounds(timeRange);
    
    return dataPoints.filter(d => d.timestamp >= startTime && d.timestamp <= endTime);
  }

  /**
   * Get time bounds for a given window
   * @private
   */
  private getTimeBounds(
    window: TimeWindow,
    startTime?: Date,
    endTime?: Date
  ): { startTime: Date; endTime: Date } {
    const end = endTime || new Date();
    const start = startTime || new Date(end.getTime() - this.getWindowMs(window));
    
    return { startTime: start, endTime: end };
  }

  /**
   * Convert time window to milliseconds
   * @private
   */
  private getWindowMs(window: TimeWindow): number {
    const multipliers: Record<TimeWindow, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };
    
    return multipliers[window];
  }

  /**
   * Convert time window to minutes
   * @private
   */
  private getWindowMinutes(window: TimeWindow): number {
    return this.getWindowMs(window) / (60 * 1000);
  }

  /**
   * Shutdown the monitoring service
   * Cleans up intervals and resources
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    logger.info('Monitoring service shut down', { event: 'monitoring.shutdown' });
    this.initialized = false;
  }
}

// ============== Singleton Export ==============

/**
 * Global monitoring service singleton instance
 * Use this instance throughout the application for all monitoring operations
 */
export const monitoringService = new MonitoringService();

// Auto-initialize in non-test environments
if (process.env.NODE_ENV !== 'test') {
  monitoringService.initialize();
}

// Export default for convenience
export default monitoringService;

// ============== Utility Functions ==============

/**
 * Decorator factory for automatic performance tracking
 * Can be used to wrap methods for automatic timing
 * 
 * @example
 * ```typescript
 * class PaymentService {
 *   @trackPerformance('payment.process')
 *   async processPayment(amount: number) {
 *     // Method implementation
 *   }
 * }
 * ```
 */
export function trackPerformance(operation: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: unknown[]) {
      const endTimer = monitoringService.startTimer(operation);
      
      try {
        const result = await originalMethod.apply(this, args);
        endTimer({ success: true });
        return result;
      } catch (error) {
        endTimer({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };
    
    return descriptor;
  };
}

/**
 * Higher-order function for wrapping async operations with performance tracking
 * 
 * @param operation - Operation name for tracking
 * @param fn - Async function to wrap
 * @returns Wrapped function with automatic tracking
 * 
 * @example
 * ```typescript
 * const trackedCall = trackAsyncOperation('db.query', () => database.query(sql));
 * const result = await trackedCall();
 * ```
 */
export async function trackAsyncOperation<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const endTimer = monitoringService.startTimer(operation);
  
  try {
    const result = await fn();
    endTimer({ success: true });
    return result;
  } catch (error) {
    endTimer({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
