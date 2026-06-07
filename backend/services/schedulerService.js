/**
 * Scheduler Service for automated PDF synchronization.
 */

import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runWeeklySync } from './weeklySyncService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SCHEDULER_STATE_FILE = path.join(DATA_DIR, 'scheduler-state.json');
const CRON_EXPRESSION = '0 2 * * 0';
const TIMEZONE = 'America/Los_Angeles';
const SCHEDULE_LABEL = 'Sundays @ 2am PT';
const DEFAULT_CATCH_UP_AFTER_MS = 8 * 24 * 60 * 60 * 1000;
const DEFAULT_CATCH_UP_SKIP_WITHIN_MS = 6 * 60 * 60 * 1000;
const STARTUP_CATCH_UP_DELAY_MS = 5000;

let schedulerState = {
  enabled: false,
  lastRun: null,
  lastRunStatus: null,
  lastRunError: null,
};

let cronJob = null;
let activeRun = null;

function loadState() {
  try {
    if (fs.existsSync(SCHEDULER_STATE_FILE)) {
      const data = fs.readFileSync(SCHEDULER_STATE_FILE, 'utf8');
      schedulerState = { ...schedulerState, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('[Scheduler] Error loading scheduler state:', error);
  }
}

function saveState() {
  try {
    fs.writeFileSync(SCHEDULER_STATE_FILE, JSON.stringify(schedulerState, null, 2));
  } catch (error) {
    console.error('[Scheduler] Error saving scheduler state:', error);
  }
}

function getSchedulerConfig() {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.ENABLE_WEEKLY_SYNC !== 'true') {
      return {
        configured: false,
        disabledReason: 'ENABLE_WEEKLY_SYNC must be true in production',
      };
    }
    return { configured: true, disabledReason: null };
  }

  if (process.env.ENABLE_SCHEDULER !== 'true') {
    return {
      configured: false,
      disabledReason: 'ENABLE_SCHEDULER must be true in development',
    };
  }

  return { configured: true, disabledReason: null };
}

function parsePositiveInteger(value, fallback) {
  const parsed = parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getCatchUpConfig() {
  return {
    enabled: process.env.ENABLE_SCHEDULER_CATCHUP === 'true',
    afterMs: parsePositiveInteger(process.env.SCHEDULER_CATCHUP_AFTER_MS, DEFAULT_CATCH_UP_AFTER_MS),
    skipWithinMs: parsePositiveInteger(process.env.SCHEDULER_CATCHUP_SKIP_WITHIN_MS, DEFAULT_CATCH_UP_SKIP_WITHIN_MS),
  };
}

function getTimeZoneParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return Object.fromEntries(
    formatter.formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  );
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function zonedTimeToUtc(year, month, day, hour, minute, second, timeZone) {
  let utcMillis = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let i = 0; i < 3; i++) {
    const offset = getTimeZoneOffsetMs(new Date(utcMillis), timeZone);
    utcMillis = Date.UTC(year, month - 1, day, hour, minute, second) - offset;
  }

  return new Date(utcMillis);
}

function addDaysToDateParts(parts, days) {
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
  };
}

function calculateNextSundayRun(now = new Date()) {
  const localParts = getTimeZoneParts(now, TIMEZONE);
  const localDayOfWeek = new Date(Date.UTC(localParts.year, localParts.month - 1, localParts.day)).getUTCDay();
  let candidateDate = addDaysToDateParts(localParts, (7 - localDayOfWeek) % 7);
  let candidate = zonedTimeToUtc(candidateDate.year, candidateDate.month, candidateDate.day, 2, 0, 0, TIMEZONE);

  if (candidate <= now) {
    candidateDate = addDaysToDateParts(candidateDate, 7);
    candidate = zonedTimeToUtc(candidateDate.year, candidateDate.month, candidateDate.day, 2, 0, 0, TIMEZONE);
  }

  return candidate.toISOString();
}

function getLastRunAgeMs(now = new Date()) {
  if (!schedulerState.lastRun) return null;
  const lastRunTime = new Date(schedulerState.lastRun).getTime();
  if (!Number.isFinite(lastRunTime)) return null;
  return now.getTime() - lastRunTime;
}

function getStaleStatus(now = new Date()) {
  const catchUpConfig = getCatchUpConfig();
  const lastRunAgeMs = getLastRunAgeMs(now);
  const hasSuccessfulRun = schedulerState.lastRunStatus === 'success';
  const overdue = lastRunAgeMs === null || lastRunAgeMs > catchUpConfig.afterMs;
  const stale = overdue || !hasSuccessfulRun;

  return {
    stale,
    overdue,
    lastRunAgeMs,
    staleAfterMs: catchUpConfig.afterMs,
  };
}

