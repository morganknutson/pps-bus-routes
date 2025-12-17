/**
 * Script to clean schools.json by removing schools not in the official PPS list
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHOOLS_FILE = path.join(__dirname, '..', 'data', 'schools.json');

// Official list of Portland Public Schools from the screenshot
const OFFICIAL_SCHOOLS = [
  'ABERNETHY',
  'ACCESS',
  'AINSWORTH',
  'ALAMEDA',
  'ARLETA',
  'ASTOR',
  'ATKINSON',
  'BEACH',
  'BEAUMONT',
  'BOISE-ELIOT',
  'BRIDGER',
  'BRIDLEMILE',
  'BUCKMAN',
  'CAPITOL',
  'CESAR CHAVEZ',
  'CHAPMAN',
  'CHIEF JOSEPH',
  'CLARK',
  'CRESTON',
  'DUNIWAY',
  'FAUBION',
  'FOREST PARK',
  'GEORGE',
  'GLENCOE',
  'GRAY',
  'GROUT',
  'HARRISON PARK',
  'HAYHURST',
  'HOSFORD',
  'IRVINGTON',
  'JACKSON',
  'JAMES JOHN',
  'KELLY',
  'KELLOGG',
  'LANE',
  'LENT',
  'LEE',
  'LEWIS',
  'LINCOLN',
  'LLEWELLYN',
  'MARKHAM',
  'DR MARTIN LUTHER KING JR',
  'MAPLEWOOD',
  'MARYSVILLE',
  'MT TABOR',
  'OCKLEY GREEN',
  'PENINSULA',
  'RICHMOND',
  'RIEKE',
  'RIGLER',
  'ROSE CITY PARK',
  'ROSEWAY HEIGHTS',
  'SCOTT',
  'SELLWOOD',
  'SITTON',
  'SKYLINE',
  'STEPHENSON',
  'TUBMAN',
  'VERNON',
  'VESTAL',
  'WEST SYLVAN',
  'WHITMAN',
  'WOODLAWN',
  'WOODMERE',
  'WOODSTOCK',
];

// Normalize school name for comparison (uppercase, handle variations)
function normalizeSchoolName(name) {
  return name
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/^DR\.?\s+/i, 'DR ') // Handle "Dr." vs "DR"
    .replace(/\s+JR\.?$/i, ' JR'); // Handle "Jr." vs "JR"
}

// Create a set of normalized official school names for quick lookup
const officialSchoolsSet = new Set(OFFICIAL_SCHOOLS.map(normalizeSchoolName));

async function cleanSchools() {
  try {
    if (!fs.existsSync(SCHOOLS_FILE)) {
      console.error(`Schools file not found: ${SCHOOLS_FILE}`);
      process.exit(1);
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);

    console.log(`Found ${schools.length} schools in file\n`);

    const validSchools = [];
    const removedSchools = [];

    for (const school of schools) {
      const normalizedName = normalizeSchoolName(school.name);
      const isOfficial = officialSchoolsSet.has(normalizedName);

      if (isOfficial) {
        validSchools.push(school);
        console.log(`✓ Keeping: ${school.name}`);
      } else {
        removedSchools.push(school);
        console.log(`✗ Removing: ${school.name} (not in official list)`);
      }
    }

    // Write cleaned schools back to file
    fs.writeFileSync(SCHOOLS_FILE, JSON.stringify(validSchools, null, 2));

    console.log(`\n=== Summary ===`);
    console.log(`Total schools in file: ${schools.length}`);
    console.log(`✓ Kept: ${validSchools.length}`);
    console.log(`✗ Removed: ${removedSchools.length}`);
    console.log(`\nRemoved schools:`);
    removedSchools.forEach(school => {
      console.log(`  - ${school.name} (id: ${school.id})`);
    });
    console.log(`\nUpdated schools file: ${SCHOOLS_FILE}`);

  } catch (error) {
    console.error('Error cleaning schools:', error);
    process.exit(1);
  }
}

cleanSchools();









