// Quick script to test file ID extraction
import fs from 'fs';

const folderId = '1BC03MH02DFuUL6teeq4jkcT2THRGgzxj';
const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

console.log('Fetching folder page...');
const response = await fetch(folderUrl, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  },
});

const html = await response.text();

// Save HTML for inspection
fs.writeFileSync('folder-page.html', html);
console.log('Saved HTML to folder-page.html');

// Try multiple patterns
const patterns = [
  /\["([a-zA-Z0-9_-]{33})","([^"]+\.pdf)"/g,
  /"([a-zA-Z0-9_-]{33})".*?\.pdf/g,
  /data-file-id="([a-zA-Z0-9_-]{33})"/g,
  /\/file\/d\/([a-zA-Z0-9_-]{33})/g,
];

console.log('\nTrying patterns...');
patterns.forEach((pattern, i) => {
  const matches = [...html.matchAll(pattern)];
  console.log(`Pattern ${i + 1}: Found ${matches.length} matches`);
  if (matches.length > 0) {
    console.log('  Sample:', matches[0][0].substring(0, 100));
  }
});

// Look for any 33-char IDs
const allIds = [...html.matchAll(/"([a-zA-Z0-9_-]{33})"/g)];
const uniqueIds = [...new Set(allIds.map(m => m[1]).filter(id => id !== folderId))];
console.log(`\nFound ${uniqueIds.length} unique 33-char IDs (excluding folder ID)`);

// Test first few to see if they're PDFs
console.log('\nTesting first 5 IDs...');
for (const id of uniqueIds.slice(0, 5)) {
  try {
    const testUrl = `https://drive.google.com/uc?export=download&id=${id}`;
    const testResponse = await fetch(testUrl, { method: 'HEAD' });
    const contentType = testResponse.headers.get('content-type');
    console.log(`  ${id}: ${contentType || 'unknown'}`);
  } catch (e) {
    console.log(`  ${id}: error`);
  }
}




