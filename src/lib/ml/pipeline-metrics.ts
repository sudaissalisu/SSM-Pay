/**
 * Pipeline Metrics Collector
 * Internal metrics collection for pipeline monitoring
 * 
 * @module ml/pipeline-metrics
 */

import { logger } from '@/lib/logger';

// ============== Exported Types ==============

/** Snapshot of pipeline metrics */
export interface PipelineMetricsSnapshot {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  avgExecutionTimeMs: number;
  totalRetries: number;
  modelExecutions: Record<string, { count: number; successes: number }>;
  lastExecutionTime: Date | null;
}

/** Pipeline health status */
export interface PipelineHealthStatus {
  isHealthy: boolean;
  pipelineId: string;
  totalModels: number;
  healthyModels: number;
  unhealthyModels: number;
  modelHealths: Map<string, ModelHealthStatus>;
  uptime: number;
  lastExecutionAt: Date | null;
}

/** Health status of a model */
export interface ModelHealthStatus {
  /** Whether model is healthy */
  isHealthy: boolean;
  /** Last prediction timestamp */
  lastPredictionAt?: Date;
  /** Average response time in ms */
  avgResponseTimeMs: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Number of predictions made */
  totalPredictions: number;
  /** Additional health info */
  details?: Record<string, unknown>;
}

// ============== Metrics Collector ==============

/**
 * Internal metrics collector for pipeline monitoring
 */
export class PipelineMetrics {
  private totalExecutions = 0;
  private successfulExecutions = 0;
  private failedExecutions = 0;
  private totalExecutionTimeMs = 0;
  private modelExecutions = new Map<string, { count: number; successes: number }>();
  private totalRetries = 0;
  private lastExecutionTime: Date | null = null;

  recordExecution(durationMs: number, success: boolean): void {
    this.totalExecutions++;
    this.totalExecutionTimeMs += durationMs;
    this.lastExecutionTime = new Date();

    if (success) {
      this.successfulExecutions++;
    } else {
      this.failedExecutions++;
    }
  }

  recordModelExecution(modelId: string, _timestamp: number, success: void | boolean): void {
    const current = this.modelExecutions.get(modelId) || { count: 0, successes: 0 };
    current.count++;
    if (success) current.successes++;
    this.modelExecutions.set(modelId, current);
  }

  recordRetry(): void {
    this.totalRetries++;
  }

  getTotalRetries(): number {
    return this.totalRetries;
  }

  getLastExecutionTime(): Date | null {
    return this.lastExecutionTime;
  }

  getSnapshot(): PipelineMetricsSnapshot {
    return {
      totalExecutions: this.totalExecutions,
      successfulExecutions: this.successfulExecutions,
      failedExecutions: this.failedExecutions,
      successRate:
        this.totalExecutions > 0
          ? this.successfulExecutions / this.totalExecutions
          : 0,
      avgExecutionTimeMs:
        this.totalExecutions > 0
          ? this.totalExecutionTimeMs / this.totalExecutions
          : 0,
      totalRetries: this.totalRetries,
      modelExecutions: Object.fromEntries(this.modelExecutions),
      lastExecutionTime: this.lastExecutionTime,
    };
  }

  reset(): void {
    this.totalExecutions = 0;
    this.successfulExecutions = 0;
    this.failedExecutions = 0;
    this.totalExecutionTimeMs = 0;
    this.modelExecutions.clear();
    this.totalRetries = 0;

    logger.debug('Pipeline metrics reset');
  }
}
