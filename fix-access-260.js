import { processSinglePDF } from './backend/services/routeProcessor.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const routes = [
  {
    path: 'data/schools/access/pdfs/260ACC-A_effective_110325.pdf',
    schoolId: 'access'
  },
  {
    path: 'data/schools/access/pdfs/260ACC-P_effective_102225.pdf',
    schoolId: 'access'
  }
];

async function run() {
  for (const route of routes) {
    const pdfPath = path.resolve(__dirname, route.path);
    if (!fs.existsSync(pdfPath)) {
      console.error(`File not found: ${pdfPath}`);
      continue;
    }
    
    console.log(`Processing ${route.path}...`);
    const pdfBuffer = fs.readFileSync(pdfPath);
    const filename = path.basename(route.path);
    
    try {
      await processSinglePDF(pdfBuffer, filename, null, {
        logPrefix: '[Fix]',
        saveToFile: true,
        schoolId: route.schoolId
      });
      console.log(`Successfully fixed ${filename}`);
    } catch (error) {
      console.error(`Failed to fix ${filename}:`, error);
    }
  }
}

run();

