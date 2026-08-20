/**
 * Zainbox Credentials & Split Configuration Validation Schemas
 * 
 * Contains schemas for:
 * - API credentials management (create, rotate, revoke)
 * - Split payment configuration
 * - Transaction querying within Zainboxes
 */

import { z } from 'zod';

// ============================================================================
// Enum Definitions
// ============================================================================

/**
 * Split type enumeration
 */
export const SplitTypeEnum = z.enum([
  'PERCENTAGE',
  'FLAT',
  'REMAINDER',
], {
  message: 'Split type must be PERCENTAGE, FLAT, or REMAINDER',
});

export type SplitType = z.infer<typeof SplitTypeEnum>;

// ============================================================================
// Base Schemas (Reusable Components)
// ============================================================================

/**
 * UUID validation helper
 */
const UuidSchema = z.uuid('Invalid UUID format');

/**
 * Currency enum for Zainbox operations
 */
const CurrencyEnum = z.enum(['NGN', 'USD', 'GBP', 'EUR'], {
  message: 'Unsupported currency code',
});

/**
 * Zainbox slug/name validation
 */
const ZainboxSlugSchema = z.string()
  .min(3, 'Zainbox name must be at least 3 characters')
  .max(64, 'Zainbox name cannot exceed 64 characters')
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Zainbox name must be lowercase alphanumeric with hyphens'
  )
  .transform((val) => val.toLowerCase());

// ============================================================================
// Zainbox Credentials Schema
// ============================================================================

/**
 * Schema for managing Zainbox API credentials
 * Handles key generation, rotation, and management
 */
export const ZainboxCredentialsSchema = z.object({
  // Credential management action
  action: z.enum([
    'create',
    'rotate',
    'revoke',
    'activate',
    'deactivate',
  ], { message: 'Invalid credential action. Use create, rotate, revoke, activate, or deactivate' }),
  
  // Key identifier (for rotate/revoke actions)
  keyId: UuidSchema.optional(),
  
  // Key configuration
  keyName: z.string()
    .min(2, 'Key name too short')
    .max(100, 'Key name too long')
    .regex(/^[a-zA-Z0-9_\s-]+$/, 'Key name contains invalid characters')
    .optional(),
  
  // Key permissions/scopes
  scopes: z.array(z.enum([
    'payments:initiate',
    'payments:verify',
    'payments:refund',
    'transactions:read',
    'customers:read',
    'customers:write',
    'zainbox:read',
    'zainbox:write',
    'webhooks:manage',
    'reports:read',
    'full_access',
  ], { message: 'Invalid permission scope' }))
    .min(1, 'At least one scope is required')
    .default(['payments:initiate', 'payments:verify', 'transactions:read']),
  
  // Key restrictions
  ipWhitelist: z.array(z.string()
    .regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Invalid IPv4 address')
    .or(z.string().regex(
      /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
      'Invalid IPv6 address'
    )))
    .max(50, 'IP whitelist limited to 50 addresses')
    .optional(),
  
  domainWhitelist: z.array(z.string())
    .max(20, 'Domain whitelist limited to 20 domains')
    .refine(
      (domains) => domains.every(d => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)),
      { message: 'Invalid domain format in whitelist' }
    )
    .optional(),
  
  // Expiration settings
  expiresAt: z.string()
    .datetime({ message: 'Expiration date must be valid ISO datetime' })
    .optional(), // No expiration if not set
  
  rateLimitPerMinute: z.number()
    .int('Rate limit must be an integer')
    .min(1, 'Minimum rate limit is 1 request per minute')
    .max(10000, 'Maximum rate limit is 10,000 requests per minute')
    .optional(),
  
  // Webhook credentials
  webhookSecret: z.string()
    .min(32, 'Webhook secret must be at least 32 characters')
    .optional(),
  
  encryptionKey: z.string()
    .min(16, 'Encryption key must be at least 16 characters')
    .optional(),
}).refine(
  // Key ID required for certain actions
  (data) => {
    const requiresKeyId = ['rotate', 'revoke'];
    return !requiresKeyId.includes(data.action) || !!data.keyId;
  },
  { message: 'Key ID is required for this action', path: ['keyId'] }
).refine(
  // Scopes required for create action
  (data) => data.action !== 'create' || (data.scopes && data.scopes.length > 0),
  { message: 'Scopes are required when creating a new key', path: ['scopes'] }
);

/** Type for Zainbox credentials input */
export type ZainboxCredentialsInput = z.infer<typeof ZainboxCredentialsSchema>;

// ============================================================================
// Zainbox Split Configuration Schema
// ============================================================================

/**
 * Individual split recipient definition
 */
const SplitRecipientSchema = z.object({
  // Recipient identification
  recipientId: UuidSchema,
  
  // Split configuration
  splitType: SplitTypeEnum,
  
  // Split value (percentage or flat amount)
  value: z.number()
    .positive('Split value must be positive'),
  
  // Optional metadata
  description: z.string()
    .max(200, 'Split description too long')
    .optional(),
  
  // Bank details for settlement
  settlementBank: z.string()
    .regex(/^\d{3,10}$/, 'Invalid bank code')
    .optional(),
  
  settlementAccount: z.string()
    .regex(/^\d{10}$/, 'Settlement account must be 10 digits')
    .optional(),
  
  // Conditions
  minAmount: z.number()
    .nonnegative('Minimum amount cannot be negative')
    .optional(),
  
  maxAmount: z.number()
    .positive('Maximum amount must be positive')
    .optional(),
}, { message: 'Invalid split recipient configuration' });

