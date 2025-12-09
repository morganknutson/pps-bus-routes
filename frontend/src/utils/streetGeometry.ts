/**
 * Improved street geometry fetching with proper segment connection and validation
 */

interface WayElement {
  type: string;
  id: number;
  nodes: number[];
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: {
    name?: string;
    highway?: string;
    'addr:street'?: string;
  };
}

interface NodeElement {
  type: string;
  id: number;
  lat: number;
  lon: number;
}

interface OverpassResponse {
  elements: (WayElement | NodeElement)[];
}

/**
 * Normalize a street name for comparison
 * Handles directionals, street types, and variations
 */
function normalizeStreetName(name: string): {
  directional: string | null;
  baseName: string;
  streetType: string | null;
  normalized: string;
} {
  if (!name) {
    return { directional: null, baseName: '', streetType: null, normalized: '' };
  }

  const upper = name.toUpperCase().trim();
  
  // Extract directional prefix
  const directionMap: Record<string, string> = {
    'N': 'NORTH',
    'S': 'SOUTH',
    'E': 'EAST',
    'W': 'WEST',
    'NE': 'NORTHEAST',
    'NW': 'NORTHWEST',
    'SE': 'SOUTHEAST',
    'SW': 'SOUTHWEST',
    'NORTH': 'NORTH',
    'SOUTH': 'SOUTH',
    'EAST': 'EAST',
    'WEST': 'WEST',
    'NORTHEAST': 'NORTHEAST',
    'NORTHWEST': 'NORTHWEST',
    'SOUTHEAST': 'SOUTHEAST',
    'SOUTHWEST': 'SOUTHWEST',
  };

  const words = upper.split(/\s+/);
  let directional: string | null = null;
  let startIdx = 0;

  // Check if first word is a directional
  if (words.length > 0 && directionMap[words[0]]) {
    directional = directionMap[words[0]];
    startIdx = 1;
  }

  // Extract street type (usually last word)
  const streetTypeMap: Record<string, string> = {
    'ST': 'STREET',
    'ST.': 'STREET',
    'STREET': 'STREET',
    'RD': 'ROAD',
    'RD.': 'ROAD',
    'ROAD': 'ROAD',
    'DR': 'DRIVE',
    'DR.': 'DRIVE',
    'DRIVE': 'DRIVE',
    'AVE': 'AVENUE',
    'AVE.': 'AVENUE',
    'AV': 'AVENUE',
    'AVENUE': 'AVENUE',
    'BLVD': 'BOULEVARD',
    'BLVD.': 'BOULEVARD',
    'BOULEVARD': 'BOULEVARD',
    'LN': 'LANE',
    'LN.': 'LANE',
    'LANE': 'LANE',
    'CT': 'COURT',
    'CT.': 'COURT',
    'COURT': 'COURT',
    'PL': 'PLACE',
    'PL.': 'PLACE',
    'PLACE': 'PLACE',
    'TERR': 'TERRACE',
    'TERR.': 'TERRACE',
    'TERRACE': 'TERRACE',
    'CIR': 'CIRCLE',
    'CIR.': 'CIRCLE',
    'CIRCLE': 'CIRCLE',
    'PKWY': 'PARKWAY',
    'PKWY.': 'PARKWAY',
    'PARKWAY': 'PARKWAY',
    'WAY': 'WAY',
    'GT': 'GATE',
    'GT.': 'GATE',
    'GATE': 'GATE',
  };

  let streetType: string | null = null;
  let endIdx = words.length;

  // Check if last word is a street type
  if (words.length > startIdx) {
    const lastWord = words[words.length - 1];
    if (streetTypeMap[lastWord]) {
      streetType = streetTypeMap[lastWord];
      endIdx = words.length - 1;
    }
  }

  // Base name is everything between directional and street type
  const baseName = words.slice(startIdx, endIdx).join(' ');

  // Create normalized version for comparison
  const parts: string[] = [];
  if (directional) parts.push(directional);
  parts.push(baseName);
  if (streetType) parts.push(streetType);
  const normalized = parts.join(' ');

  return { directional, baseName, streetType, normalized };
}

/**
 * Check if an OSM street name matches the requested street name
 */
