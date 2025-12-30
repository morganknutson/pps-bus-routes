import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const SCHOOLS_DIR = path.join(DATA_DIR, 'schools');

// Portland Metro Bounding Box
const MIN_LAT = 45.3;
const MAX_LAT = 45.7;
const MIN_LNG = -123.0;
const MAX_LNG = -122.3;

async function fixStrangeStops() {
  console.log('🛠️  Fixing strange or incorrect stops in all routes...');
  console.log('====================================================\n');

  // Load schools for coordinate lookup
  const schoolsData = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
  const schoolMap = new Map();
  schoolsData.forEach(s => {
    schoolMap.set(s.name.toLowerCase(), s);
    // Also map common variations
    if (s.id) schoolMap.set(s.id.toLowerCase(), s);
  });

  // Additional school name mappings for "Loading ZONE" stops
  const schoolVariations = {
    'mt tabor': 'Mt Tabor',
    'hosford': 'Hosford',
    'tubman': 'Tubman',
    'cesar chavez': 'Cesar Chavez',
    'vernon': 'Vernon',
    'ockley green': 'Ockley Green',
    'faubion': 'Faubion',
    'george': 'George',
    'chief joseph': 'Chief Joseph',
    'astor': 'Astor',
    'lent': 'Lent',
    'lee': 'Lee',
    'kellogg': 'Kellogg',
    'sellwood': 'Sellwood',
    'lincoln': 'Lincoln',
    'clarendon': 'Cesar Chavez', // Clarendon is part of Cesar Chavez now?
    'ln.': 'Lane',
    'lane': 'Lane',
  };

  const schools = fs.readdirSync(SCHOOLS_DIR).filter(f => 
    fs.statSync(path.join(SCHOOLS_DIR, f)).isDirectory()
  );

  let totalFixed = 0;
  let totalIssues = 0;

  for (const schoolId of schools) {
    const processedRoutesPath = path.join(SCHOOLS_DIR, schoolId, 'processed-routes');
    if (!fs.existsSync(processedRoutesPath)) continue;

    const routeFiles = fs.readdirSync(processedRoutesPath).filter(f => f.endsWith('.json'));

    for (const routeFile of routeFiles) {
      const routePath = path.join(processedRoutesPath, routeFile);
      const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));
      let modified = false;

      if (!route.stops) continue;

      route.stops.forEach((stop, index) => {
        let hasIssue = false;
        let fixed = false;

        // Check for missing coordinates or out of bounds
        if (!stop.coordinates) {
          hasIssue = true;
        } else {
          const [lng, lat] = stop.coordinates;
          if (lng === 0 && lat === 0 || lat < MIN_LAT || lat > MAX_LAT || lng < MIN_LNG || lng > MAX_LNG) {
            hasIssue = true;
          }
        }

        if (hasIssue) {
          totalIssues++;
          // Try to fix "Loading ZONE" or school stops
          const address = stop.address.toLowerCase();
          let matchedSchool = null;

          // Check against variations
          for (const [key, value] of Object.entries(schoolVariations)) {
            if (address.includes(key)) {
              matchedSchool = schoolMap.get(value.toLowerCase());
              if (matchedSchool) break;
            }
          }

          if (matchedSchool && matchedSchool.coordinates) {
            console.log(`✅ Fixing stop in ${schoolId}/${routeFile}: "${stop.address}" -> Using ${matchedSchool.name} coordinates`);
            stop.coordinates = matchedSchool.coordinates;
            stop.displayName = matchedSchool.address;
            stop.isSchoolStop = stop.isSchoolStop || false; // Keep original school stop status if any
            fixed = true;
          } else if (address.includes('i5 fwy sb no intersection')) {
            // Special case for the Redding I-5 error
            // This is likely a mistake in the PDF or geocoder.
            // For now, let's look at the surrounding stops to see if we can guess where it should be.
            // Or just remove the coordinates so it doesn't break the map bounds.
            console.log(`⚠️  Removing bad geocoding for: "${stop.address}" in ${schoolId}/${routeFile}`);
            delete stop.coordinates;
            delete stop.placeId;
            delete stop.displayName;
            fixed = true;
          }

          if (fixed) {
            totalFixed++;
            modified = true;
          } else {
            console.log(`❌ Could not fix stop in ${schoolId}/${routeFile}: "${stop.address}"`);
          }
        }
      });

      if (modified) {
        // If we modified stops, we should probably clear the geometry since it will be wrong now
        if (route.geometry) {
          console.log(`🔄 Clearing geometry for ${schoolId}/${routeFile} (will need recalculation)`);
          delete route.geometry;
        }
        fs.writeFileSync(routePath, JSON.stringify(route, null, 2));
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`Total issues identified: ${totalIssues}`);
  console.log(`Total issues fixed: ${totalFixed}`);
  console.log(`Remaining issues: ${totalIssues - totalFixed}`);
  
  if (totalFixed > 0) {
    console.log(`\n💡 Note: Geometry has been cleared for fixed routes. You may need to run scripts/process-all-routes.js or similar to recalculate them.`);
  }
}

fixStrangeStops().catch(console.error);

