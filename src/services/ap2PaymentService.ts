/**
 * Agent Payment Protocol (AP2) Implementation
 * 
 * AP2 enables AI agents to make payments on behalf of users with:
 * - User consent and authorization
 * - Payment limits and controls
 * - Transaction transparency
 * - Audit trails
 */

import { Firestore } from '@google-cloud/firestore';
import { config } from '../config';
import Stripe from 'stripe';

// AP2 Protocol Types
export interface AP2PaymentRequest {
  agentId: string;
  userId: string;
  amount: number;
  currency: string;
  description: string;
  metadata: {
    bookingReference?: string;
    flightId?: string;
    passengers?: number;
    route?: string;
  };
  userConsent: {
    consentId: string;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface AP2PaymentAuthorization {
  authorizationId: string;
  userId: string;
  agentId: string;
  maxAmount: number;
  currency: string;
  expiresAt: Date;
  scope: string[]; // e.g., ['flight-booking', 'hotel-booking']
  status: 'active' | 'revoked' | 'expired';
  createdAt: Date;
}

export interface AP2Transaction {
  transactionId: string;
  authorizationId: string;
  agentId: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  description: string;
  metadata: any;
  createdAt: Date;
  completedAt?: Date;
  auditTrail: AP2AuditEntry[];
}

export interface AP2AuditEntry {
  timestamp: Date;
  action: string;
  actor: 'agent' | 'user' | 'system';
  details: string;
  ipAddress?: string;
}

export class AP2PaymentService {
  private firestore: Firestore;
  private stripe: Stripe;

  constructor() {
    this.firestore = new Firestore({
      projectId: config.googleCloud.projectId
    });
    
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2023-10-16'
    });
  }

  /**
   * Create a payment authorization for an AI agent
   */
  async createAuthorization(
    userId: string,
    agentId: string,
    maxAmount: number,
    currency: string = 'USD',
    scope: string[] = ['flight-booking'],
    durationHours: number = 24
  ): Promise<AP2PaymentAuthorization> {
    const authorizationId = `ap2_auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    const authorization: AP2PaymentAuthorization = {
      authorizationId,
      userId,
      agentId,
      maxAmount,
      currency,
      expiresAt,
      scope,
      status: 'active',
      createdAt: new Date()
    };

    await this.firestore
      .collection('ap2_authorizations')
      .doc(authorizationId)
      .set(authorization);

    console.log(`✅ Created AP2 authorization: ${authorizationId} for user ${userId}`);
    return authorization;
  }

  /**
   * Verify if an agent has authorization to make a payment
   */
  async verifyAuthorization(
    authorizationId: string,
    amount: number,
    scope: string
  ): Promise<{ authorized: boolean; reason?: string; authorization?: AP2PaymentAuthorization }> {
    const doc = await this.firestore
      .collection('ap2_authorizations')
      .doc(authorizationId)
      .get();

    if (!doc.exists) {
      return { authorized: false, reason: 'Authorization not found' };
    }

    const auth = doc.data() as AP2PaymentAuthorization;

    // Check status
    if (auth.status !== 'active') {
      return { authorized: false, reason: `Authorization is ${auth.status}` };
    }

    // Check expiration
    if (new Date() > auth.expiresAt) {
      await this.revokeAuthorization(authorizationId, 'expired');
      return { authorized: false, reason: 'Authorization expired' };
    }

    // Check amount limit
    if (amount > auth.maxAmount) {
      return { 
        authorized: false, 
        reason: `Amount ${amount} exceeds limit ${auth.maxAmount}` 
      };
    }

    // Check scope
    if (!auth.scope.includes(scope)) {
      return { 
        authorized: false, 
        reason: `Scope '${scope}' not authorized. Allowed: ${auth.scope.join(', ')}` 
      };
    }

    return { authorized: true, authorization: auth };
  }

  /**
   * Process a payment through AP2 protocol
   */
  async processPayment(
    paymentRequest: AP2PaymentRequest,
    authorizationId: string
  ): Promise<{ success: boolean; transaction?: AP2Transaction; error?: string }> {
    try {
      // 1. Verify authorization
      const verification = await this.verifyAuthorization(
        authorizationId,
        paymentRequest.amount,
        'flight-booking'
      );

      if (!verification.authorized) {
        return { success: false, error: verification.reason };
      }

      // 2. Create transaction record
      const transactionId = `ap2_txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const transaction: AP2Transaction = {
        transactionId,
        authorizationId,
        agentId: paymentRequest.agentId,
        userId: paymentRequest.userId,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        status: 'pending',
        description: paymentRequest.description,
        metadata: paymentRequest.metadata,
        createdAt: new Date(),
        auditTrail: [
          {
            timestamp: new Date(),
            action: 'payment_initiated',
            actor: 'agent',
            details: `Agent ${paymentRequest.agentId} initiated payment`,
            ipAddress: paymentRequest.userConsent.ipAddress
          }
        ]
      };

      // 3. Save transaction
      await this.firestore
        .collection('ap2_transactions')
        .doc(transactionId)
        .set(transaction);

      // 4. Process payment with Stripe (or mock in demo mode)
      if (config.mockMode.payments) {
        // Mock payment for demo
        transaction.status = 'completed';
        transaction.completedAt = new Date();
        transaction.auditTrail.push({
          timestamp: new Date(),
          action: 'payment_completed',
          actor: 'system',
          details: 'Mock payment completed successfully'
        });
      } else {
        // Real Stripe payment
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(paymentRequest.amount * 100), // Convert to cents
          currency: paymentRequest.currency.toLowerCase(),
          description: paymentRequest.description,
          metadata: {
            transactionId,
            authorizationId,
            agentId: paymentRequest.agentId,
            userId: paymentRequest.userId,
            ...paymentRequest.metadata
          }
        });

