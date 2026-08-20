/**
 * @module risk-engine/factors
 * @description Risk factor calculations for SSM-Pay.
 * Implements individual risk factor scoring for comprehensive assessment.
 */

import {
  RiskFactor, RiskCategory, RiskSeverity, FactorAssessment,
  TransactionRiskInput, CustomerRiskInput, RiskConfig, DEFAULT_RISK_CONFIG
} from './types';

/** Amount risk calculation result */
export interface AmountRiskResult { score: number; severity: RiskSeverity; factors: { amountRatio: number; isUnusualSize: boolean; exceedsLimit: boolean; roundNumberFlag: boolean }; }

/** Frequency risk result */
export interface FrequencyRiskResult { score: number; severity: RiskSeverity; factors: { transactionsPerHour: number; transactionsPerDay: number; velocityScore: number; rapidSuccession: boolean }; }

/** Geographic risk result */
export interface GeographicRiskResult { score: number; severity: RiskSeverity; factors: { isHighRiskCountry: boolean; isCrossBorder: boolean; distanceFromUsual: number; countryRiskScore: number }; }

/** Device risk result */
export interface DeviceRiskResult { score: number; severity: RiskSeverity; factors: { isNewDevice: boolean; deviceAgeDays: number; isKnownFingerprint: boolean; deviceReputation: number }; }

/**
 * RiskFactorCalculator class
 * Calculates individual risk factor scores for transaction and customer assessment
 */
export class RiskFactorCalculator {
  private config: RiskConfig;

  constructor(config?: Partial<RiskConfig>) {
    this.config = { ...DEFAULT_RISK_CONFIG, ...config };
  }

  /**
   * Calculate amount-related risk
   */
  calculateAmountRisk(input: TransactionRiskInput, customerAvg?: number): AmountRiskResult & { assessment: FactorAssessment } {
    const { amount } = input;
    let score = 0, isUnusualSize = false, exceedsLimit = false, roundNumberFlag = false;
    let amountRatio = 1;

    if (customerAvg && customerAvg > 0) {
      amountRatio = amount / customerAvg;
      if (amountRatio > 5) { score += 40; isUnusualSize = true; }
      else if (amountRatio > 3) { score += 25; isUnusualSize = true; }
      else if (amountRatio > 2) score += 10;
    }

    if (amount > 100000) { score += 50; exceedsLimit = true; }
    else if (amount > 25000) score += 25;

    // Round number detection (potential structuring)
    if (amount > 10000 && amount % 1000 === 0) { score += 15; roundNumberFlag = true; }
    else if (amount > 5000 && amount % 500 === 0) { score += 5; roundNumberFlag = true; }

    score = Math.min(100, score);
    const severity = this.toSeverity(score);

    return {
      score, severity,
      factors: { amountRatio, isUnusualSize, exceedsLimit, roundNumberFlag },
      assessment: {
        factor: RiskFactor.AMOUNT, category: RiskCategory.FINANCIAL, score,
        weight: this.config.factorWeights[RiskFactor.AMOUNT] ?? 0.20,
        weightedScore: score * (this.config.factorWeights[RiskFactor.AMOUNT] ?? 0.20),
        description: this.amountDesc(amountRatio, isUnusualSize, exceedsLimit), severity,
        details: { amount, amountRatio: amountRatio.toFixed(2), isUnusualSize, exceedsLimit, roundNumberFlag }
      }
    };
  }

  /**
   * Calculate frequency/velocity risk
   */
  calculateFrequencyRisk(recentCount: number, lookbackHours: number = 24): FrequencyRiskResult & { assessment: FactorAssessment } {
    let score = 0;
    const tph = recentCount / lookbackHours;
    const tpd = recentCount / (lookbackHours / 24);
    let velocityScore = 0, rapidSuccession = false;

    if (tph >= 20) { score += 60; velocityScore = 4; rapidSuccession = true; }
    else if (tph >= 10) { score += 40; velocityScore = 3; rapidSuccession = true; }
    else if (tph >= 5) { score += 20; velocityScore = 2; }
    else if (tph >= 2) { score += 5; velocityScore = 1; }

    if (tpd >= 100) score += 30;
    else if (tpd >= 50) score += 15;

    score = Math.min(100, score);
    const severity = this.toSeverity(score);

    return {
      score, severity,
      factors: { transactionsPerHour: Math.round(tph * 100) / 100, transactionsPerDay: Math.round(tpd), velocityScore, rapidSuccession },
      assessment: {
        factor: RiskFactor.FREQUENCY, category: RiskCategory.FRAUD, score,
        weight: this.config.factorWeights[RiskFactor.FREQUENCY] ?? 0.15,
        weightedScore: score * (this.config.factorWeights[RiskFactor.FREQUENCY] ?? 0.15),
        description: `Velocity: ${tph.toFixed(1)}/hour, ${Math.round(tpd)}/day`, severity,
        details: { recentTransactionCount: recentCount, lookbackHours, transactionsPerHour: tph, rapidSuccession }
      }
    };
  }

