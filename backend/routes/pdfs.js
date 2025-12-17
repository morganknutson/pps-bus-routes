import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

/**
 * Serve PDF file for a school
 * GET /api/pdfs/:schoolId/:filename
 */
router.get('/:schoolId/:filename', (req, res) => {
  try {
    const { schoolId, filename } = req.params;
    
    // Security: Ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Ensure filename ends with .pdf
    if (!filename.endsWith('.pdf')) {
      return res.status(400).json({ error: 'File must be a PDF' });
    }
    
    const pdfPath = path.join(DATA_DIR, 'schools', schoolId, 'pdfs', filename);
    
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: 'PDF not found' });
    }
    
    // Set appropriate headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('[PDFs] Error streaming PDF:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading PDF file' });
      }
    });
  } catch (error) {
    console.error('[PDFs] Error serving PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as pdfsRouter };






