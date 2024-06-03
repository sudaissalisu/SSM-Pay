import { describe, it, expect } from 'vitest';
import {
  AppError,
  ConfigError,
  PaymentError,
  ApiError,
  ValidationError,
  ErrorCode,
  wrapError,
} from './errors';

describe('AppError', () => {
  it('should create an error with default values', () => {
    const error = new AppError('Test error');
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(error.severity).toBe('error');
    expect(error.name).toBe('AppError');
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  it('should create an error with custom code and severity', () => {
    const error = new AppError('Payment failed', ErrorCode.PAYMENT_INIT_FAILED, {
      severity: 'critical',
      context: { transactionId: '123' },
    });
    
    expect(error.code).toBe(ErrorCode.PAYMENT_INIT_FAILED);
    expect(error.severity).toBe('critical');
    expect(error.context).toEqual({ transactionId: '123' });
  });

  it('should serialize to JSON correctly', () => {
    const cause = new Error('Original error');
    const error = new AppError('Test', ErrorCode.API_REQUEST_FAILED, { cause });
    
    const json = error.toJSON();
    
    expect(json).toHaveProperty('name');
    expect(json).toHaveProperty('message');
    expect(json).toHaveProperty('code');
    expect(json).toHaveProperty('severity');
    expect(json).toHaveProperty('timestamp');
    expect(json.causeMessage).toBe('Original error');
  });

  it('should provide user-friendly messages', () => {
    const configError = new AppError('Config missing', ErrorCode.MISSING_CONFIG);
    expect(configError.getUserMessage()).toContain('configuration is missing');

    const paymentError = new AppError('Payment failed', ErrorCode.PAYMENT_INIT_FAILED);
    expect(paymentError.getUserMessage()).toContain('Unable to start payment');
  });

  it('should return generic message for unknown errors', () => {
    const error = new AppError('Something went wrong');
    expect(error.getUserMessage()).toContain('unexpected error');
  });
});

describe('ConfigError', () => {
  it('should create a config error with missing key', () => {
    const error = new ConfigError('API key is missing', 'API_KEY');
    
    expect(error.code).toBe(ErrorCode.MISSING_CONFIG);
    expect(error.name).toBe('ConfigError');
    expect(error.context?.missingKey).toBe('API_KEY');
  });
});

describe('PaymentError', () => {
  it('should create a payment error with transaction reference', () => {
    const error = new PaymentError('Payment failed', ErrorCode.PAYMENT_VERIFICATION_FAILED, {
      transactionRef: 'txn_123',
    });
    
    expect(error.code).toBe(ErrorCode.PAYMENT_VERIFICATION_FAILED);
    expect(error.name).toBe('PaymentError');
    expect(error.transactionRef).toBe('txn_123');
  });
});

describe('ApiError', () => {
  it('should create an API error with status code and endpoint', () => {
    const error = new ApiError('Request failed', {
      statusCode: 500,
      endpoint: '/api/test',
    });
    
    expect(error.code).toBe(ErrorCode.API_REQUEST_FAILED);
    expect(error.statusCode).toBe(500);
    expect(error.endpoint).toBe('/api/test');
  });

  it('should use response error code for 4xx status', () => {
    const error = new ApiError('Not found', {
      statusCode: 404,
      endpoint: '/api/resource',
    });
    
    expect(error.code).toBe(ErrorCode.API_RESPONSE_ERROR);
  });
});

describe('ValidationError', () => {
  it('should create a validation error with fields', () => {
    const error = new ValidationError('Invalid input', ['email', 'amount']);
    
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.fields).toEqual(['email', 'amount']);
    expect(error.severity).toBe('warning');
  });
});

describe('wrapError', () => {
  it('should return AppError as-is if already an AppError', () => {
    const original = new AppError('Original', ErrorCode.PAYMENT_INIT_FAILED);
    const wrapped = wrapError(original);
    
    expect(wrapped).toBe(original);
  });

  it('should wrap Error into AppError', () => {
    const original = new Error('Network failure');
    const wrapped = wrapError(original, 'Custom message');
    
    expect(wrapped).toBeInstanceOf(AppError);
    expect(wrapped.message).toBe('Network failure');
    expect(wrapped.cause).toBe(original);
  });

  it('should wrap string into AppError', () => {
    const wrapped = wrapError('String error');
    
    expect(wrapped).toBeInstanceOf(AppError);
    expect(wrapped.message).toBe('String error');
  });

  it('should wrap unknown types into AppError with default message', () => {
    const wrapped = wrapError(null, 'Default message');
    
    expect(wrapped).toBeInstanceOf(AppError);
    expect(wrapped.message).toBe('Default message');
  });
});
