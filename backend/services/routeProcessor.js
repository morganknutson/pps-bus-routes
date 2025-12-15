/**
 * Core route processing service
 * Processes a single PDF: parses, geocodes, adds school stop, calculates geometry
 * This is the shared logic used by all processors (CLI, API, Scheduler)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { parseRouteFromPDF } from './pdfParser.js';
import { geocodingService } from './geocodingService.js';
import { directionsService } from './directionsService.js';
import { getSchoolIdFromFilename } from '../utils/schoolUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const pdfParse = require(path.join(__dirname, '..', 'node_modules', 'pdf-parse'));

/**
 * Match anchor name to a school by finding school name in the anchor name
 * Returns the school object if found, null otherwise
 */
function matchSchoolFromAnchorName(anchorName, schools) {
  if (!anchorName || !schools || schools.length === 0) {
    return null;
  }
  
  const normalizedAnchor = anchorName.toLowerCase();
  
  // Try to find a school whose name appears in the anchor name
  for (const school of schools) {
    const schoolName = school.name.toLowerCase();
    // Check if school name appears in anchor name
    if (normalizedAnchor.includes(schoolName)) {
      return school;
    }
  }
  
  return null;
}

/**
 * Extract and validate school coordinates from various formats
 * Returns [lng, lat] array or null if invalid
 */
function extractSchoolCoordinates(matchedSchool) {
  // Handle [lng, lat] format (expected format from Google Places API)
  if (Array.isArray(matchedSchool.coordinates) && matchedSchool.coordinates.length === 2) {
    const [lng, lat] = matchedSchool.coordinates;
    if (typeof lng === 'number' && typeof lat === 'number' && 
        !isNaN(lng) && !isNaN(lat) &&
        lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
      return [lng, lat];
    }
  }
  // Handle {lat, lng} format (legacy support)
  else if (matchedSchool.coordinates?.lat && matchedSchool.coordinates?.lng) {
    const { lat, lng } = matchedSchool.coordinates;
    if (typeof lng === 'number' && typeof lat === 'number' && 
        !isNaN(lng) && !isNaN(lat) &&
        lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
      return [lng, lat];
    }
  }
  // Also check for lat/lng at top level (legacy support)
  else if (matchedSchool.lat && matchedSchool.lng) {
    const { lat, lng } = matchedSchool;
    if (typeof lng === 'number' && typeof lat === 'number' && 
        !isNaN(lng) && !isNaN(lat) &&
        lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
      return [lng, lat];
    }
  }
  
  return null;
}

/**
 * Process a single PDF buffer into a processed route
 * This is the core processing logic shared by all processors
 * 
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} filename - PDF filename (e.g., "100SYL-A_effective_082625.pdf")
 * @param {string} fileId - Optional file ID (for Drive files)
 * @param {object} options - Processing options
 * @param {string} options.logPrefix - Prefix for log messages (e.g., "[Scheduler]")
 * @param {boolean} options.saveToFile - Whether to save the processed route to file (default: false)
 * @param {string} options.outputPath - Optional custom output path (if saveToFile is true)
 * @returns {Promise<object>} Processed route object
 */
