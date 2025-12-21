/**
 * Utility functions for working with schools and PDF organization
 */

/**
 * Mapping of school codes (from PDF filenames) to school IDs
 * Pattern: {ROUTE}{CODE}-{DIRECTION}_effective_{DATE}.pdf
 * Example: "100SYL-A_effective_082625.pdf" -> code "SYL" -> school ID "west-sylvan"
 */
const SCHOOL_CODE_TO_ID = {
  // A
  'ABE': 'abernethy',
  'ACC': 'access',
  'AIN': 'ainsworth',
  'ALA': 'alameda',
  'ARL': 'arleta',
  'AST': 'astor',
  'ATK': 'atkinson',
  
  // B
  'BCH': 'beach',
  'BDG': 'bridger',
  'BDL': 'bridlemile',
  'BEL': 'boise-eliot',
  'BMT': 'beaumont',
  'BUC': 'buckman',
  
  // C
  'CAP': 'capitol',
  'CCH': 'cesar-chavez',
  'CHJ': 'chief-joseph',
  'CHP': 'chapman',
  'CLK': 'clark',
  'CRE': 'creston',
  
  // D
  'DUN': 'duniway',
  
  // F
  'FAU': 'faubion',
  'FPK': 'forest-park',
  
  // G
  'GLE': 'glencoe',
  'GRG': 'george',
  'GRT': 'grout',
  'GRY': 'gray',
  
  // H
  'HAY': 'hayhurst',
  'HOS': 'hosford',
  'HPK': 'harrison-park',
  
  // I
  'IRV': 'irvington',
  
  // J
  'JKS': 'jackson',
  'JMJ': 'james-john',
  
  // K
  'KLG': 'kellogg',
  'KLY': 'kelly',
  
  // L
  'LAN': 'lane',
  'LEE': 'lee',
  'LEW': 'lewis',
  'LLE': 'llewellyn',
  'LNC': 'lincoln',
  'LNT': 'lent',
  
  // M
  'MKM': 'markham',
  'MLK': 'dr-martin-luther-king',
  'MPL': 'maplewood',
  'MRY': 'marysville',
  
  // S
  'SYL': 'west-sylvan',
  
  // T
  'TAB': 'mt-tabor',
};

/**
 * Extract school code from PDF filename
 * @param {string} filename - PDF filename (e.g., "100SYL-A_effective_082625.pdf")
 * @returns {string|null} - School code (e.g., "SYL") or null if not found
 */
export function extractSchoolCodeFromFilename(filename) {
  if (!filename) {
    return null;
  }
  
  // Pattern: {ROUTE}{CODE}-{DIRECTION}_effective_{DATE}.pdf
  // Example: "100SYL-A_effective_082625.pdf" -> "SYL"
  const match = filename.match(/\d+([A-Z]{2,})-[AP]_/);
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
}

/**
 * Determine school ID from PDF filename
 * @param {string} filename - PDF filename (e.g., "100SYL-A_effective_082625.pdf")
 * @returns {string|null} - School ID (e.g., "west-sylvan") or null if not found
 */
export function getSchoolIdFromFilename(filename) {
  if (!filename) {
    return null;
  }

  const schoolCode = extractSchoolCodeFromFilename(filename);
  if (!schoolCode) {
    return null;
  }

  // Look up school ID from code mapping
  return SCHOOL_CODE_TO_ID[schoolCode] || null;
}

/**
 * Get the PDF directory path for a school
 * @param {string} schoolId - School ID (e.g., "west-sylvan")
 * @param {string} dataDir - Base data directory path
 * @param {object} pathModule - Path module (imported from 'path')
 * @returns {string} - Path to school's PDF directory
 */
export function getSchoolPdfDir(schoolId, dataDir, pathModule) {
  if (!schoolId) {
    return null;
  }
  return pathModule.join(dataDir, 'schools', schoolId, 'pdfs');
}

/**
 * Get all supported school codes
 * @returns {string[]} - Array of school codes
 */
export function getSupportedSchoolCodes() {
  return Object.keys(SCHOOL_CODE_TO_ID).sort();
}

/**
 * Get school ID for a given school code
 * @param {string} code - School code (e.g., "SYL")
 * @returns {string|null} - School ID (e.g., "west-sylvan") or null if not found
 */
export function getSchoolIdFromCode(code) {
  if (!code) {
    return null;
  }
  return SCHOOL_CODE_TO_ID[code.toUpperCase()] || null;
}
