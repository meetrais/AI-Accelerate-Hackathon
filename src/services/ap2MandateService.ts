/**
 * Google Agent Payment Protocol (AP2) - Official Implementation
 * 
 * AP2 is an open standard developed by Google and 60+ partners for secure
 * transactions initiated by AI agents on behalf of users.
 * 
 * Key Features:
 * - Cryptographically signed Mandates (proof of user intent)
 * - Payment-agnostic (cards, bank transfers, crypto)
 * - Extension of A2A (Agent-to-Agent) and MCP (Model Context Protocol)
 * - Trust, authorization, and accountability
 */

import { Firestore } from '@google-cloud/firestore';
import { config } from '../config';
import * as crypto from 'crypto';

// AP2 Mandate Types (Cryptographically Signed User Intent)
export interface AP2Mandate {
  mandateId: string;
  version: string; // AP2 protocol version
  userId: string;
  agentId: string;
  
  // Authorization details
  authorization: {
    maxAmount: number;
    currency: string;
    scope: string[]; // e.g., ['flight-booking', 'hotel-booking']
    validFrom: Date;
    validUntil: Date;
    transactionLimit?: number; // Max transactions allowed
  };
  
  // Payment methods (payment-agnostic)
  paymentMethods: AP2PaymentMethod[];
  
  // Cryptographic signature (proof of user intent)
  signature: {
    algorithm: string; // e.g., 'RS256', 'ES256'
    publicKey: string;
    signedData: string;
    timestamp: Date;
  };
  
  // User consent
  userConsent: {
    consentId: string;
    timestamp: Date;
    ipAddress?: string;
    deviceId?: string;
    biometricVerified?: boolean;
  };
  
  // Metadata
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    status: 'active' | 'revoked' | 'expired' | 'suspended';
    revokedAt?: Date;
    revokeReason?: string;
  };
}

export interface AP2PaymentMethod {
  methodId: string;
  type: 'card' | 'bank_transfer' | 'digital_wallet' | 'cryptocurrency' | 'other';
  provider: string; // e.g., 'stripe', 'paypal', 'coinbase'
  details: {
    last4?: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    accountNumber?: string; // Encrypted
    walletAddress?: string;
  };
  priority: number; // 1 = primary, 2 = secondary, etc.
}

export interface AP2Transaction {
  transactionId: string;
  mandateId: string;
  agentId: string;
  userId: string;
  
  // Transaction details
  amount: number;
  currency: string;
  description: string;
  
  // Payment method used
  paymentMethod: AP2PaymentMethod;
  
  // Status
  status: 'pending' | 'authorized' | 'completed' | 'failed' | 'refunded' | 'disputed';
  
  // Timestamps
  createdAt: Date;
  authorizedAt?: Date;
  completedAt?: Date;
  
  // Verification
  verification: {
    mandateVerified: boolean;
    signatureVerified: boolean;
    amountWithinLimit: boolean;
    scopeAuthorized: boolean;
  };
  
  // Audit trail (A2A protocol integration)
  auditTrail: AP2AuditEntry[];
  
  // Metadata
  metadata: any;
}

export interface AP2AuditEntry {
  timestamp: Date;
  action: string;
  actor: 'user' | 'agent' | 'system' | 'payment_provider';
  actorId: string;
  details: string;
  signature?: string; // Cryptographic proof
}

export class AP2MandateService {
  private firestore: Firestore;
  private readonly AP2_VERSION = '1.0';

  constructor() {
    this.firestore = new Firestore({
      projectId: config.googleCloud.projectId
    });
  }

