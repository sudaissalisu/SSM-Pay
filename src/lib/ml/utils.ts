/**
 * Machine Learning Utility Functions for SSM-Pay
 * 
 * @module ml/utils
 * @description Comprehensive utility functions for data preprocessing, feature engineering,
 * statistical analysis, matrix operations, and validation used across all ML modules.
 * 
 * @version 1.0.0
 * @since 2.0.0
 * @author SSM-Pay ML Engineering Team
 */

import { logger } from '@/lib/logger';
import {
  FeatureType,
  MissingValueStrategy,
  NormalizationMethod,
  QualityIssueType,
  QualityIssue,
} from './types';

// ============== Data Preprocessing Functions ==============

/**
 * Options for data preprocessing operations
 */
export interface PreprocessingOptions {
  /** Handle missing values */
  handleMissing?: boolean;
  /** Missing value strategy */
  missingStrategy?: MissingValueStrategy;
  /** Remove duplicates */
  removeDuplicates?: boolean;
  /** Validate data types */
  validateTypes?: boolean;
  /** Clip outliers using IQR method */
  clipOutliers?: boolean;
  /** IQR multiplier for outlier detection (default: 1.5) */
  iqrMultiplier?: number;
  /** Custom value for constant imputation */
  imputationConstant?: number;
}

/**
 * Result of preprocessing operation
 */
export interface PreprocessingResult<T> {
  /** Processed data array */
  data: T[];
  /** Original data length */
  originalLength: number;
  /** Processed data length */
  processedLength: number;
  /** Number of rows removed */
  rowsRemoved: number;
  /** Quality issues found and handled */
  issuesHandled: QualityIssue[];
  /** Statistics about transformations applied */
  stats: PreprocessingStats;
}

/** Statistics collected during preprocessing */
export interface PreprocessingStats {
  /** Number of missing values filled */
  missingValuesFilled: number;
  /** Number of duplicates removed */
  duplicatesRemoved: number;
  /** Number of outliers clipped */
  outliersClipped: number;
  /** Number of type conversions performed */
  typeConversions: number;
}

/**
 * Preprocess a numeric dataset with configurable options
 * 
 * @param data - Array of numeric values or records
 * @param options - Preprocessing configuration options
 * @returns Preprocessing result with processed data and statistics
 * 
 * @example
 * ```typescript
 * const result = preprocessNumeric([1, 2, null, 1000, 3], {
 *   handleMissing: true,
 *   missingStrategy: MissingValueStrategy.MEDIAN_IMPUTATION,
 *   clipOutliers: true
 * });
 * // Returns cleaned data with statistics
 * ```
 */
export function preprocessNumeric(
  data: (number | null | undefined)[],
  options: PreprocessingOptions = {}
): PreprocessingResult<number> {
  const {
    handleMissing = true,
    missingStrategy = MissingValueStrategy.MEDIAN_IMPUTATION,
    clipOutliers = false,
    iqrMultiplier = 1.5,
    imputationConstant = 0,
  } = options;

  const stats: PreprocessingStats = {
    missingValuesFilled: 0,
    duplicatesRemoved: 0,
    outliersClipped: 0,
    typeConversions: 0,
  };

  const issues: QualityIssue[] = [];
  let processedData = [...data];
  const originalLength = processedData.length;

  // Count and handle missing values
  const missingIndices: number[] = [];
  processedData.forEach((val, idx) => {
    if (val === null || val === undefined || isNaN(val)) {
      missingIndices.push(idx);
      issues.push({
        type: QualityIssueType.MISSING_VALUE,
        affectedFeatures: [`index_${idx}`],
        severity: 'warning',
        description: `Missing value at index ${idx}`,
      });
    }
  });

  if (handleMissing && missingIndices.length > 0) {
    const validValues = processedData.filter(
      (val) => val !== null && val !== undefined && !isNaN(val)
    ) as number[];

    let fillValue: number;

    switch (missingStrategy) {
      case MissingValueStrategy.MEAN_IMPUTATION:
        fillValue = mean(validValues);
        break;
      case MissingValueStrategy.MEDIAN_IMPUTATION:
        fillValue = median(validValues);
        break;
      case MissingValueStrategy.MODE_IMPUTATION:
        fillValue = mode(validValues);
        break;
      case MissingValueStrategy.CONSTANT:
        fillValue = imputationConstant;
        break;
      default:
        fillValue = median(validValues);
    }

    missingIndices.forEach((idx) => {
      processedData[idx] = fillValue;
      stats.missingValuesFilled++;
    });

    logger.debug(`Filled ${missingIndices.length} missing values using ${missingStrategy}`);
  }

  // Filter out remaining nulls if not handling or strategy was DROP_ROWS
  const beforeFilterLength = processedData.length;
  processedData = processedData.filter(
    (val) => val !== null && val !== undefined && !isNaN(val)
  ) as number[];
  stats.missingValuesFilled += beforeFilterLength - processedData.length;

  // Clip outliers if requested
  if (clipOutliers && processedData.length > 0) {
    const { q1, q3 } = quartiles(processedData as number[]);
    const iqr = q3 - q1;
    const lowerBound = q1 - iqrMultiplier * iqr;
    const upperBound = q3 + iqrMultiplier * iqr;

    processedData = processedData.map((val) => {
      if (typeof val === 'number') {
        if (val < lowerBound || val > upperBound) {
          stats.outliersClipped++;
          return Math.max(lowerBound, Math.min(upperBound, val));
        }
      }
      return val;
    }) as number[];

    logger.debug(`Clipped ${stats.outliersClipped} outliers`);
  }

  return {
    data: processedData,
    originalLength,
    processedLength: processedData.length,
    rowsRemoved: originalLength - processedData.length,
    issuesHandled: issues,
    stats,
  };
}

