import { firestoreService } from './firestoreService';
import { elasticsearchService } from './elasticsearch';
import { notificationService } from './notificationService';
import { Booking, Flight, FlightResult } from '../types';

export interface FlightChange {
  bookingId: string;
  bookingReference: string;
  originalFlight: Flight;
  newFlight: Flight;
  changeType: 'delay' | 'cancellation' | 'gate_change' | 'aircraft_change';
  changeReason: string;
  notificationSent: boolean;
  rebookingOptions?: FlightResult[];
  createdAt: Date;
}

export interface TravelReminder {
  bookingId: string;
  bookingReference: string;
  reminderType: 'check_in' | 'departure' | 'travel_tips' | 'document_check';
  scheduledFor: Date;
  sent: boolean;
  content: string;
  createdAt: Date;
}

export interface RebookingOption {
  originalBookingId: string;
  newFlightId: string;
  priceDifference: number;
  availableSeats: number;
  changeReason: string;
}

export class TravelUpdateService {
  /**
   * Monitor flights for changes and notify affected passengers
   */
  async monitorFlightChanges(): Promise<void> {
    try {
      console.log('🔍 Monitoring flights for changes...');
      
      // Get all confirmed bookings with future travel dates
      const activeBookings = await this.getActiveBookings();
      
      for (const booking of activeBookings) {
        await this.checkFlightForChanges(booking);
      }
      
      console.log(`✅ Monitored ${activeBookings.length} active bookings for flight changes`);
    } catch (error) {
      console.error('Flight monitoring error:', error);
    }
  }

  /**
   * Check individual flight for changes
   */
  private async checkFlightForChanges(booking: Booking): Promise<void> {
    try {
      const flight = booking.flights[0];
      
      // Get current flight information from the airline/system
      const currentFlightInfo = await elasticsearchService.getFlightById(flight.id);
      
      if (!currentFlightInfo) {
        // Flight not found - might be cancelled
        await this.handleFlightCancellation(booking, 'Flight cancelled by airline');
        return;
      }

      // Check for delays
      if (currentFlightInfo.departureTime.getTime() !== flight.departureTime.getTime()) {
        const delayMinutes = (currentFlightInfo.departureTime.getTime() - flight.departureTime.getTime()) / (1000 * 60);
        
        if (Math.abs(delayMinutes) >= 30) { // Significant delay (30+ minutes)
          await this.handleFlightDelay(booking, currentFlightInfo, delayMinutes);
        }
      }

      // Check for gate changes
      if (currentFlightInfo.gate && flight.gate && currentFlightInfo.gate !== flight.gate) {
        await this.handleGateChange(booking, currentFlightInfo);
      }

      // Check for aircraft changes
      if (currentFlightInfo.aircraft !== flight.aircraft) {
        await this.handleAircraftChange(booking, currentFlightInfo);
      }

    } catch (error) {
      console.error(`Error checking flight changes for booking ${booking.bookingReference}:`, error);
    }
  }

  /**
   * Handle flight delay
   */
  private async handleFlightDelay(booking: Booking, newFlightInfo: Flight, delayMinutes: number): Promise<void> {
    try {
      const flightChange: FlightChange = {
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        originalFlight: booking.flights[0],
        newFlight: newFlightInfo,
        changeType: 'delay',
        changeReason: `Flight delayed by ${Math.abs(delayMinutes)} minutes`,
        notificationSent: false,
        createdAt: new Date()
      };

      // Save flight change record
      await firestoreService.createFlightChange(flightChange);

      // Update booking with new flight information
      await firestoreService.updateBooking(booking.id, {
        flights: [newFlightInfo],
        travelDate: newFlightInfo.departureTime
      });

      // Send notification to passenger
      await notificationService.sendFlightDelayNotification(
        booking,
        newFlightInfo,
        delayMinutes
      );

      // Mark notification as sent
      await firestoreService.updateFlightChangeNotificationStatus(booking.id, true);

      console.log(`✅ Processed flight delay for booking ${booking.bookingReference}: ${delayMinutes} minutes`);

    } catch (error) {
      console.error('Error handling flight delay:', error);
    }
  }

