/**
 * Audit Event Logger
 * Handles creation and storage of audit log entries
 */

import {
  AuditAction,
  AuditActor,
  ActorType,
  AuditLogEntry,
} from './types';

/** In-memory audit log store (would be database in production) */
type AuditStore = Map<string, AuditLogEntry>;

/** Event logger configuration */
export interface AuditLoggerConfig {
  /** Enable/disable logging */
  enabled: boolean;
  /** Maximum entries to retain in memory */
  maxEntries: number;
  /** Whether to include request context automatically */
  autoCaptureContext: boolean;
  /** Default severity level */
  defaultSeverity: 'info' | 'low' | 'medium' | 'high' | 'critical';
}

/** Default configuration */
const DEFAULT_CONFIG: AuditLoggerConfig = {
  enabled: true,
  maxEntries: 100000,
  autoCaptureContext: true,
  defaultSeverity: 'info',
};

/** Context captured from current request (if available) */
interface RequestContext {
  requestId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * AuditLogger - Central service for creating audit log entries
 */
export class AuditLogger {
  private config: AuditLoggerConfig;
  private store: AuditStore = new Map();
  private idCounter: number = 0;

  constructor(config: Partial<AuditLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Log a generic audit event
   * @param entry - The audit log entry data (id/timestamp will be generated)
   * @returns The created audit log entry
   */
  async logEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
    if (!this.config.enabled) {
      return this.createEmptyEntry(entry);
    }

    const fullEntry: AuditLogEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    };

    // Store the entry
    this.store.set(fullEntry.id, fullEntry);

    // Enforce retention limit
    this.enforceRetention();

    console.log(
      `[Audit] ${entry.action} by ${entry.actor.type}:${entry.actor.id} - ${entry.description}`
    );

    return fullEntry;
  }

  /**
   * Log a user action with simplified parameters
   * @param action - Type of action performed
   * @param actor - Who performed the action
   * @param resourceType - Type of resource affected
   * @param description - Human-readable description
   * @param options - Additional options
   * @returns Created audit entry
   */
  async logAction(
    action: AuditAction,
    actor: AuditActor | { id: string; type: ActorType },
    resourceType: string,
    description: string,
    options: {
      resourceId?: string;
      outcome?: 'success' | 'failure' | 'partial';
      metadata?: Record<string, unknown>;
      errorMessage?: string;
      severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';
    } = {}
  ): Promise<AuditLogEntry> {
    const actorData: AuditActor = 'displayName' in actor ? actor as AuditActor : {
      id: actor.id,
      type: actor.type,
    };

    return this.logEvent({
      action,
      actor: actorData,
      resourceType,
      resourceId: options.resourceId,
      description,
      outcome: options.outcome || 'success',
      metadata: options.metadata || {},
      errorMessage: options.errorMessage,
      severity: options.severity || this.config.defaultSeverity,
    });
  }

  /**
   * Log an access/authorization event
   * @param actor - User or system accessing resources
   * @param resourceType - What was accessed
   * @param resourceId - Specific resource ID
   * @param action - Type of access (read, write, delete)
   * @param granted - Whether access was allowed
   * @returns Created audit entry
   */
  async logAccess(
    actor: AuditActor | { id: string; type: ActorType },
    resourceType: string,
    resourceId: string,
    action: 'read' | 'write' | 'delete',
    granted: boolean,
    metadata?: Record<string, unknown>
  ): Promise<AuditLogEntry> {
    const actorData: AuditActor = 'displayName' in actor ? actor as AuditActor : {
      id: actor.id,
      type: actor.type,
    };

    return this.logEvent({
      action: AuditAction.DATA_ACCESSED,
      actor: actorData,
      resourceType,
      resourceId,
      description: `${actorData.id} ${action}d ${resourceType}/${resourceId}`,
      outcome: granted ? 'success' : 'failure',
      metadata: {
        ...metadata,
        access_type: action,
        granted,
      },
      severity: granted ? 'info' : 'medium',
      errorMessage: granted ? undefined : `Access denied: ${action} on ${resourceType}`,
    });
  }

