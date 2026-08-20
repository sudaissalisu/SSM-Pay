/**
 * Risk Factor Calculation Functions
 * @module ml/risk/factors
 * @description Individual risk factor calculations for amount, velocity, device, geographic, behavioral, historical, and customer profile risks.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import {
  TransactionInput,
  CustomerProfile,
  TransactionHistory,
  DeviceIntelligence,
  GeoLocationData,
  RiskFactorContribution,
  RiskFactorWeights,
} from './types';
import {
  SUSPICIOUS_PATTERNS,
  HIGH_RISK_MCCS,
} from './types';

// ============== Amount Risk ==============

/**
 * Calculate amount-related risk factors
 */
export function calculateAmountRisk(
  transaction: TransactionInput,
  history: TransactionHistory
): RiskFactorContribution {
  let score = 0;
  const indicators: string[] = [];
  const metadata: Record<string, unknown> = {};

  // Factor 1: Absolute amount risk (logarithmic scale)
  const amountInMajor = transaction.amount / 100;
  if (amountInMajor > 10000) {
    score += 40;
    indicators.push('very_high_amount');
  } else if (amountInMajor > 5000) {
    score += 25;
    indicators.push('high_amount');
  } else if (amountInMajor > 1000) {
    score += 15;
    indicators.push('elevated_amount');
  } else if (amountInMajor > 500) {
    score += 8;
    indicators.push('moderate_amount');
  }
  metadata.amountInMajor = amountInMajor;

  // Factor 2: Deviation from user's average
  if (history.avgAmount30d > 0) {
    const deviation = Math.abs(amountInMajor - history.avgAmount30d / 100) / (history.stdAmount30d / 100 || 1);
    if (deviation > 5) {
      score += 35;
      indicators.push('extreme_deviation');
    } else if (deviation > 3) {
      score += 20;
      indicators.push('high_deviation');
    } else if (deviation > 2) {
      score += 10;
      indicators.push('moderate_deviation');
    }
    metadata.deviation = Math.round(deviation * 100) / 100;
  }

  // Factor 3: Exceeds maximum historical
  if (history.maxAmount30d > 0 && transaction.amount > history.maxAmount30d) {
    score += 15;
    indicators.push('exceeds_historical_max');
    metadata.previousMax = history.maxAmount30d;
  }

  // Factor 4: Round amount detection
  if (amountInMajor > 1000) {
    const roundedToThousand = amountInMajor % 1000 === 0;
    const roundedToHundred = amountInMajor % 100 === 0;
    
    if (roundedToThousand) {
      score += 15;
      indicators.push('round_thousand_amount');
    } else if (roundedToHundred) {
      score += 8;
      indicators.push('round_hundred_amount');
    }
  }

  // Factor 5: Near structuring threshold
  const structuringRange = [900000, 950000, 990000];
  if (structuringRange.some(threshold => 
    Math.abs(transaction.amount - threshold) < 5000
  )) {
    score += 25;
    indicators.push('near_structuring_threshold');
  }

  score = Math.min(score, 100);

  return {
    factorId: 'amount_risk',
    factorName: 'Amount Risk Analysis',
    score,
    maxScore: 100,
    rawValue: { amount: transaction.amount, amountInMajor },
    indicators,
    metadata,
  };
}

// ============== Velocity Risk ==============

/**
 * Calculate velocity/rate-based risk factors
 */
