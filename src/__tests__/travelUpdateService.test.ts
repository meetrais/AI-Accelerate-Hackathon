import { travelUpdateService } from '../services/travelUpdateService';
import { firestoreService } from '../services/firestoreService';
import { elasticsearchService } from '../services/elasticsearch';
import { notificationService } from '../services/notificationService';
import { Booking, Flight } from '../types';

// Mock dependencies
jest.mock('../services/firestoreService');
jest.mock('../services/elasticsearch');
jest.mock('../services/notificationService');

const mockFirestoreService = firestoreService as jest.Mocked<typeof firestoreService>;
const mockElasticsearchService = elasticsearchService as jest.Mocked<typeof elasticsearchService>;
const mockNotificationService = notificationService as jest.Mocked<typeof notificationService>;

describe('TravelUpdateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('monitorFlightChanges', () => {
    it('should monitor active bookings for flight changes', async () => {
      const mockBookings: Booking[] = [
        {
          id: 'booking1',
          bookingReference: 'FB123456',
          userId: 'user1',
          status: 'confirmed',
          flights: [{
            id: 'flight1',
            airline: 'Test Airlines',
            flightNumber: 'TA123',
            origin: { code: 'NYC', name: 'New York', city: 'New York', country: 'US', timezone: 'EST' },
            destination: { code: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'US', timezone: 'PST' },
            departureTime: new Date('2024-12-01T10:00:00Z'),
            arrivalTime: new Date('2024-12-01T13:00:00Z'),
            duration: 360,
            stops: 0,
            price: { amount: 299, currency: 'USD', taxes: 50, fees: 25 },
            availability: { economy: 100, business: 20, first: 5 },
            aircraft: 'Boeing 737',
            gate: 'A1'
          }],
          passengers: [{
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: new Date('1990-01-01'),
            nationality: 'US'
          }],
          contactInfo: {
            email: 'john@example.com',
            phone: '+1234567890'
          },
          totalPrice: 374,
          paymentStatus: 'paid',
          createdAt: new Date(),
          travelDate: new Date('2024-12-01T10:00:00Z')
        }
      ];

      mockFirestoreService.getAllBookings.mockResolvedValue(mockBookings);
      mockElasticsearchService.getFlightById.mockResolvedValue(mockBookings[0].flights[0]);

      await travelUpdateService.monitorFlightChanges();

      expect(mockFirestoreService.getAllBookings).toHaveBeenCalled();
      expect(mockElasticsearchService.getFlightById).toHaveBeenCalledWith('flight1');
    });

    it('should handle flight delays', async () => {
      const originalFlight = {
        id: 'flight1',
        airline: 'Test Airlines',
        flightNumber: 'TA123',
        origin: { code: 'NYC', name: 'New York', city: 'New York', country: 'US', timezone: 'EST' },
        destination: { code: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'US', timezone: 'PST' },
        departureTime: new Date('2024-12-01T10:00:00Z'),
        arrivalTime: new Date('2024-12-01T13:00:00Z'),
        duration: 360,
        stops: 0,
        price: { amount: 299, currency: 'USD', taxes: 50, fees: 25 },
        availability: { economy: 100, business: 20, first: 5 },
        aircraft: 'Boeing 737',
        gate: 'A1'
      };

      const delayedFlight = {
        ...originalFlight,
        departureTime: new Date('2024-12-01T11:00:00Z'), // 1 hour delay
        arrivalTime: new Date('2024-12-01T14:00:00Z')
      };

      const mockBooking: Booking = {
        id: 'booking1',
        bookingReference: 'FB123456',
        userId: 'user1',
        status: 'confirmed',
        flights: [originalFlight],
        passengers: [{
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: new Date('1990-01-01'),
          nationality: 'US'
        }],
        contactInfo: {
          email: 'john@example.com',
          phone: '+1234567890'
        },
        totalPrice: 374,
        paymentStatus: 'paid',
        createdAt: new Date(),
        travelDate: new Date('2024-12-01T10:00:00Z')
      };

      mockFirestoreService.getAllBookings.mockResolvedValue([mockBooking]);
      mockElasticsearchService.getFlightById.mockResolvedValue(delayedFlight);
      mockFirestoreService.createFlightChange.mockResolvedValue('change1');
      mockFirestoreService.updateBooking.mockResolvedValue();
      mockFirestoreService.updateFlightChangeNotificationStatus.mockResolvedValue();
      mockNotificationService.sendFlightDelayNotification.mockResolvedValue();

      await travelUpdateService.monitorFlightChanges();

      expect(mockFirestoreService.createFlightChange).toHaveBeenCalled();
      expect(mockNotificationService.sendFlightDelayNotification).toHaveBeenCalledWith(
        mockBooking,
        delayedFlight,
        60 // 60 minutes delay
      );
    });

    it('should handle flight cancellations', async () => {
      const mockBooking: Booking = {
        id: 'booking1',
        bookingReference: 'FB123456',
        userId: 'user1',
        status: 'confirmed',
        flights: [{
          id: 'flight1',
          airline: 'Test Airlines',
          flightNumber: 'TA123',
          origin: { code: 'NYC', name: 'New York', city: 'New York', country: 'US', timezone: 'EST' },
          destination: { code: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'US', timezone: 'PST' },
          departureTime: new Date('2024-12-01T10:00:00Z'),
          arrivalTime: new Date('2024-12-01T13:00:00Z'),
          duration: 360,
          stops: 0,
          price: { amount: 299, currency: 'USD', taxes: 50, fees: 25 },
          availability: { economy: 100, business: 20, first: 5 },
          aircraft: 'Boeing 737',
          gate: 'A1'
        }],
        passengers: [{
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: new Date('1990-01-01'),
          nationality: 'US'
        }],
        contactInfo: {
          email: 'john@example.com',
          phone: '+1234567890'
        },
        totalPrice: 374,
        paymentStatus: 'paid',
        createdAt: new Date(),
        travelDate: new Date('2024-12-01T10:00:00Z')
      };

      mockFirestoreService.getAllBookings.mockResolvedValue([mockBooking]);
      mockElasticsearchService.getFlightById.mockResolvedValue(null); // Flight not found = cancelled
      mockElasticsearchService.searchFlights.mockResolvedValue({ flights: [], metadata: {} });
      mockFirestoreService.createFlightChange.mockResolvedValue('change1');
      mockFirestoreService.updateFlightChangeNotificationStatus.mockResolvedValue();
      mockNotificationService.sendFlightCancellationNotification.mockResolvedValue();

      await travelUpdateService.monitorFlightChanges();

      expect(mockNotificationService.sendFlightCancellationNotification).toHaveBeenCalledWith(
        mockBooking,
        'Flight cancelled by airline',
        []
      );
    });
  });

  describe('scheduleTravelReminders', () => {
    it('should schedule reminders for upcoming bookings', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5); // 5 days from now

      const mockBooking: Booking = {
        id: 'booking1',
        bookingReference: 'FB123456',
        userId: 'user1',
        status: 'confirmed',
        flights: [{
          id: 'flight1',
          airline: 'Test Airlines',
          flightNumber: 'TA123',
          origin: { code: 'NYC', name: 'New York', city: 'New York', country: 'US', timezone: 'EST' },
          destination: { code: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'US', timezone: 'PST' },
          departureTime: futureDate,
          arrivalTime: new Date(futureDate.getTime() + 3 * 60 * 60 * 1000),
          duration: 360,
          stops: 0,
          price: { amount: 299, currency: 'USD', taxes: 50, fees: 25 },
          availability: { economy: 100, business: 20, first: 5 },
          aircraft: 'Boeing 737',
          gate: 'A1'
        }],
        passengers: [{
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: new Date('1990-01-01'),
          nationality: 'US'
        }],
        contactInfo: {
          email: 'john@example.com',
          phone: '+1234567890'
        },
        totalPrice: 374,
        paymentStatus: 'paid',
        createdAt: new Date(),
        travelDate: futureDate
      };

      mockFirestoreService.getAllBookings.mockResolvedValue([mockBooking]);
      mockFirestoreService.createTravelReminder.mockResolvedValue('reminder1');

      await travelUpdateService.scheduleTravelReminders();

      expect(mockFirestoreService.createTravelReminder).toHaveBeenCalled();
    });
  });

  describe('processRebooking', () => {
    it('should successfully process a rebooking request', async () => {
      const originalBooking: Booking = {
        id: 'booking1',
        bookingReference: 'FB123456',
        userId: 'user1',
        status: 'confirmed',
        flights: [{
          id: 'flight1',
          airline: 'Test Airlines',
          flightNumber: 'TA123',
          origin: { code: 'NYC', name: 'New York', city: 'New York', country: 'US', timezone: 'EST' },
          destination: { code: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'US', timezone: 'PST' },
          departureTime: new Date('2024-12-01T10:00:00Z'),
          arrivalTime: new Date('2024-12-01T13:00:00Z'),
          duration: 360,
          stops: 0,
          price: { amount: 299, currency: 'USD', taxes: 50, fees: 25 },
          availability: { economy: 100, business: 20, first: 5 },
          aircraft: 'Boeing 737',
          gate: 'A1'
        }],
        passengers: [{
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: new Date('1990-01-01'),
          nationality: 'US'
        }],
        contactInfo: {
          email: 'john@example.com',
          phone: '+1234567890'
        },
        totalPrice: 374,
        paymentStatus: 'paid',
        createdAt: new Date(),
        travelDate: new Date('2024-12-01T10:00:00Z')
      };

      const newFlight = {
        ...originalBooking.flights[0],
        id: 'flight2',
        flightNumber: 'TA456',
        departureTime: new Date('2024-12-01T14:00:00Z'),
        arrivalTime: new Date('2024-12-01T17:00:00Z'),
        price: { amount: 350, currency: 'USD', taxes: 50, fees: 25 }
      };

      mockFirestoreService.getBooking.mockResolvedValue(originalBooking);
      mockElasticsearchService.getFlightById.mockResolvedValue(newFlight);
      mockFirestoreService.createBooking.mockResolvedValue('booking2');
      mockFirestoreService.updateBookingStatus.mockResolvedValue();
      mockNotificationService.sendRebookingConfirmation.mockResolvedValue();

      const result = await travelUpdateService.processRebooking('booking1', 'flight2', 'Customer requested');

      expect(result.success).toBe(true);
      expect(result.priceDifference).toBe(51); // 350 - 299
      expect(mockNotificationService.sendRebookingConfirmation).toHaveBeenCalled();
    });

    it('should fail rebooking if new flight has insufficient seats', async () => {
      const originalBooking: Booking = {
        id: 'booking1',
        bookingReference: 'FB123456',
        userId: 'user1',
        status: 'confirmed',
        flights: [{
          id: 'flight1',
          airline: 'Test Airlines',
          flightNumber: 'TA123',
          origin: { code: 'NYC', name: 'New York', city: 'New York', country: 'US', timezone: 'EST' },
          destination: { code: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'US', timezone: 'PST' },
          departureTime: new Date('2024-12-01T10:00:00Z'),
          arrivalTime: new Date('2024-12-01T13:00:00Z'),
          duration: 360,
          stops: 0,
          price: { amount: 299, currency: 'USD', taxes: 50, fees: 25 },
          availability: { economy: 100, business: 20, first: 5 },
          aircraft: 'Boeing 737',
          gate: 'A1',
          availableSeats: 50
        }],
        passengers: [
          {
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: new Date('1990-01-01'),
            nationality: 'US'
          },
          {
            firstName: 'Jane',
            lastName: 'Doe',
            dateOfBirth: new Date('1992-01-01'),
            nationality: 'US'
          }
        ],
        contactInfo: {
          email: 'john@example.com',
          phone: '+1234567890'
        },
        totalPrice: 748,
        paymentStatus: 'paid',
        createdAt: new Date(),
        travelDate: new Date('2024-12-01T10:00:00Z')
      };

      const newFlight = {
        ...originalBooking.flights[0],
        id: 'flight2',
        availableSeats: 1 // Not enough for 2 passengers
      };

      mockFirestoreService.getBooking.mockResolvedValue(originalBooking);
      mockElasticsearchService.getFlightById.mockResolvedValue(newFlight);

      const result = await travelUpdateService.processRebooking('booking1', 'flight2', 'Customer requested');

      expect(result.success).toBe(false);
    });
  });

  describe('processDueReminders', () => {
    it('should process and send due reminders', async () => {
      const mockReminders = [
        {
          id: 'reminder1',
          bookingId: 'booking1',
          bookingReference: 'FB123456',
          reminderType: 'check_in',
          scheduledFor: new Date(Date.now() - 1000), // 1 second ago
          sent: false,
          content: 'Check-in is now available',
          createdAt: new Date()
        }
      ];

      const mockBooking: Booking = {
        id: 'booking1',
        bookingReference: 'FB123456',
        userId: 'user1',
        status: 'confirmed',
        flights: [{
          id: 'flight1',
          airline: 'Test Airlines',
          flightNumber: 'TA123',
          origin: { code: 'NYC', name: 'New York', city: 'New York', country: 'US', timezone: 'EST' },
          destination: { code: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'US', timezone: 'PST' },
          departureTime: new Date('2024-12-01T10:00:00Z'),
          arrivalTime: new Date('2024-12-01T13:00:00Z'),
          duration: 360,
          stops: 0,
          price: { amount: 299, currency: 'USD', taxes: 50, fees: 25 },
          availability: { economy: 100, business: 20, first: 5 },
          aircraft: 'Boeing 737',
          gate: 'A1'
        }],
        passengers: [{
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: new Date('1990-01-01'),
          nationality: 'US'
        }],
        contactInfo: {
          email: 'john@example.com',
          phone: '+1234567890'
        },
        totalPrice: 374,
        paymentStatus: 'paid',
        createdAt: new Date(),
        travelDate: new Date('2024-12-01T10:00:00Z')
      };

      mockFirestoreService.getDueReminders.mockResolvedValue(mockReminders);
      mockFirestoreService.getBooking.mockResolvedValue(mockBooking);
      mockFirestoreService.updateReminderStatus.mockResolvedValue();
      mockNotificationService.sendTravelReminder.mockResolvedValue();

      await travelUpdateService.processDueReminders();

      expect(mockNotificationService.sendTravelReminder).toHaveBeenCalledWith(
        mockBooking,
        mockReminders[0]
      );
      expect(mockFirestoreService.updateReminderStatus).toHaveBeenCalledWith(
        'booking1',
        'check_in',
        true
      );
    });
  });
});