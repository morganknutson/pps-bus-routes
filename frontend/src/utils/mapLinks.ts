/**
 * Generate a map link for an address
 * - On Mac: Opens Apple Maps
 * - On PC/Other: Opens Google Maps in new tab
 */
export function getMapLink(address: string, coordinates?: [number, number]): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  if (isMac && coordinates) {
    // Apple Maps URL format: maps://maps.apple.com/?q=address or maps://?ll=lat,lng
    const [lng, lat] = coordinates;
    return `maps://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(address)}`;
  } else {
    // Google Maps URL format
    if (coordinates) {
      const [lng, lat] = coordinates;
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    } else {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    }
  }
}

/**
 * Handle map link click - opens in appropriate app/browser
 */
export function handleMapLinkClick(e: React.MouseEvent, address: string, coordinates?: [number, number]) {
  e.preventDefault();
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  if (isMac && coordinates) {
    // Try Apple Maps first
    const [lng, lat] = coordinates;
    const appleMapsUrl = `maps://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(address)}`;
    window.location.href = appleMapsUrl;
    
    // Fallback to Google Maps if Apple Maps doesn't open
    setTimeout(() => {
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      window.open(googleMapsUrl, '_blank');
    }, 500);
  } else {
    // Open Google Maps in new tab
    const url = coordinates
      ? `https://www.google.com/maps/search/?api=1&query=${coordinates[1]},${coordinates[0]}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  }
}













