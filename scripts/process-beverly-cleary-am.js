/**
 * Process Beverly Cleary AM PDF directly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processSinglePDF } from '../backend/services/routeProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processAM() {
  const pdfPath = path.join(__dirname, '..', 'data', 'schools', 'beverly-cleary', 'pdfs', '207-AM_effective_082924.pdf');
  console.log('🔄 Processing Beverly Cleary AM PDF...\n');
  
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF file not found:', pdfPath);
    process.exit(1);
  }
  
  try {
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log('📄 PDF loaded, size:', pdfBuffer.length, 'bytes\n');
    
    const result = await processSinglePDF(pdfBuffer, '207-AM_effective_082924.pdf', '207-AM_effective_082924.pdf', {
      logPrefix: '[BeverlyCleary-AM]',
      saveToFile: true,
      schoolId: 'beverly-cleary',
    });
    
    console.log('\n✅ Success!');
    console.log('Route:', result.name);
    console.log('Direction:', result.direction);
    console.log('Total stops:', result.stats.totalStops);
    console.log('Geocoded stops:', result.stats.geocodedStops);
    console.log('Failed stops:', result.stats.failedStops);
    console.log('\n📁 Saved to: data/schools/beverly-cleary/processed-routes/207-AM_effective_082924.json');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

processAM();










