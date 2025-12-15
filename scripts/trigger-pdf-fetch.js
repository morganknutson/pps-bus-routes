/**
 * Script to trigger PDF fetch for school(s)
 * Uses the job queue system with polling for status updates
 * Works without Redis (uses polling worker and history service)
 * 
 * Usage:
 *   node scripts/trigger-pdf-fetch.js <schoolId>        - Single school
 *   node scripts/trigger-pdf-fetch.js --all             - All schools with drive links
 *   node scripts/trigger-pdf-fetch.js --help            - Show help
 * 
 * Examples:
 *   node scripts/trigger-pdf-fetch.js arleta
 *   node scripts/trigger-pdf-fetch.js --all
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';
const POLL_INTERVAL = 2000; // 2 seconds
const MAX_WAIT_TIME = 5 * 60 * 1000; // 5 minutes per job
const JOB_STATUS_TIMEOUT = 5000; // 5 seconds for status check

/**
 * Show help message
 */
function showHelp() {
  console.log(`
PDF Fetch Script - Trigger PDF synchronization for schools

Usage:
  node scripts/trigger-pdf-fetch.js <schoolId>        Fetch PDFs for a single school
  node scripts/trigger-pdf-fetch.js --all             Fetch PDFs for all schools with drive links
  node scripts/trigger-pdf-fetch.js --help            Show this help message

Examples:
  node scripts/trigger-pdf-fetch.js arleta
  node scripts/trigger-pdf-fetch.js --all

Environment Variables:
  API_BASE    API base URL (default: http://localhost:3001/api)

The script will:
  1. Enqueue a PDF sync job for the school(s)
  2. Poll the job status every ${POLL_INTERVAL / 1000} seconds
  3. Display progress updates
  4. Show final results (downloaded, skipped, deleted counts)

Note: This script works without Redis - it uses polling via the history service.
`);
}

/**
 * Format elapsed time
 */
