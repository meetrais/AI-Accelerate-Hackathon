# AI-Powered Flight Booking Assistant

A conversational flight booking platform that combines Elastic's search capabilities with Google Cloud's Vertex AI to provide intelligent, natural language flight search and booking.

## 🚀 Features

### Two User Interfaces

#### 1. Flight Booking Interface (Default)
Complete booking experience with natural language search:
- **Natural Language Search**: Describe your travel needs in plain English
- **Intelligent Recommendations**: AI-powered flight suggestions based on preferences
- **Conversational Booking**: Complete your purchase through chat interface
- **Real-time Search**: Powered by Elasticsearch for fast, relevant results
- **Secure Payments**: Stripe integration for safe transactions

#### 2. Gen AI Showcase Interface
Click "🤖 View Gen AI Showcase" to explore all AI capabilities:
- **🔍 Semantic Search**: Vector-based flight search with relevance scores
- **📊 Price Prediction**: ML-powered price forecasting with confidence levels
- **📚 Document Q&A (RAG)**: Ask questions about policies and documents
- **✨ AI Recommendations**: Personalized suggestions based on behavior
- **📋 System Overview**: Complete architecture and API documentation

### 🤖 Advanced Gen AI Features
- **Semantic Search**: Vector-based flight search using embeddings
- **RAG (Retrieval Augmented Generation)**: Context-aware AI responses grounded in real data
- **Price Prediction**: AI-powered price trend forecasting
- **Delay Prediction**: Predict flight delays before they happen
- **Multimodal AI**: Extract info from passports, boarding passes, and IDs
- **Personalization Engine**: Learn user preferences and provide tailored recommendations
- **Proactive Assistance**: Automatic rebooking, travel tips, and disruption management
- **Smart Document Processing**: Verify identity, validate passports, process boarding passes

## 🛠 Technology Stack

- **Backend**: Node.js with TypeScript and Express.js
- **AI & ML**: 
  - Google Cloud Vertex AI (Gemini Pro for conversations)
  - Vertex AI Embeddings (text-embedding-004)
  - Gemini Vision for multimodal processing
- **Search**: Elasticsearch 8.x with vector search (kNN)
- **Database**: Google Cloud Firestore for bookings, sessions, and user profiles
- **Payments**: Stripe for secure payment processing
- **Infrastructure**: Google Cloud Run for deployment

## 📋 Prerequisites

- Node.js 18+ and npm
- Google Cloud Project with Vertex AI API enabled
- Elasticsearch cluster (Elastic Cloud recommended)
- Stripe account for payments

