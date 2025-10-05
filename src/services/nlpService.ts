import { vertexAIService } from './vertexai';
import { sessionManager } from './sessionManager';
import { elasticsearchService } from './elasticsearch';
import { 
  TravelQuery, 
  ExtractedTravelParams, 
  ConversationRequest, 
  ConversationResponse,
  FlightResult,
  ConversationMessage
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class NLPService {
  /**
   * Process natural language travel query
   */
  async processTravelQuery(query: TravelQuery): Promise<{
    params: ExtractedTravelParams;
    searchResults: FlightResult[];
    response: string;
  }> {
    try {
      // Get or create session
      const session = sessionManager.getOrCreateSession(query.sessionId);

      // Extract travel parameters using Vertex AI
      const params = await vertexAIService.extractTravelParams(query);

      // Update session with extracted parameters
      sessionManager.updateSessionQuery(query.sessionId, params);

      // Search for flights if we have enough information
      let searchResults: FlightResult[] = [];
      let response = '';

      if (params.origin && params.destination && params.departureDate) {
        try {
          // Perform flight search
          searchResults = await elasticsearchService.searchFlights({
            origin: params.origin,
            destination: params.destination,
            departureDate: params.departureDate,
            returnDate: params.returnDate,
            passengers: params.passengers || 1
          });

          // Update session with results
          sessionManager.updateSessionResults(query.sessionId, searchResults);

          // Generate conversational response about the results
          const context = sessionManager.getConversationContext(query.sessionId);
          response = await vertexAIService.generateConversationalResponse(
            query.userMessage,
            context,
            searchResults
          );

        } catch (searchError) {
          console.error('Flight search error:', searchError);
          response = await this.handleSearchError(params, query.userMessage);
        }
      } else {
        // Need more information - ask clarifying questions
        response = await this.generateClarificationResponse(params, query.userMessage);
      }

      // Add messages to conversation history
      const userMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'user',
        content: query.userMessage,
        timestamp: new Date()
      };

      const assistantMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        metadata: { searchResults: searchResults.length }
      };

      sessionManager.addMessage(query.sessionId, userMessage);
      sessionManager.addMessage(query.sessionId, assistantMessage);

      return {
        params,
        searchResults,
        response
      };

    } catch (error) {
      console.error('Error processing travel query:', error);
      
      // Fallback response
      const fallbackResponse = await this.generateFallbackResponse(query.userMessage);
      
      return {
        params: { passengers: 1 },
        searchResults: [],
        response: fallbackResponse
      };
    }
  }

  /**
   * Handle conversational requests (follow-up questions, clarifications)
   */
  async handleConversation(request: ConversationRequest): Promise<ConversationResponse> {
    try {
      // Use the enhanced conversation service for better handling
      const { conversationService } = await import('./conversationService');
      return await conversationService.handleConversation(request);

    } catch (error) {
      console.error('Error handling conversation:', error);
      
      // Fallback to basic conversation handling
      const context = sessionManager.getConversationContext(request.sessionId);
      
      // Check if this is a flight selection
      const flightSelection = this.extractFlightSelection(request.message);
      if (flightSelection && context.searchResults) {
        const selectedFlight = context.searchResults[flightSelection - 1];
        if (selectedFlight) {
          sessionManager.setSelectedFlight(request.sessionId, selectedFlight);
          
          return {
            message: `Great choice! I've selected the ${selectedFlight.airline} flight ${selectedFlight.flightNumber} for $${selectedFlight.price}. Would you like to proceed with booking or need more details about this flight?`,
            flightOptions: [selectedFlight],
            suggestedActions: ['Book this flight', 'Get flight details', 'See other options'],
            bookingStep: 'flight_selection'
          };
        }
      }

      // Check if asking for alternatives or modifications
      if (this.isRequestingAlternatives(request.message)) {
        return await this.handleAlternativeRequest(request, context);
      }

      // Generate general conversational response
      const response = await vertexAIService.generateConversationalResponse(
        request.message,
        context,
        request.flightResults || context.searchResults
      );

      // Add to conversation history
      const userMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'user',
        content: request.message,
        timestamp: new Date()
      };

      const assistantMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      sessionManager.addMessage(request.sessionId, userMessage);
      sessionManager.addMessage(request.sessionId, assistantMessage);

      return {
        message: response,
        flightOptions: context.searchResults?.slice(0, 3),
        suggestedActions: this.generateSuggestedActions(context)
      };
    }
  }

  /**
   * Generate clarification response when missing information
   */
  private async generateClarificationResponse(
    params: ExtractedTravelParams,
    originalMessage: string
  ): Promise<string> {
    const missing: string[] = [];
    
    if (!params.origin) missing.push('departure city');
    if (!params.destination) missing.push('destination city');
    if (!params.departureDate) missing.push('travel date');

    if (missing.length === 0) {
      return "I have all the information I need. Let me search for flights for you.";
    }

    const prompt = `The user said: "${originalMessage}"

I was able to extract: ${JSON.stringify(params)}

But I'm missing: ${missing.join(', ')}

Generate a friendly, conversational response asking for the missing information. Be specific about what you need.

Response:`;

    try {
      const result = await vertexAIService.generateConversationalResponse(prompt);
      return result;
    } catch (error) {
      return `I'd love to help you find flights! I need a bit more information: ${missing.join(', ')}. Could you please provide these details?`;
    }
  }

  /**
   * Handle search errors with helpful responses
   */
  private async handleSearchError(
    params: ExtractedTravelParams,
    originalMessage: string
  ): Promise<string> {
    try {
      // Try to suggest alternatives
      if (params.origin && params.destination && params.departureDate) {
        const suggestions = await vertexAIService.suggestAlternativeDates(
          params.origin,
          params.destination,
          params.departureDate
        );
        
        return `I couldn't find flights for your exact search, but here are some suggestions:\n\n${suggestions}`;
      }
      
      return "I'm having trouble finding flights for your request. Could you try different dates or nearby airports?";
    } catch (error) {
      return "I'm sorry, I'm having trouble searching for flights right now. Please try again in a moment.";
    }
  }

  /**
   * Generate fallback response for errors
   */
  private async generateFallbackResponse(message: string): Promise<string> {
    const fallbacks = [
      "I'd be happy to help you find flights! Could you tell me where you'd like to fly from and to?",
      "Let me help you search for flights. What's your departure city and destination?",
      "I can help you find the perfect flight. Where are you planning to travel?",
      "I'm here to help with your flight search. Could you share your travel plans with me?"
    ];

    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  /**
   * Extract flight selection from user message
   */
  private extractFlightSelection(message: string): number | null {
    const patterns = [
      /(?:select|choose|pick|book|take)\s+(?:flight\s+)?(?:number\s+)?(\d+)/i,
      /(?:option|choice)\s+(\d+)/i,
      /^(\d+)$/,
      /first|1st/i,
      /second|2nd/i,
      /third|3rd/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        if (match[1]) {
          return parseInt(match[1]);
        } else if (pattern.source.includes('first|1st')) {
          return 1;
        } else if (pattern.source.includes('second|2nd')) {
          return 2;
        } else if (pattern.source.includes('third|3rd')) {
          return 3;
        }
      }
    }

    return null;
  }

  /**
   * Check if user is requesting alternatives
   */
  private isRequestingAlternatives(message: string): boolean {
    const alternativeKeywords = [
      'other options', 'alternatives', 'different flights', 'other flights',
      'cheaper', 'earlier', 'later', 'different time', 'other dates'
    ];

    return alternativeKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  /**
   * Handle requests for alternatives
   */
  private async handleAlternativeRequest(
    request: ConversationRequest,
    context: any
  ): Promise<ConversationResponse> {
    if (context.previousQueries && context.previousQueries.length > 0) {
      const lastQuery = context.previousQueries[context.previousQueries.length - 1];
      
      if (lastQuery.origin && lastQuery.destination && lastQuery.departureDate) {
        try {
          // Search with broader criteria or different dates
          const alternativeDate = new Date(lastQuery.departureDate);
          alternativeDate.setDate(alternativeDate.getDate() + 1);
          
          const alternatives = await elasticsearchService.searchFlights({
            origin: lastQuery.origin,
            destination: lastQuery.destination,
            departureDate: alternativeDate,
            passengers: lastQuery.passengers || 1
          });

          sessionManager.updateSessionResults(request.sessionId, alternatives);

          return {
            message: `Here are some alternative flights for ${lastQuery.origin} to ${lastQuery.destination}:`,
            flightOptions: alternatives.slice(0, 3),
            suggestedActions: ['Select a flight', 'Try different dates', 'Modify search']
          };
        } catch (error) {
          console.error('Error finding alternatives:', error);
        }
      }
    }

    return {
      message: "I'd be happy to show you alternatives! Could you let me know what specific changes you're looking for - different dates, times, or price range?",
      suggestedActions: ['Search new dates', 'Filter by price', 'Change airports']
    };
  }

  /**
   * Generate suggested actions based on context
   */
  private generateSuggestedActions(context: any): string[] {
    const actions: string[] = [];

    if (context.searchResults && context.searchResults.length > 0) {
      actions.push('Select a flight', 'See more options', 'Modify search');
    }

    if (context.selectedFlight) {
      actions.push('Book this flight', 'Get flight details', 'Choose different flight');
    }

    if (context.previousQueries && context.previousQueries.length > 0) {
      actions.push('Try different dates', 'Search new destination');
    }

    if (actions.length === 0) {
      actions.push('Search for flights', 'Get help');
    }

    return actions;
  }
}

// Export singleton instance
export const nlpService = new NLPService();