import express from 'express';
import { monitoringService } from '../services/monitoringService';
import { healthMonitor } from '../services/healthMonitor';
import { schedulerService } from '../services/schedulerService';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

/**
 * GET /api/monitoring/metrics
 * Get system performance metrics
 */
router.get('/metrics', asyncHandler(async (req, res) => {
  const metrics = monitoringService.getPerformanceMetrics();
  
  const response: ApiResponse = {
    success: true,
    data: metrics,
    message: 'Performance metrics retrieved successfully'
  };

  res.json(response);
}));

/**
 * GET /api/monitoring/logs
 * Get recent system logs
 */
router.get('/logs', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const level = req.query.level as 'info' | 'warn' | 'error' | 'debug';
  
  const logs = monitoringService.getLogs(limit, level);
  
  const response: ApiResponse = {
    success: true,
    data: { logs, count: logs.length },
    message: 'Logs retrieved successfully'
  };

  res.json(response);
}));

/**
 * GET /api/monitoring/requests
 * Get request statistics by endpoint
 */
router.get('/requests', asyncHandler(async (req, res) => {
  const stats = monitoringService.getRequestStatistics();
  
  const response: ApiResponse = {
    success: true,
    data: { statistics: stats },
    message: 'Request statistics retrieved successfully'
  };

  res.json(response);
}));

/**
 * GET /api/monitoring/health-detailed
 * Get detailed health information including circuit breakers
 */
router.get('/health-detailed', asyncHandler(async (req, res) => {
  const systemHealth = await healthMonitor.checkSystemHealth();
  const circuitBreakerStates = healthMonitor.getCircuitBreakerStates();
  const schedulerStatus = schedulerService.getStatus();
  
  const response: ApiResponse = {
    success: true,
    data: {
      health: systemHealth,
      circuitBreakers: circuitBreakerStates,
      scheduler: schedulerStatus,
      monitoring: {
        logsCount: monitoringService.getLogs(10000).length,
        metricsCount: monitoringService.getMetrics().length
      }
    },
    message: 'Detailed health information retrieved successfully'
  };

  res.json(response);
}));

/**
 * GET /api/monitoring/export
 * Export monitoring data for external systems
 */
router.get('/export', asyncHandler(async (req, res) => {
  const since = req.query.since ? new Date(req.query.since as string) : undefined;
  const data = monitoringService.exportData(since);
  
  const response: ApiResponse = {
    success: true,
    data,
    message: 'Monitoring data exported successfully'
  };

  res.json(response);
}));

/**
 * POST /api/monitoring/circuit-breaker/:service/reset
 * Reset circuit breaker for a specific service
 */
router.post('/circuit-breaker/:service/reset', asyncHandler(async (req, res) => {
  const { service } = req.params;
  const success = healthMonitor.resetCircuitBreaker(service);
  
  const response: ApiResponse = {
    success,
    data: { service, reset: success },
    message: success 
      ? `Circuit breaker for ${service} reset successfully`
      : `Circuit breaker for ${service} not found`
  };

  res.status(success ? 200 : 404).json(response);
}));

/**
 * POST /api/monitoring/cleanup
 * Manually trigger monitoring data cleanup
 */
router.post('/cleanup', asyncHandler(async (req, res) => {
  const hours = parseInt(req.body.hours) || 24;
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  monitoringService.cleanup(cutoffTime);
  
  const response: ApiResponse = {
    success: true,
    data: { cutoffTime, hours },
    message: `Cleanup completed for data older than ${hours} hours`
  };

  res.json(response);
}));

/**
 * GET /api/monitoring/dashboard
 * Get dashboard data with key metrics
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const [systemHealth, performanceMetrics, requestStats] = await Promise.all([
    healthMonitor.checkSystemHealth(),
    monitoringService.getPerformanceMetrics(),
    monitoringService.getRequestStatistics()
  ]);

  // Get recent error logs
  const recentErrors = monitoringService.getLogs(50, 'error');
  
  // Get top endpoints by request count
  const topEndpoints = requestStats.slice(0, 10);
  
  // Calculate service availability
  const availability = systemHealth.services.reduce((acc, service) => {
    acc[service.name] = service.status === 'healthy' ? 100 : 
                       service.status === 'degraded' ? 75 : 0;
    return acc;
  }, {} as { [key: string]: number });

  const dashboardData = {
    overview: {
      status: systemHealth.overall,
      uptime: performanceMetrics.uptime,
      requestCount: performanceMetrics.requestCount,
      errorRate: performanceMetrics.errorRate,
      averageResponseTime: performanceMetrics.averageResponseTime
    },
    services: systemHealth.services.map(service => ({
      name: service.name,
      status: service.status,
      responseTime: service.responseTime,
      availability: availability[service.name],
      lastCheck: service.lastCheck
    })),
    performance: {
      memory: performanceMetrics.memoryUsage,
      requests: {
        total: performanceMetrics.requestCount,
        successRate: performanceMetrics.successRate,
        errorRate: performanceMetrics.errorRate
      }
    },
    topEndpoints,
    recentErrors: recentErrors.slice(-10),
    circuitBreakers: healthMonitor.getCircuitBreakerStates(),
    scheduler: schedulerService.getStatus()
  };

  const response: ApiResponse = {
    success: true,
    data: dashboardData,
    message: 'Dashboard data retrieved successfully'
  };

  res.json(response);
}));

export default router;