#!/bin/bash

# Flight Booking Assistant - GCP Deployment Script
set -e

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"ai-accelerate-devpost"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME="flight-booking-assistant"

echo "🚀 Starting deployment to Google Cloud Platform..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with gcloud. Please run 'gcloud auth login'"
    exit 1
fi

# Set the project
echo "📋 Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    containerregistry.googleapis.com \
    secretmanager.googleapis.com \
    firestore.googleapis.com \
    aiplatform.googleapis.com

# Build and deploy using Cloud Build
echo "🏗️ Building and deploying with Cloud Build..."
gcloud builds submit --config cloudbuild.yaml \
    --substitutions=_REGION=$REGION,_SERVICE_NAME=$SERVICE_NAME

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --format="value(status.url)")

echo "✅ Deployment completed successfully!"
echo "🌐 Service URL: $SERVICE_URL"
echo "🔍 Health Check: $SERVICE_URL/health"
echo "📊 Monitoring: $SERVICE_URL/api/monitoring/dashboard"

# Test the deployment
echo "🧪 Testing deployment..."
if curl -f -s "$SERVICE_URL/health" > /dev/null; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed. Please check the logs."
    gcloud run services logs read $SERVICE_NAME --region=$REGION --limit=50
    exit 1
fi

echo "🎉 Deployment successful! Your Flight Booking Assistant is now live."