function getCatchUpDecision(now = new Date()) {
  const schedulerConfig = getSchedulerConfig();
  const catchUpConfig = getCatchUpConfig();
  const staleStatus = getStaleStatus(now);
  const nextRun = calculateNextSundayRun(now);
  const nextRunInMs = new Date(nextRun).getTime() - now.getTime();

  if (!catchUpConfig.enabled) {
    return { shouldRun: false, reason: 'catch-up disabled', nextRun, nextRunInMs };
  }

  if (!schedulerState.enabled || !schedulerConfig.configured) {
    return { shouldRun: false, reason: schedulerConfig.disabledReason || 'scheduler disabled', nextRun, nextRunInMs };
  }

  if (activeRun) {
    return { shouldRun: false, reason: 'sync already running', nextRun, nextRunInMs };
  }

  if (!staleStatus.overdue) {
    return { shouldRun: false, reason: 'last run is recent', nextRun, nextRunInMs };
  }

  if (nextRunInMs > 0 && nextRunInMs <= catchUpConfig.skipWithinMs) {
    return { shouldRun: false, reason: 'next scheduled run is soon', nextRun, nextRunInMs };
  }

  return { shouldRun: true, reason: 'last successful run is stale', nextRun, nextRunInMs };
}

function startScheduler() {
  const config = getSchedulerConfig();
  if (!config.configured) {
    schedulerState.enabled = false;
    saveState();
    console.log(`[Scheduler] Disabled: ${config.disabledReason}`);
    return false;
  }

  if (!cronJob) {
    cronJob = cron.schedule(CRON_EXPRESSION, () => {
      if (schedulerState.enabled) {
        runCheck('cron');
      }
    }, {
      scheduled: false,
      timezone: TIMEZONE,
    });
  }

  cronJob.start();
  console.log(`[Scheduler] Started - will run ${SCHEDULE_LABEL}`);
  return true;
}

function stopScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
  console.log('[Scheduler] Stopped');
}

function updateState(update) {
  schedulerState = { ...schedulerState, ...update };
  saveState();
}

function runCheck(trigger = 'manual') {
  if (activeRun) {
    return {
      accepted: true,
      alreadyRunning: true,
      status: getStatus(),
    };
  }

  const startedAt = new Date().toISOString();
  updateState({
    lastRun: startedAt,
    lastRunStatus: 'running',
    lastRunError: null,
    lastRunTrigger: trigger,
  });

  activeRun = Promise.resolve()
    .then(() => runWeeklySync())
    .then(results => {
      updateState({
        lastRunStatus: results.errorCount > 0 ? 'completed_with_errors' : 'success',
        lastRunError: results.errorCount > 0 ? `${results.errorCount} errors occurred` : null,
      });
      console.log(`[Scheduler] Weekly sync completed: ${results.schoolsChecked} checked, ${results.pdfsDownloaded} PDFs downloaded, ${results.routesProcessed} routes processed`);
      return results;
    })
    .catch(error => {
      console.error('[Scheduler] Error during weekly sync:', error);
      updateState({
        lastRunStatus: 'error',
        lastRunError: error.message,
      });
      return null;
    })
    .finally(() => {
      activeRun = null;
    });

  console.log(`[Scheduler] Weekly sync started at ${startedAt} (${trigger})`);
  return {
    accepted: true,
    alreadyRunning: false,
    status: getStatus(),
  };
}

function getStatus() {
  const config = getSchedulerConfig();
  const catchUpConfig = getCatchUpConfig();
  const staleStatus = getStaleStatus();
  const catchUpDecision = getCatchUpDecision();
  const cronRunning = !!cronJob && schedulerState.enabled && config.configured;

  return {
    ...schedulerState,
    configured: config.configured,
    disabledReason: config.disabledReason,
    running: !!activeRun,
    cronRunning,
    schedule: SCHEDULE_LABEL,
    nextRun: cronRunning ? calculateNextSundayRun() : null,
    stale: staleStatus.stale,
    overdue: staleStatus.overdue,
    lastRunAgeMs: staleStatus.lastRunAgeMs,
    staleAfterMs: staleStatus.staleAfterMs,
    catchUpEnabled: catchUpConfig.enabled,
    catchUpSkipWithinMs: catchUpConfig.skipWithinMs,
    catchUpDecision: catchUpDecision.reason,
  };
}

function toggleScheduler(enabled) {
  if (enabled) {
    const started = startScheduler();
    updateState({ enabled: started });
    if (started) {
      scheduleStartupCatchUp();
    }
  } else {
    stopScheduler();
    updateState({ enabled: false });
  }

  return getStatus();
}

function scheduleStartupCatchUp() {
  const decision = getCatchUpDecision();
  if (!decision.shouldRun) {
    console.log(`[Scheduler] Startup catch-up skipped: ${decision.reason}`);
    return;
  }

  console.log(`[Scheduler] Startup catch-up scheduled: ${decision.reason}`);
  const timer = setTimeout(() => {
    const latestDecision = getCatchUpDecision();
    if (!latestDecision.shouldRun) {
      console.log(`[Scheduler] Startup catch-up cancelled: ${latestDecision.reason}`);
      return;
    }
    runCheck('startup_catch_up');
  }, STARTUP_CATCH_UP_DELAY_MS);
  timer.unref?.();
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

loadState();
if (schedulerState.enabled) {
  startScheduler();
  scheduleStartupCatchUp();
}

export {
  getStatus,
  toggleScheduler,
  runCheck,
  startScheduler,
  stopScheduler,
};
