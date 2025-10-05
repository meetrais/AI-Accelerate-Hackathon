import { Firestore } from '@google-cloud/firestore';
import { config } from '../config';
import { vertexAIService } from './vertexai';
import { embeddingService } from './embeddingService';
import { FlightResult } from '../types';

export interface UserProfile {
  userId: string;
  preferences: UserPreferences;
  travelHistory: TravelHistory[];
  searchHistory: SearchHistory[];
  behaviorPatterns: BehaviorPatterns;
  lastUpdated: Date;
}

export interface UserPreferences {
  budgetRange?: 'budget' | 'mid-range' | 'premium';
  preferredAirlines: string[];
  preferredAirports: string[];
  seatPreference?: 'window' | 'aisle' | 'middle' | 'any';
  mealPreference?: string[];
  specialNeeds?: string[];
  loyaltyPrograms: { airline: string; number: string }[];
  timePreferences: {
    departureTime?: 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night';
    flexibleDates: boolean;
  };
  stopPreference: 'direct_only' | 'one_stop_ok' | 'any';
}

export interface TravelHistory {
  bookingId: string;
  flightId: string;
  origin: string;
  destination: string;
  airline: string;
  price: number;
  date: Date;
  rating?: number;
  feedback?: string;
}

export interface SearchHistory {
  query: string;
  timestamp: Date;
  origin?: string;
  destination?: string;
  selectedFlight?: string;
  booked: boolean;
}

export interface BehaviorPatterns {
  averageBookingLeadTime: number; // days before departure
  priceFlexibility: number; // 0-1, how much price matters
  timeFlexibility: number; // 0-1, how flexible with times
  frequentRoutes: { route: string; count: number }[];
  preferredBookingTime: string; // time of day user typically books
  conversionRate: number; // searches to bookings ratio
}

export interface PersonalizedRecommendation {
  flight: FlightResult;
  score: number;
  personalizedReasons: string[];
  matchFactors: {
    priceMatch: number;
    airlineMatch: number;
    timeMatch: number;
    routeMatch: number;
    overallMatch: number;
  };
}

export class PersonalizationEngine {
  private firestore: Firestore;

  constructor() {
    this.firestore = new Firestore({
      projectId: config.googleCloud.projectId
    });
  }

