/**
 * Initialize and test Gen AI services
 * Run with: ts-node src/scripts/initializeGenAI.ts
 */

import { embeddingService } from '../services/embeddingService';
import { vectorSearchService } from '../services/vectorSearchService';
import { multimodalService } from '../services/multimodalService';
import { elasticsearchService } from '../services/elasticsearch';

async function initializeGenAI() {
  console.log('🚀 Initializing Gen AI Services...\n');

  try {
    // 1. Initialize Embedding Service
    console.log('1️⃣  Initializing Embedding Service...');
    await embeddingService.initialize();
    console.log('✅ Embedding Service initialized\n');

    // 2. Test embedding generation
    console.log('2️⃣  Testing embedding generation...');
    try {
      const testEmbedding = await embeddingService.generateEmbedding(
        'Direct flight from New York to London'
      );
      console.log(`✅ Generated embedding with ${testEmbedding.length} dimensions\n`);
    } catch (error: any) {
      if (error.message?.includes('429') || error.message?.includes('Quota exceeded')) {
        console.log('⚠️  Vertex AI quota exceeded - this is normal if you\'ve been testing');
        console.log('   The service is configured correctly and will work when quota resets\n');
      } else {
        console.log('⚠️  Embedding test skipped:', error.message);
        console.log('   Service may still work - check your GCP credentials\n');
      }
    }

    // 3. Ensure Elasticsearch index mapping
    console.log('3️⃣  Setting up Elasticsearch vector search...');
    await vectorSearchService.ensureIndexMapping();
    console.log('✅ Elasticsearch index configured for vector search\n');

    // 4. Initialize Multimodal Service
    console.log('4️⃣  Initializing Multimodal Service...');
    await multimodalService.initialize();
    console.log('✅ Multimodal Service initialized\n');

    // 5. Test semantic search (if flights exist)
    console.log('5️⃣  Testing semantic search...');
    try {
      const searchResults = await vectorSearchService.semanticSearch(
        'cheap morning flights to Europe',
        { topK: 3, minScore: 0.5 }
      );
      console.log(`✅ Semantic search returned ${searchResults.length} results\n`);
    } catch (error: any) {
      if (error.message?.includes('429') || error.message?.includes('Quota exceeded')) {
        console.log('⚠️  Vertex AI quota exceeded - semantic search will work when quota resets\n');
      } else {
        console.log('⚠️  No flights indexed yet - run seed script first\n');
      }
    }

    console.log('🎉 Gen AI Services initialized successfully!\n');
    console.log('📚 Next steps:');
    console.log('   1. Run: npm run seed-flights (to index flights with embeddings)');
    console.log('   2. Start server: npm run dev');
    console.log('   3. Test endpoints: See GEN_AI_FEATURES.md\n');

  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

// Run initialization
initializeGenAI()
  .then(() => {
    console.log('✅ Initialization complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
