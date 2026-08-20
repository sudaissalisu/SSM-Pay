/**
 * @module services/audit-log
 * 
 * Re-exports from the audit-log module for backward compatibility.
 * The actual implementation has been split into focused sub-modules.
 */

export {
  AuditLogService,
  auditLog,
  // Enums
  AuditEventType,
  AuditAction,
  AuditSeverity,
  AuditOutcome,
  // Interfaces
  DataChange,
  AuditSource,
  AuditResource,
  AuditEvent,
  AuditQueryParams,
  ExportFormat,
  ExportOptions,
  RetentionPolicy,
  AuditStatistics,
  IntegrityResult,
  // Classes
  AuditEventLogger,
  AuditQueryManager,
  AuditExportManager,
  AuditIntegrityManager,
  // Constants
  HASH_ALGORITHM,
} from './audit-log/index';

export { default } from './audit-log/index';
