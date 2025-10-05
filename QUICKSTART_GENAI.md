# Gen AI Quick Start Guide

Get started with the comprehensive Gen AI features in 5 minutes!

## Prerequisites

1. **GCP Account** with Vertex AI enabled
2. **Elasticsearch 8.x+** with vector search support
3. **Node.js 18+** installed

## Step 1: Environment Setup

Create `.env` file:

```env
# GCP Configuration
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1

# Elasticsearch
ELASTICSEARCH_URL=https://your-elasticsearch-url
ELASTICSEARCH_API_KEY=your-api-key

# Optional: Firestore
FIRESTORE_PROJECT_ID=your-project-id
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Initialize Gen AI Services

```bash
npm run init-genai
```

This will:
- Initialize Vertex AI embedding service
- Configure Elasticsearch for vector search
- Initialize multimodal AI service
- Verify all connections

## Step 4: Seed Flight Data

```bash
npm run seed-flights
```

This will:
- Generate mock flight data
- Create embeddings for each flight
- Index flights in Elasticsearch with vectors
- Takes ~2-5 minutes for 100+ flights

## Step 5: Start the Server

```bash
npm run dev
```

Server starts on `http://localhost:3000`

## Step 6: Test Gen AI Features

### Test 1: Semantic Search

```bash
curl -X POST http://localhost:3000/api/genai/semantic-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "cheap morning flights to Europe with good legroom",
    "topK": 5
  }'
```

### Test 2: Price Prediction

```bash
curl -X POST http://localhost:3000/api/genai/predict-price \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "JFK",
    "destination": "LHR",
    "departureDate": "2025-06-15",
    "currentPrice": 650
  }'
```

### Test 3: RAG Query

```bash
curl -X POST http://localhost:3000/api/genai/rag-query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the best flight for a family with young children?",
    "flightIds": ["FL001", "FL002", "FL003"]
  }'
```

### Test 4: Policy Explanation

```bash
curl -X POST http://localhost:3000/api/genai/explain-policy \
  -H "Content-Type: application/json" \
  -d '{
    "policyType": "baggage",
    "airline": "Delta Air Lines"
  }'
```

### Test 5: Personalized Recommendations

```bash
curl -X POST http://localhost:3000/api/genai/personalized-recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "flightIds": ["FL001", "FL002", "FL003", "FL004", "FL005"]
  }'
```

## Frontend Integration

### Semantic Search Component

```javascript
async function semanticSearch(query) {
  const response = await fetch('/api/genai/semantic-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      topK: 10,
      minScore: 0.7
    })
  });
  
  const data = await response.json();
  return data.data.results;
}
```

### Price Prediction Component

```javascript
async function predictPrice(origin, destination, date) {
  const response = await fetch('/api/genai/predict-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin,
      destination,
      departureDate: date
    })
  });
  
  const data = await response.json();
  return data.data;
}
```

### Document Upload Component

```javascript
async function extractPassport(imageFile) {
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    const base64Image = e.target.result.split(',')[1];
    
    const response = await fetch('/api/genai/extract-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: base64Image,
        documentType: 'passport'
      })
    });
    
    const data = await response.json();
    console.log('Extracted passport data:', data.data);
  };
  
  reader.readAsDataURL(imageFile);
}
```

## Common Use Cases

### Use Case 1: Smart Flight Search

```javascript
// User types natural language query
const query = "I need a direct flight to Paris next week, preferably in the morning";

// Semantic search finds relevant flights
const flights = await semanticSearch(query);

// Get personalized recommendations
const recommendations = await fetch('/api/genai/personalized-recommendations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUser.id,
    flightIds: flights.map(f => f.id)
  })
}).then(r => r.json());

// Display with AI-generated explanations
displayFlights(recommendations.data);
```

### Use Case 2: Price Monitoring

