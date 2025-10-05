# AI-Powered Flight Booking Assistant

A conversational flight booking platform that combines Elastic's search capabilities with Google Cloud's Vertex AI to provide intelligent, natural language flight search and booking.

## 🚀 Features

- **Natural Language Search**: Describe your travel needs in plain English
- **Intelligent Recommendations**: AI-powered flight suggestions based on preferences
- **Conversational Booking**: Complete your purchase through chat interface
- **Real-time Search**: Powered by Elasticsearch for fast, relevant results
- **Secure Payments**: Stripe integration for safe transactions

## 🛠 Technology Stack

- **Backend**: Node.js with TypeScript and Express.js
- **AI**: Google Cloud Vertex AI (Gemini for conversations)
- **Search**: Elasticsearch for flight data indexing and search
- **Database**: Google Cloud Firestore for bookings and sessions
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

3. **Seed flight data** (requires Elasticsearch):
   ```bash
   npm run seed-flights
   ```

4. **Development server**:
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

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

This is a hackathon project showcasing the integration of Elastic and Google Cloud technologies.