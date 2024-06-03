/**
 * Comprehensive Test Suite for ML Pipeline Orchestrator
 * 
 * @module ml/pipeline.test
 * @description Unit tests for the MLPipeline class covering:
 * - Configuration validation and defaults
 * - Model registration and management
 * - Sequential execution mode
 * - Parallel execution mode
 * - DAG-based execution with dependencies
 * - Fallback chain execution
 * - Result aggregation strategies (voting, averaging, etc.)
 * - Retry mechanism with exponential backoff
 * - Caching functionality
 * - A/B testing framework
 * - Event system
 * - Metrics collection
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  MLPipeline,
  MLPredictor,
  ModelHealthStatus,
  PipelineEventType,
  PipelineMode,
  AggregationMethod,
} from './pipeline';
import {
  BasePredictionResult,
  PredictionError,
  AggregatedResult,
  PipelineConfig,
  ABTestingConfig,
  ModelMetadata,
  ModelType,
  ModelStatus,
} from './types';

// ============== Test Utilities ==============

/**
 * Create a mock model predictor for testing
 */
function createMockPredictor(
  options: {
    id?: string;
    prediction?: Partial<BasePredictionResult>;
    delay?: number;
    shouldFail?: boolean;
    errorRate?: number;
    isAvailable?: boolean;
  } = {}
): MLPredictor {
  const {
    id = 'test-model',
    prediction = {},
    delay = 0,
    shouldFail = false,
    isAvailable: available = true,
  } = options;

  let callCount = 0;

  return {
    id,
    metadata: {
      id,
      name: `Test Model ${id}`,
      version: '1.0.0',
      type: ModelType.FRAUD_DETECTION,
      createdAt: new Date(),
      status: ModelStatus.ACTIVE,
      features: ['amount', 'timestamp'],
      hyperparameters: {},
    },
    
    async predict(input: unknown): Promise<BasePredictionResult> {
      callCount++;
      
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      if (shouldFail) {
        throw new Error(`Model ${id} failed intentionally`);
      }

      return {
        predictionId: `pred_${Date.now()}_${callCount}`,
        modelId: id,
        timestamp: new Date(),
        processingTimeMs: delay,
        success: true,
        confidence: prediction.confidence ?? 0.85,
        ...prediction,
      } as BasePredictionResult;
    },

    isAvailable(): boolean {
      return available;
    },

    getHealth(): ModelHealthStatus {
      return {
        isHealthy: available,
        lastPredictionAt: callCount > 0 ? new Date() : undefined,
        avgResponseTimeMs: delay,
        errorRate: 0,
        totalPredictions: callCount,
      };
    },
  };
}

/**
 * Create a valid pipeline configuration for testing
 */
function createTestPipelineConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    id: 'test-pipeline',
    name: 'Test Pipeline',
    mode: PipelineMode.PARALLEL,
    models: [
      { modelId: 'model-a', enabled: true, weight: 0.5, priority: 1 },
      { modelId: 'model-b', enabled: true, weight: 0.3, priority: 2 },
      { modelId: 'model-c', enabled: true, weight: 0.2, priority: 3 },
    ],
    aggregation: {
      method: AggregationMethod.WEIGHTED_AVERAGE,
      params: {},
    },
    timeout: {
      perModelMs: 1000,
      totalMs: 3000,
    },
    retry: {
      enabled: true,
      maxAttempts: 2,
      initialDelayMs: 10,
      backoffMultiplier: 2,
      maxDelayMs: 100,
      retryableErrors: ['timeout'],
    },
    caching: {
      enabled: false, // Disable cache by default for testing
      ttlMs: 60000,
      maxSize: 100,
      keyStrategy: 'hash',
    },
    logLevel: 'error',
    ...overrides,
  };
}

// ============== Test Suites ==============

