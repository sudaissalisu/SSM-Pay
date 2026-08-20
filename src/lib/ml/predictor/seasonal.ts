/**
 * Seasonal Pattern Detection Logic
 * @module ml/predictor/seasonal
 * @description Seasonal pattern detection and analysis for transaction data.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import {
  SeasonalPattern,
  SeasonalPatternType,
  PeriodRange,
  PredictionResult,
  TimeSeriesPoint,
  PredictionConfig,
} from './types';
import { calculateMean, calculateStdDev } from './volume';

// ============== Pattern Detection ==============

/**
 * Detect pattern for a specific period
 */
export function detectPatternForPeriod(
  values: number[],
  period: number,
  patternType: SeasonalPatternType
): SeasonalPattern {
  const overallMean = calculateMean(values);
  
  if (overallMean === 0) {
    return {
      patternType: 'none',
      periodDays: period,
      strength: 0,
      peakPeriods: [],
      lowPeriods: [],
      amplitude: 0,
      phaseOffset: 0,
      significance: 0,
      description: 'No significant pattern detected',
    };
  }
  
  // Calculate seasonal indices for this period
  const indices: number[] = [];
  for (let s = 0; s < period; s++) {
    const seasonValues: number[] = [];
    for (let i = s; i < values.length; i += period) {
      seasonValues.push(values[i]);
    }
    indices.push(calculateMean(seasonValues) / overallMean);
  }
  
  // Calculate pattern strength (coefficient of variation of indices)
  const indexMean = calculateMean(indices);
  const indexStd = calculateStdDev(indices);
  const strength = indexMean > 0 ? Math.min(1, indexStd / indexMean) : 0;
  
  // Find peaks and troughs
  const peakThreshold = 1 + indexStd * 0.5;
  const lowThreshold = 1 - indexStd * 0.5;
  
  const peakPeriods: PeriodRange[] = [];
  const lowPeriods: PeriodRange[] = [];
  
  let inPeak = false;
  let inLow = false;
  let peakStart = 0;
  let lowStart = 0;
  
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] >= peakThreshold && !inPeak) {
      peakStart = i;
      inPeak = true;
    } else if (indices[i] < peakThreshold && inPeak) {
      peakPeriods.push({
        start: peakStart,
        end: i - 1,
        multiplier: calculateMean(indices.slice(peakStart, i)),
        label: getPeriodLabel(patternType, peakStart, i - 1),
      });
      inPeak = false;
    }
    
    if (indices[i] <= lowThreshold && !inLow) {
      lowStart = i;
      inLow = true;
    } else if (indices[i] > lowThreshold && inLow) {
      lowPeriods.push({
        start: lowStart,
        end: i - 1,
        multiplier: calculateMean(indices.slice(lowStart, i)),
        label: getPeriodLabel(patternType, lowStart, i - 1),
      });
      inLow = false;
    }
  }
  
  // Handle unclosed ranges
  if (inPeak) {
    peakPeriods.push({
      start: peakStart,
      end: indices.length - 1,
      multiplier: calculateMean(indices.slice(peakStart)),
      label: getPeriodLabel(patternType, peakStart, indices.length - 1),
    });
  }
  if (inLow) {
    lowPeriods.push({
      start: lowStart,
      end: indices.length - 1,
      multiplier: calculateMean(indices.slice(lowStart)),
      label: getPeriodLabel(patternType, lowStart, indices.length - 1),
    });
  }
  
  // Calculate amplitude
  const amplitude = Math.max(...indices) - Math.min(...indices);
  
  // Find phase offset (position of maximum)
  const maxIndex = indices.indexOf(Math.max(...indices));
  
  // Calculate statistical significance
  const significance = calculateSeasonalSignificance(values, indices, period);
  
  return {
    patternType,
    periodDays: period,
    strength: Math.min(1, strength * 3),
    peakPeriods,
    lowPeriods,
    amplitude,
    phaseOffset: maxIndex,
    significance,
    description: generatePatternDescription(patternType, strength, peakPeriods, lowPeriods),
  };
}

// ============== Helper Functions ==============

/**
 * Get human-readable label for a period
 */
