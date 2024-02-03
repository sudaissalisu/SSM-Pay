/**
 * Enterprise Configuration Management
 * Centralized configuration with environment-specific overrides
 * 
 * @module config/index
 */

import { logger } from '@/lib/logger';

// ============== Type Definitions ==============

export interface AppConfig {
  app: ApplicationConfig;
  server: ServerConfig;
  database: DatabaseConfig;
  zainpay: ZainpayConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
  cache: CacheConfig;
  rateLimit: RateLimitConfig;
  webhook: WebhookConfig;
  notification: NotificationConfig;
  features: FeatureFlags;
}

export interface ApplicationConfig {
  name: string;
  version: string;
  description: string;
  url: string;
  environment: Environment;
  debug: boolean;
  cors: CorsConfig;
  api: ApiConfig;
}

export interface ApiConfig {
  prefix: string;
  version: string;
  defaultPageSize: number;
  maxPageSize: number;
  requestTimeout: number;
  enableCompression: boolean;
  enableRateLimiting: boolean;
  enableRequestLogging: boolean;
}

export interface CorsConfig {
  origins: string[];
  methods: string[];
  headers: string[];
  credentials: boolean;
  maxAge: number;
}

export type Environment = 'development' | 'staging' | 'production' | 'test';

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: string;
  startTimeout: Number;
  shutdownTimeout: Number;
  bodySizeLimit: string;
  payloadSizeLimit: string;
}

export interface DatabaseConfig {
  url: string;
  poolSize: number;
  connectionTimeout: Number;
  queryTimeout: Number;
  ssl: SslConfig;
  migrateOnStart: boolean;
  logQueries: boolean;
  slowQueryThreshold: Number;
}

export interface SslConfig {
  rejectUnauthorized: boolean;
  requireCert: boolean;
  minVersion?: string;
}

export interface ZainpayConfig {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
  sandboxMode: boolean;
  callbackBaseUrl: string;
  zainboxCodeName: string;
  timeout: Number;
  retryAttempts: Number;
  retryDelay: Number;
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
  sessionSecret: string;
  csrfProtection: boolean;
  helmetEnabled: boolean;
  corsEnabled: boolean;
  rateLimitEnabled: boolean;
  maxRequestBodySize: string;
  encryptionKey: string;
  allowedOrigins: string[];
  trustedProxies: string[];
}

export interface LoggingConfig {
  level: LogLevel;
  format: LogFormat;
  console: boolean;
  file: FileLogConfig;
  sentry: SentryConfig;
  datadog: DatadogConfig;
  enableStructuredLogging: boolean;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogFormat = 'json' | 'pretty' | 'simple';

export interface FileLogConfig {
  enabled: boolean;
  directory: string;
  filename: string;
  maxSize: string;
  maxFiles: Number;
  datePattern: string;
}

export interface SentryConfig {
  dsn: string;
  environment: Environment;
  tracesSampleRate: number;
  profilesSampleRate: number;
  enabled: boolean;
}

export interface DatadogConfig {
  apiKey: string;
  site: string;
  service: string;
  environment: Environment;
  enabled: boolean;
}

export interface CacheConfig {
  defaultTtlMs: Number;
  maxSizeBytes: Number;
  maxEntries: Number;
  cleanupIntervalMs: Number;
  compressionEnabled: boolean;
  compressionThreshold: Number;
}

export interface RateLimitConfig {
  windowMs: Number;
  maxRequests: Number;
  skipHealthCheck: Boolean;
  skipApiKey: Boolean;
  ipWhitelist: string[];
}

export interface WebhookConfig {
  secret: string;
  toleranceSeconds: Number;
  maxRetries: Number;
  retryBaseDelayMs: Number;
  signatureAlgorithm: 'hmac-sha256';
  verifyPayload: Boolean;
}

export interface NotificationConfig {
  email: EmailNotificationConfig;
  sms: SmsNotificationConfig;
  push: PushNotificationConfig;
  inApp: InAppNotificationConfig;
}

export interface EmailNotificationConfig {
  enabled: Boolean;
  fromAddress: String;
  fromName: String;
  smtpHost: String;
  smtpPort: Number;
  smtpUser: String;
  smtpPass: String;
  queueEnabled: Boolean;
  queueConcurrency: Number;
  templatesPath: String;
}

export interface SmsNotificationConfig {
  enabled: Boolean;
  provider: 'twilio' | 'termii' | 'custom';
  apiKey: String;
  senderId: String;
  queueEnabled: Boolean;
  queueConcurrency: Number;
}

export interface PushNotificationConfig {
  enabled: Boolean;
  fcmServerKey?: String;
  apnsKeyId?: String;
  apnsTeamId?: String;
  apnsKey?: String;
  apnsEnvironment: 'production' | 'sandbox';
  bundleId: String;
  topic: String;
}

export interface InAppNotificationConfig {
  enabled: Boolean;
  defaultTtl: Number;
  maxNotifications: Number;
  soundEnabled: Boolean;
  vibrationEnabled: Boolean;
}

export interface FeatureFlags {
  enableMLFraudDetection: Boolean;
  enableAdvancedAnalytics: Boolean;
  enableRealTimeDashboard: Boolean;
  enableBatchProcessing: Boolean;
  enableWebhookRetry: Boolean;
  enableMultiCurrency: Boolean;
  enableCustomerPortal: Boolean;
  enableApiDocumentation: Boolean;
  enableRateLimitDashboard: Boolean;
  enableExportToExcel: Boolean;
  enablePdfReports: Boolean;
  darkModeDefault: Boolean;
  maintenanceMode: Boolean;
  betaFeatures: Boolean;
}

// ============== Configuration Manager ==============

class ConfigurationManager {
  private config: AppConfig;
  private env: Environment;

