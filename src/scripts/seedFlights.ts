#!/usr/bin/env node

/**
 * Script to seed Elasticsearch with mock flight data
 * Usage: npm run seed-flights
 */

import { elasticsearchService } from '../services/elasticsearch';
import { generateMockFlights } from '../data/mockFlights';

async function seedFlights() {
  console.log('🚀 Starting flight data seeding process...');

  try {
    // Check Elasticsearch connection
    console.log('🔍 Checking Elasticsearch connection...');
    const isHealthy = await elasticsearchService.healthCheck();
    
    if (!isHealthy) {
      throw new Error('Elasticsearch is not available. Please check your connection settings.');
    }
    console.log('✅ Elasticsearch connection successful');

    // Create flight index
    console.log('📋 Creating flight index...');
    await elasticsearchService.createFlightIndex();

    // Generate mock flight data
    console.log('✈️ Generating mock flight data...');
    const flights = generateMockFlights();
    console.log(`📊 Generated ${flights.length} mock flights`);

    // Clear existing data (optional - for development)
    console.log('🧹 Clearing existing flight data...');
    try {
      await elasticsearchService.deleteAllFlights();
    } catch (error) {
      // Index might not exist yet, which is fine
      console.log('ℹ️ No existing data to clear');
    }

    // Index the flights
    console.log('📥 Indexing flights in Elasticsearch...');
    await elasticsearchService.indexFlights(flights);

    // Verify the data was indexed
    console.log('🔍 Verifying indexed data...');
    
    // Test search with a sample query
    const testSearch = await elasticsearchService.searchFlights({
      origin: 'JFK',
      destination: 'LAX',
      departureDate: new Date(),
      passengers: 1
    });

    console.log(`✅ Verification complete: Found ${testSearch.length} flights for JFK->LAX route`);

    console.log('\n🎉 Flight data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • Total flights indexed: ${flights.length}`);
    console.log(`   • Unique routes: ${new Set(flights.map(f => `${f.origin.code}-${f.destination.code}`)).size}`);
    console.log(`   • Airlines: ${new Set(flights.map(f => f.airline)).size}`);
    console.log(`   • Date range: Next 30 days`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding flight data:', error);
    process.exit(1);
  }
}

// Run the seeding process
if (require.main === module) {
  seedFlights();
}

export { seedFlights };