function matchesStreetName(osmName: string, requestedName: string): boolean {
  const osmNorm = normalizeStreetName(osmName);
  const reqNorm = normalizeStreetName(requestedName);

  // If both have directionals, they must match
  if (osmNorm.directional && reqNorm.directional) {
    if (osmNorm.directional !== reqNorm.directional) {
      return false;
    }
  }

  // Base names must match (case-insensitive comparison already done in normalize)
  if (osmNorm.baseName !== reqNorm.baseName) {
    return false;
  }

  // If both have street types, they should match (but be flexible)
  if (osmNorm.streetType && reqNorm.streetType) {
    // Allow some flexibility (e.g., "St" vs "Street")
    if (osmNorm.streetType !== reqNorm.streetType) {
      return false;
    }
  }

  return true;
}

/**
 * Connect way segments that share nodes to form continuous paths
 */
function connectWaySegments(ways: WayElement[]): [number, number][][] {
  if (ways.length === 0) return [];

  // Build a map of node -> ways that use it
  const nodeToWays = new Map<number, WayElement[]>();
  for (const way of ways) {
    if (!way.nodes || way.nodes.length === 0) continue;
    for (const nodeId of way.nodes) {
      if (!nodeToWays.has(nodeId)) {
        nodeToWays.set(nodeId, []);
      }
      nodeToWays.get(nodeId)!.push(way);
    }
  }

  // Build coordinate sequences by connecting segments
  const sequences: [number, number][][] = [];
  const usedWays = new Set<number>();

  for (const way of ways) {
    if (usedWays.has(way.id) || !way.geometry || way.geometry.length === 0) {
      continue;
    }

    // Start a new sequence with this way
    const sequence: [number, number][] = way.geometry.map(p => [p.lat, p.lon]);
    usedWays.add(way.id);

    // Try to extend the sequence in both directions
    let startNode = way.nodes[0];
    let endNode = way.nodes[way.nodes.length - 1];

    // Extend forward
    while (true) {
      const connectedWays = nodeToWays.get(endNode)?.filter(w => !usedWays.has(w.id)) || [];
      if (connectedWays.length === 0) break;

      // Take the first connected way (could be improved to choose best match)
      const nextWay = connectedWays[0];
      if (!nextWay.geometry || nextWay.geometry.length === 0) {
        usedWays.add(nextWay.id);
        continue;
      }

      // Check if we need to reverse the next way
      const nextStartNode = nextWay.nodes[0];
      const nextEndNode = nextWay.nodes[nextWay.nodes.length - 1];

      if (endNode === nextStartNode) {
        // Connect normally
        sequence.push(...nextWay.geometry.map(p => [p.lat, p.lon]));
        endNode = nextEndNode;
      } else if (endNode === nextEndNode) {
        // Reverse the next way
        sequence.push(...nextWay.geometry.slice().reverse().map(p => [p.lat, p.lon]));
        endNode = nextStartNode;
      } else {
        break;
      }

      usedWays.add(nextWay.id);
    }

    // Extend backward
    while (true) {
      const connectedWays = nodeToWays.get(startNode)?.filter(w => !usedWays.has(w.id)) || [];
      if (connectedWays.length === 0) break;

      const prevWay = connectedWays[0];
      if (!prevWay.geometry || prevWay.geometry.length === 0) {
        usedWays.add(prevWay.id);
        continue;
      }

      const prevStartNode = prevWay.nodes[0];
      const prevEndNode = prevWay.nodes[prevWay.nodes.length - 1];

      if (startNode === prevEndNode) {
        // Connect normally (prepend)
        sequence.unshift(...prevWay.geometry.map(p => [p.lat, p.lon]));
        startNode = prevStartNode;
      } else if (startNode === prevStartNode) {
        // Reverse and prepend
        sequence.unshift(...prevWay.geometry.slice().reverse().map(p => [p.lat, p.lon]));
        startNode = prevEndNode;
      } else {
        break;
      }

      usedWays.add(prevWay.id);
    }

    sequences.push(sequence);
  }

  return sequences;
}

/**
 * Fetch street geometry from OpenStreetMap with improved accuracy
 * @param streetName - Street name (can be in any format: "SW Patton Rd", "Southwest Patton Road", etc.)
 * @param bbox - Bounding box for search area (default: Portland, OR)
 */
