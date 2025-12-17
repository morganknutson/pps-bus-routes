import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const backendDir = path.join(__dirname, '..', 'backend');
const dotenv = require(path.join(backendDir, 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;

async function testPhotoFetch(placeId, schoolName) {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  try {
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'id,displayName,photos'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`${schoolName}: API Error ${response.status} - ${errorText.substring(0, 100)}`);
      return;
    }
    
    const data = await response.json();
    const photoCount = data.photos ? data.photos.length : 0;
    console.log(`${schoolName}: ${photoCount} photos`);
    if (photoCount > 0) {
      console.log(`  First photo name: ${data.photos[0].name.substring(0, 80)}...`);
    }
  } catch (error) {
    console.log(`${schoolName}: Error - ${error.message}`);
  }
}

async function testMultipleSchools() {
  const testSchools = [
    { id: 'ChIJa069o3cKlVQRFWMZ0_zD7hg', name: 'Abernethy' },
    { id: 'ChIJnz4fIRwKlVQRpLrIePp94dg', name: 'Lincoln' },
    { id: 'ChIJqWVGVLCglVQRsySyu7v6r3c', name: 'Benson' },
    { id: 'ChIJ__C8KUGhlVQRIA6pcGoIaJk', name: 'Leodis V. McDaniel (has photos)' },
    { id: 'ChIJD9LhciWhlVQRmNUvbQJCDEM', name: 'Rose City Park (has photos)' }
  ];

  console.log('Testing photo fetch for sample schools:\n');
  for (const school of testSchools) {
    await testPhotoFetch(school.id, school.name);
    await new Promise(r => setTimeout(r, 200));
  }
}

testMultipleSchools().catch(console.error);

