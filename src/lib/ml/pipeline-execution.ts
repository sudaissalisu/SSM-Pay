/**
 * Pipeline Execution Strategies
 * Execution logic for sequential, parallel, DAG, and fallback chain modes
 * 
 * @module ml/pipeline-execution
 */

import { logger } from '@/lib/logger';
import {
  BasePredictionResult,
  PredictionError,
  PipelineConfig,
  PipelineMode,
  PipelineModelConfig,
} from './types';
import { generateHash, MLCache } from './utils';

// ============== Execution Strategy Types ==============

export interface ExecutionContext {
  input: unknown;
  config: PipelineConfig;
  executionId: string;
}

export type ModelExecutor = (
  modelId: string,
  input: unknown,
  config: PipelineConfig,
  executionId: string
) => Promise<BasePredictionResult>;

// ============== Sequential Execution ==============

/**
 * Execute models sequentially in priority order
 */
export async function executeSequential(
  context: ExecutionContext,
  executeModel: ModelExecutor,
  shouldStopEarly?: (result: BasePredictionResult) => boolean
): Promise<Map<string, BasePredictionResult>> {
  const results = new Map<string, BasePredictionResult>();
  const sortedModels = getSortedModels(context.config);

  for (const modelConfig of sortedModels) {
    if (!modelConfig.enabled) continue;

    const result = await executeModel(
      modelConfig.modelId,
      context.input,
      context.config,
      context.executionId
    );

    results.set(modelConfig.modelId, result);

    // In sequential mode, check if we should stop early
    // e.g., if fraud detected with high confidence
    if (shouldStopEarly && shouldStopEarly(result)) {
      logger.debug(
        `Early stopping after ${modelConfig.modelId} due to high-confidence result`
      );
      break;
    }
  }

  return results;
}

// ============== Parallel Execution ==============

/**
 * Execute all models in parallel
 */
export async function executeParallel(
  context: ExecutionContext,
  executeModel: ModelExecutor
): Promise<Map<string, BasePredictionResult>> {
  const results = new Map<string, BasePredictionResult>();
  const enabledModels = context.config.models.filter((m) => m.enabled);

  // Create promises for all models
  const promises = enabledModels.map(async (modelConfig) => {
    const result = await executeModel(
      modelConfig.modelId,
      context.input,
      context.config,
      context.executionId
    );
    return { modelId: modelConfig.modelId, result };
  });

  // Execute with overall timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Pipeline execution timeout')), context.config.timeout.totalMs);
  });

  const settledResults = await Promise.race([
    Promise.allSettled(promises),
    timeoutPromise,
  ]);

  // Process results
  if (Array.isArray(settledResults)) {
    for (const settled of settledResults) {
      if (settled.status === 'fulfilled') {
        results.set(settled.value.modelId, settled.value.result);
      } else {
        logger.error(`Model execution failed: ${settled.reason}`);
      }
    }
  }

  return results;
}

// ============== DAG-based Execution ==============

/**
 * Execute models respecting dependency graph (DAG mode)
 */
export async function executeDAG(
  context: ExecutionContext,
  executeModel: ModelExecutor
): Promise<Map<string, BasePredictionResult>> {
  const results = new Map<string, BasePredictionResult>();
  const executed = new Set<string>();
  const executing = new Set<string>();

  const executeWithDependencies = async (
    modelId: string
  ): Promise<void> => {
    if (executed.has(modelId)) return;
    if (executing.has(modelId)) return; // Prevent cycles

    const modelConfig = context.config.models.find((m) => m.modelId === modelId);
    if (!modelConfig || !modelConfig.enabled) {
      executed.add(modelId);
      return;
    }

    executing.add(modelId);

    // Execute dependencies first
    if (modelConfig.dependencies) {
      for (const dep of modelConfig.dependencies) {
        await executeWithDependencies(dep);
      }
    }

    // Execute this model
    const result = await executeModel(
      modelId,
      context.input,
      context.config,
      context.executionId
    );

    results.set(modelId, result);
    executed.add(modelId);
    executing.delete(modelId);
  };

  // Execute all enabled models (dependencies will be resolved automatically)
  for (const modelConfig of context.config.models) {
    if (modelConfig.enabled) {
      await executeWithDependencies(modelConfig.modelId);
    }
  }

  return results;
}

// ============== Fallback Chain Execution ==============

/**
 * Execute models in fallback chain (try each until one succeeds)
 */
export async function executeFallbackChain(
  context: ExecutionContext,
  executeModel: ModelExecutor
): Promise<Map<string, BasePredictionResult>> {
  const results = new Map<string, BasePredictionResult>();
  const sortedModels = getSortedModels(context.config);

  for (const modelConfig of sortedModels) {
    if (!modelConfig.enabled) continue;

    try {
      const result = await executeModel(
        modelConfig.modelId,
        context.input,
        context.config,
        context.executionId
      );

      results.set(modelConfig.modelId, result);

      // If successful, stop the chain
      if (result.success && result.confidence >= 0.5) {
        logger.debug(
          `Fallback chain stopped at ${modelConfig.modelId} (successful prediction)`
        );
        break;
      }
    } catch (error) {
      logger.warn(
        `Model ${modelConfig.modelId} failed in fallback chain, trying next...`,
        error
      );

      // Try fallback model if specified
      if (modelConfig.fallbackModelId) {
        const fallbackConfig = context.config.models.find(
          (m) => m.modelId === modelConfig.fallbackModelId
        );
        
        if (fallbackConfig && fallbackConfig.enabled) {
          const fallbackResult = await executeModel(
            fallbackConfig.modelId,
            context.input,
            context.config,
            context.executionId
          );
          
          results.set(fallbackConfig.modelId, fallbackResult);
          
          if (fallbackResult.success) {
            break;
          }
        }
      }
    }
  }

  return results;
}

