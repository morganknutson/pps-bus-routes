import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');

async function extractCurbCoordinates() {
    console.log('Starting extraction of curb coordinates...');

    try {
        const schoolsContent = await fs.readFile(SCHOOLS_FILE, 'utf8');
        const schools = JSON.parse(schoolsContent);
        const updatedSchools = [];
        let updatedCount = 0;

        for (const school of schools) {
            // Skip if no ID (shouldn't happen, but safe check)
            if (!school.id) {
                updatedSchools.push(school);
                continue;
            }

            const processedRoutesDir = path.join(DATA_DIR, 'schools', school.id, 'processed-routes');
            let curbCoords = null;
            let routeSource = null;

            try {
                await fs.access(processedRoutesDir);
                const files = await fs.readdir(processedRoutesDir);

                // Find a Morning route first (suffix 'A' usually, or check direction in file)
                const morningFile = files.find(f => f.endsWith('.json') && (f.includes('-A_') || f.includes('_AM_')));
                const afternoonFile = files.find(f => f.endsWith('.json') && (f.includes('-P_') || f.includes('_PM_')));

                // Priority: Morning Route -> Afternoon Route
                const targetFile = morningFile || afternoonFile;

                if (targetFile) {
                    const routeContent = await fs.readFile(path.join(processedRoutesDir, targetFile), 'utf8');
                    const route = JSON.parse(routeContent);

                    // Check geometry
                    if (route.geometry && route.geometry.length > 0) {
                        // Determine start or end based on direction
                        // Morning routes usually drop OFF at school (End of route)
                        // Afternoon routes pick UP at school (Start of route)
                        const isMorning = route.direction === 'Morning' || route.name.endsWith('A');

                        // Geometry is [lat, lng] in the file (Leaflet format from the cache?)
                        // Wait, checking 238ABE-A_effective_082625.json:
                        // "geometry": [[45.50736, -122.62574], ...] -> This is [lat, lng]
                        // School coordinates are [lng, lat]: [-122.6516263, 45.5058868]

                        let latLng;
                        if (isMorning) {
                            latLng = route.geometry[route.geometry.length - 1];
                        } else {
                            latLng = route.geometry[0];
                        }

                        if (latLng && latLng.length === 2) {
                            // Convert [lat, lng] to [lng, lat]
                            curbCoords = [latLng[1], latLng[0]];
                            routeSource = `Geometry from ${targetFile} (${isMorning ? 'End' : 'Start'})`;
                        }
                    }

                    // Fallback to stops if geometry check failed but we have the file
                    if (!curbCoords && route.stops && route.stops.length > 0) {
                        const schoolStop = route.stops.find(s => s.isSchoolStop);
                        if (schoolStop && schoolStop.coordinates) {
                            curbCoords = schoolStop.coordinates; // Already [lng, lat]
                            routeSource = `Stop coordinates from ${targetFile}`;
                        }
                    }
                }

            } catch (err) {
                // Directory might not exist or other error, just skip
                // console.log(`No processed routes for ${school.name} (${school.id})`);
            }

            if (curbCoords) {
                // Check if coordinates valid
                if (Array.isArray(curbCoords) && curbCoords.length === 2 &&
                    typeof curbCoords[0] === 'number' && typeof curbCoords[1] === 'number') {

                    updatedSchools.push({
                        ...school,
                        curbCoordinates: curbCoords
                    });
                    updatedCount++;
                    console.log(`✅ Updated ${school.name}: ${JSON.stringify(curbCoords)} (Source: ${routeSource})`);
                } else {
                    console.warn(`⚠️  Invalid coordinates found for ${school.name}: ${JSON.stringify(curbCoords)}`);
                    updatedSchools.push(school);
                }
            } else {
                //   console.log(`ℹ️  No curb coordinates found for ${school.name}, keeping original`);
                updatedSchools.push(school);
            }
        }

        // Write back to file
        await fs.writeFile(SCHOOLS_FILE, JSON.stringify(updatedSchools, null, 2));
        console.log(`\n🎉 Process complete. Updated ${updatedCount} schools.`);

    } catch (error) {
        console.error('Fatal error:', error);
    }
}

extractCurbCoordinates();
