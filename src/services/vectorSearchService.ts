import { elasticsearchService } from './elasticsearch';
import { embeddingService } from './embeddingService';
import { FlightResult, ExtractedTravelParams } from '../types';

export interface VectorSearchOptions {
  topK?: number;
  minScore?: number;
  filters?: any;
  boostFactors?: {
    price?: number;
    duration?: number;
    stops?: number;
  };
}

export interface VectorSearchResult {
  flight: FlightResult;
  score: number;
  similarity: number;
  explanation?: string;
}

export class VectorSearchService {
  private readonly FLIGHTS_INDEX = 'flights';
  private readonly EMBEDDING_FIELD = 'embedding';

  /**
   * Index flight with embedding
   */
  async indexFlightWithEmbedding(flight: FlightResult): Promise<void> {
    try {
      // Generate embedding for the flight
      const embeddingResult = await embeddingService.generateFlightEmbedding(flight);

      // Index in Elasticsearch with embedding
      await elasticsearchService.getClient().index({
        index: this.FLIGHTS_INDEX,
        id: flight.id,
        body: {
          ...flight,
          embedding: embeddingResult.embedding,
          embeddingText: embeddingResult.text,
          indexedAt: new Date().toISOString()
        }
      });

      console.log(`✅ Indexed flight ${flight.id} with embedding`);
    } catch (error) {
      console.error(`❌ Failed to index flight ${flight.id}:`, error);
      throw error;
    }
  }

  /**
   * Batch index flights with embeddings
   */
  async batchIndexFlights(flights: FlightResult[]): Promise<void> {
    try {
      console.log(`🔄 Batch indexing ${flights.length} flights with embeddings...`);
      console.log(`⏱️  Estimated time: ~${Math.ceil(flights.length * 1.2 / 60)} minutes (rate limited to 50/min)`);

      const operations = [];
      let processed = 0;
      
      for (const flight of flights) {
        const embeddingResult = await embeddingService.generateFlightEmbedding(flight);
        
        operations.push(
          { index: { _index: this.FLIGHTS_INDEX, _id: flight.id } },
          {
            ...flight,
            embedding: embeddingResult.embedding,
            embeddingText: embeddingResult.text,
            indexedAt: new Date().toISOString()
          }
        );

        processed++;
        if (processed % 10 === 0) {
          console.log(`   Progress: ${processed}/${flights.length} flights (${Math.round(processed/flights.length*100)}%)`);
        }
      }

      if (operations.length > 0) {
        console.log(`📤 Uploading ${flights.length} flights to Elasticsearch...`);
        await elasticsearchService.getClient().bulk({ body: operations });
        console.log(`✅ Batch indexed ${flights.length} flights with embeddings`);
      }
    } catch (error) {
      console.error('❌ Batch indexing failed:', error);
      throw error;
    }
  }

  /**
   * Semantic search using vector similarity
   */
  async semanticSearch(
    query: string,
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    try {
      const {
        topK = 10,
        minScore = 0.7,
        filters = {},
        boostFactors = {}
      } = options;

      // Generate query embedding
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      // Build Elasticsearch query with kNN search
      const searchBody: any = {
        knn: {
          field: this.EMBEDDING_FIELD,
          query_vector: queryEmbedding,
          k: topK,
          num_candidates: topK * 3
        },
        size: topK
      };

      // Add filters if provided
      if (Object.keys(filters).length > 0) {
        searchBody.query = {
          bool: {
            filter: this.buildFilters(filters)
          }
        };
      }

      // Execute search
      const response = await elasticsearchService.getClient().search({
        index: this.FLIGHTS_INDEX,
        body: searchBody
      });

      // Process results
      const results: VectorSearchResult[] = response.hits.hits
        .filter((hit: any) => hit._score >= minScore)
        .map((hit: any) => ({
          flight: this.mapToFlightResult(hit._source),
          score: hit._score,
          similarity: hit._score,
          explanation: `Semantic match score: ${hit._score.toFixed(3)}`
        }));

      return results;
    } catch (error) {
      console.error('❌ Semantic search failed:', error);
      throw error;
    }
  }

  /**
   * Hybrid search combining vector similarity and traditional search
   */
  async hybridSearch(
    query: string,
    searchParams: Partial<ExtractedTravelParams>,
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    try {
      const {
        topK = 10,
        minScore = 0.5,
        boostFactors = { price: 1.0, duration: 1.0, stops: 1.0 }
      } = options;

      // Generate query embedding
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      // Build hybrid query
      const searchBody: any = {
        size: topK,
        query: {
          bool: {
            should: [
              // Vector similarity (semantic search)
              {
                script_score: {
                  query: { match_all: {} },
                  script: {
                    source: `
                      cosineSimilarity(params.query_vector, '${this.EMBEDDING_FIELD}') + 1.0
                    `,
                    params: {
                      query_vector: queryEmbedding
                    }
                  }
                }
              },
              // Traditional text search
              {
                multi_match: {
                  query: query,
                  fields: ['airline^2', 'origin.city^1.5', 'destination.city^1.5', 'flightNumber'],
                  boost: 0.5
                }
              }
            ],
            filter: this.buildFilters(searchParams)
          }
        }
      };

      // Add sorting with boost factors
      if (Object.keys(boostFactors).length > 0) {
        searchBody.sort = [
          '_score',
          { price: { order: 'asc', boost: boostFactors.price || 1.0 } },
          { duration: { order: 'asc', boost: boostFactors.duration || 1.0 } },
          { stops: { order: 'asc', boost: boostFactors.stops || 1.0 } }
        ];
      }

      // Execute search
      const response = await elasticsearchService.getClient().search({
        index: this.FLIGHTS_INDEX,
        body: searchBody
      });

      // Process results
      const results: VectorSearchResult[] = response.hits.hits
        .filter((hit: any) => hit._score >= minScore)
        .map((hit: any) => ({
          flight: this.mapToFlightResult(hit._source),
          score: hit._score,
          similarity: hit._score,
          explanation: `Hybrid score: ${hit._score.toFixed(3)} (semantic + traditional)`
        }));

      return results;
    } catch (error) {
      console.error('❌ Hybrid search failed:', error);
      throw error;
    }
  }

