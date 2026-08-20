/**
 * Array Utilities
 * Collection of array manipulation functions
 * 
 * @module utils/array
 */

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

export type { PaginationInfo };
