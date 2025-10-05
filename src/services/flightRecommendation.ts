import { FlightResult, ExtractedTravelParams } from '../types';
import { vertexAIService } from './vertexai';

export interface UserPreferences {
  budgetRange?: 'budget' | 'mid-range' | 'premium';
  timePreference?: 'morning' | 'afternoon' | 'evening' | 'flexible';
  stopPreference?: 'direct' | 'one-stop' | 'flexible';
  airlinePreferences?: string[];
  priorityFactors?: Array<'price' | 'duration' | 'convenience' | 'airline'>;
}

export interface FlightRecommendation {
  flight: FlightResult;
  score: number;
  reasons: string[];
  category: 'best-value' | 'fastest' | 'cheapest' | 'most-convenient';
}

export interface RecommendationSet {
  primary: FlightRecommendation;
  alternatives: FlightRecommendation[];
  insights: string[];
  tips: string[];
}

export class FlightRecommendationService {
  /**
   * Generate personalized flight recommendations
   */
  async generateRecommendations(
    flights: FlightResult[],
    searchParams: ExtractedTravelParams,
    userPreferences?: UserPreferences
  ): Promise<RecommendationSet> {
    if (flights.length === 0) {
      throw new Error('No flights available for recommendations');
    }

    try {
      // Score all flights
      const scoredFlights = await this.scoreFlights(flights, searchParams, userPreferences);
      
      // Categorize flights
      const categorizedFlights = this.categorizeFlights(scoredFlights);
      
      // Select primary recommendation
      const primary = this.selectPrimaryRecommendation(categorizedFlights, userPreferences);
      
      // Select alternatives
      const alternatives = this.selectAlternatives(categorizedFlights, primary);
      
      // Generate insights and tips
      const insights = await this.generateInsights(flights, searchParams);
      const tips = await this.generateTravelTips(searchParams, flights);

      return {
        primary,
        alternatives,
        insights,
        tips
      };

    } catch (error) {
      console.error('Error generating recommendations:', error);
      
      // Fallback to simple recommendations
      return this.generateFallbackRecommendations(flights);
    }
  }

  /**
   * Score flights based on multiple factors
   */
  private async scoreFlights(
    flights: FlightResult[],
    searchParams: ExtractedTravelParams,
    userPreferences?: UserPreferences
  ): Promise<FlightRecommendation[]> {
    const maxPrice = Math.max(...flights.map(f => f.price));
    const minPrice = Math.min(...flights.map(f => f.price));
    const maxDuration = Math.max(...flights.map(f => f.duration));
    const minDuration = Math.min(...flights.map(f => f.duration));

    return flights.map(flight => {
      let score = 0;
      const reasons: string[] = [];

      // Price scoring (30% weight)
      const priceScore = (maxPrice - flight.price) / (maxPrice - minPrice || 1);
      const priceWeight = this.getPriceWeight(userPreferences?.budgetRange);
      score += priceScore * priceWeight;

      if (flight.price === minPrice) {
        reasons.push('Lowest price available');
      } else if (priceScore > 0.8) {
        reasons.push('Great value for money');
      }

      // Duration scoring (25% weight)
      const durationScore = (maxDuration - flight.duration) / (maxDuration - minDuration || 1);
      score += durationScore * 0.25;

      if (flight.duration === minDuration) {
        reasons.push('Shortest flight time');
      } else if (durationScore > 0.8) {
        reasons.push('Quick flight duration');
      }

      // Stops scoring (20% weight)
      let stopsScore = 0;
      if (flight.stops === 0) {
        stopsScore = 1;
        reasons.push('Direct flight - no layovers');
      } else if (flight.stops === 1) {
        stopsScore = 0.6;
        reasons.push('Only one stop');
      } else {
        stopsScore = 0.3;
      }
      score += stopsScore * 0.20;

      // Time preference scoring (15% weight)
      const timeScore = this.getTimePreferenceScore(flight, userPreferences?.timePreference);
      score += timeScore * 0.15;

      if (timeScore > 0.8) {
        reasons.push('Convenient departure time');
      }

      // Airline preference scoring (10% weight)
      const airlineScore = this.getAirlinePreferenceScore(flight, userPreferences?.airlinePreferences);
      score += airlineScore * 0.10;

      if (airlineScore > 0.8) {
        reasons.push('Preferred airline');
      }

      // Determine category
      const category = this.determineFlightCategory(flight, flights);

      return {
        flight,
        score,
        reasons,
        category
      };
    });
  }

  /**
   * Get price weight based on budget preference
   */
  private getPriceWeight(budgetRange?: string): number {
    switch (budgetRange) {
      case 'budget': return 0.50; // Price is very important
      case 'mid-range': return 0.30; // Balanced approach
      case 'premium': return 0.15; // Price is less important
      default: return 0.30; // Default balanced approach
    }
  }

