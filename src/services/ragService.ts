import { vertexAIService } from './vertexai';
import { vectorSearchService } from './vectorSearchService';
import { embeddingService } from './embeddingService';
import { FlightResult } from '../types';

export interface RAGContext {
  query: string;
  retrievedFlights: FlightResult[];
  userPreferences?: any;
  conversationHistory?: any[];
  additionalContext?: string;
}

export interface RAGResponse {
  answer: string;
  sources: FlightResult[];
  confidence: number;
  reasoning?: string;
}

export class RAGService {
  /**
   * Generate response using Retrieval Augmented Generation
   */
  async generateRAGResponse(context: RAGContext): Promise<RAGResponse> {
    try {
      // Step 1: Retrieve relevant context
      const retrievedContext = await this.retrieveContext(context);

      // Step 2: Build augmented prompt
      const augmentedPrompt = this.buildAugmentedPrompt(context, retrievedContext);

      // Step 3: Generate response with Vertex AI
      const response = await vertexAIService.generateConversationalResponse(
        augmentedPrompt
      );

      // Step 4: Extract confidence and reasoning
      const { answer, confidence, reasoning } = this.parseResponse(response);

      return {
        answer,
        sources: retrievedContext.flights,
        confidence,
        reasoning
      };
    } catch (error) {
      console.error('❌ RAG generation failed:', error);
      throw error;
    }
  }

  /**
   * Answer questions about flights using RAG
   */
  async answerFlightQuestion(
    question: string,
    flightIds?: string[],
    additionalContext?: string
  ): Promise<RAGResponse> {
    try {
      let flights: FlightResult[] = [];

      if (flightIds && flightIds.length > 0) {
        // Retrieve specific flights
        const { elasticsearchService } = await import('./elasticsearch');
        const retrievedFlights = await Promise.all(
          flightIds.map(id => elasticsearchService.getFlightById(id))
        );
        
        // Convert Flight to FlightResult
        flights = retrievedFlights
          .filter(f => f !== null)
          .map(f => ({
            id: f!.id,
            airline: f!.airline,
            flightNumber: f!.flightNumber,
            origin: f!.origin,
            destination: f!.destination,
            departureTime: f!.departureTime,
            arrivalTime: f!.arrivalTime,
            duration: f!.duration,
            stops: Array.isArray(f!.stops) ? f!.stops.length : f!.stops,
            price: typeof f!.price === 'number' ? f!.price : f!.price.amount,
            availableSeats: f!.availableSeats || f!.availability?.economy || 0
          }));
      } else {
        // Semantic search for relevant flights
        const searchResults = await vectorSearchService.semanticSearch(question, {
          topK: 5,
          minScore: 0.6
        });
        flights = searchResults.map(r => r.flight);
      }

      return await this.generateRAGResponse({
        query: question,
        retrievedFlights: flights,
        additionalContext
      });
    } catch (error) {
      console.error('❌ Failed to answer flight question:', error);
      throw error;
    }
  }

  /**
   * Generate personalized recommendations using RAG
   */
  async generatePersonalizedRecommendations(
    userQuery: string,
    userPreferences: any,
    conversationHistory?: any[]
  ): Promise<RAGResponse> {
    try {
      // Semantic search with user context
      const enrichedQuery = this.enrichQueryWithPreferences(userQuery, userPreferences);
      
      const searchResults = await vectorSearchService.semanticSearch(enrichedQuery, {
        topK: 10,
        minScore: 0.5
      });

      const flights = searchResults.map(r => r.flight);

      // Generate personalized recommendations
      const prompt = `Based on the user's preferences and travel history, recommend the best flights.

User Query: ${userQuery}

User Preferences:
${JSON.stringify(userPreferences, null, 2)}

Available Flights:
${this.formatFlightsForPrompt(flights)}

Provide personalized recommendations with clear reasoning for each suggestion.
Consider the user's budget, time preferences, and past behavior.

Format your response as:
1. Primary Recommendation: [Flight details and why it's the best match]
2. Alternative Options: [2-3 other good options with reasoning]
3. Key Insights: [Important factors the user should consider]`;

      const response = await vertexAIService.generateConversationalResponse(
        prompt
      );

      return {
        answer: response,
        sources: flights,
        confidence: 0.85,
        reasoning: 'Personalized based on user preferences and behavior'
      };
    } catch (error) {
      console.error('❌ Failed to generate personalized recommendations:', error);
      throw error;
    }
  }

