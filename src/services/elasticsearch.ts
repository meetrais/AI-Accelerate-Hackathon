import { Client } from '@elastic/elasticsearch';
import { config } from '../config';
import { Flight, FlightSearchRequest, FlightResult, Airport, FlightFilters } from '../types';

export class ElasticsearchService {
  private client: Client;
  private flightIndex: string;

  /**
   * Get the Elasticsearch client (for advanced operations)
   */
  public getClient(): Client {
    return this.client;
  }

  constructor() {
    // Initialize Elasticsearch client
    const clientConfig: any = {
      node: config.elasticsearch.node
    };

    // Add authentication if provided
    if (config.elasticsearch.apiKey) {
      clientConfig.auth = {
        apiKey: config.elasticsearch.apiKey
      };
    } else if (config.elasticsearch.username && config.elasticsearch.password) {
      clientConfig.auth = {
        username: config.elasticsearch.username,
        password: config.elasticsearch.password
      };
    }

    this.client = new Client(clientConfig);
    this.flightIndex = config.elasticsearch.flightIndex;
  }

  /**
   * Check if Elasticsearch is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.ping();
      return response === true;
    } catch (error) {
      console.error('Elasticsearch health check failed:', error);
      return false;
    }
  }

  /**
   * Create the flights index with proper mapping
   */
  async createFlightIndex(): Promise<void> {
    try {
      const indexExists = await this.client.indices.exists({
        index: this.flightIndex
      });

      if (!indexExists) {
        await this.client.indices.create({
          index: this.flightIndex,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                airline: { 
                  type: 'text',
                  fields: { keyword: { type: 'keyword' } }
                },
                flightNumber: { type: 'keyword' },
                aircraft: { type: 'keyword' },
                origin: {
                  properties: {
                    code: { type: 'keyword' },
                    name: { type: 'text' },
                    city: { 
                      type: 'text',
                      fields: { keyword: { type: 'keyword' } }
                    },
                    country: { type: 'keyword' },
                    timezone: { type: 'keyword' }
                  }
                },
                destination: {
                  properties: {
                    code: { type: 'keyword' },
                    name: { type: 'text' },
                    city: { 
                      type: 'text',
                      fields: { keyword: { type: 'keyword' } }
                    },
                    country: { type: 'keyword' },
                    timezone: { type: 'keyword' }
                  }
                },
                departureTime: { type: 'date' },
                arrivalTime: { type: 'date' },
                duration: { type: 'integer' },
                stops: {
                  properties: {
                    code: { type: 'keyword' },
                    name: { type: 'text' },
                    city: { type: 'text' },
                    country: { type: 'keyword' },
                    length: { type: 'integer' }
                  }
                },
                price: {
                  properties: {
                    amount: { type: 'float' },
                    currency: { type: 'keyword' },
                    taxes: { type: 'float' },
                    fees: { type: 'float' }
                  }
                },
                availability: {
                  properties: {
                    economy: { type: 'integer' },
                    business: { type: 'integer' },
                    first: { type: 'integer' }
                  }
                },
                policies: {
                  properties: {
                    baggage: {
                      properties: {
                        carry_on: { type: 'text' },
                        checked: { type: 'text' }
                      }
                    },
                    cancellation: { type: 'text' },
                    changes: { type: 'text' }
                  }
                }
              }
            }
          }
        });

