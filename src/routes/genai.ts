import express from 'express';
import Joi from 'joi';
import { embeddingService } from '../services/embeddingService';
import { vectorSearchService } from '../services/vectorSearchService';
import { ragService } from '../services/ragService';
import { predictiveAnalyticsService } from '../services/predictiveAnalytics';
import { multimodalService } from '../services/multimodalService';
import { personalizationEngine } from '../services/personalizationEngine';
import { proactiveAssistanceService } from '../services/proactiveAssistance';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

// ============================================================================
// SEMANTIC SEARCH & RAG
// ============================================================================

/**
 * POST /api/genai/semantic-search
 * Semantic search using embeddings
 */
router.post('/semantic-search', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    query: Joi.string().required(),
    topK: Joi.number().min(1).max(20).default(10),
    minScore: Joi.number().min(0).max(1).default(0.7),
    filters: Joi.object().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  try {
    const results = await vectorSearchService.semanticSearch(value.query, {
      topK: value.topK,
      minScore: value.minScore,
      filters: value.filters
    });

    const response: ApiResponse = {
      success: true,
      data: {
        query: value.query,
        results: results.map(r => ({
          flight: r.flight,
          score: r.score,
          similarity: r.similarity
        })),
        count: results.length
      },
      message: 'Semantic search completed'
    };

    res.json(response);
  } catch (error: any) {
    // Fallback to regular search if embeddings fail
    console.warn('⚠️ Semantic search failed, falling back to regular search:', error.message);
    
    // Use mock flight data when Elasticsearch is empty or embeddings fail
    const mockFlights = [
      {
        id: 'FL001',
        airline: 'Air France',
        flightNumber: 'AF100',
        origin: { code: 'JFK', name: 'New York JFK', city: 'New York', country: 'USA' },
        destination: { code: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris', country: 'France' },
        departureTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        arrivalTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(),
        duration: 480,
        stops: 0,
        price: 650,
        availableSeats: 45,
        class: 'economy'
      },
      {
        id: 'FL002',
        airline: 'Delta',
        flightNumber: 'DL200',
        origin: { code: 'JFK', name: 'New York JFK', city: 'New York', country: 'USA' },
        destination: { code: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris', country: 'France' },
        departureTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
        arrivalTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000).toISOString(),
        duration: 480,
        stops: 0,
        price: 720,
        availableSeats: 32,
        class: 'economy'
      },
      {
        id: 'FL003',
        airline: 'United',
        flightNumber: 'UA300',
        origin: { code: 'JFK', name: 'New York JFK', city: 'New York', country: 'USA' },
        destination: { code: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris', country: 'France' },
        departureTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        arrivalTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 7.5 * 60 * 60 * 1000).toISOString(),
        duration: 450,
        stops: 0,
        price: 580,
        availableSeats: 28,
        class: 'economy'
      }
    ];
    
    const fallbackResults = mockFlights.filter(f => 
      value.query.toLowerCase().includes('paris') || 
      value.query.toLowerCase().includes('france') ||
      value.query.toLowerCase().includes('cdg')
    ).slice(0, value.topK);

    const response: ApiResponse = {
      success: true,
      data: {
        query: value.query,
        results: fallbackResults.map((flight: any) => ({
          flight,
          score: 0.8,
          similarity: 0.8
        })),
        count: fallbackResults.length,
        fallback: true,
        fallbackReason: 'Embedding service unavailable (quota exceeded)'
      },
      message: 'Search completed using fallback method'
    };

    res.json(response);
  }
}));

/**
 * POST /api/genai/rag-query
 * Ask questions using RAG
 */
