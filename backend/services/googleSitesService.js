/**
 * Google Sites service for discovering school pages and Drive links
 * Scrapes Google Sites pages to find school links and embedded Drive folders
 */

class GoogleSitesService {
  constructor() {
    this.baseUrl = 'https://sites.google.com/pps.net/gt-bus-schedule/GT-Bus-Schedules';
    this.requestDelay = 1000; // 1 second delay between requests to avoid rate limiting
  }

  /**
   * Extract folder ID from various Google Drive URL formats
   * @param {string} url - Google Drive URL in any format
   * @returns {string|null} - Folder ID or null if not found
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

    // Format 4: /file/d/FOLDER_ID/view (might be folder, we'll validate later)
    match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)\/view/);
    if (match) return match[1];

    // Format 5: ?id=FOLDER_ID (query parameter)
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    return null;
  }

  /**
   * Normalize a Google Drive URL to standard format
   * @param {string} url - Google Drive URL in any format
   * @returns {string|null} - Normalized URL or null if invalid
   */
  normalizeDriveUrl(url) {
    const folderId = this.extractFolderId(url);
    if (!folderId) {
      return null;
    }
    return `https://drive.google.com/drive/folders/${folderId}`;
  }

  /**
   * Check if a Google Sites page exists for a school
   * Tries multiple URL patterns to handle different naming conventions
   * @param {string} schoolId - School ID (e.g., "abernethy")
   * @returns {Promise<string|null>} - Google Sites URL if found, null otherwise
   */
  async findSchoolPageLink(schoolId) {
    // Try different URL patterns
    const patterns = [
      schoolId, // Original: west-sylvan
      schoolId.replace(/^west-/, ''), // Remove "west-" prefix: sylvan
      schoolId.replace(/-/g, ''), // Remove all hyphens: westsylvan
      schoolId.replace(/-/g, '_'), // Replace hyphens with underscores: west_sylvan
    ];

    // Remove duplicates
    const uniquePatterns = [...new Set(patterns)];

    for (const pattern of uniquePatterns) {
      const potentialUrl = `${this.baseUrl}/${pattern}`;
      
      try {
        const response = await fetch(potentialUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          redirect: 'follow',
        });

        // If page exists and is accessible, return the URL
        if (response.ok) {
          if (pattern !== schoolId) {
            console.log(`[GoogleSitesService] Found page using alternative pattern: ${pattern} (original: ${schoolId})`);
          }
          return potentialUrl;
        }
      } catch (error) {
        // Continue to next pattern
        continue;
      }
    }

