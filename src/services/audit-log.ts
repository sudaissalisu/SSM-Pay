/**
 * Enterprise Audit Logging Service for SSM-Pay Payment Platform
 * 
 * Provides comprehensive audit trail functionality including:
 * - Structured audit event logging with multiple event types
 * - User action tracking with full context capture
 * - Data change tracking (before/after values) for compliance
 * - Tamper-evident logging using hash chaining
 * - Retention policy management for data lifecycle
 * - Compliance export capabilities (CSV, JSON)
 * - Advanced query and search functionality
 * 
 * @module services/audit-log
 * @version 1.0.0
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Type Definitions ==============

/**
 * Audit event categories for classification
 */
export enum AuditEventType {
  /** Authentication events - login, logout, session management */
  AUTHENTICATION = 'AUTHENTICATION',
  /** Transaction events - payments, transfers, refunds */
  TRANSACTION = 'TRANSACTION',
  /** Configuration events - settings changes, feature flags */
  CONFIGURATION = 'CONFIGURATION',
  /** Data access events - viewing, exporting sensitive data */
  DATA_ACCESS = 'DATA_ACCESS',
  /** System events - maintenance, errors, health checks */
  SYSTEM = 'SYSTEM',
  /** Admin events - user management, role changes */
  ADMIN = 'ADMIN',
  /** Compliance events - regulatory reports, audits */
  COMPLIANCE = 'COMPLIANCE',
}

/**
 * Specific actions within each event type
 */
export enum AuditAction {
  // Authentication actions
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  TOKEN_REFRESH = 'TOKEN_REFRESH',

  // Transaction actions
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REFUND_INITIATED = 'REFUND_INITIATED',
  REFUND_COMPLETED = 'REFUND_COMPLETED',
  TRANSFER_INITIATED = 'TRANSFER_INITIATED',
  TRANSFER_COMPLETED = 'TRANSFER_COMPLETED',
  DISPUTE_CREATED = 'DISPUTE_CREATED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',

  // Configuration actions
  CONFIG_UPDATED = 'CONFIG_UPDATED',
  CONFIG_DELETED = 'CONFIG_DELETED',
  FEATURE_FLAG_CHANGED = 'FEATURE_FLAG_CHANGED',
  RATE_LIMIT_CHANGED = 'RATE_LIMIT_CHANGED',
  WEBHOOK_UPDATED = 'WEBHOOK_UPDATED',

  // Data access actions
  DATA_VIEWED = 'DATA_VIEWED',
  DATA_EXPORTED = 'DATA_EXPORTED',
  DATA_DOWNLOADED = 'DATA_DOWNLOADED',
  REPORT_GENERATED = 'REPORT_GENERATED',
  BULK_ACCESS = 'BULK_ACCESS',

  // System actions
  SYSTEM_STARTUP = 'SYSTEM_STARTUP',
  SYSTEM_SHUTDOWN = 'SYSTEM_SHUTDOWN',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
  BACKUP_COMPLETED = 'BACKUP_COMPLETED',
  HEALTH_CHECK = 'HEALTH_CHECK',

  // Admin actions
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_UNSUSPENDED = 'USER_UNSUSPENDED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REVOKED = 'ROLE_REVOKED',
  PERMISSIONS_CHANGED = 'PERMISSIONS_CHANGED',

  // Compliance actions
  AUDIT_EXPORT = 'AUDIT_EXPORT',
  REGULATORY_REPORT = 'REGULATORY_REPORT',
  RETENTION_APPLIED = 'RETENTION_APPLIED',
  POLICY_UPDATE = 'POLICY_UPDATE',
}

/**
 * Severity levels for audit events
 */
export enum AuditSeverity {
  /** Informational - normal operations */
  INFO = 'INFO',
  /** Warning - unusual but not critical */
  WARNING = 'WARNING',
  /** Critical - security or compliance relevant */
  CRITICAL = 'CRITICAL',
  /** Emergency - immediate attention required */
  EMERGENCY = 'EMERGENCY',
}

/**
 * Outcome status of audited operations
 */
export enum AuditOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  PARTIAL = 'PARTIAL',
  BLOCKED = 'BLOCKED',
}

/**
 * Data change record for tracking modifications
 */
