/**
 * Shared ML Types for SSM-Pay Machine Learning Modules
 * 
 * @module ml/types
 * @description Common interfaces and types used across all ML modules including
 * fraud detection, transaction prediction, anomaly detection, risk engine,
 * and behavioral analytics.
 * 
 * @version 1.0.0
 * @since 2.0.0
 * @author SSM-Pay ML Engineering Team
 */

// ============== Base Model Types ==============

/**
 * Core model identifier and versioning information
 */
export interface ModelMetadata {
  /** Unique model identifier across the system */
  id: string;
  /** Human-readable model name */
  name: string;
  /** Semantic version string (e.g., "2.1.0") */
  version: string;
  /** Model type classification */
  type: ModelType;
  /** Model creation timestamp */
  createdAt: Date;
  /** Last training timestamp */
  lastTrainedAt?: Date;
  /** Training data period start */
  trainingDataStart?: Date;
  /** Training data period end */
  trainingDataEnd?: Date;
  /** Model status in the lifecycle */
  status: ModelStatus;
  /** Feature set used by this model */
  features: string[];
  /** Hyperparameters configuration */
  hyperparameters: Record<string, unknown>;
  /** Model description/purpose */
  description?: string;
  /** Tags for categorization and search */
  tags?: string[];
}

/**
 * Classification of ML model types in the system
 */
export enum ModelType {
  /** Fraud detection and prevention models */
  FRAUD_DETECTION = 'fraud_detection',
  /** Transaction volume/value prediction models */
  TRANSACTION_PREDICTION = 'transaction_prediction',
  /** Anomaly and outlier detection models */
  ANOMALY_DETECTION = 'anomaly_detection',
  /** Risk assessment and scoring models */
  RISK_ENGINE = 'risk_engine',
  /** User behavior analysis models */
  BEHAVIORAL_ANALYTICS = 'behavioral_analytics',
  /** Ensemble or meta-models combining others */
  ENSEMBLE = 'ensemble'
}

/**
 * Lifecycle status of an ML model
 */
export enum ModelStatus {
  /** Model is being trained */
  TRAINING = 'training',
  /** Model is ready for inference */
  ACTIVE = 'active',
  /** Model is being evaluated */
  EVALUATING = 'evaluating',
  /** Model is deprecated but available */
  DEPRECATED = 'deprecated',
  /** Model is disabled and not available */
  DISABLED = 'disabled',
  /** Model failed during training or evaluation */
  FAILED = 'failed'
}

// ============== Prediction Result Types ==============

/**
 * Base prediction result interface
 */
export interface BasePredictionResult {
  /** Unique prediction request identifier */
  predictionId: string;
  /** Model that generated this prediction */
  modelId: string;
  /** Timestamp when prediction was made */
  timestamp: Date;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Whether the prediction was successful */
  success: boolean;
  /** Error information if prediction failed */
  error?: PredictionError;
  /** Confidence score between 0 and 1 */
  confidence: number;
  /** Additional metadata about the prediction */
  metadata?: Record<string, unknown>;
}

/**
 * Error details from a failed prediction
 */
export interface PredictionError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** Stack trace for debugging */
  stack?: string;
}

/**
 * Classification prediction result with probability distribution
 */
export interface ClassificationResult extends BasePredictionResult {
  /** Predicted class label */
  predictedClass: string;
  /** Probability distribution over all classes */
  probabilities: Record<string, number>;
  /** Top-N alternative predictions */
  alternatives?: Array<{
    label: string;
    probability: number;
  }>;
}

/**
 * Regression/numerical prediction result with uncertainty bounds
 */
export interface RegressionResult extends BasePredictionResult {
  /** Predicted numerical value */
  value: number;
  /** Lower bound of confidence interval */
  lowerBound: number;
  /** Upper bound of confidence interval */
  upperBound: number;
  /** Confidence interval level (e.g., 0.95 for 95%) */
  confidenceLevel: number;
  /** Standard deviation of prediction */
  standardDeviation?: number;
}

/**
 * Anomaly detection result with severity scoring
 */
