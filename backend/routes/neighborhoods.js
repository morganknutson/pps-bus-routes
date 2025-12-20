import express from 'express';
import { neighborhoodService } from '../services/neighborhoodService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

/**
 * Get neighborhood from coordinates
 */
router.post('/from-coordinates', async (req, res) => {
  try {
    const { coordinates } = req.body;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ error: 'Invalid coordinates format. Expected [lng, lat]' });
    }

    const result = await neighborhoodService.getNeighborhood(coordinates);

    if (result.success) {
      res.json({
        coordinates,
        neighborhood: result.neighborhood,
        fromCache: result.fromCache || false,
        formattedAddress: result.formattedAddress,
      });
    } else {
      res.status(404).json({ error: result.error || 'Neighborhood not found' });
    }
  } catch (error) {
    console.error('[Neighborhoods] Error getting neighborhood:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get neighborhoods for multiple coordinates (batch)
 */
router.post('/batch', async (req, res) => {
  try {
    const { coordinatesList } = req.body;

    if (!Array.isArray(coordinatesList) || coordinatesList.length === 0) {
      return res.status(400).json({ error: 'coordinatesList array is required' });
    }

    console.log(`[Neighborhoods] Batch request: ${coordinatesList.length} coordinates`);

    const results = await neighborhoodService.getNeighborhoods(coordinatesList);

    console.log(`[Neighborhoods] Batch complete: ${results.filter(r => r.success).length}/${results.length} successful`);
    res.json({ results });
  } catch (error) {
    console.error('[Neighborhoods] Batch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get neighborhoods from routes (for a specific school or all routes)
 */
router.get('/from-routes', async (req, res) => {
  try {
    const { schoolId } = req.query;

    const routes = [];

    if (schoolId) {
      // Get routes for specific school
      const processedRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
      if (fs.existsSync(processedRoutesDir)) {
        const files = fs.readdirSync(processedRoutesDir).filter(f => f.endsWith('.json'));
        for (const filename of files) {
          try {
            const filePath = path.join(processedRoutesDir, filename);
            const content = fs.readFileSync(filePath, 'utf8');
            const route = JSON.parse(content);
            routes.push(route);
          } catch (error) {
            console.error(`[Neighborhoods] Error loading route ${filename}:`, error);
          }
        }
      }
    } else {
      // Get routes from ALL schools
      const schoolsDir = path.join(DATA_DIR, 'schools');
      if (fs.existsSync(schoolsDir)) {
        const schoolDirs = fs.readdirSync(schoolsDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        for (const schoolDir of schoolDirs) {
          const processedRoutesDir = path.join(schoolsDir, schoolDir, 'processed-routes');
          if (fs.existsSync(processedRoutesDir)) {
            const files = fs.readdirSync(processedRoutesDir).filter(f => f.endsWith('.json'));
            for (const filename of files) {
              try {
                const filePath = path.join(processedRoutesDir, filename);
                const content = fs.readFileSync(filePath, 'utf8');
                const route = JSON.parse(content);
                routes.push(route);
              } catch (error) {
                console.error(`[Neighborhoods] Error loading route ${filename}:`, error);
              }
            }
          }
        }
      }

      // Also check legacy processed-routes directory
      const legacyProcessedRoutesDir = path.join(DATA_DIR, 'processed-routes');
      if (fs.existsSync(legacyProcessedRoutesDir)) {
        const files = fs.readdirSync(legacyProcessedRoutesDir).filter(f => f.endsWith('.json'));
        for (const filename of files) {
          try {
            const filePath = path.join(legacyProcessedRoutesDir, filename);
            const content = fs.readFileSync(filePath, 'utf8');
            const route = JSON.parse(content);
            routes.push(route);
          } catch (error) {
            console.error(`[Neighborhoods] Error loading route ${filename}:`, error);
          }
        }
      }
    }

    console.log(`[Neighborhoods] Processing ${routes.length} routes for neighborhoods (schoolId: ${schoolId || 'all'})`);

    // Get neighborhoods from routes
    const neighborhoods = await neighborhoodService.getNeighborhoodsFromRoutes(routes);

    res.json({
      neighborhoods,
      totalRoutes: routes.length,
      schoolId: schoolId || null,
    });
  } catch (error) {
    console.error('[Neighborhoods] Error getting neighborhoods from routes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get unique neighborhoods list (just names)
 */
router.get('/list', async (req, res) => {
  try {
    const { schoolId } = req.query;

    const allCoordinates = [];

    if (schoolId) {
      // Get coordinates for specific school
      const processedRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
      if (fs.existsSync(processedRoutesDir)) {
        const files = fs.readdirSync(processedRoutesDir).filter(f => f.endsWith('.json'));
        for (const filename of files) {
          try {
            const filePath = path.join(processedRoutesDir, filename);
            const content = fs.readFileSync(filePath, 'utf8');
            const route = JSON.parse(content);

            if (route.stops && Array.isArray(route.stops)) {
              for (const stop of route.stops) {
                if (stop.coordinates && Array.isArray(stop.coordinates) && stop.coordinates.length === 2) {
                  // Deduplicate coordinates
                  const coordKey = `${stop.coordinates[0]},${stop.coordinates[1]}`;
                  if (!allCoordinates.find(c => `${c[0]},${c[1]}` === coordKey)) {
                    allCoordinates.push(stop.coordinates);
                  }
                }
              }
            }
          } catch (error) {
            console.error(`[Neighborhoods] Error loading route ${filename}:`, error);
          }
        }
      }
    } else {
      // Get coordinates from ALL schools
      const schoolsDir = path.join(DATA_DIR, 'schools');
      if (fs.existsSync(schoolsDir)) {
        const schoolDirs = fs.readdirSync(schoolsDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        for (const schoolDir of schoolDirs) {
          const processedRoutesDir = path.join(schoolsDir, schoolDir, 'processed-routes');
          if (fs.existsSync(processedRoutesDir)) {
            const files = fs.readdirSync(processedRoutesDir).filter(f => f.endsWith('.json'));
            for (const filename of files) {
              try {
                const filePath = path.join(processedRoutesDir, filename);
                const content = fs.readFileSync(filePath, 'utf8');
                const route = JSON.parse(content);

                if (route.stops && Array.isArray(route.stops)) {
                  for (const stop of route.stops) {
                    if (stop.coordinates && Array.isArray(stop.coordinates) && stop.coordinates.length === 2) {
                      // Deduplicate coordinates
                      const coordKey = `${stop.coordinates[0]},${stop.coordinates[1]}`;
                      if (!allCoordinates.find(c => `${c[0]},${c[1]}` === coordKey)) {
                        allCoordinates.push(stop.coordinates);
                      }
                    }
                  }
                }
              } catch (error) {
                console.error(`[Neighborhoods] Error loading route ${filename}:`, error);
              }
            }
          }
        }
      }

      // Also check legacy processed-routes directory
      const legacyProcessedRoutesDir = path.join(DATA_DIR, 'processed-routes');
      if (fs.existsSync(legacyProcessedRoutesDir)) {
        const files = fs.readdirSync(legacyProcessedRoutesDir).filter(f => f.endsWith('.json'));
        for (const filename of files) {
          try {
            const filePath = path.join(legacyProcessedRoutesDir, filename);
            const content = fs.readFileSync(filePath, 'utf8');
            const route = JSON.parse(content);

            if (route.stops && Array.isArray(route.stops)) {
              for (const stop of route.stops) {
                if (stop.coordinates && Array.isArray(stop.coordinates) && stop.coordinates.length === 2) {
                  // Deduplicate coordinates
                  const coordKey = `${stop.coordinates[0]},${stop.coordinates[1]}`;
                  if (!allCoordinates.find(c => `${c[0]},${c[1]}` === coordKey)) {
                    allCoordinates.push(stop.coordinates);
                  }
                }
              }
            }
          } catch (error) {
            console.error(`[Neighborhoods] Error loading route ${filename}:`, error);
          }
        }
      }
    }

    console.log(`[Neighborhoods] Getting unique neighborhoods from ${allCoordinates.length} coordinates (schoolId: ${schoolId || 'all'})`);

    // Get unique neighborhoods
    const neighborhoods = await neighborhoodService.getUniqueNeighborhoods(allCoordinates);

    res.json({
      neighborhoods,
      totalCoordinates: allCoordinates.length,
      schoolId: schoolId || null,
    });
  } catch (error) {
    console.error('[Neighborhoods] Error getting neighborhoods list:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as neighborhoodsRouter };












