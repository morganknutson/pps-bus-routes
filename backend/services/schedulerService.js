/**
 * @fileoverview Scheduler Service for Automated PDF Synchronization
 * 
 * This module provides automated daily synchronization of bus route PDFs
 * from Google Drive. When enabled, it runs at 2am Pacific Time daily,
 * checking all schools with Drive links for new or updated PDFs.
 * 
 * Key features:
 * - Cron-based scheduling (daily at 2am)
 * - Persistent state tracking (enabled/disabled, last run, errors)
 * - Integration with job queue for asynchronous processing
 * - Manual trigger capability for on-demand sync
 * 
 * @module services/schedulerService
 * @requires node-cron
 * @requires fs
 * @requires ./driveService.js
 * @requires ./jobQueue/index.js
 * @requires ./routeProcessor.js
 * 
 * @example
 * // Enable scheduler
 * import { toggleScheduler } from './schedulerService.js';
 * toggleScheduler(true);
 * 
 * @example
 * // Check status
 * import { getStatus } from './schedulerService.js';
 * console.log(getStatus());
 * // { enabled: true, lastRun: '2024-01-01T10:00:00Z', nextRun: '2024-01-02T10:00:00Z' }
 * 
 * @example
 * // Manual trigger
 * import { runCheck } from './schedulerService.js';
 * await runCheck();
 */

import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { listFolderFiles, downloadFile } from './driveService.js';
import { getSchoolIdFromFilename, getSchoolPdfDir } from '../utils/schoolUtils.js';
import { pdfSyncJobQueue } from './jobQueue/index.js';
import { JOB_PRIORITY } from './jobQueue/jobTypes.js';
import { processSinglePDF } from './routeProcessor.js';
import { runWeeklySync, getSyncState } from './weeklySyncService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Paths
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SCHEDULER_STATE_FILE = path.join(DATA_DIR, 'scheduler-state.json');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');

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

    // Process PDF using shared processor
    const finalRoute = await processSinglePDF(buffer, name, driveFile.id, {
      logPrefix: '[Scheduler]',
      saveToFile: true,
    });

    // Add Drive-specific metadata
    finalRoute.fileId = driveFile.id;
    finalRoute.modifiedTime = driveFile.modifiedTime || null;

    // Re-save with updated metadata
    const processedRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
    const outputFilename = name.replace('.pdf', '.json');
    const outputPath = path.join(processedRoutesDir, outputFilename);
    fs.writeFileSync(outputPath, JSON.stringify(finalRoute, null, 2));

    return { success: true, route: finalRoute };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Run the weekly sync check using the orchestrated workflow
 */
async function runCheck() {
  console.log('[Scheduler] Starting weekly sync at', new Date().toISOString());

  schedulerState.lastRun = new Date().toISOString();
  schedulerState.lastRunStatus = 'running';
  schedulerState.lastRunError = null;
  saveState();

  try {
    // Run the full weekly sync workflow
    const results = await runWeeklySync();

    schedulerState.lastRunStatus = results.errorCount > 0 ? 'completed_with_errors' : 'success';
    schedulerState.lastRunError = results.errorCount > 0 ? `${results.errorCount} errors occurred` : null;

    console.log(`[Scheduler] Weekly sync completed: ${results.schoolsChecked} schools checked, ${results.pdfsDownloaded} PDFs downloaded, ${results.routesProcessed} routes processed`);

    saveState();

    return {
      success: results.errorCount === 0,
      results,
    };
  } catch (error) {
    console.error('[Scheduler] Error during weekly sync:', error);
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

  // In development, require ENABLE_SCHEDULER=true
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_SCHEDULER !== 'true') {
    console.log('[Scheduler] 🚫 Scheduler is DISABLED in development (use ENABLE_SCHEDULER=true to enable)');
    return;
  }

  // In production, require ENABLE_WEEKLY_SYNC=true
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_WEEKLY_SYNC !== 'true') {
    console.log('[Scheduler] 🚫 Scheduler is DISABLED in production (use ENABLE_WEEKLY_SYNC=true to enable)');
    return;
  }

  // Schedule for 2am Sunday (weekly)
  cronJob = cron.schedule('0 2 * * 0', async () => {
    if (schedulerState.enabled) {
      await runCheck();
    }
  }, {
    scheduled: false, // Don't start automatically
    timezone: 'America/Los_Angeles', // Pacific Time
  });

  if (schedulerState.enabled) {
    cronJob.start();
    console.log('[Scheduler] Started - will run weekly on Sunday at 2am Pacific');
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
