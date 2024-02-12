"use server";

import { z } from "zod";
import 'dotenv/config';
import { type Zainbox, type ZainboxCreationResponse, type ExchangeRateResponse } from "@/lib/definitions";
import { zainpayClient, type CreateZainboxPayload } from "@/lib/zainpay-client";
import { AppError, ErrorCode, wrapError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const zainboxSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters long." }),
  callbackUrl: z.string().url({ message: "Please enter a valid URL." }),
  emailNotification: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')), 
  description: z.string().optional(),
  tags: z.string().optional(),
  codeNamePrefix: z.string().max(3, "Prefix can be up to 3 characters.").optional(),
  allowAutoInternalTransfer: z.coerce.boolean().default(false),
});

export async function createZainbox(prevState: any, formData: FormData) {
  const validatedFields = zainboxSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!validatedFields.success) {
    logger.warn('Zainbox creation validation failed', {
      event: 'zainbox.create.validation',
      metadata: { errors: validatedFields.error.flatten().fieldErrors },
    });
    
    return {
      message: "Invalid form data.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  
  const payload: CreateZainboxPayload = validatedFields.data;

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

export async function verifyTransaction(txnRef: string) {
  if (!txnRef) {
    logger.warn('Verify transaction called without reference', {
      event: 'transaction.verify.missing',
    });
    return { status: 'error', message: 'Transaction reference is missing.' };
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

export async function getExchangeRate() {
  try {
    const result = await zainpayClient.getExchangeRate();
    return result;
  } catch (error) {
    const appError = wrapError(error, 'Failed to fetch exchange rate');
    logger.appError(appError, { action: 'getExchangeRate' });
    
    // Return a default/mock rate if API fails to avoid breaking the UI
    return { buy: 1400, sell: 1450 };
  }
}

// Payment initialization for dashboard payment form
export async function initializePayment(prevState: any, formData: FormData) {
  const amount = formData.get('amount') as string;
  const email = formData.get('email') as string;
  const mobileNumber = formData.get('mobileNumber') as string;
  const currency = formData.get('currency') as string || 'NGN';

  if (!amount || !email || !mobileNumber) {
    return { error: 'Missing required fields: amount, email, or mobileNumber' };
  }

  try {
    // Call the payment initialization API
    const response = await fetch(`${process.env.BASE_URL || ''}/api/payment/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, email, mobileNumber, currency }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      return { error: result.error || 'Payment initialization failed' };
    }

    return { redirectUrl: result.redirectUrl };
  } catch (error) {
    const appError = wrapError(error, 'Payment initialization failed');
    logger.appError(appError, { action: 'initializePayment', amount, email });
    
    return { error: appError.getUserMessage() };
  }
}
