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

export async function autocompleteAddress(query: string, city = 'Portland', state = 'OR') {
  const params = new URLSearchParams({ q: query, city, state });
  const response = await fetch(`${API_BASE}/geocode/autocomplete?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch autocomplete suggestions');
  }
  return response.json();
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

