import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import backend services
const backendDir = path.join(__dirname, '..', 'backend');
const routeProcessorPath = path.join(backendDir, 'services', 'routeProcessor.js');
const { processSinglePDF } = await import(`file://${routeProcessorPath}`);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOL_ID = 'chapman';
const PDFS_DIR = path.join(DATA_DIR, 'schools', SCHOOL_ID, 'pdfs');

async function reprocessChapmanRoutes() {
  console.log('🔄 Reprocessing Chapman Routes');
  console.log('==============================\n');
  
  // Check if PDFs directory exists
  if (!fs.existsSync(PDFS_DIR)) {
    console.error(`❌ PDFs directory not found: ${PDFS_DIR}`);
    process.exit(1);
  }
  
  // Get all PDF files
  const pdfFiles = fs.readdirSync(PDFS_DIR)
    .filter(f => f.endsWith('.pdf'))
    .sort();
  
  if (pdfFiles.length === 0) {
    console.error(`❌ No PDF files found in ${PDFS_DIR}`);
    process.exit(1);
  }
  
  console.log(`📄 Found ${pdfFiles.length} PDF file(s) to process:\n`);
  pdfFiles.forEach((file, i) => {
    console.log(`   ${i + 1}. ${file}`);
  });
  console.log('');
  
  const results = {
    success: [],
    errors: [],
  };
  
  // Process each PDF
  for (let i = 0; i < pdfFiles.length; i++) {
    const filename = pdfFiles[i];
    const pdfPath = path.join(PDFS_DIR, filename);
    
    console.log(`\n[${i + 1}/${pdfFiles.length}] Processing: ${filename}`);
    console.log('─'.repeat(60));
    
    try {
      // Read PDF buffer
      const pdfBuffer = fs.readFileSync(pdfPath);
      
      // Process using routeProcessor
      const processedRoute = await processSinglePDF(
        pdfBuffer,
        filename,
        filename, // fileId
        {
          logPrefix: '[Chapman Reprocess]',
          saveToFile: true, // Save to processed-routes directory
        }
      );
      
      results.success.push({
        filename,
        route: processedRoute.name,
        direction: processedRoute.direction,
        stops: processedRoute.stats.totalStops,
        geocoded: processedRoute.stats.geocodedStops,
        failed: processedRoute.stats.failedStops,
      });
      
      console.log(`\n✅ Successfully processed ${filename}`);
      console.log(`   Route: ${processedRoute.name} (${processedRoute.direction})`);
      console.log(`   Stops: ${processedRoute.stats.geocodedStops}/${processedRoute.stats.totalStops} geocoded`);
      
    } catch (error) {
      console.error(`\n❌ Error processing ${filename}:`, error.message);
      results.errors.push({
        filename,
        error: error.message,
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Processing Summary');
  console.log('='.repeat(60));
  console.log(`✅ Successfully processed: ${results.success.length}`);
  console.log(`❌ Errors: ${results.errors.length}`);
  
  if (results.success.length > 0) {
    console.log('\n✅ Successful routes:');
    results.success.forEach(({ filename, route, direction, stops, geocoded, failed }) => {
      console.log(`   • ${filename} - Route ${route} (${direction}): ${geocoded}/${stops} stops geocoded`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(({ filename, error }) => {
      console.log(`   • ${filename}: ${error}`);
    });
  }
  
  console.log('\n✨ Done!');
}

// Run the script
reprocessChapmanRoutes()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });








