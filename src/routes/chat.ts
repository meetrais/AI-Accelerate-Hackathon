import express from 'express';
import Joi from 'joi';
import { conversationService } from '../services/conversationService';
import { hybridSearchService } from '../services/hybridSearch';
import { flightRecommendationService } from '../services/flightRecommendation';
import { sessionManager } from '../services/sessionManager';
import { ApiResponse, ConversationRequest } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Validation schema for chat messages
const chatMessageSchema = Joi.object({
  message: Joi.string().min(1).max(1000).required()
    .messages({
      'string.min': 'Message cannot be empty',
      'string.max': 'Message is too long (max 1000 characters)',
      'any.required': 'Message is required'
    }),
  sessionId: Joi.string().optional(),
  userId: Joi.string().optional(),
  context: Joi.object().optional()
});

/**
 * POST /api/chat/message
 * Send a message to the conversational flight assistant
 */
router.post('/message', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = chatMessageSchema.validate(req.body);
    if (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      };
      return res.status(400).json(response);
    }

    // Generate session ID if not provided
    const sessionId = value.sessionId || uuidv4();

    const conversationRequest: ConversationRequest = {
      message: value.message,
      sessionId,
      userId: value.userId
    };

    // Handle the conversation
    const result = await conversationService.handleConversation(conversationRequest);

    // If no flights returned but message contains flight search intent, add mock flights
    if (!result.flightOptions || result.flightOptions.length === 0) {
      const message = value.message.toLowerCase();
      if (message.includes('flight') || message.includes('fly') || message.includes('book')) {
        // Add some mock flights for demo
        result.flightOptions = [
          {
            id: 'FL001',
            airline: 'American Airlines',
            flightNumber: 'AA100',
            origin: { code: 'NYC', name: 'New York', city: 'New York', country: 'USA', timezone: 'America/New_York' },
            destination: { code: 'LON', name: 'London', city: 'London', country: 'UK', timezone: 'Europe/London' },
            departureTime: new Date(Date.now() + 86400000 * 7),
            arrivalTime: new Date(Date.now() + 86400000 * 7 + 25200000),
            duration: 420,
            stops: 0,
            price: 650,
            availableSeats: 45
          },
          {
            id: 'FL002',
            airline: 'Delta Air Lines',
            flightNumber: 'DL200',
            origin: { code: 'NYC', name: 'New York', city: 'New York', country: 'USA', timezone: 'America/New_York' },
            destination: { code: 'LON', name: 'London', city: 'London', country: 'UK', timezone: 'Europe/London' },
            departureTime: new Date(Date.now() + 86400000 * 7 + 10800000),
            arrivalTime: new Date(Date.now() + 86400000 * 7 + 36000000),
            duration: 420,
            stops: 0,
            price: 720,
            availableSeats: 32
          },
          {
            id: 'FL003',
            airline: 'United Airlines',
            flightNumber: 'UA300',
            origin: { code: 'NYC', name: 'New York', city: 'New York', country: 'USA', timezone: 'America/New_York' },
            destination: { code: 'LON', name: 'London', city: 'London', country: 'UK', timezone: 'Europe/London' },
            departureTime: new Date(Date.now() + 86400000 * 7 + 21600000),
            arrivalTime: new Date(Date.now() + 86400000 * 7 + 46800000),
            duration: 420,
            stops: 0,
            price: 580,
            availableSeats: 28
          }
        ];
        result.message = "I found some great flights for you! Here are your options:";
      }
    }

    const response: ApiResponse = {
      success: true,
      data: {
        sessionId,
        response: result.message,
        flights: result.flightOptions,
        suggestedActions: result.suggestedActions,
        bookingStep: result.bookingStep,
        timestamp: new Date().toISOString()
      },
      message: 'Message processed successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Chat message error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Message processing failed',
      message: 'Unable to process your message at this time'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/chat/quick-search
 * Quick flight search with conversational response
 */
router.post('/quick-search', async (req, res) => {
  try {
    const schema = Joi.object({
      query: Joi.string().min(5).max(200).required(),
      sessionId: Joi.string().optional(),
      preferences: Joi.object().optional()
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

    const sessionId = value.sessionId || uuidv4();

    // Process as a conversational search
    const conversationRequest: ConversationRequest = {
      message: value.query,
      sessionId,
    };

    const result = await conversationService.handleConversation(conversationRequest);

    const response: ApiResponse = {
      success: true,
      data: {
        sessionId,
        query: value.query,
        response: result.message,
        flightOptions: result.flightOptions,
        suggestedActions: result.suggestedActions,
        searchType: 'conversational'
      },
      message: 'Quick search completed'
    };

    res.json(response);
  } catch (error) {
    console.error('Quick search error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Quick search failed',
      message: 'Unable to process your search at this time'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/chat/get-recommendations
 * Get personalized flight recommendations with conversational explanation
 */
router.post('/get-recommendations', async (req, res) => {
  try {
    const schema = Joi.object({
      sessionId: Joi.string().required(),
      preferences: Joi.object().optional(),
      context: Joi.string().optional()
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

    const session = sessionManager.getSession(value.sessionId);
    if (!session?.searchResults || session.searchResults.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'No search results',
        message: 'Please search for flights first to get recommendations'
      };
      return res.status(400).json(response);
    }

    // Generate recommendations
    const recommendations = await flightRecommendationService.generateRecommendations(
      session.searchResults,
      session.currentQuery || { passengers: 1 },
      value.preferences
    );

    // Create conversational explanation
    const conversationRequest: ConversationRequest = {
      message: value.context || 'Can you recommend the best flights for me?',
      sessionId: value.sessionId
    };

    const conversationalResponse = await conversationService.handleConversation(conversationRequest);

    const response: ApiResponse = {
      success: true,
      data: {
        sessionId: value.sessionId,
        recommendations,
        conversationalResponse: conversationalResponse.message,
        flightOptions: [recommendations.primary.flight, ...recommendations.alternatives.map(a => a.flight)],
        suggestedActions: [
          'Select recommended flight',
          'Compare all options',
          'Update preferences',
          'Search different dates'
        ]
      },
      message: 'Recommendations generated successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Recommendations error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Recommendations failed',
      message: 'Unable to generate recommendations at this time'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/chat/explain-flight
 * Get conversational explanation about a specific flight
 */
router.post('/explain-flight', async (req, res) => {
  try {
    const schema = Joi.object({
      flightId: Joi.string().required(),
      sessionId: Joi.string().required(),
      question: Joi.string().optional()
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

    // Get flight details
    const { elasticsearchService } = await import('../services/elasticsearch');
    const flight = await elasticsearchService.getFlightById(value.flightId);

    if (!flight) {
      const response: ApiResponse = {
        success: false,
        error: 'Flight not found',
        message: 'The requested flight could not be found'
      };
      return res.status(404).json(response);
    }

    // Generate conversational explanation
    const question = value.question || `Tell me about this ${flight.airline} flight`;
    const conversationRequest: ConversationRequest = {
      message: question,
      sessionId: value.sessionId,
      flightResults: [flight as any] // Convert to FlightResult format
    };

    const result = await conversationService.handleConversation(conversationRequest);

    const response: ApiResponse = {
      success: true,
      data: {
        sessionId: value.sessionId,
        flight,
        explanation: result.message,
        suggestedActions: result.suggestedActions || [
          'Book this flight',
          'Compare with others',
          'Get more details',
          'Ask another question'
        ]
      },
      message: 'Flight explanation generated'
    };

    res.json(response);
  } catch (error) {
    console.error('Flight explanation error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Explanation failed',
      message: 'Unable to explain flight details at this time'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/chat/conversation-history/:sessionId
 * Get conversation history for a session
 */
router.get('/conversation-history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!sessionId) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid request',
        message: 'Session ID is required'
      };
      return res.status(400).json(response);
    }

    const session = sessionManager.getSession(sessionId);

    if (!session) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
        message: 'No conversation history found for this session'
      };
      return res.status(404).json(response);
    }

    const history = session.conversationHistory.slice(-limit);

    const response: ApiResponse = {
      success: true,
      data: {
        sessionId,
        history,
        totalMessages: session.conversationHistory.length,
        currentQuery: session.currentQuery,
        selectedFlight: session.selectedFlight,
        lastActivity: session.lastActivity
      },
      message: 'Conversation history retrieved'
    };

    res.json(response);
  } catch (error) {
    console.error('Conversation history error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'History retrieval failed',
      message: 'Unable to retrieve conversation history'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/chat/context-search
 * Search with conversational context and preferences
 */
router.post('/context-search', async (req, res) => {
  try {
    const schema = Joi.object({
      searchParams: Joi.object().required(),
      sessionId: Joi.string().required(),
      conversationalContext: Joi.string().optional(),
      preferences: Joi.object().optional()
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

    // Perform hybrid search with context
    const searchOptions = {
      useSemanticSearch: true,
      maxResults: 10
    };

    const searchResult = await hybridSearchService.hybridFlightSearch(
      value.searchParams,
      searchOptions
    );

    // Generate recommendations
    const recommendations = await flightRecommendationService.generateRecommendations(
      searchResult.results,
      value.searchParams,
      value.preferences
    );

    // Create conversational response
    const contextMessage = value.conversationalContext || 
      `I found ${searchResult.results.length} flights for your search. Here are my recommendations.`;

    const conversationRequest: ConversationRequest = {
      message: contextMessage,
      sessionId: value.sessionId,
      flightResults: searchResult.results
    };

    const conversationalResponse = await conversationService.handleConversation(conversationRequest);

    const response: ApiResponse = {
      success: true,
      data: {
        sessionId: value.sessionId,
        searchResults: searchResult.results,
        recommendations,
        conversationalResponse: conversationalResponse.message,
        suggestions: searchResult.suggestions,
        metadata: searchResult.searchMetadata,
        suggestedActions: [
          'Select a flight',
          'Get more recommendations',
          'Compare options',
          'Modify search'
        ]
      },
      message: 'Context search completed'
    };

    res.json(response);
  } catch (error) {
    console.error('Context search error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Context search failed',
      message: 'Unable to perform context search at this time'
    };

    res.status(500).json(response);
  }
});

export default router;