  constructor() {
    this.env = this.detectEnvironment();
    this.config = this.loadConfiguration();
    
    logger.info('Configuration loaded', {
      event: 'config.loaded',
      metadata: { env: this.env, appName: this.config.app.name },
    });
  }

  /**
   * Detect current environment
   */
  private detectEnvironment(): Environment {
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    const appEnv = process.env.APP_ENVIRONMENT?.toLowerCase();

    if (appEnv) return appEnv as Environment;
    if (nodeEnv === 'production') return 'production';
    if (nodeEnv === 'test') return 'test';
    if (nodeEnv === 'development') return 'development';
    return 'staging';
  }

  /**
   * Load configuration from environment variables and defaults
   */
  private loadConfiguration(): AppConfig {
    return {
      app: {
        name: process.env.APP_NAME || 'SSM Pay',
        version: process.env.APP_VERSION || '1.0.0',
        description: process.env.APP_DESCRIPTION || 'Enterprise Payment Platform',
        url: process.env.BASE_URL || 'https://ssm-pay.vercel.app',
        environment: this.env,
        debug: this.env !== 'production',
        cors: {
          origins: this.parseArray(process.env.CORS_ORIGINS, '*'),
          methods: this.parseArray(process.env.CORS_METHODS, 'GET,POST,PUT,DELETE,PATCH,OPTIONS'),
          headers: this.parseArray(process.env.CORS_HEADERS, 'Content-Type,Authorization,X-Requested-With'),
          credentials: process.env.CORS_CREDENTIALS === 'true',
          maxAge: parseInt(process.env.CORS_MAX_AGE || '86400'),
        },
        api: {
          prefix: process.env.API_PREFIX || '/api',
          version: process.env.API_VERSION || 'v1',
          defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '20'),
          maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '100'),
          requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
          enableCompression: process.env.ENABLE_COMPRESSION === 'true',
          enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
          enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING === 'true',
        },
      },
      server: {
        port: parseInt(process.env.PORT || '9002'),
        host: process.env.HOST || '0.0.0.0',
        nodeEnv: process.env.NODE_ENV || this.env,
        startTimeout: parseInt(process.env.SERVER_START_TIMEOUT || '30000'),
        shutdownTimeout: parseInt(process.env.SERVER_SHUTDOWN_TIMEOUT || '10000'),
        bodySizeLimit: process.env.BODY_SIZE_LIMIT || '10mb',
        payloadSizeLimit: process.env.PAYLOAD_SIZE_LIMIT || '10mb',
      },
      database: {
        url: process.env.DATABASE_URL || 'file:./data/ssm-pay.db',
        poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
        queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
        ssl: {
          rejectUnauthorized: process.env.SSL_REJECT_UNAUTHORIZED === 'true',
          requireCert: process.env.SSL_REQUIRE_CERT === 'true',
          minVersion: process.env.SSL_MIN_VERSION,
        },
        migrateOnStart: process.env.DB_MIGRATE_ON_START === 'true',
        logQueries: process.env.DB_LOG_QUERIES === 'true',
        slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'),
      },
      zainpay: {
        publicKey: process.env.ZAINPAY_PUBLIC_KEY || '',
        secretKey: process.env.ZAINPAY_SECRET_KEY || '',
        baseUrl: process.env.ZAINPAY_BASE_URL || 'https://api.zainpay.ng',
        sandboxMode: process.env.ZAINPAY_SANDBOX_MODE === 'true',
        callbackBaseUrl: process.env.CALLBACK_BASE_URL || process.env.BASE_URL || 'http://localhost:9002',
        zainboxCodeName: process.env.ZAINBOX_CODE_NAME || '',
        timeout: parseInt(process.env.ZAINPAY_TIMEOUT || '30000'),
        retryAttempts: parseInt(process.env.ZAINPAY_RETRY_ATTEMPTS || '3'),
        retryDelay: parseInt(process.env.ZAINPAY_RETRY_DELAY || '1000'),
      },
      security: {
        jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
        sessionSecret: process.env.SESSION_SECRET || 'change-me-in-production',
        csrfProtection: process.env.CSRF_PROTECTION !== 'false',
        helmetEnabled: process.env.HELMET_ENABLED !== 'false',
        corsEnabled: true,
        rateLimitEnabled: process.env.ENABLE_RATE_LIMITING !== 'false',
        maxRequestBodySize: process.env.MAX_REQUEST_BODY_SIZE || '10mb',
        encryptionKey: process.env.ENCRYPTION_KEY || 'change-me-32-char-hex-key',
        allowedOrigins: this.parseArray(process.env.ALLOWED_ORIGINS, '*'),
        trustedProxies: this.parseArray(process.env.TRUSTED_PROXIES, ''),
      },
      logging: {
        level: (process.env.LOG_LEVEL || 'info') as LogLevel,
        format: (process.env.LOG_FORMAT || 'json') as LogFormat,
        console: process.env.LOG_TO_CONSOLE === 'true',
        file: {
          enabled: process.env.LOG_TO_FILE === 'true',
          directory: process.env.LOG_DIR || './logs',
          filename: process.env.LOG_FILENAME || 'app.log',
          maxSize: process.env.LOG_MAX_SIZE || '20mb',
          maxFiles: parseInt(process.env.LOG_MAX_FILES || '14'),
          datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
        },
        sentry: {
          dsn: process.env.SENTRY_DSN || '',
          environment: this.env,
          tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
          profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
          enabled: process.env.SENTRY_ENABLED === 'true',
        },
        datadog: {
          apiKey: process.env.DATADOG_API_KEY || '',
          site: process.env.DATADOG_SITE || 'ssm-pay',
          service: process.env.DATADOG_SERVICE || 'ssm-pay-api',
          environment: this.env,
          enabled: process.env.DATADOG_ENABLED === 'true',
        },
        enableStructuredLogging: process.env.ENABLE_STRUCTURED_LOGGING === 'true',
      },
      cache: {
        defaultTtlMs: parseInt(process.env.CACHE_DEFAULT_TTL_MS || '300000'), // 5 minutes
        maxSizeBytes: parseInt(process.env.CACHE_MAX_SIZE_BYTES || '52428800'), // 50MB
        maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '10000')
        cleanupIntervalMs: parseInt(process.env.CACHE_CLEANUP_INTERVAL_MS || '60000'),
        compressionEnabled: process.env.CACHE_COMPRESSION === 'true',
        compressionThreshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024'),
      },
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
        skipHealthCheck: process.env.RATE_LIMIT_SKIP_HEALTH_CHECK === 'true',
        skipApiKey: process.env.RATE_LIMIT_SKIP_API_KEY === 'true',
        ipWhitelist: this.parseArray(process.env.RATE_LIMIT_IP_WHITELIST, ''),
      },
      webhook: {
        secret: process.env.WEBHOOK_SECRET || 'whsec_change_me_in_production',
        toleranceSeconds: parseInt(process.env.WEBHOOK_TOLERANCE_SECONDS || '300'),
        maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '5'),
        retryBaseDelayMs: parseInt(process.env.WEBHOOK_RETRY_DELAY_MS || '1000'),
        signatureAlgorithm: 'hmac-sha256' as const,
        verifyPayload: process.env.WEBHOOK_VERIFY_PAYLOAD !== 'false',
      },
      notification: {
        email: {
          enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
          fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@ssm-pay.com',
          fromName: process.env.EMAIL_FROM_NAME || 'SSM Pay',
          smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
          smtpPort: parseInt(process.env.SMTP_PORT || '587'),
          smtpUser: process.env.SMTP_USER || '',
          smtpPass: process.env.SMTP_PASS || '',
          queueEnabled: process.env.EMAIL_QUEUE_ENABLED === 'true',
          queueConcurrency: parseInt(process.env.EMAIL_QUEUE_CONCURRENCY || '5'),
          templatesPath: process.env.EMAIL_TEMPLATES_PATH || './templates/email',
        },
        sms: {
          enabled: process.env.SMS_NOTIFICATIONS_ENABLED === 'true',
          provider: (process.env.SMS_PROVIDER || 'termii') as 'twilio' | 'termii' | 'custom',
          apiKey: process.env.SMS_API_KEY || '',
          senderId: process.env.SMS_SENDER_ID || 'SSMPay',
          queueEnabled: process.env.SMS_QUEUE_ENABLED === 'true',
          queueConcurrency: parseInt(process.env.SMS_QUEUE_CONCURRENCY || '3'),
        },
        push: {
          enabled: process.env.PUSH_NOTIFICATIONS_ENABLED === 'true',
          fcmServerKey: process.env.FCM_SERVER_KEY || '',
          apnsKeyId: process.env.APNS_KEY_ID || '',
          apnsTeamId: process.env.APNS_TEAM_ID || '',
          apnsKey: process.env.APNS_KEY || '',
          apnsEnvironment: process.env.APNS_ENVIRONMENT || 'production',
          bundleId: process.env.IOS_BUNDLE_ID || 'com.ssm.pay.app',
          topic: process.env.PUSH_TOPIC || 'all',
        },
        inApp: {
          enabled: true,
          defaultTtl: parseInt(process.env.IN_APP_NOTIF_TTL_MS || '5000'),
          maxNotifications: parseInt(process.env.IN_APP_MAX_NOTIFICATIONS || '50'),
          soundEnabled: process.env.IN_APP_SOUND_ENABLED === 'true',
          vibrationEnabled: process.env.IN_APP_VIBRATION_ENABLED === 'true',
        },
      },
      features: {
        enableMLFraudDetection: process.env.ENABLE_ML_FRAUD_DETECTION === 'true',
        enableAdvancedAnalytics: process.env.ENABLE_ADVANCED_ANALYTICS === 'true',
        enableRealTimeDashboard: process.env.ENABLE_REALTIME_DASHBOARD === 'true',
        enableBatchProcessing: process.env.ENABLE_BATCH_PROCESSING === 'true',
        enableWebhookRetry: process.env.ENABLE_WEBHOOK_RETRY === 'true',
        enableMultiCurrency: process.env.ENABLE_MULTI_CURRENCY === 'true',
        enableCustomerPortal: process.env.ENABLE_CUSTOMER_PORTAL === 'true',
        enableApiDocumentation: process.env.ENABLE_API_DOCS === 'true',
        enableRateLimitDashboard: process.env.ENABLE_RATELIMIT_DASHBOARD === 'true',
        enableExportToExcel: process.env.ENABLE_EXCEL_EXPORT === 'true',
        enablePdfReports: process.env.ENABLE_PDF_REPORTS === 'true',
        darkModeDefault: process.env.DARK_MODE_DEFAULT === 'true',
        maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
        betaFeatures: process.env.ENABLE_BETA_FEATURES === 'true',
      },
    };
  }

  /**
   * Parse comma-separated string into array
   */
  private parseArray(value: string | undefined, defaultValue: string): string[] {
    if (!value) return defaultValue.split(',').map(s => s.trim());
    return value.split(',').map(s => s.trim());
  }

  /**
   * Get the full configuration object
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Get configuration for a specific section
   */
  getSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return this.config[section];
  }

  /**
   * Get a specific configuration value by path
   */
  get<T>(path: string): T {
    return path.split('.').reduce((obj: any, key) => obj?.[key], this.config);
  }

  /**
   * Check if we're in production
   */
  isProduction(): boolean {
    return this.env === 'production';
  }

  /**
   * Check if we're in development
   */
  isDevelopment(): boolean {
    return this.env === 'development';
  }

  /**
   * Check if we're in test mode
   */
  isTest(): boolean {
    return this.env === 'test';
  }

  /**
   * Check if feature flag is enabled
   */
  isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return !!this.config.features[feature];
  }
}

// ============== Singleton Instance ==============

/** Global configuration instance */
const configManager = new ConfigurationManager();

export { config } = configManager.getConfig();

export default ConfigurationManager;
export { configManager };
