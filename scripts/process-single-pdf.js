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

/**
 * Process a single PDF: parse route, geocode stops, and save to JSON
 */
async function processPDF(pdfPath, schoolId) {
  console.log('🚌 Processing Single PDF Route');
  console.log('================================\n');
  
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }
  
  const filename = path.basename(pdfPath);
  console.log(`📄 PDF: ${filename}`);
  console.log(`🏫 School ID: ${schoolId || 'determined from filename'}`);
  
  const pdfBuffer = fs.readFileSync(pdfPath);
  
  const route = await processSinglePDF(pdfBuffer, filename, filename, {
    logPrefix: '[ManualProcess]',
    saveToFile: true,
    schoolId: schoolId
  });
  
  return route;
}

// Main execution
const pdfPath = process.argv[2];
const schoolId = process.argv[3];

if (!pdfPath) {
  console.error('Usage: node scripts/process-single-pdf.js <path-to-pdf> [school-id]');
  console.error('\nExample:');
  console.error('  node scripts/process-single-pdf.js data/schools/lincoln/pdfs/142LNC-A_effective_091725.pdf lincoln');
  process.exit(1);
}

// Resolve relative paths
const resolvedPath = path.isAbsolute(pdfPath) 
  ? pdfPath 
  : path.join(process.cwd(), pdfPath);

processPDF(resolvedPath, schoolId)
  .then((route) => {
    console.log('\n✅ Processing complete!');
    console.log(`📊 Summary:`);
    console.log(`   Route: ${route.name}`);
    console.log(`   Total stops: ${route.stats.totalStops}`);
    console.log(`   Geocoded: ${route.stats.geocodedStops}`);
    console.log(`   Failed: ${route.stats.failedStops}`);
    console.log(`\n✨ Done!`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