    console.log(`[GoogleSitesService] Page not found for ${schoolId} with any pattern`);
    return null;
  }

  /**
   * Extract Google Drive folder links from a Google Sites page
   * @param {string} siteUrl - URL of the Google Sites page
   * @returns {Promise<string[]>} - Array of found Google Drive folder links
   */
  async extractDriveLinks(siteUrl) {
    if (!siteUrl) {
      return [];
    }

    try {
      const response = await fetch(siteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        console.log(`[GoogleSitesService] Failed to fetch ${siteUrl}: ${response.status}`);
        return [];
      }

      const html = await response.text();
      const driveLinks = new Set();

      // Pattern 1: Direct href links to Drive folders
      const hrefPattern = /href=["'](https?:\/\/drive\.google\.com\/[^"']+)["']/gi;
      const hrefMatches = [...html.matchAll(hrefPattern)];
      for (const match of hrefMatches) {
        const normalized = this.normalizeDriveUrl(match[1]);
        if (normalized) {
          driveLinks.add(normalized);
        }
      }

      // Pattern 2: Embedded iframe src
      const iframePattern = /src=["'](https?:\/\/drive\.google\.com\/[^"']+)["']/gi;
      const iframeMatches = [...html.matchAll(iframePattern)];
      for (const match of iframeMatches) {
        const normalized = this.normalizeDriveUrl(match[1]);
        if (normalized) {
          driveLinks.add(normalized);
        }
      }

      // Pattern 3: JavaScript data/JSON (look for drive.google.com URLs in script tags)
      const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      const scriptMatches = [...html.matchAll(scriptPattern)];
      for (const match of scriptMatches) {
        const scriptContent = match[1];
        const urlPattern = /(https?:\/\/drive\.google\.com\/[^\s"']+)/gi;
        const urlMatches = [...scriptContent.matchAll(urlPattern)];
        for (const urlMatch of urlMatches) {
          const normalized = this.normalizeDriveUrl(urlMatch[1]);
          if (normalized) {
            driveLinks.add(normalized);
          }
        }
      }

      // Pattern 4: Look for folder IDs directly in the HTML (data attributes, etc.)
      const folderIdPattern = /["']([a-zA-Z0-9_-]{25,44})["']/g;
      const idMatches = [...html.matchAll(folderIdPattern)];
      for (const match of idMatches) {
        const potentialId = match[1];
        // Quick validation: Google Drive folder IDs are typically 33 characters
        if (potentialId.length >= 25 && potentialId.length <= 44) {
          const normalized = `https://drive.google.com/drive/folders/${potentialId}`;
          // We'll validate this later, but add it for now
          driveLinks.add(normalized);
        }
      }

      return Array.from(driveLinks);
    } catch (error) {
      console.error(`[GoogleSitesService] Error extracting drive links from ${siteUrl}:`, error.message);
      return [];
    }
  }

  /**
   * Validate that a Google Drive folder is accessible
   * @param {string} folderUrl - Google Drive folder URL
   * @returns {Promise<boolean>} - True if folder is accessible
   */
  async validateFolder(folderUrl) {
    const folderId = this.extractFolderId(folderUrl);
    if (!folderId) {
      return false;
    }

    try {
      const testUrl = `https://drive.google.com/drive/folders/${folderId}`;
      const response = await fetch(testUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        method: 'HEAD', // Just check if accessible, don't download
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Find the best Drive link from an array of links
   * Validates links and returns the first valid folder link
   * @param {string[]} driveLinks - Array of Drive links
   * @returns {Promise<string|null>} - Best valid Drive link or null
   */
  async findBestDriveLink(driveLinks) {
    if (!driveLinks || driveLinks.length === 0) {
      return null;
    }

    // First, try to find a link that looks like a folder (contains "folders")
    const folderLinks = driveLinks.filter(link => 
      link.includes('/drive/folders/') || link.includes('/folders/')
    );

    if (folderLinks.length > 0) {
      // Validate the first folder link
      const validated = await this.validateFolder(folderLinks[0]);
      if (validated) {
        return this.normalizeDriveUrl(folderLinks[0]);
      }
    }

    // If no folder links or validation failed, try validating all links
    for (const link of driveLinks) {
      const normalized = this.normalizeDriveUrl(link);
      if (normalized) {
        const validated = await this.validateFolder(normalized);
        if (validated) {
          return normalized;
        }
      }
    }

    // If validation fails for all, return the first normalized link anyway
    // (it might be valid but validation might fail due to permissions)
    if (driveLinks.length > 0) {
      const normalized = this.normalizeDriveUrl(driveLinks[0]);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  /**
   * Discover both Google Sites link and Drive link for a school
   * @param {string} schoolId - School ID
   * @param {string} schoolName - School name (for logging)
   * @returns {Promise<{schoolPageLink: string|null, driveLink: string|null}>}
   */
  async discoverSchoolLinks(schoolId, schoolName) {
    console.log(`[GoogleSitesService] Discovering links for ${schoolName} (${schoolId})...`);

    // Step 1: Find Google Sites page link
    let schoolPageLink = null;
    try {
      schoolPageLink = await this.findSchoolPageLink(schoolId);
      if (schoolPageLink) {
        console.log(`[GoogleSitesService] ✅ Found Google Sites page: ${schoolPageLink}`);
      } else {
        console.log(`[GoogleSitesService] ⚠️  No Google Sites page found for ${schoolId}`);
      }
    } catch (error) {
      console.error(`[GoogleSitesService] Error finding page for ${schoolId}:`, error.message);
    }

    // Step 2: Extract Drive links from the Google Sites page
    let driveLink = null;
    if (schoolPageLink) {
      try {
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));

        const driveLinks = await this.extractDriveLinks(schoolPageLink);
        console.log(`[GoogleSitesService] Found ${driveLinks.length} potential Drive links`);

        if (driveLinks.length > 0) {
          driveLink = await this.findBestDriveLink(driveLinks);
          if (driveLink) {
            console.log(`[GoogleSitesService] ✅ Selected Drive link: ${driveLink}`);
          } else {
            console.log(`[GoogleSitesService] ⚠️  No valid Drive link found`);
          }
        }
      } catch (error) {
        console.error(`[GoogleSitesService] Error extracting Drive links:`, error.message);
      }
    }

    return {
      schoolPageLink,
      driveLink,
    };
  }

  /**
   * Add delay between requests to avoid rate limiting
   * @param {number} ms - Milliseconds to delay
   */
  async delay(ms = this.requestDelay) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const googleSitesService = new GoogleSitesService();
export default GoogleSitesService;



