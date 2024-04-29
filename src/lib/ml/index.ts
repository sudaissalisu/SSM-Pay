/**
 * Machine Learning Module Barrel Export for SSM-Pay
 * 
 * @module ml
 * @description Main entry point for all ML functionality in SSM-Pay.
 * Exports all sub-modules, types, utilities, and the pipeline orchestrator.
 * 
 * @organization SSM-Pay Payment Platform
 * @version 2.0.0
 * @since 1.0.0
 * 
 * @example
 * ```typescript
 * // Import everything from the ML module
 * import {
 *   // Pipeline & Orchestration
 *   MLPipeline,
 *   MLPredictor,
 *   
 *   // Individual Modules
 *   FraudDetector,
 *   TransactionPredictor,
 *   AnomalyDetector,
 *   RiskEngine,
 *   BehavioralAnalytics,
 *   
 *   // Types
 *   ModelMetadata,
 *   BasePredictionResult,
 *   RiskAssessmentResult,
 *   // ... etc
 * } from '@/lib/ml';
 * 
 * // Create a combined pipeline
 * const pipeline = new MLPipeline({
 *   id: 'main-pipeline',
 *   name: 'Main ML Pipeline',
 *   mode: PipelineMode.PARALLEL,
 *   models: [
 *     { modelId: 'fraud-detector', enabled: true, weight: 0.35, priority: 1 },
 *     { modelId: 'anomaly-detector', enabled: true, weight: 0.30, priority: 2 },
 *     { modelId: 'risk-engine', enabled: true, weight: 0.35, priority: 3 },
 *   ],
 *   aggregation: { method: AggregationMethod.WEIGHTED_VOTE, params: {} },
 *   timeout: { perModelMs: 5000, totalMs: 15000 },
 *   retry: { enabled: true, maxAttempts: 3, initialDelayMs: 100, backoffMultiplier: 2, maxDelayMs: 5000, retryableErrors: ['timeout'] },
 *   caching: { enabled: true, ttlMs: 300000, maxSize: 1000, keyStrategy: 'hash' },
 *   logLevel: 'info',
 * });
 * ```
 */

// ============== Sub-Module Exports ==============

// Fraud Detection Module
export * from './fraud-detector';

// Transaction Prediction Module
export * from './transaction-predictor';

// Anomaly Detection Module
export * from './anomaly-detector';

// Risk Engine Module
export * from './risk-engine';

// Behavioral Analytics Module
export * from './behavioral-analytics';

// ============== Core Type Exports ==============

// Shared Types
export * from './types';

// Re-export commonly used types at top level for convenience
import type {
  ModelMetadata,
  ModelType,
  ModelStatus,
  BasePredictionResult,
  PredictionError,
  ClassificationResult,
  RegressionResult,
  AnomalyResult,
  AnomalySeverity,
  AnomalyType,
  AnomalyFactor,
  RiskAssessmentResult,
  RiskLevel,
  RecommendedAction,
  RiskFactor,
  RiskCategory,
  HistoricalRiskContext,
  TrainingConfig,
  DataSource,
  FeatureConfig,
  FeatureType,
  MissingValueStrategy,
  TransformationConfig,
  TransformationType,
  NormalizationConfig,
  NormalizationMethod,
  TargetConfig,
  TaskType,
  EngineeredFeature,
  FeatureVector,
  FeatureVectorMetadata,
  QualityIssue,
  QualityIssueType,
  ModelEvaluationMetrics,
  ClassificationMetrics,
  RegressionMetrics,
  AnomalyDetectionMetrics,
  PipelineConfig,
  PipelineMode,
  PipelineModelConfig,
  AggregationConfig,
  AggregationMethod,
  RetryConfig,
  CachingConfig,
  ABTestingConfig,
  ABTestVariant,
  PipelineResult,
  AggregatedResult,
  DisagreementDetail,
  ABTestResults,
  ABTestGroupResult,
  PipelineExecutionMetadata,
} from './types';

// ============== Utility Exports ==============

// ML Utility Functions
export * from './utils';

