# Error Handling & Monitoring System

This document describes the comprehensive error handling, monitoring, and resilience features implemented in Task 10.

## Overview

The system implements a multi-layered approach to error handling and monitoring:

1. **Centralized Error Handling** - Consistent error responses across all endpoints
2. **Service Fallbacks** - Graceful degradation when external services fail
3. **Circuit Breakers** - Prevent cascading failures and enable recovery
4. **Health Monitoring** - Real-time service health tracking
5. **Request Monitoring** - Performance metrics and logging
6. **Comprehensive Testing** - Integration tests for error scenarios

## Error Handling Architecture

### Custom Error Classes

```typescript
// Base error class with operational flag
class CustomError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
}

// Specific error types
class ValidationError extends CustomError        // 400 - Bad Request
class NotFoundError extends CustomError          // 404 - Not Found
class ConflictError extends CustomError          // 409 - Conflict
class ExternalServiceError extends CustomError   // 503 - Service Unavailable
class RateLimitError extends CustomError         // 429 - Too Many Requests
class AuthenticationError extends CustomError    // 401 - Unauthorized
class AuthorizationError extends CustomError     // 403 - Forbidden
```

### Error Handler Middleware

The global error handler provides:
- **Structured error responses** with consistent format
- **Security-aware error exposure** (details hidden in production)
- **Comprehensive logging** with request context
- **HTTP status code mapping** based on error type

```typescript
interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  data?: any;
}
```

### Async Error Wrapper

All route handlers are wrapped with `asyncHandler` to automatically catch and forward async errors:

```typescript
app.get('/api/endpoint', asyncHandler(async (req, res) => {
  // Async operations that might throw
  const result = await someAsyncOperation();
  res.json({ success: true, data: result });
}));
```

## Service Fallback System

### Fallback Service

When external services fail, the system automatically falls back to local alternatives:

#### Elasticsearch Fallbacks
- **Flight Search**: Uses mock flight data with basic filtering
- **Flight Lookup**: Searches local mock data by ID
- **Airport Suggestions**: Returns common airport codes

#### Vertex AI Fallbacks
- **Natural Language Processing**: Keyword-based parameter extraction
- **Conversational Responses**: Template-based response generation
- **Flight Recommendations**: Rule-based recommendation logic

### Implementation Example

```typescript
async searchFlights(request: FlightSearchRequest): Promise<FlightResult[]> {
  try {
    return await elasticsearchService.searchFlights(request);
  } catch (error) {
    console.warn('🔄 Falling back to local search');
    const fallbackResult = await fallbackService.searchFlightsFallback(request);
    return fallbackResult.flights;
  }
}
```

## Circuit Breaker Pattern

### Circuit Breaker States
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Service is failing, requests use fallback immediately
- **HALF_OPEN**: Testing if service has recovered

### Configuration
```typescript
const circuitBreaker = new CircuitBreaker(
  failureThreshold: 5,     // Open after 5 failures
  recoveryTimeout: 60000   // Test recovery after 1 minute
);
```

### Usage
```typescript
const result = await circuitBreaker.execute(
  async () => await externalService.call(),
  async () => await fallbackService.call() // Optional fallback
);
```

## Health Monitoring System

### Service Health Checks

The health monitor continuously checks:
- **Elasticsearch**: Cluster health and connectivity
- **Vertex AI**: Model availability and response time
- **Firestore**: Database connectivity and write capability
- **Memory**: Heap usage and memory pressure
- **Disk**: Write capability and storage health

### Health Status Levels
- **Healthy**: All services operational
- **Degraded**: Some services down but core functionality available
- **Unhealthy**: Critical services down, limited functionality

### Health Endpoints

```bash
GET /health                           # Basic health check
GET /api/monitoring/health-detailed   # Detailed health with circuit breakers
GET /api/monitoring/dashboard         # Complete dashboard data
```

## Request Monitoring & Metrics

### Automatic Request Logging

Every request is automatically logged with:
- **Request details**: Method, path, headers, body size
- **Response details**: Status code, response time, body size
- **User context**: User ID, session ID (when available)
- **Performance metrics**: Duration, memory usage

### Performance Metrics

The system tracks:
- **Request count** per endpoint
- **Average response time** per endpoint
- **Error rate** per endpoint
- **Memory usage** over time
- **System uptime** and availability

### Monitoring Endpoints

```bash
GET /api/monitoring/metrics     # Performance metrics summary
GET /api/monitoring/logs        # Recent system logs
GET /api/monitoring/requests    # Request statistics by endpoint
GET /api/monitoring/export      # Export all monitoring data
```

## Retry Mechanisms

### Exponential Backoff

For transient failures, the system implements retry with exponential backoff:

```typescript
await retryWithBackoff(
  async () => await unreliableOperation(),
  maxRetries: 3,
  baseDelay: 1000,    // Start with 1 second
  maxDelay: 10000     // Cap at 10 seconds
);
```

