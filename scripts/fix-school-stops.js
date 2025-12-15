#!/usr/bin/env node
/**
 * Fix school stops in processed routes to use correct address and coordinates from schools.json
 * 
 * This script:
 * 1. Loads schools.json to get the correct address and coordinates for each school
 * 2. Finds all processed routes
 * 3. For each route with a school stop (isSchoolStop: true):
 *    - Updates the address to match schools.json exactly
 *    - Updates the coordinates to match schools.json exactly
 *    - Ensures displayName matches the address
 * 
 * Usage: node scripts/fix-school-stops.js [school-id]
 *   If school-id is provided, only fixes routes for that school
 *   Otherwise, fixes routes for all schools
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const SCHOOLS_DIR = path.join(DATA_DIR, 'schools');

// Get school ID from command line argument
const targetSchoolId = process.argv[2] || null;

/**
 * Load schools.json and create a map by school ID
 */
function loadSchools() {
  if (!fs.existsSync(SCHOOLS_FILE)) {
    throw new Error(`Schools file not found: ${SCHOOLS_FILE}`);
  }
  
  const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
  const schools = JSON.parse(content);
  
  // Create a map by school ID
  const schoolMap = new Map();
  schools.forEach(school => {
    if (!school.id) {
      console.warn(`⚠️  Warning: School missing ID: ${JSON.stringify(school)}`);
      return;
    }
    
    if (!school.address) {
      console.warn(`⚠️  Warning: School "${school.name}" (${school.id}) missing address`);
    }
    
    if (!school.coordinates || !Array.isArray(school.coordinates) || school.coordinates.length !== 2) {
      console.warn(`⚠️  Warning: School "${school.name}" (${school.id}) missing valid coordinates`);
    }
    
    schoolMap.set(school.id, school);
  });
  
  return schoolMap;
}

/**
 * Get all processed route files for a school
 */
function getProcessedRoutes(schoolId) {
  const processedRoutesDir = path.join(SCHOOLS_DIR, schoolId, 'processed-routes');
  
  if (!fs.existsSync(processedRoutesDir)) {
    return [];
  }
  
  const files = fs.readdirSync(processedRoutesDir)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(processedRoutesDir, f));
  
  return files;
}

/**
 * Fix school stop in a route file
 */
function fixSchoolStop(routePath, school) {
  const content = fs.readFileSync(routePath, 'utf8');
  const route = JSON.parse(content);
  
  // Find the school stop
  const schoolStopIndex = route.stops?.findIndex(s => s.isSchoolStop === true);
  
  if (schoolStopIndex === -1 || schoolStopIndex === undefined) {
    return { fixed: false, reason: 'No school stop found' };
  }
  
  const schoolStop = route.stops[schoolStopIndex];
  const originalAddress = schoolStop.address;
  const originalCoords = schoolStop.coordinates ? [...schoolStop.coordinates] : null;
  
  // Check if already correct
  const correctAddress = school.address.trim();
  const correctCoords = school.coordinates;
  
  const addressMatches = schoolStop.address === correctAddress;
  const coordsMatch = schoolStop.coordinates && 
    Array.isArray(schoolStop.coordinates) && 
    schoolStop.coordinates.length === 2 &&
    Math.abs(schoolStop.coordinates[0] - correctCoords[0]) < 0.0001 &&
    Math.abs(schoolStop.coordinates[1] - correctCoords[1]) < 0.0001;
  
  if (addressMatches && coordsMatch) {
    return { fixed: false, reason: 'Already correct' };
  }
  
  // Update the school stop
  route.stops[schoolStopIndex] = {
    ...schoolStop,
    address: correctAddress, // Use exact address from schools.json
    coordinates: [...correctCoords], // Use exact coordinates from schools.json
    displayName: correctAddress, // Ensure displayName matches address
    schoolName: school.name, // Ensure school name is set
    // Keep other properties like id, time, direction, originalLine, isSchoolStop, skipGeocoding
  };
  
  // Write back to file
  fs.writeFileSync(routePath, JSON.stringify(route, null, 2), 'utf8');
  
  return {
    fixed: true,
    changes: {
      address: addressMatches ? null : { from: originalAddress, to: correctAddress },
      coordinates: coordsMatch ? null : { from: originalCoords, to: correctCoords },
    },
  };
}

