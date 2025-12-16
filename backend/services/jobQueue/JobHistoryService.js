/**
 * Job History Service
 * Persists job events to a file for history tracking
 * Works independently of Redis, so jobs are always visible
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const JOBS_HISTORY_DIR = path.join(DATA_DIR, 'jobs-history');
const JOBS_HISTORY_FILE = path.join(JOBS_HISTORY_DIR, 'jobs.json');

// Ensure directory exists
if (!fs.existsSync(JOBS_HISTORY_DIR)) {
  fs.mkdirSync(JOBS_HISTORY_DIR, { recursive: true });
}

/**
 * Job History Service class
 * Manages persistent job history in a JSON file
 */
export class JobHistoryService {
  constructor() {
    this.historyFile = JOBS_HISTORY_FILE;
    this.maxHistorySize = 10000; // Keep last 10,000 jobs
    this.history = this.loadHistory();
  }

  /**
   * Load job history from file
   */
  loadHistory() {
    if (!fs.existsSync(this.historyFile)) {
      return [];
    }

    try {
      const data = fs.readFileSync(this.historyFile, 'utf8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('[JobHistoryService] Error loading history:', error);
      return [];
    }
  }

  /**
   * Save job history to file
   */
  saveHistory() {
    try {
      // Keep only the most recent jobs
      const trimmed = this.history.slice(-this.maxHistorySize);
      fs.writeFileSync(this.historyFile, JSON.stringify(trimmed, null, 2), 'utf8');
      this.history = trimmed;
    } catch (error) {
      console.error('[JobHistoryService] Error saving history:', error);
    }
  }

  /**
   * Record a job event
   * @param {string} event - Event type: 'created', 'started', 'progress', 'completed', 'failed', 'cancelled'
   * @param {object} jobData - Job data
   */
  recordEvent(event, jobData) {
    const timestamp = new Date().toISOString();
    
    // Find existing job or create new
    let job = this.history.find(j => j.id === jobData.id);
    
    if (!job) {
      // Create new job entry
      job = {
        id: jobData.id,
        name: jobData.name || jobData.jobType,
        data: jobData.data || {},
        status: 'waiting',
        progress: 0,
        result: null,
        error: null,
        createdAt: timestamp,
        processedAt: null,
        finishedAt: null,
        attemptsMade: 0,
        attemptsTotal: jobData.attempts || 3,
        events: [],
      };
      this.history.push(job);
    }

    // Update job based on event
    switch (event) {
      case 'created':
        job.status = 'waiting';
        job.createdAt = timestamp;
        break;
      
      case 'started':
        job.status = 'active';
        job.processedAt = timestamp;
        job.attemptsMade = (job.attemptsMade || 0) + 1;
        break;
      
      case 'progress':
        job.progress = jobData.progress || job.progress;
        break;
      
      case 'completed':
        job.status = 'completed';
        job.finishedAt = timestamp;
        job.progress = 100;
        job.result = jobData.result || null;
        break;
      
      case 'failed':
        job.status = 'failed';
        job.finishedAt = timestamp;
        job.error = jobData.error || jobData.failedReason || 'Unknown error';
        break;
      
      case 'cancelled':
        job.status = 'cancelled';
        job.finishedAt = timestamp;
        break;
    }

    // Record event
    job.events = job.events || [];
    job.events.push({
      event,
      timestamp,
      data: jobData,
    });

    // Keep only last 50 events per job
    if (job.events.length > 50) {
      job.events = job.events.slice(-50);
    }

    // Save to file (async, don't block)
    setImmediate(() => this.saveHistory());
  }

  /**
   * Get jobs with filters
   * @param {string} jobType - Filter by job type
   * @param {string} status - Filter by status
   * @param {number} limit - Maximum number of jobs
   * @returns {Array} Array of jobs
   */
  getJobs(jobType = null, status = null, limit = 100) {
    let jobs = [...this.history];

    // Filter by job type
    if (jobType) {
      jobs = jobs.filter(job => job.name === jobType);
    }

    // Filter by status
    if (status) {
      jobs = jobs.filter(job => job.status === status);
    }

    // Sort by creation time (newest first)
    jobs.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

    // Limit results
    return jobs.slice(0, limit);
  }

  /**
   * Get a specific job by ID
   * @param {string} jobId - Job ID
   * @returns {object|null} Job or null
   */
  getJob(jobId) {
    return this.history.find(job => job.id === jobId) || null;
  }

  /**
   * Get job statistics
   * @returns {object} Statistics
   */
  getStats() {
    const stats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: this.history.length,
    };

    for (const job of this.history) {
      const status = job.status;
      if (status === 'waiting') stats.waiting++;
      else if (status === 'active') stats.active++;
      else if (status === 'completed') stats.completed++;
      else if (status === 'failed') stats.failed++;
      else if (status === 'cancelled') stats.cancelled++;
    }

    return stats;
  }

  /**
   * Clean up old jobs (keep only recent ones)
   * @param {number} daysToKeep - Number of days to keep
   */
  cleanup(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTime = cutoffDate.getTime();

    const initialLength = this.history.length;
    this.history = this.history.filter(job => {
      const jobTime = new Date(job.createdAt).getTime();
      // Keep if created after cutoff, or if still active/waiting
      return jobTime > cutoffTime || job.status === 'waiting' || job.status === 'active';
    });

    const removed = initialLength - this.history.length;
    if (removed > 0) {
      this.saveHistory();
      console.log(`[JobHistoryService] Cleaned up ${removed} old jobs`);
    }

    return removed;
  }
}

// Export singleton instance
export const jobHistoryService = new JobHistoryService();




