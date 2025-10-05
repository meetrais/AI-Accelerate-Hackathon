import { ElasticsearchService } from '../services/elasticsearch';
import { generateMockFlights } from '../data/mockFlights';

// Mock the Elasticsearch client
jest.mock('@elastic/elasticsearch', () => ({
  Client: jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue({ statusCode: 200 }),
    indices: {
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue({ acknowledged: true })
    },
    bulk: jest.fn().mockResolvedValue({ errors: false, items: [] }),
    search: jest.fn().mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              id: 'FL1001',
              airline: 'American Airlines',
              flightNumber: 'AA1234',
              origin: { code: 'JFK', name: 'JFK Airport', city: 'New York', country: 'USA' },
              destination: { code: 'LAX', name: 'LAX Airport', city: 'Los Angeles', country: 'USA' },
              departureTime: '2024-01-15T10:00:00Z',
              arrivalTime: '2024-01-15T16:00:00Z',
              duration: 360,
              stops: [],
              price: { amount: 350, currency: 'USD' },
              availability: { economy: 100, business: 20, first: 5 }
            }
          }
        ]
      }
    }),
    get: jest.fn().mockResolvedValue({
      found: true,
      _source: {
        id: 'FL1001',
        airline: 'American Airlines',
        departureTime: '2024-01-15T10:00:00Z',
        arrivalTime: '2024-01-15T16:00:00Z'
      }
    }),
    deleteByQuery: jest.fn().mockResolvedValue({ deleted: 10 })
  }))
}));

describe('ElasticsearchService', () => {
  let elasticsearchService: ElasticsearchService;

  beforeEach(() => {
    elasticsearchService = new ElasticsearchService();
  });

  describe('healthCheck', () => {
    it('should return true when Elasticsearch is healthy', async () => {
      const result = await elasticsearchService.healthCheck();
      expect(result).toBe(true);
    });
  });

  describe('createFlightIndex', () => {
    it('should create index when it does not exist', async () => {
      await expect(elasticsearchService.createFlightIndex()).resolves.not.toThrow();
    });
  });

  describe('indexFlights', () => {
    it('should index flights successfully', async () => {
      const mockFlights = generateMockFlights().slice(0, 5); // Test with 5 flights
      await expect(elasticsearchService.indexFlights(mockFlights)).resolves.not.toThrow();
    });
  });

  describe('searchFlights', () => {
    it('should search flights and return results', async () => {
      const searchRequest = {
        origin: 'JFK',
        destination: 'LAX',
        departureDate: new Date('2024-01-15'),
        passengers: 1
      };

      const results = await elasticsearchService.searchFlights(searchRequest);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'FL1001',
        airline: 'American Airlines',
        flightNumber: 'AA1234'
      });
    });

    it('should handle search with filters', async () => {
      const searchRequest = {
        origin: 'JFK',
        destination: 'LAX',
        departureDate: new Date('2024-01-15'),
        passengers: 1,
        filters: {
          maxPrice: 500,
          airlines: ['American Airlines'],
          maxStops: 0
        }
      };

      const results = await elasticsearchService.searchFlights(searchRequest);
      expect(results).toHaveLength(1);
    });
  });

  describe('getFlightById', () => {
    it('should return flight when found', async () => {
      const flight = await elasticsearchService.getFlightById('FL1001');

      expect(flight).toBeTruthy();
      expect(flight?.id).toBe('FL1001');
      expect(flight?.airline).toBe('American Airlines');
    });

    it('should return null when flight not found', async () => {
      // Mock 404 error
      const mockGet = jest.fn().mockRejectedValue({ statusCode: 404 });
      (elasticsearchService as any).client.get = mockGet;

      const flight = await elasticsearchService.getFlightById('NONEXISTENT');
      expect(flight).toBeNull();
    });
  });

  describe('deleteAllFlights', () => {
    it('should delete all flights successfully', async () => {
      await expect(elasticsearchService.deleteAllFlights()).resolves.not.toThrow();
    });
  });
});

describe('Mock Flight Data', () => {
  it('should generate realistic flight data', () => {
    const flights = generateMockFlights();

    expect(flights.length).toBeGreaterThan(0);

    // Check first flight structure
    const flight = flights[0];
    expect(flight).toHaveProperty('id');
    expect(flight).toHaveProperty('airline');
    expect(flight).toHaveProperty('flightNumber');
    expect(flight).toHaveProperty('origin');
    expect(flight).toHaveProperty('destination');
    expect(flight).toHaveProperty('departureTime');
    expect(flight).toHaveProperty('arrivalTime');
    expect(flight).toHaveProperty('price');
    expect(flight).toHaveProperty('availability');

    // Validate airport codes
    expect(flight.origin.code).toMatch(/^[A-Z]{3}$/);
    expect(flight.destination.code).toMatch(/^[A-Z]{3}$/);

    // Validate price structure
    expect(flight.price.amount).toBeGreaterThan(0);
    expect(flight.price.currency).toBe('USD');

    // Validate availability
    expect(flight.availability.economy).toBeGreaterThan(0);
    expect(flight.availability.business).toBeGreaterThan(0);
    expect(flight.availability.first).toBeGreaterThan(0);
  });

  it('should generate flights with different routes', () => {
    const flights = generateMockFlights();
    const routes = new Set(flights.map(f => `${f.origin.code}-${f.destination.code}`));

    expect(routes.size).toBeGreaterThan(1);
  });

  it('should generate flights with different airlines', () => {
    const flights = generateMockFlights();
    const airlines = new Set(flights.map(f => f.airline));

    expect(airlines.size).toBeGreaterThan(1);
  });
});