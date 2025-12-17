/**
 * Worker service for processing jobs from the queue
 * Handles PDF sync, PDF processing, and Drive check jobs
 */

import { Worker } from 'bullmq';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { listFolderFiles, downloadFile } from '../driveService.js';
import { parseRouteFromPDF } from '../pdfParser.js';
import { geocodingService } from '../geocodingService.js';
import { getSchoolIdFromFilename, getSchoolPdfDir } from '../../utils/schoolUtils.js';
import { JOB_TYPES } from './jobTypes.js';
import { jobHistoryService } from './JobHistoryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const SYNC_STATUS_FILE = path.join(DATA_DIR, 'pdf-sync-status.json');
const pdfParse = require(path.join(__dirname, '..', '..', 'node_modules', 'pdf-parse'));

/**
 * Worker service class
 */
export class WorkerService {
  constructor(pdfSyncQueue, options = {}) {
    this.pdfSyncQueue = pdfSyncQueue;
    this.concurrency = options.concurrency || 2;
    this.workers = [];
    this.isRunning = false;
  }

  /**
   * Start the worker service
   */
  start() {
    if (this.isRunning) {
      console.log('[WorkerService] Already running');
      return;
    }

    console.log(`[WorkerService] Starting with concurrency: ${this.concurrency}`);

    // Get Redis connection from queue (may be null for in-memory)
    // The connection is stored in the queue's options
    const connection = this.pdfSyncQueue.getOptions().connection || null;

    if (!connection) {
      // Development mode: Use polling worker for in-memory queue
      console.warn('[WorkerService] ⚠️  No Redis connection available, using development polling worker');
      console.warn('[WorkerService] 💡 Set REDIS_URL environment variable for production background processing');
      this.startPollingWorker();
      return;
    }

    // Production mode: Use BullMQ Worker with Redis
    const pdfSyncWorker = new Worker(
      this.pdfSyncQueue.queueName,
      async (job) => {
        return await this.processPdfSyncJob(job);
      },
      {
        connection,
        concurrency: this.concurrency,
        limiter: {
          max: 1, // Max 1 job per interval
          duration: 2000, // 2 seconds (rate limiting for Drive API)
        },
      }
    );

    // Handle job events
    pdfSyncWorker.on('completed', (job) => {
      console.log(`[WorkerService] Job ${job.id} completed`);
      jobHistoryService.recordEvent('completed', {
        id: job.id,
        name: job.name,
        data: job.data,
        result: job.returnvalue,
      });
    });

    pdfSyncWorker.on('failed', (job, err) => {
      console.error(`[WorkerService] Job ${job.id} failed:`, err.message);
      jobHistoryService.recordEvent('failed', {
        id: job.id,
        name: job.name,
        data: job.data,
        error: err.message,
        failedReason: err.message,
      });
    });

    pdfSyncWorker.on('error', (err) => {
      console.error('[WorkerService] Worker error:', err);
    });

    this.workers.push(pdfSyncWorker);
    this.isRunning = true;

    console.log('[WorkerService] Started successfully with Redis');
  }

