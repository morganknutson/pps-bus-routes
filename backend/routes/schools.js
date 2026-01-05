import express from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchSchool, getSchoolTypes } from '../services/placesService.js';
import { schoolBoundaryService } from '../services/schoolBoundaryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const SCHOOLS_FILE = path.join(__dirname, '..', '..', 'data', 'schools.json');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// Simple in-memory cache for route counts and update times
// Cache expires after 5 minutes
const routeStatsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedStats(schoolId) {
  const cached = routeStatsCache.get(schoolId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedStats(schoolId, data) {
  routeStatsCache.set(schoolId, {
    data,
    timestamp: Date.now(),
  });
}

function invalidateRouteStatsCache(schoolId) {
  routeStatsCache.delete(schoolId);
}

// Export function to allow other modules to invalidate cache
export { invalidateRouteStatsCache };

/**
 * Extract neighborhood from placesData addressComponents
 * @param {object} placesData - Google Places API response data
 * @returns {string|null} - Neighborhood name or null if not found
 */
function extractNeighborhood(placesData) {
  if (!placesData || !placesData.addressComponents || !Array.isArray(placesData.addressComponents)) {
    return null;
  }

  // Find the address component with type "neighborhood"
  const neighborhoodComponent = placesData.addressComponents.find(component =>
    component.types && Array.isArray(component.types) && component.types.includes('neighborhood')
  );

  return neighborhoodComponent ? neighborhoodComponent.longText : null;
}

// Helper function to check if a school has PDFs downloaded
async function hasPdfs(schoolId) {
  try {
    const schoolPdfsDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');

    // Check if directory exists
    try {
      await fs.access(schoolPdfsDir);
    } catch (e) {
      // console.log(`[hasPdfs] Directory not found for ${schoolId}: ${schoolPdfsDir}`);
      return false; // Directory doesn't exist
    }

    // Check if directory has any PDF files
    const files = await fs.readdir(schoolPdfsDir);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      // console.log(`[hasPdfs] No PDFs found in ${schoolPdfsDir}`);
    }

    return pdfFiles.length > 0;
  } catch (error) {
    console.error(`Error checking PDFs for school ${schoolId}:`, error);
    return false;
  }
}

// Helper function to get route count and update time for a school (optimized)
// Counts unique routes (morning and afternoon versions of the same route count as 1)
// Returns both count and latest update time in one pass
async function getRouteStats(schoolId) {
  const startTime = Date.now();
  // Check cache first
  const cached = getCachedStats(schoolId);
  if (cached) {
    return cached;
  }

  const stats = { routeCount: 0, routesUpdatedAt: null };

  try {
    const schoolRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');

    try {
      await fs.access(schoolRoutesDir);
    } catch {
      setCachedStats(schoolId, stats);
      return stats;
    }

    const files = (await fs.readdir(schoolRoutesDir)).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
      setCachedStats(schoolId, stats);
      return stats;
    }

    // Track unique route names
    const uniqueRouteNames = new Set();
    let latestTime = 0;

    // Check directory stat for latest update time as a shortcut
    try {
      const dirStats = await fs.stat(schoolRoutesDir);
      latestTime = dirStats.mtimeMs;
    } catch (e) {
      // Ignore
    }

    // Instead of reading every file content (which is slow), 
    // let's just use the filenames and file stats for the count and time
    // if the filename contains the route name.
    for (const filename of files) {
      // Filename format is usually "Route 100 (Morning).json" or similar
      const routeNameMatch = filename.match(/^Route\s+([A-Z0-9]+)/i) || [null, filename.split('.')[0]];
      const routeName = routeNameMatch[1];
      if (routeName) uniqueRouteNames.add(routeName);
    }

    stats.routeCount = uniqueRouteNames.size;
    stats.routesUpdatedAt = latestTime > 0 ? new Date(latestTime).toISOString() : null;

    // Cache the result
    setCachedStats(schoolId, stats);
    // console.log(`[getRouteStats] ${schoolId}: ${stats.routeCount} routes (${Date.now() - startTime}ms)`);
    return stats;
  } catch (error) {
    console.error(`Error getting route stats for school ${schoolId}:`, error);
    setCachedStats(schoolId, stats);
    return stats;
  }
}

/**
 * Get assigned schools by location
 * GET /api/schools/assigned?lat=45.5&lng=-122.6
 */
