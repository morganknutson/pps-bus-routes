/**
 * Test script to check Drive link for Abernethy school
 * Tests the Drive link verification service
 */

import { driveLinkVerificationService } from '../backend/services/driveLinkVerificationService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHOOLS_FILE = path.join(__dirname, '..', 'data', 'schools.json');

async function testAbernethy() {
  console.log('🧪 Testing Drive Link Check for Abernethy');
  console.log('==========================================\n');

  try {
    // Load schools
    if (!fs.existsSync(SCHOOLS_FILE)) {
      throw new Error('Schools file not found');
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    
    // Find Abernethy
    const abernethy = schools.find(s => s.id === 'abernethy' || s.name.toLowerCase().includes('abernethy'));
    
    if (!abernethy) {
      throw new Error('Abernethy school not found');
    }

    console.log(`Found school: ${abernethy.name} (ID: ${abernethy.id})`);
    console.log(`Drive Link: ${abernethy.driveLink || 'Not configured'}\n`);

    if (!abernethy.driveLink) {
      console.log('❌ No Drive link configured for Abernethy');
      return;
    }

    console.log('Checking Drive link...\n');
    
    // Verify the Drive link
    const result = await driveLinkVerificationService.verifySchoolDriveLink(abernethy);

    console.log('📊 Results:');
    console.log('-----------');
    console.log(`School ID: ${result.schoolId}`);
    console.log(`School Name: ${result.schoolName}`);
    console.log(`Drive Link: ${result.driveLink}`);
    console.log(`Accessible: ${result.accessible ? '✅ Yes' : '❌ No'}`);
    console.log(`Has PDFs: ${result.hasPdfs ? '✅ Yes' : '❌ No'}`);
    console.log(`PDF Count: ${result.pdfCount || 0}`);
    console.log(`Drive Last Modified: ${result.driveLastModified ? new Date(result.driveLastModified).toLocaleString() : 'N/A'}`);
    console.log(`Local Last Modified: ${result.localLastModified ? new Date(result.localLastModified).toLocaleString() : 'N/A'}`);
    console.log(`Matches: ${result.matches ? '✅ Yes' : '❌ No'}`);
    console.log(`Needs Update: ${result.needsUpdate ? '⚠️  Yes' : '✅ No'}`);
    
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }

    console.log('\n📝 Detailed Comparison:');
    console.log('----------------------');
    if (result.driveLastModified && result.localLastModified) {
      const driveTime = new Date(result.driveLastModified).getTime();
      const localTime = new Date(result.localLastModified).getTime();
      const diff = Math.abs(driveTime - localTime);
      const diffSeconds = Math.floor(diff / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      let diffString = '';
      if (diffDays > 0) {
        diffString = `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
      } else if (diffHours > 0) {
        diffString = `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
      } else if (diffMinutes > 0) {
        diffString = `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
      } else {
        diffString = `${diffSeconds} second${diffSeconds !== 1 ? 's' : ''}`;
      }

      if (result.matches) {
        console.log(`✅ Dates match (within 1 second)`);
      } else if (result.needsUpdate) {
        console.log(`⚠️  Drive is ${diffString} newer than local`);
      } else {
        console.log(`⚠️  Local is ${diffString} newer than Drive (unusual)`);
      }
    } else if (result.driveLastModified && !result.localLastModified) {
      console.log('⚠️  Drive has PDFs but local storage has none');
    } else if (!result.driveLastModified && result.localLastModified) {
      console.log('⚠️  Local storage has PDFs but Drive has none (unusual)');
    } else {
      console.log('⚠️  No modified dates available for comparison');
    }

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testAbernethy();



