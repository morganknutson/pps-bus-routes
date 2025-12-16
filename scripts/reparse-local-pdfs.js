import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendDir = path.join(__dirname, '..', 'backend');
const require = createRequire(import.meta.url);
const pdfParse = require(path.join(backendDir, 'node_modules', 'pdf-parse'));
const { parseRouteFromPDF } = await import(`file://${path.join(backendDir, 'services', 'pdfParser.js')}`);

const PDFS_DIR = path.join(__dirname, '..', 'data', 'pdfs');
const ROUTES_FILE = path.join(__dirname, '..', 'data', 'routes.json');

async function reparseAll() {
  console.log('🔄 Re-parsing all PDFs with updated parser...\n');

  const pdfFiles = fs.readdirSync(PDFS_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`Found ${pdfFiles.length} PDF files\n`);

  const routes = [];
  const errors = [];

  for (let i = 0; i < pdfFiles.length; i++) {
    const filename = pdfFiles[i];
    const filePath = path.join(PDFS_DIR, filename);
    
    console.log(`[${i + 1}/${pdfFiles.length}] Processing: ${filename}`);

    try {
      const pdfBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(pdfBuffer);
      const route = parseRouteFromPDF(pdfData.text, filename, filename);

      if (route && route.stops.length > 0) {
        routes.push({
          ...route,
          fileId: filename,
          downloadedAt: new Date().toISOString(),
          stopCount: route.stops.length,
        });
        console.log(`   ✅ Parsed ${route.stops.length} stops`);
      } else {
        console.log(`   ⚠️  No stops found`);
        errors.push({ file: filename, error: 'No stops found' });
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errors.push({ file: filename, error: error.message });
    }
    console.log('');
  }

  // Save updated routes
  const output = {
    metadata: {
      folderId: '1BC03MH02DFuUL6teeq4jkcT2THRGgzxj',
      folderUrl: 'https://drive.google.com/drive/folders/1BC03MH02DFuUL6teeq4jkcT2THRGgzxj',
      downloadedAt: new Date().toISOString(),
      totalFiles: pdfFiles.length,
      successfulRoutes: routes.length,
      errors: errors.length,
      reparsed: true,
    },
    routes: routes,
    errors: errors,
  };

  fs.writeFileSync(ROUTES_FILE, JSON.stringify(output, null, 2));

  console.log('=====================================');
  console.log('✅ Complete!');
  console.log(`📊 Routes parsed: ${routes.length}`);
  console.log(`❌ Errors: ${errors.length}`);
  console.log(`\n📁 Data saved to: ${ROUTES_FILE}\n`);

  console.log('📋 Route Summary:');
  routes.forEach(route => {
    console.log(`   ${route.name}: ${route.stops.length} stops`);
  });

  if (errors.length > 0) {
    console.log('\n⚠️  Errors:');
    errors.slice(0, 10).forEach(err => {
      console.log(`   ${err.file}: ${err.error}`);
    });
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more`);
    }
  }
}

reparseAll();







