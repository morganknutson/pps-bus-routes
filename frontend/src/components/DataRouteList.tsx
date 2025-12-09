import { RouteListBase, RouteListConfig } from './RouteListBase';
import { generateRouteColor } from '../utils/colorGenerator';
import type { Route, Stop } from '../types';

/**
 * Processed route format from the API (may have slightly different structure)
 */
interface ProcessedRoute {
  id: string;
  name: string;
  direction?: 'Morning' | 'Afternoon' | null;
  filename: string;
  stops: ProcessedStop[];
  processedAt: string;
  stats: {
    totalStops: number;
    geocodedStops: number;
    failedStops: number;
  };
}

interface ProcessedStop {
  id: string;
  address: string;
  time?: string;
  direction?: string | null;
  coordinates: [number, number] | null;
  geocodeError?: string;
  displayName?: string;
  isSchoolStop?: boolean;
  schoolName?: string;
  skipGeocoding?: boolean;
}

interface DataRouteListProps {
  routes: ProcessedRoute[];
  selectedStop: { route: ProcessedRoute; stop: ProcessedStop } | null;
  onStopClick: (route: ProcessedRoute, stop: ProcessedStop) => void;
  loading?: boolean;
}

/**
 * Convert ProcessedRoute to Route format
 */
function convertToRoute(processedRoute: ProcessedRoute, index: number): Route {
  return {
    id: processedRoute.id,
    name: processedRoute.name,
    direction: processedRoute.direction || null,
    filename: processedRoute.filename,
    stops: processedRoute.stops.map(stop => ({
      id: stop.id,
      address: stop.address,
      coordinates: stop.coordinates || undefined,
      geocodeError: stop.geocodeError,
      originalLine: stop.displayName,
      time: stop.time,
      direction: stop.direction,
      isSchoolStop: stop.isSchoolStop || false,
      skipGeocoding: stop.skipGeocoding || false,
      schoolName: stop.schoolName,
    })),
    color: generateRouteColor(index), // Generate color same way as main page
    isSelected: false,
    geocodingProgress: {
      total: processedRoute.stats.totalStops,
      geocoded: processedRoute.stats.geocodedStops,
      isGeocoding: false,
    },
  };
}

/**
 * Route list component for the data management page
 * Shows processed routes with geocoding stats and error indicators
 */
export function DataRouteList({ routes, selectedStop, onStopClick, loading }: DataRouteListProps) {
  // Convert processed routes to Route format with generated colors
  const convertedRoutes: Route[] = routes.map((route, index) => convertToRoute(route, index));

  const config: RouteListConfig = {
    showGeocodingStats: true,
    showFilename: true,
    showStopErrors: true,
    onStopClick: (route: Route, stop: Stop, stopNumber: number) => {
      // Find the original processed route and stop
      const processedRoute = routes.find(r => r.id === route.id);
      if (processedRoute) {
        const processedStop = processedRoute.stops.find(s => s.id === stop.id);
        if (processedStop) {
          onStopClick(processedRoute, processedStop);
        }
      }
    },
    isRouteSelected: (route: Route) => {
      return selectedStop?.route.id === route.id;
    },
    isStopSelected: (route: Route, stop: Stop) => {
      return selectedStop?.route.id === route.id && selectedStop?.stop.id === stop.id;
    },
    // Don't override getRouteColor - use the route's color property (generated above)
  };

  return (
    <RouteListBase
      routes={convertedRoutes}
      config={config}
      loading={loading}
      emptyMessage="No processed routes found"
    />
  );
}
