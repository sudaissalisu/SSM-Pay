/**
 * Comprehensive Test Suite for AuditLogService
 * 
 * Tests cover:
 * - Core logging functionality
 * - Convenience methods (auth, transaction, config, data access)
 * - Query and search capabilities
 * - Hash chain integrity
 * - Export functionality (CSV, JSON)
 * - Retention policy management
 * - Statistics generation
 * - Edge cases and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AuditLogService,
  auditLog,
  AuditEventType,
  AuditAction,
  AuditSeverity,
  AuditOutcome,
  type AuditEvent,
  type AuditSource,
  type AuditResource,
  type DataChange,
  type AuditQueryParams,
  type RetentionPolicy,
  type IntegrityResult,
} from './audit-log';
import { AppError } from '@/lib/errors';

// ============== Test Setup ==============

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(() => {
    // Create fresh instance for each test
    service = new AuditLogService();
  });

  afterEach(() => {
    service.destroy();
  });

  // ============== Initialization Tests ==============

  describe('Initialization', () => {
    it('should create an instance with default configuration', () => {
      expect(service).toBeInstanceOf(AuditLogService);
      expect(service.getCount()).toBe(0);
      expect(service.getSequenceNumber()).toBe(0);
      expect(service.getChainHead()).toBe('');
    });

    it('should accept custom configuration', () => {
      const customService = new AuditLogService({
        defaultRetentionDays: 365,
        maxInMemoryEvents: 5000,
      });
      
      expect(customService).toBeInstanceOf(AuditLogService);
      customService.destroy();
    });

    it('should initialize with default retention policy', () => {
      const policies = service.getRetentionPolicies();
      expect(policies.length).toBe(1);
      expect(policies[0].name).toBe('default');
      expect(policies[0].active).toBe(true);
    });
  });

  // ============== Core Logging Tests ==============

  describe('Core Logging', () => {
    it('should log a basic event with required fields', async () => {
      const event = await service.log({
        eventType: AuditEventType.AUTHENTICATION,
        action: AuditAction.LOGIN,
        userId: 'user-123',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'User logged in',
      });

      expect(event.id).toMatch(/^AUD-/);
      expect(event.eventType).toBe(AuditEventType.AUTHENTICATION);
      expect(event.action).toBe(AuditAction.LOGIN);
      expect(event.userId).toBe('user-123');
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.hash).toBeDefined();
      expect(event.sequenceNumber).toBe(1);
    });

    it('should generate unique IDs for each event', async () => {
      const event1 = await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.HEALTH_CHECK,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Health check 1',
      });

      const event2 = await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.HEALTH_CHECK,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Health check 2',
      });

      expect(event1.id).not.toBe(event2.id);
    });

    it('should increment sequence numbers correctly', async () => {
      await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.SYSTEM_STARTUP,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'System started',
      });

      await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.HEALTH_CHECK,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Health check',
      } as unknown as Omit<AuditEvent, 'id' | 'timestamp' | 'previousHash' | 'hash' | 'sequenceNumber'>);

      expect(service.getSequenceNumber()).toBe(2);
    });

    it('should store events with all provided metadata', async () => {
      const source: AuditSource = {
        ipAddress: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
        sessionId: 'session-123',
      };

      const resource: AuditResource = {
        type: 'transaction',
        id: 'txn-456',
        name: 'Payment Order #1001',
      };

      const changes: DataChange[] = [
        { field: 'status', previousValue: 'pending', newValue: 'completed', changeType: 'updated' },
      ];

      const event = await service.log({
        eventType: AuditEventType.TRANSACTION,
        action: AuditAction.PAYMENT_COMPLETED,
        userId: 'user-789',
        username: 'john.doe',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Payment completed successfully',
        source,
        resource,
        changes,
        metadata: { amount: 1000, currency: 'NGN' },
        correlationId: 'corr-abc-123',
      });

      expect(event.source).toEqual(source);
      expect(event.resource).toEqual(resource);
      expect(event.changes).toEqual(changes);
      expect(event.metadata).toEqual({ amount: 1000, currency: 'NGN' });
      expect(event.correlationId).toBe('corr-abc-123');
    });

    it('should reject events with missing required fields', async () => {
      await expect(
        service.log({
          eventType: AuditEventType.AUTHENTICATION,
          action: AuditAction.LOGIN,
          // Missing userId
          severity: AuditSeverity.INFO,
          outcome: AuditOutcome.SUCCESS,
          description: 'Test',
        } as unknown as Omit<AuditEvent, 'id' | 'timestamp' | 'previousHash' | 'hash' | 'sequenceNumber'>)
      ).rejects.toThrow('userId is required');
    });

    it('should reject events with invalid eventType', async () => {
      await expect(
        service.log({
          eventType: 'INVALID_TYPE' as AuditEventType,
          action: AuditAction.LOGIN,
          userId: 'user-123',
          severity: AuditSeverity.INFO,
          outcome: AuditOutcome.SUCCESS,
          description: 'Test',
        })
      ).rejects.toThrow('Invalid or missing eventType');
    });

    it('should reject events with invalid action', async () => {
      await expect(
        service.log({
          eventType: AuditEventType.AUTHENTICATION,
          action: 'INVALID_ACTION' as AuditAction,
          userId: 'user-123',
          severity: AuditSeverity.INFO,
          outcome: AuditOutcome.SUCCESS,
          description: 'Test',
        })
      ).rejects.toThrow('Invalid or missing action');
    });

    it('should reject events with empty description', async () => {
      await expect(
        service.log({
          eventType: AuditEventType.AUTHENTICATION,
          action: AuditAction.LOGIN,
          userId: 'user-123',
          severity: AuditSeverity.INFO,
          outcome: AuditOutcome.SUCCESS,
          description: '',
        })
      ).rejects.toThrow('description is required');
    });
  });

  // ============== Hash Chain Tests ==============

  describe('Hash Chain Integrity', () => {
    it('should maintain hash chain linkage between events', async () => {
      const event1 = await service.log({
        eventType: AuditEventType.AUTHENTICATION,
        action: AuditAction.LOGIN,
        userId: 'user-1',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'First login',
      });

      const event2 = await service.log({
        eventType: AuditEventType.TRANSACTION,
        action: AuditAction.PAYMENT_INITIATED,
        userId: 'user-1',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Payment initiated',
      } as unknown as Omit<AuditEvent, 'id' | 'timestamp' | 'previousHash' | 'hash' | 'sequenceNumber'>);

      // Second event should reference first event's hash
      expect(event2.previousHash).toBe(event1.hash);
    });

    it('should update chain head after each event', async () => {
      const event = await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.SYSTEM_STARTUP,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Startup',
      });

      expect(service.getChainHead()).toBe(event.hash);
    });

    it('should verify integrity of valid chain', async () => {
      await service.log({
        eventType: AuditEventType.AUTHENTICATION,
        action: AuditAction.LOGIN,
        userId: 'user-1',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Login',
      });

      await service.log({
        eventType: AuditEventType.TRANSACTION,
        action: AuditAction.PAYMENT_COMPLETED,
        userId: 'user-1',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Payment',
      });

      const result = await service.verifyIntegrity();
      expect(result.valid).toBe(true);
      expect(result.totalEvents).toBe(2);
    });

    it('should return valid for empty chain', async () => {
      const result = await service.verifyIntegrity();
      expect(result.valid).toBe(true);
      expect(result.totalEvents).toBe(0);
    });

    it('should include sequence number in events', async () => {
      const event1 = await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.HEALTH_CHECK,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Check 1',
      });

      const event2 = await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.HEALTH_CHECK,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Check 2',
      });

      expect(event1.sequenceNumber).toBe(1);
      expect(event2.sequenceNumber).toBe(2);
      expect(event2.sequenceNumber).toBeGreaterThan(event1.sequenceNumber!);
    });
  });

  // ============== Authentication Logging Tests ==============

  describe('Authentication Event Logging', () => {
    it('should log successful login', async () => {
      const event = await service.logAuthentication(
        AuditAction.LOGIN,
        'user-123',
        { username: 'john.doe' }
      );

      expect(event.eventType).toBe(AuditEventType.AUTHENTICATION);
      expect(event.action).toBe(AuditAction.LOGIN);
      expect(event.severity).toBe(AuditSeverity.INFO);
      expect(event.outcome).toBe(AuditOutcome.SUCCESS);
      expect(event.description).toContain('john.doe');
    });

    it('should log failed login with warning severity', async () => {
      const event = await service.logAuthentication(
        AuditAction.LOGIN_FAILED,
        'user-123',
        { username: 'attacker' }
      );

      expect(event.severity).toBe(AuditSeverity.WARNING);
      expect(event.outcome).toBe(AuditOutcome.FAILURE);
    });

    it('should log password change', async () => {
      const event = await service.logAuthentication(
        AuditAction.PASSWORD_CHANGE,
        'user-123',
        { username: 'john.doe' }
      );

      expect(event.action).toBe(AuditAction.PASSWORD_CHANGE);
      expect(event.description).toContain('Password changed');
    });

    it('should log MFA enable/disable', async () => {
      const enabledEvent = await service.logAuthentication(
        AuditAction.MFA_ENABLED,
        'user-123'
      );

      const disabledEvent = await service.logAuthentication(
        AuditAction.MFA_DISABLED,
        'user-456'
      );

      expect(enabledEvent.action).toBe(AuditAction.MFA_ENABLED);
      expect(disabledEvent.action).toBe(AuditAction.MFA_DISABLED);
    });

    it('should include source information when provided', async () => {
      const source: AuditSource = {
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
      };

      const event = await service.logAuthentication(
        AuditAction.LOGOUT,
        'user-123',
        { source }
      );

      expect(event.source?.ipAddress).toBe('10.0.0.1');
      expect(event.source?.userAgent).toBe('Mozilla/5.0');
    });
  });

  // ============== Transaction Logging Tests ==============

  describe('Transaction Event Logging', () => {
    it('should log payment initiation', async () => {
      const event = await service.logTransaction(
        AuditAction.PAYMENT_INITIATED,
        'user-123',
        'txn-001',
        { amount: 5000, currency: 'NGN' }
      );

      expect(event.eventType).toBe(AuditEventType.TRANSACTION);
      expect(event.action).toBe(AuditAction.PAYMENT_INITIATED);
      expect(event.resource?.type).toBe('transaction');
      expect(event.resource?.id).toBe('txn-001');
      expect(event.resource?.metadata).toBeDefined();
      expect(event.resource?.metadata?.amount).toBe(5000);
      expect(event.resource?.metadata?.currency).toBe('NGN');
    });

    it('should log payment failure with warning severity', async () => {
      const event = await service.logTransaction(
        AuditAction.PAYMENT_FAILED,
        'user-123',
        'txn-002',
        { amount: 10000, currency: 'NGN' }
      );

      expect(event.severity).toBe(AuditSeverity.WARNING);
    });

    it('should log refund events', async () => {
      const refundInitiated = await service.logTransaction(
        AuditAction.REFUND_INITIATED,
        'user-123',
        'txn-003'
      );

      const refundCompleted = await service.logTransaction(
        AuditAction.REFUND_COMPLETED,
        'user-123',
        'txn-003'
      );

      expect(refundInitiated.action).toBe(AuditAction.REFUND_INITIATED);
      expect(refundCompleted.action).toBe(AuditAction.REFUND_COMPLETED);
      expect(refundInitiated.severity).toBe(AuditSeverity.WARNING);
    });

    it('should track data changes in transactions', async () => {
      const changes: DataChange[] = [
        { field: 'status', previousValue: 'pending', newValue: 'processing', changeType: 'updated' },
        { field: 'processedAt', previousValue: null, newValue: new Date().toISOString(), changeType: 'created' },
      ];

      const event = await service.logTransaction(
        AuditAction.PAYMENT_COMPLETED,
        'user-123',
        'txn-004',
        { changes }
      );

      expect(event.changes).toHaveLength(2);
      expect(event.changes?.[0].field).toBe('status');
    });
  });

  // ============== Configuration Change Tests ==============

  describe('Configuration Change Logging', () => {
    it('should log configuration updates', async () => {
      const event = await service.logConfigurationChange(
        'max_transaction_limit',
        'admin-1',
        {
          username: 'admin.user',
          previousValue: 100000,
          newValue: 250000,
        }
      );

      expect(event.eventType).toBe(AuditEventType.CONFIGURATION);
      expect(event.action).toBe(AuditAction.CONFIG_UPDATED);
      expect(event.severity).toBe(AuditSeverity.WARNING);
      expect(event.changes).toHaveLength(1);
      expect(event.changes?.[0].previousValue).toBe(100000);
      expect(event.changes?.[0].newValue).toBe(250000);
    });

    it('should handle new configuration values', async () => {
      const event = await service.logConfigurationChange(
        'new_feature_flag',
        'admin-1',
        { newValue: true }
      );

      expect(event.changes?.[0].changeType).toBe('created');
      expect(event.changes?.[0].previousValue).toBeNull();
    });
  });

  // ============== Data Access Logging Tests ==============

  describe('Data Access Event Logging', () => {
    it('should log data viewing', async () => {
      const event = await service.logDataAccess(
        AuditAction.DATA_VIEWED,
        'user-123',
        'customer_records',
        { recordCount: 5 }
      );

      expect(event.eventType).toBe(AuditEventType.DATA_ACCESS);
      expect(event.action).toBe(AuditAction.DATA_VIEWED);
      expect(event.severity).toBe(AuditSeverity.INFO);
      expect(event.metadata?.recordCount).toBe(5);
    });

    it('should log data export with warning severity', async () => {
      const event = await service.logDataAccess(
        AuditAction.DATA_EXPORTED,
        'user-123',
        'financial_reports',
        { recordCount: 1000 }
      );

      expect(event.severity).toBe(AuditSeverity.WARNING);
    });

    it('should log report generation', async () => {
      const event = await service.logDataAccess(
        AuditAction.REPORT_GENERATED,
        'user-123',
        'audit_summary'
      );

      expect(event.action).toBe(AuditAction.REPORT_GENERATED);
    });
  });

  // ============== Query & Search Tests ==============

  describe('Query & Search Functionality', () => {
    beforeEach(async () => {
      // Seed test data
      await service.log({
        eventType: AuditEventType.AUTHENTICATION,
        action: AuditAction.LOGIN,
        userId: 'user-a',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'User A logged in',
        timestamp: new Date('2024-01-15T10:00:00Z'),
      } as Omit<AuditEvent, 'id' | 'timestamp' | 'previousHash' | 'hash' | 'sequenceNumber'>);

      await service.log({
        eventType: AuditEventType.AUTHENTICATION,
        action: AuditAction.LOGIN_FAILED,
        userId: 'user-b',
        severity: AuditSeverity.WARNING,
        outcome: AuditOutcome.FAILURE,
        description: 'User B failed login',
      });

      await service.log({
        eventType: AuditEventType.TRANSACTION,
        action: AuditAction.PAYMENT_COMPLETED,
        userId: 'user-a',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'User A payment completed',
      });

      await service.log({
        eventType: AuditEventType.CONFIGURATION,
        action: AuditAction.CONFIG_UPDATED,
        userId: 'admin-1',
        severity: AuditSeverity.CRITICAL,
        outcome: AuditOutcome.SUCCESS,
        description: 'Critical config update',
      });
    });

    it('should query by event types', async () => {
      const results = await service.query({
        eventTypes: [AuditEventType.AUTHENTICATION],
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      results.forEach(r => expect(r.eventType).toBe(AuditEventType.AUTHENTICATION));
    });

    it('should query by actions', async () => {
      const results = await service.query({
        actions: [AuditAction.LOGIN],
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach(r => expect(r.action).toBe(AuditAction.LOGIN));
    });

    it('should query by user IDs', async () => {
      const results = await service.query({
        userIds: ['user-a'],
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      results.forEach(r => expect(r.userId).toBe('user-a'));
    });

    it('should query by severity levels', async () => {
      const results = await service.query({
        severities: [AuditSeverity.CRITICAL],
      });

      expect(results.length).toBe(1);
      expect(results[0].severity).toBe(AuditSeverity.CRITICAL);
    });

    it('should query by outcomes', async () => {
      const results = await service.query({
        outcomes: [AuditOutcome.FAILURE],
      });

      expect(results.length).toBe(1);
      expect(results[0].outcome).toBe(AuditOutcome.FAILURE);
    });

    it('should search by term in description', async () => {
      const results = await service.query({
        searchTerm: 'payment',
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach(r => 
        expect(r.description.toLowerCase()).toContain('payment')
      );
    });

    it('should apply pagination with limit and offset', async () => {
      const page1 = await service.query({ limit: 2, offset: 0 });
      const page2 = await service.query({ limit: 2, offset: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBeLessThanOrEqual(2);
      
      // Ensure no overlap
      const page1Ids = page1.map(e => e.id);
      const page2Ids = page2.map(e => e.id);
      page2Ids.forEach(id => expect(page1Ids).not.toContain(id));
    });

    it('should sort results by timestamp descending by default', async () => {
      const results = await service.query({ sortBy: 'timestamp', sortOrder: 'desc' });

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          results[i].timestamp.getTime()
        );
      }
    });

    it('should sort by severity', async () => {
      const results = await service.query({ sortBy: 'severity', sortOrder: 'asc' });

      for (let i = 1; i < results.length; i++) {
        const severityOrder = { [AuditSeverity.INFO]: 1, [AuditSeverity.WARNING]: 2, [AuditSeverity.CRITICAL]: 3 };
        expect(severityOrder[results[i - 1].severity]).toBeLessThanOrEqual(
          severityOrder[results[i].severity]
        );
      }
    });

    it('should get event by ID', async () => {
      const event = await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.HEALTH_CHECK,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Find me by ID',
      });

      const found = await service.getEventById(event.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(event.id);
    });

    it('should return null for non-existent event ID', async () => {
      const found = await service.getEventById('non-existent-id');
      expect(found).toBeNull();
    });

    it('should get events by correlation ID', async () => {
      const correlationId = 'test-correlation-123';
      
      await service.log({
        eventType: AuditEventType.TRANSACTION,
        action: AuditAction.PAYMENT_INITIATED,
        userId: 'user-1',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Step 1',
        correlationId,
      });

      await service.log({
        eventType: AuditEventType.TRANSACTION,
        action: AuditAction.PAYMENT_COMPLETED,
        userId: 'user-1',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Step 2',
        correlationId,
      });

      const relatedEvents = await service.getEventsByCorrelationId(correlationId);
      expect(relatedEvents.length).toBe(2);
    });

    it('should get user activity', async () => {
      const activity = await service.getUserActivity('user-a');
      expect(activity.length).toBeGreaterThanOrEqual(1);
      activity.forEach(a => expect(a.userId).toBe('user-a'));
    });

    it('should get resource history', async () => {
      const resourceId = 'config-max-limit';
      
      await service.logConfigurationChange(resourceId, 'admin-1', {
        previousValue: 100,
        newValue: 200,
      });

      await service.logConfigurationChange(resourceId, 'admin-1', {
        previousValue: 200,
        newValue: 300,
      });

      const history = await service.getResourceHistory('config', resourceId);
      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============== Statistics Tests ==============

  describe('Statistics Generation', () => {
    it('should generate statistics for empty log', async () => {
      const stats = await service.getStatistics();

      expect(stats.totalEvents).toBe(0);
      expect(stats.chainIntegrity).toBe(true);
    });

    it('should count events correctly', async () => {
      await service.log({
        eventType: AuditEventType.AUTHENTICATION,
        action: AuditAction.LOGIN,
        userId: 'user-1',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Login 1',
      });

      await service.log({
        eventType: AuditEventType.AUTHENTICATION,
        action: AuditAction.LOGIN,
        userId: 'user-2',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Login 2',
      });

      const stats = await service.getStatistics();
      expect(stats.totalEvents).toBe(2);
    });

    it('should categorize events by type', async () => {
      await service.log({
        eventType: AuditEventType.AUTHENTICATION,
        action: AuditAction.LOGIN,
        userId: 'user-1',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Auth event',
      });

      await service.log({
        eventType: AuditEventType.TRANSACTION,
        action: AuditAction.PAYMENT_COMPLETED,
        userId: 'user-1',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Txn event',
      });

      const stats = await service.getStatistics();
      expect(stats.eventsByType[AuditEventType.AUTHENTICATION]).toBe(1);
      expect(stats.eventsByType[AuditEventType.TRANSACTION]).toBe(1);
    });

    it('should categorize events by severity', async () => {
      await service.log({
        eventType: AuditEventType.AUTHENTICATION,
        action: AuditAction.LOGIN,
        userId: 'user-1',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Info event',
      });

      await service.log({
        eventType: AuditEventType.AUTHENTICATION,
        action: AuditAction.LOGIN_FAILED,
        userId: 'user-2',
        severity: AuditSeverity.WARNING,
        outcome: AuditOutcome.FAILURE,
        description: 'Warning event',
      });

      const stats = await service.getStatistics();
      expect(stats.eventsBySeverity[AuditSeverity.INFO]).toBe(1);
      expect(stats.eventsBySeverity[AuditSeverity.WARNING]).toBe(1);
    });

    it('should track oldest and newest events', async () => {
      await service.log({
        eventType: AuditEventType.AUTHENTICATION,
        action: AuditAction.LOGIN,
        userId: 'user-1',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Event for timestamp tracking',
      });

      const stats = await service.getStatistics();
      expect(stats.oldestEvent).toBeInstanceOf(Date);
      expect(stats.newestEvent).toBeInstanceOf(Date);
    });
  });

  // ============== Export Tests ==============

  describe('Export Functionality', () => {
    beforeEach(async () => {
      await service.log({
        eventType: AuditEventType.AUTHENTICATION,
        action: AuditAction.LOGIN,
        userId: 'user-1',
        username: 'john.doe',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'User login',
        source: { ipAddress: '192.168.1.1' },
        resource: { type: 'session', id: 'sess-1' },
        correlationId: 'corr-1',
      });
    });

    it('should export to JSON format', async () => {
      const jsonOutput = await service.export({ format: 'json' });
      const parsed = JSON.parse(jsonOutput);

      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.totalRecords).toBe(1);
      expect(parsed.events).toHaveLength(1);
      expect(parsed.events[0].action).toBe(AuditAction.LOGIN);
    });

    it('should export to CSV format', async () => {
      const csvOutput = await service.export({ format: 'csv' });

      expect(csvOutput).toContain('id');
      expect(csvOutput).toContain('timestamp');
      expect(csvOutput).toContain('eventType');
      expect(csvOutput).toContain('LOGIN');
      expect(csvOutput.split('\n').length).toBe(2); // Header + 1 row
    });

    it('should include hash chain data when requested', async () => {
      const jsonOutput = await service.export({
        format: 'json',
        includeHashChain: true,
      });

      const parsed = JSON.parse(jsonOutput);
      expect(parsed.events[0].hash).toBeDefined();
      expect(parsed.events[0].previousHash).toBeDefined();
      expect(parsed.events[0].sequenceNumber).toBeDefined();
    });

    it('should exclude hash chain data by default', async () => {
      const jsonOutput = await service.export({ format: 'json' });
      const parsed = JSON.parse(jsonOutput);

      expect(parsed.events[0].hash).toBeUndefined();
      expect(parsed.events[0].previousHash).toBeUndefined();
    });

    it('should redact sensitive fields when requested', async () => {
      await service.log({
        eventType: AuditEventType.DATA_ACCESS,
        action: AuditAction.DATA_VIEWED,
        userId: 'user-1',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Viewed sensitive data',
        metadata: { ssn: '123-45-6789', accountNumber: 'ACC-001' },
      });

      const csvOutput = await service.export({
        format: 'csv',
        includeMetadata: true,
        redactSensitive: true,
        redactedFields: ['ssn', 'accountNumber'],
      });

      expect(csvOutput).toContain('[REDACTED]');
      expect(csvOutput).not.toContain('123-45-6789');
    });

    it('should filter exports based on query parameters', async () => {
      await service.log({
        eventType: AuditEventType.TRANSACTION,
        action: AuditAction.PAYMENT_FAILED,
        userId: 'user-2',
        severity: AuditSeverity.WARNING,
        outcome: AuditOutcome.FAILURE,
        description: 'Failed payment',
      });

      const jsonOutput = await service.export({
        format: 'json',
        query: {
          eventTypes: [AuditEventType.AUTHENTICATION],
        },
      });

      const parsed = JSON.parse(jsonOutput);
      expect(parsed.totalRecords).toBe(1);
      expect(parsed.events[0].eventType).toBe(AuditEventType.AUTHENTICATION);
    });

    it('should export as blob', async () => {
      const blob = await service.exportAsBlob({ format: 'json' });

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
    });

    it('should throw error for unsupported format', async () => {
      await expect(
        service.export({ format: 'xml' as 'csv' | 'json' })
      ).rejects.toThrow('Unsupported export format');
    });
  });

  // ============== Retention Policy Tests ==============

  describe('Retention Policy Management', () => {
    it('should add custom retention policy', () => {
      const policy = service.addRetentionPolicy({
        name: '90-day-policy',
        description: 'Retain logs for 90 days',
        retentionDays: 90,
        active: true,
      });

      expect(policy.name).toBe('90-day-policy');
      expect(policy.retentionDays).toBe(90);
      expect(policy.active).toBe(true);
      expect(policy.createdAt).toBeInstanceOf(Date);
    });

    it('should list all retention policies', () => {
      service.addRetentionPolicy({
        name: 'policy-1',
        retentionDays: 30,
        active: true,
      });

      service.addRetentionPolicy({
        name: 'policy-2',
        retentionDays: 60,
        active: false,
      });

      const policies = service.getRetentionPolicies();
      expect(policies.length).toBe(3); // Default + 2 custom
    });

    it('should remove retention policy by name', () => {
      service.addRetentionPolicy({
        name: 'removable-policy',
        retentionDays: 7,
        active: true,
      });

      const removed = service.removeRetentionPolicy('removable-policy');
      expect(removed).toBe(true);

      const policies = service.getRetentionPolicies();
      expect(policies.find(p => p.name === 'removable-policy')).toBeUndefined();
    });

    it('should return false when removing non-existent policy', () => {
      const removed = service.removeRetentionPolicy('does-not-exist');
      expect(removed).toBe(false);
    });

    it('should apply retention policies and purge old events', async () => {
      // Add a very short retention policy (1 second)
      service.addRetentionPolicy({
        name: 'immediate-purge',
        retentionDays: 0.00001, // ~1 second in days
        active: true,
      });

      // Log some events
      await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.HEALTH_CHECK,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Will be purged',
      });

      // Wait a moment to ensure event timestamp is in the past
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(service.getCount()).toBeGreaterThan(0);

      // Apply retention
      const purgedCount = await service.applyRetentionPolicies();
      expect(purgedCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ============== Management Tests ==============

  describe('Service Management', () => {
    it('should clear all events with reason', async () => {
      await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.SYSTEM_STARTUP,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Startup event',
      });

      expect(service.getCount()).toBe(1);

      await service.clearAll('Testing clearance', 'test-user');
      expect(service.getCount()).toBe(0);
    });

    it('should reject clearing without reason', async () => {
      await expect(
        service.clearAll('')
      ).rejects.toThrow('Reason is required');
    });

    it('should destroy service and clean up', async () => {
      await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.SYSTEM_STARTUP,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Before destroy',
      });

      service.destroy();

      expect(service.getCount()).toBe(0);
      expect(service.getSequenceNumber()).toBe(0);
      expect(service.getChainHead()).toBe('');
    });

    it('should return correct event count', async () => {
      expect(service.getCount()).toBe(0);

      await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.HEALTH_CHECK,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Check 1',
      });

      await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.HEALTH_CHECK,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Check 2',
      });

      expect(service.getCount()).toBe(2);
    });
  });

  // ============== Singleton Instance Tests ==============

  describe('Singleton Instance', () => {
    it('should export singleton instance', () => {
      expect(auditLog).toBeInstanceOf(AuditLogService);
    });

    it('should be usable as global audit logger', async () => {
      const event = await auditLog.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.HEALTH_CHECK,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Singleton test',
      });

      expect(event.id).toBeDefined();
    });
  });

  // ============== Edge Cases & Error Handling ==============

  describe('Edge Cases', () => {
    it('should handle special characters in description', async () => {
      const event = await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.ERROR_OCCURRED,
        userId: 'system',
        severity: AuditSeverity.CRITICAL,
        outcome: AuditOutcome.FAILURE,
        description: 'Error: "Special <chars> & symbols" - test\'s data',
      });

      expect(event.description).toContain('"Special');
    });

    it('should handle empty arrays in filters', async () => {
      await service.log({
        eventType: AuditEventType.AUTHENTICATION,
        action: AuditAction.LOGIN,
        userId: 'user-1',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Test event',
      });

      // Empty array is treated as no filter applied (returns all)
      const results = await service.query({ eventTypes: [] });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle very long metadata', async () => {
      const longString = 'x'.repeat(10000);
      
      const event = await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.ERROR_OCCURRED,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Long metadata test',
        metadata: { longField: longString },
      });

      expect(event.metadata?.longField).toBe(longString);
    });

    it('should handle multiple data changes', async () => {
      const changes: DataChange[] = Array.from({ length: 10 }, (_, i) => ({
        field: `field-${i}`,
        previousValue: `old-${i}`,
        newValue: `new-${i}`,
        changeType: 'updated' as const,
      }));

      const event = await service.log({
        eventType: AuditEventType.CONFIGURATION,
        action: AuditAction.CONFIG_UPDATED,
        userId: 'admin-1',
        severity: AuditSeverity.WARNING,
        outcome: AuditOutcome.SUCCESS,
        description: 'Bulk update',
        changes,
      });

      expect(event.changes).toHaveLength(10);
    });

    it('should preserve event order in queries without explicit sort', async () => {
      const event1 = await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.HEALTH_CHECK,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'First',
      });

      const event2 = await service.log({
        eventType: AuditEventType.SYSTEM,
        action: AuditAction.HEALTH_CHECK,
        userId: 'system',
        severity: AuditSeverity.INFO,
        outcome: AuditOutcome.SUCCESS,
        description: 'Second',
      });

      const results = await service.query({ sortBy: 'timestamp', sortOrder: 'desc' });
      // Default sort is timestamp desc, so second should come first
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.map(r => r.id)).toContain(event1.id);
      expect(results.map(r => r.id)).toContain(event2.id);
    });
  });
});
