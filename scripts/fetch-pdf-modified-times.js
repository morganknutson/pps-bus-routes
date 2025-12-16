/**
 * Script to fetch PDF modified times from Google Drive
 * Updates processed route JSON files with modifiedTime from Drive
 * 
 * Usage: node scripts/fetch-pdf-modified-times.js [folderId]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const API_BASE = 'https://www.googleapis.com/drive/v3';
const FOLDER_ID = process.argv[2] || '1BC03MH02DFuUL6teeq4jkcT2THRGgzxj';
const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_DIR = path.join(DATA_DIR, 'schools');

/**
 * List all files from Drive folder with metadata
 */
async function listDriveFiles(folderId, apiKey) {
  if (!apiKey) {
    return [];
  }

  try {
    const url = `${API_BASE}/files?q='${folderId}'+in+parents+and+mimeType='application/pdf'&fields=files(id,name,modifiedTime)&orderBy=name&key=${apiKey}`;
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      return data.files || [];
    }
  } catch (error) {
    console.error(`Error listing Drive files:`, error.message);
  }
  
  return [];
}

/**
 * Get file metadata from Drive API (including modifiedTime)
 */
async function getFileMetadata(fileId, apiKey) {
  if (!apiKey) {
    return null;
  }

  try {
    const url = `${API_BASE}/files/${fileId}?fields=id,name,modifiedTime&key=${apiKey}`;
    const response = await fetch(url);
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error(`Error fetching metadata for ${fileId}:`, error.message);
  }
  
  return null;
}

/**
 * Find all processed route JSON files and update them with modifiedTime
 */
async function updateModifiedTimes() {
  console.log('📅 Fetching PDF Modified Times');
  console.log('================================\n');

  const apiKey = process.env.GOOGLE_API_KEY || null;
  if (!apiKey) {
    console.log('⚠️  No GOOGLE_API_KEY found in .env');
    console.log('   Modified times can only be fetched with an API key.\n');
    return;
  }

  if (!fs.existsSync(SCHOOLS_DIR)) {
    console.log('❌ Schools directory not found:', SCHOOLS_DIR);
    return;
  }

  // Step 1: Fetch all files from Drive to build a filename -> metadata map
  console.log('📂 Fetching file list from Google Drive...');
  const driveFiles = await listDriveFiles(FOLDER_ID, apiKey);
  console.log(`✅ Found ${driveFiles.length} files in Drive\n`);

  // Create a map of filename -> { id, modifiedTime }
  const driveFileMap = new Map();
  for (const file of driveFiles) {
    driveFileMap.set(file.name, {
      id: file.id,
      modifiedTime: file.modifiedTime,
    });
  }

  const schoolDirs = fs.readdirSync(SCHOOLS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  console.log(`Found ${schoolDirs.length} school directories\n`);

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalNotFound = 0;

  for (const schoolId of schoolDirs) {
    const processedRoutesDir = path.join(SCHOOLS_DIR, schoolId, 'processed-routes');
    
    if (!fs.existsSync(processedRoutesDir)) {
      continue;
    }

    const routeFiles = fs.readdirSync(processedRoutesDir).filter(f => f.endsWith('.json'));
    
    if (routeFiles.length === 0) {
      continue;
    }

    console.log(`\n📚 ${schoolId} (${routeFiles.length} routes)`);

    for (const filename of routeFiles) {
      const filePath = path.join(processedRoutesDir, filename);
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const route = JSON.parse(content);

        // Skip if already has modifiedTime and fileId
        if (route.modifiedTime && route.fileId) {
          totalSkipped++;
          continue;
        }

        // Get filename from route (should match PDF filename)
        const routeFilename = route.filename || filename.replace('.json', '.pdf');
        
        // Try to find matching file in Drive by filename
        const driveFile = driveFileMap.get(routeFilename);
        
        if (!driveFile) {
          console.log(`   ⚠️  ${filename}: No matching file in Drive (looking for: ${routeFilename})`);
          totalNotFound++;
          continue;
        }

        // Update route with fileId and modifiedTime
        route.fileId = driveFile.id;
        route.modifiedTime = driveFile.modifiedTime;
        
        fs.writeFileSync(filePath, JSON.stringify(route, null, 2));
        console.log(`   ✅ ${filename}: Updated (fileId: ${driveFile.id.substring(0, 8)}..., modifiedTime: ${driveFile.modifiedTime})`);
        totalUpdated++;

      } catch (error) {
        console.error(`   ❌ ${filename}: Error - ${error.message}`);
        totalErrors++;
      }
    }
  }

  console.log('\n================================');
  console.log(`✅ Updated: ${totalUpdated}`);
  console.log(`⏭️  Skipped (already have data): ${totalSkipped}`);
  console.log(`⚠️  Not found in Drive: ${totalNotFound}`);
  console.log(`❌ Errors: ${totalErrors}`);
  console.log('================================\n');
}

// Run the script
updateModifiedTimes().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});




