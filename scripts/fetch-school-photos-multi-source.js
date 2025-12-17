/**
 * Fetch photos for all schools from multiple sources:
 * 1. Google Places API (already done, but included for completeness)
 * 2. Wikipedia API - Get images from school Wikipedia pages
 * 3. Google Street View Static API - Get building exterior photos
 * 4. Google Custom Search API - Search for school images (optional, requires setup)
 * 
 * Usage: node scripts/fetch-school-photos-multi-source.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Load .env from backend directory
const backendDir = path.join(__dirname, '..', 'backend');
const dotenv = require(path.join(backendDir, 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const PHOTOS_FILE = path.join(DATA_DIR, 'school-photos.json');
const API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
const GOOGLE_CUSTOM_SEARCH_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
const GOOGLE_CUSTOM_SEARCH_ENGINE_ID = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

/**
 * Get photos from Google Places API
 */
async function getPlacePhotos(placeId) {
  if (!API_KEY) return { success: false, error: 'No API key' };
  
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'photos'
      }
    });
    
    if (!response.ok) {
      // Try legacy API
      return await getPlacePhotosLegacy(placeId);
    }
    
    const data = await response.json();
    const photos = data.photos ? data.photos.map(photo => ({
      source: 'google_places',
      name: photo.name,
      widthPx: photo.widthPx,
      heightPx: photo.heightPx,
      authorAttributions: photo.authorAttributions || []
    })) : [];
    
    return { success: true, photos };
  } catch (error) {
    return await getPlacePhotosLegacy(placeId);
  }
}

