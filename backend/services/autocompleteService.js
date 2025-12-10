import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

/**
 * AutocompleteService class for address autocomplete
 * Uses Google Places Autocomplete API with Nominatim fallback
 * Includes in-memory caching for performance
 */
class AutocompleteService {
  constructor(apiKey = API_KEY) {
    this.apiKey = apiKey;
    this.useGoogle = !!this.apiKey;
    
    // In-memory cache: Map<query, { suggestions, timestamp }>
    this.cache = new Map();
    this.cacheTTL = 1000 * 60 * 60; // 1 hour TTL
    
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
    
    // Clean up old cache entries periodically (keep cache size reasonable)
    if (this.cache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheTTL) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Format address from Google Places Autocomplete result
   */
  formatAddressFromGoogle(place) {
    // Use structured address if available, otherwise use description
    if (place.structured_formatting) {
      return place.structured_formatting.main_text || place.description;
    }
    return place.description;
  }

  /**
   * Get place details from Google Place ID
   */
  async getPlaceDetails(placeId) {
    if (!this.apiKey) {
      return null;
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
        return null;
      }

      const data = await response.json();
      
      if (data.location) {
        return {
          address: data.formattedAddress || data.displayName?.text || null,
          coordinates: [data.location.longitude, data.location.latitude], // [lng, lat]
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
      
      // Fetch place details in parallel for better performance
      const placeDetailPromises = suggestions
        .filter(s => s.placePrediction?.placeId)
        .map(suggestion => 
          this.getPlaceDetails(suggestion.placePrediction.placeId)
            .then(placeDetails => ({
              suggestion,
              placeDetails
            }))
            .catch(() => ({ suggestion, placeDetails: null }))
        );

      const placeDetailsResults = await Promise.all(placeDetailPromises);
      
      // Map results with place details
      // Note: Some suggestions may not have coordinates if place details fail
      // The frontend can geocode on selection if needed
      const results = placeDetailsResults
        .map(({ suggestion, placeDetails }) => {
          const displayText = suggestion.placePrediction.structuredFormat?.mainText?.text || 
                             suggestion.placePrediction.text?.text;
          const addressText = suggestion.placePrediction.text?.text || displayText;
          
          if (!displayText) return null;
          
          if (placeDetails && placeDetails.coordinates) {
            return {
              displayName: displayText || placeDetails.displayName,
              address: placeDetails.address || placeDetails.displayName || addressText,
              coordinates: placeDetails.coordinates
            };
          } else {
            // No coordinates from place details - frontend will geocode on selection if needed
            return {
              displayName: displayText,
              address: addressText,
              coordinates: null
            };
          }
        })
        .filter(result => result !== null); // Filter out invalid results

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
        `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=10&addressdetails=1`,
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
          address: conciseAddress,
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

    // Cache the results
    if (suggestions.length > 0) {
      this.setCache(trimmedInput, city, state, suggestions);
    }

    return suggestions;
  }
}

// Export singleton instance
export const autocompleteService = new AutocompleteService();
export { AutocompleteService };
