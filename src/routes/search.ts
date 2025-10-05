import express from 'express';
import Joi from 'joi';
import { elasticsearchService } from '../services/elasticsearch';
import { ApiResponse, FlightSearchRequest, FlightResult } from '../types';

const router = express.Router();

// Validation schema for flight search
const flightSearchSchema = Joi.object({
  origin: Joi.string().length(3).uppercase().required()
    .messages({
      'string.length': 'Origin airport code must be exactly 3 characters',
      'any.required': 'Origin airport code is required'
    }),
  destination: Joi.string().length(3).uppercase().required()
    .messages({
      'string.length': 'Destination airport code must be exactly 3 characters',
      'any.required': 'Destination airport code is required'
    }),
  departureDate: Joi.date().min('now').required()
    .messages({
      'date.min': 'Departure date must be in the future',
      'any.required': 'Departure date is required'
    }),
  returnDate: Joi.date().min(Joi.ref('departureDate')).optional()
    .messages({
      'date.min': 'Return date must be after departure date'
    }),
  passengers: Joi.number().integer().min(1).max(9).default(1)
    .messages({
      'number.min': 'At least 1 passenger is required',
      'number.max': 'Maximum 9 passengers allowed'
    }),
  filters: Joi.object({
    maxPrice: Joi.number().positive().optional(),
    airlines: Joi.array().items(Joi.string()).optional(),
    maxStops: Joi.number().integer().min(0).max(3).optional(),
    departureTimeRange: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional()
    }).optional(),
    class: Joi.string().valid('economy', 'business', 'first').optional()
  }).optional()
});

/**
 * POST /api/search/flights
 * Search for flights based on criteria with hybrid search
 */
router.post('/flights', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = flightSearchSchema.validate(req.body);
    if (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      };
      return res.status(400).json(response);
    }

    const searchRequest: FlightSearchRequest = value;

    // Check if origin and destination are the same
    if (searchRequest.origin === searchRequest.destination) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid search',
        message: 'Origin and destination cannot be the same'
      };
      return res.status(400).json(response);
    }

    // Use hybrid search service for enhanced results
    const { hybridSearchService } = await import('../services/hybridSearch');
    const searchOptions = {
      useSemanticSearch: req.query.semantic === 'true',
      maxResults: parseInt(req.query.limit as string) || 20
    };

    const searchResult = await hybridSearchService.hybridFlightSearch(searchRequest, searchOptions);

    const response: ApiResponse = {
      success: true,
      data: {
        flights: searchResult.results,
        suggestions: searchResult.suggestions,
        metadata: searchResult.searchMetadata
      },
      message: `Found ${searchResult.results.length} flights`
    };

    res.json(response);
  } catch (error) {
    console.error('Flight search error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Search failed',
      message: 'Unable to search flights at this time'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/search/airports?q=query
 * Get airport suggestions based on partial input
 */
router.get('/airports', async (req, res) => {
  try {
    const query = req.query.q as string;

    if (!query || query.length < 2) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid query',
        message: 'Query must be at least 2 characters long'
      };
      return res.status(400).json(response);
    }

    const airports = await elasticsearchService.suggestAirports(query);

    const response: ApiResponse = {
      success: true,
      data: airports,
      message: `Found ${airports.length} airport suggestions`
    };

    res.json(response);
  } catch (error) {
    console.error('Airport suggestion error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Search failed',
      message: 'Unable to get airport suggestions at this time'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/search/flights/:flightId
 * Get detailed flight information by ID
 */
router.get('/flights/:flightId', async (req, res) => {
  try {
    const { flightId } = req.params;

    if (!flightId) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid request',
        message: 'Flight ID is required'
      };
      return res.status(400).json(response);
    }

    const flight = await elasticsearchService.getFlightById(flightId);

    if (!flight) {
      const response: ApiResponse = {
        success: false,
        error: 'Not found',
        message: 'Flight not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: flight,
      message: 'Flight details retrieved successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Flight details error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Retrieval failed',
      message: 'Unable to get flight details at this time'
    };

    res.status(500).json(response);
  }
});

export default router;/*
*
 * POST /api/search/flexible
 * Search flights with flexible dates
 */
router.post('/flexible', async (req, res) => {
  try {
    const schema = Joi.object({
      origin: Joi.string().length(3).uppercase().required(),
      destination: Joi.string().length(3).uppercase().required(),
      centerDate: Joi.date().min('now').required(),
      dayRange: Joi.number().integer().min(1).max(7).default(3),
      filters: Joi.object().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      };
      return res.status(400).json(response);
    }

    const flexibleResults = await elasticsearchService.searchFlightsFlexible(
      value.origin,
      value.destination,
      value.centerDate,
      value.dayRange,
      value.filters
    );

    const response: ApiResponse = {
      success: true,
      data: flexibleResults,
      message: 'Flexible date search completed'
    };

    res.json(response);
  } catch (error) {
    console.error('Flexible search error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Search failed',
      message: 'Unable to perform flexible date search'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/search/route-stats/:origin/:destination
 * Get statistics for a specific route
 */
router.get('/route-stats/:origin/:destination', async (req, res) => {
  try {
    const { origin, destination } = req.params;

    if (!origin || !destination || origin.length !== 3 || destination.length !== 3) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid parameters',
        message: 'Origin and destination must be 3-letter airport codes'
      };
      return res.status(400).json(response);
    }

    const stats = await elasticsearchService.getRouteStatistics(
      origin.toUpperCase(),
      destination.toUpperCase()
    );

    const response: ApiResponse = {
      success: true,
      data: stats,
      message: 'Route statistics retrieved successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Route statistics error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Statistics failed',
      message: 'Unable to retrieve route statistics'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/search/recommendations
 * Get personalized flight recommendations
 */
router.post('/recommendations', async (req, res) => {
  try {
    const schema = Joi.object({
      flights: Joi.array().items(Joi.object()).required(),
      searchParams: Joi.object().required(),
      userPreferences: Joi.object().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      };
      return res.status(400).json(response);
    }

    const { flightRecommendationService } = await import('../services/flightRecommendation');
    const recommendations = await flightRecommendationService.generateRecommendations(
      value.flights,
      value.searchParams,
      value.userPreferences
    );

    const response: ApiResponse = {
      success: true,
      data: recommendations,
      message: 'Recommendations generated successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Recommendations error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Recommendations failed',
      message: 'Unable to generate recommendations'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/search/compare
 * Compare multiple flights side by side
 */
router.post('/compare', async (req, res) => {
  try {
    const schema = Joi.object({
      flights: Joi.array().items(Joi.object()).min(2).max(5).required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      };
      return res.status(400).json(response);
    }

    const { flightRecommendationService } = await import('../services/flightRecommendation');
    const comparison = flightRecommendationService.compareFlights(value.flights);

    const response: ApiResponse = {
      success: true,
      data: comparison,
      message: 'Flight comparison completed'
    };

    res.json(response);
  } catch (error) {
    console.error('Flight comparison error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Comparison failed',
      message: 'Unable to compare flights'
    };

    res.status(500).json(response);
  }
});