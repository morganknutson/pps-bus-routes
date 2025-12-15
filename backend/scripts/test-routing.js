#!/usr/bin/env node
/**
 * Test script for routing functionality
 * Tests route calculation with various scenarios
 * 
 * Usage: node scripts/test-routing.js (from backend directory)
 */

import dotenv from 'dotenv';
import { directionsService } from '../services/directionsService.js';

dotenv.config();

// Test coordinates (Portland, OR area)
const testCases = [
  {
    name: 'Two points - short route',
    waypoints: [
      [45.5152, -122.6784], // Portland city center
      [45.5200, -122.6800], // Nearby point
    ],
  },
  {
    name: 'Three points - medium route',
    waypoints: [
      [45.5152, -122.6784], // Portland city center
      [45.5200, -122.6800], // Point 1
      [45.5250, -122.6820], // Point 2
    ],
  },
  {
    name: 'Multiple waypoints - long route',
    waypoints: [
      [45.5152, -122.6784], // Portland city center
      [45.5200, -122.6800],
      [45.5250, -122.6820],
      [45.5300, -122.6840],
      [45.5350, -122.6860],
    ],
  },
];

async function testRoute(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`   Waypoints: ${testCase.waypoints.length}`);
  
  const startTime = Date.now();
  
  try {
    const result = await directionsService.getRoute(testCase.waypoints);
    const duration = Date.now() - startTime;
    
    if (result.success) {
      console.log(`   ✅ Success!`);
      console.log(`   Provider: ${result.provider || 'unknown'}`);
      console.log(`   Coordinates: ${result.coordinates?.length || 0} points`);
      console.log(`   Distance: ${result.distance ? (result.distance / 1000).toFixed(2) + ' km' : 'N/A'}`);
      console.log(`   Duration: ${result.duration ? (result.duration / 60).toFixed(1) + ' min' : 'N/A'}`);
      console.log(`   Response time: ${duration}ms`);
      
      if (result.batched) {
        console.log(`   📦 Route was batched (${testCase.waypoints.length} waypoints > 25)`);
      }
      
      if (result.failedSegments > 0) {
        console.log(`   ⚠️  ${result.failedSegments} segments failed`);
      }
      
      return { success: true, duration, result };
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      return { success: false, duration, error: result.error };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, duration, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting Routing Tests\n');
  console.log('='.repeat(60));
  
  // Show configuration
  const stats = directionsService.getStats();
  console.log('\n📊 Configuration:');
  console.log(`   Using Google API: ${stats.usingGoogle ? '✅ Yes' : '❌ No (using OSRM fallback)'}`);
  console.log(`   Has API Key: ${stats.hasApiKey ? '✅ Yes' : '❌ No'}`);
  
  if (!stats.hasApiKey) {
    console.log('\n⚠️  Warning: No Google Maps API key configured');
    console.log('   Routes will use OSRM fallback (slower, less accurate)');
    console.log('   Set GOOGLE_MAPS_API_KEY in backend/.env for better results');
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Run test cases
  const results = [];
  for (const testCase of testCases) {
    const result = await testRoute(testCase);
    results.push({ ...testCase, ...result });
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Show summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary:');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  console.log(`   Total tests: ${results.length}`);
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏱️  Average response time: ${avgDuration.toFixed(0)}ms`);
  
  // Show final statistics
  const finalStats = directionsService.getStats();
  console.log('\n📈 Service Statistics:');
  console.log(`   Google requests: ${finalStats.googleRequests} (${finalStats.googleSuccessRate} success rate)`);
  console.log(`   OSRM requests: ${finalStats.osrmRequests} (${finalStats.osrmSuccessRate} success rate)`);
  console.log(`   Total routes calculated: ${finalStats.totalRoutes}`);
  console.log(`   Straight-line fallbacks: ${finalStats.straightLineFallbacks}`);
  
  if (failed > 0) {
    console.log('\n❌ Some tests failed. Check the errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});




