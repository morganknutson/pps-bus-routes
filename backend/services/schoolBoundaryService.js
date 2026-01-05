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
     * @returns {object} Assigned schools by type (elementary, middle, high)
     */
    getAssignedSchools(lat, lng) {
        if (!this.boundaries || this.boundaries.length === 0) {
            return { error: 'Boundary data not loaded' };
        }

        const point = turf.point([lng, lat]); // Turf uses [lng, lat]
        const assigned = {
            elementary: null,
            middle: null,
            high: null,
            k8: null
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
                        assigned.elementary = schoolData;
                    } else if (zonetype === 'MS' || zonetype === 'Middle School' || zonetype.includes('Middle')) {
                        assigned.middle = schoolData;
                    } else if (zonetype === 'HS' || zonetype === 'High School' || zonetype.includes('High')) {
                        assigned.high = schoolData;
                    } else if (zonetype === 'K8' || zonetype.includes('K8')) {
                        // K8 is often mostly Elementary but covers Middle too. 
                        // Usually replaces both Elementary and Middle, or just Elementary.
                        // For now, put it in k8 field.
                        assigned.k8 = schoolData;
                    }
                }
            }

            // Logic to fallback K8 -> Elementary if Elementary is missing
            if (assigned.k8 && !assigned.elementary) {
                assigned.elementary = { ...assigned.k8, type: 'K-8 School (Elementary)' };
            }
            if (assigned.k8 && !assigned.middle) {
                assigned.middle = { ...assigned.k8, type: 'K-8 School (Middle)' };
            }

        } catch (error) {
            console.error('[SchoolBoundaryService] Error querying point in polygon:', error);
        }

        return assigned;
    }
}

// Export singleton
export const schoolBoundaryService = new SchoolBoundaryService();
