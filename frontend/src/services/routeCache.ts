import { Route } from '../types';

const CACHE_KEY = 'pps-bus-routes-cache';
const CACHE_VERSION = 2; // Incremented to clear old cache from routes.json

interface CachedRoutes {
  version: number;
  timestamp: string;
  routes: Route[];
}

/**
 * Save routes to cache (localStorage)
 */
export function saveRoutesToCache(routes: Route[]): void {
  try {
    const cached: CachedRoutes = {
      version: CACHE_VERSION,
      timestamp: new Date().toISOString(),
      routes: routes.map(route => ({
        ...route,
        stops: route.stops.map(stop => ({
          ...stop,
          // Only cache stops with coordinates
          coordinates: stop.coordinates,
        })),
        // Don't cache geocoding progress state (it's runtime only)
        geocodingProgress: undefined,
      })),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    // Only log occasionally to avoid spam
    if (Math.random() < 0.1) {
      console.log('Routes saved to cache');
    }
  } catch (error) {
    console.error('Failed to save routes to cache:', error);
  }
}

/**
 * Load routes from cache
 */
export function loadRoutesFromCache(): Route[] | null {
  try {
    const cachedStr = localStorage.getItem(CACHE_KEY);
    if (!cachedStr) {
      return null;
    }

    const cached: CachedRoutes = JSON.parse(cachedStr);
    
    // Check version compatibility
    if (cached.version !== CACHE_VERSION) {
      console.log('Cache version mismatch, clearing cache');
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    console.log(`Loaded ${cached.routes.length} routes from cache (saved: ${new Date(cached.timestamp).toLocaleString()})`);
    return cached.routes;
  } catch (error) {
    console.error('Failed to load routes from cache:', error);
    return null;
  }
}

/**
 * Merge cached coordinates into routes
 * Returns routes with coordinates from cache where available
 */
export function mergeCachedCoordinates(routes: Route[]): Route[] {
  const cached = loadRoutesFromCache();
  if (!cached) {
    return routes;
  }

  // Create a map of cached stops by route ID and stop ID
  const cacheMap = new Map<string, Map<string, [number, number]>>();
  
  cached.forEach(cachedRoute => {
    const stopMap = new Map<string, [number, number]>();
    cachedRoute.stops.forEach(stop => {
      if (stop.coordinates) {
        stopMap.set(stop.id, stop.coordinates);
      }
    });
    cacheMap.set(cachedRoute.id, stopMap);
  });

  // Merge coordinates into current routes
  return routes.map(route => {
    const cachedStops = cacheMap.get(route.id);
    if (!cachedStops) {
      return route;
    }

    return {
      ...route,
      stops: route.stops.map(stop => {
        const cachedCoords = cachedStops.get(stop.id);
        if (cachedCoords) {
          return {
            ...stop,
            coordinates: cachedCoords,
          };
        }
        return stop;
      }),
    };
  });
}

/**
 * Update cache with new coordinates for a specific stop
 */
export function updateCacheWithCoordinates(
  routeId: string,
  stopId: string,
  coordinates: [number, number]
): void {
  try {
    const cached = loadRoutesFromCache();
    if (!cached) {
      return;
    }

    const route = cached.find(r => r.id === routeId);
    if (route) {
      const stop = route.stops.find(s => s.id === stopId);
      if (stop) {
        stop.coordinates = coordinates;
        saveRoutesToCache(cached);
      }
    }
  } catch (error) {
    console.error('Failed to update cache:', error);
  }
}