router.get('/assigned', async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat or lng query parameters' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Invalid lat/lng coordinates' });
    }

    const assigned = schoolBoundaryService.getAssignedSchools(latitude, longitude);
    res.json({ assigned });
  } catch (error) {
    console.error('Error getting assigned schools:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all schools
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  try {
    console.log(`[GET /api/schools] Request started`);

    // Check if file exists
    try {
      await fs.access(SCHOOLS_FILE);
    } catch {
      console.log(`[GET /api/schools] Schools file missing, creating default`);
      // Create default schools file if it doesn't exist
      const defaultSchools = [
        {
          id: 'west-sylvan',
          name: 'West Sylvan',
          schoolPageLink: null,
          driveLink: null,
          createdAt: new Date().toISOString(),
        },
      ];
      await fs.writeFile(SCHOOLS_FILE, JSON.stringify(defaultSchools, null, 2));
    }

    const content = await fs.readFile(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);

    if (!Array.isArray(schools)) {
      throw new Error('Invalid schools data format: not an array');
    }

    console.log(`[GET /api/schools] Processing ${schools.length} schools`);

    // Process schools in chunks to avoid overwhelming the file system
    const schoolsWithCounts = [];
    const CHUNK_SIZE = 20;

    for (let i = 0; i < schools.length; i += CHUNK_SIZE) {
      const chunk = schools.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(chunk.map(async (school) => {
        try {
          const stats = await getRouteStats(school.id);
          const { placesData, placeId, ...schoolData } = school;
          const neighborhood = extractNeighborhood(placesData);

          return {
            ...schoolData,
            ...(neighborhood && { neighborhood }),
            routeCount: stats.routeCount,
            routesUpdatedAt: stats.routesUpdatedAt,
          };
        } catch (err) {
          console.error(`[GET /api/schools] Error processing school ${school.id}:`, err.message);
          return null;
        }
      }));

      schoolsWithCounts.push(...chunkResults.filter(s => s !== null));
    }

    const duration = Date.now() - startTime;
    console.log(`[GET /api/schools] Success: Returning ${schoolsWithCounts.length} schools (${duration}ms)`);
    res.json({ schools: schoolsWithCounts });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[GET /api/schools] FATAL ERROR after ${duration}ms:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific school
 */
router.get('/:schoolId', async (req, res) => {
  const startTime = Date.now();
  try {
    const { schoolId } = req.params;
    const content = await fs.readFile(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    const school = schools.find((s) => s.id === schoolId);

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    // Get route stats
    const stats = await getRouteStats(schoolId);

    // Extract neighborhood from placesData and exclude placesData/placeId from response
    const { placesData, placeId, ...schoolData } = school;
    const neighborhood = extractNeighborhood(placesData);

    // Add route count, latest update time, and neighborhood to the school
    const schoolWithCount = {
      ...schoolData,
      ...(neighborhood && { neighborhood }),
      routeCount: stats.routeCount,
      routesUpdatedAt: stats.routesUpdatedAt,
    };

    const duration = Date.now() - startTime;
    console.log(`[GET /api/schools/${schoolId}] Returning school (${duration}ms)`);
    res.json({ school: schoolWithCount });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[GET /api/schools/${schoolId}] Error loading school (${duration}ms):`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new school
 */
router.post('/', async (req, res) => {
  try {
    const { name, schoolPageLink, driveLink } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'School name is required' });
    }

    const content = await fs.readFile(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);

    // Generate ID from name
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if school already exists
    if (schools.find((s) => s.id === id)) {
      return res.status(400).json({ error: 'School with this name already exists' });
    }

    const newSchool = {
      id,
      name,
      schoolPageLink: schoolPageLink || null,
      driveLink: driveLink || null,
      createdAt: new Date().toISOString(),
    };

    schools.push(newSchool);
    await fs.writeFile(SCHOOLS_FILE, JSON.stringify(schools, null, 2));

    // Create school directory for processed routes
    const schoolDir = path.join(DATA_DIR, 'schools', id, 'processed-routes');
    try {
      await fs.access(schoolDir);
    } catch {
      await fs.mkdir(schoolDir, { recursive: true });
    }

    // Invalidate cache for this school
    routeStatsCache.delete(id);

    res.json({ school: newSchool });
  } catch (error) {
    console.error('Error creating school:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update a school (including school page link and drive link)
 */
router.put('/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { name, schoolPageLink, driveLink, address, coordinates } = req.body;

    const content = await fs.readFile(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    const schoolIndex = schools.findIndex((s) => s.id === schoolId);

    if (schoolIndex === -1) {
      return res.status(404).json({ error: 'School not found' });
    }

    const updatedSchool = {
      ...schools[schoolIndex],
      ...(name && { name }),
      ...(schoolPageLink !== undefined && { schoolPageLink }),
      ...(driveLink !== undefined && { driveLink }),
      ...(address !== undefined && { address }),
      ...(coordinates !== undefined && { coordinates }),
      updatedAt: new Date().toISOString(),
    };

    schools[schoolIndex] = updatedSchool;
    await fs.writeFile(SCHOOLS_FILE, JSON.stringify(schools, null, 2));

    res.json({ school: updatedSchool });
  } catch (error) {
    console.error('Error updating school:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update a school's address using Google Places API
 */
router.post('/:schoolId/update-address', async (req, res) => {
  try {
    const { schoolId } = req.params;
    const content = await fs.readFile(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    const schoolIndex = schools.findIndex((s) => s.id === schoolId);

    if (schoolIndex === -1) {
      return res.status(404).json({ error: 'School not found' });
    }

    const school = schools[schoolIndex];

    // Search for the school using Places API
    console.log(`[Places API] Searching for: ${school.name}`);
    const searchResult = await searchSchool(school.name);

    if (!searchResult.success) {
      return res.status(400).json({
        error: 'Failed to find school address',
        details: searchResult.error
      });
    }

    const place = searchResult.place;

    // Get school types for this school
    const schoolTypes = getSchoolTypes(school.name);

    // Update school with new address, coordinates, and school types
    // Note: placesData is not updated here, so we extract neighborhood from existing placesData if available
    const { placesData, placeId, ...schoolDataWithoutPlaces } = school;
    const neighborhood = extractNeighborhood(placesData);

    const updatedSchool = {
      ...schoolDataWithoutPlaces,
      address: place.address,
      coordinates: place.coordinates,
      schoolTypes: schoolTypes,
      ...(neighborhood && { neighborhood }),
      updatedAt: new Date().toISOString(),
    };

    schools[schoolIndex] = {
      ...updatedSchool,
      placesData: placesData, // Keep placesData in stored data
      placeId: placeId,
    };
    await fs.writeFile(SCHOOLS_FILE, JSON.stringify(schools, null, 2));

    console.log(`[Places API] Updated ${school.name}: ${place.address}`);

    res.json({
      school: updatedSchool, // Exclude placesData/placeId from response
      place: {
        name: place.name,
        address: place.address,
        coordinates: place.coordinates
      }
    });
  } catch (error) {
    console.error('Error updating school address:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Batch update addresses for all schools
 */
router.post('/batch-update-addresses', async (req, res) => {
  try {
    const content = await fs.readFile(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);

    const results = [];
    const updatedSchools = [...schools];

    console.log(`[Places API] Starting batch update for ${schools.length} schools`);

    // Process each school with rate limiting (1 request per second)
    for (let i = 0; i < schools.length; i++) {
      const school = schools[i];

      try {
        console.log(`[${i + 1}/${schools.length}] Processing: ${school.name}`);

        const searchResult = await searchSchool(school.name);

        if (searchResult.success && searchResult.place) {
          const place = searchResult.place;
          const schoolIndex = updatedSchools.findIndex((s) => s.id === school.id);

          if (schoolIndex !== -1) {
            // Get school types for this school
            const schoolTypes = getSchoolTypes(school.name);

            updatedSchools[schoolIndex] = {
              ...updatedSchools[schoolIndex],
              address: place.address,
              coordinates: place.coordinates,
              schoolTypes: schoolTypes,
              updatedAt: new Date().toISOString(),
            };
          }

          results.push({
            schoolId: school.id,
            schoolName: school.name,
            success: true,
            address: place.address,
            coordinates: place.coordinates
          });

          console.log(`  ✅ Updated: ${place.address}`);
        } else {
          results.push({
            schoolId: school.id,
            schoolName: school.name,
            success: false,
            error: searchResult.error || 'Failed to find school'
          });

          console.log(`  ❌ Failed: ${searchResult.error || 'Unknown error'}`);
        }
      } catch (error) {
        results.push({
          schoolId: school.id,
          schoolName: school.name,
          success: false,
          error: error.message
        });

        console.log(`  ❌ Error: ${error.message}`);
      }

      // Rate limiting: wait 1 second between requests (except for the last one)
      if (i < schools.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Save updated schools
    await fs.writeFile(SCHOOLS_FILE, JSON.stringify(updatedSchools, null, 2));

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[Places API] Batch update complete: ${successCount} succeeded, ${failureCount} failed`);

    res.json({
      total: schools.length,
      succeeded: successCount,
      failed: failureCount,
      results
    });
  } catch (error) {
    console.error('Error in batch update:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a school
 */
router.delete('/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;

    const content = await fs.readFile(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    const filteredSchools = schools.filter((s) => s.id !== schoolId);

    if (schools.length === filteredSchools.length) {
      return res.status(404).json({ error: 'School not found' });
    }

    await fs.writeFile(SCHOOLS_FILE, JSON.stringify(filteredSchools, null, 2));

    // Invalidate cache for this school
    routeStatsCache.delete(schoolId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting school:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as schoolsRouter };

