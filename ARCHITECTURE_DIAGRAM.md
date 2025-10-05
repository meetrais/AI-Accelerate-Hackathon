# Gen AI System Architecture Diagram

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend Application                         │
│                    (React - Natural Language UI)                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ REST API Calls
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                      Express.js API Server                           │
│                     (Node.js + TypeScript)                           │
├──────────────────────────────────────────────────────────────────────┤
│  Traditional Routes          │         Gen AI Routes                 │
│  • /api/search              │         • /api/genai/*                │
│  • /api/chat                │                                        │
│  • /api/booking             │                                        │
│  • /api/payment             │                                        │
└────────┬─────────────────────┴────────────────┬───────────────────────┘
         │                                      │
         │                                      │
┌────────▼──────────────────────┐    ┌─────────▼──────────────────────┐
│   Traditional Services        │    │     Gen AI Services            │
│                               │    │                                │
│  • NLP Service                │    │  • Embedding Service           │
│  • Conversation Service       │    │  • Vector Search Service       │
│  • Flight Recommendation      │    │  • RAG Service                 │
│  • Booking Service            │    │  • Predictive Analytics        │
│  • Payment Service            │    │  • Multimodal Service          │
│                               │    │  • Personalization Engine      │
│                               │    │  • Proactive Assistance        │
└───────┬───────────────────────┘    └────────┬───────────────────────┘
        │                                     │
        │                                     │
        └─────────────────┬───────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼────────┐ ┌──────▼──────┐ ┌───────▼────────┐
│  Elasticsearch │ │  Vertex AI  │ │   Firestore    │
│                │ │             │ │                │
│  • Flights     │ │  • Gemini   │ │  • Users       │
│  • Vectors     │ │  • Embeddings│ │  • Bookings   │
│  • kNN Search  │ │  • Vision   │ │  • Profiles    │
└────────────────┘ └─────────────┘ └────────────────┘
```

## Data Flow: Semantic Search

```
User Query: "cheap morning flights to Europe"
     │
     ▼
┌─────────────────────────────────────────┐
│  1. Embedding Service                   │
│     Generate query embedding (768-dim)  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Vector Search Service               │
│     kNN search in Elasticsearch         │
│     Find top-K similar flights          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. Return Results                      │
│     Flights ranked by similarity        │
│     With scores and explanations        │
└─────────────────────────────────────────┘
```

## Data Flow: RAG Query

```
User Question: "Which flight is best for families?"
     │
     ▼
┌─────────────────────────────────────────┐
│  1. Retrieval Phase                     │
│     • Generate query embedding          │
│     • Search for relevant flights       │
│     • Retrieve top-5 matches            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Augmentation Phase                  │
│     • Build context with flight data    │
│     • Add user preferences              │
│     • Format for AI model               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. Generation Phase                    │
│     • Send to Vertex AI Gemini          │
│     • Generate grounded response        │
│     • Include reasoning and sources     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. Return Answer                       │
│     • Natural language response         │
│     • Source citations                  │
│     • Confidence score                  │
└─────────────────────────────────────────┘
```

## Data Flow: Price Prediction

```
Request: Predict price for JFK→LHR on 2025-06-15
     │
     ▼
┌─────────────────────────────────────────┐
│  1. Historical Data Retrieval           │
│     Query Elasticsearch for:            │
│     • Past prices on this route         │
│     • Aggregated statistics             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Factor Analysis                     │
│     • Seasonality (summer = high)       │
│     • Booking timeline (45 days out)    │
│     • Day of week                       │
│     • Historical trends                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. AI Prediction                       │
│     Send context to Vertex AI:          │
│     • Historical data                   │
│     • Current factors                   │
│     • Request prediction                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. Return Prediction                   │
│     • Predicted price                   │
│     • Trend (increasing/decreasing)     │
│     • Confidence score                  │
│     • Recommendation (book_now/wait)    │
└─────────────────────────────────────────┘
```

## Data Flow: Document Extraction

```
User uploads passport image
     │
     ▼
┌─────────────────────────────────────────┐
│  1. Image Preprocessing                 │
│     • Convert to base64                 │
│     • Validate format and size          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Multimodal Service                  │
│     Send to Gemini Vision:              │
│     • Image data                        │
│     • Extraction prompt                 │
│     • Document type hint                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. AI Extraction                       │
│     Gemini Vision extracts:             │
│     • Passport number                   │
│     • Name, DOB, nationality            │
│     • Expiry date                       │
│     • All visible fields                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. Validation                          │
│     • Check required fields             │
│     • Validate expiry date              │
│     • Check format                      │
│     • Generate warnings                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  5. Return Extracted Data               │
│     • Structured passport data          │
│     • Confidence score                  │
│     • Validation errors/warnings        │
└─────────────────────────────────────────┘
```

## Data Flow: Personalization

```
User searches and books flights over time
     │
     ▼
┌─────────────────────────────────────────┐
│  1. Event Capture                       │
│     • Search queries                    │
│     • Flight selections                 │
│     • Bookings completed                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Profile Update (Firestore)          │
│     Store in user profile:              │
│     • Search history                    │
│     • Travel history                    │
│     • Behavior patterns                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. Pattern Analysis                    │
│     Calculate:                          │
│     • Frequent routes                   │
│     • Preferred airlines                │
│     • Budget range                      │
│     • Time preferences                  │
│     • Booking lead time                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. AI Preference Prediction            │
│     Send profile to Vertex AI:          │
│     • Predict future preferences        │
│     • Generate insights                 │
│     • Confidence scoring                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  5. Personalized Recommendations        │
│     For each flight:                    │
│     • Calculate match scores            │
│     • Generate personalized reasons     │
│     • Rank by relevance                 │
└─────────────────────────────────────────┘
```

## Service Dependencies

```
┌──────────────────────────────────────────────────────────────┐
│                    Embedding Service                         │
│                  (Foundation for all)                        │
└────────┬─────────────────────────────────────┬───────────────┘
         │                                     │
         │                                     │
┌────────▼──────────────┐          ┌──────────▼───────────────┐
│  Vector Search        │          │  RAG Service             │
│  • Semantic search    │          │  • Q&A                   │
│  • Hybrid search      │          │  • Recommendations       │
│  • Similar flights    │          │  • Policy explanations   │
└────────┬──────────────┘          └──────────┬───────────────┘
         │                                     │
         │                                     │
         └─────────────────┬───────────────────┘
                           │
                           │
         ┌─────────────────▼───────────────────┐
         │    Personalization Engine            │
         │    • User profiling                  │
         │    • Preference learning             │
         │    • Personalized recommendations    │
         └─────────────────┬───────────────────┘
                           │
                           │
         ┌─────────────────▼───────────────────┐
         │    Proactive Assistance              │
         │    • Flight monitoring               │
         │    • Price alerts                    │
         │    • Rebooking suggestions           │
         └──────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│              Predictive Analytics (Independent)              │
│              • Price prediction                              │
│              • Delay prediction                              │
│              • Demand forecasting                            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│              Multimodal Service (Independent)                │
│              • Document extraction                           │
│              • Identity verification                         │
└──────────────────────────────────────────────────────────────┘
```

## Technology Stack Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│                    • React Frontend                          │
│                    • Natural Language UI                     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    API Layer                                 │
│                    • Express.js REST API                     │
│                    • Input Validation (Joi)                  │
│                    • Error Handling                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    Service Layer                             │
│  Traditional Services        │    Gen AI Services            │
│  • NLP                       │    • Embedding                │
│  • Conversation              │    • Vector Search            │
│  • Booking                   │    • RAG                      │
│  • Payment                   │    • Predictive Analytics     │
│                              │    • Multimodal               │
│                              │    • Personalization          │
│                              │    • Proactive Assistance     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    AI/ML Layer                               │
│                    • Vertex AI (Gemini Pro)                  │
│                    • Vertex AI Embeddings                    │
│                    • Gemini Vision                           │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    Data Layer                                │
│  • Elasticsearch (Flights + Vectors)                         │
│  • Firestore (Users, Bookings, Profiles)                    │
│  • GCS (Images, Documents) [Optional]                       │
└─────────────────────────────────────────────────────────────┘
```

## Request Flow Example: Complete User Journey

```
1. User: "Find cheap morning flights to Paris"
   │
   ├─→ Embedding Service: Generate query embedding
   │
   ├─→ Vector Search: Find semantically similar flights
   │
   └─→ Return: 10 relevant flights
   
2. User: "Which is best for families?"
   │
   ├─→ RAG Service: 
   │   ├─→ Retrieve: Top 5 flights from previous search
   │   ├─→ Augment: Add flight details to context
   │   └─→ Generate: AI answer with reasoning
   │
   └─→ Return: "Flight FL002 is best because..."
   
3. User: "Should I book now?"
   │
   ├─→ Predictive Analytics:
   │   ├─→ Analyze: Historical prices, seasonality
   │   ├─→ Predict: Price trend
   │   └─→ Recommend: "Book now, prices rising"
   │
   └─→ Return: Price prediction with recommendation
   
4. User: Uploads passport
   │
   ├─→ Multimodal Service:
   │   ├─→ Extract: Passport information
   │   ├─→ Validate: Check expiry, format
   │   └─→ Auto-fill: Booking form
   │
   └─→ Return: Extracted data + validation
   
5. User: Books flight
   │
   ├─→ Personalization Engine:
   │   ├─→ Learn: Update user profile
   │   ├─→ Analyze: Behavior patterns
   │   └─→ Predict: Future preferences
   │
   ├─→ Proactive Assistance:
   │   ├─→ Monitor: Start flight monitoring
   │   ├─→ Alert: Set up delay alerts
   │   └─→ Tips: Generate travel tips
   │
   └─→ Return: Booking confirmation + monitoring active
```

## Scalability Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                             │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
┌────────▼────┐  ┌───────▼────┐  ┌──────▼─────┐
│  API Server │  │ API Server │  │ API Server │
│  Instance 1 │  │ Instance 2 │  │ Instance 3 │
└────────┬────┘  └───────┬────┘  └──────┬─────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
┌────────▼────────┐  ┌──▼──────────┐  ┌▼──────────┐
│  Elasticsearch  │  │ Vertex AI   │  │ Firestore │
│  Cluster        │  │ (Managed)   │  │ (Managed) │
│  • Sharding     │  │ • Auto-scale│  │ • Auto-   │
│  • Replication  │  │ • Rate limit│  │   scale   │
└─────────────────┘  └─────────────┘  └───────────┘
```

## Monitoring & Observability

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│                    • API Servers                             │
│                    • Gen AI Services                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Logs, Metrics, Traces
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    Observability Layer                       │
│  • Cloud Logging (Logs)                                      │
│  • Cloud Monitoring (Metrics)                                │
│  • Cloud Trace (Distributed tracing)                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Alerts
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    Alerting & Response                       │
│  • PagerDuty / Slack                                         │
│  • Auto-scaling triggers                                     │
│  • Incident management                                       │
└─────────────────────────────────────────────────────────────┘
```

---

This architecture provides:
- ✅ Scalability (horizontal scaling)
- ✅ Reliability (redundancy)
- ✅ Performance (caching, async)
- ✅ Observability (logging, monitoring)
- ✅ Maintainability (modular services)
- ✅ Extensibility (easy to add features)
