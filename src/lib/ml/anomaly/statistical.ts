/**
 * Statistical Outlier Detection Functions
 * @module ml/anomaly/statistical
 * @description Z-Score, IQR, and Modified Z-Score (MAD) outlier detection methods.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import { ThresholdConfig } from './types';

// ============== Core Statistical Functions ==============

/**
 * Calculate the mean of an array of numbers
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) {
    throw new AppError('Cannot calculate mean of empty array', ErrorCode.VALIDATION_ERROR);
  }
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate the standard deviation of an array of numbers
 */
export function calculateStandardDeviation(values: number[], usePopulation: boolean = false): number {
  if (values.length < 2) {
    throw new AppError('Cannot calculate standard deviation with fewer than 2 values', ErrorCode.VALIDATION_ERROR);
  }
  const mean = calculateMean(values);
  const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / (usePopulation ? values.length : values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate the median of an array of numbers
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) {
    throw new AppError('Cannot calculate median of empty array', ErrorCode.VALIDATION_ERROR);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate the Median Absolute Deviation (MAD)
 */
export function calculateMAD(values: number[]): number {
  const median = calculateMedian(values);
  const deviations = values.map(val => Math.abs(val - median));
  return calculateMedian(deviations);
}

/**
 * Calculate quartiles Q1 and Q3
 */
export function calculateQuartiles(values: number[]): { q1: number; q3: number } {
  if (values.length < 4) {
    throw new AppError('Cannot calculate quartiles with fewer than 4 values', ErrorCode.VALIDATION_ERROR);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  return {
    q1: sorted[q1Index],
    q3: sorted[q3Index],
  };
}

// ============== Utility Functions ==============

/**
 * Clamp a value between minimum and maximum bounds
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Normalize a value to 0-1 range using min-max normalization
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return clamp((value - min) / (max - min), 0, 1);
}

/**
 * Calculate percentile rank of a value in a dataset
 */
export function calculatePercentileRank(value: number, dataset: number[]): number {
  if (dataset.length === 0) return 50;
  const sorted = [...dataset].sort((a, b) => a - b);
  let belowCount = 0;
  for (const val of sorted) {
    if (val < value) belowCount++;
  }
  return (belowCount / sorted.length) * 100;
}

// ============== Z-Score Detection ==============

/**
 * Apply Z-Score detection to results array
 */
export function applyZScoreDetection(
  values: number[],
  results: Array<{ index: number; value: number; score: number; isOutlier: boolean }>,
  thresholds: ThresholdConfig
): void {
  try {
    const mean = calculateMean(values);
    const std = calculateStandardDeviation(values);
    
    if (std === 0) return;
    
    for (const result of results) {
      const zScore = Math.abs((result.value - mean) / std);
      if (zScore > thresholds.zScoreThreshold) {
        result.isOutlier = true;
        result.score = Math.max(result.score, zScore / thresholds.zScoreThreshold);
      }
    }
  } catch {
    // Silently skip if calculation fails
  }
}

/**
 * Perform standalone Z-Score analysis on transaction amount
 */
export function analyzeZScore(
  amount: number,
  historicalAmounts: number[],
  threshold: number
): { isAnomalous: boolean; zScore: number; confidence: number } | null {
  try {
    if (historicalAmounts.length < 3) return null;
    
    const mean = calculateMean(historicalAmounts);
    const std = calculateStandardDeviation(historicalAmounts);
    
    if (std <= 0) return null;
    
    const zScore = Math.abs((amount - mean) / std);
    
    return {
      isAnomalous: zScore > threshold,
      zScore,
      confidence: clamp(zScore / (threshold * 2), 0, 1),
    };
  } catch {
    return null;
  }
}

// ============== IQR Detection ==============

/**
 * Apply IQR detection to results array
 */
export function applyIQRDetection(
  values: number[],
  results: Array<{ index: number; value: number; score: number; isOutlier: boolean }>,
  thresholds: ThresholdConfig
): void {
  try {
    const { q1, q3 } = calculateQuartiles(values);
    let iqr = q3 - q1;
    
    // Handle case where IQR is 0
    if (iqr === 0) {
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      if (maxVal > minVal) {
        iqr = (maxVal - minVal) * 0.1;
      } else {
        return;
      }
    }
    
    const lowerBound = q1 - thresholds.iqrMultiplier * iqr;
    const upperBound = q3 + thresholds.iqrMultiplier * iqr;
    
    for (const result of results) {
      if (result.value < lowerBound || result.value > upperBound) {
        result.isOutlier = true;
        const deviation = Math.max(
          Math.abs(result.value - lowerBound),
          Math.abs(result.value - upperBound)
        ) / iqr;
        result.score = Math.max(result.score, deviation);
      }
    }
  } catch {
    // Silently skip if calculation fails
  }
}

/**
 * Perform standalone IQR analysis on transaction amount
 */
export function analyzeIQR(
  amount: number,
  allAmounts: number[],
  multiplier: number
): { isAnomalous: boolean; deviation: number; bounds: { lower: number; upper: number } } | null {
  try {
    if (allAmounts.length < 4) return null;
    
    const { q1, q3 } = calculateQuartiles(allAmounts);
    const iqr = q3 - q1;
    const lowerBound = q1 - multiplier * iqr;
    const upperBound = q3 + multiplier * iqr;
    
    const isAnomalous = amount < lowerBound || amount > upperBound;
    const deviation = isAnomalous 
      ? (amount > upperBound ? amount - upperBound : lowerBound - amount)
      : 0;
    
    return { isAnomalous, deviation, bounds: { lower: lowerBound, upper: upperBound } };
  } catch {
    return null;
  }
}

// ============== Modified Z-Score Detection ==============

/**
 * Apply Modified Z-Score detection to results array
 */
export function applyModifiedZScoreDetection(
  values: number[],
  results: Array<{ index: number; value: number; score: number; isOutlier: boolean }>,
  thresholds: ThresholdConfig
): void {
  try {
    const mad = calculateMAD(values);
    const median = calculateMedian(values);
    
    if (mad === 0) return;
    
    for (const result of results) {
      const modifiedZScore = Math.abs((0.6745 * (result.value - median)) / mad);
      if (modifiedZScore > thresholds.modifiedZScoreThreshold) {
        result.isOutlier = true;
        result.score = Math.max(
          result.score,
          modifiedZScore / thresholds.modifiedZScoreThreshold
        );
      }
    }
  } catch {
    // Silently skip if calculation fails
  }
}

/**
 * Perform standalone Modified Z-Score analysis
 */
export function analyzeModifiedZScore(
  amount: number,
  historicalAmounts: number[],
  threshold: number
): { isAnomalous: boolean; modifiedZScore: number; confidence: number } | null {
  try {
    if (historicalAmounts.length < 3) return null;
    
    const mad = calculateMAD(historicalAmounts);
    const median = calculateMedian(historicalAmounts);
    
    if (mad <= 0) return null;
    
    const modifiedZScore = Math.abs((0.6745 * (amount - median)) / mad);
    
    return {
      isAnomalous: modifiedZScore > threshold,
      modifiedZScore,
      confidence: clamp(modifiedZScore / (threshold * 2), 0, 1),
    };
  } catch {
    return null;
  }
}