/**
 * Preprocess a record-based dataset
 * 
 * @param data - Array of record objects
 * @param numericFields - Fields to treat as numeric
 * @param options - Preprocessing configuration
 * @returns Preprocessing result with processed records
 */
export function preprocessRecords<T extends Record<string, unknown>>(
  data: T[],
  numericFields: string[],
  options: PreprocessingOptions = {}
): PreprocessingResult<T> {
  const {
    removeDuplicates = true,
    handleMissing = true,
    missingStrategy = MissingValueStrategy.MEDIAN_IMPUTATION,
  } = options;

  const stats: PreprocessingStats = {
    missingValuesFilled: 0,
    duplicatesRemoved: 0,
    outliersClipped: 0,
    typeConversions: 0,
  };

  const issues: QualityIssue[] = [];
  let processedData = JSON.parse(JSON.stringify(data)) as T[];
  const originalLength = processedData.length;

  // Remove duplicates if requested
  if (removeDuplicates) {
    const seen = new Set<string>();
    const unique: T[] = [];

    for (const record of processedData) {
      const key = JSON.stringify(record);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(record);
      } else {
        stats.duplicatesRemoved++;
        issues.push({
          type: QualityIssueType.DUPLICATE,
          affectedFeatures: Object.keys(record),
          severity: 'warning',
          description: 'Duplicate record removed',
        });
      }
    }

    processedData = unique;
    logger.debug(`Removed ${stats.duplicatesRemoved} duplicate records`);
  }

  // Handle missing values for numeric fields
  if (handleMissing) {
    for (const field of numericFields) {
      const fieldValues = processedData
        .map((r) => r[field])
        .filter((v) => v !== null && v !== undefined && v !== '')
        .map((v) => Number(v))
        .filter((v) => !isNaN(v));

      if (fieldValues.length === 0) continue;

      let fillValue: number;
      switch (missingStrategy) {
        case MissingValueStrategy.MEAN_IMPUTATION:
          fillValue = mean(fieldValues);
          break;
        case MissingValueStrategy.MEDIAN_IMPUTATION:
          fillValue = median(fieldValues);
          break;
        default:
          fillValue = median(fieldValues);
      }

      for (const record of processedData) {
        const val = record[field];
        if (
          val === null ||
          val === undefined ||
          val === '' ||
          (typeof val === 'string' && isNaN(Number(val)))
        ) {
          record[field] = fillValue as unknown as T[Extract<keyof T, string>];
          stats.missingValuesFilled++;
        }
      }
    }
  }

  return {
    data: processedData,
    originalLength,
    processedLength: processedData.length,
    rowsRemoved: originalLength - processedData.length,
    issuesHandled: issues,
    stats,
  };
}

// ============== Feature Scaling Functions ==============

