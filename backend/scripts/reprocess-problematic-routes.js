import { processSinglePDF } from '../services/routeProcessor.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const routesToReprocess = [
  {
    pdfPath: 'data/schools/west-sylvan/pdfs/100SYL-A_effective_082625.pdf',
    schoolId: 'west-sylvan'
  },
  {
    pdfPath: 'data/schools/west-sylvan/pdfs/100SYL-P_effective_082625.pdf',
    schoolId: 'west-sylvan'
  },
  {
    pdfPath: 'data/schools/dr-martin-luther-king/pdfs/206MLK-A_effective_102225.pdf',
    schoolId: 'dr-martin-luther-king'
  },
  {
    pdfPath: 'data/schools/dr-martin-luther-king/pdfs/206MLK-P_effective_102225.pdf',
    schoolId: 'dr-martin-luther-king'
  },
  {
    pdfPath: 'data/schools/astor/pdfs/202AST-A_effective_082625.pdf',
    schoolId: 'astor'
  },
  {
    pdfPath: 'data/schools/astor/pdfs/202AST-P_effective_082625.pdf',
    schoolId: 'astor'
  }
];

async function main() {
  console.log('🔄 Reprocessing problematic routes...');

  for (const item of routesToReprocess) {
    const fullPdfPath = path.join(__dirname, '..', '..', item.pdfPath);
    
    if (!fs.existsSync(fullPdfPath)) {
      console.error(`❌ PDF not found: ${fullPdfPath}`);
      continue;
    }

    console.log(`\n📄 Processing: ${item.pdfPath} for school ${item.schoolId}`);
    
    try {
      const pdfBuffer = fs.readFileSync(fullPdfPath);
      const filename = path.basename(fullPdfPath);
      
      await processSinglePDF(pdfBuffer, filename, null, {
        logPrefix: `[Reprocess]`,
        saveToFile: true,
        schoolId: item.schoolId
      });
      
      console.log(`✅ Successfully reprocessed ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to reprocess ${item.pdfPath}:`, error.message);
    }
  }

  // Cleanup: Delete incorrect files from Benson
  const bensonRoutesToDelete = [
    'data/schools/benson/processed-routes/202AST-A_effective_082625.json',
    'data/schools/benson/processed-routes/202AST-P_effective_082625.json'
  ];

  console.log('\n🧹 Cleaning up incorrect Benson routes...');
  for (const relPath of bensonRoutesToDelete) {
    const fullPath = path.join(__dirname, '..', '..', relPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`🗑️ Deleted: ${relPath}`);
    }
  }

  console.log('\n✨ All tasks complete!');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});




