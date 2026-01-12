import { Route, Stop } from '../types';

/**
 * Calculate the display number for a stop within a route.
 * Consistent logic used by both the sidebar list and map markers.
 * 
 * Logic:
 * 1. Skip stops that are marked as skipGeocoding.
 * 2. School stops don't get a number (return 0).
 * 3. Regular stops are numbered sequentially (1, 2, 3...) based on their 
 *    order in the route, excluding skipped and school stops.
 */
export function calculateStopNumber(route: Route, stopId: string): number {
  const stop = route.stops.find(s => s.id === stopId);
  if (!stop || stop.isSchoolStop || stop.skipGeocoding) {
    return 0;
  }

  // Filter out skipped stops to get the base list of what's "real"
  const baseStops = route.stops.filter(s => !s.skipGeocoding);
  
  // Find index of our stop in this base list
  const indexInBase = baseStops.findIndex(s => s.id === stopId);
  if (indexInBase === -1) return 0;

  // Count regular stops before this one in the base list
  let regularStopCount = 0;
  for (let i = 0; i < indexInBase; i++) {
    if (!baseStops[i].isSchoolStop) {
      regularStopCount++;
    }
  }

  return regularStopCount + 1;
}

/**
 * Get all stops for a route that should be displayed on the map or in lists.
 * Excludes stops marked for skipping.
 */
export function getDisplayStops(route: Route): Stop[] {
  return route.stops.filter(s => !s.skipGeocoding);
}

/**
 * Get all stops for a route that should have a marker on the map.
 * Requires coordinates and not being marked for skipping.
 */
export function getMapStops(route: Route): Stop[] {
  return route.stops.filter(s => s.coordinates && s.coordinates.length === 2 && !s.skipGeocoding);
}