  /**
   * Score flight based on time preferences
   */
  private getTimePreferenceScore(flight: FlightResult, timePreference?: string): number {
    const hour = flight.departureTime.getHours();

    switch (timePreference) {
      case 'morning':
        return hour >= 6 && hour < 12 ? 1 : 0.3;
      case 'afternoon':
        return hour >= 12 && hour < 18 ? 1 : 0.3;
      case 'evening':
        return hour >= 18 && hour < 24 ? 1 : 0.3;
      case 'flexible':
      default:
        // Prefer reasonable hours (6 AM - 10 PM)
        return hour >= 6 && hour <= 22 ? 0.8 : 0.4;
    }
  }

  /**
   * Score flight based on airline preferences
   */
  private getAirlinePreferenceScore(flight: FlightResult, preferredAirlines?: string[]): number {
    if (!preferredAirlines || preferredAirlines.length === 0) {
      return 0.5; // Neutral score
    }

    return preferredAirlines.includes(flight.airline) ? 1 : 0.2;
  }

  /**
   * Determine flight category
   */
  private determineFlightCategory(
    flight: FlightResult, 
    allFlights: FlightResult[]
  ): 'best-value' | 'fastest' | 'cheapest' | 'most-convenient' {
    const minPrice = Math.min(...allFlights.map(f => f.price));
    const minDuration = Math.min(...allFlights.map(f => f.duration));
    const directFlights = allFlights.filter(f => f.stops === 0);

    if (flight.price === minPrice) {
      return 'cheapest';
    }

    if (flight.duration === minDuration) {
      return 'fastest';
    }

    if (flight.stops === 0 && directFlights.length > 0) {
      return 'most-convenient';
    }

    return 'best-value';
  }

  /**
   * Categorize flights by type
   */
  private categorizeFlights(scoredFlights: FlightRecommendation[]): {
    [key: string]: FlightRecommendation[]
  } {
    const categories: { [key: string]: FlightRecommendation[] } = {
      'best-value': [],
      'fastest': [],
      'cheapest': [],
      'most-convenient': []
    };

    scoredFlights.forEach(flight => {
      categories[flight.category].push(flight);
    });

    // Sort each category by score
    Object.keys(categories).forEach(category => {
      categories[category].sort((a, b) => b.score - a.score);
    });

    return categories;
  }

  /**
   * Select primary recommendation
   */
  private selectPrimaryRecommendation(
    categorizedFlights: { [key: string]: FlightRecommendation[] },
    userPreferences?: UserPreferences
  ): FlightRecommendation {
    // Determine priority based on user preferences
    const priorities = userPreferences?.priorityFactors || ['price', 'duration', 'convenience'];

    for (const priority of priorities) {
      let category: string;
      
      switch (priority) {
        case 'price':
          category = 'cheapest';
          break;
        case 'duration':
          category = 'fastest';
          break;
        case 'convenience':
          category = 'most-convenient';
          break;
        default:
          category = 'best-value';
      }

      if (categorizedFlights[category].length > 0) {
        return categorizedFlights[category][0];
      }
    }

    // Fallback to highest scored flight
    const allFlights = Object.values(categorizedFlights).flat();
    return allFlights.sort((a, b) => b.score - a.score)[0];
  }

  /**
   * Select alternative recommendations
   */
  private selectAlternatives(
    categorizedFlights: { [key: string]: FlightRecommendation[] },
    primary: FlightRecommendation
  ): FlightRecommendation[] {
    const alternatives: FlightRecommendation[] = [];
    const primaryId = primary.flight.id;

    // Get best from each category (excluding primary)
    Object.values(categorizedFlights).forEach(categoryFlights => {
      const alternative = categoryFlights.find(f => f.flight.id !== primaryId);
      if (alternative && !alternatives.some(a => a.flight.id === alternative.flight.id)) {
        alternatives.push(alternative);
      }
    });

    return alternatives.slice(0, 3); // Limit to 3 alternatives
  }

  /**
   * Generate insights about the flight options
   */
  private async generateInsights(
    flights: FlightResult[],
    searchParams: ExtractedTravelParams
  ): Promise<string[]> {
    const insights: string[] = [];

    // Price insights
    const prices = flights.map(f => f.price);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (maxPrice > minPrice * 1.5) {
      insights.push(`Prices vary significantly ($${minPrice} - $${maxPrice}). Consider flights with stops for savings.`);
    }

    // Duration insights
    const durations = flights.map(f => f.duration);
    const directFlights = flights.filter(f => f.stops === 0);
    
    if (directFlights.length > 0 && directFlights.length < flights.length) {
      const avgDirectDuration = directFlights.reduce((sum, f) => sum + f.duration, 0) / directFlights.length;
      const avgConnectingDuration = flights.filter(f => f.stops > 0)
        .reduce((sum, f) => sum + f.duration, 0) / (flights.length - directFlights.length);
      
      if (avgConnectingDuration > avgDirectDuration * 1.3) {
        insights.push(`Direct flights save significant time (${Math.round((avgConnectingDuration - avgDirectDuration) / 60)} hours on average).`);
      }
    }

    // Airline insights
    const airlines = [...new Set(flights.map(f => f.airline))];
    if (airlines.length > 3) {
      insights.push(`Multiple airlines available (${airlines.length} options) - compare services and policies.`);
    }

    // Time insights
    const morningFlights = flights.filter(f => f.departureTime.getHours() < 12).length;
    const afternoonFlights = flights.filter(f => {
      const hour = f.departureTime.getHours();
      return hour >= 12 && hour < 18;
    }).length;

    if (morningFlights > afternoonFlights * 2) {
      insights.push('More morning departure options available - consider early flights for better selection.');
    }

    return insights.slice(0, 3);
  }