async function getPlacePhotosLegacy(placeId) {
  if (!API_KEY) return { success: false, error: 'No API key' };
  
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.result) {
      const photos = data.result.photos ? data.result.photos.map(photo => ({
        source: 'google_places_legacy',
        photo_reference: photo.photo_reference,
        width: photo.width,
        height: photo.height,
        html_attributions: photo.html_attributions || []
      })) : [];
      
      return { success: true, photos };
    }
    
    return { success: false, error: `API error: ${data.status}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get images from Wikipedia article
 */
async function getWikipediaImages(schoolName) {
  try {
    // Try different search terms
    const searchTerms = [
      `${schoolName} School Portland`,
      `${schoolName} Portland Oregon`,
      schoolName
    ];
    
    for (const searchTerm of searchTerms) {
      // Use Wikipedia API to search for articles
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(searchTerm)}&srlimit=1&origin=*`;
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();
      
      if (searchData.query?.search && searchData.query.search.length > 0) {
        const pageTitle = searchData.query.search[0].title;
        
        // Get images from the article
        const imagesUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=images&titles=${encodeURIComponent(pageTitle)}&origin=*`;
        const imagesResponse = await fetch(imagesUrl);
        const imagesData = await imagesResponse.json();
        
        const pages = imagesData.query?.pages;
        if (pages) {
          const pageId = Object.keys(pages)[0];
          const imageTitles = pages[pageId]?.images || [];
          
          if (imageTitles.length > 0) {
            // Get image info for first few images
            const imageInfoTitles = imageTitles.slice(0, 5).map(img => img.title).join('|');
            const imageInfoUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|dimensions&titles=${encodeURIComponent(imageInfoTitles)}&origin=*`;
            const imageInfoResponse = await fetch(imageInfoUrl);
            const imageInfoData = await imageInfoResponse.json();
            
            const imagePages = imageInfoData.query?.pages || {};
            const images = Object.values(imagePages)
              .filter(page => page.imageinfo && page.imageinfo[0])
              .map(page => {
                const info = page.imageinfo[0];
                return {
                  source: 'wikipedia',
                  url: info.url,
                  thumbnailUrl: info.thumburl || info.url,
                  title: page.title,
                  width: info.width,
                  height: info.height
                };
              });
            
            if (images.length > 0) {
              return { success: true, photos: images };
            }
          }
        }
      }
    }
    
    return { success: false, error: 'No Wikipedia images found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get Street View static image of the school building
 */
async function getStreetViewImage(coordinates, schoolName) {
  if (!API_KEY || !coordinates || coordinates.length !== 2) {
    return { success: false, error: 'Missing coordinates or API key' };
  }
  
  const [lng, lat] = coordinates;
  
  try {
    // Street View Static API
    const url = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${lat},${lng}&fov=90&heading=0&pitch=0&key=${API_KEY}`;
    
    // Check if Street View is available
    const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${API_KEY}`;
    const metadataResponse = await fetch(metadataUrl);
    const metadata = await metadataResponse.json();
    
    if (metadata.status === 'OK') {
      return {
        success: true,
        photos: [{
          source: 'street_view',
          url: url,
          thumbnailUrl: `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${lat},${lng}&fov=90&heading=0&pitch=0&key=${API_KEY}`,
          width: 800,
          height: 600,
          location: { lat, lng },
          copyright: 'Google Street View'
        }]
      };
    }
    
    return { success: false, error: 'No Street View available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Search for images using Google Custom Search API
 * Requires: GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID
 */
async function searchGoogleImages(schoolName, address) {
  if (!GOOGLE_CUSTOM_SEARCH_API_KEY || !GOOGLE_CUSTOM_SEARCH_ENGINE_ID) {
    return { success: false, error: 'Custom Search API not configured' };
  }
  
  try {
    const query = `${schoolName} Portland Oregon school building`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_CUSTOM_SEARCH_API_KEY}&cx=${GOOGLE_CUSTOM_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&searchType=image&num=5`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const images = data.items.map(item => ({
        source: 'google_image_search',
        url: item.link,
        thumbnailUrl: item.image?.thumbnailLink,
        width: item.image?.width,
        height: item.image?.height,
        title: item.title,
        displayLink: item.displayLink
      }));
      
      return { success: true, photos: images };
    }
    
    return { success: false, error: 'No images found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch photos from all available sources for a school
 */
async function fetchAllPhotosForSchool(school) {
  const allPhotos = [];
  const sources = [];
  
  // 1. Google Places API
  if (school.placeId) {
    console.log(`   📍 Fetching from Google Places...`);
    const placesResult = await getPlacePhotos(school.placeId);
    if (placesResult.success && placesResult.photos.length > 0) {
      allPhotos.push(...placesResult.photos);
      sources.push('google_places');
    }
    await new Promise(r => setTimeout(r, 200)); // Rate limiting
  }
  
  // 2. Wikipedia
  console.log(`   📚 Checking Wikipedia...`);
  const wikiResult = await getWikipediaImages(school.name);
  if (wikiResult.success && wikiResult.photos.length > 0) {
    allPhotos.push(...wikiResult.photos);
    sources.push('wikipedia');
  }
  await new Promise(r => setTimeout(r, 200));
  
  // 3. Street View
  if (school.coordinates && school.coordinates.length === 2) {
    console.log(`   🏛️  Checking Street View...`);
    const streetViewResult = await getStreetViewImage(school.coordinates, school.name);
    if (streetViewResult.success && streetViewResult.photos.length > 0) {
      allPhotos.push(...streetViewResult.photos);
      sources.push('street_view');
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  // 4. Google Image Search (if configured)
  if (GOOGLE_CUSTOM_SEARCH_API_KEY && GOOGLE_CUSTOM_SEARCH_ENGINE_ID) {
    console.log(`   🔍 Searching Google Images...`);
    const imageSearchResult = await searchGoogleImages(school.name, school.address);
    if (imageSearchResult.success && imageSearchResult.photos.length > 0) {
      allPhotos.push(...imageSearchResult.photos);
      sources.push('google_image_search');
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  return {
    success: allPhotos.length > 0,
    photos: allPhotos,
    sources: sources,
    photoCount: allPhotos.length
  };
}

/**
 * Main function to fetch photos from all sources
 */
async function fetchAllSchoolPhotos() {
  console.log('📸 Fetching Photos for All Schools from Multiple Sources\n');
  console.log('================================\n');
  
  if (!fs.existsSync(SCHOOLS_FILE)) {
    console.error(`❌ Schools file not found: ${SCHOOLS_FILE}`);
    process.exit(1);
  }
  
  const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
  console.log(`📚 Found ${schools.length} schools\n`);
  
  if (!API_KEY) {
    console.warn('⚠️  Google Maps API key not found - Places API and Street View will be skipped\n');
  }
  
  if (!GOOGLE_CUSTOM_SEARCH_API_KEY || !GOOGLE_CUSTOM_SEARCH_ENGINE_ID) {
    console.warn('⚠️  Google Custom Search not configured - Image search will be skipped\n');
    console.warn('   To enable: Set GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID in backend/.env\n');
  }
  
  // Load existing photos
  let existingPhotos = {};
  if (fs.existsSync(PHOTOS_FILE)) {
    try {
      existingPhotos = JSON.parse(fs.readFileSync(PHOTOS_FILE, 'utf8'));
      console.log(`📁 Loaded existing photos file\n`);
    } catch (error) {
      console.log(`⚠️  Starting fresh\n`);
    }
  }
  
  const schoolPhotos = { ...existingPhotos };
  let fetched = 0;
  let updated = 0;
  let errors = 0;
  
  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    console.log(`[${i + 1}/${schools.length}] Processing: ${school.name} (${school.id})`);
    
    // Fetch from all sources
    const result = await fetchAllPhotosForSchool(school);
    
    if (result.success) {
      const previousCount = schoolPhotos[school.id]?.photoCount || 0;
      
      schoolPhotos[school.id] = {
        schoolId: school.id,
        schoolName: school.name,
        placeId: school.placeId || null,
        photos: result.photos,
        photoCount: result.photoCount,
        sources: result.sources,
        lastUpdated: new Date().toISOString()
      };
      
      if (previousCount === 0) {
        fetched++;
      } else {
        updated++;
      }
      
      console.log(`   ✅ Found ${result.photoCount} photo(s) from: ${result.sources.join(', ')}`);
    } else {
      // Keep existing photos or mark as no photos
      if (!schoolPhotos[school.id]) {
        schoolPhotos[school.id] = {
          schoolId: school.id,
          schoolName: school.name,
          placeId: school.placeId || null,
          photos: [],
          photoCount: 0,
          sources: [],
          lastUpdated: new Date().toISOString()
        };
      }
      errors++;
      console.log(`   ⚠️  No photos found from any source`);
    }
    
    console.log('');
    
    // Save progress every 10 schools
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(PHOTOS_FILE, JSON.stringify(schoolPhotos, null, 2), 'utf8');
      console.log(`   💾 Progress saved\n`);
    }
    
    // Rate limiting
    if (i < schools.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  
  // Final save
  fs.writeFileSync(PHOTOS_FILE, JSON.stringify(schoolPhotos, null, 2), 'utf8');
  
  console.log('================================');
  console.log(`✅ Complete!`);
  console.log(`   New photos found: ${fetched} schools`);
  console.log(`   Updated: ${updated} schools`);
  console.log(`   No photos: ${errors} schools`);
  console.log(`   Total: ${schools.length} schools`);
  console.log(`\n📁 Photos saved to: ${PHOTOS_FILE}`);
  
  // Summary by source
  const sourceStats = {};
  Object.values(schoolPhotos).forEach(school => {
    school.sources?.forEach(source => {
      sourceStats[source] = (sourceStats[source] || 0) + 1;
    });
  });
  
  console.log(`\n📊 Photos by source:`);
  Object.entries(sourceStats).forEach(([source, count]) => {
    console.log(`   ${source}: ${count} schools`);
  });
  
  const totalPhotos = Object.values(schoolPhotos).reduce((sum, school) => sum + (school.photoCount || 0), 0);
  const schoolsWithPhotos = Object.values(schoolPhotos).filter(school => school.photoCount > 0).length;
  console.log(`\n📊 Overall:`);
  console.log(`   Schools with photos: ${schoolsWithPhotos}`);
  console.log(`   Total photos: ${totalPhotos}`);
}

fetchAllSchoolPhotos().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