/**
 * Main function
 */
async function main() {
  console.log('🔧 Fix School Stops in Processed Routes');
  console.log('========================================\n');
  
  // Load schools
  console.log('📚 Loading schools.json...');
  const schoolMap = loadSchools();
  console.log(`   Found ${schoolMap.size} schools\n`);
  
  // Get list of schools to process
  let schoolsToProcess = [];
  if (targetSchoolId) {
    const school = schoolMap.get(targetSchoolId);
    if (!school) {
      console.error(`❌ Error: School "${targetSchoolId}" not found in schools.json`);
      process.exit(1);
    }
    schoolsToProcess = [school];
    console.log(`🎯 Processing routes for school: ${school.name} (${school.id})\n`);
  } else {
    // Get all school directories
    if (!fs.existsSync(SCHOOLS_DIR)) {
      console.error(`❌ Error: Schools directory not found: ${SCHOOLS_DIR}`);
      process.exit(1);
    }
    
    const schoolDirs = fs.readdirSync(SCHOOLS_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    schoolsToProcess = schoolDirs
      .map(id => schoolMap.get(id))
      .filter(school => school !== undefined);
    
    console.log(`📂 Found ${schoolsToProcess.length} schools with data directories\n`);
  }
  
  // Process each school
  let totalRoutes = 0;
  let totalFixed = 0;
  let totalAlreadyCorrect = 0;
  let totalNoSchoolStop = 0;
  
  for (const school of schoolsToProcess) {
    if (!school.address || !school.coordinates) {
      console.log(`⚠️  Skipping ${school.name}: Missing address or coordinates in schools.json`);
      continue;
    }
    
    console.log(`\n🏫 Processing ${school.name} (${school.id})...`);
    console.log(`   Address: ${school.address}`);
    console.log(`   Coordinates: [${school.coordinates[0]}, ${school.coordinates[1]}]`);
    
    const routeFiles = getProcessedRoutes(school.id);
    console.log(`   Found ${routeFiles.length} processed routes`);
    
    if (routeFiles.length === 0) {
      continue;
    }
    
    let schoolFixed = 0;
    let schoolAlreadyCorrect = 0;
    let schoolNoSchoolStop = 0;
    
    for (const routePath of routeFiles) {
      const filename = path.basename(routePath);
      const result = fixSchoolStop(routePath, school);
      
      totalRoutes++;
      
      if (result.fixed) {
        totalFixed++;
        schoolFixed++;
        const changes = [];
        if (result.changes.address) {
          changes.push(`address: "${result.changes.address.from}" → "${result.changes.address.to}"`);
        }
        if (result.changes.coordinates) {
          changes.push(`coordinates: [${result.changes.coordinates.from?.join(', ')}] → [${result.changes.coordinates.to.join(', ')}]`);
        }
        console.log(`   ✓ Fixed: ${filename} (${changes.join(', ')})`);
      } else if (result.reason === 'Already correct') {
        totalAlreadyCorrect++;
        schoolAlreadyCorrect++;
      } else if (result.reason === 'No school stop found') {
        totalNoSchoolStop++;
        schoolNoSchoolStop++;
        console.log(`   ⚠️  No school stop: ${filename}`);
      }
    }
    
    console.log(`   Summary: ${schoolFixed} fixed, ${schoolAlreadyCorrect} already correct, ${schoolNoSchoolStop} no school stop`);
  }
  
  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Final Summary');
  console.log('='.repeat(50));
  console.log(`Total routes processed: ${totalRoutes}`);
  console.log(`Routes fixed: ${totalFixed}`);
  console.log(`Routes already correct: ${totalAlreadyCorrect}`);
  console.log(`Routes without school stop: ${totalNoSchoolStop}`);
  console.log('\n✅ Done!');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});