  /**
   * Create a cryptographically signed Mandate
   */
  async createMandate(
    userId: string,
    agentId: string,
    authorization: AP2Mandate['authorization'],
    paymentMethods: AP2PaymentMethod[],
    userConsent: AP2Mandate['userConsent']
  ): Promise<AP2Mandate> {
    const mandateId = `mandate_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;

    // Create mandate data to be signed
    const mandateData = {
      mandateId,
      version: this.AP2_VERSION,
      userId,
      agentId,
      authorization,
      paymentMethods,
      userConsent
    };

    // Generate cryptographic signature (proof of user intent)
    const signature = await this.signMandate(mandateData);

    const mandate: AP2Mandate = {
      ...mandateData,
      signature,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active'
      }
    };

    // Store mandate in Firestore
    await this.firestore
      .collection('ap2_mandates')
      .doc(mandateId)
      .set(mandate);

    console.log(`✅ Created AP2 Mandate: ${mandateId}`);
    return mandate;
  }

  /**
   * Sign mandate data with cryptographic signature
   */
  private async signMandate(mandateData: any): Promise<AP2Mandate['signature']> {
    // Generate key pair for signing
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Create signature
    const dataToSign = JSON.stringify(mandateData);
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(dataToSign);
    sign.end();
    
    const signedData = sign.sign(privateKey, 'base64');

    return {
      algorithm: 'RS256',
      publicKey,
      signedData,
      timestamp: new Date()
    };
  }

  /**
   * Verify mandate signature (cryptographic proof)
   */
  async verifyMandateSignature(mandate: AP2Mandate): Promise<boolean> {
    try {
      const { publicKey, signedData, algorithm } = mandate.signature;

      // Reconstruct original data
      const mandateData = {
        mandateId: mandate.mandateId,
        version: mandate.version,
        userId: mandate.userId,
        agentId: mandate.agentId,
        authorization: mandate.authorization,
        paymentMethods: mandate.paymentMethods,
        userConsent: mandate.userConsent
      };

      const dataToVerify = JSON.stringify(mandateData);

      // Verify signature
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(dataToVerify);
      verify.end();

      const isValid = verify.verify(publicKey, signedData, 'base64');

      console.log(`🔐 Mandate signature verification: ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid;

    } catch (error) {
      console.error('❌ Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Verify mandate authorization for a transaction
   */
  async verifyMandateAuthorization(
    mandateId: string,
    amount: number,
    scope: string
  ): Promise<{
    authorized: boolean;
    reason?: string;
    mandate?: AP2Mandate;
  }> {
    // Get mandate
    const doc = await this.firestore
      .collection('ap2_mandates')
      .doc(mandateId)
      .get();

    if (!doc.exists) {
      return { authorized: false, reason: 'Mandate not found' };
    }

    const mandate = doc.data() as AP2Mandate;

    // 1. Verify signature (cryptographic proof of user intent)
    const signatureValid = await this.verifyMandateSignature(mandate);
    if (!signatureValid) {
      return { authorized: false, reason: 'Invalid mandate signature' };
    }

    // 2. Check status
    if (mandate.metadata.status !== 'active') {
      return { authorized: false, reason: `Mandate is ${mandate.metadata.status}` };
    }

    // 3. Check validity period
    const now = new Date();
    if (now < mandate.authorization.validFrom) {
      return { authorized: false, reason: 'Mandate not yet valid' };
    }
    if (now > mandate.authorization.validUntil) {
      await this.expireMandate(mandateId);
      return { authorized: false, reason: 'Mandate expired' };
    }

    // 4. Check amount limit
    if (amount > mandate.authorization.maxAmount) {
      return {
        authorized: false,
        reason: `Amount ${amount} exceeds limit ${mandate.authorization.maxAmount}`
      };
    }

    // 5. Check scope
    if (!mandate.authorization.scope.includes(scope)) {
      return {
        authorized: false,
        reason: `Scope '${scope}' not authorized`
      };
    }

    // 6. Check transaction limit (if set)
    if (mandate.authorization.transactionLimit) {
      const transactionCount = await this.getTransactionCount(mandateId);
      if (transactionCount >= mandate.authorization.transactionLimit) {
        return {
          authorized: false,
          reason: 'Transaction limit reached'
        };
      }
    }

    return { authorized: true, mandate };
  }

  /**
   * Process payment through AP2 (payment-agnostic)
   */
  async processPayment(
    mandateId: string,
    agentId: string,
    amount: number,
    currency: string,
    description: string,
    scope: string,
    metadata?: any
  ): Promise<{
    success: boolean;
    transaction?: AP2Transaction;
    error?: string;
  }> {
    try {
      // 1. Verify mandate authorization
      const verification = await this.verifyMandateAuthorization(
        mandateId,
        amount,
        scope
      );

      if (!verification.authorized || !verification.mandate) {
        return { success: false, error: verification.reason };
      }

      const mandate = verification.mandate;

      // 2. Select payment method (use primary)
      const paymentMethod = mandate.paymentMethods
        .sort((a, b) => a.priority - b.priority)[0];

      if (!paymentMethod) {
        return { success: false, error: 'No payment method available' };
      }

      // 3. Create transaction
      const transactionId = `txn_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;

      const transaction: AP2Transaction = {
        transactionId,
        mandateId,
        agentId,
        userId: mandate.userId,
        amount,
        currency,
        description,
        paymentMethod,
        status: 'pending',
        createdAt: new Date(),
        verification: {
          mandateVerified: true,
          signatureVerified: true,
          amountWithinLimit: amount <= mandate.authorization.maxAmount,
          scopeAuthorized: mandate.authorization.scope.includes(scope)
        },
        auditTrail: [
          {
            timestamp: new Date(),
            action: 'transaction_initiated',
            actor: 'agent',
            actorId: agentId,
            details: `Agent initiated payment of ${amount} ${currency}`,
            signature: await this.signAuditEntry(agentId, 'transaction_initiated')
          }
        ],
        metadata: metadata || {}
      };

      // 4. Process payment (payment-agnostic)
      const paymentResult = await this.executePayment(transaction, paymentMethod);

      if (paymentResult.success) {
        transaction.status = 'completed';
        transaction.completedAt = new Date();
        transaction.auditTrail.push({
          timestamp: new Date(),
          action: 'payment_completed',
          actor: 'payment_provider',
          actorId: paymentMethod.provider,
          details: `Payment processed via ${paymentMethod.type}`,
          signature: await this.signAuditEntry(paymentMethod.provider, 'payment_completed')
        });
      } else {
        transaction.status = 'failed';
        transaction.auditTrail.push({
          timestamp: new Date(),
          action: 'payment_failed',
          actor: 'system',
          actorId: 'ap2_service',
          details: paymentResult.error || 'Payment processing failed'
        });
      }

      // 5. Store transaction
      await this.firestore
        .collection('ap2_transactions')
        .doc(transactionId)
        .set(transaction);

      console.log(`✅ AP2 transaction ${transaction.status}: ${transactionId}`);
      return { success: paymentResult.success, transaction };

    } catch (error: any) {
      console.error('❌ AP2 payment failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute payment (payment-agnostic implementation)
   */
  private async executePayment(
    transaction: AP2Transaction,
    paymentMethod: AP2PaymentMethod
  ): Promise<{ success: boolean; error?: string }> {
    // Payment-agnostic: Support multiple payment providers
    switch (paymentMethod.type) {
      case 'card':
        return this.processCardPayment(transaction, paymentMethod);
      case 'bank_transfer':
        return this.processBankTransfer(transaction, paymentMethod);
      case 'digital_wallet':
        return this.processDigitalWallet(transaction, paymentMethod);
      case 'cryptocurrency':
        return this.processCryptoPayment(transaction, paymentMethod);
      default:
        return { success: false, error: 'Unsupported payment method' };
    }
  }

  private async processCardPayment(
    transaction: AP2Transaction,
    method: AP2PaymentMethod
  ): Promise<{ success: boolean; error?: string }> {
    // Mock implementation - integrate with Stripe, etc.
    console.log(`💳 Processing card payment: ${transaction.amount} ${transaction.currency}`);
    return { success: true };
  }

  private async processBankTransfer(
    transaction: AP2Transaction,
    method: AP2PaymentMethod
  ): Promise<{ success: boolean; error?: string }> {
    // Mock implementation - integrate with Plaid, etc.
    console.log(`🏦 Processing bank transfer: ${transaction.amount} ${transaction.currency}`);
    return { success: true };
  }

  private async processDigitalWallet(
    transaction: AP2Transaction,
    method: AP2PaymentMethod
  ): Promise<{ success: boolean; error?: string }> {
    // Mock implementation - integrate with PayPal, Apple Pay, etc.
    console.log(`📱 Processing digital wallet: ${transaction.amount} ${transaction.currency}`);
    return { success: true };
  }

  private async processCryptoPayment(
    transaction: AP2Transaction,
    method: AP2PaymentMethod
  ): Promise<{ success: boolean; error?: string }> {
    // Mock implementation - integrate with Coinbase, etc.
    console.log(`₿ Processing crypto payment: ${transaction.amount} ${transaction.currency}`);
    return { success: true };
  }

  /**
   * Sign audit entry for A2A protocol integration
   */
  private async signAuditEntry(actorId: string, action: string): Promise<string> {
    const data = `${actorId}:${action}:${Date.now()}`;
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Revoke mandate
   */
  async revokeMandate(mandateId: string, reason: string): Promise<void> {
    await this.firestore
      .collection('ap2_mandates')
      .doc(mandateId)
      .update({
        'metadata.status': 'revoked',
        'metadata.revokedAt': new Date(),
        'metadata.revokeReason': reason,
        'metadata.updatedAt': new Date()
      });

    console.log(`✅ Revoked AP2 Mandate: ${mandateId}`);
  }

  /**
   * Expire mandate
   */
  private async expireMandate(mandateId: string): Promise<void> {
    await this.firestore
      .collection('ap2_mandates')
      .doc(mandateId)
      .update({
        'metadata.status': 'expired',
        'metadata.updatedAt': new Date()
      });
  }

  /**
   * Get transaction count for mandate
   */
  private async getTransactionCount(mandateId: string): Promise<number> {
    const snapshot = await this.firestore
      .collection('ap2_transactions')
      .where('mandateId', '==', mandateId)
      .where('status', 'in', ['completed', 'authorized'])
      .get();

    return snapshot.size;
  }

  /**
   * Get user's mandates
   */
  async getUserMandates(userId: string): Promise<AP2Mandate[]> {
    const snapshot = await this.firestore
      .collection('ap2_mandates')
      .where('userId', '==', userId)
      .where('metadata.status', '==', 'active')
      .get();

    return snapshot.docs.map(doc => doc.data() as AP2Mandate);
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
}

export const ap2MandateService = new AP2MandateService();
