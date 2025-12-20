import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { directionsService } from '../services/directionsService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SCHOOLS_DIR = path.join(DATA_DIR, 'schools');

async function recalculateGeometry() {
  console.log('🔄 Recalculating route geometry for all routes...');
  
  if (!fs.existsSync(SCHOOLS_DIR)) {
    console.error('Schools directory not found');
    return;
  }

  const schools = fs.readdirSync(SCHOOLS_DIR).filter(f => 
    fs.statSync(path.join(SCHOOLS_DIR, f)).isDirectory()
  );

  for (const schoolId of schools) {
    const routesDir = path.join(SCHOOLS_DIR, schoolId, 'processed-routes');
    if (!fs.existsSync(routesDir)) continue;

    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.json'));
    
    for (const file of routeFiles) {
      const routePath = path.join(routesDir, file);
      const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));

      // Only recalculate if geometry is missing or we want to force it
      if (!route.geometry || route.geometry.length === 0) {
        console.log(`📍 Recalculating geometry for ${schoolId}/${file}...`);
        
        const stopsWithCoords = route.stops.filter(s => s.coordinates);
        if (stopsWithCoords.length < 2) continue;

        try {
          // Convert [lng, lat] to [lat, lng] for Directions API
          const waypoints = stopsWithCoords.map(s => [s.coordinates[1], s.coordinates[0]]);
          const geometry = await directionsService.getRouteGeometry(waypoints);
          
          if (geometry) {
            route.geometry = geometry;
            route.geometryUpdatedAt = new Date().toISOString();
            fs.writeFileSync(routePath, JSON.stringify(route, null, 2));
            console.log(`✅ Success: ${geometry.length} points`);
          }
        } catch (error) {
          console.error(`❌ Error for ${file}: ${error.message}`);
        }
      }
    }
  }
}

recalculateGeometry().catch(console.error);
