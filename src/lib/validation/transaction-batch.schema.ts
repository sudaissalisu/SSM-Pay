/**
 * Transaction Batch & Export Validation Schemas for SSM-Pay Platform
 * 
 * Contains schemas for:
 * - Batch transaction processing
 * - Transaction data export
 * - Transaction reconciliation
 */

import { z } from 'zod';

// ============================================================================
// Import Enums from Query Schema
// ============================================================================

import {
  TransactionStatusEnum,
  TransactionChannelEnum,
  ExportFormatEnum
} from './transaction-query.schema';

export type {
  TransactionStatus,
  TransactionChannel,
  ExportFormat
} from './transaction-query.schema';

// Re-export enums for convenience
export { TransactionStatusEnum, TransactionChannelEnum, ExportFormatEnum };

// ============================================================================
// Base Schemas (Reusable Components)
// ============================================================================

/**
 * Valid ISO datetime string validation
 */
const IsoDateTimeSchema = z.string().datetime({
  message: 'Invalid datetime format. Expected ISO 8601 (e.g., 2024-01-15T10:30:00Z)',
});

// ============================================================================
// Batch Transaction Schema
// ============================================================================

/**
 * Individual transaction item in a batch
 */
const BatchTransactionItemSchema = z.object({
  // Required fields for each transaction
  amount: z.number()
    .positive('Amount must be positive')
    .max(50000000, 'Single transaction amount cannot exceed ₦50,000,000'),
  
  recipient: z.object({
    accountNumber: z.string()
      .regex(/^\d{10}$/, 'Recipient account number must be 10 digits'),
    
    bankCode: z.string()
      .regex(/^\d{3,10}$/, 'Invalid bank code format'),
    
    name: z.string()
      .min(2, 'Recipient name required')
      .max(200, 'Recipient name too long'),
    
    description: z.string()
      .max(150, 'Description too long')
      .optional(),
  }),
  
  // Optional fields
  reference: z.string()
    .min(6, 'Transaction reference too short')
    .max(50, 'Transaction reference too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Reference contains invalid characters')
    .optional(),
  
  narration: z.string()
    .max(150, 'Narration too long')
    .optional(),
  
  currency: z.enum(['NGN', 'USD', 'GBP', 'EUR']).default('NGN'),
  
  metadata: z.record(z.string(), z.unknown()).default({}),
  
  callbackUrl: z.url({ message: 'Callback URL must be valid' }).optional(),
}, { message: 'Invalid transaction item in batch' });

/**
 * Schema for batch transaction processing
 * Allows processing multiple transactions in a single request
 */
export const BatchTransactionSchema = z.object({
  // Array of transactions to process
  transactions: z.array(BatchTransactionItemSchema)
    .min(1, 'At least one transaction is required in batch')
    .max(1000, 'Batch processing limited to 1000 transactions per request')
    .refine(
      // Check for duplicate references within batch
      (items) => {
        const references = items
          .filter(item => item.reference)
          .map(item => item.reference!);
        return new Set(references).size === references.length;
      },
      { message: 'Duplicate transaction references found in batch' }
    ),
  
  // Batch-level configuration
  batchTitle: z.string()
    .min(3, 'Batch title too short')
    .max(200, 'Batch title too long')
    .optional(),
  
  batchReference: z.string()
    .min(8, 'Batch reference too short')
    .max(50, 'Batch reference too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Batch reference contains invalid characters')
    .optional(),
  
  // Processing options
  processSequentially: z.coerce.boolean().default(false),
  
  stopOnError: z.coerce.boolean().default(true),
  
  // Callback configuration
  webhookUrl: z.url({ message: 'Webhook URL must be valid' }).optional(),
  
  callbackUrl: z.url({ message: 'Callback URL must be valid' }).optional(),
  
  // Metadata
  metadata: z.record(z.string(), z.unknown()).default({}),
}).refine(
  // Calculate total batch amount and validate
  (data) => {
    const totalAmount = data.transactions.reduce(
      (sum, tx) => sum + tx.amount,
      0
    );
    return totalAmount <= 500000000; // ₦500M total batch limit
  },
  { message: 'Total batch amount exceeds maximum allowed (₦500,000,000)', path: ['transactions'] }
).transform((data) => ({
  ...data,
  transactionCount: data.transactions.length,
  totalAmount: data.transactions.reduce((sum, tx) => sum + tx.amount, 0),
}));

/** Type for batch transaction input */
export type BatchTransactionInput = z.infer<typeof BatchTransactionSchema>;

/** Type for single batch transaction item */
export type BatchTransactionItem = z.infer<typeof BatchTransactionItemSchema>;

// ============================================================================
// Transaction Export Schema
// ============================================================================

/**
 * Available columns for transaction export
 */
const ExportColumnEnum = z.enum([
  'reference',
  'externalReference',
  'status',
  'amount',
  'currency',
  'channel',
  'customerName',
  'customerEmail',
  'customerPhone',
  'cardType',
  'cardLast4',
  'bankName',
  'accountNumber',
  'fees',
  'netAmount',
  'narration',
  'createdAt',
  'paidAt',
  'updatedAt',
  'metadata',
]);

