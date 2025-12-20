/**
 * Street Geometry Service
 * Finds full street geometry by finding endpoints and routing between them
 * Uses Google Geocoding API and Directions API
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { geocodingService } from './geocodingService.js';
import { directionsService } from './directionsService.js';
import { expandAddressForGeocoding } from '../utils/formatAddress.js';

// Load .env from backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
const GOOGLE_ROADS_API_URL = 'https://roads.googleapis.com/v1/snapToRoads';
const GOOGLE_PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const GOOGLE_GEOCODING_REVERSE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * StreetGeometryService class for finding full street geometry
 */
class StreetGeometryService {
  constructor() {
    this.apiKey = GOOGLE_API_KEY;
    if (!this.apiKey) {
      console.warn('[StreetGeometryService] No Google Maps API key found. Roads API features will not work.');
    } else {
      console.log('[StreetGeometryService] Initialized with Roads API support');
    }
  }

  /**
   * Format street name for geocoding
   */
  formatStreetName(streetName) {
    return expandAddressForGeocoding(streetName.trim());
  }

  /**
   * Geocode a street name with an optional address number
   */
  async geocodeStreetWithNumber(streetName, addressNumber, city = 'Portland', state = 'OR') {
    const formattedStreet = this.formatStreetName(streetName);
    const address = addressNumber ? `${addressNumber} ${formattedStreet}` : formattedStreet;
    const query = `${address}, ${city}, ${state}`;
    
    try {
      const result = await geocodingService.geocodeAddress(query, city, state);
      if (result.success) {
        return {
          coordinates: result.coordinates, // [lng, lat]
          displayName: result.displayName,
        };
      }
      return null;
    } catch (error) {
      console.warn(`[StreetGeometryService] Failed to geocode ${query}:`, error.message);
      return null;
    }
  }

  /**
   * Find street endpoints by trying different address numbers
   */
  async findStreetEndpoints(streetName, city = 'Portland', state = 'OR') {
    console.log(`[StreetGeometryService] Finding endpoints for: ${streetName}`);
    
    const addressNumbers = [1, 100, 500, 1000, 2000, 5000, 10000];
    const points = [];
    
    // First, try geocoding the street name without a number
    const basePoint = await this.geocodeStreetWithNumber(streetName, null, city, state);
    if (basePoint) {
      points.push(basePoint);
      console.log(`[StreetGeometryService] Found base point: ${basePoint.displayName}`);
    }
    
    // Try different address numbers to find points along the street
    for (const num of addressNumbers) {
      const point = await this.geocodeStreetWithNumber(streetName, num, city, state);
      if (point) {
        // Check if this is a new point (not duplicate)
        const isDuplicate = points.some(p => 
          Math.abs(p.coordinates[0] - point.coordinates[0]) < 0.0001 &&
          Math.abs(p.coordinates[1] - point.coordinates[1]) < 0.0001
        );
        
        if (!isDuplicate) {
          points.push(point);
          console.log(`[StreetGeometryService] Found point at ${num}: ${point.displayName}`);
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (points.length === 0) {
      console.warn(`[StreetGeometryService] No points found for street: ${streetName}`);
      return null;
    }
    
    if (points.length === 1) {
      // Only one point found, can't create a route
      console.warn(`[StreetGeometryService] Only one point found, cannot determine endpoints`);
      return {
        start: points[0].coordinates,
        end: points[0].coordinates,
        points: points,
      };
    }
    
    // Find the two points that are furthest apart
    let maxDistance = 0;
    let start = points[0].coordinates;
    let end = points[0].coordinates;
    
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const [lng1, lat1] = points[i].coordinates;
        const [lng2, lat2] = points[j].coordinates;
        
        // Calculate distance (Haversine formula simplified for small distances)
        const dLat = lat2 - lat1;
        const dLng = lng2 - lng1;
        const distance = Math.sqrt(dLat * dLat + dLng * dLng);
        
        if (distance > maxDistance) {
          maxDistance = distance;
          start = points[i].coordinates;
          end = points[j].coordinates;
        }
      }
    }
    
    console.log(`[StreetGeometryService] Found ${points.length} points, endpoints distance: ${(maxDistance * 111).toFixed(2)}km`);
    
    return {
      start, // [lng, lat]
      end,   // [lng, lat]
      points,
    };
  }

  /**
   * Snap coordinates to nearest road using Roads API
   * @param points Array of {lat, lng} objects
   * @returns Array of snapped points with place_id
   */
  async snapToRoads(points) {
    if (!this.apiKey || !points || points.length === 0) {
      return null;
    }
    
    // Roads API requires points in "lat,lng|lat,lng" format
    const pointsStr = points.map(p => `${p.lat},${p.lng}`).join('|');
    const url = `${GOOGLE_ROADS_API_URL}?path=${encodeURIComponent(pointsStr)}&key=${this.apiKey}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[StreetGeometryService] Roads API HTTP error: ${response.status}`, errorText);
        return null;
      }
      
