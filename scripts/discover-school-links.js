/**
 * Script to discover Google Sites links and Drive links for all schools
 * Updates schools.json with discovered links
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { googleSitesService } from '../backend/services/googleSitesService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHOOLS_FILE = path.join(__dirname, '..', 'data', 'schools.json');
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Create a backup of schools.json before updating
 */
function createBackup() {
  if (!fs.existsSync(SCHOOLS_FILE)) {
    console.log('⚠️  Schools file does not exist, skipping backup');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `schools-${timestamp}.json`);
  
  try {
    fs.copyFileSync(SCHOOLS_FILE, backupFile);
    console.log(`✅ Created backup: ${backupFile}`);
  } catch (error) {
    console.error('❌ Error creating backup:', error.message);
  }
}

/**
 * Load schools from JSON file
 */
function loadSchools() {
  try {
    if (!fs.existsSync(SCHOOLS_FILE)) {
      console.error('❌ Schools file not found:', SCHOOLS_FILE);
      process.exit(1);
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    
    if (!Array.isArray(schools)) {
      console.error('❌ Schools file does not contain an array');
      process.exit(1);
    }

    return schools;
  } catch (error) {
    console.error('❌ Error loading schools:', error.message);
    process.exit(1);
  }
}

/**
 * Save schools to JSON file
 */
function saveSchools(schools) {
  try {
    const content = JSON.stringify(schools, null, 2);
    fs.writeFileSync(SCHOOLS_FILE, content, 'utf8');
    console.log(`✅ Saved ${schools.length} schools to ${SCHOOLS_FILE}`);
  } catch (error) {
    console.error('❌ Error saving schools:', error.message);
    throw error;
  }
}

/**
 * Main discovery function
 */
async function discoverAllLinks() {
  console.log('🔍 Discovering Google Sites and Drive Links for Schools');
  console.log('====================================================\n');

  // Create backup
  createBackup();

  // Load schools
  const schools = loadSchools();
  console.log(`📚 Loaded ${schools.length} schools\n`);

  const results = {
    updated: [],
    skipped: [],
    errors: [],
    stats: {
      sitesFound: 0,
      sitesUpdated: 0,
      drivesFound: 0,
      drivesUpdated: 0,
    },
  };

  // Process each school
  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    const progress = `[${i + 1}/${schools.length}]`;

    console.log(`\n${progress} Processing: ${school.name} (${school.id})`);

    try {
      // Discover links
      const { schoolPageLink, driveLink } = await googleSitesService.discoverSchoolLinks(
        school.id,
        school.name
      );

      let updated = false;

      // Update schoolPageLink if found and different
      if (schoolPageLink && schoolPageLink !== school.schoolPageLink) {
        school.schoolPageLink = schoolPageLink;
        school.updatedAt = new Date().toISOString();
        results.stats.sitesFound++;
        results.stats.sitesUpdated++;
        updated = true;
        console.log(`   ✅ Updated schoolPageLink`);
      } else if (schoolPageLink && schoolPageLink === school.schoolPageLink) {
        results.stats.sitesFound++;
        console.log(`   ℹ️  schoolPageLink already set`);
      }

      // Update driveLink if found and different
      if (driveLink && driveLink !== school.driveLink) {
        school.driveLink = driveLink;
        school.updatedAt = new Date().toISOString();
        results.stats.drivesFound++;
        results.stats.drivesUpdated++;
        updated = true;
        console.log(`   ✅ Updated driveLink`);
      } else if (driveLink && driveLink === school.driveLink) {
        results.stats.drivesFound++;
        console.log(`   ℹ️  driveLink already set`);
      }

      if (updated) {
        results.updated.push({
          id: school.id,
          name: school.name,
          schoolPageLink: school.schoolPageLink,
          driveLink: school.driveLink,
        });
      } else {
        results.skipped.push({
          id: school.id,
          name: school.name,
          reason: !schoolPageLink && !driveLink ? 'No links found' : 'Already up to date',
        });
      }

      // Add delay between schools to avoid rate limiting
      if (i < schools.length - 1) {
        await googleSitesService.delay();
      }
    } catch (error) {
      console.error(`   ❌ Error processing ${school.name}:`, error.message);
      results.errors.push({
        id: school.id,
        name: school.name,
        error: error.message,
      });
    }
  }

  // Save updated schools
  console.log('\n💾 Saving updated schools...');
  saveSchools(schools);

  // Print summary
  console.log('\n📊 Summary');
  console.log('====================================================');
  console.log(`Total schools processed: ${schools.length}`);
  console.log(`Schools updated: ${results.updated.length}`);
  console.log(`Schools skipped: ${results.skipped.length}`);
  console.log(`Errors: ${results.errors.length}`);
  console.log(`\nLinks discovered:`);
  console.log(`  Google Sites pages found: ${results.stats.sitesFound}`);
  console.log(`  Google Sites pages updated: ${results.stats.sitesUpdated}`);
  console.log(`  Drive links found: ${results.stats.drivesFound}`);
  console.log(`  Drive links updated: ${results.stats.drivesUpdated}`);

  if (results.updated.length > 0) {
    console.log(`\n✅ Updated schools:`);
    results.updated.forEach(school => {
      console.log(`  - ${school.name} (${school.id})`);
      if (school.schoolPageLink) {
        console.log(`    Site: ${school.schoolPageLink}`);
      }
      if (school.driveLink) {
        console.log(`    Drive: ${school.driveLink}`);
      }
    });
  }

  if (results.errors.length > 0) {
    console.log(`\n❌ Errors:`);
    results.errors.forEach(item => {
      console.log(`  - ${item.name} (${item.id}): ${item.error}`);
    });
  }

  console.log('\n✅ Discovery complete!');
}

// Run the discovery
discoverAllLinks().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});




