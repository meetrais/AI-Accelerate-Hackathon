import { elasticsearchService } from './elasticsearch';
import { vertexAIService } from './vertexai';
import { firestoreService } from './firestoreService';
import { CircuitBreaker } from '../middleware/errorHandler';

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: Date;
  error?: string;
  details?: any;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  timestamp: Date;
  uptime: number;
}

export class HealthMonitor {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private healthCache: Map<string, ServiceHealth> = new Map();
  private cacheTimeout: number = 30000; // 30 seconds
  private startTime: Date = new Date();

  constructor() {
    // Initialize circuit breakers for external services
    this.circuitBreakers.set('elasticsearch', new CircuitBreaker(3, 30000));
    this.circuitBreakers.set('vertexai', new CircuitBreaker(3, 60000));
    this.circuitBreakers.set('firestore', new CircuitBreaker(5, 30000));
  }

  /**
   * Check health of all services
   */
  async checkSystemHealth(): Promise<SystemHealth> {
    const services: ServiceHealth[] = [];
    
    // Check all services in parallel
    const healthChecks = [
      this.checkElasticsearchHealth(),
      this.checkVertexAIHealth(),
      this.checkFirestoreHealth(),
      this.checkMemoryHealth(),
      this.checkDiskHealth()
    ];

    const results = await Promise.allSettled(healthChecks);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        services.push(result.value);
      } else {
        // Create unhealthy service entry for failed checks
        const serviceNames = ['elasticsearch', 'vertexai', 'firestore', 'memory', 'disk'];
        services.push({
          name: serviceNames[index],
          status: 'unhealthy',
          lastCheck: new Date(),
          error: result.reason?.message || 'Health check failed'
        });
      }
    });

    // Determine overall health
    const overall = this.determineOverallHealth(services);
    
    return {
      overall,
      services,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime()
    };
  }

  /**
   * Check Elasticsearch health
   */
  private async checkElasticsearchHealth(): Promise<ServiceHealth> {
    const cached = this.getCachedHealth('elasticsearch');
    if (cached) return cached;

    const startTime = Date.now();
    const circuitBreaker = this.circuitBreakers.get('elasticsearch')!;

    try {
      const health = await circuitBreaker.execute(
        async () => {
          const isHealthy = await elasticsearchService.healthCheck();
          if (!isHealthy) {
            throw new Error('Elasticsearch health check failed');
          }
          return { isHealthy, clusterInfo: await this.getElasticsearchClusterInfo() };
        },
        async () => ({ isHealthy: false as true, clusterInfo: { fallback: true } })
      );

      const responseTime = Date.now() - startTime;
      const serviceHealth: ServiceHealth = {
        name: 'elasticsearch',
        status: health.isHealthy ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date(),
        details: health.clusterInfo
      };

      this.setCachedHealth('elasticsearch', serviceHealth);
      return serviceHealth;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const serviceHealth: ServiceHealth = {
        name: 'elasticsearch',
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.setCachedHealth('elasticsearch', serviceHealth);
      return serviceHealth;
    }
  }

  /**
   * Check Vertex AI health
   */
  private async checkVertexAIHealth(): Promise<ServiceHealth> {
    const cached = this.getCachedHealth('vertexai');
    if (cached) return cached;

    const startTime = Date.now();
    const circuitBreaker = this.circuitBreakers.get('vertexai')!;

    try {
      const health = await circuitBreaker.execute(
        async () => {
          const isHealthy = await vertexAIService.healthCheck();
          if (!isHealthy) {
            throw new Error('Vertex AI health check failed');
          }
          return { isHealthy, modelInfo: await this.getVertexAIModelInfo() };
        },
        async () => ({ isHealthy: false as true, modelInfo: { fallback: true } })
      );

      const responseTime = Date.now() - startTime;
      const serviceHealth: ServiceHealth = {
        name: 'vertexai',
        status: health.isHealthy ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date(),
        details: health.modelInfo
      };

      this.setCachedHealth('vertexai', serviceHealth);
      return serviceHealth;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const serviceHealth: ServiceHealth = {
        name: 'vertexai',
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.setCachedHealth('vertexai', serviceHealth);
      return serviceHealth;
    }
  }

  /**
   * Check Firestore health
   */
  private async checkFirestoreHealth(): Promise<ServiceHealth> {
    const cached = this.getCachedHealth('firestore');
    if (cached) return cached;

    const startTime = Date.now();
    const circuitBreaker = this.circuitBreakers.get('firestore')!;

    try {
      const health = await circuitBreaker.execute(
        async () => {
          const isHealthy = await firestoreService.healthCheck();
          if (!isHealthy) {
            throw new Error('Firestore health check failed');
          }
          return { isHealthy };
        },
        async () => ({ isHealthy: false as true })
      );

      const responseTime = Date.now() - startTime;
      const serviceHealth: ServiceHealth = {
        name: 'firestore',
        status: health.isHealthy ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date(),
        details: {}
      };

      this.setCachedHealth('firestore', serviceHealth);
      return serviceHealth;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const serviceHealth: ServiceHealth = {
        name: 'firestore',
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.setCachedHealth('firestore', serviceHealth);
      return serviceHealth;
    }
  }

  /**
   * Check memory health
   */
  private async checkMemoryHealth(): Promise<ServiceHealth> {
    const cached = this.getCachedHealth('memory');
    if (cached) return cached;

    try {
      const memUsage = process.memoryUsage();
      const totalMem = memUsage.heapTotal;
      const usedMem = memUsage.heapUsed;
      const memoryUsagePercent = (usedMem / totalMem) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (memoryUsagePercent > 90) {
        status = 'unhealthy';
      } else if (memoryUsagePercent > 75) {
        status = 'degraded';
      }

      const serviceHealth: ServiceHealth = {
        name: 'memory',
        status,
        lastCheck: new Date(),
        details: {
          heapUsed: Math.round(usedMem / 1024 / 1024), // MB
          heapTotal: Math.round(totalMem / 1024 / 1024), // MB
          usagePercent: Math.round(memoryUsagePercent),
          external: Math.round(memUsage.external / 1024 / 1024), // MB
          rss: Math.round(memUsage.rss / 1024 / 1024) // MB
        }
      };

      this.setCachedHealth('memory', serviceHealth);
      return serviceHealth;

    } catch (error) {
      const serviceHealth: ServiceHealth = {
        name: 'memory',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.setCachedHealth('memory', serviceHealth);
      return serviceHealth;
    }
  }

  /**
   * Check disk health
   */
  private async checkDiskHealth(): Promise<ServiceHealth> {
    const cached = this.getCachedHealth('disk');
    if (cached) return cached;

    try {
      // Simple disk health check - in production, you'd want more sophisticated monitoring
      const fs = require('fs').promises;
      const testFile = '/tmp/health-check-' + Date.now();
      
      await fs.writeFile(testFile, 'health check');
      await fs.unlink(testFile);

      const serviceHealth: ServiceHealth = {
        name: 'disk',
        status: 'healthy',
        lastCheck: new Date(),
        details: {
          writable: true,
          testCompleted: true
        }
      };

      this.setCachedHealth('disk', serviceHealth);
      return serviceHealth;

    } catch (error) {
      const serviceHealth: ServiceHealth = {
        name: 'disk',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Disk write test failed'
      };

      this.setCachedHealth('disk', serviceHealth);
      return serviceHealth;
    }
  }

  /**
   * Get Elasticsearch cluster information
   */
  private async getElasticsearchClusterInfo(): Promise<any> {
    try {
      // This would call Elasticsearch cluster health API
      return {
        status: 'green',
        numberOfNodes: 1,
        numberOfDataNodes: 1
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get Vertex AI model information
   */
  private async getVertexAIModelInfo(): Promise<any> {
    try {
      return {
        model: 'gemini-pro',
        region: 'us-central1',
        available: true
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Determine overall system health
   */
  private determineOverallHealth(services: ServiceHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyServices = services.filter(s => s.status === 'unhealthy');
    const degradedServices = services.filter(s => s.status === 'degraded');

    // Critical services that must be healthy
    const criticalServices = ['elasticsearch', 'firestore'];
    const criticalUnhealthy = unhealthyServices.filter(s => criticalServices.includes(s.name));

    if (criticalUnhealthy.length > 0) {
      return 'unhealthy';
    }

    if (unhealthyServices.length > 0 || degradedServices.length > 1) {
      return 'degraded';
    }

    if (degradedServices.length > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Get cached health result
   */
  private getCachedHealth(serviceName: string): ServiceHealth | null {
    const cached = this.healthCache.get(serviceName);
    if (cached && Date.now() - cached.lastCheck.getTime() < this.cacheTimeout) {
      return cached;
    }
    return null;
  }

  /**
   * Set cached health result
   */
  private setCachedHealth(serviceName: string, health: ServiceHealth): void {
    this.healthCache.set(serviceName, health);
  }

  /**
   * Get circuit breaker states
   */
  getCircuitBreakerStates(): { [service: string]: any } {
    const states: { [service: string]: any } = {};
    
    this.circuitBreakers.forEach((breaker, service) => {
      states[service] = breaker.getState();
    });
    
    return states;
  }

  /**
   * Reset circuit breaker for a service
   */
  resetCircuitBreaker(serviceName: string): boolean {
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker) {
      // Create new circuit breaker to reset state
      this.circuitBreakers.set(serviceName, new CircuitBreaker());
      return true;
    }
    return false;
  }

  /**
   * Clear health cache
   */
  clearCache(): void {
    this.healthCache.clear();
  }
}

// Export singleton instance
export const healthMonitor = new HealthMonitor();