### Retry Strategy
- **Attempt 1**: Immediate
- **Attempt 2**: 1-2 seconds delay
- **Attempt 3**: 2-4 seconds delay
- **Attempt 4**: 4-8 seconds delay (with jitter)

## Error Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid input parameters"
}
```

### Development Error Response
```json
{
  "success": false,
  "error": "INTERNAL_ERROR",
  "message": "Database connection failed",
  "stack": "Error: Connection timeout\n    at ..."
}
```

## Monitoring Dashboard

### Key Metrics Displayed
- **System Status**: Overall health indicator
- **Service Availability**: Individual service status
- **Request Volume**: Requests per minute/hour
- **Response Times**: Average and percentile response times
- **Error Rates**: Error percentage by endpoint
- **Memory Usage**: Heap usage and trends
- **Circuit Breaker States**: Current breaker status

### Dashboard Endpoint
```bash
GET /api/monitoring/dashboard
```

Returns comprehensive dashboard data including:
- Overview metrics
- Service health details
- Performance statistics
- Top endpoints by usage
- Recent errors
- Circuit breaker states
- Scheduler status

## Testing Strategy

### Error Scenario Testing

Comprehensive tests cover:
- **Service failures** and fallback activation
- **Circuit breaker** opening and recovery
- **Validation errors** and proper responses
- **Timeout handling** for long-running operations
- **Rate limiting** and throttling
- **Malformed requests** and input sanitization

### Integration Testing

End-to-end tests verify:
- **Complete booking workflows** with service failures
- **Conversational flows** with AI service degradation
- **Health check responses** under various conditions
- **Monitoring data collection** and export

### Load Testing Considerations

The system is designed to handle:
- **High request volumes** with proper queuing
- **Service degradation** under load
- **Memory pressure** with automatic cleanup
- **Circuit breaker activation** under sustained failures

## Configuration

### Environment Variables
```bash
NODE_ENV=production                    # Environment mode
LOG_LEVEL=info                        # Logging level
CIRCUIT_BREAKER_THRESHOLD=5           # Failure threshold
CIRCUIT_BREAKER_TIMEOUT=60000         # Recovery timeout
MONITORING_RETENTION_HOURS=24         # Data retention
MONITORING_CLEANUP_INTERVAL=60        # Cleanup interval (minutes)
```

### Monitoring Configuration
```typescript
const monitoringConfig = {
  maxLogEntries: 10000,      // Maximum log entries in memory
  maxMetrics: 50000,         // Maximum metrics in memory
  cacheTimeout: 30000,       // Health check cache timeout
  retentionHours: 24,        // Data retention period
  cleanupInterval: 60        // Cleanup interval in minutes
};
```

## Production Deployment

### Health Check Integration
- **Load balancer** health checks use `/health` endpoint
- **Container orchestration** uses health status for scaling
- **Monitoring systems** consume `/api/monitoring/export` data

### Alerting Integration
- **Error rate thresholds** trigger alerts
- **Service degradation** notifications
- **Circuit breaker** state change alerts
- **Memory usage** warnings

### Log Aggregation
- **Structured logging** for easy parsing
- **Request correlation IDs** for tracing
- **Error context** with stack traces
- **Performance metrics** for analysis

## Best Practices

### Error Handling
1. **Always use asyncHandler** for async route handlers
2. **Throw specific error types** rather than generic errors
3. **Include context** in error messages
4. **Log errors** with appropriate detail level
5. **Use fallbacks** for non-critical failures

### Monitoring
1. **Monitor key business metrics** not just technical metrics
2. **Set up alerts** for critical thresholds
3. **Regular health check** endpoint testing
4. **Monitor circuit breaker** states and recovery
5. **Track user experience** metrics

### Testing
1. **Test error scenarios** as thoroughly as success scenarios
2. **Verify fallback behavior** under service failures
3. **Load test** with realistic failure rates
4. **Monitor test coverage** for error paths
5. **Test recovery scenarios** after failures

## Troubleshooting Guide

### Common Issues

#### High Error Rate
1. Check service health status
2. Review circuit breaker states
3. Examine recent error logs
4. Verify external service connectivity

#### Slow Response Times
1. Check memory usage trends
2. Review database connection pool
3. Examine circuit breaker activation
4. Analyze request patterns

#### Service Degradation
1. Verify individual service health
2. Check fallback activation
3. Review resource utilization
4. Examine error patterns

### Diagnostic Commands
```bash
# Check overall system health
curl /health

# Get detailed health information
curl /api/monitoring/health-detailed

# Export recent monitoring data
curl /api/monitoring/export?since=2024-01-01T00:00:00Z

# Reset circuit breaker
curl -X POST /api/monitoring/circuit-breaker/elasticsearch/reset
```

This comprehensive error handling and monitoring system ensures the flight booking assistant remains resilient, observable, and maintainable in production environments.