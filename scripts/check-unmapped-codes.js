import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSchoolIdFromCode, extractSchoolCodeFromFilename } from '../backend/utils/schoolUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all PDF filenames
const schoolsDir = path.join(__dirname, '..', 'data', 'schools');
const codes = new Set();

function findPDFs(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findPDFs(fullPath);
    } else if (entry.name.endsWith('.pdf')) {
      const code = extractSchoolCodeFromFilename(entry.name);
      if (code) codes.add(code);
    }
  }
}

findPDFs(schoolsDir);

// Check which codes don't have mappings
const nullCodes = [];
const mappedCodes = [];

for (const code of Array.from(codes).sort()) {
  const schoolId = getSchoolIdFromCode(code);
  if (!schoolId) {
    nullCodes.push(code);
  } else {
    mappedCodes.push({ code, schoolId });
  }
}

console.log('School codes found in PDFs:');
console.log('================================\n');

if (nullCodes.length > 0) {
  console.log('❌ Codes WITHOUT mappings:');
  nullCodes.forEach(code => console.log(`   ${code}`));
  console.log(`\n   Total unmapped: ${nullCodes.length}`);
} else {
  console.log('✅ All codes are mapped!');
}

console.log(`\n📊 Summary:`);
console.log(`   Total codes found: ${codes.size}`);
console.log(`   Mapped: ${mappedCodes.length}`);
console.log(`   Unmapped: ${nullCodes.length}`);

if (mappedCodes.length > 0 && nullCodes.length === 0) {
  console.log('\n✅ All school codes have mappings!');
}






