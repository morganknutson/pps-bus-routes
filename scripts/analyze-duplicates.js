/**
 * Analyze processed routes for duplicate coordinates
 * Helps identify routes that may have geocoding issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROCESSED_ROUTES_DIR = path.join(__dirname, '..', 'data', 'processed-routes');

function analyzeRoute(routePath) {
  const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));
  const filename = path.basename(routePath);
  
  // Group stops by coordinates
  const coordMap = new Map();
  route.stops.forEach((stop, index) => {
    if (stop.coordinates) {
      const key = stop.coordinates.join(',');
      if (!coordMap.has(key)) {
        coordMap.set(key, []);
      }
      coordMap.get(key).push({ index, stop });
    }
  });
  
  // Find duplicates
  const duplicates = [];
  coordMap.forEach((stopsAtCoord, coords) => {
    if (stopsAtCoord.length > 1) {
      duplicates.push({ coords, stops: stopsAtCoord });
    }
  });
  
  if (duplicates.length > 0) {
    console.log(`\n📄 ${filename} (Route ${route.name}, ${route.direction})`);
    console.log(`   ⚠️  Found ${duplicates.length} sets of duplicate coordinates:`);
    
    duplicates.forEach(({ coords, stops: stopsList }) => {
      console.log(`\n   📍 Coordinates [${coords}] - ${stopsList.length} stops:`);
      stopsList.forEach(({ stop }) => {
        const flags = [];
        if (stop.isApproximate) flags.push('approximate');
        if (stop.geocodeWarning) flags.push('warning');
        const flagStr = flags.length > 0 ? ` (${flags.join(', ')})` : '';
        console.log(`      • ${stop.address}${flagStr}`);
      });
    });
    
    return {
      filename,
      routeName: route.name,
      direction: route.direction,
      totalStops: route.stops.length,
      duplicateSets: duplicates.length,
      totalDuplicateStops: duplicates.reduce((sum, d) => sum + d.stops.length, 0),
      duplicates,
    };
  }
  
  return null;
}

function main() {
  console.log('🔍 Analyzing routes for duplicate coordinates...\n');
  
  if (!fs.existsSync(PROCESSED_ROUTES_DIR)) {
    console.error(`❌ Directory not found: ${PROCESSED_ROUTES_DIR}`);
    process.exit(1);
  }
  
  const files = fs.readdirSync(PROCESSED_ROUTES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(PROCESSED_ROUTES_DIR, f));
  
  if (files.length === 0) {
    console.log('No processed routes found.');
    return;
  }
  
  console.log(`Found ${files.length} processed route(s)\n`);
  
  const issues = [];
  files.forEach(file => {
    const issue = analyzeRoute(file);
    if (issue) {
      issues.push(issue);
    }
  });
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  if (issues.length === 0) {
    console.log('\n✅ No duplicate coordinates found!');
  } else {
    console.log(`\n⚠️  Found ${issues.length} route(s) with duplicate coordinates:\n`);
    
    issues.forEach(issue => {
      console.log(`   • ${issue.filename}`);
      console.log(`     Route ${issue.routeName} (${issue.direction})`);
      console.log(`     ${issue.duplicateSets} duplicate set(s), ${issue.totalDuplicateStops} affected stop(s)`);
    });
    
    const totalAffected = issues.reduce((sum, i) => sum + i.totalDuplicateStops, 0);
    console.log(`\n   Total affected stops: ${totalAffected}`);
    console.log(`\n   💡 Recommendation: Re-process these routes with the improved geocoding logic.`);
  }
}

main();













