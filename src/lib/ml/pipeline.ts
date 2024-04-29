/**
 * Machine Learning Pipeline Orchestrator for SSM-Pay
 * 
 * @module ml/pipeline
 * @description Comprehensive pipeline system for combining multiple ML models,
 * supporting sequential and parallel execution, result aggregation, ensemble methods,
 * and A/B testing for model comparison.
 * 
 * @features
 * - Sequential and parallel model execution modes
 * - DAG-based dependency resolution for complex pipelines
 * - Multiple aggregation strategies (voting, averaging, stacking)
 * - Built-in retry mechanism with exponential backoff
 * - Result caching with configurable TTL
 * - A/B testing framework for model comparison
 * - Fallback chain support for high availability
 * - Comprehensive logging and metrics collection
 * 
 * @example
 * ```typescript
 * import { MLPipeline } from '@/lib/ml/pipeline';
 * 
 * const pipeline = new MLPipeline({
 *   id: 'fraud-detection-pipeline',
 *   name: 'Fraud Detection Pipeline',
 *   mode: PipelineMode.PARALLEL,
 *   models: [
 *     { modelId: 'fraud-detector', enabled: true, weight: 0.4, priority: 1 },
 *     { modelId: 'anomaly-detector', enabled: true, weight: 0.35, priority: 2 },
 *     { modelId: 'risk-engine', enabled: true, weight: 0.25, priority: 3 },
 *   ],
 *   // ... other config
 * });
 * 
 * const result = await pipeline.execute(transactionData);
 * ```
 * 
 * @version 2.0.0
 * @since 2.0.0
 * @author SSM-Pay ML Engineering Team
 */

import { logger } from '@/lib/logger';
import {
  BasePredictionResult,
  PredictionError,
  AggregatedResult,
  AggregationMethod,
  DisagreementDetail,
  PipelineConfig,
  PipelineMode,
  PipelineModelConfig,
  AggregationConfig,
  RetryConfig,
  CachingConfig,
  ABTestingConfig,
  ABTestResults,
  ABTestGroupResult,
  PipelineResult,
  PipelineExecutionMetadata,
  ModelMetadata,
} from './types';
import { generateHash, MLCache } from './utils';

// ============== Model Interface ==============

/**
 * Interface that all ML models must implement to be used in the pipeline
 */
export interface MLPredictor {
  /** Unique model identifier */
  readonly id: string;
  /** Model metadata */
  readonly metadata: ModelMetadata;
  
  /**
   * Execute prediction on input data
   * @param input - Input data for prediction
   * @returns Prediction result
   */
  predict(input: unknown): Promise<BasePredictionResult>;
  
  /**
   * Check if model is available for predictions
   */
  isAvailable(): boolean;
  
  /**
   * Get current model health status
   */
  getHealth(): ModelHealthStatus;
}

/**
 * Health status of a model
 */
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

// ============== Pipeline Events ==============

/**
 * Event types emitted by the pipeline
 */
export enum PipelineEventType {
  /** Execution started */
  EXECUTION_STARTED = 'execution_started',
  /** Execution completed */
  EXECUTION_COMPLETED = 'execution_completed',
  /** Execution failed */
  EXECUTION_FAILED = 'execution_failed',
  /** Individual model started */
  MODEL_STARTED = 'model_started',
  /** Individual model completed */
  MODEL_COMPLETED = 'model_completed',
  /** Individual model failed */
  MODEL_FAILED = 'model_failed',
  /** Model retry attempted */
  MODEL_RETRY = 'model_retry',
  /** Cache hit */
  CACHE_HIT = 'cache_hit',
  /** Cache miss */
  CACHE_MISS = 'cache_miss',
  /** A/B test group assigned */
  AB_GROUP_ASSIGNED = 'ab_group_assigned',
}

/**
 * Pipeline event payload
 */
export interface PipelineEvent<T = unknown> {
  type: PipelineEventType;
  timestamp: Date;
  data: T;
  pipelineId: string;
  executionId?: string;
}