export interface DataChange {
  /** Field name that was changed */
  field: string;
  /** Previous value before change */
  previousValue: unknown;
  /** New value after change */
  newValue: unknown;
  /** Type of change operation */
  changeType: 'created' | 'updated' | 'deleted' | 'unchanged';
}

/**
 * Source information for the audit event
 */
export interface AuditSource {
  /** IP address of the source */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Geographic location (country code) */
  country?: string;
  /** Device identifier */
  deviceId?: string;
  /** Session identifier */
  sessionId?: string;
  /** Request ID for tracing */
  requestId?: string;
  /** API endpoint if applicable */
  endpoint?: string;
  /** HTTP method */
  httpMethod?: string;
}

/**
 * Resource being acted upon
 */
export interface AuditResource {
  /** Type of resource (e.g., 'transaction', 'user', 'config') */
  type: string;
  /** Unique identifier of the resource */
  id: string;
  /** Name/description of the resource */
  name?: string;
  /** Additional resource metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Main audit event structure
 */
export interface AuditEvent {
  /** Unique identifier for this audit event */
  id: string;
  /** Event type category */
  eventType: AuditEventType;
  /** Specific action performed */
  action: AuditAction;
  /** User who performed the action */
  userId: string;
  /** Username for display purposes */
  username?: string;
  /** Timestamp when event occurred */
  timestamp: Date;
  /** Severity level */
  severity: AuditSeverity;
  /** Outcome of the operation */
  outcome: AuditOutcome;
  /** Human-readable description */
  description: string;
  /** Source information */
  source?: AuditSource;
  /** Resource affected */
  resource?: AuditResource;
  /** Data changes tracked */
  changes?: DataChange[];
  /** Additional context/metadata */
  metadata?: Record<string, unknown>;
  /** Previous hash in chain for tamper detection */
  previousHash?: string;
  /** Hash of this event for chain integrity */
  hash?: string;
  /** Sequence number in the chain */
  sequenceNumber?: number;
  /** Correlation ID for related events */
  correlationId?: string;
}

/**
 * Query parameters for searching audit logs
 */
export interface AuditQueryParams {
  /** Filter by event types */
  eventTypes?: AuditEventType[];
  /** Filter by specific actions */
  actions?: AuditAction[];
  /** Filter by user ID */
  userIds?: string[];
  /** Filter by severity levels */
  severities?: AuditSeverity[];
  /** Filter by outcomes */
  outcomes?: AuditOutcome[];
  /** Start date range (inclusive) */
  startDate?: Date;
  /** End date range (inclusive) */
  endDate?: Date;
  /** Search term for description/metadata */
  searchTerm?: string;
  /** Filter by resource type */
  resourceType?: string;
  /** Filter by resource ID */
  resourceId?: string;
  /** Correlation ID for finding related events */
  correlationId?: string;
  /** Maximum results to return */
  limit?: number;
  /** Number of results to skip (pagination) */
  offset?: number;
  /** Sort field */
  sortBy?: 'timestamp' | 'severity' | 'eventType';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'json';

/**
 * Export options for compliance reports
 */
export interface ExportOptions {
  /** Output format */
  format: ExportFormat;
  /** Query to filter exported data */
  query?: Partial<AuditQueryParams>;
  /** Include hash chain data */
  includeHashChain?: boolean;
  /** Include full metadata */
  includeMetadata?: boolean;
  /** Custom filename (without extension) */
  filename?: string;
  /** Whether to redact sensitive fields */
  redactSensitive?: boolean;
  /** Fields to redact */
  redactedFields?: string[];
}

/**
 * Retention policy configuration
 */
export interface RetentionPolicy {
  /** Policy name/identifier */
  name: string;
  /** Description of the policy */
  description?: string;
  /** Retention period in days */
  retentionDays: number;
  /** Event types this policy applies to */
  appliesToEventTypes?: AuditEventType[];
  /** Minimum severity to retain */
  minSeverity?: AuditSeverity;
  /** Whether to archive before deletion */
  archiveBeforeDelete?: boolean;
  /** Archive destination path */
  archivePath?: string;
  /** Whether policy is active */
  active: boolean;
  /** Created at timestamp */
  createdAt: Date;
  /** Updated at timestamp */
  updatedAt: Date;
}

/**
 * Audit statistics summary
 */
export interface AuditStatistics {
  /** Total number of events */
  totalEvents: number;
  /** Events by type */
  eventsByType: Record<AuditEventType, number>;
  /** Events by severity */
  eventsBySeverity: Record<AuditSeverity, number>;
  /** Events by outcome */
  eventsByOutcome: Record<AuditOutcome, number>;
  /** Events in current time period */
  recentEvents: number;
  /** First event timestamp */
  oldestEvent?: Date;
  /** Last event timestamp */
  newestEvent?: Date;
  /** Chain integrity status */
  chainIntegrity: boolean;
  /** Chain break point (if any) */
  chainBreakPoint?: number;
}

/**
 * Integrity verification result
 */
export interface IntegrityResult {
  /** Overall integrity status */
  valid: boolean;
  /** Total events verified */
  totalEvents: number;
  /** First invalid event (if any) */
  firstInvalidEvent?: AuditEvent;
  /** Index of first invalid event */
  invalidIndex?: number;
  /** Expected vs actual hash mismatch details */
  mismatchDetails?: {
    eventId: string;
    expectedHash: string;
    actualHash: string;
  };
  /** Verification timestamp */
  verifiedAt: Date;
}

// ============== Constants ==============

/** Default retention period in days (7 years for financial compliance) */
const DEFAULT_RETENTION_DAYS = 2555;

/** Maximum events to keep in memory before requiring persistence */
const MAX_IN_MEMORY_EVENTS = 10000;

/** Default hash algorithm used for chain integrity */
const HASH_ALGORITHM = 'SHA-256';

// ============== Audit Log Service Implementation ==============

/**
 * Enterprise-grade Audit Logging Service
 * 
 * Features:
 * - Comprehensive event logging with structured data
 * - Tamper-evident hash chain for integrity verification
 * - Flexible querying and search capabilities
 * - Multiple export formats for compliance
 * - Configurable retention policies
 * - Full data change tracking
 * 
 * @example
 * ```typescript
 * const auditLog = new AuditLogService();
 * 
 * await auditLog.log({
 *   eventType: AuditEventType.TRANSACTION,
 *   action: AuditAction.PAYMENT_INITIATED,
 *   userId: 'user-123',
 *   username: 'john.doe',
 *   description: 'Payment initiated for order #ORD-456',
 *   resource: { type: 'transaction', id: 'txn-789' },
 *   changes: [{ field: 'status', previousValue: null, newValue: 'pending', changeType: 'created' }],
 * });
 * ```
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

  /**
   * Create a new AuditLogService instance
   * @param config Optional configuration overrides
   */
  constructor(config?: {
    defaultRetentionDays?: number;
    maxInMemoryEvents?: number;
    enableAutoCleanup?: boolean;
  }) {
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
   * 
   * @param event The audit event data (without system-managed fields)
   * @returns The complete audit event with generated fields
   * @throws {AppError} If validation fails or service not initialized
   * 
   * @example
   * ```typescript
   * const event = await auditLog.log({
   *   eventType: AuditEventType.AUTHENTICATION,
   *   action: AuditAction.LOGIN,
   *   userId: 'user-123',
   *   username: 'john.doe',
   *   description: 'User logged in successfully',
   *   source: { ipAddress: '192.168.1.1', userAgent: 'Mozilla/5.0...' },
   * });
   * ```
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp' | 'previousHash' | 'hash' | 'sequenceNumber'>): Promise<AuditEvent> {
    if (!this.initialized) {
      throw new AppError('AuditLogService not initialized', ErrorCode.UNKNOWN_ERROR);
    }

    // Validate required fields
    this.validateEventInput(event);

    // Generate unique ID
    const id = this.generateEventId();

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
    completeEvent.hash = this.calculateEventHash(completeEvent);

    // Store the event
    this.events.set(id, completeEvent);
    this.orderedEventIds.push(id);

    // Update last hash for chain
    this.lastHash = completeEvent.hash;

    // Invalidate stats cache
    this.statsCache = null;

    // Log to application logger
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
   * 
   * @param action The authentication action
   * @param userId User identifier
   * @param options Additional options
   * @returns The created audit event
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
    const descriptions: Record<string, string> = {
      [AuditAction.LOGIN]: `User ${options.username || userId} logged in`,
      [AuditAction.LOGOUT]: `User ${options.username || userId} logged out`,
      [AuditAction.LOGIN_FAILED]: `Failed login attempt for ${options.username || userId}`,
      [AuditAction.PASSWORD_CHANGE]: `Password changed for user ${options.username || userId}`,
      [AuditAction.MFA_ENABLED]: `MFA enabled for user ${options.username || userId}`,
      [AuditAction.MFA_DISABLED]: `MFA disabled for user ${options.username || userId}`,
    };

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
   * 
   * @param action The transaction action
   * @param userId User identifier
   * @param transactionId Transaction identifier
   * @param options Additional options
   * @returns The created audit event
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
    const severityMap: Record<string, AuditSeverity> = {
      [AuditAction.PAYMENT_FAILED]: AuditSeverity.WARNING,
      [AuditAction.REFUND_INITIATED]: AuditSeverity.WARNING,
      [AuditAction.PAYMENT_INITIATED]: AuditSeverity.INFO,
      [AuditAction.PAYMENT_COMPLETED]: AuditSeverity.INFO,
      [AuditAction.REFUND_COMPLETED]: AuditSeverity.INFO,
    };

    const descriptions: Record<string, string> = {
      [AuditAction.PAYMENT_INITIATED]: `Payment initiated: ${options.amount ? `${options.amount} ${options.currency}` : transactionId}`,
      [AuditAction.PAYMENT_COMPLETED]: `Payment completed: ${options.amount ? `${options.amount} ${options.currency}` : transactionId}`,
      [AuditAction.PAYMENT_FAILED]: `Payment failed: ${options.amount ? `${options.amount} ${options.currency}` : transactionId}`,
      [AuditAction.REFUND_INITIATED]: `Refund initiated: ${transactionId}`,
      [AuditAction.REFUND_COMPLETED]: `Refund completed: ${transactionId}`,
    };

    return this.log({
      eventType: AuditEventType.TRANSACTION,
      action,
      userId,
      username: options.username,
      severity: severityMap[action] ?? AuditSeverity.INFO,
      outcome: options.outcome ?? (action === AuditAction.PAYMENT_FAILED ? AuditOutcome.FAILURE : AuditOutcome.SUCCESS),
      description: options.description ?? descriptions[action],
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
   * 
   * @param configKey Configuration key that changed
   * @param userId User making the change
   * @param options Additional options
   * @returns The created audit event
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
      resource: {
        type: 'config',
        id: configKey,
      },
      changes: changes.length > 0 ? changes : undefined,
      metadata: options.metadata,
      correlationId: options.correlationId,
    });
  }

