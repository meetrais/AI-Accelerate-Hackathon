# Flight Booking Assistant - GCP Deployment Script (PowerShell)
param(
    [string]$ProjectId = "ai-accelerate-devpost",
    [string]$Region = "us-central1",
    [string]$ServiceName = "flight-booking-assistant"
)

Write-Host "🚀 Starting deployment to Google Cloud Platform..." -ForegroundColor Green
Write-Host "Project: $ProjectId" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host "Service: $ServiceName" -ForegroundColor Cyan

# Check if gcloud is installed and authenticated
try {
    $gcloudVersion = gcloud version 2>$null
    if (-not $gcloudVersion) {
        throw "gcloud not found"
    }
} catch {
    Write-Host "❌ gcloud CLI is not installed. Please install it first." -ForegroundColor Red
    exit 1
}

# Check if user is authenticated
try {
    $activeAccount = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
    if (-not $activeAccount) {
        throw "Not authenticated"
    }
} catch {
    Write-Host "❌ Not authenticated with gcloud. Please run 'gcloud auth login'" -ForegroundColor Red
    exit 1
}

# Set the project
Write-Host "📋 Setting project to $ProjectId..." -ForegroundColor Yellow
gcloud config set project $ProjectId

# Enable required APIs
Write-Host "🔧 Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com secretmanager.googleapis.com firestore.googleapis.com aiplatform.googleapis.com

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to enable APIs" -ForegroundColor Red
    exit 1
}

# Build and deploy using Cloud Build
Write-Host "🏗️ Building and deploying with Cloud Build..." -ForegroundColor Yellow
gcloud builds submit --config cloudbuild.yaml --substitutions="_REGION=$Region,_SERVICE_NAME=$ServiceName"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build and deployment failed" -ForegroundColor Red
    exit 1
}

# Get the service URL
Write-Host "🔍 Getting service URL..." -ForegroundColor Yellow
$ServiceUrl = gcloud run services describe $ServiceName --region=$Region --format="value(status.url)"

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host "🌐 Service URL: $ServiceUrl" -ForegroundColor Cyan
Write-Host "🔍 Health Check: $ServiceUrl/health" -ForegroundColor Cyan
Write-Host "📊 Monitoring: $ServiceUrl/api/monitoring/dashboard" -ForegroundColor Cyan

# Test the deployment
Write-Host "🧪 Testing deployment..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$ServiceUrl/health" -Method Get -TimeoutSec 30
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Health check passed!" -ForegroundColor Green
    } else {
        throw "Health check failed with status: $($response.StatusCode)"
    }
} catch {
    Write-Host "❌ Health check failed. Please check the logs." -ForegroundColor Red
    Write-Host "Running: gcloud run services logs read $ServiceName --region=$Region --limit=50" -ForegroundColor Yellow
    gcloud run services logs read $ServiceName --region=$Region --limit=50
    exit 1
}

Write-Host "🎉 Deployment successful! Your Flight Booking Assistant is now live." -ForegroundColor Green