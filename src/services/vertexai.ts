import { VertexAI } from '@google-cloud/vertexai';
import { config } from '../config';
import { TravelQuery, ExtractedTravelParams, ConversationContext } from '../types';

export class VertexAIService {
  private vertexAI: VertexAI;
  private model: any;

  constructor() {
    this.vertexAI = new VertexAI({
      project: config.googleCloud.projectId,
      location: config.googleCloud.location,
    });

    this.model = this.vertexAI.getGenerativeModel({
      model: config.googleCloud.vertexAi.model,
    });
  }

  /**
   * Check if Vertex AI is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: 'Hello' }]
        }]
      });
      return !!result.response;
    } catch (error) {
      console.error('Vertex AI health check failed:', error);
      return false;
    }
  }

  /**
   * Extract travel parameters from natural language query
   */
  async extractTravelParams(query: TravelQuery): Promise<ExtractedTravelParams> {
    try {
      const prompt = this.buildExtractionPrompt(query);
      
      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent extraction
          maxOutputTokens: 500,
        }
      });

      const responseText = result.response.candidates[0].content.parts[0].text;
      return this.parseExtractionResponse(responseText);
    } catch (error) {
      console.error('Error extracting travel parameters:', error);
      
      // Use fallback service if Vertex AI fails
      const { fallbackService } = await import('./fallbackService');
      console.warn('🔄 Falling back to basic NLP processing');
      
      try {
        const fallbackResult = await fallbackService.processNaturalLanguageFallback(query.userMessage);
        return fallbackResult.extractedParams;
      } catch (fallbackError) {
        console.error('Fallback NLP processing also failed:', fallbackError);
        throw new Error('Natural language processing temporarily unavailable');
      }
    }
  }

  /**
   * Generate conversational response about flights
   */
  async generateConversationalResponse(
    userMessage: string,
    context?: ConversationContext,
    flightResults?: any[]
  ): Promise<string> {
    try {
      const prompt = this.buildConversationPrompt(userMessage, context, flightResults);
      
      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7, // Higher temperature for more natural conversation
          maxOutputTokens: 800,
        }
      });

      return result.response.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Error generating conversational response:', error);
      
      // Use fallback service if Vertex AI fails
      const { fallbackService } = await import('./fallbackService');
      console.warn('🔄 Falling back to template-based responses');
      
      try {
        const fallbackResult = await fallbackService.generateConversationalResponseFallback(userMessage, flightResults);
        return fallbackResult.response;
      } catch (fallbackError) {
        console.error('Fallback conversation generation also failed:', fallbackError);
        return "I'm experiencing some technical difficulties. Please try again or contact support for assistance.";
      }
    }
  }

  /**
   * Build prompt for travel parameter extraction
   */
  private buildExtractionPrompt(query: TravelQuery): string {
    const contextInfo = query.context ? this.formatContextForPrompt(query.context) : '';
    
    return `You are a travel assistant that extracts flight search parameters from natural language queries.

Extract the following information from the user's message and return it as a JSON object:
- origin: departure airport code (3 letters, uppercase) or city name
- destination: arrival airport code (3 letters, uppercase) or city name  
- departureDate: departure date in YYYY-MM-DD format
- returnDate: return date in YYYY-MM-DD format (if mentioned)
- passengers: number of passengers (default: 1)
- class: travel class (economy/business/first, default: economy)
- flexibility: whether dates are flexible (exact/flexible, default: exact)

Rules:
1. If airport codes are not provided, extract city names
2. If dates are relative (like "tomorrow", "next Friday"), calculate the actual date
3. If no specific date is mentioned, assume they want to travel soon
4. If return date is not mentioned for round trip keywords, leave it null
5. Return only valid JSON, no additional text

${contextInfo}

User message: "${query.userMessage}"

JSON response:`;
  }

  /**
   * Build prompt for conversational responses
   */
  private buildConversationPrompt(
    userMessage: string,
    context?: ConversationContext,
    flightResults?: any[]
  ): string {
    let prompt = `You are a helpful flight booking assistant. Provide friendly, informative responses about flights and travel.

Guidelines:
- Be conversational and helpful
- If flight results are provided, summarize the key options
- Suggest alternatives when appropriate
- Ask clarifying questions if needed
- Keep responses concise but informative
- Always be positive and solution-oriented

`;

    if (context?.previousQueries && context.previousQueries.length > 0) {
      prompt += `Previous conversation context:
${context.previousQueries.map(q => `- Looking for flights from ${q.origin} to ${q.destination}`).join('\n')}

`;
    }

    if (flightResults && flightResults.length > 0) {
      prompt += `Available flight options:
${flightResults.slice(0, 3).map((flight, index) => 
        `${index + 1}. ${flight.airline} ${flight.flightNumber} - $${flight.price} (${flight.duration}min, ${flight.stops} stops)`
      ).join('\n')}

`;
    }

    prompt += `User message: "${userMessage}"

Response:`;

    return prompt;
  }

  /**
   * Parse the extraction response from Vertex AI
   */
  private parseExtractionResponse(responseText: string): ExtractedTravelParams {
    try {
      // Clean the response to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and transform the response
      const result: ExtractedTravelParams = {
        passengers: 1, // default
        ...parsed
      };

      // Convert date strings to Date objects
      if (result.departureDate && typeof result.departureDate === 'string') {
        result.departureDate = new Date(result.departureDate);
      }
      if (result.returnDate && typeof result.returnDate === 'string') {
        result.returnDate = new Date(result.returnDate);
      }

      // Validate required fields
      if (!result.origin || !result.destination) {
        throw new Error('Origin and destination are required');
      }

      // Convert city names to airport codes if needed
      result.origin = this.normalizeLocation(result.origin);
      result.destination = this.normalizeLocation(result.destination);

      return result;
    } catch (error) {
      console.error('Error parsing extraction response:', error);
      throw new Error('Failed to parse travel parameters');
    }
  }

  /**
   * Normalize location input (city name to airport code)
   */
  private normalizeLocation(location: string): string {
    const cityToAirport: { [key: string]: string } = {
      'new york': 'JFK',
      'nyc': 'JFK',
      'los angeles': 'LAX',
      'la': 'LAX',
      'london': 'LHR',
      'paris': 'CDG',
      'tokyo': 'NRT',
      'san francisco': 'SFO',
      'sf': 'SFO',
      'chicago': 'ORD',
      'dubai': 'DXB',
      'singapore': 'SIN',
      'frankfurt': 'FRA'
    };

    const normalized = location.toLowerCase().trim();
    
    // If it's already an airport code, return uppercase
    if (location.length === 3 && /^[A-Za-z]{3}$/.test(location)) {
      return location.toUpperCase();
    }

    // Try to find city mapping
    return cityToAirport[normalized] || location.toUpperCase();
  }

  /**
   * Format conversation context for prompt
   */
  private formatContextForPrompt(context: ConversationContext): string {
    let contextStr = 'Previous conversation context:\n';
    
    if (context.previousQueries && context.previousQueries.length > 0) {
      contextStr += 'Previous searches:\n';
      context.previousQueries.forEach((query, index) => {
        contextStr += `${index + 1}. ${query.origin} to ${query.destination}`;
        if (query.departureDate) {
          contextStr += ` on ${query.departureDate.toDateString()}`;
        }
        contextStr += '\n';
      });
    }

    if (context.selectedFlight) {
      contextStr += `Currently selected flight: ${context.selectedFlight.airline} ${context.selectedFlight.flightNumber}\n`;
    }

    if (context.bookingStep) {
      contextStr += `Current booking step: ${context.bookingStep}\n`;
    }

    return contextStr + '\n';
  }

  /**
   * Suggest alternative dates with better prices
   */
  async suggestAlternativeDates(
    origin: string,
    destination: string,
    preferredDate: Date
  ): Promise<string> {
    try {
      const prompt = `As a travel assistant, suggest alternative travel dates around ${preferredDate.toDateString()} for flights from ${origin} to ${destination}.

Provide 3-4 alternative dates within a week of the preferred date, explaining why they might be better (typically weekdays are cheaper, avoid holidays, etc.).

Keep the response conversational and helpful.

Response:`;

      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 400,
        }
      });

      return result.response.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Error suggesting alternative dates:', error);
      return 'I can help you find flights on different dates. Weekdays are typically cheaper than weekends, and avoiding holidays can save you money.';
    }
  }

  /**
   * Generate travel tips and advice
   */
  async generateTravelAdvice(
    origin: string,
    destination: string,
    travelDate?: Date
  ): Promise<string> {
    try {
      const dateInfo = travelDate ? ` in ${travelDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : '';
      
      const prompt = `Provide helpful travel advice for someone flying from ${origin} to ${destination}${dateInfo}.

Include brief tips about:
- Best time to book
- What to expect at the destination
- Any seasonal considerations
- General travel tips

Keep it concise and practical.

Response:`;

      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        }
      });

      return result.response.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Error generating travel advice:', error);
      return 'I recommend booking flights in advance for better prices and checking airline policies for baggage and changes.';
    }
  }
}

// Export singleton instance
export const vertexAIService = new VertexAIService();