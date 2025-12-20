/**
 * Update existing PDF files' timestamps to match their Drive modifiedTime
 * This fixes files that were downloaded before we started preserving Drive timestamps
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listFolderFiles } from '../backend/services/driveService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');

async function updatePdfTimestamps() {
  console.log('🔄 Updating PDF File Timestamps to Match Drive modifiedTime');
  console.log('==========================================================\n');

  try {
    // Load schools
    if (!fs.existsSync(SCHOOLS_FILE)) {
      throw new Error('Schools file not found');
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);

    const schoolsWithDriveLinks = schools.filter(s => s.driveLink);
    console.log(`Found ${schoolsWithDriveLinks.length} schools with Drive links\n`);

    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

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
          .filter(f => f.endsWith('.pdf'))
          .map(f => ({
            name: f,
            path: path.join(pdfDir, f),
          }));

        if (localPdfFiles.length === 0) {
          console.log(`  ⚠️  No PDF files found, skipping\n`);
          totalSkipped++;
          continue;
        }

        // Fetch Drive files
        const apiKey = process.env.GOOGLE_API_KEY || null;
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
          const key = (file.name || '').toLowerCase();
          if (key && file.modifiedTime) {
            driveFileMap.set(key, file);
          }
        });

        // Update local files' timestamps
        let schoolUpdated = 0;
        for (const localFile of localPdfFiles) {
          const key = localFile.name.toLowerCase();
          const driveFile = driveFileMap.get(key);

          if (!driveFile || !driveFile.modifiedTime) {
            console.log(`  ⚠️  No Drive match for ${localFile.name}, skipping`);
            continue;
          }

          try {
            const driveModifiedTime = new Date(driveFile.modifiedTime);
            const stats = fs.statSync(localFile.path);
            const currentMtime = stats.mtime;

            // Only update if timestamps don't match (within 1 second tolerance)
            const timeDiff = Math.abs(driveModifiedTime.getTime() - currentMtime.getTime());
            if (timeDiff > 1000) {
              fs.utimesSync(localFile.path, driveModifiedTime, driveModifiedTime);
              console.log(`  ✅ Updated ${localFile.name}: ${currentMtime.toISOString()} → ${driveModifiedTime.toISOString()}`);
              schoolUpdated++;
              totalUpdated++;
            } else {
              console.log(`  ✓ ${localFile.name} already has correct timestamp`);
            }
          } catch (error) {
            console.error(`  ❌ Error updating ${localFile.name}: ${error.message}`);
            totalErrors++;
          }
        }

        if (schoolUpdated > 0) {
          console.log(`  📊 Updated ${schoolUpdated} file(s) for ${school.name}\n`);
        } else {
          console.log(`  ✓ All timestamps up to date for ${school.name}\n`);
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ❌ Error processing ${school.name}: ${error.message}\n`);
        totalErrors++;
      }
    }

    console.log('==========================================================');
    console.log('✅ Update Complete!');
    console.log(`📊 Summary:`);
    console.log(`   Updated: ${totalUpdated} file(s)`);
    console.log(`   Skipped: ${totalSkipped} school(s)`);
    console.log(`   Errors: ${totalErrors} file(s)`);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the update
updatePdfTimestamps();