// Re-export commonly used utilities
import {
  preprocessNumeric,
  preprocessRecords,
  minMaxScale,
  inverseMinMaxScale,
  standardize,
  inverseStandardize,
  robustScale,
  scaleFeatures,
  createMatrix,
  transpose,
  matrixMultiply,
  matrixVectorMultiply,
  dotProduct,
  euclideanDistance,
  manhattanDistance,
  cosineSimilarity,
  covariance,
  pearsonCorrelation,
  mean,
  median,
  mode,
  standardDeviation,
  sampleStdDev,
  variance,
  quartiles,
  iqr,
  minValue,
  maxValue,
  dataRange,
  percentile,
  percentileValue,
  skewness,
  kurtosis,
  describe,
  validate,
  validateFeatureVector,
  ValidationRules,
  generateHash,
  MLCache,
  SeededRandom,
  sampleCategorical,
  softmax,
  sigmoid,
  relu,
  leakyReLU,
} from './utils';

// Re-export utility types
import type {
  PreprocessingOptions,
  PreprocessingResult,
  PreprocessingStats,
  MinMaxParams,
  StandardizationParams,
  RobustScalingParams,
  ValidationRule,
  ValidationResult,
  ValidationError,
} from './utils';

// ============== Pipeline Exports ==============

// Pipeline Orchestrator
export * from './pipeline';

// Re-export pipeline classes and interfaces
import {
  MLPipeline,
  MLPredictor,
  ModelHealthStatus,
  PipelineEventType,
  PipelineEvent,
  PipelineEventListener,
} from './pipeline';

// Re-export pipeline-specific types
import type {
  PipelineMetricsSnapshot,
  PipelineHealthStatus,
} from './pipeline';

// ============== Combined ML Orchestrator Class ==============

import { logger } from '@/lib/logger';
import type { FraudDetectionResult } from './fraud-detector';
import type { TransactionPredictionResult } from './transaction-predictor';
import type { AnomalyAnalysisResult } from './anomaly-detector';
import type { RiskAssessment as RiskEngineAssessment } from './risk-engine';
import type { BehaviorProfile } from './behavioral-analytics';

/**
 * Comprehensive result from the unified ML analysis
 */
export interface UnifiedMLAnalysisResult {
  /** Unique analysis identifier */
  analysisId: string;
  /** Timestamp of analysis */
  timestamp: Date;
  /** Input data reference */
  inputHash: string;
  
  // Module Results
  /** Fraud detection result */
  fraud?: FraudDetectionResult;
  /** Transaction prediction result */
  transactionPrediction?: TransactionPredictionResult;
  /** Anomaly detection result */
  anomaly?: AnomalyAnalysisResult;
  /** Risk assessment result */
  risk?: RiskEngineAssessment;
  /** Behavioral profile result */
  behavior?: BehaviorProfile;
  
  // Aggregated Insights
  /** Overall risk score (0-100) combining all modules */
  overallRiskScore: number;
  /** Recommended action based on combined analysis */
  recommendedAction: UnifiedRecommendedAction;
  /** Confidence in the recommendation */
  confidence: number;
  /** Key factors contributing to decision */
  keyFactors: AnalysisFactor[];
  
  // Metadata
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Which modules were executed */
  modulesExecuted: string[];
  /** Any errors encountered */
  errors?: Array<{ module: string; error: string }>;
}

/** Factors contributing to analysis decisions */
export interface AnalysisFactor {
  /** Factor name */
  name: string;
  /** Source module */
  sourceModule: string;
  /** Impact on decision (-1 to 1) */
  impact: number;
  /** Description */
  description: string;
}

/** Recommended actions from unified analysis */
export enum UnifiedRecommendedAction {
  /** Allow transaction to proceed */
  ALLOW = 'allow',
  /** Require step-up authentication */
  STEP_UP_AUTH = 'step_up_auth',
  /** Request additional verification */
  ADDITIONAL_VERIFICATION = 'additional_verification',
  /** Flag for manual review */
  FLAG_FOR_REVIEW = 'flag_for_review',
  /** Block transaction */
  BLOCK = 'block',
  /** Requires investigation */
  INVESTIGATE = 'investigate'
}

