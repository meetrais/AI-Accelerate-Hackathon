import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import { config } from './config';
import { ApiResponse, HealthCheckResponse } from './types';
// Services are imported by routes as needed
import { schedulerService } from './services/schedulerService';
import { healthMonitor } from './services/healthMonitor';
import { monitoringService } from './services/monitoringService';
import { errorHandler, notFoundHandler, asyncHandler } from './middleware/errorHandler';

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for React app
  crossOriginEmbedderPolicy: false
}));
app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Increase header size limit
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 seconds timeout
  next();
});

// Request logging and monitoring
app.use(monitoringService.createRequestLogger());

// Simple health check endpoint
app.get('/ping', (req: express.Request, res: express.Response) => {
  console.log('Ping request received from:', req.get('origin') || req.get('referer') || 'unknown');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Health check endpoint
app.get('/health', asyncHandler(async (req: express.Request, res: express.Response) => {
  const systemHealth = await healthMonitor.checkSystemHealth();
  
  const healthResponse: HealthCheckResponse = {
    status: systemHealth.overall,
    timestamp: systemHealth.timestamp.toISOString(),
    services: systemHealth.services.reduce((acc, service) => {
      acc[service.name] = service.status === 'healthy';
      return acc;
    }, {} as any),
    uptime: systemHealth.uptime,
    details: systemHealth.services
  };

  const response: ApiResponse<HealthCheckResponse> = {
    success: true,
    data: healthResponse,
    message: systemHealth.overall === 'healthy' ? 'Service is healthy' : 'Some services are degraded or unhealthy'
  };

  const statusCode = systemHealth.overall === 'healthy' ? 200 : 
                    systemHealth.overall === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json(response);
}));

// Import routes
import searchRoutes from './routes/search';
import nlpRoutes from './routes/nlp';
import chatRoutes from './routes/chat';
import bookingRoutes from './routes/booking';
import paymentRoutes from './routes/payment';
import travelUpdateRoutes from './routes/travelUpdates';
import monitoringRoutes from './routes/monitoring';
import genaiRoutes from './routes/genai';

// API routes
app.use('/api/search', searchRoutes);
app.use('/api/nlp', nlpRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/travel-updates', travelUpdateRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/genai', genaiRoutes);

// AP2 Payment Protocol routes
import ap2Routes from './routes/ap2';
app.use('/api/ap2', ap2Routes);

// Catch-all for unimplemented API routes
app.use('/api/*', (req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Serve static frontend files in production
if (config.nodeEnv === 'production') {
  const frontendPath = path.join(__dirname, '../frontend/build');
  app.use(express.static(frontendPath));
  
  // Serve index.html for all non-API routes (SPA support)
  app.get('*', (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  // 404 handler for development (frontend runs separately)
  app.use('*', (req: express.Request, res: express.Response) => {
    const response: ApiResponse = {
      success: false,
      error: 'Not found',
      message: `Route ${req.originalUrl} not found. In development, frontend runs on port 3001.`
    };

    res.status(404).json(response);
  });
}

// Error handling middleware
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  const response: ApiResponse = {
    success: false,
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? error.message : 'Something went wrong'
  };

  res.status(500).json(response);
});

// Create server with increased header size limit
const server = http.createServer({
  maxHeaderSize: 32768 // 32KB instead of default 8KB
}, app);

server.listen(config.port, () => {
  console.log(`🚀 Flight Booking Assistant API running on port ${config.port}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
  console.log(`🔗 Health check: http://localhost:${config.port}/health`);
  
  // Start background scheduler for travel updates
  schedulerService.start();
  
  // Start monitoring cleanup
  monitoringService.startCleanup(60, 24); // Clean every hour, keep 24 hours
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  schedulerService.stop();
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  schedulerService.stop();
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// Note: Error handling middleware is already defined above

export default app;