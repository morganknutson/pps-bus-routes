import { School, Route, Stop } from '../types';

/**
 * Convert school name to URL-friendly slug
 * Example: "West Sylvan" -> "west-sylvan"
 */
export function schoolNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Convert school ID (slug) back to school ID
 * Since school IDs are already slugs, this is mostly a passthrough
 * but validates that the slug exists in the schools array
 */
export function slugToSchoolId(slug: string, schools: School[]): string | null {
  // School IDs are already slugs, so we can match directly
  const school = schools.find(s => s.id === slug || schoolNameToSlug(s.name) === slug);
  return school?.id || null;
}

/**
 * Get school slug from school ID
 * Since IDs are already slugs, this is mostly a passthrough
 */
export function schoolIdToSlug(schoolId: string, schools: School[]): string {
  const school = schools.find(s => s.id === schoolId);
  if (school) {
    // Use the ID if it's already a slug, otherwise convert name
    return school.id.includes(' ') ? schoolNameToSlug(school.name) : school.id;
  }
  return schoolId; // Fallback to ID if school not found
}

/**
 * Parse route numbers from comma-separated string
 * Example: "100,101,102" -> ["100", "101", "102"]
 */
export function parseRouteNumbers(routesParam: string): string[] {
  if (!routesParam) return [];
  return routesParam.split(',').map(r => r.trim()).filter(Boolean);
}

/**
 * Find routes by their numbers
 * Handles matching route.name (e.g., "100") to the route numbers in URL
 */
export function findRoutesByNumbers(routes: Route[], routeNumbers: string[]): Route[] {
  if (!routeNumbers.length) return [];
  
  return routes.filter(route => {
    // Match by route name (e.g., "100")
    return routeNumbers.includes(route.name);
  });
}

/**
 * Get route numbers from routes array
 * Returns comma-separated string of route names
 */
export function getRouteNumbers(routes: Route[]): string {
  const selectedRoutes = routes.filter(r => r.isSelected);
  if (selectedRoutes.length === 0) return '';
  return selectedRoutes.map(r => r.name).join(',');
}

/**
 * Convert direction filter to URL format
 */
export function directionToUrl(direction: 'Morning' | 'Afternoon' | 'Both'): string {
  switch (direction) {
    case 'Morning':
      return 'morning';
    case 'Afternoon':
      return 'afternoon';
    case 'Both':
      return 'both';
    default:
      return 'morning';
  }
}

/**
 * Convert URL direction string to store direction
 */
export function urlToDirection(urlDirection: string): 'Morning' | 'Afternoon' | 'Both' {
  switch (urlDirection?.toLowerCase()) {
    case 'morning':
      return 'Morning';
    case 'afternoon':
      return 'Afternoon';
    case 'both':
      return 'Both';
    default:
      return 'Morning';
  }
}

/**
 * Find stop by its position number (1-indexed) in a route
 */
export function findStopByNumber(route: Route, stopNumber: number): Stop | null {
  if (!route || !route.stops || stopNumber < 1) return null;
  const index = stopNumber - 1; // Convert to 0-indexed
  if (index >= route.stops.length) return null;
  return route.stops[index];
}

/**
 * Get stop number (1-indexed) from stop ID in a route
 */
export function getStopNumber(route: Route, stopId: string): number | null {
  if (!route || !route.stops) return null;
  const index = route.stops.findIndex(s => s.id === stopId);
  return index >= 0 ? index + 1 : null; // Convert to 1-indexed
}

/**
 * Parse URL path segments
 * Expected format: /bus-route-explorer/{school}/{show}/{routes}/{time}/{stop}
 */
export interface ParsedUrlState {
  school: string | null;
  show: 'schools' | 'routes' | null;
  routes: string[];
  time: 'Morning' | 'Afternoon' | 'Both' | null;
  stop: number | null;
}

export function parseUrlPath(pathname: string, basePath: string = '/bus-route-explorer'): ParsedUrlState {
  // Remove base path and leading/trailing slashes
  const relativePath = pathname.replace(basePath, '').replace(/^\/|\/$/g, '');
  const segments = relativePath.split('/').filter(Boolean);

  const state: ParsedUrlState = {
    school: null,
    show: null,
    routes: [],
    time: null,
    stop: null,
  };

  if (segments.length === 0) return state;

  // First segment is always school
  state.school = segments[0] || null;

  // Second segment is show (schools or routes)
  if (segments.length > 1) {
    const showSegment = segments[1];
    if (showSegment === 'schools' || showSegment === 'routes') {
      state.show = showSegment;
    }
  }

  // Third segment is routes (comma-separated)
  if (segments.length > 2 && state.show === 'routes') {
    state.routes = parseRouteNumbers(segments[2]);
  }

  // Fourth segment is time (morning, afternoon, both)
  if (segments.length > 3 && state.show === 'routes') {
    state.time = urlToDirection(segments[3]);
  }

  // Fifth segment is stop number
  if (segments.length > 4 && state.show === 'routes') {
    const stopNum = parseInt(segments[4], 10);
    if (!isNaN(stopNum) && stopNum > 0) {
      state.stop = stopNum;
    }
  }

  return state;
}

/**
 * Build URL path from state
 */
export function buildUrlPath(
  basePath: string,
  state: {
    school?: string | null;
    show?: 'schools' | 'routes' | null;
    routes?: string[];
    time?: 'Morning' | 'Afternoon' | 'Both' | null;
    stop?: number | null;
  },
  schools: School[]
): string {
  const segments: string[] = [basePath];

  // School
  if (state.school) {
    const schoolSlug = schoolIdToSlug(state.school, schools);
    segments.push(schoolSlug);
  } else {
    return basePath; // No school selected, return base path
  }

  // Show (only if routes, schools is default and can be omitted)
  if (state.show === 'routes') {
    segments.push('routes');
  }
  // Omit 'schools' from URL as it's the default

  // Routes (only if show is routes)
  if (state.show === 'routes' && state.routes && state.routes.length > 0) {
    segments.push(state.routes.join(','));
  }

  // Time (only if routes are specified)
  if (state.show === 'routes' && state.routes && state.routes.length > 0 && state.time) {
    // Only include time if it's not the default (Morning)
    if (state.time !== 'Morning') {
      segments.push(directionToUrl(state.time));
    }
  }

  // Stop (only if routes and time are specified)
  if (state.show === 'routes' && state.routes && state.routes.length > 0 && state.stop) {
    segments.push(state.stop.toString());
  }

  return segments.join('/');
}

