import { elasticsearchService } from './elasticsearch';
import { vertexAIService } from './vertexai';
import { 
  FlightSearchRequest, 
  FlightResult, 
  Airport, 
  FlightFilters,
  ExtractedTravelParams 
} from '../types';

export interface HybridSearchOptions {
  useSemanticSearch?: boolean;
  boostFactors?: {
    price: number;
    duration: number;
    stops: number;
    departure_time: number;
  };
  maxResults?: number;
}

export interface SearchSuggestion {
  type: 'date' | 'airport' | 'price' | 'airline';
  suggestion: string;
  reason: string;
}

export class HybridSearchService {
  private defaultBoostFactors = {
    price: 2.0,
    duration: 1.5,
    stops: 1.2,
    departure_time: 1.0
  };

  /**
   * Perform hybrid search combining keyword and semantic search
   */
  async hybridFlightSearch(
    searchRequest: FlightSearchRequest,
    options: HybridSearchOptions = {}
  ): Promise<{
    results: FlightResult[];
    suggestions: SearchSuggestion[];
    searchMetadata: any;
  }> {
    try {
      const startTime = Date.now();
      
      // Perform primary search
      const primaryResults = await this.performPrimarySearch(searchRequest, options);
      
      // Generate search suggestions if results are limited
      const suggestions = await this.generateSearchSuggestions(searchRequest, primaryResults);
      
      // Apply intelligent ranking
      const rankedResults = await this.applyIntelligentRanking(
        primaryResults, 
        searchRequest, 
        options
      );

      const searchTime = Date.now() - startTime;
      
      return {
        results: rankedResults.slice(0, options.maxResults || 20),
        suggestions,
        searchMetadata: {
          searchTime,
          totalResults: primaryResults.length,
          searchType: options.useSemanticSearch ? 'hybrid' : 'keyword',
          appliedFilters: this.getAppliedFilters(searchRequest.filters)
        }
      };

    } catch (error) {
      console.error('Hybrid search error:', error);
      throw new Error('Flight search failed');
    }
  }

  /**
   * Perform the primary search operation
   */
  private async performPrimarySearch(
    searchRequest: FlightSearchRequest,
    options: HybridSearchOptions
  ): Promise<FlightResult[]> {
    // For now, use the existing Elasticsearch search
    // In a full implementation, this would combine keyword and semantic search
    const results = await elasticsearchService.searchFlights(searchRequest);
    
    // If semantic search is enabled and we have few results, try broader search
    if (options.useSemanticSearch && results.length < 5) {
      const broaderResults = await this.performBroaderSearch(searchRequest);
      return this.mergeAndDeduplicateResults(results, broaderResults);
    }

    return results;
  }

  /**
   * Perform broader search when initial results are limited
   */
  private async performBroaderSearch(
    searchRequest: FlightSearchRequest
  ): Promise<FlightResult[]> {
    try {
      // Try nearby airports
      const nearbyAirports = await this.findNearbyAirports(searchRequest.origin, searchRequest.destination);
      const broaderResults: FlightResult[] = [];

      for (const airportPair of nearbyAirports) {
        const broaderRequest = {
          ...searchRequest,
          origin: airportPair.origin,
          destination: airportPair.destination
        };

        try {
          const results = await elasticsearchService.searchFlights(broaderRequest);
          broaderResults.push(...results);
        } catch (error) {
          // Continue with other airport pairs if one fails
          console.warn(`Search failed for ${airportPair.origin}-${airportPair.destination}:`, error);
        }
      }

      return broaderResults;
    } catch (error) {
      console.error('Broader search error:', error);
      return [];
    }
  }

  /**
   * Find nearby airports for broader search
   */
  private async findNearbyAirports(
    origin: string, 
    destination: string
  ): Promise<Array<{origin: string, destination: string}>> {
    // Airport proximity mapping (in a real app, this would be more sophisticated)
    const airportGroups: { [key: string]: string[] } = {
      'NYC': ['JFK', 'LGA', 'EWR'],
      'LA': ['LAX', 'BUR', 'LGB'],
      'LONDON': ['LHR', 'LGW', 'STN'],
      'PARIS': ['CDG', 'ORY'],
      'TOKYO': ['NRT', 'HND'],
      'SF': ['SFO', 'OAK', 'SJC']
    };

    const getAirportGroup = (code: string): string[] => {
      for (const [group, airports] of Object.entries(airportGroups)) {
        if (airports.includes(code)) {
          return airports;
        }
      }
      return [code];
    };

    const originAlternatives = getAirportGroup(origin);
    const destinationAlternatives = getAirportGroup(destination);

    const pairs: Array<{origin: string, destination: string}> = [];
    
    for (const originAlt of originAlternatives) {
      for (const destAlt of destinationAlternatives) {
        if (originAlt !== origin || destAlt !== destination) {
          pairs.push({ origin: originAlt, destination: destAlt });
        }
      }
    }

    return pairs.slice(0, 4); // Limit to 4 alternative pairs
  }

