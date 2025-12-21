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
 * Find the closest stop to an address across all routes for a school
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
  if (!address || !address.coordinates || !routes || routes.length === 0) {
    return null;
  }

  const [addressLng, addressLat] = address.coordinates;

  let closestResult: ClosestStopResult | null = null;
  let minDistance = Infinity;

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

      if (distance < minDistance) {
        minDistance = distance;
        closestResult = {
          route,
          stop,
          stopNumber: index + 1,
          distance,
        };
      }
    }
  }

  return closestResult;
}












