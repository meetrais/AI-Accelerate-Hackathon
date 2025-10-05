import { vertexAIService } from './vertexai';
import { elasticsearchService } from './elasticsearch';
import { FlightResult } from '../types';

export interface PricePrediction {
  currentPrice: number;
  predictedPrice: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  recommendation: 'book_now' | 'wait' | 'monitor';
  reasoning: string;
  historicalData?: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
  };
}

export interface DelayPrediction {
  probability: number;
  expectedDelay: number; // minutes
  factors: string[];
  confidence: number;
  recommendation: string;
}

export interface DemandForecast {
  route: string;
  date: Date;
  demandLevel: 'low' | 'medium' | 'high' | 'very_high';
  availabilityTrend: 'increasing' | 'decreasing' | 'stable';
  priceImpact: 'lower' | 'normal' | 'higher';
  reasoning: string;
}

export class PredictiveAnalyticsService {
  /**
   * Predict price trends for a flight route
   */
  async predictPriceTrend(
    origin: string,
    destination: string,
    departureDate: Date,
    currentPrice?: number
  ): Promise<PricePrediction> {
    try {
      // Get historical price data
      const historicalData = await this.getHistoricalPrices(origin, destination);
      
      // Analyze seasonality and trends
      const seasonalFactors = this.analyzeSeasonality(departureDate);
      const daysToDeparture = this.getDaysToDeparture(departureDate);

      // Build prediction prompt
      const prompt = `Analyze flight price trends and predict future prices.

Route: ${origin} to ${destination}
Departure Date: ${departureDate.toDateString()}
Days Until Departure: ${daysToDeparture}
Current Price: $${currentPrice || 'Unknown'}

Historical Data:
- Average Price: $${historicalData.avgPrice}
- Price Range: $${historicalData.minPrice} - $${historicalData.maxPrice}
- Seasonal Factor: ${seasonalFactors.factor}

Booking Timeline Factors:
- Optimal booking window: 21-60 days before departure
- Current position: ${daysToDeparture} days out
- Price typically ${daysToDeparture < 21 ? 'increases' : daysToDeparture > 60 ? 'decreases' : 'stabilizes'} at this point

Provide a price prediction with:
1. Predicted price trend (increasing/decreasing/stable)
2. Confidence level (0-1)
3. Recommendation (book_now/wait/monitor)
4. Clear reasoning

Format as JSON:
{
  "trend": "increasing|decreasing|stable",
  "predictedPrice": number,
  "confidence": 0.0-1.0,
  "recommendation": "book_now|wait|monitor",
  "reasoning": "explanation"
}`;

      const response = await vertexAIService.generateConversationalResponse(prompt);
      const prediction = this.parsePredictionResponse(response);

      return {
        currentPrice: currentPrice || historicalData.avgPrice,
        predictedPrice: prediction.predictedPrice || historicalData.avgPrice * 1.1,
        trend: prediction.trend || 'stable',
        confidence: prediction.confidence || 0.7,
        recommendation: prediction.recommendation || 'monitor',
        reasoning: prediction.reasoning || 'Based on historical trends and booking timeline',
        historicalData
      };
    } catch (error) {
      console.error('❌ Price prediction failed:', error);
      return this.getFallbackPricePrediction(currentPrice);
    }
  }

