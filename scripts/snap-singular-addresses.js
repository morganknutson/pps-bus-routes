/**
 * Snap all singular address stops to streets
 * 
 * This script:
 * 1. Finds all processed route JSON files
 * 2. Identifies stops that are singular addresses (not intersections)
 * 3. Re-geocodes them to check if they're house addresses
 * 4. Snaps house addresses to the nearest street using Google Roads API
 * 5. Updates coordinates in the route files
 * 
 * Usage: node scripts/snap-singular-addresses.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import backend services
const backendDir = path.join(__dirname, '..', 'backend');
const geocodingServicePath = path.join(backendDir, 'services', 'geocodingService.js');
const { geocodingService } = await import(`file://${geocodingServicePath}`);

const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * Check if an address is a singular address (not an intersection)
 * Intersections typically contain "&" or " AND "
 */
function isSingularAddress(address) {
  if (!address) return false;
  
  // Check for intersection indicators
  const hasAmpersand = address.includes('&');
  const hasAnd = /\s+AND\s+/i.test(address);
  
  // If it has either, it's an intersection
  if (hasAmpersand || hasAnd) {
    return false;
  }
  
  return true;
}

/**
 * Find all processed route JSON files
 */
function findAllProcessedRoutes() {
  const routes = [];
  const schoolsDir = path.join(DATA_DIR, 'schools');
  
  if (!fs.existsSync(schoolsDir)) {
    return routes;
  }
  
  const schoolDirs = fs.readdirSync(schoolsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  for (const schoolId of schoolDirs) {
    const processedRoutesDir = path.join(schoolsDir, schoolId, 'processed-routes');
    
    if (fs.existsSync(processedRoutesDir)) {
      const files = fs.readdirSync(processedRoutesDir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({
          schoolId,
          filename: f,
          filePath: path.join(processedRoutesDir, f),
        }));
      
      routes.push(...files);
    }
  }
  
  return routes;
}

/**
 * Process a single route file to snap singular addresses
 */
async function snapSingularAddressesInRoute(routeData) {
  const updatedStops = [];
  let snappedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const stop of routeData.stops) {
    // Skip if:
    // - No address
    // - Marked to skip geocoding
    // - No coordinates
    // - Is an intersection (not a singular address)
    // - Is a school stop (should use school coordinates)
    if (
      !stop.address ||
      stop.skipGeocoding ||
      !stop.coordinates ||
      !Array.isArray(stop.coordinates) ||
      stop.coordinates.length !== 2 ||
      !isSingularAddress(stop.address) ||
      stop.isSchoolStop
    ) {
      updatedStops.push(stop);
      if (!stop.address || stop.skipGeocoding || !stop.coordinates || !isSingularAddress(stop.address)) {
        skippedCount++;
      }
      continue;
    }
    
    try {
      // Re-geocode the address to check if it's a house address
      const geocodeResult = await geocodingService.geocodeAddress(stop.address);
      
      if (!geocodeResult.success) {
        // If geocoding fails, keep original stop
        console.warn(`      ⚠️  Failed to geocode "${stop.address}": ${geocodeResult.error}`);
        updatedStops.push(stop);
        errorCount++;
        continue;
      }
      
      // Check if this is a house address
      const isHouse = geocodingService.isHouseAddress(geocodeResult);
      
      if (!isHouse) {
        // Not a house address, keep original coordinates
        updatedStops.push(stop);
        skippedCount++;
        continue;
      }
      
      // It's a house address - snap it to the street
      const originalCoords = stop.coordinates;
      const snappedCoords = await geocodingService.snapHouseAddressToStreet(originalCoords);
      
      // Check if coordinates changed
      const coordsChanged = 
        Math.abs(originalCoords[0] - snappedCoords[0]) > 0.000001 ||
        Math.abs(originalCoords[1] - snappedCoords[1]) > 0.000001;
      
      if (coordsChanged) {
        // Calculate distance moved
        const distanceMoved = geocodingService.calculateDistance(originalCoords, snappedCoords);
        
        console.log(`      ✅ Snapped "${stop.address}"`);
        console.log(`         From: [${originalCoords[0]}, ${originalCoords[1]}]`);
        console.log(`         To:   [${snappedCoords[0]}, ${snappedCoords[1]}]`);
        console.log(`         Distance: ${distanceMoved.toFixed(1)}m`);
        
        // Update stop with snapped coordinates
        updatedStops.push({
          ...stop,
          coordinates: snappedCoords,
          snappedFromHouse: true,
          originalCoordinates: originalCoords,
          snapDistance: distanceMoved,
        });
        
        snappedCount++;
      } else {
        // Coordinates didn't change (snapping failed or wasn't needed)
        updatedStops.push(stop);
        skippedCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`      ❌ Error processing "${stop.address}": ${error.message}`);
      updatedStops.push(stop);
      errorCount++;
    }
  }
  
  return {
    ...routeData,
    stops: updatedStops,
    snapStats: {
      snapped: snappedCount,
      skipped: skippedCount,
      errors: errorCount,
      total: routeData.stops.length,
    },
  };
}