// ============== Model Execution with Retry ==============

/**
 * Create a model executor with retry logic
 */
export function createModelExecutor(
  models: Map<string, import('./index').MLPredictor>,
  emitEvent: (type: import('./index').PipelineEventType, data: unknown, executionId?: string) => void,
  metrics: import('./pipeline-metrics').PipelineMetrics
): ModelExecutor {
  return async (
    modelId: string,
    input: unknown,
    config: PipelineConfig,
    executionId: string
  ): Promise<BasePredictionResult> => {
    const model = models.get(modelId);
    
    if (!model) {
      return createModelError(
        modelId,
        `Model '${modelId}' is not registered`,
        'MODEL_NOT_FOUND'
      );
    }

    if (!model.isAvailable()) {
      return createModelError(
        modelId,
        `Model '${modelId}' is not available`,
        'MODEL_UNAVAILABLE'
      );
    }

    emitEvent(import('./index').PipelineEventType.MODEL_STARTED, { modelId }, executionId);

    const retryConfig = config.retry;
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= (retryConfig.enabled ? retryConfig.maxAttempts : 0)) {
      try {
        // Apply timeout
        const result = await Promise.race([
          model.predict(input),
          new Promise<BasePredictionResult>((_, reject) =>
            setTimeout(
              () => reject(new Error('Model prediction timeout')),
              config.timeout.perModelMs
            )
          ),
        ]);

        emitEvent(import('./index').PipelineEventType.MODEL_COMPLETED, { modelId, result }, executionId);
        metrics.recordModelExecution(modelId, Date.now(), true);

        return result;
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt <= retryConfig.maxAttempts && retryConfig.enabled) {
          const delay = Math.min(
            retryConfig.initialDelayMs *
              Math.pow(retryConfig.backoffMultiplier, attempt - 1),
            retryConfig.maxDelayMs
          );

          emitEvent(
            import('./index').PipelineEventType.MODEL_RETRY,
            { modelId, attempt, delay, error: lastError.message },
            executionId
          );

          logger.warn(
            `Model ${modelId} attempt ${attempt} failed, retrying in ${delay}ms...`
          );

          await sleep(delay);
        }
      }
    }

    // All retries exhausted
    emitEvent(
      import('./index').PipelineEventType.MODEL_FAILED,
      { modelId, error: lastError?.message, attempts: attempt },
      executionId
    );

    metrics.recordModelExecution(modelId, Date.now(), false);

    return createModelError(
      modelId,
      lastError?.message || 'Unknown error',
      'MAX_RETRIES_EXCEEDED'
    );
  };
}

// ============== Helper Functions ==============

/**
 * Get models sorted by priority
 */
export function getSortedModels(config: PipelineConfig): PipelineModelConfig[] {
  return [...config.models].sort((a, b) => a.priority - b.priority);
}

/**
 * Check if we should stop early in sequential mode
 */
export function checkShouldStopEarly(result: BasePredictionResult): boolean {
  // Stop if high confidence detection (e.g., clear fraud)
  const resultAny = result as Record<string, unknown>;
  
  if (resultAny.isAnomalous === true && result.confidence > 0.95) {
    return true;
  }

  if (
    typeof resultAny.riskScore === 'number' &&
    (resultAny.riskScore as number) > 90
  ) {
    return true;
  }

  return false;
}

/**
 * Generate cache key from input data
 */
export function generateCacheKey(pipelineId: string, input: unknown): string {
  const hash = generateHash(input);
  return `${pipelineId}:${hash}`;
}

/**
 * Get cached result or undefined
 */
export function getCachedResult(
  cache: MLCache<import('./types').AggregatedResult>,
  pipelineId: string,
  input: unknown
): import('./types').AggregatedResult | undefined {
  const cacheKey = generateCacheKey(pipelineId, input);
  return cache.get(cacheKey);
}

/**
 * Store result in cache
 */
export function setCachedResult(
  cache: MLCache<import('./types').AggregatedResult>,
  pipelineId: string,
  input: unknown,
  result: import('./types').AggregatedResult
): void {
  const cacheKey = generateCacheKey(pipelineId, input);
  cache.set(cacheKey, result);
}

/**
 * Sleep helper for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create error result for a model
 */
function createModelError(
  modelId: string,
  message: string,
  code: string
): BasePredictionResult {
  const error: PredictionError = {
    code,
    message,
  };

  return {
    predictionId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    modelId,
    timestamp: new Date(),
    processingTimeMs: 0,
    success: false,
    confidence: 0,
    error,
  };
}
