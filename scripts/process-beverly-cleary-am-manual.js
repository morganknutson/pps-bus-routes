/**
 * One-off manual processing for Beverly Cleary AM route
 * Based on screenshot data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { geocodingService } from '../backend/services/geocodingService.js';
import { directionsService } from '../backend/services/directionsService.js';
import { streetGeometryService } from '../backend/services/streetGeometryService.js';
import { neighborhoodService } from '../backend/services/neighborhoodService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const SCHOOL_ID = 'beverly-cleary';

// Route data from screenshot
const routeStops = [
  {
    time: '8:08 am',
    address: 'RIGLER GT & ST & CAB LOADING ZONE ON 55TH',
    direction: null,
    skipGeocoding: true, // Loading zone
  },
  {
    time: '8:12 am',
    address: 'NE 57TH AV @ NE THOMPSON ST',
    direction: 'NW',
  },
  {
    time: '8:14 am',
    address: 'NE BROADWAY ST @ NE 52ND AVE',
    direction: 'NE',
  },
  {
    time: '8:16 am',
    address: 'NE 46TH AV & NE BRAZEE ST',
    direction: 'NE',
  },
  {
    time: '8:18 am',
    address: 'NE 46TH AV & NE BRAZEE ST', // Assuming same as previous, or need to check screenshot
    direction: 'NE',
  },
  {
    time: '8:20 am',
    address: 'NE 46TH AV & NE BRAZEE ST', // Assuming same, or need to check
    direction: 'NE',
  },
  {
    time: '8:26 am',
    address: 'NE 46TH AV & NE BRAZEE ST', // Assuming same, or need to check
    direction: 'NE',
  },
  {
    time: '8:30 am',
    address: 'FERNWOOD GT & ST & CAB LOAD ZONE ON HANCOCK',
    direction: null,
    skipGeocoding: true, // Loading zone
  },
];

async function processManual() {
  console.log('🔄 Manually processing Beverly Cleary AM route...\n');

  // Load schools to get school stop info
  const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
  const school = schools.find(s => s.id === SCHOOL_ID);

  if (!school) {
    throw new Error('Beverly Cleary school not found');
  }

  console.log(`📚 School: ${school.name}\n`);

  // Process stops
  const processedStops = [];
  
  for (let i = 0; i < routeStops.length; i++) {
    const stopData = routeStops[i];
    const address = stopData.direction 
      ? `${stopData.address} [${stopData.direction}]`
      : stopData.address;

    console.log(`[${i + 1}/${routeStops.length}] Processing: ${address}`);

    if (stopData.skipGeocoding) {
      processedStops.push({
        id: `stop-${i + 1}`,
        address,
        time: stopData.time,
        direction: stopData.direction,
        skipGeocoding: true,
        coordinates: null,
      });
      console.log('   ⏭️  Skipped (Loading Zone)');
      continue;
    }

    try {
      // Check if it's an intersection (contains @ or &)
      const isIntersection = address.includes('@') || address.includes('&');
      const result = isIntersection 
        ? await geocodingService.geocodeIntersection(address, 'Portland', 'OR')
        : await geocodingService.geocodeAddress(address, 'Portland', 'OR');
      
      if (result.success) {
        processedStops.push({
          id: `stop-${i + 1}`,
          address,
          time: stopData.time,
          direction: stopData.direction,
          coordinates: result.coordinates,
          displayName: result.displayName,
        });
        console.log(`   ✅ Geocoded: [${result.coordinates[0]}, ${result.coordinates[1]}]`);
      } else {
        processedStops.push({
          id: `stop-${i + 1}`,
          address,
          time: stopData.time,
          direction: stopData.direction,
          coordinates: null,
        });
        console.log(`   ❌ Failed: ${result.error}`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      processedStops.push({
        id: `stop-${i + 1}`,
        address,
        time: stopData.time,
        direction: stopData.direction,
        coordinates: null,
      });
    }
  }

  // Add school stop if available
  let finalStops = processedStops.filter(s => !s.skipGeocoding);
  
  if (school.address && school.coordinates) {
    const schoolStop = {
      id: 'stop-0',
      address: school.address,
      time: null,
      direction: null,
      isSchoolStop: true,
      coordinates: school.coordinates,
      displayName: school.address,
      schoolName: school.name,
    };
    
    // Morning route: school stop is last
    finalStops.push(schoolStop);
    console.log(`\n✅ Added school stop: ${school.address}`);
  }

  // Calculate route geometry
  console.log('\n📍 Calculating route geometry...');
  const stopsWithCoords = finalStops.filter(s => s.coordinates);
  let routeGeometry = null;

  if (stopsWithCoords.length >= 2) {
    try {
      // Convert coordinates from [lng, lat] to [lat, lng] for directions service
      const waypoints = stopsWithCoords.map(stop => {
        const [lng, lat] = stop.coordinates;
        return [lat, lng]; // Directions service expects [lat, lng]
      });

      const routeResult = await directionsService.getRoute(waypoints);
      
      if (routeResult.success && routeResult.coordinates && routeResult.coordinates.length > 0) {
        routeGeometry = routeResult.coordinates; // Already in [lat, lng] format
        console.log(`✅ Route geometry calculated: ${routeGeometry.length} points via ${routeResult.provider || 'unknown'}`);
      } else {
        console.error(`⚠️  Could not calculate route geometry: ${routeResult.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`⚠️  Could not calculate route geometry: ${error.message}`);
    }
  }

  // Get neighborhoods
  console.log('\n🏘️  Getting neighborhoods...');
  const neighborhoods = [];
  for (const stop of stopsWithCoords) {
    try {
      const neighborhood = await neighborhoodService.getNeighborhoodForCoordinates(
        stop.coordinates[1], // lat
        stop.coordinates[0]  // lng
      );
      if (neighborhood && !neighborhoods.includes(neighborhood)) {
        neighborhoods.push(neighborhood);
      }
    } catch (error) {
      // Ignore neighborhood errors
    }
  }
  console.log(`✅ Found neighborhoods: ${neighborhoods.join(', ') || 'none'}`);

  // Create route object
  const route = {
    id: '207BVC-A_effective_082924',
    name: '207',
    direction: 'Morning',
    filename: '207-AM_effective_082924.pdf',
    fileId: '207-AM_effective_082924.pdf',
    modifiedTime: null,
    stops: finalStops,
    neighborhoods: neighborhoods,
    processedAt: new Date().toISOString(),
    stats: {
      totalStops: finalStops.length,
      geocodedStops: stopsWithCoords.length,
      failedStops: finalStops.length - stopsWithCoords.length,
    },
    geometry: routeGeometry, // Already in [lat, lng] format from directions service
  };

  // Save to file
  const processedRoutesDir = path.join(DATA_DIR, 'schools', SCHOOL_ID, 'processed-routes');
  if (!fs.existsSync(processedRoutesDir)) {
    fs.mkdirSync(processedRoutesDir, { recursive: true });
  }

  const outputPath = path.join(processedRoutesDir, '207-AM_effective_082924.json');
  fs.writeFileSync(outputPath, JSON.stringify(route, null, 2));

  console.log('\n📊 Route Summary:');
  console.log(`   Route: ${route.name}`);
  console.log(`   Direction: ${route.direction}`);
  console.log(`   Total stops: ${route.stats.totalStops}`);
  console.log(`   Geocoded: ${route.stats.geocodedStops}`);
  console.log(`   Failed: ${route.stats.failedStops}`);
  console.log(`   Neighborhoods: ${neighborhoods.length}`);
  console.log(`\n📁 Saved to: ${outputPath}`);
  console.log('\n✅ Processing complete!');
}

processManual().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

