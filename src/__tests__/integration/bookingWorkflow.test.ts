import request from 'supertest';
import app from '../../server';
import { elasticsearchService } from '../../services/elasticsearch';
import { firestoreService } from '../../services/firestoreService';
import { vertexAIService } from '../../services/vertexai';

// Mock external services for integration tests
jest.mock('../../services/elasticsearch');
jest.mock('../../services/firestoreService');
jest.mock('../../services/vertexai');

const mockElasticsearchService = elasticsearchService as jest.Mocked<typeof elasticsearchService>;
const mockFirestoreService = firestoreService as jest.Mocked<typeof firestoreService>;
const mockVertexAIService = vertexAIService as jest.Mocked<typeof vertexAIService>;

describe('Complete Booking Workflow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockElasticsearchService.healthCheck.mockResolvedValue(true);
    mockFirestoreService.healthCheck.mockResolvedValue(true);
    mockVertexAIService.healthCheck.mockResolvedValue(true);
  });

  describe('End-to-End Booking Flow', () => {
    it('should complete a full booking workflow from search to confirmation', async () => {
      // Mock flight search results
      const mockFlights = [
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
      ];

      mockElasticsearchService.searchFlights.mockResolvedValue(mockFlights);
      mockElasticsearchService.getFlightById.mockResolvedValue({
        id: 'flight123',
        airline: 'Test Airlines',
        flightNumber: 'TA123',
        origin: { code: 'NYC', name: 'New York', city: 'New York', country: 'US', timezone: 'EST' },
        destination: { code: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'US', timezone: 'PST' },
        departureTime: new Date('2024-12-01T10:00:00Z'),
        arrivalTime: new Date('2024-12-01T13:00:00Z'),
        duration: 360,
        stops: [],
        price: { amount: 299, currency: 'USD', taxes: 50, fees: 25 },
        availability: { economy: 50, business: 10, first: 2 },
        aircraft: 'Boeing 737',
        gate: 'A1'
      });

      mockFirestoreService.createBooking.mockResolvedValue('booking123');
      mockFirestoreService.getBookingByReference.mockResolvedValue({
        id: 'booking123',
        bookingReference: 'FB123456',
        userId: 'user123',
        status: 'confirmed',
        flights: [mockFlights[0]],
        passengers: [{
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: new Date('1990-01-01'),
          nationality: 'US'
        }],
        contactInfo: {
          email: 'john@example.com',
          phone: '+1234567890'
        },
        totalPrice: 374,
        paymentStatus: 'paid',
        createdAt: new Date(),
        travelDate: new Date('2024-12-01T10:00:00Z')
      });

      // Step 1: Search for flights
      const searchResponse = await request(app)
        .post('/api/search/flights')
        .send({
          origin: 'NYC',
          destination: 'LAX',
          departureDate: '2024-12-01',
          passengers: 1
        })
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(searchResponse.body.data.flights).toHaveLength(1);
      expect(searchResponse.body.data.flights[0].id).toBe('flight123');

      // Step 2: Create booking
      const bookingResponse = await request(app)
        .post('/api/booking/create')
        .send({
          flightId: 'flight123',
          passengers: [{
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            nationality: 'US'
          }],
          contactInfo: {
            email: 'john@example.com',
            phone: '+1234567890'
          },
          paymentInfo: {
            method: 'card',
            cardToken: 'tok_visa'
          }
        })
        .expect(201);

      expect(bookingResponse.body.success).toBe(true);
      expect(bookingResponse.body.data.bookingReference).toBeDefined();
      expect(bookingResponse.body.data.status).toBe('confirmed');

      // Step 3: Retrieve booking confirmation
      const bookingReference = bookingResponse.body.data.bookingReference;
      const confirmationResponse = await request(app)
        .get(`/api/booking/${bookingReference}`)
        .expect(200);

      expect(confirmationResponse.body.success).toBe(true);
      expect(confirmationResponse.body.data.bookingReference).toBe(bookingReference);
      expect(confirmationResponse.body.data.status).toBe('confirmed');
    });

    it('should handle booking validation errors gracefully', async () => {
      const invalidBookingRequest = {
        flightId: 'flight123',
        passengers: [], // Invalid: no passengers
        contactInfo: {
          email: 'invalid-email', // Invalid email format
          phone: '123' // Invalid phone format
        },
        paymentInfo: {
          method: 'card'
          // Missing cardToken
        }
      };

      const response = await request(app)
        .post('/api/booking/create')
        .send(invalidBookingRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation error');
      expect(response.body.message).toContain('passengers');
    });

    it('should handle payment failures during booking', async () => {
      // Mock flight exists but payment fails
      mockElasticsearchService.getFlightById.mockResolvedValue({
        id: 'flight123',
        airline: 'Test Airlines',
        flightNumber: 'TA123',
        origin: { code: 'NYC', name: 'New York', city: 'New York', country: 'US', timezone: 'EST' },
        destination: { code: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'US', timezone: 'PST' },
        departureTime: new Date('2024-12-01T10:00:00Z'),
        arrivalTime: new Date('2024-12-01T13:00:00Z'),
        duration: 360,
        stops: [],
        price: { amount: 299, currency: 'USD', taxes: 50, fees: 25 },
        availability: { economy: 50, business: 10, first: 2 },
        aircraft: 'Boeing 737',
        gate: 'A1'
      });

      // Mock payment service to fail
      jest.doMock('../../services/paymentService', () => ({
        paymentService: {
          processPayment: jest.fn().mockResolvedValue({
            success: false,
            errorMessage: 'Payment declined'
          })
        }
      }));

      const bookingRequest = {
        flightId: 'flight123',
        passengers: [{
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          nationality: 'US'
        }],
        contactInfo: {
          email: 'john@example.com',
          phone: '+1234567890'
        },
        paymentInfo: {
          method: 'card',
          cardToken: 'tok_declined'
        }
      };

      const response = await request(app)
        .post('/api/booking/create')
        .send(bookingRequest)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Payment failed');
    });
  });

  describe('Conversational Booking Flow', () => {
    it('should handle natural language flight search and booking', async () => {
      // Mock NLP extraction
      mockVertexAIService.extractTravelParams.mockResolvedValue({
        origin: 'NYC',
        destination: 'LAX',
        departureDate: new Date('2024-12-01'),
        passengers: 1,
        flexibility: 'exact'
      });

      // Mock flight search
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

      // Mock conversational response
      mockVertexAIService.generateConversationalResponse.mockResolvedValue(
        'I found 1 flight from New York to Los Angeles on December 1st. The flight is with Test Airlines (TA123) departing at 10:00 AM for $299. Would you like to book this flight?'
      );

      // Step 1: Natural language query
      const chatResponse = await request(app)
        .post('/api/chat/message')
        .send({
          message: 'I need a flight from NYC to LA on December 1st',
          sessionId: 'session123'
        })
        .expect(200);

      expect(chatResponse.body.success).toBe(true);
      expect(chatResponse.body.data.response).toContain('Test Airlines');
      expect(chatResponse.body.data.flightOptions).toHaveLength(1);

      // Step 2: Quick search with natural language
      const quickSearchResponse = await request(app)
        .post('/api/chat/quick-search')
        .send({
          query: 'Show me flights from New York to Los Angeles tomorrow',
          sessionId: 'session123'
        })
        .expect(200);

      expect(quickSearchResponse.body.success).toBe(true);
      expect(quickSearchResponse.body.data.flightOptions).toBeDefined();
    });

    it('should handle conversation context and follow-up questions', async () => {
      // Mock conversation with context
      mockVertexAIService.generateConversationalResponse.mockResolvedValue(
        'Based on your previous search, I can help you with that flight to Los Angeles. Would you like me to check for different dates or airlines?'
      );

      const response = await request(app)
        .post('/api/chat/message')
        .send({
          message: 'What about different airlines?',
          sessionId: 'session123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.response).toContain('Los Angeles');
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should use fallback when Elasticsearch is unavailable', async () => {
      // Mock Elasticsearch failure
      mockElasticsearchService.searchFlights.mockRejectedValue(new Error('Elasticsearch connection failed'));

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
      // Should still return results from fallback service
      expect(response.body.data.flights).toBeDefined();
    });

    it('should use fallback when Vertex AI is unavailable', async () => {
      // Mock Vertex AI failure
      mockVertexAIService.extractTravelParams.mockRejectedValue(new Error('Vertex AI unavailable'));

      const response = await request(app)
        .post('/api/nlp/query')
        .send({
          userMessage: 'I need a flight from NYC to LA',
          sessionId: 'session123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should still extract basic parameters using fallback
      expect(response.body.data.extractedParams).toBeDefined();
    });

    it('should handle service degradation gracefully', async () => {
      // Mock partial service failure
      mockElasticsearchService.healthCheck.mockResolvedValue(false);
      mockVertexAIService.healthCheck.mockResolvedValue(true);
      mockFirestoreService.healthCheck.mockResolvedValue(true);

      const response = await request(app)
        .get('/health')
        .expect(200); // Should still return 200 for degraded service

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('degraded');
    });

    it('should return 503 when critical services are down', async () => {
      // Mock critical service failures
      mockElasticsearchService.healthCheck.mockResolvedValue(false);
      mockFirestoreService.healthCheck.mockResolvedValue(false);
      mockVertexAIService.healthCheck.mockResolvedValue(false);

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('unhealthy');
    });
  });

  describe('Travel Updates Integration', () => {
    it('should process flight changes and send notifications', async () => {
      // Mock booking with flight change
      const mockBooking = {
        id: 'booking123',
        bookingReference: 'FB123456',
        userId: 'user123',
        status: 'confirmed',
        flights: [{
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
        }],
        passengers: [{
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: new Date('1990-01-01'),
          nationality: 'US'
        }],
        contactInfo: {
          email: 'john@example.com',
          phone: '+1234567890'
        },
        totalPrice: 374,
        paymentStatus: 'paid',
        createdAt: new Date(),
        travelDate: new Date('2024-12-01T10:00:00Z')
      };

      mockFirestoreService.getAllBookings.mockResolvedValue([mockBooking]);
      mockFirestoreService.createFlightChange.mockResolvedValue('change123');
      mockFirestoreService.updateBooking.mockResolvedValue();
      mockFirestoreService.updateFlightChangeNotificationStatus.mockResolvedValue();

      // Trigger flight monitoring
      const response = await request(app)
        .post('/api/travel-updates/monitor-flights')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('completed successfully');
    });

    it('should handle rebooking requests', async () => {
      const mockOriginalBooking = {
        id: 'booking123',
        bookingReference: 'FB123456',
        userId: 'user123',
        status: 'confirmed',
        flights: [{
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
        }],
        passengers: [{
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: new Date('1990-01-01'),
          nationality: 'US'
        }],
        contactInfo: {
          email: 'john@example.com',
          phone: '+1234567890'
        },
        totalPrice: 374,
        paymentStatus: 'paid',
        createdAt: new Date(),
        travelDate: new Date('2024-12-01T10:00:00Z')
      };

      const mockNewFlight = {
        ...mockOriginalBooking.flights[0],
        id: 'flight456',
        flightNumber: 'TA456',
        departureTime: new Date('2024-12-01T14:00:00Z'),
        arrivalTime: new Date('2024-12-01T17:00:00Z'),
        price: { amount: 350, currency: 'USD', taxes: 50, fees: 25 }
      };

      mockFirestoreService.getBooking.mockResolvedValue(mockOriginalBooking);
      mockElasticsearchService.getFlightById.mockResolvedValue(mockNewFlight);
      mockFirestoreService.createBooking.mockResolvedValue('booking456');
      mockFirestoreService.updateBookingStatus.mockResolvedValue();

      const response = await request(app)
        .post('/api/booking/booking123/rebook')
        .send({
          newFlightId: 'flight456',
          reason: 'Original flight cancelled'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.priceDifference).toBeDefined();
    });
  });
});