export async function fetchStreetGeometry(
  streetName: string,
  bbox: string = '(45.4,-122.8,45.6,-122.6)'
): Promise<[number, number][] | null> {
  try {
    // Use the street name as-is (caller can expand if needed, but we'll handle variations)
    const inputStreet = streetName.trim();
    console.log('Fetching street geometry for:', inputStreet);

    // Normalize the requested name (handles both expanded and abbreviated forms)
    const normalized = normalizeStreetName(inputStreet);

    // Build query variations
    const queries: string[] = [];
    
    // Try exact name match first (case-insensitive) - use original input
    const escapedName = inputStreet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    queries.push(`way["name"="${escapedName}",i]["highway"~"^(primary|secondary|tertiary|residential|unclassified|service)$"]${bbox};`);

    // Try with normalized name (if different from input)
    if (normalized.normalized !== inputStreet.toUpperCase()) {
      const escapedNorm = normalized.normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      queries.push(`way["name"="${escapedNorm}",i]["highway"~"^(primary|secondary|tertiary|residential|unclassified|service)$"]${bbox};`);
    }

    // Try without directional (if present)
    if (normalized.directional) {
      const nameWithoutDir = `${normalized.baseName}${normalized.streetType ? ' ' + normalized.streetType : ''}`;
      const escapedNoDir = nameWithoutDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      queries.push(`way["name"="${escapedNoDir}",i]["highway"~"^(primary|secondary|tertiary|residential|unclassified|service)$"]${bbox};`);
    }

    // Fallback to regex if exact matches fail (but be more specific)
    const baseNameEscaped = normalized.baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    queries.push(`way["name"~"^${baseNameEscaped}(\\s+(Street|St|Road|Rd|Drive|Dr|Avenue|Ave|Blvd|Boulevard|Lane|Ln|Court|Ct|Place|Pl|Terrace|Terr|Circle|Cir|Parkway|Pkwy|Way|Gate|Gt))?$",i]["highway"~"^(primary|secondary|tertiary|residential|unclassified|service)$"]${bbox};`);

    const overpassQuery = `
      [out:json][timeout:25];
      (
        ${queries.join('\n        ')}
      );
      out geom;
    `;

    console.log('Overpass query:', overpassQuery);

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });

    if (!response.ok) {
      console.error('Overpass API error:', response.status, response.statusText);
      return null;
    }

    const data: OverpassResponse = await response.json();
    console.log('Overpass response elements:', data.elements?.length || 0);

    if (!data.elements || data.elements.length === 0) {
      console.log('No street elements found');
      return null;
    }

    // Filter to only ways with geometry and validate names
    const ways: WayElement[] = [];
    for (const element of data.elements) {
      if (element.type === 'way' && element.geometry && element.geometry.length > 0) {
        const way = element as WayElement;
        // Validate that the name matches (allows some flexibility)
        if (way.tags?.name && matchesStreetName(way.tags.name, inputStreet)) {
          ways.push(way);
        }
      }
    }

    if (ways.length === 0) {
      console.log('No matching street ways found after validation');
      return null;
    }

    console.log(`Found ${ways.length} matching way segments`);

    // Connect segments to form continuous paths
    const sequences = connectWaySegments(ways);

    if (sequences.length === 0) {
      return null;
    }

    // If we have multiple disconnected sequences, combine them (they'll be shown as separate polylines)
    // For now, return the longest sequence, or combine all if they're close
    if (sequences.length === 1) {
      return sequences[0];
    }

    // Multiple sequences - combine them (user might want to see all parts)
    // Sort by length and take the longest, or combine if they're reasonably close
    const allCoords: [number, number][] = [];
    for (const seq of sequences) {
      allCoords.push(...seq);
      // Add a small gap marker (NaN coordinates) to indicate disconnection
      // But Leaflet doesn't handle NaN well, so we'll just concatenate
      // The user will see all segments highlighted
    }

    console.log(`Combined ${sequences.length} sequences into ${allCoords.length} coordinates`);
    return allCoords.length > 0 ? allCoords : null;
  } catch (error) {
    console.error('Error fetching street geometry:', error);
    return null;
  }
}

