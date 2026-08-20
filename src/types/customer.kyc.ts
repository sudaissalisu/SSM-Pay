/**
 * @fileoverview Customer KYC (Know Your Customer) type definitions
 * @description Contains KYCStatus, IdentityDocumentType, KYCVerification, and submission types
 * @module types/customer/kyc
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Represents the KYC (Know Your Customer) verification status.
 * Customers must complete KYC to access full platform features.
 *
 * @enum {string}
 * @example
 * ```typescript
 * if (customer.kyc.status === KYCStatus.VERIFIED) {
 *   // Full access granted
 * }
 * ```
 */
export enum KYCStatus {
  /** KYC not yet started */
  NOT_STARTED = 'not_started',
  /** KYC documents submitted, awaiting review */
  PENDING = 'pending',
  /** KYC verification in progress */
  IN_PROGRESS = 'in_progress',
  /** KYC successfully verified */
  VERIFIED = 'verified',
  /** KYC verification failed - resubmission required */
  FAILED = 'failed',
  /** KYC verification rejected - cannot retry */
  REJECTED = 'rejected',
  /** KYC document expired - re-verification required */
  EXPIRED = 'expired',
  /** KYC suspended due to compliance issues */
  SUSPENDED = 'suspended'
}

/**
 * Types of identity documents accepted for KYC verification.
 *
 * @enum {string}
 */
export enum IdentityDocumentType {
  /** National Identity Card */
  NIN = 'nin',
  /** International Passport */
  PASSPORT = 'passport',
  /** Driver's License */
  DRIVERS_LICENSE = 'drivers_license',
  /** Voter's Card */
  VOTERS_CARD = 'voters_card',
  /** Permanent Voter's Card (PVC) */
  PVC = 'pvc'
}

// ============================================================================
// VERIFICATION INTERFACES
// ============================================================================

/**
 * KYC Verification information attached to a customer.
 * Tracks the state and details of identity verification.
 *
 * @interface KYCVerification
 */
export interface KYCVerification {
  /** Current KYC verification status */
  status: KYCStatus;
  /** Type of identity document submitted */
  documentType?: IdentityDocumentType;
  /** Document number (masked for security) */
  documentNumber?: string;
  /** Document upload URL (if applicable) */
  documentUrl?: string;
  /** Date when KYC was submitted */
  submittedAt?: Date;
  /** Date when KYC was verified/rejected */
  verifiedAt?: Date;
  /** Expiration date of KYC verification */
  expiresAt?: Date;
  /** Reason for failure/rejection (if applicable) */
  rejectionReason?: string;
  /** Reviewer ID who processed the KYC */
  reviewedBy?: string;
  /** Number of submission attempts */
  attemptCount: number;
  /** Maximum allowed attempts */
  maxAttempts: number;
  /** BVN (Bank Verification Number) if linked */
  bvn?: string;
  /** NIN (National Identification Number) if linked */
  nin?: string;
  /** Selfie photo URL for facial verification */
  selfieUrl?: string;
  /** Address verification status */
  addressVerified: boolean;
  /** Additional verification notes */
  notes?: string;
}

// ============================================================================
// SUBMISSION INTERFACES
// ============================================================================

/**
 * Request payload for submitting KYC documents.
 *
 * @interface KYCSubmissionRequest
 */
export interface KYCSubmissionRequest {
  /** Customer ID */
  customerId: string;
  /** Type of identity document */
  documentType: IdentityDocumentType;
  /** Document number */
  documentNumber: string;
  /** Front side document image (base64 or URL) */
  documentFront: string;
  /** Back side document image (if required) */
  documentBack?: string;
  /** Selfie photo for facial verification */
  selfie?: string;
  /** BVN (optional but recommended) */
  bvn?: string;
  /** NIN (optional but recommended) */
  nin?: string;
  /** Date of birth */
  dateOfBirth?: string;
  /** Residential address */
  address?: {
    /** Street address */
    street: string;
    /** City */
    city: string;
    /** State/Province */
    state: string;
    /** Postal code */
    postalCode?: string;
    /** Country code (ISO 3166-1 alpha-2) */
    country: string;
  };
}

/**
 * Response after KYC submission processing.
 *
 * @interface KYCSubmissionResponse
 */
export interface KYCSubmissionResponse {
  /** Indicates if submission was successful */
  success: boolean;
  /** Processing message */
  message: string;
  /** Updated KYC status */
  status: KYCStatus;
  /** Estimated processing time */
  estimatedProcessingTime?: string;
  /** Submission timestamp */
  submittedAt: Date;
  /** Any validation errors encountered */
  errors?: ValidationError[];
}

/**
 * Validation error structure.
 *
 * @interface ValidationError
 */
export interface ValidationError {
  /** Field that failed validation */
  field: string;
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** Additional error details */
  details?: unknown;
}
