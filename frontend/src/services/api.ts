import { autocompleteCache } from '../utils/autocompleteCache';

const API_BASE = '/api';

export async function fetchFolderFiles(folderId: string) {
  const response = await fetch(`${API_BASE}/drive/folder/${folderId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch folder files');
  }
  return response.json();
}

export async function parseFolder(folderId: string) {
  const response = await fetch(`${API_BASE}/drive/folder/${folderId}/parse`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to parse folder');
  }
  return response.json();
}

export async function geocodeAddress(address: string, city = 'Portland', state = 'OR') {
  const response = await fetch(`${API_BASE}/geocode/address`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address, city, state }),
  });
  if (!response.ok) {
    throw new Error('Failed to geocode address');
  }
  return response.json();
}

export async function batchGeocode(addresses: string[], city = 'Portland', state = 'OR') {
  try {
    console.log(`[API] Calling batchGeocode with ${addresses.length} addresses`);
    const url = `${API_BASE}/geocode/batch`;
    console.log(`[API] URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ addresses, city, state }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Geocoding failed with status ${response.status}:`, errorText);
      
      // Check if backend is not running
      if (response.status === 0 || response.status === 500) {
        console.error('[API] Backend may not be running! Make sure the backend server is started on port 3001');
      }
      
      throw new Error(`Failed to geocode addresses: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`[API] Received geocoding response with ${data.results?.length || 0} results`);
    return data;
  } catch (error: any) {
    console.error('[API] Error in batchGeocode:', error);
    
    // Check if it's a network error (backend not running)
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      console.error('[API] Network error - backend server may not be running on port 3001');
      console.error('[API] Please start the backend with: cd backend && npm run dev');
    }
    
    throw error;
  }
}

export async function autocompleteAddress(
  query: string, 
  city = 'Portland', 
  state = 'OR',
  signal?: AbortSignal
) {
  // Check cache first
  const cached = autocompleteCache.get(query, city, state);
  if (cached !== null) {
    console.log(`[API] Cache hit for autocomplete: "${query}"`);
    return { suggestions: cached };
  }

  const params = new URLSearchParams({ q: query, city, state });
  const response = await fetch(`${API_BASE}/geocode/autocomplete?${params}`, {
    signal // Support request cancellation
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch autocomplete suggestions');
  }
  
  const data = await response.json();
  
  // Cache the results
  if (data.suggestions && data.suggestions.length > 0) {
    autocompleteCache.set(query, data.suggestions, city, state);
  }
  
  return data;
}

export async function reverseGeocode(lat: number, lng: number) {
  const response = await fetch(`${API_BASE}/geocode/reverse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lat, lng }),
  });
  if (!response.ok) {
    throw new Error('Failed to reverse geocode coordinates');
  }
  return response.json();
}

export async function calculateWalkingDistances(home: [number, number], stops: [number, number][]) {
  const response = await fetch(`${API_BASE}/routes/calculate-walking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ home, stops }),
  });
  if (!response.ok) {
    throw new Error('Failed to calculate walking distances');
  }
  return response.json();
}

// Neighborhood API methods
export async function getNeighborhoodFromCoordinates(coordinates: [number, number]) {
  const response = await fetch(`${API_BASE}/neighborhoods/from-coordinates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ coordinates }),
  });
  if (!response.ok) {
    throw new Error('Failed to get neighborhood from coordinates');
  }
  return response.json();
}

export async function batchGetNeighborhoods(coordinatesList: [number, number][]) {
  const response = await fetch(`${API_BASE}/neighborhoods/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ coordinatesList }),
  });
  if (!response.ok) {
    throw new Error('Failed to batch get neighborhoods');
  }
  return response.json();
}

export async function getNeighborhoodsFromRoutes(schoolId?: string | null) {
  const params = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : '';
  const response = await fetch(`${API_BASE}/neighborhoods/from-routes${params}`);
  if (!response.ok) {
    throw new Error('Failed to get neighborhoods from routes');
  }
  return response.json();
}

export async function getNeighborhoodsList(schoolId?: string | null) {
  const params = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : '';
  const response = await fetch(`${API_BASE}/neighborhoods/list${params}`);
  if (!response.ok) {
    throw new Error('Failed to get neighborhoods list');
  }
  return response.json();
}

