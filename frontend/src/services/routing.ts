/**
 * Routing service using Google Maps Directions API (with OSRM fallback)
 * Fetches route geometry that follows actual streets between points
 */

const API_BASE_URL = '/api/routes';
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

// Routing statistics (client-side)
interface RoutingStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  lastRequestTime: string | null;
  providerBreakdown: {
    google: number;
    osrm: number;
    straightLine: number;
  };
}

let routingStats: RoutingStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  averageResponseTime: 0,
  lastRequestTime: null,
  providerBreakdown: {
    google: 0,
    osrm: 0,
    straightLine: 0,
  },
};

/**
 * Get routing statistics
 */
export function getRoutingStats(): RoutingStats {
  return { ...routingStats };
}

/**
 * Reset routing statistics
 */
export function resetRoutingStats(): void {
  routingStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    lastRequestTime: null,
    providerBreakdown: {
      google: 0,
      osrm: 0,
      straightLine: 0,
    },
  };
}

interface OSRMRouteResponse {
  code: string;
  routes: Array<{
    geometry: string; // Encoded polyline
    distance: number;
    duration: number;
  }>;
}

interface RouteCache {
  [key: string]: {
    coordinates: [number, number][];
    timestamp: number;
  };
}

// Cache routes for 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000;
const CACHE_KEY = 'osrm_route_cache';

/**
 * Get cached route or null if not found/expired
 */
function getCachedRoute(key: string): [number, number][] | null {
  try {
    const cacheStr = localStorage.getItem(CACHE_KEY);
    if (!cacheStr) return null;

    const cache: RouteCache = JSON.parse(cacheStr);
    const cached = cache[key];

    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > CACHE_DURATION) {
      // Remove expired entry
      delete cache[key];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return null;
    }

    return cached.coordinates;
  } catch (error) {
    console.error('Error reading route cache:', error);
    return null;
  }
}

/**
 * Save route to cache
 */
