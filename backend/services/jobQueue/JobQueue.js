/**
 * Concrete job queue implementation using BullMQ
 * Falls back to in-memory queue if Redis is not available
 */

import { Queue, QueueEvents, Worker } from 'bullmq';
import Redis from 'ioredis';
import { BaseJobQueue } from './BaseJobQueue.js';
import { JOB_STATUS } from './jobTypes.js';
import { jobHistoryService } from './JobHistoryService.js';

export class JobQueue extends BaseJobQueue {
  constructor(queueName, options = {}) {
    super();
    this.queueName = queueName;
    this.options = {
      connection: this.getRedisConnection(),
      defaultJobOptions: {
        attempts: options.attempts || 3,
        backoff: {
          type: 'exponential',
          delay: options.retryDelay || 5000,
        },
        removeOnComplete: {
          age: options.historyRetentionDays ? options.historyRetentionDays * 24 * 3600 : 30 * 24 * 3600, // 30 days default
          count: options.historyRetentionCount || 1000,
        },
        removeOnFail: {
          age: options.failedRetentionDays ? options.failedRetentionDays * 24 * 3600 : 7 * 24 * 3600, // 7 days default
        },
      },
      ...options,
    };

    this.queue = new Queue(queueName, this.options);
    this.queueEvents = new QueueEvents(queueName, this.options);
    this.isRedisAvailable = this.options.connection !== null;
    
    // Log Redis status
    if (this.isRedisAvailable) {
      console.log(`[JobQueue] Redis connection available - using production mode`);
    } else {
      console.log(`[JobQueue] No Redis connection - using polling mode with persistent history`);
    }
    
    // Set up event listeners to record job history
    this.setupEventListeners();
  }

