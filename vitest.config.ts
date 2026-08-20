import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      '.next',
      'dist',
      '**/*.config.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'json', 'html'],
      reportsDirectory: './coverage',
      
      // Coverage thresholds - DataFactor wants these enforced
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
      
      // Include all source files in coverage calculation
      include: [
        'src/**/*.ts',
        'src/**/*.tsx',
      ],
      
      // Exclude files that don't need coverage
      exclude: [
        'node_modules/**',
        '.next/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.{ts,tsx}',
        '**/index.ts',  // Barrel exports
        'src/components/ui/**',  // Shadcn UI components
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '__tests__/**',
      ],
    },
    
    // Test timeout (ms)
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Isolate tests properly
    isolate: true,
    
    // Allow running specific files
    passWithNoTests: false,
    
    // Verbose output for CI
    reportVerbose: process.env.CI === 'true',
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
