/**
 * Neighborhood Service
 * Provides neighborhood lookup from coordinates using reverse geocoding
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load .env from backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
const GOOGLE_REVERSE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

// Cache file path
const CACHE_DIR = join(__dirname, '..', '..', 'data', 'cache');
const CACHE_FILE = join(CACHE_DIR, 'neighborhood-cache.json');

/**
 * NeighborhoodService class for reverse geocoding to get neighborhoods
 */
class NeighborhoodService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || GOOGLE_API_KEY;
    this.useGoogle = !!this.apiKey;
    
    // In-memory cache: Map<"lng,lat", neighborhood>
    this.cache = new Map();
    
    // Load cache from file
    this.loadCache();
    
    if (!this.useGoogle) {
      throw new Error('[NeighborhoodService] Google Maps API key is required. Set GOOGLE_MAPS_API_KEY or GOOGLE_API_KEY in backend/.env');
    } else {
      console.log('[NeighborhoodService] Using Google Maps Reverse Geocoding API');
    }
  }

  /**
   * Load cache from file
   */
  loadCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        this.cache = new Map(Object.entries(cacheData));
        console.log(`[NeighborhoodService] Loaded ${this.cache.size} cached neighborhoods`);
      }
    } catch (error) {
      console.warn('[NeighborhoodService] Failed to load cache:', error.message);
      this.cache = new Map();
    }
  }

  /**
   * Save cache to file
   */
  saveCache() {
    try {
      // Ensure cache directory exists
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      
      const cacheData = Object.fromEntries(this.cache);
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.warn('[NeighborhoodService] Failed to save cache:', error.message);
    }
  }

  /**
   * Get cache key from coordinates (rounded to 4 decimal places for grouping nearby points)
   */
  getCacheKey(coordinates) {
    const [lng, lat] = coordinates;
    // Round to 4 decimal places (~11 meters precision)
    const roundedLng = Math.round(lng * 10000) / 10000;
    const roundedLat = Math.round(lat * 10000) / 10000;
    return `${roundedLng},${roundedLat}`;
  }

  /**
   * Extract neighborhood from Google Maps reverse geocoding response
   */
  extractNeighborhood(addressComponents) {
    if (!addressComponents || !Array.isArray(addressComponents)) {
      return null;
    }

    // Priority order for neighborhood extraction
    const priorities = [
      ['neighborhood', 'political'],
      ['sublocality', 'political'],
      ['sublocality_level_1'],
      ['sublocality_level_2'],
    ];

    for (const priority of priorities) {
      const component = addressComponents.find(comp => {
        const types = comp.types || [];
        return priority.every(type => types.includes(type));
      });
      
      if (component && component.long_name) {
        return component.long_name;
      }
    }

    return null;
  }

  /**
   * Reverse geocode coordinates to get neighborhood using Google Maps API
   */
  async reverseGeocodeWithGoogle(coordinates) {
    const [lng, lat] = coordinates;
    const url = `${GOOGLE_REVERSE_GEOCODING_URL}?latlng=${lat},${lng}&key=${this.apiKey}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google Reverse Geocoding API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        const neighborhood = this.extractNeighborhood(result.address_components);
        
        return {
          success: true,
          neighborhood: neighborhood || null,
          formattedAddress: result.formatted_address,
          addressComponents: result.address_components,
        };
      } else if (data.status === 'ZERO_RESULTS') {
        return {
          success: false,
          error: 'No results found',
        };
      } else {
        return {
          success: false,
          error: `Reverse geocoding failed: ${data.status}`,
        };
      }
    } catch (error) {
      console.error('[NeighborhoodService] Google API error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get neighborhood from coordinates (with caching)
   */
  async getNeighborhood(coordinates) {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return {
        success: false,
        error: 'Invalid coordinates format',
      };
    }

    const [lng, lat] = coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number' || 
        isNaN(lng) || isNaN(lat)) {
      return {
        success: false,
        error: 'Invalid coordinates values',
      };
    }

    // Check cache first
    const cacheKey = this.getCacheKey(coordinates);
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return {
        success: true,
        neighborhood: cached,
        fromCache: true,
      };
    }

    // Not in cache, make API call
    const result = await this.reverseGeocodeWithGoogle(coordinates);
    
    if (result.success && result.neighborhood) {
      // Cache the result
      this.cache.set(cacheKey, result.neighborhood);
      // Save cache periodically (every 10 new entries)
      if (this.cache.size % 10 === 0) {
        this.saveCache();
      }
    }

    return result;
  }

  /**
   * Get neighborhoods for multiple coordinates (batch processing)
   */
  async getNeighborhoods(coordinatesList) {
    const results = [];
    
    for (let i = 0; i < coordinatesList.length; i++) {
      const coordinates = coordinatesList[i];
      const result = await this.getNeighborhood(coordinates);
      results.push({
        coordinates,
        ...result,
      });
      
      // Rate limiting: small delay between requests
      if (i < coordinatesList.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // Save cache after batch
    this.saveCache();
    
    return results;
  }

  /**
   * Get unique neighborhoods from a list of coordinates
   */
  async getUniqueNeighborhoods(coordinatesList) {
    const neighborhoods = new Set();
    
    for (const coordinates of coordinatesList) {
      const result = await this.getNeighborhood(coordinates);
      if (result.success && result.neighborhood) {
        neighborhoods.add(result.neighborhood);
      }
    }
    
    return Array.from(neighborhoods).sort();
  }

  /**
   * Get all neighborhoods from routes (for a school or all routes)
   * Uses stored neighborhoods from stops when available, otherwise computes via reverse geocoding
   */
  async getNeighborhoodsFromRoutes(routes) {
    const allCoordinates = [];
    const coordinateToRouteMap = new Map();
    const storedNeighborhoods = new Map(); // Map<coordKey, {neighborhood, routeInfo}>
    
    // First pass: collect coordinates and check for stored neighborhoods
    for (const route of routes) {
      if (route.stops && Array.isArray(route.stops)) {
        for (const stop of route.stops) {
          if (stop.coordinates && Array.isArray(stop.coordinates) && stop.coordinates.length === 2) {
            const coordKey = `${stop.coordinates[0]},${stop.coordinates[1]}`;
            const routeInfo = {
              routeId: route.id,
              routeName: route.name,
              stopId: stop.id,
              stopAddress: stop.address,
            };
            
            // If stop already has neighborhood stored, use it
            if (stop.neighborhood) {
              storedNeighborhoods.set(coordKey, {
                neighborhood: stop.neighborhood,
                routeInfo,
              });
            } else if (!coordinateToRouteMap.has(coordKey)) {
              // Only add to coordinates list if we need to geocode it
              allCoordinates.push(stop.coordinates);
              coordinateToRouteMap.set(coordKey, routeInfo);
            }
          }
        }
      }
    }
    
    // Get neighborhoods for coordinates that don't have stored neighborhoods
    const neighborhoodResults = await this.getNeighborhoods(allCoordinates);
    
    // Build result structure
    const neighborhoods = new Map(); // Map<neighborhood, {count, routes: Set, stops: []}>
    
    // Process stored neighborhoods first
    for (const [coordKey, data] of storedNeighborhoods.entries()) {
      const { neighborhood, routeInfo } = data;
      
      if (neighborhood) {
        if (!neighborhoods.has(neighborhood)) {
          neighborhoods.set(neighborhood, {
            name: neighborhood,
            count: 0,
            routes: new Set(),
            stops: [],
          });
        }
        
        const neighborhoodData = neighborhoods.get(neighborhood);
        neighborhoodData.count++;
        neighborhoodData.routes.add(routeInfo.routeName);
        neighborhoodData.stops.push({
          routeId: routeInfo.routeId,
          routeName: routeInfo.routeName,
          stopId: routeInfo.stopId,
          stopAddress: routeInfo.stopAddress,
          coordinates: [parseFloat(coordKey.split(',')[0]), parseFloat(coordKey.split(',')[1])],
        });
      }
    }
    
    // Process geocoded neighborhoods
    for (let i = 0; i < neighborhoodResults.length; i++) {
      const result = neighborhoodResults[i];
      const coordKey = `${result.coordinates[0]},${result.coordinates[1]}`;
      const routeInfo = coordinateToRouteMap.get(coordKey);
      
      if (result.success && result.neighborhood && routeInfo) {
        if (!neighborhoods.has(result.neighborhood)) {
          neighborhoods.set(result.neighborhood, {
            name: result.neighborhood,
            count: 0,
            routes: new Set(),
            stops: [],
          });
        }
        
        const neighborhoodData = neighborhoods.get(result.neighborhood);
        neighborhoodData.count++;
        neighborhoodData.routes.add(routeInfo.routeName);
        neighborhoodData.stops.push({
          routeId: routeInfo.routeId,
          routeName: routeInfo.routeName,
          stopId: routeInfo.stopId,
          stopAddress: routeInfo.stopAddress,
          coordinates: result.coordinates,
        });
      }
    }
    
    // Convert to array format
    return Array.from(neighborhoods.values()).map(n => ({
      name: n.name,
      count: n.count,
      routes: Array.from(n.routes).sort(),
      stops: n.stops,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }
}

// Export singleton instance
export const neighborhoodService = new NeighborhoodService();

// Also export class for testing or custom instances
export { NeighborhoodService };
