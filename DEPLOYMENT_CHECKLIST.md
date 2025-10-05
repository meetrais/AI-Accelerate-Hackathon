# Production Deployment Checklist

Complete checklist for deploying the Gen AI Flight Booking Assistant to production.

## Pre-Deployment

### 1. GCP Setup ✓

#### Project Configuration
- [ ] Create GCP project
- [ ] Enable billing
- [ ] Set up project quotas
- [ ] Configure IAM roles

#### Enable Required APIs
```bash
gcloud services enable aiplatform.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
```

#### Service Accounts
- [ ] Create service account for Cloud Run
- [ ] Grant Vertex AI User role
- [ ] Grant Firestore User role
- [ ] Grant Secret Manager Accessor role
- [ ] Download service account key

### 2. Elasticsearch Setup ✓

#### Cluster Configuration
- [ ] Provision Elasticsearch 8.x+ cluster
- [ ] Enable security features
- [ ] Configure cluster size (min 3 nodes for production)
- [ ] Set up index lifecycle management
- [ ] Configure backup/snapshot policy

#### Index Configuration
- [ ] Create flights index with vector mapping
- [ ] Set up index templates
- [ ] Configure shard allocation
- [ ] Set up index aliases
- [ ] Test vector search performance

#### Security
- [ ] Generate API keys
- [ ] Configure IP allowlist
- [ ] Enable TLS/SSL
- [ ] Set up audit logging

### 3. Firestore Setup ✓

#### Database Configuration
- [ ] Create Firestore database
- [ ] Choose region (same as Cloud Run)
- [ ] Set up collections:
  - [ ] userProfiles
  - [ ] monitoredBookings
  - [ ] priceWatches
  - [ ] alerts
  - [ ] bookings

#### Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profiles - users can only read/write their own
    match /userProfiles/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Bookings - users can only read their own
    match /bookings/{bookingId} {
      allow read: if request.auth.uid == resource.data.userId;
      allow create: if request.auth.uid == request.resource.data.userId;
    }
    
    // Monitored bookings - users can only access their own
    match /monitoredBookings/{bookingId} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }
    
    // Alerts - users can only read their own
    match /alerts/{alertId} {
      allow read: if request.auth.uid == resource.data.userId;
    }
  }
}
```

#### Indexes
- [ ] Create composite indexes for common queries
- [ ] Set up TTL for old data
- [ ] Configure backup schedule

### 4. Environment Configuration ✓

#### Secrets Management
```bash
# Store secrets in Secret Manager
gcloud secrets create elasticsearch-url --data-file=-
gcloud secrets create elasticsearch-api-key --data-file=-
gcloud secrets create stripe-secret-key --data-file=-
gcloud secrets create jwt-secret --data-file=-
```

#### Environment Variables
Create `.env.production`:
```env
NODE_ENV=production
PORT=8080

# GCP
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1

# Elasticsearch
ELASTICSEARCH_URL=https://your-cluster.es.cloud
ELASTICSEARCH_API_KEY=your-api-key

# Firestore
FIRESTORE_PROJECT_ID=your-project-id

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# JWT
JWT_SECRET=your-secure-secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Vertex AI
VERTEX_AI_MODEL=gemini-1.5-pro
VERTEX_AI_EMBEDDING_MODEL=text-embedding-004
VERTEX_AI_VISION_MODEL=gemini-1.5-pro-vision

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
```

### 5. Code Preparation ✓

#### Build & Test
- [ ] Run all tests: `npm test`
- [ ] Run linter: `npm run lint`
- [ ] Build production bundle: `npm run build`
- [ ] Test production build locally
- [ ] Run security audit: `npm audit`
- [ ] Fix critical vulnerabilities

#### Code Quality
- [ ] Remove console.logs (keep structured logging)
- [ ] Remove debug code
- [ ] Optimize bundle size
- [ ] Enable compression
- [ ] Minify assets

#### Documentation
- [ ] Update README.md
- [ ] Document API endpoints
- [ ] Create runbook for operations
- [ ] Document troubleshooting steps

## Deployment

### 6. Docker Configuration ✓

#### Dockerfile
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY src ./src

# Build
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 8080

CMD ["node", "dist/server.js"]
```

