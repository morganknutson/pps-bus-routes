/**
 * Script to batch update all school addresses using Google Places API
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchSchool } from '../services/placesService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHOOLS_FILE = path.join(__dirname, '..', '..', 'data', 'schools.json');

async function batchUpdateAddresses() {
  try {
    if (!fs.existsSync(SCHOOLS_FILE)) {
      console.error(`Schools file not found: ${SCHOOLS_FILE}`);
      process.exit(1);
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);

    console.log(`🚀 Starting batch address update for ${schools.length} schools\n`);
    console.log('Using Google Places API with Portland, OR restrictions\n');
    console.log('='.repeat(60) + '\n');

    const results = [];
    const updatedSchools = [...schools];

    // Process each school with rate limiting (1 request per second)
    for (let i = 0; i < schools.length; i++) {
      const school = schools[i];
      
      try {
        console.log(`[${i + 1}/${schools.length}] Processing: ${school.name}`);
        
        const searchResult = await searchSchool(school.name);

        if (searchResult.success && searchResult.place) {
          const place = searchResult.place;
          const schoolIndex = updatedSchools.findIndex((s) => s.id === school.id);
          
          if (schoolIndex !== -1) {
            const oldAddress = updatedSchools[schoolIndex].address || 'No address';
            updatedSchools[schoolIndex] = {
              ...updatedSchools[schoolIndex],
              address: place.address,
              coordinates: place.coordinates,
              updatedAt: new Date().toISOString(),
            };
            
            results.push({
              schoolId: school.id,
              schoolName: school.name,
              success: true,
              oldAddress: oldAddress,
              newAddress: place.address,
              coordinates: place.coordinates
            });

            console.log(`  ✅ Updated`);
            console.log(`     Old: ${oldAddress}`);
            console.log(`     New: ${place.address}`);
          }
        } else {
          results.push({
            schoolId: school.id,
            schoolName: school.name,
            success: false,
            error: searchResult.error || 'Failed to find school'
          });

          console.log(`  ❌ Failed: ${searchResult.error || 'Unknown error'}`);
        }
      } catch (error) {
        results.push({
          schoolId: school.id,
          schoolName: school.name,
          success: false,
          error: error.message
        });

        console.log(`  ❌ Error: ${error.message}`);
      }

      // Rate limiting: wait 1 second between requests (except for the last one)
      if (i < schools.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(''); // Empty line for readability
    }

    // Save updated schools
    fs.writeFileSync(SCHOOLS_FILE, JSON.stringify(updatedSchools, null, 2));

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log('='.repeat(60));
    console.log('📊 Batch Update Summary');
    console.log('='.repeat(60));
    console.log(`Total schools: ${schools.length}`);
    console.log(`✅ Succeeded: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    
    if (failureCount > 0) {
      console.log('\n❌ Failed Schools:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.schoolName}: ${r.error}`);
      });
    }
    
    console.log(`\n💾 Updated schools file: ${SCHOOLS_FILE}`);

  } catch (error) {
    console.error('Error in batch update:', error);
    process.exit(1);
  }
}

batchUpdateAddresses();