  /**
   * Calculate geographic/location risk
   */
  calculateGeographicRisk(input: TransactionRiskInput, usualCountries?: string[]): GeographicRiskResult & { assessment: FactorAssessment } {
    let score = 0;
    const origin = input.originCountry ?? 'UNKNOWN';
    const dest = input.destinationCountry ?? 'UNKNOWN';
    const isCrossBorder = origin !== dest && origin !== 'UNKNOWN' && dest !== 'UNKNOWN';

    const HIGH_RISK = new Set(['XX', 'YY', 'ZZ']);
    const MED_RISK = new Set(['AA', 'BB', 'CC']);

    let isHighRiskCountry = HIGH_RISK.has(origin) || HIGH_RISK.has(dest);
    let countryRiskScore = 0;

    if (isHighRiskCountry) { score += 50; countryRiskScore = 80; }
    else if (MED_RISK.has(origin) || MED_RISK.has(dest)) { score += 25; countryRiskScore = 50; }
    if (isCrossBorder) score += 15;

    let distFromUsual = 0;
    if (usualCountries?.length && origin !== 'UNKNOWN' && !usualCountries.includes(origin)) {
      score += 20; distFromUsual = 1;
    }

    score = Math.min(100, score);
    const severity = this.toSeverity(score);

    return {
      score, severity,
      factors: { isHighRiskCountry, isCrossBorder, distanceFromUsual: distFromUsual, countryRiskScore },
      assessment: {
        factor: RiskFactor.GEOGRAPHIC, category: RiskCategory.COMPLIANCE, score,
        weight: this.config.factorWeights[RiskFactor.GEOGRAPHIC] ?? 0.15,
        weightedScore: score * (this.config.factorWeights[RiskFactor.GEOGRAPHIC] ?? 0.15),
        description: `Geographic: ${isCrossBorder ? 'cross-border' : 'domestic'}, ${isHighRiskCountry ? 'high-risk' : 'standard'}`, severity,
        details: { originCountry: origin, destinationCountry: dest, isCrossBorder, isHighRiskCountry, usualCountries: usualCountries ?? [] }
      }
    };
  }

  /**
   * Calculate device-related risk
   */
  calculateDeviceRisk(input: TransactionRiskInput, knownDevices?: Set<string>, deviceFirstSeen?: Date): DeviceRiskResult & { assessment: FactorAssessment } {
    let score = 0;
    const fp = input.deviceFingerprint;
    const isNewDevice = !fp || !knownDevices?.has(fp);
    const isKnownFp = !!fp && knownDevices?.has(fp) ?? false;
    const deviceDays = deviceFirstSeen ? (Date.now() - deviceFirstSeen.getTime()) / 86400000 : Infinity;

    if (isNewDevice) {
      score += fp ? 20 : 35;
      if (deviceDays < 7) score += 15;
    }

    const reputation = isKnownFp ? 90 : isNewDevice ? 50 : 70;
    score = Math.min(100, score);
    const severity = this.toSeverity(score);

    return {
      score, severity,
      factors: { isNewDevice, deviceAgeDays: Math.round(deviceDays), isKnownFingerprint: isKnownFp, deviceReputation: reputation },
      assessment: {
        factor: RiskFactor.DEVICE, category: RiskCategory.FRAUD, score,
        weight: this.config.factorWeights[RiskFactor.DEVICE] ?? 0.10,
        weightedScore: score * (this.config.factorWeights[RiskFactor.DEVICE] ?? 0.10),
        description: `Device: ${isNewDevice ? 'new/unknown' : 'known'}, rep: ${reputation}/100`, severity,
        details: { hasFingerprint: !!fp, isNewDevice, deviceAgeDays: Math.round(deviceDays), isKnownFingerprint: isKnownFp, deviceReputation: reputation }
      }
    };
  }

  /**
   * Calculate customer history risk
   */
  calculateCustomerHistoryRisk(input: CustomerRiskInput): FactorAssessment {
    let score = 0;
    const accountAgeDays = (Date.now() - input.accountCreatedDate.getTime()) / 86400000;

    if (accountAgeDays < 7) score += 25;
    else if (accountAgeDays < 30) score += 10;

    if (input.successRate < 0.8) score += 30;
    else if (input.successRate < 0.9) score += 10;

    if (input.chargebackCount > 5) score += 40;
    else if (input.chargebackCount > 2) score += 20;
    else if (input.chargebackCount > 0) score += 5;

    if (input.totalTransactions === 0) score += 15;
    else if (input.totalTransactions > 1000) score += 10;

    switch (input.verificationStatus) {
      case 'NONE': score += 20; break;
      case 'BASIC': score += 10; break;
      case 'FULL': score -= 10; break;
    }

    score = Math.max(0, Math.min(100, score));
    return {
      factor: RiskFactor.CUSTOMER_HISTORY, category: RiskCategory.FINANCIAL, score,
      weight: this.config.factorWeights[RiskFactor.CUSTOMER_HISTORY] ?? 0.20,
      weightedScore: score * (this.config.factorWeights[RiskFactor.CUSTOMER_HISTORY] ?? 0.20),
      description: `Customer: ${input.totalTransactions} txns, ${(input.successRate * 100).toFixed(1)}% success, ${input.chargebackCount} CBs`,
      severity: this.toSeverity(score),
      details: { accountAgeDays: Math.round(accountAgeDays), totalTransactions: input.totalTransactions, successRate: input.successRate, chargebackCount: input.chargebackCount, verificationStatus: input.verificationStatus }
    };
  }

  updateConfig(config: Partial<RiskConfig>): void { this.config = { ...this.config, config }; }

  private toSeverity(score: number): RiskSeverity {
    if (score >= 80) return RiskSeverity.CRITICAL;
    if (score >= 60) return RiskSeverity.HIGH;
    if (score >= 40) return RiskSeverity.MODERATE;
    if (score >= 20) return RiskSeverity.LOW;
    return RiskSeverity.NEGLIGIBLE;
  }

  private amountDesc(ratio: number, unusual: boolean, exceeds: boolean): string {
    const parts: string[] = [];
    if (exceeds) parts.push('exceeds limits');
    if (unusual) parts.push(`${ratio.toFixed(1)}x average`);
    return parts.length ? `Amount: ${parts.join(', ')}` : 'Amount within normal parameters';
  }
}