export interface AnomalyResult extends BasePredictionResult {
  /** Whether the input is anomalous */
  isAnomalous: boolean;
  /** Anomaly score (higher = more anomalous) */
  anomalyScore: number;
  /** Severity level of detected anomaly */
  severity: AnomalySeverity;
  /** Type of anomaly detected */
  anomalyType: AnomalyType;
  /** Contributing factors to anomaly score */
  factors?: AnomalyFactor[];
}

/**
 * Severity levels for anomalies
 */
export enum AnomalySeverity {
  /** Minor deviation, likely benign */
  LOW = 'low',
  /** Moderate concern, worth monitoring */
  MEDIUM = 'medium',
  /** Significant anomaly, requires attention */
  HIGH = 'high',
  /** Critical anomaly, immediate action needed */
  CRITICAL = 'critical'
}

/**
 * Categories of detectable anomalies
 */
export enum AnomalyType {
  /** Statistical outlier */
  STATISTICAL = 'statistical',
  /** Temporal pattern violation */
  TEMPORAL = 'temporal',
  /** Behavioral pattern deviation */
  BEHAVIORAL = 'behavioral',
  /** Geographic/location anomaly */
  GEOGRAPHIC = 'geographic',
  /** Device fingerprint mismatch */
  DEVICE = 'device',
  /** Velocity/rate anomaly */
  VELOCITY = 'velocity',
  /** Amount/value anomaly */
  AMOUNT = 'amount',
  /** Unknown/unclassified anomaly */
  UNKNOWN = 'unknown'
}

/**
 * Individual factor contributing to anomaly detection
 */
export interface AnomalyFactor {
  /** Factor name/identifier */
  name: string;
  /** Factor's contribution to overall score */
  weight: number;
  /** Raw value of this factor */
  value: number;
  /** Expected normal range */
  expectedRange: [number, number];
  /** Human-readable description */
  description: string;
}

// ============== Risk Assessment Types ==============

/**
 * Comprehensive risk assessment result
 */
export interface RiskAssessmentResult extends BasePredictionResult {
  /** Overall risk score (0-100) */
  riskScore: number;
  /** Risk level classification */
  riskLevel: RiskLevel;
  /** Required authentication level */
  recommendedAction: RecommendedAction;
  /** Breakdown of risk factors */
  riskFactors: RiskFactor[];
  /** Historical context comparison */
  historicalContext?: HistoricalRiskContext;
}

/**
 * Risk level classifications
 */
export enum RiskLevel {
  /** Score 0-29: Minimal risk */
  LOW = 'low',
  /** Score 30-59: Moderate risk */
  MEDIUM = 'medium',
  /** Score 60-79: High risk */
  HIGH = 'high',
  /** Score 80-100: Critical risk */
  CRITICAL = 'critical'
}

/**
 * Actions recommended based on risk assessment
 */
export enum RecommendedAction {
  /** Allow transaction without additional steps */
  ALLOW = 'allow',
  /** Allow with step-up authentication */
  STEP_UP_AUTH = 'step_up_auth',
  /** Require manual review */
  REVIEW = 'review',
  /** Block transaction immediately */
  BLOCK = 'block',
  /** Require additional documentation */
  ADDITIONAL_DOCS = 'additional_docs'
}

/**
 * Individual risk factor contribution
 */
export interface RiskFactor {
  /** Factor category */
  category: RiskCategory;
  /** Factor name */
  name: string;
  /** Contribution to total risk score */
  score: number;
  /** Maximum possible score for this factor */
  maxScore: number;
  /** Weight in overall calculation */
  weight: number;
  /** Description of why this factor triggered */
  description: string;
}

/**
 * Categories of risk factors
 */
export enum RiskCategory {
  /** Transaction amount related risks */
  AMOUNT = 'amount',
  /** User behavior pattern risks */
  BEHAVIORAL = 'behavioral',
  /** Device-related risks */
  DEVICE = 'device',
  /** Geographic location risks */
  GEOGRAPHIC = 'geographic',
  /** Velocity/frequency risks */
  VELOCITY = 'velocity',
  /** Historical pattern risks */
  HISTORICAL = 'historical',
  /** External data risks */
  EXTERNAL = 'external'
}

/**
 * Historical risk context for comparison
 */
