import { HybridSearchService } from '../services/hybridSearch';
import { FlightRecommendationService } from '../services/flightRecommendation';

// Mock dependencies
jest.mock('../services/elasticsearch');
jest.mock('../services/vertexai');

const mockElasticsearch = {
  searchFlights: jest.fn(),
  searchFlightsFlexible: jest.fn(),
  getRouteStatistics: jest.fn()
};

const mockVertexAI = {
  generateConversationalResponse: jest.fn()
};

describe('HybridSearchService', () => {
  let hybridSearchService: HybridSearchService;

  beforeEach(() => {
    hybridSearchService = new HybridSearchService();
    jest.clearAllMocks();
  });

  describe('hybridFlightSearch', () => {
    it('should perform hybrid search and return results with suggestions', async () => {
      const mockFlights = [
        {
          id: 'FL1001',
          airline: 'American Airlines',
          flightNumber: 'AA1234',
          origin: { code: 'JFK', name: 'JFK Airport', city: 'New York', country: 'USA' },
          destination: { code: 'LAX', name: 'LAX Airport', city: 'Los Angeles', country: 'USA' },
          departureTime: new Date('2024-01-15T10:00:00Z'),
          arrivalTime: new Date('2024-01-15T16:00:00Z'),
          duration: 360,
          stops: 0,
          price: 350,
          availableSeats: 100
        },
        {
          id: 'FL1002',
          airline: 'Delta Air Lines',
          flightNumber: 'DL5678',
          origin: { code: 'JFK', name: 'JFK Airport', city: 'New York', country: 'USA' },
          destination: { code: 'LAX', name: 'LAX Airport', city: 'Los Angeles', country: 'USA' },
          departureTime: new Date('2024-01-15T14:00:00Z'),
          arrivalTime: new Date('2024-01-15T20:00:00Z'),
          duration: 360,
          stops: 1,
          price: 280,
          availableSeats: 80
        }
      ];

      // Mock elasticsearch search
      jest.doMock('../services/elasticsearch', () => ({
        elasticsearchService: {
          searchFlights: jest.fn().mockResolvedValue(mockFlights)
        }
      }));

      const searchRequest = {
        origin: 'JFK',
        destination: 'LAX',
        departureDate: new Date('2024-01-15'),
        passengers: 1
      };

      const result = await hybridSearchService.hybridFlightSearch(searchRequest);

      expect(result.results).toHaveLength(2);
      expect(result.suggestions).toBeDefined();
      expect(result.searchMetadata).toBeDefined();
      expect(result.searchMetadata.totalResults).toBe(2);
    });

    it('should handle search errors gracefully', async () => {
      jest.doMock('../services/elasticsearch', () => ({
        elasticsearchService: {
          searchFlights: jest.fn().mockRejectedValue(new Error('Search failed'))
        }
      }));

      const searchRequest = {
        origin: 'JFK',
        destination: 'LAX',
        departureDate: new Date('2024-01-15'),
        passengers: 1
      };

      await expect(hybridSearchService.hybridFlightSearch(searchRequest))
        .rejects.toThrow('Flight search failed');
    });
  });

  describe('applyIntelligentRanking', () => {
    it('should rank flights based on multiple factors', async () => {
      const flights = [
        {
          id: 'FL1001',
          airline: 'American Airlines',
          flightNumber: 'AA1234',
          origin: { code: 'JFK', name: 'JFK Airport', city: 'New York', country: 'USA' },
          destination: { code: 'LAX', name: 'LAX Airport', city: 'Los Angeles', country: 'USA' },
          departureTime: new Date('2024-01-15T10:00:00Z'),
          arrivalTime: new Date('2024-01-15T16:00:00Z'),
          duration: 360,
          stops: 0,
          price: 500, // Higher price
          availableSeats: 100
        },
        {
          id: 'FL1002',
          airline: 'Delta Air Lines',
          flightNumber: 'DL5678',
          origin: { code: 'JFK', name: 'JFK Airport', city: 'New York', country: 'USA' },
          destination: { code: 'LAX', name: 'LAX Airport', city: 'Los Angeles', country: 'USA' },
          departureTime: new Date('2024-01-15T14:00:00Z'),
          arrivalTime: new Date('2024-01-15T20:00:00Z'),
          duration: 360,
          stops: 0,
          price: 300, // Lower price
          availableSeats: 80
        }
      ];

      const searchRequest = {
        origin: 'JFK',
        destination: 'LAX',
        departureDate: new Date('2024-01-15'),
        passengers: 1
      };

      const ranked = await (hybridSearchService as any).applyIntelligentRanking(
        flights,
        searchRequest,
        {}
      );

      // Lower price flight should be ranked higher
      expect(ranked[0].id).toBe('FL1002');
      expect(ranked[1].id).toBe('FL1001');
    });
  });

  describe('generateSearchSuggestions', () => {
    it('should suggest alternatives when no results found', async () => {
      const searchRequest = {
        origin: 'JFK',
        destination: 'LAX',
        departureDate: new Date('2024-01-15'),
        passengers: 1
      };

      const suggestions = await (hybridSearchService as any).generateSearchSuggestions(
        searchRequest,
        []
      );

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].type).toBe('date');
      expect(suggestions[1].type).toBe('airport');
    });

    it('should suggest date flexibility when few results', async () => {
      const mockFlights = [
        {
          id: 'FL1001',
          airline: 'American Airlines',
          price: 350,
          stops: 0
        }
      ];

      const searchRequest = {
        origin: 'JFK',
        destination: 'LAX',
        departureDate: new Date('2024-01-15'),
        passengers: 1
      };

      const suggestions = await (hybridSearchService as any).generateSearchSuggestions(
        searchRequest,
        mockFlights
      );

      expect(suggestions.some(s => s.type === 'date')).toBe(true);
    });
  });

  describe('smartFilter', () => {
    it('should filter flights based on user preferences', async () => {
      const flights = [
        {
          id: 'FL1001',
          airline: 'American Airlines',
          price: 350,
          stops: 0,
          departureTime: new Date('2024-01-15T10:00:00Z')
        },
        {
          id: 'FL1002',
          airline: 'Delta Air Lines',
          price: 600, // Over budget
          stops: 1,
          departureTime: new Date('2024-01-15T14:00:00Z')
        }
      ];

      const userPreferences = {
        maxPrice: 400,
        preferredAirlines: ['American Airlines'],
        maxStops: 0
      };

      const filtered = await hybridSearchService.smartFilter(flights, userPreferences);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('FL1001');
    });

    it('should return all flights when no preferences provided', async () => {
      const flights = [
        { id: 'FL1001', airline: 'American Airlines', price: 350, stops: 0 },
        { id: 'FL1002', airline: 'Delta Air Lines', price: 400, stops: 1 }
      ];

      const filtered = await hybridSearchService.smartFilter(flights);

      expect(filtered).toHaveLength(2);
    });
  });

  describe('findNearbyAirports', () => {
    it('should find alternative airport pairs', async () => {
      const pairs = await (hybridSearchService as any).findNearbyAirports('JFK', 'LAX');

      expect(pairs).toBeDefined();
      expect(Array.isArray(pairs)).toBe(true);
      // Should include alternatives like LGA-LAX, JFK-BUR, etc.
    });

    it('should return original airports when no alternatives exist', async () => {
      const pairs = await (hybridSearchService as any).findNearbyAirports('XYZ', 'ABC');

      expect(pairs).toBeDefined();
      expect(Array.isArray(pairs)).toBe(true);
    });
  });
});

