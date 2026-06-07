import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { JsonCache } from '../utils/jsonCache.js';
import { runtimeFileOptions } from '../utils/runtimePaths.js';

// Load .env from backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

// Cache file paths
const { filePath: CACHE_FILE, seedFilePath: CACHE_SEED_FILE } = runtimeFileOptions('cache', 'autocomplete-cache.json');

import { geocodingService } from './geocodingService.js';

/**
 * AutocompleteService class for address autocomplete
 * Uses Google Places Autocomplete API with Nominatim fallback
 * Includes persistent file-based caching for performance and cost savings
 */
class AutocompleteService {
  constructor(apiKey = API_KEY) {
    this.apiKey = apiKey;
    this.useGoogle = !!this.apiKey;

    // Use shared JsonCache utility
    this.cache = new JsonCache(CACHE_FILE, 5000, { seedFilePath: CACHE_SEED_FILE });
    this.cache.init();
    
    // 30 days TTL (addresses are stable)
    this.cacheTTL = 1000 * 60 * 60 * 24 * 30;

    // Portland, OR location bias (center and approximate bounds)
    this.portlandLocationBias = {
      circle: {
        center: {
          latitude: 45.5152,
          longitude: -122.6784
        },
        radius: 15000 // 15km in meters - covers Portland metro area
      }
    };

    if (!this.useGoogle) {
      console.warn('[AutocompleteService] No Google API key found, will use Nominatim fallback');
    } else {
      console.log('[AutocompleteService] Using Google Places Autocomplete API');
    }
  }

  /**
   * Get cache key for a query
   */
  getCacheKey(query, city, state) {
    return `${query.toLowerCase().trim()}|${city}|${state}`;
  }

