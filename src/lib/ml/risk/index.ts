/**
 * Risk Engine Module - Main Entry Point
 * @module ml/risk
 * @description Main class and re-exports for the risk assessment system.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// Export all types
export * from './types';

// Export factor calculation functions
export {
  calculateAmountRisk,
  calculateVelocityRisk,
  calculateDeviceRisk,
  calculateGeographicRisk,
  calculateBehavioralRisk,
  calculateHistoricalRisk,
} from './factors';

// Export compliance functions
export {
  performAMLChecks,
  calculateComplianceRisk,
} from './compliance';

// Export authentication functions
export {
  determineAuthRequirement,
  shouldBlockTransaction,
  generateRecommendations,
} from './authentication';

// Export history functions
export {
  initializeStatistics,
  updateStatistics,
  adaptFromFeedback,
} from './history';

// Import types for internal use
import {
  RiskLevel,
  AuthRequirement,
  RiskProfile,
  TransactionInput,
  CustomerProfile,
  TransactionHistory,
  DeviceIntelligence,
  GeoLocationData,
  RiskAssessmentResult,
  RiskFactorContribution,
  AMLAlert,
  RiskThresholds,
  RiskFactorWeights,
  RiskEngineConfig,
  RiskHistoryRecord,
  RiskStatistics,
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
  DEFAULT_CONFIG,
  HIGH_RISK_COUNTRIES,
  SANCTIONED_COUNTRIES,
} from './types';

import {
  calculateAmountRisk,
  calculateVelocityRisk,
  calculateDeviceRisk,
  calculateGeographicRisk,
  calculateBehavioralRisk,
  calculateHistoricalRisk,
} from './factors';

import { performAMLChecks, calculateComplianceRisk } from './compliance';
import { 
  determineAuthRequirement, 
  shouldBlockTransaction, 
  generateRecommendations 
} from './authentication';
import { initializeStatistics, updateStatistics, adaptFromFeedback } from './history';

/**
 * Enterprise Risk Scoring Engine
 */
export class RiskEngine {
  private config: RiskEngineConfig;
  private thresholds: RiskThresholds;
  private weights: RiskFactorWeights;
  private history: Map<string, RiskHistoryRecord[]> = new Map();
  private assessmentCache: Map<string, { result: RiskAssessmentResult; expiry: Date }> = new Map();
  private stats: RiskStatistics = this.initializeStats();

  constructor(config: Partial<RiskEngineConfig> = {}) {
    const profile: RiskProfile = config.profile || 'moderate';
    
    if (!['conservative', 'moderate', 'aggressive'].includes(profile)) {
      throw new AppError(
        `Invalid risk profile: ${profile}`,
        ErrorCode.INVALID_CONFIG,
        { severity: 'error', context: { provided: profile } }
      );
    }

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      profile,
    };

    this.thresholds = {
      ...DEFAULT_THRESHOLDS[profile],
      ...(this.config.thresholds || {}),
    };

    this.weights = {
      ...DEFAULT_WEIGHTS[profile],
      ...(this.config.weights || {}),
    };

    const weightSum = Object.values(this.weights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      logger.warn('Risk factor weights do not sum to 1.0', {
        event: 'risk_engine.init',
        metadata: { weightSum, weights: this.weights },
      });
    }

