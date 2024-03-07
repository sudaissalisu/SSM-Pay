/**
 * Enterprise Notification Service
 * Multi-channel notification system with templates, preferences, and delivery tracking
 * 
 * @module services/notifications
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';

// ============== Type Definitions ==============

export interface NotificationChannel {
  id: string;
  type: 'email' | 'sms' | 'push' | 'webhook' | 'in_app';
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject?: string;
  body: string;
  variables: string[];
  channels: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface NotificationRecipient {
  id: string;
  email?: string;
  phone?: string;
  deviceId?: string;
  userId: string;
  preferences: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string; // HH:mm format
  timezone: string;
}

export interface Notification {
  id: string;
  templateId: string;
  recipient: NotificationRecipient;
  data: Record<string, unknown>;
  priority: NotificationTemplate['priority'];
  channels: string[];
  status: 'pending' | 'sending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  error?: string;
  attempts: number;
  metadata: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  notificationId: string;
  channel: string;
  messageId?: string;
  error?: string;
  retryable: boolean;
}

// ============== Template Engine ==============

/**
 * Simple template engine for notifications
 * Supports {{variable}} syntax
 */
export class TemplateEngine {
  /**
   * Render a template with provided variables
   */
  static render(template: string, variables: Record<string, unknown>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value ?? ''));
    }

    // Remove any unresolved variables
    result = result.replace(/\{\{[^}]+\}\}/g, '');

    return result;
  }

  /**
   * Validate that all required variables are present
   */
  static validate(template: string, variables: Record<string, unknown>): {
    valid: boolean;
    missing: string[];
  } {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const matches = template.match(variablePattern) || [];
    const requiredVars = matches.map(m => m.replace(/{{|}}/g, ''));

    const missing = requiredVars.filter(v => !(v in variables) || variables[v] === undefined || variables[v] === null);

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}

// ============== Email Service ==============

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromAddress: string;
  fromName: string;
  replyTo?: string;
}

/**
 * Email sending service
 */
export class EmailService {
  private config: EmailConfig;
  private queue: Array<{ notification: Notification; resolve: Function; reject: Function }> = [];

  constructor(config: EmailConfig) {
    this.config = config;
    
    logger.info('EmailService initialized', {
      event: 'notification.email.init',
      metadata: { fromAddress: config.fromAddress },
    });
  }

  /**
   * Send an email notification
   */
  async send(notification: Notification): Promise<NotificationResult> {
    try {
      // In production, this would use Nodemailer or similar
      logger.info('Sending email', {
        event: 'notification.email.send',
        metadata: {
          notificationId: notification.id,
          to: notification.recipient.email,
          subject: notification.data.subject || 'Notification',
        },
      });

      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      return {
        success: true,
        notificationId: notification.id,
        channel: 'email',
        messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      };
    } catch (error) {
      return {
        success: false,
        notificationId: notification.id,
        channel: 'email',
        error: error instanceof Error ? error.message : 'Failed to send email',
        retryable: true,
      };
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulk(notifications: Notification[]): Promise<NotificationResult[]> {
    return Promise.all(notifications.map(n => this.send(n)));
  }
}

// ============== SMS Service ==============

export interface SmsConfig {
  provider: 'twilio' | 'termii' | 'custom';
  apiKey: string;
  apiSecret?: string;
  senderId: string;
}

/**
 * SMS sending service
 */
export class SmsService {
  private config: SmsConfig;

  constructor(config: SmsConfig) {
    this.config = config;
    
    logger.info('SmsService initialized', {
      event: 'notification.sms.init',
      metadata: { provider: config.provider, senderId: config.senderId },
    });
  }

  /**
   * Send an SMS notification
   */
  async send(notification: Notification): Promise<NotificationResult> {
    if (!notification.recipient.phone) {
      return {
        success: false,
        notificationId: notification.id,
        channel: 'sms',
        error: 'No phone number provided',
        retryable: false,
      };
    }

    try {
      logger.info('Sending SMS', {
        event: 'notification.sms.send',
        metadata: {
          notificationId: notification.id,
          to: notification.recipient.phone.slice(0, 5) + '****',
        },
      });

      // Simulate SMS sending
      await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 150));

      return {
        success: true,
        notificationId: notification.id,
        channel: 'sms',
        messageId: `sms_${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        notificationId: notification.id,
        channel: 'sms',
        error: error instanceof Error ? error.message : 'Failed to send SMS',
        retryable: true,
      };
    }
  }
}

// ============== Push Notification Service ==============

export interface PushConfig {
  fcmServerKey?: string;
  apnsKey?: string;
  apnsKeyId?: string;
  teamId?: string;
  bundleId?: string;
}

/**
 * Push notification service
 */
export class PushService {
  private config: PushConfig;

  constructor(config: PushConfig) {
    this.config = config;
    
    logger.info('PushService initialized', { event: 'notification.push.init' });
  }

  /**
   * Send a push notification
   */
  async send(notification: Notification): Promise<NotificationResult> {
    if (!notification.recipient.deviceId) {
      return {
        success: false,
        notificationId: notification.id,
        channel: 'push',
        error: 'No device ID provided',
        retryable: false,
      };
    }

    try {
      logger.info('Sending push notification', {
        event: 'notification.push.send',
        metadata: {
          notificationId: notification.id,
          deviceId: notification.recipient.deviceId?.slice(0, 8),
        },
      });

      // Simulate push sending
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

      return {
        success: true,
        notificationId: notification.id,
        channel: 'push',
        messageId: `push_${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        notificationId: notification.id,
        channel: 'push',
        error: error instanceof Error ? error.message : 'Failed to send push',
        retryable: true,
      };
    }
  }
}

// ============== Main Notification Manager ==============

/**
 * Enterprise Notification Manager
 * Central hub for all notification operations
 */
export class NotificationManager {
  private channels: Map<string, NotificationChannel> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  
  private emailService: EmailService | null = null;
  private smsService: SmsService | null = null;
  private pushService: PushService | null = null;
  
