/**
 * @fileoverview Google Maps Geocoding Service for PPS Bus Maps
 * 
 * This module provides geocoding functionality to convert street addresses
 * to GPS coordinates. It uses the Google Maps Geocoding API as the primary
 * service, with optional Nominatim fallback (currently disabled).
 * 
 * Key features:
 * - Single address geocoding
 * - Intersection/cross-street handling with multiple format attempts
 * - Portland bounds validation
 * - House address snapping to nearest street
 * - Neighborhood enrichment via reverse geocoding
 * - Batch geocoding for multiple stops
 * 
 * @module services/geocodingService
 * @requires dotenv
 * @requires ../utils/formatAddress.js
 * @requires ./neighborhoodService.js
 * @requires ./streetGeometryService.js
 * 
 * @example
 * // Geocode a single address
 * import { geocodingService } from './geocodingService.js';
 * 
 * const result = await geocodingService.geocodeAddress('SW Patton Rd & SW Vista Ave');
 * if (result.success) {
 *   console.log(result.coordinates); // [-122.7234, 45.5123] (lng, lat)
 * }
 * 
 * @example
 * // Geocode all stops in a route
 * const geocodedStops = await geocodingService.geocodeStops(route.stops);
 * 
 * @see {@link https://developers.google.com/maps/documentation/geocoding|Google Geocoding API}
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { expandAddressForGeocoding } from '../utils/formatAddress.js';
import { neighborhoodService } from './neighborhoodService.js';
import { streetGeometryService } from './streetGeometryService.js';

// Load .env from backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

// TEMPORARILY DISABLED: Nominatim fallback
const ENABLE_NOMINATIM_FALLBACK = false;

/**
 * GeocodingService class for converting addresses to coordinates.
 * 
 * This class provides comprehensive geocoding functionality optimized for
 * Portland, Oregon bus stop addresses. It handles:
 * - Standard addresses (e.g., "1234 SW Main St")
 * - Intersections (e.g., "SW Patton & Vista")
 * - Multiple intersection formats
 * - Portland bounds validation
 * - House address snapping to streets
 * 
 * @class
 * @example
 * // Create custom instance with specific API key
 * const customGeocoder = new GeocodingService('your-api-key');
 * 
 * @example
 * // Use singleton instance (recommended)
 * import { geocodingService } from './geocodingService.js';
 * const result = await geocodingService.geocodeAddress('123 Main St');
 */
