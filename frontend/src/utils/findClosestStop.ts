/**
 * Utility to find the closest stop to a given address
 */

import { Route, Stop, HomeAddress } from '../types';
import { calculateDistance } from './distance';

export interface ClosestStopResult {
  route: Route;
  stop: Stop;
  stopNumber: number;
  distance: number; // in kilometers
}

/**
 * Find the closest stops to an address across all routes for a school
 * @param address The home address with coordinates
 * @param routes All routes for the school
 * @param options Configuration for search
 * @returns The closest stop results, sorted by distance
 */
export function findClosestStops(
  address: HomeAddress,
  routes: Route[],
  options: { 
    direction?: 'Morning' | 'Afternoon' | 'Both',
    limit?: number 
  } = {}
): ClosestStopResult[] {
  const { direction, limit = 5 } = options;

  if (!address || !address.coordinates || !routes || routes.length === 0) {
    return [];
  }

  const [addressLng, addressLat] = address.coordinates;
  const results: ClosestStopResult[] = [];

  // Filter routes by direction if specified
  const filteredRoutes = direction && direction !== 'Both'
    ? routes.filter(r => !r.direction || r.direction === direction)
    : routes;

  for (const route of filteredRoutes) {
    // Get only valid stops with coordinates
    const stopsWithCoords = route.stops.map((stop, index) => ({ stop, index }))
      .filter(({ stop }) => stop.coordinates && !stop.skipGeocoding);

    for (const { stop, index } of stopsWithCoords) {
      const [stopLng, stopLat] = stop.coordinates!;
      const distance = calculateDistance(
        [addressLng, addressLat],
        [stopLng, stopLat]
      );

      results.push({
        route,
        stop,
        stopNumber: index + 1,
        distance,
      });
    }
  }

  // Sort by distance and return top N
  return results.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

/**
 * Find the single closest stop to an address across all routes for a school
 * @param address The home address with coordinates
 * @param routes All routes for the school
 * @param direction Filter by direction if provided
 * @returns The closest stop result, or null if no stops with coordinates found
 */
export function findClosestStop(
  address: HomeAddress,
  routes: Route[],
  direction?: 'Morning' | 'Afternoon' | 'Both'
): ClosestStopResult | null {
  const results = findClosestStops(address, routes, { direction, limit: 1 });
  return results.length > 0 ? results[0] : null;
}