  /**
   * Merge and deduplicate search results
   */
  private mergeAndDeduplicateResults(
    primary: FlightResult[], 
    secondary: FlightResult[]
  ): FlightResult[] {
    const seen = new Set(primary.map(f => f.id));
    const merged = [...primary];

    for (const flight of secondary) {
      if (!seen.has(flight.id)) {
        merged.push(flight);
        seen.add(flight.id);
      }
    }

    return merged;
  }

  /**
   * Apply intelligent ranking based on user preferences and search context
   */
  private async applyIntelligentRanking(
    results: FlightResult[],
    searchRequest: FlightSearchRequest,
    options: HybridSearchOptions
  ): Promise<FlightResult[]> {
    const boostFactors = { ...this.defaultBoostFactors, ...options.boostFactors };

    // Calculate ranking scores
    const scoredResults = results.map(flight => {
      let score = 0;

      // Price score (lower price = higher score)
      const maxPrice = Math.max(...results.map(f => f.price));
      const priceScore = (maxPrice - flight.price) / maxPrice;
      score += priceScore * boostFactors.price;

      // Duration score (shorter duration = higher score)
      const maxDuration = Math.max(...results.map(f => f.duration));
      const durationScore = (maxDuration - flight.duration) / maxDuration;
      score += durationScore * boostFactors.duration;

      // Stops score (fewer stops = higher score)
      const stopsScore = flight.stops === 0 ? 1 : (flight.stops === 1 ? 0.7 : 0.4);
      score += stopsScore * boostFactors.stops;

      // Departure time preference (based on common preferences)
      const departureHour = flight.departureTime.getHours();
      let timeScore = 0.5; // Default score
      
      if (departureHour >= 6 && departureHour <= 10) {
        timeScore = 0.9; // Morning flights preferred
      } else if (departureHour >= 14 && departureHour <= 18) {
        timeScore = 0.8; // Afternoon flights
      } else if (departureHour >= 11 && departureHour <= 13) {
        timeScore = 0.7; // Midday flights
      }
      
      score += timeScore * boostFactors.departure_time;

      return { ...flight, rankingScore: score };
    });

    // Sort by ranking score (descending)
    return scoredResults
      .sort((a, b) => b.rankingScore - a.rankingScore)
      .map(({ rankingScore, ...flight }) => flight);
  }

