import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_DIR = path.join(DATA_DIR, 'schools');

// Portland Metro Bounding Box
const MIN_LAT = 45.3;
const MAX_LAT = 45.7;
const MIN_LNG = -123.0;
const MAX_LNG = -122.3;

async function findStrangeStops() {
  console.log('🔍 Searching for strange or incorrect stops in all routes...');
  console.log('=========================================================\n');

  const issues = [];
  const schools = fs.readdirSync(SCHOOLS_DIR).filter(f => 
    fs.statSync(path.join(SCHOOLS_DIR, f)).isDirectory()
  );

  let totalRoutes = 0;
  let totalStops = 0;

  for (const schoolId of schools) {
    const processedRoutesPath = path.join(SCHOOLS_DIR, schoolId, 'processed-routes');
    if (!fs.existsSync(processedRoutesPath)) continue;

    const routeFiles = fs.readdirSync(processedRoutesPath).filter(f => f.endsWith('.json'));

    for (const routeFile of routeFiles) {
      totalRoutes++;
      const routePath = path.join(processedRoutesPath, routeFile);
      const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));

      if (!route.stops) continue;

      route.stops.forEach((stop, index) => {
        totalStops++;
        const stopIssue = {
          schoolId,
          routeFile,
          routeName: route.name,
          stopIndex: index,
          stopAddress: stop.address,
          stopCoordinates: stop.coordinates,
          reasons: []
        };

        if (!stop.coordinates) {
          stopIssue.reasons.push('Missing coordinates');
        } else {
          const [lng, lat] = stop.coordinates;

          if (lng === 0 && lat === 0) {
            stopIssue.reasons.push('Coordinates are [0, 0]');
          } else if (lat < MIN_LAT || lat > MAX_LAT || lng < MIN_LNG || lng > MAX_LNG) {
            stopIssue.reasons.push(`Coordinates [${lng}, ${lat}] are outside Portland Metro area`);
          }
        }

        if (stopIssue.reasons.length > 0) {
          issues.push(stopIssue);
        }
      });
    }
  }

  console.log(`📊 Scanned ${totalRoutes} routes and ${totalStops} stops.`);
  console.log(`❌ Found ${issues.length} stops with potential issues.\n`);

  if (issues.length > 0) {
    // Group by school for better readability
    const groupedIssues = issues.reduce((acc, issue) => {
      if (!acc[issue.schoolId]) acc[issue.schoolId] = [];
      acc[issue.schoolId].push(issue);
      return acc;
    }, {});

    for (const schoolId in groupedIssues) {
      console.log(`School: ${schoolId}`);
      groupedIssues[schoolId].forEach(issue => {
        console.log(`  - Route: ${issue.routeName} (${issue.routeFile})`);
        console.log(`    Stop #${issue.stopIndex + 1}: ${issue.stopAddress}`);
        console.log(`    Issues: ${issue.reasons.join(', ')}`);
        if (issue.stopCoordinates) {
          console.log(`    Coords: [${issue.stopCoordinates.join(', ')}]`);
        }
      });
      console.log('');
    }

    const reportPath = path.join(DATA_DIR, 'strange-stops-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      summary: {
        totalRoutes,
        totalStops,
        totalIssues: issues.length
      },
      issues
    }, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  } else {
    console.log('✅ No strange stops found!');
  }
}

findStrangeStops().catch(console.error);

