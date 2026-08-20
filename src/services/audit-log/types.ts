/**
 * Audit Log Types for SSM-Pay Payment Platform
 * Defines interfaces for audit events, queries, and exports
 */

/** Types of audit actions that can be logged */
export enum AuditAction {
  // Payment operations
  PAYMENT_CREATED = 'payment.created',
  PAYMENT_CAPTURED = 'payment.captured',
  PAYMENT_REFUNDED = 'payment.refunded',
  PAYMENT_VOIDED = 'payment.voided',
  PAYMENT_FAILED = 'payment.failed',

  // Refund operations
  REFUND_INITIATED = 'refund.initiated',
  REFUND_PROCESSED = 'refund.processed',
  REFUND_CANCELLED = 'refund.cancelled',

  // Dispute operations
  DISPUTE_OPENED = 'dispute.opened',
  DISPUTE_RESPONDED = 'dispute.responded',
  DISPUTE_WON = 'dispute.won',
  DISPUTE_LOST = 'dispute.lost',

  // Authentication & Authorization
  LOGIN = 'auth.login',
  LOGOUT = 'auth.logout',
  LOGIN_FAILED = 'auth.login_failed',
  PASSWORD_CHANGED = 'auth.password_changed',
  MFA_ENABLED = 'auth.mfa_enabled',
  MFA_DISABLED = 'auth.mfa_disabled',
  TOKEN_REFRESHED = 'auth.token_refreshed',
  SESSION_EXPIRED = 'auth.session_expired',

  // User management
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_ROLE_CHANGED = 'user.role_changed',
  PERMISSION_GRANTED = 'permission.granted',
  PERMISSION_REVOKED = 'permission.revoked',

  // Configuration changes
  CONFIG_UPDATED = 'config.updated',
  WEBHOOK_CONFIGURED = 'webhook.configured',
  API_KEY_CREATED = 'api_key.created',
  API_KEY_REVOKED = 'api_key.revoked',
  RATE_LIMIT_CHANGED = 'rate_limit.changed',

  // Data access
  DATA_EXPORTED = 'data.exported',
  DATA_IMPORTED = 'data.imported',
  REPORT_GENERATED = 'report.generated',
  DATA_ACCESSED = 'data.accessed',

  // System operations
  SYSTEM_SETTINGS_CHANGED = 'system.settings_changed',
  INTEGRATION_CONNECTED = 'integration.connected',
  INTEGRATION_DISCONNECTED = 'integration.disconnected',
}

/** Types of actors who perform audit actions */
export enum ActorType {
  /** Human user */
  USER = 'user',
  /** Service/system account */
  SERVICE = 'service',
  /** API key or integration */
  API_KEY = 'api_key',
  /** Automated process/cron job */
  AUTOMATION = 'automation',
  /** Anonymous/unauthenticated */
  ANONYMOUS = 'anonymous',
}

/** Actor information for audit log entries */
export interface AuditActor {
  /** Unique actor identifier (user ID, service name, etc.) */
  id: string;
  /** Type of actor */
  type: ActorType;
  /** Display name (if applicable) */
  displayName?: string;
  /** Email address (for user actors) */
  email?: string;
  /** IP address of the request */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
}

/** Main audit log entry structure */
export interface AuditLogEntry {
  /** Unique entry identifier */
  id: string;
  /** The action that was performed */
  action: AuditAction;
  /** Who performed the action */
  actor: AuditActor;
  /** Resource type that was acted upon */
  resourceType: string;
  /** Specific resource ID (if applicable) */
  resourceId?: string;
  /** Description of what happened */
  description: string;
  /** ISO 8601 timestamp of when the event occurred */
  timestamp: string;
  /** Additional context/metadata about the event */
  metadata: Record<string, unknown>;
  /** Outcome of the action */
  outcome: 'success' | 'failure' | 'partial';
  /** Error message if applicable */
  errorMessage?: string;
  /** Request ID for tracing */
  requestId?: string;
  /** Session ID if applicable */
  sessionId?: string;
  /** Severity level */
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
}

/** Query parameters for filtering audit logs */
export interface AuditQuery {
  /** Filter by action types */
  actions?: AuditAction[];
  /** Filter by actor ID */
  actorId?: string;
  /** Filter by actor type */
  actorType?: ActorType;
  /** Filter by resource type */
  resourceType?: string;
  /** Filter by resource ID */
  resourceId?: string;
  /** Filter by outcome */
  outcome?: 'success' | 'failure' | 'partial';
  /** Filter by severity */
  severity?: Array<'info' | 'low' | 'medium' | 'high' | 'critical'>;
  /** Start date filter (ISO 8601) */
  dateFrom?: string;
  /** End date filter (ISO 8601) */
  dateTo?: string;
  /** Search term in description */
  search?: string;
  /** Maximum results to return */
  limit?: number;
  /** Number of results to skip (for pagination) */
  offset?: number;
  /** Sort field */
  sortBy?: 'timestamp' | 'action' | 'severity';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/** Paginated query result */
export interface AuditQueryResult {
  /** Matching entries */
  entries: AuditLogEntry[];
  /** Total matching entries (before pagination) */
  totalCount: number;
  /** Current page number (1-based) */
  page: number;
  /** Page size */
  pageSize: number;
  /** Total pages */
  totalPages: number;
  /** Whether there are more pages */
  hasMore: boolean;
  /** Query execution time in milliseconds */
  queryTimeMs: number;
}

/** Export format options */
export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  PDF = 'pdf',
}

/** Export options */
export interface ExportOptions {
  /** Format to export as */
  format: ExportFormat;
  /** Query to filter exported data */
  query?: Partial<AuditQuery>;
  /** Include headers in export */
  includeHeaders: boolean;
  /** Filename (without extension) */
  filename?: string;
  /** Date range for filename suffix */
  includeDateInFilename: boolean;
  /** Compress output */
  compress: boolean;
}

/** Export result */
export interface ExportResult {
  /** Generated file content (base64 for binary formats) */
  content: string | Record<string, unknown>[];
  /** MIME type of the content */
  mimeType: string;
  /** Suggested filename */
  filename: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Number of records exported */
  recordCount: number;
  /** Generation timestamp */
  generatedAt: string;
}

/** Audit statistics summary */
export interface AuditStats {
  /** Total log entries */
  totalEntries: number;
  /** Entries by action type */
  byAction: Record<AuditAction, number>;
  /** Entries by actor type */
  byActorType: Record<ActorType, number>;
  /** Entries by outcome */
  byOutcome: Record<string, number>;
  /** Entries by severity */
  bySeverity: Record<string, number>;
  /** Date range of logs */
  dateRange: { earliest: string; latest: string };
}
