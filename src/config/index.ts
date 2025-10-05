import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Google Cloud configuration
  googleCloud: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'flight-booking-assistant',
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    vertexAi: {
      model: process.env.VERTEX_AI_MODEL || 'gemini-1.5-flash',
      embeddingModel: process.env.VERTEX_AI_EMBEDDING_MODEL || 'text-embedding-004'
    }
  },
  
  // Elasticsearch configuration
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    cloudId: process.env.ELASTICSEARCH_CLOUD_ID,
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
    apiKey: process.env.ELASTICSEARCH_API_KEY,
    flightIndex: process.env.ELASTICSEARCH_FLIGHT_INDEX || 'flights'
  },
  
  // Firestore configuration
  firestore: {
    projectId: process.env.FIRESTORE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: process.env.FIRESTORE_KEY_FILENAME
  },
  
  // Stripe configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || 'mock',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_mock_test',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock'
  },
  
  // Mock mode configuration
  mockMode: {
    payments: process.env.MOCK_PAYMENTS === 'true' || !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'mock',
    notifications: process.env.MOCK_NOTIFICATIONS === 'true' || !process.env.SENDGRID_API_KEY,
    elasticsearch: process.env.MOCK_ELASTICSEARCH === 'true' || false
  },
  
  // Session configuration
  session: {
    ttlMinutes: parseInt(process.env.SESSION_TTL_MINUTES || '60'),
    cleanupIntervalMinutes: parseInt(process.env.SESSION_CLEANUP_INTERVAL_MINUTES || '15')
  },
  
  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true
  }
};

// Validate required environment variables
const requiredEnvVars = [
  'GOOGLE_CLOUD_PROJECT_ID'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}