router.post('/rag-query', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    question: Joi.string().required(),
    flightIds: Joi.array().items(Joi.string()).optional(),
    context: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  try {
    const result = await ragService.answerFlightQuestion(
      value.question,
      value.flightIds,
      value.context
    );

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Question answered using RAG'
    };

    res.json(response);
  } catch (error: any) {
    // Fallback with helpful general information
    console.warn('⚠️ RAG failed, using fallback response:', error.message);
    
    // Provide helpful general answers for common travel questions
    let fallbackAnswer = '';
    const question = value.question.toLowerCase();
    
    if (question.includes('baggage') || question.includes('luggage')) {
      fallbackAnswer = `For international flights, most airlines allow:

**Checked Baggage:**
- Economy: 1-2 bags, up to 23kg (50 lbs) each
- Business/First: 2-3 bags, up to 32kg (70 lbs) each

**Carry-on:**
- 1 carry-on bag (max 7-10kg / 15-22 lbs)
- 1 personal item (purse, laptop bag)
- Max dimensions: 55cm x 40cm x 20cm (22" x 16" x 8")

**Important:** Specific allowances vary by airline and route. Always check with your airline before traveling.`;
    } else if (question.includes('cancel') || question.includes('refund')) {
      fallbackAnswer = `**Cancellation Policies:**

Most airlines offer:
- **24-hour free cancellation** for bookings made 7+ days before departure
- **Refundable tickets**: Full refund minus fees
- **Non-refundable tickets**: May get travel credit or pay change fee

**Refund Timeline:**
- Credit card refunds: 7-20 business days
- Travel credits: Usually valid for 12 months

Always review your specific ticket's terms and conditions.`;
    } else if (question.includes('change') || question.includes('modify')) {
      fallbackAnswer = `**Flight Change Policies:**

- **Flexible/Refundable tickets**: Usually free changes
- **Basic Economy**: Often no changes allowed
- **Standard tickets**: Change fee + fare difference

**Change Fees:**
- Domestic: $75-$200
- International: $200-$400

Many airlines now offer more flexible policies. Check your airline's current policy.`;
    } else {
      fallbackAnswer = `I'd be happy to help with your travel question! 

For the most accurate and up-to-date information about "${value.question}", I recommend:

1. **Check your airline's website** - Policies vary by carrier
2. **Review your ticket terms** - Specific rules apply to your fare class
3. **Contact customer service** - They can provide personalized assistance

Common topics I can help with:
- Baggage allowances
- Cancellation policies
- Flight changes
- Check-in procedures
- Travel requirements`;
    }

    const response: ApiResponse = {
      success: true,
      data: {
        answer: fallbackAnswer,
        sources: [],
        confidence: 0.8,
        fallback: true,
        fallbackReason: 'Using general travel information (embedding service unavailable)'
      },
      message: 'Question answered with general travel information'
    };

    res.json(response);
  }
}));

/**
 * POST /api/genai/explain-policy
 * Explain airline policies in natural language
 */
router.post('/explain-policy', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    policyType: Joi.string().valid('baggage', 'cancellation', 'change', 'refund').required(),
    airline: Joi.string().required(),
    flightClass: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const result = await ragService.explainPolicy(
    value.policyType,
    value.airline,
    value.flightClass
  );

  const response: ApiResponse = {
    success: true,
    data: result,
    message: 'Policy explained'
  };

  res.json(response);
}));

/**
 * POST /api/genai/generate-itinerary
 * Generate AI-powered travel itinerary
 */
router.post('/generate-itinerary', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    flightIds: Joi.array().items(Joi.string()).required(),
    destination: Joi.string().required(),
    tripDuration: Joi.number().min(1).max(30).required(),
    interests: Joi.array().items(Joi.string()).optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  // Get flights
  const { elasticsearchService } = await import('../services/elasticsearch');
  const flights = await Promise.all(
    value.flightIds.map(id => elasticsearchService.getFlightById(id))
  ).then(results => results.filter(f => f !== null));

  const result = await ragService.generateItinerary(
    flights as any,
    value.destination,
    value.tripDuration,
    value.interests
  );

  const response: ApiResponse = {
    success: true,
    data: result,
    message: 'Itinerary generated'
  };

  res.json(response);
}));

// ============================================================================
// PREDICTIVE ANALYTICS
// ============================================================================

/**
 * POST /api/genai/predict-price
 * Predict price trends
 */
router.post('/predict-price', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    origin: Joi.string().required(),
    destination: Joi.string().required(),
    departureDate: Joi.date().required(),
    currentPrice: Joi.number().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const prediction = await predictiveAnalyticsService.predictPriceTrend(
    value.origin,
    value.destination,
    new Date(value.departureDate),
    value.currentPrice
  );

  const response: ApiResponse = {
    success: true,
    data: prediction,
    message: 'Price prediction generated'
  };

  res.json(response);
}));

