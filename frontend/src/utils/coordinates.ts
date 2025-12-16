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