function saveRouteToCache(key: string, coordinates: [number, number][]): void {
  try {
    const cacheStr = localStorage.getItem(CACHE_KEY);
    const cache: RouteCache = cacheStr ? JSON.parse(cacheStr) : {};

    cache[key] = {
      coordinates,
      timestamp: Date.now(),
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error saving route cache:', error);
  }
}

/**
 * Decode OSRM polyline format (similar to Google's encoded polyline)
 */
function decodePolyline(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let shift = 0;
    let result = 0;
    let byte: number;

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
 * Generate cache key for a route segment
 */
function generateCacheKey(start: [number, number], end: [number, number]): string {
  return `${start[0].toFixed(6)},${start[1].toFixed(6)}_${end[0].toFixed(6)},${end[1].toFixed(6)}`;
}

/**
 * Validate coordinates
 */
function validateCoordinates(coords: [number, number], name: string): boolean {
  const [lng, lat] = coords;
  
  if (typeof lng !== 'number' || typeof lat !== 'number') {
    console.error(`[Routing] ❌ Invalid ${name} coordinates: must be numbers`, coords);
    return false;
  }
  
  if (lat < -90 || lat > 90) {
    console.error(`[Routing] ❌ Invalid ${name} latitude: ${lat} (must be -90 to 90)`);
    return false;
  }
  
  if (lng < -180 || lng > 180) {
    console.error(`[Routing] ❌ Invalid ${name} longitude: ${lng} (must be -180 to 180)`);
    return false;
  }
  
  return true;
}

/**
 * Fetch route between two points using Google Directions API (with OSRM fallback)
 * @param start [lng, lat] coordinates
 * @param end [lng, lat] coordinates
 * @returns Promise with array of [lat, lng] coordinates following streets
 */
export async function fetchRouteBetweenPoints(
  start: [number, number],
  end: [number, number]
): Promise<[number, number][]> {
  const requestStartTime = Date.now();
  routingStats.totalRequests++;
  routingStats.lastRequestTime = new Date().toISOString();

  // Validate coordinates
  if (!validateCoordinates(start, 'start') || !validateCoordinates(end, 'end')) {
    routingStats.failedRequests++;
    throw new Error('Invalid coordinates provided');
  }

  // Check cache first
  const cacheKey = generateCacheKey(start, end);
  const cached = getCachedRoute(cacheKey);
  if (cached) {
    routingStats.cacheHits++;
    console.log(`[Routing] 💾 Cache hit for route segment`);
    return cached;
  }

  routingStats.cacheMisses++;

  try {
    // Try Google Directions API first (via backend)
    // Convert from [lng, lat] to [lat, lng] for API
    const waypoints = [[start[1], start[0]], [end[1], end[0]]];
    
    console.log(`[Routing] 🗺️  Fetching route between points via backend API`);
    const response = await fetch(`${API_BASE_URL}/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ waypoints }),
    });

    if (response.ok) {
      const data = await response.json();
      const responseTime = Date.now() - requestStartTime;
      
      if (data.coordinates && Array.isArray(data.coordinates) && data.coordinates.length > 0) {
        const routeCoordinates: [number, number][] = data.coordinates;
        saveRouteToCache(cacheKey, routeCoordinates);
        
        // Update statistics
        routingStats.successfulRequests++;
        routingStats.providerBreakdown[data.provider === 'google' ? 'google' : 'osrm']++;
        routingStats.averageResponseTime = 
          (routingStats.averageResponseTime * (routingStats.successfulRequests - 1) + responseTime) / routingStats.successfulRequests;
        
        console.log(`[Routing] ✅ Route fetched: ${routeCoordinates.length} points via ${data.provider || 'unknown'} (${responseTime}ms)`);
        return routeCoordinates;
      } else {
        console.warn(`[Routing] ⚠️  Invalid response format: missing or empty coordinates`);
      }
    } else {
      const errorText = await response.text();
      console.warn(`[Routing] ⚠️  Backend API error: ${response.status}`, errorText);
    }

    // Fallback to OSRM if Google API fails
    console.warn('[Routing] ⚠️  Backend API failed, falling back to OSRM');
    return await fetchRouteWithOSRM(start, end, cacheKey, requestStartTime);
  } catch (error) {
    console.error('[Routing] ❌ Error fetching route:', error);
    routingStats.failedRequests++;
    // Fallback to OSRM
    return await fetchRouteWithOSRM(start, end, cacheKey, requestStartTime);
  }
}

/**
 * Fetch route using OSRM (fallback)
 */
async function fetchRouteWithOSRM(
  start: [number, number],
  end: [number, number],
  cacheKey: string,
  requestStartTime: number = Date.now()
): Promise<[number, number][]> {
  try {
    // OSRM expects coordinates as lng,lat
    const url = `${OSRM_BASE_URL}/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=polyline`;
    
    console.log(`[Routing] 🗺️  Fetching route via OSRM fallback`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status}`);
    }

    const data: OSRMRouteResponse = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(`OSRM returned code: ${data.code}`);
    }

    // Decode the polyline geometry
    const encodedGeometry = data.routes[0].geometry;
    const coordinates = decodePolyline(encodedGeometry);
    
    // Coordinates are already in [lat, lng] format from polyline decode
    const routeCoordinates: [number, number][] = coordinates;
    const responseTime = Date.now() - requestStartTime;

    // Save to cache
    saveRouteToCache(cacheKey, routeCoordinates);

    // Update statistics
    routingStats.successfulRequests++;
    routingStats.providerBreakdown.osrm++;
    routingStats.averageResponseTime = 
      (routingStats.averageResponseTime * (routingStats.successfulRequests - 1) + responseTime) / routingStats.successfulRequests;

    console.log(`[Routing] ✅ OSRM route fetched: ${routeCoordinates.length} points (${responseTime}ms)`);
    return routeCoordinates;
  } catch (error) {
    const responseTime = Date.now() - requestStartTime;
    console.error(`[Routing] ❌ Error fetching route from OSRM (${responseTime}ms):`, error);
    
    // Final fallback to straight line
    routingStats.providerBreakdown.straightLine++;
    console.warn('[Routing] ⚠️  Using straight-line fallback (route may not follow streets)');
    return [[start[1], start[0]], [end[1], end[0]]];
  }
}

