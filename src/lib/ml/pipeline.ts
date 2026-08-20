/**
 * @module ml/pipeline
 * @description Main ML Pipeline for SSM-Pay payment platform.
 * Orchestrates fraud detection, anomaly detection, risk assessment,
 * and prediction capabilities into a unified processing pipeline.
 */

import { FraudDetector, FraudDetectionResult, FraudDetectionInput, FraudRiskLevel } from './fraud-detector';
import { Predictor, PredictionResult, PredictionFeatures } from './predictor';
import { AnomalyDetector, AnomalyDetectionResult } from './anomaly';
import { RiskEngine, RiskAssessment, TransactionRiskInput, RiskLevel } from './risk-engine';

/** Pipeline configuration */
export interface PipelineConfig {
  enableFraudDetection: boolean;
  enableAnomalyDetection: boolean;
  enableRiskAssessment: boolean;
  enablePrediction: boolean;
  parallelExecution: boolean;
  moduleTimeoutMs: number;
  pipelineTimeoutMs: number;
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  enableFraudDetection: true, enableAnomalyDetection: true,
  enableRiskAssessment: true, enablePrediction: true,
  parallelExecution: true, moduleTimeoutMs: 5000, pipelineTimeoutMs: 15000
};

/** Input data for pipeline processing */
export interface PipelineTransactionInput {
  transactionId: string; amount: number; currency: string;
  customerId: string; timestamp: Date; paymentMethod: string;
  ipAddress?: string; deviceFingerprint?: string; countryCode?: string;
  recipientId?: string; channel?: string; merchantCategoryCode?: string;
  latitude?: number; longitude?: number; destinationCountry?: string;
  customerProfile?: CustomerContext;
}

/** Customer context data */
export interface CustomerContext {
  accountCreatedDate: Date; totalTransactions: number;
  avgTransactionAmount: number; amountStdDev?: number;
  successRate: number; countriesUsed: string[];
  knownDevices: string[]; chargebackCount: number;
  verificationStatus: 'NONE' | 'BASIC' | 'ENHANCED' | 'FULL';
  recentTransactionCount?: number;
}

/** Combined pipeline result */
export interface PipelineResult {
  executionId: string; executedAt: Date; executionTimeMs: number;
  fraudResult?: FraudDetectionResult;
  anomalyResult?: AnomalyDetectionResult;
  riskAssessment?: RiskAssessment;
  predictions?: { successProbability: PredictionResult<number>; processingTime: PredictionResult<number>; churnRisk: PredictionResult<number> };
  overallDecision: PipelineDecision; shouldApprove: boolean; shouldBlock: boolean;
  requiresReview: boolean; requiresAdditionalAuth: boolean;
  summary: PipelineSummary; riskScore: number;
  modulesExecuted: string[]; errors: PipelineError[]; warnings: string[];
}

/** Decision types */
export enum PipelineDecision { APPROVE = 'APPROVE', APPROVE_WITH_REVIEW = 'APPROVE_WITH_REVIEW', REQUIRE_AUTH = 'REQUIRE_AUTH', MANUAL_REVIEW = 'MANUAL_REVIEW', DECLINE = 'DECLINE', BLOCK = 'BLOCK' }

/** Summary of analysis */
export interface PipelineSummary { text: string; keyFindings: string[]; primaryConcern?: string; recommendedActions: string[] }

/** Pipeline error */
export interface PipelineError { module: string; error: string; timestamp: Date; fatal: boolean }

/**
 * MLPipeline class - Main orchestrator for all ML modules
 */
export class MLPipeline {
  private config: PipelineConfig;
  private fraudDetector: FraudDetector;
  private predictor: Predictor;
  private anomalyDetector: AnomalyDetector;
  private riskEngine: RiskEngine;

