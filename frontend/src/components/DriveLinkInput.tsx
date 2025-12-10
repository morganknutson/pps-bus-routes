import { useState } from 'react';
import { useStore } from '../store/useStore';
import { parseFolder } from '../services/api';
import { batchGeocode } from '../services/api';

export function DriveLinkInput() {
  const [link, setLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setRoutes, setLoading, setError, updateStopCoordinates } = useStore();

  const extractFolderId = (url: string): string | null => {
    // Match: https://drive.google.com/drive/folders/FOLDER_ID
    const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const handleFetch = async () => {
    const folderId = extractFolderId(link);
    if (!folderId) {
      setError('Invalid Google Drive folder link');
      return;
    }

    setIsLoading(true);
    setLoading(true);
    setError(undefined);

    try {
      // Parse all PDFs in folder
      const { routes } = await parseFolder(folderId);
      
      if (routes.length === 0) {
        setError('No routes found in folder');
        setLoading(false);
        setIsLoading(false);
        return;
      }

      // Set routes (without coordinates initially)
      setRoutes(routes);

      // Geocode all stops in batches
      for (const route of routes) {
        const addresses = route.stops
          .filter(stop => !stop.coordinates)
          .map(stop => stop.address);

        if (addresses.length > 0) {
          try {
            const { results } = await batchGeocode(addresses);
            
            // Import validation function
            const { validateLngLat } = await import('../utils/coordinates');
            
            // Update stops with coordinates
            results.forEach((result: any, index: number) => {
              const stop = route.stops.find(s => s.address === addresses[index]);
              if (stop && result.success && result.coordinates) {
                // Validate coordinates before updating
                if (validateLngLat(result.coordinates)) {
                  updateStopCoordinates(route.id, stop.id, result.coordinates);
                } else {
                  console.error('[DriveLinkInput] Invalid coordinates from geocoding:', result.coordinates);
                }
              }
            });
          } catch (error) {
            console.error(`Failed to geocode stops for ${route.name}:`, error);
          }
        }
      }

      setLoading(false);
    } catch (error: any) {
      setError(error.message || 'Failed to fetch routes');
      setLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', borderBottom: '1px solid #ddd' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="text"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Paste Google Drive folder link here..."
          style={{
            flex: 1,
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
        <button
          onClick={handleFetch}
          disabled={isLoading || !link}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#4ECDC4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? 'Loading...' : 'Fetch Routes'}
        </button>
      </div>
      <p style={{ fontSize: '12px', color: '#666', marginTop: '0.5rem' }}>
        Example: https://drive.google.com/drive/folders/1BC03MH02DFuUL6teeq4jkcT2THRGgzxj
      </p>
    </div>
  );
}