  /**
   * Generate travel tips using AI
   */
  private async generateTravelTips(
    searchParams: ExtractedTravelParams,
    flights: FlightResult[]
  ): Promise<string[]> {
    try {
      const route = `${searchParams.origin} to ${searchParams.destination}`;
      const travelDate = searchParams.departureDate?.toDateString() || 'your travel date';
      
      const prompt = `Generate 3 practical travel tips for someone flying ${route} on ${travelDate}. 
      
Consider:
- Best booking practices
- Airport and destination-specific advice
- Seasonal considerations
- General travel efficiency tips

Keep tips concise and actionable.

Tips:`;

      const aiTips = await vertexAIService.generateConversationalResponse(prompt);
      
      return aiTips
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(tip => tip.replace(/^\d+\.\s*/, '').trim())
        .slice(0, 3);

    } catch (error) {
      console.error('Error generating travel tips:', error);
      
      // Fallback tips
      return [
        'Book flights on Tuesday or Wednesday for better prices',
        'Arrive at the airport 2 hours early for domestic flights',
        'Check airline baggage policies before packing'
      ];
    }
  }

  /**
   * Generate fallback recommendations when AI fails
   */
  private generateFallbackRecommendations(flights: FlightResult[]): RecommendationSet {
    // Sort by price for primary recommendation
    const sortedByPrice = [...flights].sort((a, b) => a.price - b.price);
    const sortedByDuration = [...flights].sort((a, b) => a.duration - b.duration);
    const directFlights = flights.filter(f => f.stops === 0);

    const primary: FlightRecommendation = {
      flight: sortedByPrice[0],
      score: 0.8,
      reasons: ['Lowest price available'],
      category: 'cheapest'
    };

    const alternatives: FlightRecommendation[] = [];

    // Add fastest flight if different from cheapest
    if (sortedByDuration[0].id !== primary.flight.id) {
      alternatives.push({
        flight: sortedByDuration[0],
        score: 0.7,
        reasons: ['Shortest flight time'],
        category: 'fastest'
      });
    }

    // Add best direct flight if available
    if (directFlights.length > 0 && !alternatives.some(a => a.flight.id === directFlights[0].id)) {
      alternatives.push({
        flight: directFlights[0],
        score: 0.6,
        reasons: ['Direct flight - no layovers'],
        category: 'most-convenient'
      });
    }

    return {
      primary,
      alternatives: alternatives.slice(0, 2),
      insights: ['Compare prices and flight times to find your best option'],
      tips: ['Book in advance for better prices', 'Check airline policies before booking']
    };
  }

  /**
   * Compare flights side by side
   */
  compareFlights(flights: FlightResult[]): {
    comparison: Array<{
      flight: FlightResult;
      advantages: string[];
      disadvantages: string[];
    }>;
    summary: string;
  } {
    if (flights.length < 2) {
      throw new Error('Need at least 2 flights to compare');
    }

    const minPrice = Math.min(...flights.map(f => f.price));
    const minDuration = Math.min(...flights.map(f => f.duration));
    const minStops = Math.min(...flights.map(f => f.stops));

    const comparison = flights.map(flight => {
      const advantages: string[] = [];
      const disadvantages: string[] = [];

      // Price comparison
      if (flight.price === minPrice) {
        advantages.push('Lowest price');
      } else if (flight.price > minPrice * 1.2) {
        disadvantages.push('Higher price');
      }

      // Duration comparison
      if (flight.duration === minDuration) {
        advantages.push('Shortest flight time');
      } else if (flight.duration > minDuration * 1.3) {
        disadvantages.push('Longer flight time');
      }

      // Stops comparison
      if (flight.stops === minStops) {
        if (flight.stops === 0) {
          advantages.push('Direct flight');
        } else {
          advantages.push('Fewest stops');
        }
      } else if (flight.stops > minStops) {
        disadvantages.push(`${flight.stops} stop${flight.stops > 1 ? 's' : ''}`);
      }

      // Departure time
      const hour = flight.departureTime.getHours();
      if (hour >= 8 && hour <= 18) {
        advantages.push('Convenient departure time');
      } else if (hour < 6 || hour > 22) {
        disadvantages.push('Early/late departure');
      }

      return {
        flight,
        advantages,
        disadvantages
      };
    });

    const summary = `Comparing ${flights.length} flights: Price range $${minPrice}-$${Math.max(...flights.map(f => f.price))}, Duration ${Math.round(minDuration/60)}h-${Math.round(Math.max(...flights.map(f => f.duration))/60)}h`;

    return { comparison, summary };
  }
}

// Export singleton instance
export const flightRecommendationService = new FlightRecommendationService();