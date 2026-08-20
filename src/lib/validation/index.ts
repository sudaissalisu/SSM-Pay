/**
 * SSM-Pay Validation Module
 * 
 * Central export point for all Zod validation schemas used across
 * the SSM-Pay enterprise payment platform. This module provides:
 * 
 * - Comprehensive input validation schemas for API boundaries
 * - TypeScript type inference from schemas
 * - Helper functions for request validation
 * 
 * @module validation
 */

import { z } from 'zod';

// ============================================================================
// Schema Imports
// ============================================================================

// Payment Schemas
export {
  PaymentStatusEnum,
  PaymentMethodEnum,
  CurrencyEnum as PaymentCurrencyEnum,
  CardNetworkEnum,
  TransactionTypeEnum,
  InitializePaymentSchema,
  VerifyPaymentSchema,
  RefundSchema,
  WebhookPayloadSchema,
  CardPaymentSchema,
  BankTransferSchema,
  TransferSchema,
} from './payment-schema';

export type {
  PaymentStatus,
  PaymentMethod,
  Currency,
  CardNetwork,
  TransactionType,
  InitializePaymentInput,
  VerifyPaymentInput,
  RefundInput,
  WebhookPayloadInput,
  CardPaymentInput,
  BankTransferInput,
  TransferInput,
} from './payment-schema';

// Customer Schemas
export {
  CustomerStatusEnum,
  KycTierEnum,
  DocumentTypeEnum,
  VerificationStatusEnum,
  CreateCustomerSchema,
  UpdateCustomerSchema,
  CustomerSearchParamsSchema,
  KycVerificationSchema,
  KycReviewSchema,
  CustomerBulkOperationSchema,
} from './customer-schema';

export type {
  CustomerStatus,
  KycTier,
  DocumentType,
  VerificationStatus,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerSearchParams,
  KycVerificationInput,
  KycReviewInput,
  CustomerBulkOperationInput,
} from './customer-schema';

// Transaction Schemas
export {
  TransactionStatusEnum,
  TransactionChannelEnum,
  ExportFormatEnum,
  TransactionQuerySchema,
  BatchTransactionSchema,
  TransactionExportSchema,
  TransactionReconciliationSchema,
} from './transaction-schema';

export type {
  TransactionStatus,
  TransactionChannel,
  ExportFormat,
  TransactionQueryInput,
  BatchTransactionInput,
  BatchTransactionItem,
  TransactionExportInput,
  TransactionReconciliationInput,
} from './transaction-schema';

// Zainbox Schemas
export {
  ZainboxTypeEnum,
  ZainboxStatusEnum,
  BankIntegrationEnum,
  SplitTypeEnum,
  CreateZainboxSchema,
  UpdateZainboxSchema,
  ZainboxCredentialsSchema,
  ZainboxSplitConfigSchema,
  ZainboxTransactionQuerySchema,
} from './zainbox-schema';

export type {
  ZainboxType,
  ZainboxStatus,
  BankIntegration,
  SplitType,
  CreateZainboxInput,
  UpdateZainboxInput,
  ZainboxCredentialsInput,
  ZainboxSplitConfigInput,
  SplitRecipientInput,
  ZainboxTransactionQueryInput,
} from './zainbox-schema';

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validation error details structure
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code?: string;
}

/**
 * Successful validation result
 */
export interface ValidationResultSuccess<T> {
  success: true;
  data: T;
}

/**
 * Failed validation result
 */
export interface ValidationResultError {
  success: false;
  error: string;
  errors?: ValidationErrorDetail[];
}

/**
 * Combined validation result type
 */
export type ValidationResult<T> = ValidationResultSuccess<T> | ValidationResultError;

/**
 * Validates data against a Zod schema and returns a normalized result.
 * 
 * This is the primary validation helper for use at API boundaries.
 * It provides consistent error formatting and TypeScript-safe return types.
 * 
 * @example
 * ```typescript
 * import { validateRequest, InitializePaymentSchema } from '@/lib/validation';
 * 
 * // In an API route handler
 * const result = await validateRequest(InitializePaymentSchema, req.body);
 * 
 * if (!result.success) {
 *   return Response.json({ error: result.error }, { status: 400 });
 * }
 * 
 * // result.data is properly typed as InitializePaymentInput
 * const payment = await createPayment(result.data);
 * ```
 * 
 * @param schema - The Zod schema to validate against
 * @param data - The unknown data to validate (typically req.body, query params, etc.)
 * @returns Object with success status and either validated data or error message(s)
 */