/**
 * Schema for exporting transaction data
 * Supports multiple formats with customizable column selection
 */
export const TransactionExportSchema = z.object({
  // Required: export format
  format: ExportFormatEnum.default('CSV'),
  
  // Column selection
  columns: z.array(ExportColumnEnum)
    .min(1, 'At least one column must be selected for export')
    .max(20, 'Too many columns selected (maximum 20)')
    .default([
      'reference',
      'status',
      'amount',
      'currency',
      'customerEmail',
      'createdAt',
    ]),
  
  // Filters (same as query)
  status: z.union([
    TransactionStatusEnum,
    z.array(TransactionStatusEnum).min(1),
  ]).optional(),
  
  channel: TransactionChannelEnum.optional(),
  
  currency: z.enum(['NGN', 'USD', 'GBP', 'EUR']).optional(),
  
  customerId: z.string().uuid().optional(),
  
  amountMin: z.number().nonnegative().optional(),
  amountMax: z.number().positive().optional(),
  
  // Required date range for export
  from: IsoDateTimeSchema,
  to: IsoDateTimeSchema,
  
  // Export options
  filename: z.string()
    .min(1, 'Filename cannot be empty')
    .max(200, 'Filename too long')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Filename contains invalid characters')
    .optional(),
  
  includeHeaders: z.coerce.boolean().default(true),
  
  delimiter: z.enum([',', ';', '\t', '|'], {
    message: 'Delimiter must be comma, semicolon, tab, or pipe',
  }).default(','),
  
  timezone: z.string()
    .regex(/^[A-Za-z_]+\/[A-Za-z_]+$/, 'Invalid timezone format (e.g., Africa/Lagos)')
    .default('Africa/Lagos'),
  
  dateFormat: z.enum([
    'ISO_8601',
    'DD/MM/YYYY',
    'MM/DD/YYYY',
    'YYYY-MM-DD',
    'DD-MMM-YYYY',
  ]).default('ISO_8601'),
  
  // Email delivery option
  emailTo: z.email({ message: 'Invalid email address for delivery' }).optional(),
  
  emailSubject: z.string()
    .max(200, 'Email subject too long')
    .optional(),
  
  // Async processing option
  async: z.coerce.boolean().default(false),
  
  webhookUrl: z.url({ message: 'Webhook URL must be valid' }).optional(),
}).transform((data) => ({
  ...data,
  // Generate default filename if not provided
  filename: data.filename || `transactions_${new Date().toISOString().split('T')[0]}.${data.format.toLowerCase()}`,
  // Normalize date range
  dateRange: {
    from: data.from,
    to: data.to,
  },
})).refine(
  // Validate date range
  (data) => new Date(data.from) <= new Date(data.to),
  { message: 'Start date cannot be after end date', path: ['from'] }
);

/** Type for transaction export input */
export type TransactionExportInput = z.infer<typeof TransactionExportSchema>;

// ============================================================================
// Transaction Reconciliation Schema
// ============================================================================

/**
 * Schema for transaction reconciliation requests
 * Used for matching internal records with external sources
 */
export const TransactionReconciliationSchema = z.object({
  // Source of external data
  source: z.enum([
    'BANK_STATEMENT',
    'PAYMENT_GATEWAY',
    'THIRD_PARTY',
    'MANUAL_UPLOAD',
  ], { message: 'Invalid reconciliation source' }),
  
  // Date range for reconciliation
  startDate: IsoDateTimeSchema,
  endDate: IsoDateTimeSchema,
  
  // External transaction data to reconcile
  externalTransactions: z.array(z.object({
    reference: z.string().min(1),
    amount: z.number().positive(),
    currency: z.enum(['NGN', 'USD', 'GBP', 'EUR']),
    date: IsoDateTimeSchema,
    narration: z.string().max(500).optional(),
    externalId: z.string().max(200).optional(),
  }))
    .max(10000, 'Reconciliation batch limited to 10,000 entries')
    .optional(),
  
  // Matching criteria
  matchBy: z.array(z.enum([
    'reference',
    'amount_and_date',
    'narration',
    'external_id',
  ])).min(1, 'At least one matching criterion is required'),
  
  // Tolerance settings (for amount matching)
  amountTolerance: z.number()
    .min(0)
    .max(100, 'Tolerance cannot exceed 100%')
    .default(0), // Exact match by default
  
  dateToleranceHours: z.number()
    .int()
    .min(0)
    .max(168, 'Date tolerance cannot exceed 7 days (168 hours)')
    .default(24),
  
  // Output options
  reportFormat: z.enum(['SUMMARY', 'DETAILED', 'DIFF_ONLY']).default('SUMMARY'),
  
  notifyOnCompletion: z.boolean().default(false),
  notificationEmail: z.email().optional(),
}).refine(
  // Validate date range
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'Start date cannot be after end date', path: ['startDate'] }
).refine(
  // Notification email required if notification enabled
  (data) => !data.notifyOnCompletion || !!data.notificationEmail,
  { message: 'Notification email is required when notifications are enabled', path: ['notificationEmail'] }
);

/** Type for reconciliation input */
export type TransactionReconciliationInput = z.infer<typeof TransactionReconciliationSchema>;
