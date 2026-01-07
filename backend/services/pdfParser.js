/**
 * @fileoverview PDF Parser for PPS Bus Route Documents
 * 
 * This module extracts bus stop information from Portland Public Schools (PPS)
 * bus route PDF documents. It handles the specific formatting used by PPS,
 * including route numbers, directions, stop times, and intersection addresses.
 * 
 * @module services/pdfParser
 * @requires ../utils/formatAddress.js
 * 
 * @example
 * // Parse a PDF after extracting text with pdf-parse
 * import pdfParse from 'pdf-parse';
 * import { parseRouteFromPDF } from './pdfParser.js';
 * 
 * const pdfData = await pdfParse(pdfBuffer);
 * const route = parseRouteFromPDF(pdfData.text, 'file-123', '100SYL-A_effective_082625.pdf');
 * 
 * console.log(route.name);      // "100"
 * console.log(route.direction); // "Morning"
 * console.log(route.stops);     // [{ address: "SW Patton & Vista", time: "8:35 am", ... }]
 * 
 * @see {@link https://www.pps.net/transportation|PPS Transportation}
 */

import { formatStreetName } from '../utils/formatAddress.js';

/**
 * Extracts route information from a PDF filename.
 * 
 * PPS route PDF filenames follow the pattern:
 * `{ROUTE_NUMBER}{SCHOOL_CODE}-{DIRECTION}_effective_{DATE}.pdf`
 * 
 * - ROUTE_NUMBER: 1-3 digit route number (e.g., "100", "207")
 * - SCHOOL_CODE: 2-4 letter school abbreviation (e.g., "SYL", "ABE", "BVC")
 * - DIRECTION: "A" for AM (Morning) or "P" for PM (Afternoon)
 * - DATE: Effective date in MMDDYY format
 * 
 * @private
 * @param {string} filename - The PDF filename to parse
 * @param {string|null} [text=null] - Optional PDF text content for fallback extraction
 * @returns {Object} Route information object
 * @returns {string} returns.name - Route number (e.g., "100") or "Unknown Route"
 * @returns {string|null} returns.direction - "Morning", "Afternoon", or null
 * 
 * @example
 * // Standard filename
 * extractRouteInfoFromFilename('100SYL-A_effective_082625.pdf')
 * // Returns: { name: '100', direction: 'Morning' }
 * 
 * @example
 * // Afternoon route
 * extractRouteInfoFromFilename('207BVC-P_effective_082625.pdf')
 * // Returns: { name: '207', direction: 'Afternoon' }
 * 
 * @example
 * // Fallback to PDF text
 * extractRouteInfoFromFilename('unknown.pdf', 'Route: 238ABE-A some text')
 * // Returns: { name: '238', direction: 'Morning' }
 */
function extractRouteInfoFromFilename(filename, text = null) {
  if (!filename) {
    return { name: 'Unknown Route', direction: null, isUpcoming: false };
  }
  
  // Pattern: {ROUTE}{CODE}-{DIRECTION}_effective_{DATE}.pdf
  // Example: "100SYL-A_effective_082625.pdf" or "238ABE-A_effective_082625.pdf"
  const match = filename.match(/(\d+)([A-Z]{2,})-([AP])_effective_(\d{6})/);
  if (match) {
    const routeNum = match[1];
    const direction = match[3] === 'A' ? 'Morning' : 'Afternoon';
    const dateStr = match[4]; // MMDDYY
    
    // Check if date is in the future
    let isUpcoming = false;
    try {
      const month = parseInt(dateStr.substring(0, 2)) - 1;
      const day = parseInt(dateStr.substring(2, 4));
      const year = 2000 + parseInt(dateStr.substring(4, 6));
      const effectiveDate = new Date(year, month, day);
      
      // Set to start of day for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // If date is in the future (tomorrow or later), consider it upcoming
      if (effectiveDate > today) {
        isUpcoming = true;
      }
    } catch (e) {
      console.error('Error parsing date from filename:', dateStr);
    }
    
    return { name: routeNum, direction, isUpcoming };
  }
  
  // If filename doesn't match standard pattern, try text search
  if (text) {
    const textMatch = text.match(/(?:route[:\s]*)?(\d+)([A-Z]{2,})-([AP])/i);
    if (textMatch) {
      const routeNum = textMatch[1];
      const direction = textMatch[3].toUpperCase() === 'A' ? 'Morning' : 'Afternoon';
      return { name: routeNum, direction, isUpcoming: false };
    }
  }
  
  // Fallback: try to extract any number from filename
  const numMatch = filename.match(/(\d+)/);
  return {
    name: numMatch ? `Route ${numMatch[1]}` : 'Unknown Route',
    direction: null,
    isUpcoming: false,
  };
}

