import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, Logger } from './logger';
import type { AppError } from './errors';

describe('Logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  // Store original env values
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Spy on all console methods that logger might use
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
    
    // Reset environment variables for each test
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_FORMAT;
  });

  afterEach(() => {
    // Restore all spies
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
    
    // Restore original env
    process.env = originalEnv;
    
    // Clear request ID
    logger.clearRequestId();
  });

  // Helper to get all string calls from console spies
  function getAllStringCalls(): string[] {
    return [
      ...consoleSpy.log.mock.calls.map((c: unknown[]) => String(c[0])),
      ...consoleSpy.info.mock.calls.map((c: unknown[]) => String(c[0])),
      ...consoleSpy.warn.mock.calls.map((c: unknown[]) => String(c[0])),
      ...consoleSpy.error.mock.calls.map((c: unknown[]) => String(c[0])),
      ...consoleSpy.debug.mock.calls.map((c: unknown[]) => String(c[0])),
    ];
  }

  function getAllCalls(): unknown[][] {
    return [
      ...consoleSpy.log.mock.calls,
      ...consoleSpy.info.mock.calls,
      ...consoleSpy.warn.mock.calls,
      ...consoleSpy.error.mock.calls,
      ...consoleSpy.debug.mock.calls,
    ];
  }

  function resetAllSpies() {
    Object.values(consoleSpy).forEach(spy => spy.mockClear());
  }

  // ==========================================
  // Basic Logging Tests (Backward Compatibility)
  // ==========================================

  describe('Basic Logging Methods', () => {
    it('should log info messages', () => {
      logger.info('Test info message');
      
      const allCalls = getAllStringCalls();
      expect(allCalls.length).toBeGreaterThan(0);
      
      // Check that INFO level is present (either in formatted or JSON log)
      const hasInfoLevel = allCalls.some((call: string) => 
        call.includes('[INFO]') || call.includes('"level":"info"')
      );
      expect(hasInfoLevel).toBe(true);
    });

    it('should log warning messages', () => {
      logger.warn('Test warning message');
      
      const allCalls = getAllStringCalls();
      expect(allCalls.length).toBeGreaterThan(0);
      
      const hasWarnLevel = allCalls.some((call: string) => 
        call.includes('[WARN]') || call.includes('"level":"warn"')
      );
      expect(hasWarnLevel).toBe(true);
    });

    it('should log error messages', () => {
      logger.error('Test error message');
      
      const allCalls = getAllStringCalls();
      expect(allCalls.length).toBeGreaterThan(0);
      
      const hasErrorLevel = allCalls.some((call: string) => 
        call.includes('[ERROR]') || call.includes('"level":"error"')
      );
      expect(hasErrorLevel).toBe(true);
    });

    it('should log debug messages when level allows', () => {
      process.env.LOG_LEVEL = 'debug';
      const debugLogger = new Logger('test');
      
      debugLogger.debug('Test debug message');
      
      const allCalls = getAllStringCalls();
      expect(allCalls.length).toBeGreaterThan(0);
      
      const hasDebugLevel = allCalls.some((call: string) => 
        call.includes('[DEBUG]') || call.includes('"level":"debug"')
      );
      expect(hasDebugLevel).toBe(true);
    });
  });

  // ==========================================
  // JSON Log Format Tests
  // ==========================================

  describe('JSON Log Format', () => {
    it('should output JSON format when LOG_FORMAT=json', () => {
      process.env.LOG_FORMAT = 'json';
      const jsonLogger = new Logger('test-module');
      
      jsonLogger.info('JSON test message');
      
      const allCalls = getAllStringCalls();
      expect(allCalls.length).toBeGreaterThan(0);
      
      // Should be valid JSON
      const jsonCall = allCalls[0];
      expect(jsonCall).toMatch(/^\{/); // Starts with {
      expect(jsonCall).toMatch(/\}$/); // Ends with }
      
      // Should be parseable as JSON
      const parsed = JSON.parse(jsonCall);
      expect(parsed).toHaveProperty('level', 'info');
      expect(parsed).toHaveProperty('message', 'JSON test message');
      expect(parsed).toHaveProperty('timestamp');
    });

    it('should include timestamp in JSON output', () => {
      process.env.LOG_FORMAT = 'json';
      const jsonLogger = new Logger('test');
      
      jsonLogger.info('Timestamp test');
      
      const allCalls = getAllStringCalls();
      const parsed = JSON.parse(allCalls[0]);
      
      // Timestamp should be ISO format
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include level field in JSON output', () => {
      process.env.LOG_FORMAT = 'json';
      const jsonLogger = new Logger('test');
      
      jsonLogger.error('Level test');
      
      const parsed = JSON.parse(getAllStringCalls()[0]);
      expect(parsed.level).toBe('error');
    });

    it('should include message field in JSON output', () => {
      process.env.LOG_FORMAT = 'json';
      const jsonLogger = new Logger('test');
      
      jsonLogger.info('Message content here');
      
      const parsed = JSON.parse(getAllStringCalls()[0]);
      expect(parsed.message).toBe('Message content here');
    });
  });

  // ==========================================
  // Module Name Tests
  // ==========================================

  describe('Module Name Support', () => {
    it('should include module name in logs', () => {
      process.env.LOG_FORMAT = 'json';
      const moduleLogger = new Logger('payment-service');
      
      moduleLogger.info('Module test');
      
      const parsed = JSON.parse(getAllStringCalls()[0]);
      expect(parsed.module).toBe('payment-service');
    });

    it('should include default module name for main logger', () => {
      process.env.LOG_FORMAT = 'json';
      // Create fresh logger to pick up JSON format
      const jsonLogger = new Logger('ssm-pay');
      
      jsonLogger.info('Default module test');
      
      const parsed = JSON.parse(getAllStringCalls()[0]);
      expect(parsed.module).toBe('ssm-pay');
    });

    it('should allow child logger with custom module', () => {
      process.env.LOG_FORMAT = 'json';
      const parentLogger = new Logger('parent');
      
      const childLogger = parentLogger.child('auth-module');
      childLogger.info('Child logger test');
      
      const parsed = JSON.parse(getAllStringCalls()[0]);
      expect(parsed.module).toBe('auth-module');
    });

    it('should show module in text format logs', () => {
      process.env.LOG_FORMAT = 'text';
      process.env.NODE_ENV = 'development';
      const moduleLogger = new Logger('api-handler');
      
      moduleLogger.info('Text format with module');
      
      const allCalls = getAllStringCalls();
      const hasModule = allCalls.some((call: string) => call.includes('[api-handler]'));
      expect(hasModule).toBe(true);
    });
  });

  // ==========================================
  // Log Level Filtering Tests
  // ==========================================

  describe('Log Level Filtering', () => {
    it('should filter out debug messages when LOG_LEVEL=info', () => {
      process.env.LOG_LEVEL = 'info';
      const filteredLogger = new Logger('test');
      
      filteredLogger.debug('Should not appear');
      filteredLogger.info('Should appear');
      
      const allCalls = getAllStringCalls();
      
      // Only info should be logged
      expect(allCalls.length).toBe(1);
      expect(allCalls[0]).toContain('Should appear');
    });

    it('should filter out debug and info when LOG_LEVEL=warn', () => {
      process.env.LOG_LEVEL = 'warn';
      const filteredLogger = new Logger('test');
      
      filteredLogger.debug('Debug - hidden');
      filteredLogger.info('Info - hidden');
      filteredLogger.warn('Warn - visible');
      filteredLogger.error('Error - visible');
      
      const allCalls = getAllStringCalls();
      
      // Only warn and error should be logged
      expect(allCalls.length).toBe(2);
    });

    it('should only show errors when LOG_LEVEL=error', () => {
      process.env.LOG_LEVEL = 'error';
      const filteredLogger = new Logger('test');
      
      filteredLogger.debug('Debug');
      filteredLogger.info('Info');
      filteredLogger.warn('Warn');
      filteredLogger.error('Error only');
      
      const allCalls = getAllStringCalls();
      
      expect(allCalls.length).toBe(1);
      expect(allCalls[0]).toContain('Error only');
    });

    it('should show all messages when LOG_LEVEL=debug', () => {
      process.env.LOG_LEVEL = 'debug';
      const filteredLogger = new Logger('test');
      
      filteredLogger.debug('Debug msg');
      filteredLogger.info('Info msg');
      filteredLogger.warn('Warn msg');
      filteredLogger.error('Error msg');
      
      const allCalls = getAllStringCalls();
      
      expect(allCalls.length).toBe(4);
    });

    it('should handle invalid LOG_LEVEL gracefully (default to info)', () => {
      process.env.LOG_LEVEL = 'invalid_level';
      const filteredLogger = new Logger('test');
      
      filteredLogger.debug('Debug - should be hidden');
      filteredLogger.info('Info - should be visible');
      
      const allCalls = getAllStringCalls();
      
      // Default is info, so debug should be filtered
      expect(allCalls.length).toBe(1);
    });
  });

  // ==========================================
  // Request ID Tracking Tests
  // ==========================================

  describe('Request ID Tracking', () => {
    it('should set and track request ID', () => {
      process.env.LOG_FORMAT = 'json';
      const jsonLogger = new Logger('test');
      
      const requestId = jsonLogger.setRequestId('test-req-123');
      expect(requestId).toBe('test-req-123');
      
      jsonLogger.info('Request tracked message');
      
      const parsed = JSON.parse(getAllStringCalls()[0]);
      expect(parsed.requestId).toBe('test-req-123');
    });

    it('should generate request ID if not provided', () => {
      process.env.LOG_FORMAT = 'json';
      const jsonLogger = new Logger('test');
      
      const requestId = jsonLogger.setRequestId();
      expect(requestId).toBeDefined();
      expect(requestId).toMatch(/^req_/);
      
      jsonLogger.info('Auto-generated request ID');
      
      const parsed = JSON.parse(getAllStringCalls()[0]);
      expect(parsed.requestId).toBe(requestId);
    });

    it('should clear request ID', () => {
      process.env.LOG_FORMAT = 'json';
      const jsonLogger = new Logger('test');
      
      jsonLogger.setRequestId('req-to-clear');
      jsonLogger.clearRequestId();
      
      jsonLogger.info('After clear');
      
      const parsed = JSON.parse(getAllStringCalls()[0]);
      expect(parsed.requestId).toBeUndefined();
    });

    it('should return current request ID', () => {
      expect(logger.getRequestId()).toBeUndefined();
      
      logger.setRequestId('my-request-id');
      expect(logger.getRequestId()).toBe('my-request-id');
    });

    it('should propagate request ID to child loggers', () => {
      process.env.LOG_FORMAT = 'json';
      
      logger.setRequestId('parent-request');
      const childLogger = logger.child('child-module');
      
      childLogger.info('Child with parent request ID');
      
      const parsed = JSON.parse(getAllStringCalls()[0]);
      expect(parsed.requestId).toBe('parent-request');
    });
  });

  // ==========================================
  // Event and Metadata Tests
  // ==========================================

  describe('Event and Metadata', () => {
    it('should include event name in logs', () => {
      logger.info('Test message', { event: 'test.event' });
      
      const allCalls = getAllStringCalls();
      
      // Event should be present in either formatted [event] or JSON "event":"..."
      const hasEvent = allCalls.some((call: string) => 
        call.includes('[test.event]') || call.includes('"event":"test.event"')
      );
      expect(hasEvent).toBe(true);
    });

    it('should include metadata when provided', () => {
      process.env.LOG_FORMAT = 'json';
      const jsonLogger = new Logger('test');
      
      jsonLogger.info('Test message', { 
        event: 'test.event',
        metadata: { key: 'value', count: 42 },
      });
      
      const parsed = JSON.parse(getAllStringCalls()[0]);
      expect(parsed.metadata).toEqual({ key: 'value', count: 42 });
    });

    it('should log payment events correctly', () => {
      logger.payment('initiated', { amount: 1000, currency: 'NGN' });
      
      const allCalls = getAllStringCalls();
      
      // Payment event should be logged
      const hasPaymentEvent = allCalls.some((call: string) => 
        call.includes('[payment.initiated]') || 
        call.includes('"event":"payment.initiated"')
      );
      expect(hasPaymentEvent).toBe(true);
    });

    it('should log API events correctly', () => {
      logger.api('/api/test', { method: 'POST' });
      
      const allCalls = getAllStringCalls();
      
      // API event should be logged
      const hasApiEvent = allCalls.some((call: string) => 
        call.includes('[api.request]') || 
        call.includes('"event":"api.request"')
      );
      expect(hasApiEvent).toBe(true);
    });

    it('should log app errors with context', () => {
      const appError = new Error('Test error') as unknown as AppError;
      logger.appError(appError, { action: 'testAction' });
      
      // Error should have been logged
      const totalCalls = getAllCalls().length;
      expect(totalCalls).toBeGreaterThan(0);
    });

    it('should serialize error details in JSON mode', () => {
      process.env.LOG_FORMAT = 'json';
      const jsonLogger = new Logger('test');
      
      const testError = new Error('Detailed error');
      testError.name = 'CustomError';
      
      jsonLogger.error('Error occurred', { error: testError });
      
      const parsed = JSON.parse(getAllStringCalls()[0]);
      expect(parsed.error).toBeDefined();
      expect(parsed.error?.name).toBe('CustomError');
      expect(parsed.error?.message).toBe('Detailed error');
      expect(parsed.error?.stack).toBeDefined();
    });
  });

  // ==========================================
  // Domain-Specific Logging Tests
  // ==========================================

  describe('Domain-Specific Logging', () => {
    it('should log auth events', () => {
      process.env.LOG_FORMAT = 'json';
      const jsonLogger = new Logger('test');
      
      jsonLogger.auth('login', 'user-123', { ip: '127.0.0.1' });
      
      const parsed = JSON.parse(getAllStringCalls()[0]);
      expect(parsed.event).toBe('auth.login');
      expect(parsed.metadata?.userId).toBe('user-123');
      expect(parsed.metadata?.domain).toBe('auth');
    });

    it('should log database operations', () => {
      process.env.LOG_FORMAT = 'json';
      process.env.LOG_LEVEL = 'debug';
      const jsonLogger = new Logger('test');
      
      jsonLogger.database('select', 'users', { rows: 10 });
      
      const parsed = JSON.parse(getAllStringCalls()[0]);
      expect(parsed.event).toBe('database.operation');
      expect(parsed.metadata?.operation).toBe('select');
      expect(parsed.metadata?.table).toBe('users');
      expect(parsed.metadata?.domain).toBe('database');
    });
  });

  // ==========================================
  // Backward Compatibility Tests
  // ==========================================

  describe('Backward Compatibility', () => {
    it('should maintain existing API surface', () => {
      // All these methods should exist and work
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.payment).toBe('function');
      expect(typeof logger.api).toBe('function');
      expect(typeof logger.appError).toBe('function');
      expect(typeof logger.child).toBe('function');
      expect(typeof logger.setRequestId).toBe('function');
      expect(typeof logger.getRequestId).toBe('function');
      expect(typeof logger.clearRequestId).toBe('function');
    });

    it('should work without any configuration', () => {
      // Default logger should work out of the box
      expect(() => {
        logger.info('Default config works');
      }).not.toThrow();
      
      expect(getAllStringCalls().length).toBeGreaterThan(0);
    });

    it('should accept optional parameters as before', () => {
      // Old API: logger.info(message, options?)
      expect(() => {
        logger.info('Just a message');
        logger.info('With event', { event: 'my.event' });
        logger.info('With metadata', { metadata: { foo: 'bar' } });
        logger.info('Both', { event: 'both.event', metadata: { key: 'val' } });
      }).not.toThrow();
    });
  });
});
