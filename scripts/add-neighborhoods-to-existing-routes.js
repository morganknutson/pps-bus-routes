/**
 * Script to retroactively add neighborhoods array to existing processed routes
 * This aggregates neighborhoods from stops and adds them to the route object
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROCESSED_ROUTES_DIR = path.join(DATA_DIR, 'processed-routes');
const SCHOOLS_DIR = path.join(DATA_DIR, 'schools');

/**
 * Get all processed route files
 */
function getAllProcessedRouteFiles() {
  const routeFiles = [];
  
  // Check root processed-routes directory
  if (fs.existsSync(PROCESSED_ROUTES_DIR)) {
    const files = fs.readdirSync(PROCESSED_ROUTES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ filePath: path.join(PROCESSED_ROUTES_DIR, f), filename: f }));
    routeFiles.push(...files);
  }
  
  // Check school-specific processed-routes directories
  if (fs.existsSync(SCHOOLS_DIR)) {
    const schools = fs.readdirSync(SCHOOLS_DIR);
    for (const school of schools) {
      const schoolProcessedDir = path.join(SCHOOLS_DIR, school, 'processed-routes');
      if (fs.existsSync(schoolProcessedDir)) {
        const files = fs.readdirSync(schoolProcessedDir)
          .filter(f => f.endsWith('.json'))
          .map(f => ({ filePath: path.join(schoolProcessedDir, f), filename: f }));
        routeFiles.push(...files);
      }
    }
  }
  
  return routeFiles;
}

/**
 * Aggregate neighborhoods from stops in a route
 */
function aggregateNeighborhoods(stops) {
  const neighborhoodsSet = new Set();
  for (const stop of stops) {
    if (stop.neighborhood && typeof stop.neighborhood === 'string' && stop.neighborhood.trim()) {
      neighborhoodsSet.add(stop.neighborhood.trim());
    }
  }
  return Array.from(neighborhoodsSet).sort();
}

/**
 * Update a route file with neighborhoods array
 */
function updateRouteWithNeighborhoods(routeFilePath) {
  try {
    const routeData = JSON.parse(fs.readFileSync(routeFilePath, 'utf8'));
    
    // Skip if neighborhoods array already exists (newer format)
    if (Array.isArray(routeData.neighborhoods)) {
      return { updated: false, reason: 'Already has neighborhoods array' };
    }
    
    // Aggregate neighborhoods from stops
    if (!routeData.stops || !Array.isArray(routeData.stops)) {
      return { updated: false, reason: 'No stops array found' };
    }
    
    const neighborhoods = aggregateNeighborhoods(routeData.stops);
    
    // Add neighborhoods array to route
    routeData.neighborhoods = neighborhoods;
    
    // Write back to file
    fs.writeFileSync(routeFilePath, JSON.stringify(routeData, null, 2));
    
    return { 
      updated: true, 
      neighborhoods: neighborhoods,
      neighborhoodCount: neighborhoods.length
    };
  } catch (error) {
    return { updated: false, error: error.message };
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🔄 Adding Neighborhoods to Existing Routes\n');
  console.log('='.repeat(80));
  
  const routeFiles = getAllProcessedRouteFiles();
  console.log(`\nFound ${routeFiles.length} processed route files\n`);
  
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const results = [];
  
  for (const { filePath, filename } of routeFiles) {
    const result = updateRouteWithNeighborhoods(filePath);
    result.filename = filename;
    
    if (result.updated) {
      updatedCount++;
      results.push(result);
      console.log(`✅ Updated: ${filename} - ${result.neighborhoodCount} neighborhood(s): ${result.neighborhoods.join(', ')}`);
    } else if (result.error) {
      errorCount++;
      console.error(`❌ Error: ${filename} - ${result.error}`);
    } else {
      skippedCount++;
      // Don't log skipped files to reduce noise
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 SUMMARY\n');
  console.log(`Total files processed: ${routeFiles.length}`);
  console.log(`✅ Updated: ${updatedCount}`);
  console.log(`⏭️  Skipped (already have neighborhoods): ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  
  if (results.length > 0) {
    console.log('\n\n📋 Routes with Multiple Neighborhoods:\n');
    const multiNeighborhoodRoutes = results.filter(r => r.neighborhoodCount > 1);
    multiNeighborhoodRoutes.forEach(r => {
      console.log(`   ${r.filename}: ${r.neighborhoods.join(', ')}`);
    });
  }
  
  console.log('\n✅ Update complete!\n');
}

main();













