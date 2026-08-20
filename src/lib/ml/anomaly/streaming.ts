/**
 * Streaming/Real-Time Detection Functions
 * @module ml/anomaly/streaming
 * @description Real-time streaming detection with sliding window analysis and event handling.
 */

import { logger } from '@/lib/logger';
import {
  TransactionData,
  AnomalyAnalysisResult,
  StreamingEvent,
  StreamingStats,
  SlidingWindowBuffer,
  AnomalyDetectorConfig,
  DetectionResult,
  AnomalyCategory,
  AnomalySeverity,
} from './types';

// ============== Sliding Window Factory ==============

/**
 * Create a sliding window buffer for real-time analysis
 */
export function createSlidingWindow<T>(
  maxSize: number,
  windowMs: number
): SlidingWindowBuffer<T> {
  return {
    buffer: [],
    maxSize,
    windowMs,
    add(item: T): void {
      this.buffer.push(item);
      if (this.buffer.length > this.maxSize) {
        this.buffer.shift();
      }
    },
    getAll(): T[] {
      return [...this.buffer];
    },
    size(): number {
      return this.buffer.length;
    },
    clear(): void {
      this.buffer = [];
    },
    getInWindow(now: Date): T[] {
      const windowStart = new Date(now.getTime() - this.windowMs);
      return this.buffer.filter((item) => {
        const typedItem = item as unknown as { timestamp: Date };
        return typedItem.timestamp >= windowStart;
      });
    },
  };
}

// ============== Statistics Management ==============

/**
 * Initialize fresh streaming statistics
 */
export function initializeStreamingStats(): StreamingStats {
  return {
    totalEventsProcessed: 0,
    totalAnomaliesDetected: 0,
    currentAnomalyRate: 0,
    eventsInWindow: 0,
    avgProcessingTimeMs: 0,
    uptimeSeconds: 0,
  };
}

/**
 * Update streaming stats after processing an event
 */
export function updateStreamingStats(
  stats: StreamingStats,
  processingTime: number,
  isAnomalous: boolean,
  windowSize: number,
  startTime: Date | null
): StreamingStats {
  stats.totalEventsProcessed++;
  stats.eventsInWindow = windowSize;
  
  if (isAnomalous) {
    stats.totalAnomaliesDetected++;
  }
  
  // Update anomaly rate
  stats.currentAnomalyRate =
    stats.totalEventsProcessed > 0
      ? stats.totalAnomaliesDetected / stats.totalEventsProcessed
      : 0;
  
  // Update uptime
  if (startTime) {
    stats.uptimeSeconds = (Date.now() - startTime.getTime()) / 1000;
  }
  
  return stats;
}

// ============== Event Emission ==============

/**
 * Emit an event to registered listeners
 */
export function emitEvent(
  event: StreamingEvent,
  listeners: Map<string, ((event: StreamingEvent) => void)[]>
): void {
  const eventListeners = listeners.get(event.type);
  if (eventListeners) {
    for (const listener of eventListeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('Event listener error', {
          event: 'analyzer.listener.error',
          error: error as Error,
          metadata: { eventType: event.type },
        });
      }
    }
  }
}

// ============== Result Compilation Helpers ==============

/**
 * Convert raw score to severity level
 */
export function scoreToSeverity(score: number): AnomalySeverity {
  if (score >= 3.0) return AnomalySeverity.CRITICAL;
  if (score >= 2.0) return AnomalySeverity.HIGH;
  if (score >= 1.5) return AnomalySeverity.MEDIUM;
  if (score >= 1.0) return AnomalySeverity.LOW;
  return AnomalySeverity.INFO;
}

/**
 * Determine recommended action based on analysis results
 */
export function determineRecommendedAction(
  riskScore: number,
  severity: AnomalySeverity,
  detections: DetectionResult[]
): AnomalyAnalysisResult['recommendedAction'] {
  // Critical always block
  if (severity === AnomalySeverity.CRITICAL) {
    const hasImpossibleTravel = detections.some(d => 
      d.category === AnomalyCategory.GEOGRAPHIC && 
      d.description.includes('Impossible travel')
    );
    
    if (hasImpossibleTravel) {
      return 'block_and_investigate';
    }
    
    const hasFlaggedDevice = detections.some(d =>
      d.category === AnomalyCategory.DEVICE &&
      d.description.includes('flagged')
    );
    
    if (hasFlaggedDevice) {
      return 'block_and_investigate';
    }
    
    return 'decline';
  }
  
  if (severity === AnomalySeverity.HIGH) {
    if (riskScore >= 75) {
      return 'require_step_up_auth';
    }
    return 'require_additional_verification';
  }
  
  if (severity === AnomalySeverity.MEDIUM) {
    if (riskScore >= 50) {
      return 'require_additional_verification';
    }
    return 'approve_with_monitoring';
  }
  
  if (severity === AnomalySeverity.LOW) {
    return 'approve_with_monitoring';
  }
  
  return 'approve';
}
