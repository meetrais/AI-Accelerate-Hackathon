# Gen AI Testing Guide

Complete testing guide for all Gen AI features.

## Prerequisites

1. Services initialized: `npm run init-genai`
2. Flights seeded: `npm run seed-flights`
3. Server running: `npm run dev`

## Test Suite

### 1. Semantic Search Tests

#### Test 1.1: Basic Semantic Search
```bash
curl -X POST http://localhost:3000/api/genai/semantic-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "cheap morning flights to Europe",
    "topK": 5,
    "minScore": 0.7
  }'
```

**Expected**: Returns 5 flights with similarity scores > 0.7

#### Test 1.2: Complex Semantic Query
```bash
curl -X POST http://localhost:3000/api/genai/semantic-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "direct flights with good legroom for tall passengers, preferably window seats",
    "topK": 3
  }'
```

**Expected**: Returns relevant flights based on semantic understanding

#### Test 1.3: Filtered Semantic Search
```bash
curl -X POST http://localhost:3000/api/genai/semantic-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "budget friendly flights",
    "topK": 5,
    "filters": {
      "origin": "JFK",
      "destination": "LAX",
      "maxPrice": 300
    }
  }'
```

**Expected**: Returns flights matching filters with semantic relevance

---

### 2. RAG (Retrieval Augmented Generation) Tests

#### Test 2.1: Flight Question
```bash
curl -X POST http://localhost:3000/api/genai/rag-query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Which flight is best for a business traveler who values time over cost?",
    "flightIds": ["FL001", "FL002", "FL003"]
  }'
```

**Expected**: Detailed answer with reasoning based on flight data

#### Test 2.2: Policy Explanation
```bash
curl -X POST http://localhost:3000/api/genai/explain-policy \
  -H "Content-Type: application/json" \
  -d '{
    "policyType": "baggage",
    "airline": "Delta Air Lines"
  }'
```

**Expected**: Clear, natural language explanation of baggage policy

#### Test 2.3: Itinerary Generation
```bash
curl -X POST http://localhost:3000/api/genai/generate-itinerary \
  -H "Content-Type: application/json" \
  -d '{
    "flightIds": ["FL001"],
    "destination": "Paris",
    "tripDuration": 5,
    "interests": ["art", "food", "history"]
  }'
```

**Expected**: Detailed 5-day itinerary with personalized recommendations

---

### 3. Predictive Analytics Tests

#### Test 3.1: Price Prediction
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

**Expected**: 
```json
{
  "currentPrice": 650,
  "predictedPrice": 680,
  "trend": "increasing",
  "confidence": 0.82,
  "recommendation": "book_now",
  "reasoning": "..."
}
```

#### Test 3.2: Delay Prediction
```bash
curl -X POST http://localhost:3000/api/genai/predict-delay \
  -H "Content-Type: application/json" \
  -d '{
    "flightId": "FL001",
    "weatherConditions": {
      "rain": true,
      "wind": 25
    }
  }'
```

**Expected**:
```json
{
  "probability": 0.35,
  "expectedDelay": 21,
  "factors": ["Precipitation may cause delays", "..."],
  "confidence": 0.75,
  "recommendation": "..."
}
```

#### Test 3.3: Demand Forecast
```bash
curl -X POST http://localhost:3000/api/genai/forecast-demand \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "JFK",
    "destination": "LAX",
    "date": "2025-07-04"
  }'
```

**Expected**: Demand level, availability trend, price impact

#### Test 3.4: Optimal Booking Time
```bash
curl -X POST http://localhost:3000/api/genai/optimal-booking-time \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "JFK",
    "destination": "LHR",
    "departureDate": "2025-08-15"
  }'
```

**Expected**: Optimal booking date, current status, potential savings

---

### 4. Multimodal AI Tests

#### Test 4.1: Passport Extraction (Mock)
```bash
# Note: Replace with actual base64 image data
curl -X POST http://localhost:3000/api/genai/extract-document \
  -H "Content-Type: application/json" \
  -d '{
    "imageData": "base64_encoded_passport_image",
    "documentType": "passport"
  }'
```

**Expected**:
```json
{
  "documentType": "passport",
  "extractedData": {
    "passportNumber": "...",
    "firstName": "...",
    "lastName": "...",
    "nationality": "...",
    "dateOfBirth": "...",
    "expiryDate": "..."
  },
  "confidence": 0.92,
  "validationErrors": [],
  "warnings": []
}
```