describe('FlightRecommendationService', () => {
  let recommendationService: FlightRecommendationService;

  beforeEach(() => {
    recommendationService = new FlightRecommendationService();
    jest.clearAllMocks();
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations with primary and alternatives', async () => {
      const flights = [
        {
          id: 'FL1001',
          airline: 'American Airlines',
          flightNumber: 'AA1234',
          origin: { code: 'JFK', name: 'JFK Airport', city: 'New York', country: 'USA' },
          destination: { code: 'LAX', name: 'LAX Airport', city: 'Los Angeles', country: 'USA' },
          departureTime: new Date('2024-01-15T10:00:00Z'),
          arrivalTime: new Date('2024-01-15T16:00:00Z'),
          duration: 360,
          stops: 0,
          price: 350,
          availableSeats: 100
        },
        {
          id: 'FL1002',
          airline: 'Delta Air Lines',
          flightNumber: 'DL5678',
          origin: { code: 'JFK', name: 'JFK Airport', city: 'New York', country: 'USA' },
          destination: { code: 'LAX', name: 'LAX Airport', city: 'Los Angeles', country: 'USA' },
          departureTime: new Date('2024-01-15T14:00:00Z'),
          arrivalTime: new Date('2024-01-15T20:00:00Z'),
          duration: 420,
          stops: 1,
          price: 280,
          availableSeats: 80
        }
      ];

      const searchParams = {
        origin: 'JFK',
        destination: 'LAX',
        departureDate: new Date('2024-01-15'),
        passengers: 1
      };

      // Mock AI response
      mockVertexAI.generateConversationalResponse.mockResolvedValue(
        'Book flights on Tuesday for better prices\nArrive 2 hours early\nCheck baggage policies'
      );

      const recommendations = await recommendationService.generateRecommendations(
        flights,
        searchParams
      );

      expect(recommendations.primary).toBeDefined();
      expect(recommendations.alternatives).toBeDefined();
      expect(recommendations.insights).toBeDefined();
      expect(recommendations.tips).toBeDefined();
      expect(recommendations.primary.flight).toBeDefined();
      expect(recommendations.primary.reasons).toHaveLength(1);
    });

    it('should handle empty flight list', async () => {
      const searchParams = {
        origin: 'JFK',
        destination: 'LAX',
        passengers: 1
      };

      await expect(recommendationService.generateRecommendations([], searchParams))
        .rejects.toThrow('No flights available for recommendations');
    });

    it('should generate fallback recommendations on AI failure', async () => {
      const flights = [
        {
          id: 'FL1001',
          airline: 'American Airlines',
          flightNumber: 'AA1234',
          origin: { code: 'JFK', name: 'JFK Airport', city: 'New York', country: 'USA' },
          destination: { code: 'LAX', name: 'LAX Airport', city: 'Los Angeles', country: 'USA' },
          departureTime: new Date('2024-01-15T10:00:00Z'),
          arrivalTime: new Date('2024-01-15T16:00:00Z'),
          duration: 360,
          stops: 0,
          price: 350,
          availableSeats: 100
        }
      ];

      const searchParams = {
        origin: 'JFK',
        destination: 'LAX',
        passengers: 1
      };

      // Mock AI failure
      mockVertexAI.generateConversationalResponse.mockRejectedValue(new Error('AI failed'));

      const recommendations = await recommendationService.generateRecommendations(
        flights,
        searchParams
      );

      expect(recommendations.primary).toBeDefined();
      expect(recommendations.insights).toContain('Compare prices and flight times to find your best option');
    });
  });

  describe('compareFlights', () => {
    it('should compare flights and identify advantages/disadvantages', () => {
      const flights = [
        {
          id: 'FL1001',
          airline: 'American Airlines',
          flightNumber: 'AA1234',
          origin: { code: 'JFK', name: 'JFK Airport', city: 'New York', country: 'USA' },
          destination: { code: 'LAX', name: 'LAX Airport', city: 'Los Angeles', country: 'USA' },
          departureTime: new Date('2024-01-15T10:00:00Z'),
          arrivalTime: new Date('2024-01-15T16:00:00Z'),
          duration: 360,
          stops: 0,
          price: 350,
          availableSeats: 100
        },
        {
          id: 'FL1002',
          airline: 'Delta Air Lines',
          flightNumber: 'DL5678',
          origin: { code: 'JFK', name: 'JFK Airport', city: 'New York', country: 'USA' },
          destination: { code: 'LAX', name: 'LAX Airport', city: 'Los Angeles', country: 'USA' },
          departureTime: new Date('2024-01-15T14:00:00Z'),
          arrivalTime: new Date('2024-01-15T20:00:00Z'),
          duration: 420,
          stops: 1,
          price: 280,
          availableSeats: 80
        }
      ];

      const comparison = recommendationService.compareFlights(flights);

      expect(comparison.comparison).toHaveLength(2);
      expect(comparison.summary).toContain('Comparing 2 flights');
      
      // Check that advantages/disadvantages are identified
      const flight1 = comparison.comparison.find(c => c.flight.id === 'FL1001');
      const flight2 = comparison.comparison.find(c => c.flight.id === 'FL1002');
      
      expect(flight1?.advantages).toContain('Direct flight');
      expect(flight2?.advantages).toContain('Lowest price');
    });

    it('should throw error for insufficient flights', () => {
      const flights = [
        {
          id: 'FL1001',
          airline: 'American Airlines',
          price: 350,
          duration: 360,
          stops: 0,
          departureTime: new Date()
        }
      ];

      expect(() => recommendationService.compareFlights(flights))
        .toThrow('Need at least 2 flights to compare');
    });
  });

  describe('scoring functions', () => {
    it('should calculate price weight based on budget preference', () => {
      const service = recommendationService as any;
      
      expect(service.getPriceWeight('budget')).toBe(0.50);
      expect(service.getPriceWeight('mid-range')).toBe(0.30);
      expect(service.getPriceWeight('premium')).toBe(0.15);
      expect(service.getPriceWeight()).toBe(0.30); // default
    });

    it('should score time preferences correctly', () => {
      const service = recommendationService as any;
      const morningFlight = { departureTime: new Date('2024-01-15T08:00:00Z') };
      const afternoonFlight = { departureTime: new Date('2024-01-15T14:00:00Z') };
      const eveningFlight = { departureTime: new Date('2024-01-15T20:00:00Z') };

      expect(service.getTimePreferenceScore(morningFlight, 'morning')).toBe(1);
      expect(service.getTimePreferenceScore(afternoonFlight, 'morning')).toBe(0.3);
      expect(service.getTimePreferenceScore(afternoonFlight, 'afternoon')).toBe(1);
      expect(service.getTimePreferenceScore(eveningFlight, 'evening')).toBe(1);
    });

    it('should score airline preferences correctly', () => {
      const service = recommendationService as any;
      const flight = { airline: 'American Airlines' };

      expect(service.getAirlinePreferenceScore(flight, ['American Airlines'])).toBe(1);
      expect(service.getAirlinePreferenceScore(flight, ['Delta Air Lines'])).toBe(0.2);
      expect(service.getAirlinePreferenceScore(flight, [])).toBe(0.5);
      expect(service.getAirlinePreferenceScore(flight)).toBe(0.5);
    });
  });
});