  /**
   * Get cached suggestions if available and not expired
   */
  getCached(query, city, state) {
    const key = this.getCacheKey(query, city, state);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Check TTL
    const age = Date.now() - cached.timestamp;
    if (age > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.suggestions;
  }

  /**
   * Store suggestions in cache
   */
  setCache(query, city, state, suggestions) {
    const key = this.getCacheKey(query, city, state);
    this.cache.set(key, {
      suggestions,
      timestamp: Date.now()
    });
  }

  /**
   * Get place details from Google Place ID
   * Note: This is now only called when explicitly needed, not during autocomplete
   * @param {string} placeId Google Place ID
   * @param {boolean} shouldSnap Whether to snap coordinates to nearest street (default: false)
   */
  async getPlaceDetails(placeId, shouldSnap = false) {
    if (!this.apiKey) {
      return null;
    }

    try {
      const url = `https://places.googleapis.com/v1/places/${placeId}`;

      const response = await fetch(url, {
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents,types'
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (data.location) {
        const coordinates = [data.location.longitude, data.location.latitude]; // [lng, lat]

        // Snap house addresses to nearest street for better "closest stop" calculations
        // Cul-de-sacs often have houses physically closer to back streets than front streets
        let finalCoordinates = coordinates;
        const isHouse = data.addressComponents?.some(c => c.types.includes('street_number')) ||
          data.types?.includes('street_address') ||
          data.types?.includes('premise');

        if (isHouse && shouldSnap) {
          console.log(`[AutocompleteService] Snapping house address to street: ${data.formattedAddress}`);
          finalCoordinates = await geocodingService.snapHouseAddressToStreet(coordinates);
        }

        return {
          address: data.formattedAddress || data.displayName?.text || null,
          coordinates: finalCoordinates,
          displayName: data.formattedAddress || data.displayName?.text || null
        };
      }

      return null;
    } catch (error) {
      console.error('[AutocompleteService] Error getting place details:', error);
      return null;
    }
  }

  /**
   * Autocomplete using Google Places Autocomplete API
   * OPTIMIZED: Does NOT fetch place details for every suggestion.
   * Only returns placeId and text. Frontend resolves details on selection.
   */
  async autocompleteWithGoogle(input, city = 'Portland', state = 'OR') {
    if (!this.apiKey) {
      return null;
    }

    try {
      const url = 'https://places.googleapis.com/v1/places:autocomplete';

      const requestBody = {
        input,
        locationBias: this.portlandLocationBias,
        includedRegionCodes: ['us'], // Limit to US addresses
        languageCode: 'en'
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          // Only fetch minimal fields needed for list display
          'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[AutocompleteService] Google API error:', response.status, errorData);
        return null;
      }

      const data = await response.json();

      if (!data.suggestions || data.suggestions.length === 0) {
        return [];
      }

      // Limit to top 8 results for performance
      const suggestions = data.suggestions.slice(0, 8);

      // COST SAVING: Do NOT fetch details for all suggestions.
      // Just map the available text and placeId.
      // The frontend will call geocodeAddress or getPlaceDetails when user selects one.
      const results = suggestions.map(s => {
        const pred = s.placePrediction;
        const mainText = pred.structuredFormat?.mainText?.text;
        const secondaryText = pred.structuredFormat?.secondaryText?.text;
        const fullText = pred.text?.text;
        
        // Construct a display name and address
        // Ideally: Main Text (e.g. "123 Main St")
        // Address: Full Text (e.g. "123 Main St, Portland, OR")
        const displayName = mainText || fullText;
        const address = fullText || (mainText + (secondaryText ? `, ${secondaryText}` : ''));

        return {
          displayName,
          address,
          placeId: pred.placeId,
          coordinates: null // Explicitly null to trigger frontend geocode on select
        };
      });

      return results;
    } catch (error) {
      console.error('[AutocompleteService] Google API error:', error);
      return null;
    }
  }

  /**
   * Autocomplete using Nominatim (fallback)
   */
  async autocompleteWithNominatim(input, city = 'Portland', state = 'OR') {
    try {
      const query = `${input}, ${city}, ${state}`;
      const encodedQuery = encodeURIComponent(query);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=8&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'PPS-Bus-Maps/1.0', // Required by Nominatim
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      // Helper function to format a concise address from Nominatim result
      const formatConciseAddress = (result) => {
        if (!result.address) {
          return result.display_name.split(',')[0].trim();
        }

        const addr = result.address;
        const parts = [];

        if (addr.house_number) {
          parts.push(addr.house_number);
        }

        const streetName = addr.road || addr.street || addr.pedestrian || addr.path || addr.footway || addr.cycleway;
        if (streetName) {
          parts.push(streetName);
        }

        if (parts.length > 0) {
          return parts.join(' ');
        }

        return result.display_name.split(',')[0].trim();
      };

      return data.map((result) => {
        const conciseAddress = formatConciseAddress(result);
        return {
          displayName: conciseAddress,
          address: conciseAddress, // Nominatim gives us full text in display_name but we use concise for display
          coordinates: [parseFloat(result.lon), parseFloat(result.lat)], // [lng, lat]
        };
      });
    } catch (error) {
      console.error('[AutocompleteService] Nominatim error:', error);
      return [];
    }
  }

  /**
   * Main autocomplete method with caching and fallback
   */
  async autocomplete(input, city = 'Portland', state = 'OR') {
    if (!input || input.trim().length < 3) {
      return [];
    }

    const trimmedInput = input.trim();

    // Check cache first
    const cached = this.getCached(trimmedInput, city, state);
    if (cached !== null) {
      console.log(`[AutocompleteService] Cache hit for: "${trimmedInput}"`);
      return cached;
    }

    let suggestions = [];

    // Try Google Places API first
    if (this.useGoogle) {
      suggestions = await this.autocompleteWithGoogle(trimmedInput, city, state);

      if (suggestions === null) {
        // Google API failed, try Nominatim fallback
        console.log(`[AutocompleteService] Google API failed, using Nominatim fallback for: "${trimmedInput}"`);
        suggestions = await this.autocompleteWithNominatim(trimmedInput, city, state);
      } else if (suggestions.length === 0) {
        // No results from Google, try Nominatim as fallback
        console.log(`[AutocompleteService] No Google results, trying Nominatim for: "${trimmedInput}"`);
        const nominatimResults = await this.autocompleteWithNominatim(trimmedInput, city, state);
        if (nominatimResults.length > 0) {
          suggestions = nominatimResults;
        }
      }
    } else {
      // No Google API key, use Nominatim
      suggestions = await this.autocompleteWithNominatim(trimmedInput, city, state);
    }

    // Cache the results (only if we got something)
    if (suggestions && suggestions.length > 0) {
      this.setCache(trimmedInput, city, state, suggestions);
    }

    return suggestions || [];
  }
}

// Export singleton instance
export const autocompleteService = new AutocompleteService();
export { AutocompleteService };