/** Event listener callback type */
export type PipelineEventListener<T = unknown> = (event: PipelineEvent<T>) => void;

// ============== Pipeline Orchestrator Class ==============

/**
 * Main ML Pipeline orchestrator class
 * 
 * Combines multiple ML models into a unified prediction pipeline with
 * configurable execution modes, aggregation strategies, and monitoring.
 */
export class MLPipeline {
  /** Pipeline configuration */
  private config: PipelineConfig;
  
  /** Registered models map */
  private models: Map<string, MLPredictor> = new Map();
  
  /** Result cache */
  private cache: MLCache<AggregatedResult>;
  
  /** Event listeners */
  private listeners: Map<PipelineEventType, Set<PipelineEventListener>> = new Map();
  
  /** Metrics collector */
  private metrics: PipelineMetrics;
  
  /** A/B test state tracker */
  private abTestState: ABTestState | null = null;

  constructor(config: PipelineConfig) {
    this.config = this.validateConfig(config);
    this.cache = new MLCache(
      config.caching.maxSize,
      config.caching.ttlMs
    );
    this.metrics = new PipelineMetrics();
    
    logger.info(`MLPipeline initialized: ${config.name} (${config.id})`);
    
    if (config.abTesting?.enabled) {
      this.initializeABTest(config.abTesting);
    }
  }

  // ============== Configuration ==============

  /**
   * Validate and normalize pipeline configuration
   */
  private validateConfig(config: PipelineConfig): PipelineConfig {
    // Validate required fields
    if (!config.id || !config.name) {
      throw new Error('Pipeline ID and name are required');
    }

    if (!config.models || config.models.length === 0) {
      throw new Error('At least one model must be configured');
    }

    // Validate weights sum to ~1 for weighted methods
    const enabledModels = config.models.filter((m) => m.enabled);
    const totalWeight = enabledModels.reduce((sum, m) => sum + m.weight, 0);
    
    if (
      [AggregationMethod.WEIGHTED_VOTE, AggregationMethod.WEIGHTED_AVERAGE].includes(
        config.aggregation.method
      ) &&
      Math.abs(totalWeight - 1.0) > 0.01
    ) {
      logger.warn(
        `Model weights (${totalWeight}) do not sum to 1.0. Weights will be normalized.`
      );
    }

    // Set defaults
    return {
      ...config,
      timeout: {
        perModelMs: config.timeout?.perModelMs ?? 5000,
        totalMs: config.timeout?.totalMs ?? 30000,
      },
      retry: {
        enabled: config.retry?.enabled ?? true,
        maxAttempts: config.retry?.maxAttempts ?? 3,
        initialDelayMs: config.retry?.initialDelayMs ?? 100,
        backoffMultiplier: config.retry?.backoffMultiplier ?? 2,
        maxDelayMs: config.retry?.maxDelayMs ?? 5000,
        retryableErrors: config.retry?.retryableErrors ?? ['timeout', 'network_error'],
      },
      caching: {
        enabled: config.caching?.enabled ?? true,
        ttlMs: config.caching?.ttlMs ?? 300000,
        maxSize: config.caching?.maxSize ?? 1000,
        keyStrategy: config.caching?.keyStrategy ?? 'hash',
      },
      logLevel: config.logLevel ?? 'info',
    };
  }

  /**
   * Get current pipeline configuration (read-only copy)
   */
  getConfiguration(): Readonly<PipelineConfig> {
    return { ...this.config };
  }

  // ============== Model Registration ==============

  /**
   * Register a model with the pipeline
   * 
   * @param model - The ML predictor to register
   * @throws Error if model ID is already registered or not in config
   */
  registerModel(model: MLPredictor): void {
    const modelConfig = this.config.models.find((m) => m.modelId === model.id);
    
    if (!modelConfig) {
      throw new Error(
        `Model '${model.id}' is not in pipeline configuration. Add it to models array first.`
      );
    }

    if (this.models.has(model.id)) {
      throw new Error(`Model '${model.id}' is already registered`);
    }

    this.models.set(model.id, model);
    logger.info(`Model registered: ${model.id} (${model.metadata.name})`);
  }

