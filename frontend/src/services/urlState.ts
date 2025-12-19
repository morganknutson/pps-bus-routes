import { School, Route } from '../types';

export interface UrlState {
  show?: 'schools' | 'routes';
  schoolId?: string;
  direction?: 'morning' | 'afternoon' | 'both';
  routeNames?: string[];
  stopId?: string;
}

/**
 * Parse URL path to extract state information
 * Expected URL formats:
 * - /{basePath}/{schoolId} -> Schools tab, school selected
 * - /{basePath}/{schoolId}/routes -> Routes tab, school selected
 * - /{basePath}/{schoolId}/routes/{direction}/{routeNames}/{stopId}
 * 
 * Legacy/Explicit support:
 * - /basePath/schools/{schoolId}
 * - /basePath/routes/{schoolId}
 */
export function parseUrlPath(pathname: string, basePath: string): UrlState {
  let path = pathname;
  if (path.startsWith(basePath)) {
    path = path.substring(basePath.length);
  }
  path = path.replace(/^\/+|\/+$/g, '');
  
  if (!path) {
    return {};
  }

  const segments = path.split('/').filter(Boolean);
  const state: UrlState = {};

  // Case 1: Explicit prefixes
  if (segments[0] === 'schools') {
    state.show = 'schools';
    if (segments.length > 1) {
      state.schoolId = segments[1];
    }
    return state;
  } 
  
  if (segments[0] === 'routes') {
    state.show = 'routes';
    if (segments.length > 1) {
      state.schoolId = segments[1];
      
      let nextIdx = 2;
      // Handle optional /routes/{id}/routes shorthand
      if (segments.length > nextIdx && segments[nextIdx] === 'routes') {
        nextIdx++;
      }
      
      if (segments.length > nextIdx) {
        const dir = segments[nextIdx].toLowerCase();
        if (['morning', 'afternoon', 'both'].includes(dir)) {
          state.direction = dir as any;
          nextIdx++;
          
          if (segments.length > nextIdx) {
            state.routeNames = segments[nextIdx].split(',').filter(Boolean);
            nextIdx++;
            
            if (segments.length > nextIdx) {
              state.stopId = segments[nextIdx];
            }
          }
        }
      }
    }
    return state;
  }

  // Case 2: Clean Hierarchy (schoolId first)
  state.schoolId = segments[0];
  state.show = 'schools'; // Default

  if (segments.length > 1 && segments[1] === 'routes') {
    state.show = 'routes';
    
    if (segments.length > 2) {
      const next = segments[2].toLowerCase();
      // Handle direction segment
      if (['morning', 'afternoon', 'both'].includes(next)) {
        state.direction = next as any;
        if (segments.length > 3) {
          state.routeNames = segments[3].split(',').filter(Boolean);
          if (segments.length > 4) {
            state.stopId = segments[4];
          }
        }
      } else {
        // Handle direct routeNames segment (shorthand)
        state.routeNames = segments[2].split(',').filter(Boolean);
        if (segments.length > 3) {
          state.stopId = segments[3];
        }
      }
    }
  }

  return state;
}

/**
 * Build URL path from state
 * Heuristic: {schoolId} is the primary focus and comes first.
 */
export function buildUrlPath(basePath: string, state: UrlState): string {
  const parts = [basePath];
  
  if (state.schoolId) {
    // School ID always comes first in the hierarchy
    parts.push(state.schoolId);
    
    if (state.show === 'routes') {
      parts.push('routes');
      
      if (state.direction || (state.routeNames && state.routeNames.length > 0)) {
        if (state.direction) {
          parts.push(state.direction);
        }
        
        if (state.routeNames && state.routeNames.length > 0) {
          parts.push(state.routeNames.join(','));
          
          if (state.stopId) {
            parts.push(state.stopId);
          }
        }
      }
    }
  } else if (state.show === 'routes') {
    parts.push('routes');
  } else if (state.show === 'schools') {
    parts.push('schools');
  }
  
  return parts.join('/').replace(/\/+$/g, '');
}

/**
 * Apply URL state to a list of routes to determine their initial selection state.
 * This helps avoid UI flicker by ensuring routes are correctly selected/deselected
 * the moment they are loaded into the store.
 */
export function applyUrlStateToRoutes(routes: Route[], state: UrlState, currentDirectionFilter?: string): Route[] {
  // If no school focus in URL, default everything to unselected
  if (!state.schoolId) {
    return routes.map(r => ({ ...r, isSelected: false }));
  }

  const direction = state.direction || currentDirectionFilter?.toLowerCase() || 'both';

  // 1. Specific route names in URL: Strict selection
  if (state.routeNames && state.routeNames.length > 0) {
    return routes.map(r => {
      const nameMatches = state.routeNames!.includes(r.name);
      const directionMatches = direction === 'both' || !r.direction || r.direction.toLowerCase() === direction;
      return {
        ...r,
        isSelected: nameMatches && directionMatches
      };
    });
  }

  // 2. Routes tab with NO specific names: Default to "Select All" for current direction
  if (state.show === 'routes') {
    return routes.map(r => ({
      ...r,
      isSelected: direction === 'both' || !r.direction || r.direction.toLowerCase() === direction
    }));
  }

  // 3. Schools tab: Default to unselected
  return routes.map(r => ({ ...r, isSelected: false }));
}
