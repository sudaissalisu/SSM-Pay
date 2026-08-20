/**
 * Zainbox Core Validation Schemas for SSM-Pay Platform
 * 
 * Contains schemas for Zainbox creation, update operations,
 * enum definitions, and base/reusable schema components.
 */

import { z } from 'zod';

// ============================================================================
// Enum Definitions
// ============================================================================

/**
 * Zainbox types - determines the collection behavior
 */
export const ZainboxTypeEnum = z.enum([
  'STANDARD',      // Standard virtual account collection
  'FLOATING',      // Dynamic account numbers per transaction
  'RESERVED',      // Reserved/dedicated accounts
  'OMNI',          // Multi-bank collection
  'SUBACCOUNT',    // Sub-account under main merchant
], {
  message: 'Invalid Zainbox type. Use STANDARD, FLOATING, RESERVED, OMNI, or SUBACCOUNT',
});

export type ZainboxType = z.infer<typeof ZainboxTypeEnum>;

/**
 * Zainbox status values
 */
export const ZainboxStatusEnum = z.enum([
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'PENDING_ACTIVATION',
  'CLOSED',
], {
  message: 'Invalid Zainbox status',
});

export type ZainboxStatus = z.infer<typeof ZainboxStatusEnum>;

/**
 * Bank integration options for Zainbox
 */
export const BankIntegrationEnum = z.enum([
  'WEMA_BANK',
  'STERLING_BANK',
  'ACCESS_BANK',
  'GTBANK',
  'UBA',
  'ZENITH_BANK',
  'FIDELITY_BANK',
  'FIRST_BANK',
  'UNION_BANK',
  'ECOBANK',
  'POLARIS_BANK',
  'STANBIC_IBTC',
  'KEYSTONE_BANK',
  'HERITAGE_BANK',
  'ProvidusBank',
], {
  message: 'Unsupported bank for integration',
});

export type BankIntegration = z.infer<typeof BankIntegrationEnum>;

// ============================================================================
// Base Schemas (Reusable Components)
// ============================================================================

/**
 * Zainbox slug/name validation
 * Used for URL-friendly identifiers
 */
const ZainboxSlugSchema = z.string()
  .min(3, 'Zainbox name must be at least 3 characters')
  .max(64, 'Zainbox name cannot exceed 64 characters')
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Zainbox name must be lowercase alphanumeric with hyphens (no leading/trailing hyphens)'
  )
  .transform((val) => val.toLowerCase());

/**
 * Currency enum for Zainbox operations
 */
const CurrencyEnum = z.enum(['NGN', 'USD', 'GBP', 'EUR'], {
  message: 'Unsupported currency code',
});

/**
 * UUID validation helper
 */
const UuidSchema = z.uuid('Invalid UUID format');

/**
 * URL validation for webhooks/callbacks
 */
const WebhookUrlSchema = z.url({ message: 'Must be a valid URL starting with http:// or https://' })
  .refine((val) => val.length <= 500, { message: 'URL exceeds maximum length' })
  .refine(
    (url) => url.startsWith('https://'),
    { message: 'Webhook URLs must use HTTPS for security' }
  );

// ============================================================================
// Create Zainbox Schema
// ============================================================================

/**
 * Schema for creating a new Zainbox (payment collection endpoint)
 * Configures virtual account settings and bank integrations
 */
