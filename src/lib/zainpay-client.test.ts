import { describe, it, expect, beforeEach } from 'vitest';
import { MockZainpayApiClient, RealZainpayApiClient, createZainpayClient, type CreateZainboxPayload } from './zainpay-client';

describe('MockZainpayApiClient', () => {
  let mockClient: MockZainpayApiClient;

  beforeEach(() => {
    mockClient = new MockZainpayApiClient();
  });

  describe('createZainbox', () => {
    it('should successfully create a zainbox', async () => {
      const payload: CreateZainboxPayload = {
        name: 'Test Zainbox',
        callbackUrl: 'https://example.com/callback',
      };

      const result = await mockClient.createZainbox(payload);

      expect(result.code).toBe('00');
      expect(result.data.name).toBe('Test Zainbox');
      expect(result.data.callbackUrl).toBe(payload.callbackUrl);
      expect(result.data.codeName).toContain('MOCK_');
    });

    it('should handle failure mode', async () => {
      const failClient = new MockZainpayApiClient({ shouldFail: true });
      
      const result = await failClient.createZainbox({
        name: 'Test',
        callbackUrl: 'https://example.com/callback',
      });

      expect(result.code).not.toBe('00');
      expect(result.description).toContain('Mock failure');
    });
  });

  describe('listZainboxes', () => {
    it('should return list of zainboxes', async () => {
      const result = await mockClient.listZainboxes();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('codeName');
    });

    it('should return custom zainboxes when provided', async () => {
      const customClient = new MockZainpayApiClient({
        zainboxes: [
          {
            name: 'Custom Zainbox',
            codeName: 'CUSTOM_1',
            callbackUrl: 'https://example.com/callback',
            emailNotification: null,
            description: null,
            tags: null,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            autoInternalTransfer: false,
          },
        ],
      });

      const result = await customClient.listZainboxes();

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Custom Zainbox');
    });

    it('should return empty array on failure', async () => {
      const failClient = new MockZainpayApiClient({ shouldFail: true });
      
      const result = await failClient.listZainboxes();

      expect(result).toEqual([]);
    });
  });

  describe('verifyTransaction', () => {
    it('should verify a transaction successfully', async () => {
      const txnRef = 'txn_test_123';
      const result = await mockClient.verifyTransaction(txnRef);

      expect(result.status).toBe('success');
      expect(result.data).not.toBeNull();
      expect(result.data?.transactionRef).toBe(txnRef);
      expect(result.data?.status).toBe('Successful');
    });

    it('should return error for missing transaction reference', async () => {
      const result = await mockClient.verifyTransaction('');

      expect(result.status).toBe('error');
      expect(result.data).toBeNull();
      expect(result.message).toContain('missing');
    });

    it('should handle failure mode', async () => {
      const failClient = new MockZainpayApiClient({ shouldFail: true });
      
      const result = await failClient.verifyTransaction('txn_123');

      expect(result.status).toBe('error');
      expect(result.data).toBeNull();
    });
  });

  describe('getExchangeRate', () => {
    it('should return exchange rates', async () => {
      const result = await mockClient.getExchangeRate();

      expect(result).toHaveProperty('buy');
      expect(result).toHaveProperty('sell');
      expect(typeof result.buy).toBe('number');
      expect(typeof result.sell).toBe('number');
      expect(result.buy).toBeGreaterThan(0);
      expect(result.sell).toBeGreaterThan(0);
    });

    it('should return custom exchange rates when provided', async () => {
      const customClient = new MockZainpayApiClient({
        exchangeRate: { buy: 1500, sell: 1550 },
      });

      const result = await customClient.getExchangeRate();

      expect(result.buy).toBe(1500);
      expect(result.sell).toBe(1550);
    });

    it('should return zero values on failure', async () => {
      const failClient = new MockZainpayApiClient({ shouldFail: true });
      
      const result = await failClient.getExchangeRate();

      expect(result.buy).toBe(0);
      expect(result.sell).toBe(0);
    });
  });
});

describe('createZainpayClient factory', () => {
  it('should create real client by default', () => {
    const client = createZainpayClient('real');
    
    expect(client).toBeInstanceOf(RealZainpayApiClient);
  });

  it('should create mock client when specified', () => {
    const client = createZainpayClient('mock');
    
    expect(client).toBeInstanceOf(MockZainpayApiClient);
  });
  
  it('should create real client when no type is specified', () => {
    const client = createZainpayClient();
    
    expect(client).toBeInstanceOf(RealZainpayApiClient);
  });
});
