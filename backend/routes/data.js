import express from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { invalidateRouteStatsCache } from './schools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// Get processed routes directory for a school
function getProcessedRoutesDir(schoolId) {
  if (schoolId) {
    return path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
  }
  // Fallback to old location for backward compatibility
  return path.join(DATA_DIR, 'processed-routes');
}

// Get all processed routes (optionally filtered by school)
router.get('/routes', async (req, res) => {
  const startTime = Date.now();
  try {
    const { schoolId } = req.query;
    console.log('[GET /api/data/routes] schoolId:', schoolId);
    const PROCESSED_ROUTES_DIR = getProcessedRoutesDir(schoolId);
    console.log('[GET /api/data/routes] Routes directory:', PROCESSED_ROUTES_DIR);
    
    // Check if directory exists
    try {
      await fs.access(PROCESSED_ROUTES_DIR);
    } catch {
      console.log('[GET /api/data/routes] Directory does not exist, returning empty routes');
      return res.json({ routes: [] });
    }
    
    const files = (await fs.readdir(PROCESSED_ROUTES_DIR)).filter(f => f.endsWith('.json'));
    console.log('[GET /api/data/routes] Found', files.length, 'route files');
    
    // Read all files in parallel for better performance
    const routePromises = files.map(async (filename) => {
      const filePath = path.join(PROCESSED_ROUTES_DIR, filename);
      const content = await fs.readFile(filePath, 'utf8');
      const route = JSON.parse(content);
      
      // Migrate old format routes to new format (name with (AM)/(PM) -> separate direction)
      const amMatch = route.name && route.name.match(/^(\d+)\s*\(AM\)$/);
      const pmMatch = route.name && route.name.match(/^(\d+)\s*\(PM\)$/);
      
      if (amMatch && !route.direction) {
        route.name = amMatch[1]; // Just the number
        route.direction = 'Morning';
      } else if (pmMatch && !route.direction) {
        route.name = pmMatch[1]; // Just the number
        route.direction = 'Afternoon';
      }
      
      // If direction is still not set, try to extract from filename
      // Pattern: {ROUTE}{CODE}-{DIRECTION}_effective_{DATE}.json
      // Example: "238ABE-A_effective_082625.json" -> Morning
      // Example: "238ABE-P_effective_082625.json" -> Afternoon
      if (!route.direction) {
        const filenameMatch = filename.match(/-([AP])_/);
        if (filenameMatch) {
          route.direction = filenameMatch[1] === 'A' ? 'Morning' : 'Afternoon';
        }
      }
      
      return route;
    });

    const routes = await Promise.all(routePromises);
    const duration = Date.now() - startTime;
    console.log(`[GET /api/data/routes] Returning ${routes.length} routes (${duration}ms)`);
    res.json({ routes });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[GET /api/data/routes] Error loading routes (${duration}ms):`, error);
    res.status(500).json({ error: error.message });
  }
});

// Update stop coordinates
router.put('/routes/:routeId/stops/:stopId', async (req, res) => {
  const startTime = Date.now();
  try {
    const { routeId, stopId } = req.params;
    const { coordinates, schoolId } = req.body;

    // Validate coordinates format: must be [lng, lat] array with valid numbers
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ error: 'Invalid coordinates: must be array of length 2' });
    }
    
    const [lng, lat] = coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number' || 
        isNaN(lng) || isNaN(lat) ||
        lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return res.status(400).json({ 
        error: `Invalid coordinates: expected [lng, lat] with valid ranges (lng: -180 to 180, lat: -90 to 90), got [${lng}, ${lat}]` 
      });
    }

    const PROCESSED_ROUTES_DIR = getProcessedRoutesDir(schoolId);
    
    // Check if directory exists
    try {
      await fs.access(PROCESSED_ROUTES_DIR);
    } catch {
      return res.status(404).json({ error: 'School routes directory not found' });
    }

    // Find the route file
    const files = (await fs.readdir(PROCESSED_ROUTES_DIR)).filter(f => f.endsWith('.json'));
    let routeFile = null;
    let routeData = null;

    for (const filename of files) {
      const filePath = path.join(PROCESSED_ROUTES_DIR, filename);
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      
      if (data.id === routeId) {
        routeFile = filePath;
        routeData = data;
        break;
      }
    }

    if (!routeFile || !routeData) {
      return res.status(404).json({ error: 'Route not found' });
    }

    // Update the stop coordinates
    const stop = routeData.stops.find(s => s.id === stopId);
    if (!stop) {
      return res.status(404).json({ error: 'Stop not found' });
    }

    stop.coordinates = coordinates;
    stop.geocodeError = undefined;
    delete stop.geocodeError;

    // Update stats
    routeData.stats.geocodedStops = routeData.stops.filter(s => s.coordinates !== null).length;
    routeData.stats.failedStops = routeData.stops.filter(s => s.coordinates === null).length;
    routeData.processedAt = new Date().toISOString();

    // Save back to file
    await fs.writeFile(routeFile, JSON.stringify(routeData, null, 2));

    // Invalidate cache for this school's route stats
    if (schoolId) {
      invalidateRouteStatsCache(schoolId);
    }

    const duration = Date.now() - startTime;
    console.log(`[PUT /api/data/routes/${routeId}/stops/${stopId}] Updated stop (${duration}ms)`);
    res.json({ success: true, stop });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[PUT /api/data/routes/${routeId}/stops/${stopId}] Error updating stop (${duration}ms):`, error);
    res.status(500).json({ error: error.message });
  }
});

