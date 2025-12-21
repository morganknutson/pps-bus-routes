/**
 * Process all missing routes for schools that have PDFs but no processed routes
 * 
 * Usage: node scripts/process-missing-routes.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const API_BASE = process.env.API_BASE || 'http://localhost:3002/api';

/**
 * Check if a school has PDFs but no processed routes
 */
function hasPdfsButNoRoutes(schoolId) {
  const pdfDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
  const routesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
  
  // Check if PDFs directory exists and has PDFs
  if (!fs.existsSync(pdfDir)) {
    return false;
  }
  const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
  if (pdfFiles.length === 0) {
    return false;
  }
  
  // Check if processed-routes directory exists and has routes
  if (!fs.existsSync(routesDir)) {
    return true; // Has PDFs but no routes directory
  }
  const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.json'));
  if (routeFiles.length === 0) {
    return true; // Has PDFs but no route files
  }
  
  return false; // Has routes
}

async function processMissingRoutes() {
  console.log('🔄 Processing Missing Routes');
  console.log('================================\n');
  console.log('⚠️  Make sure the backend server is running and Google Maps API key is configured\n');
  
  // Load schools
  if (!fs.existsSync(SCHOOLS_FILE)) {
    console.error('❌ Schools file not found:', SCHOOLS_FILE);
    process.exit(1);
  }

  const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
  
  // Find schools with PDFs but no routes
  const schoolsToProcess = schools.filter(school => hasPdfsButNoRoutes(school.id));
  
  console.log(`📚 Found ${schoolsToProcess.length} schools with PDFs but no processed routes\n`);
  
  if (schoolsToProcess.length === 0) {
    console.log('✅ All schools with PDFs already have processed routes!');
    return;
  }

  // Show list of schools to process
  console.log('Schools to process:');
  schoolsToProcess.forEach((school, index) => {
    const pdfDir = path.join(DATA_DIR, 'schools', school.id, 'pdfs');
    const pdfCount = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf')).length;
    console.log(`   ${index + 1}. ${school.name} (${school.id}) - ${pdfCount} PDFs`);
  });
  console.log('');

  const results = {
    total: 0,
    processed: 0,
    errors: 0,
    bySchool: {},
  };

  // Process each school
  for (let i = 0; i < schoolsToProcess.length; i++) {
    const school = schoolsToProcess[i];
    const progress = `[${i + 1}/${schoolsToProcess.length}]`;
    
    console.log(`${progress} Processing: ${school.name} (${school.id})`);

    try {
      const response = await fetch(`${API_BASE}/process-pdfs/process/${school.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(600000), // 10 minute timeout per school (geocoding can take time)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        console.error(`   ❌ Error: ${error.error || response.statusText}`);
        results.errors++;
        results.bySchool[school.id] = { processed: 0, errors: 1, error: error.error || response.statusText };
        continue;
      }

      const result = await response.json();
      
      // Detailed output
      if (result.processed > 0) {
        console.log(`   ✅ Successfully processed: ${result.processed} route(s)`);
        if (result.processedDetails) {
          result.processedDetails.forEach((detail, idx) => {
            console.log(`      ${idx + 1}. ${detail.file || 'Unknown'}: ${detail.stops || 0} stops`);
          });
        }
      }
      
      if (result.errors > 0) {
        console.log(`   ⚠️  Errors: ${result.errors} route(s) failed`);
        if (result.errorDetails) {
          result.errorDetails.forEach((error, idx) => {
            console.log(`      ${idx + 1}. ${error.file || 'Unknown'}: ${error.error || 'Unknown error'}`);
          });
        }
      }
      
      results.total += result.processed;
      results.processed += result.processed;
      results.errors += result.errors;
      results.bySchool[school.id] = {
        processed: result.processed,
        errors: result.errors,
        processedDetails: result.processedDetails || [],
        errorDetails: result.errorDetails || [],
      };

      // Small delay between schools to avoid overwhelming the server
      if (i < schoolsToProcess.length - 1) {
        console.log(`   ⏳ Waiting 3 seconds before next school...\n`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.errors++;
      results.bySchool[school.id] = { processed: 0, errors: 1, error: error.message };
    }
  }

  // Print summary
  console.log('\n📊 Processing Summary');
  console.log('================================');
  console.log(`Total routes processed: ${results.processed}`);
  console.log(`Total errors: ${results.errors}`);
  console.log(`Schools processed: ${schoolsToProcess.length}`);

  if (results.errors > 0) {
    console.log(`\n⚠️  Schools with errors (${Object.entries(results.bySchool).filter(([_, data]) => data.errors > 0).length}):`);
    console.log('─'.repeat(80));
    Object.entries(results.bySchool)
      .filter(([_, data]) => data.errors > 0)
      .forEach(([schoolId, data]) => {
        const school = schools.find(s => s.id === schoolId);
        console.log(`\n   ${school?.name || schoolId} (${schoolId}):`);
        if (data.error) {
          console.log(`      ❌ School processing failed: ${data.error}`);
        } else if (data.errorDetails && data.errorDetails.length > 0) {
          console.log(`      ❌ ${data.errors} route(s) failed:`);
          data.errorDetails.forEach((error, idx) => {
            console.log(`         ${idx + 1}. ${error.file || 'Unknown file'}: ${error.error || 'Unknown error'}`);
          });
        } else {
          console.log(`      ❌ ${data.errors} error(s) (details not available)`);
        }
      });
  }

  // Show successful schools
  const successful = Object.entries(results.bySchool)
    .filter(([_, data]) => data.processed > 0 && data.errors === 0);
  
  const partial = Object.entries(results.bySchool)
    .filter(([_, data]) => data.processed > 0 && data.errors > 0);
  
  if (successful.length > 0) {
    console.log(`\n✅ Successfully processed schools (${successful.length}):`);
    console.log('─'.repeat(80));
    successful.forEach(([schoolId, data]) => {
      const school = schools.find(s => s.id === schoolId);
      console.log(`\n   ${school?.name || schoolId} (${schoolId}):`);
      console.log(`      ✅ ${data.processed} route(s) processed successfully`);
      if (data.processedDetails && data.processedDetails.length > 0) {
        data.processedDetails.forEach((detail, idx) => {
          const stopsInfo = detail.stops ? ` (${detail.stops} stops)` : '';
          console.log(`         ${idx + 1}. ${detail.file || 'Unknown'}${stopsInfo}`);
        });
      }
    });
  }
  
  if (partial.length > 0) {
    console.log(`\n⚠️  Partially processed schools (${partial.length}):`);
    console.log('─'.repeat(80));
    partial.forEach(([schoolId, data]) => {
      const school = schools.find(s => s.id === schoolId);
      console.log(`\n   ${school?.name || schoolId} (${schoolId}):`);
      console.log(`      ✅ ${data.processed} route(s) processed`);
      if (data.processedDetails && data.processedDetails.length > 0) {
        console.log(`      Successful routes:`);
        data.processedDetails.forEach((detail, idx) => {
          const stopsInfo = detail.stops ? ` (${detail.stops} stops)` : '';
          console.log(`         ${idx + 1}. ${detail.file || 'Unknown'}${stopsInfo}`);
        });
      }
      console.log(`      ❌ ${data.errors} route(s) failed`);
      if (data.errorDetails && data.errorDetails.length > 0) {
        data.errorDetails.forEach((error, idx) => {
          console.log(`         ${idx + 1}. ${error.file || 'Unknown'}: ${error.error || 'Unknown error'}`);
        });
      }
    });
  }

  console.log('\n✅ Processing complete!');
  console.log('\n📁 Processed routes saved to: data/schools/{schoolId}/processed-routes/');
  
  // Save results to file
  const resultsFile = path.join(DATA_DIR, 'process-missing-routes-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    ...results,
  }, null, 2));
  console.log(`\n💾 Results saved to: ${resultsFile}`);
}

// Run processing
processMissingRoutes().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

