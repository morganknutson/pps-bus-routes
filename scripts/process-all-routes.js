/**
 * Process all routes for all schools
 * Uses the API endpoint which uses Google Maps Geocoding API
 * 
 * Usage: node scripts/process-all-routes.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';

async function processAllSchools() {
  console.log('🔄 Processing all routes for all schools...');
  console.log('==================================================\n');
  console.log('⚠️  Make sure the backend server is running and Google Maps API key is configured\n');
  
  // Load schools
  if (!fs.existsSync(SCHOOLS_FILE)) {
    console.error('❌ Schools file not found:', SCHOOLS_FILE);
    process.exit(1);
  }

  const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
  
  // Find schools with PDFs
  const schoolsWithPdfs = schools.filter(school => {
    const pdfDir = path.join(DATA_DIR, 'schools', school.id, 'pdfs');
    if (!fs.existsSync(pdfDir)) {
      return false;
    }
    const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
    return pdfFiles.length > 0;
  });
  
  console.log(`📚 Found ${schoolsWithPdfs.length} schools with PDFs\n`);

  const results = {
    total: 0,
    processed: 0,
    errors: 0,
    bySchool: {},
  };

  // Process each school
  for (let i = 0; i < schoolsWithPdfs.length; i++) {
    const school = schoolsWithPdfs[i];
    const progress = `[${i + 1}/${schoolsWithPdfs.length}]`;
    
    console.log(`${progress} Processing: ${school.name} (${school.id})`);

    try {
      const response = await fetch(`${API_BASE}/process-pdfs/process/${school.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(300000), // 5 minute timeout per school
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        console.error(`   ❌ Error: ${error.error || response.statusText}`);
        results.errors++;
        results.bySchool[school.id] = { processed: 0, errors: 1, error: error.error || response.statusText };
        continue;
      }

      const result = await response.json();
      console.log(`   ✅ Processed: ${result.processed} routes, ${result.errors} errors`);
      
      results.total += result.processed;
      results.processed += result.processed;
      results.errors += result.errors;
      results.bySchool[school.id] = {
        processed: result.processed,
        errors: result.errors,
      };

      // Small delay between schools to avoid overwhelming the server
      if (i < schoolsWithPdfs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.errors++;
      results.bySchool[school.id] = { processed: 0, errors: 1, error: error.message };
    }
  }

  // Print summary
  console.log('\n📊 Processing Summary');
  console.log('==================================================');
  console.log(`Total routes processed: ${results.processed}`);
  console.log(`Total errors: ${results.errors}`);
  console.log(`Schools processed: ${schoolsWithPdfs.length}`);

  if (results.errors > 0) {
    console.log(`\n⚠️  Schools with errors:`);
    Object.entries(results.bySchool)
      .filter(([_, data]) => data.errors > 0)
      .slice(0, 10)
      .forEach(([schoolId, data]) => {
        const school = schools.find(s => s.id === schoolId);
        console.log(`   - ${school?.name || schoolId}: ${data.error || `${data.errors} errors`}`);
      });
  }

  console.log('\n✅ Processing complete!');
  console.log('\n📁 Processed routes saved to: data/schools/{schoolId}/processed-routes/');
}

// Run processing
processAllSchools().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});








