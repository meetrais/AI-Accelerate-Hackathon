# AI-Powered Flight Booking Assistant

A production-ready, Gen AI-powered flight booking platform that combines Google Cloud's Vertex AI, Elasticsearch, and Firestore to provide intelligent, conversational flight search and booking with Google's Agent Payment Protocol (AP2).

## 🎯 Overview

This application showcases enterprise-grade Gen AI capabilities for travel booking, featuring natural language understanding, semantic search, price predictions, and secure AI agent payments using Google's official AP2 protocol.

## ✨ Key Features

### 🤖 Gen AI Capabilities
- **Smart Search** - Natural language flight search with semantic understanding
- **Price Forecast** - ML-based price predictions with confidence scores
- **Ask Questions** - RAG-powered Q&A about travel policies and procedures
- **AI Recommendations** - Personalized flight suggestions based on preferences
- **Conversational Booking** - Complete booking flow through natural language chat

### 💳 Google AP2 Payment Protocol
- **Cryptographically Signed Mandates** - RSA-256 signatures for proof of user intent
- **Payment-Agnostic** - Support for cards, bank transfers, wallets, and cryptocurrency
- **A2A Integration** - Agent-to-Agent protocol compatibility
- **MCP Extension** - Model Context Protocol support
- **Complete Audit Trails** - Every transaction cryptographically signed

### 🔍 Advanced Search
- **Semantic Search** - Vector-based search using Vertex AI embeddings
- **Hybrid Search** - Combines semantic and traditional search
- **Real-time Results** - Fast queries powered by Elasticsearch

### 🎨 User Interface
- **Smart Travel Assistant** - Modern, dark-themed Gen AI showcase
- **Flight Booking Flow** - Complete booking interface with step-by-step process
- **Responsive Design** - Works on desktop and mobile devices

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
│              Smart Assistant + Booking Flow                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Backend (Node.js + TypeScript)                │
│         Express API + Gen AI Services + AP2                  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐     ┌──────────────┐
│  Vertex AI   │      │Elasticsearch │     │  Firestore   │
│              │      │              │     │              │
│ • Gemini     │      │ • Flights    │     │ • Bookings   │
│ • Embeddings │      │ • Vectors    │     │ • Sessions   │
│ • Vision     │      │ • Search     │     │ • Mandates   │
└──────────────┘      └──────────────┘     └──────────────┘
```

## 🛠️ Technology Stack

### Backend
- **Runtime:** Node.js 18+ with TypeScript
- **Framework:** Express.js
- **AI/ML:** Google Cloud Vertex AI (Gemini 1.5 Flash, text-embedding-004)
- **Search:** Elasticsearch 8.x with vector search (kNN)
- **Database:** Google Cloud Firestore
- **Payments:** Stripe + Google AP2 Protocol
- **Infrastructure:** Google Cloud Run

### Frontend
- **Framework:** React 18
- **Language:** JavaScript
- **Styling:** Inline styles with modern design
- **Build:** Create React App

### Key Services
- **Vertex AI** - Natural language understanding, embeddings, chat
- **Elasticsearch** - Flight search, vector similarity, semantic matching
- **Firestore** - Bookings, sessions, user profiles, AP2 mandates
- **Cloud Run** - Serverless deployment with auto-scaling

## 📋 Prerequisites

- Node.js 18+ and npm
- Google Cloud Project with billing enabled
- Elasticsearch cluster (Elastic Cloud recommended)
- Stripe account (optional, has mock mode)
- gcloud CLI installed

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd AI-Accelerate-Hackathon
npm install
cd frontend && npm install && cd ..
```

### 2. Configure Environment

Create `.env` file:

```env
# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1

# Elasticsearch
ELASTICSEARCH_NODE=https://your-cluster.es.cloud:443
ELASTICSEARCH_API_KEY=your-api-key
ELASTICSEARCH_FLIGHT_INDEX=flights

# Stripe (optional - has mock mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Development
NODE_ENV=development
PORT=3000
```