  /**
   * Unregister a model from the pipeline
   * 
   * @param modelId - ID of model to unregister
   */
  unregisterModel(modelId: string): void {
    if (this.models.delete(modelId)) {
      logger.info(`Model unregistered: ${modelId}`);
    }
  }

  /**
   * Get registered model by ID
   */
  getModel(modelId: string): MLPredictor | undefined {
    return this.models.get(modelId);
  }

  /**
   * Get list of all registered model IDs
   */
  getRegisteredModelIds(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * Check if a model is registered and available
   */
  isModelAvailable(modelId: string): boolean {
    const model = this.models.get(modelId);
    return model ? model.isAvailable() : false;
  }

  // ============== Event System ==============

  /**
   * Subscribe to pipeline events
   * 
   * @param eventType - Type of event to listen for
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  on<T = unknown>(
    eventType: PipelineEventType,
    listener: PipelineEventListener<T>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(listener as PipelineEventListener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(listener as PipelineEventListener);
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emit<T>(type: PipelineEventType, data: T, executionId?: string): void {
    const event: PipelineEvent<T> = {
      type,
      timestamp: new Date(),
      data,
      pipelineId: this.config.id,
      executionId,
    };

    const listeners = this.listeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event as PipelineEvent);
        } catch (error) {
          logger.error(`Event listener error for ${type}:`, error);
        }
      }
    }
  }

  // ============== Main Execution ==============

  /**
   * Execute the pipeline on input data
   * 
   * This is the main entry point for running predictions through
   * the configured ML models.
   * 
   * @param input - Input data for prediction
   * @param options - Optional execution options override
   * @returns Complete pipeline result with individual and aggregated results
   * 
   * @example
   * ```typescript
   * const result = await pipeline.execute({
   *   amount: 1000,
   *   userId: 'user_123',
   *   // ... transaction features
   * });
   * 
   * console.log(result.aggregatedResult.finalPrediction);
   * console.log(result.aggregatedResult.confidence);
   * ```
   */
  async execute(
    input: unknown,
    options?: Partial<PipelineConfig>
  ): Promise<PipelineResult> {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    // Merge options with base config if provided
    const effectiveConfig = options
      ? { ...this.config, ...options }
      : this.config;

    this.emit(PipelineEventType.EXECUTION_STARTED, { input }, executionId);

    // Check cache first
    if (effectiveConfig.caching.enabled) {
      const cacheKey = this.generateCacheKey(input);
      const cached = this.cache.get(cacheKey);
      
      if (cached) {
        this.emit(PipelineEventType.CACHE_HIT, { cacheKey }, executionId);
        
        return this.createCachedResult(
          cached,
          executionId,
          startTime,
          cacheKey
        );
      }
      
      this.emit(PipelineEventType.CACHE_MISS, { cacheKey }, executionId);
    }

    try {
      // Handle A/B testing if enabled
      if (effectiveConfig.abTesting?.enabled && this.abTestState) {
        return await this.executeWithABTesting(
          input,
          effectiveConfig,
          executionId,
          startTime
        );
      }

      // Execute based on mode
      let modelResults: Map<string, BasePredictionResult>;

      switch (effectiveConfig.mode) {
        case PipelineMode.SEQUENTIAL:
          modelResults = await this.executeSequential(
            input,
            effectiveConfig,
            executionId
          );
          break;
        case PipelineMode.PARALLEL:
          modelResults = await this.executeParallel(
            input,
            effectiveConfig,
            executionId
          );
          break;
        case PipelineMode.DAG:
          modelResults = await this.executeDAG(
            input,
            effectiveConfig,
            executionId
          );
          break;
        case PipelineMode.FALLBACK_CHAIN:
          modelResults = await this.executeFallbackChain(
            input,
            effectiveConfig,
            executionId
          );
          break;
        default:
          throw new Error(`Unknown pipeline mode: ${effectiveConfig.mode}`);
      }

      // Aggregate results
      const aggregatedResult = this.aggregateResults(
        modelResults,
        effectiveConfig.aggregation
      );

      // Update metrics
      this.metrics.recordExecution(Date.now() - startTime, true);

      // Cache result
      if (effectiveConfig.caching.enabled) {
        const cacheKey = this.generateCacheKey(input);
        this.cache.set(cacheKey, aggregatedResult);
      }

      const result: PipelineResult = {
        executionId,
        pipelineId: effectiveConfig.id,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        totalDurationMs: Date.now() - startTime,
        success: true,
        modelResults,
        aggregatedResult,
        metadata: this.buildMetadata(executionId, modelResults, false, effectiveConfig.mode),
      };

      this.emit(PipelineEventType.EXECUTION_COMPLETED, result, executionId);

      return result;
    } catch (error) {
      this.metrics.recordExecution(Date.now() - startTime, false);
      
      const errorResult: PipelineResult = {
        executionId,
        pipelineId: effectiveConfig.id,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        totalDurationMs: Date.now() - startTime,
        success: false,
        modelResults: new Map(),
        aggregatedResult: this.createErrorAggregatedResult(error),
        metadata: this.buildMetadata(executionId, new Map(), true, effectiveConfig.mode),
      };

      this.emit(PipelineEventType.EXECUTION_FAILED, { error }, executionId);
      
      logger.error(`Pipeline execution failed: ${executionId}`, error);
      
      throw error;
    }
  }

  // ============== Execution Strategies ==============

  /**
   * Execute models sequentially in priority order
   */
  private async executeSequential(
    input: unknown,
    config: PipelineConfig,
    executionId: string
  ): Promise<Map<string, BasePredictionResult>> {
    const results = new Map<string, BasePredictionResult>();
    const sortedModels = this.getSortedModels(config);

    for (const modelConfig of sortedModels) {
      if (!modelConfig.enabled) continue;

      const result = await this.executeModelWithRetry(
        modelConfig.modelId,
        input,
        config,
        executionId
      );

      results.set(modelConfig.modelId, result);

      // In sequential mode, check if we should stop early
      // e.g., if fraud detected with high confidence
      if (this.shouldStopEarly(result, config)) {
        logger.debug(
          `Early stopping after ${modelConfig.modelId} due to high-confidence result`
        );
        break;
      }
    }

    return results;
  }

  /**
   * Execute all models in parallel
   */
  private async executeParallel(
    input: unknown,
    config: PipelineConfig,
    executionId: string
  ): Promise<Map<string, BasePredictionResult>> {
    const results = new Map<string, BasePredictionResult>();
    const enabledModels = config.models.filter((m) => m.enabled);

    // Create promises for all models
    const promises = enabledModels.map(async (modelConfig) => {
      const result = await this.executeModelWithRetry(
        modelConfig.modelId,
        input,
        config,
        executionId
      );
      return { modelId: modelConfig.modelId, result };
    });

    // Execute with overall timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Pipeline execution timeout')), config.timeout.totalMs);
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

  /**
   * Execute models respecting dependency graph (DAG mode)
   */
  private async executeDAG(
    input: unknown,
    config: PipelineConfig,
    executionId: string
  ): Promise<Map<string, BasePredictionResult>> {
    const results = new Map<string, BasePredictionResult>();
    const executed = new Set<string>();
    const executing = new Set<string>();

    const executeWithDependencies = async (
      modelId: string
    ): Promise<void> => {
      if (executed.has(modelId)) return;
      if (executing.has(modelId)) return; // Prevent cycles

      const modelConfig = config.models.find((m) => m.modelId === modelId);
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
      const result = await this.executeModelWithRetry(
        modelId,
        input,
        config,
        executionId
      );

      results.set(modelId, result);
      executed.add(modelId);
      executing.delete(modelId);
    };

    // Execute all enabled models (dependencies will be resolved automatically)
    for (const modelConfig of config.models) {
      if (modelConfig.enabled) {
        await executeWithDependencies(modelConfig.modelId);
      }
    }

    return results;
  }

  /**
   * Execute models in fallback chain (try each until one succeeds)
   */
  private async executeFallbackChain(
    input: unknown,
    config: PipelineConfig,
    executionId: string
  ): Promise<Map<string, BasePredictionResult>> {
    const results = new Map<string, BasePredictionResult>();
    const sortedModels = this.getSortedModels(config);

    for (const modelConfig of sortedModels) {
      if (!modelConfig.enabled) continue;

      try {
        const result = await this.executeModelWithRetry(
          modelConfig.modelId,
          input,
          config,
          executionId
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
          const fallbackConfig = config.models.find(
            (m) => m.modelId === modelConfig.fallbackModelId
          );
          
          if (fallbackConfig && fallbackConfig.enabled) {
            const fallbackResult = await this.executeModelWithRetry(
              fallbackConfig.modelId,
              input,
              config,
              executionId
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
   * Execute a single model with retry logic
   */
  private async executeModelWithRetry(
    modelId: string,
    input: unknown,
    config: PipelineConfig,
    executionId: string
  ): Promise<BasePredictionResult> {
    const model = this.models.get(modelId);
    
    if (!model) {
      return this.createModelError(
        modelId,
        `Model '${modelId}' is not registered`,
        'MODEL_NOT_FOUND'
      );
    }

    if (!model.isAvailable()) {
      return this.createModelError(
        modelId,
        `Model '${modelId}' is not available`,
        'MODEL_UNAVAILABLE'
      );
    }

    this.emit(PipelineEventType.MODEL_STARTED, { modelId }, executionId);

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

        this.emit(PipelineEventType.MODEL_COMPLETED, { modelId, result }, executionId);
        this.metrics.recordModelExecution(modelId, Date.now(), true);

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

          this.emit(
            PipelineEventType.MODEL_RETRY,
            { modelId, attempt, delay, error: lastError.message },
            executionId
          );

          logger.warn(
            `Model ${modelId} attempt ${attempt} failed, retrying in ${delay}ms...`
          );

          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    this.emit(
      PipelineEventType.MODEL_FAILED,
      { modelId, error: lastError?.message, attempts: attempt },
      executionId
    );

    this.metrics.recordModelExecution(modelId, Date.now(), false);

    return this.createModelError(
      modelId,
      lastError?.message || 'Unknown error',
      'MAX_RETRIES_EXCEEDED'
    );
  }

  // ============== Result Aggregation ==============

  /**
   * Aggregate results from multiple models into a single prediction
   */
  aggregateResults(
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
        return this.majorityVoteAggregation(successfulResults, modelResults);
      case AggregationMethod.WEIGHTED_VOTE:
        return this.weightedVoteAggregation(successfulResults, modelResults, aggregationConfig);
      case AggregationMethod.AVERAGE:
        return this.averageAggregation(successfulResults);
      case AggregationMethod.WEIGHTED_AVERAGE:
        return this.weightedAverageAggregation(successfulResults, aggregationConfig);
      case AggregationMethod.MAX:
        return this.maxAggregation(successfulResults);
      case AggregationMethod.MIN:
        return this.minAggregation(successfulResults);
      default:
        return this.averageAggregation(successfulResults);
    }
  }

  /**
   * Majority vote aggregation for classification tasks
   */
  private majorityVoteAggregation(
    results: BasePredictionResult[],
    allResults: Map<string, BasePredictionResult>
  ): AggregatedResult {
    // Extract predictions (assuming they have predictedClass or value)
    const votes = new Map<string, number>();
    
    for (const result of results) {
      const prediction = this.extractPredictionValue(result);
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
    const disagreements = this.findDisagreements(results, majorityPrediction);

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
  private weightedVoteAggregation(
    results: BasePredictionResult[],
    allResults: Map<string, BasePredictionResult>,
    config: AggregationConfig
  ): AggregatedResult {
    const votes = new Map<string, number>();
    const weights = this.getModelWeights();

    for (const result of results) {
      const weight = weights.get(result.modelId) || 1 / results.length;
      const prediction = String(this.extractPredictionValue(result));
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

    const disagreements = this.findDisagreements(results, winningPrediction);

    return {
      finalPrediction: winningPrediction,
      confidence: Math.min(maxScore, 1),
      agreement: this.calculateAgreement(results),
      agreeingModels: this.countAgreeingModels(results, winningPrediction),
      totalModels: results.length,
      disagreements: disagreements.length > 0 ? disagreements : undefined,
      method: AggregationMethod.WEIGHTED_VOTE,
    };
  }

  /**
   * Simple average aggregation for numeric outputs
   */
  private averageAggregation(results: BasePredictionResult[]): AggregatedResult {
    const values = results.map((r) => this.extractNumericValue(r));
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(
      values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length
    );

    return {
      finalPrediction: avg,
      confidence: 1 / (1 + std), // Higher confidence when std is lower
      agreement: this.calculateAgreement(results),
      agreeingModels: results.length,
      totalModels: results.length,
      method: AggregationMethod.AVERAGE,
    };
  }

  /**
   * Weighted average aggregation
   */
  private weightedAverageAggregation(
    results: BasePredictionResult[],
    config: AggregationConfig
  ): AggregatedResult {
    const weights = this.getModelWeights();
    let weightedSum = 0;
    let totalWeight = 0;

    for (const result of results) {
      const weight = weights.get(result.modelId) || 1 / results.length;
      const value = this.extractNumericValue(result);
      weightedSum += value * weight;
      totalWeight += weight;
    }

    const avg = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return {
      finalPrediction: avg,
      confidence: this.averageConfidence(results),
      agreement: this.calculateAgreement(results),
      agreeingModels: results.length,
      totalModels: results.length,
      method: AggregationMethod.WEIGHTED_AVERAGE,
    };
  }

  /**
   * Max aggregation (take highest score/value)
   */
  private maxAggregation(results: BasePredictionResult[]): AggregatedResult {
    let maxValue = -Infinity;
    let maxResult: BasePredictionResult | null = null;

    for (const result of results) {
      const value = this.extractNumericValue(result);
      if (value > maxValue) {
        maxValue = value;
        maxResult = result;
      }
    }

    return {
      finalPrediction: maxValue,
      confidence: maxResult?.confidence ?? 0,
      agreement: this.calculateAgreement(results),
      agreeingModels: this.countAgreeingModels(results, maxValue),
      totalModels: results.length,
      method: AggregationMethod.MAX,
    };
  }

  /**
   * Min aggregation (take lowest score/value)
   */
  private minAggregation(results: BasePredictionResult[]): AggregatedResult {
    let minValue = Infinity;
    let minResult: BasePredictionResult | null = null;

    for (const result of results) {
      const value = this.extractNumericValue(result);
      if (value < minValue) {
        minValue = value;
        minResult = result;
      }
    }

    return {
      finalPrediction: minValue,
      confidence: minResult?.confidence ?? 0,
      agreement: this.calculateAgreement(results),
      agreeingModels: this.countAgreeingModels(results, minValue),
      totalModels: results.length,
      method: AggregationMethod.MIN,
    };
  }

  // ============== A/B Testing ==============

  /**
   * Initialize A/B testing state
   */
  private initializeABTest(config: ABTestingConfig): void {
    this.abTestState = {
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
   * Execute pipeline with A/B testing
   */
  private async executeWithABTesting(
    input: unknown,
    config: PipelineConfig,
    executionId: string,
    startTime: number
  ): Promise<PipelineResult> {
    if (!this.abTestState) {
      throw new Error('A/B testing state not initialized');
    }

    // Determine which group this request belongs to
    const isTreatment = this.assignABGroup(config.abTesting!);
    const variant = isTreatment ? config.abTesting!.treatment : config.abTesting!.control;

    this.emit(
      PipelineEventType.AB_GROUP_ASSIGNED,
      { group: isTreatment ? 'treatment' : 'control', variant: variant.name },
      executionId
    );

    // Create modified config for this variant
    const variantConfig: PipelineConfig = {
      ...config,
      models: config.models.map((m) => ({
        ...m,
        enabled: variant.modelIds.includes(m.modelId),
      })),
      abTesting: undefined, // Prevent recursive A/B testing
    };

    // Execute with variant config
    const modelResults = await this.executeParallel(input, variantConfig, executionId);
    const aggregatedResult = this.aggregateResults(modelResults, variantConfig.aggregation);

    // Record metrics for A/B test
    this.recordABMetrics(isTreatment, aggregatedResult);

    // Calculate A/B test results
    const abTestResults = this.calculateABTestResults();

    return {
      executionId,
      pipelineId: config.id,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      totalDurationMs: Date.now() - startTime,
      success: true,
      modelResults,
      aggregatedResult,
      abTestResults,
      metadata: this.buildMetadata(executionId, modelResults, false, config.mode),
    };
  }

  /**
   * Assign request to control or treatment group
   */
  private assignABGroup(config: ABTestingConfig): boolean {
    if (!this.abTestState) return false;

    const random = Math.random() * 100;
    const isTreatment = random < config.trafficSplit;

    if (isTreatment) {
      this.abTestState.treatmentCount++;
    } else {
      this.abTestState.controlCount++;
    }

    return isTreatment;
  }

  /**
   * Record metrics for A/B test analysis
   */
  private recordABMetrics(isTreatment: boolean, result: AggregatedResult): void {
    if (!this.abTestState) return;

    const metrics = isTreatment
      ? this.abTestState.treatmentMetrics
      : this.abTestState.controlMetrics;

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
  private calculateABTestResults(): ABTestResults | undefined {
    if (!this.abTestState) return undefined;

    const { config, controlCount, treatmentCount, controlMetrics, treatmentMetrics } =
      this.abTestState;

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

  // ============== Helper Methods ==============

  /**
   * Get models sorted by priority
   */
  private getSortedModels(config: PipelineConfig): PipelineModelConfig[] {
    return [...config.models].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get model weights from configuration
   */
  private getModelWeights(): Map<string, number> {
    const weights = new Map<string, number>();
    const enabledModels = this.config.models.filter((m) => m.enabled);
    const totalWeight = enabledModels.reduce((sum, m) => sum + m.weight, 0);

    for (const model of enabledModels) {
      weights.set(model.modelId, model.weight / totalWeight);
    }

    return weights;
  }

  /**
   * Extract prediction value from result
   */
  private extractPredictionValue(result: BasePredictionResult): unknown {
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
  private extractNumericValue(result: BasePredictionResult): number {
    const value = this.extractPredictionValue(result);
    return typeof value === 'number' ? value : result.confidence;
  }

  /**
   * Find disagreements among model predictions
   */
  private findDisagreements(
    results: BasePredictionResult[],
    majorityPrediction: string
  ): DisagreementDetail[] {
    const disagreements: DisagreementDetail[] = [];

    for (const result of results) {
      const prediction = String(this.extractPredictionValue(result));
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
  private calculateAgreement(results: BasePredictionResult[]): number {
    if (results.length <= 1) return 1;

    const predictions = results.map((r) => String(this.extractPredictionValue(r)));
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
  private countAgreeingModels(
    results: BasePredictionResult[],
    targetPrediction: unknown
  ): number {
    return results.filter(
      (r) => String(this.extractPredictionValue(r)) === String(targetPrediction)
    ).length;
  }

  /**
   * Average confidence across results
   */
  private averageConfidence(results: BasePredictionResult[]): number {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  }

  /**
   * Check if we should stop early in sequential mode
   */
  private shouldStopEarly(
    result: BasePredictionResult,
    config: PipelineConfig
  ): boolean {
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
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate cache key from input data
   */
  private generateCacheKey(input: unknown): string {
    const prefix = this.config.id;
    const hash = generateHash(input);
    return `${prefix}:${hash}`;
  }

  /**
   * Create error result for a model
   */
  private createModelError(
    modelId: string,
    message: string,
    code: string
  ): BasePredictionResult {
    const error: PredictionError = {
      code,
      message,
    };

    return {
      predictionId: this.generateExecutionId(),
      modelId,
      timestamp: new Date(),
      processingTimeMs: 0,
      success: false,
      confidence: 0,
      error,
    };
  }

  /**
   * Create aggregated result for error case
   */
  private createErrorAggregatedResult(error: unknown): AggregatedResult {
    return {
      finalPrediction: null,
      confidence: 0,
      agreement: 0,
      agreeingModels: 0,
      totalModels: 0,
      method: this.config.aggregation.method,
    };
  }

  /**
   * Create result from cache hit
   */
  private createCachedResult(
    cached: AggregatedResult,
    executionId: string,
    startTime: number,
    cacheKey: string
  ): PipelineResult {
    return {
      executionId,
      pipelineId: this.config.id,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      totalDurationMs: Date.now() - startTime,
      success: true,
      modelResults: new Map(),
      aggregatedResult: cached,
      metadata: this.buildMetadata(executionId, new Map(), false, this.config.mode, true),
    };
  }

  /**
   * Build execution metadata
   */
  private buildMetadata(
    executionId: string,
    modelResults: Map<string, BasePredictionResult>,
    hadError: boolean,
    mode: PipelineMode,
    cacheHit: boolean = false
  ): PipelineExecutionMetadata {
    const resultsArray = Array.from(modelResults.values());

    return {
      inputHash: '', // Would need input to compute
      modelsAttempted: this.config.models.map((m) => m.modelId),
      modelsSucceeded: resultsArray
        .filter((r) => r.success)
        .map((r) => r.modelId),
      modelsFailed: resultsArray
        .filter((r) => !r.success)
        .map((r) => r.modelId),
      cacheHit,
      retriesPerformed: this.metrics.getTotalRetries(),
      mode,
      environment: {
        nodeVersion: process.version,
        memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: 0, // Would need additional tracking
      },
    };
  }

  /**
   * Sleep helper for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============== Metrics & Monitoring ==============

  /**
   * Get pipeline performance metrics
   */
  getMetrics(): PipelineMetricsSnapshot {
    return this.metrics.getSnapshot();
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics.reset();
  }

  /**
   * Clear the result cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Pipeline cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.caching.maxSize,
    };
  }

  /**
   * Get current A/B test state (if active)
   */
  getABTestState(): ABTestState | null {
    return this.abTestState;
  }

  /**
   * End A/B test and get final results
   */
  endABTest(): ABTestResults | null {
    if (!this.abTestState) return null;

    const results = this.calculateABTestResults();
    this.abTestState = null;

    logger.info(`A/B test ended: ${results?.testId}`);

    return results;
  }

  /**
   * Health check for the entire pipeline
   */
  async healthCheck(): Promise<PipelineHealthStatus> {
    const modelHealths = new Map<string, ModelHealthStatus>();

    for (const [modelId, model] of this.models) {
      modelHealths.set(modelId, model.getHealth());
    }

    const healthyModels = Array.from(modelHealths.values()).filter(
      (h) => h.isHealthy
    ).length;
    const totalModels = modelHealths.size;

    const isHealthy = healthyModels === totalModels && totalModels > 0;

    return {
      isHealthy,
      pipelineId: this.config.id,
      totalModels,
      healthyModels,
      unhealthyModels: totalModels - healthyModels,
      modelHealths,
      uptime: process.uptime(),
      lastExecutionAt: this.metrics.getLastExecutionTime(),
    };
  }

  /**
   * Dispose of pipeline resources
   */
  dispose(): void {
    this.clearCache();
    this.listeners.clear();
    this.models.clear();
    logger.info(`Pipeline disposed: ${this.config.id}`);
  }
}

// ============== Metrics Collector ==============

/**
 * Internal metrics collector for pipeline monitoring
 */
class PipelineMetrics {
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
  }
}

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

/** Internal A/B test state */
interface ABTestState {
  config: ABTestingConfig;
  controlCount: number;
  treatmentCount: number;
  controlMetrics: Record<string, number>;
  treatmentMetrics: Record<string, number>;
  startedAt: Date;
}
