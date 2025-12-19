/**
 * PDF Fetch Tracking Service
 * Tracks last fetch time and last modified PDF date for each school
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SYNC_STATUS_FILE = path.join(DATA_DIR, 'pdf-sync-status.json');

class PdfFetchTrackingService {
  /**
   * Load sync status from file
   */
  loadSyncStatus() {
    if (fs.existsSync(SYNC_STATUS_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(SYNC_STATUS_FILE, 'utf8'));
      } catch (e) {
        console.error('[PdfFetchTrackingService] Error loading sync status:', e);
        return {};
      }
    }
    return {};
  }

  /**
   * Save sync status to file
   */
  saveSyncStatus(status) {
    try {
      fs.writeFileSync(SYNC_STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');
    } catch (e) {
      console.error('[PdfFetchTrackingService] Error saving sync status:', e);
      throw e;
    }
  }

  /**
   * Update last fetch time for a school
   * @param {string} schoolId - School ID
   * @param {string} lastModifiedPdf - ISO string of last modified PDF date
   */
  updateLastFetch(schoolId, lastModifiedPdf = null) {
    const syncStatus = this.loadSyncStatus();
    const schoolStatus = syncStatus[schoolId] || {};
    
    syncStatus[schoolId] = {
      ...schoolStatus,
      lastFetch: new Date().toISOString(),
      lastModifiedPdf: lastModifiedPdf || schoolStatus.lastModifiedPdf,
      lastChecked: new Date().toISOString(),
    };
    
    this.saveSyncStatus(syncStatus);
    return syncStatus[schoolId];
  }

  /**
   * Get fetch info for a school
   * @param {string} schoolId - School ID
   * @returns {object|null} Fetch info or null if not found
   */
  getFetchInfo(schoolId) {
    const syncStatus = this.loadSyncStatus();
    return syncStatus[schoolId] || null;
  }

  /**
   * Get fetch info for all schools
   * @returns {object} Map of schoolId to fetch info
   */
  getAllFetchInfo() {
    return this.loadSyncStatus();
  }

  /**
   * Get the last modified PDF date from local files
   * Prefers Drive modifiedTime from sync status over filesystem mtime
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

      // Fall back to filesystem mtime if sync status doesn't have it
      // (This happens for files downloaded before sync status tracking was added)
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
      console.error(`[PdfFetchTrackingService] Error getting last modified PDF for ${schoolId}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const pdfFetchTrackingService = new PdfFetchTrackingService();
export default PdfFetchTrackingService;

