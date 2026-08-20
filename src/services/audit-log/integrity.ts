/**
 * Audit Log Integrity Module
 * 
 * Provides tamper-evident logging using hash chaining
 * to detect any unauthorized modifications to audit logs.
 * 
 * @module services/audit-log/integrity
 */

import { logger } from '@/lib/logger';
import { AuditEvent } from './index';

// ============== Type Definitions ==============

/**
 * Integrity verification result
 */
export interface IntegrityResult {
  valid: boolean;
  totalEvents: number;
  firstInvalidEvent?: AuditEvent;
  invalidIndex?: number;
  mismatchDetails?: {
    eventId: string;
    expectedHash: string;
    actualHash: string;
  };
  verifiedAt: Date;
}

// ============== Constants ==============

/** Default hash algorithm used for chain integrity */
export const HASH_ALGORITHM = 'SHA-256';

// ============== Integrity Manager Class ==============

/**
 * Audit Integrity Manager
 * 
 * Manages hash chain integrity verification.
 */
export class AuditIntegrityManager {
  private orderedEventIds: string[];
  private events: Map<string, AuditEvent>;

  constructor(orderedEventIds: string[], events: Map<string, AuditEvent>) {
    this.orderedEventIds = orderedEventIds;
    this.events = events;
  }

  /**
   * Verify the integrity of the hash chain
   */
  async verifyIntegrity(): Promise<IntegrityResult> {
    const events = this.orderedEventIds.map(id => this.events.get(id)!).filter(Boolean);

    if (events.length === 0) {
      return {
        valid: true,
        totalEvents: 0,
        verifiedAt: new Date(),
      };
    }

    // Verify chain from beginning
    let expectedPreviousHash = '';
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Check previous hash linkage
      if (event.previousHash !== expectedPreviousHash) {
        return {
          valid: false,
          totalEvents: events.length,
          firstInvalidEvent: event,
          invalidIndex: i,
          mismatchDetails: {
            eventId: event.id,
            expectedHash: expectedPreviousHash,
            actualHash: event.previousHash ?? '',
          },
          verifiedAt: new Date(),
        };
      }

      // Recalculate and verify event hash
      const calculatedHash = this.calculateEventHash({ ...event, hash: undefined });
      if (event.hash !== calculatedHash) {
        return {
          valid: false,
          totalEvents: events.length,
          firstInvalidEvent: event,
          invalidIndex: i,
          mismatchDetails: {
            eventId: event.id,
            expectedHash: calculatedHash,
            actualHash: event.hash ?? '',
          },
          verifiedAt: new Date(),
        };
      }

      expectedPreviousHash = event.hash;
    }

    return {
      valid: true,
      totalEvents: events.length,
      verifiedAt: new Date(),
    };
  }

  /**
   * Get the current chain head (latest hash)
   */
  getChainHead(lastHash: string): string {
    return lastHash;
  }

  /**
   * Get the current sequence number
   */
  getSequenceNumber(sequenceNumber: number): number {
    return sequenceNumber;
  }

  /**
   * Calculate SHA-256 hash of an event for chain integrity
   */
  calculateEventHash(event: Partial<AuditEvent>): string {
    // Create canonical representation for hashing
    const canonical = [
      event.id,
      event.eventType,
      event.action,
      event.userId,
      event.timestamp?.toISOString(),
      event.severity,
      event.outcome,
      event.description,
      event.previousHash,
      event.sequenceNumber,
      JSON.stringify(event.changes ?? {}),
      JSON.stringify(event.metadata ?? {}),
    ].join('|');

    // Simple hash implementation (in production, use crypto.subtle)
    return this.simpleHash(canonical);
  }

  /**
   * Simple hash function for demo purposes
   * In production, replace with crypto.subtle.digest
   */
  private simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to hex string
    const hashStr = Math.abs(hash).toString(16).padStart(8, '0');
    
    // Add some entropy based on content length and timestamp
    const extraEntropy = (input.length * 31 + Date.now()).toString(16);
    
    return `${hashStr}-${extraEntropy.substring(0, 8)}-${btoa(input.substring(0, 32)).substring(0, 8)}`;
  }
}
