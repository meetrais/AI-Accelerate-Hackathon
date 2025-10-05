import express from 'express';
import Joi from 'joi';
import { nlpService } from '../services/nlpService';
import { vertexAIService } from '../services/vertexai';
import { sessionManager } from '../services/sessionManager';
import { ApiResponse, TravelQuery, ConversationRequest } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Validation schema for travel query
const travelQuerySchema = Joi.object({
  userMessage: Joi.string().min(1).max(500).required()
    .messages({
      'string.min': 'Message cannot be empty',
      'string.max': 'Message is too long (max 500 characters)',
      'any.required': 'User message is required'
    }),
  sessionId: Joi.string().optional(),
  userId: Joi.string().optional()
});

// Validation schema for conversation request
const conversationSchema = Joi.object({
  message: Joi.string().min(1).max(500).required()
    .messages({
      'string.min': 'Message cannot be empty',
      'string.max': 'Message is too long (max 500 characters)',
      'any.required': 'Message is required'
    }),
  sessionId: Joi.string().required()
    .messages({
      'any.required': 'Session ID is required'
    }),
  userId: Joi.string().optional()
});

/**
 * POST /api/nlp/query
 * Process natural language travel query and extract parameters
 */
router.post('/query', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = travelQuerySchema.validate(req.body);
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

    const travelQuery: TravelQuery = {
      userMessage: value.userMessage,
      sessionId,
      context: sessionManager.getConversationContext(sessionId)
    };

    // Process the query
    const result = await nlpService.processTravelQuery(travelQuery);

    const response: ApiResponse = {
      success: true,
      data: {
        sessionId,
        extractedParams: result.params,
        flightResults: result.searchResults,
        response: result.response,
        resultCount: result.searchResults.length
      },
      message: 'Query processed successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('NLP query processing error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Processing failed',
      message: 'Unable to process your travel query at this time'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/nlp/chat
 * Handle conversational interactions
 */
router.post('/chat', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = conversationSchema.validate(req.body);
    if (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      };
      return res.status(400).json(response);
    }

    const conversationRequest: ConversationRequest = {
      message: value.message,
      sessionId: value.sessionId,
      userId: value.userId
    };

    // Handle the conversation
    const result = await nlpService.handleConversation(conversationRequest);

    const response: ApiResponse = {
      success: true,
      data: {
        sessionId: value.sessionId,
        response: result.message,
        flightOptions: result.flightOptions,
        suggestedActions: result.suggestedActions,
        bookingStep: result.bookingStep
      },
      message: 'Conversation handled successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Conversation handling error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Conversation failed',
      message: 'Unable to process your message at this time'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/nlp/session/:sessionId
 * Get session information and conversation history
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

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
        error: 'Not found',
        message: 'Session not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        sessionId: session.sessionId,
        userId: session.userId,
        currentQuery: session.currentQuery,
        conversationHistory: session.conversationHistory,
        searchResults: session.searchResults,
        selectedFlight: session.selectedFlight,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity
      },
      message: 'Session retrieved successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Session retrieval error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Retrieval failed',
      message: 'Unable to retrieve session at this time'
    };

    res.status(500).json(response);
  }
});

/**
 * DELETE /api/nlp/session/:sessionId
 * Clear session data
 */
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid request',
        message: 'Session ID is required'
      };
      return res.status(400).json(response);
    }

    sessionManager.clearSession(sessionId);

    const response: ApiResponse = {
      success: true,
      message: 'Session cleared successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Session clearing error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Clear failed',
      message: 'Unable to clear session at this time'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/nlp/suggestions/airports?q=query
 * Get airport suggestions with AI-powered recommendations
 */
router.get('/suggestions/airports', async (req, res) => {
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

    // Get airport suggestions from Elasticsearch
    const { elasticsearchService } = await import('../services/elasticsearch');
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
      error: 'Suggestion failed',
      message: 'Unable to get airport suggestions at this time'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/nlp/stats
 * Get NLP service statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const sessionStats = sessionManager.getSessionStats();
    
    // Check service health
    const vertexAIHealthy = await vertexAIService.healthCheck();

    const response: ApiResponse = {
      success: true,
      data: {
        sessions: sessionStats,
        services: {
          vertexAI: vertexAIHealthy,
          nlpService: true
        },
        timestamp: new Date().toISOString()
      },
      message: 'Statistics retrieved successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Stats retrieval error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Stats failed',
      message: 'Unable to retrieve statistics at this time'
    };

    res.status(500).json(response);
  }
});

export default router;