/**
 * Main function to snap all singular addresses
 */
async function snapAllSingularAddresses() {
  console.log('📍 Snapping Singular Addresses to Streets');
  console.log('==========================================\n');
  console.log('This script will:');
  console.log('  1. Find all processed route files');
  console.log('  2. Identify stops with singular addresses (not intersections)');
  console.log('  3. Re-geocode to check if they are house addresses');
  console.log('  4. Snap house addresses to the nearest street');
  console.log('  5. Update coordinates in route files\n');
  
  // Find all processed route files
  const routeFiles = findAllProcessedRoutes();
  
  if (routeFiles.length === 0) {
    console.log('❌ No processed route files found');
    return;
  }
  
  console.log(`📂 Found ${routeFiles.length} processed route files\n`);
  
  const results = {
    total: routeFiles.length,
    success: 0,
    failed: 0,
    totalSnapped: 0,
    totalSkipped: 0,
    totalErrors: 0,
    errors: [],
  };
  
  // Process each route file
  for (let i = 0; i < routeFiles.length; i++) {
    const routeFile = routeFiles[i];
    console.log(`[${i + 1}/${routeFiles.length}] Processing: ${routeFile.filename} (${routeFile.schoolId})`);
    
    try {
      // Load route data
      const routeData = JSON.parse(fs.readFileSync(routeFile.filePath, 'utf8'));
      
      // Count singular addresses before processing
      const singularAddresses = routeData.stops.filter(stop => 
        stop.address &&
        !stop.skipGeocoding &&
        stop.coordinates &&
        Array.isArray(stop.coordinates) &&
        stop.coordinates.length === 2 &&
        isSingularAddress(stop.address) &&
        !stop.isSchoolStop
      );
      
      console.log(`   Found ${singularAddresses.length} singular addresses to check`);
      
      // Snap singular addresses
      const updatedRoute = await snapSingularAddressesInRoute(routeData);
      
      // Save updated route
      fs.writeFileSync(routeFile.filePath, JSON.stringify(updatedRoute, null, 2));
      
      const stats = updatedRoute.snapStats || { snapped: 0, skipped: 0, errors: 0 };
      console.log(`   ✅ Snapped: ${stats.snapped}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`);
      
      results.success++;
      results.totalSnapped += stats.snapped;
      results.totalSkipped += stats.skipped;
      results.totalErrors += stats.errors;
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.failed++;
      results.errors.push({
        file: routeFile.filename,
        error: error.message,
      });
    }
    
    console.log('');
  }
  
  // Summary
  console.log('==========================================');
  console.log('✅ Snapping Complete!');
  console.log(`📊 Summary:`);
  console.log(`   Total routes: ${results.total}`);
  console.log(`   Success: ${results.success}`);
  console.log(`   Failed: ${results.failed}`);
  console.log(`   Total snapped: ${results.totalSnapped}`);
  console.log(`   Total skipped: ${results.totalSkipped}`);
  console.log(`   Total errors: ${results.totalErrors}`);
  
  if (results.errors.length > 0) {
    console.log(`\n⚠️  Errors:`);
    results.errors.forEach(err => {
      console.log(`   ${err.file}: ${err.error}`);
    });
  }
}

// Run the script
snapAllSingularAddresses().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});






