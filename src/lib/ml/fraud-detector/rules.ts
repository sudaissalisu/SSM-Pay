/**
 * @module fraud-detector/rules
 * @description Fraud detection rules engine for SSM-Pay.
 * Implements rule-based fraud detection with configurable rules and scoring.
 */

import {
  FraudSignal,
  FraudSignalCategory,
  FraudDetectionInput,
  FraudDetectionConfig,
  CustomerFraudProfile,
  DEFAULT_FRAUD_CONFIG
} from './types';

/** Interface for a fraud detection rule */
export interface FraudRule {
  /** Unique identifier for the rule */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this rule detects */
  description: string;
  /** Category of fraud this rule targets */
  category: FraudSignalCategory;
  /** Default severity (0-100) if triggered */
  defaultSeverity: number;
  /** Whether this rule is enabled by default */
  enabled: boolean;
  /**
   * Evaluate the rule against input data
   * @param input - Transaction input data
   * @param profile - Optional customer profile for context
   * @returns Signal if rule triggered, null otherwise
   */
  evaluate(
    input: FraudDetectionInput,
    profile?: CustomerFraudProfile,
    config?: FraudDetectionConfig
  ): FraudSignal | null;
}

/** Collection of recent transactions for velocity checks */
interface RecentTransaction {
  timestamp: Date;
  amount: number;
}

/**
 * Velocity check rule - detects unusually high transaction frequency
 * Flags when a customer exceeds transaction limits within a time window
 */
export const velocityCheck: FraudRule = {
  id: 'velocity_check',
  name: 'Velocity Check',
  description: 'Detects unusually high transaction frequency within a time window',
  category: FraudSignalCategory.VELOCITY,
  defaultSeverity: 70,
  enabled: true,

  evaluate(
    input: FraudDetectionInput,
    profile?: CustomerFraudProfile,
    config: FraudDetectionConfig = DEFAULT_FRAUD_CONFIG
  ): FraudSignal | null {
    if (!config.enableVelocityCheck) return null;

    // In production, this would query actual recent transactions
    // For now, we use profile data as a proxy
    const recentCount = profile?.totalTransactionCount ?? 0;
    const flaggedRate = profile?.flaggedTransactionCount ?? 0;
    
    // Calculate velocity risk based on historical patterns
    const velocityRatio = flaggedRate / Math.max(recentCount, 1);
    
    if (recentCount > config.maxTransactionsPerHour || velocityRatio > 0.3) {
      return {
        id: `vel_${Date.now()}`,
        name: 'High Transaction Velocity',
        description: `Customer has ${recentCount} recent transactions, exceeding limit of ${config.maxTransactionsPerHour}`,
        severity: velocityRatio > 0.5 ? 90 : this.defaultSeverity,
        category: FraudSignalCategory.VELOCITY,
        timestamp: new Date(),
        metadata: {
          recentCount,
          maxAllowed: config.maxTransactionsPerHour,
          flaggedRate: velocityRatio
        }
      };
    }

    return null;
  }
};

/**
 * Amount anomaly detection rule
 * Flags transactions that deviate significantly from customer's typical amounts
 */
export const amountAnomaly: FraudRule = {
  id: 'amount_anomaly',
  name: 'Amount Anomaly Detection',
  description: 'Detects transactions with unusual amounts compared to customer history',
  category: FraudSignalCategory.AMOUNT,
  defaultSeverity: 65,
  enabled: true,

  evaluate(
    input: FraudDetectionInput,
    profile?: CustomerFraudProfile,
    config: FraudDetectionConfig = DEFAULT_FRAUD_CONFIG
  ): FraudSignal | null {
    if (!config.enableAmountAnomaly || !profile) return null;

    const { amount } = input;
    const { avgTransactionAmount, amountStdDev } = profile;

    // Skip if insufficient data
    if (avgTransactionAmount <= 0 || amountStdDev <= 0) return null;

    // Calculate z-score for the transaction amount
    const zScore = Math.abs(amount - avgTransactionAmount) / amountStdDev;
    
    // Flag if more than 3 standard deviations from mean
    if (zScore > 3) {
      const severity = Math.min(95, Math.round(zScore * 20));
      
      return {
        id: `amt_${Date.now()}`,
        name: 'Unusual Transaction Amount',
        description: `Amount $${amount} is ${zScore.toFixed(1)}x standard deviations from average of $${avgTransactionAmount}`,
        severity,
        category: FraudSignalCategory.AMOUNT,
        timestamp: new Date(),
        metadata: {
          amount,
          avgAmount: avgTransactionAmount,
          stdDev: amountStdDev,
          zScore: zScore.toFixed(2)
        }
      };
    }

    // Also flag absolute threshold breaches
    if (amount > config.maxTransactionAmount) {
      return {
        id: `amt_max_${Date.now()}`,
        name: 'Exceeds Maximum Amount',
        description: `Transaction amount $${amount} exceeds maximum allowed $${config.maxTransactionAmount}`,
        severity: 80,
        category: FraudSignalCategory.AMOUNT,
        timestamp: new Date(),
        metadata: {
          amount,
          maximum: config.maxTransactionAmount
        }
      };
    }

    return null;
  }
};

/**
 * Location mismatch detection rule
 * Flags transactions from unexpected geographic locations
 */
