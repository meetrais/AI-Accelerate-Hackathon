import express from 'express';
import Joi from 'joi';
import { paymentService } from '../services/paymentService';
import { ApiResponse } from '../types';

const router = express.Router();

/**
 * POST /api/payment/create-intent
 * Create a payment intent for booking
 */
router.post('/create-intent', async (req, res) => {
  try {
    const schema = Joi.object({
      amount: Joi.number().positive().required(),
      currency: Joi.string().length(3).default('usd'),
      bookingReference: Joi.string().required(),
      customerEmail: Joi.string().email().optional()
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

    const paymentIntent = await paymentService.createPaymentIntent(
      value.amount,
      value.currency,
      value.bookingReference,
      value.customerEmail
    );

    const response: ApiResponse = {
      success: true,
      data: paymentIntent,
      message: 'Payment intent created successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Payment intent creation error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Payment intent creation failed',
      message: error instanceof Error ? error.message : 'Unable to create payment intent'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/payment/validate-method
 * Validate payment method
 */
router.post('/validate-method', async (req, res) => {
  try {
    const schema = Joi.object({
      method: Joi.string().valid('card', 'paypal').required(),
      cardToken: Joi.string().when('method', { is: 'card', then: Joi.required() }),
      paypalId: Joi.string().when('method', { is: 'paypal', then: Joi.required() })
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

    const validation = await paymentService.validatePaymentMethod(value);

    const response: ApiResponse = {
      success: validation.valid,
      data: validation,
      message: validation.valid ? 'Payment method is valid' : 'Payment method validation failed'
    };

    res.json(response);
  } catch (error) {
    console.error('Payment method validation error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Validation failed',
      message: 'Unable to validate payment method'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/payment/status/:paymentId
 * Get payment status
 */
router.get('/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid payment ID',
        message: 'Payment ID is required'
      };
      return res.status(400).json(response);
    }

    const paymentStatus = await paymentService.getPaymentStatus(paymentId);

    if (!paymentStatus) {
      const response: ApiResponse = {
        success: false,
        error: 'Payment not found',
        message: 'No payment found with the provided ID'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: paymentStatus,
      message: 'Payment status retrieved successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Payment status retrieval error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Status retrieval failed',
      message: 'Unable to retrieve payment status'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/payment/refund
 * Process refund
 */
router.post('/refund', async (req, res) => {
  try {
    const schema = Joi.object({
      paymentId: Joi.string().required(),
      amount: Joi.number().positive().optional(),
      reason: Joi.string().max(500).optional()
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

    const refundResult = await paymentService.refundPayment(
      value.paymentId,
      value.amount,
      value.reason
    );

    const response: ApiResponse = {
      success: refundResult.success,
      data: refundResult,
      message: refundResult.success ? 'Refund processed successfully' : 'Refund processing failed'
    };

    res.json(response);
  } catch (error) {
    console.error('Refund processing error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Refund failed',
      message: error instanceof Error ? error.message : 'Unable to process refund'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/payment/webhook
 * Handle Stripe webhooks
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    
    if (!signature) {
      return res.status(400).send('Missing Stripe signature');
    }

    const result = await paymentService.handleWebhook(
      req.body.toString(),
      signature
    );

    if (result.processed) {
      res.json({ received: true, eventType: result.eventType });
    } else {
      res.status(400).json({ received: false, error: 'Webhook processing failed' });
    }

  } catch (error) {
    console.error('Webhook handling error:', error);
    res.status(400).json({ received: false, error: 'Invalid webhook' });
  }
});

/**
 * GET /api/payment/stats
 * Get payment statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await paymentService.getPaymentStatistics();

    const response: ApiResponse = {
      success: true,
      data: stats,
      message: 'Payment statistics retrieved successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Payment statistics error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Statistics failed',
      message: 'Unable to retrieve payment statistics'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/payment/health
 * Check payment service health
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await paymentService.healthCheck();

    const response: ApiResponse = {
      success: isHealthy,
      data: { healthy: isHealthy },
      message: isHealthy ? 'Payment service is healthy' : 'Payment service is unhealthy'
    };

    res.status(isHealthy ? 200 : 503).json(response);
  } catch (error) {
    console.error('Payment health check error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Health check failed',
      message: 'Unable to check payment service health'
    };

    res.status(503).json(response);
  }
});

export default router;