### 3. Run Locally

```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm start
```

Access the app at http://localhost:3001

### 4. Deploy to Google Cloud Run

```bash
# Build
npm run build

# Deploy (Windows)
.\deploy-gcp.ps1

# Deploy (Mac/Linux)
chmod +x deploy-gcp.sh
./deploy-gcp.sh
```

## 📚 API Documentation

### Gen AI Endpoints

#### Semantic Search
```bash
POST /api/genai/semantic-search
{
  "query": "flights to paris",
  "topK": 5,
  "minScore": 0.5
}
```

#### Price Prediction
```bash
POST /api/genai/predict-price
{
  "origin": "JFK",
  "destination": "LAX",
  "departureDate": "2025-10-15",
  "currentPrice": 450
}
```

#### Document Q&A (RAG)
```bash
POST /api/genai/rag-query
{
  "question": "What is the baggage allowance?"
}
```

### Google AP2 Protocol Endpoints

#### Create Mandate
```bash
POST /api/ap2/mandate/create
{
  "userId": "user_123",
  "agentId": "flight_agent",
  "authorization": {
    "maxAmount": 1000,
    "currency": "USD",
    "scope": ["flight-booking"],
    "validFrom": "2025-10-06T00:00:00Z",
    "validUntil": "2025-10-07T00:00:00Z"
  },
  "paymentMethods": [{
    "methodId": "pm_123",
    "type": "card",
    "provider": "stripe",
    "priority": 1
  }],
  "userConsent": {
    "consentId": "consent_123",
    "timestamp": "2025-10-06T00:00:00Z"
  }
}
```

#### Process Payment
```bash
POST /api/ap2/payment
{
  "mandateId": "mandate_...",
  "agentId": "flight_agent",
  "amount": 650,
  "currency": "USD",
  "description": "Flight booking",
  "scope": "flight-booking"
}
```

### Chat & Booking Endpoints

```bash
POST /api/chat/message        # Natural language chat
POST /api/booking/create      # Create booking
GET  /api/booking/:id         # Get booking details
POST /api/payment/process     # Process payment
GET  /health                  # Health check
```

## 🗄️ Database Schema

### Firestore Collections

#### bookings
```typescript
{
  bookingReference: string;
  userId: string;
  flights: Flight[];
  passengers: PassengerInfo[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: Date;
}
```

#### sessions
```typescript
{
  sessionId: string;
  userId?: string;
  messages: Message[];
  context: ConversationContext;
  createdAt: Date;
  lastActivity: Date;
}
```

#### ap2_mandates
```typescript
{
  mandateId: string;
  userId: string;
  agentId: string;
  authorization: Authorization;
  signature: {
    algorithm: 'RS256';
    publicKey: string;
    signedData: string;
  };
  status: 'active' | 'revoked' | 'expired';
}
```

#### ap2_transactions
```typescript
{
  transactionId: string;
  mandateId: string;
  amount: number;
  status: 'completed' | 'failed' | 'refunded';
  verification: VerificationResult;
  auditTrail: AuditEntry[];
}
```

### Elasticsearch Indices

#### flights
```json
{
  "id": "FL001",
  "airline": "American Airlines",
  "flightNumber": "AA100",
  "origin": { "code": "JFK", "city": "New York" },
  "destination": { "code": "LAX", "city": "Los Angeles" },
  "departureTime": "2025-10-15T10:00:00Z",
  "price": 450,
  "availableSeats": 45,
  "embedding": [0.123, 0.456, ...] // 768-dim vector
}
```

## 🔐 Security Features

### AP2 Protocol Security
- ✅ RSA-256 cryptographic signatures
- ✅ Proof of user intent via signed Mandates
- ✅ Amount limits and expiration
- ✅ Scope-based authorization
- ✅ Complete audit trails
- ✅ Revocable permissions