/** Configuration for the unified ML orchestrator */
export interface UnifiedMLConfig {
  /** Enable/disable individual modules */
  modules: {
    fraudDetection: boolean;
    transactionPrediction: boolean;
    anomalyDetection: boolean;
    riskEngine: boolean;
    behavioralAnalytics: boolean;
  };
  /** Weights for overall risk calculation */
  weights: {
    fraudWeight: number;
    anomalyWeight: number;
    riskWeight: number;
    behavioralWeight: number;
  };
  /** Thresholds for actions */
  thresholds: {
    blockThreshold: number;      // Score above this -> block
    reviewThreshold: number;     // Score above this -> review
    stepUpThreshold: number;     // Score above this -> step-up auth
  };
  /** Enable caching */
  enableCache: boolean;
  /** Cache TTL in ms */
  cacheTTL: number;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/** Default configuration values */
const DEFAULT_UNIFIED_CONFIG: UnifiedMLConfig = {
  modules: {
    fraudDetection: true,
    transactionPrediction: true,
    anomalyDetection: true,
    riskEngine: true,
    behavioralAnalytics: false, // Disabled by default (requires history)
  },
  weights: {
    fraudWeight: 0.35,
    anomalyWeight: 0.25,
    riskWeight: 0.30,
    behavioralWeight: 0.10,
  },
  thresholds: {
    blockThreshold: 85,
    reviewThreshold: 70,
    stepUpThreshold: 50,
  },
  enableCache: true,
  cacheTTL: 300000, // 5 minutes
  logLevel: 'info',
};

/**
 * Unified ML Orchestrator Class
 * 
 * Combines all ML modules into a single cohesive analysis system.
 * Provides simplified API for running comprehensive ML analysis
 * on transactions with automatic result aggregation.
 * 
 * @example
 * ```typescript
 * const orchestrator = new UnifiedMLOrchestrator({
 *   modules: {
 *     fraudDetection: true,
 *     anomalyDetection: true,
 *     riskEngine: true,
 *     transactionPrediction: false,
 *     behavioralAnalytics: false,
 *   }
 * });
 * 
 * const result = await orchestrator.analyzeTransaction({
 *   amount: 1000,
 *   currency: 'USD',
 *   userId: 'user_123',
 *   // ... other features
 * });
 * 
 * if (result.recommendedAction === UnifiedRecommendedAction.BLOCK) {
 *   console.log('Transaction blocked:', result.keyFactors);
 * }
 * ```
 */
export class UnifiedMLOrchestrator {
  private config: UnifiedMLConfig;
  private cache: MLCache<UnifiedMLAnalysisResult>;
  private metrics: OrchestratorMetrics;

  constructor(config: Partial<UnifiedMLConfig> = {}) {
    this.config = {
      ...DEFAULT_UNIFIED_CONFIG,
      ...config,
      modules: { ...DEFAULT_UNIFIED_CONFIG.modules, ...config.modules },
      weights: { ...DEFAULT_UNIFIED_CONFIG.weights, ...config.weights },
      thresholds: { ...DEFAULT_UNIFIED_CONFIG.thresholds, ...config.thresholds },
    };

    this.cache = new MLCache(500, this.config.cacheTTL);
    this.metrics = new OrchestratorMetrics();

    logger.info(`UnifiedMLOrchestrator initialized with config: ${JSON.stringify(this.config.modules)}`);
  }

