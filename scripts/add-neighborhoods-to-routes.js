/**
 * Script to add neighborhoods to existing processed routes
 * Reads all route JSON files and adds neighborhood data via reverse geocoding
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import backend services
const backendDir = path.join(__dirname, '..', 'backend');
const neighborhoodServicePath = path.join(backendDir, 'services', 'neighborhoodService.js');
const { neighborhoodService } = await import(`file://${neighborhoodServicePath}`);

const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * Process a single route file to add neighborhoods
 */
async function processRouteFile(filePath, schoolId = null) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const route = JSON.parse(content);
    
    let updated = false;
    let neighborhoodsAdded = 0;
    let neighborhoodsFailed = 0;
    
    // Process each stop
    for (const stop of route.stops) {
      // Skip if already has neighborhood
      if (stop.neighborhood) {
        continue;
      }
      
      // Skip if no coordinates
      if (!stop.coordinates || !Array.isArray(stop.coordinates) || stop.coordinates.length !== 2) {
        continue;
      }
      
      // Skip if skipGeocoding is true
      if (stop.skipGeocoding) {
        continue;
      }
      
      try {
        const result = await neighborhoodService.getNeighborhood(stop.coordinates);
        if (result.success && result.neighborhood) {
          stop.neighborhood = result.neighborhood;
          neighborhoodsAdded++;
          updated = true;
        } else {
          neighborhoodsFailed++;
        }
      } catch (error) {
        console.warn(`  Failed to get neighborhood for stop "${stop.address}":`, error.message);
        neighborhoodsFailed++;
      }
      
      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Save updated route if changes were made
    if (updated) {
      fs.writeFileSync(filePath, JSON.stringify(route, null, 2));
      return {
        success: true,
        filename: path.basename(filePath),
        neighborhoodsAdded,
        neighborhoodsFailed,
        totalStops: route.stops.length,
      };
    }
    
    return {
      success: true,
      filename: path.basename(filePath),
      neighborhoodsAdded: 0,
      neighborhoodsFailed: 0,
      totalStops: route.stops.length,
      skipped: true, // Already had neighborhoods or no coordinates
    };
  } catch (error) {
    return {
      success: false,
      filename: path.basename(filePath),
      error: error.message,
    };
  }
}

/**
 * Process all routes for a specific school
 */
async function processSchoolRoutes(schoolId) {
  const processedRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
  
  if (!fs.existsSync(processedRoutesDir)) {
    console.log(`  No processed-routes directory found for ${schoolId}`);
    return { processed: 0, errors: 0 };
  }
  
  const files = fs.readdirSync(processedRoutesDir).filter(f => f.endsWith('.json'));
  console.log(`  Found ${files.length} route files`);
  
  let processed = 0;
  let errors = 0;
  let totalNeighborhoodsAdded = 0;
  let totalNeighborhoodsFailed = 0;
  
  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(processedRoutesDir, filename);
    
    console.log(`  [${i + 1}/${files.length}] Processing ${filename}...`);
    const result = await processRouteFile(filePath, schoolId);
    
    if (result.success) {
      processed++;
      if (result.neighborhoodsAdded > 0) {
        totalNeighborhoodsAdded += result.neighborhoodsAdded;
        totalNeighborhoodsFailed += result.neighborhoodsFailed || 0;
        console.log(`    ✓ Added ${result.neighborhoodsAdded} neighborhoods${result.neighborhoodsFailed > 0 ? `, ${result.neighborhoodsFailed} failed` : ''}`);
      } else if (result.skipped) {
        console.log(`    ⊘ Skipped (already has neighborhoods or no coordinates)`);
      }
    } else {
      errors++;
      console.log(`    ✗ Error: ${result.error}`);
    }
  }
  
  return {
    processed,
    errors,
    totalNeighborhoodsAdded,
    totalNeighborhoodsFailed,
  };
}

/**
 * Main function to process all routes
 */
async function main() {
  console.log('🏘️  Adding Neighborhoods to Routes');
  console.log('===================================\n');
  
  const startTime = Date.now();
  
  // Get all schools
  const schoolsDir = path.join(DATA_DIR, 'schools');
  const results = {
    schools: {},
    totalProcessed: 0,
    totalErrors: 0,
    totalNeighborhoodsAdded: 0,
    totalNeighborhoodsFailed: 0,
  };
  
  if (fs.existsSync(schoolsDir)) {
    const schoolDirs = fs.readdirSync(schoolsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    console.log(`Found ${schoolDirs.length} schools\n`);
    
    for (let i = 0; i < schoolDirs.length; i++) {
      const schoolId = schoolDirs[i];
      console.log(`[${i + 1}/${schoolDirs.length}] Processing ${schoolId}...`);
      
      const schoolResult = await processSchoolRoutes(schoolId);
      results.schools[schoolId] = schoolResult;
      results.totalProcessed += schoolResult.processed;
      results.totalErrors += schoolResult.errors;
      results.totalNeighborhoodsAdded += schoolResult.totalNeighborhoodsAdded;
      results.totalNeighborhoodsFailed += schoolResult.totalNeighborhoodsFailed;
      
      console.log(`  ✓ ${schoolResult.processed} routes processed, ${schoolResult.errors} errors`);
      if (schoolResult.totalNeighborhoodsAdded > 0) {
        console.log(`  ✓ ${schoolResult.totalNeighborhoodsAdded} neighborhoods added`);
      }
      console.log('');
    }
  }
  
  // Also check legacy processed-routes directory
  const legacyProcessedRoutesDir = path.join(DATA_DIR, 'processed-routes');
  if (fs.existsSync(legacyProcessedRoutesDir)) {
    console.log('Processing legacy processed-routes directory...');
    const files = fs.readdirSync(legacyProcessedRoutesDir).filter(f => f.endsWith('.json'));
    console.log(`  Found ${files.length} route files`);
    
    for (let i = 0; i < files.length; i++) {
      const filename = files[i];
      const filePath = path.join(legacyProcessedRoutesDir, filename);
      
      console.log(`  [${i + 1}/${files.length}] Processing ${filename}...`);
      const result = await processRouteFile(filePath);
      
      if (result.success) {
        results.totalProcessed++;
        if (result.neighborhoodsAdded > 0) {
          results.totalNeighborhoodsAdded += result.neighborhoodsAdded;
          results.totalNeighborhoodsFailed += result.neighborhoodsFailed || 0;
          console.log(`    ✓ Added ${result.neighborhoodsAdded} neighborhoods${result.neighborhoodsFailed > 0 ? `, ${result.neighborhoodsFailed} failed` : ''}`);
        }
      } else {
        results.totalErrors++;
        console.log(`    ✗ Error: ${result.error}`);
      }
    }
    console.log('');
  }
  
  // Save cache after processing
  neighborhoodService.saveCache();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('===================================');
  console.log('✅ Complete!');
  console.log(`📊 Routes processed: ${results.totalProcessed}`);
  console.log(`❌ Errors: ${results.totalErrors}`);
  console.log(`🏘️  Neighborhoods added: ${results.totalNeighborhoodsAdded}`);
  if (results.totalNeighborhoodsFailed > 0) {
    console.log(`⚠️  Neighborhoods failed: ${results.totalNeighborhoodsFailed}`);
  }
  console.log(`⏱️  Duration: ${duration}s`);
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});