### Application Security
- ✅ Helmet.js security headers
- ✅ CORS configuration
- ✅ Input validation (Joi)
- ✅ Error handling middleware
- ✅ Rate limiting
- ✅ Environment variable protection

## 🧪 Testing

```bash
# Run tests
npm test

# Test with coverage
npm run test:coverage

# Test backend health
curl http://localhost:3000/health

# Test semantic search
curl -X POST http://localhost:3000/api/genai/semantic-search \
  -H "Content-Type: application/json" \
  -d '{"query": "flights to paris", "topK": 5}'
```

## 📊 Monitoring & Observability

### Health Checks
- `/health` - Complete system health
- `/ping` - Simple connectivity check

### Logging
- Structured logging with timestamps
- Request/response logging
- Error tracking
- Performance metrics

### Cloud Run Metrics
- Request count
- Response times
- Error rates
- Memory/CPU usage

## 🚢 Deployment

### Google Cloud Run

The application is deployed on Google Cloud Run with:
- **Auto-scaling:** 0-10 instances
- **Memory:** 2GB per instance
- **CPU:** 2 cores
- **Timeout:** 300 seconds
- **Region:** us-central1

### Environment Variables (Production)

Set in Cloud Run console or via gcloud:

```bash
gcloud run services update flight-booking-assistant \
  --region us-central1 \
  --update-env-vars \
  GOOGLE_CLOUD_PROJECT_ID=your-project,\
  ELASTICSEARCH_NODE=your-cluster,\
  ELASTICSEARCH_API_KEY=your-key
```

### CI/CD

Use Cloud Build for automated deployments:

```bash
gcloud builds submit --config cloudbuild.yaml
```

## 📖 Documentation

### Key Documents
- **TESTING_GUIDE.md** - Comprehensive testing instructions
- **DEPLOYMENT_CHECKLIST.md** - Production deployment guide
- **GEN_AI_ARCHITECTURE.md** - Gen AI system architecture
- **GEN_AI_FEATURES.md** - Detailed feature documentation
- **ARCHITECTURE_DIAGRAM.md** - System architecture diagrams

### API Documentation
All API endpoints are documented with:
- Request/response schemas
- Example payloads
- Error codes
- Authentication requirements

## 🎯 Use Cases

### 1. Natural Language Flight Search
User: "I need a cheap flight to Paris next week"
→ AI understands intent, searches flights, provides recommendations

### 2. AI Agent Booking
AI Agent: Creates AP2 Mandate → Books flight → Processes payment
→ All with cryptographic proof of user authorization

### 3. Price Monitoring
User: "Should I book now or wait?"
→ ML model predicts price trends, provides recommendation

### 4. Travel Q&A
User: "What's the baggage allowance?"
→ RAG system retrieves policy, generates accurate answer

## 🤝 Contributing

This is a hackathon project showcasing Gen AI and AP2 integration. Contributions welcome!

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **Google Cloud** - Vertex AI, Cloud Run, Firestore
- **Elastic** - Elasticsearch and vector search
- **Stripe** - Payment processing
- **Google AP2** - Agent Payment Protocol standard
- **60+ AP2 Partners** - For the open payment standard

## 📞 Support

### Issues
- Check existing documentation
- Review error logs in Cloud Run
- Test with `/health` endpoint

### Resources
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Elasticsearch Guide](https://www.elastic.co/guide)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [AP2 Protocol](https://agentprotocol.org)

## 🚀 Live Application

**Production URL:** https://flight-booking-assistant-640958026619.us-central1.run.app

### Features Available
- ✅ Smart Flight Search
- ✅ Price Forecast
- ✅ Ask Questions (Travel Q&A)
- ✅ AI Recommendations
- ✅ Complete Booking Flow
- ✅ Google AP2 Payments

---

**Built with ❤️ using Google Cloud, Vertex AI, and Elasticsearch**

**Powered by Google's Agent Payment Protocol (AP2)**
