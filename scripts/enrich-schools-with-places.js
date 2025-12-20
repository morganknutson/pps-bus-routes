/**
 * Enrich schools.json with Places API data
 * Fetches additional details from Google Places API using placeId
 * Usage: node scripts/enrich-schools-with-places.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory using require for dotenv
const backendDir = path.join(__dirname, '..', 'backend');
const require = createRequire(import.meta.url);
const dotenv = require(path.join(backendDir, 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error('❌ Google Maps API key not found. Set GOOGLE_MAPS_API_KEY or GOOGLE_API_KEY in backend/.env');
  process.exit(1);
}

/**
 * Geocode an address to get placeId
 */
async function geocodeAddress(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        success: true,
        placeId: result.place_id,
        coordinates: [result.geometry.location.lng, result.geometry.location.lat],
        formattedAddress: result.formatted_address,
      };
    }
    
    return { success: false, error: data.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get Places API details using placeId
 * Uses the new Places API (New) format
 */
async function getPlacesDetails(placeId) {
  // Convert Geocoding API place_id to Places API (New) format
  // The new API uses place_id directly but requires different endpoint
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents,plusCode,websiteUri,nationalPhoneNumber,regularOpeningHours,photos,editorialSummary,types'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      // If it's a 400, try using the old Places API format instead
      if (response.status === 400) {
        return await getPlacesDetailsLegacy(placeId);
      }
      
      return {
        success: false,
        error: `Places API error: ${response.status}`,
        details: errorData
      };
    }
    
    const data = await response.json();
    
    return {
      success: true,
      place: {
        id: data.id,
        displayName: data.displayName?.text || null,
        formattedAddress: data.formattedAddress || null,
        location: data.location ? {
          lat: data.location.latitude,
          lng: data.location.longitude
        } : null,
        addressComponents: data.addressComponents || null,
        plusCode: data.plusCode?.globalCode || null,
        websiteUri: data.websiteUri || null,
        phoneNumber: data.nationalPhoneNumber || null,
        regularOpeningHours: data.regularOpeningHours || null,
        photos: data.photos ? data.photos.map(photo => ({
          name: photo.name,
          widthPx: photo.widthPx,
          heightPx: photo.heightPx,
          authorAttributions: photo.authorAttributions
        })) : null,
        editorialSummary: data.editorialSummary?.text || null,
        types: data.types || null
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fallback to legacy Places API if new API fails
 */
async function getPlacesDetailsLegacy(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=place_id,name,formatted_address,geometry,address_components,plus_code,website,formatted_phone_number,opening_hours,photos,editorial_summary,types&key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.result) {
      const result = data.result;
      return {
        success: true,
        place: {
          id: result.place_id,
          displayName: result.name || null,
          formattedAddress: result.formatted_address || null,
          location: result.geometry?.location ? {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng
          } : null,
          addressComponents: result.address_components || null,
          plusCode: result.plus_code?.global_code || null,
          websiteUri: result.website || null,
          phoneNumber: result.formatted_phone_number || null,
          regularOpeningHours: result.opening_hours || null,
          photos: result.photos ? result.photos.map(photo => ({
            photo_reference: photo.photo_reference,
            width: photo.width,
            height: photo.height,
            html_attributions: photo.html_attributions
          })) : null,
          editorialSummary: result.editorial_summary?.overview || null,
          types: result.types || null
        }
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
 * Enrich schools with Places API data
 */
async function enrichSchools() {
  console.log('🏫 Enriching Schools with Places API Data\n');
  console.log('================================\n');
  
  if (!fs.existsSync(SCHOOLS_FILE)) {
    console.error(`❌ Schools file not found: ${SCHOOLS_FILE}`);
    process.exit(1);
  }
  
  const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
  console.log(`📚 Found ${schools.length} schools\n`);
  
  let updated = 0;
  let errors = 0;
  
  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    console.log(`[${i + 1}/${schools.length}] Processing: ${school.name}`);
    
    // Skip if already has places data and placeId matches
    if (school.placesData && school.placeId) {
      console.log(`   ⏭️  Already has Places data, skipping`);
      console.log('');
      continue;
    }
    
    // Get placeId if not already present
    let placeId = school.placeId;
    
    if (!placeId && school.address) {
      console.log(`   🔍 Geocoding address to get placeId...`);
      const geocodeResult = await geocodeAddress(school.address);
      
      if (geocodeResult.success) {
        placeId = geocodeResult.placeId;
        // Update coordinates if they're different or missing
        if (!school.coordinates || JSON.stringify(school.coordinates) !== JSON.stringify(geocodeResult.coordinates)) {
          school.coordinates = geocodeResult.coordinates;
          console.log(`   ✅ Got placeId and updated coordinates`);
        } else {
          console.log(`   ✅ Got placeId`);
        }
      } else {
        console.log(`   ❌ Failed to geocode: ${geocodeResult.error}`);
        errors++;
        console.log('');
        continue;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!placeId) {
      console.log(`   ⚠️  No placeId available, skipping Places API lookup`);
      console.log('');
      continue;
    }
    
    // Get Places API details
    console.log(`   📍 Fetching Places API data...`);
    const placesResult = await getPlacesDetails(placeId);
    
    if (placesResult.success) {
      school.placeId = placeId;
      school.placesData = placesResult.place;
      updated++;
      console.log(`   ✅ Enriched with Places data`);
      if (placesResult.place.websiteUri) {
        console.log(`      Website: ${placesResult.place.websiteUri}`);
      }
      if (placesResult.place.phoneNumber) {
        console.log(`      Phone: ${placesResult.place.phoneNumber}`);
      }
    } else {
      console.log(`   ❌ Failed to get Places data: ${placesResult.error}`);
      errors++;
    }
    
    console.log('');
    
    // Rate limiting between schools
    if (i < schools.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Save updated schools
  fs.writeFileSync(SCHOOLS_FILE, JSON.stringify(schools, null, 2), 'utf8');
  
  console.log('================================');
  console.log(`✅ Complete!`);
  console.log(`   Updated: ${updated} schools`);
  console.log(`   Errors: ${errors} schools`);
  console.log(`   Total: ${schools.length} schools`);
}

enrichSchools().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});