export function calculateVelocityRisk(
  transaction: TransactionInput,
  history: TransactionHistory
): RiskFactorContribution {
  let score = 0;
  const indicators: string[] = [];
  const metadata: Record<string, unknown> = {};

  // Factor 1: Hourly velocity
  if (history.lastHourCount > SUSPICIOUS_PATTERNS.MAX_VELOCITY_PER_HOUR) {
    score += 35;
    indicators.push('excessive_hourly_velocity');
  } else if (history.lastHourCount > SUSPICIOUS_PATTERNS.MAX_VELOCITY_PER_HOUR * 0.6) {
    score += 15;
    indicators.push('elevated_hourly_velocity');
  }
  metadata.hourlyCount = history.lastHourCount;

  // Factor 2: Daily velocity
  if (history.last24hCount > SUSPICIOUS_PATTERNS.MAX_VELOCITY_PER_DAY) {
    score += 35;
    indicators.push('excessive_daily_velocity');
  } else if (history.last24hCount > SUSPICIOUS_PATTERNS.MAX_VELOCITY_PER_DAY * 0.6) {
    score += 15;
    indicators.push('elevated_daily_velocity');
  }
  metadata.dailyCount = history.last24hCount;

  // Factor 3: Failed transaction ratio
  const totalAttempts = history.last24hCount + history.failedTxnCount24h + history.declinedTxnCount24h;
  if (totalAttempts > 5) {
    const failRate = (history.failedTxnCount24h + history.declinedTxnCount24h) / totalAttempts;
    if (failRate > 0.5) {
      score += 25;
      indicators.push('high_failure_rate');
    } else if (failRate > 0.3) {
      score += 12;
      indicators.push('elevated_failure_rate');
    }
    metadata.failureRate = Math.round(failRate * 100) / 100;
  }

  // Factor 4: Rapid successive transactions
  if (history.minutesSinceLastTxn < 1 && history.lastHourCount > 3) {
    score += 20;
    indicators.push('rapid_succession');
  } else if (history.minutesSinceLastTxn < 2 && history.lastHourCount > 5) {
    score += 10;
    indicators.push('quick_succession');
  }
  metadata.minutesSinceLastTxn = history.minutesSinceLastTxn;

  // Factor 5: New recipient ratio
  if (history.last24hCount > 3) {
    const newRecipientRatio = history.newRecipientCount24h / history.last24hCount;
    if (newRecipientRatio > SUSPICIOUS_PATTERNS.NEW_RECIPIENT_RATIO) {
      score += 15;
      indicators.push('many_new_recipients');
    }
    metadata.newRecipientRatio = Math.round(newRecipientRatio * 100) / 100;
  }

  score = Math.min(score, 100);

  return {
    factorId: 'velocity_risk',
    factorName: 'Velocity Analysis',
    score,
    maxScore: 100,
    rawValue: { 
      hourlyCount: history.lastHourCount, 
      dailyCount: history.last24hCount 
    },
    indicators,
    metadata,
  };
}

// ============== Device Risk ==============

/**
 * Calculate device-based risk factors
 */
export function calculateDeviceRisk(
  transaction: TransactionInput,
  device?: DeviceIntelligence
): RiskFactorContribution {
  let score = 0;
  const indicators: string[] = [];
  const metadata: Record<string, unknown> = {};

  if (!device) {
    return {
      factorId: 'device_risk',
      factorName: 'Device Analysis',
      score: 30,
      maxScore: 100,
      rawValue: null,
      indicators: ['no_device_data'],
      metadata: { reason: 'No device intelligence provided' },
    };
  }

  // Factor 1: Known device check
  if (!device.isKnownDevice) {
    score += 25;
    indicators.push('unknown_device');
  }
  metadata.isKnownDevice = device.isKnownDevice;

  // Factor 2: Device trust score
  score += (100 - device.trustScore) * 0.3;
  if (device.trustScore < 30) {
    indicators.push('low_device_trust');
  } else if (device.trustScore < 60) {
    indicators.push('moderate_device_trust');
  }
  metadata.deviceTrustScore = device.trustScore;

  // Factor 3: New device age
  if (device.deviceAgeDays < 1) {
    score += 20;
    indicators.push('brand_new_device');
  } else if (device.deviceAgeDays < 7) {
    score += 10;
    indicators.push('recent_device');
  }
  metadata.deviceAgeDays = device.deviceAgeDays;

  // Factor 4: Emulator detection
  if (device.isEmulator) {
    score += 40;
    indicators.push('emulator_detected');
  }
  metadata.isEmulator = device.isEmulator;

  // Factor 5: Root/jailbreak detection
  if (device.isRooted) {
    score += 35;
    indicators.push('root_detected');
  }
  metadata.isRooted = device.isRooted;

  // Factor 6: VPN/Proxy detection
  if (device.isVpnOrProxy) {
    score += 15;
    indicators.push('vpn_proxy_detected');
  }
  metadata.isVpnOrProxy = device.isVpnOrProxy;

  // Factor 7: Tor network
  if (device.isTor) {
    score += 50;
    indicators.push('tor_network');
  }
  metadata.isTor = device.isTor;

  // Factor 8: Integrity score
  score += (100 - device.integrityScore) * 0.2;
  if (device.integrityScore < 50) {
    indicators.push('low_integrity_score');
  }
  metadata.integrityScore = device.integrityScore;

  score = Math.min(score, 100);

  return {
    factorId: 'device_risk',
    factorName: 'Device Analysis',
    score: Math.round(score),
    maxScore: 100,
    rawValue: device,
    indicators,
    metadata,
  };
}

