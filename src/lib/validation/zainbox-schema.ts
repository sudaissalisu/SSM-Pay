/**
 * Zainbox Validation Schemas for SSM-Pay Platform
 * 
 * Barrel export file for all Zainbox-related validation schemas.
 * Split into core (create/update) and credentials/split modules.
 */

// Core schemas (CreateZainbox, UpdateZainbox)
export {
  ZainboxTypeEnum,
  ZainboxStatusEnum,
  BankIntegrationEnum,
  CreateZainboxSchema,
  UpdateZainboxSchema
} from './zainbox-core.schema';

export type {
  ZainboxType,
  ZainboxStatus,
  BankIntegration,
  CreateZainboxInput,
  UpdateZainboxInput
} from './zainbox-core.schema';

// Credentials & Split schemas
export {
  SplitTypeEnum,
  ZainboxCredentialsSchema,
  ZainboxSplitConfigSchema,
  ZainboxTransactionQuerySchema
} from './zainbox-credentials.schema';

export type {
  SplitType,
  ZainboxCredentialsInput,
  ZainboxSplitConfigInput,
  SplitRecipientInput,
  ZainboxTransactionQueryInput
} from './zainbox-credentials.schema';
