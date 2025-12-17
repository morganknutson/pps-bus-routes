import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use absolute paths
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const STATUS_FILE = path.join(DATA_DIR, 'pdf-status.json');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');

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
 * Check if a school has processed routes
 */
function hasProcessedRoutes(schoolId) {
  const processedRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
  if (!fs.existsSync(processedRoutesDir)) {
    return false;
  }
  const files = fs.readdirSync(processedRoutesDir).filter(f => f.endsWith('.json'));
  return files.length > 0;
}

/**
 * Generate fresh PDF status report by scanning filesystem
 */
function generatePdfStatus() {
  if (!fs.existsSync(SCHOOLS_FILE)) {
    throw new Error('Schools file not found');
  }

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

  return report;
}

/**
 * Generate processing status for all schools
 */
function generateProcessingStatus() {
  if (!fs.existsSync(SCHOOLS_FILE)) {
    throw new Error('Schools file not found');
  }

  const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
  const status = {};
  
  for (const school of schools) {
    status[school.id] = hasProcessedRoutes(school.id);
  }
  
  return status;
}

/**
 * Get PDF status report - ALWAYS generates fresh data from filesystem
 */
router.get('/status', (req, res) => {
  try {
    // Always generate fresh data by scanning filesystem
    const report = generatePdfStatus();
    
    // Set no-cache headers
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    res.json(report);
  } catch (error) {
    console.error('[pdfStatus] Error loading PDF status:', error);
    res.status(500).json({ 
      error: error.message,
    });
  }
});

/**
 * Refresh PDF status and processing status by scanning filesystem
 * Returns fresh data without relying on cached files
 */
router.post('/refresh-status', (req, res) => {
  try {
    console.log('[pdfStatus] Refreshing status from filesystem...');
    
    // Generate fresh PDF status
    const pdfStatus = generatePdfStatus();
    
    // Generate fresh processing status
    const processingStatus = generateProcessingStatus();
    
    console.log('[pdfStatus] Refresh complete:', {
      totalSchools: pdfStatus.totalSchools,
      schoolsWithPdfs: pdfStatus.summary.schoolsWithPdfs,
      schoolsProcessed: Object.values(processingStatus).filter(Boolean).length,
    });
    
    // Set no-cache headers
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    res.json({
      pdfStatus,
      processingStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[pdfStatus] Error refreshing status:', error);
    res.status(500).json({ 
      error: error.message,
    });
  }
});

export { router as pdfStatusRouter };
