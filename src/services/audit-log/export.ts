/**
 * Audit Log Export Service
 * Handles exporting audit logs to various formats
 */

import {
  AuditLogEntry,
  AuditQuery,
  ExportFormat,
  ExportOptions,
  ExportResult,
} from './types';
import { AuditQueryService } from './query';

/** CSV export configuration */
interface CsvExportConfig {
  /** Field delimiter */
  delimiter: string;
  /** Include BOM for Excel compatibility */
  includeBom: boolean;
  /** Quote character */
  quoteChar: string;
}

/** Default CSV config */
const DEFAULT_CSV_CONFIG: CsvExportConfig = {
  delimiter: ',',
  includeBom: true,
  quoteChar: '"',
};

/**
 * AuditExporter - Exports audit logs to various formats
 */
export class AuditExporter {
  private queryService: AuditQueryService;

  constructor(queryService: AuditQueryService) {
    this.queryService = queryService;
  }

  /**
   * Export audit logs with specified options
   * @param options - Export configuration
   * @returns Export result with content and metadata
   */
  async export(options: ExportOptions): Promise<ExportResult> {
    // Query the data
    const result = await this.queryService.queryLogs({
      ...options.query,
      limit: options.query?.limit || 100000, // High limit for exports
      offset: 0,
    });

    // Format based on type
    switch (options.format) {
      case ExportFormat.CSV:
        return this.exportToCSV(result.entries, options);

      case ExportFormat.JSON:
        return this.exportToJSON(result.entries, options);

      case ExportFormat.PDF:
        // PDF would require a library, return structured data for now
        console.warn('[Audit] PDF export not fully implemented');
        return this.exportToJSON(result.entries, options);

      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export logs to CSV format
   * @param entries - Entries to export
   * @param options - Export options
   * @returns Export result
   */
  async exportToCSV(
    entries: AuditLogEntry[],
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult> {
    const config = { ...DEFAULT_CSV_CONFIG };
    const headers = options.includeHeaders !== false;

    // Define columns in order
    const columns = [
      { key: 'id', label: 'Entry ID' },
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'action', label: 'Action' },
      { key: 'actor.id', label: 'Actor ID' },
      { key: 'actor.type', label: 'Actor Type' },
      { key: 'actor.displayName', label: 'Actor Name' },
      { key: 'resourceType', label: 'Resource Type' },
      { key: 'resourceId', label: 'Resource ID' },
      { key: 'description', label: 'Description' },
      { key: 'outcome', label: 'Outcome' },
      { key: 'severity', label: 'Severity' },
      { key: 'errorMessage', label: 'Error Message' },
      { key: 'requestId', label: 'Request ID' },
    ];

    let csvContent = '';

    // Add BOM for UTF-8 Excel compatibility
    if (config.includeBom) {
      csvContent += '\uFEFF';
    }

    // Add header row
    if (headers) {
      csvContent += columns.map((col) => this.escapeCsv(col.label, config.quoteChar)).join(config.delimiter);
      csvContent += '\n';
    }

    // Add data rows
    for (const entry of entries) {
      const row = columns.map((col) => {
        const value = this.getNestedValue(entry, col.key);
        return this.escapeCsv(String(value ?? ''), config.quoteChar);
      });
      csvContent += row.join(config.delimiter);
      csvContent += '\n';
    }

    const filename = this.generateFilename('audit_log', 'csv', options.includeDateInFilename);
    const contentBytes = new TextEncoder().encode(csvContent).length;

    return {
      content: csvContent,
      mimeType: 'text/csv; charset=utf-8',
      filename,
      sizeBytes: contentBytes,
      recordCount: entries.length,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Export logs to JSON format
   * @param entries - Entries to export
   * @param options - Export options
   * @returns Export result
   */
  async exportToJSON(
    entries: AuditLogEntry[],
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult> {
    const jsonData = entries.map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      action: entry.action,
      actor: {
        id: entry.actor.id,
        type: entry.actor.type,
        displayName: entry.actor.displayName || null,
        email: entry.actor.email || null,
        ipAddress: entry.actor.ipAddress || null,
      },
      resourceType: entry.resourceType,
      resourceId: entry.resourceId || null,
      description: entry.description,
      outcome: entry.outcome,
      severity: entry.severity,
      errorMessage: entry.errorMessage || null,
      requestId: entry.requestId || null,
      metadata: entry.metadata || {},
    }));

    const jsonContent = JSON.stringify(jsonData, null, 2);
    const filename = this.generateFilename('audit_log', 'json', options.includeDateInFilename);
    const contentBytes = new TextEncoder().encode(jsonContent).length;

    return {
      content: jsonData,
      mimeType: 'application/json',
      filename,
      sizeBytes: contentBytes,
      recordCount: entries.length,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a summary report of audit activity
   * @param dateFrom - Start date (optional)
   * @param dateTo - End date (optional)
   * @returns Report object with statistics and summary
   */
  async generateReport(dateFrom?: string, dateTo?: string): Promise<{
    summary: {
      totalEntries: number;
      dateRange: { start: string | null; end: string | null };
      generatedAt: string;
    };
    byAction: Array<{ action: string; count: number; percentage: number }>;
    byActorType: Array<{ type: string; count: number; percentage: number }>;
    byOutcome: Array<{ outcome: string; count: number; percentage: number }>;
    bySeverity: Array<{ severity: string; count: number; percentage: number }>;
    recentActivity: AuditLogEntry[];
  }> {
    const stats = this.queryService.getStatistics();

    // Get recent activity (last 50)
    const recentResult = await this.queryService.queryLogs({
      limit: 50,
      sortBy: 'timestamp',
      sortOrder: 'desc',
      dateFrom,
      dateTo,
    });

    // Calculate percentages
    const total = stats.totalEntries || 1;

    const byAction = Object.entries(stats.actionCounts)
      .map(([action, count]) => ({ action, count, percentage: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20

    const byActorType = Object.entries(stats.actorTypeCounts)
      .map(([type, count]) => ({ type, count, percentage: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);

    const byOutcome = Object.entries(stats.outcomeCounts)
      .map(([outcome, count]) => ({ outcome, count, percentage: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);

    const bySeverity = Object.entries(stats.severityCounts)
      .map(([severity, count]) => ({ severity, count, percentage: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);

    return {
      summary: {
        totalEntries: stats.totalEntries,
        dateRange: {
          start: stats.dateRange.earliest,
          end: stats.dateRange.latest,
        },
        generatedAt: new Date().toISOString(),
      },
      byAction,
      byActorType,
      byOutcome,
      bySeverity,
      recentActivity: recentResult.entries,
    };
  }

  /**
   * Escape a value for CSV output
   */
  private escapeCsv(value: string, quoteChar: string): string {
    if (
      value.includes(quoteChar) ||
      value.includes(',') ||
      value.includes('\n') ||
      value.includes('\r')
    ) {
      return `${quoteChar}${value.replace(new RegExp(quoteChar, 'g'), `${quoteChar}${quoteChar}`)}${quoteChar}`;
    }
    return value;
  }

  /**
   * Get nested object value using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj as unknown);
  }

  /**
   * Generate filename with optional date suffix
   */
  private generateFilename(
    baseName: string,
    extension: string,
    includeDate: boolean = true
  ): string {
    if (!includeDate) {
      return `${baseName}.${extension}`;
    }

    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
    return `${baseName}_${dateStr}.${extension}`;
  }
}
