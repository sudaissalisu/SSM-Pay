/**
 * Pipeline Result Aggregation
 * Aggregation strategies for combining multiple model predictions
 * 
 * @module ml/pipeline-aggregation
 */

import {
  BasePredictionResult,
  AggregatedResult,
  AggregationMethod,
  AggregationConfig,
  DisagreementDetail,
} from './types';

// ============== Main Aggregation Function ==============

/**
 * Aggregate results from multiple models into a single prediction
 */
export function aggregateResults(
  modelResults: Map<string, BasePredictionResult>,
  aggregationConfig: AggregationConfig
): AggregatedResult {
  const resultsArray = Array.from(modelResults.values());
  const successfulResults = resultsArray.filter((r) => r.success);

  if (successfulResults.length === 0) {
    return {
      finalPrediction: null,
      confidence: 0,
      agreement: 0,
      agreeingModels: 0,
      totalModels: resultsArray.length,
      disagreements: [],
      method: aggregationConfig.method,
    };
  }

  switch (aggregationConfig.method) {
    case AggregationMethod.MAJORITY_VOTE:
      return majorityVoteAggregation(successfulResults, modelResults);
    case AggregationMethod.WEIGHTED_VOTE:
      return weightedVoteAggregation(successfulResults, modelResults, aggregationConfig);
    case AggregationMethod.AVERAGE:
      return averageAggregation(successfulResults);
    case AggregationMethod.WEIGHTED_AVERAGE:
      return weightedAverageAggregation(successfulResults, aggregationConfig);
    case AggregationMethod.MAX:
      return maxAggregation(successfulResults);
    case AggregationMethod.MIN:
      return minAggregation(successfulResults);
    default:
      return averageAggregation(successfulResults);
  }
}

// ============== Aggregation Strategies ==============

/**
 * Majority vote aggregation for classification tasks
 */
function majorityVoteAggregation(
  results: BasePredictionResult[],
  _allResults: Map<string, BasePredictionResult>
): AggregatedResult {
  // Extract predictions (assuming they have predictedClass or value)
  const votes = new Map<string, number>();
  
  for (const result of results) {
    const prediction = extractPredictionValue(result);
    const key = String(prediction);
    votes.set(key, (votes.get(key) || 0) + 1);
  }

  // Find majority
  let maxVotes = 0;
  let majorityPrediction: string = '';
  
  for (const [prediction, count] of votes.entries()) {
    if (count > maxVotes) {
      maxVotes = count;
      majorityPrediction = prediction;
    }
  }

  const confidence = maxVotes / results.length;
  const disagreements = findDisagreements(results, majorityPrediction);

  return {
    finalPrediction: majorityPrediction,
    confidence,
    agreement: confidence,
    agreeingModels: maxVotes,
    totalModels: results.length,
    disagreements: disagreements.length > 0 ? disagreements : undefined,
    method: AggregationMethod.MAJORITY_VOTE,
  };
}

/**
 * Weighted vote aggregation
 */
function weightedVoteAggregation(
  results: BasePredictionResult[],
  _allResults: Map<string, BasePredictionResult>,
  config: AggregationConfig
): AggregatedResult {
  // Get weights from config if available, otherwise use equal weights
  const votes = new Map<string, number>();
  const defaultWeight = 1 / results.length;

  for (const result of results) {
    const weight = config.weights?.[result.modelId] ?? defaultWeight;
    const prediction = String(extractPredictionValue(result));
    votes.set(prediction, (votes.get(prediction) || 0) + weight);
  }

  let maxScore = 0;
  let winningPrediction = '';

  for (const [prediction, score] of votes.entries()) {
    if (score > maxScore) {
      maxScore = score;
      winningPrediction = prediction;
    }
  }

  const disagreements = findDisagreements(results, winningPrediction);

  return {
    finalPrediction: winningPrediction,
    confidence: Math.min(maxScore, 1),
    agreement: calculateAgreement(results),
    agreeingModels: countAgreeingModels(results, winningPrediction),
    totalModels: results.length,
    disagreements: disagreements.length > 0 ? disagreements : undefined,
    method: AggregationMethod.WEIGHTED_VOTE,
  };
}

/**
 * Simple average aggregation for numeric outputs
 */
