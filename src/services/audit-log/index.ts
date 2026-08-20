/**
 * Enterprise Audit Logging Service - Main Module
 * 
 * Aggregates all audit-log sub-modules and provides the main
 * AuditLogService class that coordinates:
 * - Event logging with type definitions
 * - Query and search functionality
 * - Export capabilities (CSV, JSON)
 * - Hash chain integrity verification
 * - Retention policy management
 * 
 * @module services/audit-log
 * @version 1.0.0
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// Re-export types and classes from sub-modules
export {
  // Types from events.ts
  AuditEventType,
  AuditAction,
  AuditSeverity,
  AuditOutcome,
  DataChange,
  AuditSource,
  AuditResource,
  AuditEventLogger,
} from './events';

export {
  // Types from query.ts
  AuditQueryParams,
  AuditQueryManager,
} from './query';

export {
  // Types from export.ts
  ExportFormat,
  ExportOptions,
  AuditExportManager,
} from './export';

export {
  // Types from integrity.ts
  IntegrityResult,
  AuditIntegrityManager,
  HASH_ALGORITHM,
} from './integrity';

// Import implementations
import { AuditEventType, AuditAction, AuditSeverity, AuditOutcome, DataChange, AuditSource, AuditResource, AuditEventLogger } from './events';
import { AuditQueryManager } from './query';
import { AuditExportManager } from './export';
import { AuditIntegrityManager } from './integrity';

// ============== Additional Type Definitions ==============

/**
 * Retention policy configuration
 */
export interface RetentionPolicy {
  name: string;
  description?: string;
  retentionDays: number;
  appliesToEventTypes?: AuditEventType[];
  minSeverity?: AuditSeverity;
  archiveBeforeDelete?: boolean;
  archivePath?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Audit statistics summary
 */
export interface AuditStatistics {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  eventsByOutcome: Record<AuditOutcome, number>;
  recentEvents: number;
  oldestEvent?: Date;
  newestEvent?: Date;
  chainIntegrity: boolean;
  chainBreakPoint?: number;
}

/**
 * Main audit event structure (complete)
 */
export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  action: AuditAction;
  userId: string;
  username?: string;
  timestamp: Date;
  severity: AuditSeverity;
  outcome: AuditOutcome;
  description: string;
  source?: AuditSource;
  resource?: AuditResource;
  changes?: DataChange[];
  metadata?: Record<string, unknown>;
  previousHash?: string;
  hash?: string;
  sequenceNumber?: number;
  correlationId?: string;
}

// ============== Constants ==============

/** Default retention period in days (7 years for financial compliance) */
const DEFAULT_RETENTION_DAYS = 2555;

/** Maximum events to keep in memory before requiring persistence */
const MAX_IN_MEMORY_EVENTS = 10000;

// ============== Audit Log Service Class ==============

/**
 * Enterprise-grade Audit Logging Service
 */
export class AuditLogService {
  /** In-memory event store */
  private events: Map<string, AuditEvent> = new Map();
  
  /** Ordered event IDs for sequence tracking */
  private orderedEventIds: string[] = [];
  
  /** Current hash chain state */
  private lastHash: string = '';
  
  /** Current sequence number */
  private sequenceNumber: number = 0;
  
  /** Active retention policies */
  private retentionPolicies: RetentionPolicy[] = [];
  
  /** Statistics cache */
  private statsCache: AuditStatistics | null = null;
  
  /** Whether service is initialized */
  private initialized: boolean = false;

  /** Sub-managers */
  private eventLogger: AuditEventLogger;
  private queryManager: AuditQueryManager;
  private exportManager: AuditExportManager;
  private integrityManager: AuditIntegrityManager;

