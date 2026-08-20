/**
 * @fileoverview Customer preferences and tier/status type definitions
 * @description Contains CustomerPreferences, CustomerTier, CustomerStatus, and sub-preferences
 * @module types/customer/preferences
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Customer tier levels based on transaction volume and verification status.
 *
 * @enum {string}
 */
export enum CustomerTier {
  /** New customer with limited features */
  BASIC = 'basic',
  /** Verified customer with standard features */
  STANDARD = 'standard',
  /** Premium customer with enhanced limits */
  PREMIUM = 'premium',
  /** Enterprise customer with custom features */
  ENTERPRISE = 'enterprise'
}

/**
 * Customer account status.
 *
 * @enum {string}
 */
export enum CustomerStatus {
  /** Account is active and fully functional */
  ACTIVE = 'active',
  /** Account is temporarily disabled */
  SUSPENDED = 'suspended',
  /** Account has been permanently closed */
  CLOSED = 'closed',
  /** Account is under review */
  UNDER_REVIEW = 'under_review',
  /** Account is frozen due to suspicious activity */
  FROZEN = 'frozen'
}

// ============================================================================
// PREFERENCES INTERFACES
// ============================================================================

/**
 * Customer preferences and configurable settings.
 * Allows customization of the customer experience.
 *
 * @interface CustomerPreferences
 */
export interface CustomerPreferences {
  /** Preferred language for communications */
  language: string;
  /** Preferred timezone */
  timezone: string;
  /** Notification preferences */
  notifications: NotificationPreferences;
  /** Payment preferences */
  payment: PaymentPreferences;
  /** Security preferences */
  security: SecurityPreferences;
  /** Display/theme preferences */
  display: DisplayPreferences;
  /** Communication preferences */
  communication: CommunicationPreferences;
}

/**
 * Notification preference settings.
 *
 * @interface NotificationPreferences
 */
export interface NotificationPreferences {
  /** Enable email notifications */
  email: boolean;
  /** Enable SMS notifications */
  sms: boolean;
  /** Enable push notifications */
  push: boolean;
  /** Enable WhatsApp notifications */
  whatsapp: boolean;
  /** Notify on payment received */
  onPaymentReceived: boolean;
  /** Notify on payment sent */
  onPaymentSent: boolean;
  /** Notify on failed transactions */
  onFailedTransaction: boolean;
  /** Notify on KYC status changes */
  onKycStatusChange: boolean;
  /** Marketing/promotional emails consent */
  marketingEmails: boolean;
  /** Daily digest email */
  dailyDigest: boolean;
  /** Weekly summary email */
  weeklySummary: boolean;
}

/**
 * Payment-related preferences.
 *
 * @interface PaymentPreferences
 */
export interface PaymentPreferences {
  /** Default payment currency */
  defaultCurrency: string;
  /** Preferred payment methods (ordered by preference) */
  preferredMethods: string[];
  /** Enable save card feature */
  saveCards: boolean;
  /** Require confirmation for payments above threshold */
  requireConfirmation: boolean;
  /** Confirmation threshold amount */
  confirmationThreshold: number;
  /** Enable biometric authentication for payments */
  biometricAuth: boolean;
  /** Default split configuration ID */
  defaultSplitConfig?: string;
  /** Auto-accept incoming transfers */
  autoAcceptTransfers: boolean;
  /** Set spending limit (0 = no limit) */
  monthlySpendingLimit: number;
}

/**
 * Security-related preferences.
 *
 * @interface SecurityPreferences
 */
export interface SecurityPreferences {
  /** Enable two-factor authentication */
  twoFactorEnabled: boolean;
  /** 2FA method */
  twoFactorMethod: 'app' | 'sms' | 'email' | 'call';
  /** Session timeout in minutes */
  sessionTimeout: number;
  /** Enable login notifications */
  loginNotifications: boolean;
  /** Require password change frequency (days, 0 = never) */
  passwordChangeFrequency: number;
  /** Enable device management */
  deviceManagement: boolean;
  /** Trusted devices list */
  trustedDevices?: DeviceInfo[];
  /** IP whitelist (empty = no restriction) */
  ipWhitelist?: string[];
  /** Enable transaction signing for large amounts */
  transactionSigning: boolean;
  /** Transaction signing threshold */
  transactionSigningThreshold: number;
}

/**
 * Display and UI preferences.
 *
 * @interface DisplayPreferences
 */
export interface DisplayPreferences {
  /** Theme preference */
  theme: 'light' | 'dark' | 'system';
  /** Date format preference */
  dateFormat: string;
  /** Number formatting locale */
  numberLocale: string;
  /** Show amounts with currency symbol */
  showCurrencySymbol: boolean;
  /** Compact number display (e.g., 1.2k instead of 1200) */
  compactNumbers: boolean;
  /** Dashboard layout preference */
  dashboardLayout: 'default' | 'compact' | 'detailed';
}

/**
 * Communication channel preferences.
 *
 * @interface CommunicationPreferences
 */
export interface CommunicationPreferences {
  /** Preferred primary contact method */
  primaryChannel: 'email' | 'sms' | 'whatsapp';
  /** Secondary contact method */
  secondaryChannel?: 'email' | 'sms' | 'whatsapp';
  /** Opt out of all marketing communications */
  optOutMarketing: boolean;
  /** Preferred contact time window */
  contactHours?: {
    /** Start hour (24-hour format) */
    start: number;
    /** End hour (24-hour format) */
    end: number;
    /** Timezone */
    timezone: string;
  };
}

/**
 * Device information for trusted device tracking.
 *
 * @interface DeviceInfo
 */
export interface DeviceInfo {
  /** Unique device identifier */
  deviceId: string;
  /** Device name/label */
  name: string;
  /** Device type */
  type: 'mobile' | 'desktop' | 'tablet' | 'other';
  /** Operating system */
  os: string;
  /** Browser (if web) */
  browser?: string;
  /** Last used timestamp */
  lastUsedAt: Date;
  /** IP address at registration */
  ipAddress: string;
  /** Whether device is currently trusted */
  isTrusted: boolean;
}
