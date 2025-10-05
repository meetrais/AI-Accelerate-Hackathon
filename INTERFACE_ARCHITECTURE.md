# Interface Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Application                          │
│                   (React on Port 3001)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ View Mode State
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│   Booking Interface       │   │   Gen AI Showcase         │
│   (Default View)          │   │   (Demo View)             │
│                           │   │                           │
│   Light Theme             │   │   Dark Theme              │
│   User-focused            │   │   Tech-focused            │
│   Conversion-optimized    │   │   Feature-rich            │
└───────────────────────────┘   └───────────────────────────┘
                │                           │
                │                           │
                └─────────────┬─────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API Server                            │
│                   (Node.js on Port 3000)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Vertex   │  │Elastic-  │  │Firestore │
        │   AI     │  │ search   │  │          │
        └──────────┘  └──────────┘  └──────────┘
```

## Booking Interface Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Booking Interface                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Step 1:    │    │   Step 2:    │    │   Step 3:    │
│   Search     │───▶│  Passenger   │───▶│   Payment    │
│   Flights    │    │   Details    │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
                                                  │
                                                  ▼
                                        ┌──────────────┐
                                        │   Step 4:    │
                                        │Confirmation  │
                                        └──────────────┘

APIs Used:
- POST /api/chat/message          (Natural language search)
- POST /api/booking/create        (Create booking)
- GET  /health                    (Health check)
```

## Gen AI Showcase Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Gen AI Showcase                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Tab Navigation
                              │
        ┌─────────┬───────────┼───────────┬─────────┐
        │         │           │           │         │
        ▼         ▼           ▼           ▼         ▼
    ┌──────┐ ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐
    │ Tab1 │ │ Tab2 │   │ Tab3 │   │ Tab4 │   │ Tab5 │
    │  🔍  │ │  📊  │   │  📚  │   │  ✨  │   │  📋  │
    └──────┘ └──────┘   └──────┘   └──────┘   └──────┘
        │         │           │           │         │
        ▼         ▼           ▼           ▼         ▼
    Semantic  Price      Document   Recom-    System
    Search    Predict    Q&A (RAG)  mendations Overview

APIs Used:
- POST /api/genai/semantic-search      (Vector search)
- POST /api/genai/predict-price        (ML prediction)
- POST /api/genai/rag-query            (Document Q&A)
- POST /api/genai/recommendations      (AI suggestions)
- POST /api/genai/multimodal-query     (Image processing)
- GET  /api/genai/proactive-assistance (Proactive help)
```

## Component Structure

### Booking Interface (index.js)

```
App Component
├── Header
│   ├── Title
│   └── "View Gen AI Showcase" Button ──────┐
├── Booking Steps Progress Bar              │
├── Search Interface                        │
│   ├── Natural Language Input              │
│   ├── Search Button                       │
│   └── Test Backend Button                 │
├── Chat Messages                           │
├── Flight Results                          │
├── Passenger Details Form                  │
├── Payment Form                            │
└── Confirmation                            │
                                            │
                                            │ Switch View
                                            │
Gen AI Showcase Component                   │
├── Header                                  │
│   ├── Title                               │
│   └── "Back to Booking" Button ◀──────────┘
├── Tab Navigation
│   ├── Semantic Search Tab
│   ├── Price Prediction Tab
│   ├── Document Q&A Tab
│   ├── Recommendations Tab
│   └── System Overview Tab
└── Tab Content
    ├── Input Fields
    ├── Action Buttons
    └── Results Display
```

## Data Flow

### Booking Interface Data Flow

```
User Input (Natural Language)
        │
        ▼
Frontend State Management
        │
        ▼
POST /api/chat/message
        │
        ▼
Backend Processing
        │
        ├──▶ Vertex AI (Intent Understanding)
        │
        ├──▶ Elasticsearch (Flight Search)
        │
        └──▶ Firestore (Session Storage)
        │
        ▼
Response with Flights
        │
        ▼
Display Results
        │
        ▼
User Selects Flight
        │
        ▼
Booking Flow
        │
        ▼
POST /api/booking/create
        │
        ▼
Confirmation
```

### Gen AI Showcase Data Flow

```
User Selects Tab
        │
        ▼
