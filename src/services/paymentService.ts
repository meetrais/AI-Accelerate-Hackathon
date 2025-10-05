import Stripe from 'stripe';
import { config } from '../config';
import { firestoreService } from './firestoreService';
import { BookingRequest, PaymentInfo } from '../types';

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  status: 'succeeded' | 'failed' | 'pending' | 'cancelled';
  amount: number;
  currency: string;
  errorMessage?: string;
  receiptUrl?: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
  status: 'succeeded' | 'failed' | 'pending';
  errorMessage?: string;
}

export class PaymentService {
  private stripe: Stripe | null = null;
  private mockMode: boolean;

  constructor() {
    // Enable mock mode if Stripe key is not provided or explicitly set
    this.mockMode = !config.stripe.secretKey || config.stripe.secretKey === 'mock';

    if (!this.mockMode) {
      this.stripe = new Stripe(config.stripe.secretKey, {
        apiVersion: '2023-10-16'
      });
    } else {
      console.log('🎭 Payment service running in MOCK mode');
    }
  }

  /**
   * Check if payment service is healthy
   */
  async healthCheck(): Promise<boolean> {
    if (this.mockMode) {
      console.log('🎭 Mock payment service is healthy');
      return true;
    }

    try {
      // Test Stripe connection by retrieving account info
      await this.stripe!.accounts.retrieve();
      return true;
    } catch (error) {
      console.error('Payment service health check failed:', error);
      return false;
    }
  }

