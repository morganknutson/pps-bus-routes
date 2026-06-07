/**
 * Job queue service exports
 * Creates singleton instances for use throughout the application
 */

import { PdfSyncJobQueue } from './PdfSyncJobQueue.js';
import { WorkerService } from './WorkerService.js';
import { jobHistoryService } from './JobHistoryService.js';

// Create singleton instances
export const pdfSyncJobQueue = new PdfSyncJobQueue({
  attempts: parseInt(process.env.JOB_RETRY_ATTEMPTS) || 3,
  retryDelay: parseInt(process.env.JOB_RETRY_DELAY) || 5000,
  historyRetentionDays: parseInt(process.env.JOB_HISTORY_RETENTION_DAYS) || 30,
  failedRetentionDays: parseInt(process.env.JOB_FAILED_RETENTION_DAYS) || 7,
});

export const workerService = new WorkerService(pdfSyncJobQueue, {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 2,
});

// Export types and classes for advanced usage
export { PdfSyncJobQueue } from './PdfSyncJobQueue.js';
export { JobQueue } from './JobQueue.js';
export { BaseJobQueue } from './BaseJobQueue.js';
export { WorkerService } from './WorkerService.js';
export { JobHistoryService, jobHistoryService } from './JobHistoryService.js';
export { JOB_TYPES, JOB_STATUS, JOB_PRIORITY } from './jobTypes.js';

// Clean up old jobs periodically (every 24 hours)
const cleanupInterval = setInterval(() => {
  jobHistoryService.cleanup(30); // Keep 30 days of history
}, 24 * 60 * 60 * 1000); // 24 hours
cleanupInterval.unref?.();
