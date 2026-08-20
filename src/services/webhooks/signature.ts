/**
 * Webhook Signature Verification and Generation
 * Implements HMAC-SHA256 signing for secure webhook delivery
 */

import crypto from 'crypto';
import {
  WebhookSignature,
  WebhookEvent,
  DEFAULT_RETRY_POLICY,
} from './types';

/** Tolerance in seconds for timestamp validation */
const TIMESTAMP_TOLERANCE_SECONDS = 300;

/** Signature header prefix */
const SIGNATURE_PREFIX = 'sha256=';

/**
 * Generate HMAC-SHA256 signature for a webhook payload
 * @param payload - The JSON stringified event data
 * @param secret - The webhook secret key
 * @param timestamp - Unix timestamp of signature generation
 * @returns The hex-encoded signature
 */
export function generateSignature(
  payload: string,
  secret: string,
  timestamp: number
): string {
  const signedPayload = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signedPayload);
  return `${SIGNATURE_PREFIX}${hmac.digest('hex')}`;
}

/**
 * Verify a webhook signature against the payload and secret
 * @param payload - The raw request body
 * @param signature - The signature header value
 * @param secret - The webhook secret
 * @returns Verification result with validity status
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): { valid: boolean; error?: string } {
  // Extract timestamp and signatures from header
  const elements = signature.split(',');
  let timestamp = 0;
  const signatures: string[] = [];

  for (const element of elements) {
    const [key, value] = element.split('=');
    if (key === 't') {
      timestamp = parseInt(value, 10);
      if (isNaN(timestamp)) {
        return { valid: false, error: 'Invalid timestamp format' };
      }
    } else if (value) {
      signatures.push(`${key}=${value}`);
    }
  }

  // Validate timestamp is within tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
    return {
      valid: false,
      error: `Timestamp outside tolerance: ${Math.abs(now - timestamp)}s > ${TIMESTAMP_TOLERANCE_SECONDS}s`,
    };
  }

  // Compute expected signature
  const expectedSignature = generateSignature(payload, secret, timestamp);

  // Check if any provided signature matches using constant-time comparison
  const isValid = signatures.some((sig) =>
    timingSafeEqual(sig, expectedSignature)
  );

  if (!isValid) {
    return { valid: false, error: 'Signature mismatch' };
  }

  return { valid: true };
}

/**
 * Sign a complete webhook event payload
 * @param event - The webhook event to sign
 * @param secret - The signing secret
 * @returns Signed event with signature metadata
 */
export function signPayload(
  event: WebhookEvent,
  secret: string
): { event: WebhookEvent; signature: WebhookSignature } {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify(event);
  const signatureStr = generateSignature(payload, secret, timestamp);

  const signature: WebhookSignature = {
    signature: `t=${timestamp},${signatureStr}`,
    timestamp,
    hexDigest: signatureStr.replace(SIGNATURE_PREFIX, ''),
    secretId: maskSecret(secret),
    algorithm: 'sha256',
  };

  return { event, signature };
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns Whether strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Mask a secret key for safe logging/display
 * @param secret - The secret to mask
 * @returns Masked secret showing only first/last 4 chars
 */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return '****';
  }
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

/**
 * Generate a secure random webhook secret
 * @param bytes - Number of bytes for the secret (default 32)
 * @returns Hex-encoded secret string
 */
export function generateWebhookSecret(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Construct the signature header value from components
 * @param timestamp - Unix timestamp
 * @param signature - Hex signature digest
 * @returns Formatted signature header string
 */
export function constructSignatureHeader(
  timestamp: number,
  signature: string
): string {
  return `t=${timestamp},${SIGNATURE_PREFIX}${signature}`;
}

/**
 * Parse signature header into components
 * @param header - Raw signature header value
 * @returns Parsed signature components or null if invalid
 */
export function parseSignatureHeader(header: string): {
  timestamp: number;
  signatures: string[];
} | null {
  const elements = header.split(',');
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const element of elements) {
    const eqIndex = element.indexOf('=');
    if (eqIndex === -1) continue;

    const key = element.slice(0, eqIndex);
    const value = element.slice(eqIndex + 1);

    if (key === 't') {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        timestamp = parsed;
      }
    } else if (value.length > 0) {
      signatures.push(element);
    }
  }

  if (timestamp === null || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

/**
 * Validate webhook event structure
 * @param event - Event to validate
 * @returns Validation result with any errors found
 */
export function validateEventStructure(event: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const e = event as Record<string, unknown>;

  if (!e || typeof e !== 'object') {
    return { valid: false, errors: ['Event must be an object'] };
  }

  if (typeof e.id !== 'string' || e.id.length === 0) {
    errors.push('Event id is required');
  }

  if (typeof e.type !== 'string') {
    errors.push('Event type is required');
  }

  if (typeof e.createdAt !== 'string') {
    errors.push('Event createdAt timestamp is required');
  }

  if (typeof e.data !== 'object' || e.data === null) {
    errors.push('Event data object is required');
  }

  if (typeof e.livemode !== 'boolean') {
    errors.push('Event livemode boolean is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