  /**
   * Log a data access event (convenience method)
   * 
   * @param action The data access action
   * @param userId User accessing data
   * @param dataType Type of data accessed
   * @param options Additional options
   * @returns The created audit event
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
    const severityMap: Record<string, AuditSeverity> = {
      [AuditAction.DATA_VIEWED]: AuditSeverity.INFO,
      [AuditAction.DATA_EXPORTED]: AuditSeverity.WARNING,
      [AuditAction.DATA_DOWNLOADED]: AuditSeverity.WARNING,
      [AuditAction.REPORT_GENERATED]: AuditSeverity.INFO,
    };

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

  // ============== Query & Search Methods ==============

  /**
   * Search audit logs with flexible filtering
   * 
   * @param params Query parameters for filtering
   * @returns Array of matching audit events
   * 
   * @example
   * ```typescript
   * // Find all failed login attempts in the last 24 hours
   * const results = await auditLog.query({
   *   eventTypes: [AuditEventType.AUTHENTICATION],
   *   actions: [AuditAction.LOGIN_FAILED],
   *   startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
   *   sortOrder: 'desc',
   * });
   * ```
   */
  async query(params: AuditQueryParams = {}): Promise<AuditEvent[]> {
    let results = Array.from(this.events.values());

    // Apply filters
    if (params.eventTypes && params.eventTypes.length > 0) {
      results = results.filter(e => params.eventTypes!.includes(e.eventType));
    }

    if (params.actions && params.actions.length > 0) {
      results = results.filter(e => params.actions!.includes(e.action));
    }

    if (params.userIds && params.userIds.length > 0) {
      results = results.filter(e => params.userIds!.includes(e.userId));
    }

    if (params.severities && params.severities.length > 0) {
      results = results.filter(e => params.severities!.includes(e.severity));
    }

    if (params.outcomes && params.outcomes.length > 0) {
      results = results.filter(e => params.outcomes!.includes(e.outcome));
    }

    if (params.startDate) {
      results = results.filter(e => e.timestamp >= params.startDate!);
    }

    if (params.endDate) {
      results = results.filter(e => e.timestamp <= params.endDate!);
    }

    if (params.searchTerm) {
      const term = params.searchTerm.toLowerCase();
      results = results.filter(e => 
        e.description.toLowerCase().includes(term) ||
        e.userId.toLowerCase().includes(term) ||
        (e.username && e.username.toLowerCase().includes(term)) ||
        (e.metadata && JSON.stringify(e.metadata).toLowerCase().includes(term))
      );
    }

    if (params.resourceType) {
      results = results.filter(e => e.resource?.type === params.resourceType);
    }

    if (params.resourceId) {
      results = results.filter(e => e.resource?.id === params.resourceId);
    }

    if (params.correlationId) {
      results = results.filter(e => e.correlationId === params.correlationId);
    }

    // Sort results
    const sortBy = params.sortBy ?? 'timestamp';
    const sortOrder = params.sortOrder ?? 'desc';

    results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'severity':
          const severityOrder = { [AuditSeverity.EMERGENCY]: 4, [AuditSeverity.CRITICAL]: 3, [AuditSeverity.WARNING]: 2, [AuditSeverity.INFO]: 1 };
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        case 'eventType':
          comparison = a.eventType.localeCompare(b.eventType);
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 100;
    
    results = results.slice(offset, offset + limit);

    logger.debug('Audit query executed', {
      event: 'audit.query',
      metadata: { params, resultCount: results.length },
    });

    return results;
  }

