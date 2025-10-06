# Agent Payment Protocol (AP2) Implementation

## Overview

The Agent Payment Protocol (AP2) enables AI agents to make payments on behalf of users with proper authorization, consent, and audit trails.

## Key Features

✅ **User Authorization** - Users explicitly authorize agents to make payments
✅ **Payment Limits** - Set maximum amounts and expiration times
✅ **Scope Control** - Limit what agents can pay for (e.g., only flight bookings)
✅ **Audit Trail** - Complete transaction history with timestamps
✅ **User Consent** - Every payment requires user consent
✅ **Revocable** - Users can revoke authorization anytime
✅ **Transparent** - Full visibility into all transactions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User                                 │
│                           │                                  │
│                           ▼                                  │
│                  ┌─────────────────┐                        │
│                  │  Authorization  │                        │
│                  │   (AP2 Auth)    │                        │
│                  └─────────────────┘                        │
│                           │                                  │
│                           ▼                                  │
│                  ┌─────────────────┐                        │
│                  │   AI Agent      │                        │
│                  │  (Flight Bot)   │                        │
│                  └─────────────────┘                        │
│                           │                                  │
│                           ▼                                  │
│                  ┌─────────────────┐                        │
│                  │  AP2 Payment    │                        │
│                  │    Service      │                        │
│                  └─────────────────┘                        │
│                           │                                  │
│                  ┌────────┴────────┐                        │
│                  ▼                 ▼                         │
│           ┌──────────┐      ┌──────────┐                   │
│           │Firestore │      │  Stripe  │                   │
│           │(Audit)   │      │(Payment) │                   │
│           └──────────┘      └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### 1. Create Authorization

**POST** `/api/ap2/authorize`

Create a payment authorization for an AI agent.

**Request:**
```json
{
  "userId": "user_123",
  "agentId": "flight_booking_agent",
  "maxAmount": 1000,
  "currency": "USD",
  "scope": ["flight-booking"],
  "durationHours": 24
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authorizationId": "ap2_auth_1234567890_abc123",
    "userId": "user_123",
    "agentId": "flight_booking_agent",
    "maxAmount": 1000,
    "currency": "USD",
    "expiresAt": "2025-10-07T00:00:00.000Z",
    "scope": ["flight-booking"],
    "status": "active",
    "createdAt": "2025-10-06T00:00:00.000Z"
  },
  "message": "Payment authorization created"
}
```

### 2. Process Payment

**POST** `/api/ap2/payment`

Process a payment through AP2 protocol.

**Request:**
```json
{
  "authorizationId": "ap2_auth_1234567890_abc123",
  "agentId": "flight_booking_agent",
  "userId": "user_123",
  "amount": 650,
  "currency": "USD",
  "description": "Flight booking: JFK to CDG",
  "metadata": {
    "bookingReference": "BK123456",
    "flightId": "FL001",
    "passengers": 1,
    "route": "JFK-CDG"
  },
  "userConsent": {
    "consentId": "consent_123",
    "timestamp": "2025-10-06T00:00:00.000Z",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "ap2_txn_1234567890_xyz789",
    "authorizationId": "ap2_auth_1234567890_abc123",
    "agentId": "flight_booking_agent",
    "userId": "user_123",
    "amount": 650,
    "currency": "USD",
    "status": "completed",
    "description": "Flight booking: JFK to CDG",
    "metadata": {
      "bookingReference": "BK123456",
      "flightId": "FL001",
      "passengers": 1,
      "route": "JFK-CDG"
    },
    "createdAt": "2025-10-06T00:00:00.000Z",
    "completedAt": "2025-10-06T00:00:01.000Z",
    "auditTrail": [
      {
        "timestamp": "2025-10-06T00:00:00.000Z",
        "action": "payment_initiated",
        "actor": "agent",
        "details": "Agent flight_booking_agent initiated payment",
        "ipAddress": "192.168.1.1"
      },
      {
        "timestamp": "2025-10-06T00:00:01.000Z",
        "action": "payment_completed",
        "actor": "system",
        "details": "Mock payment completed successfully"
      }
    ]
  },
  "message": "Payment processed successfully"
}
```

### 3. Revoke Authorization

**POST** `/api/ap2/revoke`

Revoke a payment authorization.

**Request:**
```json
{
  "authorizationId": "ap2_auth_1234567890_abc123",
  "reason": "user_revoked"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Authorization revoked"
}
```

### 4. Get Authorizations

**GET** `/api/ap2/authorizations/:userId`

Get user's active authorizations.

**Response:**
```json
{
  "success": true,
  "data": {
    "authorizations": [
      {
        "authorizationId": "ap2_auth_1234567890_abc123",
        "userId": "user_123",
        "agentId": "flight_booking_agent",
        "maxAmount": 1000,
        "currency": "USD",
        "expiresAt": "2025-10-07T00:00:00.000Z",
        "scope": ["flight-booking"],
        "status": "active",
        "createdAt": "2025-10-06T00:00:00.000Z"
      }
    ],
    "count": 1
  },
  "message": "Authorizations retrieved"
}
```

### 5. Get Transaction History

**GET** `/api/ap2/transactions/:userId?limit=50`

