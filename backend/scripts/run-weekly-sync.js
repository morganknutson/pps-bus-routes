import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

process.env.ENABLE_WEEKLY_SYNC ||= 'true';

const { workerService } = await import('../services/jobQueue/index.js');
const { runWeeklySync } = await import('../services/weeklySyncService.js');

async function main() {
  workerService.start();

  if (!workerService.isRunning) {
    throw new Error('Weekly sync worker did not start. Check ENABLE_WEEKLY_SYNC and DISABLE_POLLING.');
  }

  try {
    const results = await runWeeklySync();
    if (results.errorCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    await workerService.stop();
  }
}

main().catch(async error => {
  console.error('[WeeklySyncRunner] Failed:', error);
  try {
    await workerService.stop();
  } catch (stopError) {
    console.error('[WeeklySyncRunner] Failed to stop worker:', stopError);
  }
  process.exitCode = 1;
});
