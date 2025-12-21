/**
 * Job queue implementation using persistent history only
 * Redis and BullMQ have been removed to save resources
 */

import { BaseJobQueue } from './BaseJobQueue.js';
import { JOB_STATUS } from './jobTypes.js';
import { jobHistoryService } from './JobHistoryService.js';

export class JobQueue extends BaseJobQueue {
  constructor(queueName, options = {}) {
    super();
    this.queueName = queueName;
    this.isRedisAvailable = false;
    this.queue = null;
    this.queueEvents = null;
    this.options = {
      defaultJobOptions: {
        attempts: options.attempts || 3,
        backoff: {
          type: 'exponential',
          delay: options.retryDelay || 5000,
        },
      },
      ...options,
    };
    console.log(`[JobQueue] Redis/BullMQ disabled - using persistent history only`);
  }

  /**
   * Enqueue a new job
   */
  async enqueue(jobType, data, options = {}) {
    const jobOptions = {
      priority: options.priority || 5,
      delay: options.delay || 0,
      attempts: options.attempts || this.options.defaultJobOptions.attempts,
      ...options,
    };

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[JobQueue] Enqueued job ${jobId} of type ${jobType} (persistent history mode)`);
    
    // Record job creation in history
    jobHistoryService.recordEvent('created', {
      id: jobId,
      name: jobType,
      data,
      attempts: jobOptions.attempts,
    });
    
    return jobId;
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId) {
    // Fallback to history
    const historyJob = jobHistoryService.getJob(jobId);
    if (historyJob) {
      // Convert history job format to match expected format
      return {
        id: historyJob.id,
        name: historyJob.name,
        data: historyJob.data,
        status: historyJob.status,
        progress: historyJob.progress || 0,
        result: historyJob.result,
        error: historyJob.error,
        createdAt: new Date(historyJob.createdAt),
        processedAt: historyJob.processedAt ? new Date(historyJob.processedAt) : null,
        finishedAt: historyJob.finishedAt ? new Date(historyJob.finishedAt) : null,
        attemptsMade: historyJob.attemptsMade || 0,
        attemptsTotal: historyJob.attemptsTotal || 3,
      };
    }
    
    return null;
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId) {
    // Just record in history
    const historyJob = jobHistoryService.getJob(jobId);
    if (historyJob && (historyJob.status === 'waiting' || historyJob.status === 'active')) {
      jobHistoryService.recordEvent('cancelled', {
        id: jobId,
        name: historyJob.name,
        data: historyJob.data,
      });
      return true;
    }
    
    return false;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId) {
    // Get job from history and re-enqueue
    const historyJob = jobHistoryService.getJob(jobId);
    if (!historyJob) {
      throw new Error(`Job ${jobId} not found`);
    }
    if (historyJob.status !== JOB_STATUS.FAILED) {
      throw new Error(`Job ${jobId} is not in failed state (current: ${historyJob.status})`);
    }
    // Re-enqueue using the enqueue method
    return await this.enqueue(historyJob.name, historyJob.data, {
      priority: historyJob.priority || 5,
      attempts: historyJob.attemptsTotal || 3,
    });
  }

  /**
   * Get jobs by type and status
   */
  async getJobs(jobType = null, status = null, limit = 100) {
    try {
      const historyJobs = jobHistoryService.getJobs(jobType, status, limit);
      return historyJobs;
    } catch (error) {
      console.error('[JobQueue] Error getting history jobs:', error);
      return [];
    }
  }

  /**
   * Get job statistics
   */
  async getStats() {
    // Always get stats from history
    const historyStats = jobHistoryService.getStats();
    
    return {
      ...historyStats,
      delayed: 0,
      isRedisAvailable: false,
      isPollingMode: true,
    };
  }

  /**
   * Get the underlying queue (deprecated)
   */
  getQueue() {
    return null;
  }

  /**
   * Get queue options
   */
  getOptions() {
    return this.options;
  }

  /**
   * Close the queue
   */
  async close() {
    // Nothing to close
  }
}
