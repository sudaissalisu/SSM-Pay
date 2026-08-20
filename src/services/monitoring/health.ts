/**
 * Monitoring Health Check Module
 * 
 * Provides health check functionality including:
 * - Liveness checks
 * - Readiness checks (memory, event loop)
 * - Deep health checks with dependency validation
 * - Custom health check registration
 * 
 * @module services/monitoring/health
 */

import { logger } from '@/lib/logger';
import { AppError } from '@/lib/errors';

// ============== Type Definitions ==============

/**
 * Health status levels for system components
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Health check result for a single component
 */
export interface HealthCheckResult {
  /** Component identifier */
  component: string;
  /** Current health status */
  status: HealthStatus;
  /** Human-readable message */
  message?: string;
  /** Response time in milliseconds */
  responseTimeMs?: number;
  /** Additional details */
  details?: Record<string, unknown>;
  /** Error message if check failed */
  error?: string;
  /** Timestamp of the check */
  timestamp: Date;
}

/**
 * Overall system health status
 */
export interface SystemHealth {
  /** Overall system status */
  status: HealthStatus;
  /** Individual component checks */
  checks: HealthCheckResult[];
  /** System uptime in seconds */
  uptimeSeconds: number;
  /** Timestamp of the health assessment */
  timestamp: Date;
  /** Version information */
  version: string;
}

/** Health check callback function */
export type HealthCheckCallback = () => Promise<HealthCheckResult>;

// ============== Constants ==============

/** Health check timeout in milliseconds */
export const HEALTH_CHECK_TIMEOUT_MS = 5000;

/** Application version from environment or default */
export const APP_VERSION = process.env.npm_package_version || '1.0.0';

/** Application start time for uptime calculation */
export const APPLICATION_START_TIME = Date.now();

// ============== Health Manager Class ==============

/**
 * Health Check Manager
 * 
 * Manages all health check operations including:
 * - Built-in liveness and readiness checks
 * - Custom health check registration
 * - Comprehensive deep health assessments
 */
export class HealthManager {
  /** Health check registry */
  private healthChecks: Map<string, HealthCheckCallback> = new Map();
  
  /**
   * Register a custom health check
   */
  registerHealthCheck(
    component: string,
    checkFn: HealthCheckCallback
  ): void {
    this.healthChecks.set(component, checkFn);
    logger.debug(`Registered health check for: ${component}`, { event: 'health.check_registered' });
  }

  /**
   * Remove a registered health check
   */
  removeHealthCheck(component: string): boolean {
    return this.healthChecks.delete(component);
  }

  /**
   * Get all registered health check names
   */
  getRegisteredChecks(): string[] {
    return Array.from(this.healthChecks.keys());
  }

  /**
   * Perform liveness check (basic process health)
   */
  async checkLiveness(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      return {
        component: 'liveness',
        status: 'healthy',
        message: 'Service is alive',
        responseTimeMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        component: 'liveness',
        status: 'unhealthy',
        message: 'Liveness check failed',
        responseTimeMs: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Perform readiness check (dependencies available)
   */
  async checkReadiness(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const memoryHealthy = heapUsedMB < 500; // 500MB threshold
    
    checks.push({
      component: 'memory',
      status: memoryHealthy ? 'healthy' : 'degraded',
      message: `Heap usage: ${heapUsedMB.toFixed(2)}MB`,
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date(),
      details: { heapUsedMB, rssMB: memUsage.rss / 1024 / 1024 },
    });
    
    // Check event loop lag
    const eventLoopLag = await this.measureEventLoopLag();
    checks.push({
      component: 'event_loop',
      status: eventLoopLag < 100 ? 'healthy' : 'degraded',
      message: `Event loop lag: ${eventLoopLag.toFixed(2)}ms`,
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date(),
      details: { lagMs: eventLoopLag },
    });
    
    // Determine overall readiness
    const allHealthy = checks.every(c => c.status === 'healthy');
    const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
    
    return {
      component: 'readiness',
      status: hasUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded',
      message: `Readiness: ${checks.filter(c => c.status === 'healthy').length}/${checks.length} checks passing`,
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date(),
      details: { checks },
    };
  }

  /**
   * Perform deep health check (all components including dependencies)
   */
  async checkDeepHealth(): Promise<SystemHealth> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];
    
    // Run liveness check
    checks.push(await this.checkLiveness());
    
    // Run readiness check
    const readiness = await this.checkReadiness();
    checks.push(readiness);
    
    // Run all registered custom health checks
    for (const [component, checkFn] of Array.from(this.healthChecks.entries())) {
      try {
        const result = await Promise.race([
          checkFn(),
          new Promise<HealthCheckResult>((resolve) =>
            setTimeout(() => resolve({
              component,
              status: 'unhealthy' as HealthStatus,
              message: 'Health check timeout',
              timestamp: new Date(),
            }), HEALTH_CHECK_TIMEOUT_MS)
          ),
        ]);
        checks.push(result);
      } catch (error) {
        checks.push({
          component,
          status: 'unhealthy',
          message: 'Health check threw error',
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
        });
      }
    }
    
    // Determine overall status
    const statuses = checks.map(c => c.status);
    let overallStatus: HealthStatus = 'healthy';
    
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    } else if (statuses.includes('unknown')) {
      overallStatus = 'unknown';
    }
    
    const uptimeSeconds = (Date.now() - APPLICATION_START_TIME) / 1000;
    
    return {
      status: overallStatus,
      checks,
      uptimeSeconds,
      timestamp: new Date(),
      version: APP_VERSION,
    };
  }

  /**
   * Alias for deep health check
   */
  async getSystemHealth(): Promise<SystemHealth> {
    return this.checkDeepHealth();
  }

  /**
   * Measure event loop lag
   */
  private measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delta = Number(process.hrtime.bigint() - start) / 1e6; // Convert to ms
        resolve(delta);
      });
    });
  }

  /**
   * Clear all registered health checks
   */
  clearChecks(): void {
    this.healthChecks.clear();
  }
}