  /**
   * Get a single audit event by ID
   * 
   * @param id The event ID
   * @returns The audit event or null if not found
   */
  async getEventById(id: string): Promise<AuditEvent | null> {
    return this.events.get(id) ?? null;
  }

  /**
   * Get events by correlation ID (related events)
   * 
   * @param correlationId The correlation ID
   * @returns Array of related audit events
   */
  async getEventsByCorrelationId(correlationId: string): Promise<AuditEvent[]> {
    return this.query({ correlationId });
  }

  /**
   * Get events for a specific user
   * 
   * @param userId The user ID
   * @param limit Maximum number of events
   * @returns Array of user's audit events
   */
  async getUserActivity(userId: string, limit: number = 50): Promise<AuditEvent[]> {
    return this.query({ userIds: [userId], limit, sortBy: 'timestamp', sortOrder: 'desc' });
  }

  /**
   * Get events for a specific resource
   * 
   * @param resourceType The resource type
   * @param resourceId The resource ID
   * @returns Array of resource's audit events
   */
  async getResourceHistory(resourceType: string, resourceId: string): Promise<AuditEvent[]> {
    return this.query({ resourceType, resourceId, sortBy: 'timestamp', sortOrder: 'asc' });
  }

  // ============== Statistics Methods ==============

  /**
   * Get comprehensive audit statistics
   * 
   * @returns Statistics summary
   */
  async getStatistics(): Promise<AuditStatistics> {
    if (this.statsCache) {
      return this.statsCache;
    }

    const allEvents = Array.from(this.events.values());
    const totalEvents = allEvents.length;

    // Initialize counters
    const eventsByType = {} as Record<AuditEventType, number>;
    const eventsBySeverity = {} as Record<AuditSeverity, number>;
    const eventsByOutcome = {} as Record<AuditOutcome, number>;

    // Initialize all enum values
    Object.values(AuditEventType).forEach(type => { eventsByType[type] = 0; });
    Object.values(AuditSeverity).forEach(severity => { eventsBySeverity[severity] = 0; });
    Object.values(AuditOutcome).forEach(outcome => { eventsByOutcome[outcome] = 0; });

    // Count events
    let oldestEvent: Date | undefined;
    let newestEvent: Date | undefined;
    let recentEvents = 0;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const event of allEvents) {
      eventsByType[event.eventType]++;
      eventsBySeverity[event.severity]++;
      eventsByOutcome[event.outcome]++;

      if (!oldestEvent || event.timestamp < oldestEvent) {
        oldestEvent = event.timestamp;
      }
      if (!newestEvent || event.timestamp > newestEvent) {
        newestEvent = event.timestamp;
      }
      if (event.timestamp >= oneHourAgo) {
        recentEvents++;
      }
    }

