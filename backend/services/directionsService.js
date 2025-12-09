/**
 * Google Maps Directions Service
 * Provides accurate route calculation using Google Maps Directions API
 * Falls back to OSRM if API key is not configured
 */

import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
const GOOGLE_DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

/**
 * DirectionsService class for Google Maps Directions API
 */
class DirectionsService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || GOOGLE_API_KEY;
    this.useGoogle = !!this.apiKey;
    
    // Statistics tracking
    this.stats = {
      googleRequests: 0,
      googleSuccesses: 0,
      googleFailures: 0,
      osrmRequests: 0,
      osrmSuccesses: 0,
      osrmFailures: 0,
      straightLineFallbacks: 0,
      totalRoutes: 0,
      totalWaypoints: 0,
      averageResponseTime: 0,
      lastRequestTime: null,
    };
    
    if (!this.useGoogle) {
      console.warn('[DirectionsService] ⚠️  No Google Maps API key found, will use OSRM fallback');
      console.warn('[DirectionsService] 💡 Set GOOGLE_MAPS_API_KEY in backend/.env for better routing accuracy');
    } else {
      console.log('[DirectionsService] ✅ Google Maps API key configured');
      // Mask API key in logs (show first 10 chars)
      const maskedKey = this.apiKey.substring(0, 10) + '...';
      console.log(`[DirectionsService] 🔑 API Key: ${maskedKey}`);
    }
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
      osrmSuccessRate: this.stats.osrmRequests > 0
        ? (this.stats.osrmSuccesses / this.stats.osrmRequests * 100).toFixed(2) + '%'
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
      osrmRequests: 0,
      osrmSuccesses: 0,
      osrmFailures: 0,
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
   * Decode OSRM polyline format (for fallback)
   */
  decodeOSRMPolyline(encoded) {
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
  async getRouteWithGoogle(waypoints) {
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
      return await this.getRouteBatched(waypoints);
    }

    const origin = `${waypoints[0][0]},${waypoints[0][1]}`;
    const destination = `${waypoints[waypoints.length - 1][0]},${waypoints[waypoints.length - 1][1]}`;
    
    // Build waypoints string (exclude origin and destination)
    const intermediateWaypoints = waypoints.slice(1, -1)
      .map(wp => `${wp[0]},${wp[1]}`)
      .join('|');

    let url = `${GOOGLE_DIRECTIONS_URL}?origin=${origin}&destination=${destination}`;
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
  async getRouteBatched(waypoints) {
    const allCoordinates = [];
    const batchCount = Math.ceil((waypoints.length - 1) / 24);
    console.log(`[DirectionsService] 📦 Processing ${waypoints.length} waypoints in ${batchCount} batches`);
    
    // Process in batches of 25 waypoints
    for (let i = 0; i < waypoints.length - 1; i += 24) {
      const batch = waypoints.slice(i, Math.min(i + 25, waypoints.length));
      const batchNum = Math.floor(i / 24) + 1;
      console.log(`[DirectionsService] 📦 Batch ${batchNum}/${batchCount}: waypoints ${i} to ${Math.min(i + 24, waypoints.length - 1)}`);
      
      const result = await this.getRouteWithGoogle(batch);
      
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
   * Get route using OSRM (fallback)
   */
  async getRouteWithOSRM(waypoints) {
    const startTime = Date.now();
    this.stats.osrmRequests++;
    this.stats.totalWaypoints += waypoints.length;
    this.stats.lastRequestTime = new Date().toISOString();

    // Validate waypoints
    const validation = this.validateWaypoints(waypoints);
    if (!validation.valid) {
      this.stats.osrmFailures++;
      return {
        success: false,
        error: validation.error,
      };
    }

    console.log(`[DirectionsService] 🗺️  Requesting route with ${waypoints.length} waypoints via OSRM (fallback)`);
    const allCoordinates = [];
    let successfulSegments = 0;
    let failedSegments = 0;

    // Fetch route between each consecutive pair of stops
    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i];
      const end = waypoints[i + 1];

      try {
        // OSRM expects coordinates as lng,lat
        const url = `${OSRM_BASE_URL}/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=polyline`;
        
        const segmentStartTime = Date.now();
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`OSRM API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
          throw new Error(`No route found: ${data.code}`);
        }

        const encodedGeometry = data.routes[0].geometry;
        const segment = this.decodeOSRMPolyline(encodedGeometry);
        const segmentTime = Date.now() - segmentStartTime;
        
        // Add segment coordinates, avoiding duplicate at junction
        if (i === 0) {
          allCoordinates.push(...segment);
        } else {
          allCoordinates.push(...segment.slice(1));
        }

        successfulSegments++;
        if (waypoints.length > 2) {
          console.log(`[DirectionsService] ✅ Segment ${i + 1}/${waypoints.length - 1}: ${segment.length} points (${segmentTime}ms)`);
        }

        // Rate limiting delay (OSRM recommends 1 request per second)
        // Use adaptive delay: longer for many waypoints to avoid overwhelming the service
        if (i < waypoints.length - 2) {
          const delay = waypoints.length > 10 ? 1500 : 1000; // Longer delay for large routes
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        failedSegments++;
        console.warn(`[DirectionsService] ⚠️  OSRM error for segment ${i} to ${i + 1}: ${error.message}`);
        // Fallback to straight line for this segment
        if (i === 0) {
          allCoordinates.push([start[0], start[1]], [end[0], end[1]]);
        } else {
          allCoordinates.push([end[0], end[1]]);
        }
        this.stats.straightLineFallbacks++;
      }
    }

    const responseTime = Date.now() - startTime;
    
    if (failedSegments > 0) {
      console.warn(`[DirectionsService] ⚠️  OSRM route completed with ${failedSegments} failed segments (using straight lines)`);
      this.stats.osrmFailures++;
    } else {
      this.stats.osrmSuccesses++;
      this.stats.totalRoutes++;
    }

    console.log(`[DirectionsService] ✅ OSRM route completed: ${allCoordinates.length} points, ${successfulSegments}/${waypoints.length - 1} segments (${responseTime}ms)`);

    return {
      success: true,
      coordinates: allCoordinates,
      provider: 'osrm',
      successfulSegments,
      failedSegments,
      responseTime,
    };
  }

  /**
   * Get route through waypoints
   * Uses Google Directions API if available, falls back to OSRM
   * @param waypoints Array of [lat, lng] coordinates
   * @returns Promise with route coordinates [lat, lng][]
   */
  async getRoute(waypoints) {
    const validation = this.validateWaypoints(waypoints);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    if (this.useGoogle) {
      const result = await this.getRouteWithGoogle(waypoints);
      // If Google fails, try OSRM as fallback
      if (!result.success) {
        console.warn('[DirectionsService] ⚠️  Google failed, trying OSRM fallback');
        console.warn(`[DirectionsService] Error: ${result.error}`);
        return await this.getRouteWithOSRM(waypoints);
      }
      return result;
    } else {
      console.log('[DirectionsService] 📍 Using OSRM (Google API key not configured)');
      return await this.getRouteWithOSRM(waypoints);
    }
  }
}

// Export singleton instance
export const directionsService = new DirectionsService();

// Also export class for testing or custom instances
export { DirectionsService };