#### Test 4.2: Passport Validation
```bash
curl -X POST http://localhost:3000/api/genai/validate-passport \
  -H "Content-Type: application/json" \
  -d '{
    "passportNumber": "AB1234567",
    "firstName": "John",
    "lastName": "Doe",
    "nationality": "USA",
    "dateOfBirth": "1990-01-15",
    "expiryDate": "2026-01-15",
    "issuingCountry": "USA"
  }'
```

**Expected**:
```json
{
  "isValid": true,
  "errors": [],
  "warnings": []
}
```

#### Test 4.3: Expired Passport
```bash
curl -X POST http://localhost:3000/api/genai/validate-passport \
  -H "Content-Type: application/json" \
  -d '{
    "passportNumber": "AB1234567",
    "firstName": "John",
    "lastName": "Doe",
    "nationality": "USA",
    "dateOfBirth": "1990-01-15",
    "expiryDate": "2024-01-15",
    "issuingCountry": "USA"
  }'
```

**Expected**:
```json
{
  "isValid": false,
  "errors": ["Passport has expired"],
  "warnings": []
}
```

---

### 5. Personalization Tests

#### Test 5.1: Get User Profile
```bash
curl http://localhost:3000/api/genai/user-profile/user123
```

**Expected**: User profile with preferences, history, behavior patterns

#### Test 5.2: Personalized Recommendations
```bash
curl -X POST http://localhost:3000/api/genai/personalized-recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "flightIds": ["FL001", "FL002", "FL003", "FL004", "FL005"]
  }'
```

**Expected**: Flights ranked by personalization score with reasons

#### Test 5.3: Predict Preferences
```bash
curl -X POST http://localhost:3000/api/genai/predict-preferences \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123"
  }'
```

**Expected**: AI predictions about user preferences with insights

#### Test 5.4: Search Suggestions
```bash
curl http://localhost:3000/api/genai/search-suggestions/user123
```

**Expected**: Personalized search suggestions based on history

---

### 6. Proactive Assistance Tests

#### Test 6.1: Start Flight Monitoring
```bash
curl -X POST http://localhost:3000/api/genai/monitor-flight \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BK123456",
    "userId": "user123",
    "flightId": "FL001",
    "alertPreferences": {
      "delays": true,
      "gateChanges": true,
      "priceDrops": false,
      "weatherAlerts": true
    }
  }'
```

**Expected**: Confirmation that monitoring started

#### Test 6.2: Rebooking Suggestions
```bash
curl -X POST http://localhost:3000/api/genai/suggest-rebooking \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BK123456",
    "reason": "cancellation"
  }'
```

**Expected**: Alternative flights with AI recommendation

#### Test 6.3: Travel Tips
```bash
curl -X POST http://localhost:3000/api/genai/travel-tips \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "bookingId": "BK123456"
  }'
```

**Expected**: 5-7 personalized travel tips

#### Test 6.4: Check-in Assistance
```bash
curl -X POST http://localhost:3000/api/genai/check-in-assist \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BK123456"
  }'
```

**Expected**: Check-in instructions, tips, and warnings

---

## Integration Tests

### Test 7: Complete User Journey

#### Step 1: Semantic Search
```bash
SEARCH_RESULT=$(curl -s -X POST http://localhost:3000/api/genai/semantic-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "affordable direct flights to Europe next month",
    "topK": 5
  }')

echo $SEARCH_RESULT | jq '.data.results[0].flight.id'
```

#### Step 2: Get Personalized Recommendations
```bash
FLIGHT_IDS=$(echo $SEARCH_RESULT | jq -r '.data.results[].flight.id' | jq -R . | jq -s .)

curl -X POST http://localhost:3000/api/genai/personalized-recommendations \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"user123\",
    \"flightIds\": $FLIGHT_IDS
  }"
```

#### Step 3: Check Price Prediction
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

#### Step 4: Start Monitoring
```bash
curl -X POST http://localhost:3000/api/genai/monitor-flight \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BK123456",
    "userId": "user123",
    "flightId": "FL001",
    "alertPreferences": {
      "delays": true,
      "gateChanges": true,
      "weatherAlerts": true
    }
  }'
```

---

## Performance Tests

### Test 8: Latency Benchmarks

#### Embedding Generation
```bash
time curl -X POST http://localhost:3000/api/genai/semantic-search \
  -H "Content-Type: application/json" \
  -d '{"query": "test query", "topK": 1}'
```

