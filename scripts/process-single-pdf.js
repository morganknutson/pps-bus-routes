import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import backend services
const backendDir = path.join(__dirname, '..', 'backend');
const routeProcessorPath = path.join(backendDir, 'services', 'routeProcessor.js');
const { processSinglePDF } = await import(`file://${routeProcessorPath}`);

const DATA_DIR = path.join(__dirname, '..', 'data');
  // Filter out stops that should skip geocoding (e.g., CAB LOAD ZONE)
  const stopsToGeocode = stops.filter(stop => !stop.skipGeocoding);
  const skippedStops = stops.filter(stop => stop.skipGeocoding);
  
  console.log(`\n📍 Geocoding ${stopsToGeocode.length} stops (${skippedStops.length} skipped)...`);
  
  const geocodedStops = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    
    // Skip geocoding for stops marked to skip (e.g., LOADING ZONE, CAB LOAD ZONE)
    if (stop.skipGeocoding) {
      geocodedStops.push({
        ...stop,
        coordinates: null,
        skipGeocoding: true,
      });
      console.log(`  [${i + 1}/${stops.length}] ${stop.address}... ⏭️  Skipped (Loading Zone)`);
      continue;
    }
    
    // Skip geocoding for school stops that already have coordinates from schools.json
    // School stops should ALWAYS use address and coordinates from schools.json, never geocoded
    if (stop.isSchoolStop && stop.coordinates && Array.isArray(stop.coordinates) && stop.coordinates.length === 2) {
      geocodedStops.push({
        ...stop,
        // Keep existing coordinates from schools.json
        skipGeocoding: false, // Keep false to indicate it has coordinates, just not from geocoding
      });
      console.log(`  [${i + 1}/${stops.length}] ${stop.address}... ⏭️  Skipped (School stop with coordinates from schools.json)`);
      continue;
    }
    
    let address = stop.address;
    process.stdout.write(`  [${i + 1}/${stops.length}] ${address}... `);
    
    // Check if this is an intersection
    const isIntersection = address.includes('&') || address.includes(' AND ');
    
    let result;
    if (isIntersection) {
      result = await geocodeIntersection(address, city, state);
    } else {
      result = await geocodeAddress(address, city, state);
    }
    
    if (result.success) {
      const stopData = {
        ...stop,
        coordinates: result.coordinates,
        displayName: result.displayName,
      };
      
      // Add flag if this is an approximate location
      if (result.isApproximate) {
        stopData.isApproximate = true;
        stopData.geocodeWarning = 'Intersection not found, using approximate location';
      }
      
      // Get neighborhood from coordinates using reverse geocoding
      if (stopData.coordinates) {
        try {
          const neighborhoodResult = await neighborhoodService.getNeighborhood(stopData.coordinates);
          if (neighborhoodResult.success && neighborhoodResult.neighborhood) {
            stopData.neighborhood = neighborhoodResult.neighborhood;
          }
        } catch (error) {
          // Non-critical error - continue without neighborhood
          console.warn(`    Warning: Failed to get neighborhood: ${error.message}`);
        }
      }
      
      geocodedStops.push(stopData);
      successCount++;
      const approxFlag = result.isApproximate ? ' (approx)' : '';
      const neighborhoodFlag = stopData.neighborhood ? ` [${stopData.neighborhood}]` : '';
      console.log(`✓ [${result.coordinates[0]}, ${result.coordinates[1]}]${approxFlag}${neighborhoodFlag}`);
    } else {
      geocodedStops.push({
        ...stop,
        coordinates: null,
        geocodeError: result.error,
      });
      failCount++;
      console.log(`✗ ${result.error}`);
    }
    
    // Rate limiting handled by geocodingService
    // (Google API doesn't need delays, Nominatim does)
  }
  
  // Check for duplicate coordinates
  const coordMap = new Map();
  geocodedStops.forEach((stop, index) => {
    if (stop.coordinates) {
      const key = stop.coordinates.join(',');
      if (!coordMap.has(key)) {
        coordMap.set(key, []);
      }
      coordMap.get(key).push({ index, stop });
    }
  });
  
  const duplicates = [];
  coordMap.forEach((stopsAtCoord, coords) => {
    if (stopsAtCoord.length > 1) {
      duplicates.push({ coords, stops: stopsAtCoord });
    }
  });
  
  if (duplicates.length > 0) {
    console.log(`\n⚠️  WARNING: Found ${duplicates.length} sets of duplicate coordinates:`);
    duplicates.forEach(({ coords, stops: stopsList }) => {
      console.log(`   📍 [${coords}] - ${stopsList.length} stops:`);
      stopsList.forEach(({ stop }) => {
        console.log(`      - ${stop.address}${stop.isApproximate ? ' (approximate)' : ''}`);
      });
    });
    console.log(`\n   This may indicate that intersections are not being found correctly.`);
    console.log(`   Consider manually verifying these locations.\n`);
  }
  
  console.log(`\n✅ Geocoding complete: ${successCount} successful, ${failCount} failed`);
  
  // Save neighborhood cache after processing
  neighborhoodService.saveCache();
  
  return geocodedStops;
}

