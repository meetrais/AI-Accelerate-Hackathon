# Vertex AI Quota Management Guide

## 🎯 Understanding the Issue

### What Happened
Your Vertex AI quota was exceeded because:
1. **Free tier limits**: 60 requests per minute
2. **Batch processing**: Tried to process 48 flights at once
3. **No rate limiting**: All requests sent simultaneously
4. **Multiple operations**: Testing + seeding used quota quickly

### Why It Matters
- **Development**: Slows down testing and development
- **Production**: Can cause service outages
- **Costs**: Higher quotas require paid tier

## 🛠️ Solutions Implemented

### 1. ✅ Automatic Rate Limiting
The embedding service now includes:
- **Request tracking**: Monitors requests per minute
- **Automatic delays**: 1.2 seconds between requests (50/min)
- **Quota reset**: Automatically resets counter every minute
- **Wait mechanism**: Pauses when limit reached

```typescript
// Automatically applied to all embedding requests
await embeddingService.generateEmbedding(text);
// ↑ Now includes rate limiting
```

### 2. ✅ Caching
- **In-memory cache**: Stores generated embeddings
- **Avoids duplicates**: Reuses embeddings for similar text
- **Automatic**: No code changes needed

### 3. ✅ Progress Tracking
- **Real-time updates**: Shows progress every 10 flights
- **Time estimates**: Displays estimated completion time
- **Transparency**: Know exactly what's happening

### 4. ✅ Configuration
- **Environment variables**: Control rate limits via `.env`
- **Flexible limits**: Adjust based on your quota
- **Easy updates**: No code changes needed

## 📊 Current Configuration

### Default Limits (Conservative)
```env
VERTEX_AI_EMBEDDINGS_RPM=50    # 50 requests/minute (safe)
VERTEX_AI_GEMINI_RPM=50        # 50 requests/minute
VERTEX_AI_VISION_RPM=30        # 30 requests/minute
```

### Why 50 instead of 60?
- **Safety margin**: Prevents hitting exact limit
- **Network delays**: Accounts for latency
- **Concurrent requests**: Leaves room for other operations

## 🚀 How to Use

### For Development (Free Tier)
Keep defaults in `.env`:
```env
VERTEX_AI_EMBEDDINGS_RPM=50
```

**Expected times**:
- 48 flights: ~1 minute
- 100 flights: ~2 minutes
- 500 flights: ~10 minutes

### For Production (Paid Tier)
After quota increase, update `.env`:
```env
VERTEX_AI_EMBEDDINGS_RPM=300   # If you have 300 RPM quota
```

**Expected times**:
- 48 flights: ~10 seconds
- 100 flights: ~20 seconds
- 500 flights: ~2 minutes

## 📈 Request Quota Increase

### Step 1: Check Current Quota
```bash
# Go to GCP Console
https://console.cloud.google.com/iam-admin/quotas?service=aiplatform.googleapis.com

# Look for:
# "Generate content requests per minute per project per base model"
```

### Step 2: Request Increase
1. Select the quota
2. Click "EDIT QUOTAS"
3. Enter desired limit (e.g., 300)
4. Provide justification:

```
Justification Example:
"Production flight booking application with semantic search, RAG, 
and document processing. Need to index 1000+ flights daily and 
handle 100+ concurrent users. Current 60 RPM limit causes service 
delays and poor user experience."
```

### Step 3: Wait for Approval
- **Timeline**: 1-2 business days
- **Notification**: Email when approved
- **Automatic**: Takes effect immediately

### Recommended Quotas

| Use Case | Embeddings RPM | Gemini RPM | Vision RPM |
|----------|----------------|------------|------------|
| Development | 60 (free) | 60 (free) | 60 (free) |
| Staging | 100 | 100 | 60 |
| Production (Small) | 300 | 300 | 100 |
| Production (Medium) | 500 | 500 | 200 |
| Production (Large) | 1000 | 1000 | 500 |

## 🔧 Monitoring Quota Usage

