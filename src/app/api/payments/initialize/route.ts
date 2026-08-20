/**
 * Payment Initialization API Route
 * 
 * POST /api/payments/initialize
 * 
 * Accepts payment initialization requests with full Zod validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { InitializePaymentSchema, validateRequest } from '@/lib/validation/payment-schema';
import { logger } from '@/lib/logger';
import { captureException, addBreadcrumb } from '@/lib/sentry';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  // Bind request ID to logger for tracing
  const paymentLogger = logger.child('payments');
  paymentLogger.bindRequestId(requestId);
  
  addBreadcrumb('api', 'Payment initialization started', { requestId });

  try {
    // Parse and validate request body using Zod schema
    let body: unknown;
    try {
      body = await request.json();
    } catch (parseError) {
      paymentLogger.warn('Invalid JSON in request body', { error: parseError });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          },
        },
        { status: 400 }
      );
    }

    // Validate against schema
    const validation = await validateRequest(InitializePaymentSchema, body);

    if (!validation.success) {
      paymentLogger.warn('Payment validation failed', { 
        errors: validation.error,
        requestBody: { ...(body as object), cardNumber: '[FILTERED]', cvv: '[FILTERED]' }
      });
      
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error,
            requestId,
          },
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Generate unique reference if not provided
    const reference = data.reference || `SSM-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    paymentLogger.info('Processing payment initialization', {
      amount: data.amount,
      currency: data.currency,
      email: data.email,
      reference,
      paymentMethod: data.paymentMethod,
    });

    // Simulate payment processing (in real app, call Zainpay API)
    // This is where you would integrate with the actual payment provider
    
    const processingTimeMs = Date.now() - startTime;

    // Return successful response
    const response = {
      success: true,
      data: {
        reference,
        amount: data.amount,
        currency: data.currency,
        status: 'INITIALIZED',
        checkoutUrl: `https://checkout.ssmpay.com/pay/${reference}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      },
      meta: {
        requestId,
        processingTimeMs,
      },
    };

    paymentLogger.info('Payment initialized successfully', { 
      reference, 
      processingTimeMs 
    });

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    
    paymentLogger.error('Payment initialization failed', error as Error, {
      processingTimeMs,
      requestId,
    });
    
    captureException(error, {
      tags: { endpoint: 'payments/initialize', method: 'POST' },
      extra: { requestId, processingTimeMs },
      level: 'error',
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again.',
          requestId,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Handle unsupported methods
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST method is allowed for this endpoint',
      },
    },
    { status: 405 }
  );
}