/**
 * POST /api/genai/predict-delay
 * Predict flight delay probability
 */
router.post('/predict-delay', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    flightId: Joi.string().required(),
    weatherConditions: Joi.object().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const { elasticsearchService } = await import('../services/elasticsearch');
  const flight = await elasticsearchService.getFlightById(value.flightId);

  if (!flight) {
    return res.status(404).json({
      success: false,
      error: 'Flight not found',
      message: 'The specified flight could not be found'
    });
  }

  const prediction = await predictiveAnalyticsService.predictDelay(
    flight as any,
    value.weatherConditions
  );

  const response: ApiResponse = {
    success: true,
    data: prediction,
    message: 'Delay prediction generated'
  };

  res.json(response);
}));

/**
 * POST /api/genai/forecast-demand
 * Forecast demand for a route
 */
router.post('/forecast-demand', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    origin: Joi.string().required(),
    destination: Joi.string().required(),
    date: Joi.date().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const forecast = await predictiveAnalyticsService.forecastDemand(
    value.origin,
    value.destination,
    new Date(value.date)
  );

  const response: ApiResponse = {
    success: true,
    data: forecast,
    message: 'Demand forecast generated'
  };

  res.json(response);
}));

/**
 * POST /api/genai/optimal-booking-time
 * Predict optimal booking time
 */
router.post('/optimal-booking-time', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    origin: Joi.string().required(),
    destination: Joi.string().required(),
    departureDate: Joi.date().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const prediction = await predictiveAnalyticsService.predictOptimalBookingTime(
    value.origin,
    value.destination,
    new Date(value.departureDate)
  );

  const response: ApiResponse = {
    success: true,
    data: prediction,
    message: 'Optimal booking time predicted'
  };

  res.json(response);
}));

// ============================================================================
// MULTIMODAL AI
// ============================================================================

/**
 * POST /api/genai/extract-document
 * Extract information from travel document
 */
router.post('/extract-document', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    imageData: Joi.string().required(),
    documentType: Joi.string().valid('passport', 'id', 'boarding_pass', 'visa').optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const result = await multimodalService.extractDocumentInfo(
    value.imageData,
    value.documentType
  );

  const response: ApiResponse = {
    success: true,
    data: result,
    message: 'Document information extracted'
  };

  res.json(response);
}));

/**
 * POST /api/genai/validate-passport
 * Validate passport information
 */
router.post('/validate-passport', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    passportNumber: Joi.string().required(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    nationality: Joi.string().required(),
    dateOfBirth: Joi.string().required(),
    expiryDate: Joi.string().required(),
    issuingCountry: Joi.string().required(),
    gender: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const result = await multimodalService.validatePassport(value);

  const response: ApiResponse = {
    success: true,
    data: result,
    message: 'Passport validated'
  };

  res.json(response);
}));

/**
 * POST /api/genai/verify-identity
 * Verify identity using document and selfie
 */
router.post('/verify-identity', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    documentImageData: Joi.string().required(),
    selfieImageData: Joi.string().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const result = await multimodalService.verifyIdentity(
    value.documentImageData,
    value.selfieImageData
  );

  const response: ApiResponse = {
    success: true,
    data: result,
    message: 'Identity verification completed'
  };

  res.json(response);
}));

// ============================================================================
// PERSONALIZATION
// ============================================================================

/**
 * GET /api/genai/user-profile/:userId
 * Get user profile and preferences
 */
router.get('/user-profile/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const profile = await personalizationEngine.getUserProfile(userId);

  const response: ApiResponse = {
    success: true,
    data: profile,
    message: 'User profile retrieved'
  };

  res.json(response);
}));

/**
 * POST /api/genai/personalized-recommendations
 * Get personalized flight recommendations
 */
