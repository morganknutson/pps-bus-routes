import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const NEIGHBORHOOD_CACHE_FILE = path.join(DATA_DIR, 'cache', 'neighborhood-cache.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'neighborhoods.json');

async function generateNeighborhoodsData() {
  try {
    console.log('Generating neighborhoods data...');

    // 1. Load schools
    const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
    const schoolMap = new Map(schools.map(s => [s.id, s]));

    // 2. Load neighborhood cache
    const neighborhoodCache = JSON.parse(fs.readFileSync(NEIGHBORHOOD_CACHE_FILE, 'utf8'));

    // 3. Process all routes to associate neighborhoods with schools
    const neighborhoods = {}; // neighborhoodName -> { schools: Set, routes: Set }

    const schoolsDir = path.join(DATA_DIR, 'schools');
    const schoolDirs = fs.readdirSync(schoolsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const schoolId of schoolDirs) {
      const processedRoutesDir = path.join(schoolsDir, schoolId, 'processed-routes');
      if (fs.existsSync(processedRoutesDir)) {
        const files = fs.readdirSync(processedRoutesDir).filter(f => f.endsWith('.json'));
        for (const filename of files) {
          const route = JSON.parse(fs.readFileSync(path.join(processedRoutesDir, filename), 'utf8'));
          
          if (route.stops) {
            for (const stop of route.stops) {
              let neighborhoodName = stop.neighborhood;
              
              // If stop doesn't have neighborhood, check cache
              if (!neighborhoodName && stop.coordinates) {
                const key = `${stop.coordinates[0]},${stop.coordinates[1]}`;
                neighborhoodName = neighborhoodCache[key];
              }

              if (neighborhoodName) {
                if (!neighborhoods[neighborhoodName]) {
                  neighborhoods[neighborhoodName] = {
                    name: neighborhoodName,
                    schools: new Set(),
                    routes: new Set(),
                    stopCount: 0
                  };
                }
                
                neighborhoods[neighborhoodName].schools.add(schoolId);
                neighborhoods[neighborhoodName].routes.add(`${schoolId}:${route.name}`);
                neighborhoods[neighborhoodName].stopCount++;
              }
            }
          }
        }
      }
    }

    // 4. Convert to final format
    const finalData = Object.values(neighborhoods).map(n => ({
      name: n.name,
      schoolIds: Array.from(n.schools),
      routeCount: n.routes.size,
      stopCount: n.stopCount,
      // Get school names for display
      schools: Array.from(n.schools)
        .map(id => schoolMap.get(id))
        .filter(Boolean)
        .map(s => ({ id: s.id, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    })).sort((a, b) => a.name.localeCompare(b.name));

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2));
    console.log(`Successfully generated ${finalData.length} neighborhoods at ${OUTPUT_FILE}`);

  } catch (error) {
    console.error('Error generating neighborhoods data:', error);
  }
}

generateNeighborhoodsData();

