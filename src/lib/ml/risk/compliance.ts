/**
 * AML/KYC Compliance Check Functions
 * @module ml/risk/compliance
 * @description Anti-Money Laundering checks and KYC verification status assessment.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import {
  TransactionInput,
  TransactionHistory,
  CustomerProfile,
  AMLAlert,
  AMLAlertType,
  RiskFactorContribution,
  KYCStatus,
} from './types';
import {
  HIGH_RISK_COUNTRIES,
  SANCTIONED_COUNTRIES,
  SUSPICIOUS_PATTERNS,
} from './types';

// ============== AML Checks ==============

/**
 * Perform Anti-Money Laundering checks on transaction
 */
export function performAMLChecks(
  transaction: TransactionInput,
  history: TransactionHistory
): AMLAlert[] {
  const alerts: AMLAlert[] = [];
  const now = new Date();

  // Check 1: Large transaction reporting threshold
  const largeTxnThreshold = 1000000; // $10,000 in cents
  if (transaction.amount >= largeTxnThreshold) {
    alerts.push({
      type: AMLAlertType.LARGE_TRANSACTION,
      severity: transaction.amount >= largeTxnThreshold * 2 ? 4 : 3,
      description: `Transaction amount ${transaction.amount / 100} exceeds reporting threshold`,
      threshold: largeTxnThreshold,
      actualValue: transaction.amount,
      sarRecommended: transaction.amount >= largeTxnThreshold * 1.5,
      timestamp: now,
    });
  }

  // Check 2: Structuring detection
  if (history.last24hVolume > SUSPICIOUS_PATTERNS.STRUCTURING_THRESHOLD * 2 &&
      history.last24hCount >= 3) {
    const avg24h = history.last24hVolume / history.last24hCount;
    if (avg24h < SUSPICIOUS_PATTERNS.STRUCTURING_THRESHOLD &&
        history.last24hVolume > SUSPICIOUS_PATTERNS.STRUCTURING_THRESHOLD) {
      alerts.push({
        type: AMLAlertType.STRUCTURING,
        severity: 4,
        description: 'Potential structuring pattern detected - multiple transactions below reporting threshold',
        threshold: SUSPICIOUS_PATTERNS.STRUCTURING_THRESHOLD,
        actualValue: history.last24hVolume,
        sarRecommended: true,
        timestamp: now,
      });
    }
  }

  // Check 3: High-risk country
  if (HIGH_RISK_COUNTRIES.has(transaction.countryCode)) {
    alerts.push({
      type: AMLAlertType.HIGH_RISK_COUNTRY,
      severity: SANCTIONED_COUNTRIES.has(transaction.countryCode) ? 5 : 3,
      description: `Transaction involving high-risk jurisdiction: ${transaction.countryCode}`,
      sarRecommended: SANCTIONED_COUNTRIES.has(transaction.countryCode),
      timestamp: now,
    });
  }

  // Check 4: Velocity breach
  if (history.lastHourCount > SUSPICIOUS_PATTERNS.MAX_VELOCITY_PER_HOUR * 2) {
    alerts.push({
      type: AMLAlertType.VELOCITY_BREACH,
      severity: 3,
      description: `Excessive transaction velocity: ${history.lastHourCount} transactions per hour`,
      threshold: SUSPICIOUS_PATTERNS.MAX_VELOCITY_PER_HOUR * 2,
      actualValue: history.lastHourCount,
      sarRecommended: false,
      timestamp: now,
    });
  }

  // Check 5: Unusual activity pattern
  const volumeRatio = history.last24hVolume / Math.max(history.last7dVolume, 1);
  if (volumeRatio > 0.8 && history.last7dCount > 10) {
    alerts.push({
      type: AMLAlertType.UNUSUAL_ACTIVITY,
      severity: 2,
      description: 'Unusual concentration of transaction volume within 24-hour period',
      actualValue: volumeRatio,
      sarRecommended: false,
      timestamp: now,
    });
  }

  if (alerts.length > 0) {
    logger.info('AML alerts generated', {
      event: 'risk_engine.aml_alert',
      metadata: {
        transactionId: transaction.transactionId,
        alertCount: alerts.length,
        alertTypes: alerts.map(a => a.type),
      },
    });
  }

  return alerts;
}

// ============== Compliance Risk Calculation ==============

/**
 * Calculate compliance/AML risk factors
 */
export function calculateComplianceRisk(
  alerts: AMLAlert[],
  customer: CustomerProfile
): RiskFactorContribution {
  let score = 0;
  const indicators: string[] = [];
  const metadata: Record<string, unknown> = {};

  // Base score on alerts present
  score += alerts.length * 15;
  
  // Severity weighting
  const severitySum = alerts.reduce((sum, a) => sum + a.severity, 0);
  score += severitySum * 5;

  if (alerts.length > 0) {
    indicators.push('aml_alerts_present');
  }
  if (alerts.some(a => a.severity >= 4)) {
    indicators.push('high_severity_alerts');
    score += 20;
  }
  if (alerts.some(a => a.type === AMLAlertType.SANCTIONS_MATCH)) {
    indicators.push('sanctions_alert');
    score += 30;
  }

  // KYC status impact
  switch (customer.kycStatus) {
    case KYCStatus.NONE:
      score += 40;
      indicators.push('no_kyc');
      break;
    case KYCStatus.REJECTED:
      score += 50;
      indicators.push('kyc_rejected');
      break;
    case KYCStatus.PENDING:
      score += 20;
      indicators.push('kyc_pending');
      break;
    case KYCStatus.PARTIAL:
      score += 10;
      indicators.push('partial_kyc');
      break;
    case KYCStatus.VERIFIED:
      break;
  }
  metadata.kycStatus = customer.kycStatus;

  // SAR recommendation check
  const sarRecommended = alerts.some(a => a.sarRecommended);
  if (sarRecommended) {
    indicators.push('sar_recommended');
    score += 15;
  }
  metadata.alertCount = alerts.length;
  metadata.sarRecommended = sarRecommended;

  score = Math.min(score, 100);

  return {
    factorId: 'compliance_risk',
    factorName: 'Compliance & AML Analysis',
    score: Math.round(score),
    maxScore: 100,
    rawValue: { alertCount: alerts.length, kycStatus: customer.kycStatus },
    indicators,
    metadata,
  };
}