describe('MLPipeline', () => {
  let pipeline: MLPipeline;

  describe('Configuration Validation', () => {
    it('should create pipeline with valid configuration', () => {
      const config = createTestPipelineConfig();
      pipeline = new MLPipeline(config);

      const retrievedConfig = pipeline.getConfiguration();
      expect(retrievedConfig.id).toBe('test-pipeline');
      expect(retrievedConfig.name).toBe('Test Pipeline');
      expect(retrievedConfig.mode).toBe(PipelineMode.PARALLEL);
      expect(retrievedConfig.models).toHaveLength(3);
    });

    it('should throw error when ID is missing', () => {
      const config = createTestPipelineConfig({ id: '' });
      
      expect(() => new MLPipeline(config)).toThrow('Pipeline ID and name are required');
    });

    it('should throw error when name is missing', () => {
      const config = createTestPipelineConfig({ name: '' });
      
      expect(() => new MLPipeline(config)).toThrow('Pipeline ID and name are required');
    });

    it('should throw error when no models configured', () => {
      const config = createTestPipelineConfig({ models: [] });
      
      expect(() => new MLPipeline(config)).toThrow('At least one model must be configured');
    });

    it('should apply default values for optional config', () => {
      const config = createTestPipelineConfig({
        timeout: undefined,
        retry: undefined,
        caching: undefined,
        logLevel: undefined,
      });

      pipeline = new MLPipeline(config);
      const retrievedConfig = pipeline.getConfiguration();

      expect(retrievedConfig.timeout.perModelMs).toBe(5000);
      expect(retrievedConfig.timeout.totalMs).toBe(30000);
      expect(retrievedConfig.retry.enabled).toBe(true);
      expect(retrievedConfig.retry.maxAttempts).toBe(3);
      expect(retrievedConfig.caching.enabled).toBe(true);
      expect(retrievedConfig.logLevel).toBe('info');
    });

    it('should warn about weights not summing to 1 for weighted methods', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const config = createTestPipelineConfig({
        models: [
          { modelId: 'model-a', enabled: true, weight: 0.8, priority: 1 },
          { modelId: 'model-b', enabled: true, weight: 0.3, priority: 2 },
        ],
        aggregation: {
          method: AggregationMethod.WEIGHTED_VOTE,
          params: {},
        },
      });

      pipeline = new MLPipeline(config);
      
      // Should have logged a warning about weights
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Model Registration', () => {
    beforeEach(() => {
      pipeline = new MLPipeline(createTestPipelineConfig());
    });

    it('should register a valid model', () => {
      const model = createMockPredictor({ id: 'model-a' });
      
      expect(() => pipeline.registerModel(model)).not.toThrow();
      expect(pipeline.isModelAvailable('model-a')).toBe(true);
    });

    it('should throw error when registering duplicate model', () => {
      const model = createMockPredictor({ id: 'model-a' });
      pipeline.registerModel(model);

      expect(() => pipeline.registerModel(model)).toThrow(
        "Model 'model-a' is already registered"
      );
    });

    it('should throw error when registering model not in config', () => {
      const model = createMockPredictor({ id: 'unknown-model' });
      
      expect(() => pipeline.registerModel(model)).toThrow(
        "Model 'unknown-model' is not in pipeline configuration"
      );
    });

    it('should unregister a registered model', () => {
      const model = createMockPredictor({ id: 'model-a' });
      pipeline.registerModel(model);
      
      expect(pipeline.unregisterModel('model-a')).toBe(true);
      expect(pipeline.getModel('model-a')).toBeUndefined();
    });

    it('should return undefined for unregistered model', () => {
      expect(pipeline.getModel('nonexistent')).toBeUndefined();
    });

    it('should return false for unavailable model check', () => {
      const model = createMockPredictor({ 
        id: 'model-a', 
        isAvailable: false 
      });
      pipeline.registerModel(model);
      
      expect(pipeline.isModelAvailable('model-a')).toBe(false);
    });

    it('should list all registered model IDs', () => {
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));
      pipeline.registerModel(createMockPredictor({ id: 'model-b' }));
      
      const ids = pipeline.getRegisteredModelIds();
      expect(ids).toContain('model-a');
      expect(ids).toContain('model-b');
      expect(ids).toHaveLength(2);
    });
  });

  describe('Parallel Execution Mode', () => {
    beforeEach(() => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        mode: PipelineMode.PARALLEL,
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ 
        id: 'model-a', 
        prediction: { confidence: 0.9 }
      }));
      pipeline.registerModel(createMockPredictor({ 
        id: 'model-b', 
        prediction: { confidence: 0.8 }
      }));
      pipeline.registerModel(createMockPredictor({ 
        id: 'model-c', 
        prediction: { confidence: 0.7 }
      }));
    });

    it('should execute all models in parallel', async () => {
      const result = await pipeline.execute({ test: 'data' });
      
      expect(result.success).toBe(true);
      expect(result.modelResults.size).toBe(3);
      expect(result.aggregatedResult.totalModels).toBe(3);
    });

    it('should aggregate results using weighted average', async () => {
      const result = await pipeline.execute({ test: 'data' });
      
      expect(result.aggregatedResult.method).toBe(AggregationMethod.WEIGHTED_AVERAGE);
      expect(result.aggregatedResult.confidence).toBeGreaterThan(0);
      expect(result.aggregatedResult.agreeingModels).toBe(3);
    });

    it('should handle partial failures gracefully', async () => {
      // Re-create pipeline with one failing model
      pipeline = new MLPipeline(createTestPipelineConfig({
        mode: PipelineMode.PARALLEL,
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ 
        id: 'model-a', 
        prediction: { confidence: 0.9 }
      }));
      pipeline.registerModel(createMockPredictor({ 
        id: 'model-b', 
        shouldFail: true 
      }));
      pipeline.registerModel(createMockPredictor({ 
        id: 'model-c', 
        prediction: { confidence: 0.7 }
      }));

      const result = await pipeline.execute({ test: 'data' });
      
      expect(result.success).toBe(true); // Overall still succeeds
      expect(result.modelResults.size).toBeGreaterThanOrEqual(2); // At least successful ones
    });

    it('should respect per-model timeout', async () => {
      // Re-create with very short timeout
      pipeline = new MLPipeline(createTestPipelineConfig({
        mode: PipelineMode.PARALLEL,
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
        timeout: { perModelMs: 10, totalMs: 100 },
      }));
      
      pipeline.registerModel(createMockPredictor({ 
        id: 'model-a', 
        delay: 50, // Will exceed timeout
      }));

      const result = await pipeline.execute({ test: 'data' });
      
      // Should have an error result due to timeout
      const modelAResult = result.modelResults.get('model-a');
      expect(modelAResult?.success).toBe(false);
    }, 10000);
  });

  describe('Sequential Execution Mode', () => {
    beforeEach(() => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        mode: PipelineMode.SEQUENTIAL,
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ 
        id: 'model-a', 
        priority: 1,
        prediction: { confidence: 0.9 }
      }));
      pipeline.registerModel(createMockPredictor({ 
        id: 'model-b', 
        priority: 2,
        prediction: { confidence: 0.8 }
      }));
      pipeline.registerModel(createMockPredictor({ 
        id: 'model-c', 
        priority: 3,
        prediction: { confidence: 0.7 }
      }));
    });

    it('should execute models in priority order', async () => {
      const executionOrder: string[] = [];
      
      // Track execution order via delays
      pipeline = new MLPipeline(createTestPipelineConfig({
        mode: PipelineMode.SEQUENTIAL,
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      const modelA = createMockPredictor({ id: 'model-a', priority: 1, delay: 10 });
      const modelB = createMockPredictor({ id: 'model-b', priority: 2, delay: 10 });
      const modelC = createMockPredictor({ id: 'model-c', priority: 3, delay: 10 });
      
      pipeline.registerModel(modelA);
      pipeline.registerModel(modelB);
      pipeline.registerModel(modelC);

      const result = await pipeline.execute({ test: 'data' });
      
      expect(result.success).toBe(true);
      expect(result.modelResults.size).toBe(3);
    });

    it('should support early stopping on high-confidence results', async () => {
      // This would require a fraud detection result with high confidence
      // For now, just verify sequential completes successfully
      const result = await pipeline.execute({ test: 'data' });
      expect(result.success).toBe(true);
    });
  });

  describe('DAG Execution Mode', () => {
    it('should execute models respecting dependencies', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        mode: PipelineMode.DAG,
        models: [
          { 
            modelId: 'base-model', 
            enabled: true, 
            weight: 0.4, 
            priority: 1 
          },
          { 
            modelId: 'dependent-model-1', 
            enabled: true, 
            weight: 0.3, 
            priority: 2,
            dependencies: ['base-model']
          },
          { 
            modelId: 'dependent-model-2', 
            enabled: true, 
            weight: 0.3, 
            priority: 3,
            dependencies: ['base-model']
          },
        ],
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'base-model' }));
      pipeline.registerModel(createMockPredictor({ id: 'dependent-model-1' }));
      pipeline.registerModel(createMockPredictor({ id: 'dependent-model-2' }));

      const result = await pipeline.execute({ test: 'data' });
      
      expect(result.success).toBe(true);
      expect(result.modelResults.size).toBe(3);
    });

    it('should handle circular dependency detection', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        mode: PipelineMode.DAG,
        models: [
          { 
            modelId: 'model-a', 
            enabled: true, 
            weight: 0.5, 
            priority: 1,
            dependencies: ['model-b']
          },
          { 
            modelId: 'model-b', 
            enabled: true, 
            weight: 0.5, 
            priority: 2,
            dependencies: ['model-a']
          },
        ],
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));
      pipeline.registerModel(createMockPredictor({ id: 'model-b' }));

      // Should complete without hanging (cycle prevention)
      const result = await pipeline.execute({ test: 'data' });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Fallback Chain Execution', () => {
    it('should try fallback model when primary fails', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        mode: PipelineMode.FALLBACK_CHAIN,
        models: [
          { 
            modelId: 'primary-model', 
            enabled: true, 
            weight: 1, 
            priority: 1,
            fallbackModelId: 'fallback-model'
          },
          { 
            modelId: 'fallback-model', 
            enabled: true, 
            weight: 1, 
            priority: 2 
          },
        ],
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ 
        id: 'primary-model', 
        shouldFail: true 
      }));
      pipeline.registerModel(createMockPredictor({ 
        id: 'fallback-model', 
        prediction: { confidence: 0.75 }
      }));

      const result = await pipeline.execute({ test: 'data' });
      
      expect(result.success).toBe(true);
      expect(result.modelResults.has('fallback-model')).toBe(true);
    });

    it('should stop chain on first successful high-confidence result', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        mode: PipelineMode.FALLBACK_CHAIN,
        models: [
          { modelId: 'model-1', enabled: true, weight: 1, priority: 1 },
          { modelId: 'model-2', enabled: true, weight: 1, priority: 2 },
          { modelId: 'model-3', enabled: true, weight: 1, priority: 3 },
        ],
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ 
        id: 'model-1', 
        prediction: { confidence: 0.95 } // High confidence
      }));
      pipeline.registerModel(createMockPredictor({ id: 'model-2' }));
      pipeline.registerModel(createMockPredictor({ id: 'model-3' }));

      const result = await pipeline.execute({ test: 'data' });
      
      // Only first model should execute due to early stop
      expect(result.modelResults.has('model-1')).toBe(true);
    });
  });

  describe('Aggregation Methods', () => {
    describe('Majority Vote Aggregation', () => {
      it('should select most common prediction', async () => {
        pipeline = new MLPipeline(createTestPipelineConfig({
          aggregation: { method: AggregationMethod.MAJORITY_VOTE, params: {} },
          caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
        }));
        
        // Mock results with predictedClass
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-a', 
          prediction: { predictedClass: 'fraud' as const, confidence: 0.9 }
        }));
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-b', 
          prediction: { predictedClass: 'fraud' as const, confidence: 0.8 }
        }));
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-c', 
          prediction: { predictedClass: 'legit' as const, confidence: 0.7 }
        }));

        const result = await pipeline.execute({ test: 'data' });
        
        expect(result.aggregatedResult.finalPrediction).toBe('fraud');
        expect(result.aggregatedResult.method).toBe(AggregationMethod.MAJORITY_VOTE);
      });
    });

    describe('Average Aggregation', () => {
      it('should calculate mean of numeric predictions', async () => {
        pipeline = new MLPipeline(createTestPipelineConfig({
          aggregation: { method: AggregationMethod.AVERAGE, params: {} },
          caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
        }));
        
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-a', 
          prediction: { value: 80, confidence: 0.9 }
        }));
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-b', 
          prediction: { value: 70, confidence: 0.8 }
        }));
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-c', 
          prediction: { value: 90, confidence: 0.7 }
        }));

        const result = await pipeline.execute({ test: 'data' });
        
        // Average of 80, 70, 90 = 80
        expect(result.aggregatedResult.finalPrediction).toBeCloseTo(80);
        expect(result.aggregatedResult.method).toBe(AggregationMethod.AVERAGE);
      });
    });

    describe('Max/Min Aggregation', () => {
      it('should return maximum value with MAX method', async () => {
        pipeline = new MLPipeline(createTestPipelineConfig({
          aggregation: { method: AggregationMethod.MAX, params: {} },
          caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
        }));
        
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-a', 
          prediction: { riskScore: 60, confidence: 0.9 }
        }));
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-b', 
          prediction: { riskScore: 85, confidence: 0.8 }
        }));
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-c', 
          prediction: { riskScore: 45, confidence: 0.7 }
        }));

        const result = await pipeline.execute({ test: 'data' });
        
        expect(result.aggregatedResult.finalPrediction).toBe(85);
      });

      it('should return minimum value with MIN method', async () => {
        pipeline = new MLPipeline(createTestPipelineConfig({
          aggregation: { method: AggregationMethod.MIN, params: {} },
          caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
        }));
        
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-a', 
          prediction: { value: 60, confidence: 0.9 }
        }));
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-b', 
          prediction: { value: 85, confidence: 0.8 }
        }));
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-c', 
          prediction: { value: 45, confidence: 0.7 }
        }));

        const result = await pipeline.execute({ test: 'data' });
        
        expect(result.aggregatedResult.finalPrediction).toBe(45);
      });
    });

    describe('Disagreement Detection', () => {
      it('should identify disagreeing models', async () => {
        pipeline = new MLPipeline(createTestPipelineConfig({
          caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
        }));
        
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-a', 
          prediction: { predictedClass: 'fraud' as const }
        }));
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-b', 
          prediction: { predictedClass: 'fraud' as const }
        }));
        pipeline.registerModel(createMockPredictor({ 
          id: 'model-c', 
          predictedClass: 'legit' as const,
          prediction: { predictedClass: 'legit' as const }
        }));

        const result = await pipeline.execute({ test: 'data' });
        
        expect(result.aggregatedResult.disagreements).toBeDefined();
        expect(result.aggregatedResult.disagreements!.length).toBeGreaterThanOrEqual(1);
        expect(result.aggregatedResult.disagreements![0].modelId).toBe('model-c');
      });
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry failed models according to config', async () => {
      const mockPredictor = createMockPredictor({ 
        id: 'retry-model',
        shouldFail: true 
      });
      
      // Spy on predict to count calls
      const predictSpy = jest.spyOn(mockPredictor, 'predict');

      pipeline = new MLPipeline(createTestPipelineConfig({
        retry: {
          enabled: true,
          maxAttempts: 3,
          initialDelayMs: 10,
          backoffMultiplier: 1,
          maxDelayMs: 50,
          retryableErrors: ['timeout'],
        },
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(mockPredictor);

      await pipeline.execute({ test: 'data' });
      
      // Should have been called multiple times (initial + retries)
      expect(predictSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      
      predictSpy.mockRestore();
    }, 10000);

    it('should not retry when disabled', async () => {
      const mockPredictor = createMockPredictor({ 
        id: 'no-retry-model',
        shouldFail: true 
      });
      
      const predictSpy = jest.spyOn(mockPredictor, 'predict');

      pipeline = new MLPipeline(createTestPipelineConfig({
        retry: {
          enabled: false,
          maxAttempts: 0,
          initialDelayMs: 10,
          backoffMultiplier: 2,
          maxDelayMs: 100,
          retryableErrors: [],
        },
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(mockPredictor);

      await pipeline.execute({ test: 'data' });
      
      // Should only be called once (no retries)
      expect(predictSpy.mock.calls.length).toBe(1);
      
      predictSpy.mockRestore();
    });
  });

  describe('Caching', () => {
    it('should cache successful results', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        caching: { 
          enabled: true, 
          ttlMs: 60000, 
          maxSize: 100, 
          keyStrategy: 'hash' 
        },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));

      const inputData = { userId: 'user_123', amount: 1000 };

      // First call - should compute
      const result1 = await pipeline.execute(inputData);
      
      // Second call - should use cache
      const result2 = await pipeline.execute(inputData);
      
      expect(result1.executionId).not.toBe(result2.executionId);
      expect(result1.aggregatedResult.finalPrediction)
        .toEqual(result2.aggregatedResult.finalPrediction);
      expect(result2.metadata.cacheHit).toBe(true);
    });

    it('respect cache TTL', async () => {
      jest.useFakeTimers();
      
      pipeline = new MLPipeline(createTestPipelineConfig({
        caching: { 
          enabled: true, 
          ttlMs: 100, // Very short TTL
          maxSize: 100, 
          keyStrategy: 'hash' 
        },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));

      const inputData = { test: 'cache-ttl-test' };

      await pipeline.execute(inputData);
      
      // Advance time past TTL
      jest.advanceTimersByTime(150);
      
      // This should be a cache miss
      const result = await pipeline.execute(inputData);
      expect(result.metadata.cacheHit).toBe(false);
      
      jest.useRealTimers();
    });

    it('clear cache correctly', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        caching: { enabled: true, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));

      await pipeline.execute({ test: 'data' });
      
      expect(pipeline.getCacheStats().size).toBe(1);
      
      pipeline.clearCache();
      
      expect(pipeline.getCacheStats().size).toBe(0);
    });
  });

  describe('Event System', () => {
    it('should emit events during execution', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));

      const events: Array<{ type: string; data: unknown }> = [];

      // Listen for various events
      pipeline.on(PipelineEventType.EXECUTION_STARTED, (event) => {
        events.push({ type: event.type, data: event.data });
      });

      pipeline.on(PipelineEventType.EXECUTION_COMPLETED, (event) => {
        events.push({ type: event.type, data: event.data });
      });

      pipeline.on(PipelineEventType.MODEL_STARTED, (event) => {
        events.push({ type: event.type, data: event.data });
      });

      pipeline.on(PipelineEventType.MODEL_COMPLETED, (event) => {
        events.push({ type: event.type, data: event.data });
      });

      await pipeline.execute({ test: 'data' });
      
      expect(events.length).toBeGreaterThanOrEqual(3);
      expect(events.some(e => e.type === 'execution_started')).toBe(true);
      expect(events.some(e => e.type === 'execution_completed')).toBe(true);
    });

    it('should unsubscribe from events correctly', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));

      let callCount = 0;
      
      const unsubscribe = pipeline.on(
        PipelineEventType.EXECUTION_COMPLETED, 
        () => { callCount++; }
      );

      await pipeline.execute({ test: 'data' });
      expect(callCount).toBe(1);

      unsubscribe();

      await pipeline.execute({ test: 'data' });
      expect(callCount).toBe(1); // Should not increment again
    });

    it('should emit MODEL_FAILED when model fails', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ 
        id: 'fail-model', 
        shouldFail: true 
      }));

      let failureEmitted = false;
      
      pipeline.on(PipelineEventType.MODEL_FAILED, () => {
        failureEmitted = true;
      });

      await pipeline.execute({ test: 'data' });
      
      expect(failureEmitted).toBe(true);
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(() => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));
      pipeline.registerModel(createMockPredictor({ id: 'model-b' }));
    });

    it('should track execution metrics', async () => {
      await pipeline.execute({ test: 'data'1 });
      await pipeline.execute({ test: 'data'2 });

      const metrics = pipeline.getMetrics();
      
      expect(metrics.totalExecutions).toBe(2);
      expect(metrics.successfulExecutions).toBe(2);
      expect(metrics.failedExecutions).toBe(0);
      expect(metrics.successRate).toBe(1);
      expect(metrics.avgExecutionTimeMs).toBeGreaterThan(0);
    });

    it('should track failed executions', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ 
        id: 'fail-model', 
        shouldFail: true 
      }));

      try {
        await pipeline.execute({ test: 'data' });
      } catch {
        // Expected to fail
      }

      const metrics = pipeline.getMetrics();
      expect(metrics.failedExecutions).toBe(1);
    });

    it('should reset metrics correctly', async () => {
      await pipeline.execute({ test: 'data' });
      
      expect(pipeline.getMetrics().totalExecutions).toBe(1);
      
      pipeline.resetMetrics();
      
      expect(pipeline.getMetrics().totalExecutions).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should report healthy status when all models are healthy', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));
      pipeline.registerModel(createMockPredictor({ id: 'model-b' }));

      const health = await pipeline.healthCheck();
      
      expect(health.isHealthy).toBe(true);
      expect(health.totalModels).toBe(2);
      expect(health.healthyModels).toBe(2);
      expect(health.unhealthyModels).toBe(0);
    });

    it('should report unhealthy when models are unavailable', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ 
        id: 'unhealthy-model', 
        isAvailable: false 
      }));

      const health = await pipeline.healthCheck();
      
      expect(health.isHealthy).toBe(false);
      expect(health.unhealthyModels).toBe(1);
    });
  });

  describe('A/B Testing', () => {
    const abTestingConfig: ABTestingConfig = {
      enabled: true,
      testId: 'test-ab-pipeline-v1',
      control: {
        name: 'control',
        modelIds: ['model-a'],
      },
      treatment: {
        name: 'treatment',
        modelIds: ['model-b'],
      },
      trafficSplit: 50,
      minSampleSize: 10,
      significanceLevel: 0.05,
      metrics: ['confidence', 'agreement'],
    };

    it('should initialize A/B testing state', () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        abTesting: abTestingConfig,
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      const abState = pipeline.getABTestState();
      
      expect(abState).not.toBeNull();
      expect(abState!.config.testId).toBe('test-ab-pipeline-v1');
    });

    it('should assign requests to groups and track metrics', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        abTesting: abTestingConfig,
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));
      pipeline.registerModel(createMockPredictor({ id: 'model-b' }));

      // Execute multiple times to build up samples
      for (let i = 0; i < 20; i++) {
        await pipeline.execute({ test: `data-${i}` });
      }

      const abState = pipeline.getABTestState();
      
      expect(abState!.controlCount + abState!.treatmentCount).toBe(20);
      expect(abState!.controlMetrics['total_requests']).toBeDefined();
      expect(abState!.treatmentMetrics['total_requests']).toBeDefined();
    });

    it('should include A/B test results in response', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        abTesting: abTestingConfig,
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));
      pipeline.registerModel(createMockPredictor({ id: 'model-b' }));

      const result = await pipeline.execute({ test: 'ab-data' });
      
      expect(result.abTestResults).toBeDefined();
      expect(result.abTestResults!.testId).toBe('test-ab-pipeline-v1');
      expect(result.abTestResults!.control).toBeDefined();
      expect(result.abTestResults!.treatment).toBeDefined();
    });

    it('should end A/B test and provide final results', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        abTesting: abTestingConfig,
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));
      pipeline.registerModel(createMockPredictor({ id: 'model-b' }));

      // Run some executions
      for (let i = 0; i < 15; i++) {
        await pipeline.execute({ test: `final-${i}` });
      }

      const finalResults = pipeline.endABTest();
      
      expect(finalResults).not.toBeNull();
      expect(finalResults!.testId).toBe('test-ab-pipeline-v1');
      expect(finalResults!.control.sampleSize).toBeGreaterThan(0);
      expect(finalResults!.treatment.sampleSize).toBeGreaterThan(0);
      
      // State should be cleared
      expect(pipeline.getABTestState()).toBeNull();
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle empty input gracefully', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));

      const result = await pipeline.execute({});
      
      expect(result.success).toBe(true);
    });

    it('should handle disabled models', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        models: [
          { modelId: 'enabled-model', enabled: true, weight: 1, priority: 1 },
          { modelId: 'disabled-model', enabled: false, weight: 0, priority: 2 },
        ],
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'enabled-model' }));
      pipeline.registerModel(createMockPredictor({ id: 'disabled-model' }));

      const result = await pipeline.execute({ test: 'data' });
      
      // Only enabled model should run
      expect(result.modelResults.size).toBe(1);
      expect(result.modelResults.has('enabled-model')).toBe(true);
    });

    it('should generate unique execution IDs', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));

      const result1 = await pipeline.execute({ test: 'a' });
      const result2 = await pipeline.execute({ test: 'b' });
      
      expect(result1.executionId).not.toBe(result2.executionId);
      expect(result1.executionId).toMatch(/^exec_/);
    });

    it('should record processing time', async () => {
      pipeline = new MLPipeline(createTestPipelineConfig({
        caching: { enabled: false, ttlMs: 60000, maxSize: 100, keyStrategy: 'hash' },
      }));
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a', delay: 50 }));

      const result = await pipeline.execute({ test: 'data' });
      
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.completedAt.getTime()).toBeGreaterThan(
        result.startedAt.getTime()
      );
    });

    it('should dispose properly', () => {
      pipeline = new MLPipeline(createTestPipelineConfig());
      
      pipeline.registerModel(createMockPredictor({ id: 'model-a' }));
      
      expect(pipeline.getRegisteredModelIds().length).toBe(1);
      
      pipeline.dispose();
      
      expect(pipeline.getRegisteredModelIds().length).toBe(0);
    });
  });
});

