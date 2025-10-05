import { NLPService } from '../services/nlpService';
import { VertexAIService } from '../services/vertexai';
import { SessionManager } from '../services/sessionManager';

// Mock dependencies
jest.mock('../services/vertexai');
jest.mock('../services/sessionManager');
jest.mock('../services/elasticsearch');

const mockVertexAI = {
  extractTravelParams: jest.fn(),
  generateConversationalResponse: jest.fn(),
  suggestAlternativeDates: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue(true)
};

const mockSessionManager = {
  getOrCreateSession: jest.fn(),
  updateSessionQuery: jest.fn(),
  updateSessionResults: jest.fn(),
  addMessage: jest.fn(),
  getConversationContext: jest.fn(),
  setSelectedFlight: jest.fn()
};

const mockElasticsearch = {
  searchFlights: jest.fn()
};

// Mock the services
(VertexAIService as jest.Mock).mockImplementation(() => mockVertexAI);
(SessionManager as jest.Mock).mockImplementation(() => mockSessionManager);

describe('NLPService', () => {
  let nlpService: NLPService;

  beforeEach(() => {
    nlpService = new NLPService();
    jest.clearAllMocks();
  });

  describe('processTravelQuery', () => {
    it('should extract travel parameters and search flights', async () => {
      // Mock responses
      const mockParams = {
        origin: 'JFK',
        destination: 'LAX',
        departureDate: new Date('2024-01-15'),
        passengers: 1
      };

      const mockFlights = [
        {
          id: 'FL1001',
          airline: 'American Airlines',
          flightNumber: 'AA1234',
          price: 350,
          duration: 360
        }
      ];

      const mockSession = {
        sessionId: 'test-session',
        conversationHistory: []
      };

      mockVertexAI.extractTravelParams.mockResolvedValue(mockParams);
      mockSessionManager.getOrCreateSession.mockReturnValue(mockSession);
      mockSessionManager.getConversationContext.mockReturnValue({
        previousQueries: [],
        recentMessages: []
      });
      mockVertexAI.generateConversationalResponse.mockResolvedValue(
        'I found some great flights for you!'
      );

      // Mock elasticsearch
      const mockSearchFlights = jest.fn().mockResolvedValue(mockFlights);
      jest.doMock('../services/elasticsearch', () => ({
        elasticsearchService: {
          searchFlights: mockSearchFlights
        }
      }));

      const query = {
        userMessage: 'I want to fly from New York to Los Angeles tomorrow',
        sessionId: 'test-session'
      };

      const result = await nlpService.processTravelQuery(query);

      expect(result.params).toEqual(mockParams);
      expect(result.response).toBe('I found some great flights for you!');
      expect(mockVertexAI.extractTravelParams).toHaveBeenCalledWith(query);
      expect(mockSessionManager.updateSessionQuery).toHaveBeenCalledWith('test-session', mockParams);
    });

    it('should handle missing information with clarification', async () => {
      const mockParams = {
        origin: 'JFK',
        // Missing destination and date
        passengers: 1
      };

      mockVertexAI.extractTravelParams.mockResolvedValue(mockParams);
      mockSessionManager.getOrCreateSession.mockReturnValue({
        sessionId: 'test-session',
        conversationHistory: []
      });

      const query = {
        userMessage: 'I want to fly from New York',
        sessionId: 'test-session'
      };

      const result = await nlpService.processTravelQuery(query);

      expect(result.params).toEqual(mockParams);
      expect(result.searchResults).toHaveLength(0);
      expect(result.response).toContain('information'); // Should ask for more info
    });

    it('should handle extraction errors gracefully', async () => {
      mockVertexAI.extractTravelParams.mockRejectedValue(new Error('AI service error'));
      mockSessionManager.getOrCreateSession.mockReturnValue({
        sessionId: 'test-session',
        conversationHistory: []
      });

      const query = {
        userMessage: 'Invalid query',
        sessionId: 'test-session'
      };

      const result = await nlpService.processTravelQuery(query);

      expect(result.params).toEqual({ passengers: 1 });
      expect(result.searchResults).toHaveLength(0);
      expect(result.response).toContain('help'); // Should offer help
    });
  });

  describe('handleConversation', () => {
    it('should handle flight selection', async () => {
      const mockFlights = [
        {
          id: 'FL1001',
          airline: 'American Airlines',
          flightNumber: 'AA1234',
          price: 350
        },
        {
          id: 'FL1002',
          airline: 'Delta Air Lines',
          flightNumber: 'DL5678',
          price: 375
        }
      ];

      mockSessionManager.getConversationContext.mockReturnValue({
        previousQueries: [],
        searchResults: mockFlights,
        recentMessages: []
      });

      const request = {
        message: 'I want to select flight 1',
        sessionId: 'test-session'
      };

      const result = await nlpService.handleConversation(request);

      expect(result.message).toContain('Great choice');
      expect(result.flightOptions).toHaveLength(1);
      expect(result.bookingStep).toBe('flight_selection');
      expect(mockSessionManager.setSelectedFlight).toHaveBeenCalledWith(
        'test-session',
        mockFlights[0]
      );
    });

    it('should handle general conversation', async () => {
      mockSessionManager.getConversationContext.mockReturnValue({
        previousQueries: [],
        searchResults: [],
        recentMessages: []
      });

      mockVertexAI.generateConversationalResponse.mockResolvedValue(
        'I can help you find flights. Where would you like to go?'
      );

      const request = {
        message: 'Can you help me find flights?',
        sessionId: 'test-session'
      };

      const result = await nlpService.handleConversation(request);

      expect(result.message).toBe('I can help you find flights. Where would you like to go?');
      expect(mockVertexAI.generateConversationalResponse).toHaveBeenCalled();
    });

    it('should handle conversation errors gracefully', async () => {
      mockSessionManager.getConversationContext.mockReturnValue({
        previousQueries: [],
        recentMessages: []
      });

      mockVertexAI.generateConversationalResponse.mockRejectedValue(
        new Error('AI service error')
      );

      const request = {
        message: 'Help me',
        sessionId: 'test-session'
      };

      const result = await nlpService.handleConversation(request);

      expect(result.message).toContain('trouble understanding');
      expect(result.suggestedActions).toContain('Search for flights');
    });
  });

  describe('extractFlightSelection', () => {
    it('should extract flight numbers from various formats', () => {
      const testCases = [
        { input: 'select flight 1', expected: 1 },
        { input: 'I want option 2', expected: 2 },
        { input: 'book the first flight', expected: 1 },
        { input: 'choose the second one', expected: 2 },
        { input: '3', expected: 3 },
        { input: 'pick flight number 1', expected: 1 }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (nlpService as any).extractFlightSelection(input);
        expect(result).toBe(expected);
      });
    });

    it('should return null for non-selection messages', () => {
      const testCases = [
        'tell me more about flights',
        'what are the baggage policies',
        'I need help',
        'show me alternatives'
      ];

      testCases.forEach(input => {
        const result = (nlpService as any).extractFlightSelection(input);
        expect(result).toBeNull();
      });
    });
  });

  describe('isRequestingAlternatives', () => {
    it('should detect alternative requests', () => {
      const testCases = [
        'show me other options',
        'any alternatives?',
        'different flights please',
        'something cheaper',
        'earlier flight',
        'other dates available?'
      ];

      testCases.forEach(input => {
        const result = (nlpService as any).isRequestingAlternatives(input);
        expect(result).toBe(true);
      });
    });

    it('should not detect non-alternative requests', () => {
      const testCases = [
        'book this flight',
        'tell me more details',
        'what is the baggage policy',
        'I want to select flight 1'
      ];

      testCases.forEach(input => {
        const result = (nlpService as any).isRequestingAlternatives(input);
        expect(result).toBe(false);
      });
    });
  });
});

