/**
 * Utility functions for working with schools and PDF organization
 */

/**
 * Determine school ID from PDF filename
 * @param {string} filename - PDF filename (e.g., "100SYL-A_effective_082625.pdf")
 * @returns {string} - School ID (e.g., "west-sylvan")
 */
export function getSchoolIdFromFilename(filename) {
  if (!filename) {
    return null;
  }

  // Pattern: {ROUTE}SYL-{DIRECTION}_effective_{DATE}.pdf
  // SYL indicates West Sylvan
  if (filename.includes('SYL')) {
    return 'west-sylvan';
  }

  // Add more patterns here as other schools are added
  // Example:
  // if (filename.includes('BEAU')) {
  //   return 'beaumont';
  // }

  return null;
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