export async function validateRequest<T>(
  schema: z.ZodType<T>,
  data: unknown
): Promise<ValidationResult<T>> {
  const result = await schema.safeParseAsync(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  // Format errors for client consumption (Zod v4 uses 'issues' not 'errors')
  const issues = 'issues' in result.error ? result.error.issues : [];
  
  const errors: ValidationErrorDetail[] = issues.map((issue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
    code: issue.code,
  }));
  
  // Create a combined error message for simple cases
  const errorMessage = errors
    .map((e) => e.field !== 'unknown' ? `${e.field}: ${e.message}` : e.message)
    .join('; ');
  
  return {
    success: false,
    error: errorMessage,
    errors,
  };
}

/**
 * Synchronous version of validateRequest for non-async contexts.
 * Use this when you don't need async transforms in your schema.
 * 
 * @param schema - The Zod schema to validate against
 * @param data - The unknown data to validate
 * @returns Validation result with typed data or error information
 */
export function validateSync<T>(
  schema: z.ZodType<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const issues = 'issues' in result.error ? result.error.issues : [];
  
  const errors: ValidationErrorDetail[] = issues.map((issue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
    code: issue.code,
  }));
  
  const errorMessage = errors
    .map((e) => e.field !== 'unknown' ? `${e.field}: ${e.message}` : e.message)
    .join('; ');
  
  return {
    success: false,
    error: errorMessage,
    errors,
  };
}

/**
 * Creates a validated handler wrapper for Next.js API routes.
 * Automatically validates request body against provided schema and calls
 * handler only if validation passes.
 * 
 * @example
 * ```typescript
 * import { withValidation, InitializePaymentSchema } from '@/lib/validation';
 * 
 * export const POST = withValidation(InitializePaymentSchema, async (req, ctx, data) => {
 *   // data is already validated and typed as InitializePaymentInput
 *   const payment = await initializePayment(data);
 *   return Response.json(payment);
 * });
 * ```
 * 
 * @param schema - Zod schema to validate request body against
 * @param handler - Handler function that receives validated data
 * @returns Wrapped handler function for use in route handlers
 */
export function withValidation<T>(
  schema: z.ZodType<T>,
  handler: (
    request: Request,
    context: Record<string, unknown>,
    data: T
  ) => Promise<Response> | Response
) {
  return async (
    request: Request,
    context: Record<string, unknown>
  ): Promise<Response> => {
    try {
      let body: unknown;
      
      const contentType = request.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        body = await request.json();
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        const entries: Record<string, string | string[]> = {};
        formData.forEach((value, key) => {
          // Only process string values, skip File objects
          if (typeof value === 'string') {
            if (key in entries) {
              const existing = entries[key];
              entries[key] = Array.isArray(existing) 
                ? [...existing, value] 
                : [existing, value];
            } else {
              entries[key] = value;
            }
          }
        });
        body = entries;
      } else if (contentType.includes('text/plain')) {
        body = await request.text();
      } else {
        body = {};
      }
      
      const result = await validateRequest(schema, body);
      
      if (!result.success) {
        return Response.json(
          {
            success: false,
            error: 'Validation failed',
            details: 'errors' in result ? result.errors : undefined,
          },
          { status: 422 }
        );
      }
      
      return handler(request, context, result.data);
    } catch (error) {
      return Response.json(
        {
          success: false,
          error: 'Invalid request format',
        },
        { status: 400 }
      );
    }
  };
}

/**
 * Validates query parameters for GET requests.
 * Transforms URLSearchParams or plain object into validated shape.
 * 
 * @param schema - Zod schema for query parameters
 * @param query - URLSearchParams or plain object to validate
 * @returns Validation result with typed query parameters
 */
export function validateQueryParams<T>(
  schema: z.ZodType<T>,
  query: URLSearchParams | Record<string, string | string[] | undefined>
): ValidationResult<T> {
  // Convert URLSearchParams to plain object
  let params: Record<string, unknown>;
  
  if (query instanceof URLSearchParams) {
    params = {};
    query.forEach((value, key) => {
      // Handle array-like params (e.g., ?status=a&status=b)
      if (key in params) {
        const existing = params[key];
        params[key] = Array.isArray(existing) 
          ? [...existing, value] 
          : [existing as string, value];
      } else {
        params[key] = value;
      }
    });
  } else {
    params = query as Record<string, unknown>;
  }
  
  return validateSync(schema, params);
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extracts the input type from a Zod schema
 * Useful when you need the raw input type before transforms
 */
export type SchemaInput<T extends z.ZodType> = z.input<T>;

/**
 * Extracts the output type from a Zod schema
 * Includes any transformations applied by the schema
 */
export type SchemaOutput<T extends z.ZodType> = z.output<T>;

/**
 * Type for optional fields that become required after validation/transform
 */
export type RequiredAfterValidation<T> = {
  [K in keyof T]-?: T[K];
};

// ============================================================================
// Default Exports
// ============================================================================

const validationHelpers = {
  // Validation helpers
  validateRequest,
  validateSync,
  withValidation,
  validateQueryParams,
  
  // Re-export all schemas are available via named exports above
};

export default validationHelpers;
