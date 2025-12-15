/**
 * Abstract base class for job queues
 * Provides common interface for all job queue implementations
 */

export class BaseJobQueue {
  /**
   * Enqueue a new job
   * @param {string} jobType - Type of job (from JOB_TYPES)
   * @param {object} data - Job data
   * @param {object} options - Job options (priority, delay, attempts, etc.)
   * @returns {Promise<string>} Job ID
   */
  async enqueue(jobType, data, options = {}) {
    throw new Error('enqueue() must be implemented by subclass');
  }

  /**
   * Get job status by ID
   * @param {string} jobId - Job ID
   * @returns {Promise<object>} Job status and data
   */
  async getJobStatus(jobId) {
    throw new Error('getJobStatus() must be implemented by subclass');
  }

  /**
   * Cancel a job
   * @param {string} jobId - Job ID
   * @returns {Promise<boolean>} Success status
   */
  async cancelJob(jobId) {
    throw new Error('cancelJob() must be implemented by subclass');
  }

  /**
   * Retry a failed job
   * @param {string} jobId - Job ID
   * @returns {Promise<string>} New job ID
   */
  async retryJob(jobId) {
    throw new Error('retryJob() must be implemented by subclass');
  }

  /**
   * Get jobs by type and status
   * @param {string} jobType - Job type filter
   * @param {string} status - Status filter
   * @param {number} limit - Maximum number of jobs to return
   * @returns {Promise<Array>} Array of jobs
   */
  async getJobs(jobType = null, status = null, limit = 100) {
    throw new Error('getJobs() must be implemented by subclass');
  }

  /**
   * Get job statistics
   * @returns {Promise<object>} Statistics object
   */
  async getStats() {
    throw new Error('getStats() must be implemented by subclass');
  }

  /**
   * Close the queue (cleanup)
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('close() must be implemented by subclass');
  }
}