  /**
   * Start a polling worker for development (when Redis is not available)
   * Polls the queue and processes jobs synchronously
   */
  startPollingWorker() {
    this.isRunning = true;
    let isProcessing = false;
    let lastProcessTime = 0;
    const minInterval = 2000; // Minimum 2 seconds between jobs (rate limiting)
    let pollInterval = null;

    const poll = async () => {
      if (!this.isRunning) {
        if (pollInterval) clearTimeout(pollInterval);
        return;
      }

      // Don't process if already processing or too soon since last job
      const timeSinceLastProcess = Date.now() - lastProcessTime;
      if (isProcessing || timeSinceLastProcess < minInterval) {
        pollInterval = setTimeout(poll, 1000); // Check again in 1 second
        return;
      }

      try {
        // Get waiting jobs
        const queue = this.pdfSyncQueue.getQueue();
        
        // If queue is null (no Redis), skip polling
        if (!queue) {
          pollInterval = setTimeout(poll, 1000); // Check again in 1 second
          return;
        }
        
        const waitingJobs = await queue.getWaiting(0, 1);
        
        if (waitingJobs.length > 0) {
          const job = waitingJobs[0];
          isProcessing = true;
          lastProcessTime = Date.now();

          console.log(`[WorkerService] Processing job ${job.id} (development mode)`);
          
          // Record job started
          jobHistoryService.recordEvent('started', {
            id: job.id,
            name: job.name,
            data: job.data,
          });

          try {
            // Create a mock job object with updateProgress method
            const mockJob = {
              id: job.id,
              data: job.data,
              updateProgress: async (progress) => {
                // Update the actual job's progress
                await job.updateProgress(progress);
                // Record progress in history
                jobHistoryService.recordEvent('progress', {
                  id: job.id,
                  progress,
                });
              },
            };

            // Process the job
            const result = await this.processPdfSyncJob(mockJob);

            // Mark as completed
            await job.moveToCompleted(result, '0', true);
            console.log(`[WorkerService] Job ${job.id} completed`);
            
            // Record completion in history
            jobHistoryService.recordEvent('completed', {
              id: job.id,
              name: job.name,
              data: job.data,
              result,
            });
          } catch (error) {
            // Mark as failed
            await job.moveToFailed(error, '0', true);
            console.error(`[WorkerService] Job ${job.id} failed:`, error.message);
            
            // Record failure in history
            jobHistoryService.recordEvent('failed', {
              id: job.id,
              name: job.name,
              data: job.data,
              error: error.message,
              failedReason: error.message,
            });
          }

          isProcessing = false;
        }
      } catch (error) {
        console.error('[WorkerService] Error in polling worker:', error);
        isProcessing = false;
      }

      // Continue polling
      pollInterval = setTimeout(poll, 1000);
    };

    // Start polling
    poll();
    console.log('[WorkerService] Started polling worker (development mode)');
  }

  /**
   * Stop the worker service
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('[WorkerService] Stopping workers...');
    
    this.isRunning = false;
    
    // Close BullMQ workers
    await Promise.all(this.workers.map(worker => worker.close()));
    this.workers = [];

    console.log('[WorkerService] Stopped');
  }

  /**
   * Process a PDF sync job
   * @param {object} job - Job object with id, data, and updateProgress method
   */
  async processPdfSyncJob(job) {
    const { schoolId } = job.data;
    console.log(`[WorkerService] Processing PDF sync for school: ${schoolId}`);

    try {
      // Load schools
      const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
      const school = schools.find(s => s.id === schoolId);

      if (!school) {
        throw new Error(`School not found: ${schoolId}`);
      }

      if (!school.driveLink) {
        throw new Error(`School has no Drive link configured: ${schoolId}`);
      }

      // Extract folder ID
      const folderId = this.extractFolderId(school.driveLink);
      if (!folderId) {
        throw new Error(`Invalid Drive link format: ${school.driveLink}`);
      }

      // Update job progress
      await job.updateProgress(10);

      // Get PDF directory (needed for cleanup operations)
      const pdfDir = this.getSchoolPdfDir(schoolId);
      
      // Get existing PDFs
      const existingPdfs = this.getExistingPdfs(schoolId);

      // List files from Drive
      const apiKey = process.env.GOOGLE_API_KEY || null;
      await job.updateProgress(20);
      
      const driveFiles = await listFolderFiles(folderId, apiKey);
      const pdfFiles = driveFiles.filter(f => f.name.endsWith('.pdf'));
      const drivePdfNames = new Set(pdfFiles.map(f => f.name));

      // Find orphaned PDFs (files in cache that don't exist in Drive)
      const orphanedPdfs = existingPdfs.filter(pdf => !drivePdfNames.has(pdf));
      
      if (pdfFiles.length === 0) {
        // If no PDFs in Drive but we have cached PDFs, delete them all
        let deleted = 0;
        const deletionErrors = [];
        if (existingPdfs.length > 0) {
          console.log(`[WorkerService] No PDFs in Drive for ${schoolId}, cleaning up ${existingPdfs.length} cached PDFs`);
          for (const pdf of existingPdfs) {
            try {
              const filePath = path.join(pdfDir, pdf);
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                deleted++;
              }
            } catch (error) {
              deletionErrors.push({
                file: pdf,
                error: error.message,
              });
            }
          }
        }
        return {
          schoolId,
          downloaded: 0,
          skipped: 0,
          deleted,
          deletedErrors: deletionErrors,
          errors: [],
          totalInDrive: 0,
          lastModifiedPdf: null,
          lastChecked: new Date().toISOString(),
        };
      }

      // Find newest PDF modified time
      const newestModifiedTime = pdfFiles
        .map(f => new Date(f.modifiedTime).getTime())
        .reduce((max, time) => Math.max(max, time), 0);

      // Load sync status
      const syncStatus = this.loadSyncStatus();
      const schoolStatus = syncStatus[schoolId] || {};

      // Determine which files to download
      const lastKnownModified = schoolStatus.lastModifiedPdf 
        ? new Date(schoolStatus.lastModifiedPdf).getTime() 
        : 0;

      const filesToDownload = existingPdfs.length === 0
        ? pdfFiles
        : pdfFiles.filter(f => new Date(f.modifiedTime).getTime() > lastKnownModified);

      await job.updateProgress(30);

      let downloaded = 0;
      let skipped = 0;
      const errors = [];

      // Clean up orphaned PDFs (files in cache that no longer exist in Drive)
      let deleted = 0;
      const deletedErrors = [];
      if (orphanedPdfs.length > 0) {
        console.log(`[WorkerService] Found ${orphanedPdfs.length} orphaned PDF(s) for ${schoolId}, cleaning up...`);
        for (const orphanedPdf of orphanedPdfs) {
          try {
            const filePath = path.join(pdfDir, orphanedPdf);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              deleted++;
              console.log(`[WorkerService] Deleted orphaned PDF: ${orphanedPdf}`);
            }
          } catch (error) {
            console.error(`[WorkerService] Error deleting orphaned PDF ${orphanedPdf}:`, error);
            deletedErrors.push({
              file: orphanedPdf,
              error: error.message,
            });
          }
        }
      }

