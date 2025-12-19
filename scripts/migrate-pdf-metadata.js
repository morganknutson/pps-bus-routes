/**
 * Migration script to generate metadata for existing PDF files
 * This matches existing local PDFs with Drive files by filename to create metadata
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { listFolderFiles } from '../backend/services/driveService.js';
import { pdfMetadataService } from '../backend/services/pdfMetadataService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
const require = createRequire(import.meta.url);
const backendDir = path.join(__dirname, '..', 'backend');
const dotenv = require(path.join(backendDir, 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');

async function migratePdfMetadata() {
  console.log('🔄 Migrating PDF Metadata for Existing Files');
  console.log('============================================\n');

  try {
    // Load schools
    if (!fs.existsSync(SCHOOLS_FILE)) {
      throw new Error('Schools file not found');
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);

    const schoolsWithDriveLinks = schools.filter(s => s.driveLink);
    console.log(`Found ${schoolsWithDriveLinks.length} schools with Drive links\n`);

    let totalMatched = 0;
    let totalUnmatched = 0;
    let totalSkipped = 0;

    for (const school of schoolsWithDriveLinks) {
      try {
        console.log(`Processing ${school.name} (${school.id})...`);

        // Extract folder ID
        const folderIdMatch = school.driveLink.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/);
        if (!folderIdMatch) {
          console.log(`  ⚠️  Invalid Drive link format, skipping\n`);
          totalSkipped++;
          continue;
        }

        const folderId = folderIdMatch[1];
        const pdfDir = path.join(DATA_DIR, 'schools', school.id, 'pdfs');

        if (!fs.existsSync(pdfDir)) {
          console.log(`  ⚠️  No PDF directory found, skipping\n`);
          totalSkipped++;
          continue;
        }

        // Get local PDF files
        const localPdfFiles = fs.readdirSync(pdfDir)
          .filter(f => f.endsWith('.pdf'));

        if (localPdfFiles.length === 0) {
          console.log(`  ⚠️  No PDF files found, skipping\n`);
          totalSkipped++;
          continue;
        }

        // Check if metadata already exists
        // If we have an API key, re-migrate to get accurate timestamps
        const existingMetadata = pdfMetadataService.loadMetadata(school.id);
        const hasApiKey = !!process.env.GOOGLE_API_KEY;
        const hasExistingMetadata = existingMetadata.files && Object.keys(existingMetadata.files).length > 0;
        
        if (hasExistingMetadata && !hasApiKey) {
          console.log(`  ✓ Metadata already exists (${Object.keys(existingMetadata.files).length} files), skipping\n`);
          console.log(`  ⚠️  Note: Re-run with GOOGLE_API_KEY to get accurate timestamps\n`);
          totalSkipped++;
          continue;
        }
        
        if (hasExistingMetadata && hasApiKey) {
          console.log(`  🔄 Re-migrating with API key to get accurate timestamps (${Object.keys(existingMetadata.files).length} files)...`);
        }

        // Fetch Drive files
        const apiKey = process.env.GOOGLE_API_KEY || null;
        if (apiKey) {
          console.log(`  ✅ Using Google Drive API key`);
        } else {
          console.log(`  ⚠️  No API key found, using page parsing (timestamps may be inaccurate)`);
        }
        const driveFiles = await listFolderFiles(folderId, apiKey);
        const drivePdfFiles = driveFiles.filter(f => f.name && f.name.toLowerCase().endsWith('.pdf'));

        if (drivePdfFiles.length === 0) {
          console.log(`  ⚠️  No PDF files found in Drive, skipping\n`);
          totalSkipped++;
          continue;
        }

        // Create a map of Drive files by filename (case-insensitive)
        const driveFileMap = new Map();
        drivePdfFiles.forEach(file => {
          if (file.id && file.name && file.modifiedTime) {
            const key = file.name.toLowerCase();
            driveFileMap.set(key, file);
          }
        });

        // Match local files with Drive files
        const metadata = { files: {} };
        let matched = 0;
        let unmatched = 0;

        for (const localFile of localPdfFiles) {
          const key = localFile.toLowerCase();
          const driveFile = driveFileMap.get(key);

          if (driveFile && driveFile.id && driveFile.modifiedTime) {
            // Match found - add to metadata
            metadata.files[driveFile.id] = {
              filename: driveFile.name,
              modifiedTime: driveFile.modifiedTime,
              localPath: localFile,
            };
            matched++;
            totalMatched++;
          } else {
            console.log(`  ⚠️  No Drive match for ${localFile}`);
            unmatched++;
            totalUnmatched++;
          }
        }

        // Save metadata
        if (Object.keys(metadata.files).length > 0) {
          pdfMetadataService.saveMetadata(school.id, {
            files: metadata.files,
            lastSync: new Date().toISOString(),
          });
          console.log(`  ✅ Created metadata for ${matched} file(s)`);
          if (unmatched > 0) {
            console.log(`  ⚠️  ${unmatched} file(s) could not be matched`);
          }
        } else {
          console.log(`  ⚠️  No files matched, metadata not created`);
        }

        console.log('');

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ❌ Error processing ${school.name}: ${error.message}\n`);
      }
    }

    console.log('============================================');
    console.log('✅ Migration Complete!');
    console.log(`📊 Summary:`);
    console.log(`   Matched: ${totalMatched} file(s)`);
    console.log(`   Unmatched: ${totalUnmatched} file(s)`);
    console.log(`   Skipped: ${totalSkipped} school(s)`);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the migration
migratePdfMetadata();

