/**
 * @fileoverview Transaction type definitions for SSM-Pay platform
 * @description Barrel export file for all transaction-related types.
 * Split into core, filters, and batch modules for better organization.
 * @module types/transaction
 */

// Core types (enums, Transaction interface, CreateTransactionRequest, etc.)
export {
  TransactionType,
  TransactionStatus,
  TransactionCategory,
  TransactionSource,
  Transaction,
  CreateTransactionRequest,
  TransactionTimelineEvent,
  TransactionBalance,
  TransactionIdentifier,
  TransactionEventHandler
} from './transaction.core';

export type {
  Transaction as TransactionType
} from './transaction.core';

// Filter and summary types
export type {
  TransactionFilters,
  TransactionSummary,
  TransactionListResponse
} from './transaction.filters';

// Batch and export types
export {
  BatchTransactionRequest,
  BatchTransactionItem,
  BatchTransactionResponse,
  BatchTransactionStatus,
  TransactionExportOptions,
  TransactionExportResponse,
  TransactionField,
  TransactionRequest,
  TransactionResponse
} from './transaction.batch';

export type {
  BatchTransactionItem as BatchTransactionItemType,
  TransactionExportOptions as TransactionExportOptionsType,
  TransactionExportResponse as TransactionExportResponseType,
  TransactionField as TransactionFieldType,
  TransactionRequest as TransactionRequestType,
  TransactionResponse as TransactionResponseType
} from './transaction.batch';
