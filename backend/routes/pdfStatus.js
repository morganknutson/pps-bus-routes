import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const STATUS_FILE = path.join(__dirname, '..', '..', 'data', 'pdf-status.json');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

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
 * Get PDF status report
 */
router.get('/status', (req, res) => {
  try {
    console.log('[pdfStatus] GET /status - checking for status file:', STATUS_FILE);
    if (fs.existsSync(STATUS_FILE)) {
      console.log('[pdfStatus] Status file exists, reading...');
      const content = fs.readFileSync(STATUS_FILE, 'utf8');
      const report = JSON.parse(content);
      console.log('[pdfStatus] Returning cached report with', report.schools?.length || 0, 'schools');
      res.json(report);
    } else {
      console.log('[pdfStatus] Status file does not exist, generating on-the-fly...');
      const schoolsFile = path.join(DATA_DIR, 'schools.json');
      console.log('[pdfStatus] Checking for schools file:', schoolsFile);
      
      if (!fs.existsSync(schoolsFile)) {
        console.error('[pdfStatus] Schools file does not exist:', schoolsFile);
        return res.status(404).json({ 
          error: 'Schools file not found. Please ensure data/schools.json exists.',
          path: schoolsFile
        });
      }

      const schoolsContent = fs.readFileSync(schoolsFile, 'utf8');
      const schools = JSON.parse(schoolsContent);
      console.log('[pdfStatus] Loaded', schools.length, 'schools from schools.json');
      
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
        report.schools.push({
          schoolId: school.id,
          schoolName: school.name,
          driveLink: school.driveLink,
          pdfCount: pdfInfo.count,
          pdfFiles: pdfInfo.files,
          hasPdfs: pdfInfo.count > 0,
          hasDriveLink: !!school.driveLink,
        });

        if (pdfInfo.count > 0) {
          report.summary.schoolsWithPdfs++;
          report.summary.totalPdfs += pdfInfo.count;
        } else if (school.driveLink) {
          report.summary.schoolsWithoutPdfs++;
        }
        
        if (school.driveLink) {
          report.summary.schoolsWithDriveLink++;
        }
      }

      console.log('[pdfStatus] Generated report:', {
        totalSchools: report.totalSchools,
        schoolsWithPdfs: report.summary.schoolsWithPdfs,
        schoolsWithoutPdfs: report.summary.schoolsWithoutPdfs,
        totalPdfs: report.summary.totalPdfs
      });
      res.json(report);
    }
  } catch (error) {
    console.error('[pdfStatus] Error loading PDF status:', error);
    console.error('[pdfStatus] Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
});

export { router as pdfStatusRouter };
