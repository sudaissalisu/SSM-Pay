/**
 * A/B Testing State Management
 * A/B testing framework for model comparison in ML pipelines
 * 
 * @module ml/ab-test-state
 */

import { logger } from '@/lib/logger';
import {
  ABTestingConfig,
  ABTestResults,
  ABTestGroupResult,
} from './types';
import { AggregatedResult } from './types';

// ============== A/B Test State Interface ==============

/** Internal A/B test state */
export interface ABTestState {
  config: ABTestingConfig;
  controlCount: number;
  treatmentCount: number;
  controlMetrics: Record<string, number>;
  treatmentMetrics: Record<string, number>;
  startedAt: Date;
}

// ============== A/B Test Manager ==============

/**
 * Manages A/B testing state and calculations for pipeline
 */
export class ABTestManager {
  private state: ABTestState | null = null;

  /**
   * Initialize A/B testing state
   */
  initialize(config: ABTestingConfig): void {
    this.state = {
      config,
      controlCount: 0,
      treatmentCount: 0,
      controlMetrics: {},
      treatmentMetrics: {},
      startedAt: new Date(),
    };

    logger.info(`A/B test initialized: ${config.testId}`);
  }

  /**
   * Check if A/B test is active
   */
  isActive(): boolean {
    return this.state !== null;
  }

  /**
   * Get current state
   */
  getState(): ABTestState | null {
    return this.state;
  }

  /**
   * Assign request to control or treatment group
   */
  assignGroup(config: ABTestingConfig): boolean {
    if (!this.state) return false;

    const random = Math.random() * 100;
    const isTreatment = random < config.trafficSplit;

    if (isTreatment) {
      this.state.treatmentCount++;
    } else {
      this.state.controlCount++;
    }

    return isTreatment;
  }

  /**
   * Record metrics for A/B test analysis
   */
  recordMetrics(isTreatment: boolean, result: AggregatedResult): void {
    if (!this.state) return;

    const metrics = isTreatment
      ? this.state.treatmentMetrics
      : this.state.controlMetrics;

    // Record basic metrics
    metrics['total_requests'] = (metrics['total_requests'] || 0) + 1;
    metrics['avg_confidence'] =
      ((metrics['avg_confidence'] || 0) * (metrics['total_requests'] - 1) +
        result.confidence) /
      metrics['total_requests'];
    metrics['avg_agreement'] =
      ((metrics['avg_agreement'] || 0) * (metrics['total_requests'] - 1) +
        result.agreement) /
      metrics['total_requests'];
  }

  /**
   * Calculate current A/B test statistical results
   */
  calculateResults(): ABTestResults | undefined {
    if (!this.state) return undefined;

    const { config, controlCount, treatmentCount, controlMetrics, treatmentMetrics } =
      this.state;

    // Basic significance check (simplified - use proper stats library for production)
    const minSampleSize = config.minSampleSize;
    const hasEnoughSamples =
      controlCount >= minSampleSize && treatmentCount >= minSampleSize;

    // Simplified p-value calculation (use t-test in production)
    const pValue = hasEnoughSamples ? this.simplifiedPValue(controlMetrics, treatmentMetrics) : 1;
    const isSignificant = pValue < config.significanceLevel;

    // Determine winner based on primary metric
    let winningVariant: 'control' | 'treatment' | undefined;
    if (isSignificant) {
      const controlPrimary = controlMetrics[config.metrics[0]] ?? 0;
      const treatmentPrimary = treatmentMetrics[config.metrics[0]] ?? 0;
      
      // Assuming higher is better for now
      winningVariant = treatmentPrimary > controlPrimary ? 'treatment' : 'control';
    }

    return {
      testId: config.testId,
      control: {
        variantName: config.control.name,
        sampleSize: controlCount,
        metrics: controlMetrics,
      },
      treatment: {
        variantName: config.treatment.name,
        sampleSize: treatmentCount,
        metrics: treatmentMetrics,
      },
      isSignificant,
      pValue,
      winningVariant,
      recommendation: isSignificant
        ? `Consider switching to ${winningVariant} variant`
        : 'Continue collecting data',
    };
  }

  /**
   * End A/B test and get final results
   */
  end(): ABTestResults | null {
    if (!this.state) return null;

    const results = this.calculateResults();
    
    logger.info(`A/B test ended: ${results?.testId}`);
    
    this.state = null;
    return results;
  }

  /**
   * Very simplified p-value approximation
   * NOTE: Use proper statistical library for production!
   */
  private simplifiedPValue(
    controlMetrics: Record<string, number>,
    treatmentMetrics: Record<string, number>
  ): number {
    // This is a placeholder - implement proper statistical test
    const diff = Math.abs(
      (treatmentMetrics['avg_confidence'] ?? 0) -
        (controlMetrics['avg_confidence'] ?? 0)
    );
    
    // Rough approximation - smaller difference = higher p-value
    return Math.max(0.01, 1 - diff * 10);
  }
}
