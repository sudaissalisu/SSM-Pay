/**
 * SSM-Pay Validation Module
 * Central export point for all Zod validation schemas and utilities
 */

// Payment schemas
export {
  CurrencyEnum,
  PaymentMethodEnum,
  TransactionStatusEnum,
  EmailSchema,
  AmountSchema,
  ReferenceSchema,
  PaymentInitSchema,
  PaymentCallbackSchema,
  PaymentVerifySchema,
  RefundSchema,
  type PaymentInitInput,
  type PaymentCallbackInput,
  type PaymentVerifyInput,
  type RefundInput,
  type PaymentInitOutput,
  type PaymentCallbackOutput,
  type PaymentVerifyOutput,
  type RefundOutput,
} from './payment-schema';

// Zainbox schemas
export {
  ZainboxNameSchema,
  CallbackUrlSchema,
  EmailNotificationSchema,
  CodeNamePrefixSchema,
  TagsSchema,
  ZainboxCreateSchema,
  ZainboxUpdateSchema,
  ZainboxQuerySchema,
  type ZainboxCreateInput,
  type ZainboxUpdateInput,
  type ZainboxQueryInput,
  type ZainboxCreateOutput,
  type ZainboxUpdateOutput,
  type ZainboxQueryOutput,
} from './zainbox-schema';

// API schemas
export {
  SortOrderEnum,
  PaginationSchema,
  DateRangeSchema,
  ErrorCodeEnum,
  ApiErrorSchema,
  createApiResponseSchema,
  PaginatedResponseMetaSchema,
  SearchFilterSchema,
  IdParamSchema,
  BulkActionSchema,
  type PaginationInput,
  type PaginationOutput,
  type DateRangeInput,
  type ApiErrorInput,
  type ApiErrorOutput,
  type SearchFilterInput,
  type IdParamInput,
  type BulkActionInput,
  type ApiResponse,
} from './api-schemas';

import { z } from 'zod';
import { PaymentInitSchema, type PaymentInitInput } from './payment-schema';
import { ZainboxCreateSchema, type ZainboxCreateInput } from './zainbox-schema';
import { logger } from '@/lib/logger';

/**
 * Validation result with standardized error format
 */
export interface ValidationResult<T> {
  success: true;
  data: T;
} | {
  success: false;
  errors: Record<string, string[]>;
  error: z.ZodError;
};

/**
 * Validate payment initialization data
 * @param data - Raw input data to validate
 * @returns ValidationResult with either validated data or field errors
 */
export function validatePaymentInit(data: unknown): ValidationResult<PaymentInitInput> {
  const result = PaymentInitSchema.safeParse(data);
  
  if (!result.success) {
    logger.warn('Payment initialization validation failed', {
      event: 'payment.init.validation',
      metadata: { 
        errors: result.error.flatten().fieldErrors,
      },
    });
    
    return {
      success: false,
      errors: result.error.flatten().fieldErrors as Record<string, string[]>,
      error: result.error,
    };
  }
  
  return {
    success: true,
    data: result.data,
  };
}

/**
 * Validate Zainbox creation data
 * @param data - Raw input data to validate (typically from FormData)
 * @returns ValidationResult with either validated data or field errors
 */
export function validateZainboxCreate(data: unknown): ValidationResult<ZainboxCreateInput> {
  const result = ZainboxCreateSchema.safeParse(data);
  
  if (!result.success) {
    logger.warn('Zainbox creation validation failed', {
      event: 'zainbox.create.validation',
      metadata: { 
        errors: result.error.flatten().fieldErrors,
      },
    });
    
    return {
      success: false,
      errors: result.error.flatten().fieldErrors as Record<string, string[]>,
      error: result.error,
    };
  }
  
  return {
    success: true,
    data: result.data,
  };
}

/**
 * Generic validation helper for any Zod schema
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @returns Standardized validation result
 */
export function validate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors as Record<string, string[]>,
      error: result.error,
    };
  }
  
  return {
    success: true,
    data: result.data,
  };
}

/**
 * Format Zod validation errors into a user-friendly message
 * @param errors - Field errors object from Zod
 * @returns Formatted error message string
 */
export function formatValidationErrors(errors: Record<string, string[]>): string {
  const messages = Object.entries(errors).flatMap(([field, fieldErrors]) =>
    fieldErrors.map((msg) => `${field}: ${msg}`)
  );
  
  if (messages.length === 1) {
    return messages[0];
  }
  
  return `Validation errors:\n${messages.join('\n')}`;
}