        console.log(`✅ Created Elasticsearch index: ${this.flightIndex}`);
      } else {
        console.log(`📋 Elasticsearch index already exists: ${this.flightIndex}`);
      }
    } catch (error) {
      console.error('Error creating flight index:', error);
      throw error;
    }
  }

  /**
   * Index flight data in bulk
   */
  async indexFlights(flights: Flight[]): Promise<void> {
    try {
      const body = flights.flatMap(flight => [
        { index: { _index: this.flightIndex, _id: flight.id } },
        {
          ...flight,
          stops: {
            ...flight.stops,
            length: flight.stops.length
          }
        }
      ]);

      const response = await this.client.bulk({ body });

      if (response.errors) {
        console.error('Bulk indexing errors:', response.items);
        throw new Error('Failed to index some flights');
      }

      console.log(`✅ Indexed ${flights.length} flights successfully`);
    } catch (error) {
      console.error('Error indexing flights:', error);
      throw error;
    }
  }

  /**
   * Search flights based on criteria with advanced filtering
   */
  async searchFlights(searchRequest: FlightSearchRequest): Promise<FlightResult[]> {
    try {
      const query: any = {
        bool: {
          must: [
            { term: { 'origin.code': searchRequest.origin } },
            { term: { 'destination.code': searchRequest.destination } }
          ],
          filter: [],
          should: [], // For boosting certain results
          minimum_should_match: 0
        }
      };

      // Add date range filter
      const startOfDay = new Date(searchRequest.departureDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(searchRequest.departureDate);
      endOfDay.setHours(23, 59, 59, 999);

      query.bool.filter.push({
        range: {
          departureTime: {
            gte: startOfDay.toISOString(),
            lte: endOfDay.toISOString()
          }
        }
      });

      // Add filters if provided
      if (searchRequest.filters) {
        const { filters } = searchRequest;

        if (filters.maxPrice) {
          query.bool.filter.push({
            range: { 'price.amount': { lte: filters.maxPrice } }
          });
        }

        if (filters.airlines && filters.airlines.length > 0) {
          query.bool.filter.push({
            terms: { 'airline.keyword': filters.airlines }
          });
        }

        if (filters.maxStops !== undefined) {
          query.bool.filter.push({
            range: {
              'stops.length': { lte: filters.maxStops }
            }
          });
        }

        if (filters.departureTimeRange) {
          const { start, end } = filters.departureTimeRange;
          query.bool.filter.push({
            script: {
              script: {
                source: `
                  def hour = doc['departureTime'].value.getHour();
                  def startHour = Integer.parseInt(params.start.split(':')[0]);
                  def endHour = Integer.parseInt(params.end.split(':')[0]);
                  return hour >= startHour && hour <= endHour;
                `,
                params: { start, end }
              }
            }
          });
        }

        if (filters.class) {
          // Boost flights with availability in requested class
          const availabilityField = `availability.${filters.class}`;
          query.bool.should.push({
            range: { [availabilityField]: { gt: 0 } }
          });
        }
      }

      // Add boosting for better results
      query.bool.should.push(
        { range: { 'stops.length': { lte: 0, boost: 2.0 } } }, // Boost direct flights
        { range: { 'price.amount': { lte: 500, boost: 1.5 } } }, // Boost reasonable prices
        { range: { duration: { lte: 480, boost: 1.2 } } } // Boost shorter flights (under 8 hours)
      );

      const response = await this.client.search({
        index: this.flightIndex,
        body: {
          query,
          sort: [
            { _score: { order: 'desc' } }, // Sort by relevance score first
            { 'price.amount': { order: 'asc' } },
            { departureTime: { order: 'asc' } }
          ],
          size: 50
        }
      });

      // Transform Elasticsearch results to FlightResult format
      const flightResults: FlightResult[] = response.hits.hits.map((hit: any) => {
        const flight = hit._source as Flight;
        return {
          id: flight.id,
          airline: flight.airline,
          flightNumber: flight.flightNumber,
          origin: flight.origin,
          destination: flight.destination,
          departureTime: new Date(flight.departureTime),
          arrivalTime: new Date(flight.arrivalTime),
          duration: flight.duration,
          stops: flight.stops.length,
          price: flight.price.amount,
          availableSeats: flight.availability.economy + flight.availability.business + flight.availability.first
        };
      });

      return flightResults;
    } catch (error) {
      console.error('Error searching flights:', error);
      
      // Use fallback service if Elasticsearch fails
      const { fallbackService } = await import('./fallbackService');
      console.warn('🔄 Falling back to local search');
      
      try {
        const fallbackResult = await fallbackService.searchFlightsFallback(searchRequest);
        return fallbackResult.flights;
      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError);
        throw new Error('Flight search service temporarily unavailable');
      }
    }
  }

  /**
   * Advanced flight search with flexible date range
   */
  async searchFlightsFlexible(
    origin: string,
    destination: string,
    centerDate: Date,
    dayRange: number = 3,
    filters?: FlightFilters
  ): Promise<{ [date: string]: FlightResult[] }> {
    try {
      const results: { [date: string]: FlightResult[] } = {};
      
      for (let i = -dayRange; i <= dayRange; i++) {
        const searchDate = new Date(centerDate);
        searchDate.setDate(centerDate.getDate() + i);
        
        const searchRequest: FlightSearchRequest = {
          origin,
          destination,
          departureDate: searchDate,
          passengers: 1,
          filters
        };

        try {
          const flights = await this.searchFlights(searchRequest);
          const dateKey = searchDate.toISOString().split('T')[0];
          results[dateKey] = flights;
        } catch (error) {
          console.warn(`Search failed for date ${searchDate.toDateString()}:`, error);
          const dateKey = searchDate.toISOString().split('T')[0];
          results[dateKey] = [];
        }
      }

      return results;
    } catch (error) {
      console.error('Error in flexible flight search:', error);
      throw error;
    }
  }

  /**
   * Get flight statistics for a route
   */
  async getRouteStatistics(origin: string, destination: string): Promise<{
    averagePrice: number;
    priceRange: { min: number; max: number };
    averageDuration: number;
    popularAirlines: Array<{ airline: string; count: number }>;
    directFlightPercentage: number;
  }> {
    try {
      const response = await this.client.search({
        index: this.flightIndex,
        body: {
          query: {
            bool: {
              must: [
                { term: { 'origin.code': origin } },
                { term: { 'destination.code': destination } }
              ]
            }
          },
          aggs: {
            avg_price: { avg: { field: 'price.amount' } },
            price_stats: { stats: { field: 'price.amount' } },
            avg_duration: { avg: { field: 'duration' } },
            airlines: { terms: { field: 'airline.keyword', size: 10 } },
            direct_flights: {
              filter: { term: { 'stops': [] } }
            },
            total_flights: {
              value_count: { field: 'id' }
            }
          },
          size: 0
        }
      });

      const aggs = response.aggregations as any;
      const totalFlights = aggs?.total_flights?.value || 0;
      const directFlights = aggs?.direct_flights?.doc_count || 0;

      return {
        averagePrice: Math.round(aggs?.avg_price?.value || 0),
        priceRange: {
          min: Math.round(aggs?.price_stats?.min || 0),
          max: Math.round(aggs?.price_stats?.max || 0)
        },
        averageDuration: Math.round(aggs?.avg_duration?.value || 0),
        popularAirlines: aggs?.airlines?.buckets?.map((bucket: any) => ({
          airline: bucket.key,
          count: bucket.doc_count
        })) || [],
        directFlightPercentage: totalFlights > 0 ? Math.round((directFlights / totalFlights) * 100) : 0
      };
    } catch (error) {
      console.error('Error getting route statistics:', error);
      throw error;
    }
  }

  /**
   * Get flight by ID
   */
  async getFlightById(flightId: string): Promise<Flight | null> {
    try {
      const response = await this.client.get({
        index: this.flightIndex,
        id: flightId
      });

      if (response.found) {
        const flight = response._source as Flight;
        // Convert date strings back to Date objects
        flight.departureTime = new Date(flight.departureTime);
        flight.arrivalTime = new Date(flight.arrivalTime);
        return flight;
      }

      return null;
    } catch (error: any) {
      if (error?.statusCode === 404) {
        return null;
      }
      console.error('Error getting flight by ID:', error);
      
      // Use fallback service if Elasticsearch fails
      const { fallbackService } = await import('./fallbackService');
      console.warn('🔄 Falling back to local flight lookup');
      
      try {
        const fallbackFlight = await fallbackService.getFlightByIdFallback(flightId);
        return fallbackFlight as unknown as Flight;
      } catch (fallbackError) {
        console.error('Fallback flight lookup also failed:', fallbackError);
        return null;
      }
    }
  }

  /**
   * Get airport suggestions based on partial input
   */
  async suggestAirports(query: string): Promise<Airport[]> {
    try {
      const response = await this.client.search({
        index: this.flightIndex,
        body: {
          query: {
            bool: {
              should: [
                { match: { 'origin.city': { query, boost: 2 } } },
                { match: { 'origin.name': query } },
                { prefix: { 'origin.code': query.toUpperCase() } },
                { match: { 'destination.city': { query, boost: 2 } } },
                { match: { 'destination.name': query } },
                { prefix: { 'destination.code': query.toUpperCase() } }
              ]
            }
          },
          aggs: {
            unique_origins: {
              terms: { field: 'origin.code', size: 10 }
            },
            unique_destinations: {
              terms: { field: 'destination.code', size: 10 }
            }
          },
          size: 0
        }
      });

      // Extract unique airports from aggregations
      const airports: Airport[] = [];
      const seenCodes = new Set<string>();

      // Process origin airports
      const originBuckets = (response.aggregations as any)?.unique_origins?.buckets;
      if (originBuckets) {
        for (const bucket of originBuckets) {
          if (!seenCodes.has(bucket.key)) {
            // Get airport details from a sample flight
            const sampleFlight = await this.client.search({
              index: this.flightIndex,
              body: {
                query: { term: { 'origin.code': bucket.key } },
                size: 1
              }
            });

            if (sampleFlight.hits.hits.length > 0) {
              const airport = (sampleFlight.hits.hits[0]._source as Flight).origin;
              airports.push(airport);
              seenCodes.add(bucket.key);
            }
          }
        }
      }

      // Process destination airports
      const destinationBuckets = (response.aggregations as any)?.unique_destinations?.buckets;
      if (destinationBuckets) {
        for (const bucket of destinationBuckets) {
          if (!seenCodes.has(bucket.key)) {
            // Get airport details from a sample flight
            const sampleFlight = await this.client.search({
              index: this.flightIndex,
              body: {
                query: { term: { 'destination.code': bucket.key } },
                size: 1
              }
            });

            if (sampleFlight.hits.hits.length > 0) {
              const airport = (sampleFlight.hits.hits[0]._source as Flight).destination;
              airports.push(airport);
              seenCodes.add(bucket.key);
            }
          }
        }
      }

      return airports.slice(0, 10); // Return top 10 suggestions
    } catch (error) {
      console.error('Error getting airport suggestions:', error);
      return [];
    }
  }

  /**
   * Delete all flights (for testing/reset purposes)
   */
  async deleteAllFlights(): Promise<void> {
    try {
      await this.client.deleteByQuery({
        index: this.flightIndex,
        body: {
          query: { match_all: {} }
        }
      });
      console.log('✅ Deleted all flights from index');
    } catch (error) {
      console.error('Error deleting flights:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const elasticsearchService = new ElasticsearchService();