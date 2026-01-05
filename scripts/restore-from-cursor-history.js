#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Target: 10:58am Pacific TODAY (Jan 5th, 2026)
const TARGET_HOUR = 10;
const TARGET_MINUTE = 58;

// Get today's date components in Pacific timezone
const now = new Date();
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const parts = formatter.formatToParts(now);
const year = parts.find(p => p.type === 'year').value;
const month = parts.find(p => p.type === 'month').value;
const day = parts.find(p => p.type === 'day').value;

// Find the UTC time that equals TARGET_HOUR:TARGET_MINUTE Pacific today
let target = new Date(`${year}-${month}-${day}T18:00:00Z`); // Start with a safe UTC approximation

// Adjust iteratively to get exact Pacific time
for (let i = 0; i < 10; i++) {
  const options = { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: false };
  const pacificTime = target.toLocaleString('en-US', options);
  const [h, m] = pacificTime.split(':').map(Number);
  
  if (h === TARGET_HOUR && m === TARGET_MINUTE) break;
  
  const diffHours = TARGET_HOUR - h;
  const diffMinutes = TARGET_MINUTE - m;
  const adjustmentMs = (diffHours * 3600000) + (diffMinutes * 60000);
  target = new Date(target.getTime() + adjustmentMs);
}

const cutoffMs = target.getTime();

console.log(`Target Pacific Time: ${TARGET_HOUR}:${TARGET_MINUTE}`);
console.log(`Cutoff UTC Time: ${target.toISOString()}`);
console.log(`Cutoff timestamp (ms): ${cutoffMs}`);

const historyDir = join(process.env.HOME, 'Library/Application Support/Cursor/User/History');
const workspacePath = '/Users/morganknutson/Desktop/pps-bus-maps';

// Find all entries.json files
function findEntriesFiles(dir) {
  const entries = [];
  try {
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          entries.push(...findEntriesFiles(fullPath));
        } else if (item === 'entries.json') {
          entries.push(fullPath);
        }
      } catch (e) {
        // Skip if can't access
      }
    }
  } catch (e) {
    // Skip if can't access
  }
  return entries;
}

console.log('Finding history entries...');
const entriesFiles = findEntriesFiles(historyDir);
console.log(`Found ${entriesFiles.length} entries.json files`);

// Process each entries.json file
const fileRestorations = new Map(); // file path -> { entryId, timestamp, historyDir }

for (const entriesFile of entriesFiles) {
  try {
    const content = readFileSync(entriesFile, 'utf8');
    const data = JSON.parse(content);
    
    if (!data.resource || !data.resource.startsWith('file://')) continue;
    
    const filePath = data.resource.replace('file://', '');
    
    // Only process files in our workspace
    if (!filePath.startsWith(workspacePath)) continue;
    
    // Find the latest NON-EMPTY entry before cutoff
    let latestEntry = null;
    let latestTimestamp = 0;
    
    // Sort entries by timestamp descending to find the latest ones first
    const sortedEntries = (data.entries || []).sort((a, b) => b.timestamp - a.timestamp);
    
    for (const entry of sortedEntries) {
      const timestamp = entry.timestamp || 0;
      if (timestamp < cutoffMs) {
        const historyDirPath = dirname(entriesFile);
        const historyFile = join(historyDirPath, entry.id);
        
        try {
          if (existsSync(historyFile)) {
            const stat = statSync(historyFile);
            // If the file is very small (< 15 bytes), we double-check if it's truly "empty" 
            // compared to previous versions or just a small file.
            // For this specific issue, we'll skip files smaller than 15 bytes to avoid 
            // the "empty file" restoration bug.
            if (stat.size > 15) { 
              latestTimestamp = timestamp;
              latestEntry = entry;
              break; 
            }
          }
        } catch (e) {
          // Skip if can't access
        }
      }
    }
    
    if (latestEntry && latestEntry.id) {
      const historyDirPath = dirname(entriesFile);
      const existing = fileRestorations.get(filePath);
      
      // Keep the latest restoration if multiple history dirs have entries
      if (!existing || latestTimestamp > existing.timestamp) {
        fileRestorations.set(filePath, {
          entryId: latestEntry.id,
          timestamp: latestTimestamp,
          historyDir: historyDirPath,
          relativePath: filePath.replace(workspacePath + '/', '')
        });
      }
    }
  } catch (e) {
    // Skip invalid entries
  }
}

console.log(`\nFound ${fileRestorations.size} files to restore`);

// Restore each file
let restored = 0;
let failed = 0;
const failures = [];

for (const [filePath, info] of fileRestorations.entries()) {
  try {
    const historyFile = join(info.historyDir, info.entryId);
    
    if (!existsSync(historyFile)) {
      console.log(`⚠️  History file not found: ${historyFile}`);
      failed++;
      failures.push({ file: info.relativePath, reason: 'History file not found' });
      continue;
    }
    
    const content = readFileSync(historyFile, 'utf8');
    
    // Ensure directory exists
    const targetDir = dirname(filePath);
    if (!existsSync(targetDir)) {
      // This shouldn't happen, but handle it
      console.log(`⚠️  Target directory doesn't exist: ${targetDir}`);
      failed++;
      failures.push({ file: info.relativePath, reason: 'Target directory missing' });
      continue;
    }
    
    // Write the restored content
    writeFileSync(filePath, content, 'utf8');
    
    const date = new Date(info.timestamp);
    console.log(`✅ Restored: ${info.relativePath} (from ${date.toISOString()})`);
    restored++;
  } catch (e) {
    console.error(`❌ Failed to restore ${info.relativePath}: ${e.message}`);
    failed++;
    failures.push({ file: info.relativePath, reason: f.message });
  }
}

console.log(`\n=== Summary ===`);
console.log(`Restored: ${restored}`);
console.log(`Failed: ${failed}`);

if (failures.length > 0) {
  console.log(`\nFailures:`);
  failures.forEach(f => console.log(`  - ${f.file}: ${f.reason}`));
}
