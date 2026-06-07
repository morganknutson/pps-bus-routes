import express from 'express';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pdfSyncJobQueue } from '../services/jobQueue/index.js';
import { JOB_PRIORITY } from '../services/jobQueue/jobTypes.js';
import { posthog, getDistinctId } from '../services/posthog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const SYNC_STATUS_FILE = path.join(DATA_DIR, 'pdf-sync-status.json');

/**
 * Load sync status
 */
async function loadSyncStatus() {
  if (fs.existsSync(SYNC_STATUS_FILE)) {
    try {
      return JSON.parse(await fsPromises.readFile(SYNC_STATUS_FILE, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

/**
 * Save sync status
 */
async function saveSyncStatus(status) {
  const tempFile = `${SYNC_STATUS_FILE}.tmp`;
  await fsPromises.writeFile(tempFile, JSON.stringify(status, null, 2), 'utf8');
  await fsPromises.rename(tempFile, SYNC_STATUS_FILE);
}

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
function getSchoolPdfDir(schoolId) {
  return path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
}

/**
 * Get existing PDF files for a school
 */
async function getExistingPdfs(schoolId) {
  const pdfDir = getSchoolPdfDir(schoolId);
  if (!fs.existsSync(pdfDir)) {
    await fsPromises.mkdir(pdfDir, { recursive: true });
    return [];
  }
  return (await fsPromises.readdir(pdfDir)).filter(f => f.endsWith('.pdf'));
}

/**
 * Fetch PDFs for a school (enqueues a background job)
 */
router.post('/fetch/:schoolId', async (req, res) => {
  // Set a timeout for the entire request
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Request timeout - job may still be queued, please check job status' });
    }
  }, 8000); // 8 second timeout

  try {
    const { schoolId } = req.params;

    // Load schools to validate
    const schools = JSON.parse(await fsPromises.readFile(SCHOOLS_FILE, 'utf8'));
    const school = schools.find(s => s.id === schoolId);

    if (!school) {
      clearTimeout(timeout);
      return res.status(404).json({ error: 'School not found' });
    }

    if (!school.driveLink) {
      clearTimeout(timeout);
      return res.status(400).json({ error: 'School has no Drive link configured' });
    }

    // Check if there's already an active job for this school (with timeout)
    let existingJobs = [];
    try {
      const checkPromise = pdfSyncJobQueue.getJobsForSchool(schoolId, 5);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout checking for existing jobs')), 3000)
      );
      existingJobs = await Promise.race([checkPromise, timeoutPromise]);
    } catch (error) {
      console.warn(`[pdfSync] Timeout or error checking for existing jobs for ${schoolId}, proceeding anyway:`, error.message);
      // Continue anyway - worst case we'll have duplicate jobs
    }

    const hasActiveJob = existingJobs.some(
      job => job.status === 'waiting' || job.status === 'active'
    );

    if (hasActiveJob) {
      clearTimeout(timeout);
      return res.status(409).json({ 
        error: 'A job for this school is already queued or running',
        existingJob: existingJobs.find(job => job.status === 'waiting' || job.status === 'active'),
      });
    }

    // Enqueue the job with high priority (manual user request)
    // Add timeout to enqueue call as safety net
    let jobId;
    try {
      const enqueuePromise = pdfSyncJobQueue.enqueueSyncJob(schoolId, {
        priority: JOB_PRIORITY.HIGH,
        attempts: 3,
      });
      const enqueueTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout enqueueing job')), 5000)
      );
      jobId = await Promise.race([enqueuePromise, enqueueTimeout]);
    } catch (error) {
      clearTimeout(timeout);
      console.error(`[pdfSync] Error enqueueing job for ${schoolId}:`, error);
      if (!res.headersSent) {
        return res.status(500).json({ error: `Failed to enqueue job: ${error.message}` });
      }
      return;
    }

    clearTimeout(timeout);
    posthog.capture({
      distinctId: getDistinctId(req),
      event: 'pdf_sync_queued',
      properties: {
        school_id: schoolId,
        job_id: jobId,
      },
    });
    res.json({
      jobId,
      schoolId,
      status: 'queued',
      message: 'PDF sync job has been queued',
    });
  } catch (error) {
    clearTimeout(timeout);
    console.error('Error enqueueing PDF sync job:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * Get sync status for a school
 */
router.get('/status/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;
    const syncStatus = await loadSyncStatus();
    res.json(syncStatus[schoolId] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all sync status
 */
router.get('/status', async (req, res) => {
  try {
    const syncStatus = await loadSyncStatus();
    res.json(syncStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as pdfSyncRouter };
