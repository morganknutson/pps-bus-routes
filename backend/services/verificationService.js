/**
 * Verification service for validating school Google Sites and Drive links
 * Ensures initial data is correct before scheduler uses it
 */

import { listFolderFiles } from './driveService.js';

class VerificationService {
  constructor() {
    this.requestDelay = 500; // 500ms delay between requests
  }

  /**
   * Extract folder ID from Google Drive URL
   */
  extractFolderId(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    // Format 1: /drive/folders/FOLDER_ID
    let match = url.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    // Format 2: /open?id=FOLDER_ID
    match = url.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    // Format 3: /embeddedfolderview?id=FOLDER_ID
    match = url.match(/\/embeddedfolderview\?id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    return null;
  }

  /**
   * Get variations of school name for matching
   */
  getSchoolNameVariations(schoolName) {
    const variations = [schoolName];
    
    // Remove common suffixes
    const withoutSuffix = schoolName
      .replace(/\s+(Elementary|Middle|High|School)$/i, '')
      .replace(/\s+(ES|MS|HS)$/i, '');
    if (withoutSuffix !== schoolName) {
      variations.push(withoutSuffix);
    }

    // Add uppercase version
    variations.push(schoolName.toUpperCase());
    
    // Add lowercase version
    variations.push(schoolName.toLowerCase());

    return [...new Set(variations)];
  }

  /**
   * Verify Google Sites link
   */
  async verifyGoogleSitesLink(school, siteUrl) {
    const result = {
      valid: false,
      accessible: false,
      schoolNameFound: false,
      errors: [],
      warnings: [],
    };

    if (!siteUrl) {
      result.errors.push('No Google Sites URL provided');
      return result;
    }

    // 1. Check accessibility
    try {
      const response = await fetch(siteUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      result.accessible = response.ok;
      if (!response.ok) {
        result.errors.push(`HTTP ${response.status}: ${response.statusText}`);
        return result;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        result.errors.push('Request timeout');
      } else {
        result.errors.push(`Network error: ${error.message}`);
      }
      return result;
    }

    // 2. Fetch page content to check for school name
    try {
      const htmlResponse = await fetch(siteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!htmlResponse.ok) {
        result.errors.push(`Failed to fetch page content: HTTP ${htmlResponse.status}`);
        return result;
      }

      const html = await htmlResponse.text();
      const htmlLower = html.toLowerCase();

      // 3. Check for school name in content
      const schoolNameVariations = this.getSchoolNameVariations(school.name);
      const foundVariation = schoolNameVariations.find(name => 
        htmlLower.includes(name.toLowerCase())
      );

      if (foundVariation) {
        result.schoolNameFound = true;
      } else {
        result.warnings.push(`School name "${school.name}" not found on page`);
      }

      // 4. Check for Drive links on the page (cross-reference)
      const driveLinkPattern = /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/g;
      const driveMatches = [...html.matchAll(driveLinkPattern)];
      if (driveMatches.length > 0) {
        result.driveLinksFoundOnPage = driveMatches.length;
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        result.errors.push('Content fetch timeout');
      } else {
        result.errors.push(`Failed to fetch content: ${error.message}`);
      }
    }

    // 5. Overall validity
    result.valid = result.accessible && result.schoolNameFound;

    return result;
  }

  /**
   * Verify Drive folder link
   */
  async verifyDriveLink(school, driveUrl) {
    const result = {
      valid: false,
      accessible: false,
      hasPdfs: false,
      pdfCount: 0,
      errors: [],
      warnings: [],
    };

    if (!driveUrl) {
      result.errors.push('No Drive URL provided');
      return result;
    }

    // 1. Extract folder ID
    const folderId = this.extractFolderId(driveUrl);
    if (!folderId) {
      result.errors.push('Invalid Drive URL format - cannot extract folder ID');
      return result;
    }

    // 2. Check accessibility
    try {
      const testUrl = `https://drive.google.com/drive/folders/${folderId}`;
      const response = await fetch(testUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });

      result.accessible = response.ok;
      if (!response.ok) {
        result.errors.push(`HTTP ${response.status}: ${response.statusText}`);
        return result;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        result.errors.push('Request timeout');
      } else {
        result.errors.push(`Network error: ${error.message}`);
      }
      return result;
    }

    // 3. Try to list files in folder
    try {
      const apiKey = process.env.GOOGLE_API_KEY || null;
      const files = await listFolderFiles(folderId, apiKey);
      
      const pdfFiles = files.filter(f => 
        f.name && f.name.toLowerCase().endsWith('.pdf')
      );
      
      result.pdfCount = pdfFiles.length;
      result.hasPdfs = pdfFiles.length > 0;

      if (pdfFiles.length === 0) {
        result.warnings.push('No PDF files found in folder');
      } else if (pdfFiles.length < 5) {
        result.warnings.push(`Only ${pdfFiles.length} PDF(s) found - may be incomplete`);
      }

    } catch (error) {
      result.errors.push(`Failed to list files: ${error.message}`);
      // Still mark as accessible if we got past the HEAD check
      result.accessible = true;
    }

    // 4. Overall validity
    result.valid = result.accessible && result.hasPdfs;

    return result;
  }

/**
 * Verify both links for a school
 */
async verifySchoolLinks(school) {
  const result = {
    schoolId: school.id,
    schoolName: school.name,
    schoolPageLink: school.schoolPageLink || null, // Include actual URL
    driveLink: school.driveLink || null, // Include actual URL
    sitesLink: null,
    driveLinkResult: null, // Renamed to avoid conflict
    overallValid: false,
    timestamp: new Date().toISOString(),
  };

    // Verify Google Sites link
    if (school.schoolPageLink) {
      result.sitesLink = await this.verifyGoogleSitesLink(school, school.schoolPageLink);
      // Add delay between requests
      await this.delay();
    } else {
      result.sitesLink = {
        valid: false,
        accessible: false,
        schoolNameFound: false,
        errors: ['No Google Sites URL configured'],
        warnings: [],
      };
    }

    // Verify Drive link
    if (school.driveLink) {
      result.driveLinkResult = await this.verifyDriveLink(school, school.driveLink);
      // Add delay between requests
      await this.delay();
    } else {
      result.driveLinkResult = {
        valid: false,
        accessible: false,
        hasPdfs: false,
        pdfCount: 0,
        errors: ['No Drive URL configured'],
        warnings: [],
      };
    }

    // Overall validity: both links must be valid
    result.overallValid = 
      result.sitesLink.valid && 
      result.driveLinkResult.valid;

    return result;
  }

  /**
   * Add delay between requests
   */
  async delay(ms = this.requestDelay) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const verificationService = new VerificationService();
export default VerificationService;



