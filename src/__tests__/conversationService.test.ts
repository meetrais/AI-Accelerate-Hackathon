import { ConversationService } from '../services/conversationService';

// Mock dependencies
jest.mock('../services/vertexai');
jest.mock('../services/sessionManager');
jest.mock('../services/hybridSearch');
jest.mock('../services/flightRecommendation');
jest.mock('../services/elasticsearch');
jest.mock('../services/nlpService');

const mockVertexAI = {
  generateConversationalResponse: jest.fn(),
  generateTravelAdvice: jest.fn()
};

const mockSessionManager = {
  getOrCreateSession: jest.fn(),
  getSession: jest.fn(),
  setSelectedFlight: jest.fn(),
  getConversationContext: jest.fn(),
  addMessage: jest.fn()
};

const mockFlightRecommendation = {
  generateRecommendations: jest.fn(),
  compareFlights: jest.fn()
};

const mockNlpService = {
  processTravelQuery: jest.fn()
};

describe('ConversationService', () => {
  let conversationService: ConversationService;

  beforeEach(() => {
    conversationService = new ConversationService();
    jest.clearAllMocks();
  });

  describe('handleConversation', () => {
    it('should handle flight search intent', async () => {
      // Mock intent analysis to return flight search
      const mockAnalyzeIntent = jest.spyOn(conversationService as any, 'analyzeIntent')
        .mockResolvedValue({
          type: 'flight_search',
          confidence: 0.9,
          entities: {}
        });

      // Mock session
      mockSessionManager.getOrCreateSession.mockReturnValue({
        sessionId: 'test-session',
        conversationHistory: []
      });

      // Mock NLP service response
      mockNlpService.processTravelQuery.mockResolvedValue({
        params: {
          origin: 'JFK',
          destination: 'LAX',
          departureDate: new Date('2024-01-15'),
          passengers: 1
        },
        searchResults: [
          {
            id: 'FL1001',
            airline: 'American Airlines',
            flightNumber: 'AA1234',
            price: 350,
            duration: 360,
            stops: 0
          }
        ],
        response: 'I found some flights for you!'
      });

      // Mock recommendations
      mockFlightRecommendation.generateRecommendations.mockResolvedValue({
        primary: {
          flight: {
            id: 'FL1001',
            airline: 'American Airlines',
            flightNumber: 'AA1234',
            price: 350
          },
          reasons: ['Best value for money']
        },
        alternatives: [],
        insights: ['Great pricing for this route'],
        tips: ['Book soon for best rates']
      });

      const request = {
        message: 'I want to fly from New York to Los Angeles tomorrow',
        sessionId: 'test-session'
      };

      const result = await conversationService.handleConversation(request);

      expect(result.message).toContain('Great!');
      expect(result.flightOptions).toHaveLength(1);
      expect(result.suggestedActions).toContain('Select a flight');
      expect(result.bookingStep).toBe('flight_selection');
    });

    it('should handle flight selection intent', async () => {
      // Mock intent analysis
      jest.spyOn(conversationService as any, 'analyzeIntent')
        .mockResolvedValue({
          type: 'flight_selection',
          confidence: 0.9,
          entities: {}
        });

      // Mock session with search results
      mockSessionManager.getSession.mockReturnValue({
        sessionId: 'test-session',
        searchResults: [
          {
            id: 'FL1001',
            airline: 'American Airlines',
            flightNumber: 'AA1234',
            price: 350,
            duration: 360,
            stops: 0,
            departureTime: new Date('2024-01-15T10:00:00Z'),
            arrivalTime: new Date('2024-01-15T16:00:00Z'),
            origin: { code: 'JFK', city: 'New York' },
            destination: { code: 'LAX', city: 'Los Angeles' },
            availableSeats: 100
          }
        ]
      });

      // Mock flight selection extraction
      jest.spyOn(conversationService as any, 'extractFlightSelection')
        .mockReturnValue(1);

      const request = {
        message: 'I want to select flight 1',
        sessionId: 'test-session'
      };

      const result = await conversationService.handleConversation(request);

      expect(result.message).toContain('American Airlines AA1234');
      expect(result.flightOptions).toHaveLength(1);
      expect(result.suggestedActions).toContain('Book this flight');
      expect(result.bookingStep).toBe('passenger_info');
      expect(mockSessionManager.setSelectedFlight).toHaveBeenCalled();
    });

    it('should handle flight comparison intent', async () => {
      // Mock intent analysis
      jest.spyOn(conversationService as any, 'analyzeIntent')
        .mockResolvedValue({
          type: 'flight_comparison',
          confidence: 0.8,
          entities: {}
        });

      // Mock session with multiple flights
      const mockFlights = [
        {
          id: 'FL1001',
          airline: 'American Airlines',
          flightNumber: 'AA1234',
          price: 350,
          duration: 360,
          stops: 0,
          departureTime: new Date('2024-01-15T10:00:00Z')
        },
        {
          id: 'FL1002',
          airline: 'Delta Air Lines',
          flightNumber: 'DL5678',
          price: 280,
          duration: 420,
          stops: 1,
          departureTime: new Date('2024-01-15T14:00:00Z')
        }
      ];

      mockSessionManager.getSession.mockReturnValue({
        sessionId: 'test-session',
        searchResults: mockFlights
      });

      // Mock comparison service
      mockFlightRecommendation.compareFlights.mockReturnValue({
        comparison: [
          {
            flight: mockFlights[0],
            advantages: ['Direct flight'],
            disadvantages: ['Higher price']
          },
          {
            flight: mockFlights[1],
            advantages: ['Lower price'],
            disadvantages: ['One stop']
          }
        ],
        summary: 'Comparing 2 flights: Price range $280-$350'
      });

      const request = {
        message: 'Can you compare these flights for me?',
        sessionId: 'test-session'
      };

      const result = await conversationService.handleConversation(request);

      expect(result.message).toContain('Flight Comparison');
      expect(result.flightOptions).toHaveLength(2);
      expect(result.suggestedActions).toContain('Select best option');
    });

    it('should handle preference updates', async () => {
      // Mock intent analysis
      jest.spyOn(conversationService as any, 'analyzeIntent')
        .mockResolvedValue({
          type: 'preference_update',
          confidence: 0.8,
          entities: {}
        });

      // Mock preference extraction
      jest.spyOn(conversationService as any, 'extractPreferences')
        .mockResolvedValue({
          budgetRange: 'budget',
          timePreference: 'morning'
        });

      mockSessionManager.getSession.mockReturnValue({
        sessionId: 'test-session',
        searchResults: [],
        bookingInProgress: {}
      });

      const request = {
        message: 'I prefer budget flights in the morning',
        sessionId: 'test-session'
      };

      const result = await conversationService.handleConversation(request);

      expect(result.message).toContain('updated your preferences');
      expect(result.message).toContain('budget');
      expect(result.message).toContain('morning');
      expect(result.suggestedActions).toContain('Search flights');
    });

    it('should handle recommendation requests', async () => {
      // Mock intent analysis
      jest.spyOn(conversationService as any, 'analyzeIntent')
        .mockResolvedValue({
          type: 'recommendation_request',
          confidence: 0.9,
          entities: {}
        });

      // Mock session with search results
      const mockFlights = [
        {
          id: 'FL1001',
          airline: 'American Airlines',
          price: 350,
          duration: 360,
          stops: 0
        }
      ];

      mockSessionManager.getSession.mockReturnValue({
        sessionId: 'test-session',
        searchResults: mockFlights,
        currentQuery: { origin: 'JFK', destination: 'LAX', passengers: 1 }
      });

      // Mock recommendations
      mockFlightRecommendation.generateRecommendations.mockResolvedValue({
        primary: {
          flight: mockFlights[0],
          reasons: ['Best overall value']
        },
        alternatives: [],
        insights: ['Good pricing'],
        tips: ['Book early']
      });

      const request = {
        message: 'What do you recommend?',
        sessionId: 'test-session'
      };

      const result = await conversationService.handleConversation(request);

      expect(result.message).toContain('My Recommendations');
      expect(result.flightOptions).toHaveLength(1);
      expect(result.suggestedActions).toContain('Select recommended flight');
    });

    it('should handle general inquiries', async () => {
      // Mock intent analysis
      jest.spyOn(conversationService as any, 'analyzeIntent')
        .mockResolvedValue({
          type: 'general_inquiry',
          confidence: 0.6,
          entities: {}
        });

      mockSessionManager.getConversationContext.mockReturnValue({
        previousQueries: [],
        recentMessages: []
      });

      mockVertexAI.generateConversationalResponse.mockResolvedValue(
        'I can help you find and book flights. What would you like to know?'
      );

      const request = {
        message: 'What can you help me with?',
        sessionId: 'test-session'
      };

      const result = await conversationService.handleConversation(request);

      expect(result.message).toContain('help you find and book flights');
      expect(result.suggestedActions).toContain('Search for flights');
    });

    it('should handle errors gracefully', async () => {
      // Mock intent analysis to throw error
      jest.spyOn(conversationService as any, 'analyzeIntent')
        .mockRejectedValue(new Error('Analysis failed'));

      const request = {
        message: 'Test message',
        sessionId: 'test-session'
      };

      const result = await conversationService.handleConversation(request);

      expect(result.message).toContain('technical difficulties');
      expect(result.suggestedActions).toContain('Try again');
    });
  });

  describe('analyzeIntent', () => {
    it('should analyze intent using AI when available', async () => {
      mockVertexAI.generateConversationalResponse.mockResolvedValue(
        '{"type": "flight_search", "confidence": 0.9, "entities": {}}'
      );

      const session = { conversationHistory: [] };
      const result = await (conversationService as any).analyzeIntent(
        'I want to fly to Paris',
        session
      );

      expect(result.type).toBe('flight_search');
      expect(result.confidence).toBe(0.9);
    });

    it('should fallback to keyword analysis when AI fails', async () => {
      mockVertexAI.generateConversationalResponse.mockRejectedValue(
        new Error('AI service unavailable')
      );

      const session = { conversationHistory: [] };
      const result = await (conversationService as any).analyzeIntent(
        'I want to search for flights',
        session
      );

      expect(result.type).toBe('flight_search');
      expect(result.confidence).toBe(0.7);
    });
  });

  describe('extractFlightSelection', () => {
    it('should extract flight numbers from various formats', () => {
      const testCases = [
        { input: 'select flight 1', expected: 1 },
        { input: 'I want option 2', expected: 2 },
        { input: 'book the first flight', expected: 1 },
        { input: 'choose the second one', expected: 2 },
        { input: '3', expected: 3 }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (conversationService as any).extractFlightSelection(input);
        expect(result).toBe(expected);
      });
    });

    it('should return null for non-selection messages', () => {
      const result = (conversationService as any).extractFlightSelection(
        'tell me more about flights'
      );
      expect(result).toBeNull();
    });
  });

  describe('extractPreferences', () => {
    it('should extract budget preferences', async () => {
      const result = await (conversationService as any).extractPreferences(
        'I prefer budget flights'
      );
      expect(result.budgetRange).toBe('budget');
    });

    it('should extract time preferences', async () => {
      const result = await (conversationService as any).extractPreferences(
        'I like morning departures'
      );
      expect(result.timePreference).toBe('morning');
    });

    it('should extract stop preferences', async () => {
      const result = await (conversationService as any).extractPreferences(
        'I want direct flights only'
      );
      expect(result.stopPreference).toBe('direct');
    });

    it('should extract multiple preferences', async () => {
      const result = await (conversationService as any).extractPreferences(
        'I prefer budget direct flights in the morning, prioritizing price'
      );
      expect(result.budgetRange).toBe('budget');
      expect(result.timePreference).toBe('morning');
      expect(result.stopPreference).toBe('direct');
      expect(result.priorityFactors).toContain('price');
    });
  });

  describe('response generation', () => {
    it('should generate search results response', async () => {
      const flights = [
        {
          id: 'FL1001',
          airline: 'American Airlines',
          flightNumber: 'AA1234',
          price: 350
        }
      ];

      const recommendations = {
        primary: {
          flight: flights[0],
          reasons: ['Best value']
        },
        alternatives: [],
        insights: ['Good pricing']
      };

      const searchParams = {
        origin: 'JFK',
        destination: 'LAX',
        departureDate: new Date('2024-01-15'),
        passengers: 1
      };

      const result = await (conversationService as any).generateSearchResultsResponse(
        flights,
        recommendations,
        searchParams
      );

      expect(result).toContain('Great!');
      expect(result).toContain('JFK to LAX');
      expect(result).toContain('American Airlines AA1234');
      expect(result).toContain('$350');
    });

    it('should generate flight details response', async () => {
      const flight = {
        id: 'FL1001',
        airline: 'American Airlines',
        flightNumber: 'AA1234',
        origin: { code: 'JFK', city: 'New York' },
        destination: { code: 'LAX', city: 'Los Angeles' },
        departureTime: new Date('2024-01-15T10:00:00Z'),
        arrivalTime: new Date('2024-01-15T16:00:00Z'),
        duration: 360,
        stops: 0,
        price: 350,
        availableSeats: 100
      };

      const result = await (conversationService as any).generateFlightDetailsResponse(flight);

      expect(result).toContain('American Airlines AA1234');
      expect(result).toContain('New York (JFK)');
      expect(result).toContain('Los Angeles (LAX)');
      expect(result).toContain('Direct flight');
      expect(result).toContain('$350');
    });
  });
});