import { Firestore } from '@google-cloud/firestore';
import { config } from '../config';
import { vertexAIService } from './vertexai';
import { predictiveAnalyticsService } from './predictiveAnalytics';
import { ragService } from './ragService';
import { FlightResult } from '../types';

export interface ProactiveAlert {
  id: string;
  userId: string;
  bookingId: string;
  type: 'delay' | 'cancellation' | 'gate_change' | 'price_drop' | 'rebooking' | 'reminder';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  actionable: boolean;
  suggestedActions?: string[];
  alternativeFlights?: FlightResult[];
  timestamp: Date;
  read: boolean;
}

export interface MonitoredBooking {
  bookingId: string;
  userId: string;
  flightId: string;
  flight: FlightResult;
  monitoringEnabled: boolean;
  alertPreferences: {
    delays: boolean;
    gateChanges: boolean;
    priceDrops: boolean;
    weatherAlerts: boolean;
  };
}

export class ProactiveAssistanceService {
  private firestore: Firestore;

  constructor() {
    this.firestore = new Firestore({
      projectId: config.googleCloud.projectId
    });
  }

  /**
   * Monitor flight for proactive alerts
   */
  async monitorFlight(booking: MonitoredBooking): Promise<void> {
    try {
      // Store monitoring configuration
      await this.firestore
        .collection('monitoredBookings')
        .doc(booking.bookingId)
        .set(booking);

      console.log(`✅ Started monitoring booking ${booking.bookingId}`);
    } catch (error) {
      console.error('❌ Failed to start monitoring:', error);
      throw error;
    }
  }

  /**
   * Check for flight delays and send alerts
   */
  async checkForDelays(): Promise<void> {
    try {
      const monitoredBookings = await this.getActiveMonitoredBookings();

      for (const booking of monitoredBookings) {
        if (!booking.alertPreferences.delays) continue;

        // Predict delay probability
        const delayPrediction = await predictiveAnalyticsService.predictDelay(
          booking.flight
        );

        // Send alert if high delay probability
        if (delayPrediction.probability > 0.5) {
          await this.sendDelayAlert(booking, delayPrediction);
        }
      }
    } catch (error) {
      console.error('❌ Failed to check for delays:', error);
    }
  }

