import { vertexAIService } from './vertexai';
import { sessionManager } from './sessionManager';
import { hybridSearchService } from './hybridSearch';
import { flightRecommendationService } from './flightRecommendation';
import { elasticsearchService } from './elasticsearch';
import { 
  ConversationRequest, 
  ConversationResponse, 
  FlightResult, 
  ExtractedTravelParams,
  ConversationMessage,
  UserPreferences
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface ConversationContext {
  currentStep: 'search' | 'results' | 'selection' | 'comparison' | 'booking';
  searchParams?: ExtractedTravelParams;
  searchResults?: FlightResult[];
  selectedFlights?: FlightResult[];
  userPreferences?: UserPreferences;
  lastRecommendations?: any;
}

export class ConversationService {
  /**
   * Handle conversational flight search and recommendations
   */
  async handleConversation(request: ConversationRequest): Promise<ConversationResponse> {
    try {
      // Get or create session
      const session = sessionManager.getOrCreateSession(request.sessionId, request.userId);
      
      // Determine conversation intent
      const intent = await this.analyzeIntent(request.message, session);
      
      // Route to appropriate handler
      switch (intent.type) {
        case 'flight_search':
          return await this.handleFlightSearch(request, intent);
        
        case 'flight_selection':
          return await this.handleFlightSelection(request, intent);
        
        case 'flight_comparison':
          return await this.handleFlightComparison(request, intent);
        
        case 'preference_update':
          return await this.handlePreferenceUpdate(request, intent);
        
        case 'recommendation_request':
          return await this.handleRecommendationRequest(request, intent);
        
        case 'general_inquiry':
          return await this.handleGeneralInquiry(request, intent);
        
        default:
          return await this.handleFallback(request);
      }

    } catch (error) {
      console.error('Conversation handling error:', error);
      return this.generateErrorResponse(request.sessionId);
    }
  }

  /**
   * Analyze user intent from message
   */
  private async analyzeIntent(message: string, session: any): Promise<{
    type: string;
    confidence: number;
    entities: any;
  }> {
    try {
      const prompt = `Analyze this user message and determine the intent. Consider the conversation context.

User message: "${message}"

Previous context: ${JSON.stringify(session.conversationHistory?.slice(-3) || [])}

Classify the intent as one of:
- flight_search: User wants to search for flights
- flight_selection: User is selecting/choosing a specific flight
- flight_comparison: User wants to compare flights
- preference_update: User is updating their preferences (budget, time, etc.)
- recommendation_request: User wants recommendations or advice
- general_inquiry: General questions about flights, policies, etc.

Return JSON format:
{
  "type": "intent_type",
  "confidence": 0.0-1.0,
  "entities": {
    "flightNumber": "if mentioned",
    "preference": "if updating preferences",
    "comparison": "if comparing flights"
  }
}`;

      const response = await vertexAIService.generateConversationalResponse(prompt);
      
      try {
        const parsed = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] || '{}');
        return {
          type: parsed.type || 'general_inquiry',
          confidence: parsed.confidence || 0.5,
          entities: parsed.entities || {}
        };
      } catch (parseError) {
        // Fallback intent analysis
        return this.fallbackIntentAnalysis(message);
      }

    } catch (error) {
      console.error('Intent analysis error:', error);
      return this.fallbackIntentAnalysis(message);
    }
  }

  /**
   * Fallback intent analysis using keyword matching
   */
  private fallbackIntentAnalysis(message: string): {
    type: string;
    confidence: number;
    entities: any;
  } {
    const lowerMessage = message.toLowerCase();

    // Flight search patterns
    if (lowerMessage.includes('search') || lowerMessage.includes('find') || 
        lowerMessage.includes('flight') || lowerMessage.includes('fly')) {
      return { type: 'flight_search', confidence: 0.7, entities: {} };
    }

    // Selection patterns
    if (lowerMessage.includes('select') || lowerMessage.includes('choose') || 
        lowerMessage.includes('book') || /\b(first|second|third|\d+)\b/.test(lowerMessage)) {
      return { type: 'flight_selection', confidence: 0.8, entities: {} };
    }

    // Comparison patterns
    if (lowerMessage.includes('compare') || lowerMessage.includes('difference') || 
        lowerMessage.includes('versus') || lowerMessage.includes('vs')) {
      return { type: 'flight_comparison', confidence: 0.8, entities: {} };
    }

    // Preference patterns
    if (lowerMessage.includes('prefer') || lowerMessage.includes('budget') || 
        lowerMessage.includes('cheaper') || lowerMessage.includes('faster')) {
      return { type: 'preference_update', confidence: 0.7, entities: {} };
    }

    // Recommendation patterns
    if (lowerMessage.includes('recommend') || lowerMessage.includes('suggest') || 
        lowerMessage.includes('best') || lowerMessage.includes('advice')) {
      return { type: 'recommendation_request', confidence: 0.7, entities: {} };
    }

    return { type: 'general_inquiry', confidence: 0.5, entities: {} };
  }

  /**
   * Handle flight search requests
   */
  private async handleFlightSearch(
    request: ConversationRequest, 
    intent: any
  ): Promise<ConversationResponse> {
    try {
      // Extract travel parameters using existing NLP service
      const { nlpService } = await import('./nlpService');
      const travelQuery = {
        userMessage: request.message,
        sessionId: request.sessionId,
        context: sessionManager.getConversationContext(request.sessionId)
      };

      const searchResult = await nlpService.processTravelQuery(travelQuery);

      if (searchResult.searchResults.length === 0) {
        return {
          message: searchResult.response,
          suggestedActions: ['Try different dates', 'Search nearby airports', 'Adjust preferences']
        };
      }

      // Generate recommendations for the search results
      const recommendations = await flightRecommendationService.generateRecommendations(
        searchResult.searchResults,
        searchResult.params
      );

      // Create conversational response about the results
      const conversationalResponse = await this.generateSearchResultsResponse(
        searchResult.searchResults,
        recommendations,
        searchResult.params
      );

      return {
        message: conversationalResponse,
        flightOptions: searchResult.searchResults.slice(0, 5),
        suggestedActions: [
          'Select a flight',
          'Compare options',
          'See more flights',
          'Modify search'
        ],
        bookingStep: 'flight_selection'
      };

    } catch (error) {
      console.error('Flight search handling error:', error);
      return {
        message: "I'm having trouble searching for flights right now. Could you try rephrasing your request?",
        suggestedActions: ['Try again', 'Contact support']
      };
    }
  }

  /**
   * Handle flight selection
   */
  private async handleFlightSelection(
    request: ConversationRequest, 
    intent: any
  ): Promise<ConversationResponse> {
    try {
      const session = sessionManager.getSession(request.sessionId);
      if (!session?.searchResults || session.searchResults.length === 0) {
        return {
          message: "I don't see any flight options to select from. Would you like to search for flights first?",
          suggestedActions: ['Search for flights', 'Start over']
        };
      }

      // Extract flight selection from message
      const selectionIndex = this.extractFlightSelection(request.message);
      
      if (selectionIndex === null || selectionIndex > session.searchResults.length) {
        return {
          message: `I couldn't understand which flight you'd like to select. Please choose from flights 1-${session.searchResults.length}.`,
          flightOptions: session.searchResults.slice(0, 3),
          suggestedActions: session.searchResults.map((_, i) => `Select flight ${i + 1}`)
        };
      }

      const selectedFlight = session.searchResults[selectionIndex - 1];
      sessionManager.setSelectedFlight(request.sessionId, selectedFlight);

      // Generate detailed flight information
      const flightDetails = await this.generateFlightDetailsResponse(selectedFlight);

      return {
        message: flightDetails,
        flightOptions: [selectedFlight],
        suggestedActions: [
          'Book this flight',
          'Get more details',
          'Compare with others',
          'Choose different flight'
        ],
        bookingStep: 'passenger_info'
      };

    } catch (error) {
      console.error('Flight selection handling error:', error);
      return {
        message: "I had trouble processing your flight selection. Could you please try again?",
        suggestedActions: ['Try again', 'See flight options']
      };
    }
  }

  /**
   * Handle flight comparison requests
   */
  private async handleFlightComparison(
    request: ConversationRequest, 
    intent: any
  ): Promise<ConversationResponse> {
    try {
      const session = sessionManager.getSession(request.sessionId);
      if (!session?.searchResults || session.searchResults.length < 2) {
        return {
          message: "I need at least 2 flights to compare. Would you like to search for flights first?",
          suggestedActions: ['Search for flights', 'See available options']
        };
      }

      // Use top 3 flights for comparison
      const flightsToCompare = session.searchResults.slice(0, 3);
      const comparison = flightRecommendationService.compareFlights(flightsToCompare);

      const comparisonResponse = await this.generateComparisonResponse(comparison);

      return {
        message: comparisonResponse,
        flightOptions: flightsToCompare,
        suggestedActions: [
          'Select best option',
          'See more details',
          'Get recommendations',
          'Search different dates'
        ]
      };

    } catch (error) {
      console.error('Flight comparison handling error:', error);
      return {
        message: "I had trouble comparing the flights. Let me show you the available options instead.",
        suggestedActions: ['See flight options', 'Try again']
      };
    }
  }

  /**
   * Handle preference updates
   */
  private async handlePreferenceUpdate(
    request: ConversationRequest, 
    intent: any
  ): Promise<ConversationResponse> {
    try {
      // Extract preferences from message
      const preferences = await this.extractPreferences(request.message);
      
      // Update session with preferences
      const session = sessionManager.getSession(request.sessionId);
      if (session) {
        // Store preferences in session (in a real app, this would be in user profile)
        session.bookingInProgress = {
          ...session.bookingInProgress,
          userPreferences: preferences
        };
      }

      // If we have search results, re-rank them with new preferences
      let updatedResponse = `Got it! I've updated your preferences: ${this.formatPreferences(preferences)}.`;
      
      if (session?.searchResults && session.searchResults.length > 0) {
        const recommendations = await flightRecommendationService.generateRecommendations(
          session.searchResults,
          session.currentQuery || { passengers: 1 },
          preferences
        );

        updatedResponse += ` Based on your preferences, here are my updated recommendations:`;

        return {
          message: updatedResponse,
          flightOptions: [recommendations.primary.flight, ...recommendations.alternatives.map(a => a.flight)],
          suggestedActions: [
            'Select recommended flight',
            'See all options',
            'Update preferences',
            'Search new dates'
          ]
        };
      }

      return {
        message: updatedResponse + " Would you like to search for flights with these preferences?",
        suggestedActions: ['Search flights', 'Update more preferences', 'Get recommendations']
      };

    } catch (error) {
      console.error('Preference update handling error:', error);
      return {
        message: "I had trouble updating your preferences. Could you tell me more specifically what you're looking for?",
        suggestedActions: ['Try again', 'Search flights', 'Get help']
      };
    }
  }

  /**
   * Handle recommendation requests
   */
  private async handleRecommendationRequest(
    request: ConversationRequest, 
    intent: any
  ): Promise<ConversationResponse> {
    try {
      const session = sessionManager.getSession(request.sessionId);
      
      if (!session?.searchResults || session.searchResults.length === 0) {
        // Generate general travel advice
        const advice = await vertexAIService.generateTravelAdvice('', '', new Date());
        
        return {
          message: `I'd be happy to help with recommendations! ${advice}\n\nWould you like to search for specific flights so I can give you personalized recommendations?`,
          suggestedActions: ['Search for flights', 'Get travel tips', 'Ask specific question']
        };
      }

      // Generate recommendations based on current search results
      const recommendations = await flightRecommendationService.generateRecommendations(
        session.searchResults,
        session.currentQuery || { passengers: 1 }
      );

      const recommendationResponse = await this.generateRecommendationResponse(recommendations);

      return {
        message: recommendationResponse,
        flightOptions: [recommendations.primary.flight, ...recommendations.alternatives.map(a => a.flight)],
        suggestedActions: [
          'Select recommended flight',
          'Compare all options',
          'See more details',
          'Update preferences'
        ]
      };

    } catch (error) {
      console.error('Recommendation handling error:', error);
      return {
        message: "I'd love to help with recommendations! Could you tell me what specific advice you're looking for?",
        suggestedActions: ['Search for flights', 'Ask specific question', 'Get travel tips']
      };
    }
  }

  /**
   * Handle general inquiries
   */
  private async handleGeneralInquiry(
    request: ConversationRequest, 
    intent: any
  ): Promise<ConversationResponse> {
    try {
      // Use Vertex AI to generate contextual response
      const context = sessionManager.getConversationContext(request.sessionId);
      const response = await vertexAIService.generateConversationalResponse(
        request.message,
        context
      );

      return {
        message: response,
        suggestedActions: [
          'Search for flights',
          'Get recommendations',
          'Ask another question'
        ]
      };

    } catch (error) {
      console.error('General inquiry handling error:', error);
      return this.handleFallback(request);
    }
  }

  /**
   * Handle fallback cases
   */
  private async handleFallback(request: ConversationRequest): Promise<ConversationResponse> {
    const fallbackResponses = [
      "I'm here to help you find and book flights! What would you like to do?",
      "I can help you search for flights, compare options, and make recommendations. What are you looking for?",
      "Let me help you with your travel plans. Where would you like to fly?",
      "I'm your flight booking assistant. How can I help you today?"
    ];

    const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];

    return {
      message: randomResponse,
      suggestedActions: [
        'Search for flights',
        'Get recommendations',
        'Compare flight options',
        'Ask about travel tips'
      ]
    };
  }

  /**
   * Generate error response
   */
  private generateErrorResponse(sessionId: string): ConversationResponse {
    return {
      message: "I'm sorry, I'm having some technical difficulties right now. Please try again in a moment.",
      suggestedActions: ['Try again', 'Contact support', 'Start over']
    };
  }

  /**
   * Extract flight selection number from message
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
   * Extract user preferences from message
   */
  private async extractPreferences(message: string): Promise<UserPreferences> {
    const preferences: UserPreferences = {};

    const lowerMessage = message.toLowerCase();

    // Budget preferences
    if (lowerMessage.includes('budget') || lowerMessage.includes('cheap')) {
      preferences.budgetRange = 'budget';
    } else if (lowerMessage.includes('premium') || lowerMessage.includes('expensive')) {
      preferences.budgetRange = 'premium';
    } else if (lowerMessage.includes('mid') || lowerMessage.includes('moderate')) {
      preferences.budgetRange = 'mid-range';
    }

    // Time preferences
    if (lowerMessage.includes('morning')) {
      preferences.timePreference = 'morning';
    } else if (lowerMessage.includes('afternoon')) {
      preferences.timePreference = 'afternoon';
    } else if (lowerMessage.includes('evening')) {
      preferences.timePreference = 'evening';
    } else if (lowerMessage.includes('flexible')) {
      preferences.timePreference = 'flexible';
    }

    // Stop preferences
    if (lowerMessage.includes('direct') || lowerMessage.includes('nonstop')) {
      preferences.stopPreference = 'direct';
    } else if (lowerMessage.includes('one stop')) {
      preferences.stopPreference = 'one-stop';
    } else if (lowerMessage.includes('any') || lowerMessage.includes('flexible')) {
      preferences.stopPreference = 'flexible';
    }

    // Priority factors
    if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
      preferences.priorityFactors = ['price', ...(preferences.priorityFactors || [])];
    }
    if (lowerMessage.includes('time') || lowerMessage.includes('duration')) {
      preferences.priorityFactors = ['duration', ...(preferences.priorityFactors || [])];
    }
    if (lowerMessage.includes('convenience')) {
      preferences.priorityFactors = ['convenience', ...(preferences.priorityFactors || [])];
    }

    return preferences;
  }

  /**
   * Format preferences for display
   */
  private formatPreferences(preferences: UserPreferences): string {
    const parts: string[] = [];

    if (preferences.budgetRange) {
      parts.push(`${preferences.budgetRange} budget`);
    }
    if (preferences.timePreference) {
      parts.push(`${preferences.timePreference} departures`);
    }
    if (preferences.stopPreference) {
      parts.push(`${preferences.stopPreference} flights`);
    }
    if (preferences.priorityFactors?.length) {
      parts.push(`prioritizing ${preferences.priorityFactors.join(', ')}`);
    }

    return parts.join(', ') || 'general preferences';
  }

  /**
   * Generate response for search results
   */
  private async generateSearchResultsResponse(
    flights: FlightResult[],
    recommendations: any,
    searchParams: ExtractedTravelParams
  ): Promise<string> {
    const route = `${searchParams.origin} to ${searchParams.destination}`;
    const date = searchParams.departureDate?.toDateString() || 'your travel date';

    let response = `Great! I found ${flights.length} flights for ${route} on ${date}.\n\n`;

    // Highlight the primary recommendation
    const primary = recommendations.primary;
    response += `🌟 **My top recommendation**: ${primary.flight.airline} ${primary.flight.flightNumber} for $${primary.flight.price}\n`;
    response += `   ${primary.reasons.join(', ')}\n\n`;

    // Show alternatives
    if (recommendations.alternatives.length > 0) {
      response += `**Other great options**:\n`;
      recommendations.alternatives.slice(0, 2).forEach((alt: any, index: number) => {
        response += `${index + 2}. ${alt.flight.airline} ${alt.flight.flightNumber} - $${alt.flight.price} (${alt.category})\n`;
      });
    }

    // Add insights
    if (recommendations.insights.length > 0) {
      response += `\n💡 **Insights**: ${recommendations.insights[0]}`;
    }

    return response;
  }

  /**
   * Generate response for flight details
   */
  private async generateFlightDetailsResponse(flight: FlightResult): Promise<string> {
    const departureTime = flight.departureTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const arrivalTime = flight.arrivalTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const duration = `${Math.floor(flight.duration / 60)}h ${flight.duration % 60}m`;

    let response = `✈️ **${flight.airline} ${flight.flightNumber}**\n\n`;
    response += `🛫 **Departure**: ${flight.origin.city} (${flight.origin.code}) at ${departureTime}\n`;
    response += `🛬 **Arrival**: ${flight.destination.city} (${flight.destination.code}) at ${arrivalTime}\n`;
    response += `⏱️ **Duration**: ${duration}\n`;
    response += `🔄 **Stops**: ${flight.stops === 0 ? 'Direct flight' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}\n`;
    response += `💰 **Price**: $${flight.price}\n`;
    response += `💺 **Available seats**: ${flight.availableSeats}\n\n`;

    response += `Ready to book this flight?`;

    return response;
  }

  /**
   * Generate response for flight comparison
   */
  private async generateComparisonResponse(comparison: any): Promise<string> {
    let response = `📊 **Flight Comparison**\n\n${comparison.summary}\n\n`;

    comparison.comparison.forEach((comp: any, index: number) => {
      const flight = comp.flight;
      response += `**${index + 1}. ${flight.airline} ${flight.flightNumber}** - $${flight.price}\n`;
      
      if (comp.advantages.length > 0) {
        response += `   ✅ ${comp.advantages.join(', ')}\n`;
      }
      if (comp.disadvantages.length > 0) {
        response += `   ❌ ${comp.disadvantages.join(', ')}\n`;
      }
      response += '\n';
    });

    response += `Which option looks best to you?`;

    return response;
  }

  /**
   * Generate response for recommendations
   */
  private async generateRecommendationResponse(recommendations: any): Promise<string> {
    let response = `🎯 **My Recommendations**\n\n`;

    // Primary recommendation
    const primary = recommendations.primary;
    response += `**🌟 Best Choice**: ${primary.flight.airline} ${primary.flight.flightNumber} - $${primary.flight.price}\n`;
    response += `   ${primary.reasons.join(', ')}\n\n`;

    // Alternatives
    if (recommendations.alternatives.length > 0) {
      response += `**Alternative Options**:\n`;
      recommendations.alternatives.forEach((alt: any, index: number) => {
        response += `${index + 1}. ${alt.flight.airline} ${alt.flight.flightNumber} - $${alt.flight.price} (${alt.category})\n`;
      });
      response += '\n';
    }

    // Tips
    if (recommendations.tips.length > 0) {
      response += `💡 **Travel Tips**:\n`;
      recommendations.tips.forEach((tip: string) => {
        response += `• ${tip}\n`;
      });
    }

    return response;
  }
}

// Export singleton instance
export const conversationService = new ConversationService();