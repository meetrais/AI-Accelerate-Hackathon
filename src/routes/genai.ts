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