  /**
   * Monitor price drops for similar flights
   */
  async monitorPriceDrops(
    userId: string,
    searchParams: any,
    currentPrice: number
  ): Promise<void> {
    try {
      // Store price watch
      await this.firestore.collection('priceWatches').add({
        userId,
        searchParams,
        currentPrice,
        createdAt: new Date(),
        active: true
      });

      console.log(`✅ Started price monitoring for user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to start price monitoring:', error);
    }
  }

  /**
   * Check for price drops and alert users
   */
  async checkPriceDrops(): Promise<void> {
    try {
      const priceWatches = await this.getActivePriceWatches();

      for (const watch of priceWatches) {
        // Get current prices
        const pricePrediction = await predictiveAnalyticsService.predictPriceTrend(
          watch.searchParams.origin,
          watch.searchParams.destination,
          new Date(watch.searchParams.departureDate),
          watch.currentPrice
        );

        // Alert if price dropped significantly
        if (pricePrediction.predictedPrice < watch.currentPrice * 0.9) {
          await this.sendPriceDropAlert(watch, pricePrediction);
        }
      }
    } catch (error) {
      console.error('❌ Failed to check price drops:', error);
    }
  }

  /**
   * Suggest automatic rebooking for disrupted flights
   */
  async suggestRebooking(
    bookingId: string,
    reason: 'delay' | 'cancellation' | 'missed_connection'
  ): Promise<{
    alternatives: FlightResult[];
    recommendation: string;
    autoRebookAvailable: boolean;
  }> {
    try {
      // Get original booking
      const booking = await this.getMonitoredBooking(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Find alternative flights
      const { elasticsearchService } = await import('./elasticsearch');
      const alternatives = await elasticsearchService.searchFlights({
        origin: booking.flight.origin.code,
        destination: booking.flight.destination.code,
        departureDate: booking.flight.departureTime,
        passengers: 1
      });

      // Generate AI recommendation
      const prompt = `A passenger's flight has been ${reason === 'cancellation' ? 'cancelled' : 'delayed'}.

Original Flight:
- ${booking.flight.airline} ${booking.flight.flightNumber}
- ${booking.flight.origin.city} to ${booking.flight.destination.city}
- Departure: ${booking.flight.departureTime.toLocaleString()}
- Price: $${booking.flight.price}

Alternative Flights Available:
${alternatives.slice(0, 5).map((f, i) => `
${i + 1}. ${f.airline} ${f.flightNumber}
   Departure: ${f.departureTime.toLocaleString()}
   Price: $${f.price}
   Stops: ${f.stops}
`).join('\n')}

Provide:
1. Best rebooking recommendation
2. Reasoning for the recommendation
3. What the passenger should do next

Be empathetic and helpful.`;

      const recommendation = await vertexAIService.generateConversationalResponse(prompt);

      // Check if auto-rebook is available (same airline, similar price)
      const autoRebookAvailable = alternatives.some(
        f => f.airline === booking.flight.airline && 
             Math.abs(f.price - booking.flight.price) < 50
      );

      return {
        alternatives: alternatives.slice(0, 5),
        recommendation,
        autoRebookAvailable
      };
    } catch (error) {
      console.error('❌ Failed to suggest rebooking:', error);
      throw error;
    }
  }

  /**
   * Send pre-flight reminders
   */
  async sendPreFlightReminders(): Promise<void> {
    try {
      const upcomingFlights = await this.getUpcomingFlights(48); // 48 hours

      for (const booking of upcomingFlights) {
        await this.sendPreFlightReminder(booking);
      }
    } catch (error) {
      console.error('❌ Failed to send pre-flight reminders:', error);
    }
  }

  /**
   * Generate personalized travel tips
   */
  async generateTravelTips(
    userId: string,
    booking: MonitoredBooking
  ): Promise<string[]> {
    try {
      const prompt = `Generate personalized travel tips for this upcoming flight:

Flight: ${booking.flight.airline} ${booking.flight.flightNumber}
Route: ${booking.flight.origin.city} to ${booking.flight.destination.city}
Departure: ${booking.flight.departureTime.toLocaleString()}
Duration: ${Math.floor(booking.flight.duration / 60)}h ${booking.flight.duration % 60}m

Provide 5-7 practical, personalized tips covering:
- Airport arrival time
- Security and check-in tips
- In-flight comfort suggestions
- Destination-specific advice
- Weather considerations
- Local transportation

Make tips actionable and specific to this flight.`;

      const response = await vertexAIService.generateConversationalResponse(prompt);
      
      // Parse tips from response
      const tips = response
        .split('\n')
        .filter(line => line.trim().match(/^[\d\-•]/))
        .map(tip => tip.replace(/^[\d\-•]\s*/, '').trim())
        .filter(tip => tip.length > 0);

      return tips.slice(0, 7);
    } catch (error) {
      console.error('❌ Failed to generate travel tips:', error);
      return [
        'Arrive at the airport 2 hours before departure',
        'Check-in online to save time',
        'Review baggage policies before packing',
        'Download airline app for real-time updates',
        'Bring entertainment for the flight'
      ];
    }
  }

  /**
   * Analyze travel disruption and provide guidance
   */
  async analyzeTravelDisruption(
    bookingId: string,
    disruptionType: 'weather' | 'mechanical' | 'strike' | 'other',
    details: string
  ): Promise<{
    impact: 'low' | 'medium' | 'high' | 'severe';
    guidance: string;
    rights: string[];
    nextSteps: string[];
  }> {
    try {
      const booking = await this.getMonitoredBooking(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const prompt = `Analyze this travel disruption and provide passenger guidance:

Disruption Type: ${disruptionType}
Details: ${details}

Flight: ${booking.flight.airline} ${booking.flight.flightNumber}
Route: ${booking.flight.origin.city} to ${booking.flight.destination.city}

Provide:
1. Impact assessment (low/medium/high/severe)
2. Clear guidance for the passenger
3. Passenger rights and compensation eligibility
4. Specific next steps to take

Be clear, empathetic, and actionable.

Format as JSON:
{
  "impact": "low|medium|high|severe",
  "guidance": "detailed guidance",
  "rights": ["right 1", "right 2"],
  "nextSteps": ["step 1", "step 2"]
}`;

      const response = await vertexAIService.generateConversationalResponse(prompt);
      const parsed = this.parseDisruptionAnalysis(response);

      return parsed;
    } catch (error) {
      console.error('❌ Failed to analyze disruption:', error);
      return {
        impact: 'medium',
        guidance: 'Contact the airline for assistance with your disrupted flight.',
        rights: ['You may be entitled to compensation', 'Request meal vouchers if delayed 3+ hours'],
        nextSteps: ['Contact airline customer service', 'Keep all receipts', 'Document the disruption']
      };
    }
  }

  /**
   * Smart check-in assistant
   */
  async assistWithCheckIn(bookingId: string): Promise<{
    checkInAvailable: boolean;
    checkInUrl?: string;
    instructions: string[];
    tips: string[];
    warnings: string[];
  }> {
    try {
      const booking = await this.getMonitoredBooking(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const hoursUntilDeparture = 
        (booking.flight.departureTime.getTime() - Date.now()) / (1000 * 60 * 60);

      const checkInAvailable = hoursUntilDeparture <= 24 && hoursUntilDeparture > 1;

      const instructions = [
        'Have your booking reference ready',
        'Prepare passport or ID for verification',
        'Review baggage allowance before check-in',
        'Select your seat if not already assigned',
        'Download mobile boarding pass'
      ];

      const tips = [
        'Check in exactly 24 hours before departure for best seat selection',
        'Add your frequent flyer number if you haven\'t already',
        'Consider upgrading to priority boarding',
        'Set up flight status notifications'
      ];

      const warnings: string[] = [];
      if (hoursUntilDeparture < 2) {
        warnings.push('⚠️ Check-in closes soon - complete immediately!');
      }
      if (booking.flight.stops > 0) {
        warnings.push('⚠️ Connecting flight - verify baggage transfer');
      }

      return {
        checkInAvailable,
        checkInUrl: `https://${booking.flight.airline.toLowerCase().replace(/\s/g, '')}.com/checkin`,
        instructions,
        tips,
        warnings
      };
    } catch (error) {
      console.error('❌ Failed to assist with check-in:', error);
      throw error;
    }
  }