  /**
   * Explain flight policies in natural language
   */
  async explainPolicy(
    policyType: 'baggage' | 'cancellation' | 'change' | 'refund',
    airline: string,
    flightClass?: string
  ): Promise<RAGResponse> {
    try {
      // In a real system, you'd retrieve actual policy documents
      const policyContext = this.getPolicyContext(policyType, airline, flightClass);

      const prompt = `Explain the ${policyType} policy for ${airline} in simple, clear language.

Policy Details:
${policyContext}

Provide:
1. A clear summary of the policy
2. Key points travelers should know
3. Any exceptions or special cases
4. Practical advice for travelers

Use friendly, conversational language that's easy to understand.`;

      const response = await vertexAIService.generateConversationalResponse(prompt);

      return {
        answer: response,
        sources: [],
        confidence: 0.9,
        reasoning: `Policy explanation for ${airline} ${policyType}`
      };
    } catch (error) {
      console.error('❌ Failed to explain policy:', error);
      throw error;
    }
  }

  /**
   * Generate travel itinerary with AI insights
   */
  async generateItinerary(
    flights: FlightResult[],
    destination: string,
    tripDuration: number,
    interests?: string[]
  ): Promise<RAGResponse> {
    try {
      const prompt = `Create a comprehensive travel itinerary for a trip to ${destination}.

Flight Details:
${this.formatFlightsForPrompt(flights)}

Trip Duration: ${tripDuration} days
Traveler Interests: ${interests?.join(', ') || 'General sightseeing'}

Generate a detailed itinerary including:
1. Day-by-day schedule
2. Recommended activities based on interests
3. Local tips and insights
4. Transportation suggestions
5. Dining recommendations
6. Important travel considerations

Make it practical, personalized, and exciting!`;

      const response = await vertexAIService.generateConversationalResponse(prompt);

      return {
        answer: response,
        sources: flights,
        confidence: 0.8,
        reasoning: 'AI-generated itinerary based on destination and interests'
      };
    } catch (error) {
      console.error('❌ Failed to generate itinerary:', error);
      throw error;
    }
  }

  /**
   * Retrieve relevant context for RAG
   */
  private async retrieveContext(context: RAGContext): Promise<{
    flights: FlightResult[];
    relevanceScores: number[];
  }> {
    let flights = context.retrievedFlights || [];
    const relevanceScores: number[] = [];

    // If no flights provided, do semantic search
    if (flights.length === 0) {
      const searchResults = await vectorSearchService.semanticSearch(context.query, {
        topK: 5,
        minScore: 0.6
      });
      
      flights = searchResults.map(r => r.flight);
      relevanceScores.push(...searchResults.map(r => r.similarity));
    } else {
      // Calculate relevance scores for provided flights
      const queryEmbedding = await embeddingService.generateEmbedding(context.query);
      
      for (const flight of flights) {
        const flightEmbedding = await embeddingService.generateFlightEmbedding(flight);
        const similarity = embeddingService.cosineSimilarity(
          queryEmbedding,
          flightEmbedding.embedding
        );
        relevanceScores.push(similarity);
      }
    }

    return { flights, relevanceScores };
  }

  /**
   * Build augmented prompt with retrieved context
   */
  private buildAugmentedPrompt(
    context: RAGContext,
    retrievedContext: { flights: FlightResult[]; relevanceScores: number[] }
  ): string {
    let prompt = `You are an expert flight booking assistant. Answer the user's question using the provided flight information.

User Question: ${context.query}

`;

    // Add flight context
    if (retrievedContext.flights.length > 0) {
      prompt += `Available Flight Information:\n`;
      retrievedContext.flights.forEach((flight, index) => {
        prompt += `\nFlight ${index + 1} (Relevance: ${(retrievedContext.relevanceScores[index] * 100).toFixed(1)}%):\n`;
        prompt += this.formatFlightForPrompt(flight);
      });
      prompt += '\n';
    }

    // Add user preferences
    if (context.userPreferences) {
      prompt += `\nUser Preferences:\n${JSON.stringify(context.userPreferences, null, 2)}\n`;
    }

    // Add additional context
    if (context.additionalContext) {
      prompt += `\nAdditional Context:\n${context.additionalContext}\n`;
    }

    prompt += `\nProvide a helpful, accurate response based on the flight information above. 
If the information doesn't fully answer the question, acknowledge what you know and what you don't.
Be conversational and friendly while being precise and informative.`;

    return prompt;
  }