export interface HistoricalRiskContext {
  /** User's average historical risk score */
  avgHistoricalScore: number;
  /** User's maximum historical risk score */
  maxHistoricalScore: number;
  /** Number of past transactions analyzed */
  transactionCount: number;
  /** Time period of historical data */
  periodDays: number;
  /** Trend direction */
  trend: 'increasing' | 'decreasing' | 'stable';
}

// ============== Training Data Types ==============

/**
 * Training dataset configuration
 */
export interface TrainingConfig {
  /** Dataset identifier */
  datasetId: string;
  /** Training data source */
  dataSource: DataSource;
  /** Data time range */
  dateRange: {
    start: Date;
    end: Date;
  };
  /** Training/validation/test split ratios */
  splitRatios: {
    training: number;
    validation: number;
    test: number;
  };
  /** Feature selection configuration */
  features: FeatureConfig[];
  /** Target variable configuration */
  target: TargetConfig;
  /** Class weights for imbalanced data */
  classWeights?: Record<string, number>;
  /** Cross-validation folds */
  crossValidationFolds?: number;
  /** Random seed for reproducibility */
  randomSeed?: number;
  /** Maximum training iterations */
  maxIterations?: number;
  /** Early stopping patience */
  earlyStoppingPatience?: number;
  /** Learning rate configuration */
  learningRate?: number;
  /** Batch size for mini-batch training */
  batchSize?: number;
}

/**
 * Data source types for training
 */
export enum DataSource {
  /** Production transaction database */
  TRANSACTION_DB = 'transaction_db',
  /** Event tracking system */
  EVENT_STORE = 'event_store',
  /** External data provider */
  EXTERNAL_API = 'external_api',
  /** Preprocessed feature store */
  FEATURE_STORE = 'feature_store',
  /** Manual upload */
  MANUAL_UPLOAD = 'manual_upload',
  /** Synthetic/generated data */
  SYNTHETIC = 'synthetic'
}

/**
 * Configuration for a single feature
 */
export interface FeatureConfig {
  /** Feature name/identifier */
  name: string;
  /** Feature data type */
  type: FeatureType;
  /** Whether this feature is used in training */
  enabled: boolean;
  /** Feature transformation pipeline */
  transformations?: TransformationConfig[];
  /** Missing value handling strategy */
  missingValueStrategy: MissingValueStrategy;
  /** Feature-specific normalization config */
  normalization?: NormalizationConfig;
}

/**
 * Supported feature data types
 */
export enum FeatureType {
  NUMERIC = 'numeric',
  CATEGORICAL = 'categorical',
  BOOLEAN = 'boolean',
  TEMPORAL = 'temporal',
  TEXT = 'text',
  GEOGRAPHIC = 'geographic',
  SET = 'set'
}

/**
 * Strategies for handling missing values
 */
export enum MissingValueStrategy {
  DROP_ROWS = 'drop_rows',
  MEAN_IMPUTATION = 'mean_imputation',
  MEDIAN_IMPUTATION = 'median_imputation',
  MODE_IMPUTATION = 'mode_imputation',
  CONSTANT = 'constant',
  KNN_IMPUTATION = 'knn_imputation',
  FORWARD_FILL = 'forward_fill',
  INDICATOR = 'indicator'
}

/**
 * Transformation to apply to a feature
 */
export interface TransformationConfig {
  /** Transformation type */
  type: TransformationType;
  /** Transformation parameters */
  params: Record<string, unknown>;
  /** Order in transformation pipeline */
  order: number;
}

/**
 * Available feature transformations
 */
export enum TransformationType {
  LOG_TRANSFORM = 'log_transform',
  BOX_COX = 'box_cox',
  ONE_HOT_ENCODING = 'one_hot_encoding',
  LABEL_ENCODING = 'label_encoding',
  BINNING = 'binning',
  POLYNOMIAL = 'polynomial',
  INTERACTION = 'interaction',
  CUSTOM = 'custom'
}

/**
 * Normalization configuration
 */
export interface NormalizationConfig {
  /** Normalization method */
  method: NormalizationMethod;
  /** Method-specific parameters */
  params?: Record<string, unknown>;
}

/**
 * Normalization methods
 */
