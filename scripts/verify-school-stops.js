import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');

/**
 * Verify that all processed routes use the correct school addresses from schools.json
 */
async function verifySchoolStops() {
  console.log('🔍 Verifying School Stops in Processed Routes');
  console.log('=============================================\n');

  // Load schools.json
  if (!fs.existsSync(SCHOOLS_FILE)) {
    console.error(`❌ ERROR: schools.json not found at ${SCHOOLS_FILE}`);
    process.exit(1);
  }

  const schoolsContent = fs.readFileSync(SCHOOLS_FILE, 'utf8');
  const schools = JSON.parse(schoolsContent);
  
  // Create a map of school ID to school data for quick lookup
  const schoolsMap = new Map();
  schools.forEach(school => {
    schoolsMap.set(school.id, school);
  });

  console.log(`📚 Loaded ${schools.length} schools from schools.json\n`);

  // Find all processed route files
  const processedRoutesDirs = [
    path.join(DATA_DIR, 'processed-routes'),
    path.join(DATA_DIR, 'schools'),
  ];

  const routeFiles = [];
  
  // Check main processed-routes directory
  if (fs.existsSync(processedRoutesDirs[0])) {
    const files = fs.readdirSync(processedRoutesDirs[0])
      .filter(f => f.endsWith('.json'))
      .map(f => ({ path: path.join(processedRoutesDirs[0], f), schoolId: null }));
    routeFiles.push(...files);
  }

  // Check school-specific directories
  if (fs.existsSync(processedRoutesDirs[1])) {
    const schoolDirs = fs.readdirSync(processedRoutesDirs[1], { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const schoolDir of schoolDirs) {
      const processedRoutesPath = path.join(processedRoutesDirs[1], schoolDir, 'processed-routes');
      if (fs.existsSync(processedRoutesPath)) {
        const files = fs.readdirSync(processedRoutesPath)
          .filter(f => f.endsWith('.json'))
          .map(f => ({ 
            path: path.join(processedRoutesPath, f), 
            schoolId: schoolDir 
          }));
        routeFiles.push(...files);
      }
    }
  }

  console.log(`📁 Found ${routeFiles.length} processed route files\n`);

  if (routeFiles.length === 0) {
    console.log('⚠️  No processed route files found');
    return;
  }

  // Verify each route
  const results = {
    total: routeFiles.length,
    valid: 0,
    invalid: 0,
    missingSchoolStop: 0,
    issues: [],
  };

  for (const { path: routePath, schoolId } of routeFiles) {
    try {
      const routeContent = fs.readFileSync(routePath, 'utf8');
      const route = JSON.parse(routeContent);
      
      const filename = path.basename(routePath);
      
      // Find school stop in route
      const schoolStop = route.stops?.find(s => s.isSchoolStop === true);
      
      if (!schoolStop) {
        results.missingSchoolStop++;
        results.issues.push({
          file: filename,
          route: `${route.name} (${route.direction || 'Unknown'})`,
          issue: 'MISSING_SCHOOL_STOP',
          message: 'Route does not have a school stop (isSchoolStop: true)',
        });
        continue;
      }

      // Determine which school this route belongs to
      let expectedSchool = null;
      
      // Try to get school ID from filename or directory
      if (schoolId) {
        expectedSchool = schoolsMap.get(schoolId);
      } else {
        // Try to match by school name in the stop
        if (schoolStop.schoolName) {
          expectedSchool = schools.find(s => 
            s.name.toLowerCase() === schoolStop.schoolName.toLowerCase()
          );
        }
      }

      if (!expectedSchool) {
        results.invalid++;
        results.issues.push({
          file: filename,
          route: `${route.name} (${route.direction || 'Unknown'})`,
          issue: 'SCHOOL_NOT_FOUND',
          message: `Could not find matching school in schools.json for "${schoolStop.schoolName || 'unknown'}"`,
        });
        continue;
      }

      // Verify address matches exactly
      const addressMatches = schoolStop.address === expectedSchool.address;
      
      // Verify coordinates match
      const coordinatesMatch = JSON.stringify(schoolStop.coordinates) === 
                              JSON.stringify(expectedSchool.coordinates);

      // Verify placement
      const isMorning = route.direction === 'Morning';
      const isAfternoon = route.direction === 'Afternoon';
      const isFirstStop = route.stops[0]?.isSchoolStop === true;
      const isLastStop = route.stops[route.stops.length - 1]?.isSchoolStop === true;
      
      let placementCorrect = false;
      if (isMorning && isLastStop) {
        placementCorrect = true;
      } else if (isAfternoon && isFirstStop) {
        placementCorrect = true;
      } else if (!isMorning && !isAfternoon) {
        // Unknown direction - placement doesn't matter
        placementCorrect = true;
      }

      // Check if there are any issues
      const issues = [];
      if (!addressMatches) {
        issues.push({
          type: 'ADDRESS_MISMATCH',
          expected: expectedSchool.address,
          actual: schoolStop.address,
        });
      }
      if (!coordinatesMatch) {
        issues.push({
          type: 'COORDINATES_MISMATCH',
          expected: expectedSchool.coordinates,
          actual: schoolStop.coordinates,
        });
      }
      if (!placementCorrect) {
        issues.push({
          type: 'PLACEMENT_INCORRECT',
          direction: route.direction,
          isFirst: isFirstStop,
          isLast: isLastStop,
          expected: isMorning ? 'LAST' : isAfternoon ? 'FIRST' : 'EITHER',
        });
      }

      if (issues.length > 0) {
        results.invalid++;
        results.issues.push({
          file: filename,
          route: `${route.name} (${route.direction || 'Unknown'})`,
          school: expectedSchool.name,
          schoolId: expectedSchool.id,
          issues: issues,
        });
      } else {
        results.valid++;
      }
    } catch (error) {
      results.invalid++;
      results.issues.push({
        file: path.basename(routePath),
        route: 'Unknown',
        issue: 'PARSE_ERROR',
        message: error.message,
      });
    }
  }

  // Print results
  console.log('📊 Verification Results');
  console.log('=======================\n');
  console.log(`Total routes checked: ${results.total}`);
  console.log(`✅ Valid: ${results.valid}`);
  console.log(`❌ Invalid: ${results.invalid}`);
  console.log(`⚠️  Missing school stop: ${results.missingSchoolStop}\n`);

  if (results.issues.length > 0) {
    console.log('❌ Issues Found:\n');
    
    // Group issues by type
    const issuesByType = {
      MISSING_SCHOOL_STOP: [],
      SCHOOL_NOT_FOUND: [],
      ADDRESS_MISMATCH: [],
      COORDINATES_MISMATCH: [],
      PLACEMENT_INCORRECT: [],
      PARSE_ERROR: [],
    };

    results.issues.forEach(issue => {
      if (issue.issue) {
        issuesByType[issue.issue].push(issue);
      } else if (issue.issues) {
        issue.issues.forEach(i => {
          if (issuesByType[i.type]) {
            issuesByType[i.type].push({ ...issue, specificIssue: i });
          }
        });
      }
    });

    // Print missing school stops
    if (issuesByType.MISSING_SCHOOL_STOP.length > 0) {
      console.log('🚫 Routes Missing School Stop:');
      issuesByType.MISSING_SCHOOL_STOP.forEach(issue => {
        console.log(`   - ${issue.file} (${issue.route})`);
        console.log(`     ${issue.message}`);
      });
      console.log('');
    }

    // Print school not found
    if (issuesByType.SCHOOL_NOT_FOUND.length > 0) {
      console.log('🔍 Routes with School Not Found:');
      issuesByType.SCHOOL_NOT_FOUND.forEach(issue => {
        console.log(`   - ${issue.file} (${issue.route})`);
        console.log(`     ${issue.message}`);
      });
      console.log('');
    }

    // Print address mismatches
    if (issuesByType.ADDRESS_MISMATCH.length > 0) {
      console.log('📍 Address Mismatches:');
      issuesByType.ADDRESS_MISMATCH.forEach(issue => {
        console.log(`   - ${issue.file} (${issue.route}) - ${issue.school || 'Unknown School'}`);
        console.log(`     Expected: "${issue.specificIssue.expected}"`);
        console.log(`     Actual:   "${issue.specificIssue.actual}"`);
      });
      console.log('');
    }

    // Print coordinate mismatches
    if (issuesByType.COORDINATES_MISMATCH.length > 0) {
      console.log('🗺️  Coordinate Mismatches:');
      issuesByType.COORDINATES_MISMATCH.forEach(issue => {
        console.log(`   - ${issue.file} (${issue.route}) - ${issue.school || 'Unknown School'}`);
        console.log(`     Expected: [${issue.specificIssue.expected.join(', ')}]`);
        console.log(`     Actual:   [${issue.specificIssue.actual.join(', ')}]`);
      });
      console.log('');
    }

    // Print placement issues
    if (issuesByType.PLACEMENT_INCORRECT.length > 0) {
      console.log('📍 Placement Issues:');
      issuesByType.PLACEMENT_INCORRECT.forEach(issue => {
        console.log(`   - ${issue.file} (${issue.route}) - ${issue.school || 'Unknown School'}`);
        console.log(`     Direction: ${issue.specificIssue.direction || 'Unknown'}`);
        console.log(`     Current: ${issue.specificIssue.isFirst ? 'FIRST' : issue.specificIssue.isLast ? 'LAST' : 'MIDDLE'}`);
        console.log(`     Expected: ${issue.specificIssue.expected}`);
      });
      console.log('');
    }

    // Print parse errors
    if (issuesByType.PARSE_ERROR.length > 0) {
      console.log('⚠️  Parse Errors:');
      issuesByType.PARSE_ERROR.forEach(issue => {
        console.log(`   - ${issue.file}`);
        console.log(`     ${issue.message}`);
      });
      console.log('');
    }

    // Generate summary report
    const reportPath = path.join(DATA_DIR, 'school-stop-verification-report.json');
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        total: results.total,
        valid: results.valid,
        invalid: results.invalid,
        missingSchoolStop: results.missingSchoolStop,
      },
      issues: results.issues,
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}\n`);
  } else {
    console.log('✅ All routes are valid! All school stops use correct addresses and coordinates from schools.json.\n');
  }

  // Exit with appropriate code
  process.exit(results.invalid > 0 || results.missingSchoolStop > 0 ? 1 : 0);
}

// Run verification
verifySchoolStops().catch(error => {
  console.error('\n❌ Error during verification:', error);
  process.exit(1);
});







