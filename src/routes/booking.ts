import express from 'express';
import Joi from 'joi';
import { bookingService } from '../services/bookingService';
import { sessionManager } from '../services/sessionManager';
import { ApiResponse, BookingRequest, PassengerInfo, ContactInfo } from '../types';

const router = express.Router();

// Validation schemas
const passengerSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  dateOfBirth: Joi.date().max('now').required(),
  passportNumber: Joi.string().min(6).max(20).optional(),
  nationality: Joi.string().min(2).max(50).required(),
  seatPreference: Joi.string().valid('aisle', 'window', 'middle', 'any').optional()
});

const contactInfoSchema = Joi.object({
  email: Joi.string().email().required(),
  phone: Joi.string().min(10).max(20).required(),
  address: Joi.object({
    street: Joi.string().max(100).optional(),
    city: Joi.string().max(50).optional(),
    country: Joi.string().max(50).optional(),
    postalCode: Joi.string().max(20).optional()
  }).optional()
});

const paymentInfoSchema = Joi.object({
  method: Joi.string().valid('card', 'paypal').required(),
  cardToken: Joi.string().when('method', { is: 'card', then: Joi.required() }),
  paypalId: Joi.string().when('method', { is: 'paypal', then: Joi.required() })
});

const bookingRequestSchema = Joi.object({
  flightId: Joi.string().required(),
  passengers: Joi.array().items(passengerSchema).min(1).max(9).required(),
  contactInfo: contactInfoSchema.required(),
  paymentInfo: paymentInfoSchema.required(),
  sessionId: Joi.string().optional()
});

/**
 * POST /api/booking/create
 * Create a new flight booking
 */
router.post('/create', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = bookingRequestSchema.validate(req.body);
    if (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      };
      return res.status(400).json(response);
    }

    const bookingRequest: BookingRequest = value;

    // Create the booking
    const confirmation = await bookingService.createBooking(
      bookingRequest,
      value.sessionId
    );

    const response: ApiResponse = {
      success: true,
      data: confirmation,
      message: 'Booking created successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Booking creation error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Booking failed',
      message: error instanceof Error ? error.message : 'Unable to create booking'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/booking/validate
 * Validate booking request without creating the booking
 */
router.post('/validate', async (req, res) => {
  try {
    // Validate request body structure first
    const { error, value } = bookingRequestSchema.validate(req.body);
    if (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      };
      return res.status(400).json(response);
    }

    // Perform detailed booking validation
    const validation = await bookingService.validateBookingRequest(value);

    const response: ApiResponse = {
      success: validation.isValid,
      data: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      },
      message: validation.isValid ? 'Booking request is valid' : 'Booking validation failed'
    };

    res.json(response);
  } catch (error) {
    console.error('Booking validation error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Validation failed',
      message: 'Unable to validate booking request'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/booking/:bookingReference
 * Get booking details by reference number
 */
router.get('/:bookingReference', async (req, res) => {
  try {
    const { bookingReference } = req.params;

    if (!bookingReference || bookingReference.length < 6) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid booking reference',
        message: 'Booking reference is required and must be at least 6 characters'
      };
      return res.status(400).json(response);
    }

    const booking = await bookingService.getBookingByReference(bookingReference);

    if (!booking) {
      const response: ApiResponse = {
        success: false,
        error: 'Booking not found',
        message: 'No booking found with the provided reference number'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: booking,
      message: 'Booking retrieved successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Booking retrieval error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Retrieval failed',
      message: 'Unable to retrieve booking'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/booking/user/:userId
 * Get all bookings for a user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;

    if (!userId) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid user ID',
        message: 'User ID is required'
      };
      return res.status(400).json(response);
    }

    let bookings = await bookingService.getUserBookings(userId);

    // Filter by status if provided
    if (status) {
      bookings = bookings.filter(booking => booking.status === status);
    }

    // Limit results
    bookings = bookings.slice(0, limit);

    const response: ApiResponse = {
      success: true,
      data: {
        bookings,
        total: bookings.length
      },
      message: 'User bookings retrieved successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('User bookings retrieval error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Retrieval failed',
      message: 'Unable to retrieve user bookings'
    };

    res.status(500).json(response);
  }
});

/**
 * PUT /api/booking/:bookingId/cancel
 * Cancel a booking
 */
router.put('/:bookingId/cancel', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    if (!bookingId) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid booking ID',
        message: 'Booking ID is required'
      };
      return res.status(400).json(response);
    }

    const success = await bookingService.cancelBooking(bookingId, reason);

    const response: ApiResponse = {
      success,
      data: { cancelled: success },
      message: success ? 'Booking cancelled successfully' : 'Failed to cancel booking'
    };

    res.json(response);
  } catch (error) {
    console.error('Booking cancellation error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Cancellation failed',
      message: error instanceof Error ? error.message : 'Unable to cancel booking'
    };

    res.status(500).json(response);
  }
});

