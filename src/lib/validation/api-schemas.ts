import { z } from 'zod';

/**
 * API validation schemas
 * Common schemas for API requests, responses, and pagination
 */

/**
 * Sort direction enum
 */
export const SortOrderEnum = z.enum(['asc', 'desc'], {
  errorMap: () => ({ message: 'Sort order must be "asc" or "desc"' }),
});

/**
 * Pagination schema for list endpoints
 * Provides consistent pagination across all paginated APIs
 */
export const PaginationSchema = z.object({
  /** Current page number (1-indexed) */
  page: z.coerce.number({
    required_error: 'Page number is required',
    invalid_type_error: 'Page must be a number',
  }).int({ message: 'Page must be an integer' })
    .positive({ message: 'Page must be greater than 0' })
    .default(1),
  
  /** Number of items per page */
  limit: z.coerce.number({
    required_error: 'Limit is required',
    invalid_type_error: 'Limit must be a number',
  }).int({ message: 'Limit must be an integer' })
    .positive({ message: 'Limit must be greater than 0' })
    .max(100, { message: 'Limit cannot exceed 100 items' })
    .default(20),
  
  /** Field to sort results by */
  sortBy: z.string()
    .max(50, { message: 'Sort field too long' })
    .default('createdAt'),
  
  /** Sort direction - ascending or descending */
  sortOrder: SortOrderEnum.default('desc'),
}).refine(
  (data) => {
    // Ensure page * limit doesn't exceed reasonable bounds
    return data.page * data.limit <= 10000;
  },
  { message: 'Requested range exceeds maximum offset', path: ['page'] }
);

/**
 * Date range filter schema
 * Used for filtering records by creation/update dates
 */
export const DateRangeSchema = z.object({
  /** Start date (inclusive) - ISO 8601 format */
  startDate: z.string()
    .datetime({ message: 'Invalid start date format. Use ISO 8601' })
    .optional(),
  
  /** End date (inclusive) - ISO 8601 format */
  endDate: z.string()
    .datetime({ message: 'Invalid end date format. Use ISO 8601' })
    .optional(),
  
  /** Date field to filter on */
  dateField: z.enum(['createdAt', 'updatedAt', 'date'], {
    errorMap: () => ({ message: 'Invalid date field' }),
  }).default('createdAt'),
}).refine(
  (data) => {
    // If both dates are provided, ensure start <= end
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'Start date must be before end date', path: ['startDate'] }
);

/**
 * API Error code enum
 */
export const ErrorCodeEnum = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  'PAYMENT_FAILED',
  'INSUFFICIENT_FUNDS',
  'DUPLICATE_TRANSACTION',
], {
  errorMap: () => ({ message: 'Invalid error code' }),
});

/**
 * Detailed error response schema
 * Used when returning structured errors from API endpoints
 */
export const ApiErrorSchema = z.object({
  /** Machine-readable error code */
  code: ErrorCodeEnum,
  
  /** Human-readable error message */
  message: z.string({
    required_error: 'Error message is required',
  }).min(1, { message: 'Error message cannot be empty' }),
  
  /** Additional details about the error */
  details: z.record(z.unknown(), z.unknown()).optional(),
  
  /** Field-specific validation errors */
  fieldErrors: z.record(z.array(z.string())).optional(),
  
  /** Unique request ID for tracing */
  requestId: z.string().uuid().optional(),
  
  /** Timestamp of when the error occurred */
  timestamp: z.string()
    .datetime({ message: 'Timestamp must be ISO 8601 format' })
    .default(() => new Date().toISOString()),
  
  /** Path/endpoint that caused the error */
  path: z.string().optional(),
});

/**
 * Success response wrapper schema (generic)
 * Wraps successful API responses with metadata
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    /** Response data - typed based on input schema */
    data: dataSchema,
    
    /** Success flag - always true for this schema */
    success: z.literal(true),
    
    /** Human-readable success message */
    message: z.string().optional(),
    
    /** Response metadata */
    meta: z.object({
      /** Unique request identifier */
      requestId: z.string().uuid().optional(),
      
      /** Response timestamp */
      timestamp: z.string()
        .datetime()
        .default(() => new Date().toISOString()),
    }).optional(),
    
    /** Pagination info (only for list endpoints) */
    pagination: z.object({
      /** Current page */
      page: z.number().int().positive(),
      
      /** Items per page */
      limit: z.number().int().positive(),
      
      /** Total items matching query */
      totalItems: z.number().int().nonnegative(),
      
      /** Total pages available */
      totalPages: z.number().int().nonnegative(),
      
      /** Whether there's a next page */
      hasNextPage: z.boolean(),
      
      /** Whether there's a previous page */
      hasPrevPage: z.boolean(),
    }).optional(),
  });
}

/**
 * Paginated response helper type
 * Creates a properly typed paginated API response
 */
export const PaginatedResponseMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});

/**
 * Search/Filter schema for general querying
 */
export const SearchFilterSchema = z.object({
  /** Search term for text fields */
  search: z.string()
    .max(200, { message: 'Search term too long' })
    .optional(),
  
  /** Fields to search in (defaults to all text fields) */
  searchFields: z.array(z.string()).optional(),
  
  /** Filter by exact match on specific fields */
  filters: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  
  /** Combine multiple conditions */
  operator: z.enum(['AND', 'OR']).default('AND'),
});

/**
 * ID parameter schema for dynamic routes
 */
export const IdParamSchema = z.object({
  id: z.string()
    .min(1, { message: 'ID is required' })
    .regex(/^[a-zA-Z0-9\-_]+$/, {
      message: 'ID contains invalid characters',
    }),
});

/**
 * Bulk action schema for processing multiple items
 */
export const BulkActionSchema = z.object({
  /** Array of item IDs to process */
  ids: z.array(z.string().min(1))
    .min(1, { message: 'At least one ID is required' })
    .max(100, { message: 'Cannot process more than 100 items at once' }),
  
  /** Action to perform */
  action: z.enum(['delete', 'activate', 'deactivate', 'archive'], {
    errorMap: () => ({ message: 'Invalid bulk action' }),
  }),
  
  /** Confirmation that user intends this action */
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Confirmation is required for bulk actions' }),
  }),
});

/**
 * Inferred types
 */
export type PaginationInput = z.infer<typeof PaginationSchema>;
export type PaginationOutput = z.output<typeof PaginationSchema>;
export type DateRangeInput = z.infer<typeof DateRangeSchema>;
export type ApiErrorInput = z.infer<typeof ApiErrorSchema>;
export type ApiErrorOutput = z.output<typeof ApiErrorSchema>;
export type SearchFilterInput = z.infer<typeof SearchFilterSchema>;
export type IdParamInput = z.infer<typeof IdParamSchema>;
export type BulkActionInput = z.infer<typeof BulkActionSchema>;

/** Helper type for API response */
export type ApiResponse<T> = z.infer<ReturnType<typeof createApiResponseSchema<z.ZodType<T>>>>;