```javascript
// User searches for flights
const searchParams = {
  origin: "JFK",
  destination: "LAX",
  departureDate: "2025-07-01"
};

// Get price prediction
const prediction = await predictPrice(
  searchParams.origin,
  searchParams.destination,
  searchParams.departureDate
);

// Show recommendation
if (prediction.recommendation === 'book_now') {
  showAlert('Book now! Prices are likely to increase.');
} else if (prediction.recommendation === 'wait') {
  showAlert(`Wait ${prediction.daysToWait} days for potential savings of $${prediction.potentialSavings}`);
}
```

### Use Case 3: Passport Verification

```javascript
// User uploads passport
const passportFile = document.getElementById('passport-upload').files[0];

// Extract information
const passportData = await extractPassport(passportFile);

// Validate
const validation = await fetch('/api/genai/validate-passport', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(passportData.extractedData)
}).then(r => r.json());

// Show warnings
if (validation.data.warnings.length > 0) {
  showWarnings(validation.data.warnings);
}

// Auto-fill booking form
fillBookingForm(passportData.extractedData);
```

### Use Case 4: Proactive Assistance

```javascript
// After booking, start monitoring
await fetch('/api/genai/monitor-flight', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bookingId: booking.id,
    userId: user.id,
    flightId: flight.id,
    alertPreferences: {
      delays: true,
      gateChanges: true,
      weatherAlerts: true
    }
  })
});

// Get travel tips before departure
const tips = await fetch('/api/genai/travel-tips', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: user.id,
    bookingId: booking.id
  })
}).then(r => r.json());

displayTravelTips(tips.data.tips);
```

## Performance Tips

1. **Caching**: Cache embeddings in Elasticsearch
2. **Batch Operations**: Use batch endpoints for multiple flights
3. **Async Processing**: Process embeddings asynchronously
4. **Rate Limiting**: Implement rate limiting for AI endpoints
5. **Error Handling**: Always handle AI service failures gracefully

## Troubleshooting

### Issue: Embedding generation fails

**Solution**: Check GCP credentials and Vertex AI API is enabled
```bash
gcloud auth application-default login
gcloud services enable aiplatform.googleapis.com
```

### Issue: Vector search returns no results

**Solution**: Ensure flights are indexed with embeddings
```bash
npm run seed-flights
```

### Issue: Slow response times

**Solution**: 
- Reduce `topK` parameter
- Use appropriate `minScore` threshold
- Enable Elasticsearch caching

### Issue: Multimodal extraction fails

**Solution**: 
- Verify image is base64 encoded
- Check image size (< 10MB recommended)
- Ensure Gemini Vision API is enabled

## Next Steps

1. **Explore Full Documentation**: See [GEN_AI_FEATURES.md](./GEN_AI_FEATURES.md)
2. **Customize Prompts**: Modify prompts in service files
3. **Add Custom Features**: Extend services for your use case
4. **Deploy to Production**: See deployment guide
5. **Monitor Performance**: Set up logging and metrics

## Support

- **Documentation**: [GEN_AI_FEATURES.md](./GEN_AI_FEATURES.md)
- **Architecture**: [GEN_AI_ARCHITECTURE.md](./GEN_AI_ARCHITECTURE.md)
- **Issues**: Check service logs for detailed error messages

## Example Responses

### Semantic Search Response
```json
{
  "success": true,
  "data": {
    "query": "cheap morning flights to Europe",
    "results": [
      {
        "flight": {
          "id": "FL001",
          "airline": "Delta Air Lines",
          "price": 450,
          ...
        },
        "score": 0.89,
        "similarity": 0.89
      }
    ],
    "count": 5
  }
}
```

### Price Prediction Response
```json
{
  "success": true,
  "data": {
    "currentPrice": 650,
    "predictedPrice": 680,
    "trend": "increasing",
    "confidence": 0.82,
    "recommendation": "book_now",
    "reasoning": "Prices are trending upward. Book within 3 days to avoid increases."
  }
}
```

### RAG Query Response
```json
{
  "success": true,
  "data": {
    "answer": "For a family with young children, I recommend Flight FL002...",
    "sources": [...],
    "confidence": 0.88,
    "reasoning": "Generated using RAG with retrieved flight data"
  }
}
```

---

Happy coding! 🚀
