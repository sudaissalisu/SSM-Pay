/**
 * Customer Type Definitions
 * TypeScript types for customer/user-related entities
 * 
 * @module types/customer
 */

import { CurrencyCode, PaymentMethod } from './payment';

// ============== Customer Types ==============

export interface Customer {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth?: Date;
  kycLevel: KYCLevel;
  tier: CustomerTier;
  status: CustomerStatus;
  addresses: Address[];
  paymentMethods: PaymentMethod[];
  preferences: CustomerPreferences;
  metadata: CustomerMetadata;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export type KYCLevel = 'none' | 'basic' | 'enhanced' | 'professional';
export type CustomerTier = 'standard' | 'premium' | 'business' | 'enterprise';
export type CustomerStatus = 'active' | 'suspended' | 'banned' | 'closed';

export interface CustomerPreferences {
  language: LanguageCode;
  currency: CurrencyCode;
  timezone: string;
  notifications: NotificationPreferences;
  marketingOptIn: boolean;
  twoFactorEnabled: boolean;
  biometricEnabled: boolean;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  transactionAlerts: boolean;
  promotionalEmails: boolean;
  securityAlerts: boolean;
}

export interface CustomerMetadata {
  source: AcquisitionSource;
  campaign?: string;
  referralCode?: string;
  referredBy?: string;
  tags: string[];
  customFields: Record<string, unknown>;
}

export type LanguageCode = 'en' | 'fr' | 'es' | 'pt' | 'ar' | 'ha' | 'yo' | 'ig';
export type AcquisitionSource = 'organic' | 'referral' | 'api' | 'import' | 'admin';

// ============== Address Types ==============

export interface Address {
  id: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: CountryCode;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  label?: string;
  validated: boolean;
  metadata?: Record<string, unknown>;
}

export type CountryCode =
  | 'NG'
  | 'US'
  | 'GB'
  | 'CA'
  | 'DE'
  | 'FR'
  | 'IT'
  | 'ES'
  | 'GH'
  | 'KE'
  | 'ZA'
  | 'CM'
  | 'SN'
  | 'CI'
  | 'BJ'
  | 'TN'
  | 'MA'
  | 'ET'
  | 'EG'
  | 'LY'
  | 'SD'
  | 'TZ'
  | 'UG'
  | 'RW'
  | 'BI'
  | 'GQ'
  | 'ER'
  | 'DJ'
  | 'AO'
  | 'GW'
  | 'MR'
  | 'MU'
  | 'MZ'
  | 'MW'
  | 'NA'
  | 'SL'
  | 'GM'
  | 'ST'
  | 'LC'
  | 'CV'
  | 'CF'
  | 'TD'
  | 'TG'
  | 'NE'
  | 'ML'
  | 'BF'
  | 'GN'
  | 'GA'
  | 'SN'
  | 'CG'
  | 'CD'
  | 'SC'
  | 'ZW'
  | 'MZ'
  | 'NA';
