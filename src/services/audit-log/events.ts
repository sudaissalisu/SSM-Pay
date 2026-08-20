/**
 * Audit Log Events Module
 * 
 * Provides event type definitions, logging methods,
 * and convenience functions for common audit operations.
 * 
 * @module services/audit-log/events
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Type Definitions (Enums) ==============

/**
 * Audit event categories for classification
 */
export enum AuditEventType {
  AUTHENTICATION = 'AUTHENTICATION',
  TRANSACTION = 'TRANSACTION',
  CONFIGURATION = 'CONFIGURATION',
  DATA_ACCESS = 'DATA_ACCESS',
  SYSTEM = 'SYSTEM',
  ADMIN = 'ADMIN',
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
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
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

// ============== Type Definitions (Interfaces) ==============

/**
 * Data change record for tracking modifications
 */
export interface DataChange {
  field: string;
  previousValue: unknown;
  newValue: unknown;
  changeType: 'created' | 'updated' | 'deleted' | 'unchanged';
}

/**
 * Source information for the audit event
 */
export interface AuditSource {
  ipAddress?: string;
  userAgent?: string;
  country?: string;
  deviceId?: string;
  sessionId?: string;
  requestId?: string;
  endpoint?: string;
  httpMethod?: string;
}

/**
 * Resource being acted upon
 */
export interface AuditResource {
  type: string;
  id: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

// ============== Event Logger Class ==============

/**
 * Audit Event Logger
 * 
 * Handles core audit event logging functionality.
 */
export class AuditEventLogger {
  /**
   * Validate event input data
   */
  validateEventInput(event: Omit<import('./index').AuditEvent, 'id' | 'timestamp' | 'previousHash' | 'hash' | 'sequenceNumber'>): void {
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
   * Generate a unique event ID
   */
  generateEventId(sequenceNumber?: number): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    const seqPart = (sequenceNumber ?? 0).toString(36).padStart(6, '0');
    return `AUD-${timestamp}-${randomPart}-${seqPart}`;
  }

  /**
   * Get description map for authentication events
   */
  getAuthDescriptions(): Record<string, string> {
    return {
      [AuditAction.LOGIN]: 'User logged in',
      [AuditAction.LOGOUT]: 'User logged out',
      [AuditAction.LOGIN_FAILED]: 'Failed login attempt',
      [AuditAction.PASSWORD_CHANGE]: 'Password changed',
      [AuditAction.MFA_ENABLED]: 'MFA enabled',
      [AuditAction.MFA_DISABLED]: 'MFA disabled',
      [AuditAction.TOKEN_REFRESH]: 'Token refreshed',
    };
  }

  /**
   * Get severity map for transaction events
   */
  getTransactionSeverityMap(): Record<string, AuditSeverity> {
    return {
      [AuditAction.PAYMENT_FAILED]: AuditSeverity.WARNING,
      [AuditAction.REFUND_INITIATED]: AuditSeverity.WARNING,
      [AuditAction.PAYMENT_INITIATED]: AuditSeverity.INFO,
      [AuditAction.PAYMENT_COMPLETED]: AuditSeverity.INFO,
      [AuditAction.REFUND_COMPLETED]: AuditSeverity.INFO,
    };
  }

  /**
   * Get descriptions for transaction events
   */
  getTransactionDescriptions(): Record<string, (opts?: { amount?: number; currency?: string }) => string> {
    return {
      [AuditAction.PAYMENT_INITIATED]: (opts) => `Payment initiated: ${opts?.amount ? `${opts.amount} ${opts?.currency}` : ''}`,
      [AuditAction.PAYMENT_COMPLETED]: (opts) => `Payment completed: ${opts?.amount ? `${opts.amount} ${opts?.currency}` : ''}`,
      [AuditAction.PAYMENT_FAILED]: (opts) => `Payment failed: ${opts?.amount ? `${opts.amount} ${opts?.currency}` : ''}`,
      [AuditAction.REFUND_INITIATED]: () => 'Refund initiated',
      [AuditAction.REFUND_COMPLETED]: () => 'Refund completed',
    };
  }

  /**
   * Get severity map for data access events
   */
  getDataAccessSeverityMap(): Record<string, AuditSeverity> {
    return {
      [AuditAction.DATA_VIEWED]: AuditSeverity.INFO,
      [AuditAction.DATA_EXPORTED]: AuditSeverity.WARNING,
      [AuditAction.DATA_DOWNLOADED]: AuditSeverity.WARNING,
      [AuditAction.REPORT_GENERATED]: AuditSeverity.INFO,
    };
  }
}
