import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as turf from '@turf/turf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const BOUNDARIES_FILE = path.join(DATA_DIR, 'attendance-boundaries.geojson');

/**
 * Service to handle school attendance boundary lookups
 */
class SchoolBoundaryService {
    constructor() {
        this.boundaries = null;
        this.init();
    }

    /**
     * Load boundaries from GeoJSON file into memory
     */
    init() {
        try {
            if (!fs.existsSync(BOUNDARIES_FILE)) {
                console.warn('⚠️ Attendance boundaries file not found. Please run "npm run fetch-boundaries".');
                this.boundaries = [];
                return;
            }

            console.log('[SchoolBoundaryService] Loading attendance boundaries...');
            const data = JSON.parse(fs.readFileSync(BOUNDARIES_FILE, 'utf8'));

            if (!data.features) {
                console.error('[SchoolBoundaryService] Invalid GeoJSON: No features found');
                this.boundaries = [];
                return;
            }

            this.boundaries = data.features;
            console.log(`[SchoolBoundaryService] Loaded ${this.boundaries.length} boundary zones.`);

        } catch (error) {
            console.error('[SchoolBoundaryService] Error loading boundaries:', error);
            this.boundaries = [];
        }
    }

    /**
     * Get all boundaries
     * @returns {Array} GeoJSON features
     */
    getBoundaries() {
        return this.boundaries || [];
    }

    /**
     * Find assigned schools for a given lat/lng
     * @param {number} lat 
     * @param {number} lng 
     * @returns {object} Assigned schools by type (elementary, middle, high) - each is an array
     */
    getAssignedSchools(lat, lng) {
        if (!this.boundaries || this.boundaries.length === 0) {
            return { error: 'Boundary data not loaded' };
        }

        const point = turf.point([lng, lat]); // Turf uses [lng, lat]
        const assigned = {
            elementary: [],
            middle: [],
            high: [],
            k8: []
        };

        // Track school names to avoid duplicates
        const seenSchools = {
            elementary: new Set(),
            middle: new Set(),
            high: new Set(),
            k8: new Set()
        };

        try {
            for (const feature of this.boundaries) {
                // feature.geometry can be Polygon or MultiPolygon
                if (turf.booleanPointInPolygon(point, feature)) {
                    const props = feature.properties;
                    const { zonetype: rawZonetype, name, districtname, link, website } = props;
                    
                    // Normalize zonetype (trim whitespace)
                    const zonetype = rawZonetype ? rawZonetype.trim() : '';

                    // Helper to normalize school object
                    const schoolData = {
                        name: name,
                        district: districtname,
                        type: zonetype,
                        website: website || link
                    };

                    // Map zonetype to output keys
                    // zonetypes from ArcGIS: "Elementary School", "Middle School", "High School", "K5", "K8", "MS", "HS"
                    
                    if (zonetype === 'K5' || zonetype === 'Elementary School' || zonetype.includes('Elementary')) {
                        if (!seenSchools.elementary.has(name)) {
                            seenSchools.elementary.add(name);
                            assigned.elementary.push(schoolData);
                        }
                    } else if (zonetype === 'MS' || zonetype === 'Middle School' || zonetype.includes('Middle')) {
                        if (!seenSchools.middle.has(name)) {
                            seenSchools.middle.add(name);
                            assigned.middle.push(schoolData);
                        }
                    } else if (zonetype === 'HS' || zonetype === 'High School' || zonetype.includes('High')) {
                        if (!seenSchools.high.has(name)) {
                            seenSchools.high.add(name);
                            assigned.high.push(schoolData);
                        }
                    } else if (zonetype === 'K8' || zonetype.includes('K8')) {
                        // K8 is often mostly Elementary but covers Middle too. 
                        // Usually replaces both Elementary and Middle, or just Elementary.
                        if (!seenSchools.k8.has(name)) {
                            seenSchools.k8.add(name);
                            assigned.k8.push(schoolData);
                        }
                    }
                }
            }

            // Logic to fallback K8 -> Elementary/Middle if those are empty
            if (assigned.k8.length > 0 && assigned.elementary.length === 0) {
                assigned.elementary = assigned.k8.map(school => ({ ...school, type: 'K-8 School (Elementary)' }));
            }
            if (assigned.k8.length > 0 && assigned.middle.length === 0) {
                assigned.middle = assigned.k8.map(school => ({ ...school, type: 'K-8 School (Middle)' }));
            }

        } catch (error) {
            console.error('[SchoolBoundaryService] Error querying point in polygon:', error);
        }

        return assigned;
    }
}

// Export singleton
export const schoolBoundaryService = new SchoolBoundaryService();
