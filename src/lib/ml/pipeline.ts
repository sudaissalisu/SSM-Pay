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

// Re-export types from sub-modules
export {
  PipelineMetricsSnapshot,
  PipelineHealthStatus,
  ModelHealthStatus,
  PipelineMetrics,
} from './pipeline-metrics';

export type {
  PipelineMetricsSnapshot,
  PipelineHealthStatus,
  ModelHealthStatus,
} from './pipeline-metrics';

export {
  ABTestState,
  ABTestManager,
} from './ab-test-state';

export type {
  ABTestState,
} from './ab-test-state';

export {
  executeSequential,
  executeParallel,
  executeDAG,
  executeFallbackChain,
  createModelExecutor,
  getSortedModels,
  checkShouldStopEarly,
  generateCacheKey as execGenerateCacheKey,
  getCachedResult,
  setCachedResult,
} from './pipeline-execution';

export type {
  ExecutionContext,
  ModelExecutor,
} from './pipeline-execution';

export {
  aggregateResults,
  extractPredictionValue,
  extractNumericValue,
  calculateAgreement,
  averageConfidence,
} from './pipeline-aggregation';

// Import implementations
import { PipelineMetrics } from './pipeline-metrics';
import { ABTestManager } from './ab-test-state';
import {
  executeSequential,
  executeParallel,
  executeDAG,
  executeFallbackChain,
  createModelExecutor,
  getSortedModels,
  checkShouldStopEarly,
  getCachedResult,
  setCachedResult,
} from './pipeline-execution';
import { aggregateResults, averageConfidence } from './pipeline-aggregation';

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
  getHealth(): import('./pipeline-metrics').ModelHealthStatus;
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
  private abTestManager: ABTestManager;

  constructor(config: PipelineConfig) {
    this.config = this.validateConfig(config);
    this.cache = new MLCache(
      config.caching.maxSize,
      config.caching.ttlMs
    );
    this.metrics = new PipelineMetrics();
    this.abTestManager = new ABTestManager();
    
    logger.info(`MLPipeline initialized: ${config.name} (${config.id})`);
    
    if (config.abTesting?.enabled) {
      this.abTestManager.initialize(config.abTesting);
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
  emit<T>(type: PipelineEventType, data: T, executionId?: string): void {
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
      const cached = getCachedResult(this.cache, this.config.id, input);
      
      if (cached) {
        this.emit(PipelineEventType.CACHE_HIT, { }, executionId);
        
        return this.createCachedResult(
          cached,
          executionId,
          startTime
        );
      }
      
      this.emit(PipelineEventType.CACHE_MISS, { }, executionId);
    }

    try {
      // Handle A/B testing if enabled
      if (effectiveConfig.abTesting?.enabled && this.abTestManager.isActive()) {
        return await this.executeWithABTesting(
          input,
          effectiveConfig,
          executionId,
          startTime
        );
      }

      // Create model executor with retry logic
      const executeModel = createModelExecutor(
        this.models,
        this.emit.bind(this),
        this.metrics
      );

      // Execute based on mode
      let modelResults: Map<string, BasePredictionResult>;

      switch (effectiveConfig.mode) {
        case PipelineMode.SEQUENTIAL:
          modelResults = await executeSequential(
            { input, config: effectiveConfig, executionId },
            executeModel,
            checkShouldStopEarly
          );
          break;
        case PipelineMode.PARALLEL:
          modelResults = await executeParallel(
            { input, config: effectiveConfig, executionId },
            executeModel
          );
          break;
        case PipelineMode.DAG:
          modelResults = await executeDAG(
            { input, config: effectiveConfig, executionId },
            executeModel
          );
          break;
        case PipelineMode.FALLBACK_CHAIN:
          modelResults = await executeFallbackChain(
            { input, config: effectiveConfig, executionId },
            executeModel
          );
          break;
        default:
          throw new Error(`Unknown pipeline mode: ${effectiveConfig.mode}`);
      }

      // Aggregate results
      const aggregatedResult = aggregateResults(
        modelResults,
        effectiveConfig.aggregation
      );

      // Update metrics
      this.metrics.recordExecution(Date.now() - startTime, true);

      // Cache result
      if (effectiveConfig.caching.enabled) {
        setCachedResult(this.cache, this.config.id, input, aggregatedResult);
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

  // ============== A/B Testing Integration ==============

  /**
   * Execute pipeline with A/B testing
   */
  private async executeWithABTesting(
    input: unknown,
    config: PipelineConfig,
    executionId: string,
    startTime: number
  ): Promise<PipelineResult> {
    const abState = this.abTestManager.getState();
    if (!abState) {
      throw new Error('A/B testing state not initialized');
    }

    // Determine which group this request belongs to
    const isTreatment = this.abTestManager.assignGroup(config.abTesting!);
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
    const executeModel = createModelExecutor(
      this.models,
      this.emit.bind(this),
      this.metrics
    );

    const modelResults = await executeParallel(
      { input, config: variantConfig, executionId },
      executeModel
    );
    const aggregatedResult = aggregateResults(modelResults, variantConfig.aggregation);

    // Record metrics for A/B test
    this.abTestManager.recordMetrics(isTreatment, aggregatedResult);

    // Calculate A/B test results
    const abTestResults = this.abTestManager.calculateResults();

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

  // ============== Helper Methods ==============

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    startTime: number
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

  // ============== Metrics & Monitoring ==============

  /**
   * Get pipeline performance metrics
   */
  getMetrics(): import('./pipeline-metrics').PipelineMetricsSnapshot {
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
  getABTestState(): import('./ab-test-state').ABTestState | null {
    return this.abTestManager.getState();
  }

  /**
   * End A/B test and get final results
   */
  endABTest(): ABTestResults | null {
    return this.abTestManager.end();
  }

  /**
   * Health check for the entire pipeline
   */
  async healthCheck(): Promise<import('./pipeline-metrics').PipelineHealthStatus> {
    const modelHealths = new Map<string, import('./pipeline-metrics').ModelHealthStatus>();

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
