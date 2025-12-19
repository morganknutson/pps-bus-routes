/**
 * Generate PDF download status report
 * Lists all downloaded PDFs and schools where PDFs couldn't be grabbed
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHOOLS_FILE = path.join(__dirname, '..', 'data', 'schools.json');
const DATA_DIR = path.join(__dirname, '..', 'data');
const STATUS_FILE = path.join(__dirname, '..', 'data', 'pdf-status.json');

/**
 * Get PDF count and files for a school
 */
function getSchoolPdfInfo(schoolId) {
  const pdfDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
  if (fs.existsSync(pdfDir)) {
    const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
    return {
      count: files.length,
      files: files.sort(),
    };
  }
  return { count: 0, files: [] };
}

/**
 * Generate PDF status report
 */
function generatePdfStatus() {
  const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
  
  const report = {
    timestamp: new Date().toISOString(),
    totalSchools: schools.length,
    summary: {
      schoolsWithPdfs: 0,
      schoolsWithoutPdfs: 0,
      totalPdfs: 0,
      schoolsWithDriveLink: 0,
    },
    schools: [],
  };

  for (const school of schools) {
    const pdfInfo = getSchoolPdfInfo(school.id);
    const schoolStatus = {
      schoolId: school.id,
      schoolName: school.name,
      driveLink: school.driveLink,
      pdfCount: pdfInfo.count,
      pdfFiles: pdfInfo.files,
      hasPdfs: pdfInfo.count > 0,
      hasDriveLink: !!school.driveLink,
    };

    report.schools.push(schoolStatus);

    if (schoolStatus.hasDriveLink) {
      report.summary.schoolsWithDriveLink++;
    }
    if (schoolStatus.hasPdfs) {
      report.summary.schoolsWithPdfs++;
      report.summary.totalPdfs += pdfInfo.count;
    } else if (schoolStatus.hasDriveLink) {
      report.summary.schoolsWithoutPdfs++;
    }
  }

  // Save report
  fs.writeFileSync(STATUS_FILE, JSON.stringify(report, null, 2), 'utf8');
  
  console.log('📊 PDF Status Report');
  console.log('===================');
  console.log(`Total schools: ${report.summary.totalSchools}`);
  console.log(`Schools with PDFs: ${report.summary.schoolsWithPdfs}`);
  console.log(`Schools without PDFs (but have Drive link): ${report.summary.schoolsWithoutPdfs}`);
  console.log(`Total PDFs downloaded: ${report.summary.totalPdfs}`);
  console.log(`\nReport saved to: ${STATUS_FILE}`);
  
  return report;
}

generatePdfStatus();