/**
 * Extracts the anchor name (school loading zone) from PDF text.
 * 
 * The anchor name identifies the school's bus loading zone location.
 * It appears in the PDF as "Anchor Name:SCHOOL_NAME LOADING ZONE..."
 * 
 * This is used for:
 * 1. Matching routes to schools
 * 2. Filtering out the school stop from regular stops (added separately from schools.json)
 * 
 * @param {string} text - The full PDF text content
 * @returns {string|null} The anchor name if found, null otherwise
 * 
 * @example
 * // PDF contains: "Anchor Name:WEST SYLVAN GT LOADING ZONE IN DRIVEWAY"
 * const anchor = extractAnchorName(pdfText);
 * // Returns: "WEST SYLVAN GT LOADING ZONE IN DRIVEWAY"
 * 
 * @example
 * // No anchor name in PDF
 * const anchor = extractAnchorName("Some other text");
 * // Returns: null
 */
export function extractAnchorName(text) {
  const anchorMatch = text.match(/Anchor Name:\s*([^\n]+)/i);
  if (anchorMatch && anchorMatch[1]) {
    return anchorMatch[1].trim();
  }
  return null;
}

/**
 * Parses bus stop information from PDF text content.
 * 
 * PPS PDF stop entries follow this format:
 * `{TIME}{ADDRESS}[{DIRECTION}]{ROUTE_CODE}({ORDER})Stop Order #:`
 * 
 * Example line:
 * `8:35 amSW PATTON@VISTA@GEORGIAN@BROADWAY [NW]100SYL-A(1)Stop Order #:`
 * 
 * This function:
 * 1. Splits text into lines
 * 2. Matches each line against the stop pattern regex
 * 3. Cleans and formats addresses
 * 4. Handles loading zones (marked as skipGeocoding)
 * 5. Deduplicates stops by address
 * 
 * @private
 * @param {string} text - The full PDF text content
 * @param {string|null} [anchorName=null] - Optional anchor name to filter out
 * @returns {Array<Object>} Array of stop objects
 * 
 * @example
 * // Returns array of stops like:
 * [
 *   {
 *     id: 'stop-1',
 *     address: 'SW Patton & Vista & Georgian & Broadway [NW]',
 *     time: '8:35 am',
 *     direction: 'NW',
 *     originalLine: '8:35 amSW PATTON@VISTA@GEORGIAN@BROADWAY [NW]100SYL-A(1)...',
 *     skipGeocoding: false
 *   },
 *   {
 *     id: 'stop-2',
 *     address: 'Cab Load Zone',
 *     time: '8:33 am',
 *     direction: null,
 *     originalLine: '...',
 *     skipGeocoding: true  // Loading zones are not geocoded
 *   }
 * ]
 */