## 🔧 Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Environment configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration values
   ```

3. **Initialize Gen AI services**:
   ```bash
   npm run init-genai
   ```

4. **Seed flight data** (requires Elasticsearch):
   ```bash
   npm run seed-flights
   ```
   This will index flights with embeddings for semantic search.

5. **Development server**:
   ```bash
   npm run dev
   ```

5. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## 📚 API Endpoints

### Search & Discovery
- `GET /health` - Health check endpoint
- `POST /api/search/flights` - Hybrid flight search with intelligent ranking
- `POST /api/search/flexible` - Flexible date flight search
- `GET /api/search/route-stats/:origin/:destination` - Route statistics
- `POST /api/search/recommendations` - Personalized flight recommendations
- `POST /api/search/compare` - Compare multiple flights
- `GET /api/search/airports?q=query` - Get airport suggestions
- `GET /api/search/flights/:flightId` - Get flight details by ID

### Conversational Interface
- `POST /api/chat/message` - Send message to conversational assistant
- `POST /api/chat/quick-search` - Quick conversational flight search
- `POST /api/chat/get-recommendations` - Get personalized recommendations with explanation
- `POST /api/chat/explain-flight` - Get conversational flight explanation
- `GET /api/chat/conversation-history/:sessionId` - Get conversation history
- `POST /api/chat/context-search` - Search with conversational context

### 🤖 Gen AI Features
#### Semantic Search & RAG
- `POST /api/genai/semantic-search` - Vector-based semantic flight search
- `POST /api/genai/rag-query` - Ask questions using RAG
- `POST /api/genai/explain-policy` - Explain airline policies in natural language
- `POST /api/genai/generate-itinerary` - Generate AI-powered travel itinerary

#### Predictive Analytics
- `POST /api/genai/predict-price` - Predict price trends
- `POST /api/genai/predict-delay` - Predict flight delays
- `POST /api/genai/forecast-demand` - Forecast route demand
- `POST /api/genai/optimal-booking-time` - Find optimal booking time

#### Multimodal AI
- `POST /api/genai/extract-document` - Extract info from travel documents
- `POST /api/genai/validate-passport` - Validate passport information
- `POST /api/genai/verify-identity` - Verify identity with document + selfie

#### Personalization
- `GET /api/genai/user-profile/:userId` - Get user profile
- `POST /api/genai/personalized-recommendations` - Get personalized recommendations
- `POST /api/genai/predict-preferences` - Predict user preferences
- `GET /api/genai/search-suggestions/:userId` - Get personalized search suggestions

#### Proactive Assistance
- `POST /api/genai/monitor-flight` - Start flight monitoring
- `POST /api/genai/suggest-rebooking` - Get rebooking suggestions
- `POST /api/genai/travel-tips` - Get personalized travel tips
- `POST /api/genai/check-in-assist` - Get check-in assistance

### Natural Language Processing
- `POST /api/nlp/query` - Process natural language travel queries
- `POST /api/nlp/chat` - Handle conversational interactions
- `GET /api/nlp/session/:sessionId` - Get session information
- `DELETE /api/nlp/session/:sessionId` - Clear session data
- `GET /api/nlp/stats` - Get NLP service statistics

### Booking Management
- `POST /api/booking/create` - Create a new flight booking with payment
- `POST /api/booking/validate` - Validate booking request
- `GET /api/booking/:bookingReference` - Get booking by reference
- `GET /api/booking/user/:userId` - Get user bookings
- `PUT /api/booking/:bookingId/cancel` - Cancel booking with refund
- `PUT /api/booking/:bookingId/modify` - Modify booking
- `GET /api/booking/session/:sessionId/steps` - Get booking steps
- `POST /api/booking/session/:sessionId/step` - Update booking step
- `GET /api/booking/stats` - Get booking statistics

### Payment Processing
- `POST /api/payment/create-intent` - Create payment intent
- `POST /api/payment/validate-method` - Validate payment method
- `GET /api/payment/status/:paymentId` - Get payment status
- `POST /api/payment/refund` - Process refund
- `POST /api/payment/webhook` - Handle Stripe webhooks
- `GET /api/payment/stats` - Get payment statistics
- `GET /api/payment/health` - Check payment service health

### Documentation
See [GEN_AI_FEATURES.md](./GEN_AI_FEATURES.md) for comprehensive Gen AI documentation.

## 🏗 Development Progress

This project is being built incrementally following a spec-driven approach:

- ✅ **Task 1**: Project structure and core interfaces
- ✅ **Task 2**: Mock flight data and Elasticsearch integration
- ✅ **Task 3**: Natural language processing with Vertex AI
- ✅ **Task 4**: Flight search service with Elastic hybrid search
- ✅ **Task 5**: Conversational interface for flight recommendations
- ✅ **Task 6**: Booking flow and passenger information collection
- ✅ **Task 7**: Payment processing and booking completion
- ⏳ **Task 8**: React frontend
- ⏳ **Task 9**: Booking management
- ⏳ **Task 10**: Error handling and testing
- ⏳ **Task 11**: GCP deployment

## 📖 Documentation

### Gen AI Showcase
- **[QUICK_START_SHOWCASE.md](./QUICK_START_SHOWCASE.md)** - Quick start guide for the Gen AI Showcase
- **[GENAI_SHOWCASE_COMPLETE.md](./GENAI_SHOWCASE_COMPLETE.md)** - Complete implementation details
- **[SHOWCASE_VS_BOOKING.md](./SHOWCASE_VS_BOOKING.md)** - Comparison between interfaces

### General Documentation
- **[GEN_AI_FEATURES.md](./GEN_AI_FEATURES.md)** - Comprehensive Gen AI documentation
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Testing instructions
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Deployment guide

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

This is a hackathon project showcasing the integration of Elastic and Google Cloud technologies.