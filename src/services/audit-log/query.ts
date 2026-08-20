/**
 * Audit Log Query Service
 * Provides filtering, searching, and pagination of audit logs
 */

import {
  AuditLogEntry,
  AuditQuery,
  AuditQueryResult,
  AuditAction,
  ActorType,
} from './types';
import { AuditLogger } from './events';

/** Query service configuration */
export interface QueryServiceConfig {
  /** Default page size */
  defaultPageSize: number;
  /** Maximum page size (hard limit) */
  maxPageSize: number;
  /** Enable full-text search */
  enableSearch: boolean;
}

/** Default configuration */
const DEFAULT_CONFIG: QueryServiceConfig = {
  defaultPageSize: 50,
  maxPageSize: 500,
  enableSearch: true,
};

/**
 * AuditQueryService - Handles complex queries against audit logs
 */
export class AuditQueryService {
  private config: QueryServiceConfig;
  private logger: AuditLogger;

  constructor(
    logger: AuditLogger,
    config: Partial<QueryServiceConfig> = {}
  ) {
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a query against audit logs
   * @param query - Query parameters
   * @returns Paginated query result
   */
  async queryLogs(query: AuditQuery): Promise<AuditQueryResult> {
    const startTime = Date.now();

    // Get all entries and apply filters
    let entries = this.logger.getAllEntries();

    // Apply filters
    entries = this.applyFilters(entries, query);

    // Get total count before pagination
    const totalCount = entries.length;

    // Sort results
    entries = this.sortEntries(entries, query.sortBy || 'timestamp', query.sortOrder || 'desc');

    // Paginate
    const limit = Math.min(query.limit || this.config.defaultPageSize, this.config.maxPageSize);
    const offset = query.offset || 0;
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalCount / limit);

    const paginatedEntries = entries.slice(offset, offset + limit);

    return {
      entries: paginatedEntries,
      totalCount,
      page,
      pageSize: limit,
      totalPages,
      hasMore: offset + paginatedEntries.length < totalCount,
      queryTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Filter entries by date range
   * @param entries - Entries to filter
   * @param dateFrom - Start date (ISO string)
   * @param dateTo - End date (ISO string)
   * @returns Filtered entries
   */
  filterByDate(
    entries: AuditLogEntry[],
    dateFrom?: string,
    dateTo?: string
  ): AuditLogEntry[] {
    if (!dateFrom && !dateTo) return entries;

    const fromTime = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toTime = dateTo ? new Date(dateTo).getTime() : Infinity;

    return entries.filter((entry) => {
      const entryTime = new Date(entry.timestamp).getTime();
      return entryTime >= fromTime && entryTime <= toTime;
    });
  }

  /**
   * Filter entries by actor criteria
   * @param entries - Entries to filter
   * @param actorId - Actor ID to match
   * @param actorType - Actor type to match
   * @returns Filtered entries
   */
  filterByActor(
    entries: AuditLogEntry[],
    actorId?: string,
    actorType?: ActorType
  ): AuditLogEntry[] {
    return entries.filter((entry) => {
      if (actorId && entry.actor.id !== actorId) return false;
      if (actorType && entry.actor.type !== actorType) return false;
      return true;
    });
  }

  /**
   * Filter entries by resource
   * @param entries - Entries to filter
   * @param resourceType - Resource type
   * @param resourceId - Resource ID
   * @returns Filtered entries
   */
  filterByResource(
    entries: AuditLogEntry[],
    resourceType?: string,
    resourceId?: string
  ): AuditLogEntry[] {
    return entries.filter((entry) => {
      if (resourceType && entry.resourceType !== resourceType) return false;
      if (resourceId && entry.resourceId !== resourceId) return false;
      return true;
    });
  }

  /**
   * Get paginated results
   * @param entries - All matching entries
   * @param page - Page number (1-based)
   * @param pageSize - Items per page
   * @returns Paginated result with metadata
   */
  paginateResults(
    entries: AuditLogEntry[],
    page: number = 1,
    pageSize: number = this.config.defaultPageSize
  ): {
    entries: AuditLogEntry[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  } {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(pageSize, this.config.maxPageSize);
    const totalItems = entries.length;
    const totalPages = Math.ceil(totalItems / safeSize);
    const offset = (safePage - 1) * safeSize;

    return {
      entries: entries.slice(offset, offset + safeSize),
      page: safePage,
      pageSize: safeSize,
      totalItems,
      totalPages,
      hasMore: offset + safeSize < totalItems,
    };
  }

  /**
   * Search entries by text in description
   * @param entries - Entries to search
   * @param searchTerm - Text to search for
   * @returns Matching entries
   */
  searchEntries(
    entries: AuditLogEntry[],
    searchTerm: string
  ): AuditLogEntry[] {
    if (!searchTerm || !this.config.enableSearch) return entries;

    const term = searchTerm.toLowerCase();

    return entries.filter((entry) =>
      entry.description.toLowerCase().includes(term) ||
      entry.resourceId?.toLowerCase().includes(term) ||
      entry.actor.id.toLowerCase().includes(term) ||
      entry.actor.displayName?.toLowerCase().includes(term)
    );
  }

  /**
   * Get statistics about audit logs
   */
  getStatistics(): {
    totalEntries: number;
    actionCounts: Partial<Record<AuditAction, number>>;
    actorTypeCounts: Partial<Record<ActorType, number>>;
    outcomeCounts: Record<string, number>;
    severityCounts: Record<string, number>;
    dateRange: { earliest: string | null; latest: string | null };
  } {
    const entries = this.logger.getAllEntries();
    const actionCounts: Partial<Record<AuditAction, number>> = {};
    const actorTypeCounts: Partial<Record<ActorType, number>> = {};
    const outcomeCounts: Record<string, number> = {};
    const severityCounts: Record<string, number> = {};

    let earliest: string | null = null;
    let latest: string | null = null;

    for (const entry of entries) {
      // Count actions
      actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;

      // Count actor types
      actorTypeCounts[entry.actor.type] = (actorTypeCounts[entry.actor.type] || 0) + 1;

      // Count outcomes
      outcomeCounts[entry.outcome] = (outcomeCounts[entry.outcome] || 0) + 1;

      // Count severities
      severityCounts[entry.severity] = (severityCounts[entry.severity] || 0) + 1;

      // Track date range
      if (!earliest || entry.timestamp < earliest) earliest = entry.timestamp;
      if (!latest || entry.timestamp > latest) latest = entry.timestamp;
    }

    return {
      totalEntries: entries.length,
      actionCounts,
      actorTypeCounts,
      outcomeCounts,
      severityCounts,
      dateRange: { earliest, latest },
    };
  }

  /**
   * Apply all query filters to entries
   */
  private applyFilters(entries: AuditLogEntry[], query: AuditQuery): AuditLogEntry[][] {
    let filtered = [...entries];

    // Action filter
    if (query.actions && query.actions.length > 0) {
      filtered = filtered.filter((e) => query.actions!.includes(e.action));
    }

    // Actor filter
    filtered = this.filterByActor(filtered, query.actorId, query.actorType);

    // Resource filter
    filtered = this.filterByResource(filtered, query.resourceType, query.resourceId);

    // Outcome filter
    if (query.outcome) {
      filtered = filtered.filter((e) => e.outcome === query.outcome);
    }

    // Severity filter
    if (query.severity && query.severity.length > 0) {
      filtered = filtered.filter((e) => query.severity!.includes(e.severity));
    }

    // Date filter
    filtered = this.filterByDate(filtered, query.dateFrom, query.dateTo);

    // Search filter
    if (query.search) {
      filtered = this.searchEntries(filtered, query.search);
    }

    return [filtered];
  }

  /**
   * Sort entries by specified field
   */
  private sortEntries(
    entries: AuditLogEntry[],
    sortBy: 'timestamp' | 'action' | 'severity',
    sortOrder: 'asc' | 'desc'
  ): AuditLogEntry[] {
    return [...entries].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp.localeCompare(b.timestamp);
          break;
        case 'action':
          comparison = a.action.localeCompare(b.action);
          break;
        case 'severity':
          const severityOrder = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
          comparison =
            (severityOrder[a.severity as keyof typeof severityOrder] || 0) -
            (severityOrder[b.severity as keyof typeof severityOrder] || 0);
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }
}
