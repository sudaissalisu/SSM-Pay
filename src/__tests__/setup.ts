/**
 * Vitest Setup File
 * 
 * Global test configuration and mocks
 */

import { vi } from 'vitest';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = ':memory:';
process.env.NEXTAUTH_SECRET = 'test-secret-for-testing-purposes-only';

// Mock Next.js specific globals
Object.defineProperty(globalThis, 'fetch', {
  value: vi.fn(),
  writable: true,
});

// Mock console methods to reduce noise in tests (optional)
// Uncomment if needed:
// global.console = {
//   ...console,
//   log: vi.fn(),
//   debug: vi.fn(),
//   info: vi.fn(),
//   warn: vi.fn(),
// };

// Extend expect matchers
expect.extend({
  /**
   * Custom matcher for checking if object has required properties
   */
  toHaveProperties(received: Record<string, unknown>, requiredProps: string[]) {
    const missingProps = requiredProps.filter(prop => !(prop in received));
    
    return {
      pass: missingProps.length === 0,
      message: () =>
        `expected object to have properties ${missingProps.join(', ')}`,
    };
  },
});

// Global test utilities
declare module 'vitest' {
  export interface Assertion<T> {
    toHaveProperties(requiredProps: string[]): T;
  }
}
