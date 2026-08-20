/**
 * SSM-Pay Audit Log Service Module
 * Public API for audit logging, querying, and exporting
 *
 * @example
 * ```typescript
 * import {
 *   AuditService,
 *   AuditAction,
 *   ActorType,
 *   ExportFormat,
 * } from '@/services/audit-log';
 *
 * const audit = new AuditService();
 *
 * // Log an action
 * await audit.logAction(AuditAction.PAYMENT_CREATED, {
 *   id: 'user_123',
 *   type: ActorType.USER,
 * }, 'payment', 'Created payment of $100.00');
 *
 * // Query logs
 * const results = await audit.query({
 *   actions: [AuditAction.PAYMENT_CREATED],
 *   limit: 50,
 * });
 *
 * // Export to CSV
 * const exportResult = await audit.export({ format: ExportFormat.CSV });
 * ```
 */

// Type exports
export type {
  AuditLogEntry,
  AuditActor,
  AuditQuery,
  AuditQueryResult,
  ExportOptions,
  ExportResult,
  AuditStats,
} from './types';

export {
  AuditAction,
  ActorType,
  ExportFormat,
} from './types';

// Event logger
export { AuditLogger } from './events';
export type { AuditLoggerConfig } from './events';

// Query service
export { AuditQueryService } from './query';
export type { QueryServiceConfig } from './query';

// Export service
export { AuditExporter } from './export';

/**
 * Main AuditService facade combining all audit log functionality
 */
import { AuditLogger } from './events';
import { AuditQueryService } from './query';
import { AuditExporter } from './export';
import {
  AuditLogEntry,
  AuditQuery,
  AuditAction,
  ActorType,
  ExportFormat,
  ExportOptions,
} from './types';

/** Audit service configuration */
export interface AuditServiceConfig {
  /** Logger configuration */
  logger?: Partial<import('./events').AuditLoggerConfig>;
  /** Query service configuration */
  query?: Partial<QueryServiceConfig>;
}

/**
 * SSM-Pay Audit Service - Unified entry point for all audit functionality
 */
export class AuditService {
  readonly logger: AuditLogger;
  readonly query: AuditQueryService;
  readonly exporter: AuditExporter;

  constructor(config: AuditServiceConfig = {}) {
    this.logger = new AuditLogger(config.logger);
    this.query = new AuditQueryService(this.logger, config.query);
    this.exporter = new AuditExporter(this.query);
  }

  /**
   * Log a generic audit event
   * @param entry - Entry data (id/timestamp auto-generated)
   * @returns Created entry
   */
  async logEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
    return this.logger.logEvent(entry);
  }

  /**
   * Log an action with simplified parameters
   */
  async logAction(
    action: AuditAction,
    actor: { id: string; type: ActorType; displayName?: string },
    resourceType: string,
    description: string,
    options?: {
      resourceId?: string;
      outcome?: 'success' | 'failure' | 'partial';
      metadata?: Record<string, unknown>;
      errorMessage?: string;
      severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<AuditLogEntry> {
    return this.logger.logAction(action, actor, resourceType, description, options);
  }

  /**
   * Log a data access event
   */
  async logAccess(
    actor: { id: string; type: ActorType },
    resourceType: string,
    resourceId: string,
    accessType: 'read' | 'write' | 'delete',
    granted: boolean,
    metadata?: Record<string, unknown>
  ): Promise<AuditLogEntry> {
    return this.logger.logAccess(actor, resourceType, resourceId, accessType, granted, metadata);
  }

  /**
   * Log a system/configuration change event
   */
  async logSystemEvent(
    action: AuditAction,
    description: string,
    previousValue: unknown,
    newValue: unknown,
    actor?: { id: string; type: ActorType }
  ): Promise<AuditLogEntry> {
    return this.logger.logSystemEvent(action, description, previousValue, newValue, actor);
  }

  /**
   * Query audit logs with filters and pagination
   */
  async queryLogs(query?: Partial<AuditQuery>): Promise<import('./types').AuditQueryResult> {
    return this.query.queryLogs(query || {});
  }

  /**
   * Get audit log statistics
   */
  getStatistics(): ReturnType<AuditQueryService['getStatistics']> {
    return this.query.getStatistics();
  }

  /**
   * Export audit logs to specified format
   */
  async export(options: ExportOptions): Promise<import('./types').ExportResult> {
    return this.exporter.export(options);
  }

  /**
   * Generate summary report of audit activity
   */
  async generateReport(dateFrom?: string, dateTo?: string): Promise<
    ReturnType<AuditExporter['generateReport']> extends Promise<infer T> ? T : never
  > {
    return this.exporter.generateReport(dateFrom, dateTo);
  }

  /**
   * Get total count of logged entries
   */
  getCount(): number {
    return this.logger.getCount();
  }

  /**
   * Clear all audit entries (admin only)
   */
  clear(): void {
    this.logger.clear();
  }
}

// Singleton instance for convenience
let defaultInstance: AuditService | null = null;

/**
 * Get or create the default AuditService instance
 * @returns Shared AuditService instance
 */
export function getDefaultAuditService(config?: AuditServiceConfig): AuditService {
  if (!defaultInstance) {
    defaultInstance = new AuditService(config);
  }
  return defaultInstance;
}
