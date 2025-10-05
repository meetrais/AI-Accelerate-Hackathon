import { FlightResult, FlightSearchRequest, ExtractedTravelParams } from '../types';
import { mockFlights } from '../data/mockFlights';

export class FallbackService {
  /**
   * Fallback flight search when Elasticsearch is unavailable
   */
  async searchFlightsFallback(searchRequest: FlightSearchRequest): Promise<{
    flights: FlightResult[];
    metadata: any;
  }> {
    console.warn('🔄 Using fallback flight search (Elasticsearch unavailable)');
    
    try {
      // Filter mock flights based on search criteria
      let filteredFlights = mockFlights.filter(flight => {
        // Basic origin/destination matching
        const originMatch = flight.origin.code.toLowerCase() === searchRequest.origin.toLowerCase() ||
                           flight.origin.city.toLowerCase().includes(searchRequest.origin.toLowerCase());
        
        const destinationMatch = flight.destination.code.toLowerCase() === searchRequest.destination.toLowerCase() ||
                                flight.destination.city.toLowerCase().includes(searchRequest.destination.toLowerCase());
        
        return originMatch && destinationMatch;
      });

      // Apply date filtering if specified
      if (searchRequest.departureDate) {
        const searchDate = new Date(searchRequest.departureDate);
        filteredFlights = filteredFlights.filter(flight => {
          const flightDate = new Date(flight.departureTime);
          return flightDate.toDateString() === searchDate.toDateString();
        });
      }

      // Apply passenger count filtering
      filteredFlights = filteredFlights.filter(flight => 
        (flight.availability.economy + flight.availability.business + flight.availability.first) >= searchRequest.passengers
      );

      // Apply filters if provided
      if (searchRequest.filters) {
        const { maxPrice, airlines, maxStops, departureTimeRange, class: travelClass } = searchRequest.filters;
        
        if (maxPrice) {
          filteredFlights = filteredFlights.filter(flight => flight.price.amount <= maxPrice);
        }
        
        if (airlines && airlines.length > 0) {
          filteredFlights = filteredFlights.filter(flight => 
            airlines.includes(flight.airline)
          );
        }
        
        if (maxStops !== undefined) {
          filteredFlights = filteredFlights.filter(flight => flight.stops.length <= maxStops);
        }
        
        if (departureTimeRange) {
          const startTime = new Date(`1970-01-01T${departureTimeRange.start}`).getHours();
          const endTime = new Date(`1970-01-01T${departureTimeRange.end}`).getHours();
          
          filteredFlights = filteredFlights.filter(flight => {
            const flightHour = new Date(flight.departureTime).getHours();
            return flightHour >= startTime && flightHour <= endTime;
          });
        }
      }

      // Sort by price (default)
      filteredFlights.sort((a, b) => a.price.amount - b.price.amount);

      // Limit results
      const limitedFlights = filteredFlights.slice(0, 20);

      return {
        flights: limitedFlights.map(flight => ({
          id: flight.id,
          airline: flight.airline,
          flightNumber: flight.flightNumber,
          origin: flight.origin,
          destination: flight.destination,
          departureTime: flight.departureTime,
          arrivalTime: flight.arrivalTime,
          duration: flight.duration,
          stops: flight.stops.length,
          price: flight.price.amount,
          availableSeats: flight.availability.economy + flight.availability.business + flight.availability.first
        })),
        metadata: {
          totalResults: filteredFlights.length,
          searchTime: Date.now(),
          source: 'fallback',
          appliedFilters: Object.keys(searchRequest.filters || {})
        }
      };

    } catch (error) {
      console.error('Fallback flight search error:', error);
      
      // Return empty results with error metadata
      return {
        flights: [],
        metadata: {
          totalResults: 0,
          searchTime: Date.now(),
          source: 'fallback',
          error: 'Fallback search failed'
        }
      };
    }
  }

  /**
   * Fallback flight by ID when Elasticsearch is unavailable
   */
  async getFlightByIdFallback(flightId: string): Promise<FlightResult | null> {
    console.warn('🔄 Using fallback flight lookup (Elasticsearch unavailable)');
    
    try {
      const flight = mockFlights.find(f => f.id === flightId);
      if (!flight) return null;
      
      return {
        id: flight.id,
        airline: flight.airline,
        flightNumber: flight.flightNumber,
        origin: flight.origin,
        destination: flight.destination,
        departureTime: flight.departureTime,
        arrivalTime: flight.arrivalTime,
        duration: flight.duration,
        stops: flight.stops.length,
        price: flight.price.amount,
        availableSeats: flight.availability.economy + flight.availability.business + flight.availability.first
      };
    } catch (error) {
      console.error('Fallback flight lookup error:', error);
      return null;
    }
  }

