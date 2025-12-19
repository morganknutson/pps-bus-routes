/**
 * Fetch photos for all schools from Google Places API
 * Stores photos in a separate JSON file: data/school-photos.json
 * Usage: node scripts/fetch-school-photos.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
const backendDir = path.join(__dirname, '..', 'backend');
const require = createRequire(import.meta.url);
const dotenv = require(path.join(backendDir, 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const PHOTOS_FILE = path.join(DATA_DIR, 'school-photos.json');
const API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error('❌ Google Maps API key not found. Set GOOGLE_MAPS_API_KEY or GOOGLE_API_KEY in backend/.env');
  process.exit(1);
}

/**
 * Get photos from Places API using placeId
 * Uses the new Places API (New) format with fallback to legacy API
 */
async function getPlacePhotos(placeId) {
  // Try new Places API first
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'photos'
      }
    });
    
    if (!response.ok) {
      // If it's a 400, try using the old Places API format instead
      if (response.status === 400) {
        return await getPlacePhotosLegacy(placeId);
      }
      
      const errorText = await response.text();
      return {
        success: false,
        error: `Places API error: ${response.status}`,
        details: errorText
      };
    }
    
    const data = await response.json();
    
    const photos = data.photos ? data.photos.map(photo => ({
      name: photo.name,
      widthPx: photo.widthPx,
      heightPx: photo.heightPx,
      authorAttributions: photo.authorAttributions || []
    })) : [];
    
    return {
      success: true,
      photos: photos
    };
  } catch (error) {
    // Try legacy API on error
    return await getPlacePhotosLegacy(placeId);
  }
}

/**
 * Fallback to legacy Places API if new API fails
 */
async function getPlacePhotosLegacy(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.result) {
      const photos = data.result.photos ? data.result.photos.map(photo => ({
        photo_reference: photo.photo_reference,
        width: photo.width,
        height: photo.height,
        html_attributions: photo.html_attributions || []
      })) : [];
      
      return {
        success: true,
        photos: photos
      };
    }
    
    return {
      success: false,
      error: `Places API (legacy) error: ${data.status}`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetch photos for all schools
 */
async function fetchAllSchoolPhotos() {
  console.log('📸 Fetching Photos for All Schools\n');
  console.log('================================\n');
  
  if (!fs.existsSync(SCHOOLS_FILE)) {
    console.error(`❌ Schools file not found: ${SCHOOLS_FILE}`);
    process.exit(1);
  }
  
  const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
  console.log(`📚 Found ${schools.length} schools\n`);
  
  // Load existing photos file if it exists
  let existingPhotos = {};
  if (fs.existsSync(PHOTOS_FILE)) {
    try {
      existingPhotos = JSON.parse(fs.readFileSync(PHOTOS_FILE, 'utf8'));
      console.log(`📁 Loaded existing photos file with ${Object.keys(existingPhotos).length} schools\n`);
    } catch (error) {
      console.log(`⚠️  Could not load existing photos file, starting fresh\n`);
    }
  }
  
  const schoolPhotos = { ...existingPhotos };
  let fetched = 0;
  let skipped = 0;
  let errors = 0;
  
  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    console.log(`[${i + 1}/${schools.length}] Processing: ${school.name} (${school.id})`);
    
    // Skip if no placeId
    if (!school.placeId) {
      console.log(`   ⚠️  No placeId available, skipping`);
      console.log('');
      continue;
    }
    
    // Check if we already have photos for this school (and they're not empty)
    if (schoolPhotos[school.id] && 
        schoolPhotos[school.id].photos && 
        schoolPhotos[school.id].photos.length > 0 &&
        schoolPhotos[school.id].placeId === school.placeId) {
      console.log(`   ⏭️  Already have ${schoolPhotos[school.id].photos.length} photo(s), skipping`);
      skipped++;
      console.log('');
      continue;
    }
    
    // Fetch photos
    console.log(`   📍 Fetching photos from Places API...`);
    const photosResult = await getPlacePhotos(school.placeId);
    
    if (photosResult.success) {
      schoolPhotos[school.id] = {
        schoolId: school.id,
        schoolName: school.name,
        placeId: school.placeId,
        photos: photosResult.photos,
        photoCount: photosResult.photos.length,
        lastUpdated: new Date().toISOString()
      };
      
      fetched++;
      console.log(`   ✅ Fetched ${photosResult.photos.length} photo(s)`);
      
      // Save progress periodically (every 10 schools)
      if ((i + 1) % 10 === 0) {
        fs.writeFileSync(PHOTOS_FILE, JSON.stringify(schoolPhotos, null, 2), 'utf8');
        console.log(`   💾 Progress saved`);
      }
    } else {
      // Store empty result so we don't keep trying
      schoolPhotos[school.id] = {
        schoolId: school.id,
        schoolName: school.name,
        placeId: school.placeId,
        photos: [],
        photoCount: 0,
        lastUpdated: new Date().toISOString(),
        error: photosResult.error
      };
      errors++;
      console.log(`   ❌ Failed to fetch photos: ${photosResult.error}`);
    }
    
    console.log('');
    
    // Rate limiting between schools (200ms delay)
    if (i < schools.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Final save
  fs.writeFileSync(PHOTOS_FILE, JSON.stringify(schoolPhotos, null, 2), 'utf8');
  
  console.log('================================');
  console.log(`✅ Complete!`);
  console.log(`   Fetched: ${fetched} schools`);
  console.log(`   Skipped: ${skipped} schools`);
  console.log(`   Errors: ${errors} schools`);
  console.log(`   Total: ${schools.length} schools`);
  console.log(`\n📁 Photos saved to: ${PHOTOS_FILE}`);
  
  // Summary statistics
  const totalPhotos = Object.values(schoolPhotos).reduce((sum, school) => sum + (school.photoCount || 0), 0);
  const schoolsWithPhotos = Object.values(schoolPhotos).filter(school => school.photoCount > 0).length;
  console.log(`\n📊 Summary:`);
  console.log(`   Schools with photos: ${schoolsWithPhotos}`);
  console.log(`   Total photos: ${totalPhotos}`);
}

fetchAllSchoolPhotos().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});