#### .dockerignore
```
node_modules
npm-debug.log
.env
.env.*
.git
.gitignore
README.md
*.md
tests
coverage
.vscode
.idea
```

#### Build & Test Docker Image
```bash
# Build
docker build -t flight-booking-assistant .

# Test locally
docker run -p 8080:8080 --env-file .env.production flight-booking-assistant

# Test endpoints
curl http://localhost:8080/health
```

### 7. Cloud Run Deployment ✓

#### Deploy to Cloud Run
```bash
# Build and push to Container Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/flight-booking-assistant

# Deploy to Cloud Run
gcloud run deploy flight-booking-assistant \
  --image gcr.io/PROJECT_ID/flight-booking-assistant \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 80 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --set-secrets \
    ELASTICSEARCH_URL=elasticsearch-url:latest,\
    ELASTICSEARCH_API_KEY=elasticsearch-api-key:latest,\
    STRIPE_SECRET_KEY=stripe-secret-key:latest
```

#### Configure Custom Domain
```bash
# Map custom domain
gcloud run domain-mappings create \
  --service flight-booking-assistant \
  --domain api.yourdomain.com \
  --region us-central1
```

### 8. Initialize Production Data ✓

#### Seed Initial Data
```bash
# SSH into Cloud Run instance or run locally with production credentials
npm run init-genai
npm run seed-flights
```

#### Verify Data
```bash
# Test semantic search
curl https://api.yourdomain.com/api/genai/semantic-search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "topK": 1}'
```

### 9. Monitoring Setup ✓

#### Cloud Monitoring
- [ ] Create dashboard for key metrics:
  - [ ] Request rate
  - [ ] Error rate
  - [ ] Latency (p50, p95, p99)
  - [ ] CPU usage
  - [ ] Memory usage
  - [ ] Vertex AI API calls
  - [ ] Elasticsearch query time

#### Alerts
```bash
# Create alert for high error rate
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s
```

#### Logging
- [ ] Set up log-based metrics
- [ ] Configure log retention
- [ ] Set up log exports to BigQuery
- [ ] Create log-based alerts

### 10. Security Hardening ✓

#### API Security
- [ ] Enable CORS with specific origins
- [ ] Implement rate limiting
- [ ] Add request validation
- [ ] Enable HTTPS only
- [ ] Set security headers
- [ ] Implement API key authentication

#### Data Security
- [ ] Encrypt data at rest
- [ ] Encrypt data in transit
- [ ] Implement data retention policies
- [ ] Set up data backup
- [ ] Configure access controls

#### Compliance
- [ ] GDPR compliance (if applicable)
- [ ] PCI DSS compliance (for payments)
- [ ] Data privacy policy
- [ ] Terms of service
- [ ] Cookie policy

### 11. Performance Optimization ✓

#### Caching
- [ ] Enable Redis/Memorystore for caching
- [ ] Cache embeddings
- [ ] Cache frequent queries
- [ ] Set appropriate TTLs

#### CDN
- [ ] Set up Cloud CDN
- [ ] Configure cache rules
- [ ] Enable compression

#### Database Optimization
- [ ] Optimize Elasticsearch queries
- [ ] Add appropriate indexes
- [ ] Configure connection pooling
- [ ] Enable query caching

### 12. Backup & Disaster Recovery ✓

#### Backup Strategy
- [ ] Elasticsearch snapshots (daily)
- [ ] Firestore backups (daily)
- [ ] Configuration backups
- [ ] Code repository backups

#### Disaster Recovery Plan
- [ ] Document recovery procedures
- [ ] Test recovery process
- [ ] Set up multi-region deployment (optional)
- [ ] Configure failover

## Post-Deployment

### 13. Smoke Tests ✓

