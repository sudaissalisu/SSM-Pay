/**
 * Number Utilities
 * Collection of number formatting and manipulation functions
 * 
 * @module utils/number
 */

// ============== Number Utilities ==============

export namespace NumberUtils {
  /**
   * Format number as currency
   */
  export function formatCurrency(
    amount: number,
    currency: string = 'NGN',
    locale: string = 'en-NG'
  ): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Format number with commas (thousands separator)
   */
  export function formatNumber(num: number, decimals: number = 2): string {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  /**
   * Round number to specified decimal places
   */
  export function round(num: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round((num + Number.EPSILON) * factor) / factor;
  }

  /**
   * Clamp number between min and max
   */
  export function clamp(num: number, min: number, max: number): number {
    return Math.min(Math.max(num, min), max);
  }

  /**
   * Check if number is within range (inclusive)
   */
  export function isInRange(num: number, min: number, max: number): boolean {
    return num >= min && num <= max;
  }

  /**
   * Generate random integer between min and max (inclusive)
   */
  export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Calculate percentage
   */
  export function percentage(value: number, total: number): number {
    if (total === 0) return 0;
    return (value / total) * 100;
  }

  /**
   * Calculate percentage change between two values
   */
  export function percentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
  }

  /**
   * Convert bytes to human-readable format
   */
  export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  /**
   * Parse string to number safely
   */
  export function parseSafe(value: unknown, fallback: number = 0): number {
    const parsed = Number(value);
    return isNaN(parsed) ? fallback : parsed;
  }

  /**
   * Linear interpolation between two values
   */
  export function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * clamp(t, 0, 1);
  }

  /**
   * Map value from one range to another
   */
  export function mapRange(
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number
  ): number {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  }
}