/** Parameters for min-max scaling */
export interface MinMaxParams {
  min: number;
  max: number;
  dataMin: number;
  dataMax: number;
}

/** Parameters for standardization (z-score) */
export interface StandardizationParams {
  mean: number;
  std: number;
}

/** Parameters for robust scaling */
export interface RobustScalingParams {
  median: number;
  iqr: number;
}

/**
 * Scale features using Min-Max normalization
 * Scales values to [min, max] range (typically [0, 1])
 * 
 * Formula: X_scaled = (X - X_min) / (X_max - X_min) * (max - min) + min
 * 
 * @param data - Array of numeric values to scale
 * @param targetMin - Target minimum value (default: 0)
 * @param targetMax - Target maximum value (default: 1)
 * @returns Tuple of [scaled data, scaling parameters for inverse transform]
 * 
 * @example
 * ```typescript
 * const [scaled, params] = minMaxScale([1, 2, 3, 4, 100]);
 * // scaled ≈ [0, 0.01, 0.02, 0.03, 1]
 * // Use params to inverse_transform later
 * ```
 */
export function minMaxScale(
  data: number[],
  targetMin: number = 0,
  targetMax: number = 1
): [number[], MinMaxParams] {
  if (data.length === 0) {
    return [[], { min: targetMin, max: targetMax, dataMin: 0, dataMax: 1 }];
  }

  const dataMin = Math.min(...data);
  const dataMax = Math.max(...data);
  const dataRange = dataMax - dataMin;

  const params: MinMaxParams = {
    min: targetMin,
    max: targetMax,
    dataMin,
    dataMax,
  };

  if (dataRange === 0) {
    // All values are the same, scale to midpoint
    const scaled = data.map(() => (targetMin + targetMax) / 2);
    return [scaled, params];
  }

  const scaled = data.map((value) => {
    return ((value - dataMin) / dataRange) * (targetMax - targetMin) + targetMin;
  });

  logger.debug(
    `MinMax scaling applied: range [${dataMin}, ${dataMax}] -> [${targetMin}, ${targetMax}]`
  );

  return [scaled, params];
}

/**
 * Inverse transform min-max scaled data back to original scale
 * 
 * @param scaledData - Min-max scaled data
 * @params - Scaling parameters from original transformation
 * @returns Data in original scale
 */
export function inverseMinMaxScale(
  scaledData: number[],
  params: MinMaxParams
): number[] {
  const { min, max, dataMin, dataMax } = params;
  const targetRange = max - min;
  const dataRange = dataMax - dataMin;

  if (targetRange === 0) {
    return scaledData.map(() => dataMin);
  }

  return scaledData.map((value) => {
    return ((value - min) / targetRange) * dataRange + dataMin;
  });
}

/**
 * Standardize features using Z-score normalization
 * Transforms data to have mean=0 and std=1
 * 
 * Formula: X_std = (X - μ) / σ
 * 
 * @param data - Array of numeric values to standardize
 * @returns Tuple of [standardized data, standardization parameters]
 * 
 * @example
 * ```typescript
 * const [standardized, params] = standardize([1, 2, 3, 4, 5]);
 * // standardized has mean≈0, std≈1
 * ```
 */
export function standardize(
  data: number[]
): [number[], StandardizationParams] {
  if (data.length === 0) {
    return [[], { mean: 0, std: 1 }];
  }

  const mu = mean(data);
  const sigma = standardDeviation(data);

  const params: StandardizationParams = {
    mean: mu,
    std: sigma,
  };

  if (sigma === 0) {
    // All values are same, return zeros
    return [data.map(() => 0), params];
  }

  const standardized = data.map((value) => (value - mu) / sigma);

  logger.debug(
    `Standardization applied: mean=${mu.toFixed(4)}, std=${sigma.toFixed(4)}`
  );

  return [standardized, params];
}

/**
 * Inverse transform standardized data back to original scale
 * 
 * @param standardizedData - Z-score standardized data
 * @params - Standardization parameters
 * @returns Data in original scale
 */
export function inverseStandardize(
  standardizedData: number[],
  params: StandardizationParams
): number[] {
  const { mean: mu, std: sigma } = params;

  return standardizedData.map((value) => value * sigma + mu);
}

