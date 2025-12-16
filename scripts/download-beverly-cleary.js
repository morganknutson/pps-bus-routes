/**
 * Download PDFs for Beverly Cleary school only
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import backend services
const backendDir = path.join(__dirname, '..', 'backend');
const require = createRequire(import.meta.url);

// Load environment variables from backend/.env
const dotenv = require(path.join(backendDir, 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const driveServicePath = path.join(backendDir, 'services', 'driveService.js');
const { listFolderFiles, downloadFile } = await import(`file://${driveServicePath}`);

const SCHOOLS_FILE = path.join(__dirname, '..', 'data', 'schools.json');
const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * Extract folder ID from Google Drive URL
 */
function extractFolderId(url) {
  if (!url) return null;
  const match = url.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Get school PDF directory
 */
function getSchoolPdfDir(schoolId, dataDir) {
  return path.join(dataDir, 'schools', schoolId, 'pdfs');
}

async function downloadBeverlyCleary() {
  console.log('📥 Downloading PDFs for Beverly Cleary');
  console.log('==================================================\n');

  // Load schools
  if (!fs.existsSync(SCHOOLS_FILE)) {
    console.error('❌ Schools file not found:', SCHOOLS_FILE);
    process.exit(1);
  }

  const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
  const school = schools.find(s => s.id === 'beverly-cleary');

  if (!school) {
    console.error('❌ Beverly Cleary school not found');
    process.exit(1);
  }

  console.log(`📚 School: ${school.name} (${school.id})\n`);

  if (!school.driveLink) {
    console.error('❌ No Drive link configured for Beverly Cleary');
    process.exit(1);
  }

  const apiKey = process.env.GOOGLE_API_KEY || null;
  if (apiKey) {
    console.log('✅ Using Google Drive API key\n');
  } else {
    console.log('⚠️  No API key found, using page parsing...\n');
  }

  // Extract folder ID
  const folderId = extractFolderId(school.driveLink);
  if (!folderId) {
    console.error(`❌ Invalid Drive URL format: ${school.driveLink}`);
    process.exit(1);
  }

  try {
    // List files in folder
    console.log('📂 Fetching PDF list from Google Drive...');
    const files = await listFolderFiles(folderId, apiKey);
    const pdfFiles = files.filter(f => f.name && f.name.toLowerCase().endsWith('.pdf'));

    console.log(`✅ Found ${pdfFiles.length} PDF file(s)\n`);

    if (pdfFiles.length === 0) {
      console.log('⚠️  No PDFs found in folder');
      process.exit(0);
    }

    // Create school PDF directory
    const pdfsDir = getSchoolPdfDir(school.id, DATA_DIR);
    if (!fs.existsSync(pdfsDir)) {
      fs.mkdirSync(pdfsDir, { recursive: true });
    }

    let downloaded = 0;
    let skipped = 0;
    const errors = [];

    // Download each PDF
    for (let j = 0; j < pdfFiles.length; j++) {
      const file = pdfFiles[j];
      const fileProgress = `[${j + 1}/${pdfFiles.length}]`;

      try {
        // Check if file already exists
        const pdfPath = path.join(pdfsDir, file.name);
        if (fs.existsSync(pdfPath)) {
          // Delete existing file to force re-download
          console.log(`${fileProgress} 🗑️  Removing existing: ${file.name}`);
          fs.unlinkSync(pdfPath);
        }

        // Download PDF
        console.log(`${fileProgress} ⬇️  Downloading: ${file.name}`);
        const { buffer, name } = await downloadFile(file.id, apiKey);

        // Save PDF
        fs.writeFileSync(pdfPath, buffer);
        console.log(`${fileProgress} ✅ Saved: ${name} (${buffer.length} bytes)`);
        
        downloaded++;

        // Add small delay between downloads to avoid rate limiting
        if (j < pdfFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`${fileProgress} ❌ Error: ${error.message}`);
        errors.push({ file: file.name, error: error.message });
      }
    }

    // Print summary
    console.log('\n📊 Download Summary');
    console.log('==================================================');
    console.log(`✅ Downloaded: ${downloaded}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      errors.forEach(err => {
        console.log(`  - ${err.file}: ${err.error}`);
      });
    }

    console.log('\n✅ Download complete!');
  } catch (error) {
    console.error(`❌ Error processing school: ${error.message}`);
    process.exit(1);
  }
}

// Run download
downloadBeverlyCleary().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

