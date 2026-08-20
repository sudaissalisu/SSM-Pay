"use server";

import 'dotenv/config';
import { type Zainbox, type ExchangeRateResponse } from "@/lib/definitions";
import { zainpayClient, type CreateZainboxPayload } from "@/lib/zainpay-client";
import { AppError, wrapError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

// Import validation schemas and helpers
import {
  PaymentInitSchema,
  PaymentVerifySchema,
  validatePaymentInit,
  validateZainboxCreate,
  formatValidationErrors,
} from "@/lib/validation";

/**
 * Create a new Zainbox
 * Validates input using Zod schema before processing
 */
export async function createZainbox(prevState: any, formData: FormData) {
  // Convert FormData to plain object for validation
  const rawData = Object.fromEntries(formData.entries());
  
  // Validate using centralized Zod schema
  const validationResult = validateZainboxCreate(rawData);
  
  if (!validationResult.success) {
    logger.warn('Zainbox creation validation failed', {
      event: 'zainbox.create.validation',
      metadata: { errors: validationResult.errors },
    });
    
    return {
      message: "Invalid form data.",
      errors: validationResult.errors,
    };
  }
  
  const payload: CreateZainboxPayload = validationResult.data;

  try {
    const result = await zainpayClient.createZainbox(payload);
    
    return { 
      message: `Zainbox '${result.data.name}' created successfully with code: ${result.data.codeName}.`, 
      data: result.data 
    };

  } catch (error) {
    const appError = wrapError(error, 'Failed to create Zainbox');
    logger.appError(appError, { action: 'createZainbox' });
    
    return { message: appError.getUserMessage() };
  }
}

/**
 * List all Zainboxes for the merchant
 */
export async function listZainboxes(): Promise<Zainbox[]> {
  try {
    const result = await zainpayClient.listZainboxes();
    return result;
  } catch (error) {
    const appError = wrapError(error, 'Failed to list Zainboxes');
    logger.appError(appError, { action: 'listZainboxes' });
    return [];
  }
}

/**
 * Verify a transaction using its reference
 * Validates reference parameter before making API call
 */
export async function verifyTransaction(txnRef: string) {
  // Validate transaction reference
  const refValidation = PaymentVerifySchema.safeParse({ reference: txnRef });
  
  if (!refValidation.success) {
    logger.warn('Verify transaction called with invalid reference', {
      event: 'transaction.verify.invalid',
      metadata: { txnRef, errors: refValidation.error.flatten().fieldErrors },
    });
    
    return { 
      status: 'error', 
      message: 'Invalid transaction reference. Reference must be at least 6 characters.' 
    };
  }

  try {
    const result = await zainpayClient.verifyTransaction(txnRef);
    return result;
  } catch (error) {
    const appError = wrapError(error, 'Verification failed');
    logger.appError(appError, { action: 'verifyTransaction', txnRef });
    
    return { status: 'error', message: appError.getUserMessage() };
  }
}

/**
 * Get current exchange rates
 */
export async function getExchangeRate(): Promise<ExchangeRateResponse> {
  try {
    const result = await zainpayClient.getExchangeRate();
    return result;
  } catch (error) {
    const appError = wrapError(error, 'Failed to fetch exchange rate');
    logger.appError(appError, { action: 'getExchangeRate' });
    
    // Return a default/mock rate if API fails to avoid breaking the UI
    return { code: 'fallback', description: 'Using fallback rate', data: [{ name: 'Fallback', code: 'FALLBACK', currencyCode: 'NGN', buy: 1400, sell: 1450 }] };
  }
}

/**
 * Initialize a payment transaction
 * Uses comprehensive Zod validation for all payment fields
 */
export async function initializePayment(prevState: any, formData: FormData) {
  // Extract raw data from FormData
  const rawData = {
    email: formData.get('email'),
    amount: formData.get('amount') ? Number(formData.get('amount')) : undefined,
    mobileNumber: formData.get('mobileNumber'),
    currency: formData.get('currency') || 'NGN',
  };

  // Validate using PaymentInitSchema
  const validationResult = validatePaymentInit(rawData);

  if (!validationResult.success) {
    logger.warn('Payment initialization validation failed', {
      event: 'payment.init.validation',
      metadata: { errors: validationResult.errors },
    });

    return { 
      error: formatValidationErrors(validationResult.errors),
      fieldErrors: validationResult.errors,
    };
  }

  const validatedData = validationResult.data;

  try {
    // Call the payment initialization API with validated data
    const response = await fetch(`${process.env.BASE_URL || ''}/api/payment/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: validatedData.amount,
        email: validatedData.email,
        mobileNumber: validatedData.mobileNumber,
        currency: validatedData.currency,
        customerId: validatedData.customerId,
        description: validatedData.description,
        paymentMethod: validatedData.paymentMethod,
      }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      return { error: result.error || 'Payment initialization failed' };
    }

    return { redirectUrl: result.redirectUrl };
  } catch (error) {
    const appError = wrapError(error, 'Payment initialization failed');
    logger.appError(appError, { 
      action: 'initializePayment', 
      amount: validatedData.amount, 
      email: validatedData.email 
    });
    
    return { error: appError.getUserMessage() };
  }
}
