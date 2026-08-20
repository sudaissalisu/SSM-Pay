/**
 * Transaction Query Validation Schema for SSM-Pay Platform
 * 
 * Contains schemas for:
 * - Transaction querying and filtering
 * - Enum definitions for status, channel, export format
 * - Base/reusable schema components (pagination, date/amount ranges)
 */

import { z } from 'zod';

// ============================================================================
// Enum Definitions
// ============================================================================

/**
 * Transaction status values
 */
export const TransactionStatusEnum = z.enum([
  'SUCCESSFUL',
  'FAILED',
  'PENDING',
  'ABANDONED',
  'REVERSED',
  'REFUNDED',
  'PARTIAL_REFUND',
  'PROCESSING',
  'EXPIRED',
], {
  message: 'Invalid transaction status provided',
});

export type TransactionStatus = z.infer<typeof TransactionStatusEnum>;

/**
 * Transaction channel/source types
 */
export const TransactionChannelEnum = z.enum([
  'CARD',
  'BANK_TRANSFER',
  'USSD',
  'TRANSFER',
  'QRCODE',
  'API',
  'DASHBOARD',
], {
  message: 'Invalid transaction channel',
});

export type TransactionChannel = z.infer<typeof TransactionChannelEnum>;

/**
 * Export format options
 */
export const ExportFormatEnum = z.enum([
  'CSV',
  'XLSX',
  'PDF',
  'JSON',
], {
  message: 'Unsupported export format. Use CSV, XLSX, PDF, or JSON',
});

export type ExportFormat = z.infer<typeof ExportFormatEnum>;

// ============================================================================
// Base Schemas (Reusable Components)
// ============================================================================

/**
 * Valid ISO datetime string validation
 */
const IsoDateTimeSchema = z.string().datetime({
  message: 'Invalid datetime format. Expected ISO 8601 (e.g., 2024-01-15T10:30:00Z)',
});

/**
 * Pagination base schema - reused across query schemas
 */
const PaginationSchema = z.object({
  page: z.coerce.number()
    .int('Page number must be an integer')
    .positive('Page number must be greater than 0')
    .default(1),
  
  limit: z.coerce.number()
    .int('Limit must be an integer')
    .positive('Limit must be greater than 0')
    .min(1, 'Minimum limit is 1')
    .max(100, 'Maximum limit per page is 100')
    .default(20),
});

/**
 * Date range schema for filtering transactions
 */
const DateRangeSchema = z.object({
  from: IsoDateTimeSchema.optional(),
  
  to: IsoDateTimeSchema.optional(),
}).refine(
  // Ensure from date is before to date
  (data) => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  },
  { message: '"From" date cannot be after "To" date', path: ['from'] }
);

/**
 * Amount range filter schema
 */
const AmountRangeSchema = z.object({
  min: z.number()
    .nonnegative('Minimum amount cannot be negative')
    .optional(),
  
  max: z.number()
    .positive('Maximum amount must be positive')
    .optional(),
}).refine(
  // Validate amount range logic
  (data) => {
    if (data.min !== undefined && data.max !== undefined) {
      return data.min <= data.max;
    }
    return true;
  },
  { message: 'Minimum amount cannot exceed maximum amount', path: ['min'] }
);

// ============================================================================
// Transaction Query Schema
// ============================================================================

/**
 * Schema for querying/filtering transactions
 * Supports complex filtering with pagination and sorting
 */
export const TransactionQuerySchema = PaginationSchema.extend({
  // Search parameters
  search: z.string()
    .max(255, 'Search query exceeds maximum length')
    .optional(), // Searches reference, customer email/name
  
  // Filter by identifiers
  reference: z.string()
    .min(1, 'Reference cannot be empty')
    .max(100, 'Reference too long')
    .optional(),
  
  customerId: z.string()
    .uuid('Invalid customer UUID format')
    .optional(),
  
  externalReference: z.string()
    .max(200, 'External reference too long')
    .optional(),
  
  // Status filters (supports multiple)
  status: z.union([
    TransactionStatusEnum,
    z.array(TransactionStatusEnum).min(1),
  ]).optional(),
  
  // Channel filter
  channel: TransactionChannelEnum.optional(),
  
  // Currency filter
  currency: z.enum(['NGN', 'USD', 'GBP', 'EUR'], {
    message: 'Unsupported currency code',
  }).optional(),
  
  // Date range filtering
  dateRange: DateRangeSchema.optional(),
  
  createdAtFrom: IsoDateTimeSchema.optional(),
  createdAtTo: IsoDateTimeSchema.optional(),
  
  // Amount range filtering
  amountRange: AmountRangeSchema.optional(),
  amountMin: z.number().nonnegative().optional(),
  amountMax: z.number().positive().optional(),
  
  // Payment method specific filters
  cardLast4: z.string()
    .regex(/^\d{4}$/, 'Card last 4 digits must be exactly 4 numbers')
    .optional(),
  
  bankCode: z.string()
    .regex(/^\d{3,10}$/, 'Invalid bank code format')
    .optional(),
  
  authorizationCode: z.string()
    .max(100, 'Authorization code too long')
    .optional(),
  
  // Sorting options
  sortBy: z.enum([
    'createdAt',
    'updatedAt',
    'amount',
    'status',
    'customerEmail',
  ], { message: 'Invalid sort field specified' }).default('createdAt'),
  
  sortOrder: z.enum(['asc', 'desc'], {
    message: 'Sort order must be "asc" or "desc"',
  }).default('desc'),
  
  // Include related data flags
  includeCustomer: z.coerce.boolean().default(false),
  includeRefunds: z.coerce.boolean().default(false),
  includeMetadata: z.coerce.boolean().default(false),
  
  // Soft delete handling
  includeDeleted: z.coerce.boolean().default(false),
}).transform((data) => ({
  ...data,
  // Build consolidated date range if individual fields are used
  ...(data.createdAtFrom || data.createdAtTo ? {
    dateRange: {
      from: data.dateRange?.from || data.createdAtFrom,
      to: data.dateRange?.to || data.createdAtTo,
    },
  } : {}),
  // Build consolidated amount range
  ...(data.amountMin || data.amountMax ? {
    amountRange: {
      min: data.amountRange?.min ?? data.amountMin,
      max: data.amountRange?.max ?? data.amountMax,
    },
  } : {}),
})).refine(
  // Final validation on transformed data
  (data) => {
    if (data.dateRange?.from && data.dateRange?.to) {
      return new Date(data.dateRange.from) <= new Date(data.dateRange.to);
    }
    return true;
  },
  { message: 'Date range validation failed: start date after end date', path: ['dateRange'] }
);

/** Type for transaction query parameters */
export type TransactionQueryInput = z.infer<typeof TransactionQuerySchema>;