  /**
   * Predict flight delay probability
   */
  async predictDelay(
    flight: FlightResult,
    weatherConditions?: any
  ): Promise<DelayPrediction> {
    try {
      const factors: string[] = [];
      let baseProbability = 0.15; // 15% base delay probability

      // Analyze various factors
      
      // Time of day factor
      const hour = flight.departureTime.getHours();
      if (hour >= 17 && hour <= 20) {
        baseProbability += 0.1;
        factors.push('Peak evening departure time');
      }

      // Route complexity
      if (flight.stops > 0) {
        baseProbability += 0.05 * flight.stops;
        factors.push(`${flight.stops} connection(s) increase delay risk`);
      }

      // Airline historical performance (mock data)
      const airlineReliability = this.getAirlineReliability(flight.airline);
      baseProbability *= airlineReliability.factor;
      if (airlineReliability.factor > 1.1) {
        factors.push(`${flight.airline} has higher delay rates`);
      }

      // Weather impact
      if (weatherConditions) {
        const weatherImpact = this.assessWeatherImpact(weatherConditions);
        baseProbability += weatherImpact.probability;
        if (weatherImpact.probability > 0.1) {
          factors.push(weatherImpact.reason);
        }
      }

      // Day of week
      const dayOfWeek = flight.departureTime.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
        baseProbability += 0.05;
        factors.push('Weekend travel increases congestion');
      }

      // Cap probability
      const probability = Math.min(baseProbability, 0.85);

      // Estimate expected delay
      const expectedDelay = probability > 0.3 ? Math.round(probability * 60) : 0;

      // Generate recommendation
      let recommendation = 'Flight is likely on time';
      if (probability > 0.5) {
        recommendation = 'High delay risk - consider earlier flight or allow extra time';
      } else if (probability > 0.3) {
        recommendation = 'Moderate delay risk - monitor flight status closely';
      }

      return {
        probability,
        expectedDelay,
        factors,
        confidence: 0.75,
        recommendation
      };
    } catch (error) {
      console.error('❌ Delay prediction failed:', error);
      return {
        probability: 0.15,
        expectedDelay: 0,
        factors: ['Unable to analyze delay factors'],
        confidence: 0.5,
        recommendation: 'Monitor flight status'
      };
    }
  }

  /**
   * Forecast demand for a route
   */
  async forecastDemand(
    origin: string,
    destination: string,
    date: Date
  ): Promise<DemandForecast> {
    try {
      // Get current availability
      const availability = await this.getRouteAvailability(origin, destination, date);
      
      // Analyze demand factors
      const seasonalDemand = this.analyzeSeasonality(date);
      const daysToDeparture = this.getDaysToDeparture(date);
      const dayOfWeek = date.getDay();

      let demandLevel: 'low' | 'medium' | 'high' | 'very_high' = 'medium';
      let priceImpact: 'lower' | 'normal' | 'higher' = 'normal';
      let availabilityTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';

      // Determine demand level
      if (seasonalDemand.factor > 1.3 || availability.bookingRate > 0.7) {
        demandLevel = 'very_high';
        priceImpact = 'higher';
        availabilityTrend = 'decreasing';
      } else if (seasonalDemand.factor > 1.1 || availability.bookingRate > 0.5) {
        demandLevel = 'high';
        priceImpact = 'higher';
        availabilityTrend = 'decreasing';
      } else if (seasonalDemand.factor < 0.9 && availability.bookingRate < 0.3) {
        demandLevel = 'low';
        priceImpact = 'lower';
        availabilityTrend = 'increasing';
      }

      // Weekend adjustment
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        if (demandLevel === 'medium') demandLevel = 'high';
        if (demandLevel === 'low') demandLevel = 'medium';
      }

      const reasoning = this.generateDemandReasoning(
        demandLevel,
        seasonalDemand,
        availability,
        daysToDeparture
      );

      return {
        route: `${origin}-${destination}`,
        date,
        demandLevel,
        availabilityTrend,
        priceImpact,
        reasoning
      };
    } catch (error) {
      console.error('❌ Demand forecast failed:', error);
      return {
        route: `${origin}-${destination}`,
        date,
        demandLevel: 'medium',
        availabilityTrend: 'stable',
        priceImpact: 'normal',
        reasoning: 'Unable to generate detailed forecast'
      };
    }
  }

  /**
   * Predict optimal booking time
   */
  async predictOptimalBookingTime(
    origin: string,
    destination: string,
    departureDate: Date
  ): Promise<{
    optimalDate: Date;
    currentStatus: 'too_early' | 'optimal' | 'too_late';
    daysToWait: number;
    potentialSavings: number;
    reasoning: string;
  }> {
    try {
      const daysToDeparture = this.getDaysToDeparture(departureDate);
      const historicalData = await this.getHistoricalPrices(origin, destination);

      let optimalDaysOut = 45; // Typical optimal booking window
      let currentStatus: 'too_early' | 'optimal' | 'too_late';
      let daysToWait = 0;
      let potentialSavings = 0;

      if (daysToDeparture > 60) {
        currentStatus = 'too_early';
        daysToWait = daysToDeparture - optimalDaysOut;
        potentialSavings = historicalData.avgPrice * 0.1; // Potential 10% savings
      } else if (daysToDeparture >= 21 && daysToDeparture <= 60) {
        currentStatus = 'optimal';
        daysToWait = 0;
        potentialSavings = 0;
      } else {
        currentStatus = 'too_late';
        daysToWait = 0;
        potentialSavings = -(historicalData.avgPrice * 0.15); // Likely paying 15% more
      }

      const optimalDate = new Date();
      optimalDate.setDate(optimalDate.getDate() + daysToWait);

      const reasoning = this.generateBookingTimeReasoning(
        currentStatus,
        daysToDeparture,
        daysToWait,
        potentialSavings
      );

      return {
        optimalDate,
        currentStatus,
        daysToWait,
        potentialSavings,
        reasoning
      };
    } catch (error) {
      console.error('❌ Optimal booking time prediction failed:', error);
      return {
        optimalDate: new Date(),
        currentStatus: 'optimal',
        daysToWait: 0,
        potentialSavings: 0,
        reasoning: 'Book when prices meet your budget'
      };
    }
  }

  /**
   * Get historical price data for a route
   */
  private async getHistoricalPrices(
    origin: string,
    destination: string
  ): Promise<{ avgPrice: number; minPrice: number; maxPrice: number }> {
    try {
      // Query Elasticsearch for historical data
      const response = await elasticsearchService.getClient().search({
        index: 'flights',
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
            price_stats: {
              stats: { field: 'price' }
            }
          },
          size: 0
        }
      });

      const stats = response.aggregations?.price_stats as any;

      return {
        avgPrice: stats?.avg || 500,
        minPrice: stats?.min || 350,
        maxPrice: stats?.max || 800
      };
    } catch (error) {
      console.error('Error fetching historical prices:', error);
      return { avgPrice: 500, minPrice: 350, maxPrice: 800 };
    }
  }

  /**
   * Analyze seasonality factors
   */
  private analyzeSeasonality(date: Date): { factor: number; reason: string } {
    const month = date.getMonth();
    const dayOfWeek = date.getDay();

    // Peak travel months (summer and holidays)
    if (month >= 5 && month <= 7) {
      return { factor: 1.3, reason: 'Summer peak season' };
    }
    if (month === 11 || month === 0) {
      return { factor: 1.4, reason: 'Holiday season' };
    }

    // Shoulder season
    if (month === 3 || month === 4 || month === 8 || month === 9) {
      return { factor: 1.1, reason: 'Shoulder season' };
    }

    // Off-peak
    return { factor: 0.9, reason: 'Off-peak season' };
  }

  /**
   * Get days until departure
   */
  private getDaysToDeparture(departureDate: Date): number {
    const now = new Date();
    const diffTime = departureDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get airline reliability factor (mock data)
   */
  private getAirlineReliability(airline: string): { factor: number; rating: string } {
    const reliabilityData: { [key: string]: number } = {
      'Delta Air Lines': 0.95,
      'American Airlines': 1.05,
      'United Airlines': 1.1,
      'Southwest Airlines': 0.9,
      'JetBlue Airways': 0.95,
      'Alaska Airlines': 0.85
    };

    const factor = reliabilityData[airline] || 1.0;
    const rating = factor < 0.95 ? 'Excellent' : factor < 1.05 ? 'Good' : 'Fair';

    return { factor, rating };
  }

  /**
   * Assess weather impact on delays
   */
  private assessWeatherImpact(conditions: any): { probability: number; reason: string } {
    // Mock weather assessment - in production, integrate with weather API
    if (conditions.severe) {
      return { probability: 0.4, reason: 'Severe weather conditions' };
    }
    if (conditions.rain || conditions.snow) {
      return { probability: 0.15, reason: 'Precipitation may cause delays' };
    }
    if (conditions.wind > 30) {
      return { probability: 0.2, reason: 'High winds may affect operations' };
    }
    return { probability: 0, reason: 'Weather conditions favorable' };
  }

  /**
   * Get route availability
   */
  private async getRouteAvailability(
    origin: string,
    destination: string,
    date: Date
  ): Promise<{ totalSeats: number; bookedSeats: number; bookingRate: number }> {
    try {
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const response = await elasticsearchService.getClient().search({
        index: 'flights',
        body: {
          query: {
            bool: {
              must: [
                { term: { 'origin.code': origin } },
                { term: { 'destination.code': destination } },
                {
                  range: {
                    departureTime: {
                      gte: startOfDay.toISOString(),
                      lte: endOfDay.toISOString()
                    }
                  }
                }
              ]
            }
          },
          aggs: {
            total_capacity: { sum: { field: 'availableSeats' } }
          },
          size: 0
        }
      });

      const totalSeats = (response.aggregations?.total_capacity as any)?.value || 200;
      const bookedSeats = Math.floor(totalSeats * 0.6); // Mock booking rate
      const bookingRate = bookedSeats / totalSeats;

      return { totalSeats, bookedSeats, bookingRate };
    } catch (error) {
      return { totalSeats: 200, bookedSeats: 120, bookingRate: 0.6 };
    }
  }

  /**
   * Parse AI prediction response
   */
  private parsePredictionResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Failed to parse prediction response:', error);
    }
    return {};
  }

  /**
   * Generate demand reasoning
   */
  private generateDemandReasoning(
    demandLevel: string,
    seasonalDemand: any,
    availability: any,
    daysToDeparture: number
  ): string {
    const reasons: string[] = [];

    reasons.push(`Demand is ${demandLevel} for this route`);
    reasons.push(seasonalDemand.reason);
    reasons.push(`Current booking rate: ${(availability.bookingRate * 100).toFixed(0)}%`);
    
    if (daysToDeparture < 14) {
      reasons.push('Close to departure date increases urgency');
    }

    return reasons.join('. ') + '.';
  }

  /**
   * Generate booking time reasoning
   */
  private generateBookingTimeReasoning(
    status: string,
    daysToDeparture: number,
    daysToWait: number,
    potentialSavings: number
  ): string {
    if (status === 'optimal') {
      return `You're in the optimal booking window (${daysToDeparture} days out). Prices are typically best 21-60 days before departure.`;
    }
    if (status === 'too_early') {
      return `Booking ${daysToDeparture} days out may be too early. Consider waiting ${daysToWait} days for potential savings of $${Math.abs(potentialSavings).toFixed(0)}.`;
    }
    return `With only ${daysToDeparture} days until departure, prices are likely higher. Book soon to secure availability.`;
  }

  /**
   * Fallback price prediction
   */
  private getFallbackPricePrediction(currentPrice?: number): PricePrediction {
    return {
      currentPrice: currentPrice || 500,
      predictedPrice: (currentPrice || 500) * 1.05,
      trend: 'stable',
      confidence: 0.5,
      recommendation: 'monitor',
      reasoning: 'Limited data available for prediction',
      historicalData: {
        avgPrice: 500,
        minPrice: 350,
        maxPrice: 800
      }
    };
  }
}

// Export singleton instance
export const predictiveAnalyticsService = new PredictiveAnalyticsService();