/**
 * Robust scaling using median and IQR
 * More resistant to outliers than min-max or z-score
 * 
 * Formula: X_robust = (X - median) / IQR
 * 
 * @param data - Array of numeric values
 * @returns Tuple of [robustly scaled data, scaling parameters]
 */
export function robustScale(
  data: number[]
): [number[], RobustScalingParams] {
  if (data.length === 0) {
    return [[], { median: 0, iqr: 1 }];
  }

  const med = median(data);
  const { q1, q3 } = quartiles(data);
  const iqr = q3 - q1;

  const params: RobustScalingParams = {
    median: med,
    iqr: iqr || 1, // Avoid division by zero
  };

  if (iqr === 0) {
    return [data.map(() => 0), params];
  }

  const scaled = data.map((value) => (value - med) / iqr);

  logger.debug(
    `Robust scaling applied: median=${med.toFixed(4)}, IQR=${iqr.toFixed(4)}`
  );

  return [scaled, params];
}

/**
 * Apply scaling based on specified method
 * 
 * @param data - Numeric data to scale
 * @method - Normalization method to use
 * @returns Tuple of [scaled data, parameters]
 */
export function scaleFeatures(
  data: number[],
  method: NormalizationMethod
): [number[], MinMaxParams | StandardizationParams | RobustScalingParams] {
  switch (method) {
    case NormalizationMethod.MIN_MAX:
      return minMaxScale(data);
    case NormalizationMethod.STANDARD:
      return standardize(data);
    case NormalizationMethod.ROBUST:
      return robustScale(data);
    case NormalizationMethod.NONE:
    default:
      return [data, { min: 0, max: 1, dataMin: 0, dataMax: 1 }];
  }
}

// ============== Matrix Operations ==============

/**
 * Create a matrix (2D array) with given dimensions
 * 
 * @param rows - Number of rows
 * @param cols - Number of columns
 * @param fillValue - Value to fill (default: 0)
 * @returns Initialized matrix
 */
export function createMatrix(
  rows: number,
  cols: number,
  fillValue: number = 0
): number[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => fillValue)
  );
}

/**
 * Transpose a matrix (swap rows and columns)
 * 
 * @param matrix - Input matrix
 * @returns Transposed matrix
 */
export function transpose(matrix: number[][]): number[][] {
  if (matrix.length === 0) return [];

  const rows = matrix.length;
  const cols = matrix[0].length;
  const result = createMatrix(cols, rows);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = matrix[i][j];
    }
  }

  return result;
}

/**
 * Multiply two matrices
 * 
 * @param a - First matrix (m x n)
 * @param b - Second matrix (n x p)
 * @returns Product matrix (m x p)
 * @throws Error if dimensions are incompatible
 */
export function matrixMultiply(a: number[][], b: number[][]): number[][] {
  if (a.length === 0 || b.length === 0) {
    return [];
  }

  const aRows = a.length;
  const aCols = a[0].length;
  const bRows = b.length;
  const bCols = b[0].length;

  if (aCols !== bRows) {
    throw new Error(
      `Matrix dimension mismatch: ${aRows}x${aCols} cannot multiply with ${bRows}x${bCols}`
    );
  }

  const result = createMatrix(aRows, bCols);

  for (let i = 0; i < aRows; i++) {
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }

  return result;
}

/**
 * Multiply matrix by vector
 * 
 * @param matrix - Input matrix (m x n)
 * @param vector - Vector (n x 1)
 * @returns Result vector (m x 1)
 */
export function matrixVectorMultiply(
  matrix: number[][],
  vector: number[]
): number[] {
  if (matrix.length === 0) return [];

  const rows = matrix.length;
  const cols = matrix[0].length;

  if (cols !== vector.length) {
    throw new Error(
      `Dimension mismatch: matrix has ${cols} columns but vector has ${vector.length} elements`
    );
  }

  const result = new Array(rows).fill(0);

  for (let i = 0; i < rows; i++) {
    let sum = 0;
    for (let j = 0; j < cols; j++) {
      sum += matrix[i][j] * vector[j];
    }
    result[i] = sum;
  }

  return result;
}

/**
 * Element-wise matrix addition
 * 
 * @param a - First matrix
 * @param b - Second matrix (same dimensions)
 * @returns Sum matrix
 */
