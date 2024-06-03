import '@testing-library/jest-dom/vitest';

// Mock environment variables for testing
const originalEnv = process.env;

// Set up test environment variables
Object.assign(process.env, {
  ZAINPAY_PUBLIC_KEY: 'test_public_key',
  ZAINBOX_CODE_NAME: 'test_zainbox_code',
  NEXT_PUBLIC_ZAINPAY_PUBLIC_KEY: 'test_next_public_key',
  NEXT_PUBLIC_ZAINBOX_CODE_NAME: 'test_next_zainbox_code',
  BASE_URL: 'http://localhost:9002',
  NODE_ENV: 'test',
  LOG_LEVEL: 'debug',
});
