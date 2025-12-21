import { geocodingService } from './backend/services/geocodingService.js';

async function test() {
  const addresses = [
    '(chapman School) [E]',
    '(CHAPMAN SCHOOL) [E]',
    'SW PATTON @ VISTA'
  ];

  for (const addr of addresses) {
    console.log(`\nTesting: "${addr}"`);
    const formatted = geocodingService.formatAddressForGeocoding(addr);
    console.log(`Formatted for geocoding: "${formatted}"`);
    
    // We won't actually call the API here to save money/avoid using keys if not needed
    // But we can see what the query would be
    const query = `${formatted}, Portland, OR`;
    console.log(`Query: "${query}"`);
  }
}

test();