#### Health Checks
```bash
# Basic health
curl https://api.yourdomain.com/health

# Semantic search
curl -X POST https://api.yourdomain.com/api/genai/semantic-search \
  -H "Content-Type: application/json" \
  -d '{"query": "cheap flights", "topK": 3}'

# Price prediction
curl -X POST https://api.yourdomain.com/api/genai/predict-price \
  -H "Content-Type: application/json" \
  -d '{"origin": "JFK", "destination": "LAX", "departureDate": "2025-06-15"}'

# RAG query
curl -X POST https://api.yourdomain.com/api/genai/rag-query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the best flight?"}'
```

#### Load Testing
```bash
# Install k6
brew install k6

# Run load test
k6 run load-test.js
```

### 14. Monitoring & Alerts ✓

#### Set Up Alerts
- [ ] High error rate (> 5%)
- [ ] High latency (p99 > 3s)
- [ ] Low availability (< 99%)
- [ ] High memory usage (> 80%)
- [ ] High CPU usage (> 80%)
- [ ] Vertex AI quota exceeded
- [ ] Elasticsearch cluster health

#### Dashboard
- [ ] Create operations dashboard
- [ ] Set up business metrics dashboard
- [ ] Configure real-time monitoring

### 15. Documentation ✓

#### Operations Runbook
- [ ] Deployment procedures
- [ ] Rollback procedures
- [ ] Incident response
- [ ] Troubleshooting guide
- [ ] Contact information

#### API Documentation
- [ ] OpenAPI/Swagger spec
- [ ] Example requests/responses
- [ ] Authentication guide
- [ ] Rate limiting info

### 16. Team Training ✓

#### Knowledge Transfer
- [ ] Architecture overview
- [ ] Code walkthrough
- [ ] Operations training
- [ ] Incident response training
- [ ] Monitoring dashboard training

## Ongoing Maintenance

### Daily
- [ ] Check error logs
- [ ] Monitor key metrics
- [ ] Review alerts

### Weekly
- [ ] Review performance metrics
- [ ] Check cost optimization
- [ ] Review security logs
- [ ] Update dependencies

### Monthly
- [ ] Security audit
- [ ] Performance review
- [ ] Cost analysis
- [ ] Capacity planning
- [ ] Backup verification

### Quarterly
- [ ] Disaster recovery test
- [ ] Security penetration test
- [ ] Architecture review
- [ ] Technology updates

## Rollback Plan

### If Deployment Fails

#### Immediate Rollback
```bash
# Rollback to previous revision
gcloud run services update-traffic flight-booking-assistant \
  --to-revisions PREVIOUS_REVISION=100 \
  --region us-central1
```

#### Investigate
1. Check Cloud Logging for errors
2. Review deployment changes
3. Test in staging environment
4. Fix issues
5. Redeploy

### If Issues Found Post-Deployment

#### Quick Fix
1. Identify issue
2. Apply hotfix
3. Deploy patch
4. Monitor closely

#### Major Issue
1. Rollback immediately
2. Investigate thoroughly
3. Fix in development
4. Test extensively
5. Redeploy with confidence

## Success Criteria

### Technical
- ✅ All health checks passing
- ✅ Error rate < 1%
- ✅ p99 latency < 3s
- ✅ Availability > 99.9%
- ✅ All tests passing

### Business
- ✅ Users can search flights
- ✅ Semantic search returns relevant results
- ✅ Predictions are accurate
- ✅ Documents process correctly
- ✅ Personalization works
- ✅ Proactive alerts sent

## Contact Information

### On-Call
- Primary: [Name] - [Phone] - [Email]
- Secondary: [Name] - [Phone] - [Email]

### Escalation
- Engineering Lead: [Name] - [Email]
- CTO: [Name] - [Email]

### External Support
- GCP Support: [Support Plan]
- Elasticsearch Support: [Support Plan]
- Stripe Support: [Support Plan]

---

## Deployment Sign-Off

- [ ] All checklist items completed
- [ ] Smoke tests passed
- [ ] Monitoring configured
- [ ] Team trained
- [ ] Documentation complete
- [ ] Rollback plan tested

**Deployed By**: _______________  
**Date**: _______________  
**Approved By**: _______________  
**Date**: _______________  

---

**Ready for Production!** 🚀