  /**
   * Generate search suggestions when results are limited or could be improved
   */
  private async generateSearchSuggestions(
    searchRequest: FlightSearchRequest,
    results: FlightResult[]
  ): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];

    // If no results, suggest alternatives
    if (results.length === 0) {
      suggestions.push({
        type: 'date',
        suggestion: 'Try searching for different dates',
        reason: 'No flights found for the selected date'
      });

      suggestions.push({
        type: 'airport',
        suggestion: 'Consider nearby airports',
        reason: 'Expand your search to include alternative airports'
      });

      return suggestions;
    }

    // If few results, suggest date flexibility
    if (results.length < 3) {
      suggestions.push({
        type: 'date',
        suggestion: 'Try flexible dates for more options',
        reason: 'Limited flights available on selected date'
      });
    }

    // Price-based suggestions
    const avgPrice = results.reduce((sum, f) => sum + f.price, 0) / results.length;
    const minPrice = Math.min(...results.map(f => f.price));
    
    if (avgPrice > minPrice * 1.5) {
      suggestions.push({
        type: 'price',
        suggestion: 'Consider flights with stops for lower prices',
        reason: 'Direct flights are significantly more expensive'
      });
    }

    // Airline diversity suggestion
    const airlines = new Set(results.map(f => f.airline));
    if (airlines.size < 3 && results.length > 5) {
      suggestions.push({
        type: 'airline',
        suggestion: 'Try different airlines for more variety',
        reason: 'Limited airline options in current results'
      });
    }

    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  /**
   * Smart flight filtering with user preference learning
   */
  async smartFilter(
    results: FlightResult[],
    userPreferences?: {
      preferredAirlines?: string[];
      maxPrice?: number;
      preferredTimes?: string[];
      maxStops?: number;
    }
  ): Promise<FlightResult[]> {
    if (!userPreferences) return results;

    let filtered = results;

    // Apply user preference filters
    if (userPreferences.preferredAirlines?.length) {
      const preferred = filtered.filter(f => 
        userPreferences.preferredAirlines!.includes(f.airline)
      );
      
      // If preferred airlines have results, use them; otherwise keep all
      if (preferred.length > 0) {
        filtered = preferred;
      }
    }

    if (userPreferences.maxPrice) {
      filtered = filtered.filter(f => f.price <= userPreferences.maxPrice!);
    }

    if (userPreferences.maxStops !== undefined) {
      filtered = filtered.filter(f => f.stops <= userPreferences.maxStops!);
    }

    if (userPreferences.preferredTimes?.length) {
      const timeFiltered = filtered.filter(f => {
        const hour = f.departureTime.getHours();
        return userPreferences.preferredTimes!.some(timeRange => {
          switch (timeRange) {
            case 'morning': return hour >= 6 && hour < 12;
            case 'afternoon': return hour >= 12 && hour < 18;
            case 'evening': return hour >= 18 && hour < 24;
            case 'night': return hour >= 0 && hour < 6;
            default: return true;
          }
        });
      });

      // Only apply time filter if it doesn't eliminate all results
      if (timeFiltered.length > 0) {
        filtered = timeFiltered;
      }
    }

    return filtered;
  }

  /**
   * Generate alternative search suggestions using AI
   */
  async generateAISearchSuggestions(
    searchRequest: FlightSearchRequest,
    results: FlightResult[]
  ): Promise<string[]> {
    try {
      const prompt = `Based on a flight search from ${searchRequest.origin} to ${searchRequest.destination} on ${searchRequest.departureDate.toDateString()} with ${results.length} results found, suggest 3 alternative search strategies to help the user find better flight options.

Consider:
- Alternative dates (weekdays vs weekends)
- Nearby airports
- Different booking strategies
- Seasonal considerations

Provide practical, actionable suggestions.

Suggestions:`;

      const aiSuggestions = await vertexAIService.generateConversationalResponse(prompt);
      
      // Parse AI response into individual suggestions
      return aiSuggestions
        .split('\n')
        .filter(line => line.trim().length > 0)
        .slice(0, 3);

    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      return [
        'Try searching for flights on weekdays for better prices',
        'Consider booking in advance for more options',
        'Check nearby airports for alternative routes'
      ];
    }
  }

  /**
   * Get applied filters summary
   */
  private getAppliedFilters(filters?: FlightFilters): string[] {
    if (!filters) return [];

    const applied: string[] = [];

    if (filters.maxPrice) {
      applied.push(`Max price: $${filters.maxPrice}`);
    }

    if (filters.airlines?.length) {
      applied.push(`Airlines: ${filters.airlines.join(', ')}`);
    }

    if (filters.maxStops !== undefined) {
      applied.push(`Max stops: ${filters.maxStops}`);
    }

    if (filters.departureTimeRange) {
      applied.push(`Departure time: ${filters.departureTimeRange.start}-${filters.departureTimeRange.end}`);
    }

    if (filters.class) {
      applied.push(`Class: ${filters.class}`);
    }

    return applied;
  }

  /**
   * Analyze search patterns for insights
   */
  async analyzeSearchPatterns(
    searchHistory: FlightSearchRequest[]
  ): Promise<{
    popularRoutes: Array<{route: string, count: number}>;
    averageAdvanceBooking: number;
    preferredDepartureTime: string;
    seasonalTrends: any;
  }> {
    // Analyze popular routes
    const routeCounts = new Map<string, number>();
    let totalAdvanceDays = 0;
    const departureTimes: number[] = [];

    for (const search of searchHistory) {
      const route = `${search.origin}-${search.destination}`;
      routeCounts.set(route, (routeCounts.get(route) || 0) + 1);

      // Calculate advance booking days
      const advanceDays = Math.floor(
        (search.departureDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (advanceDays > 0) {
        totalAdvanceDays += advanceDays;
      }

      departureTimes.push(search.departureDate.getHours());
    }

    // Popular routes
    const popularRoutes = Array.from(routeCounts.entries())
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Average advance booking
    const averageAdvanceBooking = searchHistory.length > 0 
      ? Math.round(totalAdvanceDays / searchHistory.length)
      : 0;

    // Preferred departure time
    const avgDepartureHour = departureTimes.length > 0
      ? Math.round(departureTimes.reduce((sum, hour) => sum + hour, 0) / departureTimes.length)
      : 12;

    const preferredDepartureTime = this.getTimeRangeLabel(avgDepartureHour);

    return {
      popularRoutes,
      averageAdvanceBooking,
      preferredDepartureTime,
      seasonalTrends: {} // Placeholder for seasonal analysis
    };
  }

  /**
   * Get time range label for hour
   */
  private getTimeRangeLabel(hour: number): string {
    if (hour >= 6 && hour < 12) return 'Morning (6AM-12PM)';
    if (hour >= 12 && hour < 18) return 'Afternoon (12PM-6PM)';
    if (hour >= 18 && hour < 24) return 'Evening (6PM-12AM)';
    return 'Night (12AM-6AM)';
  }
}

// Export singleton instance
export const hybridSearchService = new HybridSearchService();