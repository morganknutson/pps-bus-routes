import express from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchSchool, getSchoolTypes } from '../services/placesService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const SCHOOLS_FILE = path.join(__dirname, '..', '..', 'data', 'schools.json');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// Simple in-memory cache for route counts and update times
// Cache expires after 10 minutes
const routeStatsCache = new Map();
const pdfExistenceCache = new Map(); // Cache for hasPdfs check
const SCHOOLS_WITH_PDFS_CACHE = {
  data: null,
  timestamp: 0
};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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

function getCachedPdfExistence(schoolId) {
  const cached = pdfExistenceCache.get(schoolId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.exists;
  }
  return null;
}

function setCachedPdfExistence(schoolId, exists) {
  pdfExistenceCache.set(schoolId, {
    exists,
    timestamp: Date.now(),
  });
}

function invalidateRouteStatsCache(schoolId) {
  routeStatsCache.delete(schoolId);
  pdfExistenceCache.delete(schoolId);
  SCHOOLS_WITH_PDFS_CACHE.data = null;
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
  // Check cache first
  const cached = getCachedPdfExistence(schoolId);
  if (cached !== null) {
    return cached;
  }

  try {
    const schoolPdfsDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
    
    // Check if directory exists - use sync for speed in batch if needed, but async is usually fine
    // However, readdir is enough to check existence
    const files = await fs.readdir(schoolPdfsDir).catch(() => []);
    const exists = files.some(f => f.toLowerCase().endsWith('.pdf'));
    
    setCachedPdfExistence(schoolId, exists);
    return exists;
  } catch (error) {
    return false;
  }
}

// Helper function to get route count and update time for a school (optimized)
async function getRouteStats(schoolId) {
  // Check cache first
  const cached = getCachedStats(schoolId);
  if (cached) {
    return cached;
  }

  const stats = { routeCount: 0, routesUpdatedAt: null };

  try {
    const schoolRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
    const files = await fs.readdir(schoolRoutesDir).catch(() => []);
    
    if (files.length === 0) {
      setCachedStats(schoolId, stats);
      return stats;
    }
    
    // Track unique route names
    const uniqueRouteNames = new Set();
    
    for (const filename of files) {
      if (!filename.endsWith('.json')) continue;
      
      // Try standard "Route 100" format
      let routeNameMatch = filename.match(/^Route\s+([A-Z0-9]+)/i);
      if (routeNameMatch) {
        uniqueRouteNames.add(routeNameMatch[1]);
        continue;
      }
      
      // Try compact "{RouteNumber}{SchoolCode}-" format (e.g. 105ACC-A)
      routeNameMatch = filename.match(/^(\d+)[A-Z]{2,}-/);
      if (routeNameMatch) {
        uniqueRouteNames.add(routeNameMatch[1]);
        continue;
      }
      
      // Fallback: use filename without extension
      const fallbackName = filename.split('.')[0];
      if (fallbackName) uniqueRouteNames.add(fallbackName);
    }

    const routeCount = uniqueRouteNames.size;
    stats.routeCount = routeCount;
    
    console.log(`[getRouteStats] School ${schoolId}: found ${files.length} files, ${routeCount} unique routes`);
    
    // Only cache if we found routes, OR if it's been 0 for a while
    // This helps with "cold starts" for new schools
    setCachedStats(schoolId, stats);
    return stats;
  } catch (error) {
    setCachedStats(schoolId, stats);
    return stats;
  }
}

/**
 * Get all schools
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  const includeStats = req.query.includeStats === 'true';
  const showAll = req.query.all === 'true';
  
  try {
    // Check global schools cache
    let schools;
    const now = Date.now();
    
    // Use separate cache for "all schools" vs "schools with PDFs"
    if (!showAll && SCHOOLS_WITH_PDFS_CACHE.data && (now - SCHOOLS_WITH_PDFS_CACHE.timestamp < CACHE_TTL)) {
      schools = SCHOOLS_WITH_PDFS_CACHE.data;
    } else {
      console.log(`[GET /api/schools] Loading from ${SCHOOLS_FILE}, showAll=${showAll}`);
      const content = await fs.readFile(SCHOOLS_FILE, 'utf8');
      const allSchools = JSON.parse(content);
      
      if (showAll) {
        schools = allSchools;
      } else {
        // Filter schools that have PDFs - use a simple loop instead of Promise.all to avoid disk slamming
        console.log(`[GET /api/schools] Checking PDFs for ${allSchools.length} schools...`);
        schools = [];
        for (const school of allSchools) {
          if (await hasPdfs(school.id)) {
            schools.push(school);
          }
        }
        console.log(`[GET /api/schools] Found ${schools.length} schools with PDFs`);
        
        SCHOOLS_WITH_PDFS_CACHE.data = schools;
        SCHOOLS_WITH_PDFS_CACHE.timestamp = now;
      }
    }
    
    let schoolsResponse;
    
    if (includeStats) {
      console.log(`[GET /api/schools] Getting stats for ${schools.length} schools...`);
      // Get route stats - use a simple loop
      const statsArray = [];
      for (const school of schools) {
        statsArray.push(await getRouteStats(school.id));
      }
      
      schoolsResponse = schools.map((school, index) => {
        const { placesData, placeId, ...schoolData } = school;
        const neighborhood = extractNeighborhood(placesData);
        return {
          ...schoolData,
          ...(neighborhood && { neighborhood }),
          routeCount: statsArray[index].routeCount,
        };
      });
    } else {
      schoolsResponse = schools.map((school) => {
        const { placesData, placeId, ...schoolData } = school;
        const neighborhood = extractNeighborhood(placesData);
        return {
          ...schoolData,
          ...(neighborhood && { neighborhood }),
        };
      });
    }
    
    const duration = Date.now() - startTime;
    console.log(`[GET /api/schools] Success: ${schoolsResponse.length} schools (${duration}ms, stats=${includeStats})`);
    res.json({ schools: schoolsResponse });
  } catch (error) {
    console.error(`[GET /api/schools] Error:`, error);
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
    const { name, schoolPageLink, driveLink, address, coordinates } = req.body;

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
      address: address || null,
      coordinates: coordinates || null,
      schoolTypes: getSchoolTypes(name),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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

