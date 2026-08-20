/**
 * Metrics Collection Service
 * Handles recording, aggregation, and retrieval of system metrics
 */

import {
  MetricType,
  MetricUnit,
  MetricPoint,
  AggregatedMetric,
} from './types';

/** Metrics collector configuration */
export interface MetricsConfig {
  /** Maximum points to retain in memory */
  maxRetainedPoints: number;
  /** Default aggregation window (seconds) */
  defaultWindowSeconds: number;
  /** Whether to enable histogram tracking */
  enableHistograms: boolean;
}

/** Default configuration */
const DEFAULT_CONFIG: MetricsConfig = {
  maxRetainedPoints: 100000,
  defaultWindowSeconds: 300,
  enableHistograms: true,
};

/**
 * MetricsCollector - Central service for collecting and querying metrics
 */
export class MetricsCollector {
  private metrics: Map<string, MetricPoint[]> = new Map();
  private config: MetricsConfig;
  private startTime: Date;

  constructor(config: Partial<MetricsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = new Date();
  }

  /**
   * Record a metric data point
   * @param name - Metric name
   * @param value - Numeric value
   * @param type - Metric type
   * @param options - Optional configuration
   */
  recordMetric(
    name: string,
    value: number,
    type: MetricType = MetricType.COUNTER,
    options: {
      unit?: MetricUnit;
      labels?: Record<string, string>;
      description?: string;
    } = {}
  ): void {
    const point: MetricPoint = {
      name,
      type,
      value,
      unit: options.unit || MetricUnit.NONE,
      timestamp: new Date().toISOString(),
      labels: options.labels || {},
      description: options.description,
    };

    // Get or create metric array
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const points = this.metrics.get(name)!;
    points.push(point);

    // Enforce retention limit
    if (points.length > this.config.maxRetainedPoints) {
      points.shift();
    }
  }

  /**
   * Increment a counter metric by 1
   * @param name - Counter name
   * @param labels - Optional labels
   * @param amount - Amount to increment (default 1)
   */
  incrementCounter(name: string, labels?: Record<string, string>, amount: number = 1): void {
    this.recordMetric(name, amount, MetricType.COUNTER, { unit: MetricUnit.COUNT, labels });
  }

  /**
   * Record a gauge value
   * @param name - Gauge name
   * @param value - Current value
   * @param labels - Optional labels
   */
  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, MetricType.GAUGE, { unit: MetricUnit.NONE, labels });
  }

  /**
   * Record a duration/histogram value
   * @param name - Histogram name
   * @param valueMs - Duration in milliseconds
   * @param labels - Optional labels
   */
  recordHistogram(name: string, valueMs: number, labels?: Record<string, string>): void {
    this.recordMetric(name, valueMs, MetricType.HISTOGRAM, { unit: MetricUnit.MILLISECONDS, labels });
  }

  /**
   * Get all recorded metrics optionally filtered by name pattern
   * @param nameFilter - Optional name prefix filter
   * @returns Array of metric points
   */
  getMetrics(nameFilter?: string): MetricPoint[] {
    const results: MetricPoint[] = [];

    for (const [name, points] of this.metrics) {
      if (!nameFilter || name.startsWith(nameFilter)) {
        results.push(...points);
      }
    }

    return results.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Get metrics aggregated over a time window
   * @param name - Metric name
   * @param windowSeconds - Aggregation window size
   * @param labelFilters - Filter by specific label values
   * @returns Aggregated metric data
   */
  aggregateByTime(
    name: string,
    windowSeconds: number = this.config.defaultWindowSeconds,
    labelFilters?: Record<string, string>
  ): AggregatedMetric | null {
    const points = this.metrics.get(name);
    if (!points || points.length === 0) {
      return null;
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - windowSeconds * 1000);

    // Filter by time window and labels
    const filteredPoints = points.filter((p) => {
      const pointTime = new Date(p.timestamp);
      if (pointTime < windowStart) return false;

      if (labelFilters) {
        for (const [key, value] of Object.entries(labelFilters)) {
          if (p.labels[key] !== value) return false;
        }
      }

      return true;
    });

    if (filteredPoints.length === 0) {
      return null;
    }

    // Calculate statistics
    const values = filteredPoints.map((p) => p.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = sum / values.length;

    return {
      name,
      type: filteredPoints[0].type,
      count: values.length,
      sum,
      min: values[0],
      max: values[values.length - 1],
      mean,
      median: this.percentile(values, 50),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99),
      standardDeviation: this.calculateStdDev(values, mean),
      windowStart: windowStart.toISOString(),
      windowEnd: now.toISOString(),
      labels: labelFilters || {},
    };
  }

  /**
   * Get all metric names currently being tracked
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get current value of a gauge or counter
   * @param name - Metric name
   * @param labels - Optional label filters
   * @returns Latest value or undefined
   */
  getCurrentValue(name: string, labels?: Record<string, string>): number | undefined {
    const points = this.metrics.get(name);
    if (!points || points.length === 0) return undefined;

    let filtered = points;
    if (labels) {
      filtered = points.filter((p) =>
        Object.entries(labels).every(([k, v]) => p.labels[k] === v)
      );
    }

    if (filtered.length === 0) return undefined;

    const latest = filtered[filtered.length - 1];
    return latest.type === MetricType.COUNTER
      ? filtered.reduce((sum, p) => sum + p.value, 0)
      : latest.value;
  }

  /**
   * Flush all stored metrics (for testing or reset)
   */
  flushMetrics(): void {
    this.metrics.clear();
    console.log('[Metrics] All metrics flushed');
  }

  /**
   * Get total count of stored metric points
   */
  getTotalPointCount(): number {
    let total = 0;
    for (const points of this.metrics.values()) {
      total += points.length;
    }
    return total;
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 1) return sortedValues[0];

    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sortedValues[lower];

    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length <= 1) return 0;

    const squaredDiffs = values.reduce((sum, v) => {
      const diff = v - mean;
      return sum + diff * diff;
    }, 0);

    return Math.sqrt(squaredDiffs / (values.length - 1));
  }

  /**
   * Get uptime since collector started
   */
  getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }
}