  /**
   * Handle flight cancellation
   */
  private async handleFlightCancellation(booking: Booking, reason: string): Promise<void> {
    try {
      // Find alternative flights
      const rebookingOptions = await this.findRebookingOptions(booking);

      const flightChange: FlightChange = {
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        originalFlight: booking.flights[0],
        newFlight: booking.flights[0], // Same as original since cancelled
        changeType: 'cancellation',
        changeReason: reason,
        notificationSent: false,
        rebookingOptions,
        createdAt: new Date()
      };

      // Save flight change record
      await firestoreService.createFlightChange(flightChange);

      // Send cancellation notification with rebooking options
      await notificationService.sendFlightCancellationNotification(
        booking,
        reason,
        rebookingOptions
      );

      // Mark notification as sent
      await firestoreService.updateFlightChangeNotificationStatus(booking.id, true);

      console.log(`✅ Processed flight cancellation for booking ${booking.bookingReference}`);

    } catch (error) {
      console.error('Error handling flight cancellation:', error);
    }
  }

  /**
   * Handle gate change
   */
  private async handleGateChange(booking: Booking, newFlightInfo: Flight): Promise<void> {
    try {
      const flightChange: FlightChange = {
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        originalFlight: booking.flights[0],
        newFlight: newFlightInfo,
        changeType: 'gate_change',
        changeReason: `Gate changed from ${booking.flights[0].gate} to ${newFlightInfo.gate}`,
        notificationSent: false,
        createdAt: new Date()
      };

      // Save flight change record
      await firestoreService.createFlightChange(flightChange);

      // Update booking with new gate information
      await firestoreService.updateBooking(booking.id, {
        flights: [newFlightInfo]
      });

      // Send gate change notification
      await notificationService.sendGateChangeNotification(booking, newFlightInfo);

      // Mark notification as sent
      await firestoreService.updateFlightChangeNotificationStatus(booking.id, true);

      console.log(`✅ Processed gate change for booking ${booking.bookingReference}`);

    } catch (error) {
      console.error('Error handling gate change:', error);
    }
  }

  /**
   * Handle aircraft change
   */
  private async handleAircraftChange(booking: Booking, newFlightInfo: Flight): Promise<void> {
    try {
      const flightChange: FlightChange = {
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        originalFlight: booking.flights[0],
        newFlight: newFlightInfo,
        changeType: 'aircraft_change',
        changeReason: `Aircraft changed from ${booking.flights[0].aircraft} to ${newFlightInfo.aircraft}`,
        notificationSent: false,
        createdAt: new Date()
      };

      // Save flight change record
      await firestoreService.createFlightChange(flightChange);

      // Update booking with new aircraft information
      await firestoreService.updateBooking(booking.id, {
        flights: [newFlightInfo]
      });

      // Send aircraft change notification
      await notificationService.sendAircraftChangeNotification(booking, newFlightInfo);

      // Mark notification as sent
      await firestoreService.updateFlightChangeNotificationStatus(booking.id, true);

      console.log(`✅ Processed aircraft change for booking ${booking.bookingReference}`);

    } catch (error) {
      console.error('Error handling aircraft change:', error);
    }
  }

  /**
   * Find rebooking options for cancelled flights
   */
  private async findRebookingOptions(booking: Booking): Promise<FlightResult[]> {
    try {
      const originalFlight = booking.flights[0];
      
      // Search for alternative flights on the same route
      const searchResults = await elasticsearchService.searchFlights({
        origin: originalFlight.origin.code,
        destination: originalFlight.destination.code,
        departureDate: originalFlight.departureTime,
        passengers: booking.passengers.length,
        filters: {
          // Look for flights within 24 hours of original departure
          departureTimeRange: {
            start: new Date(originalFlight.departureTime.getTime() - (12 * 60 * 60 * 1000)).toISOString(),
            end: new Date(originalFlight.departureTime.getTime() + (24 * 60 * 60 * 1000)).toISOString()
          }
        }
      });

      // Filter and sort options
      return searchResults
        .filter(flight => flight.availableSeats >= booking.passengers.length)
        .sort((a, b) => {
          // Prioritize flights closest to original departure time
          const aTimeDiff = Math.abs(a.departureTime.getTime() - originalFlight.departureTime.getTime());
          const bTimeDiff = Math.abs(b.departureTime.getTime() - originalFlight.departureTime.getTime());
          return aTimeDiff - bTimeDiff;
        })
        .slice(0, 5); // Return top 5 options

    } catch (error) {
      console.error('Error finding rebooking options:', error);
      return [];
    }
  }

  /**
   * Process rebooking request
   */
  async processRebooking(
    bookingId: string, 
    newFlightId: string, 
    reason: string
  ): Promise<{ success: boolean; newBooking?: Booking; priceDifference?: number }> {
    try {
      const originalBooking = await firestoreService.getBooking(bookingId);
      if (!originalBooking) {
        throw new Error('Original booking not found');
      }

      const newFlight = await elasticsearchService.getFlightById(newFlightId);
      if (!newFlight) {
        throw new Error('New flight not found');
      }

      // Check availability
      if (newFlight.availableSeats < originalBooking.passengers.length) {
        throw new Error('Not enough seats available on new flight');
      }

      // Calculate price difference
      const originalPrice = originalBooking.totalPrice;
      const newPrice = newFlight.price.amount * originalBooking.passengers.length;
      const priceDifference = newPrice - originalPrice;

      // Create new booking
      const newBooking: Booking = {
        ...originalBooking,
        id: '', // Will be set by Firestore
        bookingReference: this.generateRebookingReference(originalBooking.bookingReference),
        flights: [newFlight],
        totalPrice: newPrice,
        travelDate: newFlight.departureTime,
        createdAt: new Date()
      };

      // Save new booking
      const newBookingId = await firestoreService.createBooking(newBooking);
      newBooking.id = newBookingId;

      // Cancel original booking
      await firestoreService.updateBookingStatus(bookingId, 'cancelled', 'refunded');

      // Process payment difference if needed
      if (priceDifference > 0) {
        // Charge additional amount
        const { paymentService } = await import('./paymentService');
        const paymentResult = await paymentService.processPayment(
          originalBooking.contactInfo.paymentInfo || { method: 'card' },
          priceDifference,
          newBooking.bookingReference,
          originalBooking.contactInfo.email
        );

        if (!paymentResult.success) {
          // Rollback the rebooking
          await firestoreService.updateBookingStatus(newBookingId, 'cancelled', 'refunded');
          await firestoreService.updateBookingStatus(bookingId, 'confirmed', 'paid');
          throw new Error('Payment for price difference failed');
        }
      } else if (priceDifference < 0) {
        // Refund difference
        const { paymentService } = await import('./paymentService');
        await paymentService.refundPayment(
          'original-payment-id', // Would need to get from payment records
          Math.abs(priceDifference),
          'Rebooking price difference refund'
        );
      }

      // Send rebooking confirmation
      await notificationService.sendRebookingConfirmation(
        originalBooking,
        newBooking,
        priceDifference
      );

      console.log(`✅ Processed rebooking from ${originalBooking.bookingReference} to ${newBooking.bookingReference}`);

      return {
        success: true,
        newBooking,
        priceDifference
      };

    } catch (error) {
      console.error('Rebooking error:', error);
      return {
        success: false
      };
    }
  }

  /**
   * Schedule travel reminders
   */
  async scheduleTravelReminders(): Promise<void> {
    try {
      console.log('📅 Scheduling travel reminders...');
      
      const upcomingBookings = await this.getUpcomingBookings();
      
      for (const booking of upcomingBookings) {
        await this.scheduleBookingReminders(booking);
      }
      
      console.log(`✅ Scheduled reminders for ${upcomingBookings.length} upcoming bookings`);
    } catch (error) {
      console.error('Error scheduling travel reminders:', error);
    }
  }

  /**
   * Schedule reminders for a specific booking
   */
  private async scheduleBookingReminders(booking: Booking): Promise<void> {
    try {
      const flight = booking.flights[0];
      const departureTime = flight.departureTime;

      // Check-in reminder (24 hours before departure)
      const checkInTime = new Date(departureTime.getTime() - (24 * 60 * 60 * 1000));
      if (checkInTime > new Date()) {
        await this.scheduleReminder(booking, 'check_in', checkInTime, 
          'Check-in is now available for your flight. Complete online check-in to save time at the airport.');
      }

      // Departure reminder (2 hours before departure)
      const departureReminderTime = new Date(departureTime.getTime() - (2 * 60 * 60 * 1000));
      if (departureReminderTime > new Date()) {
        await this.scheduleReminder(booking, 'departure', departureReminderTime,
          'Your flight departs in 2 hours. Please arrive at the airport with sufficient time for security screening.');
      }

      // Travel tips (3 days before departure)
      const travelTipsTime = new Date(departureTime.getTime() - (3 * 24 * 60 * 60 * 1000));
      if (travelTipsTime > new Date()) {
        const tips = this.generateTravelTips(booking);
        await this.scheduleReminder(booking, 'travel_tips', travelTipsTime, tips);
      }

      // Document check (7 days before departure for international flights)
      if (this.isInternationalFlight(flight)) {
        const documentCheckTime = new Date(departureTime.getTime() - (7 * 24 * 60 * 60 * 1000));
        if (documentCheckTime > new Date()) {
          await this.scheduleReminder(booking, 'document_check', documentCheckTime,
            'Please ensure your passport is valid and you have any required visas for your destination.');
        }
      }

    } catch (error) {
      console.error(`Error scheduling reminders for booking ${booking.bookingReference}:`, error);
    }
  }

