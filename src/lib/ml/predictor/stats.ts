/**
 * Statistical Utility Functions
 * @module ml/predictor/stats
 * @description Core statistical functions used across prediction modules.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Basic Statistics ==============

/**
 * Calculate mean of numeric array
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
export function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length);
}

/**
 * Calculate variance
 */
export function calculateVariance(values: number[]): number {
  const stdDev = calculateStdDev(values);
  return stdDev * stdDev;
}

/**
 * Calculate median value
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate percentile
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}

// ============== Correlation & Regression Metrics ==============

/**
 * Calculate correlation coefficient (Pearson)
 */
export function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  const meanX = calculateMean(x);
  const meanY = calculateMean(y);
  
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  
  const denominator = Math.sqrt(denomX * denomY);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculate R-squared
 */
export function calculateRSquared(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length === 0) return 0;
  
  const meanActual = calculateMean(actual);
  const ssTot = actual.reduce((sum, val) => sum + Math.pow(val - meanActual, 2), 0);
  const ssRes = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  
  return ssTot === 0 ? 1 : 1 - (ssRes / ssTot);
}

// ============== Normalization Functions ==============

/**
 * Normalize values to 0-1 range using min-max scaling
 */
export function normalizeMinMax(
  values: number[]
): { normalized: number[]; min: number; max: number; scale: number } {
  if (values.length === 0) return { normalized: [], min: 0, max: 0, scale: 1 };
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const scale = max - min || 1;
  
  return {
    normalized: values.map(val => (val - min) / scale),
    min,
    max,
    scale,
  };
}

/**
 * Z-score normalization (standardization)
 */
export function standardizeZScore(
  values: number[]
): { standardized: number[]; mean: number; stdDev: number } {
  if (values.length === 0) return { standardized: [], mean: 0, stdDev: 1 };
  
  const mean = calculateMean(values);
  const stdDev = calculateStdDev(values) || 1;
  
  return {
    standardized: values.map(val => (val - mean) / stdDev),
    mean,
    stdDev,
  };
}

// ============== Activation Functions ==============

/**
 * Apply sigmoid activation function
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
}

/**
 * Apply ReLU activation function
 */
export function relu(x: number): number {
  return Math.max(0, x);
}
