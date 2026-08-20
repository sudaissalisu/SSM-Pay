/**
 * Customer Validation Schemas for SSM-Pay Platform
 * 
 * Comprehensive validation for customer management operations including
 * creation, updates, search, and KYC verification processes.
 */

import { z } from 'zod';

// ============================================================================
// Enum Definitions
// ============================================================================

/**
 * Customer status values
 */
export const CustomerStatusEnum = z.enum([
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'RESTRICTED',
], {
  message: 'Invalid customer status',
});

export type CustomerStatus = z.infer<typeof CustomerStatusEnum>;

/**
 * KYC tier levels for compliance
 */
export const KycTierEnum = z.enum([
  'TIER_1',
  'TIER_2',
  'TIER_3',
], {
  message: 'Invalid KYC tier level',
});

export type KycTier = z.infer<typeof KycTierEnum>;

/**
 * Supported document types for KYC verification
 */
export const DocumentTypeEnum = z.enum([
  'NIN_SLIP',
  'DRIVERS_LICENSE',
  'INTERNATIONAL_PASSPORT',
  'VOTERS_CARD',
  'UTILITY_BILL',
  'BANK_STATEMENT',
], {
  message: 'Unsupported document type provided',
});

export type DocumentType = z.infer<typeof DocumentTypeEnum>;

/**
 * Verification status for documents
 */
export const VerificationStatusEnum = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'UNDER_REVIEW',
], {
  message: 'Invalid verification status',
});

export type VerificationStatus = z.infer<typeof VerificationStatusEnum>;

// ============================================================================
// Base Schemas (Reusable Components)
// ============================================================================

/**
 * Nigerian phone number validation pattern
 * Supports formats: +234XXXXXXXXXX, 0XXXXXXXXX, 234XXXXXXXXXX
 */
const NigerianPhoneSchema = z.string()
  .regex(
    /^(\+234|0)[789]\d{9}$/,
    'Phone number must be a valid Nigerian number (e.g., +2348012345678 or 08012345678)'
  )
  .transform((val) => {
    // Normalize to international format
    if (val.startsWith('0')) {
      return '+234' + val.slice(1);
    }
    return val;
  });

/**
 * Email with strict validation
 */
const StrictEmailSchema = z.email('Please provide a valid email address')
  .min(5, 'Email address is too short')
  .max(254, 'Email address exceeds maximum length')
  .transform((val) => val.toLowerCase().trim());

/**
 * Name field validation (first/last name)
 */
const NameSchema = z.string()
  .min(2, 'Name must be at least 2 characters long')
  .max(100, 'Name cannot exceed 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters. Only letters, spaces, hyphens and apostrophes are allowed');

/**
 * UUID validation
 */
const UuidSchema = z.uuid('Invalid UUID format');

// ============================================================================
// Create Customer Schema
// ============================================================================

/**
 * Schema for creating a new customer record
 * All required fields must be present at creation time
 */
export const CreateCustomerSchema = z.object({
  // Required fields
  email: StrictEmailSchema,
  
  // Personal information (at least one name required)
  firstName: NameSchema.optional(),
  
  lastName: NameSchema.optional(),
  
  phone: NigerianPhoneSchema.optional(),
  
  // Company/Organization info (for business customers)
  companyName: z.string()
    .min(2, 'Company name too short')
    .max(200, 'Company name too long')
    .regex(/^[a-zA-Z0-9\s&'.,-]+$/, 'Company name contains invalid characters')
    .optional(),
  
  // Address information
  address: z.object({
    street: z.string()
      .min(5, 'Street address is required')
      .max(200, 'Street address is too long'),
    
    city: z.string()
      .min(2, 'City name is required')
      .max(100, 'City name is too long'),
    
    state: z.string()
      .min(2, 'State is required')
      .max(100, 'State name is too long'),
    
    country: z.string()
      .length(2, 'Country code must be ISO 3166-1 alpha-2 (e.g., NG)')
      .default('NG'),
    
    postalCode: z.string()
      .regex(/^\d{4,10}$/, 'Postal code must be numeric (4-10 digits)')
      .optional(),
  }).optional(),
  
  // Metadata and custom attributes
  metadata: z.record(z.string(), z.unknown())
    .default({}),
  
  // External identifiers
  externalId: z.string()
    .min(1, 'External ID cannot be empty')
    .max(100, 'External ID is too long')
    .optional(),
  
  // Risk classification
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'], {
    message: 'Invalid risk level specified',
  }).default('UNKNOWN'),
  
  // Customer group/categorization
  customerGroup: z.string()
    .max(50, 'Customer group name too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Customer group can only contain alphanumeric characters, hyphens, and underscores')
    .optional(),
}).refine(
  // At least one of firstName or lastName should be provided
  (data) => data.firstName || data.lastName || data.companyName,
  { message: 'At least one of firstName, lastName, or companyName must be provided', path: ['firstName'] }
);

