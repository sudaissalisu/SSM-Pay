/**
 * Zainpay API Client Module
 * Centralizes all Zainpay API calls for better testability and maintainability
 * Supports dependency injection for mocking in tests
 */

import { type Zainbox, type ZainboxCreationResponse, type ExchangeRateResponse } from './definitions';
import { ApiError, AppError, ErrorCode } from './errors';
import { logger } from './logger';

// Types for dependency injection
export interface ZainpayApiClient {
  createZainbox(payload: CreateZainboxPayload): Promise<ZainboxCreationResponse>;
  listZainboxes(): Promise<Zainbox[]>;
  verifyTransaction(txnRef: string): Promise<VerifyTransactionResult>;
  getExchangeRate(): Promise<ExchangeRateResult>;
}

export interface CreateZainboxPayload {
  name: string;
  callbackUrl: string;
  emailNotification?: string;
  description?: string;
  tags?: string;
  codeNamePrefix?: string;
  allowAutoInternalTransfer?: boolean;
}

export interface VerifyTransactionResult {
  status: 'success' | 'error';
  data: {
    status: string;
    amount: string;
    paymentMethod: string;
    transactionRef: string;
    createdAt: string;
    source: string;
  } | null;
  message?: string;
}

export interface ExchangeRateResult {
  buy: number;
  sell: number;
}

// Default API base URL
const DEFAULT_API_BASE_URL = 'https://api.zainpay.ng';

/**
 * Get API base URL from environment or use default
 */
function getApiBaseUrl(): string {
  return process.env.ZAINPAY_API_BASE_URL || DEFAULT_API_BASE_URL;
}

/**
 * Get authorization header value
 */
function getAuthHeader(): string {
  const publicKey = process.env.ZAINPAY_PUBLIC_KEY;
  if (!publicKey) {
    throw new AppError(
      'ZAINPAY_PUBLIC_KEY environment variable is not set',
      ErrorCode.MISSING_CONFIG,
      { severity: 'critical' }
    );
  }
  return `Bearer ${publicKey}`;
}

/**
 * Make an authenticated API request to Zainpay
 */
