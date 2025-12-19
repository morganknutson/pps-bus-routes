/**
 * Script to verify all school links and generate a report
 * Run this once to ensure initial data is correct
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { verificationService } from '../backend/services/verificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHOOLS_FILE = path.join(__dirname, '..', 'data', 'schools.json');
const REPORT_FILE = path.join(__dirname, '..', 'data', 'verification-report.json');
const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * Get PDF count for a school
 */
function getLocalPdfCount(schoolId) {
  try {
    const pdfDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
    if (fs.existsSync(pdfDir)) {
      const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
      return files.length;
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Get list of PDF files for a school
 */
function getLocalPdfFiles(schoolId) {
  try {
    const pdfDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
    if (fs.existsSync(pdfDir)) {
      const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
      return files.sort();
    }
    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Load schools from JSON file
 */
function loadSchools() {
  try {
    if (!fs.existsSync(SCHOOLS_FILE)) {
      console.error('❌ Schools file not found:', SCHOOLS_FILE);
      process.exit(1);
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    
    if (!Array.isArray(schools)) {
      console.error('❌ Schools file does not contain an array');
      process.exit(1);
    }

    return schools;
  } catch (error) {
    console.error('❌ Error loading schools:', error.message);
    process.exit(1);
  }
}

/**
 * Save verification report
 */
function saveReport(report) {
  try {
    const content = JSON.stringify(report, null, 2);
    fs.writeFileSync(REPORT_FILE, content, 'utf8');
    console.log(`\n💾 Report saved to: ${REPORT_FILE}`);
  } catch (error) {
    console.error('❌ Error saving report:', error.message);
  }
}

/**
 * Main verification function
 */
async function verifyAllLinks() {
  console.log('🔍 Verifying School Links');
  console.log('==========================\n');

  // Load schools
  const schools = loadSchools();
  console.log(`📚 Loaded ${schools.length} schools\n`);

  const report = {
    timestamp: new Date().toISOString(),
    totalSchools: schools.length,
    summary: {
      validSitesLinks: 0,
      invalidSitesLinks: 0,
      missingSitesLinks: 0,
      validDriveLinks: 0,
      invalidDriveLinks: 0,
      missingDriveLinks: 0,
      fullyValid: 0,
      partiallyValid: 0,
      invalid: 0,
    },
    schools: [],
  };

  // Process each school
  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    const progress = `[${i + 1}/${schools.length}]`;

    console.log(`${progress} Verifying: ${school.name} (${school.id})`);

    try {
      const result = await verificationService.verifySchoolLinks(school);
      // Add local PDF information
      result.localPdfCount = getLocalPdfCount(school.id);
      result.localPdfFiles = getLocalPdfFiles(school.id);
      report.schools.push(result);

      // Update summary
      if (result.sitesLink.valid) {
        report.summary.validSitesLinks++;
      } else if (school.schoolPageLink) {
        report.summary.invalidSitesLinks++;
      } else {
        report.summary.missingSitesLinks++;
      }

      if (result.driveLinkResult.valid) {
        report.summary.validDriveLinks++;
      } else if (school.driveLink) {
        report.summary.invalidDriveLinks++;
      } else {
        report.summary.missingDriveLinks++;
      }

      if (result.overallValid) {
        report.summary.fullyValid++;
        console.log(`   ✅ Valid (Sites: ✅, Drive: ✅ ${result.driveLinkResult.pdfCount} PDFs)`);
      } else if (result.sitesLink.valid || result.driveLinkResult.valid) {
        report.summary.partiallyValid++;
        const sitesStatus = result.sitesLink.valid ? '✅' : '❌';
        const driveStatus = result.driveLinkResult.valid ? '✅' : '❌';
        console.log(`   ⚠️  Partial (Sites: ${sitesStatus}, Drive: ${driveStatus})`);
      } else {
        report.summary.invalid++;
        console.log(`   ❌ Invalid (Sites: ❌, Drive: ❌)`);
      }

      // Add delay between schools
      if (i < schools.length - 1) {
        await verificationService.delay();
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      report.schools.push({
        schoolId: school.id,
        schoolName: school.name,
        error: error.message,
        overallValid: false,
      });
      report.summary.invalid++;
    }
  }

  // Save report
  saveReport(report);

  // Print summary
  console.log('\n📊 Verification Summary');
  console.log('==========================');
  console.log(`Total schools: ${report.summary.totalSchools}`);
  console.log(`✅ Fully valid: ${report.summary.fullyValid}`);
  console.log(`⚠️  Partially valid: ${report.summary.partiallyValid}`);
  console.log(`❌ Invalid: ${report.summary.invalid}`);
  console.log(`\nGoogle Sites Links:`);
  console.log(`  ✅ Valid: ${report.summary.validSitesLinks}`);
  console.log(`  ❌ Invalid: ${report.summary.invalidSitesLinks}`);
  console.log(`  ⚠️  Missing: ${report.summary.missingSitesLinks}`);
  console.log(`\nDrive Links:`);
  console.log(`  ✅ Valid: ${report.summary.validDriveLinks}`);
  console.log(`  ❌ Invalid: ${report.summary.invalidDriveLinks}`);
  console.log(`  ⚠️  Missing: ${report.summary.missingDriveLinks}`);

  // List invalid schools
  const invalidSchools = report.schools.filter(s => !s.overallValid && !s.error);
  if (invalidSchools.length > 0) {
    console.log(`\n❌ Schools with issues:`);
    invalidSchools.forEach(school => {
      console.log(`  - ${school.schoolName} (${school.schoolId})`);
      if (school.sitesLink && school.sitesLink.errors.length > 0) {
        console.log(`    Sites: ${school.sitesLink.errors.join(', ')}`);
      }
      if (school.driveLinkResult && school.driveLinkResult.errors.length > 0) {
        console.log(`    Drive: ${school.driveLinkResult.errors.join(', ')}`);
      }
    });
  }

  console.log('\n✅ Verification complete!');
}

// Run verification
verifyAllLinks().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});










