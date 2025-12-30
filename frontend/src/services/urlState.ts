import { School, Route } from '../types';

export interface UrlState {
  show?: 'schools' | 'routes' | 'neighborhoods';
  schoolId?: string;
  direction?: 'morning' | 'afternoon' | 'both';
  routeNames?: string[];
  stopId?: string;
  focus?: string; // 'school-info', 'home', or 'lat,lng,zoom'
}

/**
 * Parse URL path to extract state information
 * Expected URL formats:
 * - /{basePath}/{schoolId} -> Schools tab, school selected
 * - /{basePath}/{schoolId}/routes -> Routes tab, school selected
 * - /{basePath}/{schoolId}/routes/{direction}/{routeNames}/{stopId}
 * - .../{focus} (focus can be 'school-info', 'home', or 'lat,lng,zoom')
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

  // List of keywords that should NOT be treated as school IDs
  const reservedKeywords = ['schools', 'schools-directory', 'routes', 'morning', 'afternoon', 'both', 'explore', 'map', 'neighborhoods'];
  const focusKeywords = ['school-info', 'home', 'my-stop'];
  const isCoords = (s: string) => /^-?\d+\.?\d*,-?\d+\.?\d*,\d+$/.test(s);

  let currentIdx = 0;

  // 1. Check for explicit prefixes or clean schoolId
  if (segments[0] === 'schools') {
    state.show = 'schools';
    currentIdx = 1;
    if (segments.length > currentIdx && !focusKeywords.includes(segments[currentIdx]) && !isCoords(segments[currentIdx])) {
      state.schoolId = segments[currentIdx];
      currentIdx++;
    }
  } else if (segments[0] === 'routes') {
    state.show = 'routes';
    currentIdx = 1;
    if (segments.length > currentIdx && !focusKeywords.includes(segments[currentIdx]) && !isCoords(segments[currentIdx])) {
      state.schoolId = segments[currentIdx];
      currentIdx++;
    }
  } else if (segments[0] === 'neighborhoods') {
    state.show = 'neighborhoods';
    currentIdx = 1;
  } else if (!reservedKeywords.includes(segments[0]?.toLowerCase())) {
    state.schoolId = segments[0];
    state.show = 'schools'; // Default
    currentIdx = 1;
  } else {
    // Default fallback
    state.show = 'schools';
  }

  // 2. Process remaining segments
  while (currentIdx < segments.length) {
    const segment = segments[currentIdx];
    const segmentLower = segment.toLowerCase();

    if (segmentLower === 'routes') {
      state.show = 'routes';
    } else if (['morning', 'afternoon', 'both'].includes(segmentLower)) {
      state.direction = segmentLower as any;
    } else if (focusKeywords.includes(segmentLower) || isCoords(segment)) {
      state.focus = segmentLower;
    } else if (state.show === 'routes' && !state.routeNames) {
      state.routeNames = segment.split(',').filter(Boolean);
    } else if (state.show === 'routes' && state.routeNames && !state.stopId) {
      state.stopId = segment;
    }
    
    currentIdx++;
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
    parts.push(state.schoolId);
    
    if (state.show === 'routes') {
      parts.push('routes');
      
      if (state.direction) {
        parts.push(state.direction);
      }
      
      if (state.routeNames && state.routeNames.length > 0) {
        parts.push(state.routeNames.join(','));
        
        if (state.stopId) {
          parts.push(state.stopId);
        }
      }
    } else if (state.show === 'neighborhoods') {
      parts.push('neighborhoods');
    }
    
    if (state.focus) {
      parts.push(state.focus);
    }
  } else {
    if (state.show === 'routes') {
      parts.push('routes');
    } else if (state.show === 'neighborhoods') {
      parts.push('neighborhoods');
    } else {
      parts.push('schools');
    }
    
    if (state.focus) {
      parts.push(state.focus);
    }
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

  // 2. Default behavior: Select all routes matching current direction when a school is selected
  // We do this regardless of state.show so that routes are ready when switching to the routes tab
  return routes.map(r => ({
    ...r,
    isSelected: direction === 'both' || !r.direction || r.direction.toLowerCase() === direction
  }));
}
