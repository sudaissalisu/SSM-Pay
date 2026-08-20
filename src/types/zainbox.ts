/**
 * @fileoverview Zainbox (Virtual Account) type definitions for SSM-Pay platform
 * @description Barrel export file for all Zainbox-related types.
 * Split into core, credentials, and split modules for better organization.
 * @module types/zainbox
 */

// Core types (enums, Zainbox interface, requests/responses, transactions)
export {
  ZainboxType,
  ZainboxStatus,
  BankIntegrationType,
  Zainbox,
  CreateZainboxRequest,
  CreateZainboxResponse,
  ZainboxTransaction,
  ZainboxTransactionFilters,
  ZainboxTransactionListResponse,
  UpdateZainboxRequest,
  ZainboxStats,
  ZainboxIdentifier,
  ZainboxEventHandler,
  ZainboxRequest,
  ZainboxResponse
} from './zainbox.core';

// Credentials and configuration types
export {
  ZainboxPermission,
  ZainboxCredentials,
  ZainboxConfig
} from './zainbox.credentials';

// Split and related types
export {
  SplitMethod,
  ZainboxSplitConfig,
  ZainboxSplitRecipient,
  PayoutAccount,
  ZainboxLimits
} from './zainbox.split';
