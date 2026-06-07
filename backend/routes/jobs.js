/**
 * Job management API routes
 * Provides endpoints for managing and monitoring background jobs
 */

import express from 'express';
import { pdfSyncJobQueue } from '../services/jobQueue/index.js';
import { JOB_TYPES, JOB_STATUS } from '../services/jobQueue/jobTypes.js';
import { posthog, getDistinctId } from '../services/posthog.js';

const router = express.Router();

/**
 * Enqueue a new job
 * POST /api/jobs/enqueue
 */
router.post('/enqueue', async (req, res) => {
  try {
    const { jobType, data, options } = req.body;

    if (!jobType || !data) {
      return res.status(400).json({ error: 'jobType and data are required' });
    }

    // Validate job type
    if (!Object.values(JOB_TYPES).includes(jobType)) {
      return res.status(400).json({ error: `Invalid job type: ${jobType}` });
    }

    // For PDF_SYNC jobs, use the specialized method
    if (jobType === JOB_TYPES.PDF_SYNC) {
      if (!data.schoolId) {
        return res.status(400).json({ error: 'schoolId is required for PDF_SYNC jobs' });
      }
      const jobId = await pdfSyncJobQueue.enqueueSyncJob(data.schoolId, options || {});
      return res.json({ jobId, status: 'queued' });
    }

    // For other job types, use generic enqueue
    const jobId = await pdfSyncJobQueue.enqueue(jobType, data, options || {});
    res.json({ jobId, status: 'queued' });
  } catch (error) {
    console.error('Error enqueueing job:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * List jobs with filters
 * GET /api/jobs?jobType=&status=&limit=
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  console.log('[JobsRoute] GET /api/jobs - starting request');
  
  // CRITICAL: If Redis is not available, use a much shorter timeout
  // and return immediately from history
  const isRedisAvailable = pdfSyncJobQueue.isRedisAvailable;
  const timeoutDuration = isRedisAvailable ? 10000 : 2000; // 2 seconds for history-only
  
  // Add timeout to prevent hanging
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error(`[JobsRoute] Request timeout after ${timeoutDuration}ms`);
      res.status(504).json({ error: 'Request timeout - job queue may be unavailable or too many jobs' });
    }
  }, timeoutDuration);

  try {
    const { jobType, status, limit = 100 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 100, 500); // Cap at 500 to prevent abuse
    
    console.log(`[JobsRoute] Fetching jobs: jobType=${jobType || 'all'}, status=${status || 'all'}, limit=${limitNum}, Redis=${isRedisAvailable}`);
    
    // Wrap in Promise.race to ensure we don't hang
    const getJobsPromise = pdfSyncJobQueue.getJobs(
      jobType || null,
      status || null,
      limitNum
    );
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('getJobs timeout')), timeoutDuration - 100)
    );
    
    const jobs = await Promise.race([getJobsPromise, timeoutPromise]);
    
    clearTimeout(timeout);
    const duration = Date.now() - startTime;
    console.log(`[JobsRoute] Successfully returned ${jobs.length} jobs in ${duration}ms`);
    res.json({ jobs });
  } catch (error) {
    clearTimeout(timeout);
    const duration = Date.now() - startTime;
    console.error(`[JobsRoute] Error listing jobs after ${duration}ms:`, error.message);
    // Return empty array on error instead of 500, to prevent frontend issues
    res.json({ jobs: [] });
  }
});

/**
 * Get job statistics
 * GET /api/jobs/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await pdfSyncJobQueue.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting job stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get jobs for a specific school
 * GET /api/jobs/school/:schoolId
 */
router.get('/school/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { limit = 10 } = req.query;
    const jobs = await pdfSyncJobQueue.getJobsForSchool(schoolId, parseInt(limit));
    res.json({ jobs });
  } catch (error) {
    console.error('Error getting jobs for school:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get job status
 * GET /api/jobs/:jobId
 */
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await pdfSyncJobQueue.getJobStatus(jobId);

    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(status);
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cancel a job
 * POST /api/jobs/:jobId/cancel
 */
router.post('/:jobId/cancel', async (req, res) => {
  try {
    const { jobId } = req.params;
    const success = await pdfSyncJobQueue.cancelJob(jobId);

    if (!success) {
      return res.status(404).json({ error: 'Job not found or cannot be cancelled' });
    }

    posthog.capture({
      distinctId: getDistinctId(req),
      event: 'job_cancelled',
      properties: {
        job_id: jobId,
      },
    });
    res.json({ success: true, message: 'Job cancelled' });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Retry a failed job
 * POST /api/jobs/:jobId/retry
 */
router.post('/:jobId/retry', async (req, res) => {
  try {
    const { jobId } = req.params;
    const newJobId = await pdfSyncJobQueue.retryJob(jobId);
    res.json({ jobId: newJobId, message: 'Job retried' });
  } catch (error) {
    console.error('Error retrying job:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as jobsRouter };

