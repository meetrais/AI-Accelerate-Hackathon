# Quick Start: Gen AI Showcase

## 🚀 Start the Application

### 1. Start Backend (Terminal 1)
```bash
npm run dev
```
Backend runs on: http://localhost:3000

### 2. Start Frontend (Terminal 2)
```bash
cd frontend
npm start
```
Frontend runs on: http://localhost:3001

## 🎯 Using the Gen AI Showcase

### Access the Showcase
1. Open http://localhost:3001 in your browser
2. Click the **"🤖 View Gen AI Showcase"** button in the top-right corner
3. You'll see a dark-themed interface with 5 tabs

### Try Each Feature

#### 🔍 Tab 1: Semantic Search
**What it does:** Finds flights using natural language and AI understanding

**Try it:**
1. Click "Semantic Search" tab
2. Type: `cheap flights to beach destinations`
3. Click "🔍 Search"
4. See results with relevance scores

**Other examples:**
- "business class to tech hubs"
- "weekend getaway to warm places"
- "direct flights to Europe"

#### 📊 Tab 2: Price Prediction
**What it does:** Predicts future flight prices using ML

**Try it:**
1. Click "Price Prediction" tab
2. Click "📊 Predict Price"
3. See predicted price, confidence level, and trend
4. Get recommendation (book now or wait)

**Shows:**
- Predicted price for JFK → LAX in 30 days
- Confidence percentage
- Price trend (up ↑ or down ↓)
- Actionable recommendation

#### 📚 Tab 3: Document Q&A (RAG)
**What it does:** Answers questions about policies using uploaded documents

**Try it:**
1. Click "Document Q&A (RAG)" tab
2. Type: `What is the baggage allowance?`
3. Click "💬 Ask Question"
4. See answer with source documents

**Other examples:**
- "Can I change my flight?"
- "What are the cancellation fees?"
- "Do I need a visa?"

#### ✨ Tab 4: AI Recommendations
**What it does:** Shows personalized recommendations

**Try it:**
1. Click "AI Recommendations" tab
2. See your preferences (Budget-friendly, Direct flights, etc.)
3. See trending destinations

**Features:**
- Personalized based on history
- Popular destinations
- Preference tags

#### 📋 Tab 5: System Overview
**What it does:** Shows complete system architecture

**Try it:**
1. Click "System Overview" tab
2. See core technologies
3. See all features
4. See API endpoints

**Information:**
- Technologies: Vertex AI, Elasticsearch, RAG
- Features: All AI capabilities
- API endpoints: Complete list

## 🔄 Switch Back to Booking

Click **"← Back to Booking"** button in top-right to return to the booking interface.

## 🎨 Visual Guide

### Booking Interface (Light Theme)
- Professional, clean design
- Focus on booking flow
- Step-by-step process
- Button: "🤖 View Gen AI Showcase" (top-right)

### Showcase Interface (Dark Theme)
- Modern, tech-focused design
- Tab-based navigation
- Feature exploration
- Button: "← Back to Booking" (top-right)

## 🧪 Testing Checklist

- [ ] Backend is running (http://localhost:3000)
- [ ] Frontend is running (http://localhost:3001)
- [ ] Can access booking interface
- [ ] Can click "View Gen AI Showcase" button
- [ ] Can see all 5 tabs
- [ ] Can test semantic search
- [ ] Can test price prediction
- [ ] Can test document Q&A
- [ ] Can test recommendations
- [ ] Can view system overview
- [ ] Can click "Back to Booking" button

## 🐛 Troubleshooting

### Backend not responding
```bash
# Check if backend is running
curl http://localhost:3000/ping

# Restart backend
npm run dev
```

### Frontend not loading
```bash
# Clear cache and restart
cd frontend
rm -rf node_modules/.cache
npm start
```

### API errors in showcase
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Verify backend is running on port 3000

### Showcase button not visible
1. Refresh the page (Ctrl+R)
2. Clear browser cache (Ctrl+Shift+Delete)
3. Try a different browser

## 📊 Expected Results

### Semantic Search
- Returns 5 flights with relevance scores
- Shows airline, route, price
- Displays similarity score (0-100%)

### Price Prediction
- Shows predicted price (e.g., $475)
- Shows confidence (e.g., 85%)
- Shows trend (↑ or ↓)
- Provides recommendation

### Document Q&A
- Returns detailed answer
- Shows source documents
- Provides context from uploaded docs

### Recommendations
- Shows user preferences
- Shows trending destinations
- Displays preference badges

### System Overview
- Lists all technologies
- Lists all features
- Lists all API endpoints

## 🎯 Demo Script (For Presentations)

1. **Start**: "Let me show you our Gen AI capabilities"
2. **Click Showcase**: "Click this button to access the showcase"
3. **Semantic Search**: "Watch how it understands 'beach destinations'"
4. **Price Prediction**: "Our ML model predicts future prices"
5. **Document Q&A**: "Ask any policy question, it finds the answer"
6. **Recommendations**: "Personalized suggestions based on behavior"
7. **Overview**: "Here's the complete architecture"
8. **Back**: "And we can switch back to booking anytime"

## 🎉 Success!

You now have a fully functional Gen AI Showcase that demonstrates:
- ✅ Semantic search with vector embeddings
- ✅ ML-based price predictions
- ✅ RAG-powered document Q&A
- ✅ AI recommendations
- ✅ Complete system documentation

Enjoy exploring the AI capabilities! 🚀
