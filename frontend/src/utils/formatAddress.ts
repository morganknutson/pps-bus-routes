/**
 * Format street names to Title Case
 * Handles directional prefixes, street types, and special cases
 */

// Mapping of street type abbreviations to their proper formatted versions
const STREET_TYPE_MAP: Record<string, string> = {
  'ST': 'St.',
  'STREET': 'St.',
  'RD': 'Rd.',
  'ROAD': 'Rd.',
  'DR': 'Dr.',
  'DRIVE': 'Dr.',
  'AVE': 'Ave.',
  'AVENUE': 'Ave.',
  'AV': 'Ave.',
  'BLVD': 'Blvd.',
  'BOULEVARD': 'Blvd.',
  'LN': 'Ln.',
  'LANE': 'Ln.',
  'CT': 'Ct.',
  'COURT': 'Ct.',
  'PL': 'Pl.',
  'PLACE': 'Pl.',
  'TERR': 'Terr.',
  'TERRACE': 'Terr.',
  'CIR': 'Cir.',
  'CIRCLE': 'Cir.',
  'PKWY': 'Pkwy.',
  'PARKWAY': 'Pkwy.',
  'WAY': 'Way',
  'GT': 'Gt.',
  'GATE': 'Gt.',
  'PK': 'Pk.',
  'PARK': 'Pk.',
  'SQ': 'Sq.',
  'SQUARE': 'Sq.',
  'TRL': 'Trl.',
  'TRAIL': 'Trl.',
};

// Set of all street type abbreviations (for quick lookup)
const STREET_TYPES = new Set(Object.keys(STREET_TYPE_MAP));

// Directional prefixes (keep uppercase)
const DIRECTIONS = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'NORTH', 'SOUTH', 'EAST', 'WEST']);

// Special words that should stay uppercase
const SPECIAL_WORDS = new Set(['LOAD', 'ZONE', 'CAB']);

/**
 * Format a single word to Title Case, respecting special cases
 */
function formatWord(word: string, index: number, words: string[]): string {
  const upperWord = word.toUpperCase();
  
  // Check if it's a directional (can appear at start or after a number)
  if (DIRECTIONS.has(upperWord)) {
    return upperWord;
  }
  
  // Check if it's a street type (usually last word before optional direction in brackets)
  if (STREET_TYPES.has(upperWord)) {
    return STREET_TYPE_MAP[upperWord];
  }
  
  // Check if it's a special word
  if (SPECIAL_WORDS.has(upperWord)) {
    return upperWord;
  }
  
  // Check if it's a number (like "3737")
  if (/^\d+$/.test(word)) {
    return word;
  }
  
  // Default: Title Case
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Format an address string to Title Case
 * Examples:
 * - "SW PATTON RD & SW MONTGOMERY DR" -> "SW Patton Rd. & SW Montgomery Dr."
 * - "3737 SW HUMPHREY BLVD" -> "3737 SW Humphrey Blvd."
 * - "SW COUNCIL CREST DR" -> "SW Council Crest Dr."
 * - "AINSWORTH GT & ST & CAB LOAD ZONE" -> "Ainsworth Gt. & St. & Cab Load Zone"
 */
export function formatStreetName(address: string): string {
  if (!address) return address;
  
  // Split by common separators but keep them
  // We'll process each part separately
  const parts = address.split(/(\s+&\s+|\s+AND\s+)/i);
  
  return parts.map(part => {
    // If it's a separator (& or AND), keep it as is
    if (/^\s*&\s*$|^\s+AND\s+$/i.test(part)) {
      return part;
    }
    
    // Split into words
    const words = part.trim().split(/\s+/);
    
    return words.map((word, index) => {
      // Format the word (formatWord handles directionals, street types, etc.)
      return formatWord(word, index, words);
    }).join(' ');
  }).join('');
}

// Mapping of directional abbreviations to full words for geocoding
const DIRECTION_EXPANSION: Record<string, string> = {
  'N': 'North',
  'S': 'South',
  'E': 'East',
  'W': 'West',
  'NE': 'Northeast',
  'NW': 'Northwest',
  'SE': 'Southeast',
  'SW': 'Southwest',
  'NORTH': 'North',
  'SOUTH': 'South',
  'EAST': 'East',
  'WEST': 'West',
};

// Mapping of street type abbreviations to full words for geocoding
const STREET_TYPE_EXPANSION: Record<string, string> = {
  'ST.': 'Street',
  'ST': 'Street',
  'STREET': 'Street',
  'RD.': 'Road',
  'RD': 'Road',
  'ROAD': 'Road',
  'DR.': 'Drive',
  'DR': 'Drive',
  'DRIVE': 'Drive',
  'AVE.': 'Avenue',
  'AVE': 'Avenue',
  'AVENUE': 'Avenue',
  'AV': 'Avenue',
  'BLVD.': 'Boulevard',
  'BLVD': 'Boulevard',
  'BOULEVARD': 'Boulevard',
  'LN.': 'Lane',
  'LN': 'Lane',
  'LANE': 'Lane',
  'CT.': 'Court',
  'CT': 'Court',
  'COURT': 'Court',
  'PL.': 'Place',
  'PL': 'Place',
  'PLACE': 'Place',
  'TERR.': 'Terrace',
  'TERR': 'Terrace',
  'TERRACE': 'Terrace',
  'CIR.': 'Circle',
  'CIR': 'Circle',
  'CIRCLE': 'Circle',
  'PKWY.': 'Parkway',
  'PKWY': 'Parkway',
  'PARKWAY': 'Parkway',
  'WAY': 'Way',
  'GT.': 'Gate',
  'GT': 'Gate',
  'GATE': 'Gate',
  'PK.': 'Park',
  'PK': 'Park',
  'PARK': 'Park',
  'SQ.': 'Square',
  'SQ': 'Square',
  'SQUARE': 'Square',
  'TRL.': 'Trail',
  'TRL': 'Trail',
  'TRAIL': 'Trail',
};

/**
 * Expand abbreviations in a street address for better geocoding
 * Converts abbreviations like "SW Montgomery Dr." to "Southwest Montgomery Drive"
 * Examples:
 * - "SW Montgomery Dr." -> "Southwest Montgomery Drive"
 * - "NE 42nd Ave." -> "Northeast 42nd Avenue"
 * - "NW Couch St." -> "Northwest Couch Street"
 */
export function expandAddressForGeocoding(address: string): string {
  if (!address) return address;
  
  // Remove any direction indicators in brackets at the end (e.g., "[NE]")
  const cleanAddress = address.replace(/\s*\[.*?\]\s*$/, '').trim();
  
  // Split into words
  const words = cleanAddress.split(/\s+/);
  
  return words.map((word, index) => {
    const upperWord = word.toUpperCase();
    
    // Check if it's a directional (usually first word or after a number)
    if (DIRECTION_EXPANSION[upperWord]) {
      return DIRECTION_EXPANSION[upperWord];
    }
    
    // Check if it's a street type (usually last word)
    if (STREET_TYPE_EXPANSION[upperWord]) {
      return STREET_TYPE_EXPANSION[upperWord];
    }
    
    // Keep the word as-is (might be a number or street name)
    return word;
  }).join(' ');
}

