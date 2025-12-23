/**
 * Script to snap school coordinates to the nearest street using Google Roads API
 * Keeps the address text unchanged, only updates coordinates for better curb-side placement
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { StreetGeometryService } from '../services/streetGeometryService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');

// Initialize street geometry service
const streetGeometryService = new StreetGeometryService();

/**
 * Calculate approximate distance between two coordinates in meters
 * Uses Haversine formula for great-circle distance
 * @param coord1 [lng, lat]
 * @param coord2 [lng, lat]
 * @returns distance in meters
 */
function calculateDistance(coord1, coord2) {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function snapSchoolsToStreet() {
  try {
    if (!fs.existsSync(SCHOOLS_FILE)) {
      console.error(`Schools file not found: ${SCHOOLS_FILE}`);
      process.exit(1);
    }

    if (!streetGeometryService.apiKey) {
      console.error('Google Maps API key is required. Set GOOGLE_MAPS_API_KEY or GOOGLE_API_KEY in backend/.env');
      process.exit(1);
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);

    console.log(`🚀 Starting coordinate snapping for ${schools.length} schools\n`);
    console.log('Using Google Roads API to move markers from building rooftops to nearest street curb\n');
    console.log('='.repeat(80) + '\n');

    const results = [];
    const updatedSchools = [...schools];

    // Process schools in chunks to be respectful of rate limits
    const CHUNK_SIZE = 5;
    for (let i = 0; i < schools.length; i += CHUNK_SIZE) {
      const chunk = schools.slice(i, i + CHUNK_SIZE);
      
      console.log(`Processing batch ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(schools.length / CHUNK_SIZE)}...`);

      const promises = chunk.map(async (school) => {
        if (!school.coordinates || !Array.isArray(school.coordinates) || school.coordinates.length !== 2) {
          console.warn(`  ⚠️ Skipping ${school.name}: Missing valid coordinates`);
          return;
        }

        try {
          const [lng, lat] = school.coordinates;
          const point = { lat, lng };
          
          // Snap to roads
          const snappedPoints = await streetGeometryService.snapToRoads([point]);
          
          if (snappedPoints && snappedPoints.length > 0) {
            const snapped = snappedPoints[0];
            const snappedCoords = [snapped.location.longitude, snapped.location.latitude];
            
            const distanceMoved = calculateDistance(school.coordinates, snappedCoords);
            
            // Only use snapped coordinates if movement is reasonable (< 150 meters)
            // Schools can be large, so 150m is a safe buffer for a large campus
            if (distanceMoved < 150) {
              const schoolIndex = updatedSchools.findIndex((s) => s.id === school.id);
              if (schoolIndex !== -1) {
                updatedSchools[schoolIndex] = {
                  ...updatedSchools[schoolIndex],
                  coordinates: snappedCoords,
                  updatedAt: new Date().toISOString(),
                  metadata: {
                    ...(updatedSchools[schoolIndex].metadata || {}),
                    originalCoordinates: school.coordinates,
                    snappedToRoad: true,
                    snappedAt: new Date().toISOString(),
                    snapDistance: distanceMoved
                  }
                };
                
                console.log(`  ✅ ${school.name}: Moved ${distanceMoved.toFixed(1)}m to curb`);
                results.push({ schoolId: school.id, success: true, distance: distanceMoved });
              }
            } else {
              console.warn(`  ⚠️ ${school.name}: Snapping moved point too far (${distanceMoved.toFixed(1)}m), keeping original`);
              results.push({ schoolId: school.id, success: false, reason: 'Too far' });
            }
          } else {
            console.warn(`  ❌ ${school.name}: No road found nearby`);
            results.push({ schoolId: school.id, success: false, reason: 'No road found' });
          }
        } catch (error) {
          console.error(`  ❌ ${school.name}: Error: ${error.message}`);
          results.push({ schoolId: school.id, success: false, error: error.message });
        }
      });

      await Promise.all(promises);
      
      // Delay between batches to avoid rate limits
      if (i + CHUNK_SIZE < schools.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Save updated schools
    fs.writeFileSync(SCHOOLS_FILE, JSON.stringify(updatedSchools, null, 2));

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log('\n' + '='.repeat(80));
    console.log('📊 Snapping Summary');
    console.log('='.repeat(80));
    console.log(`Total schools: ${schools.length}`);
    console.log(`✅ Snapped: ${successCount}`);
    console.log(`❌ Skipped/Failed: ${failureCount}`);
    
    const avgDistance = results.filter(r => r.success).reduce((sum, r) => sum + r.distance, 0) / successCount || 0;
    console.log(`Average distance moved: ${avgDistance.toFixed(1)}m`);
    
    console.log(`\n💾 Updated schools file: ${SCHOOLS_FILE}`);

  } catch (error) {
    console.error('Error in snapping script:', error);
    process.exit(1);
  }
}

snapSchoolsToStreet();