  /**
   * Send delay alert
   */
  private async sendDelayAlert(
    booking: MonitoredBooking,
    delayPrediction: any
  ): Promise<void> {
    const alert: ProactiveAlert = {
      id: `alert_${Date.now()}`,
      userId: booking.userId,
      bookingId: booking.bookingId,
      type: 'delay',
      severity: delayPrediction.probability > 0.7 ? 'high' : 'medium',
      title: 'Potential Flight Delay',
      message: `Your flight ${booking.flight.flightNumber} has a ${(delayPrediction.probability * 100).toFixed(0)}% chance of delay. ${delayPrediction.recommendation}`,
      actionable: true,
      suggestedActions: [
        'Monitor flight status',
        'Consider earlier flight',
        'Allow extra travel time'
      ],
      timestamp: new Date(),
      read: false
    };

    await this.saveAlert(alert);
    // In production: send push notification, email, SMS
  }

  /**
   * Send price drop alert
   */
  private async sendPriceDropAlert(watch: any, pricePrediction: any): Promise<void> {
    const savings = watch.currentPrice - pricePrediction.predictedPrice;
    
    const alert: ProactiveAlert = {
      id: `alert_${Date.now()}`,
      userId: watch.userId,
      bookingId: '',
      type: 'price_drop',
      severity: 'medium',
      title: 'Price Drop Alert',
      message: `Prices dropped by $${savings.toFixed(0)} for your watched route! Book now to save.`,
      actionable: true,
      suggestedActions: ['Book now', 'View flights', 'Update price watch'],
      timestamp: new Date(),
      read: false
    };

    await this.saveAlert(alert);
  }

  /**
   * Send pre-flight reminder
   */
  private async sendPreFlightReminder(booking: MonitoredBooking): Promise<void> {
    const hoursUntilFlight = 
      (booking.flight.departureTime.getTime() - Date.now()) / (1000 * 60 * 60);

    const tips = await this.generateTravelTips(booking.userId, booking);

    const alert: ProactiveAlert = {
      id: `alert_${Date.now()}`,
      userId: booking.userId,
      bookingId: booking.bookingId,
      type: 'reminder',
      severity: 'low',
      title: `Flight Reminder: ${booking.flight.flightNumber}`,
      message: `Your flight departs in ${Math.round(hoursUntilFlight)} hours. ${tips[0]}`,
      actionable: true,
      suggestedActions: [
        'Check in online',
        'View boarding pass',
        'Get directions to airport',
        'Check flight status'
      ],
      timestamp: new Date(),
      read: false
    };

    await this.saveAlert(alert);
  }

  /**
   * Save alert to database
   */
  private async saveAlert(alert: ProactiveAlert): Promise<void> {
    await this.firestore.collection('alerts').doc(alert.id).set(alert);
    console.log(`✅ Sent ${alert.type} alert to user ${alert.userId}`);
  }

  /**
   * Get active monitored bookings
   */
  private async getActiveMonitoredBookings(): Promise<MonitoredBooking[]> {
    const snapshot = await this.firestore
      .collection('monitoredBookings')
      .where('monitoringEnabled', '==', true)
      .get();

    return snapshot.docs.map(doc => doc.data() as MonitoredBooking);
  }

  /**
   * Get active price watches
   */
  private async getActivePriceWatches(): Promise<any[]> {
    const snapshot = await this.firestore
      .collection('priceWatches')
      .where('active', '==', true)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get monitored booking
   */
  private async getMonitoredBooking(bookingId: string): Promise<MonitoredBooking | null> {
    const doc = await this.firestore
      .collection('monitoredBookings')
      .doc(bookingId)
      .get();

    return doc.exists ? (doc.data() as MonitoredBooking) : null;
  }

  /**
   * Get upcoming flights within hours
   */
  private async getUpcomingFlights(hours: number): Promise<MonitoredBooking[]> {
    const now = new Date();
    const future = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const snapshot = await this.firestore
      .collection('monitoredBookings')
      .where('monitoringEnabled', '==', true)
      .get();

    const bookings = snapshot.docs.map(doc => doc.data() as MonitoredBooking);

    return bookings.filter(b => {
      const departureTime = new Date(b.flight.departureTime);
      return departureTime > now && departureTime <= future;
    });
  }

  /**
   * Parse disruption analysis response
   */
  private parseDisruptionAnalysis(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Failed to parse disruption analysis:', error);
    }

    return {
      impact: 'medium',
      guidance: 'Contact airline for assistance',
      rights: [],
      nextSteps: []
    };
  }
}

// Export singleton instance
export const proactiveAssistanceService = new ProactiveAssistanceService();