  private notificationHistory: Notification[] = [];
  private maxHistorySize: number = 10000;

  constructor() {
    this.registerDefaultTemplates();
    
    logger.info('NotificationManager initialized', {
      event: 'notification.manager.init',
    });
  }

  /**
   * Configure email service
   */
  configureEmail(config: EmailConfig): void {
    this.emailService = new EmailService(config);
    this.channels.set('email', {
      id: 'email',
      type: 'email',
      name: 'Email',
      enabled: true,
      config,
    });
  }

  /**
   * Configure SMS service
   */
  configureSms(config: SmsConfig): void {
    this.smsService = new SmsService(config);
    this.channels.set('sms', {
      id: 'sms',
      type: 'sms',
      name: 'SMS',
      enabled: true,
      config,
    });
  }

  /**
   * Configure push service
   */
  configurePush(config: PushConfig): void {
    this.pushService = new PushService(config);
    this.channels.set('push', {
      id: 'push',
      type: 'push',
      name: 'Push Notifications',
      enabled: true,
      config,
    });
  }

  /**
   * Register a custom notification template
   */
  registerTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
    
    logger.debug('Template registered', {
      event: 'notification.template.registered',
      metadata: { templateId: template.id },
    });
  }

  /**
   * Send a notification
   */
  async send(options: {
    templateId: string;
    recipient: NotificationRecipient;
    data: Record<string, unknown>;
    channels?: string[];
    priority?: NotificationTemplate['priority'];
    correlationId?: string;
  }): Promise<NotificationResult[]> {
    const template = this.templates.get(options.templateId);
    if (!template) {
      throw new AppError(
        `Template not found: ${options.templateId}`,
        ErrorCode.NOT_FOUND
      );
    }

    // Check quiet hours
    if (this.isInQuietHours(options.recipient)) {
      logger.info('Notification deferred due to quiet hours', {
        event: 'notification.quiet_hours',
        metadata: { userId: options.recipient.userId },
      });
      
      // Queue for later delivery (simplified - would use job queue)
      return [{
        success: false,
        notificationId: '',
        channel: 'all',
        error: 'Deferred - quiet hours',
        retryable: true,
      }];
    }

    // Determine which channels to use
    const channels = options.channels || template.channels;
    const activeChannels = channels.filter(c => {
      const channel = this.channels.get(c);
      return channel && channel.enabled;
    });

    // Create notification record
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      templateId: options.templateId,
      recipient: options.recipient,
      data: options.data,
      priority: options.priority || template.priority,
      channels: activeChannels,
      status: 'pending',
      createdAt: new Date(),
      attempts: 0,
      metadata: {
        correlationId: options.correlationId,
      },
    };

    // Render subject and body
    const renderedSubject = template.subject 
      ? TemplateEngine.render(template.subject, options.data)
      : undefined;
    const renderedBody = TemplateEngine.render(template.body, options.data);

    notification.data = {
      ...options.data,
      subject: renderedSubject,
      body: renderedBody,
    };

    // Add to history
    this.addToHistory(notification);

    // Send via each channel
    const results: NotificationResult[] = [];

    for (const channelId of activeChannels) {
      const result = await this.sendViaChannel(channelId, notification);
      results.push(result);
    }

    // Update notification status
    const allSuccess = results.every(r => r.success);
    notification.status = allSuccess ? 'sent' : 'failed';
    notification.sentAt = new Date();

