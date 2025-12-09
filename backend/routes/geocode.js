import express from 'express';
import { geocodingService } from '../services/geocodingService.js';

const router = express.Router();

// Geocode an address using Google Maps Geocoding API (with Nominatim fallback)
router.post('/address', async (req, res) => {
  try {
    const { address, city = 'Portland', state = 'OR' } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const result = await geocodingService.geocodeAddress(address, city, state);

    if (result.success) {
      res.json({
        address,
        coordinates: result.coordinates, // [lng, lat] for Leaflet
        displayName: result.displayName,
      });
    } else {
      res.status(404).json({ error: result.error || 'Address not found' });
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Autocomplete addresses using OpenStreetMap Nominatim
router.get('/autocomplete', async (req, res) => {
  try {
    const { q, city = 'Portland', state = 'OR' } = req.query;

    if (!q || q.trim().length < 3) {
      return res.json({ suggestions: [] });
    }

    // Construct search query
    const query = `${q}, ${city}, ${state}`;
    const encodedQuery = encodeURIComponent(query);

    // Use Nominatim API for autocomplete (limit to 5 results)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=5&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'PPS-Bus-Maps/1.0', // Required by Nominatim
        },
      }
    );

    if (!response.ok) {
      return res.json({ suggestions: [] });
    }

    const data = await response.json();

    // Helper function to format a concise address from Nominatim result
    const formatConciseAddress = (result) => {
      if (!result.address) {
        // Fallback to display_name if address details aren't available
        return result.display_name.split(',')[0].trim();
      }

      const addr = result.address;
      const parts = [];

      // Add house number if available
      if (addr.house_number) {
        parts.push(addr.house_number);
      }

      // Add street name (try different possible fields)
      const streetName = addr.road || addr.street || addr.pedestrian || addr.path || addr.footway || addr.cycleway;
      if (streetName) {
        parts.push(streetName);
      }

      // If we have parts, join them; otherwise fallback to first part of display_name
      if (parts.length > 0) {
        return parts.join(' ');
      }

      // Fallback: take first part of display_name (usually the street address)
      return result.display_name.split(',')[0].trim();
    };

    const suggestions = data.map((result) => {
      const conciseAddress = formatConciseAddress(result);
      return {
        displayName: conciseAddress,
        address: conciseAddress,
        coordinates: [parseFloat(result.lon), parseFloat(result.lat)], // [lng, lat] for Leaflet
      };
    });

    res.json({ suggestions });
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.json({ suggestions: [] });
  }
});

// Reverse geocode coordinates to get street name
router.post('/reverse', async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Valid lat and lng coordinates are required' });
    }

    // Use Nominatim reverse geocoding API
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
      {
        headers: {
          'User-Agent': 'PPS-Bus-Maps/1.0', // Required by Nominatim
        },
      }
    );

    if (!response.ok) {
      return res.status(500).json({ error: 'Reverse geocoding service unavailable' });
    }

    const data = await response.json();

    if (!data || !data.address) {
      return res.json({ streetName: null });
    }

    // Extract street name from address components
    // Try different possible fields for street name
    const address = data.address;
    const streetName = 
      address.road ||
      address.street ||
      address.pedestrian ||
      address.path ||
      address.footway ||
      address.cycleway ||
      null;

    // If we have a street name, format it nicely
    let formattedStreetName = null;
    if (streetName) {
      // Combine with direction if available
      const direction = address.city_district || 
                       (address.suburb && address.suburb.match(/^(North|South|East|West|Northeast|Northwest|Southeast|Southwest)/i)?.[0]) ||
                       null;
      
      // Combine with street type if not already included
      const streetType = address.road_type || null;
      
      // Build formatted name
      if (direction && !streetName.toUpperCase().includes(direction.toUpperCase().substring(0, 2))) {
        formattedStreetName = `${direction} ${streetName}`;
      } else {
        formattedStreetName = streetName;
      }
    }

    res.json({
      streetName: formattedStreetName,
      fullAddress: data.display_name,
      address: data.address,
    });
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch geocode multiple addresses
router.post('/batch', async (req, res) => {
  try {
    const { addresses, city = 'Portland', state = 'OR' } = req.body;

    console.log(`[Geocode] Batch request: ${addresses?.length || 0} addresses`);

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: 'Addresses array is required' });
    }

    const results = await geocodingService.batchGeocode(addresses, city, state);

    console.log(`[Geocode] Batch complete: ${results.filter(r => r.success).length}/${results.length} successful`);
    res.json({ results });
  } catch (error) {
    console.error('[Geocode] Batch geocoding error:', error);
    console.error('[Geocode] Error stack:', error.stack);
    res.status(500).json({ error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
  }
});

export { router as geocodeRouter };