describe('VertexAIService', () => {
  let vertexAIService: VertexAIService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('normalizeLocation', () => {
    it('should convert city names to airport codes', () => {
      const service = new VertexAIService();
      
      const testCases = [
        { input: 'new york', expected: 'JFK' },
        { input: 'los angeles', expected: 'LAX' },
        { input: 'london', expected: 'LHR' },
        { input: 'JFK', expected: 'JFK' },
        { input: 'lax', expected: 'LAX' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (service as any).normalizeLocation(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle unknown locations', () => {
      const service = new VertexAIService();
      const result = (service as any).normalizeLocation('unknown city');
      expect(result).toBe('UNKNOWN CITY');
    });
  });
});

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    sessionManager.destroy();
  });

  describe('session management', () => {
    it('should create and retrieve sessions', () => {
      const sessionId = 'test-session';
      const session = sessionManager.createSession(sessionId);

      expect(session.sessionId).toBe(sessionId);
      expect(session.conversationHistory).toEqual([]);

      const retrieved = sessionManager.getSession(sessionId);
      expect(retrieved).toEqual(session);
    });

    it('should update session activity on access', () => {
      const sessionId = 'test-session';
      const session = sessionManager.createSession(sessionId);
      const originalActivity = session.lastActivity;

      // Wait a bit and access again
      setTimeout(() => {
        const retrieved = sessionManager.getSession(sessionId);
        expect(retrieved!.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
      }, 10);
    });

    it('should get or create sessions', () => {
      const sessionId = 'new-session';
      
      // Should create new session
      const session1 = sessionManager.getOrCreateSession(sessionId);
      expect(session1.sessionId).toBe(sessionId);

      // Should return existing session
      const session2 = sessionManager.getOrCreateSession(sessionId);
      expect(session2).toBe(session1);
    });

    it('should clear sessions', () => {
      const sessionId = 'test-session';
      sessionManager.createSession(sessionId);

      expect(sessionManager.getSession(sessionId)).toBeTruthy();
      
      sessionManager.clearSession(sessionId);
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
  });

  describe('conversation management', () => {
    it('should add messages to conversation history', () => {
      const sessionId = 'test-session';
      sessionManager.createSession(sessionId);

      const message = {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Hello',
        timestamp: new Date()
      };

      sessionManager.addMessage(sessionId, message);

      const session = sessionManager.getSession(sessionId);
      expect(session!.conversationHistory).toHaveLength(1);
      expect(session!.conversationHistory[0]).toEqual(message);
    });

    it('should limit conversation history length', () => {
      const sessionId = 'test-session';
      sessionManager.createSession(sessionId);

      // Add 25 messages (more than the 20 limit)
      for (let i = 0; i < 25; i++) {
        const message = {
          id: `msg-${i}`,
          role: 'user' as const,
          content: `Message ${i}`,
          timestamp: new Date()
        };
        sessionManager.addMessage(sessionId, message);
      }

      const session = sessionManager.getSession(sessionId);
      expect(session!.conversationHistory).toHaveLength(20);
      expect(session!.conversationHistory[0].content).toBe('Message 5'); // Should keep last 20
    });
  });

  describe('session statistics', () => {
    it('should provide session statistics', () => {
      sessionManager.createSession('session-1');
      sessionManager.createSession('session-2');

      const stats = sessionManager.getSessionStats();
      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(2);
      expect(stats.oldestSession).toBeTruthy();
    });
  });
});