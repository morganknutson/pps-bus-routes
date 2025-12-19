import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FOLDER_ID = '1BC03MH02DFuUL6teeq4jkcT2THRGgzxj';
const API_BASE = 'http://localhost:3001/api';
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const ROUTES_FILE = path.join(OUTPUT_DIR, 'routes.json');

// Ensure directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function downloadViaAPI() {
  console.log('🚌 PPS Bus Routes - Download via API');
  console.log('=====================================\n');
  console.log('⚠️  Make sure the backend server is running (npm run dev)\n');

  try {
    // Step 1: Parse folder
    console.log('📂 Fetching and parsing PDFs from Google Drive...');
    const response = await fetch(`${API_BASE}/drive/folder/${FOLDER_ID}/parse`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const { routes } = await response.json();
    console.log(`✅ Parsed ${routes.length} routes\n`);

    if (routes.length === 0) {
      console.log('❌ No routes found. Check that:');
      console.log('   1. The backend server is running');
      console.log('   2. The folder is publicly accessible');
      return;
    }

    // Step 2: Save routes data
    const output = {
      metadata: {
        folderId: FOLDER_ID,
        folderUrl: `https://drive.google.com/drive/folders/${FOLDER_ID}`,
        downloadedAt: new Date().toISOString(),
        totalRoutes: routes.length,
      },
      routes: routes.map(route => ({
        ...route,
        downloadedAt: new Date().toISOString(),
        stopCount: route.stops.length,
      })),
    };

    fs.writeFileSync(ROUTES_FILE, JSON.stringify(output, null, 2));

    console.log('=====================================');
    console.log('✅ Complete!');
    console.log(`📊 Routes saved: ${routes.length}`);
    console.log(`\n📁 Data saved to: ${ROUTES_FILE}\n`);

    console.log('📋 Route Summary:');
    routes.forEach(route => {
      console.log(`   ${route.name}: ${route.stops.length} stops`);
    });

  } catch (error) {
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.error('❌ Error: Cannot connect to backend server.');
      console.error('   Make sure the server is running: npm run dev');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

downloadViaAPI();














