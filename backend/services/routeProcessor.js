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
 * @param {string} options.schoolId - Optional school ID (if filename doesn't match pattern)
 * @returns {Promise<object>} Processed route object
 */
export async function processSinglePDF(pdfBuffer, filename, fileId = null, options = {}) {
  const {
    logPrefix = '[RouteProcessor]',
    saveToFile = false,
    outputPath = null,
    schoolId = null,
  } = options;

  // Step 1: Determine schoolId from folder structure FIRST (source of truth)
  // This is the PRIMARY way to know which school - from where the PDF is located
  const schoolIdFromOptions = options.schoolId || getSchoolIdFromFilename(filename);
  
  if (!schoolIdFromOptions) {
    throw new Error(`Could not determine school from folder structure. Filename: ${filename}, schoolId option: ${options.schoolId || 'NOT PROVIDED'}. Please provide schoolId option.`);
  }
  
  console.log(`${logPrefix} 📁 School determined from folder structure: ${schoolIdFromOptions}`);

  // Step 2: Parse PDF
  const pdfData = await pdfParse(pdfBuffer);
  const route = parseRouteFromPDF(pdfData.text, fileId || filename, filename);

  // Allow processing even if no stops found - we'll save what we can
  if (!route) {
    throw new Error('Failed to parse PDF - no route data extracted');
  }
  
  if (route.stops.length === 0) {
    console.warn(`${logPrefix} ⚠️  No stops found in PDF, but will continue processing and save route`);
  }

  // Step 3: Load schools.json and match to school (for adding school stop)
  // PRIMARY: Use schoolId from folder structure (already determined above)
  // SECONDARY: Try anchor name matching (optional, for validation)
  let matchedSchool = null;
  
  if (fs.existsSync(SCHOOLS_FILE)) {
    try {
      const schoolsContent = fs.readFileSync(SCHOOLS_FILE, 'utf8');
      const schools = JSON.parse(schoolsContent);
      
      // PRIMARY: Use schoolId directly (from folder structure)
      matchedSchool = schools.find(s => s.id === schoolIdFromOptions);
      
      if (matchedSchool) {
        console.log(`${logPrefix} ✅ Found school: ${matchedSchool.name} (ID: ${matchedSchool.id})`);
        if (matchedSchool.address && matchedSchool.coordinates) {
          console.log(`${logPrefix} ✅ School has address and coordinates - will add school stop`);
        } else {
          console.log(`${logPrefix} ⚠️  School missing address/coordinates - school stop will not be added`);
        }
      } else {
        console.log(`${logPrefix} ⚠️  School not found in schools.json with ID: ${schoolIdFromOptions}`);
        console.log(`${logPrefix}    Route will be saved but school stop will not be added`);
      }
      
      // OPTIONAL: Try anchor name matching as validation (but don't fail if it doesn't match)
      if (route.anchorName && matchedSchool) {
        const anchorMatch = matchSchoolFromAnchorName(route.anchorName, schools);
        if (anchorMatch && anchorMatch.id !== schoolIdFromOptions) {
          console.log(`${logPrefix} ⚠️  Anchor name "${route.anchorName}" suggests different school: ${anchorMatch.name}, but using ${schoolIdFromOptions} from folder structure`);
        }
      }
    } catch (error) {
      console.error(`${logPrefix} Error loading schools.json:`, error);
      console.log(`${logPrefix}    Route will be saved anyway`);
    }
  } else {
    console.log(`${logPrefix} ⚠️  SCHOOLS_FILE does not exist: ${SCHOOLS_FILE}`);
    console.log(`${logPrefix}    Route will be saved but school stop will not be added`);
  }

  // Step 4: Geocode stops (only if we have stops)
  let geocodedStops = [];
  if (route.stops.length > 0) {
    geocodedStops = await geocodingService.geocodeStops(route.stops, 'Portland', 'OR');
  } else {
    console.log(`${logPrefix} ⚠️  Skipping geocoding - no stops to geocode`);
  }

  // Step 5: Add school stop from schools.json if matched
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

  // Step 6: Filter out loading zone stops (skipGeocoding: true) - these are not actual bus stops
  // Loading zones are where buses park at night and should not be included in routes
  const routeStops = finalStops.filter(s => !s.skipGeocoding);

  // Step 7: Calculate route geometry (street-following path between stops)
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

  // Step 8: Aggregate unique neighborhoods from all stops
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

  // Step 9: Create final route object
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
  // ALWAYS save - don't fail if PDF parsing was imperfect
  if (saveToFile) {
    // Use schoolId from options (folder structure) - this is the source of truth
    const finalSchoolId = schoolIdFromOptions;
    
    if (!finalSchoolId) {
      throw new Error(`Could not determine school from folder structure. Filename: ${filename}, schoolId option: ${options.schoolId || 'NOT PROVIDED'}`);
    }

    // ALWAYS create the directory - don't fail if it doesn't exist
    const processedRoutesDir = path.join(DATA_DIR, 'schools', finalSchoolId, 'processed-routes');
    try {
      if (!fs.existsSync(processedRoutesDir)) {
        fs.mkdirSync(processedRoutesDir, { recursive: true });
        console.log(`${logPrefix} 📁 Created processed-routes directory: ${processedRoutesDir}`);
      }
    } catch (error) {
      console.error(`${logPrefix} ❌ Failed to create directory: ${error.message}`);
      throw new Error(`Failed to create processed-routes directory: ${error.message}`);
    }

    // ALWAYS save the route - even if some data is missing
    const outputFilename = outputPath || path.join(processedRoutesDir, filename.replace('.pdf', '.json'));
    try {
      fs.writeFileSync(outputFilename, JSON.stringify(finalRoute, null, 2));
      console.log(`${logPrefix} 💾 Saved route to: ${outputFilename}`);
      console.log(`${logPrefix}    Route: ${finalRoute.name}, Stops: ${finalRoute.stops.length}, Geocoded: ${finalRoute.stats.geocodedStops}/${finalRoute.stats.totalStops}`);
    } catch (error) {
      console.error(`${logPrefix} ❌ Failed to save route: ${error.message}`);
      throw new Error(`Failed to save route to ${outputFilename}: ${error.message}`);
    }
  }

  return finalRoute;
}




