/**
 * Weekly Sync Service
 * Coordinates the full Drive check -> PDF sync -> route process workflow.
 * The actual work is delegated to the same job queue used by the UI buttons.
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pdfSyncJobQueue } from './jobQueue/index.js';
import { JOB_PRIORITY } from './jobQueue/jobTypes.js';
import { sendErrorNotification, sendSuccessNotification } from './emailService.js';
import { publishGeneratedData } from './gitPublishService.js';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const SYNC_STATE_FILE = path.join(DATA_DIR, 'weekly-sync-state.json');
const SYNC_LOCK_FILE = path.join(DATA_DIR, 'weekly-sync-lock.json');

const LOCK_TTL_MS = parseInt(process.env.WEEKLY_SYNC_LOCK_TTL_MS || '', 10) || 4 * 60 * 60 * 1000;
const JOB_POLL_MS = parseInt(process.env.WEEKLY_SYNC_JOB_POLL_MS || '', 10) || 2000;
const JOB_TIMEOUT_MS = parseInt(process.env.WEEKLY_SYNC_JOB_TIMEOUT_MS || '', 10) || 45 * 60 * 1000;

async function loadJson(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(await fsPromises.readFile(filePath, 'utf8'));
        }
    } catch (error) {
        logger.error(`[WeeklySyncService] Error loading ${path.basename(filePath)}:`, error);
    }
    return fallback;
}

async function writeJson(filePath, data) {
    const tempFile = `${filePath}.tmp`;
    await fsPromises.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
    await fsPromises.rename(tempFile, filePath);
}

async function loadSyncState() {
    return loadJson(SYNC_STATE_FILE, {
        lastRun: null,
        lastRunStatus: null,
        lastRunDuration: null,
        lastRunResults: null,
    });
}

async function saveSyncState(state) {
    try {
        await writeJson(SYNC_STATE_FILE, state);
    } catch (error) {
        logger.error('[WeeklySyncService] Error saving sync state:', error);
    }
}

async function readLock() {
    return loadJson(SYNC_LOCK_FILE, null);
}

function lockIsActive(lock) {
    if (!lock?.startedAt) return false;
    return Date.now() - new Date(lock.startedAt).getTime() < LOCK_TTL_MS;
}

async function acquireLock(runId) {
    const existingLock = await readLock();
    if (lockIsActive(existingLock)) {
        const ageMinutes = Math.round((Date.now() - new Date(existingLock.startedAt).getTime()) / 60000);
        throw new Error(`Weekly sync is already running (started ${ageMinutes}m ago)`);
    }

    await writeJson(SYNC_LOCK_FILE, {
        runId,
        startedAt: new Date().toISOString(),
        pid: process.pid,
    });
}

async function releaseLock(runId) {
    const lock = await readLock();
    if (lock?.runId === runId && fs.existsSync(SYNC_LOCK_FILE)) {
        await fsPromises.unlink(SYNC_LOCK_FILE);
    }
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

function createResults() {
    return {
        startTime: new Date().toISOString(),
        endTime: null,
        duration: null,
        totalSchools: 0,
        schoolsChecked: 0,
        schoolsWithUpdates: 0,
        pdfsDownloaded: 0,
        routesProcessed: 0,
        errorCount: 0,
        errors: [],
        phases: {
            driveCheck: { status: 'pending', schools: 0, queued: 0, completed: 0, failed: 0, duration: null },
            pdfFetch: { status: 'pending', downloaded: 0, queued: 0, completed: 0, failed: 0, duration: null },
            processing: { status: 'pending', processed: 0, queued: 0, completed: 0, failed: 0, duration: null },
            publish: { status: 'pending', filesChanged: 0, pushed: false, duration: null },
        },
    };
}

async function persistRunning(results) {
    await saveSyncState({
        lastRun: results.startTime,
        lastRunStatus: 'running',
        lastRunDuration: results.duration,
        lastRunResults: results,
    });
}

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isTerminalStatus(status) {
    return ['completed', 'failed', 'cancelled'].includes(status);
}

async function waitForJobs(jobIds, phaseName, phase, results) {
    const startedAt = Date.now();
    const seenFailures = new Set();
    const seenMissing = new Set();
    let terminalJobs = [];

    while (Date.now() - startedAt < JOB_TIMEOUT_MS) {
        const jobStatuses = await Promise.all(jobIds.map(async jobId => ({
            jobId,
            job: await pdfSyncJobQueue.getJobStatus(jobId),
        })));
        const jobs = jobStatuses.map(status => status.job).filter(Boolean);
        const missingJobs = jobStatuses.filter(status => !status.job);
        const completed = jobs.filter(job => job.status === 'completed');
        const failed = jobs.filter(job => job.status === 'failed' || job.status === 'cancelled');

        phase.completed = completed.length;
        phase.failed = failed.length + missingJobs.length;

        for (const missingJob of missingJobs) {
            if (seenMissing.has(missingJob.jobId)) continue;
            seenMissing.add(missingJob.jobId);
            results.errors.push({
                phase: phaseName,
                error: `Job ${missingJob.jobId} was not found in job history`,
            });
        }

        for (const job of failed) {
            if (seenFailures.has(job.id)) continue;
            seenFailures.add(job.id);
            results.errors.push({
                phase: phaseName,
                schoolId: job.data?.schoolId,
                error: job.error || `Job ended with status ${job.status}`,
            });
        }

        await persistRunning(results);

        terminalJobs = jobs.filter(job => isTerminalStatus(job.status));
        if (terminalJobs.length + missingJobs.length === jobIds.length) {
            return terminalJobs;
        }

        await wait(JOB_POLL_MS);
    }

    const jobs = (await Promise.all(jobIds.map(jobId => pdfSyncJobQueue.getJobStatus(jobId)))).filter(Boolean);
    const pendingJobs = jobs.filter(job => !isTerminalStatus(job.status));
    for (const job of pendingJobs) {
        results.errors.push({
            phase: phaseName,
            schoolId: job.data?.schoolId,
            error: `Timed out waiting for job ${job.id}`,
        });
    }
    return jobs.filter(job => isTerminalStatus(job.status));
}

function addJobResultErrors(results, phase, jobResult, school) {
    const nestedErrors = jobResult?.errors || jobResult?.errorDetails || [];
    if (!Array.isArray(nestedErrors)) return;

    for (const nestedError of nestedErrors) {
        results.errors.push({
            phase,
            schoolId: school?.id || jobResult?.schoolId,
            schoolName: school?.name || jobResult?.schoolName,
            file: nestedError.file,
            error: nestedError.error || String(nestedError),
        });
    }
}

async function enqueueAndWait(schools, phaseName, enqueueJob, phase, results) {
    const jobs = [];
    for (const school of schools) {
        const jobId = await enqueueJob(school.id);
        jobs.push({ jobId, school });
    }

    phase.queued = jobs.length;
    await persistRunning(results);

    const completedJobs = await waitForJobs(
        jobs.map(job => job.jobId),
        phaseName,
        phase,
        results,
    );
    const byJobId = new Map(jobs.map(job => [job.jobId, job.school]));

    return completedJobs.map(job => ({
        job,
        school: byJobId.get(job.id),
    }));
}

async function runWeeklySync() {
    const startTime = Date.now();
    const runId = `weekly_${startTime}_${Math.random().toString(36).slice(2, 8)}`;
    const results = createResults();

    logger.info('[WeeklySyncService] Starting weekly sync');
    await acquireLock(runId);

    try {
        const schools = await loadJson(SCHOOLS_FILE, []);
        const schoolsWithDriveLinks = schools.filter(school => school.driveLink);
        results.totalSchools = schoolsWithDriveLinks.length;
        await persistRunning(results);

        logger.info(`[WeeklySyncService] Found ${results.totalSchools} schools with Drive links`);

        const driveCheckStart = Date.now();
        results.phases.driveCheck.status = 'running';
        const driveCheckJobs = await enqueueAndWait(
            schoolsWithDriveLinks,
            'driveCheck',
            schoolId => pdfSyncJobQueue.enqueueDriveCheckJob(schoolId, { priority: JOB_PRIORITY.LOW }),
            results.phases.driveCheck,
            results,
        );

        const schoolsNeedingUpdate = [];
        for (const { job, school } of driveCheckJobs) {
            if (job.status !== 'completed') continue;
            results.schoolsChecked++;
            const driveResult = job.result || {};
            if (driveResult.needsUpdate || driveResult.countMismatch) {
                schoolsNeedingUpdate.push(school);
            }
        }

        results.schoolsWithUpdates = schoolsNeedingUpdate.length;
        results.phases.driveCheck.status = 'completed';
        results.phases.driveCheck.schools = results.schoolsChecked;
        results.phases.driveCheck.duration = formatDuration(Date.now() - driveCheckStart);
        await persistRunning(results);

        if (schoolsNeedingUpdate.length > 0) {
            logger.info(`[WeeklySyncService] Queueing PDF sync for ${schoolsNeedingUpdate.length} schools`);
            const fetchStart = Date.now();
            results.phases.pdfFetch.status = 'running';

            const fetchJobs = await enqueueAndWait(
                schoolsNeedingUpdate,
                'pdfFetch',
                schoolId => pdfSyncJobQueue.enqueueSyncJob(schoolId, { priority: JOB_PRIORITY.LOW }),
                results.phases.pdfFetch,
                results,
            );

            for (const { job, school } of fetchJobs) {
                if (job.status !== 'completed') continue;
                const jobResult = job.result || {};
                results.pdfsDownloaded += jobResult.downloaded || 0;
                results.routesProcessed += jobResult.processed || 0;
                addJobResultErrors(results, 'pdfFetch', jobResult, school);
            }

            results.phases.pdfFetch.status = 'completed';
            results.phases.pdfFetch.downloaded = results.pdfsDownloaded;
            results.phases.pdfFetch.duration = formatDuration(Date.now() - fetchStart);
            await persistRunning(results);

            if (results.routesProcessed > 0) {
                results.phases.processing.status = 'completed';
                results.phases.processing.processed = results.routesProcessed;
                results.phases.processing.duration = results.phases.pdfFetch.duration;
            } else {
                results.phases.processing.status = 'skipped';
            }
        } else {
            results.phases.pdfFetch.status = 'skipped';
            results.phases.processing.status = 'skipped';
        }

        if (results.errors.length === 0) {
            const publishStart = Date.now();
            results.phases.publish.status = 'running';
            await persistRunning(results);

            try {
                const publishResult = await publishGeneratedData({
                    routesProcessed: results.routesProcessed,
                    pdfsDownloaded: results.pdfsDownloaded,
                    schoolsChecked: results.schoolsChecked,
                    schoolsWithUpdates: results.schoolsWithUpdates,
                });

                results.phases.publish = {
                    ...results.phases.publish,
                    ...publishResult,
                    status: publishResult.status,
                    filesChanged: publishResult.filesChanged || 0,
                    pushed: !!publishResult.pushed,
                    duration: formatDuration(Date.now() - publishStart),
                };
            } catch (error) {
                results.phases.publish.status = 'failed';
                results.phases.publish.duration = formatDuration(Date.now() - publishStart);
                results.errors.push({
                    phase: 'publish',
                    error: error.message,
                });
            }
            await persistRunning(results);
        } else {
            results.phases.publish.status = 'skipped';
            results.phases.publish.reason = 'Skipped because earlier pipeline phases had errors';
            await persistRunning(results);
        }
    } catch (error) {
        logger.error('[WeeklySyncService] Fatal error during sync:', error);
        results.errors.push({
            phase: 'fatal',
            error: error.message,
        });
    } finally {
        await releaseLock(runId);
    }

    const duration = formatDuration(Date.now() - startTime);
    results.endTime = new Date().toISOString();
    results.duration = duration;
    results.errorCount = results.errors.length;

    const lastRunStatus = results.errorCount > 0 ? 'completed_with_errors' : 'success';
    await saveSyncState({
        lastRun: results.startTime,
        lastRunStatus,
        lastRunDuration: duration,
        lastRunResults: results,
    });

    try {
        if (results.errorCount > 0) {
            await sendErrorNotification(results.errors, {
                totalSchools: results.totalSchools,
                schoolsProcessed: results.schoolsChecked,
                duration,
            });
        } else {
            await sendSuccessNotification(results);
        }
    } catch (error) {
        logger.warn('[WeeklySyncService] Email notification skipped/failed:', error.message);
    }

    logger.info(`[WeeklySyncService] Weekly sync completed in ${duration}: ${results.schoolsChecked} checked, ${results.schoolsWithUpdates} with updates, ${results.pdfsDownloaded} downloaded, ${results.routesProcessed} processed, ${results.errorCount} errors`);
    return results;
}

async function getSyncState() {
    const state = await loadSyncState();
    const lock = await readLock();
    return {
        ...state,
        running: lockIsActive(lock),
        lock: lockIsActive(lock) ? lock : null,
    };
}

export {
    runWeeklySync,
    getSyncState,
};