  constructor(config?: Partial<PipelineConfig>) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
    this.fraudDetector = new FraudDetector();
    this.predictor = new Predictor();
    this.anomalyDetector = new AnomalyDetector();
    this.riskEngine = new RiskEngine();
  }

  /**
   * Process a transaction through the full ML pipeline
   */
  async processTransaction(input: PipelineTransactionInput): Promise<PipelineResult> {
    const startTime = performance.now();
    const execId = `pipe_${input.transactionId}_${Date.now()}`;
    const modsExecuted: string[] = [];
    const errors: PipelineError[] = [];

    let fraudResult: FraudDetectionResult | undefined;
    let anomalyResult: AnomalyDetectionResult | undefined;
    let riskAssessment: RiskAssessment | undefined;
    let predictions: PipelineResult['predictions'] | undefined;

    // Run enabled modules with error handling
    if (this.config.enableFraudDetection) {
      try { fraudResult = await this.runModule(() => this.runFraud(input), 'fraud-detection'); modsExecuted.push('fraud-detection'); }
      catch (e) { errors.push(this.makeError('fraud-detection', e)); }
    }

    if (this.config.enableRiskAssessment) {
      try { riskAssessment = await this.runModule(() => this.runRisk(input), 'risk-assessment'); modsExecuted.push('risk-assessment'); }
      catch (e) { errors.push(this.makeError('risk-assessment', e)); }
    }

    if (this.config.enablePrediction) {
      try { predictions = await this.runModule(() => this.runPredictions(input), 'prediction'); modsExecuted.push('prediction'); }
      catch (e) { errors.push(this.makeError('prediction', e)); }
    }

    if (this.config.enableAnomalyDetection && input.customerProfile) {
      try { anomalyResult = await this.runModule(() => this.anomalyDetector.detect([input.amount], `tx_${input.customerId}`), 'anomaly'); modsExecuted.push('anomaly'); }
      catch (e) { errors.push(this.makeError('anomaly', e)); }
    }

    return this.buildResult({
      executionId: execId, executedAt: new Date(), executionTimeMs: performance.now() - startTime,
      fraudResult, anomalyResult, riskAssessment, predictions, modulesExecuted: modsExecuted, errors, warnings: [], input
    });
  }

  /**
   * Quick pre-check before full processing
   */
  quickCheck(input: PipelineTransactionInput): { decision: PipelineDecision; reason: string; riskScore: number } {
    if (input.amount <= 0) return { decision: PipelineDecision.DECLINE, reason: 'Invalid amount', riskScore: 100 };
    if (input.amount > 100000) return { decision: PipelineDecision.REQUIRE_AUTH, reason: 'High-value transaction', riskScore: 60 };

    if (input.customerProfile) {
      const ageDays = (Date.now() - input.customerProfile.accountCreatedDate.getTime()) / 86400000;
      if (ageDays < 1 && input.amount > 1000) return { decision: PipelineDecision.REQUIRE_AUTH, reason: 'New customer high value', riskScore: 55 };
    }

    return { decision: PipelineDecision.APPROVE, reason: 'Basic checks passed', riskScore: 10 };
  }

  updateConfig(config: Partial<PipelineConfig>): void { this.config = { ...this.config, config }; }
  getConfig(): PipelineConfig { return { ...this.config }; }

  /** Run a module with timeout */
  private async runModule<T>(fn: () => T, name: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${name} timed out`)), this.config.moduleTimeoutMs);
      try { resolve(fn()); clearTimeout(timer); }
      catch (e) { clearTimeout(timer); reject(e); }
    });
  }

  /** Build final result from all module outputs */
  private buildResult(params: {
    executionId: string; executedAt: Date; executionTimeMs: number;
    fraudResult?: FraudDetectionResult; anomalyResult?: AnomalyDetectionResult;
    riskAssessment?: RiskAssessment; predictions?: PipelineResult['predictions'];
    modulesExecuted: string[]; errors: PipelineError[]; warnings: string[]; input: PipelineTransactionInput;
  }): PipelineResult {
    const { fraudResult, riskAssessment, predictions, input, ...rest } = params;
    const riskScore = this.calcRiskScore(fraudResult, riskAssessment);
    const decision = this.decide(fraudResult, riskAssessment, predictions, riskScore);
    const summary = this.genSummary(fraudResult, riskAssessment, predictions, riskScore);

    return {
      ...rest, fraudResult, riskAssessment, predictions,
      overallDecision: decision,
      shouldApprove: decision === PipelineDecision.APPROVE || decision === PipelineDecision.APPROVE_WITH_REVIEW,
      shouldBlock: decision === PipelineDecision.BLOCK || decision === PipelineDecision.DECLINE,
      requiresReview: decision === PipelineDecision.MANUAL_REVIEW || decision === PipelineDecision.APPROVE_WITH_REVIEW,
      requiresAdditionalAuth: decision === PipelineDecision.REQUIRE_AUTH,
      summary, riskScore
    };
  }

  /** Calculate composite risk score */
  private calcRiskScore(fraud?: FraudDetectionResult, risk?: RiskAssessment): number {
    let score = 0, weight = 0;
    if (fraud) { score += fraud.riskScore * 0.4; weight += 0.4; }
    if (risk) { score += risk.overallScore * 0.4; weight += 0.4; }
    return Math.round(weight > 0 ? score / weight : 20);
  }

  /** Determine overall decision from module results */
  private decide(
    fraud?: FraudDetectionResult, risk?: RiskAssessment,
    preds?: PipelineResult['predictions'], riskScore: number
  ): PipelineDecision {
    if (fraud?.riskLevel === FraudRiskLevel.CRITICAL) return PipelineDecision.BLOCK;
    if (fraud?.riskLevel === FraudRiskLevel.HIGH && preds?.successProbability.value && preds.successProbability.value < 0.7) return PipelineDecision.DECLINE;
    if (risk?.riskLevel === RiskLevel.CRITICAL || risk?.riskLevel === RiskLevel.ELEVATED) return PipelineDecision.BLOCK;
    if (risk?.riskLevel === RiskLevel.HIGH || fraud?.riskLevel === FraudRiskLevel.HIGH) return PipelineDecision.MANUAL_REVIEW;
    if (risk?.riskLevel === RiskLevel.MEDIUM || fraud?.riskLevel === FraudRiskLevel.MEDIUM) return PipelineDecision.REQUIRE_AUTH;
    if (preds?.successProbability.value && preds.successProbability.value < 0.8) return PipelineDecision.APPROVE_WITH_REVIEW;
    if (riskScore >= 60) return PipelineDecision.MANUAL_REVIEW;
    if (riskScore >= 40) return PipelineDecision.REQUIRE_AUTH;
    return PipelineDecision.APPROVE;
  }

  /** Generate human-readable summary */
  private genSummary(
    fraud?: FraudDetectionResult, risk?: RiskAssessment,
    _preds?: PipelineResult['predictions'], riskScore: number
  ): PipelineSummary {
    const findings: string[] = [];
    let concern: string | undefined;

    if (fraud?.signals.length) { findings.push(`${fraud.signals.length} fraud signal(s)`); concern = 'Potential fraud indicators'; }
    if (risk) findings.push(`Risk level: ${risk.riskLevel}`);
    if (!concern && riskScore >= 60) concern = 'Elevated risk profile';
    else if (!concern && riskScore >= 40) concern = 'Moderate risk factors';

    return {
      text: `Overall risk: ${riskScore}/100${fraud ? `, Fraud: ${fraud.riskLevel} (${fraud.riskScore})` : ''}${risk ? `, Risk: ${risk.riskLevel} (${risk.overallScore})` : ''}`,
      keyFindings: findings.length ? findings : ['No significant concerns'],
      primaryConcern: concern,
      recommendedActions: riskScore < 30 ? ['Standard processing approved'] : riskScore >= 60 ? ['Manual review required'] : ['Additional verification recommended']
    };
  }

  /** Run fraud detection on input */
  private runFraud(input: PipelineTransactionInput): FraudDetectionResult {
    const fdInput: FraudDetectionInput = {
      transactionId: input.transactionId, amount: input.amount, currency: input.currency,
      customerId: input.customerId, recipientId: input.recipientId ?? '',
      ipAddress: input.ipAddress, deviceFingerprint: input.deviceFingerprint,
      countryCode: input.countryCode, latitude: input.latitude, longitude: input.longitude,
      timestamp: input.timestamp, paymentMethod: input.paymentMethod as any,
      merchantCategoryCode: input.merchantCategoryCode, channel: (input.channel ?? 'WEB') as any
    };

    const profile = input.customerProfile ? {
      customerId: input.customerId, avgTransactionAmount: input.customerProfile.avgTransactionAmount,
      amountStdDev: input.customerProfile.amountStdDev ?? 0,
      typicalCountries: input.customerProfile.countriesUsed, knownDevices: input.customerProfile.knownDevices,
      accountCreatedDate: input.customerProfile.accountCreatedDate,
      totalTransactionCount: input.customerProfile.totalTransactions,
      flaggedTransactionCount: input.customerProfile.chargebackCount, riskTier: 'STANDARD' as any
    } : undefined;

    return this.fraudDetector.analyze(fdInput, profile);
  }

  /** Run risk assessment on input */
  private runRisk(input: PipelineTransactionInput): RiskAssessment {
    const txInput: TransactionRiskInput = {
      transactionId: input.transactionId, amount: input.amount, currency: input.currency,
      customerId: input.customerId, paymentMethod: input.paymentMethod,
      originCountry: input.countryCode, destinationCountry: input.destinationCountry,
      deviceFingerprint: input.deviceFingerprint, ipAddress: input.ipAddress,
      timestamp: input.timestamp, channel: input.channel ?? 'WEB'
    };

    const custData = input.customerProfile ? {
      customerId: input.customerId, accountCreatedDate: input.customerProfile.accountCreatedDate,
      totalTransactions: input.customerProfile.totalTransactions, successRate: input.customerProfile.successRate,
      totalVolume: input.customerProfile.totalTransactions * input.customerProfile.avgTransactionAmount,
      avgTransactionAmount: input.customerProfile.avgTransactionAmount,
      countriesUsed: input.customerProfile.countriesUsed, deviceCount: input.customerProfile.knownDevices.length,
      chargebackCount: input.customerProfile.chargebackCount, verificationStatus: input.customerProfile.verificationStatus
    } : undefined;

    return this.riskEngine.assessTransaction(txInput, custData, input.customerProfile ? new Set(input.customerProfile.knownDevices) : undefined);
  }

  /** Run predictions on input */
  private runPredictions(input: PipelineTransactionInput): PipelineResult['predictions'] {
    const features: PredictionFeatures = {
      amount: input.amount, currency: input.currency, paymentMethod: input.paymentMethod,
      customerId: input.customerId,
      accountAgeDays: input.customerProfile ? (Date.now() - input.customerProfile.accountCreatedDate.getTime()) / 86400000 : 30,
      historicalSuccessRate: input.customerProfile?.successRate ?? 0.95,
      totalTransactions: input.customerProfile?.totalTransactions ?? 0,
      hourOfDay: input.timestamp.getHours(), dayOfWeek: input.timestamp.getDay(),
      isWeekend: input.timestamp.getDay() === 0 || input.timestamp.getDay() === 6,
      isHoliday: this.isHoliday(input.timestamp),
      originCountry: input.countryCode, destinationCountry: input.destinationCountry,
      isCrossBorder: input.countryCode !== input.destinationCountry && !!input.countryCode && !!input.destinationCountry
    };

    const all = this.predictor.transaction.predictAll(features);
    return { successProbability: all.success, processingTime: all.processingTime, churnRisk: all.churnRisk };
  }

  /** Create error object */
  private makeError(module: string, e: unknown): PipelineError {
    return {
      module, error: e instanceof Error ? e.message : 'Unknown error', timestamp: new Date(), fatal: false
    };
  }

  /** Simple holiday check */
  private isHoliday(date: Date): boolean {
    const m = date.getMonth(), d = date.getDate();
    return (m === 11 && d >= 24 && d <= 26) || (m === 6 && d === 4) || (m === 0 && d === 1);
  }
}

export default MLPipeline;