    return results;
  }

  /**
   * Send notification via specific channel
   */
  private async sendViaChannel(
    channelId: string,
    notification: Notification
  ): Promise<NotificationResult> {
    notification.attempts++;
    notification.status = 'sending';

    switch (channelId) {
      case 'email':
        if (!this.emailService) {
          throw new AppError('Email service not configured', ErrorCode.MISSING_CONFIG);
        }
        return this.emailService.send(notification);

      case 'sms':
        if (!this.smsService) {
          throw new AppError('SMS service not configured', ErrorCode.MISSING_CONFIG);
        }
        return this.smsService.send(notification);

      case 'push':
        if (!this.pushService) {
          throw new AppError('Push service not configured', ErrorCode.MISSING_CONFIG);
        }
        return this.pushService.send(notification);

      default:
        return {
          success: false,
          notificationId: notification.id,
          channel: channelId,
          error: `Unknown channel: ${channelId}`,
          retryable: false,
        };
    }
  }

  /**
   * Check if recipient is in quiet hours
   */
  private isInQuietHours(recipient: NotificationRecipient): boolean {
    const prefs = recipient.preferences;
    
    if (!prefs.quietHoursStart || !prefs.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: prefs.timezone,
    });

    return currentTime >= prefs.quietHoursStart && currentTime <= prefs.quietHoursEnd;
  }

  /**
   * Add notification to history
   */
  private addToHistory(notification: Notification): void {
    this.notificationHistory.push(notification);
    
    // Trim history if needed
    while (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory.shift();
    }
  }

  /**
   * Get notification history for a user
   */
  getUserNotifications(
    userId: string,
    options: { limit?: number; offset?: number; status?: Notification['status'] } = {}
  ): Notification[] {
    let filtered = this.notificationHistory.filter(
      n => n.recipient.userId === userId
    );

    if (options.status) {
      filtered = filtered.filter(n => n.status === options.status);
    }

    const offset = options.offset || 0;
    const limit = options.limit || 20;

    return filtered.slice(offset, offset + limit);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSent: number;
    totalFailed: number;
    byChannel: Record<string, { sent: number; failed: number }>;
    byPriority: Record<string, number>;
  } {
    const stats = {
      totalSent: 0,
      totalFailed: 0,
      byChannel: {} as Record<string, { sent: number; failed: number }>,
      byPriority: {} as Record<string, number>,
    };

    for (const notification of this.notificationHistory) {
      if (notification.status === 'sent' || notification.status === 'delivered') {
        stats.totalSent++;
      } else if (notification.status === 'failed') {
        stats.totalFailed++;
      }

      for (const channel of notification.channels) {
        if (!stats.byChannel[channel]) {
          stats.byChannel[channel] = { sent: 0, failed: 0 };
        }
        
        if (notification.status === 'sent') {
          stats.byChannel[channel].sent++;
        } else if (notification.status === 'failed') {
          stats.byChannel[channel].failed++;
        }
      }

      const priority = notification.priority;
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
    }

    return stats;
  }

  /**
   * Register default notification templates
   */
  private registerDefaultTemplates(): void {
    const defaults: NotificationTemplate[] = [
      {
        id: 'payment.success',
        name: 'Payment Success',
        subject: 'Payment Successful - {{amount}} {{currency}}',
        body: `Dear {{name}},

Your payment of {{amount}} {{currency}} was successful!

Transaction Reference: {{txnRef}}
Date: {{date}}

Thank you for using SSM Pay.

Best regards,
SSM Pay Team`,
        variables: ['amount', 'currency', 'name', 'txnRef', 'date'],
        channels: ['email', 'in_app'],
        priority: 'normal',
      },
      {
        id: 'payment.failed',
        name: 'Payment Failed',
        subject: 'Payment Failed - Please Try Again',
        body: `Dear {{name}},

We were unable to process your payment of {{amount}} {{currency}}.

Reason: {{reason}}

Please try again or contact support if the problem persists.

Reference: {{txnRef}}

SSM Pay Team`,
        variables: ['amount', 'currency', 'name', 'reason', 'txnRef'],
        channels: ['email', 'in_app'],
        priority: 'high',
      },
      {
        id: 'payment.refund',
        name: 'Payment Refund',
        subject: 'Refund Processed - {{amount}} {{currency}}',
        body: `Dear {{name}},

Your refund of {{amount}} {{currency}} has been processed.

Refund Reference: {{refundRef}}
Original Transaction: {{txnRef}}

The amount should reflect in your account within 3-5 business days.

SSM Pay Team`,
        variables: ['amount', 'currency', 'name', 'refundRef', 'txnRef'],
        channels: ['email', 'in_app'],
        priority: 'normal',
      },
      {
        id: 'account.verification',
        name: 'Account Verification',
        subject: 'Verify Your SSM Pay Account',
        body: `Hi {{name}},

Please verify your account by clicking the link below:

{{verificationUrl}}

This link will expire in 24 hours.

If you didn't create an account with us, please ignore this email.

SSM Pay Team`,
        variables: ['name', 'verificationUrl'],
        channels: ['email'],
        priority: 'high',
      },
      {
        id: 'fraud.alert',
        name: 'Fraud Alert',
        subject: 'Security Alert - Suspicious Activity Detected',
        body: `Dear {{name}},

We detected suspicious activity on your account:

{{activityDetails}}

If this wasn't you, please secure your account immediately.

Activity Time: {{activityTime}}
IP Address: {{ipAddress}}

SSM Pay Security Team`,
        variables: ['name', 'activityDetails', 'activityTime', 'ipAddress'],
        channels: ['email', 'sms', 'push'],
        priority: 'critical',
      },
    ];

    for (const template of defaults) {
      this.templates.set(template.id, template);
    }
  }
}

// ============== Singleton Instance ==============

/** Default notification manager instance */
export const notificationManager = new NotificationManager();

export default NotificationManager;
