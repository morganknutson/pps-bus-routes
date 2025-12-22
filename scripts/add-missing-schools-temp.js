import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchSchool } from '../backend/services/placesService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHOOLS_FILE = path.join(__dirname, '..', 'data', 'schools.json');

const MISSING_SCHOOLS = [
  'Cleveland High School',
  'Grant High School',
  'Ida B. Wells-Barnett High School',
  'Jefferson High School',
  'Roosevelt High School',
  'Sunnyside Environmental School',
  'Metropolitan Learning Center',
  'Winterhaven School',
  'Creative Science School',
  'Alliance High School',
  'Pioneer Program',
  'Odyssey Program',
  'Darnell Wright Heights'
];

async function addMissingSchools() {
  try {
    if (!fs.existsSync(SCHOOLS_FILE)) {
      console.error(`Schools file not found: ${SCHOOLS_FILE}`);
      process.exit(1);
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    const existingIds = new Set(schools.map(s => s.id));

    console.log(`🚀 Adding ${MISSING_SCHOOLS.length} missing schools\n`);

    for (const schoolName of MISSING_SCHOOLS) {
      const id = schoolName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      if (existingIds.has(id)) {
        console.log(`[SKIPPING] ${schoolName} (ID: ${id}) already exists.`);
        continue;
      }

      console.log(`[PROCESSING] ${schoolName}...`);
      const searchResult = await searchSchool(schoolName);

      if (searchResult.success && searchResult.place) {
        const place = searchResult.place;
        const newSchool = {
          id,
          name: schoolName,
          address: place.address,
          coordinates: place.coordinates,
          schoolPageLink: null,
          driveLink: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          routeCount: 0 // Explicitly set to 0 for frontend "lacking data" alert
        };

        schools.push(newSchool);
        console.log(`  ✅ Added: ${place.address}`);
      } else {
        console.log(`  ❌ Failed to geocode ${schoolName}: ${searchResult.error || 'Unknown error'}`);
        // Add even if geocoding fails, so it shows up in the list at least
        schools.push({
          id,
          name: schoolName,
          address: null,
          coordinates: null,
          schoolPageLink: null,
          driveLink: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          routeCount: 0
        });
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Sort schools alphabetically by name
    schools.sort((a, b) => a.name.localeCompare(b.name));

    fs.writeFileSync(SCHOOLS_FILE, JSON.stringify(schools, null, 2));
    console.log(`\n💾 Updated schools file with ${schools.length} total schools.`);

  } catch (error) {
    console.error('Error adding schools:', error);
  }
}

addMissingSchools();