// Update route geometry (street-following path)
router.put('/routes/:routeId/geometry', async (req, res) => {
  const startTime = Date.now();
  try {
    const { routeId } = req.params;
    const { geometry, schoolId } = req.body;

    // Validate geometry format: must be array of [lat, lng] coordinates
    if (!geometry || !Array.isArray(geometry) || geometry.length === 0) {
      return res.status(400).json({ error: 'Invalid geometry: must be non-empty array of coordinates' });
    }
    
    // Validate all coordinates
    for (let i = 0; i < geometry.length; i++) {
      const coord = geometry[i];
      if (!Array.isArray(coord) || coord.length !== 2) {
        return res.status(400).json({ error: `Invalid coordinate at index ${i}: must be array of length 2` });
      }
      const [lat, lng] = coord;
      if (typeof lat !== 'number' || typeof lng !== 'number' || 
          isNaN(lat) || isNaN(lng) ||
          lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        return res.status(400).json({ 
          error: `Invalid coordinate at index ${i}: expected [lat, lng] with valid ranges (lat: -90 to 90, lng: -180 to 180), got [${lat}, ${lng}]` 
        });
      }
    }

    const PROCESSED_ROUTES_DIR = getProcessedRoutesDir(schoolId);
    
    // Check if directory exists
    try {
      await fs.access(PROCESSED_ROUTES_DIR);
    } catch {
      return res.status(404).json({ error: 'School routes directory not found' });
    }

    // Find the route file
    const files = (await fs.readdir(PROCESSED_ROUTES_DIR)).filter(f => f.endsWith('.json'));
    let routeFile = null;
    let routeData = null;

    for (const filename of files) {
      const filePath = path.join(PROCESSED_ROUTES_DIR, filename);
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      
      if (data.id === routeId) {
        routeFile = filePath;
        routeData = data;
        break;
      }
    }

    if (!routeFile || !routeData) {
      return res.status(404).json({ error: 'Route not found' });
    }

    // Update the route geometry
    routeData.geometry = geometry;
    routeData.geometryUpdatedAt = new Date().toISOString();

    // Save back to file
    await fs.writeFile(routeFile, JSON.stringify(routeData, null, 2));

    // Invalidate cache for this school's route stats
    if (schoolId) {
      invalidateRouteStatsCache(schoolId);
    }

    const duration = Date.now() - startTime;
    console.log(`[PUT /api/data/routes/${routeId}/geometry] Saved geometry with ${geometry.length} points (${duration}ms)`);
    res.json({ success: true, geometry: routeData.geometry });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[PUT /api/data/routes/${routeId}/geometry] Error updating route geometry (${duration}ms):`, error);
    res.status(500).json({ error: error.message });
  }
});

export { router as dataRouter };