export const locationMismatch: FraudRule = {
  id: 'location_mismatch',
  name: 'Location Mismatch Detection',
  description: 'Detects transactions originating from unusual or mismatched locations',
  category: FraudSignalCategory.LOCATION,
  defaultSeverity: 75,
  enabled: true,

  evaluate(
    input: FraudDetectionInput,
    profile?: CustomerFraudProfile,
    config: FraudDetectionConfig = DEFAULT_FRAUD_CONFIG
  ): FraudSignal | null {
    if (!config.enableLocationCheck) return null;
    if (!input.countryCode && !profile?.typicalCountries.length) return null;

    const transactionCountry = input.countryCode;
    const typicalCountries = profile?.typicalCountries ?? [];

    // Check if country is in typical set
    if (transactionCountry && typicalCountries.length > 0) {
      const isKnownLocation = typicalCountries.includes(transactionCountry);
      
      if (!isKnownLocation) {
        // Check for impossible travel (would need timestamp comparison)
        return {
          id: `loc_${Date.now()}`,
          name: 'Unusual Location',
          description: `Transaction from ${transactionCountry} is outside typical locations: ${typicalCountries.join(', ')}`,
          severity: this.defaultSeverity,
          category: FraudSignalCategory.LOCATION,
          timestamp: new Date(),
          metadata: {
            transactionCountry,
            typicalCountries,
            isNewCountry: true
          }
        };
      }
    }

    // High-risk country check
    const HIGH_RISK_COUNTRIES = ['XX', 'YY']; // Placeholder for actual high-risk list
    if (transactionCountry && HIGH_RISK_COUNTRIES.includes(transactionCountry)) {
      return {
        id: `loc_risk_${Date.now()}`,
        name: 'High-Risk Country',
        description: `Transaction originates from high-risk country: ${transactionCountry}`,
        severity: 85,
        category: FraudSignalCategory.LOCATION,
        timestamp: new Date(),
        metadata: {
          countryCode: transactionCountry,
          riskLevel: 'HIGH'
        }
      };
    }

    return null;
  }
};

/**
 * New device detection rule
 * Flags transactions from unrecognized devices
 */
export const newDeviceFlag: FraudRule = {
  id: 'new_device_flag',
  name: 'New Device Detection',
  description: 'Detects transactions from previously unseen devices',
  category: FraudSignalCategory.DEVICE,
  defaultSeverity: 55,
  enabled: true,

  evaluate(
    input: FraudDetectionInput,
    profile?: CustomerFraudProfile,
    config: FraudDetectionConfig = DEFAULT_FRAUD_CONFIG
  ): FraudSignal | null {
    if (!config.enableDeviceCheck) return null;
    if (!input.deviceFingerprint || !profile?.knownDevices?.length) return null;

    const deviceFingerprint = input.deviceFingerprint;
    const knownDevices = profile.knownDevices;

    const isKnownDevice = knownDevices.some(
      known => known === deviceFingerprint
    );

    if (!isKnownDevice) {
      // Higher severity if account is newer
      const accountAgeDays = profile.accountCreatedDate
        ? (Date.now() - profile.accountCreatedDate.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;

      const adjustedSeverity = accountAgeDays < 30 
        ? Math.min(90, this.defaultSeverity + 20)
        : this.defaultSeverity;

      return {
        id: `dev_${Date.now()}`,
        name: 'New Device Detected',
        description: 'Transaction initiated from an unrecognized device',
        severity: adjustedSeverity,
        category: FraudSignalCategory.DEVICE,
        timestamp: new Date(),
        metadata: {
          deviceFingerprint: deviceFingerprint.substring(0, 8) + '...',
          knownDeviceCount: knownDevices.length,
          accountAgeDays: Math.round(accountAgeDays)
        }
      };
    }

    return null;
  }
};

/** All built-in fraud detection rules */
export const BUILT_IN_RULES: FraudRule[] = [
  velocityCheck,
  amountAnomaly,
  locationMismatch,
  newDeviceFlag
];

/** Result of running the rule engine */
export interface RuleEngineResult {
  /** All signals generated by rules */
  signals: FraudSignal[];
  /** Number of rules evaluated */
  rulesEvaluated: number;
  /** Number of rules that triggered */
  rulesTriggered: number;
  /** Total execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Fraud Rule Engine class
 * Orchestrates evaluation of fraud detection rules against transaction data
 */
export class FraudRuleEngine {
  private rules: FraudRule[];
  private config: FraudDetectionConfig;

  constructor(
    rules: FraudRule[] = BUILT_IN_RULES,
    config: FraudDetectionConfig = DEFAULT_FRAUD_CONFIG
  ) {
    this.rules = rules.filter(r => r.enabled);
    this.config = config;
  }

  /**
   * Add a custom rule to the engine
   */
  addRule(rule: FraudRule): void {
    if (rule.enabled) {
      this.rules.push(rule);
    }
  }

  /**
   * Remove a rule by ID
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FraudDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Evaluate all rules against transaction input
   */
  evaluate(
    input: FraudDetectionInput,
    profile?: CustomerFraudProfile
  ): RuleEngineResult {
    const startTime = performance.now();
    const signals: FraudSignal[] = [];
    let rulesTriggered = 0;

    for (const rule of this.rules) {
      try {
        const signal = rule.evaluate(input, profile, this.config);
        if (signal) {
          signals.push(signal);
          rulesTriggered++;
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }

    return {
      signals,
      rulesEvaluated: this.rules.length,
      rulesTriggered,
      executionTimeMs: performance.now() - startTime
    };
  }

  /**
   * Get currently active rules
   */
  getActiveRules(): FraudRule[] {
    return [...this.rules];
  }

  /**
   * Get current configuration
   */
  getConfig(): FraudDetectionConfig {
    return { ...this.config };
  }
}
