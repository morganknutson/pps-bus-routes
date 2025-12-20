import { verificationService } from '../services/verificationService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  console.log('🔍 Starting Strange Stops Scan...');
  const report = await verificationService.findStrangeStops();
  console.log(`📊 Scan Complete. Found ${report.summary.totalIssues} potential issues across ${report.summary.totalRoutes} routes.`);
  
  if (report.summary.totalIssues > 0) {
    console.log('🛠️ Starting Fixes...');
    const result = await verificationService.fixStrangeStops();
    console.log(`✅ Fixes Complete!`);
    console.log(`📊 Fix Summary:`);
    console.log(`   - Total Issues: ${result.summary.totalIssues}`);
    console.log(`   - Total Fixed: ${result.summary.totalFixed}`);
    console.log(`   - Remaining: ${result.summary.remainingIssues}`);
  }

  console.log('\n🏫 Starting School Stop Verification...');
  const schoolReport = await verificationService.verifySchoolStops();
  console.log(`📊 School Verification Complete.`);
  console.log(`   - Total Routes: ${schoolReport.summary.total}`);
  console.log(`   - Valid: ${schoolReport.summary.valid}`);
  console.log(`   - Invalid: ${schoolReport.summary.invalid}`);
  console.log(`   - Missing School Stop: ${schoolReport.summary.missingSchoolStop}`);

  if (schoolReport.summary.missingSchoolStop > 0 || schoolReport.summary.invalid > 0) {
    console.log('\n📝 Some routes need re-processing to fix school stops or placement.');
    console.log('   (Note: Re-processing is best done via the UI or by re-running the route processor)');
  }
}

main().catch(err => {
  console.error('❌ Error during verification/fix:', err);
  process.exit(1);
});