export function matrixAdd(a: number[][], b: number[][]): number[][] {
  if (a.length === 0) return [];

  const rows = a.length;
  const cols = a[0].length;
  const result = createMatrix(rows, cols);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[i][j] = a[i][j] + b[i][j];
    }
  }

  return result;
}

/**
 * Element-wise matrix subtraction
 */
export function matrixSubtract(a: number[][], b: number[][]): number[][] {
  if (a.length === 0) return [];

  const rows = a.length;
  const cols = a[0].length;
  const result = createMatrix(rows, cols);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[i][j] = a[i][j] - b[i][j];
    }
  }

  return result;
}

/**
 * Calculate dot product of two vectors
 * 
 * @param a - First vector
 * @param b - Second vector (same length)
 * @returns Dot product scalar
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  return a.reduce((sum, val, idx) => sum + val * b[idx], 0);
}

/**
 * Calculate Euclidean distance between two vectors
 * 
 * @param a - First vector
 * @param b - Second vector
 * @returns Euclidean distance
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  const sumOfSquares = a.reduce((sum, val, idx) => {
    const diff = val - b[idx];
    return sum + diff * diff;
  }, 0);

  return Math.sqrt(sumOfSquares);
}

/**
 * Calculate Manhattan (L1) distance between two vectors
 */
export function manhattanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  return a.reduce((sum, val, idx) => sum + Math.abs(val - b[idx]), 0);
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * @returns Value between -1 and 1 (1 = identical direction)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  const dot = dotProduct(a, b);
  const normA = Math.sqrt(dotProduct(a, a));
  const normB = Math.sqrt(dotProduct(b, b));

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (normA * normB);
}

/**
 * Compute covariance between two arrays
 */
export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) {
    return 0;
  }

  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (x[i] - meanX) * (y[i] - meanY);
  }

  return sum / (n - 1); // Sample covariance
}

/**
 * Compute Pearson correlation coefficient
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const cov = covariance(x, y);
  const stdX = standardDeviation(x);
  const stdY = standardDeviation(y);

  if (stdX === 0 || stdY === 0) {
    return 0;
  }

  return cov / (stdX * stdY);
}

// ============== Statistical Helper Functions ==============

/**
 * Calculate arithmetic mean of an array
 */
export function mean(data: number[]): number {
  if (data.length === 0) return 0;
  return data.reduce((sum, val) => sum + val, 0) / data.length;
}

/**
 * Calculate median of an array
 */
export function median(data: number[]): number {
  if (data.length === 0) return 0;

  const sorted = [...data].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Calculate mode (most frequent value) of an array
 */
export function mode(data: number[]): number {
  if (data.length === 0) return 0;

  const frequency = new Map<number, number>();
  let maxFreq = 0;
  let modeVal = data[0];

  for (const val of data) {
    const freq = (frequency.get(val) || 0) + 1;
    frequency.set(val, freq);

    if (freq > maxFreq) {
      maxFreq = freq;
      modeVal = val;
    }
  }

  return modeVal;
}

/**
 * Calculate population standard deviation
 */
export function standardDeviation(data: number[]): number {
  if (data.length <= 1) return 0;

  const mu = mean(data);
  const squaredDiffs = data.map((val) => (val - mu) ** 2);
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length;

  return Math.sqrt(variance);
}

/**
 * Calculate sample standard deviation (using n-1)
 */
export function sampleStdDev(data: number[]): number {
  if (data.length <= 1) return 0;

  const mu = mean(data);
  const squaredDiffs = data.map((val) => (val - mu) ** 2);
  const variance =
    squaredDiffs.reduce((sum, val) => sum + val, 0) / (data.length - 1);

  return Math.sqrt(variance);
}

/**
 * Calculate variance
 */
export function variance(data: number[]): number {
  if (data.length === 0) return 0;

  const mu = mean(data);
  return data.reduce((sum, val) => sum + (val - mu) ** 2, 0) / data.length;
}

/**
 * Calculate quartiles (Q1 and Q3)
 * 
 * @returns Object with q1 and q3 values
 */
export function quartiles(data: number[]): { q1: number; q3: number } {
  if (data.length === 0) return { q1: 0, q3: 0 };

  const sorted = [...data].sort((a, b) => a - b);
  const n = sorted.length;

  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);

  return {
    q1: sorted[q1Index],
    q3: sorted[q3Index],
  };
}

