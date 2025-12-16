/**
 * Test script to verify PDF processing works correctly
 * Usage: node scripts/test-process-pdfs.js [schoolId]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');

// Get school ID from command line or use first school with PDFs
const schoolId = process.argv[2];

async function testProcessing() {
  console.log('🧪 Testing PDF Processing\n');
  console.log('================================\n');

  // Load schools
  const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
  
  let targetSchool;
  if (schoolId) {
    targetSchool = schools.find(s => s.id === schoolId);
    if (!targetSchool) {
      console.error(`❌ School not found: ${schoolId}`);
      process.exit(1);
    }
  } else {
    // Find first school with PDFs
    for (const school of schools) {
      const pdfDir = path.join(DATA_DIR, 'schools', school.id, 'pdfs');
      if (fs.existsSync(pdfDir)) {
        const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
        if (pdfFiles.length > 0) {
          targetSchool = school;
          break;
        }
      }
    }
    
    if (!targetSchool) {
      console.error('❌ No schools with PDFs found');
      process.exit(1);
    }
  }

  console.log(`📚 Testing with school: ${targetSchool.name} (${targetSchool.id})\n`);

  // Check PDFs
  const pdfDir = path.join(DATA_DIR, 'schools', targetSchool.id, 'pdfs');
  if (!fs.existsSync(pdfDir)) {
    console.error(`❌ PDF directory not found: ${pdfDir}`);
    process.exit(1);
  }

  const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
  console.log(`📄 Found ${pdfFiles.length} PDF file(s):`);
  pdfFiles.forEach(file => console.log(`   - ${file}`));
  console.log('');

  // Check existing processed routes
  const processedDir = path.join(DATA_DIR, 'schools', targetSchool.id, 'processed-routes');
  const existingProcessed = fs.existsSync(processedDir) 
    ? fs.readdirSync(processedDir).filter(f => f.endsWith('.json'))
    : [];
  
  console.log(`📦 Existing processed routes: ${existingProcessed.length}`);
  if (existingProcessed.length > 0) {
    console.log('   Files:');
    existingProcessed.forEach(file => console.log(`   - ${file}`));
  }
  console.log('');

  // Test the API endpoint
  console.log('🔗 Testing API endpoint...\n');
  console.log(`   POST http://localhost:3001/api/process-pdfs/process/${targetSchool.id}`);
  console.log('');
  console.log('   To test manually:');
  console.log(`   curl -X POST http://localhost:3001/api/process-pdfs/process/${targetSchool.id}`);
  console.log('');
  console.log('   Or use the frontend verification page and click "Process PDFs" button');
  console.log('');

  // Verify processed routes structure
  if (existingProcessed.length > 0) {
    console.log('✅ Verifying processed route structure...\n');
    const sampleFile = existingProcessed[0];
    const samplePath = path.join(processedDir, sampleFile);
    const route = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    
    console.log(`   Sample route: ${sampleFile}`);
    console.log(`   - ID: ${route.id || 'missing'}`);
    console.log(`   - Name: ${route.name || 'missing'}`);
    console.log(`   - Direction: ${route.direction || 'missing'}`);
    console.log(`   - Stops: ${route.stops?.length || 0}`);
    console.log(`   - Geocoded: ${route.stats?.geocodedStops || 0}/${route.stats?.totalStops || 0}`);
    console.log(`   - Processed at: ${route.processedAt || 'missing'}`);
    
    // Check for required fields
    const required = ['id', 'name', 'stops', 'stats'];
    const missing = required.filter(field => !route[field]);
    if (missing.length > 0) {
      console.log(`   ⚠️  Missing fields: ${missing.join(', ')}`);
    } else {
      console.log('   ✅ All required fields present');
    }
    
    // Check stop structure
    if (route.stops && route.stops.length > 0) {
      const sampleStop = route.stops[0];
      console.log(`   - Sample stop has coordinates: ${!!sampleStop.coordinates}`);
      console.log(`   - Sample stop has address: ${!!sampleStop.address}`);
    }
  } else {
    console.log('⚠️  No processed routes found - processing will create new ones');
  }

  console.log('\n✅ Test setup complete!');
  console.log('\nNext steps:');
  console.log('1. Make sure backend server is running (npm run dev in backend/)');
  console.log('2. Use the verification page or curl to trigger processing');
  console.log('3. Check the processed-routes directory for output');
}

testProcessing().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});