  /**
   * Schedule individual reminder
   */
  private async scheduleReminder(
    booking: Booking, 
    type: TravelReminder['reminderType'], 
    scheduledFor: Date, 
    content: string
  ): Promise<void> {
    const reminder: TravelReminder = {
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      reminderType: type,
      scheduledFor,
      sent: false,
      content,
      createdAt: new Date()
    };

    await firestoreService.createTravelReminder(reminder);
  }

  /**
   * Process due reminders
   */
  async processDueReminders(): Promise<void> {
    try {
      console.log('⏰ Processing due travel reminders...');
      
      const dueReminders = await firestoreService.getDueReminders();
      
      for (const reminder of dueReminders) {
        await this.sendReminder(reminder);
      }
      
      console.log(`✅ Processed ${dueReminders.length} due reminders`);
    } catch (error) {
      console.error('Error processing due reminders:', error);
    }
  }

  /**
   * Send individual reminder
   */
  private async sendReminder(reminder: TravelReminder): Promise<void> {
    try {
      const booking = await firestoreService.getBooking(reminder.bookingId);
      if (!booking) {
        console.warn(`Booking not found for reminder: ${reminder.bookingReference}`);
        return;
      }

      await notificationService.sendTravelReminder(booking, reminder);

      // Mark reminder as sent
      await firestoreService.updateReminderStatus(reminder.bookingId, reminder.reminderType, true);

      console.log(`✅ Sent ${reminder.reminderType} reminder for booking ${reminder.bookingReference}`);

    } catch (error) {
      console.error(`Error sending reminder for booking ${reminder.bookingReference}:`, error);
    }
  }

  /**
   * Get active bookings (confirmed, future travel dates)
   */
  private async getActiveBookings(): Promise<Booking[]> {
    const allBookings = await firestoreService.getAllBookings();
    const now = new Date();
    
    return allBookings.filter(booking => 
      booking.status === 'confirmed' && 
      booking.travelDate > now
    );
  }

  /**
   * Get upcoming bookings (within next 7 days)
   */
  private async getUpcomingBookings(): Promise<Booking[]> {
    const allBookings = await firestoreService.getAllBookings();
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
    
    return allBookings.filter(booking => 
      booking.status === 'confirmed' && 
      booking.travelDate > now &&
      booking.travelDate <= sevenDaysFromNow
    );
  }

  /**
   * Generate rebooking reference
   */
  private generateRebookingReference(originalReference: string): string {
    return `${originalReference}-R${Date.now().toString(36).toUpperCase().slice(-4)}`;
  }

  /**
   * Check if flight is international
   */
  private isInternationalFlight(flight: Flight): boolean {
    return flight.origin.country !== flight.destination.country;
  }

  /**
   * Generate travel tips based on booking details
   */
  private generateTravelTips(booking: Booking): string {
    const flight = booking.flights[0];
    const tips = [];

    if (this.isInternationalFlight(flight)) {
      tips.push('• Arrive at the airport 3 hours before international departure');
      tips.push('• Check passport validity (must be valid for 6+ months)');
      tips.push('• Verify visa requirements for your destination');
    } else {
      tips.push('• Arrive at the airport 2 hours before domestic departure');
    }

    tips.push('• Check baggage allowance and restrictions');
    tips.push('• Download your airline\'s mobile app for updates');
    tips.push('• Consider travel insurance for your trip');

    return `Travel tips for your upcoming flight:\n${tips.join('\n')}`;
  }

  /**
   * Get flight change history for a booking
   */
  async getFlightChangeHistory(bookingId: string): Promise<FlightChange[]> {
    try {
      return await firestoreService.getFlightChanges(bookingId);
    } catch (error) {
      console.error('Error getting flight change history:', error);
      return [];
    }
  }

  /**
   * Get travel reminders for a booking
   */
  async getTravelReminders(bookingId: string): Promise<TravelReminder[]> {
    try {
      return await firestoreService.getTravelReminders(bookingId);
    } catch (error) {
      console.error('Error getting travel reminders:', error);
      return [];
    }
  }
}

// Export singleton instance
export const travelUpdateService = new TravelUpdateService();