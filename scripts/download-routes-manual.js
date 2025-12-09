import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use require for backend dependencies
const require = createRequire(import.meta.url);
const pdfParse = require(path.join(__dirname, '..', 'backend', 'node_modules', 'pdf-parse'));

// Import backend services
const backendDir = path.join(__dirname, '..', 'backend');
const driveServicePath = path.join(backendDir, 'services', 'driveService.js');
const pdfParserPath = path.join(backendDir, 'services', 'pdfParser.js');

const { downloadFile } = await import(`file://${driveServicePath}`);
const { parseRouteFromPDF } = await import(`file://${pdfParserPath}`);
const { getSchoolIdFromFilename, getSchoolPdfDir } = await import(`file://${path.join(backendDir, 'utils', 'schoolUtils.js')}`);

const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const ROUTES_FILE = path.join(OUTPUT_DIR, 'routes.json');

// Ensure directories exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Known file IDs from the folder (we'll extract these from the page)
// For now, let's use a method that tries to download using the folder structure
async function extractFileIdsFromFolder(folderId) {
  console.log('🔍 Extracting file IDs from folder page...');
  
  // Try to get file IDs by accessing the folder's JSON endpoint
  // Google Drive has a hidden API endpoint for public folders
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
  
  // We'll need to parse the page more carefully
  // For now, let's use a workaround: try common file ID patterns
  // Or better: use the folder's shareable link format
  
  // Actually, let's use the method: access the folder and look for data-file-id attributes
  const response = await fetch(folderUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });
  
  const html = await response.text();
  
  // Look for data-file-id attributes in the HTML
  const fileIdRegex = /data-file-id="([a-zA-Z0-9_-]{25,44})"/g;
  const matches = [...html.matchAll(fileIdRegex)];
  const fileIds = [...new Set(matches.map(m => m[1]))];
  
  console.log(`Found ${fileIds.length} potential file IDs`);
  
  // Also try to extract from JavaScript data
  const jsDataRegex = /\["([a-zA-Z0-9_-]{33})","([^"]+\.pdf)"/g;
  const jsMatches = [...html.matchAll(jsDataRegex)];
  
  const files = [];
  
  // Combine both methods
  const allIds = [...new Set([...fileIds, ...jsMatches.map(m => m[1])])];
  
  for (const fileId of allIds) {
    if (fileId === folderId) continue;
    
    // Try to get filename from JS matches
    const jsMatch = jsMatches.find(m => m[1] === fileId);
    const name = jsMatch ? jsMatch[2] : `file_${fileId.substring(0, 8)}.pdf`;
    
    files.push({
      id: fileId,
      name: name,
      modifiedTime: new Date().toISOString(),
    });
  }
  
  return files;
}

async function downloadAndParseAll() {
  console.log('🚌 PPS Bus Routes - Download and Parse');
  console.log('=====================================\n');

  const FOLDER_ID = '1BC03MH02DFuUL6teeq4jkcT2THRGgzxj';

  try {
    // Extract file IDs
    const files = await extractFileIdsFromFolder(FOLDER_ID);
    
    if (files.length === 0) {
      console.log('❌ No files found. Trying alternative method...');
      console.log('\n💡 Tip: You can manually provide file IDs, or use a Google Drive API key for more reliable access.');
      return;
    }
    
    console.log(`✅ Found ${files.length} files\n`);

    const routes = [];
    const errors = [];

    // Download and parse each PDF
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`[${i + 1}/${files.length}] Processing: ${file.name || file.id}`);

      try {
        // Download PDF (works without API key for public files)
        const { buffer, name } = await downloadFile(file.id, null);

        // Save PDF locally
        // Determine school from filename and save PDF to school-specific directory
        const schoolId = getSchoolIdFromFilename(name);
        if (!schoolId) {
          console.log(`   ⚠️  Could not determine school from filename: ${name}`);
          errors.push({ file: name, error: 'Could not determine school from filename' });
          continue;
        }
        
        const pdfsDir = getSchoolPdfDir(schoolId, OUTPUT_DIR, path);
        if (!fs.existsSync(pdfsDir)) {
          fs.mkdirSync(pdfsDir, { recursive: true });
        }
        
        const pdfPath = path.join(pdfsDir, name);
        fs.writeFileSync(pdfPath, buffer);
        console.log(`   💾 Saved: ${name}`);

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
          console.log(`   ⚠️  No stops found`);
          errors.push({ file: name, error: 'No stops found' });
        }
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        errors.push({ file: file.name || file.id, error: error.message });
      }

      console.log('');
    }

    // Save routes data
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

    if (routes.length > 0) {
      console.log('\n📋 Route Summary:');
      routes.forEach(route => {
        console.log(`   ${route.name}: ${route.stops.length} stops`);
      });
    }

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

downloadAndParseAll();


