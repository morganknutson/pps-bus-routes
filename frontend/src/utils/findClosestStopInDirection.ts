/**
 * Utility to find the closest stop in a different direction
 */

import { Route, Stop } from '../types';
import { calculateDistance } from './distance';

export interface ClosestStopInDirectionResult {
  route: Route;
  stop: Stop;
  stopNumber: number;
  distance: number; // in kilometers
}

/**
 * Find the closest stop in the opposite direction to the currently selected stop
 * @param selectedStop The currently selected stop
 * @param targetDirection The direction to search for ('Morning' or 'Afternoon')
 * @param allRoutes All available routes
 * @returns The closest stop in the target direction, or null if no stops found
 */
export function findClosestStopInDirection(
  selectedStop: { route: Route; stop: Stop; stopNumber: number },
  targetDirection: 'Morning' | 'Afternoon',
  allRoutes: Route[]
): ClosestStopInDirectionResult | null {
  // Get the coordinates of the currently selected stop
  if (!selectedStop.stop.coordinates) {
    return null;
  }

  const [selectedLng, selectedLat] = selectedStop.stop.coordinates;

  let closestResult: ClosestStopInDirectionResult | null = null;
  let minDistance = Infinity;

  // Filter routes by target direction
  const targetRoutes = allRoutes.filter(route => route.direction === targetDirection);

  // Search through all routes in the target direction
  for (const route of targetRoutes) {
    for (let i = 0; i < route.stops.length; i++) {
      const stop = route.stops[i];
      
      // Skip stops without coordinates or that should be skipped
      if (!stop.coordinates || stop.skipGeocoding) {
        continue;
      }

      const [stopLng, stopLat] = stop.coordinates;
      const distance = calculateDistance(
        [selectedLng, selectedLat],
        [stopLng, stopLat]
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestResult = {
          route,
          stop,
          stopNumber: i + 1,
          distance,
        };
      }
    }
  }

  return closestResult;
}
