/**
 * Volume Forecasting Functions
 * @module ml/predictor/volume
 * @description Time series forecasting functions including Holt-Winters, EMA, 
 * moving averages for volume prediction.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// Re-export stats functions for convenience
export {
  calculateMean,
  calculateStdDev,
  calculateVariance,
  calculateMedian,
  calculatePercentile,
  calculateCorrelation,
  calculateRSquared,
  normalizeMinMax,
  standardizeZScore,
  sigmoid,
  relu,
} from './stats';

// ============== Moving Average Functions ==============

/**
 * Calculate simple moving average
 */
export function simpleMovingAverage(values: number[], window: number): number[] {
  if (window <= 0 || values.length === 0) return [];
  if (window >= values.length) return [calculateMean(values)];
  
  const result: number[] = [];
  for (let i = window - 1; i < values.length; i++) {
    const windowSlice = values.slice(i - window + 1, i + 1);
    result.push(calculateMean(windowSlice));
  }
  
  return result;
}

/**
 * Calculate weighted moving average
 */
export function weightedMovingAverage(values: number[], weights: number[]): number[] {
  if (weights.length === 0 || values.length === 0) return [];
  const window = weights.length;
  if (values.length < window) return [calculateMean(values)];
  
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const result: number[] = [];
  
  for (let i = window - 1; i < values.length; i++) {
    const windowSlice = values.slice(i - window + 1, i + 1);
    let weightedSum = 0;
    for (let j = 0; j < window; j++) {
      weightedSum += windowSlice[j] * weights[j];
    }
    result.push(weightedSum / weightSum);
  }
  
  return result;
}

/**
 * Calculate exponential moving average
 */
export function exponentialMovingAverage(values: number[], alpha: number = 0.3): number[] {
  if (values.length === 0) return [];
  if (alpha <= 0 || alpha > 1) alpha = 0.3;
  
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(alpha * values[i] + (1 - alpha) * ema[i - 1]);
  }
  
  return ema;
}

// ============== Exponential Smoothing Functions ==============

/**
 * Apply double exponential smoothing (Holt's method)
 */
export function doubleExponentialSmoothing(
  values: number[],
  alpha: number = 0.3,
  beta: number = 0.1
): { smoothed: number[]; trend: number[] } {
  if (values.length < 2) {
    return { smoothed: values.slice(), trend: new Array(values.length).fill(0) };
  }
  
  const smoothed: number[] = [values[0]];
  const trend: number[] = [values[1] - values[0]];
  const level: number[] = [values[0]];
  
  for (let i = 1; i < values.length; i++) {
    const prevLevel = level[i - 1];
    const prevTrend = trend[i - 1];
    
    const newLevel = alpha * values[i] + (1 - alpha) * (prevLevel + prevTrend);
    const newTrend = beta * (newLevel - prevLevel) + (1 - beta) * prevTrend;
    
    level.push(newLevel);
    trend.push(newTrend);
    smoothed.push(newLevel + newTrend);
  }
  
  return { smoothed, trend };
}

/**
 * Apply triple exponential smoothing (Holt-Winters)
 */
export function holtWintersSmoothing(
  values: number[],
  seasonLength: number = 7,
  alpha: number = 0.3,
  beta: number = 0.1,
  gamma: number = 0.1
): {
  smoothed: number[];
  level: number[];
  trend: number[];
  seasonal: number[];
} {
  if (values.length < seasonLength * 2) {
    logger.warn('Insufficient data for Holt-Winters smoothing', {
      event: 'ml.holt-warnings',
      metadata: { dataLength: values.length, requiredLength: seasonLength * 2 },
    });
    return {
      smoothed: values.slice(),
      level: values.slice(),
      trend: new Array(values.length).fill(0),
      seasonal: new Array(values.length).fill(0),
    };
  }
  
  // Initialize seasonal indices
  const seasonalIndices: number[] = [];
  for (let s = 0; s < seasonLength; s++) {
    const seasonValues: number[] = [];
    for (let i = s; i < values.length; i += seasonLength) {
      seasonValues.push(values[i]);
    }
    const seasonAvg = calculateMean(seasonValues);
    const globalAvg = calculateMean(values);
    seasonalIndices.push(globalAvg > 0 ? seasonAvg / globalAvg : 1);
  }
  
  // Initialize level and trend using first season
  let level = values[0] / seasonalIndices[0];
  const initialTrend =
    (calculateMean(values.slice(0, seasonLength)) -
      calculateMean(values.slice(seasonLength, seasonLength * 2))) /
    seasonLength;
  let trend = initialTrend;
  
  const levels: number[] = [level];
  const trends: number[] = [trend];
  const seasonal: number[] = seasonalIndices.slice();
  const smoothed: number[] = [];
  
  for (let i = 0; i < values.length; i++) {
    const s = i % seasonLength;
    
    if (i > 0) {
      const newLevel =
        alpha * (values[i] / seasonal[s]) + (1 - alpha) * (level + trend);
      const newTrend =
        beta * (newLevel - level) + (1 - beta) * trend;
      const newSeasonal =
        gamma * (values[i] / newLevel) + (1 - gamma) * seasonal[s];
      
      level = newLevel;
      trend = newTrend;
      seasonal[s] = newSeasonal;
      
      levels.push(level);
      trends.push(trend);
    }
    
    smoothed.push((level + trend) * seasonal[s]);
  }
  
  return { smoothed, level: levels, trend: trends, seasonal };
}

