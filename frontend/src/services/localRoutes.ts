import { Route } from '../types';
import { loadRoutesFromCache } from './routeCache';
import { fetchWithProgress } from '../utils/fetchWithProgress';

/**
 * Load routes from the same API endpoint as the data management page
 * Uses processed routes from /api/data/routes
 * @param schoolId Optional school ID to filter routes
 * @param onProgress Optional progress callback (0-100)
 */
export async function loadLocalRoutes(
  schoolId?: string | null,
  onProgress?: (progress: number) => void
): Promise<Route[]> {
  // Always load from API to ensure we get the latest processed routes
  // Cache is now managed by the store after routes are loaded

  // No cache, load from API (same as data management page)
  try {
    const url = schoolId 
      ? `/api/data/routes?schoolId=${encodeURIComponent(schoolId)}`
      : '/api/data/routes';
    console.log('[loadLocalRoutes] Loading routes for schoolId:', schoolId, 'URL:', url);
    
    let response: Response;
    try {
      response = await fetchWithProgress(url, {}, onProgress);
    } catch (error) {
      console.warn('[loadLocalRoutes] fetchWithProgress failed, trying regular fetch:', error);
      // Fallback to regular fetch if fetchWithProgress fails
      response = await fetch(url);
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to load routes: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json().catch((error) => {
      console.error('[loadLocalRoutes] Failed to parse JSON:', error);
      throw new Error(`Failed to parse response: ${error.message}`);
    });
    console.log('[loadLocalRoutes] Received data:', data);
    const processedRoutes = data.routes || [];
    console.log('[loadLocalRoutes] Found', processedRoutes.length, 'processed routes');
    
    // Convert processed route format to Route format expected by main page
    const routes: Route[] = processedRoutes.map((processedRoute: any) => {
      // Migrate old format routes to new format (name with (AM)/(PM) -> separate direction)
      let name = processedRoute.name;
      let direction = processedRoute.direction;
      
      const amMatch = name && name.match(/^(\d+)\s*\(AM\)$/);
      const pmMatch = name && name.match(/^(\d+)\s*\(PM\)$/);
      
      if (amMatch && !direction) {
        name = amMatch[1]; // Just the number
        direction = 'Morning';
      } else if (pmMatch && !direction) {
        name = pmMatch[1]; // Just the number
        direction = 'Afternoon';
      }
      
      // Convert stops: coordinates can be null in processed format, but should be optional in Route format
      const stops = processedRoute.stops.map((stop: any) => ({
        id: stop.id,
        address: stop.address,
        coordinates: stop.coordinates || undefined, // Convert null to undefined
        geocodeError: stop.geocodeError,
        originalLine: stop.originalLine,
        time: stop.time,
        direction: stop.direction,
        isSchoolStop: stop.isSchoolStop || false, // Pass through school stop flag
        skipGeocoding: stop.skipGeocoding || false, // Pass through skip geocoding flag
        schoolName: stop.schoolName, // Pass through school name for school stops
        neighborhood: stop.neighborhood, // Pass through neighborhood from processed route
      }));
      
      return {
        id: processedRoute.id,
        name,
        direction: direction || null,
        filename: processedRoute.filename,
        stops,
        neighborhoods: processedRoute.neighborhoods || [], // Aggregated neighborhoods from route
        color: '', // Will be assigned by store
        isSelected: true, // Default to selected
        geocodingProgress: {
          total: processedRoute.stats?.totalStops || stops.length,
          geocoded: processedRoute.stats?.geocodedStops || stops.filter((s: any) => s.coordinates).length,
          isGeocoding: false,
        },
        geometry: processedRoute.geometry, // Include cached route geometry if available
      };
    });
    
    return routes;
  } catch (error) {
    console.error('Error loading routes from API:', error);
    return [];
  }
}

