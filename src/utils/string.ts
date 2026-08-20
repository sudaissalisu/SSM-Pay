/**
 * String Utilities
 * Collection of string manipulation functions for the SSM Pay platform
 * 
 * @module utils/string
 */

// ============== String Utilities ==============

export namespace StringUtils {
  /**
   * Convert string to title case
   */
  export function toTitleCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/(?:^|\s|[-_])\w/g, (match) => match.toUpperCase())
      .replace(/[-_]/g, ' ');
  }

  /**
   * Generate a random string of specified length
   */
  export function random(length: number = 16, charset?: string): string {
    const defaultCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const chars = charset || defaultCharset;
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Truncate string with ellipsis
   */
  export function truncate(str: string, maxLength: number, suffix = '...'): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Mask sensitive information (e.g., email, phone)
   */
  export function mask(str: string, visibleChars: number = 4, maskChar = '*'): string {
    if (str.length <= visibleChars) return str;
    
    const start = str.slice(0, Math.ceil(visibleChars / 2));
    const end = str.slice(-Math.floor(visibleChars / 2));
    const maskLength = str.length - visibleChars;
    
    return `${start}${maskChar.repeat(maskLength)}${end}`;
  }

  /**
   * Check if string is valid email
   */
  export function isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Check if string is valid phone number (international format)
   */
  export function isValidPhone(phone: string): boolean {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    // International numbers are typically 10-15 digits
    return digits.length >= 10 && digits.length <= 15 && /^\d+$/.test(digits);
  }

  /**
   * Escape HTML special characters
   */
  export function escapeHtml(str: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
    };
    
    return str.replace(/[&<>"'/]/g, (char) => htmlEntities[char]);
  }

  /**
   * Generate slug from string
   */
  export function slugify(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Reverse a string
   */
  export function reverse(str: string): string {
    return str.split('').reverse().join('');
  }

  /**
   * Count occurrences of substring in string
   */
  export function countOccurrences(str: string, subStr: string): number {
    return str.split(subStr).length - 1;
  }

  /**
   * Pluralize a word based on count
   */
  export function pluralize(count: number, singular: string, plural?: string): string {
    return count === 1 ? singular : (plural || `${singular}s`);
  }
}

// ============== ID Generation Utilities ==============

export namespace IdUtils {
  /**
   * Generate UUID v4
   */
  export function uuid(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate short ID (16 chars)
   */
  export function shortId(): string {
    return `id_${Date.now().toString(36)}_${StringUtils.random(8)}`;
  }

  /**
   * Generate transaction reference
   */
  export function txnRef(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = StringUtils.random(6).toUpperCase();
    return `SSM_${timestamp}_${random}`;
  }

  /**
   * Generate order number
   */
  export function orderNo(): string {
    const date = new Date();
    const datePart = date.getFullYear().toString().slice(-2) +
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0');
    const random = StringUtils.random(6);
    return `ORD-${datePart}-${random}`;
  }

  /**
   * Generate invoice number
   */
  export function invoiceNo(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const seq = StringUtils.random(5, '0123456789');
    return `INV-${year}-${month}-${seq}`;
  }

  /**
   * Generate session token
   */
  export function sessionToken(): string {
    const header = Buffer.from(StringUtils.random(16)).toString('base64url');
    const payload = Buffer.from(`${Date.now()}-${StringUtils.random(32)}`).toString('base64url');
    const signature = StringUtils.random(32);
    return `${header}.${payload}.${signature}`;
  }

  /**
   * Generate API key
   */
  export function apiKey(prefix: string = 'sk'): string {
    const timestamp = Date.now().toString(36);
    const random = StringUtils.random(48, 'abcdefghijklmnopqrstuvwxyz0123456789');
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Generate webhook secret
   */
  export function webhookSecret(): string {
    return `whsec_${StringUtils.random(64)}`;
  }

  /**
   * Generate verification code
   */
  export function verificationCode(length: number = 6): string {
    return StringUtils.random(length, '0123456789');
  }

  /**
   * Generate OTP (One-Time Password)
   */
  export function otp(): string {
    return verificationCode(6);
  }

  /**
   * Generate reference code (alphanumeric)
   */
  export function refCode(length: number = 8): string {
    return StringUtils.random(length, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
  }
}
