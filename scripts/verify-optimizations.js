
import { placesService } from '../backend/services/placesService.js';
import { autocompleteService } from '../backend/services/autocompleteService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(__dirname, '..', 'data', 'cache');

async function verify() {
    console.log('🧪 Verifying API Optimizations...\n');

    // Test Places Service
    console.log('--- Places Service ---');
    const schoolName = 'Lincoln High School';
    console.log(`Searching for: ${schoolName}`);
    const placesResult = await placesService.searchSchool(schoolName);
    console.log(`Result: ${placesResult.success ? '✅ Success' : '❌ Failed'}`);
    if (placesResult.success) {
        console.log(`Place ID: ${placesResult.place.id}`);
        console.log(`From Cache: ${placesResult.fromCache || false}`);
    }

    // Test Autocomplete Service
    console.log('\n--- Autocomplete Service ---');
    const input = 'Powell\'s Books';
    console.log(`Autocompleting: ${input}`);
    const autoResult = await autocompleteService.autocomplete(input);
    console.log(`Found ${autoResult.length} suggestions`);
    const fromCache = autocompleteService.getCached(autocompleteService.getCacheKey(input, 'Portland', 'OR'));
    console.log(`Cache entry exists: ${!!fromCache}`);

    // Check Cache Files
    console.log('\n--- Cache Files ---');
    const files = fs.readdirSync(CACHE_DIR);
    console.log('Cache directory contents:');
    files.forEach(f => console.log(` - ${f}`));

    console.log('\n✅ Verification Complete');
}

verify().catch(console.error);
