/**
 * Google Maps Geocoding Service
 * Provides accurate geocoding using Google Maps Geocoding API
 * Falls back to Nominatim if API key is not configured
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { expandAddressForGeocoding } from '../utils/formatAddress.js';

// Load .env from backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

// TEMPORARILY DISABLED: Nominatim fallback
const ENABLE_NOMINATIM_FALLBACK = false;

/**
 * GeocodingService class for Google Maps Geocoding API
 */
class GeocodingService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || GOOGLE_API_KEY;
    this.useGoogle = !!this.apiKey;
    
    if (!this.useGoogle) {
      if (ENABLE_NOMINATIM_FALLBACK) {
        console.warn('[GeocodingService] No Google Maps API key found, will use Nominatim fallback');
      } else {
        throw new Error('[GeocodingService] Google Maps API key is required. Set GOOGLE_MAPS_API_KEY or GOOGLE_API_KEY in backend/.env');
      }
    } else {
      console.log('[GeocodingService] Using Google Maps Geocoding API');
    }
  }

  /**
   * Format address for geocoding
   * Expands abbreviations and removes direction brackets
   */
  formatAddressForGeocoding(address) {
    // First expand abbreviations for better geocoding
    let expanded = expandAddressForGeocoding(address);
    
    // Remove direction brackets and normalize whitespace
    let cleaned = expanded
      .replace(/\s*\[([NWES]+)\]\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned;
  }

  /**
   * Geocode using Google Maps Geocoding API
   */
  async geocodeWithGoogle(address, city = 'Portland', state = 'OR') {
    const formattedAddress = this.formatAddressForGeocoding(address);
    const query = `${formattedAddress}, ${city}, ${state}`;
    
    const url = `${GOOGLE_GEOCODING_URL}?address=${encodeURIComponent(query)}&key=${this.apiKey}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google Geocoding API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry.location;
        
        return {
          success: true,
          coordinates: [location.lng, location.lat], // [lng, lat] for Leaflet
          displayName: result.formatted_address,
          placeId: result.place_id,
          locationType: result.geometry.location_type,
        };
      } else if (data.status === 'ZERO_RESULTS') {
        return {
          success: false,
          error: 'Address not found',
        };
      } else {
        return {
          success: false,
          error: `Geocoding failed: ${data.status}`,
        };
      }
    } catch (error) {
      console.error('[GeocodingService] Google API error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Geocode using Nominatim (fallback)
   */
  async geocodeWithNominatim(address, city = 'Portland', state = 'OR') {
    const formattedAddress = this.formatAddressForGeocoding(address);
    const query = `${formattedAddress}, ${city}, ${state}`;
    const encodedQuery = encodeURIComponent(query);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'PPS-Bus-Maps/1.0',
          },
        }
      );

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      
      if (data.length > 0) {
        const lon = parseFloat(data[0].lon);
        const lat = parseFloat(data[0].lat);
        
        if (isNaN(lon) || isNaN(lat)) {
          return { success: false, error: 'Invalid coordinates returned' };
        }
        
        return {
          success: true,
          coordinates: [lon, lat],
          displayName: data[0].display_name,
        };
      } else {
        return { success: false, error: 'Address not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Geocode a single address
   * Uses Google Maps API only (Nominatim fallback disabled)
   */
  async geocodeAddress(address, city = 'Portland', state = 'OR') {
    if (!this.useGoogle) {
      if (ENABLE_NOMINATIM_FALLBACK) {
        return await this.geocodeWithNominatim(address, city, state);
      } else {
        throw new Error('[GeocodingService] Google Maps API key is required');
      }
    }
    
    // Use Google Maps API only - no fallback
    const result = await this.geocodeWithGoogle(address, city, state);
    
    // TEMPORARILY DISABLED: Nominatim fallback
    // if (!result.success && result.error !== 'Address not found' && ENABLE_NOMINATIM_FALLBACK) {
    //   console.warn(`[GeocodingService] Google failed for "${address}", trying Nominatim fallback`);
    //   return await this.geocodeWithNominatim(address, city, state);
    // }
    
    return result;
  }

  /**
   * Try multiple geocoding strategies for an intersection address
   */
  async geocodeIntersection(address, city = 'Portland', state = 'OR') {
    // Extract the two streets
    const streets = address.split(/\s+&\s+|\s+AND\s+/i).map(s => s.trim()).filter(s => s);
    
    if (streets.length < 2) {
      // Not an intersection, just try the address as-is
      return await this.geocodeAddress(address, city, state);
    }
    
    // Expand each street for better geocoding
    const street1 = this.formatAddressForGeocoding(streets[0]);
    const street2 = this.formatAddressForGeocoding(streets[1]);
    
    // Try multiple formats for intersections
    const formats = [
      `${street1} & ${street2}`,                    // Original format
      `${street1} and ${street2}`,                  // "and" instead of "&"
      `${street1} at ${street2}`,                   // "at" format
      `${street1}, ${street2}`,                     // Comma separated
      `corner of ${street1} and ${street2}`,        // Corner format
      `intersection ${street1} ${street2}`,         // Intersection keyword
      `${street1} / ${street2}`,                    // Slash format
    ];
    
    // Try each format
    for (const format of formats) {
      const result = await this.geocodeAddress(format, city, state);
      if (result.success) {
        return result;
      }
      // Small delay between attempts
      if (this.useGoogle) {
        await new Promise(resolve => setTimeout(resolve, 100));
      } else if (ENABLE_NOMINATIM_FALLBACK) {
        // Nominatim rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // If all intersection formats fail, try geocoding both streets separately
    // and use the midpoint (this is a fallback strategy)
    const result1 = await this.geocodeAddress(street1, city, state);
    if (!this.useGoogle && ENABLE_NOMINATIM_FALLBACK) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const result2 = await this.geocodeAddress(street2, city, state);
    
    if (result1.success && result2.success) {
      // Calculate midpoint between the two streets
      const midLon = (result1.coordinates[0] + result2.coordinates[0]) / 2;
      const midLat = (result1.coordinates[1] + result2.coordinates[1]) / 2;
      
      return {
        success: true,
        coordinates: [midLon, midLat],
        displayName: `Approximate intersection of ${street1} and ${street2}`,
        isApproximate: true,
        geocodeWarning: 'Intersection not found, using approximate location',
      };
    }
    
    // If we got one result, use it
    if (result1.success) {
      return {
        ...result1,
        isApproximate: true,
        geocodeWarning: 'Intersection not found, using first street location',
      };
    }
    if (result2.success) {
      return {
        ...result2,
        isApproximate: true,
        geocodeWarning: 'Intersection not found, using second street location',
      };
    }
    
    return { success: false, error: 'Address not found' };
  }

  /**
   * Geocode all stops for a route
   */
  async geocodeStops(stops, city = 'Portland', state = 'OR') {
    const geocodedStops = [];
    
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      let address = stop.address;
      
      // Check if this is an intersection
      const isIntersection = address.includes('&') || address.includes(' AND ');
      
      let result;
      if (isIntersection) {
        result = await this.geocodeIntersection(address, city, state);
      } else {
        result = await this.geocodeAddress(address, city, state);
      }
      
      if (result.success) {
        const stopData = {
          ...stop,
          coordinates: result.coordinates,
          displayName: result.displayName,
        };
        
        // Add flag if this is an approximate location
        if (result.isApproximate) {
          stopData.isApproximate = true;
          stopData.geocodeWarning = result.geocodeWarning || 'Intersection not found, using approximate location';
        }
        
        geocodedStops.push(stopData);
      } else {
        geocodedStops.push({
          ...stop,
          coordinates: null,
          geocodeError: result.error,
        });
      }
      
      // Rate limiting: wait between requests
      if (this.useGoogle && i < stops.length - 1) {
        // Small delay for Google to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 50));
      } else if (!this.useGoogle && ENABLE_NOMINATIM_FALLBACK && i < stops.length - 1) {
        // Nominatim rate limiting (disabled)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Check for duplicate coordinates and warn
    const coordinateMap = new Map();
    geocodedStops.forEach((stop, index) => {
      if (stop.coordinates) {
        const key = `${stop.coordinates[0].toFixed(6)},${stop.coordinates[1].toFixed(6)}`;
        if (coordinateMap.has(key)) {
          console.warn(`[GeocodingService] Duplicate coordinates detected: Stop ${index + 1} "${stop.address}" has same coordinates as stop ${coordinateMap.get(key) + 1}`);
        } else {
          coordinateMap.set(key, index);
        }
      }
    });
    
    return geocodedStops;
  }

  /**
   * Batch geocode multiple addresses
   */
  async batchGeocode(addresses, city = 'Portland', state = 'OR') {
    const results = [];
    
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      const result = await this.geocodeAddress(address, city, state);
      results.push({
        address,
        ...result,
      });
      
      // Rate limiting
      if (!this.useGoogle && i < addresses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else if (this.useGoogle && i < addresses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return results;
  }
}

// Export singleton instance
export const geocodingService = new GeocodingService();

// Also export class for testing or custom instances
export { GeocodingService };