/** Type for create customer input */
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

// ============================================================================
// Update Customer Schema
// ============================================================================

/**
 * Schema for updating existing customer records
 * All fields are optional to support partial updates
 */
export const UpdateCustomerSchema = z.object({
  // Updatable personal fields
  firstName: NameSchema.optional(),
  
  lastName: NameSchema.optional(),
  
  email: StrictEmailSchema.optional(),
  
  phone: NigerianPhoneSchema.optional(),
  
  // Company update
  companyName: z.string()
    .min(2, 'Company name too short')
    .max(200, 'Company name too long')
    .optional(),
  
  // Status changes
  status: CustomerStatusEnum.optional(),
  
  // Address updates
  address: z.object({
    street: z.string().min(5).max(200).optional(),
    city: z.string().min(2).max(100).optional(),
    state: z.string().min(2).max(100).optional(),
    country: z.string().length(2).optional(),
    postalCode: z.string().regex(/^\d{4,10}$/).optional(),
  }).strict().optional(),
  
  // Metadata merge/update
  metadata: z.record(z.string(), z.unknown()).optional(),
  
  // Risk reclassification
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']).optional(),
  
  // Group assignment
  customerGroup: z.string()
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
}).refine(
  // Prevent empty updates
  (data) => Object.keys(data).length > 0,
  { message: 'Update request must include at least one field to update' }
);

/** Type for update customer input */
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;

// ============================================================================
// Customer Search Parameters Schema
// ============================================================================

/**
 * Schema for customer search/query parameters
 * Supports pagination, filtering, and sorting
 */
export const CustomerSearchParamsSchema = z.object({
  // Pagination parameters
  page: z.coerce.number()
    .int('Page number must be an integer')
    .positive('Page number must be positive')
    .default(1),
  
  limit: z.coerce.number()
    .int('Limit must be an integer')
    .positive('Limit must be positive')
    .min(1, 'Minimum page size is 1')
    .max(100, 'Maximum page size is 100')
    .default(20),
  
  // Search filters
  query: z.string()
    .max(255, 'Search query exceeds maximum length')
    .optional(), // Searches across name, email, phone
  
  email: z.email().optional(),
  
  phone: z.string()
    .regex(/^(\+234|0)[789]\d{9}$/)
    .optional(),
  
  status: CustomerStatusEnum.optional(),
  
  customerGroup: z.string()
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  
  kycTier: KycTierEnum.optional(),
  
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']).optional(),
  
  dateCreatedFrom: z.string()
    .datetime({ message: 'Start date must be valid ISO datetime' })
    .optional(),
  
  dateCreatedTo: z.string()
    .datetime({ message: 'End date must be valid ISO datetime' })
    .optional(),
  
  // Sorting options
  sortBy: z.enum([
    'createdAt',
    'updatedAt',
    'firstName',
    'lastName',
    'email',
  ], { message: 'Invalid sort field' }).default('createdAt'),
  
  sortOrder: z.enum(['asc', 'desc'], {
    message: 'Sort order must be asc or desc',
  }).default('desc'),
  
  // Include soft-deleted records
  includeDeleted: z.coerce.boolean().default(false),
}).refine(
  // Validate date range logic
  (data) => {
    if (data.dateCreatedFrom && data.dateCreatedTo) {
      return new Date(data.dateCreatedFrom) <= new Date(data.dateCreatedTo);
    }
    return true;
  },
  { message: 'Start date cannot be after end date', path: ['dateCreatedFrom'] }
);

/** Type for customer search params */
export type CustomerSearchParams = z.infer<typeof CustomerSearchParamsSchema>;

// ============================================================================
// KYC Verification Schema
// ============================================================================

/**
 * Schema for submitting KYC verification documents
 * Handles document upload and identity verification
 */
