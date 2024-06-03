import { describe, it, expect, vi } from 'vitest';

// Mock the zainpay-client module - must be done before importing actions
vi.mock('@/lib/zainpay-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/zainpay-client')>();
  
  return {
    ...actual,
    zainpayClient: {
      createZainbox: vi.fn().mockResolvedValue({
        code: '00',
        description: 'Success',
        data: {
          name: 'Mock Zainbox',
          codeName: 'MOCK_1234567890',
          callbackUrl: 'https://example.com/callback',
          emailNotification: null,
          description: null,
          tags: null,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          autoInternalTransfer: false,
        },
      }),
      listZainboxes: vi.fn().mockResolvedValue([
        {
          name: 'Mock Zainbox',
          codeName: 'MOCK_ZAINBOX_1',
          callbackUrl: 'https://example.com/callback',
          emailNotification: null,
          description: null,
          tags: null,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          autoInternalTransfer: false,
        },
      ]),
      verifyTransaction: vi.fn().mockImplementation(async (txnRef: string) => {
        if (!txnRef) {
          return { status: 'error' as const, data: null, message: 'Transaction reference is missing.' };
        }
        return {
          status: 'success' as const,
          data: {
            status: 'Successful',
            amount: '5000.00',
            paymentMethod: 'Card',
            transactionRef: txnRef,
            createdAt: new Date().toISOString(),
            source: 'NGN',
          },
        };
      }),
      getExchangeRate: vi.fn().mockResolvedValue({ buy: 1450, sell: 1500 }),
    },
  };
});

// Import after mocking
const { createZainbox, listZainboxes, verifyTransaction, getExchangeRate } = await import('./actions');

describe('Server Actions', () => {
  describe('createZainbox', () => {
    const prevState = { message: '' };

    it('should validate required fields', async () => {
      const formData = new FormData();
      formData.append('name', 'ab'); // Too short
      formData.append('callbackUrl', 'not-a-url'); // Invalid URL

      const result = await createZainbox(prevState, formData);

      expect(result).toHaveProperty('errors');
      expect(result.errors?.name).toBeDefined();
      expect(result.errors?.callbackUrl).toBeDefined();
    });

    it('should create a zainbox with valid data', async () => {
      const formData = new FormData();
      formData.append('name', 'Test Zainbox');
      formData.append('callbackUrl', 'https://example.com/callback');

      const result = await createZainbox(prevState, formData);

      expect(result.message).toContain('created successfully');
      expect(result.data).toBeDefined();
      expect(result.data?.codeName).toContain('MOCK_');
    });

    it('should handle optional fields correctly', async () => {
      const formData = new FormData();
      formData.append('name', 'Test Zainbox');
      formData.append('callbackUrl', 'https://example.com/callback');
      formData.append('emailNotification', 'test@example.com');
      formData.append('description', 'A test zainbox');
      formData.append('tags', 'test, payment');
      formData.append('codeNamePrefix', 'TST');
      formData.append('allowAutoInternalTransfer', 'true');

      const result = await createZainbox(prevState, formData);

      expect(result.data).toBeDefined();
    });
  });

  describe('listZainboxes', () => {
    it('should return an array of zainboxes', async () => {
      const result = await listZainboxes();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('codeName');
    });
  });

  describe('verifyTransaction', () => {
    it('should return error for missing transaction reference', async () => {
      const result = await verifyTransaction('');

      expect(result.status).toBe('error');
      expect(result.message).toContain('missing');
    });

    it('should verify a valid transaction reference', async () => {
      const result = await verifyTransaction('txn_test_123');

      expect(result).toHaveProperty('status');
      if (result.status === 'success') {
        expect(result).toHaveProperty('data');
        // Type guard for data existence
        if ('data' in result && result.data !== null && result.data !== undefined) {
          expect(result.data.transactionRef).toBe('txn_test_123');
        }
      }
    });
  });

  describe('getExchangeRate', () => {
    it('should return exchange rate data', async () => {
      const result = await getExchangeRate();

      expect(result).toHaveProperty('buy');
      expect(result).toHaveProperty('sell');
      expect(typeof result.buy).toBe('number');
      expect(typeof result.sell).toBe('number');
    });

    it('should return positive values', async () => {
      const result = await getExchangeRate();

      expect(result.buy).toBeGreaterThan(0);
      expect(result.sell).toBeGreaterThan(0);
    });
  });
});
