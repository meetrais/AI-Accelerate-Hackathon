import { firestoreService } from './firestoreService';
import { elasticsearchService } from './elasticsearch';
import { sessionManager } from './sessionManager';
import { 
  BookingRequest, 
  BookingConfirmation, 
  Booking, 
  PassengerInfo, 
  ContactInfo, 
  Flight,
  FlightResult
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface BookingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BookingStep {
  step: 'flight_selection' | 'passenger_info' | 'contact_info' | 'payment' | 'confirmation';
  completed: boolean;
  data?: any;
  errors?: string[];
}

export class BookingService {
  /**
   * Validate booking request
   */
  async validateBookingRequest(request: BookingRequest): Promise<BookingValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate flight exists and is available
      const flight = await elasticsearchService.getFlightById(request.flightId);
      if (!flight) {
        errors.push('Selected flight is no longer available');
      } else {
        // Check seat availability
        const totalAvailableSeats = flight.availability.economy + 
                                   flight.availability.business + 
                                   flight.availability.first;
        
        if (totalAvailableSeats < request.passengers.length) {
          errors.push('Not enough seats available on this flight');
        }

        // Check if flight is in the future
        if (flight.departureTime <= new Date()) {
          errors.push('Cannot book flights that have already departed');
        }

        // Warning for flights departing soon
        const hoursUntilDeparture = (flight.departureTime.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilDeparture < 2) {
          warnings.push('Flight departs in less than 2 hours - check-in may be required');
        }
      }

      // Validate passengers
      if (!request.passengers || request.passengers.length === 0) {
        errors.push('At least one passenger is required');
      } else {
        request.passengers.forEach((passenger, index) => {
          const passengerErrors = this.validatePassenger(passenger, index + 1);
          errors.push(...passengerErrors);
        });
      }

      // Validate contact information
      const contactErrors = this.validateContactInfo(request.contactInfo);
      errors.push(...contactErrors);

      // Validate payment information
      const paymentErrors = this.validatePaymentInfo(request.paymentInfo);
      errors.push(...paymentErrors);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      console.error('Booking validation error:', error);
      return {
        isValid: false,
        errors: ['Unable to validate booking request'],
        warnings: []
      };
    }
  }

  /**
   * Validate individual passenger information
   */
  private validatePassenger(passenger: PassengerInfo, passengerNumber: number): string[] {
    const errors: string[] = [];

    if (!passenger.firstName || passenger.firstName.trim().length < 2) {
      errors.push(`Passenger ${passengerNumber}: First name is required (minimum 2 characters)`);
    }

    if (!passenger.lastName || passenger.lastName.trim().length < 2) {
      errors.push(`Passenger ${passengerNumber}: Last name is required (minimum 2 characters)`);
    }

    if (!passenger.dateOfBirth) {
      errors.push(`Passenger ${passengerNumber}: Date of birth is required`);
    } else {
      const age = this.calculateAge(passenger.dateOfBirth);
      if (age < 0 || age > 120) {
        errors.push(`Passenger ${passengerNumber}: Invalid date of birth`);
      }
    }

    if (!passenger.nationality || passenger.nationality.trim().length < 2) {
      errors.push(`Passenger ${passengerNumber}: Nationality is required`);
    }

    // Validate passport for international flights (simplified check)
    if (passenger.passportNumber && passenger.passportNumber.length < 6) {
      errors.push(`Passenger ${passengerNumber}: Invalid passport number format`);
    }

    return errors;
  }

  /**
   * Validate contact information
   */
  private validateContactInfo(contactInfo: ContactInfo): string[] {
    const errors: string[] = [];

    if (!contactInfo.email || !this.isValidEmail(contactInfo.email)) {
      errors.push('Valid email address is required');
    }

    if (!contactInfo.phone || contactInfo.phone.trim().length < 10) {
      errors.push('Valid phone number is required');
    }

    return errors;
  }

  /**
   * Validate payment information
   */
  private validatePaymentInfo(paymentInfo: any): string[] {
    const errors: string[] = [];

    if (!paymentInfo.method) {
      errors.push('Payment method is required');
    }

    if (paymentInfo.method === 'card' && !paymentInfo.cardToken) {
      errors.push('Payment card information is required');
    }

    if (paymentInfo.method === 'paypal' && !paymentInfo.paypalId) {
      errors.push('PayPal account information is required');
    }

    return errors;
  }

  /**
   * Create a new booking with payment processing
   */
  async createBooking(request: BookingRequest, sessionId?: string): Promise<BookingConfirmation> {
    try {
      // Validate the booking request
      const validation = await this.validateBookingRequest(request);
      if (!validation.isValid) {
        throw new Error(`Booking validation failed: ${validation.errors.join(', ')}`);
      }

      // Get flight details
      const flight = await elasticsearchService.getFlightById(request.flightId);
      if (!flight) {
        throw new Error('Flight not found');
      }

      // Generate booking reference
      const bookingReference = this.generateBookingReference();

      // Calculate total price (including taxes and fees)
      const totalPrice = this.calculateTotalPrice(flight, request.passengers.length);

      // Process payment
      const { paymentService } = await import('./paymentService');
      const paymentResult = await paymentService.processPayment(
        request.paymentInfo,
        totalPrice,
        bookingReference,
        request.contactInfo.email
      );

      if (!paymentResult.success) {
        throw new Error(`Payment failed: ${paymentResult.errorMessage}`);
      }

      // Create booking object
      const booking: Booking = {
        id: '', // Will be set by Firestore
        bookingReference,
        userId: sessionId || 'anonymous',
        status: 'confirmed',
        flights: [flight],
        passengers: request.passengers,
        contactInfo: request.contactInfo,
        totalPrice,
        paymentStatus: paymentResult.status === 'succeeded' ? 'paid' : 'pending',
        createdAt: new Date(),
        travelDate: flight.departureTime
      };

      // Save booking to Firestore
      const bookingId = await firestoreService.createBooking(booking);
      booking.id = bookingId;

      // Update session if provided
      if (sessionId) {
        const session = sessionManager.getSession(sessionId);
        if (session) {
          session.bookingInProgress = {
            ...session.bookingInProgress,
            bookingId,
            bookingReference,
            paymentId: paymentResult.paymentId
          } as any;
        }
      }

      // Send booking confirmation notification
      try {
        const { notificationService } = await import('./notificationService');
        await notificationService.sendBookingConfirmation(booking);
        
        if (paymentResult.status === 'succeeded') {
          await notificationService.sendPaymentConfirmation(
            booking,
            paymentResult.paymentId,
            paymentResult.receiptUrl
          );
        }
      } catch (notificationError) {
        console.warn('Failed to send booking notifications:', notificationError);
        // Don't fail the booking if notifications fail
      }

      // Create booking confirmation
      const confirmation: BookingConfirmation = {
        bookingReference,
        status: 'confirmed',
        totalPrice,
        flights: [flight],
        passengers: request.passengers
      };

      console.log(`✅ Created booking ${bookingReference} for flight ${flight.flightNumber} with payment ${paymentResult.paymentId}`);

      return confirmation;

    } catch (error) {
      console.error('Booking creation error:', error);
      throw new Error(`Failed to create booking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get booking by reference number
   */
  async getBookingByReference(bookingReference: string): Promise<Booking | null> {
    try {
      return await firestoreService.getBookingByReference(bookingReference);
    } catch (error) {
      console.error('Error retrieving booking:', error);
      return null;
    }
  }

  /**
   * Get bookings for a user
   */
  async getUserBookings(userId: string): Promise<Booking[]> {
    try {
      return await firestoreService.getBookingsByUser(userId);
    } catch (error) {
      console.error('Error retrieving user bookings:', error);
      return [];
    }
  }

  /**
   * Cancel booking with refund processing
   */
  async cancelBooking(bookingId: string, reason?: string): Promise<boolean> {
    try {
      const booking = await firestoreService.getBooking(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status === 'cancelled') {
        throw new Error('Booking is already cancelled');
      }

      // Check if cancellation is allowed (e.g., not too close to departure)
      const flight = booking.flights[0];
      const hoursUntilDeparture = (flight.departureTime.getTime() - Date.now()) / (1000 * 60 * 60);
      
      if (hoursUntilDeparture < 2) {
        throw new Error('Cannot cancel booking less than 2 hours before departure');
      }

      // Process refund if payment was successful
      if (booking.paymentStatus === 'paid') {
        try {
          const { paymentService } = await import('./paymentService');
          
          // Get payment records to find the payment ID
          const paymentRecords = await firestoreService.getPaymentRecords(booking.bookingReference);

          if (paymentRecords.length > 0) {
            const paymentRecord = paymentRecords[0];
            const refundResult = await paymentService.refundPayment(
              paymentRecord.paymentId,
              booking.totalPrice,
              reason || 'Customer requested cancellation'
            );

            if (refundResult.success) {
              console.log(`✅ Processed refund ${refundResult.refundId} for booking ${booking.bookingReference}`);
            } else {
              console.warn(`⚠️ Refund failed for booking ${booking.bookingReference}: ${refundResult.errorMessage}`);
            }
          }
        } catch (refundError) {
          console.error('Refund processing error:', refundError);
          // Continue with cancellation even if refund fails
        }
      }

      // Update booking status
      await firestoreService.updateBookingStatus(bookingId, 'cancelled', 'refunded');

      // Send cancellation notification
      try {
        const { notificationService } = await import('./notificationService');
        await notificationService.sendBookingCancellation(booking, booking.totalPrice);
      } catch (notificationError) {
        console.warn('Failed to send cancellation notification:', notificationError);
        // Don't fail the cancellation if notification fails
      }

      console.log(`✅ Cancelled booking ${booking.bookingReference}`);
      return true;

    } catch (error) {
      console.error('Booking cancellation error:', error);
      throw error;
    }
  }

  /**
   * Modify booking (simplified - in reality this would be more complex)
   */
  async modifyBooking(
    bookingId: string, 
    modifications: {
      newFlightId?: string;
      passengerUpdates?: Partial<PassengerInfo>[];
      contactUpdates?: Partial<ContactInfo>;
    }
  ): Promise<Booking> {
    try {
      const booking = await firestoreService.getBooking(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'confirmed') {
        throw new Error('Can only modify confirmed bookings');
      }

      const updates: Partial<Booking> = {};

      // Handle flight changes
      if (modifications.newFlightId) {
        const newFlight = await elasticsearchService.getFlightById(modifications.newFlightId);
        if (!newFlight) {
          throw new Error('New flight not found');
        }
        
        updates.flights = [newFlight];
        updates.travelDate = newFlight.departureTime;
        updates.totalPrice = this.calculateTotalPrice(newFlight, booking.passengers.length);
      }

      // Handle passenger updates
      if (modifications.passengerUpdates) {
        const updatedPassengers = booking.passengers.map((passenger, index) => ({
          ...passenger,
          ...modifications.passengerUpdates![index]
        }));
        updates.passengers = updatedPassengers;
      }

      // Handle contact updates
      if (modifications.contactUpdates) {
        updates.contactInfo = {
          ...booking.contactInfo,
          ...modifications.contactUpdates
        };
      }

      // Apply updates
      await firestoreService.updateBooking(bookingId, updates);

      // Return updated booking
      const updatedBooking = await firestoreService.getBooking(bookingId);
      if (!updatedBooking) {
        throw new Error('Failed to retrieve updated booking');
      }

      console.log(`✅ Modified booking ${booking.bookingReference}`);
      return updatedBooking;

    } catch (error) {
      console.error('Booking modification error:', error);
      throw error;
    }
  }

  /**
   * Get booking steps for a session
   */
  getBookingSteps(sessionId: string): BookingStep[] {
    const session = sessionManager.getSession(sessionId);
    const bookingInProgress = session?.bookingInProgress;

    const steps: BookingStep[] = [
      {
        step: 'flight_selection',
        completed: !!session?.selectedFlight,
        data: session?.selectedFlight
      },
      {
        step: 'passenger_info',
        completed: !!bookingInProgress?.passengers,
        data: bookingInProgress?.passengers
      },
      {
        step: 'contact_info',
        completed: !!bookingInProgress?.contactInfo,
        data: bookingInProgress?.contactInfo
      },
      {
        step: 'payment',
        completed: !!bookingInProgress?.paymentInfo,
        data: bookingInProgress?.paymentInfo ? { method: bookingInProgress.paymentInfo.method } : undefined
      },
      {
        step: 'confirmation',
        completed: !!bookingInProgress?.bookingReference,
        data: bookingInProgress?.bookingReference ? { 
          bookingReference: bookingInProgress.bookingReference 
        } : undefined
      }
    ];

    return steps;
  }

  /**
   * Update booking step data
   */
  updateBookingStep(sessionId: string, step: string, data: any): void {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (!session.bookingInProgress) {
      session.bookingInProgress = {};
    }

    switch (step) {
      case 'passenger_info':
        session.bookingInProgress.passengers = data;
        break;
      case 'contact_info':
        session.bookingInProgress.contactInfo = data;
        break;
      case 'payment':
        session.bookingInProgress.paymentInfo = data;
        break;
      default:
        throw new Error(`Unknown booking step: ${step}`);
    }
  }

  /**
   * Generate booking reference
   */
  private generateBookingReference(): string {
    const prefix = 'FB'; // Flight Booking
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Calculate total price including taxes and fees
   */
  private calculateTotalPrice(flight: Flight, passengerCount: number): number {
    const basePrice = flight.price.amount * passengerCount;
    const taxes = flight.price.taxes * passengerCount;
    const fees = flight.price.fees * passengerCount;
    
    return Math.round(basePrice + taxes + fees);
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get booking statistics
   */
  async getBookingStatistics(): Promise<any> {
    try {
      return await firestoreService.getBookingStats();
    } catch (error) {
      console.error('Error getting booking statistics:', error);
      return {
        totalBookings: 0,
        confirmedBookings: 0,
        cancelledBookings: 0,
        totalRevenue: 0,
        averageBookingValue: 0
      };
    }
  }
}

// Export singleton instance
export const bookingService = new BookingService();