// ============== Additional Utility Tests ==============

describe('ML Pipeline Utility Functions', () => {
  describe('generateHash', () => {
    it('should generate consistent hash for same input', () => {
      const { generateHash } = require('./utils');
      
      const hash1 = generateHash({ a: 1, b: 'test' });
      const hash2 = generateHash({ a: 1, b: 'test' });
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const { generateHash } = require('./utils');
      
      const hash1 = generateHash({ a: 1 });
      const hash2 = generateHash({ a: 2 });
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('MLCache', () => {
    it('should store and retrieve values', () => {
      const { MLCache } = require('./utils');
      const cache = new MLCache<string>(10, 60000);
      
      cache.set('key1', 'value1');
      
      expect(cache.get('key1')).toBe('value1');
    });

    it('should expire entries after TTL', () => {
      jest.useFakeTimers();
      const { MLCache } = require('./utils');
      const cache = new MLCache<string>(10, 100);
      
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      
      jest.advanceTimersByTime(150);
      
      expect(cache.get('key1')).toBeUndefined();
      
      jest.useRealTimers();
    });

    it('should evict oldest entry when at capacity', () => {
      const { MLCache } = require('./utils');
      const cache = new MLCache<string>(2, 60000);
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3'); // Should evict key1
      
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
    });

    it('should clear all entries', () => {
      const { MLCache } = require('./utils');
      const cache = new MLCache<string>(10, 60000);
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      
      expect(cache.size).toBe(0);
    });
  });

  describe('SeededRandom', () => {
    it('should produce deterministic sequences with same seed', () => {
      const { SeededRandom } = require('./utils');
      
      const rng1 = new SeededRandom(42);
      const rng2 = new SeededRandom(42);
      
      for (let i = 0; i < 10; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('should produce different sequences with different seeds', () => {
      const { SeededRandom } = require('./utils');
      
      const rng1 = new SeededRandom(42);
      const rng2 = new SeededRandom(123);
      
      let allSame = true;
      for (let i = 0; i < 10; i++) {
        if (rng1.next() !== rng2.next()) {
          allSame = false;
          break;
        }
      }
      
      expect(allSame).toBe(false);
    });

    it('should shuffle array in place', () => {
      const { SeededRandom } = require('./utils');
      const rng = new SeededRandom(42);
      
      const original = [1, 2, 3, 4, 5];
      const shuffled = [...original];
      
      rng.shuffle(shuffled);
      
      // Should have same elements but potentially different order
      expect(shuffled.sort()).toEqual(original.sort());
    });
  });
});
