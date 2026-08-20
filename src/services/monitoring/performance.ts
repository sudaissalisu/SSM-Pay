/**
 * Performance Tracking Service
 * Monitors request latency, throughput, and detects anomalies
 */

import { PerformanceSnapshot, MetricType, MetricUnit } from './types';
import { MetricsCollector } from './metrics';

export interface PerformanceConfig {
  enabled: boolean;
  slowThresholdMs: number;
  sampleRate: number;
  maxSnapshots: number;
  slowQueryThresholdMs: number;
}

const DEFAULT_CONFIG: PerformanceConfig = {
  enabled: true, slowThresholdMs: 1000, sampleRate: 1.0,
  maxSnapshots: 10000, slowQueryThresholdMs: 500,
}

export interface RequestContext {
  requestId: string; operation: string; method?: string;
  startTime: number; tags?: Record<string, string>;
}

export interface PerformanceReport {
  periodStart: string; periodEnd: string; totalRequests: number;
  successfulRequests: number; failedRequests: number;
  averageLatencyMs: number; p50LatencyMs: number; p95LatencyMs: number;
  p99LatencyMs: number; slowRequestCount: number; errorRate: number;
  throughputPerSecond: number; operations: Record<string, OperationStats>;
}

export interface OperationStats {
  count: number; avgLatencyMs: number; maxLatencyMs: number;
  minLatencyMs: number; errorCount: number; errorRate: number;
}

export interface SlowQueryRecord {
  id: string; query: string; durationMs: number;
  timestamp: string; operation: string; tags?: Record<string, string>;
}

/**
 * PerformanceTracker - Tracks and analyzes system performance
 */
export class PerformanceTracker {
  private config: PerformanceConfig;
  private metrics: MetricsCollector;
  private activeContexts: Map<string, RequestContext> = new Map();
  private snapshots: PerformanceSnapshot[] = [];
  private slowQueries: SlowQueryRecord[] = [];

