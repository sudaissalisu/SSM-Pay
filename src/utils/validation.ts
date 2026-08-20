/**
 * Validation Utilities
 * Collection of validation functions for data verification
 * 
 * @module utils/validation
 */

import { StringUtils } from './string';
import { NumberUtils } from './number';

// ============== Validation Utilities ==============

export namespace ValidationUtils {
  /**
   * Validate required fields
   */
  export function required(
    data: Record<string, unknown>,
    fields: string[]
  ): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    for (const field of fields) {
      if (!data[field] || data[field] === '') {
        errors[field] = `${field} is required`;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Validate email field
   */
  export function email(
    data: Record<string, unknown>,
    field: string
  ): { valid: boolean; error?: string } {
    const value = data[field];

    if (!value || value === '') {
      return { valid: false, error: `${field} is required` };
    }

    if (!StringUtils.isValidEmail(String(value))) {
      return { valid: false, error: `Invalid email address` };
    }

    return { valid: true };
  }

  /**
   * Validate phone field
   */
  export function phone(
    data: Record<string, unknown>,
    field: string
  ): { valid: boolean; error?: string } {
    const value = data[field];

    if (!value || value === '') {
      return { valid: false, error: `${field} is required` };
    }

    if (!StringUtils.isValidPhone(String(value))) {
      return { valid: false, error: `Invalid phone number` };
    }

    return { valid: true };
  }

  /**
   * Validate minimum length
   */
  export function minLength(
    data: Record<string, unknown>,
    field: string,
    min: number
  ): { valid: boolean; error?: string } {
    const value = String(data[field] || '');

    if (value.length < min) {
      return {
        valid: false,
        error: `${field} must be at least ${min} characters`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate maximum length
   */
  export function maxLength(
    data: Record<string, unknown>,
    field: string,
    max: number
  ): { valid: boolean; error?: string } {
    const value = String(data[field] || '');

    if (value.length > max) {
      return {
        valid: false,
        error: `${field} must be no more than ${max} characters`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate numeric range
   */
  export function range(
    data: Record<string, unknown>,
    field: string,
    min: number,
    max: number
  ): { valid: boolean; error?: string } {
    const value = NumberUtils.parseSafe(data[field]);

    if (isNaN(value)) {
      return { valid: false, error: `${field} must be a number` };
    }

    if (value < min || value > max) {
      return {
        valid: false,
        error: `${field} must be between ${min} and ${max}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate pattern (regex)
   */
  export function pattern(
    data: Record<string, unknown>,
    field: string,
    regex: RegExp,
    message?: string
  ): { valid: boolean; error?: string } {
    const value = String(data[field] || '');

    if (!regex.test(value)) {
      return {
        valid: false,
        error: message || `${field} format is invalid`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate enum value
   */
  export function enumValue<T>(
    data: Record<string, unknown>,
    field: string,
    allowedValues: T[]
  ): { valid: boolean; error?: string } {
    const value = data[field];

    if (!allowedValues.includes(value as T)) {
      return {
        valid: false,
        error: `${field} must be one of: ${allowedValues.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate URL
   */
  export function url(
    data: Record<string, unknown>,
    field: string
  ): { valid: boolean; error?: string } {
    const value = String(data[field] || '');

    try {
      new URL(value);
      return { valid: true };
    } catch {
      return { valid: false, error: `Invalid URL format` };
    }
  }

  /**
   * Validate date
   */
  export function date(
    data: Record<string, unknown>,
    field: string
  ): { valid: boolean; error?: string } {
    const value = data[field];

    if (!value) {
      return { valid: false, error: `${field} is required` };
    }

    const date = new Date(value as string | number);
    if (isNaN(date.getTime())) {
      return { valid: false, error: `Invalid date format` };
    }

    return { valid: true };
  }

  /**
   * Run multiple validations
   */
  export async function validateAll(
    data: Record<string, unknown>,
    validations: Array<{ valid: boolean; error?: string }>
  ): Promise<{ valid: boolean; errors: Record<string, string> }> {
    const errors: Record<string, string> = {};

    for (const validation of validations) {
      if (!validation.valid && validation.error) {
        // Extract field name from error message
        const fieldMatch = validation.error.match(/^(\w+)/);
        if (fieldMatch) {
          errors[fieldMatch[1]] = validation.error;
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