### Check Usage in Real-Time
```bash
# Using gcloud CLI
gcloud monitoring time-series list \
  --filter='metric.type="aiplatform.googleapis.com/quota/generate_content_requests/usage"' \
  --format="table(metric.labels.quota_metric, point.value)"
```

### Set Up Alerts
1. Go to **Cloud Monitoring** → **Alerting**
2. Create alert:
   - Metric: `aiplatform.googleapis.com/quota/usage`
   - Condition: Usage > 80%
   - Notification: Email/Slack

### View in Console
```
https://console.cloud.google.com/monitoring/dashboards
```

## 💡 Best Practices

### 1. Batch Processing
```typescript
// ❌ Bad: Process all at once
for (const flight of flights) {
  await generateEmbedding(flight);
}

// ✅ Good: Use rate-limited batch processing
await vectorSearchService.batchIndexFlights(flights);
// ↑ Automatically rate limited
```

### 2. Cache Aggressively
```typescript
// Embeddings are cached automatically
// Same text = cached result (no API call)
```

### 3. Process During Off-Peak
```bash
# Schedule seeding during low-traffic times
# e.g., 2 AM - 6 AM
0 2 * * * npm run seed-flights
```

### 4. Use Batch Endpoints
```typescript
// ✅ Better: Batch operations when possible
await embeddingService.generateBatchEmbeddings(texts);
```

### 5. Monitor and Alert
- Set up quota alerts at 80%
- Monitor daily usage trends
- Plan capacity ahead of time

## 🐛 Troubleshooting

### Error: "Quota exceeded"
**Solution**: Wait 1 minute for quota to reset, or:
```bash
# Check when quota resets
# Quotas reset every minute (rolling window)
```

### Error: "Too many requests"
**Solution**: Reduce rate limit in `.env`:
```env
VERTEX_AI_EMBEDDINGS_RPM=30  # Lower limit
```

### Slow Processing
**Expected**: With rate limiting, processing takes time
- 50 RPM = ~1 minute per 50 items
- This is normal and prevents quota errors

### Cache Not Working
**Solution**: Cache is in-memory, clears on restart
- For persistent cache, use Redis (future enhancement)

## 📊 Cost Optimization

### Free Tier
- **Embeddings**: 60 RPM free
- **Gemini**: 60 RPM free
- **Vision**: 60 RPM free
- **Total**: ~$0/month

### Paid Tier (Example)
- **Embeddings**: $0.00025 per 1K characters
- **Gemini**: $0.00025 per 1K characters
- **Vision**: $0.0025 per image

**Estimated costs** (1000 flights/day):
- Embeddings: ~$0.50/day
- Gemini (100 queries): ~$0.10/day
- Vision (50 documents): ~$0.13/day
- **Total**: ~$0.73/day = ~$22/month

## 🎯 Quick Reference

### Check Quota
```bash
gcloud compute project-info describe --project=YOUR_PROJECT_ID
```

### Update Rate Limit
```bash
# Edit .env
VERTEX_AI_EMBEDDINGS_RPM=100
```

### Test Rate Limiting
```bash
npm run seed-flights
# Watch for: "⏳ Rate limit reached. Waiting..."
```

### Monitor Progress
```bash
# Output shows:
# Progress: 10/48 flights (21%)
# Progress: 20/48 flights (42%)
```

## 📞 Support

### GCP Support
- **Free tier**: Community support only
- **Paid tier**: Email/phone support
- **Enterprise**: 24/7 support

### Quota Increase Request
- **URL**: https://console.cloud.google.com/iam-admin/quotas
- **Timeline**: 1-2 business days
- **Cost**: Free (just need paid billing account)

---

## Summary

✅ **Rate limiting implemented** - Automatic, no code changes needed  
✅ **Caching added** - Reduces duplicate API calls  
✅ **Progress tracking** - Know what's happening  
✅ **Configuration** - Easy to adjust via `.env`  
✅ **Documentation** - This guide for reference  

**Next steps**:
1. Wait for quota to reset (~1 minute)
2. Run `npm run seed-flights` again
3. Watch it process with rate limiting
4. Request quota increase for production

🎉 **No more quota errors!**
