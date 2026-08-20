/**
 * Monitoring Performance Tracking Module
 * 
 * Provides performance measurement and tracking including:
 * - Timer-based operation tracking
 * - Aggregated performance statistics
 * - Percentile calculations
 * - Throughput measurements
 * 
 * @module services/monitoring/performance
 */

import { logger } from '@/lib/logger';
import { MetricsManager } from './metrics';

// ============== Type Definitions ==============

/**
 * Time window options for aggregated metrics
 */
export type TimeWindow = '1m' | '5m' | '15m' | '1h' | '6h' | '24h' | '7d';

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
  labels?: import('./metrics').MetricLabels;
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
  labelFilters?: import('./metrics').MetricLabels;
}

// ============== Performance Tracker Class ==============

/**
 * Performance Tracker
 * 
 * Manages performance data collection and analysis.
 */
export class PerformanceTracker {
  /** Performance records for time-windowed analysis */
  private performanceRecords: Map<string, PerformanceRecord[]> = new Map();
  
  /** Reference to metrics manager for histogram updates */
  private metricsManager: MetricsManager;

  constructor(metricsManager: MetricsManager) {
    this.metricsManager = metricsManager;
  }

  /**
   * Start a timer for performance measurement
   */
  startTimer(operation: string): (result?: {
    success: boolean;
    error?: string;
    labels?: import('./metrics').MetricLabels;
  }) => number {
    const startTime = Date.now();
    
    return (result?: {
      success: boolean;
      error?: string;
      labels?: import('./metrics').MetricLabels;
    }): number => {
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
      if (this.metricsManager.getMetric(histogramName)) {
        this.metricsManager.observeHistogram(histogramName, durationMs, result?.labels);
      }
      
      return durationMs;
    };
  }

  /**
   * Get aggregated performance statistics for an operation
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
   */
  getAllPerformanceStats(query?: TimeWindowQuery): Map<string, PerformanceStats> {
    const stats = new Map<string, PerformanceStats>();
    
    for (const operation of Array.from(this.performanceRecords.keys())) {
      stats.set(operation, this.getPerformanceStats(operation, query));
    }
    
    return stats;
  }

  /**
   * Get all tracked operations
   */
  getTrackedOperations(): string[] {
    return Array.from(this.performanceRecords.keys());
  }

  /**
   * Clear performance records for an operation
   */
  clearOperationRecords(operation: string): void {
    this.performanceRecords.delete(operation);
  }

  /**
   * Clear all performance records
   */
  clearAllRecords(): void {
    this.performanceRecords.clear();
  }

  /**
   * Clean up old performance records
   */
  cleanupOldData(cutoffTime: Date): void {
    for (const [key, records] of Array.from(this.performanceRecords.entries())) {
      const filtered = records.filter(r => r.timestamp > cutoffTime);
      if (filtered.length !== records.length) {
        this.performanceRecords.set(key, filtered);
      }
    }
  }

  // ============== Private Methods ==============

  /**
   * Get empty performance stats placeholder
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

  /**
   * Calculate percentile from sorted values
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

  /**
   * Get time bounds for a given window
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
   */
  getWindowMs(window: TimeWindow): number {
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
   */
  getWindowMinutes(window: TimeWindow): number {
    return this.getWindowMs(window) / (60 * 1000);
  }
}
