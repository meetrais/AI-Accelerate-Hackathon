/**
 * Google Agent Payment Protocol (AP2) API Routes
 * 
 * Official AP2 implementation with cryptographically signed Mandates
 * Developed by Google and 60+ partners
 */

import express from 'express';
import Joi from 'joi';
import { ap2MandateService } from '../services/ap2MandateService';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { ap2PaymentService } from '../services/ap2PaymentService';
import { ap2PaymentService } from '../services/ap2PaymentService';
import { ap2PaymentService } from '../services/ap2PaymentService';
import { ap2PaymentService } from '../services/ap2PaymentService';
import { ap2PaymentService } from '../services/ap2PaymentService';
import { ap2PaymentService } from '../services/ap2PaymentService';
import { ap2PaymentService } from '../services/ap2PaymentService';

const router = express.Router();

/**
 * POST /api/ap2/mandate/create
 * Create a cryptographically signed Mandate (official AP2)
 */
router.post('/mandate/create', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    userId: Joi.string().required(),
    agentId: Joi.string().required(),
    maxAmount: Joi.number().min(0).required(),
    currency: Joi.string().default('USD'),
    scope: Joi.array().items(Joi.string()).default(['flight-booking']),
    durationHours: Joi.number().min(1).max(168).default(24) // Max 7 days
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const authorization = await ap2PaymentService.createAuthorization(
    value.userId,
    value.agentId,
    value.maxAmount,
    value.currency,
    value.scope,
    value.durationHours
  );

  const response: ApiResponse = {
    success: true,
    data: authorization,
    message: 'Payment authorization created'
  };

  res.json(response);
}));

/**
 * POST /api/ap2/payment
 * Process a payment through AP2 protocol
 */
router.post('/payment', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    authorizationId: Joi.string().required(),
    agentId: Joi.string().required(),
    userId: Joi.string().required(),
    amount: Joi.number().min(0).required(),
    currency: Joi.string().default('USD'),
    description: Joi.string().required(),
    metadata: Joi.object({
      bookingReference: Joi.string().optional(),
      flightId: Joi.string().optional(),
      passengers: Joi.number().optional(),
      route: Joi.string().optional()
    }).optional(),
    userConsent: Joi.object({
      consentId: Joi.string().required(),
      timestamp: Joi.date().required(),
      ipAddress: Joi.string().optional(),
      userAgent: Joi.string().optional()
    }).required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const result = await ap2PaymentService.processPayment(
    value,
    value.authorizationId
  );

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: 'Payment failed',
      message: result.error
    });
  }

  const response: ApiResponse = {
    success: true,
    data: result.transaction,
    message: 'Payment processed successfully'
  };

  res.json(response);
}));

/**
 * POST /api/ap2/revoke
 * Revoke a payment authorization
 */
router.post('/revoke', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    authorizationId: Joi.string().required(),
    reason: Joi.string().default('user_revoked')
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  await ap2PaymentService.revokeAuthorization(
    value.authorizationId,
    value.reason
  );

  const response: ApiResponse = {
    success: true,
    message: 'Authorization revoked'
  };

  res.json(response);
}));

/**
 * GET /api/ap2/authorizations/:userId
 * Get user's active authorizations
 */
router.get('/authorizations/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const authorizations = await ap2PaymentService.getUserAuthorizations(userId);

  const response: ApiResponse = {
    success: true,
    data: {
      authorizations,
      count: authorizations.length
    },
    message: 'Authorizations retrieved'
  };

  res.json(response);
}));

/**
 * GET /api/ap2/transactions/:userId
 * Get transaction history
 */
router.get('/transactions/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  const transactions = await ap2PaymentService.getTransactionHistory(userId, limit);

  const response: ApiResponse = {
    success: true,
    data: {
      transactions,
      count: transactions.length
    },
    message: 'Transaction history retrieved'
  };

  res.json(response);
}));

/**
 * POST /api/ap2/refund
 * Refund a transaction
 */
router.post('/refund', asyncHandler(async (req, res) => {
  const schema = Joi.object({
    transactionId: Joi.string().required(),
    reason: Joi.string().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: error.details[0].message
    });
  }

  const result = await ap2PaymentService.refundTransaction(
    value.transactionId,
    value.reason
  );

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: 'Refund failed',
      message: result.error
    });
  }

  const response: ApiResponse = {
    success: true,
    message: 'Transaction refunded'
  };

  res.json(response);
}));

/**
 * GET /api/ap2/stats/:userId
 * Get payment statistics
 */
router.get('/stats/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const stats = await ap2PaymentService.getPaymentStats(userId);

  const response: ApiResponse = {
    success: true,
    data: stats,
    message: 'Payment statistics retrieved'
  };

  res.json(response);
}));

export default router;
