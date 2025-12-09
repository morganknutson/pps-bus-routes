/**
 * Parse bus route information from PDF text
 */
import { formatStreetName } from '../utils/formatAddress.js';

/**
 * Extract route name and direction from filename
 * Example: "100SYL-A_effective_082625.pdf" -> { name: "100", direction: "Morning" }
 */
function extractRouteInfoFromFilename(filename) {
  if (!filename) {
    return { name: 'Unknown Route', direction: null };
  }
  
  const match = filename.match(/(\d+)SYL-([AP])_/);
  if (match) {
    const routeNum = match[1];
    const direction = match[2] === 'A' ? 'Morning' : 'Afternoon';
    return { name: routeNum, direction };
  }
  
  // Fallback: try to extract any number
  const numMatch = filename.match(/(\d+)/);
  return {
    name: numMatch ? `Route ${numMatch[1]}` : 'Unknown Route',
    direction: null,
  };
}

/**
 * Extract anchor name (school loading zone) from PDF text
 * Format: "Anchor Name:WEST SYLVAN GT LOADING ZONE IN DRIVEWAY"
 * This is used for matching routes to schools, not for creating stops
 */
export function extractAnchorName(text) {
  const anchorMatch = text.match(/Anchor Name:\s*([^\n]+)/i);
  if (anchorMatch && anchorMatch[1]) {
    return anchorMatch[1].trim();
  }
  return null;
}

/**
 * Parse bus stop addresses from PDF text
 * Format: "8:33 amADDRESS[DIRECTION]ROUTE(ORDER)Stop Order #:"
 * Examples:
 * - "8:33 amAINSWORTH GT & ST & CAB LOAD ZONE100SYL-AStop Order #:"
 * - "8:35 amSW PATTON@VISTA@GEORGIAN@BROADWAY [NW]100SYL-A(1)Stop Order #:"
 * - "8:36 amSW PATTON RD @ SW MONTGOMERY DR [NE]100SYL-A(2)Stop Order #:"
 * - "8:54 am3737 SW HUMPHREY BLVD [NE]100SYL-A(12)Stop Order #:"
 * @param text PDF text content
 * @param anchorName Optional anchor name to filter out (school loading zone)
 */
function parseStops(text, anchorName = null) {
  const stops = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Pattern to match stop lines: time + address + optional direction + route info
  // Format: "8:33 amADDRESS[DIRECTION]ROUTE(ORDER)Stop Order #:"
  const stopPattern = /^(\d{1,2}:\d{2}\s*(?:am|pm))(.+?)(?:\[([NWES]+)\])?(?:\d+SYL-[AP](?:\(\d+\))?)?(?:Stop Order #:)?$/i;
  
  for (const line of lines) {
    // Skip header lines
    if (
      line.toLowerCase().includes('route:') ||
      line.toLowerCase().includes('anchor name:') ||
      line.toLowerCase().includes('note:') ||
      line.toLowerCase().includes('bus schedule') ||
      line.toLowerCase().includes('driver to distribute') ||
      line.toLowerCase().includes('families, school') ||
      line.toLowerCase().includes('to:') ||
      line.toLowerCase().includes('re:') ||
      line.match(/^\[.*\]$/) || // Checkbox lines
      line.length < 10
    ) {
      continue;
    }
    
    // Try to match the stop pattern
    const match = line.match(stopPattern);
    if (match) {
      const time = match[1].trim();
      let address = match[2].trim();
      const direction = match[3] || '';
      
      // Clean up the address
      // Remove route numbers and stop order info that might be at the end
      address = address
        .replace(/\d+SYL-[AP](?:\(\d+\))?/gi, '') // Remove route numbers like "100SYL-A(1)"
        .replace(/Stop Order #:.*$/i, '') // Remove "Stop Order #:" and anything after
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // Skip if address is too short or empty
      if (address.length < 5) {
        continue;
      }
      
      // Format addresses with "@" to use "&" instead for consistency
      address = address.replace(/\s+@\s+/g, ' & ');
      
      // Handle multiple "@" separators (e.g., "SW PATTON@VISTA@GEORGIAN@BROADWAY")
      // Convert to a more readable format
      if (address.includes('@') && !address.includes(' & ')) {
        const parts = address.split('@').map(p => p.trim()).filter(p => p);
        if (parts.length > 1) {
          // Join with " & " for cross streets
          address = parts.join(' & ');
        }
      }
      
      // Format street name to Title Case (e.g., "SW PATTON RD" -> "SW Patton Rd")
      address = formatStreetName(address);
      
      // Check if this matches the anchor name (school loading zone) - we'll add it separately
      let isSchoolLoadingZone = false;
      if (anchorName) {
        const formattedAnchorName = formatStreetName(anchorName);
        const normalizedAddress = address.toLowerCase();
        const normalizedAnchorName = formattedAnchorName.toLowerCase();
        // Check if addresses match (allowing for minor variations)
        if (normalizedAddress === normalizedAnchorName || 
            normalizedAddress.includes(normalizedAnchorName) ||
            normalizedAnchorName.includes(normalizedAddress)) {
          continue; // Skip this stop as it's the school loading zone (we'll add it separately)
        }
      }
      
      // Check if this is a loading zone (CAB LOAD ZONE, LOADING ZONE, LOAD ZONE, etc.)
      // But exclude school loading zones (which are handled separately)
      const normalizedAddress = address.toLowerCase();
      const isLoadingZone = (
        normalizedAddress.includes('cab load zone') ||
        normalizedAddress.includes('load zone') || 
        normalizedAddress.includes('loading zone')
      ) && !isSchoolLoadingZone;
      
      // Add direction to address if present
      if (direction) {
        address = `${address} [${direction}]`;
      }
      
      // Avoid duplicates
      const normalizedAddressForDupCheck = address.toLowerCase();
      if (!stops.some(s => s.address.toLowerCase() === normalizedAddressForDupCheck)) {
        stops.push({
          id: `stop-${stops.length + 1}`,
          address,
          time,
          direction: direction || null,
          originalLine: line,
          skipGeocoding: isLoadingZone, // Mark loading zone stops to skip geocoding
        });
      }
    }
  }
  
  return stops;
}

/**
 * Parse route from PDF text
 * Note: School stops are NOT created here - they should be added from schools.json data
 * The anchor name is returned for matching routes to schools
 */
export function parseRouteFromPDF(text, fileId, filename = '') {
  const routeInfo = extractRouteInfoFromFilename(filename);
  const anchorName = extractAnchorName(text);
  const stops = parseStops(text, anchorName); // Pass anchor name to filter it out from regular stops
  
  return {
    id: fileId || `route-${Date.now()}`,
    name: routeInfo.name,
    direction: routeInfo.direction,
    filename,
    stops, // Only regular stops - school stop will be added separately
    anchorName, // Return anchor name for school matching
    rawText: text.substring(0, 500), // First 500 chars for debugging
  };
}


