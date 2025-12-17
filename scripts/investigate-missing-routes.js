import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');

// Schools that have PDFs but no routes
const schoolsToCheck = [
  'gray', 'hayhurst', 'hosford', 'jackson', 'james-john', 'kelly', 
  'kellogg', 'lane', 'lee', 'lent', 'lincoln', 'maplewood', 'markham',
  'ockley-green', 'peninsula', 'richmond', 'rieke', 'rigler', 'rosa-parks',
  'rose-city-park', 'roseway-heights', 'sabin', 'scott', 'sellwood', 'sitton',
  'skyline', 'stephenson', 'tubman', 'vernon', 'vestal', 'whitman', 
  'woodlawn', 'woodmere', 'woodstock', 'harrison-park'
];

async function investigate() {
  console.log('🔍 Investigating Missing Routes');
  console.log('================================\n');

  const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
  
  for (const schoolId of schoolsToCheck) {
    const school = schools.find(s => s.id === schoolId);
    if (!school) {
      console.log(`⚠️  School not found: ${schoolId}`);
      continue;
    }

    const pdfDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
    const routesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
    
    const hasPdfs = fs.existsSync(pdfDir) && 
      fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf')).length > 0;
    const hasRoutes = fs.existsSync(routesDir) && 
      fs.readdirSync(routesDir).filter(f => f.endsWith('.json')).length > 0;
    
    if (hasPdfs && !hasRoutes) {
      const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
      console.log(`\n📄 ${school.name} (${schoolId}):`);
      console.log(`   PDFs: ${pdfFiles.length} files`);
      console.log(`   Routes: 0 files`);
      console.log(`   PDF directory exists: ${fs.existsSync(pdfDir)}`);
      console.log(`   Routes directory exists: ${fs.existsSync(routesDir)}`);
      
      // Check if routes directory was ever created
      if (!fs.existsSync(routesDir)) {
        console.log(`   ⚠️  Routes directory was never created`);
      } else {
        console.log(`   ⚠️  Routes directory exists but is empty`);
      }
      
      // Check first few PDF filenames
      console.log(`   Sample PDFs:`);
      pdfFiles.slice(0, 3).forEach(pdf => {
        console.log(`      - ${pdf}`);
      });
    }
  }
  
  console.log('\n✅ Investigation complete');
}

investigate().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

