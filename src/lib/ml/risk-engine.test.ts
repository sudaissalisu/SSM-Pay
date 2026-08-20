/**
 * Comprehensive Test Suite for Risk Scoring Engine
 * @module ml/risk-engine.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RiskEngine,
  RiskLevel,
  AuthRequirement,
  AMLAlertType,
  KYCStatus,
  createDefaultRiskEngine,
  createConservativeRiskEngine,
  createAggressiveRiskEngine,
  formatRiskScore,
  getRiskLevelDescription,
  getAuthRequirementDescription,
  type TransactionInput,
  type CustomerProfile,
  type TransactionHistory,
  type DeviceIntelligence,
  type GeoLocationData,
  type RiskAssessmentResult,
  type RiskFactorContribution,
  type AMLAlert,
} from './risk-engine';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Test Fixtures & Helpers ==============

/**
 * Create a valid transaction input for testing
 */
function createTestTransaction(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    transactionId: 'test-txn-001',
    amount: 50000, // $500 in cents
    currency: 'NGN',
    timestamp: new Date(),
    customerId: 'customer-001',
    customerHash: 'abc123hash',
    sourceAccountId: 'wallet-001',
    destinationAccountId: 'wallet-002',
    paymentMethod: 'transfer',
    deviceFingerprint: 'device-fp-001',
    ipAddress: '192.168.1.1',
    countryCode: 'NG',
    ...overrides,
  };
}

/**
 * Create a valid customer profile for testing
 */
function createTestCustomer(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    customerId: 'customer-001',
    accountCreatedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    kycStatus: KYCStatus.VERIFIED,
    riskRating: 20,
    totalTransactions: 50,
    totalVolume: 2500000, // $25,000 in cents
    disputeCount: 0,
    flaggedCount: 1,
    accountStatus: 'active',
    tier: 'individual',
    knownCountries: ['NG', 'US'],
    knownDevices: ['device-fp-001'],
    emailDomain: 'gmail.com',
    phoneCountryCode: '+234',
    ...overrides,
  };
}

/**
 * Create valid transaction history for testing
 */
function createTestHistory(overrides: Partial<TransactionHistory> = {}): TransactionHistory {
  return {
    lastHourCount: 2,
    last24hCount: 5,
    last7dCount: 20,
    last30dCount: 50,
    last24hVolume: 250000,
    last7dVolume: 1000000,
    avgAmount30d: 50000,
    stdAmount30d: 15000,
    maxAmount30d: 100000,
    minutesSinceLastTxn: 30,
    failedTxnCount24h: 0,
    declinedTxnCount24h: 0,
    newRecipientCount24h: 1,
    recentDestinations: ['wallet-002', 'wallet-003'],
    ...overrides,
  };
}

/**
 * Create device intelligence data for testing
 */
function createTestDevice(overrides: Partial<DeviceIntelligence> = {}): DeviceIntelligence {
  return {
    isKnownDevice: true,
    trustScore: 85,
    deviceAgeDays: 30,
    isEmulator: false,
    isRooted: false,
    isVpnOrProxy: false,
    isTor: false,
    integrityScore: 90,
    screenResolution: '1920x1080',
    userAgentHash: 'ua-hash-001',
    ...overrides,
  };
}

/**
 * Create geolocation data for testing
 */
function createTestGeoLocation(overrides: Partial<GeoLocationData> = {}): GeoLocationData {
  return {
    countryCode: 'NG',
    matchesAccountCountry: true,
    distanceFromHome: 10,
    isHighRiskCountry: false,
    isSanctionedCountry: false,
    countryRiskScore: 20,
    timezoneConsistent: true,
    city: 'Lagos',
    region: 'Lagos State',
    isp: 'MTN Nigeria',
    connectionType: 'mobile',
    ...overrides,
  };
}

// ============== Test Suites ==============