  constructor(config?: {
    defaultRetentionDays?: number;
    maxInMemoryEvents?: number;
    enableAutoCleanup?: boolean;
  }) {
    // Initialize sub-managers
    this.eventLogger = new AuditEventLogger();
    this.queryManager = new AuditQueryManager(this.events);
    this.exportManager = new AuditExportManager(this.queryManager);
    this.integrityManager = new AuditIntegrityManager(this.orderedEventIds, this.events);

    // Initialize default retention policy
    this.retentionPolicies.push({
      name: 'default',
      description: 'Default retention policy for all events',
      retentionDays: config?.defaultRetentionDays ?? DEFAULT_RETENTION_DAYS,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info('AuditLogService initialized', {
      event: 'audit.init',
      metadata: { 
        defaultRetentionDays: config?.defaultRetentionDays ?? DEFAULT_RETENTION_DAYS,
        maxInMemoryEvents: config?.maxInMemoryEvents ?? MAX_IN_MEMORY_EVENTS,
      },
    });

    this.initialized = true;
  }

  // ============== Core Logging Methods ==============

  /**
   * Log a new audit event
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp' | 'previousHash' | 'hash' | 'sequenceNumber'>): Promise<AuditEvent> {
    if (!this.initialized) {
      throw new AppError('AuditLogService not initialized', ErrorCode.UNKNOWN_ERROR);
    }

    // Validate required fields
    this.eventLogger.validateEventInput(event);

    // Generate unique ID
    const id = this.eventLogger.generateEventId(this.sequenceNumber + 1);

    // Create timestamp
    const timestamp = new Date();

    // Build complete event with hash chain
    const completeEvent: AuditEvent = {
      ...event,
      id,
      timestamp,
      previousHash: this.lastHash,
      sequenceNumber: ++this.sequenceNumber,
    };

    // Calculate and set hash
    completeEvent.hash = this.integrityManager.calculateEventHash(completeEvent);

    // Store the event
    this.events.set(id, completeEvent);
    this.orderedEventIds.push(id);

    // Update last hash for chain
    this.lastHash = completeEvent.hash;

    // Invalidate stats cache
    this.statsCache = null;

    logger.info(`Audit event logged: ${event.action}`, {
      event: `audit.${event.eventType.toLowerCase()}.${event.action.toLowerCase()}`,
      metadata: {
        eventId: id,
        userId: event.userId,
        action: event.action,
        severity: event.severity,
        outcome: event.outcome,
      },
    });

    return completeEvent;
  }

  /**
   * Log an authentication event (convenience method)
   */
  async logAuthentication(
    action: AuditAction.LOGIN | AuditAction.LOGOUT | AuditAction.LOGIN_FAILED | AuditAction.PASSWORD_CHANGE | AuditAction.MFA_ENABLED | AuditAction.MFA_DISABLED,
    userId: string,
    options: {
      username?: string;
      outcome?: AuditOutcome;
      description?: string;
      source?: AuditSource;
      metadata?: Record<string, unknown>;
      correlationId?: string;
    } = {}
  ): Promise<AuditEvent> {
    const descriptions = this.eventLogger.getAuthDescriptions();

    return this.log({
      eventType: AuditEventType.AUTHENTICATION,
      action,
      userId,
      username: options.username,
      severity: action === AuditAction.LOGIN_FAILED ? AuditSeverity.WARNING : AuditSeverity.INFO,
      outcome: options.outcome ?? (action === AuditAction.LOGIN_FAILED ? AuditOutcome.FAILURE : AuditOutcome.SUCCESS),
      description: options.description ?? descriptions[action],
      source: options.source,
      metadata: options.metadata,
      correlationId: options.correlationId,
    });
  }

  /**
   * Log a transaction event (convenience method)
   */
  async logTransaction(
    action: AuditAction.PAYMENT_INITIATED | AuditAction.PAYMENT_COMPLETED | AuditAction.PAYMENT_FAILED | AuditAction.REFUND_INITIATED | AuditAction.REFUND_COMPLETED,
    userId: string,
    transactionId: string,
    options: {
      username?: string;
      amount?: number;
      currency?: string;
      outcome?: AuditOutcome;
      description?: string;
      source?: AuditSource;
      changes?: DataChange[];
      metadata?: Record<string, unknown>;
      correlationId?: string;
    } = {}
  ): Promise<AuditEvent> {
    const severityMap = this.eventLogger.getTransactionSeverityMap();
    const descriptions = this.eventLogger.getTransactionDescriptions();

    return this.log({
      eventType: AuditEventType.TRANSACTION,
      action,
      userId,
      username: options.username,
      severity: severityMap[action] ?? AuditSeverity.INFO,
      outcome: options.outcome ?? (action === AuditAction.PAYMENT_FAILED ? AuditOutcome.FAILURE : AuditOutcome.SUCCESS),
      description: options.description ?? descriptions[action]?.(options),
      source: options.source,
      resource: {
        type: 'transaction',
        id: transactionId,
        metadata: options.amount ? { amount: options.amount, currency: options.currency } : undefined,
      },
      changes: options.changes,
      metadata: options.metadata,
      correlationId: options.correlationId,
    });
  }

  /**
   * Log a configuration change event (convenience method)
   */
  async logConfigurationChange(
    configKey: string,
    userId: string,
    options: {
      username?: string;
      previousValue?: unknown;
      newValue?: unknown;
      outcome?: AuditOutcome;
      description?: string;
      source?: AuditSource;
      metadata?: Record<string, unknown>;
      correlationId?: string;
    } = {}
  ): Promise<AuditEvent> {
    const changes: DataChange[] = [];
    
    if (options.previousValue !== undefined || options.newValue !== undefined) {
      changes.push({
        field: configKey,
        previousValue: options.previousValue ?? null,
        newValue: options.newValue ?? null,
        changeType: options.previousValue === undefined ? 'created' : 'updated',
      });
    }

    return this.log({
      eventType: AuditEventType.CONFIGURATION,
      action: AuditAction.CONFIG_UPDATED,
      userId,
      username: options.username,
      severity: AuditSeverity.WARNING,
      outcome: options.outcome ?? AuditOutcome.SUCCESS,
      description: options.description ?? `Configuration updated: ${configKey}`,
      source: options.source,
      resource: { type: 'config', id: configKey },
      changes: changes.length > 0 ? changes : undefined,
      metadata: options.metadata,
      correlationId: options.correlationId,
    });
  }

  /**
   * Log a data access event (convenience method)
   */
  async logDataAccess(
    action: AuditAction.DATA_VIEWED | AuditAction.DATA_EXPORTED | AuditAction.DATA_DOWNLOADED | AuditAction.REPORT_GENERATED,
    userId: string,
    dataType: string,
    options: {
      username?: string;
      recordCount?: number;
      resourceId?: string;
      outcome?: AuditOutcome;
      description?: string;
      source?: AuditSource;
      metadata?: Record<string, unknown>;
      correlationId?: string;
    } = {}
  ): Promise<AuditEvent> {
    const severityMap = this.eventLogger.getDataAccessSeverityMap();

    return this.log({
      eventType: AuditEventType.DATA_ACCESS,
      action,
      userId,
      username: options.username,
      severity: severityMap[action] ?? AuditSeverity.INFO,
      outcome: options.outcome ?? AuditOutcome.SUCCESS,
      description: options.description ?? `${action.replace(/_/g, ' ')}: ${dataType}${options.recordCount ? ` (${options.recordCount} records)` : ''}`,
      source: options.source,
      resource: options.resourceId ? { type: dataType, id: options.resourceId } : undefined,
      metadata: { ...options.metadata, ...(options.recordCount !== undefined && { recordCount: options.recordCount }) },
      correlationId: options.correlationId,
    });
  }

  // ============== Query & Search Delegation ==============

  async query(params: AuditQueryParams = {}): Promise<AuditEvent[]> {
    return this.queryManager.query(params);
  }

  async getEventById(id: string): Promise<AuditEvent | null> {
    return this.queryManager.getEventById(id);
  }

  async getEventsByCorrelationId(correlationId: string): Promise<AuditEvent[]> {
    return this.queryManager.getEventsByCorrelationId(correlationId);
  }

  async getUserActivity(userId: string, limit: number = 50): Promise<AuditEvent[]> {
    return this.queryManager.getUserActivity(userId, limit);
  }

  async getResourceHistory(resourceType: string, resourceId: string): Promise<AuditEvent[]> {
    return this.queryManager.getResourceHistory(resourceType, resourceId);
  }

  // ============== Statistics Methods ==============

  async getStatistics(): Promise<AuditStatistics> {
    if (this.statsCache) {
      return this.statsCache;
    }

    const allEvents = Array.from(this.events.values());
    const totalEvents = allEvents.length;

    const eventsByType = {} as Record<AuditEventType, number>;
    const eventsBySeverity = {} as Record<AuditSeverity, number>;
    const eventsByOutcome = {} as Record<AuditOutcome, number>;

    Object.values(AuditEventType).forEach(type => { eventsByType[type] = 0; });
    Object.values(AuditSeverity).forEach(severity => { eventsBySeverity[severity] = 0; });
    Object.values(AuditOutcome).forEach(outcome => { eventsByOutcome[outcome] = 0; });

    let oldestEvent: Date | undefined;
    let newestEvent: Date | undefined;
    let recentEvents = 0;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const event of allEvents) {
      eventsByType[event.eventType]++;
      eventsBySeverity[event.severity]++;
      eventsByOutcome[event.outcome]++;

      if (!oldestEvent || event.timestamp < oldestEvent) oldestEvent = event.timestamp;
      if (!newestEvent || event.timestamp > newestEvent) newestEvent = event.timestamp;
      if (event.timestamp >= oneHourAgo) recentEvents++;
    }

    const integrityResult = await this.verifyIntegrity();

    this.statsCache = {
      totalEvents,
      eventsByType,
      eventsBySeverity,
      eventsByOutcome,
      recentEvents,
      oldestEvent,
      newestEvent,
      chainIntegrity: integrityResult.valid,
      chainBreakPoint: integrityResult.invalidIndex,
    };

    return this.statsCache;
  }

  // ============== Export Delegation ==============

  async export(options: ExportOptions): Promise<string> {
    return this.exportManager.export(options);
  }

  async exportAsBlob(options: ExportOptions): Promise<Blob> {
    return this.exportManager.exportAsBlob(options);
  }

  // ============== Integrity & Security Delegation ==============

  async verifyIntegrity(): Promise<IntegrityResult> {
    return this.integrityManager.verifyIntegrity();
  }

  getChainHead(): string {
    return this.integrityManager.getChainHead(this.lastHash);
  }

  getSequenceNumber(): number {
    return this.sequenceNumber;
  }

  // ============== Retention Policy Methods ==============

  addRetentionPolicy(policy: Omit<RetentionPolicy, 'createdAt' | 'updatedAt'>): RetentionPolicy {
    const now = new Date();
    const newPolicy: RetentionPolicy = {
      ...policy,
      createdAt: now,
      updatedAt: now,
    };

    this.retentionPolicies.push(newPolicy);
    this.statsCache = null;

    logger.info('Retention policy added', {
      event: 'audit.retention.policy_added',
      metadata: { policyName: policy.name, retentionDays: policy.retentionDays },
    });

    return newPolicy;
  }

  getRetentionPolicies(): RetentionPolicy[] {
    return [...this.retentionPolicies];
  }

  removeRetentionPolicy(name: string): boolean {
    const index = this.retentionPolicies.findIndex(p => p.name === name);
    if (index === -1) return false;

    this.retentionPolicies.splice(index, 1);
    this.statsCache = null;

    logger.info('Retention policy removed', {
      event: 'audit.retension.policy_removed',
      metadata: { policyName: name },
    });

    return true;
  }

  async applyRetentionPolicies(): Promise<number> {
    const now = new Date();
    let totalPurged = 0;

    for (const policy of this.retentionPolicies.filter(p => p.active)) {
      const cutoffDate = new Date(now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);
      
      const eventsToPurge: string[] = [];
      
      for (const [id, event] of this.events.entries()) {
        if (policy.appliesToEventTypes && !policy.appliesToEventTypes.includes(event.eventType)) continue;

        if (policy.minSeverity) {
          const severityLevels = [AuditSeverity.INFO, AuditSeverity.WARNING, AuditSeverity.CRITICAL, AuditSeverity.EMERGENCY];
          const eventLevel = severityLevels.indexOf(event.severity);
          const minLevel = severityLevels.indexOf(policy.minSeverity);
          if (eventLevel < minLevel) continue;
        }

        if (event.timestamp < cutoffDate) {
          eventsToPurge.push(id);
        }
      }

      for (const id of eventsToPurge) {
        this.events.delete(id);
        const idx = this.orderedEventIds.indexOf(id);
        if (idx !== -1) this.orderedEventIds.splice(idx, 1);
        totalPurged++;
      }
    }

    if (totalPurged > 0) {
      this.statsCache = null;
      
      logger.info('Retention policies applied', {
        event: 'audit.retention.applied',
        metadata: { eventsPurged: totalPurged, remainingEvents: this.events.size },
      });
    }

    return totalPurged;
  }

  // ============== Management Methods ==============

  async clearAll(reason: string, userId: string = 'system'): Promise<void> {
    if (!reason || reason.trim().length === 0) {
      throw new AppError('Reason is required for clearing audit logs', ErrorCode.VALIDATION_ERROR);
    }

    const count = this.events.size;
    this.events.clear();
    this.orderedEventIds = [];
    this.lastHash = '';
    this.sequenceNumber = 0;
    this.statsCache = null;

    logger.warn('All audit logs cleared', {
      event: 'audit.cleared',
      metadata: { reason, clearedBy: userId, eventsRemoved: count },
    });
  }

  getCount(): number {
    return this.events.size;
  }

  destroy(): void {
    this.events.clear();
    this.orderedEventIds = [];
    this.retentionPolicies = [];
    this.lastHash = '';
    this.sequenceNumber = 0;
    this.statsCache = null;
    this.initialized = false;

    logger.info('AuditLogService destroyed', { event: 'audit.destroy' });
  }
}

// ============== Singleton Instance ==============

/** Default application-wide audit log instance */
export const auditLog = new AuditLogService();

// ============== Exports ==============

export default AuditLogService;