**Target**: < 1 second

#### RAG Response
```bash
time curl -X POST http://localhost:3000/api/genai/rag-query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Which flight is best?",
    "flightIds": ["FL001", "FL002"]
  }'
```

**Target**: < 3 seconds

#### Price Prediction
```bash
time curl -X POST http://localhost:3000/api/genai/predict-price \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "JFK",
    "destination": "LAX",
    "departureDate": "2025-06-15"
  }'
```

**Target**: < 2 seconds

---

## Error Handling Tests

### Test 9: Invalid Inputs

#### Invalid Flight ID
```bash
curl -X POST http://localhost:3000/api/genai/predict-delay \
  -H "Content-Type: application/json" \
  -d '{
    "flightId": "INVALID_ID"
  }'
```

**Expected**: 404 error with clear message

#### Missing Required Field
```bash
curl -X POST http://localhost:3000/api/genai/semantic-search \
  -H "Content-Type: application/json" \
  -d '{
    "topK": 5
  }'
```

**Expected**: 400 validation error

#### Invalid Date Format
```bash
curl -X POST http://localhost:3000/api/genai/predict-price \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "JFK",
    "destination": "LAX",
    "departureDate": "invalid-date"
  }'
```

**Expected**: 400 validation error

---

## Automated Test Script

Save as `test-genai.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000/api/genai"

echo "🧪 Testing Gen AI Features..."
echo ""

# Test 1: Semantic Search
echo "1️⃣  Testing Semantic Search..."
RESULT=$(curl -s -X POST $BASE_URL/semantic-search \
  -H "Content-Type: application/json" \
  -d '{"query": "cheap flights", "topK": 3}')

if echo $RESULT | jq -e '.success' > /dev/null; then
  echo "✅ Semantic Search: PASS"
else
  echo "❌ Semantic Search: FAIL"
fi

# Test 2: Price Prediction
echo "2️⃣  Testing Price Prediction..."
RESULT=$(curl -s -X POST $BASE_URL/predict-price \
  -H "Content-Type: application/json" \
  -d '{"origin": "JFK", "destination": "LAX", "departureDate": "2025-06-15"}')

if echo $RESULT | jq -e '.success' > /dev/null; then
  echo "✅ Price Prediction: PASS"
else
  echo "❌ Price Prediction: FAIL"
fi

# Test 3: RAG Query
echo "3️⃣  Testing RAG Query..."
RESULT=$(curl -s -X POST $BASE_URL/rag-query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the best flight?"}')

if echo $RESULT | jq -e '.success' > /dev/null; then
  echo "✅ RAG Query: PASS"
else
  echo "❌ RAG Query: FAIL"
fi

# Test 4: User Profile
echo "4️⃣  Testing User Profile..."
RESULT=$(curl -s $BASE_URL/user-profile/test-user)

if echo $RESULT | jq -e '.success' > /dev/null; then
  echo "✅ User Profile: PASS"
else
  echo "❌ User Profile: FAIL"
fi

echo ""
echo "🎉 Testing Complete!"
```

Run with:
```bash
chmod +x test-genai.sh
./test-genai.sh
```

---

## Troubleshooting

### Issue: All tests fail with connection error
**Solution**: Ensure server is running on port 3000

### Issue: Semantic search returns no results
**Solution**: Run `npm run seed-flights` to index flights with embeddings

### Issue: RAG responses are slow
**Solution**: Normal for first request (cold start). Subsequent requests should be faster

### Issue: Multimodal tests fail
**Solution**: Ensure Gemini Vision API is enabled in GCP

### Issue: Personalization returns default values
**Solution**: User profile is created on first access. Make some searches/bookings to populate data

---

## Success Criteria

✅ All semantic search tests return relevant results  
✅ RAG responses are grounded in flight data  
✅ Price predictions include confidence scores  
✅ Delay predictions consider multiple factors  
✅ Document extraction works with test images  
✅ Personalization adapts to user behavior  
✅ Proactive assistance provides actionable recommendations  
✅ All endpoints return proper error messages  
✅ Response times meet performance targets  

---

## Next Steps

1. **Frontend Integration**: Integrate tested endpoints into UI
2. **Load Testing**: Test with concurrent users
3. **Monitoring**: Set up logging and metrics
4. **Optimization**: Cache frequently accessed data
5. **Production**: Deploy to GCP Cloud Run

---

Happy Testing! 🧪✅