// ============== Geographic Risk ==============

/**
 * Calculate geographic/location-based risk factors
 */
export function calculateGeographicRisk(
  transaction: TransactionInput,
  geoLocation?: GeoLocationData,
  customer?: CustomerProfile
): RiskFactorContribution {
  let score = 0;
  const indicators: string[] = [];
  const metadata: Record<string, unknown> = {};

  const effectiveGeo: GeoLocationData = geoLocation || {
    countryCode: transaction.countryCode,
    matchesAccountCountry: true,
    isHighRiskCountry: false,
    isSanctionedCountry: false,
    countryRiskScore: 20,
    timezoneConsistent: true,
    connectionType: 'unknown',
  };

  // Factor 1: High-risk country
  if (effectiveGeo.isHighRiskCountry) {
    score += 35;
    indicators.push('high_risk_country');
  }
  metadata.isHighRiskCountry = effectiveGeo.isHighRiskCountry;

  // Factor 2: Sanctioned country
  if (effectiveGeo.isSanctionedCountry) {
    score += 100;
    indicators.push('sanctioned_country');
  }
  metadata.isSanctionedCountry = effectiveGeo.isSanctionedCountry;

  // Factor 3: Country mismatch
  if (!effectiveGeo.matchesAccountCountry) {
    score += 25;
    indicators.push('country_mismatch');
  }
  metadata.matchesAccountCountry = effectiveGeo.matchesAccountCountry;

  // Factor 4: Country risk score
  score += effectiveGeo.countryRiskScore * 0.3;
  metadata.countryRiskScore = effectiveGeo.countryRiskScore;

  // Factor 5: Distance from home location
  if (effectiveGeo.distanceFromHome !== undefined) {
    if (effectiveGeo.distanceFromHome > 5000) {
      score += 25;
      indicators.push('impossible_travel');
    } else if (effectiveGeo.distanceFromHome > 1000) {
      score += 12;
      indicators.push('unusual_location');
    }
    metadata.distanceFromHomeKm = effectiveGeo.distanceFromHome;
  }

  // Factor 6: Timezone inconsistency
  if (!effectiveGeo.timezoneConsistent) {
    score += 15;
    indicators.push('timezone_inconsistent');
  }
  metadata.timezoneConsistent = effectiveGeo.timezoneConsistent;

  // Factor 7: Datacenter connection
  if (effectiveGeo.connectionType === 'datacenter') {
    score += 30;
    indicators.push('datacenter_connection');
  }
  metadata.connectionType = effectiveGeo.connectionType;

  // Factor 8: Cross-border for customer
  if (customer && customer.knownCountries.length > 0) {
    const isNewCountry = !customer.knownCountries.includes(effectiveGeo.countryCode);
    if (isNewCountry) {
      score += 15;
      indicators.push('new_country_for_customer');
    }
    metadata.customerKnownCountries = customer.knownCountries;
  }

  score = Math.min(score, 100);

  return {
    factorId: 'geographic_risk',
    factorName: 'Geographic Analysis',
    score: Math.round(score),
    maxScore: 100,
    rawValue: effectiveGeo,
    indicators,
    metadata,
  };
}

// ============== Behavioral Risk ==============

/**
 * Calculate behavioral/pattern-based risk factors
 */
