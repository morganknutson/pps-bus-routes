import express from 'express';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { processSinglePDF } from '../services/routeProcessor.js';
import { getSchoolIdFromFilename } from '../utils/schoolUtils.js';
import { pdfMetadataService } from '../services/pdfMetadataService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');

/**
 * Check if a school has processed routes
 */
async function hasProcessedRoutes(schoolId) {
  const processedRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
  if (!fs.existsSync(processedRoutesDir)) {
    return false;
  }
  const files = (await fsPromises.readdir(processedRoutesDir)).filter(f => f.endsWith('.json'));
  return files.length > 0;
}

/**
 * Clean up processed routes that don't have corresponding PDFs
 * This removes routes that were processed but their PDFs have been deleted
 */
async function cleanupOrphanedProcessedRoutes(schoolId) {
  const processedRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
  if (!fs.existsSync(processedRoutesDir)) {
    return { deleted: 0, errors: [] };
  }

  // Get list of current PDF files (from metadata or filesystem)
  const pdfDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
  let currentPdfFiles = new Set();
  
  // Try to get from metadata first (more accurate)
  const metadata = await pdfMetadataService.loadMetadata(schoolId);
  if (metadata.files && Object.keys(metadata.files).length > 0) {
    // Get all local paths from metadata
    Object.values(metadata.files).forEach(file => {
      if (file.localPath) {
        currentPdfFiles.add(file.localPath);
      }
    });
  }
  
  // Fall back to filesystem if metadata is empty
  if (currentPdfFiles.size === 0 && fs.existsSync(pdfDir)) {
    const pdfFiles = (await fsPromises.readdir(pdfDir)).filter(f => f.endsWith('.pdf'));
    pdfFiles.forEach(file => currentPdfFiles.add(file));
  }

  // Get all processed route files
  const processedRouteFiles = (await fsPromises.readdir(processedRoutesDir))
    .filter(f => f.endsWith('.json'));

  let deleted = 0;
  const errors = [];

  for (const routeFile of processedRouteFiles) {
    // Extract PDF filename from route filename
    // Route files are typically named like: "238ABE-A_effective_082625.json"
    // PDF files are typically named like: "238ABE-A_effective_082625.pdf"
    const pdfFileName = routeFile.replace(/\.json$/, '.pdf');
    
    // Check if corresponding PDF exists
    if (!currentPdfFiles.has(pdfFileName)) {
      try {
        const routeFilePath = path.join(processedRoutesDir, routeFile);
        await fsPromises.unlink(routeFilePath);
        console.log(`[ProcessPdfs] Deleted orphaned processed route: ${routeFile} (PDF ${pdfFileName} no longer exists)`);
        deleted++;
      } catch (error) {
        console.error(`[ProcessPdfs] Error deleting orphaned route ${routeFile}:`, error);
        errors.push({
          file: routeFile,
          error: error.message,
        });
      }
    }
  }

  return { deleted, errors };
}

/**
 * Process all PDFs for a school (batch processing)
 * Uses the shared processSinglePDF function with limited parallelism
 */
