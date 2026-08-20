/**
 * @fileoverview Customer type definitions for SSM-Pay platform
 * @description Barrel export file for all customer-related types.
 * Split into core, kyc, and preferences modules for better organization.
 * @module types/customer
 */

// Core types (Customer interface, requests/responses, search)
export {
  Customer,
  CustomerRequest,
  CustomerResponse,
  CustomerSearchParams,
  CustomerListResponse,
  UpdateCustomerRequest,
  CustomerStats,
  CustomerIdentifier,
  CustomerEventHandler,
  CustomerOperationRequest
} from './customer.core';

// KYC types
export {
  KYCStatus,
  IdentityDocumentType,
  KYCVerification,
  KYCSubmissionRequest,
  KYCSubmissionResponse,
  ValidationError
} from './customer.kyc';

// Preferences and status/tier types
export {
  CustomerTier,
  CustomerStatus,
  CustomerPreferences,
  NotificationPreferences,
  PaymentPreferences,
  SecurityPreferences,
  DisplayPreferences,
  CommunicationPreferences,
  DeviceInfo
} from './customer.preferences';
