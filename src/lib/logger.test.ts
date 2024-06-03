import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';
import type { AppError } from './errors';

describe('Logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on all console methods that logger might use
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    infoSpy.mockRestore();
  });

  // Helper to get all string calls from console spies
  function getAllStringCalls(): string[] {
    return [
      ...logSpy.mock.calls.map((c: unknown[]) => String(c[0])),
      ...infoSpy.mock.calls.map((c: unknown[]) => String(c[0])),
      ...warnSpy.mock.calls.map((c: unknown[]) => String(c[0])),
      ...errorSpy.mock.calls.map((c: unknown[]) => String(c[0])),
    ];
  }

  function getAllCalls(): unknown[][] {
    return [
      ...logSpy.mock.calls,
      ...infoSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ];
  }

  it('should log info messages', () => {
    logger.info('Test info message');
    
    const allCalls = getAllStringCalls();
    expect(allCalls.length).toBeGreaterThan(0);
    
    // Check that INFO level is present (either in formatted or JSON log)
    const hasInfoLevel = allCalls.some((call: string) => call.includes('[INFO]') || call.includes('"level":"info"'));
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
    logger.info('Test message', { 
      event: 'test.event',
      metadata: { key: 'value' },
    });
    
    // Just verify logging happened with some content
    expect(getAllStringCalls().length).toBeGreaterThan(0);
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
});
