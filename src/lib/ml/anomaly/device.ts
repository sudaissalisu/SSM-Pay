/**
 * Device Anomaly Detection Functions
 * @module ml/anomaly/device
 * @description Device fingerprint risk assessment and device-related anomaly detection.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import {
  TransactionData,
  DetectionResult,
  AnomalyCategory,
  AnomalySeverity,
  UserProfile,
  DeviceProfile,
  ThresholdConfig,
} from './types';

// ============== Device Risk Calculation ==============

/**
 * Calculate risk score for a new device
 */
export function calculateDeviceRisk(
  deviceFingerprint: string,
  profile: UserProfile,
  deviceProfile: DeviceProfile | undefined
): number {
  let risk = 30;
  
  if (deviceProfile) {
    if (deviceProfile.isFlagged) {
      risk = 100;
    } else if (deviceProfile.uniqueCustomers > 1) {
      risk += 30;
      risk += (deviceProfile.uniqueCustomers - 1) * 10;
    }
    
    const deviceAge = Date.now() - deviceProfile.firstSeen.getTime();
    const deviceAgeDays = deviceAge / (1000 * 60 * 60 * 24);
    
    if (deviceAgeDays < 1) {
      risk += 20;
    }
  } else {
    risk += 20;
  }
  
  if (profile.accountAgeDays < 30) {
    risk += 15;
  }
  
  if (profile.knownDevices.size >= 3) {
    risk += 10;
  } else if (profile.knownDevices.size >= 2) {
    risk += 5;
  }
  
  return clamp(risk, 0, 100);
}

/**
 * Clamp value between bounds
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============== Device Analysis ==============

/**
 * Run device fingerprint analysis on transaction
 */
export function runDeviceAnalysis(
  transaction: TransactionData,
  profile: UserProfile | undefined,
  deviceProfiles: Map<string, DeviceProfile>,
  thresholds: ThresholdConfig
): DetectionResult[] {
  const results: DetectionResult[] = [];
  
  if (!profile) {
    return results;
  }
  
  const deviceProfile = deviceProfiles.get(transaction.deviceFingerprint);
  
  // New device check
  const isNewDevice = !profile.knownDevices.has(transaction.deviceFingerprint);
  
  if (isNewDevice && profile.knownDevices.size > 0) {
    const deviceRisk = calculateDeviceRisk(transaction.deviceFingerprint, profile, deviceProfile);
    
    if (deviceRisk > thresholds.newDeviceRiskThreshold) {
      results.push({
        isAnomalous: true,
        category: AnomalyCategory.DEVICE,
        severity: deviceRisk > 80 ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM,
        confidence: clamp(deviceRisk / 100, 0, 1),
        score: deviceRisk,
        threshold: thresholds.newDeviceRiskThreshold,
        actualValue: deviceRisk,
        description: 'Transaction from new/high-risk device',
        details: {
          deviceFingerprint: transaction.deviceFingerprint.substring(0, 16) + '...',
          deviceRisk,
          knownDeviceCount: profile.knownDevices.size,
        },
        detectedAt: new Date(),
      });
    }
  }
  
  // Check if device is flagged
  if (deviceProfile?.isFlagged) {
    results.push({
      isAnomalous: true,
      category: AnomalyCategory.DEVICE,
      severity: AnomalySeverity.CRITICAL,
      confidence: 0.99,
      score: 100,
      threshold: 0,
      actualValue: 1,
      description: 'Transaction from flagged/fraudulent device',
      details: {
        deviceFingerprint: transaction.deviceFingerprint.substring(0, 16) + '...',
        flagReason: 'Previously associated with fraudulent activity',
      },
      detectedAt: new Date(),
    });
  }
  
  // Device sharing detection (multiple accounts on same device)
  if (deviceProfile && deviceProfile.uniqueCustomers >= 3) {
    const sharingRatio = deviceProfile.uniqueCustomers / Math.max(deviceProfile.transactionCount, 1);
    
    if (sharingRatio > 0.25) {
      results.push({
        isAnomalous: true,
        category: AnomalyCategory.DEVICE,
        severity: AnomalySeverity.MEDIUM,
        confidence: clamp(sharingRatio, 0, 1),
        score: sharingRatio * 100,
        threshold: 25,
        actualValue: deviceProfile.uniqueCustomers,
        description: `Device shared by ${deviceProfile.uniqueCustomers} different accounts`,
        details: {
          uniqueCustomers: deviceProfile.uniqueCustomers,
          totalTransactions: deviceProfile.transactionCount,
          sharingRatio: sharingRatio.toFixed(2),
        },
        detectedAt: new Date(),
      });
    }
  }
  
  return results;
}
