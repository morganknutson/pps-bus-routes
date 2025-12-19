/**
 * PDF Metadata Service
 * Manages per-school metadata files that track Drive file IDs, filenames, and modifiedTimes
 * Uses file IDs as the source of truth to handle renames and modifications
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

class PdfMetadataService {
  /**
   * Get metadata file path for a school
   */
  getMetadataPath(schoolId) {
    return path.join(DATA_DIR, 'schools', schoolId, 'pdf-metadata.json');
  }

  /**
   * Load metadata for a school
   * @param {string} schoolId - School ID
   * @returns {Promise<object>} Metadata object with files map and lastSync
   */
  async loadMetadata(schoolId) {
    const metadataPath = this.getMetadataPath(schoolId);
    
    if (!fs.existsSync(metadataPath)) {
      return {
        files: {},
        lastSync: null,
      };
    }

    try {
      const content = await fsPromises.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(content);
      return {
        files: metadata.files || {},
        lastSync: metadata.lastSync || null,
      };
    } catch (error) {
      console.error(`[PdfMetadataService] Error loading metadata for ${schoolId}:`, error);
      return {
        files: {},
        lastSync: null,
      };
    }
  }

  /**
   * Save metadata for a school
   * @param {string} schoolId - School ID
   * @param {object} metadata - Metadata object with files map and lastSync
   */
  async saveMetadata(schoolId, metadata) {
    const metadataPath = this.getMetadataPath(schoolId);
    const metadataDir = path.dirname(metadataPath);
    
    // Ensure directory exists
    if (!fs.existsSync(metadataDir)) {
      await fsPromises.mkdir(metadataDir, { recursive: true });
    }

    try {
      const content = JSON.stringify({
        files: metadata.files || {},
        lastSync: metadata.lastSync || new Date().toISOString(),
      }, null, 2);
      
      const tempFile = `${metadataPath}.tmp`;
      await fsPromises.writeFile(tempFile, content, 'utf8');
      await fsPromises.rename(tempFile, metadataPath);
    } catch (error) {
      console.error(`[PdfMetadataService] Error saving metadata for ${schoolId}:`, error);
      throw error;
    }
  }

  /**
   * Get metadata for a specific file by file ID
   * @param {string} schoolId - School ID
   * @param {string} fileId - Drive file ID
   * @returns {Promise<object|null>} File metadata or null
   */
  async getFileMetadata(schoolId, fileId) {
    const metadata = await this.loadMetadata(schoolId);
    return metadata.files[fileId] || null;
  }

  /**
   * Update metadata for a file
   * @param {string} schoolId - School ID
   * @param {string} fileId - Drive file ID
   * @param {object} fileData - File data { filename, modifiedTime, localPath }
   */
  async updateFileMetadata(schoolId, fileId, fileData) {
    const metadata = await this.loadMetadata(schoolId);
    metadata.files[fileId] = {
      filename: fileData.filename,
      modifiedTime: fileData.modifiedTime,
      localPath: fileData.localPath || fileData.filename,
    };
    metadata.lastSync = new Date().toISOString();
    await this.saveMetadata(schoolId, metadata);
  }

  /**
   * Remove metadata for a file
   * @param {string} schoolId - School ID
   * @param {string} fileId - Drive file ID
   */
  async removeFileMetadata(schoolId, fileId) {
    const metadata = await this.loadMetadata(schoolId);
    if (metadata.files[fileId]) {
      delete metadata.files[fileId];
      metadata.lastSync = new Date().toISOString();
      await this.saveMetadata(schoolId, metadata);
    }
  }

  /**
   * Get all file IDs for a school
   * @param {string} schoolId - School ID
   * @returns {Promise<Array<string>>} Array of file IDs
   */
  async getAllFileIds(schoolId) {
    const metadata = await this.loadMetadata(schoolId);
    return Object.keys(metadata.files);
  }

  /**
   * Get all local file paths for a school
   * @param {string} schoolId - School ID
   * @returns {Promise<Array<string>>} Array of local file paths
   */
  async getAllLocalPaths(schoolId) {
    const metadata = await this.loadMetadata(schoolId);
    return Object.values(metadata.files)
      .map(file => file.localPath)
      .filter(path => path);
  }

  /**
   * Check if a file ID exists in metadata
   * @param {string} schoolId - School ID
   * @param {string} fileId - Drive file ID
   * @returns {Promise<boolean>}
   */
  async hasFile(schoolId, fileId) {
    const metadata = await this.loadMetadata(schoolId);
    return !!metadata.files[fileId];
  }

  /**
   * Get the most recent modifiedTime from all files in metadata
   * @param {string} schoolId - School ID
   * @returns {Promise<string|null>} ISO string of most recent modifiedTime or null
   */
  async getMostRecentModifiedTime(schoolId) {
    const metadata = await this.loadMetadata(schoolId);
    const files = Object.values(metadata.files);
    
    if (files.length === 0) {
      return null;
    }

    const modifiedTimes = files
      .map(file => new Date(file.modifiedTime || 0).getTime())
      .filter(time => time > 0);

    if (modifiedTimes.length === 0) {
      return null;
    }

    const mostRecent = Math.max(...modifiedTimes);
    return new Date(mostRecent).toISOString();
  }
}

// Export singleton instance
export const pdfMetadataService = new PdfMetadataService();
export default PdfMetadataService;



