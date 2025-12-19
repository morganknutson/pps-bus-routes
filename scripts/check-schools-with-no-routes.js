import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');

/**
 * Get route count for a school
 * Counts unique routes (morning and afternoon versions of the same route count as 1)
 */
async function getRouteCount(schoolId) {
  try {
    const schoolRoutesDir = path.join(DATA_DIR, 'schools', schoolId, 'processed-routes');
    
    // Check if directory exists
    try {
      await fs.promises.access(schoolRoutesDir);
    } catch {
      return 0; // Directory doesn't exist = 0 routes
    }

    const files = (await fs.promises.readdir(schoolRoutesDir)).filter(f => f.endsWith('.json'));
    
    if (files.length === 0) {
      return 0;
    }
    
    // Track unique route names (morning and afternoon versions count as 1 route)
    const uniqueRouteNames = new Set();
    
    // Read all files in parallel
    const routePromises = files.map(async (filename) => {
      try {
        const filePath = path.join(schoolRoutesDir, filename);
        const content = await fs.promises.readFile(filePath, 'utf8');
        const route = JSON.parse(content);
        
        // Extract route name, handling both new and old formats
        let routeName = route.name;
        let direction = route.direction;
        
        // Migrate old format routes (name with (AM)/(PM) -> separate direction)
        const amMatch = routeName && routeName.match(/^(\d+)\s*\(AM\)$/);
        const pmMatch = routeName && routeName.match(/^(\d+)\s*\(PM\)$/);
        
        if (amMatch && !direction) {
          routeName = amMatch[1]; // Just the number
          direction = 'Morning';
        } else if (pmMatch && !direction) {
          routeName = pmMatch[1]; // Just the number
          direction = 'Afternoon';
        }
        
        // Use route name as the unique identifier (ignoring direction)
        if (routeName) {
          uniqueRouteNames.add(routeName);
        }
      } catch (error) {
        console.error(`   ⚠️  Error reading route file ${filename} for school ${schoolId}:`, error.message);
      }
    });

    await Promise.all(routePromises);
    
    return uniqueRouteNames.size;
  } catch (error) {
    console.error(`   ⚠️  Error checking routes for school ${schoolId}:`, error.message);
    return 0;
  }
}

/**
 * Check if a school has PDFs downloaded
 */
async function hasPdfs(schoolId) {
  try {
    const schoolPdfsDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
    
    // Check if directory exists
    try {
      await fs.promises.access(schoolPdfsDir);
    } catch {
      return false; // Directory doesn't exist
    }

    // Check if directory has any PDF files
    const files = await fs.promises.readdir(schoolPdfsDir);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    
    return pdfFiles.length > 0;
  } catch (error) {
    return false;
  }
}

async function findSchoolsWithNoRoutes() {
  console.log('🔍 Finding Schools with No Routes');
  console.log('==================================\n');

  // Load schools
  if (!fs.existsSync(SCHOOLS_FILE)) {
    console.error(`❌ Schools file not found: ${SCHOOLS_FILE}`);
    process.exit(1);
  }

  const schools = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
  console.log(`📚 Total schools: ${schools.length}\n`);

  const schoolsWithNoRoutes = [];
  const schoolsWithPdfsButNoRoutes = [];
  const schoolsWithNoPdfs = [];

  // Check each school
  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    process.stdout.write(`\r   Checking ${i + 1}/${schools.length}: ${school.name}...`);
    
    const routeCount = await getRouteCount(school.id);
    const hasPdf = await hasPdfs(school.id);
    
    if (routeCount === 0) {
      schoolsWithNoRoutes.push({
        ...school,
        routeCount: 0,
        hasPdfs: hasPdf,
      });
      
      if (hasPdf) {
        schoolsWithPdfsButNoRoutes.push(school);
      } else {
        schoolsWithNoPdfs.push(school);
      }
    }
  }

  process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear line

  console.log('\n📊 Results:\n');
  console.log(`   Schools with 0 routes: ${schoolsWithNoRoutes.length}`);
  console.log(`   └─ Schools with PDFs but no routes: ${schoolsWithPdfsButNoRoutes.length}`);
  console.log(`   └─ Schools with no PDFs: ${schoolsWithNoPdfs.length}\n`);

  if (schoolsWithNoRoutes.length > 0) {
    console.log('🚫 Schools with 0 Routes:');
    console.log('='.repeat(80));
    
    // Group by whether they have PDFs
    if (schoolsWithPdfsButNoRoutes.length > 0) {
      console.log('\n📄 Schools with PDFs but NO processed routes (need processing):');
      console.log('-'.repeat(80));
      schoolsWithPdfsButNoRoutes.forEach((school, index) => {
        console.log(`   ${index + 1}. ${school.name} (ID: ${school.id})`);
        if (school.address) {
          console.log(`      Address: ${school.address}`);
        }
      });
    }

    if (schoolsWithNoPdfs.length > 0) {
      console.log('\n📭 Schools with NO PDFs (need download):');
      console.log('-'.repeat(80));
      schoolsWithNoPdfs.forEach((school, index) => {
        console.log(`   ${index + 1}. ${school.name} (ID: ${school.id})`);
        if (school.address) {
          console.log(`      Address: ${school.address}`);
        }
        if (school.driveLink) {
          console.log(`      Drive Link: ${school.driveLink}`);
        }
      });
    }

    // Save to JSON file
    const outputFile = path.join(DATA_DIR, 'schools-with-no-routes.json');
    const output = {
      generatedAt: new Date().toISOString(),
      total: schoolsWithNoRoutes.length,
      withPdfs: schoolsWithPdfsButNoRoutes.length,
      withoutPdfs: schoolsWithNoPdfs.length,
      schools: schoolsWithNoRoutes.map(s => ({
        id: s.id,
        name: s.name,
        address: s.address,
        hasPdfs: s.hasPdfs,
        driveLink: s.driveLink,
      })),
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\n💾 Results saved to: ${outputFile}`);
  } else {
    console.log('✅ All schools have routes!');
  }
}

// Run the script
findSchoolsWithNoRoutes().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});