  /**
   * Fallback natural language processing when Vertex AI is unavailable
   */
  async processNaturalLanguageFallback(userMessage: string): Promise<{
    extractedParams: ExtractedTravelParams;
    confidence: number;
    fallback: boolean;
  }> {
    console.warn('🔄 Using fallback NLP processing (Vertex AI unavailable)');
    
    try {
      // Simple keyword-based extraction
      const extractedParams: ExtractedTravelParams = {
        origin: this.extractLocation(userMessage, 'from'),
        destination: this.extractLocation(userMessage, 'to'),
        departureDate: this.extractDate(userMessage),
        passengers: this.extractPassengerCount(userMessage),
        flexibility: this.extractFlexibility(userMessage)
      };

      return {
        extractedParams,
        confidence: 0.6, // Lower confidence for fallback
        fallback: true
      };

    } catch (error) {
      console.error('Fallback NLP processing error:', error);
      
      return {
        extractedParams: {
          passengers: 1,
          flexibility: 'exact'
        },
        confidence: 0.1,
        fallback: true
      };
    }
  }

  /**
   * Fallback conversational response when Vertex AI is unavailable
   */
  async generateConversationalResponseFallback(
    userMessage: string,
    flightResults?: FlightResult[]
  ): Promise<{
    response: string;
    suggestedActions: string[];
    fallback: boolean;
  }> {
    console.warn('🔄 Using fallback conversation generation (Vertex AI unavailable)');
    
    try {
      let response = '';
      const suggestedActions: string[] = [];

      if (flightResults && flightResults.length > 0) {
        response = `I found ${flightResults.length} flight${flightResults.length > 1 ? 's' : ''} for you. `;
        
        if (flightResults.length === 1) {
          const flight = flightResults[0];
          response += `The flight is with ${flight.airline} (${flight.flightNumber}) departing at ${new Date(flight.departureTime).toLocaleTimeString()} for $${flight.price}.`;
        } else {
          const cheapest = flightResults.reduce((min, flight) => flight.price < min.price ? flight : min);
          response += `Prices start from $${cheapest.price} with ${cheapest.airline}.`;
        }
        
        suggestedActions.push('Book this flight', 'See more options', 'Modify search');
      } else {
        response = "I'm sorry, I couldn't find any flights matching your criteria. ";
        response += "You might want to try different dates or destinations.";
        
        suggestedActions.push('Try different dates', 'Search other destinations', 'Contact support');
      }

      return {
        response,
        suggestedActions,
        fallback: true
      };

    } catch (error) {
      console.error('Fallback conversation generation error:', error);
      
      return {
        response: "I'm experiencing some technical difficulties. Please try again or contact support for assistance.",
        suggestedActions: ['Try again', 'Contact support'],
        fallback: true
      };
    }
  }

  /**
   * Extract location from user message
   */
  private extractLocation(message: string, direction: 'from' | 'to'): string | undefined {
    const lowerMessage = message.toLowerCase();
    
    // Common airport codes and cities
    const locations = [
      'nyc', 'new york', 'jfk', 'lga', 'ewr',
      'lax', 'los angeles', 'la',
      'sfo', 'san francisco', 'sf',
      'ord', 'chicago', 'chi',
      'mia', 'miami',
      'dfw', 'dallas',
      'atl', 'atlanta',
      'bos', 'boston',
      'sea', 'seattle',
      'den', 'denver',
      'las', 'vegas',
      'phx', 'phoenix',
      'iah', 'houston',
      'dca', 'washington', 'dc'
    ];

    const directionWords = direction === 'from' ? ['from', 'leaving', 'departing'] : ['to', 'going', 'arriving'];
    
    for (const dirWord of directionWords) {
      const pattern = new RegExp(`${dirWord}\\s+([a-zA-Z\\s]+?)(?:\\s+(?:to|from|on|at|in)|$)`, 'i');
      const match = lowerMessage.match(pattern);
      
      if (match) {
        const location = match[1].trim();
        
        // Check if it matches known locations
        for (const knownLocation of locations) {
          if (location.includes(knownLocation) || knownLocation.includes(location)) {
            return knownLocation.toUpperCase();
          }
        }
        
        return location;
      }
    }
    
    return undefined;
  }

