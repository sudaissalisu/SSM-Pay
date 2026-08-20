/**
 * Object Utilities
 * Collection of object manipulation functions
 * 
 * @module utils/object
 */

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
    const { [oldKey]: removed, ...rest } = obj as any;
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