  /**
   * Create payment intent for booking
   */
  async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    bookingReference: string,
    customerEmail?: string
  ): Promise<PaymentIntent> {
    if (this.mockMode) {
      // Mock payment intent
      const mockId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log(`🎭 Mock payment intent created: ${mockId} for ${amount} ${currency}`);
      
      return {
        id: mockId,
        clientSecret: `${mockId}_secret_mock`,
        amount,
        currency: currency.toLowerCase(),
        status: 'requires_payment_method'
      };
    }

    try {
      const paymentIntent = await this.stripe!.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        metadata: {
          bookingReference,
          type: 'flight_booking'
        },
        receipt_email: customerEmail,
        description: `Flight booking - ${bookingReference}`,
        automatic_payment_methods: {
          enabled: true
        }
      });

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount / 100, // Convert back to dollars
        currency: paymentIntent.currency,
        status: paymentIntent.status
      };

    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error(`Failed to create payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process payment for booking
   */
  async processPayment(
    paymentInfo: PaymentInfo,
    amount: number,
    bookingReference: string,
    customerEmail?: string
  ): Promise<PaymentResult> {
    try {
      let paymentResult: PaymentResult;

      switch (paymentInfo.method) {
        case 'card':
          paymentResult = await this.processCardPayment(
            paymentInfo.cardToken!,
            amount,
            bookingReference,
            customerEmail
          );
          break;

        case 'paypal':
          paymentResult = await this.processPayPalPayment(
            paymentInfo.paypalId!,
            amount,
            bookingReference
          );
          break;

        default:
          throw new Error(`Unsupported payment method: ${paymentInfo.method}`);
      }

      // Store payment record
      await this.storePaymentRecord(paymentResult, bookingReference);

      return paymentResult;

    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        paymentId: '',
        status: 'failed',
        amount,
        currency: 'usd',
        errorMessage: error instanceof Error ? error.message : 'Payment processing failed'
      };
    }
  }

  /**
   * Process card payment using Stripe
   */
  private async processCardPayment(
    cardToken: string,
    amount: number,
    bookingReference: string,
    customerEmail?: string
  ): Promise<PaymentResult> {
    if (this.mockMode) {
      // Mock card payment processing
      console.log(`🎭 Processing mock card payment: ${amount} for ${bookingReference}`);
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate 95% success rate
      const success = Math.random() > 0.05;
      const paymentId = `pay_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      return {
        success,
        paymentId,
        status: success ? 'succeeded' : 'failed',
        amount,
        currency: 'usd',
        receiptUrl: success ? `https://mock-receipts.com/${paymentId}` : undefined,
        errorMessage: success ? undefined : 'Mock payment declined'
      };
    }

    try {
      // Create payment intent
      const paymentIntent = await this.createPaymentIntent(
        amount,
        'usd',
        bookingReference,
        customerEmail
      );

      // Confirm payment intent with the card token
      const confirmedPayment = await this.stripe!.paymentIntents.confirm(
        paymentIntent.id,
        {
          payment_method: cardToken,
          return_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/booking/confirmation`
        }
      );

      const success = confirmedPayment.status === 'succeeded';

      return {
        success,
        paymentId: confirmedPayment.id,
        status: confirmedPayment.status as any,
        amount: confirmedPayment.amount / 100,
        currency: confirmedPayment.currency,
        receiptUrl: undefined, // Receipt URL would need to be fetched separately from charges
        errorMessage: success ? undefined : 'Payment was not successful'
      };

    } catch (error) {
      console.error('Card payment error:', error);
      throw error;
    }
  }

  /**
   * Process PayPal payment (simplified mock implementation)
   */
  private async processPayPalPayment(
    paypalId: string,
    amount: number,
    bookingReference: string
  ): Promise<PaymentResult> {
    try {
      // In a real implementation, this would integrate with PayPal API
      // For demo purposes, we'll simulate a successful payment
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate 95% success rate
      const success = Math.random() > 0.05;

      if (!success) {
        throw new Error('PayPal payment declined');
      }

      const paymentId = `pp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      return {
        success: true,
        paymentId,
        status: 'succeeded',
        amount,
        currency: 'usd',
        receiptUrl: `https://paypal.com/receipt/${paymentId}`
      };

    } catch (error) {
      console.error('PayPal payment error:', error);
      throw error;
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<RefundResult> {
    try {
      const refundData: any = {
        payment_intent: paymentId,
        reason: reason || 'requested_by_customer'
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to cents
      }

      const refund = await this.stripe.refunds.create(refundData);

      const result: RefundResult = {
        success: refund.status === 'succeeded',
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status as any
      };

      // Store refund record
      await this.storeRefundRecord(result, paymentId);

      return result;

    } catch (error) {
      console.error('Refund error:', error);
      return {
        success: false,
        refundId: '',
        amount: amount || 0,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Refund failed'
      };
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<{
    status: string;
    amount: number;
    currency: string;
    created: Date;
  } | null> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);

      return {
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        created: new Date(paymentIntent.created * 1000)
      };

    } catch (error) {
      console.error('Error retrieving payment status:', error);
      return null;
    }
  }

  /**
   * Handle webhook events from Stripe
   */
  async handleWebhook(
    payload: string,
    signature: string
  ): Promise<{ processed: boolean; eventType: string }> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );

      console.log(`Processing webhook event: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'charge.dispute.created':
          await this.handleChargeDispute(event.data.object as Stripe.Dispute);
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      return {
        processed: true,
        eventType: event.type
      };

    } catch (error) {
      console.error('Webhook processing error:', error);
      return {
        processed: false,
        eventType: 'unknown'
      };
    }
  }

  /**
   * Handle successful payment webhook
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const bookingReference = paymentIntent.metadata.bookingReference;
      
      if (bookingReference) {
        const booking = await firestoreService.getBookingByReference(bookingReference);
        
        if (booking) {
          await firestoreService.updateBookingStatus(
            booking.id,
            'confirmed',
            'paid'
          );

          console.log(`✅ Payment confirmed for booking ${bookingReference}`);
        }
      }
    } catch (error) {
      console.error('Error handling payment success:', error);
    }
  }

  /**
   * Handle failed payment webhook
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const bookingReference = paymentIntent.metadata.bookingReference;
      
      if (bookingReference) {
        const booking = await firestoreService.getBookingByReference(bookingReference);
        
        if (booking) {
          await firestoreService.updateBookingStatus(
            booking.id,
            'cancelled',
            'pending'
          );

          console.log(`❌ Payment failed for booking ${bookingReference}`);
        }
      }
    } catch (error) {
      console.error('Error handling payment failure:', error);
    }
  }

  /**
   * Handle charge dispute webhook
   */
  private async handleChargeDispute(dispute: Stripe.Dispute): Promise<void> {
    try {
      console.log(`⚠️ Charge dispute created: ${dispute.id} for amount ${dispute.amount / 100}`);
      
      // In a real implementation, you would:
      // 1. Notify administrators
      // 2. Gather evidence
      // 3. Respond to the dispute
      // 4. Update booking status if necessary
      
    } catch (error) {
      console.error('Error handling charge dispute:', error);
    }
  }

  /**
   * Store payment record in Firestore
   */
  private async storePaymentRecord(
    paymentResult: PaymentResult,
    bookingReference: string
  ): Promise<void> {
    try {
      const paymentRecord = {
        paymentId: paymentResult.paymentId,
        bookingReference,
        amount: paymentResult.amount,
        currency: paymentResult.currency,
        status: paymentResult.status,
        success: paymentResult.success,
        receiptUrl: paymentResult.receiptUrl,
        errorMessage: paymentResult.errorMessage,
        createdAt: new Date(),
        type: 'payment'
      };

      await firestoreService.savePaymentRecord(paymentRecord);
      
    } catch (error) {
      console.error('Error storing payment record:', error);
      // Don't throw error as payment was successful
    }
  }

  /**
   * Store refund record in Firestore
   */
  private async storeRefundRecord(
    refundResult: RefundResult,
    originalPaymentId: string
  ): Promise<void> {
    try {
      const refundRecord = {
        refundId: refundResult.refundId,
        originalPaymentId,
        amount: refundResult.amount,
        status: refundResult.status,
        success: refundResult.success,
        errorMessage: refundResult.errorMessage,
        createdAt: new Date(),
        type: 'refund'
      };

      await firestoreService.savePaymentRecord(refundRecord);
      
    } catch (error) {
      console.error('Error storing refund record:', error);
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(): Promise<{
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    totalRevenue: number;
    averageTransactionAmount: number;
    refundRate: number;
  }> {
    try {
      const payments = await firestoreService.getPaymentStats();

      let totalPayments = 0;
      let successfulPayments = 0;
      let failedPayments = 0;
      let totalRevenue = 0;

      payments.forEach(payment => {
        totalPayments++;
        
        if (payment.success) {
          successfulPayments++;
          totalRevenue += payment.amount;
        } else {
          failedPayments++;
        }
      });

      // Get refund count
      const refunds = await firestoreService.getRefundRecords();
      const refundCount = refunds.filter(refund => refund.success).length;
      const refundRate = successfulPayments > 0 ? (refundCount / successfulPayments) * 100 : 0;
      const averageTransactionAmount = successfulPayments > 0 ? totalRevenue / successfulPayments : 0;

      return {
        totalPayments,
        successfulPayments,
        failedPayments,
        totalRevenue: Math.round(totalRevenue),
        averageTransactionAmount: Math.round(averageTransactionAmount),
        refundRate: Math.round(refundRate * 100) / 100
      };

    } catch (error) {
      console.error('Error getting payment statistics:', error);
      return {
        totalPayments: 0,
        successfulPayments: 0,
        failedPayments: 0,
        totalRevenue: 0,
        averageTransactionAmount: 0,
        refundRate: 0
      };
    }
  }

  /**
   * Validate payment method
   */
  async validatePaymentMethod(paymentInfo: PaymentInfo): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      switch (paymentInfo.method) {
        case 'card':
          if (!paymentInfo.cardToken) {
            errors.push('Card token is required');
          } else {
            // Validate card token format (basic check)
            if (!paymentInfo.cardToken.startsWith('tok_') && 
                !paymentInfo.cardToken.startsWith('pm_')) {
              errors.push('Invalid card token format');
            }
          }
          break;

        case 'paypal':
          if (!paymentInfo.paypalId) {
            errors.push('PayPal ID is required');
          } else {
            // Basic PayPal ID validation
            if (paymentInfo.paypalId.length < 10) {
              errors.push('Invalid PayPal ID format');
            }
          }
          break;

        default:
          errors.push(`Unsupported payment method: ${paymentInfo.method}`);
      }

      return {
        valid: errors.length === 0,
        errors
      };

    } catch (error) {
      console.error('Payment method validation error:', error);
      return {
        valid: false,
        errors: ['Payment method validation failed']
      };
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();