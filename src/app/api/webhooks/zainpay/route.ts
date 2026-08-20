/**
 * Webhook Handler API Route
 * 
 * POST /api/webhooks/zainpay
 * 
 * Receives and processes webhooks from Zainpay with signature verification
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { WebhookPayloadSchema, validateRequest } from '@/lib/validation/payment-schema';
import { logger } from '@/lib/logger';
import { captureException, addBreadcrumb } from '@/lib/sentry';

// Simple HMAC-SHA256 signature verification (inline to avoid import issues)
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Process webhook event (simplified for API route)
async function processWebhookEvent(event: unknown, _requestId: string): Promise<void> {
  // In production, this would:
  // 1. Update payment status in database
  // 2. Send confirmation email/customer notification
  // 3. Trigger any post-payment workflows
  
  console.log('[Webhook] Processing event:', JSON.stringify(event, null, 2));
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const webhookLogger = logger.child('webhooks');
  webhookLogger.bindRequestId(requestId);

  addBreadcrumb('webhook', 'Incoming webhook received', { requestId });

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON payload' } },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const signature = request.headers.get('x-zainpay-signature') || '';
    const webhookSecret = process.env.ZAINPAY_WEBHOOK_SECRET || '';

    if (webhookSecret && signature) {
      const isValid = verifySignature(rawBody, signature, webhookSecret);
      
      if (!isValid) {
        webhookLogger.warn('Webhook signature verification failed', {
          signaturePresent: !!signature,
          hasSecret: !!webhookSecret,
        });

        return NextResponse.json(
          { success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' } },
          { status: 401 }
        );
      }
    }

    // Validate payload structure
    const validation = await validateRequest(WebhookPayloadSchema, body);

    if (!validation.success) {
      webhookLogger.warn('Webhook payload validation failed', {
        errors: validation.error,
      });

      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: validation.error } },
        { status: 400 }
      );
    }

    const event = validation.data;

    webhookLogger.info('Processing webhook event', {
      eventType: event.event,
      eventId: (event.data as {id?: string})?.id,
      status: (event.data as {status?: string})?.status,
    });

    // Process the webhook event asynchronously
    try {
      await processWebhookEvent(event, requestId);
    } catch (processingError) {
      webhookLogger.error('Failed to process webhook event', processingError as Error, {
        eventId: (event.data as {id?: string})?.id,
        eventType: event.event,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook received and processed',
      eventId: (event.data as {id?: string})?.id,
      requestId,
    });

  } catch (error) {
    webhookLogger.error('Webhook handler error', error as Error, { requestId });
    
    captureException(error, {
      tags: { endpoint: 'webhooks/zainpay', method: 'POST' },
      extra: { requestId },
      level: 'error',
    });

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed' } },
      { status: 500 }
    );
  }
}

/**
 * Verify endpoint - used by Zainpay to check webhook URL is active
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'SSM-Pay Webhook Handler',
    version: '2.1.0',
  });
}
