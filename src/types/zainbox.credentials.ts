/**
 * @fileoverview Zainbox credentials and configuration type definitions
 * @description Contains ZainboxCredentials, ZainboxConfig, and permission types
 * @module types/zainbox/credentials
 */

// ============================================================================
// PERMISSION ENUM
// ============================================================================

/**
 * Permission levels for Zainbox API access.
 *
 * @enum {string}
 */
export enum ZainboxPermission {
  /** Read-only access */
  READ = 'read',
  /** Write/create access */
  WRITE = 'write',
  /** Delete access */
  DELETE = 'delete',
  /** Admin/full access */
  ADMIN = 'admin',
  /** Transfer/initiate payouts */
  TRANSFER = 'transfer',
  /** View reports/analytics */
  REPORTS = 'reports',
  /** Manage settings/config */
  SETTINGS = 'settings'
}

// ============================================================================
// CREDENTIALS INTERFACE
// ============================================================================

/**
 * Credentials and authentication details for Zainbox access.
 *
 * @interface ZainboxCredentials
 */
export interface ZainboxCredentials {
  /** Public key for client-side operations */
  publicKey: string;
  /** Secret key (masked/partially shown) */
  secretKeyMasked: string;
  /** Secret key last 4 characters */
  secretKeyLast4: string;
  /** Whether secret key has been set */
  hasSecretKey: boolean;
  /** Encryption key for sensitive data */
  encryptionKeyId: string;
  /** Webhook signing key */
  webhookSigningKey: string;
  /** Webhook signing key last 4 */
  webhookSigningKeyLast4: string;
  /** API keys for programmatic access */
  apiKeys: Array<{
    /** Key identifier */
    keyId: string;
    /** Key name/label */
    name: string;
    /** Masked key value */
    keyMasked: string;
    /** Key permissions */
    permissions: ZainboxPermission[];
    /** Creation date */
    createdAt: Date;
    /** Last used date */
    lastUsedAt?: Date;
    /** Expiration date */
    expiresAt?: Date;
    /** Active status */
    isActive: boolean;
  }>;
  /** IP whitelist for API access */
  ipWhitelist: string[];
  /** Allowed origins for webhooks */
  allowedOrigins: string[];
  /** Last credentials rotation date */
  lastRotatedAt?: Date;
  /** Next scheduled rotation date */
  nextRotationAt?: Date;
}

// ============================================================================
// CONFIGURATION INTERFACE
// ============================================================================

/**
 * Configuration settings for a Zainbox.
 *
 * @interface ZainboxConfig
 */
export interface ZainboxConfig {
  /** Auto-settle incoming funds */
  autoSettle: boolean;
  /** Settlement schedule */
  settlementSchedule: 'realtime' | 'daily' | 'weekly' | 'custom';
  /** Settlement time (for daily/weekly schedules) */
  settlementTime?: string; // HH:mm format
  /** Settlement day of week (for weekly) */
  settlementDayOfWeek?: number; // 0-6 (Sunday-Saturday)
  /** Minimum amount for settlement */
  minimumSettlementAmount?: number;
  /** Enable instant payout option */
  enableInstantPayout: boolean;
  /** Instant payout fee percentage */
  instantPayoutFeePercent?: number;
  /** Maximum instant payout amount */
  maxInstantPayoutAmount?: number;
  /** Notify on every incoming payment */
  notifyOnPayment: boolean;
  /** Send daily summary report */
  dailySummary: boolean;
  /** Send weekly summary report */
  weeklySummary: boolean;
  /** Require approval for outgoing transfers above threshold */
  requireApprovalForTransfers: boolean;
  /** Approval threshold amount */
  transferApprovalThreshold?: number;
  /** Approvers list */
  approvers?: Array<{
    /** Approver ID */
    approverId: string;
    /** Approver name */
    name: string;
    /** Approver email */
    email: string;
  }>;
  /** Number of approvals required */
  requiredApprovals?: number;
  /** Enable QR code generation for receiving */
  enableQrCode: boolean;
  /** Generate USSD code for receiving */
  enableUssd: boolean;
  /** Integration type */
  bankIntegration: import('./zainbox.core').BankIntegrationType;
  /** Enable duplicate transaction detection */
  detectDuplicates: boolean;
  /** Duplicate detection window in minutes */
  duplicateWindowMinutes?: number;
  /** Enable transaction tagging */
  enableAutoTagging: boolean;
  /** Auto-tagging rules */
  autoTaggingRules?: Array<{
    /** Rule name */
    name: string;
    /** Condition field */
    conditionField: string;
    /** Condition operator */
    conditionOperator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
    /** Condition value */
    conditionValue: string;
    /** Tag to apply */
    tag: string;
  }>;
  /** Rate limiting configuration */
  rateLimit?: {
    /** Max requests per minute */
    requestsPerMinute: number;
    /** Max requests per hour */
    requestsPerHour: number;
    /** Max requests per day */
    requestsPerDay: number;
  };
  /** Webhook retry configuration */
  webhookRetry: {
    /** Enable retries */
    enabled: boolean;
    /** Maximum retry attempts */
    maxAttempts: number;
    /** Retry backoff in seconds */
    backoffSeconds: number;
    /** Use exponential backoff */
    exponentialBackoff: boolean;
  };
}