export const CreateZainboxSchema = z.object({
  // Required identification
  slug: ZainboxSlugSchema,
  
  // Display information
  displayName: z.string()
    .min(2, 'Display name is required')
    .max(150, 'Display name too long')
    .regex(/^[a-zA-Z0-9\s&'.,-]+$/, 'Display name contains invalid characters'),
  
  description: z.string()
    .max(1000, 'Description too long')
    .optional(),
  
  // Type configuration
  type: ZainboxTypeEnum.default('STANDARD'),
  
  // Bank integration settings
  bankIntegrations: z.array(z.object({
    bank: BankIntegrationEnum,
    
    preferred: z.boolean().default(false),
    
    accountName: z.string()
      .min(2, 'Account name required')
      .max(200, 'Account name too long'),
    
    // For reserved/floating types
    dedicatedAccountNumber: z.string()
      .regex(/^\d{10}$/, 'Account number must be exactly 10 digits')
      .optional(),
    
    bvn: z.string()
      .regex(/^\d{11}$/, 'BVN must be 11 digits')
      .optional(),
  }))
    .min(1, 'At least one bank integration is required')
    .max(10, 'Maximum 10 bank integrations allowed'),
  
  // Currency support
  currencies: z.array(CurrencyEnum)
    .min(1, 'At least one currency must be supported')
    .default(['NGN']),
  
  // Collection limits
  dailyLimit: z.number()
    .positive('Daily limit must be positive')
    .max(10000000000, 'Daily limit exceeds maximum allowed')
    .optional(),
  
  singleTransactionLimit: z.number()
    .positive('Single transaction limit must be positive')
    .max(50000000, 'Single transaction limit too high')
    .optional(),
  
  minimumAmount: z.number()
    .nonnegative('Minimum amount cannot be negative')
    .default(100), // Default ₦100 minimum
  
  // Callback/Webhook configuration
  webhookUrl: WebhookUrlSchema.optional(),
  
  callbackUrl: z.url({ message: 'Callback URL must be valid' }).optional(),
  
  // Split configuration reference
  splitCode: z.string()
    .min(1, 'Split code required if provided')
    .max(50, 'Split code format invalid')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Split code format invalid')
    .optional(),
  
  // Metadata
  metadata: z.record(z.string(), z.unknown())
    .default({}),
  
  // Owner assignment
  ownerId: UuidSchema.optional(),
  
  tags: z.array(z.string()
    .min(1)
    .max(30)
    .regex(/^[a-z0-9-]+$/))
    .max(20, 'Maximum 20 tags allowed')
    .default([]),
}).refine(
  // Validate that at least one bank is marked as preferred when multiple banks exist
  (data) => {
    if (data.bankIntegrations.length > 1) {
      return data.bankIntegrations.some(b => b.preferred);
    }
    return true;
  },
  { message: 'One bank integration must be marked as preferred when multiple banks are configured', path: ['bankIntegrations'] }
).refine(
  // Validate limits are consistent
  (data) => {
    if (data.singleTransactionLimit && data.dailyLimit) {
      return data.singleTransactionLimit <= data.dailyLimit;
    }
    return true;
  },
  { message: 'Single transaction limit cannot exceed daily limit', path: ['singleTransactionLimit'] }
);

/** Type for create Zainbox input */
export type CreateZainboxInput = z.infer<typeof CreateZainboxSchema>;

// ============================================================================
// Update Zainbox Schema
// ============================================================================

/**
 * Schema for updating existing Zainbox configuration
 * Supports partial updates
 */
export const UpdateZainboxSchema = z.object({
  displayName: z.string()
    .min(2, 'Display name too short')
    .max(150, 'Display name too long')
    .optional(),
  
  description: z.string()
    .max(1000, 'Description too long')
    .optional(),
  
  status: ZainboxStatusEnum.optional(),
  
  webhookUrl: WebhookUrlSchema.optional(),
  
  callbackUrl: z.url().optional(),
  
  splitCode: z.string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .nullable() // Allow null to remove split config
    .optional(),
  
  dailyLimit: z.number()
    .positive()
    .max(10000000000)
    .optional(),
  
  singleTransactionLimit: z.number()
    .positive()
    .max(50000000)
    .optional(),
  
  minimumAmount: z.number()
    .nonnegative()
    .optional(),
  
  metadata: z.record(z.string(), z.unknown()).optional(),
  
  tags: z.array(z.string()
    .min(1)
    .max(30)
    .regex(/^[a-z0-9-]+$/))
    .max(20)
    .optional(),
}).refine(
  // Prevent empty update
  (data) => Object.keys(data).length > 0,
  { message: 'Update request must include at least one field to modify' }
);

/** Type for update Zainbox input */
export type UpdateZainboxInput = z.infer<typeof UpdateZainboxSchema>;