export enum NormalizationMethod {
  MIN_MAX = 'min_max',
  STANDARD = 'standard',
  ROBUST = 'robust',
  NONE = 'none'
}

/**
 * Target variable configuration
 */
export interface TargetConfig {
  /** Target column name */
  name: string;
  /** Target type (classification vs regression) */
  taskType: TaskType;
  /** For classification: list of classes */
  classes?: string[];
  /** For regression: value range */
  valueRange?: [number, number];
}

/**
 * Machine learning task types
 */
export enum TaskType {
  BINARY_CLASSIFICATION = 'binary_classification',
  MULTI_CLASS_CLASSIFICATION = 'multi_class_classification',
  REGRESSION = 'regression',
  ANOMALY_DETECTION = 'anomaly_detection',
  CLUSTERING = 'clustering',
  RANKING = 'ranking'
}

// ============== Feature Engineering Types ==============

/**
 * Engineered feature definition
 */
export interface EngineeredFeature {
  /** Feature name */
  name: string;
  /** Feature description */
  description: string;
  /** Source features used */
  sourceFeatures: string[];
  /** Engineering function applied */
  engineeringFunction: string;
  /** Feature data type */
  type: FeatureType;
  /** Computed value */
  value: unknown;
  /** Computation timestamp */
  computedAt: Date;
}

/**
 * Feature vector representation
 */
export interface FeatureVector {
  /** Vector identifier */
  id: string;
  /** Feature values as key-value pairs */
  features: Record<string, unknown>;
  /** Feature names in order */
  featureNames: string[];
  /** Numerical values for model input */
  numericalValues: number[];
  /** Original raw data reference */
  rawDataId?: string;
  /** Engineering metadata */
  metadata: FeatureVectorMetadata;
}

/**
 * Metadata for a feature vector
 */
export interface FeatureVectorMetadata {
  /** When the vector was created */
  createdAt: Date;
  /** Which model/version created it */
  createdBy: string;
  /** Number of features */
  dimension: number;
  /** Whether vector is normalized */
  isNormalized: boolean;
  /** Normalization method if applied */
  normalizationMethod?: NormalizationMethod;
  /** Quality score (0-1) */
  qualityScore: number;
  /** Any quality issues flagged */
  issues?: QualityIssue[];
}

/**
 * Data quality issue flag
 */
export interface QualityIssue {
  /** Issue type */
  type: QualityIssueType;
  /** Affected feature(s) */
  affectedFeatures: string[];
  /** Severity level */
  severity: 'warning' | 'error' | 'critical';
  /** Description */
  description: string;
}

/**
 * Types of data quality issues
 */
export enum QualityIssueType {
  MISSING_VALUE = 'missing_value',
  OUT_OF_RANGE = 'out_of_range',
  INVALID_TYPE = 'invalid_type',
  DUPLICATE = 'duplicate',
  INCONSISTENT = 'inconsistent',
  STALE_DATA = 'stale_data'
}

// ============== Model Evaluation Types ==============

/**
 * Comprehensive model evaluation metrics
 */
export interface ModelEvaluationMetrics {
  /** When evaluation was performed */
  evaluatedAt: Date;
  /** Dataset used for evaluation */
  evalDataset: string;
  /** Classification metrics (if applicable) */
  classificationMetrics?: ClassificationMetrics;
  /** Regression metrics (if applicable) */
  regressionMetrics?: RegressionMetrics;
  /** Anomaly detection metrics (if applicable) */
  anomalyMetrics?: AnomalyDetectionMetrics;
  /** Overall model health score */
  healthScore: number;
  /** Recommendations for improvement */
  recommendations?: string[];
}

/**
 * Classification performance metrics
 */
export interface ClassificationMetrics {
  /** Accuracy score */
  accuracy: number;
  /** Precision (macro/micro/weighted) */
  precision: {
    macro: number;
    micro: number;
    weighted: number;
    perClass: Record<string, number>;
  };
  /** Recall scores */
  recall: {
    macro: number;
    micro: number;
    weighted: number;
    perClass: Record<string, number>;
  };
  /** F1 scores */
  f1Score: {
    macro: number;
    micro: number;
    weighted: number;
    perClass: Record<string, number>;
  };
  /** Area under ROC curve */
  aucROC: number;
  /** Area under PR curve */
  aucPR: number;
  /** Confusion matrix */
  confusionMatrix: number[][];
  /** Log loss */
  logLoss: number;
}

