/**
 * Distance calculation utilities using Haversine formula
 * Coordinates are in [lng, lat] format (GeoJSON standard)
 */

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param coord1 [lng, lat] coordinates
 * @param coord2 [lng, lat] coordinates
 * @returns Distance in kilometers
 */
export function calculateDistance(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert kilometers to miles
 */
export function kmToMiles(km: number): number {
  return km * 0.621371;
}

/**
 * Format distance for display
 */
export function formatDistance(km: number, useMiles = false): string {
  const distance = useMiles ? kmToMiles(km) : km;
  const unit = useMiles ? 'mi' : 'km';
  
  if (distance < 1) {
    return `${(distance * (useMiles ? 5280 : 1000)).toFixed(0)} ${useMiles ? 'ft' : 'm'}`;
  }
  
  return `${distance.toFixed(2)} ${unit}`;
}



