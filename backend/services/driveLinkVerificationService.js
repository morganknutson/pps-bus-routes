/**
 * Drive Link Verification Service
 * Checks if Drive latest modified dates match local latest modified dates
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listFolderFiles } from './driveService.js';
import { pdfFetchTrackingService } from './pdfFetchTrackingService.js';
import { pdfMetadataService } from './pdfMetadataService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');

class DriveLinkVerificationService {
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
   * Load sync status
   */
  loadSyncStatus() {
    if (fs.existsSync(SYNC_STATUS_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(SYNC_STATUS_FILE, 'utf8'));
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  /**
   * Get last modified PDF date from local files
   * Tries to get Drive modifiedTime from sync status first,
   * otherwise uses filesystem mtime (which should be set to Drive modifiedTime when downloaded)
   * @param {string} schoolId - School ID
   * @returns {string|null} ISO string of last modified PDF or null
   */
  getLastModifiedPdfFromLocal(schoolId) {
    try {
      // First, try to get from sync status (Drive modifiedTime stored when downloaded)
      const syncStatus = this.loadSyncStatus();
      const schoolSyncStatus = syncStatus[schoolId];
      if (schoolSyncStatus?.lastModifiedPdf) {
        return schoolSyncStatus.lastModifiedPdf;
      }

      // Fall back to filesystem mtime
      // Note: For files downloaded before we started setting mtime to Drive modifiedTime,
      // this will be the download time, not the actual Drive modifiedTime
      const pdfDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
      if (!fs.existsSync(pdfDir)) {
        return null;
      }

      const pdfFiles = fs.readdirSync(pdfDir)
        .filter(f => f.endsWith('.pdf'))
        .map(f => {
          const filePath = path.join(pdfDir, f);
          const stats = fs.statSync(filePath);
          return {
            name: f,
            modifiedTime: stats.mtime,
          };
        });

      if (pdfFiles.length === 0) {
        return null;
      }

      // Sort by modifiedTime descending (most recent first), then get the first one
      pdfFiles.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());
      const newest = pdfFiles[0];

      return newest.modifiedTime.toISOString();
    } catch (error) {
      console.error(`[DriveLinkVerificationService] Error getting last modified PDF for ${schoolId}:`, error);
      return null;
    }
  }

  /**
   * Get the most recent Drive modifiedTime for local PDFs by matching file IDs
   * Uses metadata to match by file ID (handles renames correctly)
   * @param {string} schoolId - School ID
   * @param {Array} driveFiles - Array of files from Drive with id and modifiedTime
   * @returns {string|null} ISO string of most recent Drive modifiedTime for files we have locally
   */
  getMostRecentLocalDriveModifiedTime(schoolId, driveFiles) {
    try {
      // Load metadata to get file IDs we have locally
      const metadata = pdfMetadataService.loadMetadata(schoolId);
      const localFileIds = new Set(Object.keys(metadata.files || {}));

      if (localFileIds.size === 0) {
        return null;
      }

      // Find Drive modifiedTimes for files we have locally (by file ID)
      const localDriveModifiedTimes = driveFiles
        .filter(driveFile => {
          return driveFile.id && localFileIds.has(driveFile.id);
        })
        .map(driveFile => new Date(driveFile.modifiedTime || 0).getTime())
        .filter(time => time > 0);

      if (localDriveModifiedTimes.length === 0) {
        return null;
      }

      // Get the most recent one
      const mostRecent = Math.max(...localDriveModifiedTimes);
      return new Date(mostRecent).toISOString();
    } catch (error) {
      console.error(`[DriveLinkVerificationService] Error getting local Drive modifiedTime for ${schoolId}:`, error);
      return null;
    }
  }

  /**
   * Verify a single school's Drive link
   * @param {object} school - School object with id, name, and driveLink
   * @returns {Promise<object>} Verification result
   */
  async verifySchoolDriveLink(school) {
    const result = {
      schoolId: school.id,
      schoolName: school.name,
      driveLink: school.driveLink || null,
      hasDriveLink: !!school.driveLink,
      accessible: false,
      hasPdfs: false,
      pdfCount: 0,
      driveLastModified: null,
      localLastModified: null,
      matches: false,
      needsUpdate: false,
      error: null,
    };

    if (!school.driveLink) {
      result.error = 'No Drive link configured';
      return result;
    }

    // We'll get local last modified after we fetch Drive files
    // so we can match filenames and get accurate Drive modifiedTimes

    // Extract folder ID
    const folderId = this.extractFolderId(school.driveLink);
    if (!folderId) {
      result.error = 'Invalid Drive URL format';
      return result;
    }

    try {
      // List files from Drive
      const apiKey = process.env.GOOGLE_API_KEY || null;
      const driveFiles = await listFolderFiles(folderId, apiKey);
      const pdfFiles = driveFiles.filter(f => f.name && f.name.toLowerCase().endsWith('.pdf'));

      result.accessible = true;
      result.hasPdfs = pdfFiles.length > 0;
      result.pdfCount = pdfFiles.length;

      if (pdfFiles.length > 0) {
        // Files should already be sorted by modifiedTime descending from listFolderFiles
        // Get the first one (most recently modified)
        const newest = pdfFiles[0];
        result.driveLastModified = newest.modifiedTime || null;

        // Get local last modified - prioritize metadata which has accurate Drive modifiedTimes
        // First try to get from metadata (most accurate - has actual Drive modifiedTimes)
        result.localLastModified = pdfMetadataService.getMostRecentModifiedTime(school.id);
        
        // If metadata doesn't have it, try matching with current Drive files
        if (!result.localLastModified) {
          result.localLastModified = this.getMostRecentLocalDriveModifiedTime(
            school.id,
            pdfFiles
          );
        }
        
        // Last resort: use filesystem mtime (not accurate, but better than nothing)
        if (!result.localLastModified) {
          result.localLastModified = this.getLastModifiedPdfFromLocal(school.id);
        }

        // Compare with local
        if (result.localLastModified && result.driveLastModified) {
          const localTime = new Date(result.localLastModified).getTime();
          const driveTime = new Date(result.driveLastModified).getTime();
          
          // Consider them matching if within 1 second (to account for rounding)
          result.matches = Math.abs(localTime - driveTime) < 1000;
          result.needsUpdate = driveTime > localTime;
        } else if (result.driveLastModified && !result.localLastModified) {
          // Drive has PDFs but local doesn't
          result.needsUpdate = true;
        } else if (!result.driveLastModified && result.localLastModified) {
          // Local has PDFs but Drive doesn't (unusual)
          result.matches = false;
        }
      }
    } catch (error) {
      result.error = error.message;
      console.error(`[DriveLinkVerificationService] Error verifying ${school.id}:`, error);
    }

    return result;
  }

  /**
   * Verify all schools' Drive links
   * @param {Array<object>} schools - Array of school objects
   * @param {Function} onProgress - Optional progress callback (schoolId, result)
   * @returns {Promise<object>} Verification results
   */
  async verifyAllDriveLinks(schools = null, onProgress = null) {
    // Load schools if not provided
    if (!schools) {
      if (!fs.existsSync(SCHOOLS_FILE)) {
        throw new Error('Schools file not found');
      }
      const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
      schools = JSON.parse(content);
    }

    // Filter to only schools with Drive links
    const schoolsWithDriveLinks = schools.filter(s => s.driveLink);

    const results = {
      timestamp: new Date().toISOString(),
      totalSchools: schools.length,
      schoolsWithDriveLinks: schoolsWithDriveLinks.length,
      results: [],
      summary: {
        accessible: 0,
        hasPdfs: 0,
        matches: 0,
        needsUpdate: 0,
        errors: 0,
      },
    };

    // Verify each school
    for (const school of schoolsWithDriveLinks) {
      try {
        const result = await this.verifySchoolDriveLink(school);
        results.results.push(result);

        // Update summary
        if (result.accessible) results.summary.accessible++;
        if (result.hasPdfs) results.summary.hasPdfs++;
        if (result.matches) results.summary.matches++;
        if (result.needsUpdate) results.summary.needsUpdate++;
        if (result.error) results.summary.errors++;

        // Call progress callback if provided
        if (onProgress) {
          onProgress(school.id, result);
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.results.push({
          schoolId: school.id,
          schoolName: school.name,
          error: error.message,
        });
        results.summary.errors++;
      }
    }

    return results;
  }
}

// Export singleton instance
export const driveLinkVerificationService = new DriveLinkVerificationService();
export default DriveLinkVerificationService;