  constructor(config: Partial<PerformanceConfig> = {}, metrics?: MetricsCollector) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = metrics || new MetricsCollector();
  }

  /** Begin tracking a new request */
  startTracking(operation: string, method?: string, tags?: Record<string, string>): RequestContext | null {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) return null;
    const ctx: RequestContext = { requestId: this.genId(), operation, method, startTime: Date.now(), tags };
    this.activeContexts.set(ctx.requestId, ctx);
    return ctx;
  }

  /** End tracking and record performance data */
  endTracking(context: RequestContext | null, statusCode: number = 200, error?: string): void {
    if (!context || !this.activeContexts.has(context.requestId)) return;

    const endTime = Date.now();
    const durationMs = endTime - context.startTime;
    const success = statusCode >= 200 && statusCode < 400 && !error;

    const snapshot: PerformanceSnapshot = {
      id: `perf_${context.requestId}`, requestId: context.requestId,
      operation: context.operation, method: context.method,
      startTime: new Date(context.startTime).toISOString(),
      endTime: new Date(endTime).toISOString(), durationMs,
      statusCode, success, error, tags: context.tags || {},
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.config.maxSnapshots) this.snapshots.shift();

    // Record metrics
    this.metrics.recordHistogram('request_duration_ms', durationMs, {
      operation: context.operation, method: context.method || 'unknown', status: success ? 'success' : 'error',
    });
    this.metrics.incrementCounter('requests_total', { operation: context.operation, status: success ? 'success' : 'error' });

    if (durationMs > this.config.slowThresholdMs) {
      console.warn(`[Performance] Slow request: ${context.operation} took ${durationMs}ms`);
      this.metrics.incrementCounter('slow_requests_total', { operation: context.operation });
    }

    this.activeContexts.delete(context.requestId);
  }

  /** Track a database query duration */
  measureQuery(query: string, durationMs: number, operation?: string): void {
    if (!this.config.enabled) return;

    this.metrics.recordHistogram('query_duration_ms', durationMs, {
      query_hash: this.hashQuery(query), operation: operation || 'unknown',
    });

    if (durationMs > this.config.slowQueryThresholdMs) {
      const sq: SlowQueryRecord = {
        id: `slow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        query, durationMs, timestamp: new Date().toISOString(), operation: operation || 'unknown',
      };
      this.slowQueries.push(sq);
      if (this.slowQueries.length > 1000) this.slowQueries.shift();

      console.warn(`[Performance] Slow query (${durationMs}ms): ${query.slice(0, 100)}`);
      this.metrics.incrementCounter('slow_queries_total');
    }
  }

  /** Get recent slow queries */
  getSlowQueries(limit: number = 50): SlowQueryRecord[] { return this.slowQueries.slice(-limit); }

  /** Detect slow queries based on threshold */
  detectSlowQueries(): SlowQueryRecord[] {
    return this.slowQueries.filter((sq) => sq.durationMs > this.config.slowQueryThresholdMs);
  }

  /** Generate comprehensive performance report */
  generateReport(windowSeconds: number = 300): PerformanceReport {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowSeconds * 1000);
    const relevant = this.snapshots.filter((s) => new Date(s.startTime) >= windowStart);

    if (relevant.length === 0) return this.emptyReport(windowStart, now);

    const latencies = relevant.map((s) => s.durationMs).sort((a, b) => a - b);
    const successful = relevant.filter((s) => s.success).length;
    const failed = relevant.length - successful;

    return {
      periodStart: windowStart.toISOString(), periodEnd: now.toISOString(),
      totalRequests: relevant.length, successfulRequests: successful, failedRequests: failed,
      averageLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50LatencyMs: this.pct(latencies, 50), p95LatencyMs: this.pct(latencies, 95),
      p99LatencyMs: this.pct(latencies, 99),
      slowRequestCount: relevant.filter((s) => s.durationMs > this.config.slowThresholdMs).length,
      errorRate: failed / relevant.length,
      throughputPerSecond: relevant.length / windowSeconds,
      operations: this.groupByOp(relevant),
    };
  }

  /** Get underlying metrics collector */
  getMetrics(): MetricsCollector { return this.metrics; }

  /** Clear all stored data */
  reset(): void { this.snapshots = []; this.slowQueries = []; this.activeContexts.clear(); }

  // Private helpers

  private genId(): string { return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; }

  private hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) { hash = ((hash << 5) - hash) + query.charCodeAt(i); hash |= 0; }
    return Math.abs(hash).toString(36);
  }

  private pct(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? sorted[lo] : sorted[lo] * (1 - (idx - lo)) + sorted[hi] * (idx - lo);
  }

  private groupByOp(snaps: PerformanceSnapshot[]): Record<string, OperationStats> {
    const groups: Record<string, PerformanceSnapshot[]> = {};
    for (const s of snaps) { if (!groups[s.operation]) groups[s.operation] = []; groups[s.operation].push(s); }

    const result: Record<string, OperationStats> = {};
    for (const [op, ops] of Object.entries(groups)) {
      const lats = ops.map((o) => o.durationMs);
      const errs = ops.filter((o) => !o.success).length;
      result[op] = {
        count: ops.length, avgLatencyMs: lats.reduce((a, b) => a + b, 0) / lats.length,
        maxLatencyMs: Math.max(...lats), minLatencyMs: Math.min(...lats),
        errorCount: errs, errorRate: errs / ops.length,
      };
    }
    return result;
  }

  private emptyReport(start: Date, end: Date): PerformanceReport {
    return {
      periodStart: start.toISOString(), periodEnd: end.toISOString(),
      totalRequests: 0, successfulRequests: 0, failedRequests: 0,
      averageLatencyMs: 0, p50LatencyMs: 0, p95LatencyMs: 0, p99LatencyMs: 0,
      slowRequestCount: 0, errorRate: 0, throughputPerSecond: 0, operations: {},
    };
  }
}