async function processBatchPDFs(schoolId, pdfFiles, pdfDir) {
  const CONCURRENCY = 2; // Process 2 PDFs at a time
  const processed = [];
  const errors = [];
  const processedRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
  
  if (!fs.existsSync(processedRoutesDir)) {
    await fsPromises.mkdir(processedRoutesDir, { recursive: true });
  }

  // Clean up orphaned processed routes before processing
  const cleanupResult = await cleanupOrphanedProcessedRoutes(schoolId);
  if (cleanupResult.deleted > 0) {
    console.log(`[ProcessPdfs] Cleaned up ${cleanupResult.deleted} orphaned processed route(s) for ${schoolId}`);
  }

  // Process in chunks
  for (let i = 0; i < pdfFiles.length; i += CONCURRENCY) {
    const chunk = pdfFiles.slice(i, i + CONCURRENCY);
    const chunkPromises = chunk.map(async (pdfFile) => {
      try {
        const pdfPath = path.join(pdfDir, pdfFile);
        
        // Verify PDF file exists
        if (!fs.existsSync(pdfPath)) {
          errors.push({ file: pdfFile, error: `PDF file not found: ${pdfPath}` });
          return;
        }
        
        const pdfBuffer = await fsPromises.readFile(pdfPath);

        // Process using shared processor
        // ALWAYS pass schoolId from folder structure - this is the source of truth
        const finalRoute = await processSinglePDF(pdfBuffer, pdfFile, pdfFile, {
          logPrefix: '[ProcessPdfs]',
          saveToFile: true,
          schoolId: schoolId, // CRITICAL: Always pass schoolId from folder structure
        });

        processed.push({
          file: pdfFile,
          routeName: finalRoute.name || 'Unknown',
          stops: finalRoute.stops ? finalRoute.stops.length : 0,
          geocoded: finalRoute.stats ? finalRoute.stats.geocodedStops : 0,
          totalStops: finalRoute.stats ? finalRoute.stats.totalStops : 0,
          failedStops: finalRoute.stats ? finalRoute.stats.failedStops : 0,
        });
      } catch (error) {
        console.error(`[ProcessPdfs] Error processing ${pdfFile}:`, error.message);
        errors.push({ 
          file: pdfFile, 
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    });

    await Promise.all(chunkPromises);
    
    // Minimal delay between chunks to keep event loop responsive but faster than before
    if (i + CONCURRENCY < pdfFiles.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return { processed, errors, cleanupResult };
}

/**
 * Get processing status for all schools
 * Returns both whether routes exist and the last processed timestamp
 */
router.get('/status', async (req, res) => {
  try {
    const schools = JSON.parse(await fsPromises.readFile(SCHOOLS_FILE, 'utf8'));
    const status = {};
    
    for (const school of schools) {
      const processedRoutesDir = path.join(DATA_DIR, 'schools', school.id, 'processed-routes');
      if (!fs.existsSync(processedRoutesDir)) {
        status[school.id] = { hasProcessed: false, lastProcessed: null };
        continue;
      }
      
      const files = (await fsPromises.readdir(processedRoutesDir)).filter(f => f.endsWith('.json'));
      if (files.length === 0) {
        status[school.id] = { hasProcessed: false, lastProcessed: null };
        continue;
      }
      
      // Get the most recent file modification time
      let mostRecentTime = 0;
      for (const file of files) {
        const filePath = path.join(processedRoutesDir, file);
        try {
          const stats = await fsPromises.stat(filePath);
          if (stats.mtime.getTime() > mostRecentTime) {
            mostRecentTime = stats.mtime.getTime();
          }
        } catch (err) {
          // Skip files that can't be stat'd
        }
      }
      
      status[school.id] = {
        hasProcessed: true,
        lastProcessed: mostRecentTime > 0 ? new Date(mostRecentTime).toISOString() : null,
      };
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
    const schools = JSON.parse(await fsPromises.readFile(SCHOOLS_FILE, 'utf8'));
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

    const pdfFiles = (await fsPromises.readdir(pdfDir)).filter(f => f.endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      return res.status(400).json({ error: 'No PDF files found in PDF directory' });
    }

    // Create processed routes directory
    const processedRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
    if (!fs.existsSync(processedRoutesDir)) {
      await fsPromises.mkdir(processedRoutesDir, { recursive: true });
    }

    // Process all PDFs using batch processor (which uses shared single processor)
    const { processed, errors, cleanupResult } = await processBatchPDFs(schoolId, pdfFiles, pdfDir);

    res.json({
      schoolId,
      schoolName: school.name,
      processed: processed.length,
      errors: errors.length,
      processedDetails: processed,
      errorDetails: errors,
      cleanup: {
        orphanedRoutesDeleted: cleanupResult.deleted || 0,
        cleanupErrors: cleanupResult.errors || [],
      },
      summary: {
        totalPdfs: pdfFiles.length,
        successful: processed.length,
        failed: errors.length,
        totalRoutesProcessed: processed.length,
        totalStopsProcessed: processed.reduce((sum, p) => sum + (p.stops || 0), 0),
        totalStopsGeocoded: processed.reduce((sum, p) => sum + (p.geocoded || 0), 0),
      },
    });
  } catch (error) {
    console.error('Error processing PDFs:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as processPdfsRouter };
