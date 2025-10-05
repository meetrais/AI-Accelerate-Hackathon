# Flight Booking Assistant - GCP Deployment Script (PowerShell)
# This script deploys the application to Google Cloud Run

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting GCP Deployment..." -ForegroundColor Cyan

# Check if gcloud is installed
try {
    $null = Get-Command gcloud -ErrorAction Stop
} catch {
    Write-Host "❌ gcloud CLI is not installed. Please install it first:" -ForegroundColor Red
    Write-Host "https://cloud.google.com/sdk/docs/install"
    exit 1
}

# Get project ID
$PROJECT_ID = gcloud config get-value project 2>$null
if ([string]::IsNullOrEmpty($PROJECT_ID)) {
    Write-Host "❌ No GCP project selected. Please run:" -ForegroundColor Red
    Write-Host "gcloud config set project YOUR_PROJECT_ID"
    exit 1
}

Write-Host "✓ Using GCP Project: $PROJECT_ID" -ForegroundColor Green

# Set variables
$SERVICE_NAME = "flight-booking-assistant"
$REGION = "us-central1"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

# Confirm deployment
Write-Host ""
Write-Host "This will deploy to:" -ForegroundColor Yellow
Write-Host "  Project: $PROJECT_ID"
Write-Host "  Service: $SERVICE_NAME"
Write-Host "  Region: $REGION"
Write-Host ""
$confirmation = Read-Host "Continue? (y/n)"
if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "Deployment cancelled."
    exit 0
}

# Enable required APIs
Write-Host ""
Write-Host "📦 Enabling required GCP APIs..." -ForegroundColor Cyan
gcloud services enable `
    cloudbuild.googleapis.com `
    run.googleapis.com `
    containerregistry.googleapis.com `
    artifactregistry.googleapis.com `
    --project=$PROJECT_ID

# Build the application locally first
Write-Host ""
Write-Host "🔨 Building application..." -ForegroundColor Cyan
npm run build

# Build and push Docker image
Write-Host ""
Write-Host "🐳 Building Docker image..." -ForegroundColor Cyan
docker build -t "${IMAGE_NAME}:latest" .

Write-Host ""
Write-Host "📤 Pushing image to Container Registry..." -ForegroundColor Cyan
docker push "${IMAGE_NAME}:latest"

# Deploy to Cloud Run
Write-Host ""
Write-Host "🚀 Deploying to Cloud Run..." -ForegroundColor Cyan
gcloud run deploy $SERVICE_NAME `
    --image "${IMAGE_NAME}:latest" `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --port 8080 `
    --memory 2Gi `
    --cpu 2 `
    --min-instances 0 `
    --max-instances 10 `
    --timeout 300 `
    --set-env-vars NODE_ENV=production,PORT=8080 `
    --project $PROJECT_ID

# Get the service URL
$SERVICE_URL = gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)' --project $PROJECT_ID

Write-Host ""
Write-Host "✅ Deployment successful!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Service URL: $SERVICE_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Set up environment variables in Cloud Run console"
Write-Host "2. Configure secrets for sensitive data"
Write-Host "3. Test the deployment: curl $SERVICE_URL/health"
Write-Host ""
Write-Host "To view logs:"
Write-Host "  gcloud run services logs read $SERVICE_NAME --region $REGION"
Write-Host ""
Write-Host "To update environment variables:"
Write-Host "  gcloud run services update $SERVICE_NAME --region $REGION --update-env-vars KEY=VALUE"
