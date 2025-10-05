/**
 * Rate limiting configuration for external APIs
 */

export const rateLimits = {
  vertexAI: {
    // Vertex AI Embedding API limits
    embeddings: {
      requestsPerMinute: parseInt(process.env.VERTEX_AI_EMBEDDINGS_RPM || '50'),
      delayBetweenRequests: 1200, // milliseconds (50 req/min = 1.2s delay)
      maxRetries: 3,
      retryDelay: 5000 // 5 seconds
    },
    
    // Vertex AI Gemini API limits
    gemini: {
      requestsPerMinute: parseInt(process.env.VERTEX_AI_GEMINI_RPM || '50'),
      delayBetweenRequests: 1200,
      maxRetries: 3,
      retryDelay: 5000
    },
    
    // Vertex AI Vision API limits
    vision: {
      requestsPerMinute: parseInt(process.env.VERTEX_AI_VISION_RPM || '30'),
      delayBetweenRequests: 2000, // 30 req/min = 2s delay
      maxRetries: 3,
      retryDelay: 5000
    }
  },
  
  elasticsearch: {
    // Elasticsearch bulk indexing
    bulkIndexing: {
      batchSize: parseInt(process.env.ES_BULK_BATCH_SIZE || '100'),
      delayBetweenBatches: 1000 // 1 second
    }
  }
};

/**
 * Get recommended batch size based on rate limit
 */
export function getRecommendedBatchSize(requestsPerMinute: number): number {
  // Process in batches that take ~5 minutes each
  return Math.min(requestsPerMinute * 5, 500);
}

/**
 * Calculate estimated time for batch processing
 */
export function estimateProcessingTime(
  itemCount: number,
  requestsPerMinute: number
): { minutes: number; seconds: number } {
  const totalSeconds = Math.ceil((itemCount / requestsPerMinute) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return { minutes, seconds };
}