Tab-Specific Input
        │
        ├──▶ Semantic Search
        │    │
        │    ▼
        │    POST /api/genai/semantic-search
        │    │
        │    ├──▶ Generate Embeddings (Vertex AI)
        │    └──▶ Vector Search (Elasticsearch)
        │
        ├──▶ Price Prediction
        │    │
        │    ▼
        │    POST /api/genai/predict-price
        │    │
        │    └──▶ ML Model (Vertex AI)
        │
        ├──▶ Document Q&A
        │    │
        │    ▼
        │    POST /api/genai/rag-query
        │    │
        │    ├──▶ Retrieve Context (Elasticsearch)
        │    └──▶ Generate Answer (Vertex AI)
        │
        └──▶ Recommendations
             │
             ▼
             POST /api/genai/recommendations
             │
             └──▶ Personalization Engine
        │
        ▼
Display Results with Details
```

## State Management

### Booking Interface State

```javascript
{
  viewMode: 'booking',           // or 'showcase'
  query: '',                     // Search query
  flights: [],                   // Search results
  loading: false,                // Loading state
  chatMessages: [],              // Chat history
  selectedFlight: null,          // Selected flight
  bookingStep: 'search',         // Current step
  passengerDetails: [],          // Passenger info
  contactInfo: {},               // Contact info
  bookingReference: ''           // Confirmation
}
```

### Gen AI Showcase State

```javascript
{
  activeTab: 'semantic-search',  // Current tab
  semanticQuery: '',             // Search query
  semanticResults: null,         // Search results
  pricePrediction: null,         // Prediction data
  ragQuestion: '',               // Q&A question
  ragAnswer: null,               // Q&A answer
  loading: false                 // Loading state
}
```

## Navigation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Opens Application                        │
│                  http://localhost:3001                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Booking Interface│
                    │  (Default View)  │
                    └──────────────────┘
                              │
                              │ Click "View Gen AI Showcase"
                              │
                              ▼
                    ┌──────────────────┐
                    │  Gen AI Showcase │
                    │   (Demo View)    │
                    └──────────────────┘
                              │
                              │ Click "Back to Booking"
                              │
                              ▼
                    ┌──────────────────┐
                    │ Booking Interface│
                    │  (Default View)  │
                    └──────────────────┘
```

## API Endpoint Mapping

### Booking Interface Endpoints

| Action | Endpoint | Method | Purpose |
|--------|----------|--------|---------|
| Search | `/api/chat/message` | POST | Natural language search |
| Book | `/api/booking/create` | POST | Create booking |
| Health | `/health` | GET | Check backend status |

### Gen AI Showcase Endpoints

| Feature | Endpoint | Method | Purpose |
|---------|----------|--------|---------|
| Semantic Search | `/api/genai/semantic-search` | POST | Vector-based search |
| Price Prediction | `/api/genai/predict-price` | POST | ML price forecast |
| Document Q&A | `/api/genai/rag-query` | POST | RAG-based answers |
| Recommendations | `/api/genai/recommendations` | POST | AI suggestions |
| Multimodal | `/api/genai/multimodal-query` | POST | Image processing |
| Proactive | `/api/genai/proactive-assistance` | GET | Smart notifications |

## Technology Stack by Interface

### Booking Interface

```
Frontend:
- React 18
- Inline Styles
- Fetch API

Backend:
- Express.js
- Vertex AI (Gemini)
- Elasticsearch
- Firestore
```

### Gen AI Showcase

```
Frontend:
- React 18
- Inline Styles (Dark Theme)
- Fetch API
- Tab Navigation

Backend:
- Express.js
- Vertex AI (Embeddings + Gemini)
- Elasticsearch (Vector Search)
- RAG Pipeline
- ML Models
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Cloud Run                                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Frontend Container                       │ │
│  │                   (React Build + Nginx)                     │ │
│  │                                                             │ │
│  │  ┌──────────────────┐      ┌──────────────────┐          │ │
│  │  │ Booking Interface│      │ Gen AI Showcase  │          │ │
│  │  └──────────────────┘      └──────────────────┘          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Backend Container                        │ │
│  │                   (Node.js + Express)                       │ │
│  │                                                             │ │
│  │  ┌──────────────────┐      ┌──────────────────┐          │ │
│  │  │  Booking APIs    │      │   Gen AI APIs    │          │ │
│  │  └──────────────────┘      └──────────────────┘          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Vertex   │  │Elastic   │  │Firestore │
        │   AI     │  │  Cloud   │  │          │
        └──────────┘  └──────────┘  └──────────┘
```

## Summary

The application provides two distinct interfaces:

1. **Booking Interface**: Production-ready, user-focused booking experience
2. **Gen AI Showcase**: Feature-rich demonstration of AI capabilities

Both interfaces share the same backend infrastructure but serve different purposes and audiences. Users can seamlessly switch between them using the navigation buttons.
