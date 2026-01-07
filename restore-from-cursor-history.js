#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target time: 10pm Pacific on January 6th, 2026
// Create date string for 10pm Pacific on Jan 6, 2026: "2026-01-06T22:00:00-08:00" (PST)
const pacificTimeString = '2026-01-06T22:00:00-08:00';
const targetTime = new Date(pacificTimeString).getTime();
console.log(`Target time: ${new Date(targetTime).toISOString()} (10pm Pacific on January 6th, 2026)`);

const historyDir = path.join(process.env.HOME, 'Library/Application Support/Cursor/User/History');
const workspaceRoot = path.join(__dirname);

// Files to restore (relative to workspace root)
const filesToRestore = [
  'frontend/src/services/urlState.ts',
  'frontend/src/hooks/useUrlState.ts',
  'frontend/src/components/MapView.tsx',
  'frontend/src/pages/TechPage.tsx',
  'frontend/src/utils/markerIcons.ts'
].map(f => path.join(workspaceRoot, f));

// Function to find all entries.json files and restore files
function restoreFiles() {
  const restored = [];
  const skipped = [];
  const errors = [];

  // Get all history directories
  const historyDirs = fs.readdirSync(historyDir).filter(dir => {
    const dirPath = path.join(historyDir, dir);
    return fs.statSync(dirPath).isDirectory();
  });

  console.log(`Found ${historyDirs.length} history directories\n`);

  // Process each history directory
  for (const dir of historyDirs) {
    const dirPath = path.join(historyDir, dir);
    const entriesFile = path.join(dirPath, 'entries.json');

    if (!fs.existsSync(entriesFile)) {
      continue;
    }

    try {
      const entriesData = JSON.parse(fs.readFileSync(entriesFile, 'utf8'));
      
      if (!entriesData.resource) {
        continue;
      }

      // Extract the file path from the resource URI
      // Format: file:///Users/morganknutson/Desktop/pps-bus-maps/frontend/src/file.tsx
      const resourceUri = entriesData.resource;
      if (!resourceUri.startsWith('file://')) {
        continue;
      }

      // Remove file:// prefix and decode URI
      const filePath = decodeURIComponent(resourceUri.replace('file://', ''));
      
      // Check if file is in our workspace
      if (!filePath.startsWith(workspaceRoot)) {
        continue;
      }

      // Check if this is one of the files we want to restore
      if (!filesToRestore.includes(filePath)) {
        continue;
      }

      // Find the entry with the latest timestamp <= targetTime
      let latestEntry = null;
      let latestTimestamp = 0;

      if (entriesData.entries && Array.isArray(entriesData.entries)) {
        for (const entry of entriesData.entries) {
          const entryTime = entry.timestamp || 0;
          if (entryTime <= targetTime && entryTime > latestTimestamp) {
            latestTimestamp = entryTime;
            latestEntry = entry;
          }
        }
      }

      // If no entry found before target time, skip
      if (!latestEntry) {
        skipped.push({
          file: path.relative(workspaceRoot, filePath),
          reason: 'No version found before target time'
        });
        continue;
      }

      // Get the hashed filename
      const hashedFile = path.join(dirPath, latestEntry.id);
      if (!fs.existsSync(hashedFile)) {
        skipped.push({
          file: path.relative(workspaceRoot, filePath),
          reason: `Hashed file not found: ${latestEntry.id}`
        });
        continue;
      }

      // Read the content
      const content = fs.readFileSync(hashedFile, 'utf8');
      
      // Ensure directory exists
      const targetDir = path.dirname(filePath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Restore the file
      fs.writeFileSync(filePath, content, 'utf8');
      
      const entryTimeStr = new Date(latestTimestamp).toISOString();
      restored.push({
        file: path.relative(workspaceRoot, filePath),
        timestamp: entryTimeStr,
        hashedFile: latestEntry.id
      });

      console.log(`✅ Restored: ${path.relative(workspaceRoot, filePath)} (${entryTimeStr})`);

    } catch (error) {
      errors.push({
        dir,
        error: error.message
      });
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`✅ Restored: ${restored.length} files`);
  console.log(`⏭️  Skipped: ${skipped.length} files`);
  console.log(`❌ Errors: ${errors.length} directories`);

  if (skipped.length > 0) {
    console.log(`\n⏭️  Skipped files:`);
    skipped.forEach(s => console.log(`   - ${s.file}: ${s.reason}`));
  }

  if (errors.length > 0) {
    console.log(`\n❌ Errors:`);
    errors.forEach(e => console.log(`   - ${e.dir}: ${e.error}`));
  }

  return { restored, skipped, errors };
}

// Run the restoration
try {
  if (!fs.existsSync(historyDir)) {
    console.error(`History directory not found: ${historyDir}`);
    process.exit(1);
  }

  restoreFiles();
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}

