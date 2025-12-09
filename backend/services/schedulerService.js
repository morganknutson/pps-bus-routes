/**
 * Scheduler service for checking and updating routes from Google Drive
 * Runs daily at 2am when enabled
 */

import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { listFolderFiles, downloadFile } from './driveService.js';
import { parseRouteFromPDF } from './pdfParser.js';
import { geocodingService } from './geocodingService.js';
import { getSchoolIdFromFilename, getSchoolPdfDir } from '../utils/schoolUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Paths
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SCHEDULER_STATE_FILE = path.join(DATA_DIR, 'scheduler-state.json');

// Use require for pdf-parse (CommonJS module)
const pdfParse = require(path.join(__dirname, '..', 'node_modules', 'pdf-parse'));

const FOLDER_ID = '1BC03MH02DFuUL6teeq4jkcT2THRGgzxj';

// Scheduler state
let schedulerState = {
  enabled: false,
  lastRun: null,
  lastRunStatus: null,
  lastRunError: null,
  nextRun: null,
};

// Cron job instance
let cronJob = null;

/**
 * Load scheduler state from file
 */
function loadState() {
  try {
    if (fs.existsSync(SCHEDULER_STATE_FILE)) {
      const data = fs.readFileSync(SCHEDULER_STATE_FILE, 'utf8');
      schedulerState = { ...schedulerState, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Error loading scheduler state:', error);
  }
}

/**
 * Save scheduler state to file
 */
function saveState() {
  try {
    fs.writeFileSync(SCHEDULER_STATE_FILE, JSON.stringify(schedulerState, null, 2));
  } catch (error) {
    console.error('Error saving scheduler state:', error);
  }
}

/**
 * Geocode all stops for a route
 * Uses GeocodingService which handles Google Maps API with Nominatim fallback
 */
async function geocodeStops(stops, city = 'Portland', state = 'OR') {
  return await geocodingService.geocodeStops(stops, city, state);
}

/**
 * Check if a file needs to be updated by comparing with existing processed route
 */
function fileNeedsUpdate(driveFile, existingRoute) {
  if (!existingRoute) {
    return true; // New file
  }
  
  // Check if modified time is newer than processed time
  if (driveFile.modifiedTime) {
    const modifiedTime = new Date(driveFile.modifiedTime);
    const processedTime = new Date(existingRoute.processedAt);
    if (modifiedTime > processedTime) {
      return true; // File was modified after processing
    }
  }
  
  return false;
}

/**
 * Process a single PDF file
 */
async function processPDFFile(driveFile, apiKey) {
  try {
    // Download PDF
    const { buffer, name } = await downloadFile(driveFile.id, apiKey);
    
    // Determine school from filename
    const schoolId = getSchoolIdFromFilename(name);
    if (!schoolId) {
      return { success: false, error: `Could not determine school from filename: ${name}` };
    }
    
    // Get school-specific PDF directory
    const pdfsDir = getSchoolPdfDir(schoolId, DATA_DIR, path);
    if (!fs.existsSync(pdfsDir)) {
      fs.mkdirSync(pdfsDir, { recursive: true });
    }
    
    // Save PDF locally
    const pdfPath = path.join(pdfsDir, name);
    fs.writeFileSync(pdfPath, buffer);
    
    // Parse PDF
    const pdfData = await pdfParse(buffer);
    const route = parseRouteFromPDF(pdfData.text, driveFile.id, name);
    
    if (!route || route.stops.length === 0) {
      return { success: false, error: 'No stops found in PDF' };
    }
    
    // Geocode stops
    const geocodedStops = await geocodeStops(route.stops);
    
    // Create final route object
    const finalRoute = {
      id: route.id,
      name: route.name,
      filename: route.filename,
      stops: geocodedStops,
      processedAt: new Date().toISOString(),
      stats: {
        totalStops: geocodedStops.length,
        geocodedStops: geocodedStops.filter(s => s.coordinates).length,
        failedStops: geocodedStops.filter(s => !s.coordinates).length,
      },
    };
    
    // Save to school-specific processed-routes directory
    const processedRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
    if (!fs.existsSync(processedRoutesDir)) {
      fs.mkdirSync(processedRoutesDir, { recursive: true });
    }
    const outputFilename = name.replace('.pdf', '.json');
    const outputPath = path.join(processedRoutesDir, outputFilename);
    fs.writeFileSync(outputPath, JSON.stringify(finalRoute, null, 2));
    
    return { success: true, route: finalRoute };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Run the check: compare Drive files with existing processed routes
 */
async function runCheck() {
  console.log('[Scheduler] Starting daily check at', new Date().toISOString());
  
  schedulerState.lastRun = new Date().toISOString();
  schedulerState.lastRunStatus = 'running';
  schedulerState.lastRunError = null;
  saveState();
  
  try {
    const apiKey = process.env.GOOGLE_API_KEY || null;
    
    // List files from Drive
    const driveFiles = await listFolderFiles(FOLDER_ID, apiKey);
    console.log(`[Scheduler] Found ${driveFiles.length} files in Drive`);
    
    // Load existing processed routes from all school directories
    const existingRoutes = {};
    const schoolsDir = path.join(DATA_DIR, 'schools');
    if (fs.existsSync(schoolsDir)) {
      const schoolDirs = fs.readdirSync(schoolsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      for (const schoolId of schoolDirs) {
        const processedRoutesDir = path.join(schoolsDir, schoolId, 'processed-routes');
        if (fs.existsSync(processedRoutesDir)) {
          const files = fs.readdirSync(processedRoutesDir).filter(f => f.endsWith('.json'));
          for (const filename of files) {
            try {
              const filePath = path.join(processedRoutesDir, filename);
              const content = fs.readFileSync(filePath, 'utf8');
              const route = JSON.parse(content);
              existingRoutes[route.filename] = route;
            } catch (error) {
              console.error(`[Scheduler] Error loading route ${filename}:`, error);
            }
          }
        }
      }
    }
    
    // Check each file
    const results = {
      new: [],
      updated: [],
      unchanged: [],
      errors: [],
    };
    
    for (const driveFile of driveFiles) {
      const existingRoute = existingRoutes[driveFile.name];
      const shouldUpdate = fileNeedsUpdate(driveFile, existingRoute);
      
      if (shouldUpdate) {
        console.log(`[Scheduler] Processing ${driveFile.name}...`);
        const result = await processPDFFile(driveFile, apiKey);
        
        if (result.success) {
          if (existingRoute) {
            results.updated.push(driveFile.name);
          } else {
            results.new.push(driveFile.name);
          }
        } else {
          results.errors.push({ file: driveFile.name, error: result.error });
        }
      } else {
        results.unchanged.push(driveFile.name);
      }
    }
    
    schedulerState.lastRunStatus = 'success';
    schedulerState.lastRunError = null;
    
    console.log(`[Scheduler] Check complete:`);
    console.log(`  New: ${results.new.length}`);
    console.log(`  Updated: ${results.updated.length}`);
    console.log(`  Unchanged: ${results.unchanged.length}`);
    console.log(`  Errors: ${results.errors.length}`);
    
    saveState();
    
    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error('[Scheduler] Error during check:', error);
    schedulerState.lastRunStatus = 'error';
    schedulerState.lastRunError = error.message;
    saveState();
    
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Start the scheduler
 */
function startScheduler() {
  if (cronJob) {
    console.log('[Scheduler] Already running');
    return;
  }
  
  // Schedule for 2am daily
  cronJob = cron.schedule('0 2 * * *', async () => {
    if (schedulerState.enabled) {
      await runCheck();
    }
  }, {
    scheduled: false, // Don't start automatically
    timezone: 'America/Los_Angeles', // Adjust to your timezone
  });
  
  if (schedulerState.enabled) {
    cronJob.start();
    console.log('[Scheduler] Started - will run daily at 2am');
  }
}

/**
 * Stop the scheduler
 */
function stopScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[Scheduler] Stopped');
  }
}

/**
 * Get scheduler status
 */
function getStatus() {
  const status = { ...schedulerState };
  
  // Calculate next run time if enabled
  if (status.enabled && cronJob) {
    // Next run is tomorrow at 2am
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(2, 0, 0, 0);
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    status.nextRun = nextRun.toISOString();
  }
  
  return status;
}

/**
 * Toggle scheduler on/off
 */
function toggleScheduler(enabled) {
  schedulerState.enabled = enabled;
  saveState();
  
  if (enabled) {
    if (!cronJob) {
      startScheduler();
    } else {
      cronJob.start();
    }
    console.log('[Scheduler] Enabled');
  } else {
    stopScheduler();
    console.log('[Scheduler] Disabled');
  }
  
  return getStatus();
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
// School-specific directories are created on-demand in processPDFFile

// Initialize
loadState();
if (schedulerState.enabled) {
  startScheduler();
}

export {
  getStatus,
  toggleScheduler,
  runCheck,
  startScheduler,
  stopScheduler,
};