      // Download files
      const totalFiles = filesToDownload.length;
      for (let i = 0; i < filesToDownload.length; i++) {
        const file = filesToDownload[i];
        
        try {
          const filePath = path.join(pdfDir, file.name);

          // Skip if already exists
          if (fs.existsSync(filePath)) {
            skipped++;
            continue;
          }

          // Download file
          const result = await downloadFile(file.id, apiKey);
          
          // Save file
          fs.writeFileSync(filePath, result.buffer);
          downloaded++;

          // Update progress (adjust progress range to account for cleanup phase)
          const progress = 30 + Math.floor((i + 1) / totalFiles * 60);
          await job.updateProgress(progress);

          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          errors.push({
            file: file.name,
            error: error.message,
          });
        }
      }

      // Update sync status
      const newStatus = {
        ...syncStatus,
        [schoolId]: {
          lastModifiedPdf: newestModifiedTime > 0 ? new Date(newestModifiedTime).toISOString() : schoolStatus.lastModifiedPdf,
          lastChecked: new Date().toISOString(),
        },
      };
      this.saveSyncStatus(newStatus);

      await job.updateProgress(100);

      return {
        schoolId,
        downloaded,
        skipped,
        deleted: deleted || 0,
        deletedErrors: deletedErrors.length > 0 ? deletedErrors : undefined,
        errors,
        totalInDrive: pdfFiles.length,
        lastModifiedPdf: newestModifiedTime > 0 ? new Date(newestModifiedTime).toISOString() : null,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[WorkerService] Error processing PDF sync for ${schoolId}:`, error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  extractFolderId(url) {
    if (!url) return null;
    const match = url.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  getSchoolPdfDir(schoolId) {
    const pdfDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }
    return pdfDir;
  }

  getExistingPdfs(schoolId) {
    const pdfDir = this.getSchoolPdfDir(schoolId);
    return fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
  }

  loadSyncStatus() {
    if (fs.existsSync(SYNC_STATUS_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(SYNC_STATUS_FILE, 'utf8'));
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  saveSyncStatus(status) {
    fs.writeFileSync(SYNC_STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');
  }
}