/**
 * Process a single PDF: parse route, geocode stops, and save to JSON
 */
async function processPDF(pdfPath) {
  console.log('🚌 Processing Single PDF Route');
  console.log('================================\n');
  
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }
  
  const filename = path.basename(pdfPath);
  console.log(`📄 PDF: ${filename}`);
  
  // Step 1: Read and parse PDF
  console.log('\n📖 Reading PDF...');
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(pdfBuffer);
  const text = pdfData.text;
  
  console.log(`   PDF text length: ${text.length} characters`);
  
  // Step 2: Parse route from PDF text
  console.log('\n🔍 Parsing route and stops...');
  const route = parseRouteFromPDF(text, null, filename);
  
  console.log(`   Route: ${route.name}`);
  console.log(`   Stops found: ${route.stops.length}`);
  if (route.anchorName) {
    console.log(`   Anchor name: ${route.anchorName}`);
  }
  
  if (route.stops.length === 0) {
    throw new Error('No stops found in PDF');
  }
  
  // Step 2.5: Load schools and match to school
  let matchedSchool = null;
  if (route.anchorName && fs.existsSync(SCHOOLS_FILE)) {
    const schoolsContent = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(schoolsContent);
    matchedSchool = matchSchoolFromAnchorName(route.anchorName, schools);
    if (matchedSchool) {
      console.log(`   Matched to school: ${matchedSchool.name} (ID: ${matchedSchool.id})`);
      if (matchedSchool.address && matchedSchool.coordinates) {
        console.log(`   📍 School address from schools.json: ${matchedSchool.address}`);
        console.log(`   📍 School coordinates from schools.json: [${matchedSchool.coordinates[0]}, ${matchedSchool.coordinates[1]}]`);
      } else {
        console.log(`   ⚠️  School missing address/coordinates - school stop will not be added`);
      }
    } else {
      console.log(`   ⚠️  Could not match anchor name to a school`);
    }
  }
  
  // Step 3: Geocode all stops
  const geocodedStops = await geocodeStops(route.stops);
  
  // Step 4: Add school stop from schools.json if matched
  let finalStops = geocodedStops;
  if (matchedSchool) {
    // VALIDATION: Ensure we have the required data from schools.json
    if (!matchedSchool.address) {
      console.log(`\n   ❌ ERROR: School "${matchedSchool.name}" is missing address in schools.json`);
      console.log(`      School stop will NOT be added. Please update schools.json with verified address.`);
    } else if (!matchedSchool.coordinates || !Array.isArray(matchedSchool.coordinates) || matchedSchool.coordinates.length !== 2) {
      console.log(`\n   ❌ ERROR: School "${matchedSchool.name}" is missing valid coordinates in schools.json`);
      console.log(`      School stop will NOT be added. Please update schools.json with verified coordinates.`);
    } else {
      // Extract coordinates - validate format
      let schoolCoordinates = null;
      
      // Handle [lng, lat] format (expected format from Google Places API)
      if (Array.isArray(matchedSchool.coordinates) && matchedSchool.coordinates.length === 2) {
        const [lng, lat] = matchedSchool.coordinates;
        if (typeof lng === 'number' && typeof lat === 'number' && 
            !isNaN(lng) && !isNaN(lat) &&
            lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
          schoolCoordinates = [lng, lat];
        } else {
          console.log(`\n   ❌ ERROR: Invalid coordinate format in schools.json`);
          console.log(`      Expected [longitude, latitude] with valid numbers`);
          console.log(`      Got: [${lng}, ${lat}]`);
        }
      }
      // Handle {lat, lng} format (legacy support)
      else if (matchedSchool.coordinates.lat && matchedSchool.coordinates.lng) {
        const { lat, lng } = matchedSchool.coordinates;
        if (typeof lng === 'number' && typeof lat === 'number' && 
            !isNaN(lng) && !isNaN(lat) &&
            lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
          schoolCoordinates = [lng, lat];
          console.log(`   ⚠️  WARNING: Using legacy coordinate format, converting to [lng, lat]`);
        }
      }
      // Also check for lat/lng at top level (legacy support)
      else if (matchedSchool.lat && matchedSchool.lng) {
        const { lat, lng } = matchedSchool;
        if (typeof lng === 'number' && typeof lat === 'number' && 
            !isNaN(lng) && !isNaN(lat) &&
            lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
          schoolCoordinates = [lng, lat];
          console.log(`   ⚠️  WARNING: Using legacy top-level coordinate format, converting to [lng, lat]`);
        }
      }
      
      // VALIDATION: Use EXACT address from schools.json (no transformation)
      // This ensures we use the Google Places API verified address
      const schoolAddress = matchedSchool.address.trim();
      
      if (schoolCoordinates && schoolAddress) {
        // Log what we're using for the school stop
        console.log(`\n   ✅ Creating school stop with verified data from schools.json:`);
        console.log(`      Address: "${schoolAddress}"`);
        console.log(`      Coordinates: [${schoolCoordinates[0]}, ${schoolCoordinates[1]}]`);
        console.log(`      School Name: "${matchedSchool.name}"`);
        
        const schoolStop = {
          id: 'stop-0',
          address: schoolAddress, // EXACT address from schools.json (no transformation)
          time: null,
          direction: null,
          originalLine: `Anchor Name:${route.anchorName}`,
          isSchoolStop: true,
          skipGeocoding: false, // Don't skip - we already have coordinates
          coordinates: schoolCoordinates, // EXACT coordinates from schools.json
          displayName: schoolAddress, // Use exact address for display
          schoolName: matchedSchool.name, // Store school name for display
        };
        
        // VALIDATION: Verify the stop was created correctly
        if (schoolStop.address !== matchedSchool.address) {
          console.log(`\n   ❌ ERROR: Address was transformed! Expected "${matchedSchool.address}", got "${schoolStop.address}"`);
          throw new Error('School address transformation detected - this should not happen');
        }
        
        // Add school stop based on route direction
        if (route.direction === 'Morning') {
          // Morning: school stop is LAST (end of route)
          finalStops = [...geocodedStops, schoolStop];
          console.log(`   ✓ Added school stop at END of route (Morning route)`);
        } else if (route.direction === 'Afternoon') {
          // Afternoon: school stop is FIRST (beginning of route)
          finalStops = [schoolStop, ...geocodedStops];
          console.log(`   ✓ Added school stop at BEGINNING of route (Afternoon route)`);
        } else {
          // Unknown direction: add at end
          finalStops = [...geocodedStops, schoolStop];
          console.log(`   ✓ Added school stop at END of route (unknown direction - defaulting to end)`);
        }
        
        // Final validation log
        const addedStop = finalStops.find(s => s.isSchoolStop);
        if (addedStop) {
          console.log(`   ✅ Verification: School stop added successfully`);
          console.log(`      Position: ${route.direction === 'Afternoon' ? 'FIRST' : 'LAST'} stop`);
          console.log(`      Address matches schools.json: ${addedStop.address === matchedSchool.address ? '✓ YES' : '✗ NO'}`);
          console.log(`      Coordinates match schools.json: ${JSON.stringify(addedStop.coordinates) === JSON.stringify(matchedSchool.coordinates) ? '✓ YES' : '✗ NO'}`);
        }
      } else {
        console.log(`\n   ⚠️  School missing address/coordinates - school stop will not be added`);
        if (!schoolAddress) console.log(`      Missing: address`);
        if (!schoolCoordinates) console.log(`      Missing: coordinates`);
      }
    }
  }
  
  // Step 5: Calculate route geometry (street-following path between stops)
  console.log('\n🗺️  Calculating route geometry...');
  let routeGeometry = null;
  const stopsWithCoords = finalStops.filter(s => s.coordinates && !s.skipGeocoding);
  
  if (stopsWithCoords.length >= 2) {
    try {
      // Convert coordinates from [lng, lat] to [lat, lng] for directions service
      const waypoints = stopsWithCoords.map(stop => {
        const [lng, lat] = stop.coordinates;
        return [lat, lng]; // Directions service expects [lat, lng]
      });
      
      console.log(`   Calculating route for ${waypoints.length} waypoints...`);
      const routeResult = await directionsService.getRoute(waypoints);
      
      if (routeResult.success && routeResult.coordinates && routeResult.coordinates.length > 0) {
        routeGeometry = routeResult.coordinates; // Already in [lat, lng] format
        console.log(`   ✅ Route geometry calculated: ${routeGeometry.length} points via ${routeResult.provider || 'unknown'}`);
      } else {
        console.warn(`   ⚠️  Failed to calculate route geometry: ${routeResult.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`   ❌ Error calculating route geometry:`, error.message);
      // Continue without geometry - route will still be saved
    }
  } else {
    console.log(`   ⚠️  Insufficient stops with coordinates (${stopsWithCoords.length}) to calculate route geometry`);
  }
  
  // Step 6: Create final route object
  // Filter out loading zone stops (skipGeocoding: true) - these are not actual bus stops
  // Loading zones are where buses park at night and should not be included in routes
  const routeStops = finalStops.filter(s => !s.skipGeocoding);
  
  // Calculate stats (all stops in routeStops should be geocoded)
  const stopsForStats = routeStops;
  
  // Aggregate unique neighborhoods from all stops
  const neighborhoodsSet = new Set();
  for (const stop of routeStops) {
    if (stop.neighborhood && typeof stop.neighborhood === 'string' && stop.neighborhood.trim()) {
      neighborhoodsSet.add(stop.neighborhood.trim());
    }
  }
  const neighborhoods = Array.from(neighborhoodsSet).sort();
  
  if (neighborhoods.length > 0) {
    console.log(`\n📍 Route passes through ${neighborhoods.length} neighborhood(s): ${neighborhoods.join(', ')}`);
  }
  
  const finalRoute = {
    id: route.id,
    name: route.name, // Just the number, e.g., "100"
    direction: route.direction, // "Morning" or "Afternoon"
    filename: route.filename,
    stops: routeStops, // Only include actual bus stops (excludes loading zones)
    neighborhoods: neighborhoods, // Aggregated unique neighborhoods from all stops
    processedAt: new Date().toISOString(),
    stats: {
      totalStops: stopsForStats.length, // Only count stops that should be geocoded
      geocodedStops: stopsForStats.filter(s => s.coordinates).length,
      failedStops: stopsForStats.filter(s => !s.coordinates).length,
    },
    geometry: routeGeometry, // Street-following route geometry [lat, lng][]
  };
  
  // Step 7: Save to JSON file in school-specific directory
  const schoolId = getSchoolIdFromFilename(filename);
  if (!schoolId) {
    throw new Error(`Could not determine school from filename: ${filename}`);
  }
  
  const processedRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
  if (!fs.existsSync(processedRoutesDir)) {
    fs.mkdirSync(processedRoutesDir, { recursive: true });
  }
  
  const outputFilename = filename.replace('.pdf', '.json');
  const outputPath = path.join(processedRoutesDir, outputFilename);
  
  console.log(`\n💾 Saving to: ${outputPath}`);
  fs.writeFileSync(outputPath, JSON.stringify(finalRoute, null, 2));
  
  console.log('\n✅ Processing complete!');
  console.log(`\n📊 Summary:`);
  console.log(`   Route: ${finalRoute.name}`);
  console.log(`   Total stops: ${finalRoute.stats.totalStops}`);
  console.log(`   Geocoded: ${finalRoute.stats.geocodedStops}`);
  console.log(`   Failed: ${finalRoute.stats.failedStops}`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   School: ${schoolId}`);
  
  return finalRoute;
}

// Main execution
const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error('Usage: node scripts/process-single-pdf.js <path-to-pdf>');
  console.error('\nExample:');
  console.error('  node scripts/process-single-pdf.js data/schools/west-sylvan/pdfs/100SYL-A_effective_082625.pdf');
  process.exit(1);
}

// Resolve relative paths
const resolvedPath = path.isAbsolute(pdfPath) 
  ? pdfPath 
  : path.join(__dirname, '..', pdfPath);

processPDF(resolvedPath)
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });

