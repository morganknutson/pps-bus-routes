/**
 * Weekly Sync Service
 * Orchestrates the full weekly synchronization workflow:
 * 1. Check Drive status for all schools
 * 2. Fetch PDFs for schools with mismatches
 * 3. Process updated routes
 * 4. Send email notification on errors
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { driveLinkVerificationService } from './driveLinkVerificationService.js';
import { listFolderFiles, downloadFile } from './driveService.js';
import { processSinglePDF } from './routeProcessor.js';
import { pdfMetadataService } from './pdfMetadataService.js';
import { sendErrorNotification, sendSuccessNotification } from './emailService.js';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const SYNC_STATE_FILE = path.join(DATA_DIR, 'weekly-sync-state.json');

/**
 * Load sync state from file
 */
async function loadSyncState() {
    try {
        if (fs.existsSync(SYNC_STATE_FILE)) {
            const data = await fsPromises.readFile(SYNC_STATE_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error('[WeeklySyncService] Error loading sync state:', error);
    }
    return {
        lastRun: null,
        lastRunStatus: null,
        lastRunDuration: null,
        lastRunResults: null,
    };
}

/**
 * Save sync state to file
 */
async function saveSyncState(state) {
    try {
        await fsPromises.writeFile(SYNC_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch (error) {
        logger.error('[WeeklySyncService] Error saving sync state:', error);
    }
}

/**
 * Extract folder ID from Google Drive URL
 */
function extractFolderId(url) {
    if (!url) return null;
    const match = url.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Run the full weekly sync workflow
 */
async function runWeeklySync() {
    const startTime = Date.now();
    logger.info('[WeeklySyncService] ========== Starting weekly sync ==========');

    const results = {
        startTime: new Date().toISOString(),
        totalSchools: 0,
        schoolsChecked: 0,
        schoolsWithUpdates: 0,
        pdfsDownloaded: 0,
        routesProcessed: 0,
        errors: [],
        phases: {
            driveCheck: { status: 'pending', schools: 0, duration: null },
            pdfFetch: { status: 'pending', downloaded: 0, duration: null },
            processing: { status: 'pending', processed: 0, duration: null },
        },
    };

    try {
        // Load schools
        const schoolsContent = await fsPromises.readFile(SCHOOLS_FILE, 'utf8');
        const schools = JSON.parse(schoolsContent);
        const schoolsWithDriveLinks = schools.filter(s => s.driveLink);
        results.totalSchools = schoolsWithDriveLinks.length;

        logger.info(`[WeeklySyncService] Found ${results.totalSchools} schools with Drive links`);

        // ========== PHASE 1: Drive Check ==========
        logger.info('[WeeklySyncService] Phase 1: Checking Drive status for all schools...');
        const driveCheckStart = Date.now();
        results.phases.driveCheck.status = 'running';

        const schoolsNeedingUpdate = [];

        for (const school of schoolsWithDriveLinks) {
            try {
                const checkResult = await driveLinkVerificationService.verifySchoolDriveLink(school);
                results.schoolsChecked++;

                if (checkResult.needsUpdate || checkResult.countMismatch) {
                    schoolsNeedingUpdate.push({
                        school,
                        driveResult: checkResult,
                    });
                    logger.info(`[WeeklySyncService] ${school.name} needs update (needsUpdate=${checkResult.needsUpdate}, countMismatch=${checkResult.countMismatch || false})`);
                }

                // Rate limiting delay
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                logger.error(`[WeeklySyncService] Error checking ${school.id}:`, error.message);
                results.errors.push({
                    phase: 'driveCheck',
                    schoolId: school.id,
                    schoolName: school.name,
                    error: error.message,
                });
            }
        }

        results.phases.driveCheck.status = 'completed';
        results.phases.driveCheck.schools = results.schoolsChecked;
        results.phases.driveCheck.duration = formatDuration(Date.now() - driveCheckStart);
        results.schoolsWithUpdates = schoolsNeedingUpdate.length;

        logger.info(`[WeeklySyncService] Phase 1 complete: ${schoolsNeedingUpdate.length} schools need updates`);

        // ========== PHASE 2: PDF Fetch ==========
        if (schoolsNeedingUpdate.length > 0) {
            logger.info('[WeeklySyncService] Phase 2: Fetching PDFs for schools with updates...');
            const fetchStart = Date.now();
            results.phases.pdfFetch.status = 'running';

            const apiKey = process.env.GOOGLE_API_KEY || null;

            for (const { school, driveResult } of schoolsNeedingUpdate) {
                try {
                    const folderId = extractFolderId(school.driveLink);
                    if (!folderId) {
                        throw new Error('Invalid Drive link format');
                    }

                    // Get list of files from Drive
                    const driveFiles = await listFolderFiles(folderId, apiKey);
                    const pdfFiles = driveFiles.filter(f => f.name && f.name.toLowerCase().endsWith('.pdf'));

                    // Get current local metadata
                    const metadata = await pdfMetadataService.loadMetadata(school.id);
                    const localFileIds = new Set(Object.keys(metadata.files || {}));

                    // Ensure PDF directory exists
                    const pdfDir = path.join(DATA_DIR, 'schools', school.id, 'pdfs');
                    if (!fs.existsSync(pdfDir)) {
                        await fsPromises.mkdir(pdfDir, { recursive: true });
                    }

                    // Determine which files to download
                    for (const driveFile of pdfFiles) {
                        try {
                            const localFileInfo = metadata.files?.[driveFile.id];
                            let needsDownload = false;

                            if (!localFileInfo) {
                                // New file - doesn't exist locally
                                needsDownload = true;
                                logger.info(`[WeeklySyncService] New PDF: ${driveFile.name}`);
                            } else {
                                // Check if Drive version is newer
                                const localModified = new Date(localFileInfo.modifiedTime || 0).getTime();
                                const driveModified = new Date(driveFile.modifiedTime || 0).getTime();

                                if (driveModified > localModified + 1000) {
                                    needsDownload = true;
                                    logger.info(`[WeeklySyncService] Updated PDF: ${driveFile.name}`);
                                }
                            }

                            if (needsDownload) {
                                // Download the file
                                const { buffer } = await downloadFile(driveFile.id, apiKey);
                                const filePath = path.join(pdfDir, driveFile.name);
                                await fsPromises.writeFile(filePath, buffer);

                                // Update metadata
                                await pdfMetadataService.updateFileMetadata(school.id, driveFile.id, {
                                    filename: driveFile.name,
                                    modifiedTime: driveFile.modifiedTime,
                                    localPath: driveFile.name,
                                    downloadedAt: new Date().toISOString(),
                                });

                                results.pdfsDownloaded++;

                                // Rate limiting
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        } catch (error) {
                            logger.error(`[WeeklySyncService] Error downloading ${driveFile.name}:`, error.message);
                            results.errors.push({
                                phase: 'pdfFetch',
                                schoolId: school.id,
                                schoolName: school.name,
                                file: driveFile.name,
                                error: error.message,
                            });
                        }
                    }

                    // Clean up orphaned local files (files that exist locally but not in Drive)
                    const driveFileIds = new Set(pdfFiles.map(f => f.id));
                    for (const localId of localFileIds) {
                        if (!driveFileIds.has(localId)) {
                            try {
                                const localInfo = metadata.files[localId];
                                if (localInfo?.localPath) {
                                    const filePath = path.join(pdfDir, localInfo.localPath);
                                    if (fs.existsSync(filePath)) {
                                        await fsPromises.unlink(filePath);
                                        logger.info(`[WeeklySyncService] Deleted orphaned file: ${localInfo.localPath}`);
                                    }
                                }
                                await pdfMetadataService.removeFileMetadata(school.id, localId);
                            } catch (error) {
                                logger.warn(`[WeeklySyncService] Error cleaning up orphaned file:`, error.message);
                            }
                        }
                    }
                } catch (error) {
                    logger.error(`[WeeklySyncService] Error fetching PDFs for ${school.id}:`, error.message);
                    results.errors.push({
                        phase: 'pdfFetch',
                        schoolId: school.id,
                        schoolName: school.name,
                        error: error.message,
                    });
                }
            }

            results.phases.pdfFetch.status = 'completed';
            results.phases.pdfFetch.downloaded = results.pdfsDownloaded;
            results.phases.pdfFetch.duration = formatDuration(Date.now() - fetchStart);

            logger.info(`[WeeklySyncService] Phase 2 complete: ${results.pdfsDownloaded} PDFs downloaded`);
        } else {
            results.phases.pdfFetch.status = 'skipped';
            logger.info('[WeeklySyncService] Phase 2 skipped: No schools need updates');
        }

        // ========== PHASE 3: Process Routes ==========
        if (results.pdfsDownloaded > 0) {
            logger.info('[WeeklySyncService] Phase 3: Processing updated routes...');
            const processStart = Date.now();
            results.phases.processing.status = 'running';

            for (const { school } of schoolsNeedingUpdate) {
                try {
                    const pdfDir = path.join(DATA_DIR, 'schools', school.id, 'pdfs');
                    if (!fs.existsSync(pdfDir)) continue;

                    const pdfFiles = (await fsPromises.readdir(pdfDir)).filter(f => f.endsWith('.pdf'));

                    for (const pdfFile of pdfFiles) {
                        try {
                            const pdfPath = path.join(pdfDir, pdfFile);
                            const pdfBuffer = await fsPromises.readFile(pdfPath);

                            await processSinglePDF(pdfBuffer, pdfFile, pdfFile, {
                                logPrefix: '[WeeklySyncService]',
                                saveToFile: true,
                                schoolId: school.id,
                            });

                            results.routesProcessed++;
                        } catch (error) {
                            logger.error(`[WeeklySyncService] Error processing ${pdfFile}:`, error.message);
                            results.errors.push({
                                phase: 'processing',
                                schoolId: school.id,
                                schoolName: school.name,
                                file: pdfFile,
                                error: error.message,
                            });
                        }
                    }
                } catch (error) {
                    logger.error(`[WeeklySyncService] Error processing school ${school.id}:`, error.message);
                    results.errors.push({
                        phase: 'processing',
                        schoolId: school.id,
                        schoolName: school.name,
                        error: error.message,
                    });
                }
            }

            results.phases.processing.status = 'completed';
            results.phases.processing.processed = results.routesProcessed;
            results.phases.processing.duration = formatDuration(Date.now() - processStart);

            logger.info(`[WeeklySyncService] Phase 3 complete: ${results.routesProcessed} routes processed`);
        } else {
            results.phases.processing.status = 'skipped';
            logger.info('[WeeklySyncService] Phase 3 skipped: No PDFs downloaded');
        }

    } catch (error) {
        logger.error('[WeeklySyncService] Fatal error during sync:', error);
        results.errors.push({
            phase: 'fatal',
            error: error.message,
        });
    }

    // ========== PHASE 4: Notification ==========
    const endTime = Date.now();
    const duration = formatDuration(endTime - startTime);
    results.endTime = new Date().toISOString();
    results.duration = duration;
    results.errorCount = results.errors.length;

    logger.info(`[WeeklySyncService] ========== Weekly sync completed in ${duration} ==========`);
    logger.info(`[WeeklySyncService] Summary: ${results.schoolsChecked} checked, ${results.schoolsWithUpdates} with updates, ${results.pdfsDownloaded} downloaded, ${results.routesProcessed} processed, ${results.errorCount} errors`);

    // Save state
    await saveSyncState({
        lastRun: results.startTime,
        lastRunStatus: results.errorCount > 0 ? 'completed_with_errors' : 'success',
        lastRunDuration: duration,
        lastRunResults: results,
    });

    // Send notifications
    if (results.errorCount > 0) {
        await sendErrorNotification(results.errors, {
            totalSchools: results.totalSchools,
            schoolsProcessed: results.schoolsChecked,
            duration,
        });
    } else {
        // Send success notification
        await sendSuccessNotification(results);
    }

    return results;
}

/**
 * Get the current sync state
 */
async function getSyncState() {
    return await loadSyncState();
}

export {
    runWeeklySync,
    getSyncState,
};
