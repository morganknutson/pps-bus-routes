/**
 * Utility to find the closest stop to a given address
 */

import { Route, Stop, HomeAddress } from '../types';
import { calculateDistance } from './distance';
import { calculateWalkingDistances } from '../services/api';

export interface ClosestStopResult {
  route: Route;
  stop: Stop;
  stopNumber: number;
  distance: number; // in kilometers
  walkingDistance?: number; // in meters
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
 * Find the single closest stop to an address across all routes for a school,
 * with optional street-aware walking distance refinement.
 * @param address The home address with coordinates
 * @param routes All routes for the school
 * @param direction Filter by direction if provided
 * @returns The closest stop result, or null if no stops with coordinates found
 */
export async function findClosestStop(
  address: HomeAddress,
  routes: Route[],
  direction?: 'Morning' | 'Afternoon' | 'Both'
): Promise<ClosestStopResult | null> {
  // 1. Get top candidates by straight-line distance
  const candidates = findClosestStops(address, routes, { direction, limit: 5 });
  
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // 2. Refine using walking distance if possible
  // Only do this if the difference between top candidates is small (< 500m)
  // to avoid unnecessary API calls for clearly distant stops.
  if (candidates.length > 1 && (candidates[1].distance - candidates[0].distance) < 0.5) {
    try {
      console.log('[findClosestStop] Refining search with walking distance for', candidates.length, 'candidates');
      
      // API expects [lat, lng]
      const stopCoords = candidates.map(c => [c.stop.coordinates![1], c.stop.coordinates![0]] as [number, number]);
      const homeCoords = [address.coordinates![1], address.coordinates![0]] as [number, number];
      
      const walkingResults = await calculateWalkingDistances(homeCoords, stopCoords);
      
      if (walkingResults.results && walkingResults.results.length > 0) {
        let minWalkingDistance = Infinity;
        let bestIndex = 0;
        
        walkingResults.results.forEach((res: any, idx: number) => {
          if (res.success && res.distance < minWalkingDistance) {
            minWalkingDistance = res.distance;
            bestIndex = idx;
          }
        });
        
        const bestCandidate = candidates[bestIndex];
        bestCandidate.walkingDistance = walkingResults.results[bestIndex].distance;
        
        console.log('[findClosestStop] Best stop by walking distance:', {
          route: bestCandidate.route.name,
          stop: bestCandidate.stop.address,
          walkingDistance: bestCandidate.walkingDistance + 'm'
        });
        
        return bestCandidate;
      }
    } catch (error) {
      console.warn('[findClosestStop] Failed to refine with walking distance, falling back to straight-line:', error);
    }
  }

  // Fall back to top straight-line candidate
  return candidates[0];
}












