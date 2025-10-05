#!/bin/bash

# Flight Booking Assistant - Secret Manager Setup Script
set -e

PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"ai-accelerate-devpost"}

echo "🔐 Setting up secrets in Google Secret Manager..."
echo "Project: $PROJECT_ID"

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Set the project
gcloud config set project $PROJECT_ID

# Enable Secret Manager API
echo "🔧 Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com

# Function to create secret if it doesn't exist
create_secret() {
    local secret_name=$1
    local secret_value=$2
    
    if gcloud secrets describe $secret_name &>/dev/null; then
        echo "📝 Updating existing secret: $secret_name"
        echo "$secret_value" | gcloud secrets versions add $secret_name --data-file=-
    else
        echo "🆕 Creating new secret: $secret_name"
        echo "$secret_value" | gcloud secrets create $secret_name --data-file=-
    fi
}

# Create service account key (you'll need to replace this with your actual key)
echo "🔑 Creating service account key secret..."
echo "Please ensure you have a service account key file ready."
read -p "Enter path to your service account key file: " SA_KEY_PATH

if [ -f "$SA_KEY_PATH" ]; then
    gcloud secrets create service-account --data-file="$SA_KEY_PATH" || \
    gcloud secrets versions add service-account --data-file="$SA_KEY_PATH"
else
    echo "❌ Service account key file not found: $SA_KEY_PATH"
    exit 1
fi

# Elastic Cloud secrets
echo "☁️ Setting up Elastic Cloud secrets..."
read -p "Enter your Elastic Cloud ID: " ELASTIC_CLOUD_ID
read -p "Enter your Elastic API Key: " ELASTIC_API_KEY

create_secret "elastic-cloud-id" "$ELASTIC_CLOUD_ID"
create_secret "elastic-api-key" "$ELASTIC_API_KEY"

# Stripe secrets
echo "💳 Setting up Stripe secrets..."
read -p "Enter your Stripe Secret Key: " STRIPE_SECRET_KEY
read -p "Enter your Stripe Publishable Key: " STRIPE_PUBLISHABLE_KEY

create_secret "stripe-secret" "$STRIPE_SECRET_KEY"
create_secret "stripe-publishable" "$STRIPE_PUBLISHABLE_KEY"

# SendGrid secrets
echo "📧 Setting up SendGrid secrets..."
read -p "Enter your SendGrid API Key: " SENDGRID_API_KEY
read -p "Enter your SendGrid From Email: " SENDGRID_FROM_EMAIL

create_secret "sendgrid-api-key" "$SENDGRID_API_KEY"
create_secret "sendgrid-from-email" "$SENDGRID_FROM_EMAIL"

# Grant Cloud Run access to secrets
echo "🔓 Granting Cloud Run access to secrets..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
CLOUD_RUN_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

for secret in service-account elastic-cloud-id elastic-api-key stripe-secret stripe-publishable sendgrid-api-key sendgrid-from-email; do
    gcloud secrets add-iam-policy-binding $secret \
        --member="serviceAccount:$CLOUD_RUN_SA" \
        --role="roles/secretmanager.secretAccessor"
done

echo "✅ Secrets setup completed successfully!"
echo "🔐 All secrets are now stored in Google Secret Manager and accessible by Cloud Run."