// ============== Regression Functions ==============

/**
 * Perform linear regression
 */
export function linearRegression(x: number[], y: number[]): {
  slope: number;
  intercept: number;
  rSquared: number;
  standardError: number;
  predict: (x: number) => number;
} {
  if (x.length !== y.length || x.length < 2) {
    return {
      slope: 0,
      intercept: 0,
      rSquared: 0,
      standardError: 0,
      predict: (val: number) => 0,
    };
  }
  
  const n = x.length;
  const meanX = calculateMean(x);
  const meanY = calculateMean(y);
  
  let sumXY = 0;
  let sumXX = 0;
  
  for (let i = 0; i < n; i++) {
    sumXY += (x[i] - meanX) * (y[i] - meanY);
    sumXX += (x[i] - meanX) * (x[i] - meanX);
  }
  
  const slope = sumXX === 0 ? 0 : sumXY / sumXX;
  const intercept = meanY - slope * meanX;
  
  const predicted = x.map(xi => slope * xi + intercept);
  const rSquared = calculateRSquared(y, predicted);
  
  const residuals = y.map((yi, i) => yi - predicted[i]);
  const mse = residuals.reduce((sum, r) => sum + r * r, 0) / (n - 2);
  const standardError = Math.sqrt(mse);
  
  return {
    slope,
    intercept,
    rSquared,
    standardError,
    predict: (val: number) => slope * val + intercept,
  };
}

/**
 * Perform polynomial regression
 */
export function polynomialRegression(
  x: number[],
  y: number[],
  degree: number = 2
): {
  coefficients: number[];
  rSquared: number;
  predict: (x: number) => number;
} {
  if (x.length !== y.length || x.length <= degree) {
    return {
      coefficients: new Array(degree + 1).fill(0),
      rSquared: 0,
      predict: (_val: number) => 0,
    };
  }
  
  const n = x.length;
  const m = degree + 1;
  
  // Create design matrix X
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < m; j++) {
      row.push(Math.pow(x[i], j));
    }
    X.push(row);
  }
  
  // Compute X^T * X
  const XtX: number[][] = Array(m).fill(null).map(() => Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      for (let k = 0; k < n; k++) {
        XtX[i][j] += X[k][i] * X[k][j];
      }
    }
  }
  
  // Compute X^T * y
  const Xty: number[] = Array(m).fill(0);
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < n; k++) {
      Xty[i] += X[k][i] * y[k];
    }
  }
  
  const coefficients = gaussianElimination(XtX, Xty);
  
  const predicted = x.map(xi =>
    coefficients.reduce((sum, coef, j) => sum + coef * Math.pow(xi, j), 0)
  );
  const rSquared = calculateRSquared(y, predicted);
  
  return {
    coefficients,
    rSquared,
    predict: (val: number) =>
      coefficients.reduce((sum, coef, j) => sum + coef * Math.pow(val, j), 0),
  };
}

/**
 * Gaussian elimination for solving linear systems
 */
function gaussianElimination(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const aug = matrix.map((row, i) => [...row, vector[i]]);
  
  // Forward elimination
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }
    
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    
    if (Math.abs(aug[col][col]) < 1e-10) continue;
    
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }
  
  // Back substitution
  const solution = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    if (Math.abs(aug[row][row]) < 1e-10) {
      solution[row] = 0;
      continue;
    }
    solution[row] = aug[row][n];
    for (let col = row + 1; col < n; col++) {
      solution[row] -= aug[row][col] * solution[col];
    }
    solution[row] /= aug[row][row];
  }
  
  return solution;
}

// ============== Anomaly Detection Utilities ==============

/**
 * Detect anomalies using z-score method
 */
export function detectAnomaliesZScore(
  values: number[],
  threshold: number = 2.5
): { index: number; value: number; zScore: number }[] {
  const { standardized } = standardizeZScore(values);
  const anomalies: { index: number; value: number; zScore: number }[] = [];
  
  for (let i = 0; i < standardized.length; i++) {
    if (Math.abs(standardized[i]) > threshold) {
      anomalies.push({
        index: i,
        value: values[i],
        zScore: standardized[i],
      });
    }
  }
  
  return anomalies;
}

/**
 * Detect anomalies using IQR method
 */
export function detectAnomaliesIQR(
  values: number[],
  multiplier: number = 1.5
): { index: number; value: number; type: 'outlier_high' | 'outlier_low' }[] {
  if (values.length === 0) return [];
  
  const q1 = calculatePercentile(values, 25);
  const q3 = calculatePercentile(values, 75);
  const iqr = q3 - q1;
  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;
  
  const anomalies: { index: number; value: number; type: 'outlier_high' | 'outlier_low' }[] = [];
  
  for (let i = 0; i < values.length; i++) {
    if (values[i] < lowerBound) {
      anomalies.push({ index: i, value: values[i], type: 'outlier_low' });
    } else if (values[i] > upperBound) {
      anomalies.push({ index: i, value: values[i], type: 'outlier_high' });
    }
  }
  
  return anomalies;
}