  /**
   * Extract date from user message
   */
  private extractDate(message: string): Date | undefined {
    const lowerMessage = message.toLowerCase();
    
    // Look for relative dates
    if (lowerMessage.includes('today')) {
      return new Date();
    }
    
    if (lowerMessage.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    
    if (lowerMessage.includes('next week')) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    }
    
    // Look for day names
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (let i = 0; i < days.length; i++) {
      if (lowerMessage.includes(days[i])) {
        const targetDay = new Date();
        const currentDay = targetDay.getDay();
        const targetDayIndex = i + 1; // Monday = 1, Sunday = 0
        const daysUntilTarget = (targetDayIndex - currentDay + 7) % 7;
        targetDay.setDate(targetDay.getDate() + (daysUntilTarget || 7));
        return targetDay;
      }
    }
    
    // Look for month names
    const months = ['january', 'february', 'march', 'april', 'may', 'june',
                   'july', 'august', 'september', 'october', 'november', 'december'];
    
    for (let i = 0; i < months.length; i++) {
      if (lowerMessage.includes(months[i])) {
        const date = new Date();
        date.setMonth(i);
        if (date < new Date()) {
          date.setFullYear(date.getFullYear() + 1);
        }
        return date;
      }
    }
    
    return undefined;
  }

  /**
   * Extract passenger count from user message
   */
  private extractPassengerCount(message: string): number {
    const lowerMessage = message.toLowerCase();
    
    // Look for numbers
    const numberMatch = lowerMessage.match(/(\d+)\s*(?:passenger|person|people|adult|traveler)/);
    if (numberMatch) {
      return parseInt(numberMatch[1]);
    }
    
    // Look for written numbers
    const writtenNumbers: { [key: string]: number } = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    };
    
    for (const [word, number] of Object.entries(writtenNumbers)) {
      if (lowerMessage.includes(word)) {
        return number;
      }
    }
    
    return 1; // Default to 1 passenger
  }

  /**
   * Extract flexibility from user message
   */
  private extractFlexibility(message: string): 'exact' | 'flexible' {
    const lowerMessage = message.toLowerCase();
    
    const flexibleKeywords = ['flexible', 'around', 'approximately', 'roughly', 'about', 'give or take'];
    const exactKeywords = ['exact', 'exactly', 'specific', 'must be', 'only'];
    
    for (const keyword of flexibleKeywords) {
      if (lowerMessage.includes(keyword)) {
        return 'flexible';
      }
    }
    
    for (const keyword of exactKeywords) {
      if (lowerMessage.includes(keyword)) {
        return 'exact';
      }
    }
    
    return 'exact'; // Default to exact
  }

  /**
   * Get fallback flight recommendations
   */
  async getFlightRecommendationsFallback(flights: FlightResult[]): Promise<{
    recommendations: any[];
    reasoning: string;
    fallback: boolean;
  }> {
    console.warn('🔄 Using fallback flight recommendations (Vertex AI unavailable)');
    
    try {
      if (flights.length === 0) {
        return {
          recommendations: [],
          reasoning: 'No flights available for recommendations',
          fallback: true
        };
      }

      // Simple rule-based recommendations
      const recommendations = [];
      
      // Best value (lowest price)
      const cheapest = flights.reduce((min, flight) => flight.price < min.price ? flight : min);
      recommendations.push({
        flight: cheapest,
        category: 'best-value',
        reason: 'Lowest price option'
      });
      
      // Fastest (shortest duration)
      const fastest = flights.reduce((min, flight) => flight.duration < min.duration ? flight : min);
      if (fastest.id !== cheapest.id) {
        recommendations.push({
          flight: fastest,
          category: 'fastest',
          reason: 'Shortest flight duration'
        });
      }
      
      // Direct flights (no stops)
      const directFlights = flights.filter(flight => flight.stops === 0);
      if (directFlights.length > 0) {
        const bestDirect = directFlights.reduce((min, flight) => flight.price < min.price ? flight : min);
        if (bestDirect.id !== cheapest.id && bestDirect.id !== fastest.id) {
          recommendations.push({
            flight: bestDirect,
            category: 'most-convenient',
            reason: 'Direct flight with no stops'
          });
        }
      }

      return {
        recommendations,
        reasoning: 'Basic rule-based recommendations (AI unavailable)',
        fallback: true
      };

    } catch (error) {
      console.error('Fallback recommendations error:', error);
      
      return {
        recommendations: [],
        reasoning: 'Unable to generate recommendations',
        fallback: true
      };
    }
  }
}

// Export singleton instance
export const fallbackService = new FallbackService();