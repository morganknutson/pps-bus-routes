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

function calculateNextSundayRun() {
  const now = new Date();
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
        runCheck();
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

function runCheck() {
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

  console.log('[Scheduler] Weekly sync started at', startedAt);
  return {
    accepted: true,
    alreadyRunning: false,
    status: getStatus(),
  };
}

function getStatus() {
  const config = getSchedulerConfig();
  const cronRunning = !!cronJob && schedulerState.enabled && config.configured;

  return {
    ...schedulerState,
    configured: config.configured,
    disabledReason: config.disabledReason,
    running: !!activeRun,
    cronRunning,
    schedule: SCHEDULE_LABEL,
    nextRun: cronRunning ? calculateNextSundayRun() : null,
  };
}

function toggleScheduler(enabled) {
  if (enabled) {
    const started = startScheduler();
    updateState({ enabled: started });
  } else {
    stopScheduler();
    updateState({ enabled: false });
  }

  return getStatus();
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

loadState();
if (schedulerState.enabled) {
  startScheduler();
}

export {
  getStatus,
  toggleScheduler,
  runCheck,
  startScheduler,
  stopScheduler,
};
