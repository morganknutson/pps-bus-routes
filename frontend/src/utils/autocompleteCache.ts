/**
 * Client-side cache for autocomplete suggestions
 * Uses in-memory Map with TTL-based expiration
 */

interface CachedSuggestion {
  displayName: string;
  address: string;
  coordinates: [number, number];
}

interface CacheEntry {
  suggestions: CachedSuggestion[];
  timestamp: number;
}

class AutocompleteCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL = 1000 * 60 * 30; // 30 minutes TTL
  private readonly MAX_SIZE = 500; // Maximum cache entries

  /**
   * Generate cache key from query, city, and state
   */
  private getCacheKey(query: string, city: string, state: string): string {
    return `${query.toLowerCase().trim()}|${city}|${state}`;
  }

  /**
   * Get cached suggestions if available and not expired
   */
  get(query: string, city: string = 'Portland', state: string = 'OR'): CachedSuggestion[] | null {
    const key = this.getCacheKey(query, city, state);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.suggestions;
  }

  /**
   * Store suggestions in cache
   */
  set(query: string, suggestions: CachedSuggestion[], city: string = 'Portland', state: string = 'OR'): void {
    const key = this.getCacheKey(query, city, state);
    
    this.cache.set(key, {
      suggestions,
      timestamp: Date.now()
    });

    // Clean up old entries if cache is too large
    if (this.cache.size > this.MAX_SIZE) {
      this.cleanup();
    }
  }

  /**
   * Remove expired entries from cache
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    // If still too large, remove oldest entries
    if (this.cache.size > this.MAX_SIZE) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.cache.size - this.MAX_SIZE);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_SIZE,
      ttl: this.TTL
    };
  }
}

// Export singleton instance
export const autocompleteCache = new AutocompleteCache();
export { AutocompleteCache };