function formatElapsed(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Enqueue a PDF sync job for a school
 */
async function enqueueJob(schoolId) {
  try {
    const response = await fetch(`${API_BASE}/pdf-sync/fetch/${schoolId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out - server may be unavailable');
    }
    throw error;
  }
}

/**
 * Get job status
 */
async function getJobStatus(jobId) {
  try {
    const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
      signal: AbortSignal.timeout(JOB_STATUS_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Job not found
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      return null; // Timeout - return null to retry
    }
    throw error;
  }
}

/**
 * Poll job status until completion
 */
async function pollJobStatus(jobId, schoolName) {
  const startTime = Date.now();
  let lastStatus = null;
  let lastProgress = null;

  console.log(`\n📊 Polling job status for ${schoolName}...`);
  console.log(`   Job ID: ${jobId.substring(0, 8)}...`);

  while (true) {
    const elapsed = Date.now() - startTime;
    
    // Check timeout
    if (elapsed > MAX_WAIT_TIME) {
      console.log(`\n⏱️  Timeout after ${formatElapsed(MAX_WAIT_TIME)} - job may still be processing`);
      console.log(`   Check status: ${API_BASE}/jobs/${jobId}`);
      return null;
    }

    // Get job status
    const status = await getJobStatus(jobId);
    
    if (!status) {
      // Job not found or timeout - wait and retry
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      continue;
    }

    // Show status update if it changed
    if (status.status !== lastStatus) {
      const statusEmoji = {
        'waiting': '⏳',
        'active': '🔄',
        'completed': '✅',
        'failed': '❌',
        'delayed': '⏰',
      };
      const emoji = statusEmoji[status.status] || '📋';
      console.log(`\n${emoji} Status: ${status.status.toUpperCase()}`);
      lastStatus = status.status;
    }

    // Show progress update if it changed
    if (status.progress !== undefined && status.progress !== lastProgress) {
      console.log(`   Progress: ${status.progress}%`);
      lastProgress = status.progress;
    }

    // Check if job is complete
    if (status.status === 'completed') {
      console.log(`\n✅ Job completed in ${formatElapsed(Date.now() - startTime)}`);
      return status;
    }

    if (status.status === 'failed') {
      console.log(`\n❌ Job failed after ${formatElapsed(Date.now() - startTime)}`);
      if (status.error) {
        console.log(`   Error: ${status.error}`);
      }
      if (status.failedReason) {
        console.log(`   Reason: ${status.failedReason}`);
      }
      return status;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

/**
 * Display job result summary
 */
function displayResult(status) {
  if (!status || !status.result) {
    return;
  }

  const result = status.result;
  console.log('\n📋 Result Summary:');
  console.log(`   School ID: ${result.schoolId}`);
  
  if (result.downloaded !== undefined) {
    console.log(`   Downloaded: ${result.downloaded} PDF(s)`);
  }
  if (result.skipped !== undefined) {
    console.log(`   Skipped: ${result.skipped} PDF(s)`);
  }
  if (result.deleted !== undefined && result.deleted > 0) {
    console.log(`   Deleted (orphaned): ${result.deleted} PDF(s)`);
  }
  if (result.totalInDrive !== undefined) {
    console.log(`   Total in Drive: ${result.totalInDrive} PDF(s)`);
  }
  if (result.errors && result.errors.length > 0) {
    console.log(`   Errors: ${result.errors.length}`);
    result.errors.forEach(err => {
      console.log(`     - ${err.file}: ${err.error}`);
    });
  }
  if (result.deletedErrors && result.deletedErrors.length > 0) {
    console.log(`   Deletion Errors: ${result.deletedErrors.length}`);
    result.deletedErrors.forEach(err => {
      console.log(`     - ${err.file}: ${err.error}`);
    });
  }
}

/**
 * Load schools from API
 */
async function loadSchools() {
  try {
    const response = await fetch(`${API_BASE}/schools`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.schools || [];
  } catch (error) {
    throw new Error(`Failed to load schools: ${error.message}`);
  }
}

/**
 * Process a single school
 */
async function processSchool(schoolId, schoolName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚌 Fetching PDFs for: ${schoolName} (${schoolId})`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Enqueue job
    console.log('\n📤 Enqueueing PDF sync job...');
    const enqueueResult = await enqueueJob(schoolId);
    
    if (enqueueResult.error) {
      console.error(`❌ Error: ${enqueueResult.error}`);
      if (enqueueResult.existingJob) {
        console.log(`   A job is already running: ${enqueueResult.existingJob.id.substring(0, 8)}...`);
      }
      return { success: false, schoolId, error: enqueueResult.error };
    }

    console.log(`✅ Job queued: ${enqueueResult.jobId.substring(0, 8)}...`);

    // Poll for status
    const status = await pollJobStatus(enqueueResult.jobId, schoolName);
    
    // Display results
    if (status) {
      displayResult(status);
    }

    return {
      success: status?.status === 'completed',
      schoolId,
      status: status?.status || 'unknown',
      result: status?.result,
      error: status?.error || status?.failedReason,
    };
  } catch (error) {
    console.error(`\n❌ Error processing ${schoolName}:`, error.message);
    return { success: false, schoolId, error: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  // Check for help
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  // Check for --all flag
  if (args[0] === '--all') {
    console.log('📚 Fetching PDFs for all schools with drive links...\n');
    
    try {
      const schools = await loadSchools();
      const schoolsWithDriveLinks = schools.filter(s => s.driveLink);
      
      if (schoolsWithDriveLinks.length === 0) {
        console.log('❌ No schools with drive links found');
        process.exit(1);
      }

      console.log(`Found ${schoolsWithDriveLinks.length} school(s) with drive links\n`);

      const results = [];
      for (const school of schoolsWithDriveLinks) {
        const result = await processSchool(school.id, school.name);
        results.push(result);
        
        // Small delay between schools
        if (schoolsWithDriveLinks.indexOf(school) < schoolsWithDriveLinks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Summary
      console.log(`\n${'='.repeat(60)}`);
      console.log('📊 Summary');
      console.log(`${'='.repeat(60)}`);
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`✅ Successful: ${successful}`);
      console.log(`❌ Failed: ${failed}`);
      console.log(`📋 Total: ${results.length}`);

      process.exit(failed > 0 ? 1 : 0);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  } else {
    // Single school
    const schoolId = args[0];
    
    try {
      const schools = await loadSchools();
      const school = schools.find(s => s.id === schoolId);
      
      if (!school) {
        console.error(`❌ School not found: ${schoolId}`);
        process.exit(1);
      }

      const result = await processSchool(schoolId, school.name);
      process.exit(result.success ? 0 : 1);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

// Run main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