  /**
   * Format flight for prompt
   */
  private formatFlightForPrompt(flight: FlightResult): string {
    return `- ${flight.airline} ${flight.flightNumber}
  Route: ${flight.origin.city} (${flight.origin.code}) → ${flight.destination.city} (${flight.destination.code})
  Departure: ${flight.departureTime.toLocaleString()}
  Arrival: ${flight.arrivalTime.toLocaleString()}
  Duration: ${Math.floor(flight.duration / 60)}h ${flight.duration % 60}m
  Stops: ${flight.stops === 0 ? 'Direct' : `${flight.stops} stop(s)`}
  Price: $${flight.price}
  Available Seats: ${flight.availableSeats}
`;
  }

  /**
   * Format multiple flights for prompt
   */
  private formatFlightsForPrompt(flights: FlightResult[]): string {
    return flights.map((flight, index) => 
      `Flight ${index + 1}:\n${this.formatFlightForPrompt(flight)}`
    ).join('\n');
  }

  /**
   * Format conversation history
   */
  private formatConversationHistory(history?: any[]): string {
    if (!history || history.length === 0) {
      return '';
    }

    return history
      .slice(-5) // Last 5 messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  /**
   * Enrich query with user preferences
   */
  private enrichQueryWithPreferences(query: string, preferences: any): string {
    const prefParts: string[] = [query];

    if (preferences.budgetRange) {
      prefParts.push(`budget: ${preferences.budgetRange}`);
    }
    if (preferences.timePreference) {
      prefParts.push(`prefers ${preferences.timePreference} flights`);
    }
    if (preferences.stopPreference) {
      prefParts.push(`prefers ${preferences.stopPreference} flights`);
    }
    if (preferences.airlinePreferences?.length > 0) {
      prefParts.push(`prefers airlines: ${preferences.airlinePreferences.join(', ')}`);
    }

    return prefParts.join(', ');
  }

  /**
   * Parse AI response to extract confidence and reasoning
   */
  private parseResponse(response: string): {
    answer: string;
    confidence: number;
    reasoning?: string;
  } {
    // Simple confidence estimation based on response characteristics
    let confidence = 0.7;

    if (response.includes('recommend') || response.includes('suggest')) {
      confidence += 0.1;
    }
    if (response.includes('based on') || response.includes('because')) {
      confidence += 0.1;
    }
    if (response.length > 200) {
      confidence += 0.05;
    }

    confidence = Math.min(confidence, 0.95);

    return {
      answer: response,
      confidence,
      reasoning: 'Generated using RAG with retrieved flight data'
    };
  }

  /**
   * Get policy context (mock - in real system, retrieve from database)
   */
  private getPolicyContext(
    policyType: string,
    airline: string,
    flightClass?: string
  ): string {
    // Mock policy data - in production, retrieve from database
    const policies: any = {
      baggage: {
        default: `
- Carry-on: 1 bag (22x14x9 inches, max 15 lbs)
- Personal item: 1 item (purse, laptop bag, etc.)
- Checked bags: Fees apply ($30 first bag, $40 second bag)
- Weight limit: 50 lbs per checked bag
- Overweight fees: $100 for 51-70 lbs, $200 for 71-100 lbs
        `
      },
      cancellation: {
        default: `
- Cancellation within 24 hours of booking: Full refund
- Cancellation 7+ days before departure: $200 fee
- Cancellation 2-6 days before departure: $300 fee
- Cancellation within 48 hours: No refund (credit only)
- Non-refundable tickets: Credit for future travel minus fees
        `
      },
      change: {
        default: `
- Changes within 24 hours of booking: Free
- Changes 7+ days before departure: $75 fee + fare difference
- Changes 2-6 days before departure: $150 fee + fare difference
- Same-day changes: $75 (subject to availability)
- Name changes: Not permitted
        `
      },
      refund: {
        default: `
- Refundable tickets: Full refund to original payment method
- Non-refundable tickets: Travel credit only
- Processing time: 7-10 business days
- Cancellation fees apply based on timing
- Travel credits valid for 1 year from original booking
        `
      }
    };

    return policies[policyType]?.default || 'Policy information not available';
  }
}

// Export singleton instance
export const ragService = new RAGService();
