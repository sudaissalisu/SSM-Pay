/**
 * @fileoverview Customer shared types re-exports
 * @description Re-exports types used across customer sub-modules
 * @module types/customer/index
 */

// Re-export enums and interfaces needed by other modules
export { CustomerTier, CustomerStatus } from './customer.preferences';
export type { CustomerPreferences } from './customer.preferences';
export { KYCStatus, IdentityDocumentType } from './customer.kyc';
export type { KYCVerification, ValidationError } from './customer.kyc';
