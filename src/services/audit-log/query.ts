/**
 * Audit Log Query & Search Module
 * 
 * Provides query and search functionality for audit logs
 * including filtering, sorting, and pagination.
 * 
 * @module services/audit-log/query
 */

import { logger } from '@/lib/logger';
import { AuditEvent } from './index';

// ============== Type Definitions ==============

/**
 * Query parameters for searching audit logs
 */
export interface AuditQueryParams {
  eventTypes?: import('./events').AuditEventType[];
  actions?: import('./events').AuditAction[];
  userIds?: string[];
  severities?: import('./events').AuditSeverity[];
  outcomes?: import('./events').AuditOutcome[];
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
  resourceType?: string;
  resourceId?: string;
  correlationId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'severity' | 'eventType';
  sortOrder?: 'asc' | 'desc';
}

// ============== Query Manager Class ==============

/**
 * Audit Query Manager
 */
export class AuditQueryManager {
  private events: Map<string, AuditEvent>;

  constructor(events: Map<string, AuditEvent>) {
    this.events = events;
  }

  /**
   * Search audit logs with flexible filtering
   */
  async query(params: AuditQueryParams = {}): Promise<AuditEvent[]> {
    let results = Array.from(this.events.values());

    // Apply filters
    if (params.eventTypes && params.eventTypes.length > 0) {
      results = results.filter(e => params.eventTypes!.includes(e.eventType));
    }

    if (params.actions && params.actions.length > 0) {
      results = results.filter(e => params.actions!.includes(e.action));
    }

    if (params.userIds && params.userIds.length > 0) {
      results = results.filter(e => params.userIds!.includes(e.userId));
    }

    if (params.severities && params.severities.length > 0) {
      results = results.filter(e => params.severities!.includes(e.severity));
    }

    if (params.outcomes && params.outcomes.length > 0) {
      results = results.filter(e => params.outcomes!.includes(e.outcome));
    }

    if (params.startDate) {
      results = results.filter(e => e.timestamp >= params.startDate!);
    }

    if (params.endDate) {
      results = results.filter(e => e.timestamp <= params.endDate!);
    }

    if (params.searchTerm) {
      const term = params.searchTerm.toLowerCase();
      results = results.filter(e => 
        e.description.toLowerCase().includes(term) ||
        e.userId.toLowerCase().includes(term) ||
        (e.username && e.username.toLowerCase().includes(term)) ||
        (e.metadata && JSON.stringify(e.metadata).toLowerCase().includes(term))
      );
    }

    if (params.resourceType) {
      results = results.filter(e => e.resource?.type === params.resourceType);
    }

    if (params.resourceId) {
      results = results.filter(e => e.resource?.id === params.resourceId);
    }

    if (params.correlationId) {
      results = results.filter(e => e.correlationId === params.correlationId);
    }

    // Sort results
    const sortBy = params.sortBy ?? 'timestamp';
    const sortOrder = params.sortOrder ?? 'desc';

    results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'severity': {
          const severityOrder: Record<string, number> = { [import('./events').AuditSeverity.EMERGENCY]: 4, [import('./events').AuditSeverity.CRITICAL]: 3, [import('./events').AuditSeverity.WARNING]: 2, [import('./events').AuditSeverity.INFO]: 1 };
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        }
        case 'eventType':
          comparison = a.eventType.localeCompare(b.eventType);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 100;
    
    results = results.slice(offset, offset + limit);

    logger.debug('Audit query executed', {
      event: 'audit.query',
      metadata: { params, resultCount: results.length },
    });

    return results;
  }

  /**
   * Get a single audit event by ID
   */
  async getEventById(id: string): Promise<AuditEvent | null> {
    return this.events.get(id) ?? null;
  }

  /**
   * Get events by correlation ID (related events)
   */
  async getEventsByCorrelationId(correlationId: string): Promise<AuditEvent[]> {
    return this.query({ correlationId });
  }

  /**
   * Get events for a specific user
   */
  async getUserActivity(userId: string, limit: number = 50): Promise<AuditEvent[]> {
    return this.query({ userIds: [userId], limit, sortBy: 'timestamp', sortOrder: 'desc' });
  }

  /**
   * Get events for a specific resource
   */
  async getResourceHistory(resourceType: string, resourceId: string): Promise<AuditEvent[]> {
    return this.query({ resourceType, resourceId, sortBy: 'timestamp', sortOrder: 'asc' });
  }

  /**
   * Count events matching query parameters
   */
  async count(params: Omit<AuditQueryParams, 'offset' | 'limit' | 'sortBy' | 'sortOrder'> = {}): Promise<number> {
    const results = await this.query({ ...params, limit: undefined, offset: undefined });
    return results.length;
  }
}
