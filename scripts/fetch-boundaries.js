import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Correct FeatureServer URL for Attendance Zones (Layer 2)
const LAYER_URL = 'https://services.arcgis.com/10N2YvfR3dqhPYAK/arcgis/rest/services/Schools_51e5ab7b167e457ebc668581dda23731/FeatureServer/2';

// Output path: data/attendance-boundaries.geojson
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'attendance-boundaries.geojson');

async function fetchBoundaries() {
    console.log('Fetching PPS Attendance Boundaries...');
    console.log(`Source: ${LAYER_URL}`);

    try {
        // Ensure data directory exists
        if (!fs.existsSync(DATA_DIR)) {
            console.log(`Creating directory: ${DATA_DIR}`);
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        // Query for all features as GeoJSON
        // 1=1 means "all records"
        // outFields=* gets all attributes
        // f=geojson gets GeoJSON format
        const queryUrl = `${LAYER_URL}/query?where=1=1&outFields=*&f=geojson&outSR=4326`;

        console.log(`Querying: ${queryUrl}`);

        const response = await fetch(queryUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`ArcGIS API error: ${JSON.stringify(data.error)}`);
        }

        if (!data.features || data.features.length === 0) {
            console.warn('Warning: No features returned.');
        } else {
            console.log(`Successfully fetched ${data.features.length} boundaries.`);
        }

        // Save to file
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
        console.log(`Saved to: ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('Error fetching boundaries:', error);
        process.exit(1);
    }
}

fetchBoundaries();
