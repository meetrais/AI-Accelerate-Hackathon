import { Request, Response } from 'express';

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  service?: string;
  operation?: string;
  duration?: number;
  userId?: string;
  sessionId?: string;
  metadata?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: { [key: string]: string };
}

export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  successRate: number;
  activeConnections: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  uptime: number;
}

export class MonitoringService {
  private logs: LogEntry[] = [];
  private metrics: Metric[] = [];
  private requestMetrics: Map<string, { count: number; totalTime: number; errors: number }> = new Map();
  private maxLogEntries: number = 10000;
  private maxMetrics: number = 50000;

  /**
   * Log an entry with structured data
   */
  log(level: LogEntry['level'], message: string, metadata?: any): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      ...metadata
    };

    this.logs.push(entry);

    // Trim logs if exceeding max entries
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }

    // Console output with formatting
    const timestamp = entry.timestamp.toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    const service = entry.service ? `[${entry.service}]` : '';
    const operation = entry.operation ? `{${entry.operation}}` : '';
    
    console.log(`${timestamp} ${levelStr} ${service}${operation} ${message}`);
    
    if (entry.metadata) {
      console.log('  Metadata:', JSON.stringify(entry.metadata, null, 2));
    }
    
    if (entry.error) {
      console.error('  Error:', entry.error);
    }
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: any): void {
    this.log('info', message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: any): void {
    this.log('warn', message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: any): void {
    const errorData = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : undefined;

    this.log('error', message, {
      ...metadata,
      error: errorData
    });
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: any): void {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, metadata);
    }
  }

  /**
   * Record a metric
   */
  recordMetric(name: string, value: number, tags?: { [key: string]: string }): void {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date(),
      tags
    };

    this.metrics.push(metric);

    // Trim metrics if exceeding max entries
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Record request metrics
   */
  recordRequest(endpoint: string, method: string, statusCode: number, duration: number): void {
    const key = `${method} ${endpoint}`;
    const existing = this.requestMetrics.get(key) || { count: 0, totalTime: 0, errors: 0 };
    
    existing.count++;
    existing.totalTime += duration;
    
    if (statusCode >= 400) {
      existing.errors++;
    }
    
    this.requestMetrics.set(key, existing);

    // Record individual metrics
    this.recordMetric('http_request_duration_ms', duration, {
      endpoint,
      method,
      status_code: statusCode.toString()
    });

    this.recordMetric('http_request_count', 1, {
      endpoint,
      method,
      status_code: statusCode.toString()
    });
  }

  /**
   * Get recent logs
   */
  getLogs(limit: number = 100, level?: LogEntry['level']): LogEntry[] {
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = this.logs.filter(log => log.level === level);
    }
    
    return filteredLogs.slice(-limit);
  }

  /**
   * Get metrics for a time range
   */
  getMetrics(
    name?: string, 
    since?: Date, 
    limit: number = 1000
  ): Metric[] {
    let filteredMetrics = this.metrics;
    
    if (name) {
      filteredMetrics = filteredMetrics.filter(metric => metric.name === name);
    }
    
    if (since) {
      filteredMetrics = filteredMetrics.filter(metric => metric.timestamp >= since);
    }
    
    return filteredMetrics.slice(-limit);
  }

  /**
   * Get performance metrics summary
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    
    // Get recent request metrics
    const recentRequests = this.getMetrics('http_request_count', oneHourAgo);
    const recentDurations = this.getMetrics('http_request_duration_ms', oneHourAgo);
    
    const totalRequests = recentRequests.reduce((sum, metric) => sum + metric.value, 0);
    const totalDuration = recentDurations.reduce((sum, metric) => sum + metric.value, 0);
    const averageResponseTime = totalRequests > 0 ? totalDuration / totalRequests : 0;
    
    // Calculate error rate
    const errorRequests = recentRequests.filter(metric => 
      metric.tags?.status_code && parseInt(metric.tags.status_code) >= 400
    ).reduce((sum, metric) => sum + metric.value, 0);
    
    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
    const successRate = 100 - errorRate;

    // Get memory usage
    const memUsage = process.memoryUsage();
    
    return {
      requestCount: totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      activeConnections: 0, // Would need to track this separately
      memoryUsage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024) // MB
      },
      uptime: process.uptime()
    };
  }

  /**
   * Get request statistics by endpoint
   */
  getRequestStatistics(): Array<{
    endpoint: string;
    count: number;
    averageTime: number;
    errorRate: number;
  }> {
    const stats: Array<{
      endpoint: string;
      count: number;
      averageTime: number;
      errorRate: number;
    }> = [];

    this.requestMetrics.forEach((metrics, endpoint) => {
      stats.push({
        endpoint,
        count: metrics.count,
        averageTime: Math.round(metrics.totalTime / metrics.count),
        errorRate: Math.round((metrics.errors / metrics.count) * 100 * 100) / 100
      });
    });

    return stats.sort((a, b) => b.count - a.count);
  }

  /**
   * Clear old logs and metrics
   */
  cleanup(olderThan: Date): void {
    const initialLogCount = this.logs.length;
    const initialMetricCount = this.metrics.length;
    
    this.logs = this.logs.filter(log => log.timestamp >= olderThan);
    this.metrics = this.metrics.filter(metric => metric.timestamp >= olderThan);
    
    const clearedLogs = initialLogCount - this.logs.length;
    const clearedMetrics = initialMetricCount - this.metrics.length;
    
    if (clearedLogs > 0 || clearedMetrics > 0) {
      this.info(`Cleaned up ${clearedLogs} logs and ${clearedMetrics} metrics older than ${olderThan.toISOString()}`);
    }
  }

  /**
   * Export logs and metrics for external systems
   */
  exportData(since?: Date): {
    logs: LogEntry[];
    metrics: Metric[];
    performance: PerformanceMetrics;
    requestStats: Array<{
      endpoint: string;
      count: number;
      averageTime: number;
      errorRate: number;
    }>;
  } {
    return {
      logs: since ? this.logs.filter(log => log.timestamp >= since) : this.logs,
      metrics: since ? this.metrics.filter(metric => metric.timestamp >= since) : this.metrics,
      performance: this.getPerformanceMetrics(),
      requestStats: this.getRequestStatistics()
    };
  }

  /**
   * Create request logging middleware
   */
  createRequestLogger() {
    return (req: Request, res: Response, next: Function) => {
      const startTime = Date.now();
      const originalSend = res.send;

      // Override res.send to capture response
      res.send = function(body: any) {
        const duration = Date.now() - startTime;
        
        // Record request metrics
        monitoringService.recordRequest(
          req.route?.path || req.path,
          req.method,
          res.statusCode,
          duration
        );

        // Log request details
        const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
        monitoringService.log(logLevel, `${req.method} ${req.path} ${res.statusCode}`, {
          service: 'http',
          operation: 'request',
          duration,
          userId: (req as any).userId,
          sessionId: (req as any).sessionId,
          metadata: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            responseSize: body ? JSON.stringify(body).length : 0
          }
        });

        return originalSend.call(this, body);
      };

      next();
    };
  }

  /**
   * Start periodic cleanup
   */
  startCleanup(intervalMinutes: number = 60, retentionHours: number = 24): void {
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
      this.cleanup(cutoffTime);
    }, intervalMinutes * 60 * 1000);

    this.info(`Started monitoring cleanup: ${intervalMinutes}min interval, ${retentionHours}h retention`);
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();