  /**
   * Log a system-level event (config changes, etc.)
   * @param action - System action that occurred
   * @param description - Description of what changed
   * @param previousValue - Value before change
   * @param newValue - Value after change
   * @param actor - Who made the change
   * @returns Created audit entry
   */
  async logSystemEvent(
    action: AuditAction,
    description: string,
    previousValue: unknown,
    newValue: unknown,
    actor?: AuditActor | { id: string; type: ActorType }
  ): Promise<AuditLogEntry> {
    const actorData: AuditActor = actor && 'displayName' in actor
      ? actor as AuditActor
      : actor
        ? { id: actor.id, type: actor.type }
        : { id: 'system', type: ActorType.SERVICE };

    return this.logEvent({
      action,
      actor: actorData,
      resourceType: 'system_config',
      description,
      outcome: 'success',
      metadata: {
        previous_value: previousValue,
        new_value: newValue,
      },
      severity: 'high',
    });
  }

  /**
   * Log a payment-related event (convenience method)
   */
  async logPaymentEvent(
    action: AuditAction.PAYMENT_CREATED |
      AuditAction.PAYMENT_CAPTURED |
      AuditAction.PAYMENT_REFUNDED |
      AuditAction.PAYMENT_VOIDED |
      AuditAction.PAYMENT_FAILED,
    actor: AuditActor,
    paymentId: string,
    amount: number,
    currency: string,
    outcome: 'success' | 'failure',
    error?: string
  ): Promise<AuditLogEntry> {
    return this.logEvent({
      action,
      actor,
      resourceType: 'payment',
      resourceId: paymentId,
      description: `Payment ${action.split('.')[1]}: ${amount} ${currency}`,
      outcome,
      metadata: { amount, currency },
      errorMessage: error,
      severity: outcome === 'failure' ? 'high' : 'info',
    });
  }

  /**
   * Log an authentication event (convenience method)
   */
  async logAuthEvent(
    action: AuditAction.LOGIN |
      AuditAction.LOGOUT |
      AuditAction.LOGIN_FAILED |
      AuditAction.PASSWORD_CHANGED,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    success: boolean = true,
    error?: string
  ): Promise<AuditLogEntry> {
    return this.logEvent({
      action,
      actor: {
        id: userId,
        type: ActorType.USER,
        ipAddress,
        userAgent,
      },
      resourceType: 'session',
      description: `${action.split('.').join(' ')} for user ${userId}`,
      outcome: success ? 'success' : 'failure',
      errorMessage: error,
      severity: !success ? 'high' : 'info',
    });
  }

  /**
   * Get a single log entry by ID
   */
  getEntry(id: string): AuditLogEntry | undefined {
    return this.store.get(id);
  }

  /**
   * Get all stored entries (use carefully - could be large)
   */
  getAllEntries(): AuditLogEntry[] {
    return Array.from(this.store.values());
  }

  /**
   * Get total count of entries
   */
  getCount(): number {
    return this.store.size;
  }

  /**
   * Clear all entries (for testing/admin use)
   */
  clear(): void {
    this.store.clear();
    console.log('[Audit] All entries cleared');
  }

  /**
   * Generate unique entry ID
   */
  private generateId(): string {
    this.idCounter += 1;
    return `audit_${Date.now()}_${this.idCounter.toString(36)}`;
  }

  /**
   * Enforce maximum retention limit
   */
  private enforceRetention(): void {
    if (this.store.size <= this.config.maxEntries) return;

    // Remove oldest entries (Map maintains insertion order in JS)
    let removed = 0;
    while (this.store.size > this.config.maxEntries && removed < 1000) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) {
        this.store.delete(firstKey);
        removed++;
      }
    }
  }

  /**
   * Create empty entry when logging is disabled
   */
  private createEmptyEntry(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    return {
      ...entry,
      id: '',
      timestamp: new Date().toISOString(),
    };
  }
}