  /**
   * Find similar flights based on a reference flight
   */
  async findSimilarFlights(
    flightId: string,
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    try {
      const { topK = 5 } = options;

      // Get the reference flight
      const flight = await elasticsearchService.getFlightById(flightId);
      if (!flight) {
        throw new Error(`Flight ${flightId} not found`);
      }

      // Get its embedding
      const response = await elasticsearchService.getClient().get({
        index: this.FLIGHTS_INDEX,
        id: flightId
      });

      const embedding = (response._source as any).embedding;
      if (!embedding) {
        throw new Error(`No embedding found for flight ${flightId}`);
      }

      // Search for similar flights
      const searchBody = {
        knn: {
          field: this.EMBEDDING_FIELD,
          query_vector: embedding,
          k: topK + 1, // +1 to exclude the reference flight
          num_candidates: (topK + 1) * 3
        },
        size: topK + 1
      };

      const searchResponse = await elasticsearchService.getClient().search({
        index: this.FLIGHTS_INDEX,
        body: searchBody
      });

      // Filter out the reference flight and process results
      const results: VectorSearchResult[] = searchResponse.hits.hits
        .filter((hit: any) => hit._id !== flightId)
        .slice(0, topK)
        .map((hit: any) => ({
          flight: this.mapToFlightResult(hit._source),
          score: hit._score,
          similarity: hit._score,
          explanation: `Similar to ${flight.airline} ${flight.flightNumber}`
        }));

      return results;
    } catch (error) {
      console.error('❌ Find similar flights failed:', error);
      throw error;
    }
  }

  /**
   * Build Elasticsearch filters from search parameters
   */
  private buildFilters(params: any): any[] {
    const filters: any[] = [];

    if (params.origin) {
      filters.push({
        term: { 'origin.code': params.origin }
      });
    }

    if (params.destination) {
      filters.push({
        term: { 'destination.code': params.destination }
      });
    }

    if (params.departureDate) {
      const date = new Date(params.departureDate);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      filters.push({
        range: {
          departureTime: {
            gte: startOfDay.toISOString(),
            lte: endOfDay.toISOString()
          }
        }
      });
    }

    if (params.maxPrice) {
      filters.push({
        range: { price: { lte: params.maxPrice } }
      });
    }

    if (params.maxStops !== undefined) {
      filters.push({
        range: { stops: { lte: params.maxStops } }
      });
    }

    if (params.airlines && params.airlines.length > 0) {
      filters.push({
        terms: { airline: params.airlines }
      });
    }

    return filters;
  }

  /**
   * Map Elasticsearch source to FlightResult
   */
  private mapToFlightResult(source: any): FlightResult {
    return {
      id: source.id,
      airline: source.airline,
      flightNumber: source.flightNumber,
      origin: source.origin,
      destination: source.destination,
      departureTime: new Date(source.departureTime),
      arrivalTime: new Date(source.arrivalTime),
      duration: source.duration,
      stops: source.stops,
      price: source.price,
      availableSeats: source.availableSeats
    };
  }

  /**
   * Ensure index has proper mapping for vector search
   */
  async ensureIndexMapping(): Promise<void> {
    try {
      const indexExists = await elasticsearchService.getClient().indices.exists({
        index: this.FLIGHTS_INDEX
      });

      if (!indexExists) {
        await elasticsearchService.getClient().indices.create({
          index: this.FLIGHTS_INDEX,
          body: {
            mappings: {
              properties: {
                embedding: {
                  type: 'dense_vector',
                  dims: 768, // text-embedding-004 dimension
                  index: true,
                  similarity: 'cosine'
                },
                embeddingText: { type: 'text' },
                airline: { type: 'keyword' },
                flightNumber: { type: 'keyword' },
                origin: {
                  properties: {
                    code: { type: 'keyword' },
                    city: { type: 'text' },
                    name: { type: 'text' }
                  }
                },
                destination: {
                  properties: {
                    code: { type: 'keyword' },
                    city: { type: 'text' },
                    name: { type: 'text' }
                  }
                },
                departureTime: { type: 'date' },
                arrivalTime: { type: 'date' },
                duration: { type: 'integer' },
                stops: { type: 'integer' },
                price: { type: 'float' },
                availableSeats: { type: 'integer' }
              }
            }
          }
        });

        console.log('✅ Created flights index with vector search mapping');
      }
    } catch (error) {
      console.error('❌ Failed to ensure index mapping:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const vectorSearchService = new VectorSearchService();