function getPeriodLabel(patternType: SeasonalPatternType, start: number, end: number): string {
  switch (patternType) {
    case 'weekly':
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      if (start === end) return days[start];
      return `${days[start]} - ${days[end]}`;
    case 'monthly':
      if (start < 7) return `Beginning of month (day ${start + 1}-${end + 1})`;
      if (start < 14) return `First half of month (day ${start + 1}-${end + 1})`;
      if (start < 21) return `Third week (day ${start + 1}-${end + 1})`;
      return `End of month (day ${start + 1}-${end + 1})`;
    default:
      return `Period ${start + 1} - ${end + 1}`;
  }
}

/**
 * Calculate statistical significance of seasonal pattern
 */
function calculateSeasonalSignificance(
  values: number[],
  indices: number[],
  period: number
): number {
  const seasonalVariation = calculateStdDev(indices);
  const expectedRandomVariation = 1 / Math.sqrt(values.length / period);
  
  return Math.min(1, seasonalVariation / (expectedRandomVariation + 0.01));
}

/**
 * Generate human-readable pattern description
 */
function generatePatternDescription(
  patternType: SeasonalPatternType,
  strength: number,
  peaks: PeriodRange[],
  lows: PeriodRange[]
): string {
  if (strength < 0.2) return `No significant ${patternType} pattern detected`;
  
  const peakDesc = peaks.length > 0 
    ? `Peaks occur during: ${peaks.map(p => p.label).join(', ')}`
    : '';
  const lowDesc = lows.length > 0 
    ? `Low periods: ${lows.map(p => p.label).join(', ')}`
    : '';
  
  return [`Strong ${patternType} pattern detected (strength: ${(strength * 100).toFixed(0)}%)`, peakDesc, lowDesc]
    .filter(Boolean)
    .join('. ');
}

// ============== Full Seasonal Detection ==============

/**
 * Perform complete seasonal pattern detection
 */
export function detectSeasonalPatterns(
  modelVersion: string,
  config: PredictionConfig,
  trainingData: TimeSeriesPoint[]
): PredictionResult<SeasonalPattern[]> {
  const startTime = Date.now();
  
  if (trainingData.length < config.seasonalityPeriod * 2) {
    throw new AppError(
      'Insufficient data for seasonal pattern detection',
      ErrorCode.VALIDATION_ERROR,
      { severity: 'warning' }
    );
  }

  try {
    const patterns: SeasonalPattern[] = [];
    const counts = trainingData.map(d => d.count);
    
    // Detect weekly pattern
    const weeklyPattern = detectPatternForPeriod(counts, 7, 'weekly');
    patterns.push(weeklyPattern);
    
    // Detect monthly pattern (approximate with 30-day period)
    if (counts.length >= 60) {
      const monthlyPattern = detectPatternForPeriod(counts, 30, 'monthly');
      patterns.push(monthlyPattern);
    }
    
    // Determine dominant pattern
    const dominantPattern = patterns.reduce((max, p) => p.strength > max.strength ? p : max, patterns[0]);
    
    // If mixed patterns detected, add summary
    if (patterns.length > 1 && patterns.every(p => p.strength > 0.3)) {
      patterns.push({
        patternType: 'mixed',
        periodDays: 7,
        strength: Math.min(1, patterns.reduce((sum, p) => sum + p.strength, 0) / patterns.length),
        peakPeriods: dominantPattern.peakPeriods,
        lowPeriods: dominantPattern.lowPeriods,
        amplitude: dominantPattern.amplitude,
        phaseOffset: dominantPattern.phaseOffset,
        significance: Math.min(...patterns.map(p => p.significance)),
        description: `Multiple seasonal patterns detected: ${patterns.map(p => p.patternType).join(', ')}`,
      });
    }
    
    const result: PredictionResult<SeasonalPattern[]> = {
      predictions: patterns,
      modelVersion,
      predictedAt: new Date(),
      confidence: dominantPattern.strength,
      featuresUsed: ['count', 'timestamp'],
      processingTimeMs: Date.now() - startTime,
    };
    
    logger.info('Seasonal pattern detection completed', {
      event: 'ml.predictor.seasonal-complete',
      metadata: {
        patternsDetected: patterns.length,
        dominantPattern: dominantPattern.patternType,
        processingTimeMs: result.processingTimeMs,
      },
    });
    
    return result;
  } catch (error) {
    logger.error('Seasonal pattern detection failed', {
      event: 'ml.predictor.seasonal-error',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    throw error instanceof AppError ? error : new AppError(
      'Failed to detect seasonal patterns',
      ErrorCode.UNKNOWN_ERROR,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}
