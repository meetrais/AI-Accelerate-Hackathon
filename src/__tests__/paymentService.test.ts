import { PaymentService } from '../services/paymentService';

// Mock Stripe
const mockStripe = {
  accounts: {
    retrieve: jest.fn()
  },
  paymentIntents: {
    create: jest.fn(),
    confirm: jest.fn(),
    retrieve: jest.fn()
  },
  refunds: {
    create: jest.fn()
  },
  webhooks: {
    constructEvent: jest.fn()
  }
};

// Mock Firestore
const mockFirestore = {
  db: {
    collection: jest.fn(() => ({
      add: jest.fn(),
      where: jest.fn(() => ({
        get: jest.fn()
      })),
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn()
        }))
      }))
    }))
  }
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

jest.mock('../services/firestoreService', () => ({
  firestoreService: mockFirestore
}));

describe('PaymentService', () => {
  let paymentService: PaymentService;

  beforeEach(() => {
    paymentService = new PaymentService();
    jest.clearAllMocks();
  });

  describe('healthCheck', () => {
    it('should return true when Stripe is healthy', async () => {
      mockStripe.accounts.retrieve.mockResolvedValue({ id: 'acct_123' });

      const result = await paymentService.healthCheck();

      expect(result).toBe(true);
      expect(mockStripe.accounts.retrieve).toHaveBeenCalled();
    });

    it('should return false when Stripe is unhealthy', async () => {
      mockStripe.accounts.retrieve.mockRejectedValue(new Error('API Error'));

      const result = await paymentService.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        client_secret: 'pi_123_secret',
        amount: 35000, // $350 in cents
        currency: 'usd',
        status: 'requires_payment_method'
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      const result = await paymentService.createPaymentIntent(
        350,
        'usd',
        'FB123ABC',
        'test@example.com'
      );

      expect(result).toEqual({
        id: 'pi_123',
        clientSecret: 'pi_123_secret',
        amount: 350,
        currency: 'usd',
        status: 'requires_payment_method'
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 35000,
        currency: 'usd',
        metadata: {
          bookingReference: 'FB123ABC',
          type: 'flight_booking'
        },
        receipt_email: 'test@example.com',
        description: 'Flight booking - FB123ABC',
        automatic_payment_methods: {
          enabled: true
        }
      });
    });

    it('should handle payment intent creation errors', async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(new Error('Stripe API Error'));

      await expect(paymentService.createPaymentIntent(350, 'usd', 'FB123ABC'))
        .rejects.toThrow('Failed to create payment intent: Stripe API Error');
    });
  });

  describe('processPayment', () => {
    it('should process card payment successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        client_secret: 'pi_123_secret',
        amount: 35000,
        currency: 'usd',
        status: 'requires_payment_method'
      };

      const mockConfirmedPayment = {
        id: 'pi_123',
        status: 'succeeded',
        amount: 35000,
        currency: 'usd',
        charges: {
          data: [{ receipt_url: 'https://stripe.com/receipt/123' }]
        }
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);
      mockStripe.paymentIntents.confirm.mockResolvedValue(mockConfirmedPayment);
      mockFirestore.db.collection().add.mockResolvedValue({ id: 'record_123' });

      const paymentInfo = {
        method: 'card' as const,
        cardToken: 'tok_visa_1234'
      };

      const result = await paymentService.processPayment(
        paymentInfo,
        350,
        'FB123ABC',
        'test@example.com'
      );

      expect(result.success).toBe(true);
      expect(result.paymentId).toBe('pi_123');
      expect(result.status).toBe('succeeded');
      expect(result.amount).toBe(350);
      expect(result.receiptUrl).toBe('https://stripe.com/receipt/123');
    });

    it('should process PayPal payment successfully', async () => {
      const paymentInfo = {
        method: 'paypal' as const,
        paypalId: 'paypal_account_123'
      };

      mockFirestore.db.collection().add.mockResolvedValue({ id: 'record_123' });

      const result = await paymentService.processPayment(
        paymentInfo,
        350,
        'FB123ABC'
      );

      expect(result.success).toBe(true);
      expect(result.paymentId).toMatch(/^pp_/);
      expect(result.status).toBe('succeeded');
      expect(result.amount).toBe(350);
    });

    it('should handle unsupported payment methods', async () => {
      const paymentInfo = {
        method: 'bitcoin' as any,
        cardToken: 'invalid'
      };

      const result = await paymentService.processPayment(
        paymentInfo,
        350,
        'FB123ABC'
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Unsupported payment method');
    });

    it('should handle payment processing errors', async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(new Error('Payment failed'));

      const paymentInfo = {
        method: 'card' as const,
        cardToken: 'tok_visa_1234'
      };

      const result = await paymentService.processPayment(
        paymentInfo,
        350,
        'FB123ABC'
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Payment failed');
    });
  });

  describe('refundPayment', () => {
    it('should process refund successfully', async () => {
      const mockRefund = {
        id: 're_123',
        status: 'succeeded',
        amount: 35000
      };

      mockStripe.refunds.create.mockResolvedValue(mockRefund);
      mockFirestore.db.collection().add.mockResolvedValue({ id: 'record_123' });

      const result = await paymentService.refundPayment('pi_123', 350, 'Customer request');

      expect(result.success).toBe(true);
      expect(result.refundId).toBe('re_123');
      expect(result.amount).toBe(350);
      expect(result.status).toBe('succeeded');

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_123',
        amount: 35000,
        reason: 'Customer request'
      });
    });

    it('should handle refund errors', async () => {
      mockStripe.refunds.create.mockRejectedValue(new Error('Refund failed'));

      const result = await paymentService.refundPayment('pi_123', 350);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Refund failed');
    });
  });

  describe('getPaymentStatus', () => {
    it('should retrieve payment status successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        status: 'succeeded',
        amount: 35000,
        currency: 'usd',
        created: 1640995200 // Unix timestamp
      };

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      const result = await paymentService.getPaymentStatus('pi_123');

      expect(result).toEqual({
        status: 'succeeded',
        amount: 350,
        currency: 'usd',
        created: new Date(1640995200 * 1000)
      });
    });

    it('should return null for non-existent payment', async () => {
      mockStripe.paymentIntents.retrieve.mockRejectedValue(new Error('Not found'));

      const result = await paymentService.getPaymentStatus('pi_nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('validatePaymentMethod', () => {
    it('should validate card payment method', async () => {
      const paymentInfo = {
        method: 'card' as const,
        cardToken: 'tok_visa_1234'
      };

      const result = await paymentService.validatePaymentMethod(paymentInfo);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate PayPal payment method', async () => {
      const paymentInfo = {
        method: 'paypal' as const,
        paypalId: 'paypal_account_123456'
      };

      const result = await paymentService.validatePaymentMethod(paymentInfo);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid card token', async () => {
      const paymentInfo = {
        method: 'card' as const,
        cardToken: 'invalid_token'
      };

      const result = await paymentService.validatePaymentMethod(paymentInfo);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid card token format');
    });

    it('should reject missing card token', async () => {
      const paymentInfo = {
        method: 'card' as const
      };

      const result = await paymentService.validatePaymentMethod(paymentInfo);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Card token is required');
    });

    it('should reject short PayPal ID', async () => {
      const paymentInfo = {
        method: 'paypal' as const,
        paypalId: 'short'
      };

      const result = await paymentService.validatePaymentMethod(paymentInfo);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid PayPal ID format');
    });

    it('should reject unsupported payment method', async () => {
      const paymentInfo = {
        method: 'bitcoin' as any
      };

      const result = await paymentService.validatePaymentMethod(paymentInfo);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unsupported payment method: bitcoin');
    });
  });

  describe('handleWebhook', () => {
    it('should handle payment succeeded webhook', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            metadata: {
              bookingReference: 'FB123ABC'
            }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Mock firestoreService methods
      const mockGetBookingByReference = jest.fn().mockResolvedValue({
        id: 'booking_123',
        bookingReference: 'FB123ABC'
      });
      const mockUpdateBookingStatus = jest.fn().mockResolvedValue(undefined);

      // Mock the import
      jest.doMock('../services/firestoreService', () => ({
        firestoreService: {
          getBookingByReference: mockGetBookingByReference,
          updateBookingStatus: mockUpdateBookingStatus
        }
      }));

      const result = await paymentService.handleWebhook('payload', 'signature');

      expect(result.processed).toBe(true);
      expect(result.eventType).toBe('payment_intent.succeeded');
    });

    it('should handle webhook signature verification failure', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const result = await paymentService.handleWebhook('payload', 'invalid_signature');

      expect(result.processed).toBe(false);
      expect(result.eventType).toBe('unknown');
    });
  });

  describe('getPaymentStatistics', () => {
    it('should return payment statistics', async () => {
      const mockPaymentRecords = {
        docs: [
          { data: () => ({ success: true, amount: 350, type: 'payment' }) },
          { data: () => ({ success: true, amount: 500, type: 'payment' }) },
          { data: () => ({ success: false, amount: 200, type: 'payment' }) }
        ]
      };

      const mockRefundRecords = {
        size: 1
      };

      mockFirestore.db.collection().where().get.mockResolvedValueOnce(mockPaymentRecords);
      mockFirestore.db.collection().where().where().get.mockResolvedValueOnce(mockRefundRecords);

      const result = await paymentService.getPaymentStatistics();

      expect(result.totalPayments).toBe(3);
      expect(result.successfulPayments).toBe(2);
      expect(result.failedPayments).toBe(1);
      expect(result.totalRevenue).toBe(850);
      expect(result.averageTransactionAmount).toBe(425);
      expect(result.refundRate).toBe(50); // 1 refund out of 2 successful payments
    });
  });
});