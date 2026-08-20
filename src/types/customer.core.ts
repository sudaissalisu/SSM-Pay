/**
 * @fileoverview Core Customer type definitions
 * @description Contains Customer interface, CustomerRequest/Response, and search types
 * @module types/customer/core
 */

import {
  CustomerTier,
  CustomerStatus,
  KYCVerification,
  CustomerPreferences
} from './customer.index';

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Core Customer entity representing a registered user on the platform.
 * This is the central data structure for all customer operations.
 *
 * @interface Customer
 * @example
 * ```typescript
 * const customer: Customer = {
 *   id: 'cust_abc123',
 *   email: 'john.doe@example.com',
 *   phone: '+2348012345678',
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   createdAt: new Date()
 * };
 * ```
 */
export interface Customer {
  /** Unique identifier for the customer (format: cust_xxxx) */
  id: string;
  /** Primary email address for the customer */
  email: string;
  /** Primary phone number (E.164 format recommended) */
  phone?: string;
  /** Customer's first name/given name */
  firstName?: string;
  /** Customer's last name/family name */
  lastName?: string;
  /** Customer's middle name (optional) */
  middleName?: string;
  /** Display name (computed from first/last names) */
  displayName?: string;
  /** Profile avatar URL */
  avatarUrl?: string;
  /** Current account status */
  status: CustomerStatus;
  /** Customer tier level */
  tier: CustomerTier;
  /** KYC verification information */
  kyc: KYCVerification;
  /** Customer preferences and settings */
  preferences: CustomerPreferences;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Associated Zainbox/virtual account ID */
  zainboxId?: string;
  /** Timestamp when customer was created */
  createdAt: Date;
  /** Timestamp when customer was last updated */
  updatedAt: Date;
  /** Timestamp of last login/activity */
  lastActiveAt?: Date;
  /** Account closure date (if applicable) */
  closedAt?: Date;
}

/**
 * Request payload for creating a new customer.
 *
 * @interface CustomerRequest
 */
export interface CustomerRequest {
  /** Email address (required) */
  email: string;
  /** Phone number */
  phone?: string;
  /** First name */
  firstName?: string;
  /** Last name */
  lastName?: string;
  /** Middle name */
  middleName?: string;
  /** Display name override */
  displayName?: string;
  /** Profile avatar URL */
  avatarUrl?: string;
  /** Initial metadata */
  metadata?: Record<string, unknown>;
  /** External reference ID from your system */
  externalId?: string;
  /** Customer group/segment */
  group?: string;
  /** Initial tier assignment */
  tier?: CustomerTier;
  /** Preferred notification channels */
  preferredChannels?: ('email' | 'sms' | 'push' | 'whatsapp')[];
}

/**
 * Response returned after successful customer creation or retrieval.
 *
 * @interface CustomerResponse
 */
export interface CustomerResponse {
  /** Indicates if operation was successful */
  success: boolean;
  /** Response message */
  message: string;
  /** Created/retrieved customer data */
  data: Customer;
}

// ============================================================================
// SEARCH AND LIST INTERFACES
// ============================================================================

/**
 * Parameters for searching and filtering customers.
 *
 * @interface CustomerSearchParams
 */
export interface CustomerSearchParams {
  /** Search by email (partial match) */
  email?: string;
  /** Search by phone number (partial match) */
  phone?: string;
  /** Search by name (searches first, last, and display names) */
  name?: string;
  /** Filter by exact customer ID */
  id?: string;
  /** Filter by external ID */
  externalId?: string;
  /** Filter by customer status */
  status?: CustomerStatus;
  /** Filter by tier level */
  tier?: CustomerTier;
  /** Filter by KYC status */
  kycStatus?: import('./customer.kyc').KYCStatus;
  /** Filter by customer group */
  group?: string;
  /** Filter by creation date range start */
  createdFrom?: Date;
  /** Filter by creation date range end */
  createdTo?: Date;
  /** Filter by last activity date range start */
  activeFrom?: Date;
  /** Filter by last activity date range end */
  activeTo?: Date;
  /** Pagination page number */
  page?: number;
  /** Items per page */
  perPage?: number;
  /** Sort field */
  sortBy?: 'createdAt' | 'updatedAt' | 'lastActiveAt' | 'name' | 'email';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response for customer listings.
 *
 * @interface CustomerListResponse
 */
export interface CustomerListResponse {
  /** Array of customers for current page */
  data: Customer[];
  /** Pagination metadata */
  meta: {
    /** Current page number */
    currentPage: number;
    /** Total number of pages */
    totalPages: number;
    /** Total number of customers matching filters */
    totalItems: number;
    /** Items per page */
    perPage: number;
    /** Whether there are more pages */
    hasNextPage: boolean;
    /** Whether there is a previous page */
    hasPrevPage: boolean;
  };
}

// ============================================================================
// UPDATE AND STATS INTERFACES
// ============================================================================

/**
 * Customer update request payload.
 *
 * @interface UpdateCustomerRequest
 */
export interface UpdateCustomerRequest {
  /** Email address */
  email?: string;
  /** Phone number */
  phone?: string;
  /** First name */
  firstName?: string;
  /** Last name */
  lastName?: string;
  /** Display name */
  displayName?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Metadata to update (merged with existing) */
  metadata?: Record<string, unknown>;
  /** Preferences to update (merged with existing) */
  preferences?: Partial<CustomerPreferences>;
  /** Status update (requires admin privileges) */
  status?: CustomerStatus;
  /** Tier update (requires admin privileges) */
  tier?: CustomerTier;
}

/**
 * Customer statistics/aggregation data.
 *
 * @interface CustomerStats
 */
export interface CustomerStats {
  /** Total number of customers */
  totalCustomers: number;
  /** Active customers count */
  activeCustomers: number;
  /** New customers this period */
  newCustomers: number;
  /** Customers by tier */
  customersByTier: Record<CustomerTier, number>;
  /** Customers by KYC status */
  customersByKycStatus: Record<import('./customer.kyc').KYCStatus, number>;
  /** Average registration rate per day */
  avgRegistrationsPerDay: number;
  /** Top countries by customer count */
  topCountries: { country: string; count: number }[];
}

// ============================================================================
// TYPE ALIASES
// ============================================================================

/**
 * Type for customer search identifier (ID, email, or phone).
 */
export type CustomerIdentifier =
  | { id: string }
  | { email: string }
  | { phone: string }
  | { externalId: string };

/**
 * Type for customer event handlers.
 */
export type CustomerEventHandler = (
  event: 'created' | 'updated' | 'deleted' | 'kyc_updated',
  customer: Customer
) => Promise<void> | void;

/**
 * Union type for customer request types.
 */
export type CustomerOperationRequest =
  | CustomerRequest
  | UpdateCustomerRequest
  | import('./customer.kyc').KYCSubmissionRequest;
