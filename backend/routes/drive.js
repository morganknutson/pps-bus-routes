import express from 'express';
import pdfParse from 'pdf-parse';
import { parseRouteFromPDF } from '../services/pdfParser.js';
import { listFolderFiles, downloadFile } from '../services/driveService.js';

const router = express.Router();

// List all PDFs in a folder
router.get('/folder/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const apiKey = process.env.GOOGLE_API_KEY || null; // Optional

    const files = await listFolderFiles(folderId, apiKey);
    
    res.json({
      files: files.map(file => ({
        id: file.id,
        name: file.name,
        modifiedTime: file.modifiedTime,
      })),
    });
  } catch (error) {
    console.error('Error listing folder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download and parse a PDF file
router.get('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const apiKey = process.env.GOOGLE_API_KEY || null; // Optional

    // Download file
    const { buffer, name } = await downloadFile(fileId, apiKey);

    // Parse PDF
    const pdfData = await pdfParse(buffer);
    
    // Extract route information
    const route = parseRouteFromPDF(pdfData.text, fileId, name);

    res.json({
      route,
      rawText: pdfData.text.substring(0, 500), // First 500 chars for debugging
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch and parse all PDFs in a folder
router.post('/folder/:folderId/parse', async (req, res) => {
  try {
    const { folderId } = req.params;
    const apiKey = process.env.GOOGLE_API_KEY || null; // Optional

    // List files
    const files = await listFolderFiles(folderId, apiKey);
    const routes = [];

    // Process each PDF
    for (const file of files) {
      try {
        // Download PDF (works without API key for public files)
        const { buffer } = await downloadFile(file.id, apiKey);

        // Parse PDF
        const pdfData = await pdfParse(buffer);
        const route = parseRouteFromPDF(pdfData.text, file.id, file.name);

        if (route && route.stops.length > 0) {
          routes.push(route);
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error.message);
        // Continue with other files
      }
    }

    res.json({ routes });
  } catch (error) {
    console.error('Error parsing folder:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as driveRouter };