/**
 * Schema for configuring payment splits on a Zainbox
 * Defines how incoming payments are distributed among recipients
 */
export const ZainboxSplitConfigSchema = z.object({
  // Split configuration identification
  splitCode: z.string()
    .min(3, 'Split code too short')
    .max(50, 'Split code too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Split code can only contain alphanumeric, hyphens, and underscores')
    .transform((val) => val.toUpperCase()),
  
  // Split name/description
  name: z.string()
    .min(2, 'Split name too short')
    .max(200, 'Split name too long')
    .optional(),
  
  description: z.string()
    .max(500, 'Split description too long')
    .optional(),
  
  // Array of split recipients
  recipients: z.array(SplitRecipientSchema)
    .min(1, 'At least one split recipient is required')
    .max(20, 'Maximum 20 split recipients allowed'),
  
  // Split behavior options
  bearerType: z.enum([
    'ALL',       // All parties bear fees proportionally
    'ACCOUNT',   // Main account bears fees
    'SUBLIMITS', // Sub-accounts bear their portion
  ], { message: 'Invalid bearer type. Use ALL, ACCOUNT, or SUBLIMITS' }).default('ALL'),
  
  // Active/inactive toggle
  active: z.boolean().default(true),
  
  // Currency restriction
  currency: CurrencyEnum.default('NGN'),
  
  // Apply to specific Zainboxes (empty = global)
  zainboxSlugs: z.array(ZainboxSlugSchema)
    .max(50, 'Split can apply to maximum 50 Zainboxes')
    .default([]),
  
  // Metadata
  metadata: z.record(z.string(), z.unknown())
    .default({}),
}).refine(
  // Validate percentage splits total
  (data) => {
    const percentageRecipients = data.recipients.filter(
      r => r.splitType === 'PERCENTAGE'
    );
    
    if (percentageRecipients.length === 0) return true;
    
    const totalPercentage = percentageRecipients.reduce(
      (sum, r) => sum + r.value,
      0
    );
    
    // Check for remainder type
    const hasRemainder = data.recipients.some(r => r.splitType === 'REMAINDER');
    
    if (hasRemainder) {
      return totalPercentage < 100; // Remainder gets what's left
    }
    
    // Allow small floating point tolerance
    return Math.abs(totalPercentage - 100) < 0.01;
  },
  { message: 'Percentage splits must sum to 100% (or less if using REMAINDER type)', path: ['recipients'] }
).refine(
  // Ensure only one remainder recipient exists
  (data) => {
    const remainderCount = data.recipients.filter(
      r => r.splitType === 'REMAINDER'
    ).length;
    return remainderCount <= 1;
  },
  { message: 'Only one REMAINDER split recipient is allowed per configuration', path: ['recipients'] }
).refine(
  // Validate individual split values based on type
  (data) => {
    return data.recipients.every(r => {
      switch (r.splitType) {
        case 'PERCENTAGE':
          return r.value > 0 && r.value <= 100;
        case 'FLAT':
          return r.value > 0;
        case 'REMAINDER':
          return true; // Value ignored for remainder
        default:
          return false;
      }
    });
  },
  { message: 'Split values invalid: PERCENTAGE must be 0-100, FLAT must be positive', path: ['recipients'] }
);

/** Type for Zainbox split config input */
export type ZainboxSplitConfigInput = z.infer<typeof ZainboxSplitConfigSchema>;

/** Type for individual split recipient */
export type SplitRecipientInput = z.infer<typeof SplitRecipientSchema>;

// ============================================================================
// Zainbox Transaction Query Schema
// ============================================================================

/**
 * Schema for querying transactions within a specific Zainbox
 */
export const ZainboxTransactionQuerySchema = z.object({
  // Pagination
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().min(1).max(100).default(20),
  
  // Date range
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  
  // Filters
  status: z.enum(['SUCCESSFUL', 'FAILED', 'PENDING']).optional(),
  channel: z.enum(['BANK_TRANSFER', 'CARD', 'USSD']).optional(),
  
  // Amount range
  amountFrom: z.number().nonnegative().optional(),
  amountTo: z.number().positive().optional(),
  
  // Search
  search: z.string().max(255).optional(),
  
  // Sorting
  sortBy: z.enum(['createdAt', 'amount', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).refine(
  (data) => {
    if (data.fromDate && data.toDate) {
      return new Date(data.fromDate) <= new Date(data.toDate);
    }
    return true;
  },
  { message: 'From date cannot be after to date', path: ['fromDate'] }
);

/** Type for Zainbox transaction query input */
export type ZainboxTransactionQueryInput = z.infer<typeof ZainboxTransactionQuerySchema>;