      // Check if response has content
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error(`[StreetGeometryService] Roads API returned non-JSON: ${text.substring(0, 200)}`);
        return null;
      }
      
      const data = await response.json();
      
      // Check for API errors in response
      if (data.error) {
        console.error(`[StreetGeometryService] Roads API error:`, data.error);
        return null;
      }
      
      if (data.snappedPoints && data.snappedPoints.length > 0) {
        return data.snappedPoints.map(point => ({
          location: {
            latitude: point.location.latitude,
            longitude: point.location.longitude,
          },
          placeId: point.placeId,
          originalIndex: point.originalIndex,
        }));
      }
      
      return null;
    } catch (error) {
      console.error('[StreetGeometryService] Roads API error:', error.message);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to get street name
   */
  async reverseGeocode(lat, lng) {
    if (!this.apiKey) {
      return null;
    }
    
    const url = `${GOOGLE_GEOCODING_REVERSE_URL}?latlng=${lat},${lng}&key=${this.apiKey}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[StreetGeometryService] Reverse geocoding HTTP error: ${response.status}`, errorText);
        return null;
      }
      
      const data = await response.json();
      
      // Check for API errors
      if (data.error) {
        console.error(`[StreetGeometryService] Reverse geocoding API error:`, data.error);
        return null;
      }
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        // Find the route (street) component
        for (const result of data.results) {
          if (result.address_components) {
            const routeComponent = result.address_components.find(
              component => component.types.includes('route')
            );
            if (routeComponent) {
              return {
                streetName: routeComponent.long_name || routeComponent.short_name,
                fullAddress: result.formatted_address,
                placeId: result.place_id,
              };
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('[StreetGeometryService] Reverse geocoding error:', error);
      return null;
    }
  }

  /**
   * Get road geometry using Places API Place Details
   */
  async getRoadGeometry(placeId) {
    const url = `${GOOGLE_PLACES_API_URL}?place_id=${placeId}&fields=geometry,name&key=${this.apiKey}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Places API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.result) {
        return {
          name: data.result.name,
          geometry: data.result.geometry,
        };
      }
      
      return null;
    } catch (error) {
      console.error('[StreetGeometryService] Places API error:', error);
      return null;
    }
  }

  /**
   * Get full street geometry using Roads API
   * Strategy: Find points along the street, snap them to roads, then route between them
   */
  async getStreetGeometryWithRoadsAPI(streetName, stopCoordinates, city = 'Portland', state = 'OR') {
    const startTime = Date.now();
    
    // Validate stop coordinates
    if (!stopCoordinates || !Array.isArray(stopCoordinates) || stopCoordinates.length !== 2) {
      console.warn(`[StreetGeometryService] Invalid stop coordinates: ${stopCoordinates}`);
      return await this.getStreetGeometryWithEndpoints(streetName, city, state);
    }
    
    const [stopLng, stopLat] = stopCoordinates;
    
    // Validate coordinates are numbers
    if (typeof stopLat !== 'number' || typeof stopLng !== 'number' || 
        isNaN(stopLat) || isNaN(stopLng)) {
      console.warn(`[StreetGeometryService] Invalid coordinate values: lat=${stopLat}, lng=${stopLng}`);
      return await this.getStreetGeometryWithEndpoints(streetName, city, state);
    }
    
    console.log(`[StreetGeometryService] Getting geometry for: ${streetName} near [${stopLat}, ${stopLng}]`);
    
    try {
      // Step 1: Verify the stop is actually on the clicked street using reverse geocoding
      // This is critical - we need to confirm we're on the right street
      const stopStreetInfo = await this.reverseGeocode(stopLat, stopLng);
      if (!stopStreetInfo) {
        console.warn(`[StreetGeometryService] Could not reverse geocode stop location, falling back`);
        return await this.getStreetGeometryWithEndpoints(streetName, city, state);
      }
      
      // Normalize street names for comparison
      const normalizeStreetName = (name) => {
        return name.toLowerCase()
          .replace(/\b(street|st|road|rd|drive|dr|avenue|ave|blvd|boulevard|lane|ln|court|ct|place|pl|terrace|terr|circle|cir|parkway|pkwy|way|gate|gt)\b/g, '')
          .replace(/\b(north|south|east|west|northeast|northwest|southeast|southwest|n|s|e|w|ne|nw|se|sw)\b/g, '')
          .trim();
      };
      
      const clickedStreetNormalized = normalizeStreetName(streetName);
      const foundStreetNormalized = normalizeStreetName(stopStreetInfo.streetName);
      
      // Check if the found street matches the clicked street
      const streetMatches = clickedStreetNormalized.includes(foundStreetNormalized) || 
                           foundStreetNormalized.includes(clickedStreetNormalized) ||
                           clickedStreetNormalized === foundStreetNormalized;
      
      if (!streetMatches) {
        console.warn(`[StreetGeometryService] Street mismatch: clicked "${streetName}", but stop is on "${stopStreetInfo.streetName}"`);
        console.warn(`[StreetGeometryService] Using the actual street at stop location: "${stopStreetInfo.streetName}"`);
        // Use the actual street name from reverse geocoding
        streetName = stopStreetInfo.streetName;
      } else {
        console.log(`[StreetGeometryService] ✅ Verified: stop is on "${stopStreetInfo.streetName}"`);
      }
      
      // Step 3: Find points along the ACTUAL street by geocoding addresses
      // We'll use the verified street name from reverse geocoding
      const formattedStreet = this.formatStreetName(streetName);
      const searchPoints = [{ lat: stopLat, lng: stopLng }]; // Start with stop location
      
      // Search for addresses at different numbers on the street
      const addressNumbers = [1, 50, 100, 200, 500, 1000, 2000];
      const maxPoints = 8; // Limit total points
      const maxDistance = 2000; // Maximum distance from stop (2km)
      
      console.log(`[StreetGeometryService] Finding points along "${streetName}" by geocoding addresses...`);
      
      for (const num of addressNumbers) {
        if (searchPoints.length >= maxPoints) break;
        
        // Try geocoding addresses on the street
        const testAddress = `${num} ${formattedStreet}`;
        const geocodeResult = await geocodingService.geocodeAddress(
          `${testAddress}, ${city}, ${state}`
        );
        
        if (geocodeResult.success) {
          const [resultLng, resultLat] = geocodeResult.coordinates;
          
          // Calculate distance from stop (in meters)
          const distanceFromStop = Math.sqrt(
            Math.pow((resultLat - stopLat) * 111000, 2) +
            Math.pow((resultLng - stopLng) * 111000 * Math.cos(stopLat * Math.PI / 180), 2)
          );
          
          if (distanceFromStop < maxDistance) {
            // CRITICAL: Verify this point is actually on the correct street
            const pointStreetInfo = await this.reverseGeocode(resultLat, resultLng);
            if (pointStreetInfo) {
              const pointStreetNormalized = normalizeStreetName(pointStreetInfo.streetName);
              const isOnCorrectStreet = clickedStreetNormalized.includes(pointStreetNormalized) || 
                                       pointStreetNormalized.includes(clickedStreetNormalized) ||
                                       pointStreetNormalized === clickedStreetNormalized ||
                                       foundStreetNormalized.includes(pointStreetNormalized) ||
                                       pointStreetNormalized.includes(foundStreetNormalized);
              
              if (!isOnCorrectStreet) {
                console.log(`[StreetGeometryService] Skipping point at ${num}: geocoded to "${pointStreetInfo.streetName}" instead of "${streetName}"`);
                await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
                continue; // Skip this point - it's on a different street
              }
            }
            
            // Check for duplicates
            const isDuplicate = searchPoints.some(p => 
              Math.abs(p.lat - resultLat) < 0.0001 &&
              Math.abs(p.lng - resultLng) < 0.0001
            );
            
            if (!isDuplicate) {
              searchPoints.push({ lat: resultLat, lng: resultLng });
              console.log(`[StreetGeometryService] ✅ Found point at ${num}: [${resultLat}, ${resultLng}] (${distanceFromStop.toFixed(0)}m from stop)`);
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
      }
      
      // If we only have the stop point, try searching with just the street name
      if (searchPoints.length < 3) {
        const streetOnlyResult = await geocodingService.geocodeAddress(
          `${formattedStreet}, ${city}, ${state}`
        );
        
        if (streetOnlyResult.success) {
          const [resultLng, resultLat] = streetOnlyResult.coordinates;
          const distanceFromStop = Math.sqrt(
            Math.pow((resultLat - stopLat) * 111000, 2) +
            Math.pow((resultLng - stopLng) * 111000 * Math.cos(stopLat * Math.PI / 180), 2)
          );
          
          if (distanceFromStop < maxDistance) {
            // Verify this point is on the correct street
            const pointStreetInfo = await this.reverseGeocode(resultLat, resultLng);
            if (pointStreetInfo) {
              const pointStreetNormalized = normalizeStreetName(pointStreetInfo.streetName);
              const isOnCorrectStreet = foundStreetNormalized.includes(pointStreetNormalized) ||
                                       pointStreetNormalized.includes(foundStreetNormalized);
              
              if (isOnCorrectStreet) {
                const isDuplicate = searchPoints.some(p => 
                  Math.abs(p.lat - resultLat) < 0.0001 &&
                  Math.abs(p.lng - resultLng) < 0.0001
                );
                
                if (!isDuplicate) {
                  searchPoints.push({ lat: resultLat, lng: resultLng });
                  console.log(`[StreetGeometryService] ✅ Found point from street name: [${resultLat}, ${resultLng}] (${distanceFromStop.toFixed(0)}m from stop)`);
                }
              }
            }
          }
        }
      }
      
      // Step 4: Snap all points to roads using Roads API
      console.log(`[StreetGeometryService] Snapping ${searchPoints.length} points to roads...`);
      const snappedPoints = await this.snapToRoads(searchPoints);
      
      if (!snappedPoints || snappedPoints.length < 2) {
        console.warn(`[StreetGeometryService] Could not snap enough points to roads (got ${snappedPoints ? snappedPoints.length : 0}), falling back to endpoint method`);
        return await this.getStreetGeometryWithEndpoints(streetName, city, state);
      }
      
      // Step 4a: Verify each snapped point is still on the correct street using reverse geocoding
      // This is critical to filter out points that snapped to nearby streets
      console.log(`[StreetGeometryService] Verifying ${snappedPoints.length} snapped points are on correct street...`);
      const verifiedPoints = [];
      
      for (const snappedPoint of snappedPoints) {
        const pointStreetInfo = await this.reverseGeocode(
          snappedPoint.location.latitude, 
          snappedPoint.location.longitude
        );
        
        if (pointStreetInfo) {
          const pointStreetNormalized = normalizeStreetName(pointStreetInfo.streetName);
          const isOnCorrectStreet = foundStreetNormalized.includes(pointStreetNormalized) ||
                                   pointStreetNormalized.includes(foundStreetNormalized) ||
                                   pointStreetNormalized === foundStreetNormalized;
          
          if (isOnCorrectStreet) {
            verifiedPoints.push(snappedPoint);
            console.log(`[StreetGeometryService] ✅ Verified point on "${pointStreetInfo.streetName}"`);
          } else {
            console.log(`[StreetGeometryService] ❌ Rejected point: snapped to "${pointStreetInfo.streetName}" instead of target street`);
          }
        } else {
          // If reverse geocoding fails, include it but log warning
          console.warn(`[StreetGeometryService] ⚠️  Could not verify point, including anyway`);
          verifiedPoints.push(snappedPoint);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50)); // Rate limiting for reverse geocoding
      }
      
      if (verifiedPoints.length < 2) {
        console.warn(`[StreetGeometryService] Not enough verified points (${verifiedPoints.length}), falling back`);
        return await this.getStreetGeometryWithEndpoints(streetName, city, state);
      }
      
      // Step 4b: Filter to only points on the same road (same place_id) from verified points
      const placeIds = new Set(verifiedPoints.map(p => p.placeId).filter(Boolean));
      
      let sameRoadPoints;
      if (placeIds.size === 0) {
        console.warn(`[StreetGeometryService] No place_ids found after verification, using verified points directly`);
        sameRoadPoints = verifiedPoints;
      } else {
        // If we have multiple place_ids, use the one with the most points (most likely the correct road)
        const placeIdCounts = {};
        verifiedPoints.forEach(p => {
          if (p.placeId) {
            placeIdCounts[p.placeId] = (placeIdCounts[p.placeId] || 0) + 1;
          }
        });
        
        const primaryPlaceId = Object.keys(placeIdCounts).reduce((a, b) => 
          placeIdCounts[a] > placeIdCounts[b] ? a : b
        );
        
        sameRoadPoints = verifiedPoints.filter(p => p.placeId === primaryPlaceId);
        
        console.log(`[StreetGeometryService] Found ${sameRoadPoints.length} verified points on same road (place_id: ${primaryPlaceId})`);
        
        // If place_id filtering is too strict, use all verified points
        if (sameRoadPoints.length < 2) {
          console.warn(`[StreetGeometryService] Not enough points on same place_id, using all verified points`);
          sameRoadPoints = verifiedPoints;
        }
      }
      
      if (sameRoadPoints.length < 2) {
        console.warn(`[StreetGeometryService] Not enough points after filtering, falling back`);
        return await this.getStreetGeometryWithEndpoints(streetName, city, state);
      }
      
      console.log(`[StreetGeometryService] Using ${sameRoadPoints.length} verified points on correct street`);
      
      // Step 5: Find endpoints (furthest points on the same road)
      let maxSegmentDistance = 0;
      let startPoint = sameRoadPoints[0];
      let endPoint = sameRoadPoints[0];
      
      for (let i = 0; i < sameRoadPoints.length; i++) {
        for (let j = i + 1; j < sameRoadPoints.length; j++) {
          const p1 = sameRoadPoints[i].location;
          const p2 = sameRoadPoints[j].location;
          const dist = Math.sqrt(
            Math.pow((p1.latitude - p2.latitude) * 111000, 2) +
            Math.pow((p1.longitude - p2.longitude) * 111000 * Math.cos(p1.latitude * Math.PI / 180), 2)
          );
          
          if (dist > maxSegmentDistance) {
            maxSegmentDistance = dist;
            startPoint = sameRoadPoints[i];
            endPoint = sameRoadPoints[j];
          }
        }
      }
      
      console.log(`[StreetGeometryService] Endpoints distance: ${maxSegmentDistance.toFixed(0)}m`);
      
      // Step 6: Use ALL snapped points as waypoints to force route to stay on same road
      // Sort points by originalIndex (from Roads API) to maintain order along the street
      const sortedPoints = [...sameRoadPoints].sort((a, b) => {
        // Use originalIndex if available, otherwise sort by distance from stop
        if (a.originalIndex !== undefined && b.originalIndex !== undefined) {
          return a.originalIndex - b.originalIndex;
        }
        // Fallback: sort by distance from stop location
        const distA = Math.sqrt(
          Math.pow((a.location.latitude - stopLat) * 111000, 2) +
          Math.pow((a.location.longitude - stopLng) * 111000 * Math.cos(stopLat * Math.PI / 180), 2)
        );
        const distB = Math.sqrt(
          Math.pow((b.location.latitude - stopLat) * 111000, 2) +
          Math.pow((b.location.longitude - stopLng) * 111000 * Math.cos(stopLat * Math.PI / 180), 2)
        );
        return distA - distB;
      });
      
      // Convert to [lat, lng] format for Directions API
      const waypoints = sortedPoints.map(p => [p.location.latitude, p.location.longitude]);
      
      console.log(`[StreetGeometryService] Routing with ${waypoints.length} waypoints to constrain to same road...`);
      const routeResult = await directionsService.getRoute(waypoints);
      
      if (!routeResult.success) {
        // Fallback: use snapped points directly (connect them in order)
        console.warn(`[StreetGeometryService] Routing failed, using snapped points directly`);
        const fallbackGeometry = sortedPoints.map(p => [p.location.latitude, p.location.longitude]);
        const lats = fallbackGeometry.map(c => c[0]);
        const lngs = fallbackGeometry.map(c => c[1]);
        
        return {
          success: true,
          geometry: fallbackGeometry,
          bounds: {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs),
          },
          responseTime: Date.now() - startTime,
          method: 'roads_api_snapped_points',
        };
      }
      
      // Calculate bounds from route geometry
      const lats = routeResult.coordinates.map(c => c[0]);
      const lngs = routeResult.coordinates.map(c => c[1]);
      
      const bounds = {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      };
      
      const responseTime = Date.now() - startTime;
      console.log(`[StreetGeometryService] ✅ Street geometry found using Roads API: ${routeResult.coordinates.length} points (${responseTime}ms)`);
      
      return {
        success: true,
        geometry: routeResult.coordinates, // [lat, lng][] for Leaflet
        bounds,
        responseTime,
        method: 'roads_api',
      };
      
    } catch (error) {
      console.error(`[StreetGeometryService] ❌ Error with Roads API:`, error);
      console.error(`[StreetGeometryService] Error stack:`, error.stack);
      
      // Fallback to original method, but wrap in try-catch to prevent further errors
      try {
        console.log(`[StreetGeometryService] Falling back to endpoint method...`);
        return await this.getStreetGeometryWithEndpoints(streetName, city, state);
      } catch (fallbackError) {
        console.error(`[StreetGeometryService] ❌ Fallback method also failed:`, fallbackError);
        return {
          success: false,
          error: `Failed to get street geometry: ${error.message || 'Unknown error'}`,
        };
      }
    }
  }

  /**
   * Main method to get street geometry - uses Roads API if stop coordinates provided
   */
  async getStreetGeometry(streetName, city = 'Portland', state = 'OR', stopCoordinates = null) {
    // If stop coordinates provided, use Roads API method
    if (stopCoordinates && stopCoordinates.length === 2 && this.apiKey) {
      return await this.getStreetGeometryWithRoadsAPI(streetName, stopCoordinates, city, state);
    }
    
    // Otherwise, use original endpoint method
    return await this.getStreetGeometryWithEndpoints(streetName, city, state);
  }

  /**
   * Get full street geometry by routing between endpoints (original method, kept as fallback)
   */
  async getStreetGeometryWithEndpoints(streetName, city = 'Portland', state = 'OR') {
    const startTime = Date.now();
    console.log(`[StreetGeometryService] Getting geometry for: ${streetName}, ${city}, ${state}`);
    
    try {
      // Step 1: Find endpoints
      const endpoints = await this.findStreetEndpoints(streetName, city, state);
      
      if (!endpoints) {
        return {
          success: false,
          error: 'Could not find street endpoints',
        };
      }
      
      // If start and end are the same, we only have one point
      if (endpoints.start[0] === endpoints.end[0] && endpoints.start[1] === endpoints.end[1]) {
        // Return a small circle around the point as fallback
        const [lng, lat] = endpoints.start;
        const radius = 0.001; // ~100 meters
        const circlePoints = [];
        for (let i = 0; i < 32; i++) {
          const angle = (i / 32) * 2 * Math.PI;
          circlePoints.push([
            lat + radius * Math.cos(angle),
            lng + radius * Math.sin(angle),
          ]);
        }
        circlePoints.push(circlePoints[0]); // Close the circle
        
        return {
          success: true,
          geometry: circlePoints, // [lat, lng][] for Leaflet
          bounds: {
            north: lat + radius,
            south: lat - radius,
            east: lng + radius,
            west: lng - radius,
          },
          isApproximate: true,
        };
      }
      
      // Step 2: Get route between endpoints using Directions API
      // Directions API expects [lat, lng] format
      const startCoords = [endpoints.start[1], endpoints.start[0]]; // Convert [lng, lat] to [lat, lng]
      const endCoords = [endpoints.end[1], endpoints.end[0]];
      
      console.log(`[StreetGeometryService] Routing from [${startCoords[0]}, ${startCoords[1]}] to [${endCoords[0]}, ${endCoords[1]}]`);
      
      const routeResult = await directionsService.getRoute([startCoords, endCoords]);
      
      if (!routeResult.success) {
        // Fallback: try reverse direction
        console.log(`[StreetGeometryService] Route failed, trying reverse direction`);
        const reverseResult = await directionsService.getRoute([endCoords, startCoords]);
        
        if (!reverseResult.success) {
          // Final fallback: straight line
          console.warn(`[StreetGeometryService] Both directions failed, using straight line`);
          return {
            success: true,
            geometry: [startCoords, endCoords],
            bounds: {
              north: Math.max(startCoords[0], endCoords[0]),
              south: Math.min(startCoords[0], endCoords[0]),
              east: Math.max(startCoords[1], endCoords[1]),
              west: Math.min(startCoords[1], endCoords[1]),
            },
            isApproximate: true,
          };
        }
        
        // Reverse the coordinates
        reverseResult.coordinates = reverseResult.coordinates.reverse();
        routeResult.success = true;
        routeResult.coordinates = reverseResult.coordinates;
      }
      
      // Calculate bounds from geometry
      const lats = routeResult.coordinates.map(c => c[0]);
      const lngs = routeResult.coordinates.map(c => c[1]);
      
      const bounds = {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      };
      
      const responseTime = Date.now() - startTime;
      console.log(`[StreetGeometryService] ✅ Street geometry found: ${routeResult.coordinates.length} points (${responseTime}ms)`);
      
      return {
        success: true,
        geometry: routeResult.coordinates, // [lat, lng][] for Leaflet
        bounds,
        responseTime,
      };
      
    } catch (error) {
      console.error(`[StreetGeometryService] ❌ Error getting street geometry:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const streetGeometryService = new StreetGeometryService();

// Also export class for testing
export { StreetGeometryService };