  /**
   * Set up event listeners to record job history
   */
  setupEventListeners() {
    // Only set up event listeners if Redis is available
    // In-memory queues don't support QueueEvents properly
    if (!this.isRedisAvailable) {
      console.log('[JobQueue] Skipping event listeners - Redis not available (will use polling worker events instead)');
      return;
    }
    
    // Listen to queue events
    this.queueEvents.on('waiting', ({ jobId }) => {
      this.queue.getJob(jobId).then(job => {
        if (job) {
          jobHistoryService.recordEvent('created', {
            id: jobId,
            name: job.name,
            data: job.data,
            attempts: job.opts.attempts,
          });
        }
      }).catch(err => console.error('[JobQueue] Error recording created event:', err));
    });

    this.queueEvents.on('active', ({ jobId }) => {
      this.queue.getJob(jobId).then(job => {
        if (job) {
          jobHistoryService.recordEvent('started', {
            id: jobId,
            name: job.name,
            data: job.data,
          });
        }
      }).catch(err => console.error('[JobQueue] Error recording started event:', err));
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      jobHistoryService.recordEvent('progress', {
        id: jobId,
        progress: data,
      });
    });

    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      this.queue.getJob(jobId).then(job => {
        if (job) {
          jobHistoryService.recordEvent('completed', {
            id: jobId,
            name: job.name,
            data: job.data,
            result: returnvalue,
          });
        }
      }).catch(err => console.error('[JobQueue] Error recording completed event:', err));
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.queue.getJob(jobId).then(job => {
        if (job) {
          jobHistoryService.recordEvent('failed', {
            id: jobId,
            name: job.name,
            data: job.data,
            error: failedReason,
            failedReason,
          });
        }
      }).catch(err => console.error('[JobQueue] Error recording failed event:', err));
    });
  }

  /**
   * Get Redis connection or return null for in-memory fallback
   */
  getRedisConnection() {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.log(`[JobQueue] No REDIS_URL found, using in-memory queue (jobs will be lost on restart)`);
      return null; // BullMQ will use in-memory queue
    }

    try {
      return new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    } catch (error) {
      console.error(`[JobQueue] Failed to connect to Redis: ${error.message}, falling back to in-memory queue`);
      return null;
    }
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

    const job = await this.queue.add(jobType, data, jobOptions);
    console.log(`[JobQueue] Enqueued job ${job.id} of type ${jobType}`);
    
    // Record job creation in history (immediate, in case events don't fire for in-memory queue)
    jobHistoryService.recordEvent('created', {
      id: job.id,
      name: jobType,
      data,
      attempts: jobOptions.attempts,
    });
    
    return job.id;
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId) {
    // First try to get from queue (if Redis available)
    if (this.queue && this.isRedisAvailable) {
      const job = await this.queue.getJob(jobId);
      
      if (job) {
        const state = await job.getState();
        const progress = job.progress || 0;
        const result = job.returnvalue || null;
        const failedReason = job.failedReason || null;

        return {
          id: job.id,
          name: job.name,
          data: job.data,
          status: this.mapBullMQStateToStatus(state),
          progress,
          result,
          error: failedReason,
          createdAt: new Date(job.timestamp),
          processedAt: job.processedOn ? new Date(job.processedOn) : null,
          finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
          attemptsMade: job.attemptsMade,
          attemptsTotal: job.opts.attempts,
        };
      }
    }
    
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
   * Map BullMQ state to our status enum
   */
  mapBullMQStateToStatus(state) {
    const mapping = {
      'waiting': JOB_STATUS.WAITING,
      'active': JOB_STATUS.ACTIVE,
      'completed': JOB_STATUS.COMPLETED,
      'failed': JOB_STATUS.FAILED,
      'delayed': JOB_STATUS.DELAYED,
      'paused': JOB_STATUS.PAUSED,
    };
    return mapping[state] || state;
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId) {
    if (this.queue && this.isRedisAvailable) {
      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.remove();
        // Record cancellation in history
        jobHistoryService.recordEvent('cancelled', {
          id: jobId,
          name: job.name,
          data: job.data,
        });
        return true;
      }
    }
    
    // If not in Redis, just record in history
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
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const state = await job.getState();
    if (state !== 'failed') {
      throw new Error(`Job ${jobId} is not in failed state (current: ${state})`);
    }

    // Create a new job with the same data
    const newJob = await this.queue.add(job.name, job.data, {
      priority: job.opts.priority,
      attempts: job.opts.attempts,
    });

    return newJob.id;
  }

  /**
   * Get jobs by type and status
   */
  async getJobs(jobType = null, status = null, limit = 100) {
    const startTime = Date.now();
    
    // CRITICAL: Check Redis availability FIRST before doing anything else
    // If Redis is not available, return history jobs immediately - don't touch the queue
    if (!this.isRedisAvailable) {
      try {
        const historyJobs = jobHistoryService.getJobs(jobType, status, limit);
        const duration = Date.now() - startTime;
        console.log(`[JobQueue] Redis not available (isRedisAvailable=${this.isRedisAvailable}) - returning ${historyJobs.length} jobs from persistent history in ${duration}ms`);
        return historyJobs;
      } catch (error) {
        console.error('[JobQueue] Error getting history jobs:', error);
        const duration = Date.now() - startTime;
        console.log(`[JobQueue] Returning empty array after ${duration}ms due to history error`);
        return [];
      }
    }
    
    // Always get jobs from history (for merging with Redis jobs)
    const historyJobs = jobHistoryService.getJobs(jobType, status, limit * 2);
    
    // Check if queue is initialized
    if (!this.queue) {
      console.log('[JobQueue] Queue not initialized, returning history jobs only');
      return historyJobs.slice(0, limit);
    }
    
    const jobs = [];
    
    // Get jobs from different states
    const states = status 
      ? [this.mapStatusToBullMQState(status)]
      : ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'];

    // Limit per state to avoid fetching too many jobs
    // If we have 6 states and want 100 jobs total, fetch ~20 per state
    const perStateLimit = Math.ceil(limit / states.length) + 10; // Add buffer for filtering

    console.log(`[JobQueue] getJobs: fetching up to ${perStateLimit} jobs per state from ${states.length} states (total limit: ${limit})`);

    // Wrap entire operation in a timeout to prevent hanging
    try {
      const getJobsPromise = (async () => {
        for (const state of states) {
          // Skip if we already have enough jobs
          if (jobs.length >= limit) {
            break;
          }

          let stateJobs = [];
          
          try {
            // Add timeout per state fetch (3 seconds max per state)
            const stateFetchPromise = (async () => {
              switch (state) {
                case 'waiting':
                  return await this.queue.getWaiting(0, perStateLimit);
                case 'active':
                  return await this.queue.getActive(0, perStateLimit);
                case 'completed':
                  return await this.queue.getCompleted(0, perStateLimit);
                case 'failed':
                  return await this.queue.getFailed(0, perStateLimit);
                case 'delayed':
                  return await this.queue.getDelayed(0, perStateLimit);
                case 'paused':
                  return await this.queue.getPaused(0, perStateLimit);
                default:
                  return [];
              }
            })();

            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Timeout fetching ${state} jobs`)), 3000)
            );

            stateJobs = await Promise.race([stateFetchPromise, timeoutPromise]);
            console.log(`[JobQueue] Fetched ${stateJobs.length} ${state} jobs`);
          } catch (error) {
            console.error(`[JobQueue] Error fetching ${state} jobs:`, error.message);
            // Continue with other states even if one fails
            continue;
          }

          // Filter by job type if specified
          if (jobType) {
            stateJobs = stateJobs.filter(job => job.name === jobType);
          }

          // Convert to our format - use the state we already know instead of calling getState()
          const mappedStatus = this.mapBullMQStateToStatus(state);
          for (const job of stateJobs) {
            jobs.push({
              id: job.id,
              name: job.name,
              data: job.data,
              status: mappedStatus, // Use the state we already know
              progress: job.progress || 0,
              result: job.returnvalue || null,
              error: job.failedReason || null,
              createdAt: new Date(job.timestamp),
              processedAt: job.processedOn ? new Date(job.processedOn) : null,
              finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
              attemptsMade: job.attemptsMade,
              attemptsTotal: job.opts.attempts,
            });
          }
        }

        // Sort by creation time (newest first) and limit
        jobs.sort((a, b) => {
          const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
          const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
          return timeB - timeA;
        });
        
        // Merge with history jobs (prefer Redis jobs for active jobs, but include history for completed/failed)
        const redisJobIds = new Set(jobs.map(j => j.id));
        const additionalHistoryJobs = historyJobs.filter(hj => !redisJobIds.has(hj.id));
        
        // Combine and deduplicate
        const allJobs = [...jobs, ...additionalHistoryJobs];
        allJobs.sort((a, b) => {
          const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
          const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
          return timeB - timeA;
        });
        
        return allJobs.slice(0, limit);
      })();

      // Overall timeout of 10 seconds
      const overallTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Overall timeout fetching jobs')), 10000)
      );

      const result = await Promise.race([getJobsPromise, overallTimeout]);
      const duration = Date.now() - startTime;
      console.log(`[JobQueue] getJobs completed in ${duration}ms, returning ${result.length} jobs`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[JobQueue] getJobs failed after ${duration}ms:`, error.message);
      // On error, return history jobs as fallback
      console.log(`[JobQueue] Returning ${historyJobs.length} history jobs as fallback`);
      return historyJobs;
    }
  }

  /**
   * Map our status to BullMQ state
   */
  mapStatusToBullMQState(status) {
    const mapping = {
      [JOB_STATUS.WAITING]: 'waiting',
      [JOB_STATUS.ACTIVE]: 'active',
      [JOB_STATUS.COMPLETED]: 'completed',
      [JOB_STATUS.FAILED]: 'failed',
      [JOB_STATUS.DELAYED]: 'delayed',
      [JOB_STATUS.PAUSED]: 'paused',
    };
    return mapping[status] || status;
  }

  /**
   * Get job statistics
   */
  async getStats() {
    // Always get stats from history (works even without Redis)
    const historyStats = jobHistoryService.getStats();
    
    // If Redis is not available, return history stats
    if (!this.isRedisAvailable) {
      console.log('[JobQueue] Redis not available - returning stats from persistent history');
      return {
        ...historyStats,
        delayed: 0,
        isRedisAvailable: false,
        isPollingMode: true, // Indicate we're in polling mode
      };
    }

    if (!this.queue) {
      return {
        ...historyStats,
        delayed: 0,
        isRedisAvailable: false,
        isPollingMode: true,
      };
    }

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      // Merge Redis stats with history stats (prefer Redis for active counts, history for totals)
      return {
        waiting: Math.max(waiting, historyStats.waiting), // Use Redis if available, but don't lose history
        active: Math.max(active, historyStats.active),
        completed: Math.max(completed, historyStats.completed),
        failed: Math.max(failed, historyStats.failed),
        delayed,
        total: Math.max(waiting + active + completed + failed + delayed, historyStats.total),
        isRedisAvailable: this.isRedisAvailable,
        isPollingMode: false,
      };
    } catch (error) {
      console.error('[JobQueue] Error getting stats:', error.message);
      // On error, return history stats as fallback
      return {
        ...historyStats,
        delayed: 0,
        isRedisAvailable: false,
        isPollingMode: true,
      };
    }
  }

  /**
   * Get the underlying BullMQ queue (for worker setup)
   */
  getQueue() {
    return this.queue;
  }

  /**
   * Get queue options (for worker setup)
   */
  getOptions() {
    return this.options;
  }

  /**
   * Close the queue
   */
  async close() {
    await this.queue.close();
    await this.queueEvents.close();
    if (this.options.connection) {
      await this.options.connection.quit();
    }
  }
}

