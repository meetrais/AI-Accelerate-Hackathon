import { VertexAI } from '@google-cloud/vertexai';
import { config } from '../config';
import { FlightResult } from '../types';

export interface EmbeddingResult {
  embedding: number[];
  text: string;
  metadata?: any;
}

export class EmbeddingService {
  private vertexAI: VertexAI;
  private model: any;
  private requestCount: number = 0;
  private lastResetTime: number = Date.now();
  private readonly MAX_REQUESTS_PER_MINUTE = 50; // Conservative limit (below 60)
  private readonly DELAY_BETWEEN_REQUESTS = 1200; // 1.2 seconds (50 requests/min)
  private embeddingCache: Map<string, number[]> = new Map();

  constructor() {
    this.vertexAI = new VertexAI({
      project: config.googleCloud.projectId,
      location: config.googleCloud.location
    });
  }

  /**
   * Rate limiting helper
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceReset = now - this.lastResetTime;

    // Reset counter every minute
    if (timeSinceReset >= 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    // If we've hit the limit, wait
    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = 60000 - timeSinceReset;
      console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastResetTime = Date.now();
    }

    // Add delay between requests
    if (this.requestCount > 0) {
      await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_REQUESTS));
    }

    this.requestCount++;
  }

  /**
   * Initialize the embedding model
   */
  async initialize(): Promise<void> {
    try {
      // Note: All embedding models in Vertex AI SDK route through textembedding-gecko
      // which has quota limitations. Using the model anyway for when quota is available.
      this.model = this.vertexAI.preview.getGenerativeModel({
        model: 'text-embedding-004'
      });
      console.log('✅ Embedding service initialized');
      console.log('⚠️  Note: Embeddings require textembedding-gecko quota to be enabled');
    } catch (error) {
      console.error('❌ Failed to initialize embedding service:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Check cache first
      const cacheKey = text.substring(0, 100); // Use first 100 chars as key
      if (this.embeddingCache.has(cacheKey)) {
        return this.embeddingCache.get(cacheKey)!;
      }

      if (!this.model) {
        await this.initialize();
      }

      // Apply rate limiting
      await this.rateLimit();

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text }] }]
      });

      // Extract embedding from response
      const embedding = result.response?.candidates?.[0]?.content?.parts?.[0]?.embedding;
      
      if (!embedding) {
        throw new Error('No embedding returned from model');
      }

      // Cache the result
      this.embeddingCache.set(cacheKey, embedding);

      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    try {
      const embeddings = await Promise.all(
        texts.map(async (text) => ({
          embedding: await this.generateEmbedding(text),
          text
        }))
      );

      return embeddings;
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for a flight (semantic representation)
   */
  async generateFlightEmbedding(flight: FlightResult): Promise<EmbeddingResult> {
    const flightText = this.flightToText(flight);
    const embedding = await this.generateEmbedding(flightText);

    return {
      embedding,
      text: flightText,
      metadata: {
        flightId: flight.id,
        airline: flight.airline,
        route: `${flight.origin.code}-${flight.destination.code}`
      }
    };
  }

  /**
   * Generate embeddings for user query with context
   */
  async generateQueryEmbedding(
    query: string,
    context?: {
      previousQueries?: string[];
      userPreferences?: any;
      conversationHistory?: any[];
    }
  ): Promise<EmbeddingResult> {
    let enrichedQuery = query;

    // Enrich query with context
    if (context?.userPreferences) {
      const prefs = context.userPreferences;
      enrichedQuery += ` User preferences: ${JSON.stringify(prefs)}`;
    }

    if (context?.previousQueries && context.previousQueries.length > 0) {
      enrichedQuery += ` Previous context: ${context.previousQueries.slice(-2).join('. ')}`;
    }

    const embedding = await this.generateEmbedding(enrichedQuery);

    return {
      embedding,
      text: enrichedQuery,
      metadata: { originalQuery: query }
    };
  }

  /**
   * Convert flight to semantic text representation
   */
  private flightToText(flight: FlightResult): string {
    const parts: string[] = [];

    // Basic info
    parts.push(`${flight.airline} flight ${flight.flightNumber}`);
    parts.push(`from ${flight.origin.city} ${flight.origin.code}`);
    parts.push(`to ${flight.destination.city} ${flight.destination.code}`);

    // Time info
    const departureTime = flight.departureTime.toLocaleString('en-US', {
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
    parts.push(`departing ${departureTime}`);

    // Duration and stops
    const hours = Math.floor(flight.duration / 60);
    const minutes = flight.duration % 60;
    parts.push(`duration ${hours} hours ${minutes} minutes`);
    parts.push(flight.stops === 0 ? 'direct flight' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`);

    // Price
    parts.push(`price $${flight.price}`);

    // Availability
    parts.push(`${flight.availableSeats} seats available`);

    return parts.join(', ');
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Find most similar embeddings
   */
  findMostSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: EmbeddingResult[],
    topK: number = 5
  ): Array<EmbeddingResult & { similarity: number }> {
    const similarities = candidateEmbeddings.map(candidate => ({
      ...candidate,
      similarity: this.cosineSimilarity(queryEmbedding, candidate.embedding)
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