/**
 * Regression performance metrics
 */
export interface RegressionMetrics {
  /** Mean Absolute Error */
  mae: number;
  /** Mean Squared Error */
  mse: number;
  /** Root Mean Squared Error */
  rmse: number;
  /** R-squared coefficient */
  rSquared: number;
  /** Adjusted R-squared */
  adjustedRSquared: number;
  /** Mean Absolute Percentage Error */
  mape: number;
  /** Symmetric MAPE */
  smape: number;
  /** Explained variance */
  explainedVariance: number;
  /** Max error */
  maxError: number;
  /** Median absolute error */
  medianAE: number;
}

/**
 * Anomaly detection specific metrics
 */
export interface AnomalyDetectionMetrics {
  /** True positive rate at various thresholds */
  tprAtThresholds: Record<number, number>;
  /** False positive rate at various thresholds */
  fprAtThresholds: Record<number, number>;
  /** Precision-recall at threshold */
  precisionRecallCurve: Array<{ threshold: number; precision: number; recall: number }>;
  /** Area under PR curve for anomalies */
  aucPR: number;
  /** Detection latency in milliseconds */
  avgDetectionLatencyMs: number;
  /** False discovery rate */
  falseDiscoveryRate: number;
}

// ============== Pipeline Types ==============

/**
 * Pipeline execution configuration
 */
