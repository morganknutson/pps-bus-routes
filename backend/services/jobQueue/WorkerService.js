/**
 * Worker service for processing jobs from the queue
 * Handles PDF sync, PDF processing, and Drive check jobs
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { listFolderFiles, downloadFile } from '../driveService.js';
import { processSinglePDF } from '../routeProcessor.js';
import { pdfMetadataService } from '../pdfMetadataService.js';
import { driveLinkVerificationService } from '../driveLinkVerificationService.js';
import { JOB_TYPES } from './jobTypes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const SYNC_STATUS_FILE = path.join(DATA_DIR, 'pdf-sync-status.json');

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

    // In development, always enable unless explicitly disabled
    // In production, require ENABLE_WEEKLY_SYNC=true
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_WEEKLY_SYNC !== 'true') {
      console.log('[WorkerService] 🚫 Background jobs are DISABLED in production (use ENABLE_WEEKLY_SYNC=true to enable)');
      return;
    }

    // Explicitly disable polling if requested via environment variable
    if (process.env.DISABLE_POLLING === 'true') {
      console.log('[WorkerService] 🚫 Background polling is EXPLICITLY DISABLED via environment variable');
      return;
    }

    const modeLabel = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    console.log(`[WorkerService] Starting in ${modeLabel} mode (polling worker)`);
    console.log(`[WorkerService] Concurrency: ${this.concurrency}`);

    // Start the polling worker
    this.startPollingWorker();
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
        pollInterval = setTimeout(poll, 5000); // Check again in 5 seconds
        return;
      }

      try {
        // Get waiting jobs
        // Use the queue instance's getJobs method which handles Redis/No-Redis correctly
        // Check for PDF_SYNC jobs first
        let waitingJobs = await this.pdfSyncQueue.getJobs(JOB_TYPES.PDF_SYNC, 'waiting', 1);

        // Then check for PDF_PROCESS jobs
        if (!waitingJobs || waitingJobs.length === 0) {
          waitingJobs = await this.pdfSyncQueue.getJobs(JOB_TYPES.PDF_PROCESS, 'waiting', 1);
        }

        // Finally check for DRIVE_CHECK jobs
        if (!waitingJobs || waitingJobs.length === 0) {
          waitingJobs = await this.pdfSyncQueue.getJobs(JOB_TYPES.DRIVE_CHECK, 'waiting', 1);
        }

        if (waitingJobs && waitingJobs.length > 0) {
          const job = waitingJobs[0];
          isProcessing = true;
          lastProcessTime = Date.now();

          console.log(`[WorkerService] Processing job ${job.id} (${job.name}) (development mode)`);

          try {
            // In development mode (history only), we need to get the "real" job object if possible
            // but since we're using polling, we'll just use the job data from history

            // Create a mock job object with updateProgress method
            const mockJob = {
              id: job.id,
              name: job.name,
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
            let result;
            if (job.name === JOB_TYPES.DRIVE_CHECK) {
              result = await this.processDriveCheckJob(mockJob);
            } else if (job.name === JOB_TYPES.PDF_PROCESS) {
              result = await this.processPdfProcessJob(mockJob);
            } else {
              result = await this.processPdfSyncJob(mockJob);
            }

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
      pollInterval = setTimeout(poll, 5000); // Wait 5 seconds between polls
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
    this.workers = [];

    console.log('[WorkerService] Stopped');
  }

  /**
   * Process a Drive check job
   * @param {object} job - Job object
   */
  async processDriveCheckJob(job) {
    const { schoolId } = job.data;
    console.log(`[WorkerService] Processing Drive check for school: ${schoolId}`);

    try {
      // Load schools
      const schools = JSON.parse(await fsPromises.readFile(SCHOOLS_FILE, 'utf8'));
      const school = schools.find(s => s.id === schoolId);

      if (!school) {
        throw new Error(`School not found: ${schoolId}`);
      }

      await job.updateProgress(20);

      // Use the verification service logic
      const result = await driveLinkVerificationService.verifySchoolDriveLink(school);

      await job.updateProgress(80);

      // Save updated cache
      await this.updateVerificationCache(schoolId, result);

      await job.updateProgress(100);
      return result;
    } catch (error) {
      console.error(`[WorkerService] Error processing Drive check for ${schoolId}:`, error);
      throw error;
    }
  }

  /**
   * Update the verification results cache file for a specific school
   * @param {string} schoolId 
   * @param {object} result 
   */
  async updateVerificationCache(schoolId, result) {
    try {
      const schools = JSON.parse(await fsPromises.readFile(SCHOOLS_FILE, 'utf8'));

      let cachedResults = {
        timestamp: new Date().toISOString(),
        totalSchools: schools.length,
        results: [],
      };

      const DRIVE_VERIFICATION_CACHE_FILE = path.join(DATA_DIR, 'drive-link-verification-results.json');

      if (fs.existsSync(DRIVE_VERIFICATION_CACHE_FILE)) {
        try {
          const cacheContent = await fsPromises.readFile(DRIVE_VERIFICATION_CACHE_FILE, 'utf8');
          cachedResults = JSON.parse(cacheContent);
        } catch (error) {
          console.warn('[WorkerService] Error loading cache for update:', error.message);
        }
      }

      // Update or add this school's result
      const existingIndex = cachedResults.results.findIndex(r => r.schoolId === schoolId);
      if (existingIndex >= 0) {
        cachedResults.results[existingIndex] = result;
      } else {
        cachedResults.results.push(result);
      }

      // Update the global timestamp to now
      cachedResults.timestamp = new Date().toISOString();

      // Save updated cache
      const tempFile = `${DRIVE_VERIFICATION_CACHE_FILE}.tmp`;
      await fsPromises.writeFile(tempFile, JSON.stringify(cachedResults, null, 2), 'utf8');
      await fsPromises.rename(tempFile, DRIVE_VERIFICATION_CACHE_FILE);
    } catch (error) {
      console.warn('[WorkerService] Error updating verification cache:', error.message);
    }
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

          // Update metadata service
          await pdfMetadataService.updateFileMetadata(schoolId, file.id, {
            filename: file.name,
            modifiedTime: file.modifiedTime,
            localPath: file.name,
          });

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

      // Clean up orphaned local files (files that exist locally but not in Drive)
      const driveFileNames = new Set(pdfFiles.map(f => f.name));
      const driveFileIds = new Set(pdfFiles.map(f => f.id));
      const currentLocalPdfs = await this.getExistingPdfs(schoolId);
      const orphanedPdfs = currentLocalPdfs.filter(name => !driveFileNames.has(name));

      // Also check metadata for orphaned entries by file ID
      const metadata = await pdfMetadataService.loadMetadata(schoolId);
      const metadataFileIds = Object.keys(metadata.files || {});
      const orphanedFileIds = metadataFileIds.filter(id => !driveFileIds.has(id));

      let deletedCount = 0;

      // Delete files based on names not in Drive
      for (const orphanedPdf of orphanedPdfs) {
        try {
          const pdfPath = path.join(pdfDir, orphanedPdf);
          const jsonPath = path.join(processedDir, orphanedPdf.replace('.pdf', '.json'));

          if (fs.existsSync(pdfPath)) {
            await fsPromises.unlink(pdfPath);
            console.log(`[WorkerService] Deleted orphaned PDF: ${orphanedPdf}`);
          }

          if (fs.existsSync(jsonPath)) {
            await fsPromises.unlink(jsonPath);
            console.log(`[WorkerService] Deleted orphaned JSON: ${orphanedPdf.replace('.pdf', '.json')}`);
          }
          deletedCount++;
        } catch (err) {
          console.error(`[WorkerService] Failed to delete orphaned file ${orphanedPdf}:`, err.message);
        }
      }

      // Clean up metadata for orphaned file IDs
      for (const orphanedId of orphanedFileIds) {
        try {
          await pdfMetadataService.removeFileMetadata(schoolId, orphanedId);
          console.log(`[WorkerService] Removed orphaned metadata for file ID: ${orphanedId}`);
        } catch (err) {
          console.error(`[WorkerService] Failed to remove orphaned metadata ${orphanedId}:`, err.message);
        }
      }

      if (deletedCount > 0 || orphanedFileIds.length > 0) {
        console.log(`[WorkerService] Cleaned up ${deletedCount} orphaned files and ${orphanedFileIds.length} metadata entries for ${schoolId}`);
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

      // Perform a final Drive check to update the verification results table
      try {
        const driveResult = await driveLinkVerificationService.verifySchoolDriveLink(school);
        await this.updateVerificationCache(schoolId, driveResult);
      } catch (cacheError) {
        console.warn(`[WorkerService] Failed to update verification cache after sync for ${schoolId}:`, cacheError.message);
      }

      await job.updateProgress(100);

      return {
        schoolId,
        downloaded,
        processed,
        skipped,
        deleted: deletedCount,
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
   * Process a PDF process job
   * @param {object} job - Job object
   */
  async processPdfProcessJob(job) {
    const { schoolId } = job.data;
    console.log(`[WorkerService] Processing PDFs for school: ${schoolId}`);

    try {
      // Load schools
      const schoolsContent = await fsPromises.readFile(SCHOOLS_FILE, 'utf8');
      const schools = JSON.parse(schoolsContent);
      const school = schools.find(s => s.id === schoolId);

      if (!school) {
        throw new Error(`School not found: ${schoolId}`);
      }

      await job.updateProgress(10);

      // Get PDF directory
      const pdfDir = await this.getSchoolPdfDir(schoolId);
      if (!fs.existsSync(pdfDir)) {
        throw new Error(`No PDF directory found for ${schoolId}`);
      }

      const pdfFiles = (await fsPromises.readdir(pdfDir)).filter(f => f.endsWith('.pdf'));
      if (pdfFiles.length === 0) {
        return {
          schoolId,
          processed: 0,
          errors: [],
          totalProcessed: 0,
          message: 'No PDFs found to process'
        };
      }

      await job.updateProgress(20);

      const processed = [];
      const errors = [];
      const totalFiles = pdfFiles.length;

      // Process PDFs one by one
      for (let i = 0; i < totalFiles; i++) {
        const pdfFile = pdfFiles[i];
        try {
          const pdfPath = path.join(pdfDir, pdfFile);
          const pdfBuffer = await fsPromises.readFile(pdfPath);

          console.log(`[WorkerService] Processing: ${pdfFile}`);
          const finalRoute = await processSinglePDF(pdfBuffer, pdfFile, pdfFile, {
            logPrefix: '[WorkerService]',
            saveToFile: true,
            schoolId: schoolId,
          });

          processed.push({
            file: pdfFile,
            routeName: finalRoute.name || 'Unknown',
            stops: finalRoute.stops ? finalRoute.stops.length : 0,
            geocoded: finalRoute.stats ? finalRoute.stats.geocodedStops : 0,
          });
        } catch (error) {
          console.error(`[WorkerService] Error processing ${pdfFile}:`, error.message);
          errors.push({ file: pdfFile, error: error.message });
        }

        // Update progress (from 20% to 100%)
        const progress = 20 + Math.floor(((i + 1) / totalFiles) * 80);
        await job.updateProgress(progress);
      }

      return {
        schoolId,
        schoolName: school.name,
        processed: processed.length,
        errors: errors.length,
        processedDetails: processed,
        errorDetails: errors,
        summary: {
          totalPdfs: totalFiles,
          successful: processed.length,
          failed: errors.length,
        },
      };
    } catch (error) {
      console.error(`[WorkerService] Error processing job for ${schoolId}:`, error);
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