  /**
   * Analyze a transaction using all configured ML modules
   * 
   * @param transactionData - Transaction features and context
   * @param options - Optional overrides for this specific analysis
   * @returns Comprehensive analysis result from all modules
   */
  async analyzeTransaction(
    transactionData: Record<string, unknown>,
    options?: {
      forceRefresh?: boolean;
      moduleOverrides?: Partial<UnifiedMLConfig['modules']>;
    }
  ): Promise<UnifiedMLAnalysisResult> {
    const startTime = Date.now();
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate input hash for caching
    const inputHash = generateHash(transactionData);

    // Check cache unless forced refresh
    if (!options?.forceRefresh && this.config.enableCache) {
      const cached = this.cache.get(inputHash);
      if (cached) {
        this.metrics.recordCacheHit();
        return cached;
      }
      this.metrics.recordCacheMiss();
    }

    const effectiveModules = {
      ...this.config.modules,
      ...options?.moduleOverrides,
    };

    const result: UnifiedMLAnalysisResult = {
      analysisId,
      timestamp: new Date(),
      inputHash,
      overallRiskScore: 0,
      recommendedAction: UnifiedRecommendedAction.ALLOW,
      confidence: 0,
      keyFactors: [],
      processingTimeMs: 0,
      modulesExecuted: [],
      errors: [],
    };

    try {
      // Execute each enabled module
      const moduleResults = await Promise.allSettled([
        this.runFraudDetection(transactionData, effectiveModules.fraudDetection),
        this.runAnomalyDetection(transactionData, effectiveModules.anomalyDetection),
        this.runRiskAssessment(transactionData, effectiveModules.riskEngine),
        this.runTransactionPrediction(transactionData, effectiveModules.transactionPrediction),
        this.runBehavioralAnalysis(transactionData, effectiveModules.behavioralAnalytics),
      ]);

      // Process results
      this.processModuleResults(moduleResults, result);

      // Calculate aggregated insights
      this.calculateAggregatedInsights(result);

      // Cache result
      if (this.config.enableCache) {
        this.cache.set(inputHash, result);
      }

      // Record metrics
      result.processingTimeMs = Date.now() - startTime;
      this.metrics.recordAnalysis(result.processingTimeMs, result.errors.length === 0);

      return result;
    } catch (error) {
      result.processingTimeMs = Date.now() - startTime;
      result.errors.push({
        module: 'orchestrator',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      logger.error(`Analysis failed: ${analysisId}`, error);
      
      throw error;
    }
  }

  /**
   * Run fraud detection module
   */
  private async runFraudDetection(
    data: Record<string, unknown>,
    enabled: boolean
  ): Promise<FraudDetectionResult | null> {
    if (!enabled) return null;

    try {
      // Dynamic import to avoid loading module if not needed
      const { FraudDetector } = await import('./fraud-detector');
      const detector = new FraudDetector({});
      const result = await detector.analyzeTransaction(data as Parameters<typeof detector.analyzeTransaction>[0]);
      
      return result;
    } catch (error) {
      logger.error('Fraud detection failed:', error);
      throw error;
    }
  }

  /**
   * Run anomaly detection module
   */
  private async runAnomalyDetection(
    data: Record<string, unknown>,
    enabled: boolean
  ): Promise<AnomalyAnalysisResult | null> {
    if (!enabled) return null;

    try {
      const { AnomalyDetector } = await import('./anomaly-detector');
      const detector = new AnomalyDetector({ sensitivity: 'medium' });
      const result = await detector.analyzeTransaction(data as Parameters<typeof detector.analyzeTransaction>[0]);
      
      return result;
    } catch (error) {
      logger.error('Anomaly detection failed:', error);
      throw error;
    }
  }

  /**
   * Run risk assessment module
   */
  private async runRiskAssessment(
    data: Record<string, unknown>,
    enabled: boolean
  ): Promise<RiskEngineAssessment | null> {
    if (!enabled) return null;

    try {
      const { RiskEngine } = await import('./risk-engine');
      const engine = new RiskEngine({ profile: 'moderate' });
      const result = await engine.assessTransactionRisk(data as Parameters<typeof engine.assessTransactionRisk>[0]);
      
      return result;
    } catch (error) {
      logger.error('Risk assessment failed:', error);
      throw error;
    }
  }

  /**
   * Run transaction prediction module
   */
  private async runTransactionPrediction(
    data: Record<string, unknown>,
    enabled: boolean
  ): Promise<TransactionPredictionResult | null> {
    if (!enabled) return null;

    try {
      const { TransactionPredictor } = await import('./transaction-predictor');
      const predictor = new TransactionPredictor();
      const result = await predictor.predictTransactionOutcome(data as Parameters<typeof predictor.predictTransactionOutcome>[0]);
      
      return result;
    } catch (error) {
      logger.error('Transaction prediction failed:', error);
      throw error;
    }
  }

  /**
   * Run behavioral analytics module
   */
  private async runBehavioralAnalysis(
    data: Record<string, unknown>,
    enabled: boolean
  ): Promise<BehaviorProfile | null> {
    if (!enabled) return null;

    try {
      const { BehavioralAnalytics } = await import('./behavioral-analytics');
      const analytics = new BehavioralAnalytics();
      const userId = data.userId as string;
      
      if (!userId) return null;
      
      const result = await analytics.getUserProfile(userId);
      return result;
    } catch (error) {
      logger.error('Behavioral analysis failed:', error);
      throw error;
    }
  }

  /**
   * Process results from all modules
   */
  private processModuleResults(
    results: PromiseSettledResult<unknown>[],
    output: UnifiedMLAnalysisResult
  ): void {
    const moduleNames = ['fraud', 'anomaly', 'risk', 'transaction', 'behavior'];
    
    results.forEach((result, index) => {
      const moduleName = moduleNames[index];
      
      if (result.status === 'fulfilled' && result.value !== null) {
        output.modulesExecuted.push(moduleName);
        
        switch (moduleName) {
          case 'fraud':
            output.fraud = result.value as FraudDetectionResult;
            break;
          case 'anomaly':
            output.anomaly = result.value as AnomalyAnalysisResult;
            break;
          case 'risk':
            output.risk = result.value as RiskEngineAssessment;
            break;
          case 'transaction':
            output.transactionPrediction = result.value as TransactionPredictionResult;
            break;
          case 'behavior':
            output.behavior = result.value as BehaviorProfile;
            break;
        }
      } else if (result.status === 'rejected') {
        output.errors!.push({
          module: moduleName,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    });
  }

  /**
   * Calculate aggregated insights from module results
   */
  private calculateAggregatedInsights(result: UnifiedMLAnalysisResult): void {
    const { weights, thresholds } = this.config;
    
    let weightedScore = 0;
    let totalWeight = 0;
    let confidenceSum = 0;
    let confidenceCount = 0;
    const factors: AnalysisFactor[] = [];

    // Process fraud detection result
    if (result.fraud) {
      const fraudScore = result.fraud.riskScore ?? 0;
      const weight = weights.fraudWeight;
      weightedScore += fraudScore * weight;
      totalWeight += weight;
      confidenceSum += result.fraud.confidence ?? 0;
      confidenceCount++;

      if (fraudScore > 50) {
        factors.push({
          name: 'High Fraud Risk',
          sourceModule: 'fraud',
          impact: fraudScore / 100,
          description: `Fraud score: ${fraudScore.toFixed(1)} - ${result.fraud.riskLevel}`,
        });
      }
    }

    // Process anomaly detection result
    if (result.anomaly) {
      const anomalyScore = result.anomaly.isAnomalous ? 
        (result.anomaly.anomalyScore ?? 0) * 100 : 0;
      const weight = weights.anomalyWeight;
      weightedScore += anomalyScore * weight;
      totalWeight += weight;
      confidenceSum += result.anomaly.confidence ?? 0;
      confidenceCount++;

      if (result.anomaly.isAnomalous) {
        factors.push({
          name: 'Anomaly Detected',
          sourceModule: 'anomaly',
          impact: (result.anomaly.anomalyScore ?? 0),
          description: `Anomaly type: ${result.anomaly.anomalyType}, severity: ${result.anomaly.severity}`,
        });
      }
    }

    // Process risk assessment result
    if (result.risk) {
      const riskScore = result.risk.riskScore ?? 0;
      const weight = weights.riskWeight;
      weightedScore += riskScore * weight;
      totalWeight += weight;
      confidenceSum += 1 - (result.risk.riskScore ?? 0) / 100; // Inverse confidence
      confidenceCount++;

      // Add top risk factors
      if (result.risk.riskFactors) {
        const topFactors = result.risk.riskFactors
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        for (const factor of topFactors) {
          factors.push({
            name: factor.name,
            sourceModule: 'risk',
            impact: factor.score / factor.maxScore,
            description: `${factor.category}: ${factor.description}`,
          });
        }
      }
    }

    // Process behavioral result
    if (result.behavior) {
      const behaviorScore = result.behavior.riskScore ?? 50; // Default medium
      const weight = weights.behavioralWeight;
      weightedScore += behaviorScore * weight;
      totalWeight += weight;
      confidenceCount++;

      if (result.behavior.trustScore !== undefined && result.behavior.trustScore < 50) {
        factors.push({
          name: 'Low Trust Score',
          sourceModule: 'behavior',
          impact: (50 - result.behavior.trustScore) / 50,
          description: `User trust score: ${result.behavior.trustScore}`,
        });
      }
    }

    // Calculate final scores
    result.overallRiskScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    result.confidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;
    result.keyFactors = factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    // Determine recommended action
    if (result.overallRiskScore >= thresholds.blockThreshold) {
      result.recommendedAction = UnifiedRecommendedAction.BLOCK;
    } else if (result.overallRiskScore >= thresholds.reviewThreshold) {
      result.recommendedAction = UnifiedRecommendedAction.FLAG_FOR_REVIEW;
    } else if (result.overallRiskScore >= thresholds.stepUpThreshold) {
      result.recommendedAction = UnifiedRecommendedAction.STEP_UP_AUTH;
    } else {
      result.recommendedAction = UnifiedRecommendedAction.ALLOW;
    }
  }

  /**
   * Get orchestrator metrics
   */
  getMetrics(): OrchestratorMetricsSnapshot {
    return this.metrics.getSnapshot();
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('UnifiedMLOrchestrator cache cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<UnifiedMLConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      modules: { ...this.config.modules, ...updates.modules },
      weights: { ...this.config.weights, ...updates.weights },
      thresholds: { ...this.config.thresholds, ...updates.thresholds },
    };
    logger.info('UnifiedMLOrchestrator configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<UnifiedMLConfig> {
    return { ...this.config };
  }

  /**
   * Health check for all modules
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    modules: Record<string, { available: boolean; latencyMs?: number }>;
  }> {
    const moduleHealth: Record<string, { available: boolean; latencyMs?: number }> = {};

    // Quick availability check for each module
    const checks = [
      { name: 'fraudDetection', enabled: this.config.modules.fraudDetection },
      { name: 'anomalyDetection', enabled: this.config.modules.anomalyDetection },
      { name: 'riskEngine', enabled: this.config.modules.riskEngine },
      { name: 'transactionPrediction', enabled: this.config.modules.transactionPrediction },
      { name: 'behavioralAnalytics', enabled: this.config.modules.behavioralAnalytics },
    ];

    for (const check of checks) {
      if (!check.enabled) {
        moduleHealth[check.name] = { available: true }; // Not needed, so considered healthy
        continue;
      }

      const start = Date.now();
      try {
        // Simple check by attempting to import
        switch (check.name) {
          case 'fraudDetection':
            await import('./fraud-detector');
            break;
          case 'anomalyDetection':
            await import('./anomaly-detector');
            break;
          case 'riskEngine':
            await import('./risk-engine');
            break;
          case 'transactionPrediction':
            await import('./transaction-predictor');
            break;
          case 'behavioralAnalytics':
            await import('./behavioral-analytics');
            break;
        }
        moduleHealth[check.name] = { available: true, latencyMs: Date.now() - start };
      } catch {
        moduleHealth[check.name] = { available: false };
      }
    }

    const allHealthy = Object.values(moduleHealth).every((m) => m.available);

    return {
      healthy: allHealthy,
      modules: moduleHealth,
    };
  }
}

// ============== Internal Metrics Class ==============

class OrchestratorMetrics {
  private totalAnalyses = 0;
  private successfulAnalyses = 0;
  private failedAnalyses = 0;
  private totalTimeMs = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  recordAnalysis(durationMs: number, success: boolean): void {
    this.totalAnalyses++;
    this.totalTimeMs += durationMs;
    
    if (success) {
      this.successfulAnalyses++;
    } else {
      this.failedAnalyses++;
    }
  }

  recordCacheHit(): void {
    this.cacheHits++;
  }

  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  getSnapshot(): OrchestratorMetricsSnapshot {
    return {
      totalAnalyses: this.totalAnalyses,
      successfulAnalyses: this.successfulAnalyses,
      failedAnalyses: this.failedAnalyses,
      successRate: this.totalAnalyses > 0 ? this.successfulAnalyses / this.totalAnalyses : 0,
      avgAnalysisTimeMs: this.totalAnalyses > 0 ? this.totalTimeMs / this.totalAnalyses : 0,
      cacheHitRate:
        this.cacheHits + this.cacheMisses > 0
          ? this.cacheHits / (this.cacheHits + this.cacheMisses)
          : 0,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
    };
  }
}

interface OrchestratorMetricsSnapshot {
  totalAnalyses: number;
  successfulAnalyses: number;
  failedAnalyses: number;
  successRate: number;
  avgAnalysisTimeMs: number;
  cacheHitRate: number;
  cacheHits: number;
  cacheMisses: number;
}

// ============== Factory Functions ==============

/**
 * Create a default ML pipeline for fraud detection
 */
export function createFraudDetectionPipeline(): MLPipeline {
  return new MLPipeline({
    id: 'fraud-detection-default',
    name: 'Default Fraud Detection Pipeline',
    mode: PipelineMode.PARALLEL,
    models: [
      { modelId: 'fraud-detector', enabled: true, weight: 0.5, priority: 1 },
      { modelId: 'anomaly-detector', enabled: true, weight: 0.3, priority: 2 },
      { modelId: 'risk-engine', enabled: true, weight: 0.2, priority: 3 },
    ],
    aggregation: {
      method: AggregationMethod.WEIGHTED_AVERAGE,
      params: {},
    },
    timeout: { perModelMs: 3000, totalMs: 8000 },
    retry: {
      enabled: true,
      maxAttempts: 2,
      initialDelayMs: 50,
      backoffMultiplier: 2,
      maxDelayMs: 2000,
      retryableErrors: ['timeout'],
    },
    caching: {
      enabled: true,
      ttlMs: 120000,
      maxSize: 500,
      keyStrategy: 'hash',
    },
    logLevel: 'warn',
  });
}

/**
 * Create a default ML pipeline for transaction prediction
 */
export function createTransactionPredictionPipeline(): MLPipeline {
  return new MLPipeline({
    id: 'transaction-prediction-default',
    name: 'Default Transaction Prediction Pipeline',
    mode: PipelineMode.SEQUENTIAL,
    models: [
      { modelId: 'transaction-predictor', enabled: true, weight: 0.6, priority: 1 },
      { modelId: 'anomaly-detector', enabled: true, weight: 0.25, priority: 2 },
      { modelId: 'behavioral-analytics', enabled: true, weight: 0.15, priority: 3 },
    ],
    aggregation: {
      method: AggregationMethod.WEIGHTED_AVERAGE,
      params: {},
    },
    timeout: { perModelMs: 5000, totalMs: 12000 },
    retry: {
      enabled: true,
      maxAttempts: 3,
      initialDelayMs: 100,
      backoffMultiplier: 1.5,
      maxDelayMs: 3000,
      retryableErrors: ['timeout', 'network_error'],
    },
    caching: {
      enabled: true,
      ttlMs: 300000,
      maxSize: 1000,
      keyStrategy: 'hash',
    },
    logLevel: 'info',
  });
}

/**
 * Create a default unified ML orchestrator
 */
export function createDefaultOrchestrator(): UnifiedMLOrchestrator {
  return new UnifiedMLOrchestrator(DEFAULT_UNIFIED_CONFIG);
}

// ============== Version Information ==============

export const ML_MODULE_VERSION = '2.0.0';
export const ML_MODULE_BUILD_DATE = new Date().toISOString();

/**
 * Get information about the ML module
 */
export function getMLInfo(): {
  version: string;
  buildDate: string;
  modules: string[];
  capabilities: string[];
} {
  return {
    version: ML_MODULE_VERSION,
    buildDate: ML_MODULE_BUILD_DATE,
    modules: [
      'fraud-detector',
      'transaction-predictor',
      'anomaly-detector',
      'risk-engine',
      'behavioral-analytics',
    ],
    capabilities: [
      'real-time-fraud-detection',
      'anomaly-detection',
      'risk-scoring',
      'transaction-prediction',
      'behavioral-profiling',
      'model-ensemble',
      'ab-testing',
      'result-caching',
      'pipeline-orchestration',
    ],
  };
}