function parseStops(text, anchorName = null) {
  const stops = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Pattern to match stop lines: time + address + optional direction + route info
  // Format: "8:33 amADDRESS[DIRECTION]ROUTE(ORDER)Stop Order #:"
  // Supports any school code (not just SYL)
  const stopPattern = /^(\d{1,2}:\d{2}\s*(?:am|pm))(.+?)(?:\[([NWES]+)\])?(?:\d+[A-Z]{2,}-[AP](\((\d+)\))?)?(?:Stop Order #:)?$/i;
  
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
      const stopOrder = match[5] || null;
      
      // Clean up the address
      // Remove route numbers and stop order info that might be at the end
      // Supports any school code (not just SYL)
      address = address
        .replace(/\d+[A-Z]{2,}-[AP](?:\(\d+\))?/gi, '') // Remove route numbers like "100SYL-A(1)" or "238ABE-A(1)"
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
          isSchoolLoadingZone = true;
          continue; // Skip this stop as it's the school loading zone (we'll add it separately)
        }
      }
      
      // Check if this is a loading zone or non-geocodable highway stop
      const normalizedAddress = address.toLowerCase();
      const isLoadingZone = (
        normalizedAddress.includes('cab load zone') ||
        normalizedAddress.includes('load zone') || 
        normalizedAddress.includes('loading zone') ||
        normalizedAddress.includes('fwy') || // Highway stops like "I5 Fwy"
        normalizedAddress.includes('no intersection') || // Non-intersection driver notes
        normalizedAddress.includes('bus yard') ||
        normalizedAddress.includes('bus garage') ||
        (!stopOrder && !isSchoolLoadingZone) // If no stop order is found, it's likely a transition stop/loading zone
      );
      
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
 * Parses a complete bus route from PDF text content.
 * 
 * This is the main entry point for PDF parsing. It:
 * 1. Extracts route info (number, direction) from filename
 * 2. Extracts anchor name for school matching
 * 3. Parses all stops from the text
 * 
 * **Important**: School stops are NOT created here. They should be added
 * separately from schools.json data by the route processor. The anchor name
 * is returned for matching routes to the correct school.
 * 
 * @param {string} text - The full PDF text content (from pdf-parse)
 * @param {string} fileId - Unique identifier for this route (Drive file ID or generated)
 * @param {string} [filename=''] - Original PDF filename for route info extraction
 * @returns {Object} Parsed route object
 * @returns {string} returns.id - Route identifier
 * @returns {string} returns.name - Route number (e.g., "100")
 * @returns {string|null} returns.direction - "Morning" or "Afternoon"
 * @returns {string} returns.filename - Original filename
 * @returns {Array<Object>} returns.stops - Array of stop objects (without school stop)
 * @returns {string|null} returns.anchorName - School loading zone name for matching
 * @returns {string} returns.rawText - First 500 chars of PDF for debugging
 * 
 * @example
 * import pdfParse from 'pdf-parse';
 * import fs from 'fs';
 * 
 * // Read and parse PDF
 * const pdfBuffer = fs.readFileSync('100SYL-A_effective_082625.pdf');
 * const pdfData = await pdfParse(pdfBuffer);
 * 
 * // Parse route info
 * const route = parseRouteFromPDF(
 *   pdfData.text,
 *   'drive-file-id-123',
 *   '100SYL-A_effective_082625.pdf'
 * );
 * 
 * console.log(route);
 * // {
 * //   id: 'drive-file-id-123',
 * //   name: '100',
 * //   direction: 'Morning',
 * //   filename: '100SYL-A_effective_082625.pdf',
 * //   stops: [
 * //     { id: 'stop-1', address: 'SW Patton & Vista [NW]', time: '8:35 am', ... },
 * //     { id: 'stop-2', address: 'SW Montgomery & Humphrey', time: '8:36 am', ... }
 * //   ],
 * //   anchorName: 'WEST SYLVAN GT LOADING ZONE IN DRIVEWAY',
 * //   rawText: 'Route: 100SYL-A\nAnchor Name:WEST SYLVAN...'
 * // }
 * 
 * @example
 * // The route can then be processed further
 * import { processSinglePDF } from './routeProcessor.js';
 * 
 * // routeProcessor will:
 * // - Geocode all stops
 * // - Add school stop from schools.json
 * // - Calculate route geometry
 * // - Save to JSON file
 */
export function parseRouteFromPDF(text, fileId, filename = '') {
  const routeInfo = extractRouteInfoFromFilename(filename, text); // Pass text to extract route from PDF content
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