Get transaction history.

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "transactionId": "ap2_txn_1234567890_xyz789",
        "authorizationId": "ap2_auth_1234567890_abc123",
        "agentId": "flight_booking_agent",
        "userId": "user_123",
        "amount": 650,
        "currency": "USD",
        "status": "completed",
        "description": "Flight booking: JFK to CDG",
        "createdAt": "2025-10-06T00:00:00.000Z",
        "completedAt": "2025-10-06T00:00:01.000Z"
      }
    ],
    "count": 1
  },
  "message": "Transaction history retrieved"
}
```

### 6. Refund Transaction

**POST** `/api/ap2/refund`

Refund a transaction.

**Request:**
```json
{
  "transactionId": "ap2_txn_1234567890_xyz789",
  "reason": "Flight cancelled by airline"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction refunded"
}
```

### 7. Get Payment Statistics

**GET** `/api/ap2/stats/:userId`

Get payment statistics for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalTransactions": 5,
    "totalAmount": 3250,
    "activeAuthorizations": 1,
    "lastTransaction": "2025-10-06T00:00:00.000Z"
  },
  "message": "Payment statistics retrieved"
}
```

## Security Features

### 1. Authorization Verification
Every payment request is verified against:
- ✅ Authorization exists and is active
- ✅ Authorization hasn't expired
- ✅ Payment amount is within limits
- ✅ Payment scope is authorized

### 2. User Consent
Every payment requires:
- ✅ Consent ID
- ✅ Timestamp
- ✅ IP address (optional)
- ✅ User agent (optional)

### 3. Audit Trail
Every transaction includes:
- ✅ Complete history of actions
- ✅ Timestamps for all events
- ✅ Actor identification (agent/user/system)
- ✅ IP addresses when available

### 4. Revocation
Users can:
- ✅ Revoke authorization anytime
- ✅ View all active authorizations
- ✅ See complete transaction history

## Firestore Collections

### ap2_authorizations
```typescript
{
  authorizationId: string;
  userId: string;
  agentId: string;
  maxAmount: number;
  currency: string;
  expiresAt: Date;
  scope: string[];
  status: 'active' | 'revoked' | 'expired';
  createdAt: Date;
  revokedAt?: Date;
  revokeReason?: string;
}
```

### ap2_transactions
```typescript
{
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
  refundedAt?: Date;
  refundReason?: string;
  auditTrail: AuditEntry[];
}
```

## Usage Example

### Step 1: User Authorizes Agent
```typescript
// User grants permission to AI agent
const auth = await ap2PaymentService.createAuthorization(
  'user_123',
  'flight_booking_agent',
  1000, // Max $1000
  'USD',
  ['flight-booking'],
  24 // Valid for 24 hours
);
```

### Step 2: Agent Makes Payment
```typescript
// AI agent books flight and processes payment
const payment = await ap2PaymentService.processPayment({
  agentId: 'flight_booking_agent',
  userId: 'user_123',
  amount: 650,
  currency: 'USD',
  description: 'Flight booking: JFK to CDG',
  metadata: {
    bookingReference: 'BK123456',
    flightId: 'FL001'
  },
  userConsent: {
    consentId: 'consent_123',
    timestamp: new Date(),
    ipAddress: '192.168.1.1'
  }
}, auth.authorizationId);
```

### Step 3: User Views Transactions
```typescript
// User checks transaction history
const history = await ap2PaymentService.getTransactionHistory('user_123');
```

### Step 4: User Revokes Authorization (Optional)
```typescript
// User revokes agent's payment permission
await ap2PaymentService.revokeAuthorization(
  auth.authorizationId,
  'user_revoked'
);
```

## Benefits

1. **Trust** - Users maintain control over agent payments
2. **Transparency** - Complete visibility into all transactions
3. **Security** - Multiple layers of verification and limits
4. **Compliance** - Full audit trail for regulatory requirements
5. **Flexibility** - Configurable limits, scopes, and durations
6. **Revocable** - Users can stop agent payments anytime

## Testing

```bash
# Create authorization
curl -X POST http://localhost:3000/api/ap2/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "agentId": "flight_booking_agent",
    "maxAmount": 1000,
    "currency": "USD",
    "scope": ["flight-booking"],
    "durationHours": 24
  }'

# Process payment
curl -X POST http://localhost:3000/api/ap2/payment \
  -H "Content-Type: application/json" \
  -d '{
    "authorizationId": "ap2_auth_...",
    "agentId": "flight_booking_agent",
    "userId": "user_123",
    "amount": 650,
    "currency": "USD",
    "description": "Flight booking",
    "metadata": {},
    "userConsent": {
      "consentId": "consent_123",
      "timestamp": "2025-10-06T00:00:00.000Z"
    }
  }'

# Get transactions
curl http://localhost:3000/api/ap2/transactions/user_123
```

## Production Deployment

The AP2 implementation is ready for production with:
- ✅ Firestore for persistent storage
- ✅ Stripe integration for real payments
- ✅ Mock mode for testing
- ✅ Complete audit trails
- ✅ Security validations
- ✅ Error handling

Your AP2 Payment Protocol is now fully implemented! 🚀
