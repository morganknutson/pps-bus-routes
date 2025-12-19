/**
 * Job type constants for the job queue system
 */

export const JOB_TYPES = {
  PDF_SYNC: 'pdf-sync',           // Download PDFs for a school from Drive
  PDF_PROCESS: 'pdf-process',     // Process/parse PDFs for a school
  DRIVE_CHECK: 'drive-check',     // Check for Drive updates (scheduled)
};

export const JOB_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELAYED: 'delayed',
  PAUSED: 'paused',
};

export const JOB_PRIORITY = {
  LOW: 1,      // Scheduled checks
  NORMAL: 5,   // Default
  HIGH: 10,    // Manual user requests
};










