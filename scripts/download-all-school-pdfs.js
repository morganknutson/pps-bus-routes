/**
 * @deprecated This script is deprecated. Use scripts/trigger-pdf-fetch.js instead.
 * 
 * The new script (trigger-pdf-fetch.js) uses the job queue system which provides:
 * - Better error handling and retry logic
 * - Automatic cleanup of orphaned PDFs (files removed from Drive)
 * - Job status tracking and progress updates
 * - Works with both Redis and polling modes (no Redis required)
 * - Better integration with the verification page and worker system
 * 
 * Migration:
 *   Old: node scripts/download-all-school-pdfs.js
 *   New: node scripts/trigger-pdf-fetch.js --all
 * 
 * For single school:
 *   Old: (not supported)
 *   New: node scripts/trigger-pdf-fetch.js <schoolId>
 * 
 * This script is kept for reference but should not be used for new operations.
 */

/**
 * Script to download PDFs from all school Drive folders
 * Uses the driveLink from each school in schools.json
 * 
 * @deprecated - See deprecation notice above
 */

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

// Import ES modules
const { listFolderFiles, downloadFile } = await import(`file://${driveServicePath}`);

const SCHOOLS_FILE = path.join(__dirname, '..', 'data', 'schools.json');
const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * Extract folder ID from Google Drive URL
 */
function extractFolderId(url) {
  if (!url) return null;
  
  // Format: https://drive.google.com/drive/folders/FOLDER_ID
  const match = url.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Get school PDF directory
 */
function getSchoolPdfDir(schoolId, dataDir) {
  return path.join(dataDir, 'schools', schoolId, 'pdfs');
}

/**
 * Main download function
 */
async function downloadAllSchoolPdfs() {
  console.log('📥 Downloading PDFs from All School Drive Folders');
  console.log('==================================================\n');

  // Load schools
  if (!fs.existsSync(SCHOOLS_FILE)) {
    console.error('❌ Schools file not found:', SCHOOLS_FILE);
    process.exit(1);
  }

  const schoolsContent = fs.readFileSync(SCHOOLS_FILE, 'utf8');
  const schools = JSON.parse(schoolsContent);

  console.log(`📚 Loaded ${schools.length} schools\n`);

  const apiKey = process.env.GOOGLE_API_KEY || null;
  if (apiKey) {
    console.log('✅ Using Google Drive API key\n');
  } else {
    console.log('⚠️  No API key found, using page parsing...\n');
  }

  const results = {
    total: 0,
    downloaded: 0,
    skipped: 0,
    errors: [],
    bySchool: {},
  };

  // Process each school
  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    const progress = `[${i + 1}/${schools.length}]`;

    console.log(`${progress} Processing: ${school.name} (${school.id})`);

    // Check if school has Drive link
    if (!school.driveLink) {
      console.log(`   ⚠️  No Drive link configured, skipping`);
      results.skipped++;
      results.bySchool[school.id] = { downloaded: 0, skipped: 1, errors: [] };
      continue;
    }

    // Extract folder ID
    const folderId = extractFolderId(school.driveLink);
    if (!folderId) {
      console.log(`   ❌ Invalid Drive URL format: ${school.driveLink}`);
      results.errors.push({
        school: school.name,
        error: 'Invalid Drive URL format',
      });
      results.bySchool[school.id] = { downloaded: 0, skipped: 0, errors: ['Invalid Drive URL format'] };
      continue;
    }

    try {
      // List files in folder
      const files = await listFolderFiles(folderId, apiKey);
      const pdfFiles = files.filter(f => f.name && f.name.toLowerCase().endsWith('.pdf'));

      console.log(`   📂 Found ${pdfFiles.length} PDF file(s)`);

      if (pdfFiles.length === 0) {
        console.log(`   ⚠️  No PDFs found in folder`);
        results.skipped++;
        results.bySchool[school.id] = { downloaded: 0, skipped: pdfFiles.length, errors: [] };
        continue;
      }

      // Create school PDF directory
      const pdfsDir = getSchoolPdfDir(school.id, DATA_DIR);
      if (!fs.existsSync(pdfsDir)) {
        fs.mkdirSync(pdfsDir, { recursive: true });
      }

      let schoolDownloaded = 0;
      let schoolErrors = [];

      // Download each PDF
      for (let j = 0; j < pdfFiles.length; j++) {
        const file = pdfFiles[j];
        const fileProgress = `   [${j + 1}/${pdfFiles.length}]`;

        try {
          // Check if file already exists
          const pdfPath = path.join(pdfsDir, file.name);
          if (fs.existsSync(pdfPath)) {
            console.log(`${fileProgress} ⏭️  Already exists: ${file.name}`);
            results.total++;
            continue;
          }

          // Download PDF
          console.log(`${fileProgress} ⬇️  Downloading: ${file.name}`);
          const { buffer, name } = await downloadFile(file.id, apiKey);

          // Save PDF
          fs.writeFileSync(pdfPath, buffer);
          console.log(`${fileProgress} ✅ Saved: ${name}`);
          
          schoolDownloaded++;
          results.downloaded++;
          results.total++;

          // Add small delay between downloads to avoid rate limiting
          if (j < pdfFiles.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`${fileProgress} ❌ Error: ${error.message}`);
          schoolErrors.push({ file: file.name, error: error.message });
          results.errors.push({
            school: school.name,
            file: file.name,
            error: error.message,
          });
        }
      }

      results.bySchool[school.id] = {
        downloaded: schoolDownloaded,
        skipped: pdfFiles.length - schoolDownloaded - schoolErrors.length,
        errors: schoolErrors,
      };

      console.log(`   ✅ Completed: ${schoolDownloaded} downloaded, ${schoolErrors.length} errors\n`);

      // Add delay between schools
      if (i < schools.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`   ❌ Error processing school: ${error.message}`);
      results.errors.push({
        school: school.name,
        error: error.message,
      });
      results.bySchool[school.id] = { downloaded: 0, skipped: 0, errors: [error.message] };
    }
  }

  // Print summary
  console.log('\n📊 Download Summary');
  console.log('==================================================');
  console.log(`Total PDFs processed: ${results.total}`);
  console.log(`✅ Downloaded: ${results.downloaded}`);
  console.log(`⏭️  Skipped (already exist): ${results.skipped}`);
  console.log(`❌ Errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log(`\n❌ Errors encountered:`);
    results.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.school}: ${err.file || ''} - ${err.error}`);
    });
    if (results.errors.length > 10) {
      console.log(`  ... and ${results.errors.length - 10} more errors`);
    }
  }

  console.log('\n✅ Download complete!');
}

// Run download
downloadAllSchoolPdfs().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