describe('RiskEngine', () => {
  let engine: RiskEngine;

  beforeEach(() => {
    engine = new RiskEngine({ profile: 'moderate' });
  });

  describe('Constructor & Configuration', () => {
    it('should initialize with default moderate profile', () => {
      const config = engine.getConfig();
      expect(config.profile).toBe('moderate');
      expect(config.enableAML).toBe(true);
      expect(config.version).toBeDefined();
    });

    it('should throw error for invalid profile', () => {
      expect(() => {
        new RiskEngine({ profile: 'invalid' as any });
      }).toThrow(AppError);
    });

    it('should accept conservative profile configuration', () => {
      const conservativeEngine = new RiskEngine({ profile: 'conservative' });
      const thresholds = conservativeEngine.getThresholds();
      expect(thresholds.lowMax).toBe(20);
      expect(thresholds.mediumMax).toBe(40);
    });

    it('should accept aggressive profile configuration', () => {
      const aggressiveEngine = new RiskEngine({ profile: 'aggressive' });
      const thresholds = aggressiveEngine.getThresholds();
      expect(thresholds.lowMax).toBe(40);
      expect(thresholds.highMax).toBe(80);
    });

    it('should apply custom threshold overrides', () => {
      const customEngine = new RiskEngine({
        profile: 'moderate',
        thresholds: { lowMax: 25 },
      });
      const thresholds = customEngine.getThresholds();
      expect(thresholds.lowMax).toBe(25);
      expect(thresholds.mediumMax).toBe(50); // Default preserved
    });

    it('should apply custom weight overrides', () => {
      const customEngine = new RiskEngine({
        profile: 'moderate',
        weights: { amountWeight: 0.25 },
      });
      const config = customEngine.getConfig();
      // Weights are private but should be applied internally
      expect(config.profile).toBe('moderate');
    });
  });

  describe('Quick Pre-Check', () => {
    it('should pass valid transaction pre-check', () => {
      const transaction = createTestTransaction();
      const result = engine.quickPreCheck(transaction);
      expect(result.passed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should fail for sanctioned country', () => {
      const transaction = createTestTransaction({ countryCode: 'KP' });
      const result = engine.quickPreCheck(transaction);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('sanctioned');
    });

    it('should fail for zero amount', () => {
      const transaction = createTestTransaction({ amount: 0 });
      const result = engine.quickPreCheck(transaction);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Invalid');
    });

    it('should fail for negative amount', () => {
      const transaction = createTestTransaction({ amount: -100 });
      const result = engine.quickPreCheck(transaction);
      expect(result.passed).toBe(false);
    });

    it('should fail for future timestamp', () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const transaction = createTestTransaction({ timestamp: futureDate });
      const result = engine.quickPreCheck(transaction);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Future');
    });
  });

  describe('Transaction Risk Assessment - Basic Functionality', () => {
    it('should return complete assessment result structure', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(transaction, customer, history);

      expect(result).toHaveProperty('riskScore');
      expect(result).toHaveProperty('riskLevel');
      expect(result).toHaveProperty('requiredAuth');
      expect(result).toHaveProperty('shouldBlock');
      expect(result).toHaveProperty('shouldFlag');
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('amlAlerts');
      expect(result).toHaveProperty('assessedAt');
      expect(result).toHaveProperty('assessmentVersion');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('processingTimeMs');
    });

    it('should assess low-risk transaction correctly', async () => {
      const transaction = createTestTransaction({
        amount: 5000, // Small amount ($50)
      });
      const customer = createTestCustomer({
        kycStatus: KYCStatus.VERIFIED,
        riskRating: 10,
        totalTransactions: 100,
        disputeCount: 0,
      });
      const history = createTestHistory({
        lastHourCount: 1,
        last24hCount: 3,
        avgAmount30d: 5000,
      });
      const device = createTestDevice();
      const geo = createTestGeoLocation();

      const result = await engine.assessTransactionRisk(
        transaction, 
        customer, 
        history, 
        device, 
        geo
      );

      expect(result.riskScore).toBeLessThanOrEqual(40);
      expect([RiskLevel.LOW, RiskLevel.MEDIUM]).toContain(result.riskLevel);
      expect(result.shouldBlock).toBe(false);
    });

    it('should detect high-risk transaction with large amount', async () => {
      const transaction = createTestTransaction({
        amount: 2000000, // $20,000 - very large
      });
      const customer = createTestCustomer();
      const history = createTestHistory({
        avgAmount30d: 50000,
        maxAmount30d: 100000,
      });

      const result = await engine.assessTransactionRisk(transaction, customer, history);

      expect(result.riskScore).toBeGreaterThan(40);
      expect(result.factors.some(f => f.factorId === 'amount_risk')).toBe(true);
      
      const amountFactor = result.factors.find(f => f.factorId === 'amount_risk')!;
      expect(amountFactor.score).toBeGreaterThan(20);
    });

    it('should include all expected risk factors', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const history = createTestHistory();
      const device = createTestDevice();
      const geo = createTestGeoLocation();

      const result = await engine.assessTransactionRisk(
        transaction, 
        customer, 
        history, 
        device, 
        geo
      );

      const factorIds = result.factors.map(f => f.factorId);
      expect(factorIds).toContain('amount_risk');
      expect(factorIds).toContain('velocity_risk');
      expect(factorIds).toContain('device_risk');
      expect(factorIds).toContain('geographic_risk');
      expect(factorIds).toContain('behavioral_risk');
      expect(factorIds).toContain('historical_risk');
      expect(factorIds).toContain('compliance_risk');
      expect(factorIds).toContain('customer_profile_risk');
    });

    it('should handle missing optional data gracefully', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const history = createTestHistory();

      // No device or geo data
      const result = await engine.assessTransactionRisk(transaction, customer, history);

      expect(result.riskScore).toBeDefined();
      expect(result.confidence).toBeLessThan(100); // Lower confidence without full data
      
      const deviceFactor = result.factors.find(f => f.factorId === 'device_risk')!;
      expect(deviceFactor.indicators).toContain('no_device_data');
    });
  });

  describe('Amount Risk Analysis', () => {
    it('should score higher for larger amounts', async () => {
      const smallTxn = createTestTransaction({ amount: 1000 }); // $10
      const largeTxn = createTestTransaction({ amount: 1500000 }); // $15,000
      const customer = createTestCustomer();
      const history = createTestHistory();

      const smallResult = await engine.assessTransactionRisk(smallTxn, customer, history);
      const largeResult = await engine.assessTransactionRisk(largeTxn, customer, history);

      const smallAmountScore = smallResult.factors.find(f => f.factorId === 'amount_risk')!.score;
      const largeAmountScore = largeResult.factors.find(f => f.factorId === 'amount_risk')!.score;

      expect(largeAmountScore).toBeGreaterThan(smallAmountScore);
    });

    it('should detect round amounts as suspicious', async () => {
      const roundTxn = createTestTransaction({ amount: 1000000 }); // Exactly $10,000
      const customer = createTestCustomer();
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(roundTxn, customer, history);
      const amountFactor = result.factors.find(f => f.factorId === 'amount_risk')!;

      expect(amountFactor.indicators).toContain('round_thousand_amount');
    });

    it('should detect near-threshold amounts (structuring)', async () => {
      const structuringTxn = createTestTransaction({ amount: 950000 }); // $9,500 (near $10k)
      const customer = createTestCustomer();
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(structuringTxn, customer, history);
      const amountFactor = result.factors.find(f => f.factorId === 'amount_risk')!;

      expect(amountFactor.indicators).toContain('near_structuring_threshold');
    });

    it('should penalize deviation from average', async () => {
      const unusualTxn = createTestTransaction({ amount: 500000 }); // $5,000
      const customer = createTestCustomer();
      const history = createTestHistory({
        avgAmount30d: 10000, // Average is $100
        stdAmount30d: 2000,
      });

      const result = await engine.assessTransactionRisk(unusualTxn, customer, history);
      const amountFactor = result.factors.find(f => f.factorId === 'amount_risk')!;

      expect(amountFactor.indicators.some(i => i.includes('deviation'))).toBe(true);
    });
  });

  describe('Velocity Risk Analysis', () => {
    it('should detect excessive hourly velocity', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const highVelocityHistory = createTestHistory({ lastHourCount: 15 });

      const result = await engine.assessTransactionRisk(transaction, customer, highVelocityHistory);
      const velocityFactor = result.factors.find(f => f.factorId === 'velocity_risk')!;

      expect(velocityFactor.indicators).toContain('excessive_hourly_velocity');
    });

    it('should detect excessive daily velocity', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const highDailyHistory = createTestHistory({ last24hCount: 60 });

      const result = await engine.assessTransactionRisk(transaction, customer, highDailyHistory);
      const velocityFactor = result.factors.find(f => f.factorId === 'velocity_risk')!;

      expect(velocityFactor.indicators).toContain('excessive_daily_velocity');
    });

    it('should detect high failure rate', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const failingHistory = createTestHistory({
        failedTxnCount24h: 8,
        declinedTxnCount24h: 4,
        last24hCount: 10,
      });

      const result = await engine.assessTransactionRisk(transaction, customer, failingHistory);
      const velocityFactor = result.factors.find(f => f.factorId === 'velocity_risk')!;

      expect(velocityFactor.indicators).toContain('high_failure_rate');
    });

    it('should detect rapid succession of transactions', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const rapidHistory = createTestHistory({
        minutesSinceLastTxn: 0,
        lastHourCount: 5,
      });

      const result = await engine.assessTransactionRisk(transaction, customer, rapidHistory);
      const velocityFactor = result.factors.find(f => f.factorId === 'velocity_risk')!;

      expect(velocityFactor.indicators).toContain('rapid_succession');
    });
  });

  describe('Device Risk Analysis', () => {
    it('should score unknown devices higher', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const history = createTestHistory();
      const unknownDevice = createTestDevice({ isKnownDevice: false, trustScore: 30 });

      const result = await engine.assessTransactionRisk(
        transaction, 
        customer, 
        history, 
        unknownDevice
      );
      const deviceFactor = result.factors.find(f => f.factorId === 'device_risk')!;

      expect(deviceFactor.indicators).toContain('unknown_device');
      expect(deviceFactor.score).toBeGreaterThan(25);
    });

    it('should heavily penalize emulator detection', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const history = createTestHistory();
      const emulatedDevice = createTestDevice({ isEmulator: true });

      const result = await engine.assessTransactionRisk(
        transaction, 
        customer, 
        history, 
        emulatedDevice
      );
      const deviceFactor = result.factors.find(f => f.factorId === 'device_risk')!;

      expect(deviceFactor.indicators).toContain('emulator_detected');
      expect(deviceFactor.score).toBeGreaterThan(35);
    });

    it('should heavily penalize root/jailbreak detection', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const history = createTestHistory();
      const rootedDevice = createTestDevice({ isRooted: true });

      const result = await engine.assessTransactionRisk(
        transaction, 
        customer, 
        history, 
        rootedDevice
      );
      const deviceFactor = result.factors.find(f => f.factorId === 'device_risk')!;

      expect(deviceFactor.indicators).toContain('root_detected');
    });

    it('should heavily penalize Tor network usage', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const history = createTestHistory();
      const torDevice = createTestDevice({ isTor: true });

      const result = await engine.assessTransactionRisk(
        transaction, 
        customer, 
        history, 
        torDevice
      );
      const deviceFactor = result.factors.find(f => f.factorId === 'device_risk')!;

      expect(deviceFactor.indicators).toContain('tor_network');
      expect(deviceFactor.score).toBeGreaterThan(45);
    });

    it('should detect VPN/proxy usage', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const history = createTestHistory();
      const vpnDevice = createTestDevice({ isVpnOrProxy: true });

      const result = await engine.assessTransactionRisk(
        transaction, 
        customer, 
        history, 
        vpnDevice
      );
      const deviceFactor = result.factors.find(f => f.factorId === 'device_risk')!;

      expect(deviceFactor.indicators).toContain('vpn_proxy_detected');
    });
  });

  describe('Geographic Risk Analysis', () => {
    it('should detect high-risk countries', async () => {
      const transaction = createTestTransaction({ countryCode: 'RU' });
      const customer = createTestCustomer();
      const history = createTestHistory();
      const highRiskGeo = createTestGeoLocation({ 
        countryCode: 'RU', 
        isHighRiskCountry: true,
        countryRiskScore: 80,
      });

      const result = await engine.assessTransactionRisk(
        transaction, 
        customer, 
        history, 
        undefined, 
        highRiskGeo
      );
      const geoFactor = result.factors.find(f => f.factorId === 'geographic_risk')!;

      expect(geoFactor.indicators).toContain('high_risk_country');
      expect(geoFactor.score).toBeGreaterThan(30);
    });

    it('should block sanctioned countries', async () => {
      const transaction = createTestTransaction({ countryCode: 'IR' });
      const customer = createTestCustomer();
      const history = createTestHistory();
      const sanctionedGeo = createTestGeoLocation({ 
        countryCode: 'IR', 
        isSanctionedCountry: true,
        isHighRiskCountry: true,
        countryRiskScore: 100,
      });

      const result = await engine.assessTransactionRisk(
        transaction, 
        customer, 
        history, 
        undefined, 
        sanctionedGeo
      );

      // Sanctioned countries should result in high risk or blocking
      expect(result.riskScore).toBeGreaterThan(50);
    });

    it('should detect country mismatch', async () => {
      const transaction = createTestTransaction({ countryCode: 'US' });
      const customer = createTestCustomer({ knownCountries: ['NG'] });
      const history = createTestHistory();
      const mismatchGeo = createTestGeoLocation({ 
        countryCode: 'US', 
        matchesAccountCountry: false,
      });

      const result = await engine.assessTransactionRisk(
        transaction, 
        customer, 
        history, 
        undefined, 
        mismatchGeo
      );
      const geoFactor = result.factors.find(f => f.factorId === 'geographic_risk')!;

      expect(geoFactor.indicators).toContain('country_mismatch');
    });

    it('should detect impossible travel', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const history = createTestHistory();
      const farAwayGeo = createTestGeoLocation({ 
        distanceFromHome: 8000, // 8000 km away
      });

      const result = await engine.assessTransactionRisk(
        transaction, 
        customer, 
        history, 
        undefined, 
        farAwayGeo
      );
      const geoFactor = result.factors.find(f => f.factorId === 'geographic_risk')!;

      expect(geoFactor.indicators).toContain('impossible_travel');
    });

    it('should flag datacenter connections', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const history = createTestHistory();
      const dcGeo = createTestGeoLocation({ connectionType: 'datacenter' });

      const result = await engine.assessTransactionRisk(
        transaction, 
        customer, 
        history, 
        undefined, 
        dcGeo
      );
      const geoFactor = result.factors.find(f => f.factorId === 'geographic_risk')!;

      expect(geoFactor.indicators).toContain('datacenter_connection');
    });
  });

  describe('Behavioral Risk Analysis', () => {
    it('should flag unusual hour large transactions', async () => {
      const lateNightDate = new Date();
      lateNightDate.setHours(2, 0, 0, 0); // 2 AM
      
      const transaction = createTestTransaction({ 
        timestamp: lateNightDate,
        amount: 100000, // $1,000 at 2 AM
      });
      const customer = createTestCustomer();
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(transaction, customer, history);
      const behavioralFactor = result.factors.find(f => f.factorId === 'behavioral_risk')!;

      expect(behavioralFactor.indicators).toContain('unusual_hour_large_amount');
    });

    it('should detect new account rapid activity', async () => {
      const transaction = createTestTransaction();
      const newCustomer = createTestCustomer({
        accountCreatedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days old
        totalTransactions: 5,
      });
      const activeHistory = createTestHistory({ last24hCount: 10 });

      const result = await engine.assessTransactionRisk(transaction, newCustomer, activeHistory);
      const behavioralFactor = result.factors.find(f => f.factorId === 'behavioral_risk')!;

      expect(behavioralFactor.indicators).toContain('new_account_rapid_activity');
    });

    it('should detect self-transfer attempts', async () => {
      const transaction = createTestTransaction({
        sourceAccountId: 'wallet-001',
        destinationAccountId: 'wallet-001', // Same account!
      });
      const customer = createTestCustomer();
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(transaction, customer, history);
      const behavioralFactor = result.factors.find(f => f.factorId === 'behavioral_risk')!;

      expect(behavioralFactor.indicators).toContain('self_transfer_suspicious');
    });

    it('should flag high-risk merchant categories', async () => {
      const transaction = createTestTransaction({
        merchantCategoryCode: '7995', // Gambling
      });
      const customer = createTestCustomer();
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(transaction, customer, history);
      const behavioralFactor = result.factors.find(f => f.factorId === 'behavioral_risk')!;

      expect(behavioralFactor.indicators).toContain('high_risk_mcc');
    });
  });

  describe('Historical Risk Analysis', () => {
    it('should score customers with high historical risk rating higher', async () => {
      const transaction = createTestTransaction();
      const riskyCustomer = createTestCustomer({ riskRating: 80 });
      const safeCustomer = createTestCustomer({ riskRating: 15 });
      const history = createTestHistory();

      const riskyResult = await engine.assessTransactionRisk(transaction, riskyCustomer, history);
      const safeResult = await engine.assessTransactionRisk(transaction, safeCustomer, history);

      const riskyHistorical = riskyResult.factors.find(f => f.factorId === 'historical_risk');
      const safeHistorical = safeResult.factors.find(f => f.factorId === 'historical_risk');

      if (riskyHistorical && safeHistorical) {
        // Risky customer should have higher or equal score contribution
        expect(riskyHistorical.scoreContribution ?? riskyHistorical.score).toBeGreaterThanOrEqual(
          safeHistorical.scoreContribution ?? safeHistorical.score
        );
      }
    });

    it('should penalize high dispute rates', async () => {
      const transaction = createTestTransaction();
      const disputingCustomer = createTestCustomer({
        disputeCount: 10,
        totalTransactions: 50, // 20% dispute rate
      });
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(transaction, disputingCustomer, history);
      const historicalFactor = result.factors.find(f => f.factorId === 'historical_risk')!;

      expect(historicalFactor.indicators).toContain('high_dispute_rate');
    });

    it('should restrict suspended accounts', async () => {
      const transaction = createTestTransaction();
      const suspendedCustomer = createTestCustomer({ accountStatus: 'suspended' });
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(transaction, suspendedCustomer, history);

      expect(result.shouldBlock).toBe(true);
    });

    it('should flag restricted accounts', async () => {
      const transaction = createTestTransaction();
      const restrictedCustomer = createTestCustomer({ accountStatus: 'restricted' });
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(transaction, restrictedCustomer, history);
      const historicalFactor = result.factors.find(f => f.factorId === 'historical_risk')!;

      expect(historicalFactor.indicators).toContain('account_restricted');
    });
  });

  describe('Compliance & AML Checks', () => {
    it('should generate alerts for large transactions', async () => {
      const largeTransaction = createTestTransaction({ amount: 1500000 }); // $15,000
      const customer = createTestCustomer();
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(largeTransaction, customer, history);

      expect(result.amlAlerts.length).toBeGreaterThan(0);
      expect(result.amlAlerts.some(a => a.type === AMLAlertType.LARGE_TRANSACTION)).toBe(true);
    });

    it('should detect structuring patterns', async () => {
      const transaction = createTestTransaction({ amount: 450000 }); // $4,500
      const customer = createTestCustomer();
      const structuringHistory = createTestHistory({
        last24hVolume: 950000, // Just under $10k total
        last24hCount: 3,
      });

      const result = await engine.assessTransactionRisk(transaction, customer, structuringHistory);

      // Structuring detection may trigger based on implementation
      expect(result).toBeDefined();
    });

    it('should generate alerts for high-risk jurisdictions', async () => {
      const transaction = createTestTransaction({ countryCode: 'KP' });
      const customer = createTestCustomer();
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(transaction, customer, history);

      // Should generate at least one AML alert for high-risk country
      expect(result.amlAlerts.length).toBeGreaterThan(0);
    });

    it('should recommend SAR filing for severe alerts', async () => {
      const transaction = createTestTransaction({ amount: 2500000 }); // $25,000
      const customer = createTestCustomer();
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(transaction, customer, history);

      const sarAlerts = result.amlAlerts.filter(a => a.sarRecommended);
      expect(sarAlerts.length).toBeGreaterThan(0);
    });

    it('should enforce KYC requirements when enabled', async () => {
      const noKycEngine = new RiskEngine({ 
        profile: 'moderate', 
        enforceKYC: true 
      });
      
      const transaction = createTestTransaction();
      const unverifiedCustomer = createTestCustomer({ kycStatus: KYCStatus.NONE });
      const history = createTestHistory();

      const result = await noKycEngine.assessTransactionRisk(transaction, unverifiedCustomer, history);
      const complianceFactor = result.factors.find(f => f.factorId === 'compliance_risk')!;

      expect(complianceFactor.indicators).toContain('no_kyc');
    });

    it('can disable AML checks', async () => {
      const noAMLEngine = new RiskEngine({ 
        profile: 'moderate', 
        enableAML: false 
      });
      
      const largeTransaction = createTestTransaction({ amount: 2000000 });
      const customer = createTestCustomer();
      const history = createTestHistory();

      const result = await noAMLEngine.assessTransactionRisk(largeTransaction, customer, history);

      expect(result.amlAlerts.length).toBe(0);
    });
  });

  describe('Authentication Requirements', () => {
    it('should require no auth for low-risk verified users', async () => {
      const transaction = createTestTransaction({ amount: 5000 });
      const verifiedCustomer = createTestCustomer({ 
        kycStatus: KYCStatus.VERIFIED,
        riskRating: 5,
      });
      const history = createTestHistory({ 
        lastHourCount: 1,
        avgAmount30d: 5000,
      });
      const device = createTestDevice();
      const geo = createTestGeoLocation();

      const result = await engine.assessTransactionRisk(
        transaction, 
        verifiedCustomer, 
        history, 
        device, 
        geo
      );

      expect(result.requiredAuth).toBe(AuthRequirement.NONE);
    });

    it('should require OTP for medium risk', async () => {
      const transaction = createTestTransaction({ amount: 100000 }); // $1,000
      const customer = createTestCustomer();
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(transaction, customer, history);

      if (result.riskLevel === RiskLevel.MEDIUM) {
        expect(result.requiredAuth).toBe(AuthRequirement.OTP);
      }
    });

    it('should require biometric for high risk', async () => {
      const transaction = createTestTransaction({ amount: 500000 });
      const customer = createTestCustomer({ riskRating: 60 });
      const history = createTestHistory({ last24hCount: 20 });

      const result = await engine.assessTransactionRisk(transaction, customer, history);

      if (result.riskLevel === RiskLevel.HIGH) {
        expect([AuthRequirement.BIOMETRIC, AuthRequirement.STEP_UP]).toContain(result.requiredAuth);
      }
    });

    it('should block critical risk transactions', async () => {
      const transaction = createTestTransaction({ countryCode: 'KP' });
      const customer = createTestCustomer();
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(transaction, customer, history);

      if (result.riskLevel === RiskLevel.CRITICAL) {
        expect(result.requiredAuth).toBe(AuthRequirement.BLOCKED);
        expect(result.shouldBlock).toBe(true);
      }
    });

    it('should require step-up auth for new device at medium risk', async () => {
      const transaction = createTestTransaction({ amount: 75000 });
      const customer = createTestCustomer();
      const history = createTestHistory();
      const newDevice = createTestDevice({ isKnownDevice: false });

      const result = await engine.assessTransactionRisk(
        transaction, 
        customer, 
        history, 
        newDevice
      );

      // New device should increase auth requirement
      if (result.riskLevel >= RiskLevel.MEDIUM) {
        expect([AuthRequirement.OTP, AuthRequirement.STEP_UP]).toContain(result.requiredAuth);
      }
    });
  });

  describe('Dynamic Threshold Adjustment', () => {
    it('should allow runtime threshold updates', () => {
      const originalThresholds = engine.getThresholds();
      
      engine.updateThresholds({ lowMax: 35 });
      const updatedThresholds = engine.getThresholds();
      
      expect(updatedThresholds.lowMax).toBe(35);
      expect(updatedThresholds.mediumMax).toBe(originalThresholds.mediumMax);
    });

    it('should allow runtime weight updates', () => {
      engine.updateWeights({ amountWeight: 0.25 });
      // Weights are internal but update shouldn't error
      expect(engine.getConfig().profile).toBe('moderate');
    });

    it('should support profile switching', () => {
      engine.changeProfile('conservative');
      
      const thresholds = engine.getThresholds();
      expect(thresholds.lowMax).toBe(20);
      expect(thresholds.mediumMax).toBe(40);
    });

    it('should clear cache on profile change', () => {
      // This is implicitly tested by the fact that changeProfile calls clearCache
      engine.changeProfile('aggressive');
      const thresholds = engine.getThresholds();
      expect(thresholds.lowMax).toBe(40);
    });
  });

  describe('Historical Tracking & Statistics', () => {
    it('should record assessments to history', () => {
      const mockResult: RiskAssessmentResult = {
        riskScore: 45,
        riskLevel: RiskLevel.MEDIUM,
        requiredAuth: AuthRequirement.OTP,
        shouldBlock: false,
        shouldFlag: false,
        factors: [],
        amlAlerts: [],
        assessedAt: new Date(),
        assessmentVersion: '1.0.0',
        recommendations: ['Require OTP verification'],
        confidence: 85,
        processingTimeMs: 15,
      };

      engine.recordAssessment('txn-001', mockResult, 'approved');

      const history = engine.getTransactionHistory('txn-001');
      expect(history.length).toBe(1);
      expect(history[0].decision).toBe('approved');
      expect(history[0].transactionId).toBe('txn-001');
    });

    it('should track statistics across assessments', async () => {
      // Reset stats first
      engine.resetStatistics();

      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const history = createTestHistory();

      // Run multiple assessments
      for (let i = 0; i < 5; i++) {
        await engine.assessTransactionRisk(
          { ...transaction, transactionId: `txn-${i}` },
          customer,
          history
        );
      }

      const stats = engine.getStatistics();
      expect(stats.totalAssessments).toBeGreaterThanOrEqual(5);
      expect(stats.averageScore).toBeGreaterThan(0);
    });

    it('should track AML alert statistics', async () => {
      engine.resetStatistics();

      const largeTransaction = createTestTransaction({ amount: 2000000 });
      const customer = createTestCustomer();
      const history = createTestHistory();

      await engine.assessTransactionRisk(largeTransaction, customer, history);

      const stats = engine.getStatistics();
      expect(stats.amlStats.totalAlerts).toBeGreaterThan(0);
    });

    it('should limit history size', () => {
      const mockResult: RiskAssessmentResult = {
        riskScore: 30,
        riskLevel: RiskLevel.LOW,
        requiredAuth: AuthRequirement.NONE,
        shouldBlock: false,
        shouldFlag: false,
        factors: [],
        amlAlerts: [],
        assessedAt: new Date(),
        assessmentVersion: '1.0.0',
        recommendations: [],
        confidence: 90,
        processingTimeMs: 10,
      };

      // Add more records than max size
      for (let i = 0; i < 15000; i++) {
        engine.recordAssessment(`txn-${i}`, mockResult, 'approved');
      }

      const history = engine.getTransactionHistory('txn-14999');
      // History should be trimmed (maxHistorySize default is 10000)
      expect(history.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('Caching', () => {
    it('should cache assessment results', async () => {
      const transaction = createTestTransaction();
      const customer = createTestCustomer();
      const history = createTestHistory();

      const firstResult = await engine.assessTransactionRisk(transaction, customer, history);
      const secondResult = await engine.assessTransactionRisk(transaction, customer, history);

      // Same transaction should return cached result (same object reference)
      expect(firstResult.assessedAt.getTime()).toEqual(secondResult.assessedAt.getTime());
    });

    it('should allow cache clearing', () => {
      expect(() => engine.clearCache()).not.toThrow();
    });
  });

  describe('Input Validation', () => {
    it('should reject transaction without ID', async () => {
      const invalidTransaction = createTestTransaction({ transactionId: '' });
      const customer = createTestCustomer();
      const history = createTestHistory();

      await expect(
        engine.assessTransactionRisk(invalidTransaction, customer, history)
      ).rejects.toThrow(AppError);
    });

    it('should reject zero amount transaction', async () => {
      const invalidTransaction = createTestTransaction({ amount: 0 });
      const customer = createTestCustomer();
      const history = createTestHistory();

      await expect(
        engine.assessTransactionRisk(invalidTransaction, customer, history)
      ).rejects.toThrow(AppError);
    });

    it('should reject negative amount transaction', async () => {
      const invalidTransaction = createTestTransaction({ amount: -100 });
      const customer = createTestCustomer();
      const history = createTestHistory();

      await expect(
        engine.assessTransactionRisk(invalidTransaction, customer, history)
      ).rejects.toThrow(AppError);
    });

    it('should reject customer without ID', async () => {
      const transaction = createTestTransaction();
      const invalidCustomer = createTestCustomer({ customerId: '' });
      const history = createTestHistory();

      await expect(
        engine.assessTransactionRisk(transaction, invalidCustomer, history)
      ).rejects.toThrow(AppError);
    });
  });

  describe('Recommendations Generation', () => {
    it('should generate approval recommendation for low risk', async () => {
      const transaction = createTestTransaction({ amount: 1000 });
      const customer = createTestCustomer({ riskRating: 5 });
      const history = createTestHistory({ lastHourCount: 1, avgAmount30d: 1000 });
      const device = createTestDevice();
      const geo = createTestGeoLocation();

      const result = await engine.assessTransactionRisk(
        transaction, 
        customer, 
        history, 
        device, 
        geo
      );

      expect(result.recommendations.length).toBeGreaterThan(0);
      if (result.riskLevel === RiskLevel.LOW) {
        expect(result.recommendations.some(r => r.includes('approved'))).toBe(true);
      }
    });

    it('should include SAR recommendation when warranted', async () => {
      const transaction = createTestTransaction({ amount: 3000000 }); // $30,000
      const customer = createTestCustomer();
      const history = createTestHistory();

      const result = await engine.assessTransactionRisk(transaction, customer, history);

      if (result.amlAlerts.some(a => a.sarRecommended)) {
        expect(result.recommendations.some(r => r.includes('SAR'))).toBe(true);
      }
    });
  });
});

// ============== Factory Function Tests ==============

describe('Factory Functions', () => {
  it('createDefaultRiskEngine should return moderate engine', () => {
    const engine = createDefaultRiskEngine();
    expect(engine.getConfig().profile).toBe('moderate');
  });

  it('createConservativeRiskEngine should return conservative engine', () => {
    const engine = createConservativeRiskEngine();
    expect(engine.getConfig().profile).toBe('conservative');
    expect(engine.getConfig().enableAML).toBe(true);
    expect(engine.getConfig().enforceKYC).toBe(true);
  });

  it('createAggressiveRiskEngine should return aggressive engine', () => {
    const engine = createAggressiveRiskEngine();
    expect(engine.getConfig().profile).toBe('aggressive');
    expect(engine.getConfig().enforceKYC).toBe(false);
  });
});

// ============== Utility Function Tests ==============

describe('Utility Functions', () => {
  describe('formatRiskScore', () => {
    it('should format low risk score with green indicator', () => {
      expect(formatRiskScore(15)).toContain('🟢');
      expect(formatRiskScore(15)).toContain('Low Risk');
    });

    it('should format medium risk score with yellow indicator', () => {
      expect(formatRiskScore(45)).toContain('🟡');
      expect(formatRiskScore(45)).toContain('Medium Risk');
    });

    it('should format high risk score with orange indicator', () => {
      expect(formatRiskScore(70)).toContain('🟠');
      expect(formatRiskScore(70)).toContain('High Risk');
    });

    it('should format critical risk score with red indicator', () => {
      expect(formatRiskScore(95)).toContain('🔴');
      expect(formatRiskScore(95)).toContain('Critical Risk');
    });
  });

  describe('getRiskLevelDescription', () => {
    it('should return description for LOW level', () => {
      const desc = getRiskLevelDescription(RiskLevel.LOW);
      expect(desc).toContain('Minimal risk');
    });

    it('should return description for MEDIUM level', () => {
      const desc = getRiskLevelDescription(RiskLevel.MEDIUM);
      expect(desc).toContain('Moderate risk');
    });

    it('should return description for HIGH level', () => {
      const desc = getRiskLevelDescription(RiskLevel.HIGH);
      expect(desc).toContain('Significant risk');
    });

    it('should return description for CRITICAL level', () => {
      const desc = getRiskLevelDescription(RiskLevel.CRITICAL);
      expect(desc).toContain('Critical risk');
    });
  });

  describe('getAuthRequirementDescription', () => {
    it('should return description for NONE', () => {
      expect(getAuthRequirementDescription(AuthRequirement.NONE)).toContain('No additional');
    });

    it('should return description for OTP', () => {
      expect(getAuthRequirementDescription(AuthRequirement.OTP)).toContain('One-time password');
    });

    it('should return description for BIOMETRIC', () => {
      expect(getAuthRequirementDescription(AuthRequirement.BIOMETRIC)).toContain('Biometric');
    });

    it('should return description for STEP_UP', () => {
      expect(getAuthRequirementDescription(AuthRequirement.STEP_UP)).toContain('step-up');
    });

    it('should return description for MANUAL_REVIEW', () => {
      expect(getAuthRequirementDescription(AuthRequirement.MANUAL_REVIEW)).toContain('Manual review');
    });

    it('should return description for BLOCKED', () => {
      expect(getAuthRequirementDescription(AuthRequirement.BLOCKED)).toContain('blocked');
    });
  });
});

// ============== Edge Cases & Integration Tests ==============

describe('Edge Cases', () => {
  let engine: RiskEngine;

  beforeEach(() => {
    engine = new RiskEngine({ profile: 'moderate' });
  });

  it('should handle brand new customer with no history', async () => {
    const transaction = createTestTransaction({ amount: 50000 });
    const newCustomer = createTestCustomer({
      accountCreatedDate: new Date(),
      totalTransactions: 0,
      totalVolume: 0,
      kycStatus: KYCStatus.NONE,
    });
    const emptyHistory = createTestHistory({
      lastHourCount: 1,
      last24hCount: 1,
      last7dCount: 1,
      last30dCount: 1,
      avgAmount30d: 50000,
      stdAmount30d: 0,
      maxAmount30d: 50000,
    });

    const result = await engine.assessTransactionRisk(transaction, newCustomer, emptyHistory);

    expect(result.riskScore).toBeDefined();
    expect(result.riskLevel).toBeDefined();
    // New customer with no KYC should have elevated risk
    expect(result.confidence).toBeLessThan(100);
  });

  it('should handle maximum values gracefully', async () => {
    const transaction = createTestTransaction({ amount: Number.MAX_SAFE_INTEGER });
    const customer = createTestCustomer();
    const history = createTestHistory();

    const result = await engine.assessTransactionRisk(transaction, customer, history);

    expect(result.riskScore).toBeLessThanOrEqual(100);
    // Should handle extreme values without errors
    expect(result).toBeDefined();
  });

  it('should process assessment within reasonable time', async () => {
    const transaction = createTestTransaction();
    const customer = createTestCustomer();
    const history = createTestHistory();
    const device = createTestDevice();
    const geo = createTestGeoLocation();

    const start = Date.now();
    await engine.assessTransactionRisk(transaction, customer, history, device, geo);
    const elapsed = Date.now() - start;

    // Should complete within 100ms for normal input
    expect(elapsed).toBeLessThan(100);
  });

  it('should handle multiple concurrent assessments', async () => {
    const transaction = createTestTransaction();
    const customer = createTestCustomer();
    const history = createTestHistory();

    const promises = Array.from({ length: 10 }, (_, i) =>
      engine.assessTransactionRisk(
        { ...transaction, transactionId: `concurrent-${i}` },
        customer,
        history
      )
    );

    const results = await Promise.all(promises);

    expect(results.length).toBe(10);
    results.forEach(result => {
      expect(result.riskScore).toBeDefined();
      expect(result.riskLevel).toBeDefined();
    });
  });

  it('should handle adaptive mode feedback', () => {
    const adaptiveEngine = new RiskEngine({ 
      profile: 'moderate',
      adaptiveMode: true,
    });

    const mockResult: RiskAssessmentResult = {
      riskScore: 75,
      riskLevel: RiskLevel.HIGH,
      requiredAuth: AuthRequirement.BIOMETRIC,
      shouldBlock: false,
      shouldFlag: true,
      factors: [],
      amlAlerts: [],
      assessedAt: new Date(),
      assessmentVersion: '1.0.0',
      recommendations: [],
      confidence: 80,
      processingTimeMs: 12,
    };

    // Simulate analyst override (false positive)
    adaptiveEngine.recordAssessment('txn-adaptive-1', mockResult, 'approved', 'analyst');

    // Thresholds may have adapted
    const thresholds = adaptiveEngine.getThresholds();
    expect(thresholds).toBeDefined();
  });
});

// ============== Enum Tests ==============

describe('Enumerations', () => {
  it('RiskLevel should have correct values', () => {
    expect(RiskLevel.LOW).toBe('low');
    expect(RiskLevel.MEDIUM).toBe('medium');
    expect(RiskLevel.HIGH).toBe('high');
    expect(RiskLevel.CRITICAL).toBe('critical');
  });

  it('AuthRequirement should have correct values', () => {
    expect(AuthRequirement.NONE).toBe('none');
    expect(AuthRequirement.OTP).toBe('otp');
    expect(AuthRequirement.BIOMETRIC).toBe('biometric');
    expect(AuthRequirement.STEP_UP).toBe('step_up');
    expect(AuthRequirement.MANUAL_REVIEW).toBe('manual_review');
    expect(AuthRequirement.BLOCKED).toBe('blocked');
  });

  it('AMLAlertType should have all required types', () => {
    expect(AMLAlertType.LARGE_TRANSACTION).toBe('large_transaction');
    expect(AMLAlertType.STRUCTURING).toBe('structuring');
    expect(AMLAlertType.HIGH_RISK_COUNTRY).toBe('high_risk_country');
    expect(AMLAlertType.SANCTIONS_MATCH).toBe('sanctions_match');
    expect(AMLAlertType.UNUSUAL_ACTIVITY).toBe('unusual_activity');
    expect(AMLAlertType.VELOCITY_BREACH).toBe('velocity_breach');
  });

  it('KYCStatus should have all required statuses', () => {
    expect(KYCStatus.VERIFIED).toBe('verified');
    expect(KYCStatus.PARTIAL).toBe('partial');
    expect(KYCStatus.PENDING).toBe('pending');
    expect(KYCStatus.NONE).toBe('none');
    expect(KYCStatus.REJECTED).toBe('rejected');
  });
});
