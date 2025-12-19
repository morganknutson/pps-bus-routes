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
 * @returns The closest stop result, or null if no stops with coordinates found
 */
export function findClosestStop(
  address: HomeAddress,
  routes: Route[]
): ClosestStopResult | null {
  const [addressLng, addressLat] = address.coordinates;

  let closestResult: ClosestStopResult | null = null;
  let minDistance = Infinity;

  for (const route of routes) {
    for (let i = 0; i < route.stops.length; i++) {
      const stop = route.stops[i];
      
      // Skip stops without coordinates or that should be skipped
      if (!stop.coordinates || stop.skipGeocoding) {
        continue;
      }

      const [stopLng, stopLat] = stop.coordinates;
      const distance = calculateDistance(
        [addressLng, addressLat],
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