export async function processSinglePDF(pdfBuffer, filename, fileId = null, options = {}) {
  const {
    logPrefix = '[RouteProcessor]',
    saveToFile = false,
    outputPath = null,
  } = options;

  // Step 1: Parse PDF
  const pdfData = await pdfParse(pdfBuffer);
  const route = parseRouteFromPDF(pdfData.text, fileId || filename, filename);

  if (!route || route.stops.length === 0) {
    throw new Error('No stops found in PDF');
  }

  // Step 2: Load schools.json and match to school
  let matchedSchool = null;
  if (route.anchorName && fs.existsSync(SCHOOLS_FILE)) {
    try {
      const schoolsContent = fs.readFileSync(SCHOOLS_FILE, 'utf8');
      const schools = JSON.parse(schoolsContent);
      matchedSchool = matchSchoolFromAnchorName(route.anchorName, schools);
      if (matchedSchool) {
        console.log(`${logPrefix} Matched to school: ${matchedSchool.name} (ID: ${matchedSchool.id})`);
        if (!matchedSchool.address || !matchedSchool.coordinates) {
          console.log(`${logPrefix} ⚠️  School missing address/coordinates - school stop will not be added`);
        }
      }
    } catch (error) {
      console.error(`${logPrefix} Error loading schools.json:`, error);
    }
  }

  // Step 3: Geocode stops
  const geocodedStops = await geocodingService.geocodeStops(route.stops, 'Portland', 'OR');

  // Step 4: Add school stop from schools.json if matched
  let finalStops = geocodedStops;
  if (matchedSchool && matchedSchool.address && matchedSchool.coordinates) {
    const schoolCoordinates = extractSchoolCoordinates(matchedSchool);
    const schoolAddress = matchedSchool.address.trim();

    if (schoolCoordinates && schoolAddress) {
      const schoolStop = {
        id: 'stop-0',
        address: schoolAddress, // EXACT address from schools.json
        time: null,
        direction: null,
        originalLine: `Anchor Name:${route.anchorName}`,
        isSchoolStop: true,
        skipGeocoding: false, // Don't skip - we already have coordinates
        coordinates: schoolCoordinates, // EXACT coordinates from schools.json
        displayName: schoolAddress,
        schoolName: matchedSchool.name,
      };

      // Add school stop based on route direction
      if (route.direction === 'Morning') {
        // Morning: school stop is LAST (end of route)
        finalStops = [...geocodedStops, schoolStop];
      } else if (route.direction === 'Afternoon') {
        // Afternoon: school stop is FIRST (beginning of route)
        finalStops = [schoolStop, ...geocodedStops];
      } else {
        // Unknown direction: add at end
        finalStops = [...geocodedStops, schoolStop];
      }

      console.log(`${logPrefix} ✅ Added school stop from schools.json: ${schoolAddress}`);
    }
  }

  // Step 5: Filter out loading zone stops (skipGeocoding: true) - these are not actual bus stops
  // Loading zones are where buses park at night and should not be included in routes
  const routeStops = finalStops.filter(s => !s.skipGeocoding);

  // Step 6: Calculate route geometry (street-following path between stops)
  let routeGeometry = null;
  const stopsWithCoords = routeStops.filter(s => s.coordinates);

  if (stopsWithCoords.length >= 2) {
    try {
      console.log(`${logPrefix} 🗺️  Calculating route geometry for ${route.name} (${stopsWithCoords.length} stops)`);

      // Convert coordinates from [lng, lat] to [lat, lng] for directions service
      const waypoints = stopsWithCoords.map(stop => {
        const [lng, lat] = stop.coordinates;
        return [lat, lng]; // Directions service expects [lat, lng]
      });

      const routeResult = await directionsService.getRoute(waypoints);

      if (routeResult.success && routeResult.coordinates && routeResult.coordinates.length > 0) {
        routeGeometry = routeResult.coordinates; // Already in [lat, lng] format
        console.log(`${logPrefix} ✅ Route geometry calculated: ${routeGeometry.length} points via ${routeResult.provider || 'unknown'}`);
      } else {
        console.warn(`${logPrefix} ⚠️  Failed to calculate route geometry: ${routeResult.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`${logPrefix} ❌ Error calculating route geometry:`, error.message);
      // Continue without geometry - route will still be saved
    }
  } else {
    console.log(`${logPrefix} ⚠️  Insufficient stops with coordinates (${stopsWithCoords.length}) to calculate route geometry`);
  }

  // Step 7: Aggregate unique neighborhoods from all stops
  const neighborhoodsSet = new Set();
  for (const stop of routeStops) {
    if (stop.neighborhood && typeof stop.neighborhood === 'string' && stop.neighborhood.trim()) {
      neighborhoodsSet.add(stop.neighborhood.trim());
    }
  }
  const neighborhoods = Array.from(neighborhoodsSet).sort();

  if (neighborhoods.length > 0) {
    console.log(`${logPrefix} 📍 Route passes through ${neighborhoods.length} neighborhood(s): ${neighborhoods.join(', ')}`);
  }

  // Step 8: Create final route object
  const stopsForStats = routeStops;
  const finalRoute = {
    id: route.id,
    name: route.name, // Just the number, e.g., "100"
    direction: route.direction, // "Morning" or "Afternoon"
    filename: route.filename,
    fileId: fileId || filename,
    modifiedTime: null, // Can be set by caller
    stops: routeStops, // Only include actual bus stops (excludes loading zones)
    neighborhoods: neighborhoods,
    processedAt: new Date().toISOString(),
    stats: {
      totalStops: stopsForStats.length,
      geocodedStops: stopsForStats.filter(s => s.coordinates).length,
      failedStops: stopsForStats.filter(s => !s.coordinates).length,
    },
    geometry: routeGeometry, // Street-following route geometry [lat, lng][]
  };

  // Step 9: Save to file if requested
  if (saveToFile) {
    const schoolId = getSchoolIdFromFilename(filename);
    if (!schoolId) {
      throw new Error(`Could not determine school from filename: ${filename}`);
    }

    const processedRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
    if (!fs.existsSync(processedRoutesDir)) {
      fs.mkdirSync(processedRoutesDir, { recursive: true });
    }

    const outputFilename = outputPath || path.join(processedRoutesDir, filename.replace('.pdf', '.json'));
    fs.writeFileSync(outputFilename, JSON.stringify(finalRoute, null, 2));
    console.log(`${logPrefix} 💾 Saved to: ${outputFilename}`);
  }

  return finalRoute;
}



