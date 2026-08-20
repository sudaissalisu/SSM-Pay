/**
 * Payment Success Prediction Logic
 * @module ml/predictor/success
 * @description Payment success rate estimation and risk indicator analysis.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import {
  PaymentSuccessParams,
  SuccessPrediction,
  RiskIndicator,
  PaymentRiskLevel,
  PredictionResult,
  TimeSeriesPoint,
  CustomerProfile,
  PaymentMethodType,
  DeviceType,
} from './types';

// ============== Risk Indicator Calculations ==============

/**
 * Calculate amount-based risk indicator
 */
export function calculateAmountRisk(amount: number): RiskIndicator {
  const thresholds = [
    { limit: 10000, risk: 0.05 },
    { limit: 50000, risk: 0.1 },
    { limit: 200000, risk: 0.15 },
    { limit: 500000, risk: 0.25 },
    { limit: 1000000, risk: 0.35 },
    { limit: Infinity, risk: 0.5 },
  ];
  
  const threshold = thresholds.find(t => amount <= t.limit)!;
  const severity = threshold.risk > 0.3 ? 'critical' : threshold.risk > 0.15 ? 'warning' : 'info';
  
  return {
    name: 'amount_risk',
    value: amount,
    riskScore: threshold.risk,
    severity,
    description: `Amount ${formatCurrency(amount)} falls into ${severity} risk tier`,
  };
}

/**
 * Calculate payment method risk
 */
export function calculateMethodRisk(method: PaymentMethodType): RiskIndicator {
  const methodRisks: Record<PaymentMethodType, { risk: number; description: string }> = {
    card: { risk: 0.08, description: 'Card payments have good reliability' },
    bank_transfer: { risk: 0.12, description: 'Bank transfers may have delays' },
    wallet: { risk: 0.06, description: 'Wallet payments are highly reliable' },
    ussd: { risk: 0.18, description: 'USSD has higher failure rates due to network issues' },
    qr_code: { risk: 0.1, description: 'QR code payments are generally reliable' },
    pay_with_bank: { risk: 0.15, description: 'Pay with bank depends on bank availability' },
  };
  
  const { risk, description } = methodRisks[method];
  const severity = risk > 0.15 ? 'warning' : 'info';
  
  return {
    name: 'payment_method_risk',
    value: 0,
    riskScore: risk,
    severity,
    description,
  };
}

/**
 * Calculate time-based risk
 */
export function calculateTimeRisk(hourOfDay: number, dayOfWeek: number): RiskIndicator {
  const isBusinessHours = hourOfDay >= 8 && hourOfDay <= 18;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  let risk = 0.05;
  
  if (!isBusinessHours) risk += 0.08;
  if (isWeekend) risk += 0.05;
  if (hourOfDay >= 0 && hourOfDay < 6) risk += 0.1;
  
  const severity = risk > 0.15 ? 'warning' : 'info';
  
  return {
    name: 'temporal_risk',
    value: hourOfDay,
    riskScore: Math.min(0.4, risk),
    severity,
    description: `Transaction at ${hourOfDay}:00 on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]}`,
  };
}

/**
 * Calculate device-based risk
 */
export function calculateDeviceRisk(deviceType: DeviceType): RiskIndicator {
  const deviceRisks: Record<DeviceType, { risk: number; description: string }> = {
    web_desktop: { risk: 0.05, description: 'Desktop web is stable' },
    web_mobile: { risk: 0.08, description: 'Mobile web may have browser variations' },
    ios_app: { risk: 0.04, description: 'iOS app provides consistent experience' },
    android_app: { risk: 0.06, description: 'Android app is generally reliable' },
    api: { risk: 0.03, description: 'API calls are well-handled' },
    unknown: { risk: 0.12, description: 'Unknown device type adds uncertainty' },
  };
  
  const { risk, description } = deviceRisks[deviceType];
  
  return {
    name: 'device_risk',
    value: 0,
    riskScore: risk,
    severity: risk > 0.08 ? 'warning' : 'info',
    description,
  };
}

/**
 * Calculate all risk indicators for a payment
 */
export function calculateRiskIndicators(
  params: PaymentSuccessParams,
  customerProfiles: Map<string, CustomerProfile>
): RiskIndicator[] {
  const indicators: RiskIndicator[] = [];
  
  // Amount-based risk
  indicators.push(calculateAmountRisk(params.amount));
  
  // Payment method risk
  indicators.push(calculateMethodRisk(params.paymentMethod));
  
  // Customer history risk
  if (params.customerId) {
    const profile = customerProfiles.get(params.customerId);
    if (profile) {
      indicators.push({
        name: 'customer_success_rate',
        value: profile.successRate,
        riskScore: 1 - profile.successRate,
        severity: profile.successRate < 0.8 ? 'warning' : 'info',
        description: `Historical success rate: ${(profile.successRate * 100).toFixed(1)}%`,
      });
      
      indicators.push({
        name: 'customer_recency',
        value: profile.daysSinceLastTransaction,
        riskScore: Math.min(1, profile.daysSinceLastTransaction / 90),
        severity: profile.daysSinceLastTransaction > 60 ? 'warning' : 'info',
        description: `${profile.daysSinceLastTransaction} days since last transaction`,
      });
    } else {
      indicators.push({
        name: 'customer_history',
        value: 0,
        riskScore: 0.2,
        severity: 'info',
        description: 'New customer - limited history',
      });
    }
  }
  
  // Time-based risk
  if (params.hourOfDay !== undefined) {
    indicators.push(calculateTimeRisk(params.hourOfDay, params.dayOfWeek ?? 0));
  }
  
  // Device risk
  if (params.deviceType) {
    indicators.push(calculateDeviceRisk(params.deviceType));
  }
  
  return indicators;
}

// ============== Success Prediction Helpers ==============

/**
 * Calculate base success rate from historical data
 */
export function calculateBaseSuccessRate(
  params: PaymentSuccessParams,
  trainingData: TimeSeriesPoint[]
): number {
  if (trainingData.length === 0) return 0.92;
  
  const totalSuccess = trainingData.reduce((sum, d) => sum + d.successCount, 0);
  const totalTxns = trainingData.reduce((sum, d) => sum + d.count, 0);
  
  return totalTxns > 0 ? totalSuccess / totalTxns : 0.92;
}

/**
 * Calculate cumulative risk adjustment
 */
export function calculateRiskAdjustment(indicators: RiskIndicator[]): number {
  return indicators.reduce((sum, ind) => sum + ind.riskScore * 0.1, 0);
}

/**
 * Classify payment risk level
 */
export function classifyPaymentRisk(probability: number): PaymentRiskLevel {
  if (probability >= 0.95) return 'very_low';
  if (probability >= 0.85) return 'low';
  if (probability >= 0.70) return 'medium';
  if (probability >= 0.50) return 'high';
  return 'very_high';
}

/**
 * Estimate processing time based on parameters
 */
export function estimateProcessingTime(params: PaymentSuccessParams): number {
  const baseTimes: Record<PaymentMethodType, number> = {
    card: 3000,
    bank_transfer: 15000,
    wallet: 2000,
    ussd: 45000,
    qr_code: 4000,
    pay_with_bank: 12000,
  };
  
  let estimatedTime = baseTimes[params.paymentMethod] || 5000;
  
  if (params.amount > 500000) estimatedTime *= 1.3;
  if (params.amount > 1000000) estimatedTime *= 1.5;
  
  estimatedTime *= (0.9 + Math.random() * 0.2);
  
  return Math.round(estimatedTime);
}

/**
 * Generate recommendations to improve success rate
 */
export function generateSuccessRecommendations(
  indicators: RiskIndicator[],
  riskLevel: PaymentRiskLevel
): string[] {
  const recommendations: string[] = [];
  
  for (const indicator of indicators) {
    if (indicator.severity !== 'critical' && indicator.severity !== 'warning') continue;
    
    switch (indicator.name) {
      case 'amount_risk':
        recommendations.push('Consider splitting large transactions');
        recommendations.push('Enable 3D Secure for added verification');
        break;
      case 'payment_method_risk':
        recommendations.push('Offer alternative payment methods at checkout');
        break;
      case 'customer_success_rate':
        recommendations.push('Pre-validate customer payment details');
        break;
      case 'temporal_risk':
        recommendations.push('Consider retry logic for off-hours transactions');
        break;
      case 'device_risk':
        recommendations.push('Ensure proper device fingerprinting');
        break;
    }
  }
  
  if (riskLevel === 'high' || riskLevel === 'very_high') {
    recommendations.push('Implement real-time fraud screening');
    recommendations.push('Prepare manual review workflow');
  }
  
  return [...new Set(recommendations)];
}

/**
 * Calculate confidence in success prediction
 */
export function calculateSuccessConfidence(indicators: RiskIndicator[]): number {
  const avgRisk = indicators.reduce((sum, i) => sum + i.riskScore, 0) / indicators.length;
  return Math.max(0.6, 1 - avgRisk);
}

// ============== Full Success Prediction ==============

/**
 * Perform complete payment success prediction
 */
export function predictPaymentSuccess(
  params: PaymentSuccessParams,
  modelVersion: string,
  trainingData: TimeSeriesPoint[],
  customerProfiles: Map<string, CustomerProfile>
): PredictionResult<SuccessPrediction> {
  const startTime = Date.now();
  
  try {
    const indicators = calculateRiskIndicators(params, customerProfiles);
    const baseSuccessRate = calculateBaseSuccessRate(params, trainingData);
    const riskAdjustment = calculateRiskAdjustment(indicators);
    const successProbability = Math.max(0.05, Math.min(0.99, baseSuccessRate - riskAdjustment));
    const riskAssessment = classifyPaymentRisk(successProbability);
    const estimatedProcessingTime = estimateProcessingTime(params);
    const recommendations = generateSuccessRecommendations(indicators, riskAssessment);
    
    const prediction: SuccessPrediction = {
      successProbability,
      riskAssessment,
      riskIndicators: indicators,
      estimatedProcessingTime,
      recommendations,
    };
    
    const result: PredictionResult<SuccessPrediction> = {
      predictions: prediction,
      modelVersion,
      predictedAt: new Date(),
      confidence: calculateSuccessConfidence(indicators),
      featuresUsed: indicators.map(i => i.name),
      processingTimeMs: Date.now() - startTime,
    };
    
    logger.info('Payment success prediction completed', {
      event: 'ml.predictor.success-complete',
      metadata: {
        successProbability,
        riskAssessment,
        processingTimeMs: result.processingTimeMs,
      },
    });
    
    return result;
  } catch (error) {
    logger.error('Payment success prediction failed', {
      event: 'ml.predictor.success-error',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    throw error instanceof AppError ? error : new AppError(
      'Failed to generate success prediction',
      ErrorCode.UNKNOWN_ERROR,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

// ============== Utility Functions ==============

/**
 * Format currency amount for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}
