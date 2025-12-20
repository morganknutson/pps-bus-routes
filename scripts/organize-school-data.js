import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const DATA_DIR = path.join(projectRoot, 'data', 'schools');

async function organizeData() {
  try {
    const schools = await fs.readdir(DATA_DIR);
    console.log(`Auditing ${schools.length} schools...`);

    for (const schoolId of schools) {
      if (schoolId === '.DS_Store') continue;
      const schoolPath = path.join(DATA_DIR, schoolId);
      const stats = await fs.stat(schoolPath);
      if (!stats.isDirectory()) continue;

      const pdfDir = path.join(schoolPath, 'pdfs');
      const processedDir = path.join(schoolPath, 'processed-routes');

      // Ensure subdirectories exist
      if (!fsSync.existsSync(pdfDir)) {
        await fs.mkdir(pdfDir, { recursive: true });
        console.log(`Created pdfs dir for ${schoolId}`);
      }
      if (!fsSync.existsSync(processedDir)) {
        await fs.mkdir(processedDir, { recursive: true });
        console.log(`Created processed-routes dir for ${schoolId}`);
      }

      const files = await fs.readdir(schoolPath);
      for (const file of files) {
        const filePath = path.join(schoolPath, file);
        const fileStats = await fs.stat(filePath);
        if (!fileStats.isFile()) continue;

        // Skip metadata and other non-route files
        if (file === 'pdf-metadata.json' || file === '.DS_Store') continue;

        if (file.toLowerCase().endsWith('.pdf')) {
          const dest = path.join(pdfDir, file);
          await fs.rename(filePath, dest);
          console.log(`Moved ${file} to pdfs/ for ${schoolId}`);
        } else if (file.toLowerCase().endsWith('.json')) {
          const dest = path.join(processedDir, file);
          await fs.rename(filePath, dest);
          console.log(`Moved ${file} to processed-routes/ for ${schoolId}`);
        }
      }
    }
    console.log('Organization complete.');
  } catch (error) {
    console.error('Error organizing data:', error);
  }
}

organizeData();