export function calculateBehavioralRisk(
  transaction: TransactionInput,
  history: TransactionHistory,
  customer: CustomerProfile
): RiskFactorContribution {
  let score = 0;
  const indicators: string[] = [];
  const metadata: Record<string, unknown> = {};

  // Factor 1: Unusual hour large amount
  const hour = transaction.timestamp.getHours();
  if (hour >= 0 && hour < 5 && transaction.amount > 50000) {
    score += 15;
    indicators.push('unusual_hour_large_amount');
  }
  metadata.transactionHour = hour;

  // Factor 2: Weekend/holiday large transaction
  const dayOfWeek = transaction.timestamp.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend && transaction.amount > 100000) {
    score += 10;
    indicators.push('weekend_large_transaction');
  }
  metadata.dayOfWeek = dayOfWeek;

  // Factor 3: Return after silence
  if (history.minutesSinceLastTxn > 1440 && customer.totalTransactions > 10) {
    score += 10;
    indicators.push('return_after_silence');
  } else if (history.minutesSinceLastTxn > 10080) {
    score += 15;
    indicators.push('return_after_long_absence');
  }
  metadata.silenceMinutes = history.minutesSinceLastTxn;

  // Factor 4: Spending pattern break
  if (history.avgAmount30d > 0 && history.last30dCount >= 5) {
    const ratio = (transaction.amount / 100) / (history.avgAmount30d / 100);
    if (ratio > 10) {
      score += 25;
      indicators.push('spending_pattern_break');
    } else if (ratio > 5) {
      score += 12;
      indicators.push('elevated_spending');
    }
    metadata.spendingRatio = Math.round(ratio * 100) / 100;
  }

  // Factor 5: New account rapid activity
  const accountAgeDays = Math.floor(
    (Date.now() - customer.accountCreatedDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (accountAgeDays < 7 && history.last24hCount > 5) {
    score += 25;
    indicators.push('new_account_rapid_activity');
  } else if (accountAgeDays < 30 && history.last24hCount > 20) {
    score += 15;
    indicators.push('young_account_high_activity');
  }
  metadata.accountAgeDays = accountAgeDays;

  // Factor 6: High-risk MCC
  if (transaction.merchantCategoryCode && HIGH_RISK_MCCS.has(transaction.merchantCategoryCode)) {
    score += 20;
    indicators.push('high_risk_mcc');
  }
  metadata.mcc = transaction.merchantCategoryCode;

  // Factor 7: Self-transfer detection
  if (transaction.sourceAccountId === transaction.destinationAccountId) {
    score += 30;
    indicators.push('self_transfer_suspicious');
  }

  score = Math.min(score, 100);

  return {
    factorId: 'behavioral_risk',
    factorName: 'Behavioral Pattern Analysis',
    score: Math.round(score),
    maxScore: 100,
    rawValue: { hour, dayOfWeek, accountAgeDays },
    indicators,
    metadata,
  };
}

// ============== Historical Risk ==============

/**
 * Calculate historical risk factors based on customer's past behavior
 */
export function calculateHistoricalRisk(customer: CustomerProfile): RiskFactorContribution {
  let score = 0;
  const indicators: string[] = [];
  const metadata: Record<string, unknown> = {};

  // Factor 1: Previous risk rating
  score += customer.riskRating * 0.4;
  if (customer.riskRating > 70) {
    indicators.push('high_historical_risk');
  } else if (customer.riskRating > 50) {
    indicators.push('elevated_historical_risk');
  }
  metadata.historicalRiskRating = customer.riskRating;

  // Factor 2: Dispute/chargeback history
  const disputeRate = customer.totalTransactions > 0 
    ? customer.disputeCount / customer.totalTransactions 
    : 0;
  
  if (disputeRate > 0.1) {
    score += 30;
    indicators.push('high_dispute_rate');
  } else if (disputeRate > 0.05) {
    score += 15;
    indicators.push('elevated_dispute_rate');
  }
  metadata.disputeRate = Math.round(disputeRate * 100) / 100;
  metadata.disputeCount = customer.disputeCount;

  // Factor 3: Flagged transaction history
  const flaggedRate = customer.totalTransactions > 0
    ? customer.flaggedCount / customer.totalTransactions
    : 0;
  
  if (flaggedRate > 0.2) {
    score += 25;
    indicators.push('frequently_flagged');
  } else if (flaggedRate > 0.1) {
    score += 12;
    indicators.push('sometimes_flagged');
  }
  metadata.flaggedRate = Math.round(flaggedRate * 100) / 100;
  metadata.flaggedCount = customer.flaggedCount;

  // Factor 4: Account restrictions
  if (customer.accountStatus === 'restricted') {
    score += 40;
    indicators.push('account_restricted');
  } else if (customer.accountStatus === 'under_review') {
    score += 25;
    indicators.push('account_under_review');
  } else if (customer.accountStatus === 'suspended') {
    score += 100;
    indicators.push('account_suspended');
  }
  metadata.accountStatus = customer.accountStatus;

  // Factor 5: Low transaction history
  if (customer.totalTransactions < 5) {
    score += 15;
    indicators.push('limited_history');
  } else if (customer.totalTransactions < 20) {
    score += 5;
    indicators.push('developing_history');
  }
  metadata.totalTransactions = customer.totalTransactions;

  score = Math.min(score, 100);

  return {
    factorId: 'historical_risk',
    factorName: 'Historical Analysis',
    score: Math.round(score),
    maxScore: 100,
    rawValue: customer,
    indicators,
    metadata,
  };
}