function averageAggregation(results: BasePredictionResult[]): AggregatedResult {
  const values = results.map((r) => extractNumericValue(r));
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length
  );

  return {
    finalPrediction: avg,
    confidence: 1 / (1 + std), // Higher confidence when std is lower
    agreement: calculateAgreement(results),
    agreeingModels: results.length,
    totalModels: results.length,
    method: AggregationMethod.AVERAGE,
  };
}

/**
 * Weighted average aggregation
 */
function weightedAverageAggregation(
  results: BasePredictionResult[],
  config: AggregationConfig
): AggregatedResult {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const result of results) {
    const weight = config.weights?.[result.modelId] ?? 1 / results.length;
    const value = extractNumericValue(result);
    weightedSum += value * weight;
    totalWeight += weight;
  }

  const avg = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    finalPrediction: avg,
    confidence: averageConfidence(results),
    agreement: calculateAgreement(results),
    agreeingModels: results.length,
    totalModels: results.length,
    method: AggregationMethod.WEIGHTED_AVERAGE,
  };
}

/**
 * Max aggregation (take highest score/value)
 */
function maxAggregation(results: BasePredictionResult[]): AggregatedResult {
  let maxValue = -Infinity;
  let maxResult: BasePredictionResult | null = null;

  for (const result of results) {
    const value = extractNumericValue(result);
    if (value > maxValue) {
      maxValue = value;
      maxResult = result;
    }
  }

  return {
    finalPrediction: maxValue,
    confidence: maxResult?.confidence ?? 0,
    agreement: calculateAgreement(results),
    agreeingModels: countAgreeingModels(results, maxValue),
    totalModels: results.length,
    method: AggregationMethod.MAX,
  };
}

/**
 * Min aggregation (take lowest score/value)
 */
function minAggregation(results: BasePredictionResult[]): AggregatedResult {
  let minValue = Infinity;
  let minResult: BasePredictionResult | null = null;

  for (const result of results) {
    const value = extractNumericValue(result);
    if (value < minValue) {
      minValue = value;
      minResult = result;
    }
  }

  return {
    finalPrediction: minValue,
    confidence: minResult?.confidence ?? 0,
    agreement: calculateAgreement(results),
    agreeingModels: countAgreeingModels(results, minValue),
    totalModels: results.length,
    method: AggregationMethod.MIN,
  };
}

// ============== Helper Functions ==============

/**
 * Extract prediction value from result
 */
export function extractPredictionValue(result: BasePredictionResult): unknown {
  const resultAny = result as Record<string, unknown>;
  return (
    resultAny.predictedClass ??
    resultAny.value ??
    resultAny.isAnomalous ??
    resultAny.riskScore ??
    null
  );
}

/**
 * Extract numeric value from result
 */
export function extractNumericValue(result: BasePredictionResult): number {
  const value = extractPredictionValue(result);
  return typeof value === 'number' ? value : result.confidence;
}

/**
 * Find disagreements among model predictions
 */
function findDisagreements(
  results: BasePredictionResult[],
  majorityPrediction: string
): DisagreementDetail[] {
  const disagreements: DisagreementDetail[] = [];

  for (const result of results) {
    const prediction = String(extractPredictionValue(result));
    if (prediction !== majorityPrediction) {
      disagreements.push({
        modelId: result.modelId,
        prediction,
        majorityPrediction,
        deviationScore: Math.abs(result.confidence - 0.5) * 2,
      });
    }
  }

  return disagreements;
}

/**
 * Calculate agreement level among models (0-1)
 */
export function calculateAgreement(results: BasePredictionResult[]): number {
  if (results.length <= 1) return 1;

  const predictions = results.map((r) => String(extractPredictionValue(r)));
  const uniquePredictions = new Set(predictions);

  // Perfect agreement if all same
  if (uniquePredictions.size === 1) return 1;

  // No agreement if all different
  if (uniquePredictions.size === results.length) return 0;

  // Partial agreement based on majority proportion
  const counts = new Map<string, number>();
  for (const pred of predictions) {
    counts.set(pred, (counts.get(pred) || 0) + 1);
  }

  const maxCount = Math.max(...counts.values());
  return maxCount / results.length;
}

/**
 * Count models that agree with given prediction
 */
function countAgreeingModels(
  results: BasePredictionResult[],
  targetPrediction: unknown
): number {
  return results.filter(
    (r) => String(extractPredictionValue(r)) === String(targetPrediction)
  ).length;
}

/**
 * Average confidence across results
 */
export function averageConfidence(results: BasePredictionResult[]): number {
  if (results.length === 0) return 0;
  return results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
}