export const KycVerificationSchema = z.object({
  customerId: UuidSchema,
  
  // Document identification
  documentType: DocumentTypeEnum,
  
  documentNumber: z.string()
    .min(6, 'Document number is too short')
    .max(30, 'Document number is too long')
    .regex(/^[A-Z0-9]+$/, 'Document number can only contain uppercase letters and numbers')
    .transform((val) => val.toUpperCase()),
  
  // Document images/files (base64 encoded)
  documentFrontImage: z.string()
    .min(100, 'Document front image appears to be empty or corrupted')
    .max(5000000, 'Document front image exceeds maximum size (5MB base64)')
    .startsWith('data:image/', 'Document front image must be a valid image file (base64 encoded)')
    .optional(),
  
  documentBackImage: z.string()
    .min(100, 'Document back image appears to be empty or corrupted')
    .max(5000000, 'Document back image exceeds maximum size (5MB base64)')
    .startsWith('data:image/', 'Document back image must be a valid image file (base64 encoded)')
    .optional(),
  
  // Selfie for liveness check
  selfieImage: z.string()
    .min(100, 'Selfie image appears to be empty or corrupted')
    .max(5000000, 'Selfie image exceeds maximum size (5MB base64)')
    .startsWith('data:image/', 'Selfie must be a valid image file (base64 encoded)')
    .optional(),
  
  // Additional information
  issueDate: z.string()
    .datetime({ message: 'Issue date must be a valid ISO date' })
    .optional(),
  
  expiryDate: z.string()
    .datetime({ message: 'Expiry date must be a valid ISO date' })
    .optional(),
  
  issuingCountry: z.string()
    .length(2, 'Issuing country must be ISO 3166-1 alpha-2 code')
    .default('NG'),
  
  consentGiven: z.boolean().default(true),
  
  additionalInfo: z.record(z.string(), z.unknown())
    .default({}),
}).refine(
  // Front image required for most document types
  (data) => {
    const requiresFront = ['NIN_SLIP', 'DRIVERS_LICENSE', 'INTERNATIONAL_PASSPORT', 'VOTERS_CARD'];
    if (requiresFront.includes(data.documentType)) {
      return !!data.documentFrontImage;
    }
    return true;
  },
  { message: 'Front document image is required for this document type', path: ['documentFrontImage'] }
).refine(
  // Expiry date validation
  (data) => {
    if (data.expiryDate) {
      return new Date(data.expiryDate) > new Date();
    }
    return true;
  },
  { message: 'Document has expired or will expire soon', path: ['expiryDate'] }
);

/** Type for KYC verification input */
export type KycVerificationInput = z.infer<typeof KycVerificationSchema>;

// ============================================================================
// KYC Review Schema (Admin Operations)
// ============================================================================

/**
 * Schema for admin review/approval/rejection of KYC submissions
 */
export const KycReviewSchema = z.object({
  kycSubmissionId: UuidSchema,
  
  action: z.enum(['approve', 'reject', 'request_info'], {
    message: 'Action must be approve, reject, or request_info',
  }),
  
  reason: z.string()
    .min(10, 'Review reason must be at least 10 characters')
    .max(1000, 'Review reason is too verbose')
    .optional(),
  
  notes: z.string()
    .max(2000, 'Internal notes exceed maximum length')
    .optional(),
  
  reviewerId: UuidSchema,
  
  reviewedAt: z.string()
    .datetime()
    .default(() => new Date().toISOString()),
}).refine(
  // Reason required for rejection
  (data) => data.action !== 'reject' || (data.reason && data.reason.length >= 10),
  { message: 'Reason is required when rejecting a KYC submission', path: ['reason'] }
);

/** Type for KYC review input */
export type KycReviewInput = z.infer<typeof KycReviewSchema>;

// ============================================================================
// Customer Bulk Operations Schema
// ============================================================================

/**
 * Schema for bulk customer operations (e.g., bulk status change)
 */
export const CustomerBulkOperationSchema = z.object({
  customerIds: z.array(UuidSchema)
    .min(1, 'At least one customer ID is required')
    .max(500, 'Bulk operations limited to 500 customers at a time'),
  
  operation: z.enum(['activate', 'deactivate', 'suspend', 'assign_group', 'update_risk'], {
    message: 'Invalid operation type',
  }),
  
  value: z.union([
    z.string(),
    z.boolean(),
    z.enum(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']),
  ]).optional(),
  
  reason: z.string()
    .min(5, 'Operation reason is required')
    .max(500, 'Operation reason is too long')
    .optional(),
}).refine(
  // Value required for certain operations
  (data) => {
    const requiresValue = ['assign_group', 'update_risk'];
    if (requiresValue.includes(data.operation)) {
      return data.value !== undefined;
    }
    return true;
  },
  { message: 'Value parameter is required for this operation type', path: ['value'] }
);

/** Type for bulk operation input */
export type CustomerBulkOperationInput = z.infer<typeof CustomerBulkOperationSchema>;