/**
 * Fetch complete route for a sequence of stops
 * Uses Google Directions API if available (supports multiple waypoints)
 * @param stops Array of [lng, lat] coordinates
 * @returns Promise with combined route coordinates [lat, lng][]
 */
export async function fetchRouteForStops(
  stops: [number, number][]
): Promise<[number, number][]> {
  const requestStartTime = Date.now();
  
  if (stops.length < 2) {
    console.warn(`[Routing] ⚠️  Not enough stops for route: ${stops.length} (need at least 2)`);
    return stops.map(([lng, lat]) => [lat, lng]);
  }

  // Validate all stops
  for (let i = 0; i < stops.length; i++) {
    if (!validateCoordinates(stops[i], `stop ${i}`)) {
      throw new Error(`Invalid coordinates at stop ${i}`);
    }
  }

  console.log(`[Routing] 🗺️  Fetching route for ${stops.length} stops`);

  // Try to use Google Directions API with all waypoints at once (more efficient)
  try {
    // Convert from [lng, lat] to [lat, lng] for API
    const waypoints = stops.map(([lng, lat]) => [lat, lng]);
    
    const response = await fetch(`${API_BASE_URL}/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ waypoints }),
    });

    if (response.ok) {
      const data = await response.json();
      const responseTime = Date.now() - requestStartTime;
      
      if (data.coordinates && Array.isArray(data.coordinates) && data.coordinates.length > 0) {
        // Update statistics
        routingStats.successfulRequests++;
        routingStats.providerBreakdown[data.provider === 'google' ? 'google' : 'osrm']++;
        routingStats.averageResponseTime = 
          (routingStats.averageResponseTime * (routingStats.successfulRequests - 1) + responseTime) / routingStats.successfulRequests;
        
        console.log(`[Routing] ✅ Route fetched for ${stops.length} stops: ${data.coordinates.length} points via ${data.provider || 'unknown'} (${responseTime}ms)`);
        if (data.metadata) {
          console.log(`[Routing] 📊 Metadata:`, data.metadata);
        }
        return data.coordinates;
      } else {
        console.warn(`[Routing] ⚠️  Invalid response: missing or empty coordinates`);
      }
    } else {
      const errorText = await response.text();
      console.warn(`[Routing] ⚠️  Backend API error: ${response.status}`, errorText);
    }
  } catch (error) {
    console.warn(`[Routing] ⚠️  Failed to fetch route with all waypoints, falling back to segment-by-segment:`, error);
  }

  // Fallback: Fetch route between each consecutive pair of stops
  console.log(`[Routing] 📍 Falling back to segment-by-segment routing`);
  const allCoordinates: [number, number][] = [];
  let successfulSegments = 0;
  let failedSegments = 0;

  for (let i = 0; i < stops.length - 1; i++) {
    const start = stops[i];
    const end = stops[i + 1];

    try {
      const segment = await fetchRouteBetweenPoints(start, end);
      
      // Add segment coordinates, avoiding duplicate at junction
      if (i === 0) {
        // First segment: include all points
        allCoordinates.push(...segment);
      } else {
        // Subsequent segments: skip first point (same as last point of previous segment)
        allCoordinates.push(...segment.slice(1));
      }

      successfulSegments++;
      console.log(`[Routing] ✅ Segment ${i + 1}/${stops.length - 1} completed: ${segment.length} points`);

      // Add small delay to avoid rate limiting (only for OSRM fallback)
      if (i < stops.length - 2) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      failedSegments++;
      console.error(`[Routing] ❌ Error fetching route segment ${i} to ${i + 1}:`, error);
      // Fallback to straight line for this segment
      if (i === 0) {
        allCoordinates.push([start[1], start[0]], [end[1], end[0]]);
      } else {
        allCoordinates.push([end[1], end[0]]);
      }
      routingStats.providerBreakdown.straightLine++;
    }
  }

  const responseTime = Date.now() - requestStartTime;
  console.log(`[Routing] ✅ Route completed: ${allCoordinates.length} total points, ${successfulSegments}/${stops.length - 1} segments successful (${responseTime}ms)`);
  
  if (failedSegments > 0) {
    console.warn(`[Routing] ⚠️  ${failedSegments} segments failed and used straight-line fallback`);
  }

  return allCoordinates;
}

