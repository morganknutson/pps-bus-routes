import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processSinglePDF } from '../services/routeProcessor.js';
import { getSchoolIdFromFilename } from '../utils/schoolUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');

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
 * Process all PDFs for a school (batch processing)
 * Uses the shared processSinglePDF function
 */
async function processBatchPDFs(schoolId, pdfFiles, pdfDir) {
  const processed = [];
  const errors = [];
  const processedRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
  
  if (!fs.existsSync(processedRoutesDir)) {
    fs.mkdirSync(processedRoutesDir, { recursive: true });
  }

  for (const pdfFile of pdfFiles) {
    try {
      const pdfPath = path.join(pdfDir, pdfFile);
      const pdfBuffer = fs.readFileSync(pdfPath);

      // Process using shared processor
      const finalRoute = await processSinglePDF(pdfBuffer, pdfFile, pdfFile, {
        logPrefix: '[ProcessPdfs]',
        saveToFile: true,
      });

      processed.push({
        file: pdfFile,
        routeName: finalRoute.name,
        stops: finalRoute.stops.length,
        geocoded: finalRoute.stats.geocodedStops,
      });

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      errors.push({ file: pdfFile, error: error.message });
    }
  }

  return { processed, errors };
}

/**
 * Get processing status for all schools
 */
router.get('/status', (req, res) => {
  try {
    const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
    const status = {};
    
    for (const school of schools) {
      status[school.id] = hasProcessedRoutes(school.id);
    }
    
    res.json(status);
  } catch (error) {
    console.error('Error getting processing status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process all PDFs for a school
 */
router.post('/process/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;
    const apiKey = process.env.GOOGLE_API_KEY || null;

    // Load schools
    const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
    const school = schools.find(s => s.id === schoolId);

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    if (!school.driveLink) {
      return res.status(400).json({ error: 'School has no Drive link configured' });
    }

    // Extract folder ID
    const folderIdMatch = school.driveLink.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/);
    if (!folderIdMatch) {
      return res.status(400).json({ error: 'Invalid Drive link format' });
    }
    const folderId = folderIdMatch[1];

    // Get PDF directory
    const pdfDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
    if (!fs.existsSync(pdfDir)) {
      return res.status(400).json({ error: 'No PDFs found for this school. Download PDFs first.' });
    }

    const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      return res.status(400).json({ error: 'No PDF files found in PDF directory' });
    }

    // Create processed routes directory
    const processedRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
    if (!fs.existsSync(processedRoutesDir)) {
      fs.mkdirSync(processedRoutesDir, { recursive: true });
    }

    // Process all PDFs using batch processor (which uses shared single processor)
    const { processed, errors } = await processBatchPDFs(schoolId, pdfFiles, pdfDir);

    res.json({
      schoolId,
      processed: processed.length,
      errors: errors.length,
      details: {
        processed,
        errors,
      },
    });
  } catch (error) {
    console.error('Error processing PDFs:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as processPdfsRouter };
