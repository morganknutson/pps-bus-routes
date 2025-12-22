/**
 * Re-geocode all existing processed route JSON files using Google Maps API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import backend services
const backendDir = path.join(__dirname, '..', 'backend');
const geocodingServicePath = path.join(backendDir, 'services', 'geocodingService.js');
const { geocodingService } = await import(`file://${geocodingServicePath}`);
const schoolUtilsPath = path.join(backendDir, 'utils', 'schoolUtils.js');
const { getSchoolIdFromFilename, getSchoolPdfDir } = await import(`file://${schoolUtilsPath}`);

const DATA_DIR = path.join(__dirname, '..', 'data');

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
 * Re-geocode stops for a route
 */
async function regeocodeRoute(routeData) {
  const stopsToGeocode = routeData.stops.filter(stop => 
    !stop.skipGeocoding && stop.address
  );
  
  if (stopsToGeocode.length === 0) {
    return routeData; // No stops to geocode
  }
  
  console.log(`   Geocoding ${stopsToGeocode.length} stops...`);
  
  // Re-geocode all stops
  const geocodedStops = await geocodingService.geocodeStops(stopsToGeocode);
  
  // Map geocoded stops back to original stops array
  const geocodedMap = new Map();
  geocodedStops.forEach(stop => {
    geocodedMap.set(stop.id, stop);
  });
  
  // Update stops in route
  const updatedStops = routeData.stops.map(stop => {
    if (stop.skipGeocoding) {
      return stop; // Keep skipped stops as-is
    }
    
    const geocoded = geocodedMap.get(stop.id);
    if (geocoded) {
      return {
        ...stop,
        coordinates: geocoded.coordinates,
        displayName: geocoded.displayName,
        isApproximate: geocoded.isApproximate || undefined,
        geocodeWarning: geocoded.geocodeWarning || undefined,
        geocodeError: geocoded.geocodeError || undefined,
      };
    }
    
    return stop;
  });
  
  // Update stats
  const geocodedCount = updatedStops.filter(s => s.coordinates).length;
  const failedCount = updatedStops.filter(s => !s.coordinates && !s.skipGeocoding).length;
  
  return {
    ...routeData,
    stops: updatedStops,
    processedAt: new Date().toISOString(),
    stats: {
      totalStops: routeData.stops.length,
      geocodedStops: geocodedCount,
      failedStops: failedCount,
    },
  };
}

/**
 * Main function to re-geocode all routes
 */
async function regeocodeAllRoutes() {
  console.log('🔄 Re-geocoding All Processed Routes');
  console.log('====================================\n');
  
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
    errors: [],
  };
  
  // Process each route file
  for (let i = 0; i < routeFiles.length; i++) {
    const routeFile = routeFiles[i];
    console.log(`[${i + 1}/${routeFiles.length}] Processing: ${routeFile.filename} (${routeFile.schoolId})`);
    
    try {
      // Load route data
      const routeData = JSON.parse(fs.readFileSync(routeFile.filePath, 'utf8'));
      
      // Re-geocode stops
      const updatedRoute = await regeocodeRoute(routeData);
      
      // Save updated route
      fs.writeFileSync(routeFile.filePath, JSON.stringify(updatedRoute, null, 2));
      
      const geocodedCount = updatedRoute.stops.filter(s => s.coordinates).length;
      const totalStops = updatedRoute.stops.length;
      
      console.log(`   ✅ Re-geocoded: ${geocodedCount}/${totalStops} stops`);
      results.success++;
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
  console.log('====================================');
  console.log('✅ Re-geocoding Complete!');
  console.log(`📊 Summary:`);
  console.log(`   Total: ${results.total}`);
  console.log(`   Success: ${results.success}`);
  console.log(`   Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log(`\n⚠️  Errors:`);
    results.errors.forEach(err => {
      console.log(`   ${err.file}: ${err.error}`);
    });
  }
}

// Run the script
regeocodeAllRoutes().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});














