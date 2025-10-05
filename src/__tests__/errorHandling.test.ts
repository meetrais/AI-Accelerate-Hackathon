import request from 'supertest';
import app from '../server';
import { elasticsearchService } from '../services/elasticsearch';
import { vertexAIService } from '../services/vertexai';
import { firestoreService } from '../services/firestoreService';
import { CustomError, ValidationError, NotFoundError, ExternalServiceError } from '../middleware/errorHandler';

// Mock external services
jest.mock('../services/elasticsearch');
jest.mock('../services/vertexai');
jest.mock('../services/firestoreService');

const mockElasticsearchService = elasticsearchService as jest.Mocked<typeof elasticsearchService>;
const mockVertexAIService = vertexAIService as jest.Mocked<typeof vertexAIService>;
const mockFirestoreService = firestoreService as jest.Mocked<typeof firestoreService>;

describe('Error Handling and Fallback Mechanisms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API Error Responses', () => {
    it('should return 400 for validation errors', async () => {
      const response = await request(app)
        .post('/api/booking/create')
        .send({
          // Missing required fields
          flightId: '',
          passengers: []
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation error');
      expect(response.body.message).toContain('required');
    });

    it('should return 404 for non-existent resources', async () => {
      mockFirestoreService.getBookingByReference.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/booking/NONEXISTENT')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('NOT_FOUND');
    });

    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('NOT_FOUND');
    });

    it('should return 500 for internal server errors', async () => {
      mockElasticsearchService.searchFlights.mockRejectedValue(new Error('Database connection failed'));
      
      // Mock fallback to also fail
      jest.doMock('../services/fallbackService', () => ({
        fallbackService: {
          searchFlightsFallback: jest.fn().mockRejectedValue(new Error('Fallback also failed'))
        }
      }));

      const response = await request(app)
        .post('/api/search/flights')
        .send({
          origin: 'NYC',
          destination: 'LAX',
          departureDate: '2024-12-01',
          passengers: 1
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Service Fallback Mechanisms', () => {
    it('should use fallback when Elasticsearch is unavailable', async () => {
      mockElasticsearchService.searchFlights.mockRejectedValue(
        new ExternalServiceError('Elasticsearch')
      );

      const response = await request(app)
        .post('/api/search/flights')
        .send({
          origin: 'NYC',
          destination: 'LAX',
          departureDate: '2024-12-01',
          passengers: 1
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.flights).toBeDefined();
      // Should indicate fallback was used
      expect(response.body.data.metadata?.source).toBe('fallback');
    });

    it('should use fallback when Vertex AI is unavailable', async () => {
      mockVertexAIService.extractTravelParams.mockRejectedValue(
        new ExternalServiceError('Vertex AI')
      );

      const response = await request(app)
        .post('/api/nlp/query')
        .send({
          userMessage: 'I need a flight from NYC to LA',
          sessionId: 'session123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.extractedParams).toBeDefined();
      // Should have lower confidence for fallback
      expect(response.body.data.confidence).toBeLessThan(0.8);
    });

    it('should handle partial service failures gracefully', async () => {
      // Elasticsearch works, Vertex AI fails
      mockElasticsearchService.searchFlights.mockResolvedValue([
        {
          id: 'flight123',
          airline: 'Test Airlines',
          flightNumber: 'TA123',
          origin: { code: 'NYC', name: 'New York', city: 'New York', country: 'US', timezone: 'EST' },
          destination: { code: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'US', timezone: 'PST' },
          departureTime: new Date('2024-12-01T10:00:00Z'),
          arrivalTime: new Date('2024-12-01T13:00:00Z'),
          duration: 360,
          stops: 0,
          price: 299,
          availableSeats: 50
        }
      ]);

      mockVertexAIService.generateConversationalResponse.mockRejectedValue(
        new ExternalServiceError('Vertex AI')
      );

      const response = await request(app)
        .post('/api/chat/message')
        .send({
          message: 'Show me flights from NYC to LA',
          sessionId: 'session123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.response).toBeDefined();
      // Should still provide a response using fallback
      expect(response.body.data.response).toContain('flight');
    });
  });

  describe('Circuit Breaker Functionality', () => {
    it('should open circuit breaker after multiple failures', async () => {
      // Simulate multiple failures
      mockElasticsearchService.searchFlights.mockRejectedValue(
        new Error('Service unavailable')
      );

      // Make multiple requests to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/search/flights')
          .send({
            origin: 'NYC',
            destination: 'LAX',
            departureDate: '2024-12-01',
            passengers: 1
          });
      }

      // Check circuit breaker status
      const healthResponse = await request(app)
        .get('/api/monitoring/health-detailed')
        .expect(200);

      expect(healthResponse.body.data.circuitBreakers.elasticsearch.state).toBe('OPEN');
    });

    it('should allow circuit breaker reset', async () => {
      const response = await request(app)
        .post('/api/monitoring/circuit-breaker/elasticsearch/reset')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reset).toBe(true);
    });
  });

  describe('Health Check Degradation', () => {
    it('should report degraded status when some services are down', async () => {
      mockElasticsearchService.healthCheck.mockResolvedValue(false);
      mockVertexAIService.healthCheck.mockResolvedValue(true);
      mockFirestoreService.healthCheck.mockResolvedValue(true);

      const response = await request(app)
        .get('/health')
        .expect(200); // Should still return 200 for degraded

      expect(response.body.data.status).toBe('degraded');
      expect(response.body.data.services.elasticsearch).toBe(false);
    });

    it('should report unhealthy status when critical services are down', async () => {
      mockElasticsearchService.healthCheck.mockResolvedValue(false);
      mockVertexAIService.healthCheck.mockResolvedValue(false);
      mockFirestoreService.healthCheck.mockResolvedValue(false);

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.data.status).toBe('unhealthy');
    });
  });

  describe('Request Timeout Handling', () => {
    it('should timeout long-running requests', async () => {
      // Mock a service that takes too long
      mockElasticsearchService.searchFlights.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 15000)) // 15 seconds
      );

      const response = await request(app)
        .post('/api/search/flights')
        .send({
          origin: 'NYC',
          destination: 'LAX',
          departureDate: '2024-12-01',
          passengers: 1
        })
        .timeout(12000) // 12 second timeout
        .expect(500);

      expect(response.body.success).toBe(false);
    }, 15000);
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit errors appropriately', async () => {
      // This would require implementing rate limiting middleware
      // For now, we'll test the error handling structure
      
      const rateLimitError = new CustomError('Rate limit exceeded', 429, true, 'RATE_LIMIT_EXCEEDED');
      
      expect(rateLimitError.statusCode).toBe(429);
      expect(rateLimitError.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Data Validation and Sanitization', () => {
    it('should reject malformed JSON', async () => {
      const response = await request(app)
        .post('/api/booking/create')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should sanitize and validate input data', async () => {
      const response = await request(app)
        .post('/api/booking/create')
        .send({
          flightId: '<script>alert("xss")</script>',
          passengers: [{
            firstName: 'John<script>',
            lastName: 'Doe',
            dateOfBirth: 'invalid-date',
            nationality: 'US'
          }],
          contactInfo: {
            email: 'not-an-email',
            phone: '123'
          },
          paymentInfo: {
            method: 'invalid-method'
          }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('Monitoring and Logging', () => {
    it('should log errors with proper context', async () => {
      mockElasticsearchService.searchFlights.mockRejectedValue(
        new Error('Test error for logging')
      );

      await request(app)
        .post('/api/search/flights')
        .send({
          origin: 'NYC',
          destination: 'LAX',
          departureDate: '2024-12-01',
          passengers: 1
        });

      // Check that error was logged
      const logsResponse = await request(app)
        .get('/api/monitoring/logs?level=error&limit=10')
        .expect(200);

      expect(logsResponse.body.data.logs.length).toBeGreaterThan(0);
      const errorLog = logsResponse.body.data.logs.find((log: any) => 
        log.message.includes('Test error for logging')
      );
      expect(errorLog).toBeDefined();
    });

    it('should track request metrics', async () => {
      mockElasticsearchService.searchFlights.mockResolvedValue([]);

      await request(app)
        .post('/api/search/flights')
        .send({
          origin: 'NYC',
          destination: 'LAX',
          departureDate: '2024-12-01',
          passengers: 1
        });

      const metricsResponse = await request(app)
        .get('/api/monitoring/requests')
        .expect(200);

      expect(metricsResponse.body.data.statistics).toBeDefined();
      expect(metricsResponse.body.data.statistics.length).toBeGreaterThan(0);
    });
  });

  describe('Recovery and Resilience', () => {
    it('should recover from temporary service failures', async () => {
      // First request fails
      mockElasticsearchService.searchFlights.mockRejectedValueOnce(
        new Error('Temporary failure')
      );

      const failedResponse = await request(app)
        .post('/api/search/flights')
        .send({
          origin: 'NYC',
          destination: 'LAX',
          departureDate: '2024-12-01',
          passengers: 1
        })
        .expect(200); // Should still work with fallback

      expect(failedResponse.body.success).toBe(true);

      // Second request succeeds
      mockElasticsearchService.searchFlights.mockResolvedValue([
        {
          id: 'flight123',
          airline: 'Test Airlines',
          flightNumber: 'TA123',
          origin: { code: 'NYC', name: 'New York', city: 'New York', country: 'US', timezone: 'EST' },
          destination: { code: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'US', timezone: 'PST' },
          departureTime: new Date('2024-12-01T10:00:00Z'),
          arrivalTime: new Date('2024-12-01T13:00:00Z'),
          duration: 360,
          stops: 0,
          price: 299,
          availableSeats: 50
        }
      ]);

      const successResponse = await request(app)
        .post('/api/search/flights')
        .send({
          origin: 'NYC',
          destination: 'LAX',
          departureDate: '2024-12-01',
          passengers: 1
        })
        .expect(200);

      expect(successResponse.body.success).toBe(true);
      expect(successResponse.body.data.flights).toHaveLength(1);
    });
  });
});