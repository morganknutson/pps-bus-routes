/**
 * @fileoverview Google Maps Directions Service for PPS Bus Maps
 * 
 * This module calculates street-following route geometry between bus stops.
 * It uses the Google Maps Directions API as the primary service.
 * 
 * Key features:
 * - Street-following route calculation (not straight lines)
 * - Support for up to 25 waypoints per request (auto-batching for more)
 * - Polyline decoding from Google's encoded format
 * - Statistics tracking for monitoring
 * 
 * @module services/directionsService
 * @requires dotenv
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import { JsonCache } from '../utils/jsonCache.js';
import { runtimeFileOptions } from '../utils/runtimePaths.js';

// Load .env from backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
const GOOGLE_DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

// Cache file paths
const { filePath: CACHE_FILE, seedFilePath: CACHE_SEED_FILE } = runtimeFileOptions('cache', 'directions-cache.json');

/**
 * DirectionsService class for calculating route geometry.
 */
class DirectionsService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || GOOGLE_API_KEY;
    this.useGoogle = !!this.apiKey;

    // Use shared JsonCache utility
    this.cache = new JsonCache(CACHE_FILE, 5000, { seedFilePath: CACHE_SEED_FILE });
    this.cache.init();

    // Statistics tracking
    this.stats = {
      googleRequests: 0,
      googleSuccesses: 0,
      googleFailures: 0,
      cacheHits: 0,
      straightLineFallbacks: 0,
      totalRoutes: 0,
      totalWaypoints: 0,
      averageResponseTime: 0,
      lastRequestTime: null,
    };

    if (!this.useGoogle) {
      console.warn('[DirectionsService] ⚠️  No Google Maps API key found.');
      console.warn('[DirectionsService] 💡 Set GOOGLE_MAPS_API_KEY in backend/.env for routing accuracy');
    } else {
      console.log('[DirectionsService] ✅ Google Maps API key configured');
    }
  }

  /**
   * Create a hash from waypoints for cache key
   * Rounds coordinates to 5 decimal places (~1m precision) for reasonable cache hits
   */
  getCacheKey(waypoints, mode) {
    // Round coordinates and stringify
    const normalizedWaypoints = waypoints.map(wp => [
      Math.round(wp[0] * 100000) / 100000,
      Math.round(wp[1] * 100000) / 100000
    ]);
    const waypointsStr = JSON.stringify(normalizedWaypoints);
    // Create a short hash
    const hash = crypto.createHash('md5').update(waypointsStr).digest('hex').substring(0, 16);
    return `${hash}|${mode}|${waypoints.length}pts`;
  }

  /**
   * Get cached directions result
   */
  getCached(waypoints, mode) {
    const key = this.getCacheKey(waypoints, mode);
    return this.cache.get(key);
  }

  /**
   * Store directions result in cache
   */
  setCache(waypoints, mode, result) {
    const key = this.getCacheKey(waypoints, mode);
    this.cache.set(key, {
      coordinates: result.coordinates,
      distance: result.distance,
      duration: result.duration,
      cachedAt: new Date().toISOString()
    });
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      googleSuccessRate: this.stats.googleRequests > 0
        ? (this.stats.googleSuccesses / this.stats.googleRequests * 100).toFixed(2) + '%'
        : 'N/A',
      usingGoogle: this.useGoogle,
      hasApiKey: !!this.apiKey,
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      googleRequests: 0,
      googleSuccesses: 0,
      googleFailures: 0,
      straightLineFallbacks: 0,
      totalRoutes: 0,
      totalWaypoints: 0,
      averageResponseTime: 0,
      lastRequestTime: null,
    };
  }

  /**
   * Decode Google's encoded polyline format
   */
  decodePolyline(encoded) {
    const coordinates = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let shift = 0;
      let result = 0;
      let byte;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      // Google polyline returns [lat, lng]
      coordinates.push([lat / 1e5, lng / 1e5]);
    }

    return coordinates;
  }

  /**
   * Validate waypoints format and coordinates
   */
  validateWaypoints(waypoints) {
    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      return { valid: false, error: 'At least 2 waypoints required' };
    }

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      if (!Array.isArray(wp) || wp.length !== 2) {
        return { valid: false, error: `Waypoint ${i} must be [lat, lng] array` };
      }

      const [lat, lng] = wp;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return { valid: false, error: `Waypoint ${i} coordinates must be numbers` };
      }

      if (lat < -90 || lat > 90) {
        return { valid: false, error: `Waypoint ${i} latitude out of range: ${lat}` };
      }

      if (lng < -180 || lng > 180) {
        return { valid: false, error: `Waypoint ${i} longitude out of range: ${lng}` };
      }
    }

    return { valid: true };
  }

  /**
   * Get route using Google Directions API
   * Supports up to 25 waypoints per request
   */
  async getRouteWithGoogle(waypoints, mode = 'driving') {
    const startTime = Date.now();
    this.stats.googleRequests++;
    this.stats.totalWaypoints += waypoints.length;
    this.stats.lastRequestTime = new Date().toISOString();

    // Validate waypoints
    const validation = this.validateWaypoints(waypoints);
    if (!validation.valid) {
      this.stats.googleFailures++;
      return {
        success: false,
        error: validation.error,
      };
    }

    // Google Directions API supports up to 25 waypoints
    // If we have more, we need to batch the requests
    if (waypoints.length > 25) {
      console.log(`[DirectionsService] 📦 Batching ${waypoints.length} waypoints (max 25 per request)`);
      return await this.getRouteBatched(waypoints, mode);
    }

    const origin = `${waypoints[0][0]},${waypoints[0][1]}`;
    const destination = `${waypoints[waypoints.length - 1][0]},${waypoints[waypoints.length - 1][1]}`;

    // Build waypoints string (exclude origin and destination)
    const intermediateWaypoints = waypoints.slice(1, -1)
      .map(wp => `${wp[0]},${wp[1]}`)
      .join('|');

    let url = `${GOOGLE_DIRECTIONS_URL}?origin=${origin}&destination=${destination}&mode=${mode}`;
    if (intermediateWaypoints) {
      url += `&waypoints=${intermediateWaypoints}`;
    }
    url += `&key=${this.apiKey}`;

    try {
      console.log(`[DirectionsService] 🗺️  Requesting route with ${waypoints.length} waypoints via Google Directions API`);
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DirectionsService] ❌ Google API HTTP error: ${response.status}`, errorText);
        this.stats.googleFailures++;
        return {
          success: false,
          error: `Google Directions API error: ${response.status}`,
        };
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const polyline = route.overview_polyline.points;
        const coordinates = this.decodePolyline(polyline);
        const distance = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
        const duration = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0);

        // Update statistics
        this.stats.googleSuccesses++;
        this.stats.totalRoutes++;
        this.stats.averageResponseTime =
          (this.stats.averageResponseTime * (this.stats.googleSuccesses - 1) + responseTime) / this.stats.googleSuccesses;

        console.log(`[DirectionsService] ✅ Route calculated: ${coordinates.length} points, ${(distance / 1000).toFixed(2)}km, ${(duration / 60).toFixed(1)}min (${responseTime}ms)`);

        return {
          success: true,
          coordinates, // [lat, lng][] format for Leaflet
          distance,
          duration,
          provider: 'google',
          responseTime,
        };
      } else {
        console.warn(`[DirectionsService] ⚠️  Google API returned status: ${data.status}`, data.error_message || '');
        this.stats.googleFailures++;
        return {
          success: false,
          error: `Directions failed: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`,
          status: data.status,
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`[DirectionsService] ❌ Google API error (${responseTime}ms):`, error.message);
      this.stats.googleFailures++;
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Batch route requests for more than 25 waypoints
   */
  async getRouteBatched(waypoints, mode = 'driving') {
    const allCoordinates = [];
    const batchCount = Math.ceil((waypoints.length - 1) / 24);
    console.log(`[DirectionsService] 📦 Processing ${waypoints.length} waypoints in ${batchCount} batches`);

    // Process in batches of 25 waypoints
    for (let i = 0; i < waypoints.length - 1; i += 24) {
      const batch = waypoints.slice(i, Math.min(i + 25, waypoints.length));
      const batchNum = Math.floor(i / 24) + 1;
      console.log(`[DirectionsService] 📦 Batch ${batchNum}/${batchCount}: waypoints ${i} to ${Math.min(i + 24, waypoints.length - 1)}`);

      const result = await this.getRouteWithGoogle(batch, mode);

      if (result.success) {
        if (i === 0) {
          allCoordinates.push(...result.coordinates);
        } else {
          // Skip first point (same as last point of previous batch)
          allCoordinates.push(...result.coordinates.slice(1));
        }
        console.log(`[DirectionsService] ✅ Batch ${batchNum} completed: ${result.coordinates.length} points`);
      } else {
        console.error(`[DirectionsService] ❌ Batch ${batchNum} failed: ${result.error}`);
        throw new Error(`Failed to get route for batch ${batchNum} (waypoints ${i}-${Math.min(i + 24, waypoints.length - 1)}): ${result.error}`);
      }

      // Small delay between batches to avoid rate limiting
      if (i + 24 < waypoints.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[DirectionsService] ✅ All batches completed: ${allCoordinates.length} total points`);
    return {
      success: true,
      coordinates: allCoordinates,
      provider: 'google',
      batched: true,
    };
  }

  /**
   * Get route through waypoints
   * Uses Google Directions API
   */
  async getRoute(waypoints, mode = 'driving') {
    const validation = this.validateWaypoints(waypoints);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check cache first
    const cached = this.getCached(waypoints, mode);
    if (cached) {
      console.log(`[DirectionsService] Cache hit for ${waypoints.length} waypoints`);
      this.stats.cacheHits++;
      return {
        success: true,
        coordinates: cached.coordinates,
        distance: cached.distance,
        duration: cached.duration,
        provider: 'cache',
        fromCache: true,
      };
    }

    if (this.useGoogle) {
      const result = await this.getRouteWithGoogle(waypoints, mode);

      // Cache successful results
      if (result.success && result.coordinates) {
        this.setCache(waypoints, mode, result);
      }

      return result;
    } else {
      return {
        success: false,
        error: 'Google API key not configured',
      };
    }
  }
}

// Export singleton instance
export const directionsService = new DirectionsService();

// Also export class for testing or custom instances
export { DirectionsService };
