/**
 * @fileoverview Google Routes API Service for PPS Bus Maps
 * 
 * This module uses the modern Google Routes API (v2) to calculate travel matrices.
 * It is more efficient than the legacy Distance Matrix API and the Directions API
 * for one-to-many or many-to-many distance calculations.
 * 
 * @module services/routesService
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
const ROUTES_MATRIX_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';

/**
 * RoutesService class for matrix-based distance calculations.
 */
class RoutesService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || GOOGLE_API_KEY;
    this.useGoogle = !!this.apiKey;
    
    if (!this.useGoogle) {
      console.warn('[RoutesService] ⚠️ No Google Maps API key found.');
    } else {
      console.log('[RoutesService] ✅ Google Routes API configured');
    }
  }

  /**
   * Compute a route matrix for walking distances
   * @param {Array<number>} origin [lat, lng]
   * @param {Array<Array<number>>} destinations Array of [lat, lng]
   * @returns {Promise<Object>} Matrix results
   */
  async getWalkingMatrix(origin, destinations) {
    if (!this.useGoogle) {
      throw new Error('Google API key not configured');
    }

    const startTime = Date.now();
    
    // FieldMask is mandatory for Routes API v2
    // It determines which fields are returned and how the request is billed
    const fieldMask = 'originIndex,destinationIndex,distanceMeters,duration,status,condition';

    const body = {
      origins: [
        {
          waypoint: {
            location: {
              latLng: {
                latitude: origin[0],
                longitude: origin[1]
              }
            }
          }
        }
      ],
      destinations: destinations.map(dest => ({
        waypoint: {
          location: {
            latLng: {
              latitude: dest[0],
              longitude: dest[1]
            }
          }
        }
      })),
      travelMode: 'WALK',
      routingPreference: 'ROUTING_PREFERENCE_UNSPECIFIED'
    };

    try {
      console.log(`[RoutesService] 🗺️ Requesting walking matrix for 1 origin and ${destinations.length} destinations`);
      
      const response = await fetch(ROUTES_MATRIX_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': fieldMask
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[RoutesService] ❌ API error: ${response.status}`, errorText);
        throw new Error(`Routes API error: ${response.status}`);
      }

      const results = await response.json();
      const responseTime = Date.now() - startTime;
      
      console.log(`[RoutesService] ✅ Matrix calculated successfully in ${responseTime}ms`);
      
      // Routes API v2 returns an array of elements. Each element has originIndex and destinationIndex.
      // Note: The results might not be in order if using a large matrix, but for small ones they usually are.
      // We'll normalize them to match the input order of destinations.
      const normalizedResults = new Array(destinations.length).fill(null);
      
      if (Array.isArray(results)) {
        results.forEach(item => {
          if (item.originIndex === 0 && item.destinationIndex !== undefined) {
            normalizedResults[item.destinationIndex] = {
              distance: item.distanceMeters,
              duration: item.duration ? parseInt(item.duration.replace('s', '')) : null,
              status: item.status?.code === 0 || !item.status ? 'OK' : 'ERROR',
              error: item.status?.message || null
            };
          }
        });
      }

      return {
        success: true,
        results: normalizedResults,
        responseTime
      };
    } catch (error) {
      console.error('[RoutesService] ❌ Error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const routesService = new RoutesService();