async function zainpayFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getApiBaseUrl()}${endpoint}`;
  
  logger.api(url, {
    method: options.method || 'GET',
  });

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new ApiError(
        `API request failed with status ${response.status}`,
        { statusCode: response.status, endpoint: url }
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to connect to Zainpay API',
      { endpoint: url, cause: error instanceof Error ? error : undefined }
    );
  }
}

/**
 * Real Zainpay API Client implementation
 * This client makes actual HTTP requests to the Zainpay API
 */
export class RealZainpayApiClient implements ZainpayApiClient {
  
  async createZainbox(payload: CreateZainboxPayload): Promise<ZainboxCreationResponse> {
    logger.info('Creating Zainbox', { event: 'zainbox.create' });
    
    try {
      const result = await zainpayFetch<ZainboxCreationResponse>(
        '/zainbox/create/request',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      if (result.code !== '00') {
        throw new AppError(
          result.description || 'Failed to create Zainbox',
          ErrorCode.ZAINBOX_CREATE_FAILED,
          { context: { apiCode: result.code } }
        );
      }

      logger.info('Zainbox created successfully', {
        event: 'zainbox.created',
        metadata: { codeName: result.data?.codeName },
      });

      return result;
    } catch (error) {
      logger.appError(error instanceof Error ? error : new Error(String(error)), { action: 'createZainbox' });
      throw error;
    }
  }

  async listZainboxes(): Promise<Zainbox[]> {
    logger.info('Listing Zainboxes', { event: 'zainbox.list' });
    
    try {
      const result = await zainpayFetch<{ code: string; description?: string; data: Zainbox[] }>(
        '/zainbox/list',
        { method: 'GET' }
      );

      if (result.code !== '00') {
        throw new AppError(
          result.description || 'Failed to fetch Zainboxes',
          ErrorCode.ZAINBOX_LIST_FAILED,
          { context: { apiCode: result.code } }
        );
      }

      return result.data;
    } catch (error) {
      logger.appError(error instanceof Error ? error : new Error(String(error)), { action: 'listZainboxes' });
      return [];
    }
  }

  async verifyTransaction(txnRef: string): Promise<VerifyTransactionResult> {
    if (!txnRef) {
      return {
        status: 'error',
        data: null,
        message: 'Transaction reference is missing.',
      };
    }

    logger.info('Verifying transaction', {
      event: 'transaction.verify',
      metadata: { txnRef },
    });

    try {
      // Primary verification
      const verifyResult = await zainpayFetch<{
        code: string;
        data?: {
          amount?: { amount?: number };
          sender?: string;
          txnRef?: string;
          paymentDate?: string;
        };
      }>(`/virtual-account/wallet/deposit/verify/${txnRef}`);

      if (verifyResult.code === '00' && verifyResult.data) {
        const apiData = verifyResult.data;
        logger.info('Transaction verified successfully', {
          event: 'transaction.verified',
          metadata: { txnRef, status: 'success' },
        });
        
        return {
          status: 'success',
          data: {
            status: 'Successful',
            amount: String(apiData.amount?.amount || 0),
            paymentMethod: apiData.sender || '',
            transactionRef: apiData.txnRef || txnRef,
            createdAt: apiData.paymentDate || '',
            source: 'NGN',
          },
        };
      }

      // Try reconciliation
      const reconcileResult = await zainpayFetch<{
        code: string;
        data?: { txnStatus?: string };
      }>(`/virtual-account/wallet/transaction/reconcile/card-payment?txnRef=${txnRef}`);

      if (reconcileResult.code === '00' && reconcileResult.data?.txnStatus === 'success') {
        // Re-verify after reconciliation
        const finalVerifyResult = await zainpayFetch<{
          code: string;
          data?: {
            amount?: { amount?: number };
            sender?: string;
            txnRef?: string;
            paymentDate?: string;
          };
        }>(`/virtual-account/wallet/deposit/verify/${txnRef}`);

        if (finalVerifyResult.code === '00' && finalVerifyResult.data) {
          const apiData = finalVerifyResult.data;
          return {
            status: 'success',
            data: {
              status: 'Successful',
              amount: String(apiData.amount?.amount || 0),
              paymentMethod: apiData.sender || '',
              transactionRef: apiData.txnRef || txnRef,
              createdAt: apiData.paymentDate || '',
              source: 'NGN',
            },
          };
        }
      }

      // Return incomplete status
      return { status: 'success', data: null };

    } catch (error) {
      logger.appError(error instanceof Error ? error : new Error(String(error)), {
        action: 'verifyTransaction',
        txnRef,
      });
      
      return {
        status: 'error',
        data: null,
        message: 'An unexpected error occurred during verification.',
      };
    }
  }

  async getExchangeRate(): Promise<ExchangeRateResult> {
    logger.info('Fetching exchange rates', { event: 'exchangeRate.fetch' });
    
    try {
      const result = await zainpayFetch<ExchangeRateResponse>(
        '/transfer/partners',
        { method: 'GET' }
      );

      if (result.code !== '00' || !result.data) {
        throw new AppError(
          result.description || 'Could not retrieve exchange rates',
          ErrorCode.EXCHANGE_RATE_FETCH_FAILED
        );
      }

      const usdPartner = result.data.find((p) => p.currencyCode === 'USD');
      if (!usdPartner) {
        throw new AppError(
          'USD exchange rate not found',
          ErrorCode.EXCHANGE_RATE_NOT_FOUND
        );
      }

      logger.info('Exchange rates fetched successfully', {
        event: 'exchangeRate.fetched',
        metadata: { buy: usdPartner.buy, sell: usdPartner.sell },
      });

      return {
        buy: usdPartner.buy,
        sell: usdPartner.sell,
      };

    } catch (error) {
      logger.appError(error instanceof Error ? error : new Error(String(error)), {
        action: 'getExchangeRate',
      });
      
      // Return default fallback values
      return { buy: 1400, sell: 1450 };
    }
  }
}

/**
 * Mock Zainpay API Client for testing
 * Returns predictable mock responses without making network calls
 */
export class MockZainpayApiClient implements ZainpayApiClient {
  private mockData: {
    zainboxes?: Zainbox[];
    exchangeRate?: ExchangeRateResult;
    shouldFail?: boolean;
  };

  constructor(mockData: MockZainpayApiClient['mockData'] = {}) {
    this.mockData = mockData;
  }

  async createZainbox(payload: CreateZainboxPayload): Promise<ZainboxCreationResponse> {
    if (this.mockData.shouldFail) {
      return {
        code: '01',
        description: 'Mock failure: Unable to create Zainbox',
        data: {} as Zainbox,
      };
    }

    return {
      code: '00',
      description: 'Success',
      data: {
        name: payload.name,
        codeName: `MOCK_${Date.now()}`,
        callbackUrl: payload.callbackUrl,
        emailNotification: payload.emailNotification || null,
        description: payload.description || null,
        tags: payload.tags || null,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        autoInternalTransfer: payload.allowAutoInternalTransfer || false,
      },
    };
  }

  async listZainboxes(): Promise<Zainbox[]> {
    if (this.mockData.shouldFail) {
      return [];
    }

    return this.mockData.zainboxes || [
      {
        name: 'Mock Zainbox',
        codeName: 'MOCK_ZAINBOX_1',
        callbackUrl: 'https://example.com/callback',
        emailNotification: null,
        description: 'A mock zainbox for testing',
        tags: null,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        autoInternalTransfer: false,
      },
    ];
  }

  async verifyTransaction(txnRef: string): Promise<VerifyTransactionResult> {
    if (!txnRef) {
      return { status: 'error', data: null, message: 'Transaction reference is missing.' };
    }

    if (this.mockData.shouldFail) {
      return { status: 'error', data: null, message: 'Mock verification failed.' };
    }

    return {
      status: 'success',
      data: {
        status: 'Successful',
        amount: '5000.00',
        paymentMethod: 'Card',
        transactionRef: txnRef,
        createdAt: new Date().toISOString(),
        source: 'NGN',
      },
    };
  }

  async getExchangeRate(): Promise<ExchangeRateResult> {
    if (this.mockData.shouldFail) {
      return { buy: 0, sell: 0 };
    }

    return this.mockData.exchangeRate || { buy: 1450, sell: 1500 };
  }
}

// Default export - real client for production use
export const zainpayClient: ZainpayApiClient = new RealZainpayApiClient();

// Export factory function for creating clients
export function createZainpayClient(type: 'real' | 'mock' = 'real', mockData?: MockZainpayApiClient['mockData']): ZainpayApiClient {
  switch (type) {
    case 'mock':
      return new MockZainpayApiClient(mockData);
    case 'real':
    default:
      return new RealZainpayApiClient();
  }
}
