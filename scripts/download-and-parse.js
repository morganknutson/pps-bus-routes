import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import backend services
const backendDir = path.join(__dirname, '..', 'backend');

// Use require for CommonJS modules
const require = createRequire(import.meta.url);

// Load environment variables from backend/.env
const dotenv = require(path.join(backendDir, 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const driveServicePath = path.join(backendDir, 'services', 'driveService.js');
const pdfParserPath = path.join(backendDir, 'services', 'pdfParser.js');

// Use require for pdf-parse (CommonJS module)
const pdfParse = require(path.join(backendDir, 'node_modules', 'pdf-parse'));

// Import ES modules
const { listFolderFiles, downloadFile } = await import(`file://${driveServicePath}`);
const { parseRouteFromPDF } = await import(`file://${pdfParserPath}`);
const { getSchoolIdFromFilename, getSchoolPdfDir } = await import(`file://${path.join(backendDir, 'utils', 'schoolUtils.js')}`);

const FOLDER_ID = '1BC03MH02DFuUL6teeq4jkcT2THRGgzxj';
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const ROUTES_FILE = path.join(OUTPUT_DIR, 'routes.json');

// Ensure directories exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function downloadAndParseAll() {
  console.log('🚌 PPS Bus Routes - Download and Parse');
  console.log('=====================================\n');

  try {
    // Step 1: List all PDFs in folder
    console.log('📂 Fetching PDF list from Google Drive...');
    const apiKey = process.env.GOOGLE_API_KEY || null;
    if (apiKey) {
      console.log('✅ Using Google Drive API key');
    } else {
      console.log('⚠️  No API key found, using page parsing...');
    }
    const files = await listFolderFiles(FOLDER_ID, apiKey);
    console.log(`✅ Found ${files.length} PDF files\n`);

    const routes = [];
    const errors = [];

    // Step 2: Download and parse each PDF
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`[${i + 1}/${files.length}] Processing: ${file.name}`);

      try {
        // Download PDF (use API key from .env)
        const apiKey = process.env.GOOGLE_API_KEY || null;
        const { buffer, name } = await downloadFile(file.id, apiKey);

        // Determine school from filename and save PDF to school-specific directory
        const schoolId = getSchoolIdFromFilename(name);
        if (!schoolId) {
          console.log(`   ⚠️  Could not determine school from filename: ${name}`);
          errors.push({ file: name, error: 'Could not determine school from filename' });
          console.log('');
          continue;
        }
        
        const pdfsDir = getSchoolPdfDir(schoolId, OUTPUT_DIR, path);
        if (!fs.existsSync(pdfsDir)) {
          fs.mkdirSync(pdfsDir, { recursive: true });
        }
        
        // Save PDF locally
        const pdfPath = path.join(pdfsDir, name);
        fs.writeFileSync(pdfPath, buffer);
        console.log(`   💾 Saved PDF: ${name} (${schoolId})`);

        // Parse PDF
        const pdfData = await pdfParse(buffer);
        const route = parseRouteFromPDF(pdfData.text, file.id, name);

        if (route && route.stops.length > 0) {
          routes.push({
            ...route,
            fileId: file.id,
            downloadedAt: new Date().toISOString(),
            stopCount: route.stops.length,
          });
          console.log(`   ✅ Parsed ${route.stops.length} stops`);
        } else {
          console.log(`   ⚠️  No stops found in PDF`);
          errors.push({ file: name, error: 'No stops found' });
        }
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        errors.push({ file: file.name, error: error.message });
      }

      console.log('');
    }

    // Step 3: Save routes data
    const output = {
      metadata: {
        folderId: FOLDER_ID,
        folderUrl: `https://drive.google.com/drive/folders/${FOLDER_ID}`,
        downloadedAt: new Date().toISOString(),
        totalFiles: files.length,
        successfulRoutes: routes.length,
        errors: errors.length,
      },
      routes: routes,
      errors: errors,
    };

    fs.writeFileSync(ROUTES_FILE, JSON.stringify(output, null, 2));
    console.log('=====================================');
    console.log('✅ Complete!');
    console.log(`📊 Routes parsed: ${routes.length}`);
    console.log(`❌ Errors: ${errors.length}`);
    console.log(`\n📁 Data saved to:`);
    console.log(`   Routes: ${ROUTES_FILE}`);
    console.log(`   PDFs: ${path.join(OUTPUT_DIR, 'schools', '*', 'pdfs')}`);

    // Print summary
    console.log('\n📋 Route Summary:');
    routes.forEach(route => {
      console.log(`   ${route.name}: ${route.stops.length} stops`);
    });

    if (errors.length > 0) {
      console.log('\n⚠️  Errors:');
      errors.forEach(err => {
        console.log(`   ${err.file}: ${err.error}`);
      });
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
downloadAndParseAll();

