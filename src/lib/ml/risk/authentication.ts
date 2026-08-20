/**
 * Authentication Requirement Determination Functions
 * @module ml/risk/authentication
 * @description Determine authentication requirements based on risk level and factors.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import {
  RiskLevel,
  AuthRequirement,
  RiskFactorContribution,
  CustomerProfile,
  AMLAlert,
  AMLAlertType,
} from './types';

// ============== Auth Requirement Determination ==============

/**
 * Determine authentication requirement based on risk level
 */
export function determineAuthRequirement(
  riskLevel: RiskLevel,
  factors: RiskFactorContribution[],
  customer: CustomerProfile
): AuthRequirement {
  // Critical always blocks
  if (riskLevel === RiskLevel.CRITICAL) {
    return AuthRequirement.BLOCKED;
  }

  // High risk requires strong auth
  if (riskLevel === RiskLevel.HIGH) {
    const hasDeviceRisk = factors
      .find(f => f.factorId === 'device_risk' && f.score > 50);
    
    if (hasDeviceRisk) {
      return AuthRequirement.STEP_UP;
    }
    return AuthRequirement.BIOMETRIC;
  }

  // Medium risk requires OTP
  if (riskLevel === RiskLevel.MEDIUM) {
    const isNewDevice = factors
      .find(f => f.factorId === 'device_risk' && f.indicators.includes('unknown_device'));
    const isNewLocation = factors
      .find(f => f.factorId === 'geographic_risk' && f.indicators.includes('country_mismatch'));
    
    if (isNewDevice || isNewLocation) {
      return AuthRequirement.STEP_UP;
    }
    return AuthRequirement.OTP;
  }

  // Low risk - check KYC for unverified users
  if (customer.kycStatus !== 'verified' && customer.kycStatus !== 'partial') {
    return AuthRequirement.OTP;
  }

  return AuthRequirement.NONE;
}

// ============== Blocking Logic ==============

/**
 * Determine if transaction should be blocked
 */
export function shouldBlockTransaction(
  riskLevel: RiskLevel,
  amlAlerts: AMLAlert[],
  customer: CustomerProfile
): boolean {
  // Critical risk always blocks
  if (riskLevel === RiskLevel.CRITICAL) {
    return true;
  }

  // Sanctions match always blocks
  if (amlAlerts.some(a => a.type === AMLAlertType.SANCTIONS_MATCH)) {
    return true;
  }

  // Suspended account blocks
  if (customer.accountStatus === 'suspended') {
    return true;
  }

  // High severity AML alerts with high risk
  if (riskLevel === RiskLevel.HIGH && amlAlerts.some(a => a.severity >= 4)) {
    return true;
  }

  return false;
}

// ============== Recommendation Generation ==============

/**
 * Generate actionable recommendations based on assessment
 */
export function generateRecommendations(
  riskLevel: RiskLevel,
  factors: RiskFactorContribution[],
  amlAlerts: AMLAlert[]
): string[] {
  const recommendations: string[] = [];

  switch (riskLevel) {
    case RiskLevel.LOW:
      recommendations.push('Transaction approved for processing');
      break;
    case RiskLevel.MEDIUM:
      recommendations.push('Require OTP verification before processing');
      break;
    case RiskLevel.HIGH:
      recommendations.push('Require step-up authentication');
      recommendations.push('Consider setting up transaction monitoring rules');
      break;
    case RiskLevel.CRITICAL:
      recommendations.push('BLOCK transaction immediately');
      recommendations.push('Escalate to fraud operations team');
      break;
  }

  // Specific factor-based recommendations
  const highDeviceRisk = factors.find(f => f.factorId === 'device_risk' && f.score > 60);
  if (highDeviceRisk) {
    recommendations.push('Review device fingerprint - potential fraud tool detected');
  }

  const geoMismatch = factors.find(f => 
      f.factorId === 'geographic_risk' && f.indicators.includes('impossible_travel')
    );
  if (geoMismatch) {
    recommendations.push('Flag for impossible travel investigation');
  }

  // AML-specific recommendations
  if (amlAlerts.some(a => a.sarRecommended)) {
    recommendations.push('Consider filing Suspicious Activity Report (SAR)');
  }

  if (amlAlerts.some(a => a.type === AMLAlertType.STRUCTURING)) {
    recommendations.push('Review for potential structuring violation');
  }

  return recommendations;
}
