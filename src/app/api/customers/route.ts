/**
 * Customer Management API Route
 * 
 * POST /api/customers - Create new customer
 * GET /api/customers?email=...&page=1&limit=20 - List customers
 */

import { NextRequest, NextResponse } from 'next/server';
import { CreateCustomerSchema, CustomerSearchParamsSchema, validateRequest } from '@/lib/validation/customer-schema';
import { logger } from '@/lib/logger';
import { captureException } from '@/lib/sentry';

// POST - Create new customer
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const customerLogger = logger.child('customers');
  customerLogger.bindRequestId(requestId);

  try {
    const body = await request.json();
    const validation = await validateRequest(CreateCustomerSchema, body);

    if (!validation.success) {
      customerLogger.warn('Customer creation validation failed', {
        errors: validation.error,
      });

      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: validation.error, requestId },
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    customerLogger.info('Creating new customer', {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone ? '[FILTERED]' : undefined,
    });

    // Generate customer ID
    const customerId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    // In production, save to database via Prisma
    const customer = {
      id: customerId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      metadata: data.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      kycStatus: 'NOT_VERIFIED',
      status: 'ACTIVE',
    };

    customerLogger.info('Customer created successfully', { customerId, email: data.email });

    return NextResponse.json({
      success: true,
      data: customer,
      meta: { requestId },
    }, { status: 201 });

  } catch (error) {
    customerLogger.error('Customer creation failed', error as Error, { requestId });
    captureException(error, { tags: { endpoint: 'customers', method: 'POST' }, extra: { requestId } });

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create customer', requestId } },
      { status: 500 }
    );
  }
}

// GET - List customers with pagination and filters
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const customerLogger = logger.child('customers');
  customerLogger.bindRequestId(requestId);

  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    
    const validation = await validateRequest(CustomerSearchParamsSchema, searchParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: validation.error, requestId },
        },
        { status: 400 }
      );
    }

    const params = validation.data;
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100); // Max 100 per page

    customerLogger.info('Listing customers', { page, limit, searchEmail: params.email });

    // In production, query database with filters
    const customers: unknown[] = []; // Array from DB query
    const total = customers.length;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      meta: { requestId },
    });

  } catch (error) {
    customerLogger.error('Customer listing failed', error as Error, { requestId });
    captureException(error, { tags: { endpoint: 'customers', method: 'GET' }, extra: { requestId } });

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list customers', requestId } },
      { status: 500 }
    );
  }
}