/**
 * Calculate interquartile range (IQR)
 */
export function iqr(data: number[]): number {
  const { q1, q3 } = quartiles(data);
  return q3 - q1;
}

/**
 * Find minimum value in array
 */
export function minValue(data: number[]): number {
  if (data.length === 0) return 0;
  return Math.min(...data);
}

/**
 * Find maximum value in array
 */
export function maxValue(data: number[]): number {
  if (data.length === 0) return 0;
  return Math.max(...data);
}

/**
 * Calculate range (max - min)
 */
export function dataRange(data: number[]): number {
  if (data.length === 0) return 0;
  return maxValue(data) - minValue(data);
}

/**
 * Calculate percentile of a value in a distribution
 * 
 * @param value - Value to find percentile for
 * @param data - Reference dataset
 * @returns Percentile (0-100)
 */
export function percentile(value: number, data: number[]): number {
  if (data.length === 0) return 0;

  const sorted = [...data].sort((a, b) => a - b);
  const belowCount = sorted.filter((v) => v < value).length;

  return (belowCount / sorted.length) * 100;
}

/**
 * Get value at a specific percentile
 * 
 * @param data - Dataset
 * @param pct - Percentile (0-100)
 * @returns Value at that percentile
 */
export function percentileValue(data: number[], pct: number): number {
  if (data.length === 0) return 0;

  const sorted = [...data].sort((a, b) => a - b);
  const index = (pct / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  // Linear interpolation
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate skewness (measure of asymmetry)
 */
export function skewness(data: number[]): number {
  if (data.length < 3) return 0;

  const n = data.length;
  const mu = mean(data);
  const sigma = standardDeviation(data);

  if (sigma === 0) return 0;

  const cubedDiffs = data.map((val) => ((val - mu) / sigma) ** 3);
  const sum = cubedDiffs.reduce((a, b) => a + b, 0);

  return (n / ((n - 1) * (n - 2))) * sum;
}

/**
 * Calculate kurtosis (measure of tailedness)
 */
export function kurtosis(data: number[]): number {
  if (data.length < 4) return 0;

  const n = data.length;
  const mu = mean(data);
  const sigma = standardDeviation(data);

  if (sigma === 0) return 0;

  const fourthDiffs = data.map((val) => ((val - mu) / sigma) ** 4);
  const sum = fourthDiffs.reduce((a, b) => a + b, 0);

  // Excess kurtosis (normal distribution = 0)
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum -
    (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

/**
 * Generate summary statistics for a dataset
 */
export function describe(data: number[]): Record<string, number> {
  if (data.length === 0) {
    return {
      count: 0,
      mean: 0,
      std: 0,
      min: 0,
      max: 0,
      median: 0,
      q1: 0,
      q3: 0,
      skewness: 0,
      kurtosis: 0,
    };
  }

  const { q1, q3 } = quartiles(data);

  return {
    count: data.length,
    mean: mean(data),
    std: standardDeviation(data),
    min: minValue(data),
    max: maxValue(data),
    median: median(data),
    q1,
    q3,
    skewness: skewness(data),
    kurtosis: kurtosis(data),
  };
}

// ============== Validation Utilities ==============

/**
 * Validation rule definition
 */
export interface ValidationRule {
  /** Rule name */
  name: string;
  /** Validation function returning error message or null if valid */
  validate: (value: unknown, context?: Record<string, unknown>) => string | null;
  /** Severity level */
  severity: 'error' | 'warning';
  /** Whether this rule should fail validation entirely */
  fatal?: boolean;
}

/**
 * Result of validation check
 */
export interface ValidationResult {
  /** Whether all validations passed */
  isValid: boolean;
  /** Errors found (fatal issues) */
  errors: ValidationError[];
  /** Warnings found (non-fatal issues) */
  warnings: ValidationError[];
  /** Summary message */
  summary: string;
}

/** Individual validation error/warning */
export interface ValidationError {
  /** Rule that triggered */
  ruleName: string;
  /** Message describing the issue */
  message: string;
  /** Severity level */
  severity: 'error' | 'warning';
  /** Path to the invalid field (for nested objects) */
  path?: string;
}

/**
 * Validate a value against multiple rules
 * 
 * @param value - Value to validate
 * @param rules - Array of validation rules
 * @param context - Additional context for validation
 * @returns Validation result with any errors/warnings
 */
export function validate(
  value: unknown,
  rules: ValidationRule[],
  context?: Record<string, unknown>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  for (const rule of rules) {
    const errorMessage = rule.validate(value, context);
    if (errorMessage !== null) {
      const issue: ValidationError = {
        ruleName: rule.name,
        message: errorMessage,
        severity: rule.severity,
      };

      if (rule.severity === 'error') {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }
    }
  }

  const isValid = errors.length === 0;
  const totalIssues = errors.length + warnings.length;

  return {
    isValid,
    errors,
    warnings,
    summary: isValid
      ? 'Validation passed'
      : `Validation failed with ${errors.length} error(s) and ${warnings.length} warning(s)`,
  };
}

/**
 * Common validation rules for ML data
 */
export const ValidationRules = {
  /**
   * Check if value is a finite number
   */
  isFiniteNumber: (): ValidationRule => ({
    name: 'isFiniteNumber',
    severity: 'error',
    fatal: true,
    validate: (value) => {
      if (typeof value !== 'number') return 'Value must be a number';
      if (!isFinite(value)) return 'Value must be finite (not NaN or Infinity)';
      return null;
    },
  }),

  /**
   * Check if value is within a range
   */
  isInRange: (min: number, max: number): ValidationRule => ({
    name: 'isInRange',
    severity: 'error',
    validate: (value) => {
      if (typeof value !== 'number') return 'Value must be a number';
      if (value < min || value > max) {
        return `Value must be between ${min} and ${max}`;
      }
      return null;
    },
  }),

  /**
   * Check if value is positive
   */
  isPositive: (): ValidationRule => ({
    name: 'isPositive',
    severity: 'error',
    validate: (value) => {
      if (typeof value !== 'number') return 'Value must be a number';
      if (value <= 0) return 'Value must be positive';
      return null;
    },
  }),

  /**
   * Check if string matches pattern
   */
  matchesPattern: (pattern: RegExp): ValidationRule => ({
    name: 'matchesPattern',
    severity: 'error',
    validate: (value) => {
      if (typeof value !== 'string') return 'Value must be a string';
      if (!pattern.test(value)) return `Value does not match required pattern`;
      return null;
    },
  }),

  /**
   * Check if array has minimum length
   */
  minLength: (min: number): ValidationRule => ({
    name: 'minLength',
    severity: 'error',
    validate: (value) => {
      if (!Array.isArray(value)) return 'Value must be an array';
      if (value.length < min) return `Array must have at least ${min} elements`;
      return null;
    },
  }),

  /**
   * Check if value is not null/undefined
   */
  isRequired: (): ValidationRule => ({
    name: 'isRequired',
    severity: 'error',
    fatal: true,
    validate: (value) => {
      if (value === null || value === undefined) return 'Value is required';
      return null;
    },
  }),

  /**
   * Check if probability is between 0 and 1
   */
  isValidProbability: (): ValidationRule => ({
    name: 'isValidProbability',
    severity: 'error',
    validate: (value) => {
      if (typeof value !== 'number') return 'Probability must be a number';
      if (value < 0 || value > 1) return 'Probability must be between 0 and 1';
      return null;
    },
  }),

  /**
   * Check if date is not in the future (for historical data)
   */
  isNotFutureDate: (): ValidationRule => ({
    name: 'isNotFutureDate',
    severity: 'warning',
    validate: (value) => {
      if (!(value instanceof Date)) return 'Value must be a Date';
      if (value > new Date()) return 'Date should not be in the future';
      return null;
    },
  }),

  /**
   * Check for reasonable transaction amount
   */
  isReasonableAmount: (maxAmount: number = 1000000): ValidationRule => ({
    name: 'isReasonableAmount',
    severity: 'warning',
    validate: (value) => {
      if (typeof value !== 'number') return 'Amount must be a number';
      if (value > maxAmount) {
        return `Amount exceeds reasonable limit of ${maxAmount}`;
      }
      if (value <= 0) return 'Amount must be positive';
      return null;
    },
  }),
};

/**
 * Validate a complete feature vector
 * 
 * @param features - Feature key-value pairs
 * @param schema - Expected types for each feature
 * @returns Validation result
 */
export function validateFeatureVector(
  features: Record<string, unknown>,
  schema: Record<string, FeatureType>
): ValidationResult {
  const rules: ValidationRule[] = [];
  const entries = Object.entries(schema);

  for (const [key, type] of entries) {
    switch (type) {
      case FeatureType.NUMERIC:
        rules.push({
          name: `${key}_numeric`,
          severity: 'error',
          validate: (val) => {
            const value = val?.[key as keyof typeof val];
            if (value === undefined || value === null) {
              return null; // Let isRequired handle this
            }
            if (typeof value !== 'number' || isNaN(value)) {
              return `${key} must be a valid number`;
            }
            return null;
          },
        });
        break;
      case FeatureType.BOOLEAN:
        rules.push({
          name: `${key}_boolean`,
          severity: 'error',
          validate: (val) => {
            const value = val?.[key as keyof typeof val];
            if (value === undefined || value === null) return null;
            if (typeof value !== 'boolean') {
              return `${key} must be a boolean`;
            }
            return null;
          },
        });
        break;
      case FeatureType.CATEGORICAL:
        rules.push({
          name: `${key}_categorical`,
          severity: 'error',
          validate: (val) => {
            const value = val?.[key as keyof typeof val];
            if (value === undefined || value === null) return null;
            if (typeof value !== 'string' && typeof value !== 'number') {
              return `${key} must be a categorical value`;
            }
            return null;
          },
        });
        break;
    }
  }

  return validate(features, rules);
}

// ============== Hashing & Caching Utilities ==============

/**
 * Generate a simple hash string from input data for cache keys
 * Uses a basic FNV-1a hash implementation
 * 
 * @param data - Data to hash
 * @returns Hexadecimal hash string
 */
export function generateHash(data: unknown): string {
  const str = JSON.stringify(data);
  
  let hash = 2166136261; // FNV offset basis
  
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, force unsigned
  }
  
  return hash.toString(16).padStart(8, '0');
}

/**
 * Simple in-memory cache with TTL support
 */
export class MLCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 300000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get cached value if exists and not expired
   */
  get(key: string): T | undefined {
    const item = this.cache.get(key);
    
    if (!item) {
      return undefined;
    }
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    
    return item.value;
  }

  /**
   * Set value in cache with optional custom TTL
   */
  set(key: string, value: T, ttl?: number): void {
    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttl ?? this.defaultTTL),
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached items
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  get size(): number {
    // Clean up expired entries
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }
}

// ============== Probability & Random Utilities ==============

/**
 * Seedable pseudo-random number generator (Mulberry32)
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed;
  }

  /**
   * Generate random number between 0 and 1
   */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer in range [min, max]
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Shuffle an array in place (Fisher-Yates)
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Sample n elements from array without replacement
   */
  sample<T>(array: T[], n: number): T[] {
    const copy = [...array];
    this.shuffle(copy);
    return copy.slice(0, Math.min(n, copy.length));
  }
}

/**
 * Sample from a categorical distribution
 * 
 * @param probabilities - Array of probabilities (must sum to ~1)
 * @param rng - Optional seeded RNG
 * @returns Index of sampled category
 */
export function sampleCategorical(
  probabilities: number[],
  rng?: SeededRandom
): number {
  const random = rng ? rng.next() : Math.random();
  let cumulative = 0;

  for (let i = 0; i < probabilities.length; i++) {
    cumulative += probabilities[i];
    if (random < cumulative) {
      return i;
    }
  }

  // Fallback to last category due to floating point
  return probabilities.length - 1;
}

/**
 * Softmax function for converting logits to probabilities
 * 
 * @param logits - Array of raw scores
 * @returns Array of probabilities summing to 1
 */
export function softmax(logits: number[]): number[] {
  if (logits.length === 0) return [];

  // Subtract max for numerical stability
  const maxLogit = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxLogit));
  const sumExps = exps.reduce((a, b) => a + b, 0);

  return exps.map((e) => e / sumExps);
}

/**
 * Sigmoid activation function
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * ReLU activation function
 */
export function relu(x: number): number {
  return Math.max(0, x);
}

/**
 * Leaky ReLU activation function
 */
export function leakyReLU(x: number, alpha: number = 0.01): number {
  return x > 0 ? x : alpha * x;
}
