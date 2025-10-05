# Flight Booking Assistant - Secret Manager Setup Script (PowerShell)
param(
    [string]$ProjectId = "ai-accelerate-devpost"
)

Write-Host "🔐 Setting up secrets in Google Secret Manager..." -ForegroundColor Green
Write-Host "Project: $ProjectId" -ForegroundColor Cyan

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

# Set the project
gcloud config set project $ProjectId

# Enable Secret Manager API
Write-Host "🔧 Enabling Secret Manager API..." -ForegroundColor Yellow
gcloud services enable secretmanager.googleapis.com

# Function to create secret if it doesn't exist
function Create-Secret {
    param(
        [string]$SecretName,
        [string]$SecretValue
    )
    
    try {
        gcloud secrets describe $SecretName 2>$null | Out-Null
        Write-Host "📝 Updating existing secret: $SecretName" -ForegroundColor Yellow
        $SecretValue | gcloud secrets versions add $SecretName --data-file=-
    } catch {
        Write-Host "🆕 Creating new secret: $SecretName" -ForegroundColor Yellow
        $SecretValue | gcloud secrets create $SecretName --data-file=-
    }
}

# Create service account key
Write-Host "🔑 Creating service account key secret..." -ForegroundColor Yellow
Write-Host "Please ensure you have a service account key file ready." -ForegroundColor Cyan
$SAKeyPath = Read-Host "Enter path to your service account key file"

if (Test-Path $SAKeyPath) {
    try {
        gcloud secrets describe "service-account" 2>$null | Out-Null
        gcloud secrets versions add "service-account" --data-file="$SAKeyPath"
    } catch {
        gcloud secrets create "service-account" --data-file="$SAKeyPath"
    }
} else {
    Write-Host "❌ Service account key file not found: $SAKeyPath" -ForegroundColor Red
    exit 1
}

# Elastic Cloud secrets
Write-Host "☁️ Setting up Elastic Cloud secrets..." -ForegroundColor Yellow
$ElasticCloudId = Read-Host "Enter your Elastic Cloud ID"
$ElasticApiKey = Read-Host "Enter your Elastic API Key" -AsSecureString
$ElasticApiKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ElasticApiKey))

Create-Secret "elastic-cloud-id" $ElasticCloudId
Create-Secret "elastic-api-key" $ElasticApiKeyPlain

# Ask about mock mode
Write-Host "🎭 Mock Mode Configuration..." -ForegroundColor Yellow
$UseMockMode = Read-Host "Do you want to use mock mode for Stripe and SendGrid? (y/n) [y]"
if ($UseMockMode -eq "" -or $UseMockMode -eq "y" -or $UseMockMode -eq "Y") {
    Write-Host "🎭 Setting up mock mode..." -ForegroundColor Cyan
    
    # Create mock secrets
    Create-Secret "stripe-secret" "mock"
    Create-Secret "stripe-publishable" "pk_mock_test"
    Create-Secret "sendgrid-api-key" "mock"
    Create-Secret "sendgrid-from-email" "demo@flightbooking.com"
    
    Write-Host "✅ Mock mode configured - payments and emails will be simulated" -ForegroundColor Green
} else {
    # Stripe secrets
    Write-Host "💳 Setting up Stripe secrets..." -ForegroundColor Yellow
    $StripeSecretKey = Read-Host "Enter your Stripe Secret Key" -AsSecureString
    $StripeSecretKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($StripeSecretKey))
    $StripePublishableKey = Read-Host "Enter your Stripe Publishable Key"

    Create-Secret "stripe-secret" $StripeSecretKeyPlain
    Create-Secret "stripe-publishable" $StripePublishableKey

    # SendGrid secrets
    Write-Host "📧 Setting up SendGrid secrets..." -ForegroundColor Yellow
    $SendGridApiKey = Read-Host "Enter your SendGrid API Key" -AsSecureString
    $SendGridApiKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($SendGridApiKey))
    $SendGridFromEmail = Read-Host "Enter your SendGrid From Email"

    Create-Secret "sendgrid-api-key" $SendGridApiKeyPlain
    Create-Secret "sendgrid-from-email" $SendGridFromEmail
}

# Grant Cloud Run access to secrets
Write-Host "🔓 Granting Cloud Run access to secrets..." -ForegroundColor Yellow
$ProjectNumber = gcloud projects describe $ProjectId --format="value(projectNumber)"
$CloudRunSA = "$ProjectNumber-compute@developer.gserviceaccount.com"

$secrets = @("service-account", "elastic-cloud-id", "elastic-api-key", "stripe-secret", "stripe-publishable", "sendgrid-api-key", "sendgrid-from-email")

foreach ($secret in $secrets) {
    gcloud secrets add-iam-policy-binding $secret --member="serviceAccount:$CloudRunSA" --role="roles/secretmanager.secretAccessor"
}

Write-Host "✅ Secrets setup completed successfully!" -ForegroundColor Green
Write-Host "🔐 All secrets are now stored in Google Secret Manager and accessible by Cloud Run." -ForegroundColor Cyan