import { schoolBoundaryService } from './backend/services/schoolBoundaryService.js';
import { geocodingService } from './backend/services/geocodingService.js';

async function debug() {
    const address = '8708 NW Terraceview Ct, Portland, OR 97229';
    console.log(`Geocoding ${address}...`);
    
    // The service handles caching.
    const result = await geocodingService.geocodeAddress(address);
    
    if (!result.success || !result.coordinates) {
        console.error('Geocoding failed:', result.error);
        return;
    }
    
    const coords = result.coordinates;
    console.log('Coordinates:', coords);
    
    // The boundary service expects (lat, lng).
    // If coords is array [lng, lat], we need to swap.
    
    let lat, lng;
    if (Array.isArray(coords)) {
        [lng, lat] = coords;
    } else {
        lat = coords.lat;
        lng = coords.lng;
    }
    
    console.log(`Checking boundaries for Lat: ${lat}, Lng: ${lng}`);
    
    // 1. Get assigned schools
    const assigned = schoolBoundaryService.getAssignedSchools(lat, lng);
    console.log('Assigned Schools Result:', JSON.stringify(assigned, null, 2));
    
    // 2. Deep dive - check ALL polygons this point falls into
    console.log('\n--- Deep Dive: Polygons containing point ---');
    const boundaries = schoolBoundaryService.getBoundaries();
    const point = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Point',
            coordinates: [lng, lat]
        }
    };
    
    const turf = await import('@turf/turf');
    
    let foundCount = 0;
    for (const feature of boundaries) {
        if (turf.booleanPointInPolygon(point, feature)) {
            console.log('Found in polygon:', JSON.stringify(feature.properties, null, 2));
            foundCount++;
        }
    }
    
    if (foundCount === 0) {
        console.log('Point is not in ANY boundary polygon.');
    }
}

debug().catch(console.error);
