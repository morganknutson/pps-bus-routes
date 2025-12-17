import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { verificationService } from '../services/verificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const REPORT_FILE = path.join(__dirname, '..', '..', 'data', 'verification-report.json');
const SCHOOLS_FILE = path.join(__dirname, '..', '..', 'data', 'schools.json');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

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
 * Get latest verification report
 */
router.get('/report', (req, res) => {
  try {
    if (!fs.existsSync(REPORT_FILE)) {
      return res.status(404).json({ error: 'Verification report not found. Run verification first.' });
    }

    const content = fs.readFileSync(REPORT_FILE, 'utf8');
    const report = JSON.parse(content);
    res.json(report);
  } catch (error) {
    console.error('Error loading verification report:', error);
    // Return 404 instead of 500 so frontend knows it's just missing, not an error
    res.status(404).json({ error: 'Verification report not found. Run verification first.' });
  }
});

/**
 * Verify a specific school
 */
router.post('/verify/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;

    // Load schools
    if (!fs.existsSync(SCHOOLS_FILE)) {
      return res.status(404).json({ error: 'Schools file not found' });
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    const school = schools.find(s => s.id === schoolId);

    if (!school) {
      return res.status(404).json({ error: `School not found: ${schoolId}` });
    }

    // Verify school links
    const result = await verificationService.verifySchoolLinks(school);
    // Add local PDF information
    result.localPdfCount = getLocalPdfCount(schoolId);
    result.localPdfFiles = getLocalPdfFiles(schoolId);
    res.json(result);
  } catch (error) {
    console.error('Error verifying school:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify all schools (triggers full verification)
 */
router.post('/verify-all', async (req, res) => {
  try {
    // Load schools
    if (!fs.existsSync(SCHOOLS_FILE)) {
      return res.status(404).json({ error: 'Schools file not found' });
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);

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

    // Verify each school
    for (const school of schools) {
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
        } else if (result.sitesLink.valid || result.driveLinkResult.valid) {
          report.summary.partiallyValid++;
        } else {
          report.summary.invalid++;
        }

        // Add delay
        await verificationService.delay();
      } catch (error) {
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
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

    res.json(report);
  } catch (error) {
    console.error('Error verifying all schools:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as verificationRouter };






