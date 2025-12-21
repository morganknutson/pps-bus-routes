/**
 * Coordinate utility functions
 * 
 * Internal format: [lng, lat] (GeoJSON standard, matches backend)
 * Leaflet format: [lat, lng] (Leaflet convention)
 */

export type CoordinateLngLat = [number, number]; // [longitude, latitude]
export type CoordinateLatLng = [number, number]; // [latitude, longitude]

/**
 * Convert [lng, lat] to [lat, lng] for Leaflet
 */
export function toLeafletPosition(coords: CoordinateLngLat): CoordinateLatLng {
  if (!coords || coords.length !== 2) {
    throw new Error(`Invalid coordinate format: expected [lng, lat], got ${JSON.stringify(coords)}`);
  }
  const [lng, lat] = coords;
  if (typeof lng !== 'number' || typeof lat !== 'number') {
    throw new Error(`Invalid coordinate values: lng=${lng}, lat=${lat}`);
  }
  return [lat, lng];
}

/**
 * Convert [lat, lng] to [lng, lat] (internal format)
 */
export function fromLeafletPosition(coords: CoordinateLatLng): CoordinateLngLat {
  if (!coords || coords.length !== 2) {
    throw new Error(`Invalid coordinate format: expected [lat, lng], got ${JSON.stringify(coords)}`);
  }
  const [lat, lng] = coords;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new Error(`Invalid coordinate values: lat=${lat}, lng=${lng}`);
  }
  return [lng, lat];
}

/**
 * Validate coordinate format [lng, lat]
 */
export function validateLngLat(coords: unknown): coords is CoordinateLngLat {
  if (!Array.isArray(coords) || coords.length !== 2) {
    return false;
  }
  const [lng, lat] = coords;
  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    lng >= -180 && lng <= 180 &&
    lat >= -90 && lat <= 90
  );
}

/**
 * Validate coordinate format [lat, lng]
 */
export function validateLatLng(coords: unknown): coords is CoordinateLatLng {
  if (!Array.isArray(coords) || coords.length !== 2) {
    return false;
  }
  const [lat, lng] = coords;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/**
 * Format coordinates for logging/debugging
 */
export function formatCoordinates(coords: CoordinateLngLat | CoordinateLatLng, format: 'lnglat' | 'latlng' = 'lnglat'): string {
  if (!coords || coords.length !== 2) {
    return 'Invalid coordinates';
  }
  const [first, second] = coords;
  if (format === 'lnglat') {
    return `[${first.toFixed(6)}, ${second.toFixed(6)}] (lng, lat)`;
  } else {
    return `[${first.toFixed(6)}, ${second.toFixed(6)}] (lat, lng)`;
  }
}

/**
 * Calculate the distance between two [lng, lat] coordinates in meters using Haversine formula
 */
export function calculateDistance(coord1: CoordinateLngLat, coord2: CoordinateLngLat): number {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}