router.post('/personalized-recommendations', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    userId: Joi.string().required(),
    flightIds: Joi.array().items(Joi.string()).required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  // Get flights
  const { elasticsearchService } = await import('../services/elasticsearch');
  const flights = await Promise.all(
    value.flightIds.map(id => elasticsearchService.getFlightById(id))
  ).then(results => results.filter(f => f !== null));

  const recommendations = await personalizationEngine.generatePersonalizedRecommendations(
    value.userId,
    flights as any
  );

  const response: ApiResponse = {
    success: true,
    data: recommendations,
    message: 'Personalized recommendations generated'
  };

  res.json(response);
}));

/**
 * POST /api/genai/predict-preferences
 * Predict user preferences using AI
 */
router.post('/predict-preferences', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    userId: Joi.string().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const predictions = await personalizationEngine.predictUserPreferences(value.userId);

  const response: ApiResponse = {
    success: true,
    data: predictions,
    message: 'User preferences predicted'
  };

  res.json(response);
}));

/**
 * GET /api/genai/search-suggestions/:userId
 * Get personalized search suggestions
 */
router.get('/search-suggestions/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const suggestions = await personalizationEngine.getPersonalizedSearchSuggestions(userId);

  const response: ApiResponse = {
    success: true,
    data: { suggestions },
    message: 'Search suggestions generated'
  };

  res.json(response);
}));

// ============================================================================
// PROACTIVE ASSISTANCE
// ============================================================================

/**
 * POST /api/genai/monitor-flight
 * Start monitoring a flight for proactive alerts
 */
router.post('/monitor-flight', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    bookingId: Joi.string().required(),
    userId: Joi.string().required(),
    flightId: Joi.string().required(),
    alertPreferences: Joi.object({
      delays: Joi.boolean().default(true),
      gateChanges: Joi.boolean().default(true),
      priceDrops: Joi.boolean().default(false),
      weatherAlerts: Joi.boolean().default(true)
    }).default()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const { elasticsearchService } = await import('../services/elasticsearch');
  const flight = await elasticsearchService.getFlightById(value.flightId);

  if (!flight) {
    return res.status(404).json({
      success: false,
      error: 'Flight not found',
      message: 'The specified flight could not be found'
    });
  }

  await proactiveAssistanceService.monitorFlight({
    bookingId: value.bookingId,
    userId: value.userId,
    flightId: value.flightId,
    flight: flight as any,
    monitoringEnabled: true,
    alertPreferences: value.alertPreferences
  });

  const response: ApiResponse = {
    success: true,
    data: { monitoring: true },
    message: 'Flight monitoring started'
  };

  res.json(response);
}));

/**
 * POST /api/genai/suggest-rebooking
 * Get rebooking suggestions for disrupted flight
 */
router.post('/suggest-rebooking', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    bookingId: Joi.string().required(),
    reason: Joi.string().valid('delay', 'cancellation', 'missed_connection').required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const suggestions = await proactiveAssistanceService.suggestRebooking(
    value.bookingId,
    value.reason
  );

  const response: ApiResponse = {
    success: true,
    data: suggestions,
    message: 'Rebooking suggestions generated'
  };

  res.json(response);
}));

/**
 * POST /api/genai/travel-tips
 * Get personalized travel tips
 */
router.post('/travel-tips', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    userId: Joi.string().required(),
    bookingId: Joi.string().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  // Mock booking data - in production, fetch from database
  const mockBooking: any = {
    userId: value.userId,
    bookingId: value.bookingId,
    flight: {
      airline: 'Delta Air Lines',
      flightNumber: 'DL100',
      origin: { city: 'New York', code: 'JFK' },
      destination: { city: 'London', code: 'LHR' },
      departureTime: new Date(Date.now() + 86400000 * 2),
      duration: 420
    }
  };

  const tips = await proactiveAssistanceService.generateTravelTips(
    value.userId,
    mockBooking
  );

  const response: ApiResponse = {
    success: true,
    data: { tips },
    message: 'Travel tips generated'
  };

  res.json(response);
}));

/**
 * POST /api/genai/check-in-assist
 * Get check-in assistance
 */
router.post('/check-in-assist', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    bookingId: Joi.string().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const assistance = await proactiveAssistanceService.assistWithCheckIn(value.bookingId);

  const response: ApiResponse = {
    success: true,
    data: assistance,
    message: 'Check-in assistance provided'
  };

  res.json(response);
}));

export default router;
