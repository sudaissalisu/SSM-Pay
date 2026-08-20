import { z } from 'zod';

/**
 * Zainbox validation schemas
 * Used for creating, updating, and managing Zainbox payment collections
 */

/**
 * Schema for validating zainbox names
 * Must be descriptive and unique within the merchant's account
 */
export const ZainboxNameSchema = z.string({
  required_error: 'Zainbox name is required',
  invalid_type_error: 'Name must be a string',
}).min(3, {
  message: 'Name must be at least 3 characters long',
}).max(100, {
  message: 'Name cannot exceed 100 characters',
}).regex(/^[a-zA-Z0-9\s\-_]+$/, {
  message: 'Name can only contain letters, numbers, spaces, hyphens, and underscores',
});

/**
 * Schema for callback URL validation
 * Must be a valid HTTPS URL for security
 */
export const CallbackUrlSchema = z.string({
  required_error: 'Callback URL is required',
}).url({
  message: 'Please enter a valid URL',
}).startsWith('https', {
  message: 'Callback URL must use HTTPS for security',
});

/**
 * Schema for email notification (optional field)
 * Allows empty string or valid email
 */
export const EmailNotificationSchema = z.union([
  z.string().email({ message: 'Please enter a valid email address' }),
  z.literal('').transform(() => undefined),
]).optional();

/**
 * Schema for code name prefix (max 3 characters)
 * Used to generate unique zainbox code names
 */
export const CodeNamePrefixSchema = z.string()
  .max(3, { message: 'Prefix can be up to 3 characters' })
  .regex(/^[A-Z]*$/i, {
    message: 'Prefix can only contain letters',
  })
  .optional();

/**
 * Schema for tags (comma-separated values)
 */
export const TagsSchema = z.string()
  .max(200, { message: 'Tags too long (max 200 characters)' })
  .transform((val) => val ? val.split(',').map(t => t.trim()).filter(Boolean) : [])
  .optional();

/**
 * Zainbox creation schema
 * Validates all fields required when creating a new Zainbox
 */
export const ZainboxCreateSchema = z.object({
  /** Display name for the Zainbox */
  name: ZainboxNameSchema,
  
  /** URL where payment callbacks will be sent */
  callbackUrl: CallbackUrlSchema,
  
  /** Email address for payment notifications */
  emailNotification: EmailNotificationSchema,
  
  /** Optional description of the Zainbox's purpose */
  description: z.string()
    .max(500, { message: 'Description too long (max 500 characters)' })
    .optional(),
  
  /** Comma-separated tags for organization and filtering */
  tags: z.string()
    .max(200, { message: 'Tags too long' })
    .optional(),
  
  /** Prefix for auto-generated code name (max 3 chars) */
  codeNamePrefix: CodeNamePrefixSchema,
  
  /** Enable automatic internal transfers on received payments */
  allowAutoInternalTransfer: z.preprocess(
    (val) => {
      if (typeof val === 'string') return val === 'true';
      if (typeof val === 'boolean') return val;
      return false;
    },
    z.boolean({ invalid_type_error: 'allowAutoInternalTransfer must be a boolean' }).default(false)
  ),
  
  /** Minimum amount allowed for payments to this Zainbox */
  minAmount: z.number({
    invalid_type_error: 'Min amount must be a number',
  }).nonnegative({ message: 'Minimum amount cannot be negative' })
    .optional(),
  
  /** Maximum amount allowed for payments to this Zainbox */
  maxAmount: z.number({
    invalid_type_error: 'Max amount must be a number',
  }).positive({ message: 'Maximum amount must be positive' })
    .max(100000000, { message: 'Maximum amount exceeds limit' })
    .optional(),
  
  /** Custom metadata attached to the Zainbox */
  metadata: z.record(z.unknown(), z.unknown()).optional(),
});

/**
 * Zainbox update schema
 * All fields are optional - only provided fields will be updated
 */
export const ZainboxUpdateSchema = z.object({
  /** Updated display name */
  name: ZainboxNameSchema.optional(),
  
  /** Updated callback URL */
  callbackUrl: CallbackUrlSchema.optional(),
  
  /** Updated notification email */
  emailNotification: EmailNotificationSchema,
  
  /** Updated description */
  description: z.string()
    .max(500, { message: 'Description too long' })
    .optional(),
  
  /** Updated tags */
  tags: z.string()
    .max(200, { message: 'Tags too long' })
    .optional(),
  
  /** Toggle automatic internal transfers */
  allowAutoInternalTransfer: z.preprocess(
    (val) => {
      if (typeof val === 'string') return val === 'true';
      if (typeof val === 'boolean') return val;
      return undefined;
    },
    z.boolean().optional()
  ).optional(),
  
  /** Update active status of the Zainbox */
  active: z.boolean({
    invalid_type_error: 'Active must be a boolean',
  }).optional(),
  
  /** Update minimum amount */
  minAmount: z.number()
    .nonnegative({ message: 'Minimum amount cannot be negative' })
    .optional(),
  
  /** Update maximum amount */
  maxAmount: z.number()
    .positive({ message: 'Maximum amount must be positive' })
    .max(100000000)
    .optional(),
  
  /** Update metadata (will be merged) */
  metadata: z.record(z.unknown(), z.unknown()).optional(),
}).refine(
  // Ensure at least one field is provided
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

/**
 * Zainbox query/filter schema for listing and searching
 */
export const ZainboxQuerySchema = z.object({
  /** Search by name or code */
  search: z.string().max(100).optional(),
  
  /** Filter by active status */
  active: z.preprocess(
    (val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    },
    z.boolean().optional()
  ).optional(),
  
  /** Page number for pagination */
  page: z.coerce.number()
    .int({ message: 'Page must be an integer' })
    .positive({ message: 'Page must be positive' })
    .default(1),
  
  /** Number of items per page */
  limit: z.coerce.number()
    .int({ message: 'Limit must be an integer' })
    .positive({ message: 'Limit must be positive' })
    .max(100, { message: 'Limit cannot exceed 100' })
    .default(20),
  
  /** Sort field */
  sortBy: z.enum(['name', 'createdAt', 'updatedAt'], {
    errorMap: () => ({ message: 'Invalid sort field' }),
  }).default('createdAt'),
  
  /** Sort direction */
  sortOrder: z.enum(['asc', 'desc'], {
    errorMap: () => ({ message: 'Sort order must be asc or desc' }),
  }).default('desc'),
});

/**
 * Inferred types from schemas
 */
export type ZainboxCreateInput = z.infer<typeof ZainboxCreateSchema>;
export type ZainboxUpdateInput = z.infer<typeof ZainboxUpdateSchema>;
export type ZainboxQueryInput = z.infer<typeof ZainboxQuerySchema>;

/** Validated output types */
export type ZainboxCreateOutput = z.output<typeof ZainboxCreateSchema>;
export type ZainboxUpdateOutput = z.output<typeof ZainboxUpdateSchema>;
export type ZainboxQueryOutput = z.output<typeof ZainboxQuerySchema>;