class GeocodingService {
  /**
   * Creates a new GeocodingService instance.
   * 
   * @param {string|null} [apiKey=null] - Google Maps API key. If not provided,
   *   falls back to GOOGLE_MAPS_API_KEY or GOOGLE_API_KEY environment variables.
   * @throws {Error} If no API key is found and Nominatim fallback is disabled
   * 
   * @example
   * // Using environment variable (default)
   * const service = new GeocodingService();
   * 
   * @example
   * // Using explicit API key
   * const service = new GeocodingService('AIza...');
   */
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
   * Strips parenthetical content, expands abbreviations, and removes direction brackets
   */
  formatAddressForGeocoding(address) {
    // First remove parenthetical content (descriptive notes, not part of address)
    // e.g., "(wee Village Dc)" should be removed to prevent misinterpretation
    // This must be done BEFORE expansion to avoid processing parenthetical content
    let addressWithoutParentheses = address.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    
    // Then expand abbreviations for better geocoding
    let expanded = expandAddressForGeocoding(addressWithoutParentheses);
    
    // Remove direction brackets and normalize whitespace
    let cleaned = expanded
      .replace(/\s*\[([NWES]+)\]\s*/g, '') // Remove direction brackets
      .replace(/\s+/g, ' ') // Normalize whitespace
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
          coordinates: [location.lng, location.lat], // [lng, lat] - GeoJSON format (internal standard)
          displayName: result.formatted_address,
          placeId: result.place_id,
          locationType: result.geometry.location_type,
          addressComponents: result.address_components || [],
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
   * Validates coordinates are within Portland bounds and retries without parenthetical content if needed
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
    
    // Validate coordinates are within Portland bounds
    if (result.success && result.coordinates) {
      if (!this.isWithinPortlandBounds(result.coordinates)) {
        console.warn(`[GeocodingService] Geocoded coordinates [${result.coordinates[0]}, ${result.coordinates[1]}] are outside Portland bounds for address: "${address}"`);
        console.warn(`[GeocodingService] Display name: "${result.displayName}"`);
        
        // Try again without parenthetical content if original address had parentheses
        if (address.includes('(') && address.includes(')')) {
          const addressWithoutParentheses = address.replace(/\s*\([^)]*\)\s*/g, '').trim();
          if (addressWithoutParentheses !== address) {
            console.warn(`[GeocodingService] Retrying geocoding without parenthetical content: "${addressWithoutParentheses}"`);
            const retryResult = await this.geocodeWithGoogle(addressWithoutParentheses, city, state);
            
            // Only use retry result if it's within bounds
            if (retryResult.success && retryResult.coordinates && this.isWithinPortlandBounds(retryResult.coordinates)) {
              console.log(`[GeocodingService] Retry successful - coordinates [${retryResult.coordinates[0]}, ${retryResult.coordinates[1]}] are within Portland bounds`);
              return {
                ...retryResult,
                geocodeWarning: 'Geocoded without parenthetical content due to initial out-of-bounds result',
              };
            } else {
              console.warn(`[GeocodingService] Retry also failed or out of bounds, keeping original result with warning`);
              return {
                ...result,
                geocodeWarning: `Coordinates [${result.coordinates[0]}, ${result.coordinates[1]}] are outside Portland bounds. May be incorrect.`,
                isApproximate: true,
              };
            }
          }
        } else {
          // No parentheses to remove, but coordinates are still out of bounds
          console.warn(`[GeocodingService] Coordinates are outside Portland bounds and no parenthetical content to remove`);
          return {
            ...result,
            geocodeWarning: `Coordinates [${result.coordinates[0]}, ${result.coordinates[1]}] are outside Portland bounds. May be incorrect.`,
            isApproximate: true,
          };
        }
      }
    }
    
    // TEMPORARILY DISABLED: Nominatim fallback
    // if (!result.success && result.error !== 'Address not found' && ENABLE_NOMINATIM_FALLBACK) {
    //   console.warn(`[GeocodingService] Google failed for "${address}", trying Nominatim fallback`);
    //   return await this.geocodeWithNominatim(address, city, state);
    // }
    