export interface PipelineConfig {
  /** Pipeline identifier */
  id: string;
  /** Pipeline name */
  name: string;
  /** Execution mode */
  mode: PipelineMode;
  /** Models to include in pipeline */
  models: PipelineModelConfig[];
  /** Result aggregation strategy */
  aggregation: AggregationConfig;
  /** Timeout configuration */
  timeout: {
    /** Per-model timeout in ms */
    perModelMs: number;
    /** Total pipeline timeout in ms */
    totalMs: number;
  };
  /** Retry configuration */
  retry: RetryConfig;
  /** Caching configuration */
  caching: CachingConfig;
  /** A/B testing configuration */
  abTesting?: ABTestingConfig;
  /** Logging level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Pipeline execution modes
 */
export enum PipelineMode {
  /** Execute models sequentially */
  SEQUENTIAL = 'sequential',
  /** Execute models in parallel */
  PARALLEL = 'parallel',
  /** Execute with dependency graph */
  DAG = 'dag',
  /** Execute with fallback chain */
  FALLBACK_CHAIN = 'fallback_chain'
}

/**
 * Configuration for a single model within a pipeline
 */
export interface PipelineModelConfig {
  /** Model ID to use */
  modelId: string;
  /** Whether this model is enabled */
  enabled: boolean;
  /** Model weight in ensemble (for weighted aggregation) */
  weight: number;
  /** Priority for sequential execution */
  priority: number;
  /** Dependencies on other models (for DAG mode) */
  dependencies?: string[];
  /** Fallback model if this fails */
  fallbackModelId?: string;
  /** Model-specific configuration overrides */
  configOverrides?: Record<string, unknown>;
}

/**
 * Result aggregation configuration
 */
export interface AggregationConfig {
  /** Aggregation method */
  method: AggregationMethod;
  /** Method-specific parameters */
  params: Record<string, unknown>;
}

/**
 * Aggregation methods for combining model results
 */
export enum AggregationMethod {
  /** Simple majority vote */
  MAJORITY_VOTE = 'majority_vote',
  /** Weighted voting */
  WEIGHTED_VOTE = 'weighted_vote',
  /** Average of numeric outputs */
  AVERAGE = 'average',
  /** Weighted average */
  WEIGHTED_AVERAGE = 'weighted_average',
  /** Maximum score */
  MAX = 'max',
  /** Minimum score */
  MIN = 'min',
  /** Stack-based meta-learner */
  STACKING = 'stacking',
  /** Custom aggregation function */
  CUSTOM = 'custom'
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Enable retries */
  enabled: boolean;
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Retryable error codes */
  retryableErrors: string[];
}

/**
 * Caching configuration
 */
export interface CachingConfig {
  /** Enable result caching */
  enabled: boolean;
  /** Cache TTL in milliseconds */
  ttlMs: number;
  /** Maximum cache size */
  maxSize: number;
  /** Cache key generation strategy */
  keyStrategy: 'hash' | 'signature' | 'custom';
}

/**
 * A/B testing configuration for pipelines
 */
export interface ABTestingConfig {
  /** Enable A/B testing */
  enabled: boolean;
  /** Test identifier */
  testId: string;
  /** Control group configuration (model A) */
  control: ABTestVariant;
  /** Treatment group configuration (model B) */
  treatment: ABTestVariant;
  /** Traffic split ratio (control:treatment) */
  trafficSplit: number;
  /** Minimum sample size for significance */
  minSampleSize: number;
  /** Significance level (alpha) */
  significanceLevel: number;
  /** Metrics to compare */
  metrics: string[];
}

/**
 * Single variant in A/B test
 */
export interface ABTestVariant {
  /** Variant name/identifier */
  name: string;
  /** Models to use in this variant */
  modelIds: string[];
  /** Variant-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Complete pipeline execution result
 */
export interface PipelineResult {
  /** Pipeline execution identifier */
  executionId: string;
  /** Pipeline ID */
  pipelineId: string;
  /** Timestamp when execution started */
  startedAt: Date;
  /** Timestamp when execution completed */
  completedAt: Date;
  /** Total execution time in milliseconds */
  totalDurationMs: number;
  /** Whether execution was successful */
  success: boolean;
  /** Individual model results */
  modelResults: Map<string, BasePredictionResult>;
  /** Aggregated final result */
  aggregatedResult: AggregatedResult;
  /** A/B testing results if applicable */
  abTestResults?: ABTestResults;
  /** Execution metadata */
  metadata: PipelineExecutionMetadata;
}

/**
 * Aggregated result from multiple models
 */
export interface AggregatedResult {
  /** Final prediction/classification */
  finalPrediction: unknown;
  /** Overall confidence score */
  confidence: number;
  /** Agreement level among models (0-1) */
  agreement: number;
  /** Number of models that agreed */
  agreeingModels: number;
  /** Total models executed */
  totalModels: number;
  /** Disagreement details if any */
  disagreements?: DisagreementDetail[];
  /** Aggregation method used */
  method: AggregationMethod;
}

/**
 * Detail about model disagreement
 */
export interface DisagreementDetail {
  /** Model ID that disagreed */
  modelId: string;
  /** What this model predicted */
  prediction: unknown;
  /** What the majority predicted */
  majorityPrediction: unknown;
  /** How far off from consensus */
  deviationScore: number;
}

/**
 * A/B test execution results
 */
export interface ABTestResults {
  /** Test identifier */
  testId: string;
  /** Control group results */
  control: ABTestGroupResult;
  /** Treatment group results */
  treatment: ABTestGroupResult;
  /** Statistical significance */
  isSignificant: boolean;
  /** P-value from statistical test */
  pValue: number;
  /** Winning variant (if significant) */
  winningVariant?: 'control' | 'treatment';
  /** Recommendation based on results */
  recommendation: string;
}

/**
 * Results for one group in A/B test
 */
export interface ABTestGroupResult {
  /** Variant name */
  variantName: string;
  /** Sample size */
  sampleSize: number;
  /** Metric values */
  metrics: Record<string, number>;
  /** Conversion rate if applicable */
  conversionRate?: number;
  /** Average value if applicable */
  avgValue?: number;
}

/**
 * Metadata about pipeline execution
 */
export interface PipelineExecutionMetadata {
  /** Input data hash for caching */
  inputHash: string;
  /** Models attempted */
  modelsAttempted: string[];
  /** Models that succeeded */
  modelsSucceeded: string[];
  /** Models that failed */
  modelsFailed: string[];
  /** Cache hit status */
  cacheHit: boolean;
  /** Retries performed */
  retriesPerformed: number;
  /** Execution mode used */
  mode: PipelineMode;
  /** Node/environment info */
  environment: {
    nodeVersion: string;
    memoryUsageMb: number;
    cpuUsage: number;
  };
}
