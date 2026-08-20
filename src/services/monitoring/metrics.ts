/**
 * Monitoring Metrics Module
 * 
 * Provides metric types (Counter, Gauge, Histogram) with
 * creation, manipulation, and query operations.
 * 
 * @module services/monitoring/metrics
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

// ============== Constants ==============

/** Default histogram buckets for latency measurements */
export const DEFAULT_LATENCY_BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/** Maximum number of data points retained per metric */
export const MAX_DATA_POINTS_PER_METRIC = 10080; // 7 days at 1-minute intervals

// ============== Metrics Manager Class ==============

/**
 * Metrics Manager
 * 
 * Handles all metric CRUD operations including:
 * - Creating counters, gauges, and histograms
 * - Recording observations
 * - Querying current values
 */
export class MetricsManager {
  /** Storage for all registered metrics */
  private metrics: Map<string, Metric> = new Map();
  
  /** Historical data points for dashboard visualization */
  private historicalData: Map<string, DataPoint[]> = new Map();

  /**
   * Create a new counter metric
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
   */
  incrementCounter(
    name: string,
    amount: number = 1,
    labels: MetricLabels = {}
  ): void {
    let metric = this.metrics.get(name);
    
    if (!metric) {
      this.createCounter(name);
      metric = this.metrics.get(name)!;
    }
    
    if (metric.type !== 'counter') {
      throw new AppError(
        `Metric '${name}' is not a counter`,
        ErrorCode.VALIDATION_ERROR,
        { severity: 'warning' }
      );
    }

    (metric as CounterMetric).value += amount;
    (metric as CounterMetric).totalIncrements++;
    metric.updatedAt = new Date();
    
    if (Object.keys(labels).length > 0) {
      metric.labels = { ...metric.labels, ...labels };
    }

    this.recordHistoricalDataPoint(name, (metric as CounterMetric).value);
  }

  /**
   * Get current counter value
   */
  getCounterValue(name: string): number {
    const metric = this.metrics.get(name);
    
    if (!metric || metric.type !== 'counter') {
      return 0;
    }
    
    return (metric as CounterMetric).value;
  }

  /**
   * Create a new gauge metric
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
   */
  incrementGauge(name: string, amount: number = 1): void {
    const metric = this.metrics.get(name) as GaugeMetric | undefined;
    const currentValue = metric?.value ?? 0;
    this.setGauge(name, currentValue + amount);
  }

  /**
   * Decrement a gauge metric
   */
  decrementGauge(name: string, amount: number = 1): void {
    const metric = this.metrics.get(name) as GaugeMetric | undefined;
    const currentValue = metric?.value ?? 0;
    this.setGauge(name, currentValue - amount);
  }

  /**
   * Get current gauge value
   */
  getGaugeValue(name: string): number | undefined {
    const metric = this.metrics.get(name);
    
    if (!metric || metric.type !== 'gauge') {
      return undefined;
    }
    
    return (metric as GaugeMetric).value;
  }

  /**
   * Create a new histogram metric
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
      (metric as HistogramMetric).percentiles = {
        50: this.calculatePercentile(values, 50),
        90: this.calculatePercentile(values, 90),
        95: this.calculatePercentile(values, 95),
        99: this.calculatePercentile(values, 99),
      };
    }

    return metric as HistogramMetric;
  }

  /**
   * Calculate percentile from sorted values
   */
  calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
  }

  // ============== General Methods ==============

  /**
   * Get all registered metrics
   */
  getAllMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get a specific metric by name
   */
  getMetric(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Remove a metric
   */
  removeMetric(name: string): boolean {
    return this.metrics.delete(name);
  }

  /**
   * Reset a metric to initial state
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
        (metric as CounterMetric).value = 0;
        (metric as CounterMetric).totalIncrements = 0;
        break;
      case 'gauge':
        (metric as GaugeMetric).value = 0;
        (metric as GaugeMetric).min = Infinity;
        (metric as GaugeMetric).max = -Infinity;
        break;
      case 'histogram':
        (metric as HistogramMetric).count = 0;
        (metric as HistogramMetric).sum = 0;
        (metric as HistogramMetric).buckets.forEach(b => b.count = 0);
        delete (metric as HistogramMetric).percentiles;
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
   */
  exportPrometheusFormat(): string {
    const lines: string[] = [];
    lines.push('# SSM-Pay Metrics Export');
    lines.push(`# Generated at: ${new Date().toISOString()}`);
    lines.push('');
    
    for (const metric of Array.from(this.metrics.values())) {
      lines.push(`# HELP ${metric.name} ${metric.description}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      
      const labelsStr = Object.entries(metric.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      
      switch (metric.type) {
        case 'counter':
        case 'gauge':
          lines.push(`${metric.name}{${labelsStr}} ${metric.value}`);
          break;
        case 'histogram':
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
   */
  exportJSON(): Record<string, unknown> {
    const exportData: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      metrics: {},
    };
    
    for (const [name, metric] of Array.from(this.metrics.entries())) {
      (exportData.metrics as Record<string, unknown>)[name] = metric;
    }
    
    return exportData;
  }

  // ============== Historical Data Methods ==============

  /**
   * Record a historical data point
   */
  recordHistoricalDataPoint(metricName: string, value: number): void {
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
   */
  getHistoricalData(metricName: string, startTime?: Date, endTime?: Date): DataPoint[] {
    const dataPoints = this.historicalData.get(metricName) || [];
    const end = endTime || new Date();
    
    return dataPoints.filter(d => 
      d.timestamp >= (startTime || new Date(0)) && d.timestamp <= end
    );
  }

  /**
   * Clean up old historical data
   */
  cleanupOldData(cutoffTime: Date): void {
    for (const [key, dataPoints] of Array.from(this.historicalData.entries())) {
      const filtered = dataPoints.filter(d => d.timestamp > cutoffTime);
      if (filtered.length !== dataPoints.length) {
        this.historicalData.set(key, filtered.slice(-MAX_DATA_POINTS_PER_METRIC));
      }
    }
  }
}

// ============== Internal Types ==============

interface DataPoint {
  timestamp: Date;
  value: number;
}
