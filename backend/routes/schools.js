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

// Helper function to get route count and update time for a school (optimized)
// Counts unique routes (morning and afternoon versions of the same route count as 1)
// Returns both count and latest update time in one pass
async function getRouteStats(schoolId) {
  // Check cache first
  const cached = getCachedStats(schoolId);
  if (cached) {
    return cached;
  }

  try {
    const schoolRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
    
    try {
      await fs.access(schoolRoutesDir);
    } catch {
      const stats = { routeCount: 0, routesUpdatedAt: null };
      setCachedStats(schoolId, stats);
      return stats;
    }

    const files = (await fs.readdir(schoolRoutesDir)).filter(f => f.endsWith('.json'));
    
    // Track unique route names (morning and afternoon versions count as 1 route)
    const uniqueRouteNames = new Set();
    let latestTime = null;
    
    // Read all files in parallel for better performance
    const routePromises = files.map(async (filename) => {
      try {
        const filePath = path.join(schoolRoutesDir, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const route = JSON.parse(content);
        
        // Extract route name, handling both new and old formats
        let routeName = route.name;
        let direction = route.direction;
        
        // Migrate old format routes (name with (AM)/(PM) -> separate direction)
        const amMatch = routeName && routeName.match(/^(\d+)\s*\(AM\)$/);
        const pmMatch = routeName && routeName.match(/^(\d+)\s*\(PM\)$/);
        
        if (amMatch && !direction) {
          routeName = amMatch[1]; // Just the number
          direction = 'Morning';
        } else if (pmMatch && !direction) {
          routeName = pmMatch[1]; // Just the number
          direction = 'Afternoon';
        }
        
        // Use route name as the unique identifier (ignoring direction)
        if (routeName) {
          uniqueRouteNames.add(routeName);
        }
        
        // Check modifiedTime first (from Drive), then fall back to processedAt
        const timeToCheck = route.modifiedTime || route.processedAt;
        if (timeToCheck) {
          const time = new Date(timeToCheck);
          if (!latestTime || time > latestTime) {
            latestTime = time;
          }
        }
        
        return { routeName, time: timeToCheck ? new Date(timeToCheck) : null };
      } catch (error) {
        console.error(`Error reading route file ${filename} for school ${schoolId}:`, error);
        return null;
      }
    });

    await Promise.all(routePromises);
    
    const stats = {
      routeCount: uniqueRouteNames.size,
      routesUpdatedAt: latestTime ? latestTime.toISOString() : null,
    };
    
    // Cache the result
    setCachedStats(schoolId, stats);
    return stats;
  } catch (error) {
    console.error(`Error getting route stats for school ${schoolId}:`, error);
    const stats = { routeCount: 0, routesUpdatedAt: null };
    setCachedStats(schoolId, stats);
    return stats;
  }
}

/**
 * Get all schools
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  try {
    // Check if file exists
    try {
      await fs.access(SCHOOLS_FILE);
    } catch {
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
      // Add route counts to default schools
      const stats = await getRouteStats(defaultSchools[0].id);
      const schoolsWithCounts = defaultSchools.map(school => ({
        ...school,
        routeCount: stats.routeCount,
        routesUpdatedAt: stats.routesUpdatedAt,
      }));
      const duration = Date.now() - startTime;
      console.log(`[GET /api/schools] Returning ${schoolsWithCounts.length} schools (${duration}ms)`);
      return res.json({ schools: schoolsWithCounts });
    }

    const content = await fs.readFile(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    
    // Ensure schools is an array
    if (!Array.isArray(schools)) {
      console.error('Schools file does not contain an array:', typeof schools);
      return res.status(500).json({ error: 'Invalid schools data format' });
    }
    
    // Get route stats for all schools in parallel
    const statsPromises = schools.map(school => getRouteStats(school.id));
    const statsArray = await Promise.all(statsPromises);
    
    // Add route counts and latest update times to each school
    // Exclude placesData and placeId from frontend response (keep in backend data only)
    const schoolsWithCounts = schools.map((school, index) => {
      const { placesData, placeId, ...schoolData } = school;
      const stats = statsArray[index];
      return {
        ...schoolData,
        routeCount: stats.routeCount,
        routesUpdatedAt: stats.routesUpdatedAt,
      };
    });
    
    const duration = Date.now() - startTime;
    console.log(`[GET /api/schools] Returning ${schoolsWithCounts.length} schools (${duration}ms)`);
    res.json({ schools: schoolsWithCounts });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[GET /api/schools] Error loading schools (${duration}ms):`, error);
    console.error('Error stack:', error.stack);
    console.error('Schools file path:', SCHOOLS_FILE);
    res.status(500).json({ error: error.message, details: error.stack });
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

    // Add route count and latest update time to the school
    const schoolWithCount = {
      ...school,
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
    const updatedSchool = {
      ...school,
      address: place.address,
      coordinates: place.coordinates,
      schoolTypes: schoolTypes,
      updatedAt: new Date().toISOString(),
    };

    schools[schoolIndex] = updatedSchool;
    await fs.writeFile(SCHOOLS_FILE, JSON.stringify(schools, null, 2));

    console.log(`[Places API] Updated ${school.name}: ${place.address}`);

    res.json({ 
      school: updatedSchool,
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