    // Verify chain integrity
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

  // ============== Export Methods ==============

  /**
   * Export audit logs for compliance reporting
   * 
   * @param options Export configuration options
   * @returns Exported data as string
   * 
   * @example
   * ```typescript
   * // Export all transactions from last month as CSV
   * const csvData = await auditLog.export({
   *   format: 'csv',
   *   query: {
   *     eventTypes: [AuditEventType.TRANSACTION],
   *     startDate: new Date('2024-01-01'),
   *     endDate: new Date('2024-01-31'),
   *   },
   * });
   * ```
   */
  async export(options: ExportOptions): Promise<string> {
    const events = await this.query(options.query ?? {});
    
    // Redact sensitive fields if requested
    let processedEvents = events;
    if (options.redactSensitive && options.redactedFields && options.redactedFields.length > 0) {
      processedEvents = this.redactEvents(events, options.redactedFields);
    }

    switch (options.format) {
      case 'csv':
        return this.exportToCSV(processedEvents, options);
      case 'json':
        return this.exportToJSON(processedEvents, options);
      default:
        throw new AppError(`Unsupported export format: ${options.format}`, ErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Export as downloadable file blob
   * 
   * @param options Export configuration options
   * @returns Blob containing the exported data
   */
  async exportAsBlob(options: ExportOptions): Promise<Blob> {
    const data = await this.export(options);
    const mimeType = options.format === 'csv' ? 'text/csv' : 'application/json';
    const filename = options.filename ?? `audit-export-${new Date().toISOString().split('T')[0]}`;
    
    logger.info('Audit export generated', {
      event: 'audit.export',
      metadata: { format: options.format, eventCount: (await this.query(options.query)).length, filename },
    });

    return new Blob([data], { type: mimeType });
  }

  // ============== Integrity & Security Methods ==============

  /**
   * Verify the integrity of the hash chain
   * 
   * Detects any tampering with audit logs by verifying
   * that each event's hash correctly chains to the next.
   * 
   * @returns Integrity verification result
   */
  async verifyIntegrity(): Promise<IntegrityResult> {
    const events = this.orderedEventIds.map(id => this.events.get(id)!).filter(Boolean);

    if (events.length === 0) {
      return {
        valid: true,
        totalEvents: 0,
        verifiedAt: new Date(),
      };
    }

    // Verify chain from beginning
    let expectedPreviousHash = '';
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Check previous hash linkage
      if (event.previousHash !== expectedPreviousHash) {
        return {
          valid: false,
          totalEvents: events.length,
          firstInvalidEvent: event,
          invalidIndex: i,
          mismatchDetails: {
            eventId: event.id,
            expectedHash: expectedPreviousHash,
            actualHash: event.previousHash ?? '',
          },
          verifiedAt: new Date(),
        };
      }

      // Recalculate and verify event hash
      const calculatedHash = this.calculateEventHash({ ...event, hash: undefined });
      if (event.hash !== calculatedHash) {
        return {
          valid: false,
          totalEvents: events.length,
          firstInvalidEvent: event,
          invalidIndex: i,
          mismatchDetails: {
            eventId: event.id,
            expectedHash: calculatedHash,
            actualHash: event.hash ?? '',
          },
          verifiedAt: new Date(),
        };
      }

      expectedPreviousHash = event.hash;
    }

    return {
      valid: true,
      totalEvents: events.length,
      verifiedAt: new Date(),
    };
  }

  /**
   * Get the current chain head (latest hash)
   * 
   * @returns Current hash chain head
   */
  getChainHead(): string {
    return this.lastHash;
  }

  /**
   * Get the current sequence number
   * 
   * @returns Current sequence number
   */
  getSequenceNumber(): number {
    return this.sequenceNumber;
  }

  // ============== Retention Policy Methods ==============

  /**
   * Add a custom retention policy
   * 
   * @param policy The retention policy to add
   * @returns The added policy
   */
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

  /**
   * Get all retention policies
   * 
   * @returns Array of retention policies
   */
  getRetentionPolicies(): RetentionPolicy[] {
    return [...this.retentionPolicies];
  }

  /**
   * Remove a retention policy by name
   * 
   * @param name Policy name to remove
   * @returns True if removed, false if not found
   */
  removeRetentionPolicy(name: string): boolean {
    const index = this.retentionPolicies.findIndex(p => p.name === name);
    if (index === -1) {
      return false;
    }

    this.retentionPolicies.splice(index, 1);
    this.statsCache = null;

    logger.info('Retention policy removed', {
      event: 'audit.retension.policy_removed',
      metadata: { policyName: name },
    });

    return true;
  }

  /**
   * Apply retention policies to purge old events
   * 
   * @returns Number of events purged
   */
  async applyRetentionPolicies(): Promise<number> {
    const now = new Date();
    let totalPurged = 0;

    for (const policy of this.retentionPolicies.filter(p => p.active)) {
      const cutoffDate = new Date(now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);
      
      const eventsToPurge: string[] = [];
      
      for (const [id, event] of this.events.entries()) {
        // Check if policy applies to this event type
        if (policy.appliesToEventTypes && !policy.appliesToEventTypes.includes(event.eventType)) {
          continue;
        }

        // Check minimum severity
        if (policy.minSeverity) {
          const severityLevels = [AuditSeverity.INFO, AuditSeverity.WARNING, AuditSeverity.CRITICAL, AuditSeverity.EMERGENCY];
          const eventLevel = severityLevels.indexOf(event.severity);
          const minLevel = severityLevels.indexOf(policy.minSeverity);
          if (eventLevel < minLevel) {
            continue;
          }
        }

        // Check age
        if (event.timestamp < cutoffDate) {
          eventsToPurge.push(id);
        }
      }

      // Purge events
      for (const id of eventsToPurge) {
        this.events.delete(id);
        const idx = this.orderedEventIds.indexOf(id);
        if (idx !== -1) {
          this.orderedEventIds.splice(idx, 1);
        }
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

  /**
   * Clear all audit events (use with caution)
   * 
   * @param reason Reason for clearing (for audit trail of the clear itself)
   * @throws {AppError} If reason not provided
   */
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

  /**
   * Get the total count of stored events
   * 
   * @returns Number of stored events
   */
  getCount(): number {
    return this.events.size;
  }

  /**
   * Destroy the service instance and clean up resources
   */
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

  // ============== Private Helper Methods ==============

  /**
   * Generate a unique event ID
   * 
   * @returns Unique identifier string
   */
  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    const seqPart = this.sequenceNumber.toString(36).padStart(6, '0');
    return `AUD-${timestamp}-${randomPart}-${seqPart}`;
  }

  /**
   * Calculate SHA-256 hash of an event for chain integrity
   * 
   * @param event The event to hash
   * @returns Hex-encoded hash string
   */
  private calculateEventHash(event: Partial<AuditEvent>): string {
    // Create canonical representation for hashing
    const canonical = [
      event.id,
      event.eventType,
      event.action,
      event.userId,
      event.timestamp?.toISOString(),
      event.severity,
      event.outcome,
      event.description,
      event.previousHash,
      event.sequenceNumber,
      JSON.stringify(event.changes ?? {}),
      JSON.stringify(event.metadata ?? {}),
    ].join('|');

    // Simple hash implementation (in production, use crypto.subtle)
    return this.simpleHash(canonical);
  }

  /**
   * Simple hash function for demo purposes
   * In production, replace with crypto.subtle.digest
   * 
   * @param input String to hash
   * @returns Hash string
   */
  private simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to hex string
    const hashStr = Math.abs(hash).toString(16).padStart(8, '0');
    
    // Add some entropy based on content length and timestamp
    const extraEntropy = (input.length * 31 + Date.now()).toString(16);
    
    return `${hashStr}-${extraEntropy.substring(0, 8)}-${btoa(input.substring(0, 32)).substring(0, 8)}`;
  }

  /**
   * Validate event input data
   * 
   * @param event Event data to validate
   * @throws {AppError} If validation fails
   */
  private validateEventInput(event: Omit<AuditEvent, 'id' | 'timestamp' | 'previousHash' | 'hash' | 'sequenceNumber'>): void {
    if (!event.eventType || !Object.values(AuditEventType).includes(event.eventType)) {
      throw new AppError('Invalid or missing eventType', ErrorCode.VALIDATION_ERROR, { context: { eventType: event.eventType } });
    }

    if (!event.action || !Object.values(AuditAction).includes(event.action)) {
      throw new AppError('Invalid or missing action', ErrorCode.VALIDATION_ERROR, { context: { action: event.action } });
    }

    if (!event.userId || typeof event.userId !== 'string' || event.userId.trim().length === 0) {
      throw new AppError('userId is required and must be a non-empty string', ErrorCode.VALIDATION_ERROR);
    }

    if (!event.severity || !Object.values(AuditSeverity).includes(event.severity)) {
      throw new AppError('Invalid or missing severity', ErrorCode.VALIDATION_ERROR, { context: { severity: event.severity } });
    }

    if (!event.outcome || !Object.values(AuditOutcome).includes(event.outcome)) {
      throw new AppError('Invalid or missing outcome', ErrorCode.VALIDATION_ERROR, { context: { outcome: event.outcome } });
    }

    if (!event.description || typeof event.description !== 'string' || event.description.trim().length === 0) {
      throw new AppError('description is required and must be a non-empty string', ErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Export events to CSV format
   * 
   * @param events Events to export
   * @param options Export options
   * @returns CSV formatted string
   */
  private exportToCSV(events: AuditEvent[], options: ExportOptions): string {
    const headers = [
      'id',
      'timestamp',
      'eventType',
      'action',
      'userId',
      'username',
      'severity',
      'outcome',
      'description',
      'resourceType',
      'resourceId',
      'sourceIpAddress',
      'correlationId',
      ...(options.includeHashChain ? ['sequenceNumber', 'previousHash', 'hash'] : []),
      ...(options.includeMetadata ? ['metadata'] : []),
    ];

    const rows = events.map(event => [
      this.csvEscape(event.id),
      event.timestamp.toISOString(),
      event.eventType,
      event.action,
      this.csvEscape(event.userId),
      this.csvEscape(event.username ?? ''),
      event.severity,
      event.outcome,
      this.csvEscape(event.description),
      event.resource?.type ?? '',
      event.resource?.id ?? '',
      event.source?.ipAddress ?? '',
      event.correlationId ?? '',
      ...(options.includeHashChain ? [event.sequenceNumber ?? '', event.previousHash ?? '', event.hash ?? ''] : []),
      ...(options.includeMetadata ? [this.csvEscape(JSON.stringify(event.metadata ?? {}))] : []),
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Export events to JSON format
   * 
   * @param events Events to export
   * @param options Export options
   * @returns JSON formatted string
   */
  private exportToJSON(events: AuditEvent[], options: ExportOptions): string {
    let processedEvents = events;

    if (!options.includeMetadata) {
      processedEvents = events.map(({ metadata, ...rest }) => rest);
    }

    if (!options.includeHashChain) {
      processedEvents = processedEvents.map(({ previousHash, hash, sequenceNumber, ...rest }) => rest);
    }

    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      totalRecords: processedEvents.length,
      events: processedEvents,
    }, null, 2);
  }

  /**
   * Escape a value for CSV output
   * 
   * @param value Value to escape
   * @returns Escaped CSV value
   */
  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Redact sensitive fields from events
   * 
   * @param events Events to process
   * @param fields Fields to redact
   * @returns Redacted events
   */
  private redactEvents(events: AuditEvent[], fields: string[]): AuditEvent[] {
    return events.map(event => {
      const redacted = { ...event };
      
      // Redact from metadata
      if (redacted.metadata) {
        redacted.metadata = { ...redacted.metadata };
        for (const field of fields) {
          if (field in redacted.metadata) {
            (redacted.metadata as Record<string, unknown>)[field] = '[REDACTED]';
          }
        }
      }

      // Redact from changes
      if (redacted.changes) {
        redacted.changes = redacted.changes.map(change => {
          if (fields.includes(change.field)) {
            return {
              ...change,
              previousValue: '[REDACTED]',
              newValue: '[REDACTED]',
            };
          }
          return change;
        });
      }

      // Redact from source
      if (redacted.source) {
        redacted.source = { ...redacted.source };
        for (const field of fields) {
          if (field in redacted.source) {
            (redacted.source as Record<string, unknown>)[field] = '[REDACTED]';
          }
        }
      }

      return redacted;
    });
  }
}

// ============== Singleton Instance ==============

/** Default application-wide audit log instance */
export const auditLog = new AuditLogService();

// ============== Exports ==============

export default AuditLogService;
