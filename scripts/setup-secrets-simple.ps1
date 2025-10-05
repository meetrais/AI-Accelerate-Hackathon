# Flight Booking Assistant - Simple Secret Manager Setup Script
param(
    [string]$ProjectId = "ai-accelerate-devpost"
)

Write-Host "Setting up secrets in Google Secret Manager..." -ForegroundColor Green
Write-Host "Project: $ProjectId" -ForegroundColor Cyan

# Set the project
gcloud config set project $ProjectId

# Enable Secret Manager API
Write-Host "Enabling Secret Manager API..." -ForegroundColor Yellow
gcloud services enable secretmanager.googleapis.com

# Create service account key secret
Write-Host "Creating service account key secret..." -ForegroundColor Yellow
$SAKeyPath = Read-Host "Enter path to your service account key file (e.g., service-account-key.json)"

if (Test-Path $SAKeyPath) {
    Write-Host "Creating service-account secret..." -ForegroundColor Yellow
    gcloud secrets create "service-account" --data-file="$SAKeyPath" 2>$null
    if ($LASTEXITCODE -ne 0) {
        gcloud secrets versions add "service-account" --data-file="$SAKeyPath"
    }
} else {
    Write-Host "Service account key file not found: $SAKeyPath" -ForegroundColor Red
    exit 1
}

# Elastic Cloud secrets
Write-Host "Setting up Elastic Cloud secrets..." -ForegroundColor Yellow
$ElasticCloudId = Read-Host "Enter your Elastic Cloud ID"
$ElasticApiKey = Read-Host "Enter your Elastic API Key"

Write-Host "Creating elastic-cloud-id secret..." -ForegroundColor Yellow
echo $ElasticCloudId | gcloud secrets create "elastic-cloud-id" --data-file=- 2>$null
if ($LASTEXITCODE -ne 0) {
    echo $ElasticCloudId | gcloud secrets versions add "elastic-cloud-id" --data-file=-
}

Write-Host "Creating elastic-api-key secret..." -ForegroundColor Yellow
echo $ElasticApiKey | gcloud secrets create "elastic-api-key" --data-file=- 2>$null
if ($LASTEXITCODE -ne 0) {
    echo $ElasticApiKey | gcloud secrets versions add "elastic-api-key" --data-file=-
}

# Mock mode setup
Write-Host "Setting up mock mode for Stripe and SendGrid..." -ForegroundColor Cyan

Write-Host "Creating stripe-secret (mock)..." -ForegroundColor Yellow
echo "mock" | gcloud secrets create "stripe-secret" --data-file=- 2>$null
if ($LASTEXITCODE -ne 0) {
    echo "mock" | gcloud secrets versions add "stripe-secret" --data-file=-
}

Write-Host "Creating stripe-publishable (mock)..." -ForegroundColor Yellow
echo "pk_mock_test" | gcloud secrets create "stripe-publishable" --data-file=- 2>$null
if ($LASTEXITCODE -ne 0) {
    echo "pk_mock_test" | gcloud secrets versions add "stripe-publishable" --data-file=-
}

Write-Host "Creating sendgrid-api-key (mock)..." -ForegroundColor Yellow
echo "mock" | gcloud secrets create "sendgrid-api-key" --data-file=- 2>$null
if ($LASTEXITCODE -ne 0) {
    echo "mock" | gcloud secrets versions add "sendgrid-api-key" --data-file=-
}

Write-Host "Creating sendgrid-from-email (mock)..." -ForegroundColor Yellow
echo "demo@flightbooking.com" | gcloud secrets create "sendgrid-from-email" --data-file=- 2>$null
if ($LASTEXITCODE -ne 0) {
    echo "demo@flightbooking.com" | gcloud secrets versions add "sendgrid-from-email" --data-file=-
}

# Grant Cloud Run access to secrets
Write-Host "Granting Cloud Run access to secrets..." -ForegroundColor Yellow
$ProjectNumber = gcloud projects describe $ProjectId --format="value(projectNumber)"
$CloudRunSA = "$ProjectNumber-compute@developer.gserviceaccount.com"

$secrets = @("service-account", "elastic-cloud-id", "elastic-api-key", "stripe-secret", "stripe-publishable", "sendgrid-api-key", "sendgrid-from-email")

foreach ($secret in $secrets) {
    Write-Host "Granting access to $secret..." -ForegroundColor Yellow
    gcloud secrets add-iam-policy-binding $secret --member="serviceAccount:$CloudRunSA" --role="roles/secretmanager.secretAccessor"
}

Write-Host "Secrets setup completed successfully!" -ForegroundColor Green
Write-Host "Mock mode configured - payments and emails will be simulated" -ForegroundColor Green
Write-Host "All secrets are now stored in Google Secret Manager and accessible by Cloud Run." -ForegroundColor Cyan