  /**
   * Get or create user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const docRef = this.firestore.collection('userProfiles').doc(userId);
      const doc = await docRef.get();

      if (doc.exists) {
        return doc.data() as UserProfile;
      }

      // Create new profile
      const newProfile: UserProfile = {
        userId,
        preferences: {
          preferredAirlines: [],
          preferredAirports: [],
          loyaltyPrograms: [],
          timePreferences: { flexibleDates: true },
          stopPreference: 'any'
        },
        travelHistory: [],
        searchHistory: [],
        behaviorPatterns: {
          averageBookingLeadTime: 30,
          priceFlexibility: 0.5,
          timeFlexibility: 0.5,
          frequentRoutes: [],
          preferredBookingTime: 'evening',
          conversionRate: 0
        },
        lastUpdated: new Date()
      };

      await docRef.set(newProfile);
      return newProfile;
    } catch (error) {
      console.error('❌ Failed to get user profile:', error);
      throw error;
    }
  }

  /**
   * Update user profile with new data
   */
  async updateUserProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<void> {
    try {
      const docRef = this.firestore.collection('userProfiles').doc(userId);
      await docRef.update({
        ...updates,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('❌ Failed to update user profile:', error);
      throw error;
    }
  }

  /**
   * Learn from user search behavior
   */
  async learnFromSearch(
    userId: string,
    searchQuery: string,
    searchParams: any,
    selectedFlight?: FlightResult,
    booked: boolean = false
  ): Promise<void> {
    try {
      const profile = await this.getUserProfile(userId);

      // Add to search history
      const searchEntry: SearchHistory = {
        query: searchQuery,
        timestamp: new Date(),
        origin: searchParams.origin,
        destination: searchParams.destination,
        selectedFlight: selectedFlight?.id,
        booked
      };

      profile.searchHistory.push(searchEntry);

      // Update behavior patterns
      await this.updateBehaviorPatterns(profile);

      // Learn preferences from selections
      if (selectedFlight) {
        await this.learnPreferencesFromSelection(profile, selectedFlight);
      }

      // Save updated profile
      await this.updateUserProfile(userId, profile);
    } catch (error) {
      console.error('❌ Failed to learn from search:', error);
    }
  }

  /**
   * Learn from completed booking
   */
  async learnFromBooking(
    userId: string,
    booking: any,
    flight: FlightResult
  ): Promise<void> {
    try {
      const profile = await this.getUserProfile(userId);

      // Add to travel history
      const travelEntry: TravelHistory = {
        bookingId: booking.id,
        flightId: flight.id,
        origin: flight.origin.code,
        destination: flight.destination.code,
        airline: flight.airline,
        price: flight.price,
        date: flight.departureTime
      };

      profile.travelHistory.push(travelEntry);

      // Update preferences based on booking
      await this.updatePreferencesFromBooking(profile, flight);

      // Update behavior patterns
      await this.updateBehaviorPatterns(profile);

      // Save updated profile
      await this.updateUserProfile(userId, profile);
    } catch (error) {
      console.error('❌ Failed to learn from booking:', error);
    }
  }

  /**
   * Generate personalized flight recommendations
   */
  async generatePersonalizedRecommendations(
    userId: string,
    flights: FlightResult[],
    searchContext?: any
  ): Promise<PersonalizedRecommendation[]> {
    try {
      const profile = await this.getUserProfile(userId);

      const recommendations = flights.map(flight => {
        const matchFactors = this.calculateMatchFactors(flight, profile);
        const score = this.calculatePersonalizationScore(matchFactors);
        const reasons = this.generatePersonalizedReasons(flight, profile, matchFactors);

        return {
          flight,
          score,
          personalizedReasons: reasons,
          matchFactors
        };
      });

      // Sort by personalization score
      recommendations.sort((a, b) => b.score - a.score);

      return recommendations;
    } catch (error) {
      console.error('❌ Failed to generate personalized recommendations:', error);
      return flights.map(flight => ({
        flight,
        score: 0.5,
        personalizedReasons: ['Based on general preferences'],
        matchFactors: {
          priceMatch: 0.5,
          airlineMatch: 0.5,
          timeMatch: 0.5,
          routeMatch: 0.5,
          overallMatch: 0.5
        }
      }));
    }
  }

  /**
   * Predict user preferences using AI
   */
  async predictUserPreferences(userId: string): Promise<{
    predictions: any;
    confidence: number;
    insights: string[];
  }> {
    try {
      const profile = await this.getUserProfile(userId);

      // Build context for AI prediction
      const context = `
User Travel Profile:
- Total bookings: ${profile.travelHistory.length}
- Total searches: ${profile.searchHistory.length}
- Conversion rate: ${(profile.behaviorPatterns.conversionRate * 100).toFixed(1)}%
- Average booking lead time: ${profile.behaviorPatterns.averageBookingLeadTime} days
- Frequent routes: ${profile.behaviorPatterns.frequentRoutes.map(r => r.route).join(', ')}

Recent Travel History:
${profile.travelHistory.slice(-5).map(t => 
  `- ${t.origin} to ${t.destination} on ${t.airline} for $${t.price}`
).join('\n')}

Current Preferences:
${JSON.stringify(profile.preferences, null, 2)}

Based on this data, predict:
1. What are the user's true priorities (price, convenience, comfort)?
2. What airlines do they prefer and why?
3. What time of day do they prefer to travel?
4. Are they a budget traveler or willing to pay for premium?
5. What recommendations would improve their experience?

Format as JSON with predictions and insights.`;

      const response = await vertexAIService.generateConversationalResponse(context);
      const parsed = this.parsePredictionResponse(response);

      return {
        predictions: parsed.predictions || {},
        confidence: parsed.confidence || 0.7,
        insights: parsed.insights || []
      };
    } catch (error) {
      console.error('❌ Failed to predict user preferences:', error);
      return {
        predictions: {},
        confidence: 0.5,
        insights: ['Insufficient data for predictions']
      };
    }
  }

  /**
   * Get personalized search suggestions
   */
  async getPersonalizedSearchSuggestions(userId: string): Promise<string[]> {
    try {
      const profile = await this.getUserProfile(userId);
      const suggestions: string[] = [];

      // Suggest frequent routes
      profile.behaviorPatterns.frequentRoutes.slice(0, 3).forEach(route => {
        suggestions.push(`Search flights on ${route.route}`);
      });

      // Suggest based on travel history
      if (profile.travelHistory.length > 0) {
        const lastTrip = profile.travelHistory[profile.travelHistory.length - 1];
        const monthsAgo = Math.floor(
          (Date.now() - lastTrip.date.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        
        if (monthsAgo >= 3) {
          suggestions.push(`Return to ${lastTrip.destination}?`);
        }
      }

      // Suggest based on season
      const month = new Date().getMonth();
      if (month >= 5 && month <= 7) {
        suggestions.push('Summer vacation destinations');
      } else if (month === 11 || month === 0) {
        suggestions.push('Holiday travel deals');
      }

      return suggestions.slice(0, 5);
    } catch (error) {
      console.error('❌ Failed to get search suggestions:', error);
      return [];
    }
  }

  /**
   * Calculate match factors between flight and user profile
   */
  private calculateMatchFactors(
    flight: FlightResult,
    profile: UserProfile
  ): PersonalizedRecommendation['matchFactors'] {
    let priceMatch = 0.5;
    let airlineMatch = 0.5;
    let timeMatch = 0.5;
    let routeMatch = 0.5;

    // Price match
    if (profile.travelHistory.length > 0) {
      const avgPrice = profile.travelHistory.reduce((sum, t) => sum + t.price, 0) / 
                       profile.travelHistory.length;
      const priceDiff = Math.abs(flight.price - avgPrice) / avgPrice;
      priceMatch = Math.max(0, 1 - priceDiff);
    }

    // Airline match
    if (profile.preferences.preferredAirlines.includes(flight.airline)) {
      airlineMatch = 1.0;
    } else if (profile.travelHistory.some(t => t.airline === flight.airline)) {
      airlineMatch = 0.8;
    }

    // Time match
    const hour = flight.departureTime.getHours();
    const preferredTime = profile.preferences.timePreferences.departureTime;
    if (preferredTime) {
      if (preferredTime === 'early_morning' && hour >= 5 && hour < 8) timeMatch = 1.0;
      else if (preferredTime === 'morning' && hour >= 8 && hour < 12) timeMatch = 1.0;
      else if (preferredTime === 'afternoon' && hour >= 12 && hour < 17) timeMatch = 1.0;
      else if (preferredTime === 'evening' && hour >= 17 && hour < 21) timeMatch = 1.0;
      else if (preferredTime === 'night' && (hour >= 21 || hour < 5)) timeMatch = 1.0;
    }

    // Route match
    const route = `${flight.origin.code}-${flight.destination.code}`;
    const frequentRoute = profile.behaviorPatterns.frequentRoutes.find(r => r.route === route);
    if (frequentRoute) {
      routeMatch = Math.min(1.0, 0.5 + (frequentRoute.count * 0.1));
    }

    const overallMatch = (priceMatch + airlineMatch + timeMatch + routeMatch) / 4;

    return { priceMatch, airlineMatch, timeMatch, routeMatch, overallMatch };
  }

  /**
   * Calculate personalization score
   */
  private calculatePersonalizationScore(
    matchFactors: PersonalizedRecommendation['matchFactors']
  ): number {
    // Weighted average of match factors
    return (
      matchFactors.priceMatch * 0.3 +
      matchFactors.airlineMatch * 0.25 +
      matchFactors.timeMatch * 0.2 +
      matchFactors.routeMatch * 0.25
    );
  }

  /**
   * Generate personalized reasons
   */
  private generatePersonalizedReasons(
    flight: FlightResult,
    profile: UserProfile,
    matchFactors: PersonalizedRecommendation['matchFactors']
  ): string[] {
    const reasons: string[] = [];

    if (matchFactors.airlineMatch >= 0.8) {
      reasons.push(`You've flown ${flight.airline} before`);
    }

    if (matchFactors.priceMatch >= 0.8) {
      reasons.push('Price matches your typical budget');
    }

    if (matchFactors.timeMatch >= 0.8) {
      reasons.push('Departure time matches your preference');
    }

    if (matchFactors.routeMatch >= 0.7) {
      reasons.push('You frequently travel this route');
    }

    if (flight.stops === 0 && profile.preferences.stopPreference === 'direct_only') {
      reasons.push('Direct flight as you prefer');
    }

    if (profile.preferences.loyaltyPrograms.some(lp => lp.airline === flight.airline)) {
      reasons.push('Earn miles with your loyalty program');
    }

    return reasons.length > 0 ? reasons : ['Recommended based on your profile'];
  }

  /**
   * Update behavior patterns from profile data
   */
  private async updateBehaviorPatterns(profile: UserProfile): Promise<void> {
    // Calculate average booking lead time
    if (profile.travelHistory.length > 0) {
      const leadTimes = profile.travelHistory.map(t => {
        // Estimate booking date (mock - in real system, store actual booking date)
        const bookingDate = new Date(t.date);
        bookingDate.setDate(bookingDate.getDate() - 30);
        return Math.floor((t.date.getTime() - bookingDate.getTime()) / (1000 * 60 * 60 * 24));
      });
      profile.behaviorPatterns.averageBookingLeadTime = 
        leadTimes.reduce((sum, lt) => sum + lt, 0) / leadTimes.length;
    }

    // Calculate conversion rate
    const totalSearches = profile.searchHistory.length;
    const totalBookings = profile.searchHistory.filter(s => s.booked).length;
    profile.behaviorPatterns.conversionRate = totalSearches > 0 ? totalBookings / totalSearches : 0;

    // Update frequent routes
    const routeCounts: { [key: string]: number } = {};
    profile.travelHistory.forEach(t => {
      const route = `${t.origin}-${t.destination}`;
      routeCounts[route] = (routeCounts[route] || 0) + 1;
    });

    profile.behaviorPatterns.frequentRoutes = Object.entries(routeCounts)
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Learn preferences from flight selection
   */
  private async learnPreferencesFromSelection(
    profile: UserProfile,
    flight: FlightResult
  ): Promise<void> {
    // Learn airline preference
    if (!profile.preferences.preferredAirlines.includes(flight.airline)) {
      profile.preferences.preferredAirlines.push(flight.airline);
    }

    // Learn time preference
    const hour = flight.departureTime.getHours();
    if (hour >= 5 && hour < 8) {
      profile.preferences.timePreferences.departureTime = 'early_morning';
    } else if (hour >= 8 && hour < 12) {
      profile.preferences.timePreferences.departureTime = 'morning';
    } else if (hour >= 12 && hour < 17) {
      profile.preferences.timePreferences.departureTime = 'afternoon';
    } else if (hour >= 17 && hour < 21) {
      profile.preferences.timePreferences.departureTime = 'evening';
    }

    // Learn stop preference
    if (flight.stops === 0) {
      profile.preferences.stopPreference = 'direct_only';
    }
  }

  /**
   * Update preferences from booking
   */
  private async updatePreferencesFromBooking(
    profile: UserProfile,
    flight: FlightResult
  ): Promise<void> {
    // Similar to learnPreferencesFromSelection but with higher confidence
    await this.learnPreferencesFromSelection(profile, flight);

    // Update budget range based on booking price
    if (flight.price < 300) {
      profile.preferences.budgetRange = 'budget';
    } else if (flight.price < 600) {
      profile.preferences.budgetRange = 'mid-range';
    } else {
      profile.preferences.budgetRange = 'premium';
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
    return { predictions: {}, confidence: 0.5, insights: [] };
  }
}

// Export singleton instance
export const personalizationEngine = new PersonalizationEngine();
