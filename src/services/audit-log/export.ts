/**
 * Audit Log Export Module
 * 
 * Provides export functionality for compliance reporting
 * including CSV and JSON format support.
 * 
 * @module services/audit-log/export
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import { AuditEvent } from './index';

// ============== Type Definitions ==============

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'json';

/**
 * Export options for compliance reports
 */
export interface ExportOptions {
  format: ExportFormat;
  query?: Partial<import('./query').AuditQueryParams>;
  includeHashChain?: boolean;
  includeMetadata?: boolean;
  filename?: string;
  redactSensitive?: boolean;
  redactedFields?: string[];
}

// ============== Export Manager Class ==============

/**
 * Audit Export Manager
 */
export class AuditExportManager {
  private queryManager: {
    query: (params: import('./query').AuditQueryParams) => Promise<AuditEvent[]>;
  };

  constructor(queryManager: {
    query: (params: import('./query').AuditQueryParams) => Promise<AuditEvent[]>;
  }) {
    this.queryManager = queryManager;
  }

  /**
   * Export audit logs for compliance reporting
   */
  async export(options: ExportOptions): Promise<string> {
    const events = await this.queryManager.query(options.query ?? {});
    
    // Redact sensitive fields if requested
    let processedEvents = events;
    if (options.redactSensitive && options.redactedFields && options.redactedFields.length > 0) {
      processedEvents = this.redactEvents(events, options.redactedFields);
    }

    switch (options.format) {
      case 'csv':
        return this.exportToCSV(processedEvents, options);
      case 'json':
        return this.exportToJSON(processedEvents, options);
      default:
        throw new AppError(`Unsupported export format: ${options.format}`, ErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Export as downloadable file blob
   */
  async exportAsBlob(options: ExportOptions): Promise<Blob> {
    const data = await this.export(options);
    const mimeType = options.format === 'csv' ? 'text/csv' : 'application/json';
    const filename = options.filename ?? `audit-export-${new Date().toISOString().split('T')[0]}`;
    
    logger.info('Audit export generated', {
      event: 'audit.export',
      metadata: { format: options.format, eventCount: (await this.queryManager.query(options.query || {})).length, filename },
    });

    return new Blob([data], { type: mimeType });
  }

  /**
   * Export events to CSV format
   */
  private exportToCSV(events: AuditEvent[], options: ExportOptions): string {
    const headers = [
      'id',
      'timestamp',
      'eventType',
      'action',
      'userId',
      'username',
      'severity',
      'outcome',
      'description',
      'resourceType',
      'resourceId',
      'sourceIpAddress',
      'correlationId',
      ...(options.includeHashChain ? ['sequenceNumber', 'previousHash', 'hash'] : []),
      ...(options.includeMetadata ? ['metadata'] : []),
    ];

    const rows = events.map(event => [
      this.csvEscape(event.id),
      event.timestamp.toISOString(),
      event.eventType,
      event.action,
      this.csvEscape(event.userId),
      this.csvEscape(event.username ?? ''),
      event.severity,
      event.outcome,
      this.csvEscape(event.description),
      event.resource?.type ?? '',
      event.resource?.id ?? '',
      event.source?.ipAddress ?? '',
      event.correlationId ?? '',
      ...(options.includeHashChain ? [event.sequenceNumber ?? '', event.previousHash ?? '', event.hash ?? ''] : []),
      ...(options.includeMetadata ? [this.csvEscape(JSON.stringify(event.metadata ?? {}))] : []),
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Export events to JSON format
   */
  private exportToJSON(events: AuditEvent[], options: ExportOptions): string {
    let processedEvents = events;

    if (!options.includeMetadata) {
      processedEvents = events.map(({ metadata, ...rest }) => rest);
    }

    if (!options.includeHashChain) {
      processedEvents = processedEvents.map(({ previousHash, hash, sequenceNumber, ...rest }) => rest);
    }

    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      totalRecords: processedEvents.length,
      events: processedEvents,
    }, null, 2);
  }

  /**
   * Escape a value for CSV output
   */
  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Redact sensitive fields from events
   */
  redactEvents(events: AuditEvent[], fields: string[]): AuditEvent[] {
    return events.map(event => {
      const redacted = { ...event };
      
      // Redact from metadata
      if (redacted.metadata) {
        redacted.metadata = { ...redacted.metadata };
        for (const field of fields) {
          if (field in redacted.metadata) {
            (redacted.metadata as Record<string, unknown>)[field] = '[REDACTED]';
          }
        }
      }

      // Redact from changes
      if (redacted.changes) {
        redacted.changes = redacted.changes.map(change => {
          if (fields.includes(change.field)) {
            return {
              ...change,
              previousValue: '[REDACTED]',
              newValue: '[REDACTED]',
            };
          }
          return change;
        });
      }

      // Redact from source
      if (redacted.source) {
        redacted.source = { ...redacted.source };
        for (const field of fields) {
          if (field in redacted.source) {
            (redacted.source as Record<string, unknown>)[field] = '[REDACTED]';
          }
        }
      }

      return redacted;
    });
  }
}
