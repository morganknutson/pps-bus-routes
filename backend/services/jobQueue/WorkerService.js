/**
 * Worker service for processing jobs from the queue
 * Handles PDF sync, PDF processing, and Drive check jobs
 */

import { Worker } from 'bullmq';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { listFolderFiles, downloadFile } from '../driveService.js';
import { parseRouteFromPDF } from '../pdfParser.js';
import { geocodingService } from '../geocodingService.js';
import { processSinglePDF } from '../routeProcessor.js';
import { getSchoolIdFromFilename, getSchoolPdfDir } from '../../utils/schoolUtils.js';
import { JOB_TYPES } from './jobTypes.js';

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
    });

    pdfSyncWorker.on('failed', (job, err) => {
      console.error(`[WorkerService] Job ${job.id} failed:`, err.message);
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
        // Use the queue instance's getJobs method which handles Redis/No-Redis correctly
        const waitingJobs = await this.pdfSyncQueue.getJobs(JOB_TYPES.PDF_SYNC, 'waiting', 1);
        
        if (waitingJobs && waitingJobs.length > 0) {
          const job = waitingJobs[0];
          isProcessing = true;
          lastProcessTime = Date.now();

          console.log(`[WorkerService] Processing job ${job.id} (development mode)`);

          try {
            // In development mode (history only), we need to get the "real" job object if possible
            // but since we're using polling, we'll just use the job data from history
            
            // Create a mock job object with updateProgress method
            const mockJob = {
              id: job.id,
              data: job.data,
              updateProgress: async (progress) => {
                // Update progress in history service
                const { jobHistoryService } = await import('./JobHistoryService.js');
                jobHistoryService.recordEvent('progress', {
                  id: job.id,
                  progress
                });
              },
            };

            // Process the job
            const result = await this.processPdfSyncJob(mockJob);

            // Record completion in history
            const { jobHistoryService } = await import('./JobHistoryService.js');
            jobHistoryService.recordEvent('completed', {
              id: job.id,
              result
            });
            
            console.log(`[WorkerService] Job ${job.id} completed`);
          } catch (error) {
            // Record failure in history
            const { jobHistoryService } = await import('./JobHistoryService.js');
            jobHistoryService.recordEvent('failed', {
              id: job.id,
              error: error.message
            });
            
            console.error(`[WorkerService] Job ${job.id} failed:`, error.message);
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
      const schools = JSON.parse(await fsPromises.readFile(SCHOOLS_FILE, 'utf8'));
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

      // Get existing PDFs
      const existingPdfs = await this.getExistingPdfs(schoolId);

      // List files from Drive
      const apiKey = process.env.GOOGLE_API_KEY || null;
      await job.updateProgress(20);
      
      const driveFiles = await listFolderFiles(folderId, apiKey);
      const pdfFiles = driveFiles.filter(f => f.name.endsWith('.pdf'));

      if (pdfFiles.length === 0) {
        return {
          schoolId,
          downloaded: 0,
          processed: 0,
          skipped: 0,
          errors: [],
          totalInDrive: 0,
          lastModifiedPdf: null,
          lastChecked: new Date().toISOString(),
        };
      }

      // Update sync status
      const syncStatus = await this.loadSyncStatus();
      const schoolStatus = syncStatus[schoolId] || {};

      // PDF and Processed JSON directories
      const pdfDir = await this.getSchoolPdfDir(schoolId);
      const processedDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');

      // Ensure processed directory exists
      if (!fs.existsSync(processedDir)) {
        await fsPromises.mkdir(processedDir, { recursive: true });
      }

      // Find newest PDF modified time from Drive
      const newestModifiedTime = pdfFiles
        .map(f => new Date(f.modifiedTime).getTime())
        .reduce((max, time) => Math.max(max, time), 0);

      // Determine which files to download or re-process
      const filesToDownload = [];
      for (const file of pdfFiles) {
        const filePath = path.join(pdfDir, file.name);
        const jsonPath = path.join(processedDir, file.name.replace('.pdf', '.json'));
        
        let needsSync = false;
        if (!fs.existsSync(filePath)) {
          needsSync = true;
          console.log(`[WorkerService] File ${file.name} missing locally, will download`);
        } else if (!fs.existsSync(jsonPath)) {
          needsSync = true;
          console.log(`[WorkerService] JSON for ${file.name} missing, will process`);
        } else {
          // Both exist, check if Drive version is newer
          const localStats = fs.statSync(filePath);
          const driveModified = new Date(file.modifiedTime).getTime();
          const localModified = localStats.mtime.getTime();
          
          if (driveModified > localModified + 1000) { // Add 1s buffer
            needsSync = true;
            console.log(`[WorkerService] Drive version of ${file.name} is newer, will sync`);
          }
        }
        
        if (needsSync) {
          filesToDownload.push(file);
        }
      }

      await job.updateProgress(30);

      let downloaded = 0;
      let processed = 0;
      let skipped = 0;
      const errors = [];

      // Download and process files
      const totalFiles = filesToDownload.length;
      for (let i = 0; i < totalFiles; i++) {
        const file = filesToDownload[i];
        
        try {
          const filePath = path.join(pdfDir, file.name);
          let pdfBuffer;

          // Download if doesn't exist
          if (!fs.existsSync(filePath)) {
            const result = await downloadFile(file.id, apiKey);
            pdfBuffer = result.buffer;
            await fsPromises.writeFile(filePath, pdfBuffer);
            downloaded++;
          } else {
            pdfBuffer = await fsPromises.readFile(filePath);
            skipped++;
          }

          // Process the PDF
          console.log(`[WorkerService] Processing PDF: ${file.name}`);
          await processSinglePDF(pdfBuffer, file.name, file.id, {
            logPrefix: '[WorkerService]',
            saveToFile: true,
            schoolId: schoolId,
          });
          processed++;

          // Update progress
          const progress = 30 + Math.floor((i + 1) / totalFiles * 60);
          await job.updateProgress(progress);

          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`[WorkerService] Error processing ${file.name}:`, error);
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
      await this.saveSyncStatus(newStatus);

      await job.updateProgress(100);

      return {
        schoolId,
        downloaded,
        processed,
        skipped,
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

  async getSchoolPdfDir(schoolId) {
    const pdfDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
    if (!fs.existsSync(pdfDir)) {
      await fsPromises.mkdir(pdfDir, { recursive: true });
    }
    return pdfDir;
  }

  async getExistingPdfs(schoolId) {
    const pdfDir = await this.getSchoolPdfDir(schoolId);
    return (await fsPromises.readdir(pdfDir)).filter(f => f.endsWith('.pdf'));
  }

  async loadSyncStatus() {
    if (fs.existsSync(SYNC_STATUS_FILE)) {
      try {
        return JSON.parse(await fsPromises.readFile(SYNC_STATUS_FILE, 'utf8'));
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  async saveSyncStatus(status) {
    const tempFile = `${SYNC_STATUS_FILE}.tmp`;
    await fsPromises.writeFile(tempFile, JSON.stringify(status, null, 2), 'utf8');
    await fsPromises.rename(tempFile, SYNC_STATUS_FILE);
  }
}
