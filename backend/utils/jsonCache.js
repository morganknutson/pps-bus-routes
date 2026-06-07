import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

/**
 * A persistent JSON file-based cache with debounced saving and in-memory storage.
 * Designed to replace ad-hoc caching in services.
 */
export class JsonCache {
  /**
   * @param {string} filePath - Absolute path to the cache file
   * @param {number} saveDelayMs - Debounce delay in ms (default: 5000ms)
   */
  constructor(filePath, saveDelayMs = 5000, options = {}) {
    this.filePath = filePath;
    this.saveDelayMs = saveDelayMs;
    this.seedFilePath = options.seedFilePath || null;
    this.cache = new Map();
    this.isSaving = false;
    this.needsSave = false;
    this.saveTimeout = null;
    this.loaded = false;
  }

  /**
   * Load cache from disk
   */
  async init() {
    if (this.loaded) return;

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        await fsPromises.mkdir(dir, { recursive: true });
      }

      const cacheData = {};
      const sourceFiles = [
        this.seedFilePath && fs.existsSync(this.seedFilePath) ? this.seedFilePath : null,
        fs.existsSync(this.filePath) ? this.filePath : null,
      ].filter(Boolean);

      for (const sourceFile of sourceFiles) {
        const content = await fsPromises.readFile(sourceFile, 'utf8');
        Object.assign(cacheData, JSON.parse(content));
      }

      if (sourceFiles.length > 0) {
        this.cache = new Map(Object.entries(cacheData));
        console.log(`[JsonCache] Loaded ${this.cache.size} entries from ${sourceFiles.map(file => path.basename(file)).join(', ')}`);
      }
    } catch (error) {
      console.warn(`[JsonCache] Failed to load cache from ${this.filePath}:`, error.message);
      // Start fresh on error
      this.cache = new Map();
    } finally {
      this.loaded = true;
    }
  }

  /**
   * Get a value from cache
   * @param {string} key 
   * @returns {any|null}
   */
  get(key) {
    return this.cache.get(key) || null;
  }

  /**
   * Set a value in cache
   * @param {string} key 
   * @param {any} value 
   */
  set(key, value) {
    this.cache.set(key, value);
    this.scheduleSave();
  }

  /**
   * Delete a value from cache
   * @param {string} key 
   */
  delete(key) {
    this.cache.delete(key);
    this.scheduleSave();
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.scheduleSave();
  }

  /**
   * Schedule a save operation (debounced)
   */
  scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.save();
    }, this.saveDelayMs);
  }

  /**
   * Save cache to disk
   */
  async save() {
    if (this.isSaving) {
      this.needsSave = true;
      return;
    }

    this.isSaving = true;
    this.needsSave = false;

    try {
      const data = Object.fromEntries(this.cache);
      const tempFile = `${this.filePath}.tmp`;
      
      await fsPromises.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
      await fsPromises.rename(tempFile, this.filePath);
      // console.log(`[JsonCache] Saved ${this.cache.size} entries to ${path.basename(this.filePath)}`);
    } catch (error) {
      console.error(`[JsonCache] Failed to save cache to ${this.filePath}:`, error.message);
    } finally {
      this.isSaving = false;
      if (this.needsSave) {
        // If changes happened while saving, schedule another save
        this.scheduleSave();
      }
    }
  }

  /**
   * Get size of cache
   */
  size() {
    return this.cache.size;
  }
}


