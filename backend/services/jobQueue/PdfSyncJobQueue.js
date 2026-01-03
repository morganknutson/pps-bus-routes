/**
 * Specialized job queue for PDF sync operations
 * Extends JobQueue with PDF-specific methods
 */

import { JobQueue } from './JobQueue.js';
import { JOB_TYPES, JOB_PRIORITY } from './jobTypes.js';

export class PdfSyncJobQueue extends JobQueue {
  constructor(options = {}) {
    super('pdf-sync', {
      attempts: options.attempts || 3,
      retryDelay: options.retryDelay || 5000,
      historyRetentionDays: options.historyRetentionDays || 30,
      failedRetentionDays: options.failedRetentionDays || 7,
      ...options,
    });
  }

  /**
   * Enqueue a PDF sync job for a school
   * @param {string} schoolId - School ID
   * @param {object} options - Job options
   * @returns {Promise<string>} Job ID
   */
  async enqueueSyncJob(schoolId, options = {}) {
    return await this.enqueue(
      JOB_TYPES.PDF_SYNC,
      { schoolId },
      {
        priority: options.priority || JOB_PRIORITY.NORMAL,
        delay: options.delay || 0,
        attempts: options.attempts || 3,
        ...options,
      }
    );
  }

  /**
   * Enqueue a Drive check job for a school
   * @param {string} schoolId - School ID
   * @param {object} options - Job options
   * @returns {Promise<string>} Job ID
   */
  async enqueueDriveCheckJob(schoolId, options = {}) {
    return await this.enqueue(
      JOB_TYPES.DRIVE_CHECK,
      { schoolId },
      {
        priority: options.priority || JOB_PRIORITY.NORMAL,
        delay: options.delay || 0,
        attempts: options.attempts || 3,
        ...options,
      }
    );
  }

  /**
   * Enqueue a PDF process job for a school
   * @param {string} schoolId - School ID
   * @param {object} options - Job options
   * @returns {Promise<string>} Job ID
   */
  async enqueueProcessJob(schoolId, options = {}) {
    return await this.enqueue(
      JOB_TYPES.PDF_PROCESS,
      { schoolId },
      {
        priority: options.priority || JOB_PRIORITY.NORMAL,
        delay: options.delay || 0,
        attempts: options.attempts || 3,
        ...options,
      }
    );
  }

  /**
   * Enqueue multiple PDF sync jobs (for scheduled checks)
   * @param {Array<string>} schoolIds - Array of school IDs
   * @param {object} options - Job options
   * @returns {Promise<Array<string>>} Array of job IDs
   */
  async enqueueBulkSyncJobs(schoolIds, options = {}) {
    const jobIds = [];
    
    // Optimization: Get active jobs once instead of in every iteration
    const existingJobs = await this.getJobs(JOB_TYPES.PDF_SYNC, null, 1000);
    const activeSchoolIds = new Set(
      existingJobs
        .filter(job => job.status === 'waiting' || job.status === 'active')
        .map(job => job.data && job.data.schoolId)
        .filter(id => !!id)
    );

    for (const schoolId of schoolIds) {
      if (!activeSchoolIds.has(schoolId)) {
        const jobId = await this.enqueueSyncJob(schoolId, {
          priority: options.priority || JOB_PRIORITY.LOW,
          ...options,
        });
        jobIds.push(jobId);
      }
    }

    return jobIds;
  }

  /**
   * Get jobs for a specific school
   * @param {string} schoolId - School ID
   * @param {number} limit - Maximum number of jobs
   * @returns {Promise<Array>} Array of jobs
   */
  async getJobsForSchool(schoolId, limit = 10) {
    const allJobs = await this.getJobs(null, null, 1000);
    return allJobs
      .filter(job => job.data && job.data.schoolId === schoolId)
      .slice(0, limit);
  }
}










