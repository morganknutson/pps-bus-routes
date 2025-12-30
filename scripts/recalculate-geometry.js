import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { directionsService } from '../backend/services/directionsService.js';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_DIR = path.join(DATA_DIR, 'schools');

async function recalculateGeometry() {
  console.log('🔄 Recalculating geometry for routes missing it...');
  console.log('==================================================\n');

  const schools = fs.readdirSync(SCHOOLS_DIR).filter(f => 
    fs.statSync(path.join(SCHOOLS_DIR, f)).isDirectory()
  );

  let totalProcessed = 0;
  let totalErrors = 0;

  for (const schoolId of schools) {
    const processedRoutesPath = path.join(SCHOOLS_DIR, schoolId, 'processed-routes');
    if (!fs.existsSync(processedRoutesPath)) continue;

    const routeFiles = fs.readdirSync(processedRoutesPath).filter(f => f.endsWith('.json'));

    for (const routeFile of routeFiles) {
      const routePath = path.join(processedRoutesPath, routeFile);
      const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));

      if (route.geometry || !route.stops || route.stops.length < 2) continue;

      // Filter stops to only those with coordinates
      const validStops = route.stops.filter(s => s.coordinates && s.coordinates.length === 2);
      
      if (validStops.length < 2) {
        console.log(`⚠️  Skipping ${schoolId}/${routeFile}: Not enough stops with coordinates`);
        continue;
      }

      console.log(`🛣️  Calculating geometry for ${schoolId}/${routeFile} (${validStops.length} stops)`);
      
      try {
        // directionsService expects [lat, lng]
        const waypoints = validStops.map(s => [s.coordinates[1], s.coordinates[0]]);
        
        const result = await directionsService.getRoute(waypoints);
        
        if (result.success) {
          route.geometry = result.coordinates;
          fs.writeFileSync(routePath, JSON.stringify(route, null, 2));
          console.log(`   ✅ Success!`);
          totalProcessed++;
        } else {
          console.error(`   ❌ Error: ${result.error}`);
          totalErrors++;
        }
      } catch (error) {
        console.error(`   ❌ Fatal error: ${error.message}`);
        totalErrors++;
      }

      // Small delay to avoid hitting rate limits too hard
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`Total routes updated: ${totalProcessed}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log('\n✅ Recalculation complete!');
}

recalculateGeometry().catch(console.error);

