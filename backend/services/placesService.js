import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import { JsonCache } from '../utils/jsonCache.js';

// Load .env from backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

// Cache file paths
const CACHE_DIR = join(__dirname, '..', '..', 'data', 'cache');
const CACHE_FILE = join(CACHE_DIR, 'places-cache.json');

if (!API_KEY) {
  console.warn('⚠️  GOOGLE_API_KEY not found in environment variables');
}

/**
 * Service for interacting with Google Places API (v1)
 * Implements persistent file-based caching to reduce API costs
 */
class PlacesService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || API_KEY;

    // Use shared JsonCache utility
    this.cache = new JsonCache(CACHE_FILE);
    this.cache.init();
  }

  /**
   * Generate cache key for search queries
   */
  getSearchCacheKey(query, options = {}) {
    const keyString = `search:${query}:${JSON.stringify(options)}`;
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  /**
   * Generate cache key for details requests
   */
  getDetailsCacheKey(placeId) {
    return `details:${placeId}`;
  }

  /**
   * Get cached result
   */
  getCached(key) {
    const cached = this.cache.get(key);
    return cached ? cached.data : null;
  }

  /**
   * Store result in cache
   */
  setCache(key, data) {
    this.cache.set(key, {
      data,
      cachedAt: new Date().toISOString()
    });
  }

  /**
   * Infer school type(s) from name
   */
  getSchoolTypes(schoolName) {
    const name = schoolName.toLowerCase();
    const types = [];

    // Check for explicit type in name
    if (name.includes('elementary')) types.push('Elementary School');
    if (name.includes('middle')) types.push('Middle School');
    if (name.includes('high')) types.push('High School');

    // Known high schools in Portland
    const highSchools = [
      'lincoln', 'franklin', 'benson', 'grant', 'cleveland', 'jefferson',
      'roosevelt', 'wilson', 'madison', 'marshall', 'da vinci', 'davinci'
    ];
    if (highSchools.some(hs => name.includes(hs)) && !types.includes('High School')) {
      types.push('High School');
    }

    // Known middle schools in Portland
    const middleSchools = [
      'beaumont', 'hosford', 'west sylvan', 'george', 'harrison park',
      'lane', 'gray', 'kelly', 'kellogg', 'mt tabor', 'mt. tabor', 'roseway heights'
    ];
    if (middleSchools.some(ms => name.includes(ms)) && !types.includes('Middle School')) {
      types.push('Middle School');
    }

    // Hybrid schools
    const hybridSchools = {
      'access': ['Elementary School', 'Middle School'],
    };

    for (const [key, hybridTypes] of Object.entries(hybridSchools)) {
      if (name.includes(key)) {
        hybridTypes.forEach(type => {
          if (!types.includes(type)) types.push(type);
        });
      }
    }

    if (types.length === 0) {
      types.push('Elementary School');
    }

    return types;
  }

  /**
   * Search for a place using Google Places API (New)
   */
  async searchPlace(query, options = {}) {
    if (!this.apiKey) {
      return { success: false, error: 'Google Places API key not configured' };
    }

    const cacheKey = this.getSearchCacheKey(query, options);
    const cached = this.getCached(cacheKey);

    if (cached) {
      console.log(`[PlacesService] Cache hit for search: "${query}"`);
      return { success: true, ...cached, fromCache: true };
    }

    try {
      const url = `https://places.googleapis.com/v1/places:searchText`;

      const requestBody = {
        textQuery: query
      };

      if (options.locationBias) {
        requestBody.locationBias = options.locationBias;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `Places API error: ${response.status} ${response.statusText}`,
          details: errorData
        };
      }

      const data = await response.json();

      if (data.places && data.places.length > 0) {
        const place = data.places[0];
        const result = {
          place: {
            id: place.id,
            name: place.displayName?.text || null,
            address: place.formattedAddress || null,
            location: place.location ? {
              lat: place.location.latitude,
              lng: place.location.longitude
            } : null,
            coordinates: place.location ? [
              place.location.longitude,
              place.location.latitude
            ] : null
          }
        };

        this.setCache(cacheKey, result);

        return { success: true, ...result };
      } else {
        return { success: false, error: 'No places found for query' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Search for a school by name in Portland, Oregon
   */
  async searchSchool(schoolName) {
    const schoolTypes = this.getSchoolTypes(schoolName);
    const typeString = schoolTypes.join(' ');
    const query = `${schoolName} ${typeString} Portland Oregon`;

    // Portland, OR context
    const portlandLocationBias = {
      circle: {
        center: { latitude: 45.5152, longitude: -122.6784 },
        radius: 15000
      }
    };

    console.log(`[PlacesService] Searching for: "${query}" (biased to Portland, OR)`);

    const result = await this.searchPlace(query, {
      locationBias: portlandLocationBias
    });

    // Validate result is in Portland area
    if (result.success && result.place && result.place.address) {
      const address = result.place.address.toLowerCase();
      const isPortland = address.includes('portland') &&
        (address.includes('or ') || address.includes('oregon') || address.includes(', or'));

      let isInPortlandArea = false;
      if (result.place.coordinates && result.place.coordinates.length === 2) {
        const [lng, lat] = result.place.coordinates;
        isInPortlandArea = lat >= 45.4 && lat <= 45.6 && lng >= -122.8 && lng <= -122.4;
      }

      if (!isPortland && !isInPortlandArea) {
        console.warn(`[PlacesService] Rejecting result for "${schoolName}": Not in Portland, OR`);
        return {
          success: false,
          error: `School found but not in Portland, OR. Found: ${result.place.address}`
        };
      }
    }

    return result;
  }

  /**
   * Get place details by Place ID
   */
  async getPlaceDetails(placeId) {
    if (!this.apiKey) {
      return { success: false, error: 'Google Places API key not configured' };
    }

    const cacheKey = this.getDetailsCacheKey(placeId);
    const cached = this.getCached(cacheKey);

    if (cached) {
      console.log(`[PlacesService] Cache hit for details: ${placeId}`);
      return { success: true, ...cached, fromCache: true };
    }

    try {
      const url = `https://places.googleapis.com/v1/places/${placeId}`;

      const response = await fetch(url, {
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `Places API error: ${response.status} ${response.statusText}`,
          details: errorData
        };
      }

      const data = await response.json();

      const result = {
        place: {
          id: data.id,
          name: data.displayName?.text || null,
          address: data.formattedAddress || null,
          location: data.location ? {
            lat: data.location.latitude,
            lng: data.location.longitude
          } : null,
          coordinates: data.location ? [
            data.location.longitude,
            data.location.latitude
          ] : null
        }
      };

      this.setCache(cacheKey, result);

      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const placesService = new PlacesService();

// Export wrappers for backward compatibility
export function getSchoolTypes(name) {
  return placesService.getSchoolTypes(name);
}

export function searchPlace(query, options) {
  return placesService.searchPlace(query, options);
}

export function searchSchool(name) {
  return placesService.searchSchool(name);
}

export function getPlaceDetails(id) {
  return placesService.getPlaceDetails(id);
}