    return result;
  }

  /**
   * Try multiple geocoding strategies for an intersection address
   * Validates coordinates are within Portland bounds
   */
  async geocodeIntersection(address, city = 'Portland', state = 'OR') {
    // Extract the two streets (after removing parenthetical content for splitting)
    const addressForSplitting = address.replace(/\s*\([^)]*\)\s*/g, '').trim();
    const streets = addressForSplitting.split(/\s+&\s+|\s+AND\s+/i).map(s => s.trim()).filter(s => s);
    
    if (streets.length < 2) {
      // Not an intersection, just try the address as-is (which will handle validation)
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
        // Only return if coordinates are within Portland bounds
        // If out of bounds with warning, continue trying other formats
        if (result.coordinates && this.isWithinPortlandBounds(result.coordinates)) {
          return result;
        } else if (result.coordinates && !result.geocodeWarning) {
          // If coordinates exist but no warning, might be a different issue, still return
          return result;
        }
        // Otherwise, continue to next format (result has warning about out-of-bounds)
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
      const midpoint = [midLon, midLat];
      
      // Validate midpoint is within Portland bounds
      if (!this.isWithinPortlandBounds(midpoint)) {
        console.warn(`[GeocodingService] Calculated midpoint [${midLon}, ${midLat}] is outside Portland bounds for intersection: "${address}"`);
      }
      
      return {
        success: true,
        coordinates: midpoint,
        displayName: `Approximate intersection of ${street1} and ${street2}`,
        placeId: null, // No placeId for approximate intersections
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
   * Check if coordinates are within reasonable bounds for Portland, Oregon
   * Portland approximate bounds:
   * - Latitude: 45.4 to 45.7 (roughly)
   * - Longitude: -122.8 to -122.4 (roughly)
   * @param coordinates [lng, lat] coordinates to validate
   * @returns true if coordinates are within Portland bounds
   */
  isWithinPortlandBounds(coordinates) {
    if (!coordinates || coordinates.length !== 2) {
      return false;
    }
    
    const [lng, lat] = coordinates;
    
    // Portland bounds with reasonable buffer
    const PORTLAND_LAT_MIN = 45.3;
    const PORTLAND_LAT_MAX = 45.8;
    const PORTLAND_LNG_MIN = -123.0;
    const PORTLAND_LNG_MAX = -122.3;
    
    return (
      lat >= PORTLAND_LAT_MIN &&
      lat <= PORTLAND_LAT_MAX &&
      lng >= PORTLAND_LNG_MIN &&
      lng <= PORTLAND_LNG_MAX
    );
  }

  /**
   * Check if geocoded result represents a house address (not an intersection or street)
   * @param result Geocoding result with locationType and addressComponents
   * @returns true if this is a house address
   */
  isHouseAddress(result) {
    // Check if location type indicates a precise house location
    if (result.locationType === 'ROOFTOP') {
      console.log(`[GeocodingService] Detected house address: locationType=ROOFTOP`);
      return true;
    }
    
    // Check if address components include a street number (indicates specific house)
    if (result.addressComponents && Array.isArray(result.addressComponents)) {
      const hasStreetNumber = result.addressComponents.some(
        component => component.types && component.types.includes('street_number')
      );
      if (hasStreetNumber) {
        console.log(`[GeocodingService] Detected house address: has street_number in addressComponents`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Snap house address coordinates to the nearest point on the street
   * Uses Google Roads API to move the pin from the house to the street in front of it
   * @param coordinates [lng, lat] coordinates of the house
   * @returns Promise with snapped coordinates [lng, lat] or original coordinates if snapping fails
   */
  async snapHouseAddressToStreet(coordinates) {
    if (!this.useGoogle || !streetGeometryService.apiKey) {
      // Can't snap without Google API
      return coordinates;
    }
    
    try {
      // Convert [lng, lat] to {lat, lng} format for Roads API
      const [lng, lat] = coordinates;
      const point = { lat, lng };
      
      // Snap to roads (expects array of {lat, lng} objects)
      const snappedPoints = await streetGeometryService.snapToRoads([point]);
      
      if (snappedPoints && snappedPoints.length > 0) {
        const snapped = snappedPoints[0];
        // Convert back to [lng, lat] format
        const snappedCoords = [snapped.location.longitude, snapped.location.latitude];
        
        // Calculate distance moved (in meters, approximate)
        const distanceMoved = this.calculateDistance(coordinates, snappedCoords);
        
        // Only use snapped coordinates if movement is reasonable (< 100 meters)
        // This prevents snapping to a completely different street
        if (distanceMoved < 100) {
          console.log(`[GeocodingService] Snapped house address to street (moved ${distanceMoved.toFixed(1)}m)`);
          return snappedCoords;
        } else {
          console.warn(`[GeocodingService] Snapping moved point too far (${distanceMoved.toFixed(1)}m), keeping original coordinates`);
          return coordinates;
        }
      }
      
      // If snapping failed, return original coordinates
      return coordinates;
    } catch (error) {
      console.warn(`[GeocodingService] Failed to snap house address to street: ${error.message}`);
      // Return original coordinates on error
      return coordinates;
    }
  }

  /**
   * Calculate approximate distance between two coordinates in meters
   * Uses Haversine formula for great-circle distance
   * @param coord1 [lng, lat]
   * @param coord2 [lng, lat]
   * @returns distance in meters
   */
  calculateDistance(coord1, coord2) {
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;
    
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Geocode all stops for a route with limited parallelism
   */
  async geocodeStops(stops, city = 'Portland', state = 'OR') {
    const CONCURRENCY = 3; // Process 3 stops at a time to be respectful of rate limits
    const geocodedStops = new Array(stops.length);
    
    // Process stops in chunks
    for (let i = 0; i < stops.length; i += CONCURRENCY) {
      const chunk = stops.slice(i, i + CONCURRENCY);
      const chunkPromises = chunk.map(async (stop, index) => {
        const actualIndex = i + index;
        
        // Skip geocoding for stops marked to skip (e.g., LOADING ZONE, CAB LOAD ZONE)
        if (stop.skipGeocoding) {
          geocodedStops[actualIndex] = {
            ...stop,
            coordinates: null,
            skipGeocoding: true,
          };
          return;
        }
        
        // Skip geocoding for school stops that already have coordinates from schools.json
        if (stop.isSchoolStop && stop.coordinates && Array.isArray(stop.coordinates) && stop.coordinates.length === 2) {
          const schoolStopData = {
            ...stop,
            skipGeocoding: false,
          };
          
          if (!stop.neighborhood) {
            try {
              const neighborhoodResult = await neighborhoodService.getNeighborhood(stop.coordinates);
              if (neighborhoodResult.success && neighborhoodResult.neighborhood) {
                schoolStopData.neighborhood = neighborhoodResult.neighborhood;
              }
            } catch (error) {
              console.warn(`[GeocodingService] Failed to get neighborhood for school stop "${stop.address}":`, error.message);
            }
          }
          
          geocodedStops[actualIndex] = schoolStopData;
          return;
        }
        
        const address = stop.address;
        const isIntersection = address.includes('&') || address.includes(' AND ');
        
        let result;
        if (isIntersection) {
          result = await this.geocodeIntersection(address, city, state);
        } else {
          result = await this.geocodeAddress(address, city, state);
        }
        
        if (result.success) {
          let finalCoordinates = result.coordinates;
          
          if (!isIntersection && this.isHouseAddress(result)) {
            finalCoordinates = await this.snapHouseAddressToStreet(result.coordinates);
          }
          
          const stopData = {
            ...stop,
            coordinates: finalCoordinates,
            displayName: result.displayName,
            placeId: result.placeId || null,
          };
          
          if (result.isApproximate) {
            stopData.isApproximate = true;
            stopData.geocodeWarning = result.geocodeWarning || 'Intersection not found, using approximate location';
          }
          
          if (stopData.coordinates) {
            try {
              const neighborhoodResult = await neighborhoodService.getNeighborhood(stopData.coordinates);
              if (neighborhoodResult.success && neighborhoodResult.neighborhood) {
                stopData.neighborhood = neighborhoodResult.neighborhood;
              }
            } catch (error) {
              console.warn(`[GeocodingService] Failed to get neighborhood for stop "${stop.address}":`, error.message);
            }
          }
          
          geocodedStops[actualIndex] = stopData;
        } else {
          geocodedStops[actualIndex] = {
            ...stop,
            coordinates: null,
            geocodeError: result.error,
          };
        }
      });
      
      await Promise.all(chunkPromises);
      
      // Small delay between chunks to avoid hitting rate limits too fast
      if (i + CONCURRENCY < stops.length) {
        await new Promise(resolve => setTimeout(resolve, this.useGoogle ? 100 : 1000));
      }
    }
    
    // Check for duplicate coordinates and warn
    const coordinateMap = new Map();
    geocodedStops.forEach((stop, index) => {
      if (stop && stop.coordinates) {
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
   * Batch geocode multiple addresses with limited parallelism
   */
  async batchGeocode(addresses, city = 'Portland', state = 'OR') {
    const CONCURRENCY = 3;
    const results = new Array(addresses.length);
    
    for (let i = 0; i < addresses.length; i += CONCURRENCY) {
      const chunk = addresses.slice(i, i + CONCURRENCY);
      const chunkPromises = chunk.map(async (address, index) => {
        const actualIndex = i + index;
        const result = await this.geocodeAddress(address, city, state);
        results[actualIndex] = {
          address,
          ...result,
        };
      });
      
      await Promise.all(chunkPromises);
      
      // Rate limiting
      if (i + CONCURRENCY < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, this.useGoogle ? 100 : 1000));
      }
    }
    
    return results;
  }
}

// Export singleton instance
export const geocodingService = new GeocodingService();

// Also export class for testing or custom instances
export { GeocodingService };

