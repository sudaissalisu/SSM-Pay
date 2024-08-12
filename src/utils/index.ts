/**
 * Enterprise Utility Library
 * Collection of reusable utility functions for the SSM Pay platform
 * 
 * @module utils/index
 */

import { logger } from '@/lib/logger';

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

// ============== Date & Time Utilities ==============

export namespace DateUtils {
  /**
   * Format date to relative time (e.g., "2 hours ago")
   */
  export function timeAgo(date: Date | string): string {
    const now = new Date();
    const past = typeof date === 'string' ? new Date(date) : date;
    const diffMs = now.getTime() - past.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSecs < 60) return `${diffSecs} seconds ago`;
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
    
    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
  }

  /**
   * Format date to locale string
   */
  export function formatDate(
    date: Date | string,
    options?: Intl.DateTimeFormatOptions,
    locale: string = 'en-US'
  ): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    });
  }

  /**
   * Format date and time
   */
  export function formatDateTime(date: Date | string, locale: string = 'en-US'): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Check if date is today
   */
  export function isToday(date: Date | string): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  }

  /**
   * Check if date is in the past
   */
  export function isPast(date: Date | string): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.getTime() < Date.now();
  }

  /**
   * Check if date is in the future
   */
  export function isFuture(date: Date | string): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.getTime() > Date.now();
  }

  /**
   * Add days to date
   */
  export function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Add hours to date
   */
  export function addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  /**
   * Get difference in days between two dates
   */
  export function diffInDays(date1: Date | string, date2: Date | string): number {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
    const diffTime = Math.abs(d1.getTime() - d2.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get start of day
   */
  export function startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get end of day
   */
  export function endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Get start of month
   */
  export function startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  /**
   * Get end of month
   */
  export function endOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  /**
   * Check if year is a leap year
   */
  export function isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  /**
   * Get days in month
   */
  export function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  /**
   * Get quarter of year (1-4)
   */
  export function getQuarter(date: Date): number {
    return Math.ceil((date.getMonth() + 1) / 3);
  }
}

// ============== Array Utilities ==============

export namespace ArrayUtils {
  /**
   * Chunk array into smaller arrays of specified size
   */
  export function chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Shuffle array (Fisher-Yates)
   */
  export function shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Get unique values from array
   */
  export function unique<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  /**
   * Group array by key function
   */
  export function groupBy<T, K extends string | number>(
    array: T[],
    keyFn: (item: T) => K
  ): Record<K, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      (groups[key] = groups[key] || []).push(item);
      return groups;
    }, {} as Record<K, T[]>);
  }

  /**
   * Sort array by key function
   */
  export function sortBy<T>(array: T[], keyFn: (item: T) => number | string, order: 'asc' | 'desc' = 'asc'): T[] {
    return [...array].sort((a, b) => {
      const valA = keyFn(a);
      const valB = keyFn(b);
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        return order === 'asc' 
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      
      const numA = Number(valA);
      const numB = Number(valB);
      
      return order === 'asc' ? numA - numB : numB - numA;
    });
  }

  /**
   * Flatten nested array
   */
  export function flatten<T>(array: (T | T[])[]): T[] {
    return array.reduce<T[]>((flat, item) => {
      return flat.concat(Array.isArray(item) ? item : [item]);
    }, []);
  }

  /**
   * Find intersection of two arrays
   */
  export function intersection<T>(arr1: T[], arr2: T[]): T[] {
    const set2 = new Set(arr2);
    return arr1.filter(item => set2.has(item));
  }

  /**
   * Find difference of two arrays (items in arr1 not in arr2)
   */
  export function difference<T>(arr1: T[], arr2: T[]): T[] {
    const set2 = new Set(arr2);
    return arr1.filter(item => !set2.has(item));
  }

  /**
   * Partition array based on predicate
   */
  export function partition<T>(
    array: T[],
    predicate: (item: T) => boolean
  ): [T[], T[]] {
    return [
      array.filter(predicate),
      array.filter(item => !predicate(item)),
    ];
  }

  /**
   * Pick random elements from array
   */
  export function sample<T>(array: T[], count: number = 1): T[] {
    const shuffled = shuffle(array);
    return shuffled.slice(0, Math.min(count, array.length));
  }

  /**
   * Check if array includes all items
   */
  export function includesAll<T>(array: T[], items: T[]): boolean {
    return items.every(item => array.includes(item));
  }

  /**
   * Create range array
   */
  export function range(start: number, end?: number, step: number = 1): number[] {
    const result: number[] = [];
    
    if (end === undefined) {
      end = start;
      start = 0;
    }
    
    for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
      result.push(i);
    }
    
    return result;
  }

  /**
   * Remove duplicates while preserving order
   */
  export function distinct<T>(array: T[]): T[] {
    const seen = new Set<T>();
    return array.filter(item => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  }

  /**
   * Sum all numeric values in array
   */
  export function sum(array: number[]): number {
    return array.reduce((acc, val) => acc + val, 0);
  }

  /**
   * Average of numeric values
   */
  export function average(array: number[]): number {
    if (array.length === 0) return 0;
    return sum(array) / array.length;
  }

  /**
   * Min value in array
   */
  export function min(array: number[]): number {
    return Math.min(...array);
  }

  /**
   * Max value in array
   */
  export function max(array: number[]): number {
    return Math.max(...array);
  }

  /**
   * Find index of element matching predicate
   */
  export function findIndex<T>(array: T[], predicate: (item: T) => boolean): number {
    return array.findIndex(predicate);
  }

  /**
   * Remove element at index
   */
  export function removeAt<T>(array: T[], index: number): T[] {
    return [...array.slice(0, index), ...array.slice(index + 1)];
  }

  /**
   * Insert element at index
   */
  export function insertAt<T>(array: T[], index: number, item: T): T[] {
    return [...array.slice(0, index), item, ...array.slice(index)];
  }

  /**
   * Update element at index
   */
  export function updateAt<T>(array: T[], index: number, updater: (item: T) => T): T[] {
    return array.map((item, i) => i === index ? updater(item) : item);
  }

  /**
   * Rotate array left by n positions
   */
  export function rotateLeft<T>(array: T[], n: number): T[] {
    const offset = n % array.length;
    return [...array.slice(offset), ...array.slice(0, offset)];
  }

  /**
   * Rotate array right by n positions
   */
  export function rotateRight<T>(array: T[], n: number): T[] {
    const offset = n % array.length;
    return rotateLeft(array, array.length - offset);
  }

  /**
   * Zip multiple arrays together
   */
  export function zip<T, U>(arr1: T[], arr2: U[]): [T, U][] {
    const length = Math.min(arr1.length, arr2.length);
    return Array.from({ length }, (_, i) => [arr1[i], arr2[i]]);
  }

  /**
   * Unzip paired array into two arrays
   */
  export function unzip<T, U>(pairs: [T, U][]): [T[], U[]] {
    return pairs.reduce(
      ([arr1, arr2], [t, u]) => [[...arr1, t], [...arr2, u]],
      [[] as T[], [] as U[]]
    );
  }

  /**
   * Deep clone an object/array
   */
  export function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Compare two arrays for equality
   */
  export function isEqual<T>(arr1: T[], arr2: T[]): boolean {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, idx) => val === arr2[idx]);
  }

  /**
   * Check if array is empty or null/undefined
   */
  export function isEmpty<T>(array: T[] | null | undefined): boolean {
    return !array || array.length === 0;
  }

  /**
   * Get first element that matches predicate
   */
  export function find<T>(array: T[], predicate: (item: T) => boolean): T | undefined {
    return array.find(predicate);
  }

  /**
   * Get last element
   */
  export function last<T>(array: T[]): T | undefined {
    return array[array.length - 1];
  }

  /**
   * Get first element
   */
  export function first<T>(array: T[]): T | undefined {
    return array[0];
  }

  /**
   * Take first n elements
   */
  export function take<T>(array: T[], n: number): T[] {
    return array.slice(0, n);
  }

  /**
   * Drop first n elements
   */
  export function drop<T>(array: T[], n: number): T[] {
    return array.slice(n);
  }

  /**
   * Take last n elements
   */
  export function takeRight<T>(array: T[], n: number): T[] {
    return array.slice(-n || array.length);
  }

  /**
   * Drop last n elements
   */
  export function dropRight<T>(array: T[], n: number): T[] {
    return array.slice(0, -n || undefined);
  }

  /**
   * Compact - remove falsy values from array
   */
  export function compact<T>(array: (T | null | undefined | false | 0 | '')[]): T[] {
    return array.filter(Boolean) as T[];
  }

  /**
   * Fill array with value
   */
  export function fill<T>(length: number, value: T): T[] {
    return Array(length).fill(value);
  }

  /**
   * Repeat value n times into array
   */
  export function repeat<T>(value: T, times: number): T[] {
    return Array(times).fill(value);
  }

  /**
   * Split array at index
   */
  export function splitAt<T>(array: T[], index: number): [T[], T[]] {
    return [array.slice(0, index), array.slice(index)];
  }

  /**
   * Batches - split array into batches of size
   */
  export function batches<T>(array: T[], size: number): T[][] {
    return chunk(array, size);
  }

  /**
   * Paginate array
   */
  export function paginate<T>(
    array: T[],
    page: number,
    pageSize: number
  ): { data: T[]; pagination: PaginationInfo } {
    const totalItems = array.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const offset = (page - 1) * pageSize;

    return {
      data: array.slice(offset, offset + pageSize),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============== Object Utilities ==============

export namespace ObjectUtils {
  /**
   * Deep merge objects
   */
  export function deepMerge<T extends Record<string, unknown>>(
    target: T,
    source: Partial<T>
  ): T {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      const sourceVal = source[key as keyof T];
      const targetVal = target[key as keyof T];

      if (
        sourceVal &&
        typeof sourceVal === 'object' &&
        !Array.isArray(sourceVal) &&
        targetVal &&
        typeof targetVal === 'object' &&
        !Array.isArray(targetVal)
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          targetVal as Record<string, unknown>,
          sourceVal as Record<string, unknown>
        );
      } else {
        (result as Record<string, unknown>)[key] = sourceVal;
      }
    }

    return result;
  }

  /**
   * Pick specific keys from object
   */
  export function pick<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
      if (key in obj) {
        result[key] = obj[key];
      }
    }
    return result;
  }

  /**
   * Omit specific keys from object
   */
  export function omit<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Omit<T, K> {
    const result = { ...obj };
    for (const key of keys) {
      delete result[key];
    }
    return result as Omit<T, K>;
  }

  /**
   * Check if object is empty
   */
  export function isEmpty(obj: Record<string, unknown>): boolean {
    return Object.keys(obj).length === 0;
  }

  /**
   * Get all nested values from object
   */
  export function getValues(obj: Record<string, unknown>): unknown[] {
    const values: unknown[] = [];

    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        values.push(...getValues(value as Record<string, unknown>));
      } else {
        values.push(value);
      }
    }

    return values;
  }

  /**
   * Freeze object deeply
   */
  export function deepFreeze<T>(obj: T): Readonly<T> {
    Object.freeze(obj);

    Object.getOwnPropertyNames(obj).forEach(prop => {
      const value = obj[prop as keyof T];
      if (
        value &&
        typeof value === 'object' &&
        !Object.isFrozen(value)
      ) {
        deepFreeze(value);
      }
    });

    return obj;
  }

  /**
   * Transform object keys using mapping function
   */
  export function mapKeys<T extends Record<string, unknown>, K extends string>(
    obj: T,
    mapper: (key: string) => K
  ): Record<K, T[keyof T]> {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [mapper(key), value])
    ) as Record<K, T[keyof T]>;
  }

  /**
   * Transform object values using mapping function
   */
  export function mapValues<T extends Record<string, unknown>, V>(
    obj: T,
    mapper: (value: T[keyof T], key: string) => V
  ): Record<string, V> {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, mapper(value as T[keyof T], key)])
    );
  }

  /**
   * Rename object key
   */
  export function renameKey<T extends Record<string, unknown>>(
    obj: T,
    oldKey: string,
    newKey: string
  ): Record<string, unknown> {
    const { [removed], ...rest } = obj as any;
    return { ...rest, [newKey]: removed };
  }

  /**
   * Invert object (swap keys and values)
   */
  export function invert<T extends Record<string, string | number>>(
    obj: T
  ): Record<string | number, string> {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [value, key])
    ) as Record<string | number, string>;
  }

  /**
   * Clone object without reference
   */
  export function clone<T extends Record<string, unknown>>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Check if property exists on object
   */
  export function has<T extends Record<string, unknown>>(
    obj: T,
    path: string
  ): boolean {
    return path.split('.').reduce((current, key) => {
      return current?.[key as keyof T] !== undefined;
    }, obj as any);
  }

  /**
   * Get nested property from object safely
   */
  export function get<T extends Record<string, unknown>, V = unknown>(
    obj: T,
    path: string,
    defaultValue?: V
  ): V | undefined {
    try {
      const value = path.split('.').reduce((current: any, key) => {
        return current?.[key];
      }, obj as any);

      return value ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Set nested property on object
   */
  export function set<T extends Record<string, unknown>>(
    obj: T,
    path: string,
    value: unknown
  ): T {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    const target = keys.reduce((current: any, key) => {
      if (current[key] === undefined) {
        current[key] = {};
      }
      return current[key];
    }, obj as any);

    target[lastKey] = value;
    return obj;
  }

  /**
   * Unset nested property from object
   */
  export function unset<T extends Record<string, unknown>>(obj: T, path: string): T {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    const target = keys.reduce((current: any, key) => {
      return current?.[key];
    }, obj as any);

    if (target) {
      delete target[lastKey];
    }

    return obj;
  }

  /**
   * Flatten nested object to single level
   */
  export function flatten(obj: Record<string, unknown>, separator = '.'): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    const recurse = (current: any, prefix: string) => {
      for (const [key, value] of Object.entries(current)) {
        const newKey = prefix ? `${prefix}${separator}${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          recurse(value, newKey);
        } else {
          result[newKey] = value;
        }
      }
    };

    recurse(obj, '');
    return result;
  }

  /**
   * Unflatten object with separator to nested structure
   */
  export function unflatten(obj: Record<string, unknown>, separator = '.'): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const keys = key.split(separator);
      let current = result;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]] as Record<string, unknown>;
      }

      current[keys[keys.length - 1]] = value;
    }

    return result;
  }

  /**
   * Filter object by predicate on values
   */
  export function filter<T extends Record<string, unknown>>(
    obj: T,
    predicate: (value: T[keyof T], key: string) => boolean
  ): Partial<T> {
    const result: Partial<T> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (predicate(value as T[keyof T], key)) {
        result[key as keyof T] = value;
      }
    }
    
    return result;
  }

  /**
   * Some - check if some value passes predicate
   */
  export function some<T extends Record<string, unknown>>(
    obj: T,
    predicate: (value: T[keyof T]) => boolean
  ): boolean {
    return Object.values(obj).some(v => predicate(v as T[keyof T]));
  }

  /**
   * Every - check if all values pass predicate
   */
  export function every<T extends Record<string, unknown>>(
    obj: T,
    predicate: (value: T[keyof T]) => boolean
  ): boolean {
    return Object.values(obj).every(v => predicate(v as T[keyof T]));
  }

  /**
   * Reduce object to single value
   */
  export function reduce<T extends Record<string, unknown>, V>(
    obj: T,
    reducer: (accumulator: V, value: T[keyof T], key: string) => V,
    initialValue: V
  ): V {
    return Object.entries(obj).reduce(
      (acc, [key, value]) => reducer(acc, value as T[keyof T], key),
      initialValue
    );
  }

  /**
   * Tap into object without modifying it (for debugging)
   */
  export function tap<T extends Record<string, unknown>>(
    obj: T,
    interceptor: (obj: T) => void
  ): T {
    interceptor(obj);
    return obj;
  }

  /**
   * Default value for missing properties
   */
  export function defaults<T extends Record<string, unknown>>(
    obj: T,
    defaults: Partial<T>
  ): T {
    const result = { ...defaults };
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        (result as any)[key] = value;
      }
    }
    
    return result as T;
  }
}

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

// ============== Export All Utilities ==============

export {
  StringUtils,
  NumberUtils,
  DateUtils,
  ArrayUtils,
  ObjectUtils,
  ValidationUtils,
  IdUtils,
};

export default {
  StringUtils,
  NumberUtils,
  DateUtils,
  ArrayUtils,
  ObjectUtils,
  ValidationUtils,
  IdUtils,
};
