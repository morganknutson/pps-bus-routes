/**
 * Routing service using Google Maps Directions API
 * Fetches route geometry that follows actual streets between points
 */

const API_BASE_URL = '/api/routes';

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
      straightLine: 0,
    },
  };
}

interface RouteCache {
  [key: string]: {
    coordinates: [number, number][];
    timestamp: number;
  };
}

// Cache routes for 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000;
const CACHE_KEY = 'google_route_cache';

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
 * Fetch route between two points using Google Directions API
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
    // Try Google Directions API via backend
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
        routingStats.providerBreakdown.google++;
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

    // Final fallback to straight line
    routingStats.providerBreakdown.straightLine++;
    console.warn('[Routing] ⚠️  Using straight-line fallback');
    return [[start[1], start[0]], [end[1], end[0]]];
  } catch (error) {
    console.error('[Routing] ❌ Error fetching route:', error);
    routingStats.failedRequests++;
    
    // Final fallback to straight line
    routingStats.providerBreakdown.straightLine++;
    console.warn('[Routing] ⚠️  Using straight-line fallback');
    return [[start[1], start[0]], [end[1], end[0]]];
  }
}

/**
 * Fetch complete route for a sequence of stops
 * Uses Google Directions API
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
        routingStats.providerBreakdown.google++;
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

