/**
 * Analyze processed routes to check:
 * 1. If routes have multiple neighborhoods
 * 2. If neighborhoods are being saved properly
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
      .map(f => path.join(PROCESSED_ROUTES_DIR, f));
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
          .map(f => path.join(schoolProcessedDir, f));
        routeFiles.push(...files);
      }
    }
  }
  
  return routeFiles;
}

/**
 * Analyze a single route file
 */
function analyzeRoute(routeFilePath) {
  try {
    const routeData = JSON.parse(fs.readFileSync(routeFilePath, 'utf8'));
    const routeName = routeData.name || 'Unknown';
    const filename = path.basename(routeFilePath);
    const direction = routeData.direction || 'Unknown';
    
    if (!routeData.stops || !Array.isArray(routeData.stops)) {
      return {
        filename,
        routeName,
        direction,
        hasStops: false,
        error: 'No stops array found'
      };
    }
    
    // Collect neighborhoods from stops
    const neighborhoods = new Set();
    const stopsWithNeighborhoods = [];
    const stopsWithoutNeighborhoods = [];
    
    for (const stop of routeData.stops) {
      if (stop.skipGeocoding) {
        continue; // Skip stops that don't need geocoding
      }
      
      if (stop.neighborhood) {
        neighborhoods.add(stop.neighborhood);
        stopsWithNeighborhoods.push({
          id: stop.id,
          address: stop.address,
          neighborhood: stop.neighborhood,
          coordinates: stop.coordinates
        });
      } else if (stop.coordinates) {
        stopsWithoutNeighborhoods.push({
          id: stop.id,
          address: stop.address,
          coordinates: stop.coordinates
        });
      }
    }
    
    return {
      filename,
      routeName,
      direction,
      hasStops: true,
      totalStops: routeData.stops.length,
      stopsWithCoordinates: routeData.stops.filter(s => s.coordinates && !s.skipGeocoding).length,
      stopsWithNeighborhoods: stopsWithNeighborhoods.length,
      stopsWithoutNeighborhoods: stopsWithoutNeighborhoods.length,
      uniqueNeighborhoods: Array.from(neighborhoods).sort(),
      neighborhoodCount: neighborhoods.size,
      hasMultipleNeighborhoods: neighborhoods.size > 1,
      stopsWithNeighborhoodsList: stopsWithNeighborhoods,
      stopsWithoutNeighborhoodsList: stopsWithoutNeighborhoods
    };
  } catch (error) {
    return {
      filename: path.basename(routeFilePath),
      error: error.message
    };
  }
}

/**
 * Main analysis
 */
function main() {
  console.log('🔍 Analyzing Processed Routes for Neighborhoods\n');
  console.log('='.repeat(80));
  
  const routeFiles = getAllProcessedRouteFiles();
  console.log(`\nFound ${routeFiles.length} processed route files\n`);
  
  const results = routeFiles.map(analyzeRoute);
  
  // Summary statistics
  const routesWithMultipleNeighborhoods = results.filter(r => r.hasMultipleNeighborhoods === true);
  const routesWithNoNeighborhoods = results.filter(r => r.hasStops && r.stopsWithNeighborhoods === 0 && r.stopsWithCoordinates > 0);
  const routesWithSomeNeighborhoods = results.filter(r => r.hasStops && r.stopsWithNeighborhoods > 0 && r.stopsWithNeighborhoods < r.stopsWithCoordinates);
  const routesWithAllNeighborhoods = results.filter(r => r.hasStops && r.stopsWithNeighborhoods === r.stopsWithCoordinates && r.stopsWithCoordinates > 0);
  
  console.log('\n📊 SUMMARY STATISTICS\n');
  console.log(`Total routes analyzed: ${results.length}`);
  console.log(`Routes with multiple neighborhoods: ${routesWithMultipleNeighborhoods.length}`);
  console.log(`Routes with no neighborhoods saved: ${routesWithNoNeighborhoods.length}`);
  console.log(`Routes with some neighborhoods (incomplete): ${routesWithSomeNeighborhoods.length}`);
  console.log(`Routes with all neighborhoods saved: ${routesWithAllNeighborhoods.length}`);
  
  // Routes with multiple neighborhoods
  if (routesWithMultipleNeighborhoods.length > 0) {
    console.log('\n\n🎯 ROUTES WITH MULTIPLE NEIGHBORHOODS\n');
    console.log('='.repeat(80));
    for (const route of routesWithMultipleNeighborhoods) {
      console.log(`\n📌 Route: ${route.routeName} (${route.direction}) - ${route.filename}`);
      console.log(`   Neighborhoods (${route.neighborhoodCount}): ${route.uniqueNeighborhoods.join(', ')}`);
      console.log(`   Stops: ${route.stopsWithNeighborhoods} with neighborhoods, ${route.stopsWithoutNeighborhoods} without`);
    }
  }
  
  // Routes missing neighborhoods
  if (routesWithNoNeighborhoods.length > 0) {
    console.log('\n\n❌ ROUTES WITH NO NEIGHBORHOODS SAVED (but have coordinates)\n');
    console.log('='.repeat(80));
    for (const route of routesWithNoNeighborhoods.slice(0, 10)) { // Show first 10
      console.log(`\n📌 Route: ${route.routeName} (${route.direction}) - ${route.filename}`);
      console.log(`   Has ${route.stopsWithCoordinates} stops with coordinates but no neighborhoods saved`);
      if (route.stopsWithoutNeighborhoodsList.length > 0) {
        console.log(`   Example stop: ${route.stopsWithoutNeighborhoodsList[0].address}`);
      }
    }
    if (routesWithNoNeighborhoods.length > 10) {
      console.log(`\n   ... and ${routesWithNoNeighborhoods.length - 10} more routes`);
    }
  }
  
  // Routes with incomplete neighborhoods
  if (routesWithSomeNeighborhoods.length > 0) {
    console.log('\n\n⚠️  ROUTES WITH INCOMPLETE NEIGHBORHOODS\n');
    console.log('='.repeat(80));
    for (const route of routesWithSomeNeighborhoods.slice(0, 10)) { // Show first 10
      console.log(`\n📌 Route: ${route.routeName} (${route.direction}) - ${route.filename}`);
      console.log(`   ${route.stopsWithNeighborhoods}/${route.stopsWithCoordinates} stops have neighborhoods`);
      if (route.uniqueNeighborhoods.length > 0) {
        console.log(`   Neighborhoods: ${route.uniqueNeighborhoods.join(', ')}`);
      }
      if (route.stopsWithoutNeighborhoodsList.length > 0) {
        console.log(`   Missing neighborhood for: ${route.stopsWithoutNeighborhoodsList[0].address}`);
      }
    }
    if (routesWithSomeNeighborhoods.length > 10) {
      console.log(`\n   ... and ${routesWithSomeNeighborhoods.length - 10} more routes`);
    }
  }
  
  // Detailed breakdown by neighborhood count
  console.log('\n\n📈 BREAKDOWN BY NUMBER OF NEIGHBORHOODS\n');
  console.log('='.repeat(80));
  const neighborhoodCounts = {};
  results.forEach(r => {
    if (r.neighborhoodCount !== undefined) {
      neighborhoodCounts[r.neighborhoodCount] = (neighborhoodCounts[r.neighborhoodCount] || 0) + 1;
    }
  });
  
  Object.keys(neighborhoodCounts)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(count => {
      console.log(`   ${count} neighborhood(s): ${neighborhoodCounts[count]} routes`);
    });
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Analysis complete!\n');
}

main();











