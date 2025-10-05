# Google Cloud Platform Deployment Guide

This guide provides step-by-step instructions for deploying the Flight Booking Assistant to Google Cloud Platform.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and configured
3. **Docker** installed (for local testing)
4. **Node.js 18+** and npm installed

## Required GCP Resources

You'll need to create these resources manually before deployment:

### 1. Google Cloud Project
```bash
# Create a new project (replace with your preferred project ID)
gcloud projects create your-project-id --name="Flight Booking Assistant"

# Set as default project
gcloud config set project your-project-id

# Enable billing (required for most services)
# This must be done through the GCP Console
```

### 2. Service Account
```bash
# Create service account
gcloud iam service-accounts create flight-booking-sa \
    --display-name="Flight Booking Assistant Service Account"

# Grant necessary roles
gcloud projects add-iam-policy-binding your-project-id \
    --member="serviceAccount:flight-booking-sa@your-project-id.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding your-project-id \
    --member="serviceAccount:flight-booking-sa@your-project-id.iam.gserviceaccount.com" \
    --role="roles/datastore.user"

gcloud projects add-iam-policy-binding your-project-id \
    --member="serviceAccount:flight-booking-sa@your-project-id.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Create and download service account key
gcloud iam service-accounts keys create service-account-key.json \
    --iam-account=flight-booking-sa@your-project-id.iam.gserviceaccount.com
```

### 3. Firestore Database
```bash
# Create Firestore database in Native mode
gcloud firestore databases create --region=us-central1
```

### 4. Enable Vertex AI
```bash
# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# No additional setup required - Gemini Pro is available by default
```

### 5. Elastic Cloud Setup
You'll need to set up Elastic Cloud separately:

1. Go to [Elastic Cloud](https://cloud.elastic.co/)
2. Create a new deployment
3. Choose the appropriate region (preferably same as your GCP region)
4. Note down your Cloud ID and API Key
5. Configure the deployment with appropriate resources

### 6. External Service Keys
Obtain API keys for:
- **Stripe**: Create account at [stripe.com](https://stripe.com) and get API keys
- **SendGrid**: Create account at [sendgrid.com](https://sendgrid.com) and get API key

## Deployment Steps

### Step 1: Clone and Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd flight-booking-assistant

# Install dependencies
npm install
cd frontend && npm install && cd ..
```

### Step 2: Configure Environment
```bash
# Copy production environment template
cp .env.production .env

# Edit .env with your actual values
# Replace placeholders with your actual project ID, keys, etc.
```

### Step 3: Setup Secrets
```bash
# Run the secrets setup script
npm run setup-secrets

# This will prompt you for:
# - Path to service account key file
# - Elastic Cloud ID and API Key
# - Stripe API keys
# - SendGrid API key and from email
```

### Step 4: Build and Test Locally
```bash
# Build the application
npm run build

# Test with Docker locally
npm run docker:build
npm run docker:run

# Test the health endpoint
curl http://localhost:8080/health
```

### Step 5: Deploy to Cloud Run
```bash
# Deploy using the deployment script
npm run deploy

# Or manually with gcloud
gcloud builds submit --config cloudbuild.yaml
```

### Step 6: Configure Custom Domain (Optional)
```bash
# Map custom domain to Cloud Run service
gcloud run domain-mappings create \
    --service=flight-booking-assistant \
    --domain=your-domain.com \
    --region=us-central1
```

## Post-Deployment Configuration

### 1. Update Frontend Configuration
Update `frontend/.env.production` with your actual Cloud Run service URL:
```bash
REACT_APP_API_URL=https://your-service-url/api
```

### 2. Configure CORS
Update the CORS configuration in your environment variables to allow your frontend domain.

### 3. Setup Monitoring
The application includes built-in monitoring endpoints:
- Health: `https://your-service-url/health`
- Metrics: `https://your-service-url/api/monitoring/dashboard`
- Logs: `https://your-service-url/api/monitoring/logs`

### 4. Configure Alerts
Set up Cloud Monitoring alerts for:
- Service availability
- Error rates
- Response times
- Memory usage

## Environment Variables Reference

### Required Environment Variables
```bash
# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/secrets/service-account/key.json

# Firestore
FIRESTORE_PROJECT_ID=your-project-id

# Vertex AI
VERTEX_AI_PROJECT_ID=your-project-id
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-pro

# Elasticsearch (stored in Secret Manager)
ELASTIC_CLOUD_ID=your-elastic-cloud-id
ELASTIC_API_KEY=your-elastic-api-key

# Stripe (stored in Secret Manager)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# SendGrid (stored in Secret Manager)
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@your-domain.com

# Application
NODE_ENV=production
PORT=8080
CORS_ORIGIN=https://your-frontend-domain.com
```

## Scaling Configuration

### Cloud Run Scaling
The service is configured with:
- **Min instances**: 1 (always warm)
- **Max instances**: 10 (auto-scale based on demand)
- **Concurrency**: 80 requests per instance
- **CPU**: 2 vCPU per instance
- **Memory**: 2GB per instance
- **Timeout**: 300 seconds

### Firestore Scaling
Firestore automatically scales based on usage. No manual configuration required.

### Elastic Cloud Scaling
Configure your Elastic deployment based on expected search volume:
- **Development**: 1GB RAM, 1 zone
- **Production**: 4GB+ RAM, multiple zones for high availability

## Monitoring and Logging

### Built-in Monitoring
The application provides:
- **Health checks**: `/health` endpoint
- **Metrics dashboard**: `/api/monitoring/dashboard`
- **Request statistics**: `/api/monitoring/requests`
- **System logs**: `/api/monitoring/logs`

### Cloud Logging
All application logs are automatically sent to Cloud Logging:
```bash
# View logs
gcloud run services logs read flight-booking-assistant --region=us-central1

# Follow logs in real-time
gcloud run services logs tail flight-booking-assistant --region=us-central1
```

### Cloud Monitoring
Set up alerts for:
- **Service availability** < 99%
- **Error rate** > 5%
- **Response time** > 2 seconds
- **Memory usage** > 80%

## Security Considerations

### Service Account Permissions
The service account has minimal required permissions:
- `aiplatform.user` - For Vertex AI access
- `datastore.user` - For Firestore access
- `secretmanager.secretAccessor` - For accessing secrets

### Secret Management
All sensitive data is stored in Google Secret Manager:
- Service account keys
- API keys
- Database credentials
- Third-party service tokens

### Network Security
- Cloud Run service allows unauthenticated access (required for public API)
- CORS is configured to allow only specified origins
- All external API calls use HTTPS
- Input validation on all endpoints

## Troubleshooting

### Common Issues

#### 1. Service Account Permissions
```bash
# Check service account permissions
gcloud projects get-iam-policy your-project-id \
    --flatten="bindings[].members" \
    --format="table(bindings.role)" \
    --filter="bindings.members:flight-booking-sa@your-project-id.iam.gserviceaccount.com"
```

#### 2. Secret Access Issues
```bash
# Test secret access
gcloud secrets versions access latest --secret="service-account"
```

#### 3. Firestore Connection Issues
```bash
# Check Firestore status
gcloud firestore databases describe --database="(default)"
```

#### 4. Build Failures
```bash
# Check build logs
gcloud builds log <BUILD_ID>
```

### Health Check Failures
If health checks fail:
1. Check service logs for errors
2. Verify all secrets are accessible
3. Test external service connectivity
4. Check resource limits (CPU/Memory)

### Performance Issues
If experiencing slow responses:
1. Check Elastic Cloud performance
2. Monitor Vertex AI quotas and limits
3. Review Firestore usage patterns
4. Consider increasing Cloud Run resources

## Cost Optimization

### Cloud Run
- Use minimum instances (1) for consistent availability
- Set appropriate CPU and memory limits
- Configure request timeout to prevent resource waste

### Firestore
- Use composite indexes efficiently
- Implement proper query pagination
- Clean up old data regularly

### Vertex AI
- Cache AI responses when possible
- Use appropriate model sizes
- Monitor token usage

### Elastic Cloud
- Right-size your deployment
- Use appropriate retention policies
- Monitor search query efficiency

## Backup and Recovery

### Firestore Backup
```bash
# Export Firestore data
gcloud firestore export gs://your-backup-bucket/firestore-backup
```

### Secret Backup
Secrets are automatically versioned in Secret Manager. Previous versions can be restored if needed.

### Application Recovery
The application is stateless and can be quickly redeployed from the container image stored in Container Registry.

## Support and Maintenance

### Regular Maintenance Tasks
1. **Update dependencies** monthly
2. **Review logs** for errors and performance issues
3. **Monitor costs** and optimize resource usage
4. **Update secrets** as needed (API key rotation)
5. **Test disaster recovery** procedures

### Monitoring Checklist
- [ ] Service health checks passing
- [ ] Error rates within acceptable limits
- [ ] Response times meeting SLA
- [ ] External service connectivity
- [ ] Resource utilization optimal
- [ ] Security alerts reviewed

This deployment guide ensures your Flight Booking Assistant runs reliably and securely on Google Cloud Platform.