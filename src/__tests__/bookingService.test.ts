import { BookingService } from '../services/bookingService';

// Mock dependencies
jest.mock('../services/firestoreService');
jest.mock('../services/elasticsearch');
jest.mock('../services/sessionManager');

const mockFirestore = {
  createBooking: jest.fn(),
  getBooking: jest.fn(),
  getBookingByReference: jest.fn(),
  getBookingsByUser: jest.fn(),
  updateBookingStatus: jest.fn(),
  updateBooking: jest.fn(),
  getBookingStats: jest.fn()
};

const mockElasticsearch = {
  getFlightById: jest.fn()
};

const mockSessionManager = {
  getSession: jest.fn()
};

describe('BookingService', () => {
  let bookingService: BookingService;

  beforeEach(() => {
    bookingService = new BookingService();
    jest.clearAllMocks();
  });

  describe('validateBookingRequest', () => {
    const mockFlight = {
      id: 'FL1001',
      airline: 'American Airlines',
      flightNumber: 'AA1234',
      departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      availability: {
        economy: 100,
        business: 20,
        first: 5
      },
      price: {
        amount: 350,
        taxes: 50,
        fees: 25
      }
    };

    const validBookingRequest = {
      flightId: 'FL1001',
      passengers: [
        {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: new Date('1990-01-01'),
          nationality: 'US',
          passportNumber: 'A12345678'
        }
      ],
      contactInfo: {
        email: 'john.doe@example.com',
        phone: '+1234567890'
      },
      paymentInfo: {
        method: 'card',
        cardToken: 'tok_visa_1234'
      }
    };

    it('should validate a valid booking request', async () => {
      mockElasticsearch.getFlightById.mockResolvedValue(mockFlight);

      const result = await bookingService.validateBookingRequest(validBookingRequest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject booking for non-existent flight', async () => {
      mockElasticsearch.getFlightById.mockResolvedValue(null);

      const result = await bookingService.validateBookingRequest(validBookingRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Selected flight is no longer available');
    });

    it('should reject booking with insufficient seats', async () => {
      const flightWithNoSeats = {
        ...mockFlight,
        availability: { economy: 0, business: 0, first: 0 }
      };
      mockElasticsearch.getFlightById.mockResolvedValue(flightWithNoSeats);

      const result = await bookingService.validateBookingRequest(validBookingRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Not enough seats available on this flight');
    });

    it('should reject booking for past flights', async () => {
      const pastFlight = {
        ...mockFlight,
        departureTime: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      };
      mockElasticsearch.getFlightById.mockResolvedValue(pastFlight);

      const result = await bookingService.validateBookingRequest(validBookingRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot book flights that have already departed');
    });

    it('should validate passenger information', async () => {
      mockElasticsearch.getFlightById.mockResolvedValue(mockFlight);

      const invalidPassengerRequest = {
        ...validBookingRequest,
        passengers: [
          {
            firstName: 'J', // Too short
            lastName: '', // Empty
            dateOfBirth: new Date('2030-01-01'), // Future date
            nationality: '', // Empty
            passportNumber: '123' // Too short
          }
        ]
      };

      const result = await bookingService.validateBookingRequest(invalidPassengerRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('First name'))).toBe(true);
      expect(result.errors.some(error => error.includes('Last name'))).toBe(true);
      expect(result.errors.some(error => error.includes('date of birth'))).toBe(true);
      expect(result.errors.some(error => error.includes('Nationality'))).toBe(true);
    });

    it('should validate contact information', async () => {
      mockElasticsearch.getFlightById.mockResolvedValue(mockFlight);

      const invalidContactRequest = {
        ...validBookingRequest,
        contactInfo: {
          email: 'invalid-email',
          phone: '123' // Too short
        }
      };

      const result = await bookingService.validateBookingRequest(invalidContactRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('email'))).toBe(true);
      expect(result.errors.some(error => error.includes('phone'))).toBe(true);
    });

    it('should validate payment information', async () => {
      mockElasticsearch.getFlightById.mockResolvedValue(mockFlight);

      const invalidPaymentRequest = {
        ...validBookingRequest,
        paymentInfo: {
          method: 'card'
          // Missing cardToken
        }
      };

      const result = await bookingService.validateBookingRequest(invalidPaymentRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('card information'))).toBe(true);
    });

    it('should provide warnings for flights departing soon', async () => {
      const soonDepartingFlight = {
        ...mockFlight,
        departureTime: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      };
      mockElasticsearch.getFlightById.mockResolvedValue(soonDepartingFlight);

      const result = await bookingService.validateBookingRequest(validBookingRequest);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(warning => warning.includes('2 hours'))).toBe(true);
    });
  });

  describe('createBooking', () => {
    const mockFlight = {
      id: 'FL1001',
      airline: 'American Airlines',
      flightNumber: 'AA1234',
      departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      availability: { economy: 100, business: 20, first: 5 },
      price: { amount: 350, taxes: 50, fees: 25 }
    };

    const validBookingRequest = {
      flightId: 'FL1001',
      passengers: [
        {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: new Date('1990-01-01'),
          nationality: 'US'
        }
      ],
      contactInfo: {
        email: 'john.doe@example.com',
        phone: '+1234567890'
      },
      paymentInfo: {
        method: 'card',
        cardToken: 'tok_visa_1234'
      }
    };

    it('should create a booking successfully', async () => {
      mockElasticsearch.getFlightById.mockResolvedValue(mockFlight);
      mockFirestore.createBooking.mockResolvedValue('booking-123');

      const result = await bookingService.createBooking(validBookingRequest, 'session-123');

      expect(result.status).toBe('confirmed');
      expect(result.bookingReference).toBeDefined();
      expect(result.totalPrice).toBe(425); // 350 + 50 + 25
      expect(result.flights).toHaveLength(1);
      expect(result.passengers).toEqual(validBookingRequest.passengers);
      expect(mockFirestore.createBooking).toHaveBeenCalled();
    });

    it('should fail when flight is not found', async () => {
      mockElasticsearch.getFlightById.mockResolvedValue(null);

      await expect(bookingService.createBooking(validBookingRequest))
        .rejects.toThrow('Flight not found');
    });

    it('should fail validation and not create booking', async () => {
      mockElasticsearch.getFlightById.mockResolvedValue(mockFlight);

      const invalidRequest = {
        ...validBookingRequest,
        passengers: [] // No passengers
      };

      await expect(bookingService.createBooking(invalidRequest))
        .rejects.toThrow('Booking validation failed');
    });
  });

  describe('cancelBooking', () => {
    const mockBooking = {
      id: 'booking-123',
      bookingReference: 'FB123ABC',
      status: 'confirmed',
      flights: [
        {
          departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
        }
      ]
    };

    it('should cancel a booking successfully', async () => {
      mockFirestore.getBooking.mockResolvedValue(mockBooking);
      mockFirestore.updateBookingStatus.mockResolvedValue(undefined);

      const result = await bookingService.cancelBooking('booking-123');

      expect(result).toBe(true);
      expect(mockFirestore.updateBookingStatus).toHaveBeenCalledWith(
        'booking-123',
        'cancelled',
        'refunded'
      );
    });

    it('should fail to cancel non-existent booking', async () => {
      mockFirestore.getBooking.mockResolvedValue(null);

      await expect(bookingService.cancelBooking('booking-123'))
        .rejects.toThrow('Booking not found');
    });

    it('should fail to cancel already cancelled booking', async () => {
      const cancelledBooking = { ...mockBooking, status: 'cancelled' };
      mockFirestore.getBooking.mockResolvedValue(cancelledBooking);

      await expect(bookingService.cancelBooking('booking-123'))
        .rejects.toThrow('Booking is already cancelled');
    });

    it('should fail to cancel booking departing soon', async () => {
      const soonDepartingBooking = {
        ...mockBooking,
        flights: [
          {
            departureTime: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
          }
        ]
      };
      mockFirestore.getBooking.mockResolvedValue(soonDepartingBooking);

      await expect(bookingService.cancelBooking('booking-123'))
        .rejects.toThrow('Cannot cancel booking less than 2 hours before departure');
    });
  });

  describe('getBookingSteps', () => {
    it('should return booking steps for a session', () => {
      const mockSession = {
        selectedFlight: { id: 'FL1001' },
        bookingInProgress: {
          passengers: [{ firstName: 'John', lastName: 'Doe' }],
          contactInfo: { email: 'john@example.com' }
        }
      };

      mockSessionManager.getSession.mockReturnValue(mockSession);

      const steps = bookingService.getBookingSteps('session-123');

      expect(steps).toHaveLength(5);
      expect(steps[0].step).toBe('flight_selection');
      expect(steps[0].completed).toBe(true);
      expect(steps[1].step).toBe('passenger_info');
      expect(steps[1].completed).toBe(true);
      expect(steps[2].step).toBe('contact_info');
      expect(steps[2].completed).toBe(true);
      expect(steps[3].step).toBe('payment');
      expect(steps[3].completed).toBe(false);
      expect(steps[4].step).toBe('confirmation');
      expect(steps[4].completed).toBe(false);
    });

    it('should handle session with no booking progress', () => {
      mockSessionManager.getSession.mockReturnValue({});

      const steps = bookingService.getBookingSteps('session-123');

      expect(steps).toHaveLength(5);
      expect(steps.every(step => !step.completed)).toBe(true);
    });
  });

  describe('updateBookingStep', () => {
    it('should update passenger info step', () => {
      const mockSession = { bookingInProgress: {} };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      const passengerData = [{ firstName: 'John', lastName: 'Doe' }];
      
      bookingService.updateBookingStep('session-123', 'passenger_info', passengerData);

      expect(mockSession.bookingInProgress.passengers).toEqual(passengerData);
    });

    it('should update contact info step', () => {
      const mockSession = { bookingInProgress: {} };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      const contactData = { email: 'john@example.com', phone: '+1234567890' };
      
      bookingService.updateBookingStep('session-123', 'contact_info', contactData);

      expect(mockSession.bookingInProgress.contactInfo).toEqual(contactData);
    });

    it('should update payment step', () => {
      const mockSession = { bookingInProgress: {} };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      const paymentData = { method: 'card', cardToken: 'tok_123' };
      
      bookingService.updateBookingStep('session-123', 'payment', paymentData);

      expect(mockSession.bookingInProgress.paymentInfo).toEqual(paymentData);
    });

    it('should throw error for invalid step', () => {
      const mockSession = { bookingInProgress: {} };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      expect(() => {
        bookingService.updateBookingStep('session-123', 'invalid_step', {});
      }).toThrow('Unknown booking step: invalid_step');
    });

    it('should throw error for non-existent session', () => {
      mockSessionManager.getSession.mockReturnValue(null);

      expect(() => {
        bookingService.updateBookingStep('session-123', 'passenger_info', {});
      }).toThrow('Session not found');
    });
  });

  describe('utility methods', () => {
    it('should generate unique booking references', () => {
      const ref1 = (bookingService as any).generateBookingReference();
      const ref2 = (bookingService as any).generateBookingReference();

      expect(ref1).toMatch(/^FB[A-Z0-9]+$/);
      expect(ref2).toMatch(/^FB[A-Z0-9]+$/);
      expect(ref1).not.toBe(ref2);
    });

    it('should calculate total price correctly', () => {
      const mockFlight = {
        price: { amount: 300, taxes: 45, fees: 20 }
      };

      const totalPrice = (bookingService as any).calculateTotalPrice(mockFlight, 2);

      expect(totalPrice).toBe(730); // (300 + 45 + 20) * 2
    });

    it('should calculate age correctly', () => {
      const birthDate = new Date('1990-06-15');
      const age = (bookingService as any).calculateAge(birthDate);

      expect(age).toBeGreaterThan(30);
      expect(age).toBeLessThan(40);
    });

    it('should validate email format', () => {
      const service = bookingService as any;

      expect(service.isValidEmail('test@example.com')).toBe(true);
      expect(service.isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(service.isValidEmail('invalid-email')).toBe(false);
      expect(service.isValidEmail('test@')).toBe(false);
      expect(service.isValidEmail('@example.com')).toBe(false);
    });
  });
});