        transaction.status = 'completed';
        transaction.completedAt = new Date();
        transaction.auditTrail.push({
          timestamp: new Date(),
          action: 'payment_completed',
          actor: 'system',
          details: `Stripe payment intent: ${paymentIntent.id}`
        });
      }

      // 5. Update transaction
      await this.firestore
        .collection('ap2_transactions')
        .doc(transactionId)
        .update({
          status: transaction.status,
          completedAt: transaction.completedAt,
          auditTrail: transaction.auditTrail
        });

      console.log(`✅ AP2 payment completed: ${transactionId}`);
      return { success: true, transaction };

    } catch (error: any) {
      console.error('❌ AP2 payment failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Revoke an authorization
   */
  async revokeAuthorization(
    authorizationId: string,
    reason: string = 'user_revoked'
  ): Promise<void> {
    await this.firestore
      .collection('ap2_authorizations')
      .doc(authorizationId)
      .update({
        status: reason === 'expired' ? 'expired' : 'revoked',
        revokedAt: new Date(),
        revokeReason: reason
      });

    console.log(`✅ Revoked AP2 authorization: ${authorizationId} (${reason})`);
  }

  /**
   * Get user's active authorizations
   */
  async getUserAuthorizations(userId: string): Promise<AP2PaymentAuthorization[]> {
    const snapshot = await this.firestore
      .collection('ap2_authorizations')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    return snapshot.docs.map(doc => doc.data() as AP2PaymentAuthorization);
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    userId: string,
    limit: number = 50
  ): Promise<AP2Transaction[]> {
    const snapshot = await this.firestore
      .collection('ap2_transactions')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data() as AP2Transaction);
  }

  /**
   * Refund a transaction
   */
  async refundTransaction(
    transactionId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const doc = await this.firestore
        .collection('ap2_transactions')
        .doc(transactionId)
        .get();

      if (!doc.exists) {
        return { success: false, error: 'Transaction not found' };
      }

      const transaction = doc.data() as AP2Transaction;

      if (transaction.status !== 'completed') {
        return { success: false, error: 'Can only refund completed transactions' };
      }

      // Update transaction status
      transaction.status = 'refunded';
      transaction.auditTrail.push({
        timestamp: new Date(),
        action: 'payment_refunded',
        actor: 'system',
        details: `Refund reason: ${reason}`
      });

      await this.firestore
        .collection('ap2_transactions')
        .doc(transactionId)
        .update({
          status: 'refunded',
          refundedAt: new Date(),
          refundReason: reason,
          auditTrail: transaction.auditTrail
        });

      console.log(`✅ Refunded AP2 transaction: ${transactionId}`);
      return { success: true };

    } catch (error: any) {
      console.error('❌ Refund failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get payment statistics for a user
   */
  async getPaymentStats(userId: string): Promise<{
    totalTransactions: number;
    totalAmount: number;
    activeAuthorizations: number;
    lastTransaction?: Date;
  }> {
    const [transactions, authorizations] = await Promise.all([
      this.getTransactionHistory(userId, 1000),
      this.getUserAuthorizations(userId)
    ]);

    const completedTransactions = transactions.filter(t => t.status === 'completed');
    const totalAmount = completedTransactions.reduce((sum, t) => sum + t.amount, 0);

    return {
      totalTransactions: completedTransactions.length,
      totalAmount,
      activeAuthorizations: authorizations.length,
      lastTransaction: completedTransactions[0]?.createdAt
    };
  }
}

export const ap2PaymentService = new AP2PaymentService();