/**
 * PUT /api/booking/:bookingId/modify
 * Modify a booking
 */
router.put('/:bookingId/modify', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const modifications = req.body;

    if (!bookingId) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid booking ID',
        message: 'Booking ID is required'
      };
      return res.status(400).json(response);
    }

    const updatedBooking = await bookingService.modifyBooking(bookingId, modifications);

    const response: ApiResponse = {
      success: true,
      data: updatedBooking,
      message: 'Booking modified successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Booking modification error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Modification failed',
      message: error instanceof Error ? error.message : 'Unable to modify booking'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/booking/session/:sessionId/steps
 * Get booking steps for a session
 */
router.get('/session/:sessionId/steps', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid session ID',
        message: 'Session ID is required'
      };
      return res.status(400).json(response);
    }

    const steps = bookingService.getBookingSteps(sessionId);

    const response: ApiResponse = {
      success: true,
      data: {
        sessionId,
        steps,
        currentStep: steps.find(step => !step.completed)?.step || 'confirmation',
        completedSteps: steps.filter(step => step.completed).length,
        totalSteps: steps.length
      },
      message: 'Booking steps retrieved successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Booking steps retrieval error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Retrieval failed',
      message: 'Unable to retrieve booking steps'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/booking/session/:sessionId/step
 * Update booking step data
 */
router.post('/session/:sessionId/step', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { step, data } = req.body;

    if (!sessionId || !step) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid request',
        message: 'Session ID and step are required'
      };
      return res.status(400).json(response);
    }

    // Validate step data based on step type
    let validationError = null;
    switch (step) {
      case 'passenger_info':
        const passengerValidation = Joi.array().items(passengerSchema).validate(data);
        if (passengerValidation.error) {
          validationError = passengerValidation.error.details[0].message;
        }
        break;
      case 'contact_info':
        const contactValidation = contactInfoSchema.validate(data);
        if (contactValidation.error) {
          validationError = contactValidation.error.details[0].message;
        }
        break;
      case 'payment':
        const paymentValidation = paymentInfoSchema.validate(data);
        if (paymentValidation.error) {
          validationError = paymentValidation.error.details[0].message;
        }
        break;
    }

    if (validationError) {
      const response: ApiResponse = {
        success: false,
        error: 'Validation error',
        message: validationError
      };
      return res.status(400).json(response);
    }

    bookingService.updateBookingStep(sessionId, step, data);

    const response: ApiResponse = {
      success: true,
      data: { step, updated: true },
      message: 'Booking step updated successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Booking step update error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Update failed',
      message: error instanceof Error ? error.message : 'Unable to update booking step'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/booking/stats
 * Get booking statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await bookingService.getBookingStatistics();

    const response: ApiResponse = {
      success: true,
      data: stats,
      message: 'Booking statistics retrieved successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Booking statistics error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Statistics failed',
      message: 'Unable to retrieve booking statistics'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/booking/:bookingId/rebook
 * Rebook a cancelled flight
 */
router.post('/:bookingId/rebook', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { newFlightId, reason } = req.body;

    if (!bookingId || !newFlightId) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid request',
        message: 'Booking ID and new flight ID are required'
      };
      return res.status(400).json(response);
    }

    const { travelUpdateService } = await import('../services/travelUpdateService');
    const result = await travelUpdateService.processRebooking(bookingId, newFlightId, reason || 'Customer requested rebooking');

    const response: ApiResponse = {
      success: result.success,
      data: result,
      message: result.success ? 'Rebooking processed successfully' : 'Rebooking failed'
    };

    res.json(response);
  } catch (error) {
    console.error('Rebooking error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Rebooking failed',
      message: error instanceof Error ? error.message : 'Unable to process rebooking'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/booking/:bookingId/flight-changes
 * Get flight change history for a booking
 */
router.get('/:bookingId/flight-changes', async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid booking ID',
        message: 'Booking ID is required'
      };
      return res.status(400).json(response);
    }

    const { travelUpdateService } = await import('../services/travelUpdateService');
    const flightChanges = await travelUpdateService.getFlightChangeHistory(bookingId);

    const response: ApiResponse = {
      success: true,
      data: { flightChanges },
      message: 'Flight change history retrieved successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Flight changes retrieval error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Retrieval failed',
      message: 'Unable to retrieve flight change history'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/booking/:bookingId/travel-reminders
 * Get travel reminders for a booking
 */
router.get('/:bookingId/travel-reminders', async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid booking ID',
        message: 'Booking ID is required'
      };
      return res.status(400).json(response);
    }

    const { travelUpdateService } = await import('../services/travelUpdateService');
    const reminders = await travelUpdateService.getTravelReminders(bookingId);

    const response: ApiResponse = {
      success: true,
      data: { reminders },
      message: 'Travel reminders retrieved successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Travel reminders retrieval error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Retrieval failed',
      message: 'Unable to retrieve travel reminders'
    };

    res.status(500).json(response);
  }
});

export default router;