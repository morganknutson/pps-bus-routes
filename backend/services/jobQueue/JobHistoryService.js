/**
 * Job History Service
 * Persists job events to a file for history tracking
 * Works independently of Redis, so jobs are always visible
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import { dataPath, runtimeDataPath } from '../../utils/runtimePaths.js';

const JOBS_HISTORY_DIR = runtimeDataPath('jobs-history');
const JOBS_HISTORY_FILE = runtimeDataPath('jobs-history', 'jobs.json');
const JOBS_HISTORY_SEED_FILE = dataPath('jobs-history', 'jobs.json');

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
    this.maxHistorySize = 1000; // Reduced from 10,000 to 1,000 for better performance
    this.history = [];
    this.isSaving = false;
    this.needsSave = false;
    this.saveInterval = 5000; // Save at most once every 5 seconds
    this.lastSaveTime = 0;
    this.saveTimeout = null;
    
    // Initial load
    this.init();
  }

  /**
   * Initial load of history
   */
  async init() {
    this.history = await this.loadHistory();
    // Immediately trim if oversized
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
      await this.saveHistory();
    }
  }

  /**
   * Load job history from file
   */
  async loadHistory() {
    const sourceFile = fs.existsSync(this.historyFile)
      ? this.historyFile
      : this.historyFile !== JOBS_HISTORY_SEED_FILE && fs.existsSync(JOBS_HISTORY_SEED_FILE)
        ? JOBS_HISTORY_SEED_FILE
        : null;

    if (!sourceFile) {
      return [];
    }

    try {
      const data = await fsPromises.readFile(sourceFile, 'utf8');
      if (!data || data.trim() === '') return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('[JobHistoryService] Error loading history:', error);
      return [];
    }
  }

  /**
   * Request a save - throttled to prevent event loop blocking
   */
  requestSave() {
    if (this.isSaving) {
      this.needsSave = true;
      return;
    }

    const now = Date.now();
    const timeSinceLastSave = now - this.lastSaveTime;

    if (this.saveTimeout) {
      // Already have a pending save
      return;
    }

    if (timeSinceLastSave >= this.saveInterval) {
      // Can save immediately
      this.saveHistory();
    } else {
      // Schedule save for later
      const delay = this.saveInterval - timeSinceLastSave;
      this.saveTimeout = setTimeout(() => {
        this.saveTimeout = null;
        this.saveHistory();
      }, delay);
    }
  }

  /**
   * Save job history to file
   * Implements atomic write to prevent corruption
   */
  async saveHistory() {
    if (this.isSaving) {
      this.needsSave = true;
      return;
    }

    this.isSaving = true;
    this.needsSave = false;
    this.lastSaveTime = Date.now();

    try {
      // Keep only the most recent jobs
      const trimmed = this.history.slice(-this.maxHistorySize);
      const tempFile = `${this.historyFile}.tmp`;
      
      // Use synchronous write for temp file to ensure it's complete before renaming,
      // but wrap in try/catch to handle errors. 
      // Actually, async writeFile is fine and better for event loop.
      await fsPromises.writeFile(tempFile, JSON.stringify(trimmed, null, 2), 'utf8');
      await fsPromises.rename(tempFile, this.historyFile);

      if (this.history.length > this.maxHistorySize) {
        this.history = this.history.slice(-this.maxHistorySize);
      }
    } catch (error) {
      console.error('[JobHistoryService] Error saving history:', error);
    } finally {
      this.isSaving = false;
      // If another save was requested while we were saving, run it now
      if (this.needsSave) {
        setImmediate(() => this.saveHistory());
      }
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
      
      // If history is too large, remove oldest
      if (this.history.length > this.maxHistorySize + 100) { // Add buffer to avoid frequent trimming
        this.history = this.history.slice(-this.maxHistorySize);
      }
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

    // Keep only last 20 events per job (reduced from 50)
    if (job.events.length > 20) {
      job.events = job.events.slice(-20);
    }

    // Trigger throttled save
    this.requestSave();
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






