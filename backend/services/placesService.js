import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.warn('⚠️  GOOGLE_API_KEY not found in environment variables');
}

/**
 * Infer school type(s) from name - returns array to support hybrid schools
 * @param {string} schoolName - Name of the school
 * @returns {('Elementary School' | 'Middle School' | 'High School')[]}
 */
export function getSchoolTypes(schoolName) {
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
  
  // Hybrid schools - schools that serve multiple grade levels
  const hybridSchools = {
    'access': ['Elementary School', 'Middle School'],
  };
  
  for (const [key, hybridTypes] of Object.entries(hybridSchools)) {
    if (name.includes(key)) {
      // Add all hybrid types if not already present
      hybridTypes.forEach(type => {
        if (!types.includes(type)) {
          types.push(type);
        }
      });
    }
  }
  
  // Default to elementary if no types found
  if (types.length === 0) {
    types.push('Elementary School');
  }
  
  return types;
}

/**
 * Legacy function for backward compatibility - returns first type
 * @param {string} schoolName - Name of the school
 * @returns {'Elementary School' | 'Middle School' | 'High School'}
 */
function getSchoolType(schoolName) {
  const types = getSchoolTypes(schoolName);
  return types[0];
}

/**
 * Search for a place using Google Places API (New)
 * @param {string} query - Search query (e.g., "Lincoln High School Portland Oregon")
 * @param {object} options - Optional search parameters
 * @param {object} options.locationBias - Location bias (circle)
 * @returns {Promise<{success: boolean, place?: object, error?: string}>}
 */
export async function searchPlace(query, options = {}) {
  if (!API_KEY) {
    return {
      success: false,
      error: 'Google Places API key not configured'
    };
  }

  try {
    const url = `https://places.googleapis.com/v1/places:searchText`;
    
    const requestBody = {
      textQuery: query
    };

    // Add location bias if provided (prefers results in the specified area)
    if (options.locationBias) {
      requestBody.locationBias = options.locationBias;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
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
      return {
        success: true,
        place: {
          id: place.id,
          name: place.displayName?.text || null,
          address: place.formattedAddress || null,
          location: place.location ? {
            lat: place.location.latitude,
            lng: place.location.longitude
          } : null,
          coordinates: place.location ? [
            place.location.longitude, // [lng, lat] format for consistency
            place.location.latitude
          ] : null
        }
      };
    } else {
      return {
        success: false,
        error: 'No places found for query'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Search for a school by name in Portland, Oregon
 * @param {string} schoolName - Name of the school
 * @returns {Promise<{success: boolean, place?: object, error?: string}>}
 */
export async function searchSchool(schoolName) {
  // Get school types (array to support hybrid schools) and include them in the search query
  const schoolTypes = getSchoolTypes(schoolName);
  
  // Construct query with school name, all types, and location context
  // For hybrid schools, include all types (e.g., "ACCESS Elementary School Middle School Portland Oregon")
  const typeString = schoolTypes.join(' ');
  const query = `${schoolName} ${typeString} Portland Oregon`;
  
  // Portland, Oregon coordinates (approximate center)
  // Latitude: 45.5152, Longitude: -122.6784
  // Using a circle with ~15km radius to cover all of Portland metro area
  const portlandLocationBias = {
    circle: {
      center: {
        latitude: 45.5152,
        longitude: -122.6784
      },
      radius: 15000 // 15km in meters - covers Portland metro area
    }
  };
  
  console.log(`[Places API] Searching for: "${query}" (biased to Portland, OR)`);
  
  const result = await searchPlace(query, {
    locationBias: portlandLocationBias
  });

  // Strict validation: reject results that are not in Portland, OR
  if (result.success && result.place && result.place.address) {
    const address = result.place.address.toLowerCase();
    // Check if address contains Portland, OR indicators
    const isPortland = address.includes('portland') && 
                      (address.includes('or ') || address.includes('oregon') || address.includes(', or'));
    
    // Also check coordinates - Portland is roughly lat 45.4-45.6, lng -122.4 to -122.8
    let isInPortlandArea = false;
    if (result.place.coordinates && result.place.coordinates.length === 2) {
      const [lng, lat] = result.place.coordinates;
      isInPortlandArea = lat >= 45.4 && lat <= 45.6 && lng >= -122.8 && lng <= -122.4;
    }
    
    if (!isPortland && !isInPortlandArea) {
      console.warn(`[Places API] Rejecting result for "${schoolName}": Not in Portland, OR`);
      console.warn(`  Address: ${result.place.address}`);
      console.warn(`  Coordinates: ${result.place.coordinates}`);
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
 * @param {string} placeId - Google Place ID
 * @returns {Promise<{success: boolean, place?: object, error?: string}>}
 */
export async function getPlaceDetails(placeId) {
  if (!API_KEY) {
    return {
      success: false,
      error: 'Google Places API key not configured'
    };
  }

  try {
    const url = `https://places.googleapis.com/v1/places/${placeId}`;
    
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': API_KEY,
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

    return {
      success: true,
      place: {
        id: data.id,
        name: data.displayName?.text || null,
        address: data.formattedAddress || null,
        location: data.location ? {
          lat: data.location.latitude,
          lng: data.location.longitude
        } : null,
        coordinates: data.location ? [
          data.location.longitude, // [lng, lat] format
          data.location.latitude
        ] : null
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

