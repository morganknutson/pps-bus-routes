import { Route } from '../types';
import { loadRoutesFromCache } from './routeCache';

/**
 * Load routes from the same API endpoint as the data management page
 * Uses processed routes from /api/data/routes
 * @param schoolId Optional school ID to filter routes
 */
export async function loadLocalRoutes(schoolId?: string | null): Promise<Route[]> {
  // Always load from API to ensure we get the latest processed routes
  // Cache is now managed by the store after routes are loaded

  // No cache, load from API (same as data management page)
  try {
    const url = schoolId 
      ? `/api/data/routes?schoolId=${encodeURIComponent(schoolId)}`
      : '/api/data/routes';
    console.log('[loadLocalRoutes] Loading routes for schoolId:', schoolId, 'URL:', url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load routes: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[loadLocalRoutes] Received data:', data);
    const processedRoutes = data.routes || [];
    console.log('[loadLocalRoutes] Found', processedRoutes.length, 'processed routes');
    
    // Convert processed route format to Route format expected by main page
    const allRoutes: Route[] = processedRoutes.map((processedRoute: any) => {
      // Migrate old format routes to new format (name with (AM)/(PM) -> separate direction)
      let name = processedRoute.name;
      let direction = processedRoute.direction;
      let effectiveDate: Date | null = null;
      
      const amMatch = name && name.match(/^(\d+)\s*\(AM\)$/);
      const pmMatch = name && name.match(/^(\d+)\s*\(PM\)$/);
      
      if (amMatch && !direction) {
        name = amMatch[1]; // Just the number
        direction = 'Morning';
      } else if (pmMatch && !direction) {
        name = pmMatch[1]; // Just the number
        direction = 'Afternoon';
      }
      
      // Check for "upcoming" routes based on filename if not already in name
      if (processedRoute.filename) {
        const dateMatch = processedRoute.filename.match(/_effective_(\d{6})/);
        if (dateMatch) {
          const dateStr = dateMatch[1];
          try {
            const month = parseInt(dateStr.substring(0, 2)) - 1;
            const day = parseInt(dateStr.substring(2, 4));
            const year = 2000 + parseInt(dateStr.substring(4, 6));
            effectiveDate = new Date(year, month, day);
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // If date is in the future, consider it upcoming
            if (effectiveDate > today && !name.includes('-upcoming')) {
              name = `${name}-upcoming`;
            }
          } catch (e) {
            // Ignore date parsing errors
          }
        }
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
      }));
      
      return {
        id: processedRoute.id,
        name,
        direction: direction || null,
        filename: processedRoute.filename,
        effectiveDate, // Added this field for filtering
        stops,
        color: '', // Will be assigned by store
        isSelected: false, // Default to NOT selected
        geocodingProgress: {
          total: processedRoute.stats?.totalStops || stops.length,
          geocoded: processedRoute.stats?.geocodedStops || stops.filter((s: any) => s.coordinates).length,
          isGeocoding: false,
        },
        geometry: processedRoute.geometry, // Include cached route geometry if available
      };
    });

    // Filter out superseded routes
    // For each (name, direction) group:
    // 1. Keep all "upcoming" routes (they have -upcoming in the name)
    // 2. For "current" routes (no -upcoming), only keep the one with the latest effectiveDate
    const filteredRoutes: Route[] = [];
    const currentRoutesByGroup: Record<string, Route> = {};

    for (const route of allRoutes) {
      if (route.name.endsWith('-upcoming')) {
        filteredRoutes.push(route);
      } else {
        const groupKey = `${route.name}-${route.direction}`;
        const existing = currentRoutesByGroup[groupKey];
        
        if (!existing || (route.effectiveDate && (!existing.effectiveDate || route.effectiveDate > existing.effectiveDate))) {
          currentRoutesByGroup[groupKey] = route;
        }
      }
    }

    // Add the latest current routes to the final list
    for (const groupKey in currentRoutesByGroup) {
      filteredRoutes.push(currentRoutesByGroup[groupKey]);
    }
    
    return filteredRoutes;
  } catch (error) {
    console.error('Error loading routes from API:', error);
    return [];
  }
}