    logger.info('Risk Engine initialized', {
      event: 'risk_engine.init',
      metadata: {
        profile: this.config.profile,
        thresholds: this.thresholds,
        version: this.config.version,
      },
    });
  }

  // ============== Public API Methods ==============

  async assessTransactionRisk(
    transaction: TransactionInput,
    customer: CustomerProfile,
    history: TransactionHistory,
    device?: DeviceIntelligence,
    geoLocation?: GeoLocationData
  ): Promise<RiskAssessmentResult> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateCacheKey(transaction);
      const cached = this.getCachedAssessment(cacheKey);
      if (cached) return cached;

      this.validateInputs(transaction, customer, history);

      const factors: RiskFactorContribution[] = [];

      factors.push(calculateAmountRisk(transaction, history));
      factors.push(calculateVelocityRisk(transaction, history));
      factors.push(calculateDeviceRisk(transaction, device));
      factors.push(calculateGeographicRisk(transaction, geoLocation, customer));
      factors.push(calculateBehavioralRisk(transaction, history, customer));
      factors.push(calculateHistoricalRisk(customer));

      const amlAlerts = this.config.enableAML 
        ? performAMLChecks(transaction, history)
        : [];

      factors.push(calculateComplianceRisk(amlAlerts, customer));
      factors.push(this.calculateCustomerProfileRisk(transaction, customer));

      const riskScore = this.calculateCompositeScore(factors);
      const riskLevel = this.classifyRiskLevel(riskScore);
      const requiredAuth = determineAuthRequirement(riskLevel, factors, customer);
      const shouldBlock = shouldBlockTransaction(riskLevel, amlAlerts, customer);
      const shouldFlag = !shouldBlock && (riskLevel >= RiskLevel.HIGH || amlAlerts.length > 0);
      const recommendations = generateRecommendations(riskLevel, factors, amlAlerts);
      const confidence = this.calculateConfidence(factors, device, geoLocation);

      const result: RiskAssessmentResult = {
        riskScore: Math.round(riskScore * 100) / 100,
        riskLevel,
        requiredAuth,
        shouldBlock,
        shouldFlag,
        factors,
        amlAlerts,
        assessedAt: new Date(),
        assessmentVersion: this.config.version,
        recommendations,
        confidence,
        processingTimeMs: Date.now() - startTime,
      };

      this.cacheAssessment(cacheKey, result);
      this.updateStatistics(result);

      logger.info('Risk assessment completed', {
        event: 'risk_engine.assessment',
        metadata: {
          transactionId: transaction.transactionId,
          riskScore: result.riskScore,
          riskLevel: result.riskLevel,
          shouldBlock: result.shouldBlock,
        },
      });

      return result;
    } catch (error) {
      const appError = error instanceof AppError 
        ? error 
        : new AppError('Risk assessment failed', ErrorCode.UNKNOWN_ERROR, { cause: error as Error });
      logger.error('Risk assessment error', {
        event: 'risk_engine.error',
        error: appError,
      });
      throw appError;
    }
  }

  quickPreCheck(transaction: TransactionInput): { passed: boolean; reason?: string } {
    if (SANCTIONED_COUNTRIES.has(transaction.countryCode)) {
      return { passed: false, reason: `Transaction from sanctioned country: ${transaction.countryCode}` };
    }
    if (transaction.amount <= 0) {
      return { passed: false, reason: 'Invalid transaction amount' };
    }
    if (transaction.timestamp > new Date()) {
      return { passed: false, reason: 'Future transaction timestamp' };
    }
    return { passed: true };
  }

  recordAssessment(
    transactionId: string,
    result: RiskAssessmentResult,
    decision: 'approved' | 'denied' | 'review',
    decisionMaker: 'system' | 'analyst' | 'override' = 'system',
    notes?: string
  ): void {
    const record: RiskHistoryRecord = {
      id: `${transactionId}_${Date.now()}`,
      transactionId,
      customerId: '',
      assessment: { ...result, processingTimeMs: 0 },
      decision,
      decisionMaker,
      notes,
      createdAt: new Date(),
    };

    const existing = this.history.get(transactionId) || [];
    existing.push(record);
    if (existing.length > this.config.maxHistorySize) {
      existing.shift();
    }
    this.history.set(transactionId, existing);

    if (this.config.adaptiveMode && decisionMaker === 'analyst') {
      const newThresholds = adaptFromFeedback(record, {
        highMax: this.thresholds.highMax,
        criticalMin: this.thresholds.criticalMin,
        mediumMax: this.thresholds.mediumMax,
        lowMax: this.thresholds.lowMax,
      });
      this.thresholds = { ...this.thresholds, ...newThresholds };
    }
  }

  getStatistics(): RiskStatistics {
    return { ...this.stats };
  }

  getConfig(): Readonly<RiskEngineConfig> {
    return { ...this.config };
  }

  getThresholds(): Readonly<RiskThresholds> {
    return { ...this.thresholds };
  }

  updateThresholds(updates: Partial<RiskThresholds>): void {
    this.thresholds = { ...this.thresholds, ...updates };
    logger.info('Thresholds updated', { event: 'risk_engine.threshold_update' });
  }

  updateWeights(updates: Partial<RiskFactorWeights>): void {
    this.weights = { ...this.weights, ...updates };
    logger.info('Weights updated', { event: 'risk_engine.weight_update' });
  }

  changeProfile(newProfile: RiskProfile): void {
    this.config.profile = newProfile;
    this.thresholds = { ...DEFAULT_THRESHOLDS[newProfile] };
    this.weights = { ...DEFAULT_WEIGHTS[newProfile] };
    this.assessmentCache.clear();
    logger.info('Risk profile changed', { event: 'risk_engine.profile_change' });
  }

  getTransactionHistory(transactionId: string): RiskHistoryRecord[] {
    return (this.history.get(transactionId) || []).map(r => ({ ...r }));
  }

  clearCache(): void {
    this.assessmentCache.clear();
  }

  resetStatistics(): void {
    this.stats = this.initializeStats();
  }

  // ============== Private Methods ==============

  private validateInputs(
    transaction: TransactionInput,
    customer: CustomerProfile,
    history: TransactionHistory
  ): void {
    if (!transaction.transactionId) {
      throw new AppError('Transaction ID is required', ErrorCode.VALIDATION_ERROR);
    }
    if (!transaction.amount || transaction.amount <= 0) {
      throw new AppError('Valid transaction amount is required', ErrorCode.VALIDATION_ERROR);
    }
    if (!customer.customerId) {
      throw new AppError('Customer ID is required', ErrorCode.VALIDATION_ERROR);
    }
  }

  private calculateCustomerProfileRisk(
    transaction: TransactionInput,
    customer: CustomerProfile
  ): RiskFactorContribution {
    let score = 0;
    const indicators: string[] = [];
    const metadata: Record<string, unknown> = {};

    const accountAgeDays = Math.floor(
      (Date.now() - customer.accountCreatedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (accountAgeDays < 1) {
      score += 30;
      indicators.push('brand_new_account');
    } else if (accountAgeDays < 7) {
      score += 15;
      indicators.push('very_new_account');
    } else if (accountAgeDays < 30) {
      score += 5;
      indicators.push('new_account');
    }
    metadata.accountAgeDays = accountAgeDays;

    switch (customer.tier) {
      case 'enterprise': score -= 10; break;
      case 'premium': score -= 5; break;
      case 'business': score += 5; indicators.push('business_tier'); break;
    }
    metadata.tier = customer.tier;

    score = Math.max(0, Math.min(score, 100));

    return {
      factorId: 'customer_profile_risk',
      factorName: 'Customer Profile Analysis',
      score: Math.round(score),
      maxScore: 100,
      rawValue: { tier: customer.tier, accountAgeDays },
      indicators,
      metadata,
    };
  }

  private calculateCompositeScore(factors: RiskFactorContribution[]): number {
    const weightEntries: Array<[keyof RiskFactorWeights, string]> = [
      ['amountWeight', 'amount_risk'],
      ['velocityWeight', 'velocity_risk'],
      ['deviceWeight', 'device_risk'],
      ['geographicWeight', 'geographic_risk'],
      ['behavioralWeight', 'behavioral_risk'],
      ['historicalWeight', 'historical_risk'],
      ['complianceWeight', 'compliance_risk'],
      ['customerProfileWeight', 'customer_profile_risk'],
    ];

    let compositeScore = 0;
    for (const [weightKey, factorId] of weightEntries) {
      const factor = factors.find(f => f.factorId === factorId);
      if (factor) {
        compositeScore += factor.score * this.weights[weightKey];
      }
    }

    return Math.min(100, Math.max(0, compositeScore));
  }

  private classifyRiskLevel(score: number): RiskLevel {
    if (score <= this.thresholds.lowMax) return RiskLevel.LOW;
    if (score <= this.thresholds.mediumMax) return RiskLevel.MEDIUM;
    if (score <= this.thresholds.highMax) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }

  private calculateConfidence(
    factors: RiskFactorContribution[],
    device?: DeviceIntelligence,
    geoLocation?: GeoLocationData
  ): number {
    let confidence = 70;
    if (device) confidence += 10;
    if (geoLocation) confidence += 10;
    const missingDataFactors = factors.filter(f =>
      f.indicators.includes('no_device_data')
    ).length;
    confidence -= missingDataFactors * 10;
    return Math.min(100, Math.max(0, confidence));
  }

  private generateCacheKey(transaction: TransactionInput): string {
    return `risk:${transaction.transactionId}:${transaction.amount}:${transaction.timestamp.getTime()}`;
  }

  private getCachedAssessment(key: string): RiskAssessmentResult | null {
    const cached = this.assessmentCache.get(key);
    if (cached && cached.expiry > new Date()) return cached.result;
    if (cached) this.assessmentCache.delete(key);
    return null;
  }

  private cacheAssessment(key: string, result: RiskAssessmentResult): void {
    const expiry = new Date(Date.now() + this.config.cacheTTL);
    this.assessmentCache.set(key, { result, expiry });
  }

  private initializeStats(): RiskStatistics {
    return initializeStatistics();
  }

  private updateStatistics(result: RiskAssessmentResult): void {
    updateStatistics(this.stats, result);
  }
}

// ============== Factory Functions ==============

export function createDefaultRiskEngine(): RiskEngine {
  return new RiskEngine({ profile: 'moderate' });
}

export function createConservativeRiskEngine(): RiskEngine {
  return new RiskEngine({ 
    profile: 'conservative',
    enableAML: true,
    enforceKYC: true,
  });
}

export function createAggressiveRiskEngine(): RiskEngine {
  return new RiskEngine({ 
    profile: 'aggressive',
    enableAML: true,
    enforceKYC: false,
  });
}

export function formatRiskScore(score: number): string {
  if (score <= 30) return `🟢 ${score}/100 (Low Risk)`;
  if (score <= 60) return `🟡 ${score}/100 (Medium Risk)`;
  if (score <= 80) return `🟠 ${score}/100 (High Risk)`;
  return `🔴 ${score}/100 (Critical Risk)`;
}

export function getRiskLevelDescription(level: RiskLevel): string {
  const descriptions: Record<RiskLevel, string> = {
    [RiskLevel.LOW]: 'Minimal risk detected. Transaction can proceed normally.',
    [RiskLevel.MEDIUM]: 'Moderate risk indicators present. Additional verification recommended.',
    [RiskLevel.HIGH]: 'Significant risk factors detected. Strong authentication required.',
    [RiskLevel.CRITICAL]: 'Critical risk level. Immediate action required.',
  };
  return descriptions[level];
}

export function getAuthRequirementDescription(req: AuthRequirement): string {
  const descriptions: Record<AuthRequirement, string> = {
    [AuthRequirement.NONE]: 'No additional authentication required.',
    [AuthRequirement.OTP]: 'One-time password verification via SMS or email required.',
    [AuthRequirement.BIOMETRIC]: 'Biometric verification (fingerprint or face) required.',
    [AuthRequirement.STEP_UP]: 'Multi-factor step-up authentication required.',
    [AuthRequirement.MANUAL_REVIEW]: 'Manual review by fraud analyst required before proceeding.',
    [AuthRequirement.BLOCKED]: 'Transaction blocked. No authentication override available.',
  };
  return descriptions[req];
}

// Export singleton instances
export const defaultRiskEngine = createDefaultRiskEngine();
export const conservativeRiskEngine = createConservativeRiskEngine();
export const aggressiveRiskEngine = createAggressiveRiskEngine();

export default RiskEngine;
